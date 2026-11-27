-- CANDIDATA locale. Verificare progetto/ambiente esternamente. Nessuna esecuzione Production in questo STEP.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL statement_timeout='90s';
SET LOCAL lock_timeout='2s';
DO $$ BEGIN
 IF current_database()<>'postgres' OR (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
 IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()] THEN RAISE EXCEPTION 'STOP_BASELINE_HARD_DELETE'; END IF;
END $$;
DO $$ BEGIN
 IF to_regprocedure('public.riconcilia_acconto_fattura(uuid,uuid,uuid,uuid,jsonb,jsonb,text,text,boolean,jsonb)') IS NOT NULL
 OR EXISTS(SELECT FROM pg_attribute WHERE attrelid='artecna_contabilita.attribuzioni_clienti'::regclass AND attname='riconciliazione' AND NOT attisdropped)
 OR EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','artecna_contabilita') AND p.proname IN('riconcilia_acconto_fattura','risolvi_iva_persistita','documento_riconciliazione','proteggi_fonte_iva','fotografia_fonte_iva','leggi_riconciliazione_unificata','verifica_coppia_riconciliazione','revoca_riconciliazione_unificata'))
 OR EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.fatture_emesse'::regclass AND attname='fonte_iva_verificata' AND NOT attisdropped)
 OR EXISTS(SELECT FROM pg_attribute WHERE attrelid='artecna_contabilita.quote_lorde_clienti'::regclass AND attname='attribuzione_id' AND NOT attisdropped)
 OR to_regclass('artecna_contabilita.quota_lorda_attribuzione_univoca') IS NOT NULL
 OR EXISTS(SELECT FROM pg_trigger WHERE tgrelid IN('public.fatture_emesse'::regclass,'artecna_contabilita.attribuzioni_clienti'::regclass,'artecna_contabilita.quote_lorde_clienti'::regclass) AND tgname IN('fonte_iva_riservata','coppia_riconciliazione_netto','coppia_riconciliazione_lordo'))
 THEN RAISE EXCEPTION 'STOP_GIA_INSTALLATA'; END IF;
 IF to_regprocedure('public.leggi_acconto_compilazione(uuid)') IS NULL OR to_regprocedure('public.attribuisci_incasso_lordo_cliente(uuid,uuid,uuid,numeric)') IS NULL THEN RAISE EXCEPTION 'STOP_DIPENDENZE'; END IF;
END $$;
WITH rel AS (SELECT unnest(ARRAY['public.cantieri','public.preventivi_cantiere','public.sal_lavorazioni','public.acconti_cantiere','public.fatture_emesse','public.fatture_fornitori','public.fatture_fornitori_righe','public.utenti_impresa','public.utenti_cantiere','artecna_contabilita.attribuzioni_clienti','artecna_contabilita.incassi_lordi_clienti','artecna_contabilita.quote_lorde_clienti','artecna_contabilita.imputazioni_acconti','artecna_contabilita.acconti_fiscali','artecna_contabilita.fatture_sdi','artecna_contabilita.storni_acconti','artecna_notifiche.evento_notificabile','artecna_notifiche.notifica']) AS name), data AS (
SELECT name,query_to_xml(format('SELECT count(*) AS rows, encode(sha256(convert_to(coalesce(string_agg((to_jsonb(x)-%L-%L-%L)::text,E''\n'' ORDER BY (to_jsonb(x)-%L-%L-%L)::text COLLATE "C"),''''),''UTF8'')),''hex'') AS sha256 FROM %s x',
 CASE WHEN name='artecna_contabilita.attribuzioni_clienti' THEN 'riconciliazione' ELSE '__none__' END,
 CASE WHEN name='artecna_contabilita.quote_lorde_clienti' THEN 'attribuzione_id' ELSE '__none__' END,
 CASE WHEN name='public.fatture_emesse' THEN 'fonte_iva_verificata' ELSE '__none__' END,
 CASE WHEN name='artecna_contabilita.attribuzioni_clienti' THEN 'riconciliazione' ELSE '__none__' END,
 CASE WHEN name='artecna_contabilita.quote_lorde_clienti' THEN 'attribuzione_id' ELSE '__none__' END,
 CASE WHEN name='public.fatture_emesse' THEN 'fonte_iva_verificata' ELSE '__none__' END,name::regclass),false,false,'') AS evidence FROM rel)
SELECT jsonb_build_object('marker','ARTECNA_RICONCILIAZIONE_PRECHECK_READONLY','scope','Full rows and columns of contractual and financial histories; only the three new metadata/link fields excluded',
'registry_standard_present',to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,'verification_method','SEALED_OBJECT_MANIFEST_NOT_MIGRATION_HISTORY','fingerprints',jsonb_object_agg(name,jsonb_build_object('rows',(xpath('/table/row/rows/text()',evidence))[1]::text::bigint,'sha256',(xpath('/table/row/sha256/text()',evidence))[1]::text)),
'backup_or_apply_authorized',false) AS evidence FROM data;
ROLLBACK;
