begin;

-- Patch della definizione installata: nessuna ricostruzione del corpo RPC.
-- PostgreSQL 17; stesso pattern di membership temporanea delle migration Varianti.
-- Se le precondizioni amministrative differiscono, interrompe senza modificarle.
do $preflight$
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
    raise exception 'Membership o privilegi iniziali inattesi: installazione interrotta';
  end if;
end;
$preflight$;

grant artecna_varianti_rpc to postgres
  with admin false, inherit false, set true granted by postgres;
grant create on schema public to artecna_varianti_rpc;
set local role artecna_varianti_rpc;

do $patch$
declare
  v_prima pg_catalog.pg_proc%rowtype;
  v_dopo pg_catalog.pg_proc%rowtype;
  v_definizione text;
  v_prosrc_nuovo text;
  v_delimitatore text;
  v_num_delimitatori integer;
  v_pos_insert integer;
  v_pos_p2101 integer;
  v_num_p2101 integer;
  -- U& mantiene il file ASCII e identifica esattamente il testo UTF-8 corrotto nel DB.
  v_corrotto constant text := U&'La base contrattuale non pu\00C3\00B2 essere confermata come nuova lavorazione';
  v_ascii constant text := 'La base contrattuale non puo essere confermata come nuova lavorazione';
begin
  select p.* into v_prima from pg_catalog.pg_proc p
  where p.oid = to_regprocedure('public.conferma_preventivo_integrativo(uuid,jsonb)');
  if not found then
    raise exception 'RPC conferma_preventivo_integrativo non disponibile';
  end if;
  if current_user <> 'artecna_varianti_rpc'
    or v_prima.proowner <> 'artecna_varianti_rpc'::regrole
    or not v_prima.prosecdef
    or v_prima.provolatile <> 'v'
    or v_prima.proconfig is distinct from array['search_path=pg_catalog, pg_temp']::text[]
    or not has_function_privilege('artecna_varianti_rpc', v_prima.oid, 'EXECUTE')
    or not has_function_privilege('authenticated', v_prima.oid, 'EXECUTE')
    or has_function_privilege('anon', v_prima.oid, 'EXECUTE')
    or exists (
      select 1 from pg_catalog.aclexplode(
        coalesce(v_prima.proacl, pg_catalog.acldefault('f', v_prima.proowner))
      ) a where a.grantee not in ('artecna_varianti_rpc'::regrole, 'authenticated'::regrole)
        or (a.grantee = 'authenticated'::regrole and a.is_grantable)
    ) then
    raise exception 'Owner, sicurezza, volatility, search_path o ACL inattesi';
  end if;
  select count(*) into v_num_p2101
  from pg_catalog.regexp_matches(v_prima.prosrc, 'P2101', 'gi');
  v_pos_p2101 := strpos(v_prima.prosrc, 'P2101');
  if v_num_p2101 <> 1 or v_pos_p2101 = 0 then
    raise exception 'P2101 assente o non univoco';
  end if;
  if length(v_prima.prosrc) - length(replace(v_prima.prosrc, v_corrotto, '')) <> length(v_corrotto)
    or strpos(v_prima.prosrc, v_ascii) <> 0 then
    raise exception 'Literal corrotto assente/non univoco o ASCII gia presente';
  end if;
  -- Certifica che il testo da sostituire sia il literal MESSAGE di P2101.
  if substring(v_prima.prosrc from v_pos_p2101) !~
      ('^P2101''[[:space:]]*,[[:space:]]*message[[:space:]]*=[[:space:]]*''' || v_corrotto || '''[[:space:]]*;') then
    raise exception 'Literal corrotto non associato al MESSAGE di P2101';
  end if;
  -- Primo INSERT applicativo, anche con maiuscole o separazione diversa.
  select min(strpos(lower(v_prima.prosrc), lower(r.parti[1]))) into v_pos_insert
  from pg_catalog.regexp_matches(v_prima.prosrc,
    '(insert[[:space:]]+into[[:space:]]+public[[:space:]]*\.[[:space:]]*variante_lavorazioni\M)', 'gi') r(parti);
  if v_pos_insert is null or v_pos_insert = 0 or v_pos_p2101 >= v_pos_insert then
    raise exception 'INSERT assente o precedente a P2101';
  end if;
  v_prosrc_nuovo := replace(v_prima.prosrc, v_corrotto, v_ascii);
  if length(v_prosrc_nuovo) - length(replace(v_prosrc_nuovo, v_ascii, '')) <> length(v_ascii)
    or strpos(v_prosrc_nuovo, v_corrotto) <> 0
    or replace(v_prosrc_nuovo, v_ascii, v_corrotto) is distinct from v_prima.prosrc then
    raise exception 'Sostituzione non unica o non reversibile byte-for-byte';
  end if;
  v_definizione := pg_catalog.pg_get_functiondef(v_prima.oid);
  select count(*), min(r.parti[1]) into v_num_delimitatori, v_delimitatore
  from pg_catalog.regexp_matches(v_definizione,
    '(?n)^AS (\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$)', 'g') r(parti);
  if v_num_delimitatori <> 1 or v_delimitatore is null then
    raise exception 'Delimitatore AS assente o non univoco';
  end if;
  if length(v_definizione) - length(replace(v_definizione, v_delimitatore, '')) <> 2 * length(v_delimitatore)
    or split_part(v_definizione, v_delimitatore, 2) is distinct from v_prima.prosrc
    or strpos(v_prosrc_nuovo, v_delimitatore) > 0 then
    raise exception 'Corpo delimitato non identificabile con certezza';
  end if;
  execute split_part(v_definizione, v_delimitatore, 1)
    || v_delimitatore || v_prosrc_nuovo || v_delimitatore
    || split_part(v_definizione, v_delimitatore, 3);
  select p.* into strict v_dopo from pg_catalog.pg_proc p where p.oid = v_prima.oid;
  if v_dopo.prosrc is distinct from v_prosrc_nuovo
    or (to_jsonb(v_dopo) - 'prosrc') is distinct from (to_jsonb(v_prima) - 'prosrc') then
    raise exception 'Corpo inatteso o attributi pg_proc modificati';
  end if;
end;
$patch$;

reset role;
revoke create on schema public from artecna_varianti_rpc;
revoke artecna_varianti_rpc from postgres granted by postgres restrict;

do $verify$
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
end;
$verify$;

commit;
