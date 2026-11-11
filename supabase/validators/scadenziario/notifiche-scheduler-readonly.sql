BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '8s';

DO $validate$
BEGIN
  IF current_database() <> 'postgres'
     OR NOT (SELECT rolbypassrls OR rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user)
  THEN
    RAISE EXCEPTION 'Il validator richiede accesso completo a cron.job nel database postgres';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_language l ON l.oid = p.prolang
    WHERE p.oid = to_regprocedure('artecna_notifiche.esegui_generatore_runtime()')
      AND p.pronargs = 0 AND p.pronargdefaults = 0 AND NOT p.proretset
      AND p.prokind = 'f' AND p.prorettype = 'integer'::regtype
      AND p.proowner = 'postgres'::regrole AND p.prosecdef AND l.lanname = 'sql'
      AND p.proconfig = ARRAY['search_path=pg_catalog, pg_temp']
      AND btrim(p.prosrc, E' \r\n\t') =
        'SELECT artecna_notifiche.genera_scadenze(pg_catalog.now());'
  ) THEN
    RAISE EXCEPTION 'Firma, owner, search_path o corpo del wrapper divergenti';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_language l ON l.oid = p.prolang
    WHERE p.oid = to_regprocedure('artecna_notifiche.genera_scadenze(timestamp with time zone)')
      AND p.proowner = 'postgres'::regrole AND p.prosecdef AND l.lanname = 'plpgsql'
      AND p.proconfig = ARRAY['search_path=pg_catalog, pg_temp']
      AND md5(replace(p.prosrc, E'\r\n', E'\n')) = 'bb69b7b5d4e258be6a73684791dc52be'
  ) THEN
    RAISE EXCEPTION 'Definizione certificata del generatore divergente';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND p.proname ~* '(genera_scadenze|esegui_generatore_runtime)'
      AND (
        EXISTS (
          SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
          WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
        )
        OR has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
        OR has_function_privilege('service_role', p.oid, 'EXECUTE')
      )
  ) THEN
    RAISE EXCEPTION 'Funzione scheduler esposta al client';
  END IF;

  IF (SELECT count(*) FROM cron.job WHERE jobname = 'artecna-notifiche-reconcile') <> 1
     OR NOT EXISTS (
       SELECT 1 FROM cron.job
       WHERE jobname = 'artecna-notifiche-reconcile'
         AND schedule = '10 * * * *'
         AND database = 'postgres'
         AND username = 'postgres'
         AND command = 'SELECT artecna_notifiche.esegui_generatore_runtime();'
         AND active IS TRUE
     )
  THEN
    RAISE EXCEPTION 'Job scheduler assente, duplicato o divergente';
  END IF;
END;
$validate$;

SELECT job.jobid, job.jobname, job.schedule, job.database, job.username, job.command, job.active,
  run.runid, run.start_time, run.end_time, run.end_time - run.start_time AS durata,
  coalesce(run.status, 'never_run') AS stato_ultima_esecuzione,
  run.return_message
FROM cron.job AS job
LEFT JOIN LATERAL (
  SELECT runid, start_time, end_time, status, return_message
  FROM cron.job_run_details
  WHERE jobid = job.jobid
  ORDER BY runid DESC
  LIMIT 1
) AS run ON true
WHERE job.jobname = 'artecna-notifiche-reconcile';

ROLLBACK;
