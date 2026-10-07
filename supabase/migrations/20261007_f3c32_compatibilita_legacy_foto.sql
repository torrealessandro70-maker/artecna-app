-- SOLO LOCALE. Da installare insieme alla protezione F3C3, prima della nuova UI.
-- Nessun cleanup Allegati/Storage; tutti gli stati del registro bloccano i padri.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL idle_in_transaction_session_timeout='30s';
SET LOCAL search_path TO pg_catalog,public;
LOCK TABLE public.cantieri,public.rapportini,public.foto_cantiere,artecna_rapportini.allegati IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE f3c32_rpc_originale ON COMMIT DROP AS
 SELECT to_jsonb(p) metadata FROM pg_proc p WHERE oid=to_regprocedure('public.elimina_cantiere_definitivamente(uuid,text)');
CREATE TEMP TABLE f3c32_rel_originali ON COMMIT DROP AS
 SELECT oid,relacl,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace,'storage'::regnamespace);
CREATE TEMP TABLE f3c32_guardie_originali ON COMMIT DROP AS
 SELECT oid,to_jsonb(p) metadata FROM pg_proc p WHERE pronamespace='artecna_rapportini'::regnamespace OR oid=to_regprocedure('public.finalizza_allegato_rapportino_portale(text,uuid,uuid)');
CREATE TEMP TABLE f3c32_membership_originale ON COMMIT DROP AS SELECT to_jsonb(m) metadata FROM pg_auth_members m WHERE roleid='artecna_cantieri_delete_rpc'::regrole;
CREATE TEMP TABLE f3c32_trigger_originali ON COMMIT DROP AS SELECT oid,to_jsonb(t) metadata FROM pg_trigger t WHERE tgrelid IN ('public.foto_cantiere'::regclass,'artecna_rapportini.allegati'::regclass);
DO $preflight$
DECLARE p record;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'F3C3.2: installer postgres richiesto'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.foto_cantiere'::regclass AND relkind='r' AND relowner='postgres'::regrole AND NOT relrowsecurity AND NOT relforcerowsecurity)
  OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='artecna_rapportini.allegati'::regclass AND relkind='r' AND relowner='postgres'::regrole AND NOT relrowsecurity AND NOT relforcerowsecurity) THEN RAISE EXCEPTION 'F3C3.2: owner/RLS foto-registro divergenti'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.foto_cantiere'::regclass AND attname='allegato_v1_id' AND NOT attisdropped AND atttypid='uuid'::regtype) THEN RAISE EXCEPTION 'F3C3.2: protezione F3C3 richiesta'; END IF;
 IF (SELECT encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') FROM pg_proc WHERE oid=to_regprocedure('public.finalizza_allegato_rapportino_portale(text,uuid,uuid)')) IS DISTINCT FROM 'fbd491fe3adb0d7ac680ed8364fba041dafdf4b96bade7760b827fafb46c58c1' THEN RAISE EXCEPTION 'F3C3.2: finalizzazione F3C3 divergente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.foto_cantiere'::regclass AND tgname='f3c3_foto_dml' AND tgenabled='O' AND NOT tgisinternal) THEN RAISE EXCEPTION 'F3C3.2: guardia foto F3C3 assente/disattivata'; END IF;
 SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure('public.elimina_cantiere_definitivamente(uuid,text)');
 IF NOT FOUND OR NOT p.prosecdef OR p.proowner<>'artecna_cantieri_delete_rpc'::regrole OR p.provolatile<>'v'
  OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[]
  OR p.pronargdefaults<>0 OR p.prorettype<>'record'::regtype
  OR strpos(replace(p.prosrc,E'\r\n',''),E'\r')>0
  OR encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')<>'3f547540c57fb860dad4a49c84639145303330bbd134cee440e3a1a9ec6058a3'
 THEN RAISE EXCEPTION 'F3C3.2: baseline RPC distruzione divergente'; END IF;
 IF EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 OR a.is_grantable OR a.grantee NOT IN ('postgres'::regrole,'authenticated'::regrole,'artecna_cantieri_delete_rpc'::regrole))
  OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE') THEN RAISE EXCEPTION 'F3C3.2: ACL RPC distruzione divergente'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE proname IN ('rinomina_cantiere_legacy_senza_allegati','elimina_rapportino_legacy_senza_allegati','compat_foto_verifica_cantiere','compat_foto_fk_allegati')) THEN RAISE EXCEPTION 'F3C3.2: oggetti già presenti'; END IF;
 IF has_schema_privilege('artecna_cantieri_delete_rpc','public','CREATE') OR EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='artecna_cantieri_delete_rpc'::regrole AND member='postgres'::regrole AND grantor='postgres'::regrole) THEN RAISE EXCEPTION 'F3C3.2: privilegi installer divergenti'; END IF;
END;
$preflight$;
CREATE FUNCTION artecna_rapportini.compat_foto_fk_allegati(p_oid oid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE k record; v_col text; v_target regclass;
BEGIN
 SELECT * INTO k FROM pg_constraint WHERE oid=p_oid;
 IF NOT FOUND OR k.conrelid<>'artecna_rapportini.allegati'::regclass THEN RETURN false; END IF;
 CASE k.conname
 WHEN 'allegati_cantiere_id_fkey' THEN v_col:='cantiere_id';v_target:='public.cantieri'::regclass;
 WHEN 'allegati_rapportino_id_fkey' THEN v_col:='rapportino_id';v_target:='public.rapportini'::regclass;
 WHEN 'allegati_foto_cantiere_id_fkey' THEN v_col:='foto_cantiere_id';v_target:='public.foto_cantiere'::regclass;
 ELSE RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='FK Allegati non certificata';
 END CASE;
 IF k.contype<>'f' OR NOT k.convalidated OR k.condeferrable OR k.condeferred OR k.confrelid<>v_target
  OR k.confdeltype<>'r' OR k.confupdtype<>'a' OR k.confmatchtype<>'s'
  OR k.conkey IS DISTINCT FROM ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=k.conrelid AND attname=v_col)]::smallint[]
  OR k.confkey IS DISTINCT FROM ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=v_target AND attname='id')]::smallint[] THEN
  RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='FK Allegati divergente'; END IF;
 RETURN true;
END;
$fn$;
CREATE FUNCTION artecna_rapportini.compat_foto_verifica_cantiere(p_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE v_count integer; k record;
BEGIN
 v_count:=0;
 FOR k IN SELECT oid FROM pg_constraint WHERE conrelid='artecna_rapportini.allegati'::regclass AND contype='f' LOOP
  PERFORM artecna_rapportini.compat_foto_fk_allegati(k.oid);v_count:=v_count+1;
 END LOOP;
 IF v_count<>3 THEN RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Inventario FK Allegati divergente'; END IF;
 IF EXISTS(SELECT 1 FROM artecna_rapportini.allegati a LEFT JOIN public.rapportini r ON r.id=a.rapportino_id
    LEFT JOIN public.foto_cantiere f ON f.id=a.foto_cantiere_id
    WHERE a.cantiere_id=p_id OR r.cantiere_id=p_id OR f.cantiere_id=p_id)
  OR EXISTS(SELECT 1 FROM public.foto_cantiere WHERE cantiere_id=p_id AND allegato_v1_id IS NOT NULL) THEN
  RAISE EXCEPTION USING ERRCODE='P2131',MESSAGE='Il cantiere contiene foto Rapportino V1 o Allegati. Eliminazione non disponibile.';
 END IF;
END;
$fn$;
DO $fk_preflight$ BEGIN PERFORM artecna_rapportini.compat_foto_verifica_cantiere(NULL); END; $fk_preflight$;
CREATE FUNCTION public.elimina_rapportino_legacy_senza_allegati(p_rapportino_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE r record; v_user uuid;
BEGIN
 v_user:=artecna_guardie.utente_jwt_corrente();
 SELECT id,cantiere_id INTO r FROM public.rapportini WHERE id=p_rapportino_id;
 IF v_user IS NULL OR NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,r.cantiere_id) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Rapportino non autorizzato'; END IF;
 SELECT id,cantiere_id INTO r FROM public.rapportini WHERE id=p_rapportino_id FOR UPDATE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,r.cantiere_id) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Rapportino non autorizzato'; END IF;
 IF EXISTS(SELECT 1 FROM artecna_rapportini.allegati WHERE rapportino_id=r.id)
  OR EXISTS(SELECT 1 FROM public.foto_cantiere WHERE rapportino_id=r.id::text AND allegato_v1_id IS NOT NULL) THEN
  RAISE EXCEPTION USING ERRCODE='P2132',MESSAGE='Il Rapportino contiene Allegati. Nessuna foto scollegata e nessun Rapportino eliminato.'; END IF;
 UPDATE public.foto_cantiere SET rapportino_id=NULL WHERE rapportino_id=r.id::text;
 DELETE FROM public.rapportini WHERE id=r.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'F3C3.2: eliminazione Rapportino non confermata'; END IF;
 RETURN jsonb_build_object('rapportino_id',r.id,'eliminato',true);
END;
$fn$;
CREATE FUNCTION public.rinomina_cantiere_legacy_senza_allegati(p_cantiere_id uuid,p_nome_atteso text,p_nuovo_nome text,p_modalita text,p_dati jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE c record; v_user uuid; t text; v_nome text;
BEGIN
 v_user:=artecna_guardie.utente_jwt_corrente();v_nome:=btrim(p_nuovo_nome);
 IF v_user IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non autorizzato'; END IF;
 IF v_nome IS NULL OR v_nome='' OR p_modalita IS NULL OR p_modalita NOT IN ('legacy','scheda','registro') OR p_dati IS NULL OR jsonb_typeof(p_dati)<>'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_dati) k WHERE k NOT IN ('preventivo','data_inizio_lavori','data_fine_lavori','lavori_conclusi'))
  OR p_modalita<>'registro' AND p_dati<>'{}'::jsonb THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Dati modifica cantiere non validi'; END IF;
 -- Stesso ordine del registro: Rapportino prima di Allegato. FK verso cantiere
 -- impedisce nuovi INSERT Allegati mentre è detenuto il successivo FOR UPDATE.
 PERFORM id FROM public.rapportini WHERE cantiere_id=p_cantiere_id ORDER BY id FOR UPDATE;
 SELECT id,nome INTO c FROM public.cantieri WHERE id=p_cantiere_id FOR UPDATE;
 IF NOT FOUND OR c.nome IS DISTINCT FROM p_nome_atteso OR artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='P2133',MESSAGE='Cantiere modificato: ricarica prima di rinominare'; END IF;
 IF c.nome IS DISTINCT FROM v_nome THEN
  BEGIN PERFORM artecna_rapportini.compat_foto_verifica_cantiere(c.id);
  EXCEPTION WHEN SQLSTATE 'P2131' THEN RAISE EXCEPTION USING ERRCODE='P2131',MESSAGE='Il cantiere contiene foto Rapportino V1. La rinomina non è ancora disponibile.'; END;
 END IF;
 IF p_modalita='legacy' AND (SELECT count(*) FROM public.cantieri WHERE nome=c.nome)<>1 THEN RAISE EXCEPTION USING ERRCODE='P2133',MESSAGE='Nome cantiere ambiguo: usa la scheda identificata da UUID'; END IF;
 IF p_modalita='registro' THEN
  IF NOT p_dati ?& ARRAY['preventivo','data_inizio_lavori','data_fine_lavori','lavori_conclusi'] THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Dati registro incompleti'; END IF;
  -- popola solo i campi della whitelist usando i tipi reali della tabella.
  UPDATE public.cantieri dst SET nome=v_nome,preventivo=src.preventivo,data_inizio_lavori=src.data_inizio_lavori,data_fine_lavori=src.data_fine_lavori,lavori_conclusi=src.lavori_conclusi
   FROM jsonb_populate_record(NULL::public.cantieri,p_dati) src WHERE dst.id=c.id;
 ELSE UPDATE public.cantieri SET nome=v_nome WHERE id=c.id; END IF;
 IF p_modalita='legacy' AND c.nome IS DISTINCT FROM v_nome THEN
  FOREACH t IN ARRAY ARRAY['rapportini','foto_cantiere','timbrature','preventivi_cantiere','materiali_cantiere','attrezzi_cantiere'] LOOP
   EXECUTE format('UPDATE public.%I SET cantiere=$1 WHERE cantiere=$2',t) USING v_nome,c.nome;
  END LOOP;
 END IF;
 RETURN jsonb_build_object('cantiere_id',c.id,'nome',v_nome);
END;
$fn$;
-- Ricostruzione minima della RPC certificata: due soli punti nuovi.
DO $patch$
DECLARE src text; ddl text; n text;
BEGIN
 src:=replace((SELECT prosrc FROM pg_proc WHERE oid='public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure),E'\r\n',E'\n');
 n:=replace(src,'  PERFORM artecna_distruzione.inizia_contesto(p_cantiere_id);','  PERFORM artecna_rapportini.compat_foto_verifica_cantiere(p_cantiere_id);'||E'\n'||'  PERFORM artecna_distruzione.inizia_contesto(p_cantiere_id);');
 n:=replace(n,'    IF fk.ns_figlio<>''public'' OR NOT (fk.figlio=ANY(v_tabelle)) OR NOT fk.convalidated THEN',
 '    IF artecna_rapportini.compat_foto_fk_allegati(fk.oid) THEN CONTINUE; END IF;'||E'\n'||'    IF fk.ns_figlio<>''public'' OR NOT (fk.figlio=ANY(v_tabelle)) OR NOT fk.convalidated THEN');
 IF n=src OR encode(sha256(convert_to(n,'UTF8')),'hex')<>'82d9a2ad8263e43ded78cdee976605b5bf3da1bbf07d9710c6c960fe1235dc63' THEN RAISE EXCEPTION 'F3C3.2: patch distruzione inattesa'; END IF;
 ddl:=replace(pg_get_functiondef('public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure),E'\r\n',E'\n');
 ddl:=replace(ddl,src,n);
 GRANT artecna_cantieri_delete_rpc TO postgres WITH INHERIT FALSE GRANTED BY postgres;
 GRANT artecna_cantieri_delete_rpc TO postgres WITH SET TRUE GRANTED BY postgres;
 GRANT CREATE ON SCHEMA public TO artecna_cantieri_delete_rpc;
 SET LOCAL ROLE artecna_cantieri_delete_rpc;
 EXECUTE ddl;
 RESET ROLE;
 REVOKE CREATE ON SCHEMA public FROM artecna_cantieri_delete_rpc;
 REVOKE artecna_cantieri_delete_rpc FROM postgres GRANTED BY postgres RESTRICT;
END;
$patch$;
-- Revoca default grants di qualsiasi grantee; nessun SELECT browser al registro.
DO $acl$
DECLARE p record; a record;
BEGIN
 FOR p IN SELECT oid,proowner FROM pg_proc WHERE proname IN ('rinomina_cantiere_legacy_senza_allegati','elimina_rapportino_legacy_senza_allegati','compat_foto_verifica_cantiere','compat_foto_fk_allegati') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',p.oid::regprocedure);
  FOR a IN SELECT DISTINCT grantee FROM aclexplode(coalesce((SELECT proacl FROM pg_proc WHERE oid=p.oid),acldefault('f',p.proowner))) WHERE grantee<>0 AND grantee<>p.proowner LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',p.oid::regprocedure,pg_get_userbyid(a.grantee));
  END LOOP;
 END LOOP;
END;
$acl$;
GRANT EXECUTE ON FUNCTION public.rinomina_cantiere_legacy_senza_allegati(uuid,text,text,text,jsonb),public.elimina_rapportino_legacy_senza_allegati(uuid) TO authenticated;
GRANT USAGE ON SCHEMA artecna_rapportini TO artecna_cantieri_delete_rpc;
GRANT EXECUTE ON FUNCTION artecna_rapportini.compat_foto_verifica_cantiere(uuid),artecna_rapportini.compat_foto_fk_allegati(oid) TO artecna_cantieri_delete_rpc;
-- F3C32_POSTCHECK
DO $post$
DECLARE p record; v_role text;
BEGIN
 IF (SELECT count(*) FROM pg_proc WHERE proname IN ('rinomina_cantiere_legacy_senza_allegati','elimina_rapportino_legacy_senza_allegati','compat_foto_verifica_cantiere','compat_foto_fk_allegati'))<>4 THEN RAISE EXCEPTION 'F3C3.2: inventario capability incompleto'; END IF;
 IF EXISTS(SELECT 1 FROM f3c32_rel_originali b LEFT JOIN pg_class c ON c.oid=b.oid WHERE c.oid IS NULL OR ROW(c.relacl,c.relrowsecurity,c.relforcerowsecurity) IS DISTINCT FROM ROW(b.relacl,b.relrowsecurity,b.relforcerowsecurity)) THEN RAISE EXCEPTION 'F3C3.2: ACL/RLS tabelle mutate'; END IF;
 IF has_schema_privilege('artecna_cantieri_delete_rpc','public','CREATE') OR EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='artecna_cantieri_delete_rpc'::regrole AND member='postgres'::regrole AND grantor='postgres'::regrole) THEN RAISE EXCEPTION 'F3C3.2: privilegi temporanei non ripristinati'; END IF;
 IF EXISTS(SELECT 1 FROM f3c32_trigger_originali b LEFT JOIN pg_trigger t0 ON t0.oid=b.oid WHERE to_jsonb(t0) IS DISTINCT FROM b.metadata) THEN RAISE EXCEPTION 'F3C3.2: trigger F3C3 mutati'; END IF;
 PERFORM artecna_rapportini.compat_foto_verifica_cantiere(NULL);
 IF EXISTS(SELECT 1 FROM f3c32_guardie_originali b LEFT JOIN pg_proc p0 ON p0.oid=b.oid WHERE to_jsonb(p0) IS DISTINCT FROM b.metadata) THEN RAISE EXCEPTION 'F3C3.2: funzioni Allegati/F3C3 mutate'; END IF;
 IF EXISTS((SELECT metadata FROM f3c32_membership_originale EXCEPT SELECT to_jsonb(m) FROM pg_auth_members m WHERE roleid='artecna_cantieri_delete_rpc'::regrole) UNION ALL (SELECT to_jsonb(m) FROM pg_auth_members m WHERE roleid='artecna_cantieri_delete_rpc'::regrole EXCEPT SELECT metadata FROM f3c32_membership_originale)) THEN RAISE EXCEPTION 'F3C3.2: membership non ripristinate'; END IF;
 IF (SELECT to_jsonb(p0)-'prosrc' FROM pg_proc p0 WHERE oid='public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure)
  IS DISTINCT FROM (SELECT metadata-'prosrc' FROM f3c32_rpc_originale) THEN RAISE EXCEPTION 'F3C3.2: metadata/ACL distruzione cambiati'; END IF;
 IF (SELECT encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') FROM pg_proc WHERE oid='public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure)<>'82d9a2ad8263e43ded78cdee976605b5bf3da1bbf07d9710c6c960fe1235dc63' THEN RAISE EXCEPTION 'F3C3.2: fingerprint distruzione errata'; END IF;
 FOR p IN SELECT oid,pronamespace,proowner,prosecdef,proconfig,proacl FROM pg_proc WHERE proname IN ('rinomina_cantiere_legacy_senza_allegati','elimina_rapportino_legacy_senza_allegati','compat_foto_verifica_cantiere','compat_foto_fk_allegati') LOOP
  IF p.proowner<>'postgres'::regrole OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] THEN RAISE EXCEPTION 'F3C3.2: metadata helper'; END IF;
  IF NOT has_function_privilege(CASE WHEN p.pronamespace='public'::regnamespace THEN 'authenticated' ELSE 'artecna_cantieri_delete_rpc' END,p.oid,'EXECUTE') THEN RAISE EXCEPTION 'F3C3.2: capability prevista non disponibile'; END IF;
  IF EXISTS(SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee=0 OR a.is_grantable OR a.grantee NOT IN ('postgres'::regrole,CASE WHEN p.pronamespace='public'::regnamespace THEN 'authenticated'::regrole ELSE 'artecna_cantieri_delete_rpc'::regrole END)) THEN RAISE EXCEPTION 'F3C3.2: ACL helper divergente'; END IF;
  FOREACH v_role IN ARRAY ARRAY['anon','service_role','artecna_rapportini_backend'] LOOP
   IF has_function_privilege(v_role,p.oid,'EXECUTE') THEN RAISE EXCEPTION 'F3C3.2: EXECUTE non autorizzato'; END IF;
  END LOOP;
  IF p.pronamespace='artecna_rapportini'::regnamespace AND has_function_privilege('authenticated',p.oid,'EXECUTE') THEN RAISE EXCEPTION 'F3C3.2: helper esposto'; END IF;
 END LOOP;
 IF has_table_privilege('authenticated','artecna_rapportini.allegati','SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'F3C3.2: registro esposto'; END IF;
END;
$post$;
COMMIT;
