\set ON_ERROR_STOP on
\set VERBOSITY sqlstate
SET SESSION default_transaction_read_only=on;
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
DO $$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')<>'170006' OR current_setting('transaction_read_only')<>'on'
 OR current_setting('transaction_isolation')<>'repeatable read'
 OR (SELECT count(*) FROM pg_trigger WHERE tgname IN ('accordo_documento_guard','accordo_voci_guard','accordo_cantiere_guard','accordo_sal_guard') AND tgenabled='O' AND NOT tgisinternal)<>4
 OR (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
 IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()]
 OR EXISTS (SELECT FROM public.preventivi_cantiere WHERE accordo_contrattuale IS NOT NULL)
 OR EXISTS (SELECT FROM public.sal_lavorazioni WHERE accordo_riga IS NOT NULL)
 OR EXISTS (SELECT FROM artecna_contratti.accordi)
 OR has_table_privilege('authenticated','artecna_contratti.accordi','INSERT,UPDATE,DELETE')
 OR pg_has_role('postgres','artecna_sal_rpc','SET') OR has_schema_privilege('artecna_sal_rpc','public','CREATE')
 OR has_schema_privilege('artecna_sal_rpc','artecna_guardie','CREATE') THEN
 RAISE EXCEPTION 'Postcheck accordi incompatibile' USING ERRCODE='P0001'; END IF;
 IF EXISTS (SELECT FROM unnest(ARRAY[
 'public.candidati_accordo_contrattuale(uuid)',
 'public.anteprima_accordo_contrattuale(uuid,uuid,jsonb,numeric,text,text,text,text)',
 'public.conferma_accordo_contrattuale(uuid,uuid,uuid,jsonb,numeric,text,text,text,text,text,text)',
 'public.importa_sal_accordato(uuid,uuid,bigint[])']) f(firma)
 LEFT JOIN pg_proc p ON p.oid=to_regprocedure(f.firma)
 WHERE p.oid IS NULL OR NOT p.prosecdef OR pg_get_userbyid(p.proowner)<>'postgres'
 OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']
 OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
 OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE')) THEN
 RAISE EXCEPTION 'RPC accordi non conforme' USING ERRCODE='P0001'; END IF;
 IF NOT EXISTS (SELECT FROM pg_proc WHERE oid='public.aggiorna_avanzamento_sal(bigint,numeric,boolean)'::regprocedure
 AND prosrc LIKE '%artecna_guardie.valore_base_accordato(v_s.id)%'
 AND pg_get_userbyid(proowner)='artecna_sal_rpc' AND prosecdef)
 OR NOT EXISTS (SELECT FROM pg_proc WHERE oid='artecna_guardie.calcola_residuo_componente(text,bigint,uuid,uuid)'::regprocedure
 AND prosrc LIKE '%artecna_guardie.valore_base_accordato(b.id)%'
 AND pg_get_userbyid(proowner)='artecna_sal_rpc' AND prosecdef) THEN
 RAISE EXCEPTION 'Base SAL non collegata agli accordi' USING ERRCODE='P0001'; END IF;
END $$;
ROLLBACK;
\qecho ARTECNA_ACCORDI_POSTCHECK_READONLY_GREEN
