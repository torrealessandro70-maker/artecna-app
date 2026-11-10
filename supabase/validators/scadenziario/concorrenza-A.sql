-- NON ESEGUITO. Solo DB locale usa-e-getta. Richiede test_titolare, test_id, test_revisione.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claim.sub',:'test_titolare',true);
SET LOCAL ROLE authenticated;
SELECT pg_backend_pid() AS backend_a;
SELECT public.aggiorna_scadenza_fiscale(:'test_id'::uuid,:'test_revisione'::bigint,
 (SELECT (x-ARRAY['id','revisione','created_at','created_by','updated_at','updated_by','archiviata_at','archiviata_by','motivo_archiviazione'])||jsonb_build_object('note','fixture concorrente A')
 FROM jsonb_array_elements(public.leggi_scadenze_fiscali(false)->'righe') x WHERE x->>'id'=:'test_id'));
\prompt 'Avviare B con stessa revisione; confermare B in attesa di lock prima di continuare: ' conferma
COMMIT;
SELECT 'A_COMMITTED_LOCAL_FIXTURE' AS verdict;
