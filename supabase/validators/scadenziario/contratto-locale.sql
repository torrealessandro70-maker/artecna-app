-- NON ESEGUITO. Solo DB LOCALE usa-e-getta, con test_titolare/test_esterno già predisposti.
\set ON_ERROR_STOP on
\if :{?test_titolare}
\else
\quit 2
\endif
\if :{?test_esterno}
\else
\quit 2
\endif
BEGIN;
SELECT set_config('request.jwt.claim.sub',:'test_titolare',true),set_config('scadenziario.test_esterno',:'test_esterno',true),set_config('scadenziario.test_id',gen_random_uuid()::text,true);
SET LOCAL ROLE authenticated;
DO $test$
DECLARE id uuid:=current_setting('scadenziario.test_id')::uuid; u uuid:=current_setting('request.jwt.claim.sub')::uuid; d jsonb; r jsonb; prima jsonb;
BEGIN
 d:=jsonb_build_object('tipo','F24','periodo_riferimento',id::text,'data_scadenza','2026-12-01','importo_previsto',NULL,'stato','da_verificare','importo_pagato',NULL,'data_pagamento',NULL,'note','fixture locale','riferimento_documento','fixture','includi_nei_totali',false);
 BEGIN EXECUTE 'SELECT * FROM artecna_contabilita.scadenze_fiscali'; RAISE EXCEPTION 'DIRECT_READER_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN EXECUTE 'INSERT INTO artecna_contabilita.scadenze_fiscali(id) VALUES(gen_random_uuid())'; RAISE EXCEPTION 'DIRECT_WRITER_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 r:=public.crea_scadenza_fiscale(id,d);
 IF r->>'created_by'<>u::text OR r->>'updated_by'<>u::text OR r->'importo_previsto'<>'null'::jsonb OR r->>'revisione'<>'0' OR r->>'includi_nei_totali'<>'false' THEN RAISE EXCEPTION 'CREATE_CONTRACT'; END IF;
 prima:=r;
 IF public.crea_scadenza_fiscale(id,d)<>prima THEN RAISE EXCEPTION 'CREATE_NOT_IDEMPOTENT'; END IF;
 BEGIN PERFORM public.crea_scadenza_fiscale(gen_random_uuid(),d||jsonb_build_object('created_by',u)); RAISE EXCEPTION 'CLIENT_ACTOR_ALLOWED'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.aggiorna_scadenza_fiscale(id,0,d||jsonb_build_object('importo_previsto','1.001')); RAISE EXCEPTION 'SILENT_ROUNDING'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.aggiorna_scadenza_fiscale(id,0,d||jsonb_build_object('importo_previsto','-1')); RAISE EXCEPTION 'NEGATIVE_ALLOWED'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 d:=d||jsonb_build_object('importo_previsto','0.00','importo_pagato','0.00','data_pagamento','2026-11-10','stato','pagato');
 r:=public.aggiorna_scadenza_fiscale(id,0,d);
 IF r->>'revisione'<>'1' OR r->>'importo_previsto'<>'0.00' OR r->>'created_by'<>u::text THEN RAISE EXCEPTION 'UPDATE_CONTRACT'; END IF;
 BEGIN PERFORM public.aggiorna_scadenza_fiscale(id,0,d); RAISE EXCEPTION 'STALE_REVISION_ALLOWED'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 r:=public.archivia_scadenza_fiscale(id,1,'Fixture conclusa');
 IF r->>'revisione'<>'2' OR r->>'stato'<>'pagato' OR r->>'archiviata_by'<>u::text OR r->'archiviata_at'='null'::jsonb THEN RAISE EXCEPTION 'ARCHIVE_CONTRACT'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(public.leggi_scadenze_fiscali(false)->'righe') x WHERE x->>'id'=id::text) THEN RAISE EXCEPTION 'ARCHIVED_IN_ACTIVE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.leggi_scadenze_fiscali(true)->'righe') x WHERE x->>'id'=id::text) THEN RAISE EXCEPTION 'ARCHIVE_DELETED'; END IF;
END $test$;
SELECT set_config('request.jwt.claim.sub',current_setting('scadenziario.test_esterno'),true);
DO $test$ BEGIN
 BEGIN PERFORM public.leggi_scadenze_fiscali(false); RAISE EXCEPTION 'NON_OWNER_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.crea_scadenza_fiscale(gen_random_uuid(),'{}'); RAISE EXCEPTION 'NON_OWNER_CREATE_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.aggiorna_scadenza_fiscale(current_setting('scadenziario.test_id')::uuid,0,'{}'); RAISE EXCEPTION 'NON_OWNER_UPDATE_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.archivia_scadenza_fiscale(current_setting('scadenziario.test_id')::uuid,0,'fixture'); RAISE EXCEPTION 'NON_OWNER_ARCHIVE_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $test$;
SET LOCAL ROLE anon;
DO $test$ BEGIN
 BEGIN PERFORM public.leggi_scadenze_fiscali(false); RAISE EXCEPTION 'ANON_READER_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.crea_scadenza_fiscale(gen_random_uuid(),'{}'); RAISE EXCEPTION 'ANON_WRITER_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $test$;
RESET ROLE;
SELECT 'GREEN_SCADENZIARIO_LOCAL_CONTRACT' AS verdict;
ROLLBACK;
