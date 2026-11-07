BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
DO $$
BEGIN
 IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_storage_worker' AND NOT rolcanlogin) THEN
  RAISE EXCEPTION 'Capability/installer Storage inatteso'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_storage_worker_login') THEN
  CREATE ROLE artecna_storage_worker_login LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
 -- Unexpected existing grants must be reviewed, never silently inherited.
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE member='artecna_storage_worker_login'::regrole
  AND (roleid<>'artecna_storage_worker'::regrole OR admin_option)) THEN
  RAISE EXCEPTION 'Membership login Storage inattesa'; END IF;
 IF EXISTS(SELECT 1 FROM pg_shdepend WHERE refclassid='pg_authid'::regclass AND refobjid='artecna_storage_worker_login'::regrole AND deptype IN ('a','o')) THEN
  RAISE EXCEPTION 'Privilegi diretti/ownership login Storage inattesi'; END IF;
 ALTER ROLE artecna_storage_worker_login LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 GRANT artecna_storage_worker TO artecna_storage_worker_login WITH INHERIT TRUE, SET FALSE;
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
COMMIT;
