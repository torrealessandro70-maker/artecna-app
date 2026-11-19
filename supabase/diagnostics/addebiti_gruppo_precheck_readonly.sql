\set ON_ERROR_STOP on
\set VERBOSITY sqlstate
SET SESSION default_transaction_read_only=on;
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL statement_timeout='25s';
SET LOCAL lock_timeout='3s';
DO $$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')<>'170006' OR current_setting('check_function_bodies')<>'on'
 OR current_setting('default_transaction_read_only')<>'on' OR current_setting('transaction_read_only')<>'on'
 OR current_setting('transaction_isolation')<>'repeatable read'
 OR to_regclass('artecna_addebiti.richieste') IS NULL OR to_regclass('artecna_addebiti.gruppi') IS NOT NULL
 OR to_regclass('artecna_addebiti.righe_gruppo') IS NOT NULL
 OR to_regprocedure('public.crea_addebiti_gruppo(uuid,uuid,jsonb,text)') IS NOT NULL
 OR to_regprocedure('public.anteprima_addebiti_gruppo(uuid,jsonb)') IS NOT NULL
 OR to_regprocedure('public.leggi_quote_addebito_gruppo(uuid)') IS NOT NULL
 OR (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected) IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()]
 THEN RAISE EXCEPTION 'Sessione o stato installazione incompatibile'; END IF;
 IF EXISTS(SELECT FROM pg_roles r WHERE (r.rolsuper OR r.rolcreaterole OR r.rolbypassrls OR r.rolname IN ('postgres','artecna_varianti_rpc'))
 AND (pg_has_role('authenticated',r.oid,'USAGE') OR pg_has_role('authenticated',r.oid,'SET')))
 OR EXISTS(SELECT FROM pg_auth_members WHERE admin_option AND pg_has_role('authenticated',member,'MEMBER'))
 OR has_parameter_privilege('authenticated','session_replication_role','SET') THEN RAISE EXCEPTION 'Ruolo API privilegiato'; END IF;
 IF EXISTS(SELECT FROM unnest(ARRAY['public.crea_addebito_cliente(uuid,uuid,numeric,numeric,boolean,numeric,text,text,text,text)',
 'public.anteprima_addebito_cliente(uuid,numeric,numeric,boolean,numeric,text,text,text)','public.leggi_quote_addebito_cliente(uuid)']) f(firma)
 LEFT JOIN pg_proc p ON p.oid=to_regprocedure(f.firma) WHERE p.oid IS NULL OR NOT p.prosecdef OR pg_get_userbyid(p.proowner)<>'postgres'
 OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']
 OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')) THEN RAISE EXCEPTION 'RPC singole incompatibili'; END IF;
 IF EXISTS(SELECT FROM pg_class WHERE oid IN ('public.materiali_cantiere'::regclass,'public.varianti_cantiere'::regclass,
 'public.variante_lavorazioni'::regclass,'artecna_addebiti.richieste'::regclass)
 AND (pg_has_role('authenticated',relowner,'USAGE') OR pg_has_role('authenticated',relowner,'SET'))) THEN
 RAISE EXCEPTION 'Ruolo API proprietario'; END IF;
 IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
  IF EXISTS(SELECT FROM supabase_migrations.schema_migrations WHERE version::text='20261119000100') THEN
  RAISE EXCEPTION 'Migrazione gia registrata'; END IF;
 END IF;
 PERFORM richiesta,materiale_id,fattura_riga_id,cantiere_id,variante_id,quantita,snapshot FROM artecna_addebiti.richieste LIMIT 0;
END $$;
ROLLBACK;
\qecho ARTECNA_ADDEBITI_GRUPPO_PRECHECK_READONLY_GREEN
