BEGIN READ ONLY;

DO $$
DECLARE
  runtime oid := 'artecna_notifiche.esegui_generatore_runtime()'::regprocedure;
  producer oid := 'artecna_notifiche.genera_agenda(timestamptz)'::regprocedure;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid = runtime AND p.prosecdef AND p.pronargs = 0
      AND pg_get_userbyid(p.proowner) = 'postgres'
      AND p.proconfig = ARRAY['search_path=pg_catalog, pg_temp']
      AND btrim(replace(p.prosrc, chr(13), ''), E'\n') = $wrapper$DECLARE
  ora_batch timestamptz := pg_catalog.now();
  scadenze integer;
BEGIN
  scadenze := artecna_notifiche.genera_scadenze(ora_batch);
  RETURN scadenze + artecna_notifiche.genera_agenda(ora_batch);
END;$wrapper$
  ) THEN RAISE EXCEPTION 'Wrapper notifiche divergente'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    WHERE p.oid IN (runtime, producer) AND acl.grantee <> p.proowner AND acl.privilege_type = 'EXECUTE'
  ) THEN RAISE EXCEPTION 'Funzione runtime esposta'; END IF;

  IF to_regclass('cron.job') IS NOT NULL THEN
    IF (SELECT count(*) FROM cron.job WHERE jobname = 'artecna-notifiche-reconcile') <> 1 OR NOT EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'artecna-notifiche-reconcile' AND active
        AND database = 'postgres' AND username = 'postgres' AND schedule = '10 * * * *'
        AND command = 'SELECT artecna_notifiche.esegui_generatore_runtime();'
    ) THEN RAISE EXCEPTION 'Job notifiche divergente'; END IF;
  END IF;
END;
$$;

ROLLBACK;
