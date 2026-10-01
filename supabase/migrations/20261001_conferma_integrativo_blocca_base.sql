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
  v_newline text;
  v_marker text;
  v_tabella text;
  v_vecchi text[] := array[
    $decl_old$  v_variante public.varianti_cantiere%rowtype;$decl_old$,
    $lock_old$  select v.* into v_variante
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
$lock_old$,
    $source_old$    perform 1 from public.variante_sorgenti s
    where s.id = v_sorgente and s.variante_id = p_variante_id;
    if not found then
      raise exception using errcode = '22023', message = 'Sorgente non appartenente alla Variante';
    end if;$source_old$
  ];
  v_nuovi text[] := array[
    $decl_new$  v_variante public.varianti_cantiere%rowtype;
  v_cantiere_id uuid;
  v_cantiere public.cantieri%rowtype;
  v_sorgente_reale public.variante_sorgenti%rowtype;$decl_new$,
    $lock_new$  -- Lettura senza lock: serve soltanto a individuare il cantiere da bloccare.
  select v.cantiere_id into v_cantiere_id
  from public.varianti_cantiere v where v.id = p_variante_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Variante non disponibile';
  end if;
  select c.* into v_cantiere
  from public.cantieri c where c.id = v_cantiere_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Cantiere non disponibile';
  end if;
  if artecna_guardie.utente_puo_modificare_cantiere(v_utente, v_cantiere.id) is not true then
    raise exception using errcode = '42501', message = 'Cantiere non autorizzato';
  end if;
  -- Ordine condiviso con le RPC Varianti: cantiere -> Variante.
  select v.* into v_variante
  from public.varianti_cantiere v where v.id = p_variante_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Variante non disponibile';
  end if;
  if v_variante.cantiere_id is distinct from v_cantiere.id then
    raise exception using errcode = '22023', message = 'Cantiere della Variante cambiato';
  end if;
  if v_variante.stato is distinct from 'bozza' then
    raise exception using errcode = '22023', message = 'Variante non in bozza';
  end if;
  if v_cantiere.preventivo_contrattuale_id is null
    or v_variante.preventivo_contrattuale_id is null
    or v_variante.preventivo_contrattuale_id is distinct from v_cantiere.preventivo_contrattuale_id
    or not exists (
      select 1 from public.preventivi_cantiere p
      where p.id = v_cantiere.preventivo_contrattuale_id and p.cantiere_id = v_cantiere.id
    ) then
    raise exception using errcode = '22023', message = 'Contratto corrente non disponibile o cambiato';
  end if;
$lock_new$,
    $source_new$    select s.* into v_sorgente_reale from public.variante_sorgenti s
    where s.id = v_sorgente and s.variante_id = p_variante_id;
    if not found then
      raise exception using errcode = '22023', message = 'Sorgente non appartenente alla Variante';
    end if;
    if v_sorgente_reale.tipo = 'preventivo_artecna' then
      if v_sorgente_reale.preventivo_sorgente_id is null
        or not exists (
          select 1 from public.preventivi_cantiere p
          where p.id = v_sorgente_reale.preventivo_sorgente_id and p.cantiere_id = v_cantiere.id
        ) then
        raise exception using errcode = '22023', message = 'Preventivo sorgente non coerente con il cantiere';
      end if;
      if v_sorgente_reale.preventivo_sorgente_id = v_variante.preventivo_contrattuale_id then
        raise exception using errcode = 'P2101',
          message = 'La base contrattuale non puo essere confermata come nuova lavorazione';
      end if;
    elsif v_sorgente_reale.tipo = 'file' then
      if v_sorgente_reale.preventivo_sorgente_id is not null then
        raise exception using errcode = '22023', message = 'Sorgente file non coerente';
      end if;
    else
      raise exception using errcode = '22023', message = 'Tipo sorgente non valido';
    end if;$source_new$
  ];
  v_i integer;
begin
  select p.* into v_prima from pg_catalog.pg_proc p
  where p.oid = to_regprocedure('public.conferma_preventivo_integrativo(uuid,jsonb)');
  if not found then raise exception 'RPC conferma_preventivo_integrativo non disponibile'; end if;
  if current_user <> 'artecna_varianti_rpc'
    or v_prima.proowner <> 'artecna_varianti_rpc'::regrole
    or not v_prima.prosecdef or v_prima.provolatile <> 'v'
    or v_prima.proconfig is distinct from array['search_path=pg_catalog, pg_temp']::text[]
    or not has_function_privilege('artecna_varianti_rpc', v_prima.oid, 'EXECUTE')
    or not has_function_privilege('authenticated', v_prima.oid, 'EXECUTE')
    or has_function_privilege('anon', v_prima.oid, 'EXECUTE')
    or exists (
      select 1 from pg_catalog.aclexplode(coalesce(v_prima.proacl, pg_catalog.acldefault('f', v_prima.proowner))) a
      where a.grantee not in ('artecna_varianti_rpc'::regrole, 'authenticated'::regrole)
        or (a.grantee = 'authenticated'::regrole and a.is_grantable)
    ) then
    raise exception 'Owner, sicurezza, volatility, search_path o ACL inattesi';
  end if;
  foreach v_tabella in array array['public.cantieri', 'public.varianti_cantiere',
    'public.variante_sorgenti', 'public.preventivi_cantiere'] loop
    if not has_table_privilege('artecna_varianti_rpc', v_tabella, 'SELECT') then
      raise exception 'Privilegio SELECT preesistente mancante: %', v_tabella;
    end if;
  end loop;
  foreach v_tabella in array array['public.cantieri', 'public.varianti_cantiere'] loop
    if not has_any_column_privilege('artecna_varianti_rpc', v_tabella, 'UPDATE') then
      raise exception 'Privilegio di lock preesistente mancante: %', v_tabella;
    end if;
  end loop;
  -- Certifica soltanto prosrc, mai il wrapper di pg_get_functiondef.
  if v_prima.prosrc ~* 'P2101'
    or v_prima.prosrc ~* 'v_cantiere_id|v_cantiere|v_sorgente_reale'
    or v_prima.prosrc ~* 'from[[:space:]]+public[[:space:]]*\.[[:space:]]*cantieri'
    or v_prima.prosrc ~* 'select[[:space:]]+s[[:space:]]*\.[[:space:]]*\*'
    or v_prima.prosrc ~* 's[[:space:]]*\.[[:space:]]*(tipo|preventivo_sorgente_id)'
    or v_prima.prosrc ~* 'Contratto corrente non disponibile o cambiato' then
    raise exception 'P2101 o nuova logica gia presenti: patch interrotta';
  end if;
  -- Un solo marker per fase e ordine certificato, prima di qualsiasi sostituzione.
  foreach v_marker in array array['declare', '-- Fase 1:',
    '    v_indice := v_indice_num::integer;',
    '    v_chiave := v_sorgente::text || '':'' || v_indice::text;',
    '-- Fase 2:', 'insert into public.variante_lavorazioni'] loop
    if length(v_prima.prosrc) - length(replace(v_prima.prosrc, v_marker, '')) <> length(v_marker) then
      raise exception 'Marker strutturale assente o non univoco: %', v_marker;
    end if;
  end loop;
  v_newline := case when strpos(v_prima.prosrc, chr(13) || chr(10)) > 0
    then chr(13) || chr(10) else chr(10) end;
  v_prosrc_nuovo := v_prima.prosrc;
  for v_i in 1..3 loop
    -- Anche i literal della migration possono essere LF o CRLF: normalizza solo questi.
    v_vecchi[v_i] := replace(replace(v_vecchi[v_i], chr(13) || chr(10), chr(10)), chr(10), v_newline);
    v_nuovi[v_i] := replace(replace(v_nuovi[v_i], chr(13) || chr(10), chr(10)), chr(10), v_newline);
    v_marker := v_vecchi[v_i];
    if length(v_prosrc_nuovo) - length(replace(v_prosrc_nuovo, v_marker, '')) <> length(v_marker) then
      raise exception 'Ancoraggio assente o non univoco: %', v_i;
    end if;
  end loop;
  if not (
    strpos(v_prima.prosrc, 'declare') < strpos(v_prima.prosrc, v_vecchi[1])
    and strpos(v_prima.prosrc, v_vecchi[1]) < strpos(v_prima.prosrc, v_vecchi[2])
    and strpos(v_prima.prosrc, v_vecchi[2]) < strpos(v_prima.prosrc, '-- Fase 1:')
    and strpos(v_prima.prosrc, '-- Fase 1:') < strpos(v_prima.prosrc, '    v_indice := v_indice_num::integer;')
    and strpos(v_prima.prosrc, '    v_indice := v_indice_num::integer;') < strpos(v_prima.prosrc, v_vecchi[3])
    and strpos(v_prima.prosrc, v_vecchi[3]) < strpos(v_prima.prosrc, '    v_chiave := v_sorgente::text || '':'' || v_indice::text;')
    and strpos(v_prima.prosrc, '    v_chiave := v_sorgente::text || '':'' || v_indice::text;') < strpos(v_prima.prosrc, '-- Fase 2:')
    and strpos(v_prima.prosrc, '-- Fase 2:') < strpos(v_prima.prosrc, 'insert into public.variante_lavorazioni')
  ) then
    raise exception 'Ordine degli ancoraggi strutturali inatteso';
  end if;
  for v_i in 1..3 loop
    v_prosrc_nuovo := replace(v_prosrc_nuovo, v_vecchi[v_i], v_nuovi[v_i]);
  end loop;
  -- Reversibilita byte-for-byte: il resto del corpo, incluse Fase 2 ed eccezioni, resta intatto.
  v_marker := v_prosrc_nuovo;
  for v_i in reverse 3..1 loop
    v_marker := replace(v_marker, v_nuovi[v_i], v_vecchi[v_i]);
  end loop;
  if v_marker is distinct from v_prima.prosrc
    or strpos(v_prosrc_nuovo, 'P2101') >= strpos(v_prosrc_nuovo, 'insert into public.variante_lavorazioni') then
    raise exception 'Patch non reversibile o controllo base dopo INSERT';
  end if;
  v_definizione := pg_catalog.pg_get_functiondef(v_prima.oid);
  select count(*), min(r.parti[1]) into v_num_delimitatori, v_delimitatore
  from pg_catalog.regexp_matches(v_definizione,
    '(?n)^AS (\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$)', 'g') as r(parti);
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
