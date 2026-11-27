-- CANDIDATA locale. Verificare progetto/ambiente esternamente. Nessuna esecuzione Production in questo STEP.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL statement_timeout='90s';
SET LOCAL lock_timeout='2s';
DO $$ BEGIN
 IF current_database()<>'postgres' OR (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
 IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()] THEN RAISE EXCEPTION 'STOP_BASELINE_HARD_DELETE'; END IF;
END $$;
DO $$ DECLARE n text; f oid; BEGIN
 FOREACH n IN ARRAY ARRAY['public.leggi_riconciliazione_unificata(uuid,uuid)','public.riconcilia_acconto_fattura(uuid,uuid,uuid,uuid,jsonb,jsonb,text,text,boolean)','public.revoca_riconciliazione_unificata(uuid,uuid)'] LOOP
  f:=to_regprocedure(n);IF f IS NULL OR NOT EXISTS(SELECT FROM pg_proc WHERE oid=f AND prosecdef AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=pg_catalog, pg_temp'])
  OR has_function_privilege('anon',f,'EXECUTE') OR NOT has_function_privilege('authenticated',f,'EXECUTE')
  OR EXISTS(SELECT FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x WHERE p.oid=f AND x.grantee=0 AND x.privilege_type='EXECUTE') THEN RAISE EXCEPTION 'STOP_RPC_ACL_CONFIG'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='artecna_contabilita.quote_lorde_clienti'::regclass AND confrelid='artecna_contabilita.attribuzioni_clienti'::regclass AND contype='f' AND confdeltype='r')
 OR (SELECT count(*) FROM pg_trigger WHERE tgname IN ('coppia_riconciliazione_netto','coppia_riconciliazione_lordo') AND tgdeferrable AND tginitdeferred AND tgenabled='O')<>2
 OR EXISTS(SELECT FROM pg_class WHERE oid IN('artecna_contabilita.attribuzioni_clienti'::regclass,'artecna_contabilita.quote_lorde_clienti'::regclass,'artecna_contabilita.incassi_lordi_clienti'::regclass) AND NOT relrowsecurity)
 THEN RAISE EXCEPTION 'STOP_RLS_RELAZIONI_GUARD'; END IF;
END $$;
WITH rel AS (SELECT unnest(ARRAY['public.cantieri','public.preventivi_cantiere','public.sal_lavorazioni','public.acconti_cantiere','public.fatture_emesse','artecna_contabilita.attribuzioni_clienti','artecna_contabilita.incassi_lordi_clienti','artecna_contabilita.quote_lorde_clienti','artecna_contabilita.imputazioni_acconti','artecna_contabilita.acconti_fiscali','artecna_contabilita.fatture_sdi','artecna_notifiche.evento_notificabile','artecna_notifiche.notifica']) AS name), data AS (
SELECT name,query_to_xml(format('SELECT count(*) AS rows, encode(sha256(convert_to(coalesce(string_agg((to_jsonb(x)-%L-%L)::text,E''\n'' ORDER BY (to_jsonb(x)-%L-%L)::text COLLATE "C"),''''),''UTF8'')),''hex'') AS sha256 FROM %s x',
 CASE WHEN name='artecna_contabilita.attribuzioni_clienti' THEN 'riconciliazione' ELSE '__none__' END,
 CASE WHEN name='artecna_contabilita.quote_lorde_clienti' THEN 'attribuzione_id' ELSE '__none__' END,
 CASE WHEN name='artecna_contabilita.attribuzioni_clienti' THEN 'riconciliazione' ELSE '__none__' END,
 CASE WHEN name='artecna_contabilita.quote_lorde_clienti' THEN 'attribuzione_id' ELSE '__none__' END,name::regclass),false,false,'') AS evidence FROM rel)
SELECT jsonb_build_object('marker','ARTECNA_RICONCILIAZIONE_POSTCHECK_READONLY','scope','Full rows and columns of contractual and financial histories; only the two new link fields excluded',
'fingerprints',jsonb_object_agg(name,jsonb_build_object('rows',(xpath('/table/row/rows/text()',evidence))[1]::text::bigint,'sha256',(xpath('/table/row/sha256/text()',evidence))[1]::text)),
'backup_or_apply_authorized',false) AS evidence FROM data;
ROLLBACK;
