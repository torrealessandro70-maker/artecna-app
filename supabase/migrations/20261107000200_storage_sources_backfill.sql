-- Generata da schema Production SHA256 4e5bdd0d6befabbbc90cad17617419af96f9f92437f5915941827f4ff22b11c1.
-- Recovery: proiezione Storage stretta e FETCH singolo; nessuna modifica alla 001 o ai writer.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN IF current_user<>'postgres' THEN RAISE EXCEPTION 'Installer inatteso'; END IF; END $$;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM artecna_distruzione.storage_sorgenti)
 OR EXISTS(SELECT 1 FROM artecna_distruzione.storage_oggetti)
 OR EXISTS(SELECT 1 FROM artecna_distruzione.storage_riferimenti)
 OR EXISTS(SELECT 1 FROM artecna_distruzione.storage_anomalie)
 OR (SELECT count(*) FROM artecna_distruzione.storage_copertura WHERE singleton AND NOT completa)<>1 THEN
  RAISE EXCEPTION '002 richiede registro iniziale vuoto e copertura false; nessun retry parziale';
 END IF;
END $$;
INSERT INTO artecna_distruzione.storage_sorgenti(relation,pk,fields,json_fields,json_bucket) VALUES
('public.preventivi_cantiere'::regclass,ARRAY['id']::text[],'{"file_path":{"kind":"path","bucket":"preventivi"},"file_url":{"kind":"uri"}}'::jsonb,ARRAY['json_voci_ai','provenienza_generazione']::text[],NULL),
('public.foto_cantiere'::regclass,ARRAY['id']::text[],'{"file_path":{"kind":"path","bucket":"preventivi","provider_column":"storage_provider"},"file_url":{"kind":"uri"},"thumbnail_url":{"kind":"uri"},"immagine_base64":{"kind":"uri"}}'::jsonb,ARRAY[]::text[],NULL),
('public.materiali_cantiere'::regclass,ARRAY['id']::text[],'{"file_path":{"kind":"path","bucket":"preventivi"},"file_url":{"kind":"uri"}}'::jsonb,ARRAY[]::text[],NULL),
('public.attrezzi_cantiere'::regclass,ARRAY['id']::text[],'{"file_path":{"kind":"path","bucket":"preventivi"},"file_url":{"kind":"uri"}}'::jsonb,ARRAY[]::text[],NULL),
('public.foto_sopralluogo'::regclass,ARRAY['id']::text[],'{"immagine_base64":{"kind":"uri"}}'::jsonb,ARRAY[]::text[],NULL),
('public.variante_documenti'::regclass,ARRAY['id']::text[],'{"storage_path":{"kind":"path","bucket":"preventivi"}}'::jsonb,ARRAY[]::text[],NULL),
('artecna_rapportini.allegati'::regclass,ARRAY['id']::text[],'{"file_path":{"kind":"path","bucket_column":"bucket"}}'::jsonb,ARRAY[]::text[],NULL),
('public.note_allegati'::regclass,ARRAY['id']::text[],'{"storage_path":{"kind":"path","bucket":"preventivi"},"url":{"kind":"uri"}}'::jsonb,ARRAY[]::text[],NULL),
('public.quaderno_allegati'::regclass,ARRAY['id']::text[],'{"storage_path":{"kind":"path","bucket_column":"storage_bucket"},"url":{"kind":"uri"}}'::jsonb,ARRAY[]::text[],NULL),
('public.quaderno_copie_allegati'::regclass,ARRAY['id']::text[],'{"storage_path":{"kind":"path","bucket_column":"storage_bucket"}}'::jsonb,ARRAY[]::text[],NULL),
('public.fatture_emesse'::regclass,ARRAY['id']::text[],'{"pdf_url":{"kind":"uri"},"xml_url":{"kind":"uri"}}'::jsonb,ARRAY[]::text[],NULL),
('public.economia_righe'::regclass,ARRAY['id']::text[],'{}'::jsonb,ARRAY['dettagli_analitici','prestazione_snapshot']::text[],NULL),
('public.quaderno_progetti'::regclass,ARRAY['id']::text[],'{}'::jsonb,ARRAY['analisi_ai','checklist','disegni']::text[],NULL),
('public.note_sopralluogo'::regclass,ARRAY['id']::text[],'{}'::jsonb,ARRAY['analisi_ai','checklist','disegni']::text[],NULL),
('public.quaderno_gestioni'::regclass,ARRAY['id']::text[],'{}'::jsonb,ARRAY['assets','documento']::text[],':gestione'),
('public.quaderno_richiami_sopralluogo'::regclass,ARRAY['id']::text[],'{}'::jsonb,ARRAY['assets','documento','input_documento']::text[],'quaderno-sopralluoghi'),
('public.agenda_attivita'::regclass,ARRAY['id']::text[],'{}'::jsonb,ARRAY['checklist','collegamento']::text[],NULL),
('public.variante_osservatore_analisi'::regclass,ARRAY['id']::text[],'{}'::jsonb,ARRAY['fonti','risultato']::text[],NULL),
('public.fornitori_rettifiche'::regclass,ARRAY['id']::text[],'{}'::jsonb,ARRAY['fotografia','richiesta']::text[],NULL),
('artecna_guardie.fatture_classificazione_richieste'::regclass,ARRAY['user_id','richiesta_id']::text[],'{}'::jsonb,ARRAY['payload','risultato']::text[],NULL),
('artecna_rapportini.richieste'::regclass,ARRAY['canale','utente_id','richiesta_id']::text[],'{}'::jsonb,ARRAY['risultato']::text[],NULL),
('public.variante_sorgenti'::regclass,ARRAY['id']::text[],'{}'::jsonb,ARRAY['snapshot']::text[],NULL),
('public.economia_sorgenti'::regclass,ARRAY['id']::text[],'{}'::jsonb,ARRAY['snapshot']::text[],NULL);
-- Tutti i writer sorgenti restano esclusi fino al COMMIT: stessa atomicita della 002 originale.
DO $$ DECLARE s record;c text; BEGIN
 FOR s IN SELECT * FROM artecna_distruzione.storage_sorgenti ORDER BY relation::text LOOP
  EXECUTE format('LOCK TABLE %s IN SHARE ROW EXCLUSIVE MODE',s.relation);
  FOR c IN SELECT jsonb_object_keys(s.fields) UNION SELECT unnest(s.json_fields) UNION SELECT unnest(s.pk) LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=s.relation AND attname=c AND NOT attisdropped) THEN RAISE EXCEPTION 'Colonna sorgente Storage mancante'; END IF;
  END LOOP;
  EXECUTE format('CREATE TRIGGER storage_registry_reference AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION artecna_distruzione.storage_sync()',s.relation);
  EXECUTE format('CREATE TRIGGER storage_registry_no_truncate BEFORE TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION artecna_distruzione.storage_sync()',s.relation);
 END LOOP;
END $$;

-- BACKFILL_SOURCE artecna_guardie.fatture_classificazione_richieste; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='artecna_guardie.fatture_classificazione_richieste'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE artecna_guardie.fatture_classificazione_richieste: % righe',n;
END $$;

-- BACKFILL_SOURCE artecna_rapportini.allegati; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='artecna_rapportini.allegati'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE artecna_rapportini.allegati: % righe',n;
END $$;

-- BACKFILL_SOURCE artecna_rapportini.richieste; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='artecna_rapportini.richieste'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE artecna_rapportini.richieste: % righe',n;
END $$;

-- BACKFILL_SOURCE public.agenda_attivita; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.agenda_attivita'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.agenda_attivita: % righe',n;
END $$;

-- BACKFILL_SOURCE public.attrezzi_cantiere; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.attrezzi_cantiere'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.attrezzi_cantiere: % righe',n;
END $$;

-- BACKFILL_SOURCE public.economia_righe; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.economia_righe'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.economia_righe: % righe',n;
END $$;

-- BACKFILL_SOURCE public.economia_sorgenti; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.economia_sorgenti'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.economia_sorgenti: % righe',n;
END $$;

-- BACKFILL_SOURCE public.fatture_emesse; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.fatture_emesse'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.fatture_emesse: % righe',n;
END $$;

-- BACKFILL_SOURCE public.fornitori_rettifiche; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.fornitori_rettifiche'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.fornitori_rettifiche: % righe',n;
END $$;

-- BACKFILL_SOURCE public.foto_cantiere; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.foto_cantiere'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.foto_cantiere: % righe',n;
END $$;

-- BACKFILL_SOURCE public.foto_sopralluogo; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.foto_sopralluogo'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.foto_sopralluogo: % righe',n;
END $$;

-- BACKFILL_SOURCE public.materiali_cantiere; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.materiali_cantiere'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.materiali_cantiere: % righe',n;
END $$;

-- BACKFILL_SOURCE public.note_allegati; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.note_allegati'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.note_allegati: % righe',n;
END $$;

-- BACKFILL_SOURCE public.note_sopralluogo; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.note_sopralluogo'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.note_sopralluogo: % righe',n;
END $$;

-- BACKFILL_SOURCE public.preventivi_cantiere; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.preventivi_cantiere'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.preventivi_cantiere: % righe',n;
END $$;

-- BACKFILL_SOURCE public.quaderno_allegati; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.quaderno_allegati'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.quaderno_allegati: % righe',n;
END $$;

-- BACKFILL_SOURCE public.quaderno_copie_allegati; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.quaderno_copie_allegati'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.quaderno_copie_allegati: % righe',n;
END $$;

-- BACKFILL_SOURCE public.quaderno_gestioni; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.quaderno_gestioni'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.quaderno_gestioni: % righe',n;
END $$;

-- BACKFILL_SOURCE public.quaderno_progetti; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.quaderno_progetti'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.quaderno_progetti: % righe',n;
END $$;

-- BACKFILL_SOURCE public.quaderno_richiami_sopralluogo; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.quaderno_richiami_sopralluogo'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.quaderno_richiami_sopralluogo: % righe',n;
END $$;

-- BACKFILL_SOURCE public.variante_documenti; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.variante_documenti'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.variante_documenti: % righe',n;
END $$;

-- BACKFILL_SOURCE public.variante_osservatore_analisi; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.variante_osservatore_analisi'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.variante_osservatore_analisi: % righe',n;
END $$;

-- BACKFILL_SOURCE public.variante_sorgenti; statement autonomo, stessa transazione complessiva.
DO $$ DECLARE cfg artecna_distruzione.storage_sorgenti;cols text[];projection text;ordering text;j jsonb;c refcursor;n bigint:=0; BEGIN
 SELECT * INTO STRICT cfg FROM artecna_distruzione.storage_sorgenti WHERE relation='public.variante_sorgenti'::regclass;
 cols:=cfg.pk||cfg.json_fields||ARRAY['cantiere_id','tipo','rapportino_id','chiave_client_allegato','mime_type','user_id','nota_id','richiamo_id'];
 cols:=cols||ARRAY(SELECT jsonb_object_keys(cfg.fields));
 cols:=cols||ARRAY(SELECT value->>'provider_column' FROM jsonb_each(cfg.fields) WHERE value->>'provider_column' IS NOT NULL);
 cols:=cols||ARRAY(SELECT value->>'bucket_column' FROM jsonb_each(cfg.fields) WHERE value->>'bucket_column' IS NOT NULL);
 -- URI non riconosciuti producono gia zero riferimenti nel parser canonico della 001.
 -- Escludere inline base64 prima del JSON evita copie enormi senza concedere ownership.
 SELECT string_agg(format('%L,%s',a.attname,
  CASE WHEN cfg.fields->a.attname->>'kind'='uri' THEN
   format('CASE WHEN t.%1$I LIKE ''quaderno-storage:%%'' OR t.%1$I LIKE ''quaderno-sopralluogo:%%'' OR t.%1$I ~ ''^https://axuiaiglbahygsmeoypy[.]supabase[.]co/storage/v1/object/(public|sign|authenticated)/'' THEN t.%1$I END',a.attname)
  ELSE format('t.%I',a.attname) END),',' ORDER BY a.attnum) INTO projection
 FROM pg_attribute a WHERE a.attrelid=cfg.relation AND a.attnum>0 AND NOT a.attisdropped AND a.attname=ANY(cols);
 SELECT string_agg(format('t.%I',k),',' ORDER BY ord) INTO ordering FROM unnest(cfg.pk) WITH ORDINALITY p(k,ord);
 OPEN c NO SCROLL FOR EXECUTE format('SELECT jsonb_build_object(%s) FROM %s t ORDER BY %s',projection,cfg.relation,ordering);
 LOOP
  -- FETCH esplicito: una riga, senza il prefetch implicito di 50 JSON completi.
  FETCH c INTO j;EXIT WHEN NOT FOUND;
  PERFORM artecna_distruzione.storage_indicizza(cfg.relation,NULL,j);n:=n+1;
 END LOOP;
 CLOSE c;
 RAISE NOTICE 'BACKFILL_SOURCE public.variante_sorgenti: % righe',n;
END $$;
DO $$ BEGIN UPDATE artecna_distruzione.storage_copertura SET completa=true WHERE singleton; END $$;
-- Oggetti/riferimenti/anomalie, namespace creatori, lock e helper restano quelli canonici della 001.
COMMIT;
