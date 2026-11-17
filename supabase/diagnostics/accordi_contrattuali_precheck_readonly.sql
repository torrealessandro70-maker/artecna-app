\set ON_ERROR_STOP on
\set VERBOSITY sqlstate
SET SESSION default_transaction_read_only=on;
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL statement_timeout='25s';
SET LOCAL lock_timeout='3s';
DO $$ BEGIN
 IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
 IF EXISTS (SELECT FROM supabase_migrations.schema_migrations WHERE version::text='20261117000100') THEN
 RAISE EXCEPTION 'Migrazione accordi gia registrata' USING ERRCODE='P0001'; END IF; END IF;
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')<>'170006' OR current_setting('transaction_read_only')<>'on'
 OR current_setting('transaction_isolation')<>'repeatable read'
 OR to_regnamespace('artecna_contratti') IS NOT NULL
 OR EXISTS (SELECT FROM pg_attribute WHERE attrelid='public.preventivi_cantiere'::regclass AND attname='accordo_contrattuale' AND NOT attisdropped)
 OR EXISTS (SELECT FROM pg_attribute WHERE attrelid='public.sal_lavorazioni'::regclass AND attname='accordo_riga' AND NOT attisdropped)
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.aggiorna_avanzamento_sal(bigint,numeric,boolean)'::regprocedure)<>'133f3abc8fa415dd529110a00301bd7f'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='artecna_guardie.calcola_residuo_componente(text,bigint,uuid,uuid)'::regprocedure)<>'55760dbed88e0607124f14c48b33408b'
 OR to_regprocedure('public.salva_classificazione_cantiere(uuid,text,text,boolean,text,text,boolean)') IS NULL
 OR (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
 IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()]
 OR NOT EXISTS (SELECT FROM pg_auth_members WHERE roleid='artecna_sal_rpc'::regrole AND member='postgres'::regrole AND admin_option)
 OR pg_has_role('postgres','artecna_sal_rpc','SET') OR has_schema_privilege('artecna_sal_rpc','public','CREATE')
 OR has_schema_privilege('artecna_sal_rpc','artecna_guardie','CREATE')
 OR EXISTS (SELECT FROM pg_roles r WHERE (r.rolsuper OR r.rolcreaterole OR r.rolbypassrls OR r.rolname IN ('postgres','supabase_admin','artecna_sal_rpc'))
 AND (pg_has_role('authenticated',r.oid,'USAGE') OR pg_has_role('authenticated',r.oid,'SET')))
 OR has_parameter_privilege('authenticated','session_replication_role','SET')
 THEN RAISE EXCEPTION 'Precheck accordi incompatibile' USING ERRCODE='P0001'; END IF;
END $$;
SELECT jsonb_build_object('fase','privilegi','tabella',relname,'rls',relrowsecurity,
 'select_auth',has_table_privilege('authenticated',oid,'SELECT'),'update_auth',has_table_privilege('authenticated',oid,'UPDATE'))
FROM pg_class WHERE oid IN ('public.cantieri'::regclass,'public.preventivi_cantiere'::regclass,
 'public.preventivo_lavorazioni'::regclass,'public.sal_lavorazioni'::regclass) ORDER BY relname;
ROLLBACK;
\qecho ARTECNA_ACCORDI_PRECHECK_READONLY_GREEN
