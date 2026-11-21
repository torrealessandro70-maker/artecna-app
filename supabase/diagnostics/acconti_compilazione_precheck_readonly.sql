\set ON_ERROR_STOP on
\set VERBOSITY terse
\pset pager off
SET SESSION default_transaction_read_only=on;
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL statement_timeout='25s';
DO $precheck$
DECLARE r record;
BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('transaction_isolation')<>'repeatable read'
 OR current_setting('transaction_read_only')<>'on'
 OR current_setting('check_function_bodies')<>'on'
 THEN RAISE EXCEPTION 'STOP_SESSIONE'; END IF;
 FOR r IN SELECT unnest(ARRAY[
  'public.acconti_cantiere','public.cantieri','artecna_contabilita.acconti_fiscali',
  'artecna_contabilita.incassi_lordi_clienti','artecna_contabilita.imputazioni_acconti',
  'artecna_contabilita.attribuzioni_clienti','artecna_distruzione.hard_delete_catalog_expected']) AS nome LOOP
  IF to_regclass(r.nome) IS NULL OR NOT has_table_privilege(current_user,to_regclass(r.nome),'SELECT')
  THEN RAISE EXCEPTION 'STOP_DIPENDENZA %',encode(sha256(convert_to(r.nome,'UTF8')),'hex'); END IF;
 END LOOP;
 FOR r IN SELECT unnest(ARRAY[
  'artecna_contabilita.proteggi_incassi_lordi()',
  'artecna_contabilita.autorizza_acconto_fiscale(uuid)',
  'artecna_contabilita.fonte_acconto(public.acconti_cantiere)',
  'artecna_guardie.utente_jwt_corrente()',
  'artecna_guardie.utente_puo_operare_impresa(uuid)',
  'artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)',
  'artecna_distruzione.hard_delete_catalog()']) AS firma LOOP
  IF to_regprocedure(r.firma) IS NULL THEN RAISE EXCEPTION 'STOP_FUNZIONE %',encode(sha256(convert_to(r.firma,'UTF8')),'hex'); END IF;
 END LOOP;
 IF NOT EXISTS(SELECT FROM pg_class WHERE oid='public.acconti_cantiere'::regclass AND relowner='postgres'::regrole)
 OR NOT has_schema_privilege(current_user,'public','USAGE') OR NOT has_schema_privilege(current_user,'public','CREATE')
 OR NOT has_schema_privilege(current_user,'artecna_contabilita','USAGE') OR NOT has_schema_privilege(current_user,'artecna_contabilita','CREATE')
 THEN RAISE EXCEPTION 'STOP_AUTORITA_INSTALLER'; END IF;
 IF EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.acconti_cantiere'::regclass AND attname='compilazione_unica' AND NOT attisdropped)
 OR to_regprocedure('public.salva_acconto_compilazione(uuid,uuid,uuid,jsonb,jsonb,jsonb)') IS NOT NULL
 OR to_regprocedure('public.leggi_acconto_compilazione(uuid)') IS NOT NULL
 OR to_regprocedure('artecna_contabilita.acconto_compilazione_documentato(uuid)') IS NOT NULL
 OR to_regprocedure('artecna_contabilita.proteggi_compilazione_acconto()') IS NOT NULL
 OR EXISTS(SELECT FROM pg_trigger WHERE tgrelid='public.acconti_cantiere'::regclass AND tgname='acconto_compilazione_guard')
 THEN RAISE EXCEPTION 'STOP_ACCONTI_PRESENTE_O_PARZIALE'; END IF;
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid='artecna_distruzione.hard_delete_catalog()'::regprocedure AND provolatile='s')
 THEN RAISE EXCEPTION 'STOP_LETTORE_CATALOGO'; END IF;
 IF (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
 IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()]
 THEN RAISE EXCEPTION 'STOP_SIGILLO_HARD_DELETE'; END IF;
END $precheck$;
SELECT to_regclass('artecna_addebiti.voci_manuali') IS NOT NULL AS oggetto_misti_presente,
 to_regprocedure('public.anteprima_addebiti_misti(uuid,jsonb,jsonb,boolean)') IS NOT NULL AS rpc_misti_anteprima_presente,
 to_regprocedure('public.crea_addebiti_misti(uuid,uuid,jsonb,jsonb,boolean,text)') IS NOT NULL AS rpc_misti_creazione_presente;
-- Il risultato Cron e informativo: nessun LOCK viene tentato e nessuna ACL modificata.
SELECT to_regclass('cron.job') IS NOT NULL AS cron_presente,
 CASE WHEN to_regclass('cron.job') IS NOT NULL
 THEN has_table_privilege(current_user,to_regclass('cron.job'),'MAINTAIN,UPDATE,DELETE,TRUNCATE') END AS cron_share_teorico;
ROLLBACK;
\qecho ARTECNA_ACCONTI_COMPILAZIONE_PRECHECK_READONLY_GREEN
