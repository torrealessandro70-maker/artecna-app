\set ON_ERROR_STOP on
BEGIN READ ONLY;
DO $test$
DECLARE t oid := 'artecna_contabilita.documenti_fiscali'::regclass; r record; firma text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=t AND relrowsecurity AND relforcerowsecurity AND relowner='postgres'::regrole) THEN RAISE EXCEPTION 'UNSAFE_RLS_OWNER'; END IF;
 IF (SELECT count(*) FROM pg_attribute WHERE attrelid=t AND attnum>0 AND NOT attisdropped)<>15 THEN RAISE EXCEPTION 'COLUMN_SET'; END IF;
 FOR r IN SELECT * FROM (VALUES
 ('id','uuid'),('tipo_documento','text'),('nome_file','text'),('data_documento','date'),('storage_path','text'),
 ('mime_type','text'),('byte_size','integer'),('revisione','integer'),('created_at','timestamp with time zone'),('created_by','uuid'),
 ('updated_at','timestamp with time zone'),('updated_by','uuid'),('caricato_at','timestamp with time zone'),('archiviata_at','timestamp with time zone'),('archiviata_by','uuid')) x(nome,tipo)
 LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=t AND attname=r.nome AND format_type(atttypid,atttypmod)=r.tipo AND NOT attisdropped) THEN RAISE EXCEPTION 'COLUMN_TYPE %',r.nome; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=t AND contype='p' AND pg_get_constraintdef(oid)='PRIMARY KEY (id)') THEN RAISE EXCEPTION 'PK'; END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE conrelid=t AND contype='c')<>6 THEN RAISE EXCEPTION 'CHECKS'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=t AND a.attname='revisione' AND a.attnotnull AND pg_get_expr(d.adbin,d.adrelid)='0') THEN RAISE EXCEPTION 'REVISION_DEFAULT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=t AND a.attname='storage_path' AND a.attgenerated='s' AND pg_get_expr(d.adbin,d.adrelid) LIKE '%id%') THEN RAISE EXCEPTION 'GENERATED_PATH'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=t) THEN RAISE EXCEPTION 'DIRECT_POLICY'; END IF;
 FOR r IN SELECT unnest(ARRAY['anon','authenticated','service_role']) AS ruolo LOOP
  IF has_table_privilege(r.ruolo,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=t AND attnum>0 AND NOT attisdropped AND has_column_privilege(r.ruolo,t,attnum,'SELECT,INSERT,UPDATE')) THEN RAISE EXCEPTION 'DIRECT_ACCESS %',r.ruolo; END IF;
 END LOOP;
 FOREACH firma IN ARRAY ARRAY[
 'public.elenca_documenti_fiscali()','public.crea_documento_fiscale(uuid,text,text,date,integer)',
 'public.aggiorna_documento_fiscale(uuid,integer,text,text,date)','public.archivia_documento_fiscale(uuid,integer)',
 'public.conferma_upload_documento_fiscale(uuid)','public.collega_documento_scadenza(uuid,uuid,bigint)','public.scollega_documento_scadenza(uuid,bigint)'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure(firma) AND prosecdef AND proowner='postgres'::regrole AND proconfig=ARRAY['search_path=pg_catalog, pg_temp'] AND prorettype='jsonb'::regtype) THEN RAISE EXCEPTION 'RPC_CONTRACT %',firma; END IF;
  IF has_function_privilege('anon',firma,'EXECUTE') OR has_function_privilege('service_role',firma,'EXECUTE') OR NOT has_function_privilege('authenticated',firma,'EXECUTE') THEN RAISE EXCEPTION 'RPC_ACL %',firma; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='documenti-fiscali-privati' AND NOT public AND file_size_limit=10485760 AND allowed_mime_types=ARRAY['application/pdf']) THEN RAISE EXCEPTION 'BUCKET_CONTRACT'; END IF;
 IF (SELECT count(*) FROM pg_policy WHERE polrelid='storage.objects'::regclass AND polname IN('fiscali_confine_lettura','fiscali_confine_upload','fiscali_immutabili','fiscali_nessuna_rimozione') AND NOT polpermissive)<>4 THEN RAISE EXCEPTION 'STORAGE_BOUNDARY'; END IF;
END $test$;
SELECT 'GREEN_DOCUMENTI_FISCALI_STRUCTURE' AS verdict;
ROLLBACK;
