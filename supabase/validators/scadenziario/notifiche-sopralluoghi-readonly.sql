BEGIN READ ONLY;

DO $$
DECLARE
  runtime oid := 'artecna_notifiche.esegui_generatore_runtime()'::regprocedure;
  producer oid := 'artecna_notifiche.genera_sopralluoghi(timestamptz)'::regprocedure;
  preferenze oid := 'public.salva_preferenze_notifiche(integer,boolean,boolean,boolean,integer[],boolean,integer[],boolean,integer[])'::regprocedure;
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_proc p WHERE p.oid = runtime AND p.prosecdef AND p.proowner = 'postgres'::regrole
      AND p.proconfig = ARRAY['search_path=pg_catalog, pg_temp']
      AND p.prosrc LIKE '%genera_scadenze(ora_batch)%genera_agenda(ora_batch)%genera_sopralluoghi(ora_batch)%'
  ) THEN RAISE EXCEPTION 'Wrapper notifiche divergente'; END IF;

  IF EXISTS (
    SELECT FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    WHERE p.oid IN (runtime, producer, 'artecna_notifiche.sopralluogo_orario(date,text)'::regprocedure,
      'artecna_notifiche.puo_ricevere_sopralluoghi(uuid)'::regprocedure)
      AND acl.grantee <> p.proowner AND acl.privilege_type = 'EXECUTE'
  ) OR NOT has_function_privilege('authenticated', preferenze, 'EXECUTE')
     OR has_function_privilege('anon', preferenze, 'EXECUTE')
     OR has_function_privilege('service_role', preferenze, 'EXECUTE')
  THEN RAISE EXCEPTION 'ACL notifiche divergenti'; END IF;

  IF to_regclass('cron.job') IS NOT NULL THEN
    IF (SELECT count(*) FROM cron.job WHERE jobname = 'artecna-notifiche-reconcile') <> 1 OR NOT EXISTS (
      SELECT FROM cron.job WHERE jobname = 'artecna-notifiche-reconcile' AND active
        AND database = 'postgres' AND username = 'postgres' AND schedule = '10 * * * *'
        AND command = 'SELECT artecna_notifiche.esegui_generatore_runtime();'
    ) THEN RAISE EXCEPTION 'Job notifiche divergente'; END IF;
  END IF;
END;
$$;

ROLLBACK;
