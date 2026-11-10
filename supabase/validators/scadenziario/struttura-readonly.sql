-- PREPARATO, NON ESEGUITO. Richiede la futura migration in un DB locale usa-e-getta.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
DO $test$
DECLARE t oid:=to_regclass('artecna_contabilita.scadenze_fiscali'); k text; r record; firma text;
BEGIN
 IF t IS NULL THEN RAISE EXCEPTION 'MISSING_TABLE'; END IF;
 IF (SELECT count(*) FROM pg_attribute WHERE attrelid=t AND attnum>0 AND NOT attisdropped)<>19 THEN RAISE EXCEPTION 'UNEXPECTED_COLUMN_SET'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=t AND relrowsecurity AND relforcerowsecurity AND relowner='postgres'::regrole) THEN RAISE EXCEPTION 'UNSAFE_RLS_OWNER'; END IF;
 FOR r IN SELECT * FROM (VALUES
 ('id','uuid'),('tipo','text'),('periodo_riferimento','text'),('data_scadenza','date'),('importo_previsto','numeric(14,2)'),
 ('stato','text'),('importo_pagato','numeric(14,2)'),('data_pagamento','date'),('note','text'),('riferimento_documento','text'),
 ('includi_nei_totali','boolean'),('revisione','bigint'),('created_at','timestamp with time zone'),('created_by','uuid'),
 ('updated_at','timestamp with time zone'),('updated_by','uuid'),('archiviata_at','timestamp with time zone'),('archiviata_by','uuid'),('motivo_archiviazione','text')) x(nome,tipo)
 LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=t AND attname=r.nome AND format_type(atttypid,atttypmod)=r.tipo AND NOT attisdropped) THEN RAISE EXCEPTION 'COLUMN_MISMATCH %',r.nome; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=t AND attname IN('importo_previsto','importo_pagato') AND attnotnull) THEN RAISE EXCEPTION 'NULL_ZERO_COLLAPSED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=t AND contype='p' AND pg_get_constraintdef(oid)='PRIMARY KEY (id)') THEN RAISE EXCEPTION 'PK_MISSING'; END IF;
 FOREACH k IN ARRAY ARRAY['importo_previsto','importo_pagato'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=t AND contype='c' AND position(k IN pg_get_constraintdef(oid))>0 AND position('>=' IN pg_get_constraintdef(oid))>0 AND position('999999999999.99' IN pg_get_constraintdef(oid))>0) THEN RAISE EXCEPTION 'MONEY_CONSTRAINT_MISSING %',k; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=t AND contype='c' AND pg_get_constraintdef(oid) LIKE '%previsto%' AND pg_get_constraintdef(oid) LIKE '%da_verificare%' AND pg_get_constraintdef(oid) LIKE '%da_pagare%' AND pg_get_constraintdef(oid) LIKE '%pagato%') THEN RAISE EXCEPTION 'STATE_CONSTRAINT_MISSING'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_index WHERE indrelid=t AND indisunique AND indpred IS NOT NULL) THEN RAISE EXCEPTION 'ACTIVE_UNIQUENESS_MISSING'; END IF;
 FOREACH k IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF has_table_privilege(k,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=t AND attnum>0 AND NOT attisdropped AND has_column_privilege(k,t,attnum,'SELECT,INSERT,UPDATE')) THEN RAISE EXCEPTION 'DIRECT_ACCESS %',k; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=t) THEN RAISE EXCEPTION 'UNEXPECTED_BROWSER_POLICY'; END IF;
 FOREACH firma IN ARRAY ARRAY['public.leggi_scadenze_fiscali(boolean)','public.crea_scadenza_fiscale(uuid,jsonb)','public.aggiorna_scadenza_fiscale(uuid,bigint,jsonb)','public.archivia_scadenza_fiscale(uuid,bigint,text)'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure(firma) AND prosecdef AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']) THEN RAISE EXCEPTION 'UNSAFE_RPC %',firma; END IF;
  IF has_function_privilege('anon',firma,'EXECUTE') OR has_function_privilege('service_role',firma,'EXECUTE') OR NOT has_function_privilege('authenticated',firma,'EXECUTE') THEN RAISE EXCEPTION 'RPC_ACL %',firma; END IF;
 END LOOP;
END $test$;
SELECT 'GREEN_SCADENZIARIO_STRUCTURE' AS verdict;
ROLLBACK;
