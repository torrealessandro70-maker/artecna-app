\set ON_ERROR_STOP on
\set VERBOSITY sqlstate
SET SESSION default_transaction_read_only=on;
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL statement_timeout='25s';
DO $$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')<>'170006' OR current_setting('transaction_read_only')<>'on'
 OR current_setting('default_transaction_read_only')<>'on' OR current_setting('transaction_isolation')<>'repeatable read'
 OR (SELECT count(*) FROM pg_trigger WHERE tgname IN ('addebito_variante_guard','addebito_voce_guard','addebito_sorgente_guard','addebito_materiale_guard','addebito_fattura_riga_guard','addebito_variante_truncate_guard','addebito_voce_truncate_guard','addebito_sorgente_truncate_guard','addebito_materiale_truncate_guard','addebito_fattura_riga_truncate_guard') AND tgenabled='O' AND NOT tgisinternal)<>10
 OR (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected) IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()]
 OR EXISTS(SELECT FROM artecna_addebiti.richieste)
 OR has_table_privilege('authenticated','artecna_addebiti.richieste','SELECT,INSERT,UPDATE,DELETE')
 OR has_table_privilege('service_role','artecna_addebiti.richieste','INSERT,UPDATE,DELETE') THEN
 RAISE EXCEPTION 'Postcheck addebiti incompatibile'; END IF;
 IF EXISTS(SELECT FROM unnest(ARRAY['public.leggi_quote_addebito_cliente(uuid)',
 'public.anteprima_addebito_cliente(uuid,numeric,numeric,boolean,numeric,text,text,text)',
 'public.crea_addebito_cliente(uuid,uuid,numeric,numeric,boolean,numeric,text,text,text,text)']) f(firma)
 LEFT JOIN pg_proc p ON p.oid=to_regprocedure(f.firma) WHERE p.oid IS NULL OR NOT p.prosecdef
 OR p.proowner<>'postgres'::regrole OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']
 OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE')
 OR has_function_privilege('service_role',p.oid,'EXECUTE')) THEN RAISE EXCEPTION 'RPC addebiti non conformi'; END IF;
END $$;
ROLLBACK;
\qecho ARTECNA_ADDEBITI_POSTCHECK_READONLY_GREEN
