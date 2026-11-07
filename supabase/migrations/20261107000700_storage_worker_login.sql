BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
DO $$
DECLARE installer oid;is_super boolean;can_create boolean;worker oid;login oid;helper oid;r record;
BEGIN
 SELECT oid,rolsuper,rolcreaterole INTO installer,is_super,can_create FROM pg_roles WHERE rolname=current_user;
 IF current_user<>'postgres' OR NOT (is_super OR can_create) THEN
  RAISE EXCEPTION 'Installer Storage: richiesto postgres con CREATEROLE' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname='artecna_distruzione'
  AND has_schema_privilege(current_user,n.oid,'USAGE') AND has_schema_privilege(current_user,n.oid,'CREATE'))
 OR NOT has_language_privilege(current_user,'sql','USAGE') THEN
  RAISE EXCEPTION 'Autorita schema/linguaggio Storage assente' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_storage_worker') THEN
  CREATE ROLE artecna_storage_worker NOLOGIN INHERIT;
 END IF;
 SELECT oid INTO worker FROM pg_roles WHERE rolname='artecna_storage_worker';
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE oid=worker AND NOT rolcanlogin AND rolinherit
  AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls) THEN
  RAISE EXCEPTION 'Attributi capability Storage inattesi: nessuna correzione automatica'; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE member=worker) THEN
  RAISE EXCEPTION 'Capability Storage eredita ruoli inattesi'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_storage_worker_login') THEN
  CREATE ROLE artecna_storage_worker_login LOGIN INHERIT;
 END IF;
 SELECT oid INTO login FROM pg_roles WHERE rolname='artecna_storage_worker_login';
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE oid=login AND rolcanlogin AND rolinherit
  AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls) THEN
  RAISE EXCEPTION 'Attributi login Storage inattesi: nessuna correzione automatica'; END IF;
 IF EXISTS(SELECT 1 FROM pg_db_role_setting WHERE setrole IN(worker,login)) THEN
  RAISE EXCEPTION 'Configurazione per-ruolo Storage inattesa';
 END IF;
 -- Unexpected existing grants must be reviewed, never silently inherited.
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE member='artecna_storage_worker_login'::regrole
  AND (roleid<>worker OR admin_option OR NOT inherit_option OR set_option)) THEN
  RAISE EXCEPTION 'Membership login Storage inattesa'; END IF;
 IF EXISTS(SELECT 1 FROM pg_shdepend WHERE refclassid='pg_authid'::regclass AND refobjid='artecna_storage_worker_login'::regrole AND deptype IN ('a','o')) THEN
  RAISE EXCEPTION 'Privilegi diretti/ownership login Storage inattesi'; END IF;
 -- The capability must have no ownership or direct grants outside its contract.
 FOR r IN SELECT * FROM pg_shdepend WHERE refclassid='pg_authid'::regclass AND refobjid=worker AND deptype IN('a','o') LOOP
  IF r.deptype='o' OR r.dbid NOT IN(0,(SELECT oid FROM pg_database WHERE datname=current_database()))
   OR NOT coalesce((r.classid='pg_namespace'::regclass AND r.objid=to_regnamespace('artecna_distruzione'))
    OR (r.classid='pg_proc'::regclass AND r.objid IN(to_regprocedure('artecna_distruzione.storage_claim()'),
     to_regprocedure('artecna_distruzione.storage_finish(bigint,uuid,boolean,boolean,text)'),
     to_regprocedure('artecna_distruzione.storage_verifica_job(bigint,uuid)'))),false) THEN
   RAISE EXCEPTION 'Privilegi diretti/ownership capability Storage inattesi'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(CASE WHEN cardinality(n.nspacl)>0 THEN n.nspacl END) a
  WHERE n.nspname='artecna_distruzione' AND a.grantee=worker AND (a.privilege_type<>'USAGE' OR a.is_grantable))
 OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(CASE WHEN cardinality(p.proacl)>0 THEN p.proacl END) a
  WHERE a.grantee=worker AND (a.privilege_type<>'EXECUTE' OR a.is_grantable)) THEN
  RAISE EXCEPTION 'ACL capability Storage non minimali'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid=worker AND member=login) THEN
  -- CREATEROLE is not role-grant authority. Accept only a proven direct ADMIN
  -- option (automatically assigned to a PG17 non-superuser creator) or superuser.
  IF NOT is_super AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid=worker AND member=installer AND admin_option) THEN
   RAISE EXCEPTION 'ADMIN OPTION sulla capability Storage assente' USING ERRCODE='42501'; END IF;
  GRANT artecna_storage_worker TO artecna_storage_worker_login WITH ADMIN FALSE, INHERIT TRUE, SET FALSE;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid=worker AND member=login AND NOT admin_option AND inherit_option AND NOT set_option) THEN
  RAISE EXCEPTION 'Membership Storage non conforme al contratto'; END IF;
 helper:=to_regprocedure('artecna_distruzione.storage_verifica_job(bigint,uuid)');
 IF helper IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=helper AND proowner=installer AND prolang=(SELECT oid FROM pg_language WHERE lanname='sql')
   AND prorettype='boolean'::regtype AND NOT proretset AND prosecdef AND provolatile='s' AND NOT proisstrict AND NOT proleakproof AND proparallel='u'
   AND proconfig=ARRAY['search_path=pg_catalog, pg_temp'] AND md5(prosrc)='27ff4d4288eac279ea5e3741fdffeb53')
  OR (SELECT count(*) FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=helper)<>2
  OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   WHERE p.oid=helper AND (a.grantee NOT IN(installer,worker) OR a.grantor<>installer OR a.privilege_type<>'EXECUTE' OR a.is_grantable)) THEN
   RAISE EXCEPTION 'Helper Storage esistente divergente: owner/corpo/ACL non corretti'; END IF;
 END IF;
END $$;
-- No password is supplied, set or reset. A newly created login cannot use
-- password authentication until an administrator configures its secret.
CREATE OR REPLACE FUNCTION artecna_distruzione.storage_verifica_job(job bigint,token uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT pg_has_role(session_user,'artecna_storage_worker','MEMBER') AND EXISTS(
  SELECT 1 FROM artecna_distruzione.cleanup_storage j
  JOIN artecna_distruzione.storage_oggetti o USING(bucket,path)
  WHERE j.id=job AND j.lease_id=token AND j.lease_backend=pg_backend_pid()
  AND j.lease_until>clock_timestamp() AND o.stato='cancellazione'
  AND o.cleanup_autorizzato AND artecna_distruzione.numero_riferimenti_vivi(j.bucket,j.path)=0
  AND EXISTS(SELECT 1 FROM pg_locks l WHERE l.locktype='advisory' AND l.pid=pg_backend_pid()
   AND l.granted AND l.objsubid=1
   AND l.classid=((artecna_distruzione.storage_lock_key(j.bucket,j.path)>>32)&4294967295)::oid
   AND l.objid=(artecna_distruzione.storage_lock_key(j.bucket,j.path)&4294967295)::oid))
$$;
-- Neutralize default function grants only on this new capability.
DO $$ DECLARE a record; BEGIN
 FOR a IN SELECT DISTINCT grantee FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid='artecna_distruzione.storage_verifica_job(bigint,uuid)'::regprocedure)) LOOP
  IF a.grantee<> 'postgres'::regrole THEN
   EXECUTE format('REVOKE ALL ON FUNCTION artecna_distruzione.storage_verifica_job(bigint,uuid) FROM %s',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END);
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION artecna_distruzione.storage_verifica_job(bigint,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION artecna_distruzione.storage_verifica_job(bigint,uuid) TO artecna_storage_worker;
DO $$ DECLARE installer oid:='postgres'::regrole;worker oid:='artecna_storage_worker'::regrole;helper oid:='artecna_distruzione.storage_verifica_job(bigint,uuid)'::regprocedure; BEGIN
 IF (SELECT proowner FROM pg_proc WHERE oid=helper)<>installer
 OR (SELECT count(*) FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=helper)<>2
 OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  WHERE p.oid=helper AND (a.grantee NOT IN(installer,worker) OR a.grantor<>installer OR a.privilege_type<>'EXECUTE' OR a.is_grantable)) THEN
  RAISE EXCEPTION 'Owner/ACL finali helper Storage non minimali'; END IF;
END $$;
COMMIT;
