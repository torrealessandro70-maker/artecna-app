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
 IF to_regprocedure('public.riconcilia_acconto_fattura(uuid,uuid,uuid,uuid,jsonb,jsonb,text,text,boolean)') IS NOT NULL
 OR EXISTS(SELECT FROM pg_attribute WHERE attrelid='artecna_contabilita.attribuzioni_clienti'::regclass AND attname='riconciliazione' AND NOT attisdropped)
 THEN RAISE EXCEPTION 'STOP_GIA_INSTALLATA'; END IF;
 IF to_regprocedure('public.leggi_acconto_compilazione(uuid)') IS NULL OR to_regprocedure('public.attribuisci_incasso_lordo_cliente(uuid,uuid,uuid,numeric)') IS NULL THEN RAISE EXCEPTION 'STOP_DIPENDENZE'; END IF;
END $$;
WITH rel AS (SELECT unnest(ARRAY['public.cantieri','public.preventivi_cantiere','public.sal_lavorazioni','public.acconti_cantiere','public.fatture_emesse','artecna_contabilita.attribuzioni_clienti','artecna_contabilita.incassi_lordi_clienti','artecna_contabilita.quote_lorde_clienti','artecna_contabilita.imputazioni_acconti','artecna_contabilita.acconti_fiscali','artecna_contabilita.fatture_sdi','artecna_notifiche.evento_notificabile','artecna_notifiche.notifica']) AS name), data AS (
SELECT name,query_to_xml(format('SELECT count(*) AS rows, encode(sha256(convert_to(coalesce(string_agg((to_jsonb(x)-%L-%L)::text,E''\n'' ORDER BY (to_jsonb(x)-%L-%L)::text COLLATE "C"),''''),''UTF8'')),''hex'') AS sha256 FROM %s x',
 CASE WHEN name='artecna_contabilita.attribuzioni_clienti' THEN 'riconciliazione' ELSE '__none__' END,
 CASE WHEN name='artecna_contabilita.quote_lorde_clienti' THEN 'attribuzione_id' ELSE '__none__' END,
 CASE WHEN name='artecna_contabilita.attribuzioni_clienti' THEN 'riconciliazione' ELSE '__none__' END,
 CASE WHEN name='artecna_contabilita.quote_lorde_clienti' THEN 'attribuzione_id' ELSE '__none__' END,name::regclass),false,false,'') AS evidence FROM rel)
SELECT jsonb_build_object('marker','ARTECNA_RICONCILIAZIONE_PRECHECK_READONLY','scope','Full rows and columns of contractual and financial histories; only the two new link fields excluded',
'fingerprints',jsonb_object_agg(name,jsonb_build_object('rows',(xpath('/table/row/rows/text()',evidence))[1]::text::bigint,'sha256',(xpath('/table/row/sha256/text()',evidence))[1]::text)),
'backup_or_apply_authorized',false) AS evidence FROM data;
ROLLBACK;
