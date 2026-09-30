begin;

-- PostgreSQL 17: concessione temporanea distinta per grantor.
-- La membership concessa da supabase_admin non viene modificata.
do $preflight$
begin
  if current_user <> 'postgres' or session_user <> 'postgres'
    or current_setting('server_version_num')::integer / 10000 <> 17 then
    raise exception 'Installazione prevista come postgres su PostgreSQL 17';
  end if;
  if (select count(*) from pg_catalog.pg_auth_members
      where roleid = 'artecna_varianti_rpc'::regrole
        and member = 'postgres'::regrole) <> 1
    or not exists (
      select 1 from pg_catalog.pg_auth_members
      where roleid = 'artecna_varianti_rpc'::regrole
        and member = 'postgres'::regrole
        and grantor = 'supabase_admin'::regrole
        and admin_option and not inherit_option and not set_option
    ) then
    raise exception 'Membership iniziale diversa da quella certificata';
  end if;
  if pg_has_role('postgres', 'artecna_varianti_rpc', 'SET')
    or has_schema_privilege('artecna_varianti_rpc', 'public', 'CREATE') then
    raise exception 'Privilegi temporanei gia presenti: installazione interrotta';
  end if;
end;
$preflight$;

grant artecna_varianti_rpc to postgres
  with admin false, inherit false, set true
  granted by postgres;

do $check_set$
begin
  if not pg_has_role('postgres', 'artecna_varianti_rpc', 'SET')
    or not exists (
      select 1 from pg_catalog.pg_auth_members
      where roleid = 'artecna_varianti_rpc'::regrole
        and member = 'postgres'::regrole and grantor = 'postgres'::regrole
        and not admin_option and not inherit_option and set_option
    ) then
    raise exception 'Concessione temporanea SET non disponibile';
  end if;
end;
$check_set$;

-- SELECT sulle due tabelle e privilegi di lock sulla testata sono gia esistenti.
do $privilegi$
declare
  v_sequenza text;
  v_identity text;
begin
  if not has_table_privilege('artecna_varianti_rpc', 'public.variante_lavorazioni', 'SELECT')
    or not has_table_privilege('artecna_varianti_rpc', 'public.variante_sorgenti', 'SELECT') then
    raise exception 'Privilegi SELECT preesistenti mancanti';
  end if;
  -- Un eventuale default serial richiede nextval; non si presume il nome della sequenza.
  select a.attidentity::text into v_identity
  from pg_catalog.pg_attribute a
  where a.attrelid = 'public.variante_lavorazioni'::regclass
    and a.attname = 'id' and not a.attisdropped;
  v_sequenza := pg_catalog.pg_get_serial_sequence('public.variante_lavorazioni', 'id');
  if v_identity = '' and v_sequenza is not null
    and not has_sequence_privilege('artecna_varianti_rpc', v_sequenza, 'USAGE')
    and not has_sequence_privilege('artecna_varianti_rpc', v_sequenza, 'UPDATE') then
    execute format('GRANT USAGE ON SEQUENCE %s TO artecna_varianti_rpc', v_sequenza::regclass);
  end if;
end;
$privilegi$;

grant insert on public.variante_lavorazioni to artecna_varianti_rpc;
grant create on schema public to artecna_varianti_rpc;
set local role artecna_varianti_rpc;

create function public.conferma_preventivo_integrativo(
  p_variante_id uuid,
  p_lavorazioni jsonb
) returns table (variante_id uuid, numero_lavorazioni integer, delta_totale numeric)
language plpgsql
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $$
declare
  v_utente uuid;
  v_variante public.varianti_cantiere%rowtype;
  v_elemento record;
  v_riga jsonb;
  v_validate jsonb := '[]'::jsonb;
  v_viste text[] := array[]::text[];
  v_chiave text;
  v_sorgente uuid;
  v_indice integer;
  v_indice_num numeric;
  v_descrizione text;
  v_um text;
  v_quantita numeric;
  v_prezzo numeric;
  v_delta numeric;
  v_totale numeric := 0;
  v_numero bigint;
  v_conteggio integer;
  v_vincolo text;
begin
  if current_user <> 'artecna_varianti_rpc' then
    raise exception using errcode = '42501', message = 'Ruolo RPC non autorizzato';
  end if;
  v_utente := artecna_guardie.utente_jwt_corrente();
  if v_utente is null then
    raise exception using errcode = '42501', message = 'Utente non autenticato';
  end if;
  if p_variante_id is null then
    raise exception using errcode = '22023', message = 'ID Variante obbligatorio';
  end if;
  select v.* into v_variante
  from public.varianti_cantiere v where v.id = p_variante_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Variante non disponibile';
  end if;
  if artecna_guardie.utente_puo_modificare_cantiere(v_utente, v_variante.cantiere_id) is not true then
    raise exception using errcode = '42501', message = 'Cantiere non autorizzato';
  end if;
  if v_variante.stato is distinct from 'bozza' then
    raise exception using errcode = '22023', message = 'Variante non in bozza';
  end if;
  if p_lavorazioni is null or jsonb_typeof(p_lavorazioni) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Payload non valido: atteso array JSON';
  end if;
  v_conteggio := jsonb_array_length(p_lavorazioni);
  if v_conteggio < 1 or v_conteggio > 1000 then
    raise exception using errcode = '22023', message = 'Payload non valido: richieste da 1 a 1000 lavorazioni';
  end if;

  -- Fase 1: nessun INSERT finche tutte le righe non sono state validate.
  for v_elemento in
    select e.value, e.ordinality
    from jsonb_array_elements(p_lavorazioni) with ordinality as e(value, ordinality)
    order by e.ordinality
  loop
    v_riga := v_elemento.value;
    if jsonb_typeof(v_riga) is distinct from 'object' then
      raise exception using errcode = '22023', message = format('Riga %s: atteso oggetto JSON', v_elemento.ordinality);
    end if;
    if not (v_riga ?& array['sorgenteId', 'indiceVoce', 'descrizione', 'unitaMisura', 'quantita', 'prezzoUnitario'])
      or (select count(*) from jsonb_object_keys(v_riga)) <> 6 then
      raise exception using errcode = '22023', message = format('Riga %s: campi mancanti o non ammessi', v_elemento.ordinality);
    end if;
    if jsonb_typeof(v_riga->'sorgenteId') is distinct from 'string'
      or jsonb_typeof(v_riga->'indiceVoce') is distinct from 'number'
      or jsonb_typeof(v_riga->'descrizione') is distinct from 'string'
      or jsonb_typeof(v_riga->'unitaMisura') is distinct from 'string'
      or jsonb_typeof(v_riga->'quantita') is distinct from 'number'
      or jsonb_typeof(v_riga->'prezzoUnitario') is distinct from 'number' then
      raise exception using errcode = '22023', message = format('Riga %s: tipi JSON non validi', v_elemento.ordinality);
    end if;
    begin
      v_sorgente := (v_riga->>'sorgenteId')::uuid;
      v_indice_num := (v_riga->>'indiceVoce')::numeric;
      v_quantita := (v_riga->>'quantita')::numeric;
      v_prezzo := (v_riga->>'prezzoUnitario')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode = '22023', message = format('Riga %s: UUID o numero non valido', v_elemento.ordinality);
    end;
    if v_indice_num::text in ('NaN', 'Infinity', '-Infinity')
      or v_indice_num < 0 or v_indice_num > 2147483647 or trunc(v_indice_num) <> v_indice_num then
      raise exception using errcode = '22023', message = format('Riga %s: indice voce non valido', v_elemento.ordinality);
    end if;
    v_indice := v_indice_num::integer;
    perform 1 from public.variante_sorgenti s
    where s.id = v_sorgente and s.variante_id = p_variante_id;
    if not found then
      raise exception using errcode = '22023', message = 'Sorgente non appartenente alla Variante';
    end if;
    v_chiave := v_sorgente::text || ':' || v_indice::text;
    if v_chiave = any(v_viste) then
      raise exception using errcode = '22023', message = 'Voce duplicata nel payload';
    end if;
    v_viste := array_append(v_viste, v_chiave);
    perform 1 from public.variante_lavorazioni l
    where l.variante_sorgente_id = v_sorgente and l.indice_voce_sorgente = v_indice;
    if found then
      raise exception using errcode = '23505', message = 'Voce sorgente gia confermata';
    end if;
    v_descrizione := btrim(v_riga->>'descrizione');
    v_um := btrim(v_riga->>'unitaMisura');
    if v_descrizione = '' then
      raise exception using errcode = '22023', message = format('Riga %s: descrizione obbligatoria', v_elemento.ordinality);
    end if;
    if v_um = '' then
      raise exception using errcode = '22023', message = format('Riga %s: unita di misura obbligatoria', v_elemento.ordinality);
    end if;
    if v_quantita::text in ('NaN', 'Infinity', '-Infinity') or v_quantita <= 0 then
      raise exception using errcode = '22023', message = format('Riga %s: quantita non valida', v_elemento.ordinality);
    end if;
    if v_prezzo::text in ('NaN', 'Infinity', '-Infinity') or v_prezzo < 0 then
      raise exception using errcode = '22023', message = format('Riga %s: prezzo non valido', v_elemento.ordinality);
    end if;
    begin
      v_delta := round(v_quantita * v_prezzo, 2);
      v_totale := v_totale + v_delta;
    exception when numeric_value_out_of_range then
      raise exception using errcode = '22023', message = 'Delta o totale fuori intervallo';
    end;
    if v_delta::text in ('NaN', 'Infinity', '-Infinity') or v_delta <= 0
      or v_totale::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception using errcode = '22023', message = format('Riga %s: delta non valido', v_elemento.ordinality);
    end if;
    v_validate := v_validate || jsonb_build_array(jsonb_build_object(
      'sorgenteId', v_sorgente, 'indiceVoce', v_indice,
      'descrizione', v_descrizione, 'unitaMisura', v_um,
      'quantita', v_quantita, 'prezzoUnitario', v_prezzo, 'delta', v_delta
    ));
  end loop;

  select coalesce(max(l.numero_riga), 0)::bigint into v_numero
  from public.variante_lavorazioni l where l.variante_id = p_variante_id;
  if v_numero + v_conteggio > 2147483647 then
    raise exception using errcode = '22023', message = 'Numerazione lavorazioni esaurita';
  end if;
  -- Fase 2: solo dati validati, nello stesso lock e nella stessa transazione.
  for v_elemento in
    select e.value, e.ordinality
    from jsonb_array_elements(v_validate) with ordinality as e(value, ordinality)
    order by e.ordinality
  loop
    v_riga := v_elemento.value;
    insert into public.variante_lavorazioni (
      variante_id, numero_riga, operazione, descrizione, unita_misura,
      quantita_delta, prezzo_unitario, delta_contratto,
      riferimento_preventivo_lavorazione_id, riferimento_variante_lavorazione_id,
      variante_sorgente_id, indice_voce_sorgente
    ) values (
      p_variante_id, (v_numero + v_elemento.ordinality)::integer, 'nuova',
      v_riga->>'descrizione', v_riga->>'unitaMisura',
      (v_riga->>'quantita')::numeric, (v_riga->>'prezzoUnitario')::numeric,
      (v_riga->>'delta')::numeric, null, null,
      (v_riga->>'sorgenteId')::uuid, (v_riga->>'indiceVoce')::integer
    );
  end loop;
  return query select p_variante_id, v_conteggio, round(v_totale, 2);
exception
  when unique_violation then
    get stacked diagnostics v_vincolo = constraint_name;
    if v_vincolo = 'variante_lavorazioni_sorgente_voce_unique' then
      raise exception using errcode = '23505', message = 'Voce sorgente gia confermata';
    end if;
    -- Conserva anche l'errore applicativo 23505 emesso durante la validazione.
    if v_vincolo is null or v_vincolo = '' then raise; end if;
    raise exception using errcode = '23505', message = 'Conflitto concorrente sulle lavorazioni: ricaricare e riprovare';
  when serialization_failure or deadlock_detected then
    raise exception using errcode = SQLSTATE, message = 'Operazione concorrente: riprovare la transazione';
end;
$$;

revoke all on function public.conferma_preventivo_integrativo(uuid, jsonb) from public, anon;
grant execute on function public.conferma_preventivo_integrativo(uuid, jsonb) to authenticated;

reset role;
revoke create on schema public from artecna_varianti_rpc;
-- Elimina solo la concessione creata da postgres, non quella originale.
revoke artecna_varianti_rpc from postgres granted by postgres restrict;

do $verify$
declare
  v_firma text;
  v_funzione pg_catalog.pg_proc%rowtype;
begin
  if current_user <> 'postgres'
    or (select count(*) from pg_catalog.pg_auth_members
        where roleid = 'artecna_varianti_rpc'::regrole
          and member = 'postgres'::regrole) <> 1
    or not exists (
      select 1 from pg_catalog.pg_auth_members
      where roleid = 'artecna_varianti_rpc'::regrole
        and member = 'postgres'::regrole
        and grantor = 'supabase_admin'::regrole
        and admin_option and not inherit_option and not set_option
    ) then
    raise exception 'Membership originale non ripristinata';
  end if;
  if pg_has_role('postgres', 'artecna_varianti_rpc', 'SET')
    or has_schema_privilege('artecna_varianti_rpc', 'public', 'CREATE')
    or not has_schema_privilege('artecna_varianti_rpc', 'public', 'USAGE') then
    raise exception 'Privilegi temporanei non ripristinati';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_roles
    where rolname = 'artecna_varianti_rpc'
      and not rolcanlogin and not rolsuper and not rolinherit and rolbypassrls
  ) then
    raise exception 'Attributi ruolo tecnico inattesi';
  end if;
  if not has_table_privilege('artecna_varianti_rpc', 'public.variante_lavorazioni', 'SELECT')
    or not has_table_privilege('artecna_varianti_rpc', 'public.variante_lavorazioni', 'INSERT')
    or not has_table_privilege('artecna_varianti_rpc', 'public.variante_sorgenti', 'SELECT') then
    raise exception 'Privilegi necessari alla RPC non disponibili';
  end if;
  foreach v_firma in array array[
    'public.conferma_preventivo_integrativo(uuid,jsonb)'
  ] loop
    select p.* into v_funzione from pg_catalog.pg_proc p
    where p.oid = to_regprocedure(v_firma);
    if not found then
      raise exception 'RPC assente: %', v_firma;
    end if;
    if v_funzione.proowner <> 'artecna_varianti_rpc'::regrole
      or not v_funzione.prosecdef
      or v_funzione.proconfig is distinct from array['search_path=pg_catalog, pg_temp']::text[]
      or not has_function_privilege('authenticated', v_funzione.oid, 'EXECUTE')
      or has_function_privilege('anon', v_funzione.oid, 'EXECUTE')
      or exists (
        select 1 from pg_catalog.aclexplode(
          coalesce(v_funzione.proacl, pg_catalog.acldefault('f', v_funzione.proowner))
        ) a
        where a.grantee not in ('artecna_varianti_rpc'::regrole, 'authenticated'::regrole)
          or (a.grantee = 'authenticated'::regrole and a.is_grantable)
      ) then
      raise exception 'Owner, sicurezza o ACL inattesi: %', v_firma;
    end if;
  end loop;
end;
$verify$;

commit;
