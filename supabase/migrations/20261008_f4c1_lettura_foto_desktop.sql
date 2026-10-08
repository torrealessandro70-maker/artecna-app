-- F4C.1 locale. Dopo core F3C3.7 -> F3C3.1 -> F3C3.2 -> F3C3.3.
-- Il backend deve ricavare p_utente da JWT verificato lato server, MAI dal payload.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,pg_temp;
LOCK TABLE public.cantieri,public.rapportini,public.utenti_cantiere,
 public.foto_cantiere,artecna_rapportini.allegati IN SHARE MODE;
CREATE TEMP TABLE f4c1_proc ON COMMIT DROP AS SELECT oid,to_jsonb(p) metadata FROM pg_proc p;
CREATE TEMP TABLE f4c1_rel ON COMMIT DROP AS SELECT oid,relacl,relowner,relrowsecurity,relforcerowsecurity FROM pg_class;
CREATE TEMP TABLE f4c1_schema ON COMMIT DROP AS SELECT oid,nspacl FROM pg_namespace;
CREATE TEMP TABLE f4c1_members ON COMMIT DROP AS SELECT to_jsonb(m) metadata FROM pg_auth_members m;
DO $pre$
DECLARE r record; p record;
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'F4C1: installer inatteso'; END IF;
 IF to_regnamespace('artecna_foto_desktop') IS NOT NULL
  OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='elenca_foto_rapportino_desktop')
  THEN RAISE EXCEPTION 'F4C1: oggetti gia presenti'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_rapportini_backend' AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls)
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated' AND NOT rolsuper AND NOT rolbypassrls)
  THEN RAISE EXCEPTION 'F4C1: ruoli divergenti'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.foto_cantiere'::regclass
  AND attname='allegato_v1_id' AND atttypid='uuid'::regtype AND NOT attisdropped)
  THEN RAISE EXCEPTION 'F4C1: core sostitutivo richiesto'; END IF;
 FOR r IN SELECT * FROM (VALUES
  ('artecna_guardie','utente_jwt_corrente','',false,'9ab5ea099e74ec09e83b1505c51a3647791195aed7c742dcc3f257dfc7d2f300'),
  ('artecna_guardie','utente_puo_modificare_cantiere','uuid, uuid',false,'b14c8c5608e62555b6abb8ffbc8412a1023103805add2325ec40c89761b69d2e'),
  ('artecna_rapportini','accesso_allegato_finalizzato','uuid, uuid, uuid, date',true,'627df2345e6e7e3c5e11bf8eb4f908cfdaaecdcc1c36b98869cab653b3c94b1b')
 ) AS v(schema_name,function_name,args,definer,hash) LOOP
  SELECT pr.*,l.lanname INTO p FROM pg_proc pr JOIN pg_namespace n ON n.oid=pr.pronamespace
   JOIN pg_language l ON l.oid=pr.prolang WHERE n.nspname=r.schema_name AND pr.proname=r.function_name
   AND oidvectortypes(pr.proargtypes)=r.args;
  IF NOT FOUND OR p.proowner<>'postgres'::regrole OR p.prosecdef<>r.definer
   OR p.provolatile<>'s' OR p.prokind<>'f' OR p.pronargdefaults<>0 OR p.proretset
   OR p.lanname<>(CASE WHEN r.definer THEN 'plpgsql' ELSE 'sql' END)
   OR p.prorettype<>(CASE r.function_name WHEN 'utente_jwt_corrente' THEN 'uuid'::regtype
     WHEN 'utente_puo_modificare_cantiere' THEN 'boolean'::regtype ELSE 'jsonb'::regtype END)
   OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']
   OR encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')<>r.hash
   OR position(E'\r' IN replace(p.prosrc,E'\r\n',''))>0
   THEN RAISE EXCEPTION 'F4C1: helper baseline divergente %.%',r.schema_name,r.function_name; END IF;
  IF r.definer AND p.proacl::text IS DISTINCT FROM '{postgres=X/postgres}' THEN RAISE EXCEPTION 'F4C1: ACL resolver divergente'; END IF;
 END LOOP;
END;
$pre$;
CREATE SCHEMA artecna_foto_desktop AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA artecna_foto_desktop FROM PUBLIC;

CREATE FUNCTION artecna_foto_desktop.verifica(p_allegato uuid,p_utente uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE a record; r record; resolved jsonb;
BEGIN
 IF p_utente IS NULL THEN RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Identita Desktop obbligatoria'; END IF;
 SELECT id,cantiere_id,rapportino_id,foto_cantiere_id,sha256 INTO a FROM artecna_rapportini.allegati WHERE id=p_allegato;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Foto non disponibile'; END IF;
 IF artecna_guardie.utente_puo_modificare_cantiere(p_utente,a.cantiere_id) IS DISTINCT FROM true
  THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito'; END IF;
 SELECT cantiere_id,data,versione_prestazioni INTO r FROM public.rapportini WHERE id=a.rapportino_id;
 IF NOT FOUND OR r.cantiere_id IS DISTINCT FROM a.cantiere_id OR r.versione_prestazioni IS DISTINCT FROM 1
  OR r.data IS NULL OR NOT isfinite(r.data) THEN RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Contesto Foto incoerente'; END IF;
 -- Resolver certificato core: stato, path canonico, proiezione e marker.
 resolved:=artecna_rapportini.accesso_allegato_finalizzato(a.id,a.rapportino_id,a.cantiere_id,r.data);
 IF NOT EXISTS(SELECT 1 FROM public.foto_cantiere f WHERE f.id=a.foto_cantiere_id AND f.allegato_v1_id=a.id)
  OR (SELECT count(*) FROM public.foto_cantiere f WHERE f.allegato_v1_id=a.id)<>1
  THEN RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Reciprocita Foto incoerente'; END IF;
 RETURN resolved||jsonb_build_object('rapportino_id',a.rapportino_id,'cantiere_id',a.cantiere_id,
  'foto_cantiere_id',a.foto_cantiere_id,'sha256',encode(a.sha256,'hex'));
END;
$fn$;

CREATE FUNCTION public.elenca_foto_rapportino_desktop(p_rapportino uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE u uuid; r record; a record; resolved jsonb; items jsonb:='[]'::jsonb;
BEGIN
 IF current_setting('role',true)<>'authenticated' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Canale Desktop obbligatorio'; END IF;
 u:=artecna_guardie.utente_jwt_corrente();
 IF u IS NULL THEN RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Identita Desktop obbligatoria'; END IF;
 SELECT cantiere_id,data,versione_prestazioni INTO r FROM public.rapportini WHERE id=p_rapportino;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Rapportino non disponibile'; END IF;
 IF artecna_guardie.utente_puo_modificare_cantiere(u,r.cantiere_id) IS DISTINCT FROM true
  THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito'; END IF;
 IF r.versione_prestazioni IS DISTINCT FROM 1 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Rapportino non strutturato'; END IF;
 FOR a IN SELECT id FROM artecna_rapportini.allegati WHERE rapportino_id=p_rapportino AND stato='finalizzato' ORDER BY created_at,id LOOP
  resolved:=artecna_foto_desktop.verifica(a.id,u);
  items:=items||jsonb_build_array(jsonb_build_object('allegato_id',a.id,'foto_cantiere_id',resolved->'foto_cantiere_id',
   'rapportino_id',p_rapportino,'mime_type',resolved->'mime_type','byte_size',resolved->'byte_size'));
 END LOOP;
 RETURN jsonb_build_object('versione_contratto',1,'rapportino_id',p_rapportino,'allegati',items);
END;
$fn$;

CREATE FUNCTION artecna_foto_desktop.risolvi(p_allegato uuid,p_utente uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF session_user<>'artecna_rapportini_backend' THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Backend Foto obbligatorio'; END IF;
 -- p_utente e attestazione del backend fidato dopo verifica JWT, non un parametro HTTP.
 RETURN artecna_foto_desktop.verifica(p_allegato,p_utente);
END;
$fn$;

DO $acl$
DECLARE p record; a record;
BEGIN
 FOR p IN SELECT oid FROM pg_proc WHERE pronamespace='artecna_foto_desktop'::regnamespace
  OR (pronamespace='public'::regnamespace AND proname='elenca_foto_rapportino_desktop') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',p.oid::regprocedure);
  FOR a IN SELECT DISTINCT grantee FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid=p.oid)) WHERE grantee<>0 AND grantee<>'postgres'::regrole LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',p.oid::regprocedure,pg_get_userbyid(a.grantee));
  END LOOP;
 END LOOP;
END;
$acl$;
GRANT EXECUTE ON FUNCTION public.elenca_foto_rapportino_desktop(uuid) TO authenticated;
GRANT USAGE ON SCHEMA artecna_foto_desktop TO artecna_rapportini_backend;
GRANT EXECUTE ON FUNCTION artecna_foto_desktop.risolvi(uuid,uuid) TO artecna_rapportini_backend;

-- F4C1_POSTCHECK
DO $post$
DECLARE r record; expected oid[];
BEGIN
 IF EXISTS(SELECT 1 FROM f4c1_proc b LEFT JOIN pg_proc p ON p.oid=b.oid WHERE to_jsonb(p) IS DISTINCT FROM b.metadata)
  OR EXISTS(SELECT 1 FROM f4c1_rel b LEFT JOIN pg_class c ON c.oid=b.oid WHERE c.oid IS NULL OR c.relacl IS DISTINCT FROM b.relacl
    OR c.relowner<>b.relowner OR c.relrowsecurity<>b.relrowsecurity OR c.relforcerowsecurity<>b.relforcerowsecurity)
  OR EXISTS(SELECT 1 FROM f4c1_schema b LEFT JOIN pg_namespace n ON n.oid=b.oid WHERE n.oid IS NULL OR n.nspacl IS DISTINCT FROM b.nspacl)
  OR (SELECT coalesce(jsonb_agg(metadata ORDER BY metadata::text),'[]') FROM f4c1_members)
     IS DISTINCT FROM (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY to_jsonb(m)::text),'[]') FROM pg_auth_members m)
  THEN RAISE EXCEPTION 'F4C1: metadata legacy cambiati'; END IF;
 FOR r IN SELECT p.* FROM pg_proc p WHERE p.pronamespace='artecna_foto_desktop'::regnamespace
  OR (p.pronamespace='public'::regnamespace AND p.proname='elenca_foto_rapportino_desktop') LOOP
  expected:=CASE r.proname WHEN 'elenca_foto_rapportino_desktop' THEN ARRAY['postgres'::regrole::oid,'authenticated'::regrole::oid]
   WHEN 'risolvi' THEN ARRAY['postgres'::regrole::oid,'artecna_rapportini_backend'::regrole::oid] ELSE ARRAY['postgres'::regrole::oid] END;
  IF r.proowner<>'postgres'::regrole OR NOT r.prosecdef OR r.provolatile<>'s' OR r.proretset OR r.pronargdefaults<>0
   OR r.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']
   OR (SELECT array_agg(a.grantee ORDER BY a.grantee) FROM aclexplode(r.proacl) a)
      IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(expected) x)
   OR EXISTS(SELECT 1 FROM aclexplode(r.proacl) a WHERE a.privilege_type<>'EXECUTE' OR a.is_grantable)
   THEN RAISE EXCEPTION 'F4C1: ACL/metadata nuovi divergenti'; END IF;
 END LOOP;
 IF (SELECT nspacl::text FROM pg_namespace WHERE nspname='artecna_foto_desktop')
    IS DISTINCT FROM '{postgres=UC/postgres,artecna_rapportini_backend=U/postgres}'
  OR (SELECT count(*) FROM pg_proc WHERE pronamespace='artecna_foto_desktop'::regnamespace)<>2
  THEN RAISE EXCEPTION 'F4C1: inventario funzioni divergente'; END IF;
END;
$post$;
COMMIT;
