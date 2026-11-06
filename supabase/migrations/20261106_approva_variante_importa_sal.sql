begin;

-- Approvazione e materializzazione SAL nella stessa transazione.
-- Nessun backfill: le varianti storiche mantengono il recupero manuale esistente.
-- Patch fail-closed dei soli corpi certificati; nessuna copia del dominio SAL.
do $preflight$
declare
  r text;
  p pg_catalog.pg_proc%rowtype;
begin
  if current_user <> 'postgres' or session_user <> 'postgres'
    or current_setting('server_version_num')::integer / 10000 <> 17 then
    raise exception 'Installazione prevista come postgres su PostgreSQL 17';
  end if;
  foreach r in array array['artecna_varianti_rpc','artecna_sal_rpc'] loop
    if (select count(*) from pg_catalog.pg_auth_members
        where roleid = r::regrole and member = 'postgres'::regrole) <> 1
      or not exists (select 1 from pg_catalog.pg_auth_members
        where roleid = r::regrole and member = 'postgres'::regrole
          and grantor = 'supabase_admin'::regrole
          and admin_option and not inherit_option and not set_option)
      or pg_has_role('postgres', r, 'SET')
      or has_schema_privilege(r, 'public', 'CREATE') then
      raise exception 'Membership o privilegi iniziali inattesi: %', r;
    end if;
  end loop;
  foreach r in array array['public.approva_variante(uuid,text)',
    'public.importa_variante_approvata_nel_sal(uuid)'] loop
    select * into p from pg_catalog.pg_proc where oid = to_regprocedure(r);
    if not found then raise exception 'RPC richiesta assente: %', r; end if;
    if not p.prosecdef or p.provolatile <> 'v'
      or p.proconfig is distinct from array['search_path=pg_catalog, pg_temp']::text[]
      or p.proowner <> (case when r like 'public.approva_%' then 'artecna_varianti_rpc'
        else 'artecna_sal_rpc' end)::regrole
      or encode(sha256(convert_to(replace(p.prosrc, chr(13)||chr(10), chr(10)), 'UTF8')), 'hex')
        <> (case when r like 'public.approva_%'
          then 'c39e78007df82a8708d69a1455c1d38071e7148937c0c42d2fbe0a17d24c8b0a'
          else '3d24557ff7747ddbbd4573e8d57f81ddfc5394b6a3f21bcf0d7ca886b46d1d74' end)
      or not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      or exists (select 1 from pg_catalog.aclexplode(p.proacl) a
        where a.privilege_type <> 'EXECUTE' or a.is_grantable
          or a.grantee not in (p.proowner, 'authenticated'::regrole)
          or a.grantor <> p.proowner)
      or (select count(*) from pg_catalog.aclexplode(p.proacl)) <> 2 then
      raise exception 'Corpo, sicurezza o ACL RPC inattesi: %', r;
    end if;
  end loop;
end;
$preflight$;

-- Il definer dell'approvazione può invocare il definer SAL, senza nuovi diritti
-- sulle tabelle e senza cambiare JWT/guardia canonica dell'importatore.
grant artecna_sal_rpc to postgres
  with admin false, inherit false, set true granted by postgres;
set local role artecna_sal_rpc;
grant execute on function public.importa_variante_approvata_nel_sal(uuid)
  to artecna_varianti_rpc;
reset role;
revoke artecna_sal_rpc from postgres granted by postgres restrict;

grant artecna_varianti_rpc to postgres
  with admin false, inherit false, set true granted by postgres;
grant create on schema public to artecna_varianti_rpc;
set local role artecna_varianti_rpc;

do $patch$
declare
  prima pg_catalog.pg_proc%rowtype;
  dopo pg_catalog.pg_proc%rowtype;
  definizione text;
  delimitatore text;
  corpo text;
  nl text;
  marker text;
begin
  select * into strict prima from pg_catalog.pg_proc
    where oid = 'public.approva_variante(uuid,text)'::regprocedure;
  nl := case when strpos(prima.prosrc, chr(13)||chr(10)) > 0
    then chr(13)||chr(10) else chr(10) end;
  marker := nl || 'EXCEPTION' || nl || '  WHEN serialization_failure OR deadlock_detected THEN';
  if (length(prima.prosrc) - length(replace(prima.prosrc, marker, ''))) <> length(marker)
    or strpos(prima.prosrc, 'importa_variante_approvata_nel_sal') > 0 then
    raise exception 'Punto di inserimento non univoco o patch già applicata';
  end if;
  -- RETURN QUERY accoda il risultato; l'esecuzione prosegue prima di restituirlo.
  -- Qualsiasi errore SAL propaga e annulla anche UPDATE/risultato approvazione.
  corpo := replace(prima.prosrc, marker,
    nl || '  PERFORM public.importa_variante_approvata_nel_sal(v_variante.id);'
      || nl || marker);
  definizione := pg_catalog.pg_get_functiondef(prima.oid);
  select m[1] into strict delimitatore from pg_catalog.regexp_matches(
    definizione, '(?n)^AS (\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$)', 'g') m;
  if split_part(definizione, delimitatore, 2) is distinct from prima.prosrc
    or strpos(corpo, delimitatore) > 0
    or length(definizione)-length(replace(definizione, delimitatore,'')) <> 2*length(delimitatore) then
    raise exception 'Corpo delimitato non identificabile';
  end if;
  execute split_part(definizione, delimitatore, 1) || delimitatore || corpo
    || delimitatore || split_part(definizione, delimitatore, 3);
  select * into strict dopo from pg_catalog.pg_proc where oid = prima.oid;
  if dopo.prosrc is distinct from corpo
    or (to_jsonb(dopo)-'prosrc') is distinct from (to_jsonb(prima)-'prosrc') then
    raise exception 'Modifica inattesa degli attributi approva_variante';
  end if;
end;
$patch$;

reset role;
revoke create on schema public from artecna_varianti_rpc;
revoke artecna_varianti_rpc from postgres granted by postgres restrict;

do $verify$
declare r text;
begin
  foreach r in array array['artecna_varianti_rpc','artecna_sal_rpc'] loop
    if (select count(*) from pg_catalog.pg_auth_members
        where roleid=r::regrole and member='postgres'::regrole) <> 1
      or not exists (select 1 from pg_catalog.pg_auth_members
        where roleid=r::regrole and member='postgres'::regrole
          and grantor='supabase_admin'::regrole
          and admin_option and not inherit_option and not set_option)
      or pg_has_role('postgres',r,'SET')
      or has_schema_privilege(r,'public','CREATE') then
      raise exception 'Privilegi temporanei non ripristinati: %', r;
    end if;
  end loop;
  if not has_function_privilege('artecna_varianti_rpc',
    'public.importa_variante_approvata_nel_sal(uuid)', 'EXECUTE') then
    raise exception 'Delega RPC SAL mancante';
  end if;
end;
$verify$;

commit;
