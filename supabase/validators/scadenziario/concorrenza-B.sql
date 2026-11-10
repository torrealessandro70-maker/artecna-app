-- NON ESEGUITO. Solo DB locale usa-e-getta, backend distinto da A.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claim.sub',:'test_titolare',true),set_config('scadenziario.test_id',:'test_id',true),set_config('scadenziario.test_revision',:'test_revisione',true);
SET LOCAL ROLE authenticated;
SELECT pg_backend_pid() AS backend_b;
DO $test$
DECLARE d jsonb; id uuid:=current_setting('scadenziario.test_id')::uuid;
BEGIN
 SELECT x-ARRAY['id','revisione','created_at','created_by','updated_at','updated_by','archiviata_at','archiviata_by','motivo_archiviazione'] INTO d
 FROM jsonb_array_elements(public.leggi_scadenze_fiscali(false)->'righe') x WHERE x->>'id'=id::text;
 BEGIN
  PERFORM public.aggiorna_scadenza_fiscale(id,current_setting('scadenziario.test_revision')::bigint,d||jsonb_build_object('note','fixture concorrente B'));
  RAISE EXCEPTION 'CONCURRENT_WRITE_UNEXPECTEDLY_ACCEPTED';
 EXCEPTION WHEN serialization_failure THEN NULL;
 END;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.leggi_scadenze_fiscali(false)->'righe') x WHERE x->>'id'=id::text AND x->>'note'='fixture concorrente A') THEN RAISE EXCEPTION 'WINNER_CHANGED'; END IF;
END $test$;
SELECT 'GREEN_CONCURRENT_REVISION_REJECTED' AS verdict;
ROLLBACK;
