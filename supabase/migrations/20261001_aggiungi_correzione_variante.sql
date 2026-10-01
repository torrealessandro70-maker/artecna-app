begin;

-- Crea solo una lavorazione in bozza: approva_variante rivalida le correttive.
-- P2091 input/sessione; P2092 autorizzazione; P2093 destinazione/contratto;
-- P2094 componente; P2095 SAL/residuo incoerente; P2096 residuo insufficiente;
-- P2097 eliminazione economica; P2098 conflitto/inserimento.

do $preflight$
declare
  v_tabella text;
  v_colonne text;
  v_colonna text;
begin
  if current_user <> 'postgres' or session_user <> 'postgres'
    or current_setting('server_version_num')::integer / 10000 <> 17 then
    raise exception 'Installazione prevista come postgres su PostgreSQL 17';
  end if;
  if (select count(*) from pg_catalog.pg_auth_members
      where roleid = 'artecna_varianti_rpc'::regrole and member = 'postgres'::regrole) <> 1
    or not exists (
      select 1 from pg_catalog.pg_auth_members
      where roleid = 'artecna_varianti_rpc'::regrole and member = 'postgres'::regrole
        and grantor = 'supabase_admin'::regrole
        and admin_option and not inherit_option and not set_option
    )
    or pg_has_role('postgres', 'artecna_varianti_rpc', 'SET')
    or has_schema_privilege('artecna_varianti_rpc', 'public', 'CREATE') then
    raise exception 'Membership o privilegi temporanei iniziali inattesi';
  end if;
  if not has_schema_privilege('artecna_varianti_rpc', 'artecna_guardie', 'USAGE')
    or not has_schema_privilege('artecna_varianti_rpc', 'public', 'USAGE')
    or not exists (select 1 from pg_catalog.pg_roles
      where rolname = 'artecna_varianti_rpc' and not rolcanlogin and not rolsuper and rolbypassrls) then
    raise exception 'Schema o ruolo tecnico non conformi';
  end if;
  for v_tabella, v_colonne in
    select * from (values
      ('cantieri', 'id,preventivo_contrattuale_id'),
      ('preventivi_cantiere', 'id,cantiere_id'),
      ('varianti_cantiere', 'id,cantiere_id,preventivo_contrattuale_id,stato'),
      ('variante_lavorazioni', 'id,variante_id,numero_riga,operazione,descrizione,unita_misura,note,quantita_delta,prezzo_unitario,delta_contratto,riferimento_preventivo_lavorazione_id,riferimento_variante_lavorazione_id,created_at')
    ) as permessi(tabella, colonne)
  loop
    foreach v_colonna in array string_to_array(v_colonne, ',') loop
      if not has_column_privilege('artecna_varianti_rpc', 'public.' || v_tabella, v_colonna, 'SELECT') then
        raise exception 'Privilegio SELECT mancante su %.%; nessuna ACL tabella modificata', v_tabella, v_colonna;
      end if;
    end loop;
  end loop;
  if not has_function_privilege('artecna_varianti_rpc',
    'artecna_guardie.calcola_residuo_componente(text,bigint,uuid,uuid)', 'EXECUTE') then
    raise exception 'EXECUTE helper residuo mancante';
  end if;
  foreach v_colonna in array array[
    'variante_id', 'numero_riga', 'operazione', 'descrizione', 'unita_misura',
    'quantita_delta', 'prezzo_unitario', 'delta_contratto', 'note',
    'riferimento_preventivo_lavorazione_id', 'riferimento_variante_lavorazione_id',
    'variante_sorgente_id', 'indice_voce_sorgente'
  ] loop
    if not has_column_privilege('artecna_varianti_rpc', 'public.variante_lavorazioni', v_colonna, 'INSERT') then
      raise exception 'Privilegio INSERT mancante su variante_lavorazioni.%', v_colonna;
    end if;
  end loop;
  -- FOR UPDATE richiede UPDATE su almeno una colonna della relazione.
  foreach v_tabella in array array['cantieri', 'varianti_cantiere'] loop
    if not has_any_column_privilege('artecna_varianti_rpc', 'public.' || v_tabella, 'UPDATE') then
      raise exception 'Privilegio necessario al lock mancante su %', v_tabella;
    end if;
  end loop;
  if not has_function_privilege('artecna_varianti_rpc',
      'artecna_guardie.utente_jwt_corrente()', 'EXECUTE')
    or not has_function_privilege('artecna_varianti_rpc',
      'artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)', 'EXECUTE') then
    raise exception 'EXECUTE guardie di autorizzazione mancante';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_attribute a
    where a.attrelid = 'public.variante_lavorazioni'::regclass
      and a.attname = 'id' and not a.attisdropped
      and a.attidentity = 'a' and a.atttypid = 'bigint'::regtype
  ) then
    raise exception 'ID lavorazione diverso dalla identity always certificata';
  end if;
end;
$preflight$;


-- Solo privilegi amministrativi temporanei; nessun grant tabella o sequenza.
grant artecna_varianti_rpc to postgres
  with admin false, inherit false, set true granted by postgres;
grant create on schema public to artecna_varianti_rpc;
set local role artecna_varianti_rpc;

create function public.aggiungi_correzione_variante(
  p_variante_id uuid,
  p_tipo_componente text,
  p_componente_id bigint,
  p_operazione text,
  p_quantita numeric,
  p_motivo text
) returns table (
  id bigint, variante_id uuid, numero_riga integer, operazione text,
  descrizione text, unita_misura text, quantita_delta numeric,
  prezzo_unitario numeric, delta_contratto numeric, note text,
  riferimento_preventivo_lavorazione_id bigint,
  riferimento_variante_lavorazione_id bigint, created_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_utente uuid;
  v_cantiere_id uuid;
  v_cantiere record;
  v_variante record;
  v_h record;
  v_quantita numeric;
  v_quantita_delta numeric;
  v_delta numeric;
  v_numero bigint;
begin
  if current_user <> 'artecna_varianti_rpc' then
    raise exception using errcode = 'P2091', message = 'Ruolo RPC non valido';
  end if;
  v_utente := artecna_guardie.utente_jwt_corrente();
  if v_utente is null then
    raise exception using errcode = 'P2091', message = 'Sessione non valida';
  end if;
  if p_variante_id is null or p_tipo_componente is null
    or p_tipo_componente not in ('preventivo', 'variante')
    or p_componente_id is null or p_componente_id <= 0
    or p_operazione is null or p_operazione not in ('riduzione_residua', 'eliminazione_residua')
    or p_motivo is null or btrim(p_motivo) = '' then
    raise exception using errcode = 'P2091', message = 'Richiesta di correzione non valida';
  end if;
  if p_operazione = 'riduzione_residua' then
    if p_quantita is null or p_quantita <= 0
      or p_quantita::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception using errcode = 'P2091', message = 'Quantita di riduzione non valida';
    end if;
  elsif p_quantita is not null then
    raise exception using errcode = 'P2091', message = 'Eliminazione: quantita client non ammessa';
  end if;

  select v.cantiere_id into v_cantiere_id
  from public.varianti_cantiere v where v.id = p_variante_id;
  if not found or v_cantiere_id is null then
    raise exception using errcode = 'P2093', message = 'Variante non disponibile';
  end if;
  select c.id, c.preventivo_contrattuale_id into v_cantiere
  from public.cantieri c where c.id = v_cantiere_id for update;
  if not found then
    raise exception using errcode = 'P2093', message = 'Cantiere non disponibile';
  end if;
  if artecna_guardie.utente_puo_modificare_cantiere(v_utente, v_cantiere.id) is not true then
    raise exception using errcode = 'P2092', message = 'Utente non autorizzato sul cantiere';
  end if;
  select v.id, v.cantiere_id, v.preventivo_contrattuale_id, v.stato into v_variante
  from public.varianti_cantiere v where v.id = p_variante_id for update;
  if not found then
    raise exception using errcode = 'P2093', message = 'Variante non disponibile dopo il lock';
  end if;
  if v_variante.cantiere_id is distinct from v_cantiere.id
    or v_variante.stato is distinct from 'bozza'
    or v_cantiere.preventivo_contrattuale_id is null
    or v_variante.preventivo_contrattuale_id is distinct from v_cantiere.preventivo_contrattuale_id
    or not exists (
      select 1 from public.preventivi_cantiere p
      where p.id = v_cantiere.preventivo_contrattuale_id and p.cantiere_id = v_cantiere.id
    ) then
    raise exception using errcode = 'P2093', message = 'Variante non modificabile o contratto cambiato';
  end if;

  -- Comando separato DOPO entrambi i lock; una sola invocazione dell'helper STABLE.
  begin
    select h.* into strict v_h
    from artecna_guardie.calcola_residuo_componente(
      p_tipo_componente, p_componente_id, v_cantiere.id, v_variante.preventivo_contrattuale_id
    ) h;
  exception
    -- P2033 include anche valori canonici/contesto incoerenti: non si analizza il messaggio.
    when sqlstate 'P2031' or sqlstate 'P2033' or sqlstate 'P2035' then
      raise exception using errcode = 'P2094', message = 'Componente non disponibile o non coerente';
    when sqlstate 'P2034' or sqlstate 'P2036' or sqlstate 'P2037' or sqlstate 'P2038' then
      raise exception using errcode = 'P2095', message = 'Stato SAL o residuo non verificabile';
    when no_data_found or too_many_rows then
      raise exception using errcode = 'P2094', message = 'Cardinalita del componente non valida';
  end;
  if v_h.tipo_componente is distinct from p_tipo_componente
    or v_h.componente_id is distinct from p_componente_id
    or v_h.cantiere_id is distinct from v_cantiere.id
    or v_h.preventivo_contrattuale_id is distinct from v_variante.preventivo_contrattuale_id then
    raise exception using errcode = 'P2094', message = 'Identita del componente non coerente';
  end if;
  if v_h.sal_presente is not true or v_h.maturato_verificabile is not true
    or v_h.quantita_riducibile is null or v_h.importo_riducibile is null then
    raise exception using errcode = 'P2095', message = 'SAL o maturato non verificabile';
  end if;
  if v_h.quantita_contrattuale is null or v_h.importo_contrattuale is null
    or v_h.quantita_contrattuale::text in ('NaN', 'Infinity', '-Infinity')
    or v_h.importo_contrattuale::text in ('NaN', 'Infinity', '-Infinity')
    or v_h.quantita_riducibile::text in ('NaN', 'Infinity', '-Infinity')
    or v_h.importo_riducibile::text in ('NaN', 'Infinity', '-Infinity')
    or v_h.quantita_contrattuale < 0 or v_h.importo_contrattuale < 0
    or v_h.quantita_riducibile < 0 or v_h.importo_riducibile < 0
    or v_h.quantita_riducibile > v_h.quantita_contrattuale
    or v_h.importo_riducibile > v_h.importo_contrattuale then
    raise exception using errcode = 'P2095', message = 'Residui quantitativi o economici incoerenti';
  end if;
  if v_h.quantita_contrattuale = 0 or v_h.quantita_riducibile = 0 then
    raise exception using errcode = 'P2096', message = 'Nessuna quantita riducibile disponibile';
  end if;
  if v_h.descrizione is null or btrim(v_h.descrizione) = ''
    or v_h.unita_misura is null or btrim(v_h.unita_misura) = ''
    or v_h.prezzo_unitario is null or v_h.prezzo_unitario < 0
    or v_h.prezzo_unitario::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = 'P2094', message = 'Valori canonici del componente non validi';
  end if;

  v_quantita := case when p_operazione = 'riduzione_residua'
    then p_quantita else v_h.quantita_riducibile end;
  if v_quantita > v_h.quantita_riducibile then
    raise exception using errcode = 'P2096', message = 'Quantita superiore al residuo';
  end if;
  v_quantita_delta := -v_quantita;
  v_delta := round(v_quantita_delta * v_h.prezzo_unitario, 2);
  if v_quantita_delta >= 0 or v_delta >= 0
    or v_quantita_delta::text in ('NaN', 'Infinity', '-Infinity')
    or v_delta::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = 'P2091', message = 'Quantita o delta della correzione non validi';
  end if;
  if p_operazione = 'eliminazione_residua' then
    if -v_delta <> v_h.importo_riducibile then
      raise exception using errcode = 'P2097', message = 'Eliminazione economicamente diversa dal residuo';
    end if;
  elsif -v_delta > v_h.importo_riducibile then
    raise exception using errcode = 'P2096', message = 'Importo della riduzione superiore al residuo';
  end if;

  -- Non lasciare che i typmod delle colonne arrotondino implicitamente i valori validati.
  begin
    if v_quantita_delta::numeric(18,6) <> v_quantita_delta then
      raise exception using errcode = 'P2091', message = 'Quantita non rappresentabile senza arrotondamento';
    end if;
    if v_h.prezzo_unitario::numeric(18,6) <> v_h.prezzo_unitario then
      raise exception using errcode = 'P2094', message = 'Prezzo canonico non rappresentabile senza arrotondamento';
    end if;
    if v_delta::numeric(18,2) <> v_delta then
      raise exception using errcode = 'P2091', message = 'Delta non rappresentabile';
    end if;
  exception when numeric_value_out_of_range then
    raise exception using errcode = 'P2091', message = 'Valori oltre la capacita numerica delle colonne';
  end;

  -- Stessa strategia legacy, con testata gia lockata; nessun ID/nextval client.
  select coalesce(max(l.numero_riga)::bigint, 0) + 1 into v_numero
  from public.variante_lavorazioni l where l.variante_id = p_variante_id;
  if v_numero < 1 or v_numero > 2147483647 then
    raise exception using errcode = 'P2098', message = 'Numerazione lavorazioni esaurita';
  end if;
  return query
  insert into public.variante_lavorazioni as l (
    variante_id, numero_riga, operazione, descrizione, unita_misura,
    quantita_delta, prezzo_unitario, delta_contratto,
    riferimento_preventivo_lavorazione_id, riferimento_variante_lavorazione_id,
    note, variante_sorgente_id, indice_voce_sorgente
  ) values (
    p_variante_id, v_numero::integer, p_operazione, v_h.descrizione, v_h.unita_misura,
    v_quantita_delta, v_h.prezzo_unitario, v_delta,
    case when p_tipo_componente = 'preventivo' then p_componente_id else null end,
    case when p_tipo_componente = 'variante' then p_componente_id else null end,
    btrim(p_motivo), null, null
  ) returning l.id, l.variante_id, l.numero_riga, l.operazione, l.descrizione,
    l.unita_misura, l.quantita_delta, l.prezzo_unitario, l.delta_contratto,
    l.note, l.riferimento_preventivo_lavorazione_id,
    l.riferimento_variante_lavorazione_id, l.created_at;
exception
  when unique_violation or serialization_failure or deadlock_detected then
    raise exception using errcode = 'P2098', message = 'Conflitto durante inserimento: ricaricare e riprovare';
end;
$function$;

revoke all on function public.aggiungi_correzione_variante(uuid,text,bigint,text,numeric,text)
  from public, anon;
grant execute on function public.aggiungi_correzione_variante(uuid,text,bigint,text,numeric,text)
  to authenticated;

reset role;
revoke create on schema public from artecna_varianti_rpc;
revoke artecna_varianti_rpc from postgres granted by postgres restrict;

do $verify$
declare
  v_f pg_catalog.pg_proc%rowtype;
begin
  if current_user <> 'postgres'
    or (select count(*) from pg_catalog.pg_auth_members
        where roleid = 'artecna_varianti_rpc'::regrole and member = 'postgres'::regrole) <> 1
    or not exists (
      select 1 from pg_catalog.pg_auth_members
      where roleid = 'artecna_varianti_rpc'::regrole and member = 'postgres'::regrole
        and grantor = 'supabase_admin'::regrole
        and admin_option and not inherit_option and not set_option
    )
    or pg_has_role('postgres', 'artecna_varianti_rpc', 'SET')
    or has_schema_privilege('artecna_varianti_rpc', 'public', 'CREATE') then
    raise exception 'Privilegi temporanei non ripristinati';
  end if;
  select p.* into strict v_f from pg_catalog.pg_proc p
  where p.oid = 'public.aggiungi_correzione_variante(uuid,text,bigint,text,numeric,text)'::regprocedure;
  if v_f.proowner <> 'artecna_varianti_rpc'::regrole or not v_f.prosecdef or v_f.provolatile <> 'v'
    or v_f.proconfig is distinct from array['search_path=pg_catalog, pg_temp']::text[]
    or not has_function_privilege('authenticated', v_f.oid, 'EXECUTE')
    or has_function_privilege('anon', v_f.oid, 'EXECUTE')
    or not has_function_privilege('artecna_varianti_rpc', v_f.oid, 'EXECUTE')
    or exists (
      select 1 from pg_catalog.aclexplode(coalesce(v_f.proacl, pg_catalog.acldefault('f', v_f.proowner))) a
      where a.grantee not in ('artecna_varianti_rpc'::regrole, 'authenticated'::regrole)
        or (a.grantee = 'authenticated'::regrole and a.is_grantable)
    ) then
    raise exception 'Owner, sicurezza o ACL helper inattesi';
  end if;
end;
$verify$;

commit;
