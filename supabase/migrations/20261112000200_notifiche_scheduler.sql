BEGIN;

SELECT pg_catalog.pg_advisory_xact_lock(20261112, 2);

DO $preflight$
BEGIN
  IF current_database() <> 'postgres'
     OR session_user <> 'postgres'
     OR current_user <> 'postgres'
     OR current_setting('cron.database_name', true) IS DISTINCT FROM 'postgres'
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_cron')
     OR to_regprocedure('cron.schedule(text,text,text)') IS NULL
     OR to_regprocedure('artecna_notifiche.genera_scadenze(timestamp with time zone)') IS NULL
     OR NOT (SELECT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname = current_user)
  THEN
    RAISE EXCEPTION 'Prerequisiti scheduler mancanti: postgres, pg_cron, inventario completo e generatore';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION artecna_notifiche.esegui_generatore_runtime()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $runtime$
  SELECT artecna_notifiche.genera_scadenze(pg_catalog.now());
$runtime$;

ALTER FUNCTION artecna_notifiche.esegui_generatore_runtime() OWNER TO postgres;
REVOKE ALL ON FUNCTION artecna_notifiche.esegui_generatore_runtime()
  FROM PUBLIC, anon, authenticated, service_role;

DO $register$
DECLARE
  nome CONSTANT text := 'artecna-notifiche-reconcile';
  frequenza CONSTANT text := '10 * * * *';
  comando CONSTANT text := 'SELECT artecna_notifiche.esegui_generatore_runtime();';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = nome) THEN
    PERFORM cron.schedule(nome, frequenza, comando);
  END IF;

  IF (SELECT count(*) FROM cron.job WHERE jobname = nome) <> 1 OR NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = nome AND schedule = frequenza
      AND command = comando AND database = 'postgres'
      AND username = 'postgres' AND active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Job scheduler duplicato o configurazione divergente: %', nome;
  END IF;
END;
$register$;

COMMIT;
