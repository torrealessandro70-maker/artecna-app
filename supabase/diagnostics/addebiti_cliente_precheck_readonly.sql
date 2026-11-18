\set ON_ERROR_STOP on
\set VERBOSITY sqlstate
SET SESSION default_transaction_read_only=on;
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL statement_timeout='25s';
SET LOCAL lock_timeout='3s';
DO $$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('default_transaction_read_only')<>'on'
 OR current_setting('transaction_read_only')<>'on' OR current_setting('transaction_isolation')<>'repeatable read'
 OR to_regnamespace('artecna_addebiti') IS NOT NULL
 OR to_regprocedure('public.importa_sal_accordato(uuid,uuid,bigint[])') IS NULL
 OR to_regprocedure('public.crea_addebito_cliente(uuid,uuid,numeric,numeric,boolean,numeric,text,text,text,text)') IS NOT NULL
 OR (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected) IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()]
 THEN RAISE EXCEPTION 'Sessione, schema o catalogo incompatibile'; END IF;
 IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
 IF EXISTS(SELECT FROM supabase_migrations.schema_migrations WHERE version::text='20261118000100') THEN RAISE EXCEPTION 'Migrazione gia registrata'; END IF; END IF;
 IF EXISTS(SELECT FROM pg_roles r WHERE (r.rolsuper OR r.rolcreaterole OR r.rolbypassrls OR r.rolname IN ('postgres','artecna_varianti_rpc'))
 AND (pg_has_role('authenticated',r.oid,'USAGE') OR pg_has_role('authenticated',r.oid,'SET')))
 OR EXISTS(SELECT FROM pg_auth_members WHERE admin_option AND pg_has_role('authenticated',member,'MEMBER'))
 OR has_parameter_privilege('authenticated','session_replication_role','SET')
 OR EXISTS(SELECT FROM pg_class WHERE oid IN ('public.materiali_cantiere'::regclass,'public.fatture_fornitori_righe'::regclass,
 'public.varianti_cantiere'::regclass,'public.variante_lavorazioni'::regclass,'public.variante_sorgenti'::regclass)
 AND (pg_has_role('authenticated',relowner,'USAGE') OR pg_has_role('authenticated',relowner,'SET'))) THEN
 RAISE EXCEPTION 'Privilegi API incompatibili'; END IF;
 IF EXISTS(SELECT FROM unnest(ARRAY['public.proponi_variante(uuid)','public.approva_variante(uuid,text)',
 'public.importa_variante_approvata_nel_sal(uuid)']) f(firma) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(f.firma)
 WHERE p.oid IS NULL OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']
 OR pg_get_userbyid(p.proowner) NOT IN ('artecna_varianti_rpc','artecna_sal_rpc')) THEN RAISE EXCEPTION 'RPC Varianti o SAL inattese'; END IF;
 -- Referenze alle colonne: un'incompatibilita dello schema ferma il controllo.
 PERFORM m.fattura_riga_id,m.cantiere_id,m.unita_misura,m.prezzo_unitario,m.totale FROM public.materiali_cantiere m LIMIT 0;
 PERFORM r.fattura_id,r.quantita,r.prezzo_unitario FROM public.fatture_fornitori_righe r LIMIT 0;
 PERFORM c.destinazione_amministrativa,c.lavori_conclusi FROM public.cantieri c LIMIT 0;
 PERFORM p.accordo_contrattuale FROM public.preventivi_cantiere p LIMIT 0;
END $$;
ROLLBACK;
\qecho ARTECNA_ADDEBITI_PRECHECK_READONLY_GREEN
