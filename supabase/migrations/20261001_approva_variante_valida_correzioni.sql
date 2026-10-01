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
  v_marker text;
  v_pos_if integer;
  v_pos_return integer;
  v_pos_update integer;
  v_pos_inserimento integer;
  v_newline text;
  v_inserimento text;
  v_segmento text;
  v_controllo constant text := $check$IF v_delta = 0 THEN
    RAISE EXCEPTION USING ERRCODE='P2032',
      MESSAGE='La variante ha delta contrattuale nullo';
  END IF;$check$;
  v_chiamata constant text := 'artecna_guardie.valida_correzioni_variante(';
begin
  select p.* into v_prima from pg_catalog.pg_proc p
  where p.oid = to_regprocedure('public.approva_variante(uuid,text)');
  if not found then
    raise exception 'RPC approva_variante installata non disponibile';
  end if;
  if current_user <> 'artecna_varianti_rpc'
    or v_prima.proowner <> 'artecna_varianti_rpc'::regrole
    or not v_prima.prosecdef
    or v_prima.proconfig is distinct from array['search_path=pg_catalog, pg_temp']::text[]
    or not has_function_privilege('authenticated', v_prima.oid, 'EXECUTE')
    or has_function_privilege('anon', v_prima.oid, 'EXECUTE')
    or exists (
      select 1 from pg_catalog.aclexplode(
        coalesce(v_prima.proacl, pg_catalog.acldefault('f', v_prima.proowner))
      ) a where a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
    raise exception 'Owner, sicurezza, search_path o EXECUTE RPC approva_variante inattesi';
  end if;

  if not has_schema_privilege('artecna_varianti_rpc', 'artecna_guardie', 'USAGE')
    or not has_function_privilege('artecna_varianti_rpc',
      'artecna_guardie.valida_correzioni_variante(uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'USAGE o EXECUTE del validatore mancanti';
  end if;

  -- Rifiuta anche una chiamata gia presente con spaziatura diversa.
  if lower(v_prima.prosrc) ~ 'artecna_guardie[[:space:]]*\.[[:space:]]*valida_correzioni_variante[[:space:]]*\(' then
    raise exception 'approva_variante già protetta';
  end if;
  foreach v_marker in array array[
    'IF v_delta = 0 THEN', 'RETURN QUERY', 'UPDATE public.varianti_cantiere AS v'
  ] loop
    if length(v_prima.prosrc) - length(replace(v_prima.prosrc, v_marker, ''))
        <> length(v_marker) then
      raise exception 'Marker strutturale assente o non univoco: %', v_marker;
    end if;
  end loop;
  v_pos_if := strpos(v_prima.prosrc, 'IF v_delta = 0 THEN');
  v_pos_return := strpos(v_prima.prosrc, 'RETURN QUERY');
  v_pos_update := strpos(v_prima.prosrc, 'UPDATE public.varianti_cantiere AS v');
  if v_pos_if >= v_pos_return or v_pos_return >= v_pos_update then
    raise exception 'Ordine dei marker strutturali inatteso';
  end if;
  -- Normalizzazione esclusivamente per validare il segmento certificato.
  v_segmento := substring(v_prima.prosrc from v_pos_if for v_pos_return - v_pos_if);
  if btrim(replace(v_segmento, chr(13) || chr(10), chr(10)), ' ' || chr(9) || chr(13) || chr(10))
      is distinct from replace(v_controllo, chr(13) || chr(10), chr(10))
    or substring(v_prima.prosrc from v_pos_return + length('RETURN QUERY')
      for v_pos_update - v_pos_return - length('RETURN QUERY')) !~ '^[[:space:]]+$'
    or substring(v_prima.prosrc from v_pos_return - 3 for 3) <> chr(10) || '  ' then
    raise exception 'Controllo delta, separazione UPDATE o indentazione inattesi';
  end if;

  v_newline := case when strpos(v_prima.prosrc, chr(13) || chr(10)) > 0
    then chr(13) || chr(10) else chr(10) end;
  -- Inserimento prima dei due spazi originali di RETURN QUERY: nessun byte rimosso.
  v_pos_inserimento := v_pos_return - 2;
  v_inserimento := '  PERFORM artecna_guardie.valida_correzioni_variante(' || v_newline
    || '    v_variante.id,' || v_newline
    || '    v_cantiere.id,' || v_newline
    || '    v_variante.preventivo_contrattuale_id' || v_newline
    || '  );' || v_newline || v_newline;
  v_prosrc_nuovo := substring(v_prima.prosrc from 1 for v_pos_inserimento - 1)
    || v_inserimento || substring(v_prima.prosrc from v_pos_inserimento);
  if length(v_prosrc_nuovo) - length(replace(v_prosrc_nuovo, v_chiamata, ''))
      <> length(v_chiamata)
    or strpos(v_prosrc_nuovo, v_chiamata) >= strpos(v_prosrc_nuovo, 'RETURN QUERY') then
    raise exception 'Chiamata al validatore non unica o in posizione errata';
  end if;
  if replace(v_prosrc_nuovo, v_inserimento, '') is distinct from v_prima.prosrc then
    raise exception 'Inserimento non reversibile byte-for-byte';
  end if;

  -- Il wrapper serve solo a preservare gli attributi della definizione.
  -- L'ancoraggio applicativo viene verificato esclusivamente in prosrc.
  v_definizione := pg_catalog.pg_get_functiondef(v_prima.oid);
  select count(*), min(r.parti[1])
  into v_num_delimitatori, v_delimitatore
  from pg_catalog.regexp_matches(
    v_definizione, '(?n)^AS (\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$)', 'g'
  ) as r(parti);
  if v_num_delimitatori <> 1 or v_delimitatore is null then
    raise exception 'Delimitatore AS del corpo assente o non univoco';
  end if;
  if (length(v_definizione) - length(replace(v_definizione, v_delimitatore, '')))
      <> 2 * length(v_delimitatore)
    or split_part(v_definizione, v_delimitatore, 2) is distinct from v_prima.prosrc
    or strpos(v_prosrc_nuovo, v_delimitatore) > 0 then
    raise exception 'Corpo delimitato non identificabile con certezza';
  end if;

  -- PERFORM separato dopo i lock e i controlli certificati, prima di RETURN QUERY UPDATE.
  -- Nessuna modifica a lock, eccezioni, firma, RETURNS o ACL. Non esegue la RPC.
  execute split_part(v_definizione, v_delimitatore, 1)
    || v_delimitatore || v_prosrc_nuovo || v_delimitatore
    || split_part(v_definizione, v_delimitatore, 3);

  select p.* into strict v_dopo from pg_catalog.pg_proc p where p.oid = v_prima.oid;
  if v_dopo.prosrc is distinct from v_prosrc_nuovo
    or (to_jsonb(v_dopo) - 'prosrc') is distinct from (to_jsonb(v_prima) - 'prosrc') then
    raise exception 'La patch ha modificato attributi diversi dal solo PERFORM previsto';
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
