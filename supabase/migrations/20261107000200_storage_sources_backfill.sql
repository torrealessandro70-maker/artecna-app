-- Generata da schema Production SHA256 4e5bdd0d6befabbbc90cad17617419af96f9f92437f5915941827f4ff22b11c1.
-- Non installata. Nessuna UPDATE sui record sorgenti: backfill solo del registro.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN IF current_user<>'postgres' THEN RAISE EXCEPTION 'Installer inatteso'; END IF; END $$;
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
DO $$ DECLARE s record;r record;c text; BEGIN
 FOR s IN SELECT * FROM artecna_distruzione.storage_sorgenti ORDER BY relation::text LOOP
  EXECUTE format('LOCK TABLE %s IN SHARE ROW EXCLUSIVE MODE',s.relation);
 END LOOP;
 FOR s IN SELECT * FROM artecna_distruzione.storage_sorgenti ORDER BY relation::text LOOP
  FOR c IN SELECT jsonb_object_keys(s.fields) UNION SELECT unnest(s.json_fields) UNION SELECT unnest(s.pk) LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=s.relation AND attname=c AND NOT attisdropped) THEN RAISE EXCEPTION 'Colonna sorgente Storage mancante'; END IF;
  END LOOP;
  EXECUTE format('CREATE TRIGGER storage_registry_reference AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION artecna_distruzione.storage_sync()',s.relation);
  EXECUTE format('CREATE TRIGGER storage_registry_no_truncate BEFORE TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION artecna_distruzione.storage_sync()',s.relation);
  FOR r IN EXECUTE format('SELECT to_jsonb(t) j FROM %s t',s.relation) LOOP
   PERFORM artecna_distruzione.storage_indicizza(s.relation,NULL,r.j);
  END LOOP;
 END LOOP;
 UPDATE artecna_distruzione.storage_copertura SET completa=true WHERE singleton;
END $$;
-- Anomalie JSON senza bucket certo non diventano oggetti inventati: impediscono
-- il worker finché il riferimento non è normalizzato attraverso il writer.
COMMIT;
