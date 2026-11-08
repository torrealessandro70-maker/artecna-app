-- Minimal local candidate: schema USAGE only; no Production execution authorized.
-- The 010 runtime catalog includes this schema ACL: recompute, never hard-code its signature.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
DO $usage_fix$
DECLARE before_metadata jsonb; after_metadata jsonb; before_signature text; after_signature text; changed_rows bigint;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION '011 requires the certified postgres actor' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_cantieri_delete_rpc' AND NOT rolsuper AND NOT rolinherit AND NOT rolcreaterole)
 OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='artecna_contabilita' AND nspowner='postgres'::regrole AND nspacl='{postgres=UC/postgres}'::aclitem[])
 THEN RAISE EXCEPTION '011 role/schema ACL baseline mismatch' USING ERRCODE='P2113'; END IF;
 IF has_schema_privilege('artecna_cantieri_delete_rpc','artecna_contabilita','USAGE') OR has_schema_privilege('artecna_cantieri_delete_rpc','artecna_contabilita','CREATE')
 THEN RAISE EXCEPTION '011 requires absent USAGE and CREATE; no second application' USING ERRCODE='P2113'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.elimina_cantiere_definitivamente(uuid,text)') AND proowner='artecna_cantieri_delete_rpc'::regrole AND prosecdef
 AND proconfig=ARRAY['search_path=pg_catalog, pg_temp'] AND md5(prosrc)='9262aba322f48c6b456c78570e2cbb3a' AND proacl='{artecna_cantieri_delete_rpc=X/artecna_cantieri_delete_rpc,authenticated=X/artecna_cantieri_delete_rpc}'::aclitem[])
 OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('artecna_distruzione.hard_delete_catalog()') AND md5(prosrc)='e653969ab1719f575d07038a3cbdd143')
 THEN RAISE EXCEPTION '011 certified RPC/runtime baseline mismatch' USING ERRCODE='P2113'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('artecna_contabilita.attribuzioni_clienti') AND relowner='postgres'::regrole AND relacl='{postgres=arwdDxtm/postgres,artecna_cantieri_delete_rpc=r/postgres}'::aclitem[])
 OR EXISTS(SELECT 1 FROM pg_class WHERE oid IN(to_regclass('artecna_contabilita.archivio_quote'),to_regclass('artecna_contabilita.archivio_attribuzioni')) AND (relowner<>'postgres'::regrole OR relacl IS DISTINCT FROM '{postgres=arwdDxtm/postgres}'::aclitem[]))
 OR to_regclass('artecna_contabilita.archivio_quote') IS NULL OR to_regclass('artecna_contabilita.archivio_attribuzioni') IS NULL
 THEN RAISE EXCEPTION '011 accounting table ACL baseline mismatch' USING ERRCODE='P2113'; END IF;
 IF (SELECT jsonb_agg(jsonb_build_array(p.oid::regprocedure::text,pg_get_userbyid(p.proowner),p.prosecdef,p.proconfig,p.proacl::text,md5(p.prosrc)) ORDER BY p.oid::regprocedure::text COLLATE "C") FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='artecna_contabilita') IS DISTINCT FROM '[["artecna_contabilita.autorizza(uuid)","postgres",true,["search_path=pg_catalog, pg_temp"],"{postgres=X/postgres}","6c2f16f1d87df3434ac712e81bfa0f1d"],["artecna_contabilita.proteggi_origine()","postgres",true,["search_path=pg_catalog, pg_temp"],"{postgres=X/postgres}","01de63df46ced4b8390ff007e5b05125"],["artecna_contabilita.proteggi_truncate()","postgres",true,["search_path=pg_catalog, pg_temp"],"{postgres=X/postgres}","8fae8bb0df69ec22943db0fc81a04caf"]]'::jsonb
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member='artecna_cantieri_delete_rpc'::regrole)
 OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='artecna_contabilita' AND c.relkind IN('r','p','v','m','S','f'))<>3
 OR (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='artecna_contabilita')<>6
 OR EXISTS(SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='artecna_contabilita' AND (t.typowner<>'postgres'::regrole OR t.typacl IS NOT NULL))
 THEN RAISE EXCEPTION '011 accounting functions/types/sequences/membership baseline mismatch' USING ERRCODE='P2113'; END IF;
 IF (SELECT count(*) FROM artecna_distruzione.hard_delete_catalog_expected)<>1 THEN RAISE EXCEPTION '011 expected signature cardinality mismatch' USING ERRCODE='P2113'; END IF;
 before_signature:=artecna_distruzione.hard_delete_catalog();
 IF (SELECT signature FROM artecna_distruzione.hard_delete_catalog_expected) IS DISTINCT FROM before_signature THEN RAISE EXCEPTION '011 runtime catalog drift' USING ERRCODE='P2113'; END IF;
 before_metadata:=jsonb_build_object(
 'relations',(SELECT jsonb_agg(jsonb_build_array(oid,relowner,relacl) ORDER BY oid) FROM pg_class WHERE relnamespace IN(SELECT oid FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema')),
 'functions',(SELECT jsonb_agg(jsonb_build_array(oid,proowner,proacl,prosecdef,proconfig,md5(prosrc)) ORDER BY oid) FROM pg_proc WHERE pronamespace IN(SELECT oid FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema')),
 'types',(SELECT jsonb_agg(jsonb_build_array(oid,typowner,typacl) ORDER BY oid) FROM pg_type WHERE typnamespace IN(SELECT oid FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema')),
 'other_schemas',(SELECT jsonb_agg(jsonb_build_array(oid,nspowner,nspacl) ORDER BY oid) FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname NOT IN('information_schema','artecna_contabilita')),
 'column_acls',(SELECT jsonb_agg(jsonb_build_array(attrelid,attnum,attacl) ORDER BY attrelid,attnum) FROM pg_attribute WHERE attacl IS NOT NULL),
 'default_acls',(SELECT jsonb_agg(to_jsonb(d) ORDER BY oid) FROM pg_default_acl d),
 'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member,grantor) FROM pg_auth_members m),
 'roles',(SELECT jsonb_agg(jsonb_build_array(oid,rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconfig) ORDER BY oid) FROM pg_roles));
 GRANT USAGE ON SCHEMA artecna_contabilita TO artecna_cantieri_delete_rpc;
 after_signature:=artecna_distruzione.hard_delete_catalog();
 IF after_signature IS NOT DISTINCT FROM before_signature THEN RAISE EXCEPTION '011 schema ACL not covered by certified runtime signature' USING ERRCODE='P2113'; END IF;
 UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog();
 GET DIAGNOSTICS changed_rows=ROW_COUNT;
 IF changed_rows<>1 OR (SELECT signature FROM artecna_distruzione.hard_delete_catalog_expected) IS DISTINCT FROM after_signature THEN RAISE EXCEPTION '011 signature update mismatch' USING ERRCODE='P2113'; END IF;
 after_metadata:=jsonb_build_object(
 'relations',(SELECT jsonb_agg(jsonb_build_array(oid,relowner,relacl) ORDER BY oid) FROM pg_class WHERE relnamespace IN(SELECT oid FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema')),
 'functions',(SELECT jsonb_agg(jsonb_build_array(oid,proowner,proacl,prosecdef,proconfig,md5(prosrc)) ORDER BY oid) FROM pg_proc WHERE pronamespace IN(SELECT oid FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema')),
 'types',(SELECT jsonb_agg(jsonb_build_array(oid,typowner,typacl) ORDER BY oid) FROM pg_type WHERE typnamespace IN(SELECT oid FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema')),
 'other_schemas',(SELECT jsonb_agg(jsonb_build_array(oid,nspowner,nspacl) ORDER BY oid) FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname NOT IN('information_schema','artecna_contabilita')),
 'column_acls',(SELECT jsonb_agg(jsonb_build_array(attrelid,attnum,attacl) ORDER BY attrelid,attnum) FROM pg_attribute WHERE attacl IS NOT NULL),
 'default_acls',(SELECT jsonb_agg(to_jsonb(d) ORDER BY oid) FROM pg_default_acl d),
 'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member,grantor) FROM pg_auth_members m),
 'roles',(SELECT jsonb_agg(jsonb_build_array(oid,rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconfig) ORDER BY oid) FROM pg_roles));
 IF after_metadata IS DISTINCT FROM before_metadata THEN RAISE EXCEPTION '011 changed unrelated ACL, owner, function, role or membership' USING ERRCODE='P2113'; END IF;
 IF NOT has_schema_privilege('artecna_cantieri_delete_rpc','artecna_contabilita','USAGE') OR has_schema_privilege('artecna_cantieri_delete_rpc','artecna_contabilita','CREATE')
 OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='artecna_contabilita' AND nspowner='postgres'::regrole AND nspacl='{postgres=UC/postgres,artecna_cantieri_delete_rpc=U/postgres}'::aclitem[])
 OR has_schema_privilege('authenticated','artecna_contabilita','USAGE') OR has_schema_privilege('authenticated','artecna_contabilita','CREATE')
 THEN RAISE EXCEPTION '011 schema ACL postcondition mismatch' USING ERRCODE='P2113'; END IF;
END $usage_fix$;
COMMIT;
