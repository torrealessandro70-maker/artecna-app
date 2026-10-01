begin;

-- Helper interno: nessun JWT, lock o DML; approva_variante NON e ancora protetta.
-- Il chiamante deve autorizzare, acquisire il lock cantiere e rileggere
-- Variante/lavorazioni prima della chiamata. Solo dopo puo approvare.
-- Invocare in un comando successivo all'acquisizione del lock (snapshot STABLE).
-- P2081 riferimento; P2082 maturato; P2083 riduzione; P2084 eliminazione;
-- P2085 numeri; P2086 descrizione/UM; P2087 combinazioni;
-- P2088 stato incoerente; P2089 residuo esaurito.

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
    or has_schema_privilege('artecna_varianti_rpc', 'artecna_guardie', 'CREATE') then
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
      ('varianti_cantiere', 'id,cantiere_id,preventivo_contrattuale_id,stato'),
      ('variante_lavorazioni', 'id,variante_id,operazione,descrizione,unita_misura,note,quantita_delta,prezzo_unitario,delta_contratto,riferimento_preventivo_lavorazione_id,riferimento_variante_lavorazione_id')
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
end;
$preflight$;

-- Nessun grant sulle tabelle: ogni SELECT necessario deve gia esistere.
grant artecna_varianti_rpc to postgres
  with admin false, inherit false, set true granted by postgres;
grant create on schema artecna_guardie to artecna_varianti_rpc;
set local role artecna_varianti_rpc;

create function artecna_guardie.valida_correzioni_variante(
  p_variante_id uuid,
  p_cantiere_id uuid,
  p_preventivo_contrattuale_id uuid
) returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_variante record;
  v_l record;
  v_g record;
  v_h record;
begin
  if current_user <> 'artecna_varianti_rpc' then
    raise exception using errcode = '42501', message = 'Owner validatore non corretto';
  end if;
  if p_variante_id is null or p_cantiere_id is null or p_preventivo_contrattuale_id is null then
    raise exception using errcode = 'P2081', message = 'Identita Variante o contesto mancanti';
  end if;
  select v.cantiere_id, v.preventivo_contrattuale_id, v.stato
  into v_variante from public.varianti_cantiere v where v.id = p_variante_id;
  if not found then
    raise exception using errcode = 'P2081', message = 'Variante non disponibile';
  end if;
  if v_variante.stato is distinct from 'proposta'
    or v_variante.cantiere_id is distinct from p_cantiere_id
    or v_variante.preventivo_contrattuale_id is distinct from p_preventivo_contrattuale_id then
    raise exception using errcode = 'P2088', message = 'Stato o contesto Variante incoerenti';
  end if;

  -- Tutte le righe sono validate prima delle somme; nessun NULL viene ignorato.
  for v_l in
    select l.id, l.operazione, l.descrizione, l.unita_misura, l.note,
      l.quantita_delta, l.prezzo_unitario, l.delta_contratto,
      l.riferimento_preventivo_lavorazione_id, l.riferimento_variante_lavorazione_id
    from public.variante_lavorazioni l where l.variante_id = p_variante_id
    order by l.id
  loop
    if v_l.operazione is null or v_l.operazione not in
      ('nuova', 'aumento', 'riduzione_residua', 'eliminazione_residua') then
      raise exception using errcode = 'P2081', message = 'Operazione non ammessa';
    end if;
    if v_l.operazione in ('nuova', 'aumento') then
      continue;
    end if;
    if v_l.id is null or v_l.id <= 0
      or (v_l.riferimento_preventivo_lavorazione_id is null) =
         (v_l.riferimento_variante_lavorazione_id is null)
      or coalesce(v_l.riferimento_preventivo_lavorazione_id,
                  v_l.riferimento_variante_lavorazione_id) <= 0 then
      raise exception using errcode = 'P2081', message = 'Riferimento correttivo non valido';
    end if;
    if v_l.descrizione is null or btrim(v_l.descrizione) = ''
      or v_l.unita_misura is null or btrim(v_l.unita_misura) = '' then
      raise exception using errcode = 'P2086', message = 'Descrizione o UM mancanti';
    end if;
    if v_l.note is null or btrim(v_l.note) = '' then
      raise exception using errcode = 'P2081', message = 'Motivazione della correttiva mancante';
    end if;
    if v_l.quantita_delta is null or v_l.quantita_delta >= 0
      or v_l.quantita_delta::text in ('NaN', 'Infinity', '-Infinity')
      or v_l.prezzo_unitario is null or v_l.prezzo_unitario < 0
      or v_l.prezzo_unitario::text in ('NaN', 'Infinity', '-Infinity')
      or v_l.delta_contratto is null or v_l.delta_contratto >= 0
      or v_l.delta_contratto::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception using errcode = 'P2085', message = 'Quantita, prezzo o delta non validi';
    end if;
  end loop;

  for v_g in
    select case when l.riferimento_preventivo_lavorazione_id is not null
        then 'preventivo' else 'variante' end as tipo,
      coalesce(l.riferimento_preventivo_lavorazione_id,
               l.riferimento_variante_lavorazione_id) as componente_id,
      count(*) filter (where l.operazione = 'riduzione_residua') as riduzioni,
      count(*) filter (where l.operazione = 'eliminazione_residua') as eliminazioni,
      -sum(l.quantita_delta) as quantita, -sum(l.delta_contratto) as importo
    from public.variante_lavorazioni l
    where l.variante_id = p_variante_id
      and l.operazione in ('riduzione_residua', 'eliminazione_residua')
    group by 1, 2
    order by 1, 2
  loop
    if v_g.eliminazioni > 1 or (v_g.eliminazioni = 1 and v_g.riduzioni > 0) then
      raise exception using errcode = 'P2087', message = 'Combinazione correttive vietata';
    end if;
    if v_g.quantita is null or v_g.quantita <= 0
      or v_g.quantita::text in ('NaN', 'Infinity', '-Infinity')
      or v_g.importo is null or v_g.importo <= 0
      or v_g.importo::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception using errcode = 'P2085', message = 'Aggregati correttivi non validi';
    end if;
    -- Una sola invocazione per componente; STRICT impone esattamente una riga.
    -- Traduzione limitata a questo blocco: gli errori inattesi propagano.
    begin
      select h.* into strict v_h
      from artecna_guardie.calcola_residuo_componente(
        v_g.tipo, v_g.componente_id, p_cantiere_id, p_preventivo_contrattuale_id
      ) h;
    exception
      when sqlstate 'P2031' or sqlstate 'P2035' then
        raise exception using errcode = 'P2081', message = 'Componente correttivo non disponibile';
      -- P2033 copre sia sorgenti sia contesto/SAL: non si interpreta il messaggio.
      when sqlstate 'P2033' or sqlstate 'P2034' or sqlstate 'P2036'
        or sqlstate 'P2037' or sqlstate 'P2038' then
        raise exception using errcode = 'P2088', message = 'Stato contrattuale o SAL incoerente';
      when no_data_found or too_many_rows then
        raise exception using errcode = 'P2088', message = 'Cardinalita helper residuo incoerente';
    end;
    if v_h.tipo_componente is distinct from v_g.tipo
      or v_h.componente_id is distinct from v_g.componente_id
      or v_h.cantiere_id is distinct from p_cantiere_id
      or v_h.preventivo_contrattuale_id is distinct from p_preventivo_contrattuale_id then
      raise exception using errcode = 'P2088', message = 'Identita restituita dall helper incoerente';
    end if;
    if v_h.sal_presente is not true or v_h.maturato_verificabile is not true
      or v_h.quantita_riducibile is null or v_h.importo_riducibile is null then
      raise exception using errcode = 'P2082', message = 'SAL o maturato non verificabile';
    end if;
    if v_h.quantita_contrattuale is null or v_h.importo_contrattuale is null
      or v_h.quantita_contrattuale < 0 or v_h.importo_contrattuale < 0
      or v_h.quantita_riducibile < 0 or v_h.importo_riducibile < 0
      or v_h.quantita_contrattuale::text in ('NaN', 'Infinity', '-Infinity')
      or v_h.importo_contrattuale::text in ('NaN', 'Infinity', '-Infinity')
      or v_h.quantita_riducibile::text in ('NaN', 'Infinity', '-Infinity')
      or v_h.importo_riducibile::text in ('NaN', 'Infinity', '-Infinity')
      or v_h.quantita_riducibile > v_h.quantita_contrattuale
      or v_h.importo_riducibile > v_h.importo_contrattuale then
      raise exception using errcode = 'P2088', message = 'Residui contrattuali incoerenti';
    end if;
    if v_h.quantita_contrattuale = 0 or v_h.quantita_riducibile = 0 then
      raise exception using errcode = 'P2089', message = 'Nessun residuo disponibile';
    end if;
    for v_l in
      select l.descrizione, l.unita_misura, l.quantita_delta,
        l.prezzo_unitario, l.delta_contratto
      from public.variante_lavorazioni l
      where l.variante_id = p_variante_id
        and l.operazione in ('riduzione_residua', 'eliminazione_residua')
        and ((v_g.tipo = 'preventivo' and l.riferimento_preventivo_lavorazione_id = v_g.componente_id)
          or (v_g.tipo = 'variante' and l.riferimento_variante_lavorazione_id = v_g.componente_id))
      order by l.id
    loop
      if btrim(v_l.descrizione) is distinct from btrim(v_h.descrizione)
        or btrim(v_l.unita_misura) is distinct from btrim(v_h.unita_misura) then
        raise exception using errcode = 'P2086', message = 'Descrizione o UM non canoniche';
      end if;
      if v_l.prezzo_unitario is distinct from v_h.prezzo_unitario
        or round(v_l.quantita_delta * v_h.prezzo_unitario, 2) is distinct from v_l.delta_contratto then
        raise exception using errcode = 'P2085', message = 'Prezzo o delta non coerenti con la sorgente';
      end if;
    end loop;
    if v_g.eliminazioni = 1 then
      if v_g.quantita <> v_h.quantita_riducibile or v_g.importo <> v_h.importo_riducibile then
        raise exception using errcode = 'P2084', message = 'Eliminazione diversa dal residuo';
      end if;
    elsif v_g.quantita > v_h.quantita_riducibile or v_g.importo > v_h.importo_riducibile then
      raise exception using errcode = 'P2083', message = 'Riduzione superiore al residuo';
    end if;
  end loop;
end;
$function$;

revoke all on function artecna_guardie.valida_correzioni_variante(uuid,uuid,uuid)
  from public, anon, authenticated;

reset role;
revoke create on schema artecna_guardie from artecna_varianti_rpc;
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
    or has_schema_privilege('artecna_varianti_rpc', 'artecna_guardie', 'CREATE') then
    raise exception 'Privilegi temporanei non ripristinati';
  end if;
  select p.* into strict v_f from pg_catalog.pg_proc p
  where p.oid = 'artecna_guardie.valida_correzioni_variante(uuid,uuid,uuid)'::regprocedure;
  if v_f.proowner <> 'artecna_varianti_rpc'::regrole or not v_f.prosecdef or v_f.provolatile <> 's'
    or v_f.proconfig is distinct from array['search_path=pg_catalog, pg_temp']::text[]
    or has_function_privilege('authenticated', v_f.oid, 'EXECUTE')
    or has_function_privilege('anon', v_f.oid, 'EXECUTE')
    or not has_function_privilege('artecna_varianti_rpc', v_f.oid, 'EXECUTE')
    or exists (
      select 1 from pg_catalog.aclexplode(coalesce(v_f.proacl, pg_catalog.acldefault('f', v_f.proowner))) a
      where a.grantee <> 'artecna_varianti_rpc'::regrole
    ) then
    raise exception 'Owner, sicurezza o ACL helper inattesi';
  end if;
end;
$verify$;

commit;
