BEGIN READ ONLY;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='5s';
WITH target_roles AS (
 SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolbypassrls
 FROM pg_roles WHERE rolname IN (current_user,'postgres','artecna_varianti_rpc','authenticated','anon','service_role')
), routines AS (
 SELECT n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS args,
 pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS security_definer,p.provolatile AS volatility,
 p.proconfig AS config,md5(pg_get_functiondef(p.oid)) AS definition_md5,
 (SELECT jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantor,a.grantee,a.privilege_type)
 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a) AS acl
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','artecna_guardie') AND p.prokind IN ('f','p')
), rels AS (
 SELECT c.oid,n.nspname AS schema,c.relname,c.relkind,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f','S')
)
SELECT jsonb_build_object(
 'meta',jsonb_build_object('database',current_database(),'user',current_user,'read_only',current_setting('transaction_read_only'),'time',current_timestamp,'server_version',current_setting('server_version')),
 'prerequisites',jsonb_build_object(
 'new_rpc_absent',to_regprocedure('public.leggi_identita_lavorazioni_variante(uuid)') IS NULL,
 'public_name_collisions',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='leggi_identita_lavorazioni_variante'),
 'function_owner_expected','postgres',
 'guard_jwt',to_regprocedure('artecna_guardie.utente_jwt_corrente()') IS NOT NULL,
 'guard_cantiere',to_regprocedure('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)') IS NOT NULL,
 'installer_create_public',has_schema_privilege(current_user,'public','CREATE'),
 'owner_create_public',has_schema_privilege(current_user,'public','CREATE'),
 'owner_usage_public',has_schema_privilege(current_user,'public','USAGE'),
 'owner_usage_guardie',has_schema_privilege(current_user,'artecna_guardie','USAGE'),
 'owner_execute_jwt',has_function_privilege(current_user,'artecna_guardie.utente_jwt_corrente()','EXECUTE'),
 'owner_execute_guard',has_function_privilege(current_user,'artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)','EXECUTE'),
 'authenticated_usage_public',has_schema_privilege('authenticated','public','USAGE')),
 'column_privileges',(SELECT jsonb_agg(jsonb_build_object('table',t.tabella,'column',t.colonna,'select',has_column_privilege(current_user,'public.'||t.tabella,t.colonna,'SELECT')) ORDER BY t.tabella,t.colonna) FROM (VALUES ('varianti_cantiere','id'),('varianti_cantiere','cantiere_id'),('variante_lavorazioni','id'),('variante_lavorazioni','variante_id'),('variante_lavorazioni','variante_sorgente_id'),('variante_lavorazioni','indice_voce_sorgente')) t(tabella,colonna)),
 'roles',(SELECT jsonb_agg(to_jsonb(target_roles) ORDER BY rolname) FROM target_roles),
 'memberships',(SELECT jsonb_agg(jsonb_build_object('role',pg_get_userbyid(m.roleid),'member',pg_get_userbyid(m.member),'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY m.roleid,m.member) FROM pg_auth_members m WHERE m.roleid IN (SELECT oid FROM pg_roles WHERE rolname IN ('postgres','artecna_varianti_rpc')) OR m.member IN (SELECT oid FROM pg_roles WHERE rolname IN ('postgres','artecna_varianti_rpc'))),
 'schema_acl',(SELECT jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl) ORDER BY nspname) FROM pg_namespace WHERE nspname IN ('public','artecna_guardie')),
 'default_acl',(SELECT jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(defaclrole),'schema',CASE WHEN defaclnamespace=0 THEN '' ELSE defaclnamespace::regnamespace::text END,'type',defaclobjtype,'acl',defaclacl) ORDER BY defaclrole,defaclnamespace,defaclobjtype) FROM pg_default_acl WHERE defaclrole IN (SELECT oid FROM pg_roles WHERE rolname IN ('postgres','artecna_varianti_rpc'))),
 'routines',(SELECT jsonb_agg(to_jsonb(routines) ORDER BY schema,name,args) FROM routines),
 'new_rpc_definition',(SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='leggi_identita_lavorazioni_variante' AND p.pronargs=1 AND p.proargtypes[0]='uuid'::regtype),
 'new_rpc_dependencies',(SELECT jsonb_agg(jsonb_build_object('type',d.deptype,'reference',pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid)) ORDER BY d.refclassid,d.refobjid,d.refobjsubid) FROM pg_depend d JOIN pg_proc p ON d.classid='pg_proc'::regclass AND p.oid=d.objid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='leggi_identita_lavorazioni_variante'),
 'relations',(SELECT jsonb_agg(to_jsonb(rels)-'oid' ORDER BY schema,relname) FROM rels),
 'columns',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'number',a.attnum,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'acl',a.attacl,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY r.relname,a.attnum) FROM rels r JOIN pg_attribute a ON a.attrelid=r.oid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',k.conname,'type',k.contype,'definition',pg_get_constraintdef(k.oid,true),'validated',k.convalidated) ORDER BY r.relname,k.conname) FROM rels r JOIN pg_constraint k ON k.conrelid=r.oid),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM pg_policies p WHERE schemaname='public'),
 'indexes',(SELECT jsonb_agg(to_jsonb(i) ORDER BY tablename,indexname) FROM pg_indexes i WHERE schemaname='public'),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid,true)) ORDER BY r.relname,t.tgname) FROM rels r JOIN pg_trigger t ON t.tgrelid=r.oid WHERE NOT t.tgisinternal),
 'protected_data',jsonb_build_array(
  jsonb_build_object('table','varianti_cantiere','count',(SELECT count(*) FROM public.varianti_cantiere),'fingerprint',(SELECT md5(coalesce(jsonb_agg(to_jsonb(v) ORDER BY id)::text,'[]')) FROM public.varianti_cantiere v)),
  jsonb_build_object('table','variante_lavorazioni','count',(SELECT count(*) FROM public.variante_lavorazioni),'fingerprint',(SELECT md5(coalesce(jsonb_agg(to_jsonb(l) ORDER BY id)::text,'[]')) FROM public.variante_lavorazioni l))
 )
);
ROLLBACK;
