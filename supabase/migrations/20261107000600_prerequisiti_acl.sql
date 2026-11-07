-- Neutralizza default privileges inattesi sulle sole nuove capability.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
DO $$
DECLARE p record;a record;allowed text[];r text;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Installer inatteso'; END IF;
 FOR p IN SELECT proc.*,n.nspname FROM pg_proc proc JOIN pg_namespace n ON n.oid=proc.pronamespace
 WHERE (n.nspname='artecna_distruzione' AND (proc.proname LIKE 'storage_%' OR proc.proname IN
  ('numero_riferimenti_vivi','apri_contesto_prerequisiti','target_prerequisiti','chiudi_contesto_prerequisiti','sanifica_archivio','ids_operativi','td04_detach_consentito','documento_detach_consentito','archivio_quota_eliminata','detach_contabile_cantiere','legacy_derivazione','normalizza_legacy_cantiere','approva_risoluzione_legacy')))
 OR (n.nspname='public' AND proc.proname IN ('assegna_legacy_cantiere','leggi_archivio_contabile_cantiere')) LOOP
  IF p.proowner<>'postgres'::regrole THEN RAISE EXCEPTION 'Owner capability inatteso'; END IF;
  allowed:=ARRAY['postgres'];
  IF p.proname IN ('storage_claim','storage_finish') THEN allowed:=array_append(allowed,'artecna_storage_worker'); END IF;
  IF p.proname IN ('apri_contesto_prerequisiti','target_prerequisiti','chiudi_contesto_prerequisiti','detach_contabile_cantiere') THEN allowed:=array_append(allowed,'artecna_cantieri_delete_rpc'); END IF;
  IF p.nspname='public' THEN allowed:=array_append(allowed,'authenticated'); END IF;
  FOR a IN SELECT DISTINCT grantee FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) LOOP
   IF a.grantee=0 THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',p.oid::regprocedure);
   ELSIF NOT pg_get_userbyid(a.grantee)=ANY(allowed) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',p.oid::regprocedure,pg_get_userbyid(a.grantee)); END IF;
  END LOOP;
  FOREACH r IN ARRAY allowed LOOP
   IF r='postgres' THEN CONTINUE; END IF;
   EXECUTE format('REVOKE GRANT OPTION FOR EXECUTE ON FUNCTION %s FROM %I',p.oid::regprocedure,r);
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I',p.oid::regprocedure,r);
  END LOOP;
 END LOOP;
 FOR p IN SELECT c.oid,c.relowner,c.relacl,n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE (n.nspname='artecna_distruzione' AND (c.relname LIKE 'storage_%' OR c.relname IN ('contesto_prerequisiti','quote_da_eliminare','legacy_sorgenti','legacy_da_risolvere')) AND c.relkind='r')
 OR (n.nspname='artecna_contabilita' AND c.relname IN ('archivio_quote','archivio_attribuzioni')) LOOP
  FOR a IN SELECT DISTINCT grantee FROM aclexplode(coalesce(p.relacl,acldefault('r',p.relowner))) WHERE grantee<>p.relowner LOOP
   EXECUTE format('REVOKE ALL ON TABLE %s FROM %s',p.oid::regclass,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END);
  END LOOP;
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',p.oid::regclass);
 END LOOP;
 -- The INVOKER invoice guard needs only a scoped existence check on the bridge.
 GRANT SELECT ON artecna_distruzione.quote_da_eliminare TO artecna_cantieri_delete_rpc;
END $$;
COMMIT;
