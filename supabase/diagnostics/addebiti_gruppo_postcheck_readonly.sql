\set ON_ERROR_STOP on
\set VERBOSITY sqlstate
SET SESSION default_transaction_read_only=on;
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL statement_timeout='25s';
DO $$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_database()<>'postgres'
 OR current_setting('server_version_num')<>'170006' OR current_setting('transaction_read_only')<>'on'
 OR current_setting('transaction_isolation')<>'repeatable read'
 OR (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected) IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()]
 THEN RAISE EXCEPTION 'Sessione o catalogo incompatibile'; END IF;
 IF EXISTS(SELECT FROM unnest(ARRAY['public.crea_addebiti_gruppo(uuid,uuid,jsonb,text)','public.anteprima_addebiti_gruppo(uuid,jsonb)',
 'public.leggi_quote_addebito_gruppo(uuid)']) f(firma) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(f.firma)
 WHERE p.oid IS NULL OR NOT p.prosecdef OR pg_get_userbyid(p.proowner)<>'postgres'
 OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']
 OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE')) THEN
 RAISE EXCEPTION 'RPC gruppo non protette'; END IF;
 IF (SELECT count(*) FROM pg_class WHERE oid IN ('artecna_addebiti.gruppi'::regclass,'artecna_addebiti.righe_gruppo'::regclass) AND relrowsecurity)<>2
 OR has_table_privilege('authenticated','artecna_addebiti.gruppi','INSERT,UPDATE,DELETE,TRUNCATE')
 OR has_table_privilege('authenticated','artecna_addebiti.righe_gruppo','INSERT,UPDATE,DELETE,TRUNCATE')
 THEN RAISE EXCEPTION 'Audit gruppo non protetto'; END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE tgfoid='artecna_guardie.proteggi_addebiti_gruppo()'::regprocedure AND tgenabled='O')<>14
 OR (SELECT count(*) FROM pg_trigger WHERE tgfoid='artecna_guardie.verifica_riserva_addebiti()'::regprocedure AND tgenabled='O')<>2
 THEN RAISE EXCEPTION 'Guardie gruppo incomplete'; END IF;
 -- Postcheck di installazione: nessun gruppo reale deve essere stato generato.
 IF EXISTS(SELECT FROM artecna_addebiti.gruppi) OR EXISTS(SELECT FROM artecna_addebiti.righe_gruppo) THEN
 RAISE EXCEPTION 'Dati gruppo presenti: revisione manuale richiesta'; END IF;
END $$;
ROLLBACK;
\qecho ARTECNA_ADDEBITI_GRUPPO_POSTCHECK_READONLY_GREEN
