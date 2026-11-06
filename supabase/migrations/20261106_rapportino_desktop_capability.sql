-- Incremental, fail-closed installation. No table/policy/role/data changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $extract$
DECLARE item record; src text; definition text; prefix text; suffix text;
  previous_acl aclitem[]; previous_owner oid;
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'Installer postgres richiesto'; END IF;
 IF to_regprocedure('artecna_rapportini.crea_proiezione_foto_v1(uuid,uuid)') IS NULL
  OR to_regprocedure('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)') IS NULL
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_rapportini_backend') THEN
  RAISE EXCEPTION 'Prerequisiti core foto / guardia / backend mancanti'; END IF;
 IF to_regprocedure('artecna_rapportini.arricchisci_lettura_rapportino_v2(jsonb)') IS NOT NULL THEN
  RAISE EXCEPTION 'Helper V2 gia presente: verificare il catalogo prima di procedere'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('artecna_rapportini.costruisci_lettura_rapportino_v1(uuid,date,uuid)')
  AND proowner='postgres'::regrole AND NOT prosecdef AND provolatile='s'
  AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[]
  AND encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='44199784658278669514869f4f973aa33671c8691065aacd35006d34ffe58964') THEN
  RAISE EXCEPTION 'Builder V1 Production divergente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.leggi_rapportino_desktop(uuid,date,uuid,smallint)')
  AND proowner='postgres'::regrole AND prosecdef AND provolatile='s'
  AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[]
  AND encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='bc0668994f1d48e07681536cbc190e619a93a4bd5a2bebabf8fc3621546445e8') THEN
  RAISE EXCEPTION 'Reader V1 Production divergente'; END IF;
 FOR item IN SELECT * FROM (VALUES
  ('prenota_allegato','text,uuid,uuid,date,uuid,text,text,bigint','  IF p_rapportino_id IS NULL',
   'p_sessione,p_rapportino_id,p_cantiere_id,p_data,p_chiave_client_allegato,p_sha256,p_mime_type,p_byte_size','b94e320aa56509b5e56433d5f693f778b954a37ec87edd5ef3e0e137a7477760'),
  ('finalizza_allegato','text,uuid,uuid','  IF p_allegato_id IS NULL',
   'p_sessione,p_allegato_id,p_lease_id','fbd491fe3adb0d7ac680ed8364fba041dafdf4b96bade7760b827fafb46c58c1')
 ) v(name,types,marker,args,hash) LOOP
  SELECT replace(prosrc,E'\r\n',E'\n'),proacl,proowner INTO STRICT src,previous_acl,previous_owner
   FROM pg_proc WHERE oid=('public.'||item.name||'_rapportino_portale('||item.types||')')::regprocedure;
  IF encode(sha256(convert_to(src,'UTF8')),'hex')<>item.hash OR previous_owner<>'postgres'::regrole THEN
   RAISE EXCEPTION 'Definizione installata divergente: %',item.name; END IF;
  IF to_regprocedure('artecna_rapportini.'||item.name||'_core('||item.types||')') IS NOT NULL THEN
   RAISE EXCEPTION 'Core gia presente'; END IF;
  IF strpos(src,item.marker)=0 OR strpos(src,E'BEGIN\n')=0 THEN RAISE EXCEPTION 'Confine estrazione inatteso'; END IF;
  prefix:=substr(src,1,strpos(src,item.marker)-1); suffix:=substr(src,strpos(src,item.marker));
  definition:=replace(pg_get_functiondef(('public.'||item.name||'_rapportino_portale('||item.types||')')::regprocedure),E'\r\n',E'\n');
  -- One domain implementation. Keep the original declaration and complete domain suffix.
  EXECUTE replace(replace(definition,'CREATE OR REPLACE FUNCTION public.'||item.name||'_rapportino_portale(',
   'CREATE FUNCTION artecna_rapportini.'||item.name||'_core('),src,
   substr(src,1,strpos(src,E'BEGIN\n')+5)||E'  IF session_user<>''artecna_rapportini_backend'' THEN RAISE EXCEPTION USING ERRCODE=''42501'',MESSAGE=''Backend obbligatorio''; END IF;\n'||suffix);
  -- Keep the portal authentication prefix verbatim, including token/worker checks.
  EXECUTE replace(definition,src,prefix||'  RETURN artecna_rapportini.'||item.name||'_core('||item.args||E');\nEND;\n');
  IF (SELECT proacl FROM pg_proc WHERE oid=('public.'||item.name||'_rapportino_portale('||item.types||')')::regprocedure)
   IS DISTINCT FROM previous_acl THEN RAISE EXCEPTION 'ACL mobile cambiate'; END IF;
 END LOOP;
END;
$extract$;

-- Copied verbatim from 20261007_rapportino_desktop_lettura.sql (body CRLF -> LF).
-- prosrc SHA256: 5ee5af07746556b6e18cc2a4cdf53792ccb11d9a561ed150161eba610aa01793
CREATE FUNCTION artecna_rapportini.arricchisci_lettura_rapportino_v2(p_lettura_v1 jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE base jsonb:=p_lettura_v1; dettaglio jsonb; materiali jsonb; riepilogo jsonb; rid uuid; vm smallint;
BEGIN
 IF base->'versione_prestazioni' IS DISTINCT FROM '1'::jsonb THEN RETURN base||jsonb_build_object('versione_lettura',2); END IF;
 rid:=(base->>'rapportino_id')::uuid;
 SELECT versione_materiali INTO vm FROM public.rapportini WHERE id=rid;
 IF vm IS NULL OR vm NOT IN(0,1) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione materiali non supportata'; END IF;
 IF vm=0 AND EXISTS(SELECT 1 FROM public.rapportino_materiali WHERE rapportino_id=rid) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Contesto materiali incoerente'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('materiale_id',m.id,'chiave_client',m.chiave_client,'descrizione',m.descrizione,'unita_misura',m.unita_misura,
 'quantita',m.quantita::text,'costo_unitario',m.costo_unitario::text,'costo_totale',m.costo_totale::text,'note',m.note,'revisione',m.revisione,'rimossa_at',m.rimossa_at)
 ORDER BY m.created_at,m.id),'[]'::jsonb) INTO materiali FROM public.rapportino_materiali m WHERE m.rapportino_id=rid;
 SELECT jsonb_build_object('totale_materiali_valorizzati',coalesce(sum(m.costo_totale),0.00)::text,
 'numero_materiali_da_valorizzare',count(*) FILTER(WHERE m.costo_unitario IS NULL),'valorizzazione_completa',count(*) FILTER(WHERE m.costo_unitario IS NULL)=0)
 INTO riepilogo FROM public.rapportino_materiali m WHERE m.rapportino_id=rid AND m.rimossa_at IS NULL;
 dettaglio:=((base->'dettaglio')-'documento')||jsonb_build_object('versione_contratto',2,
 'documento',jsonb_build_object('note',base#>>'{dettaglio,documento,note}'),
 'documento_legacy_materiali',jsonb_build_object('materiali',base#>>'{dettaglio,documento,materiali}','quantita_materiali',base#>>'{dettaglio,documento,quantita_materiali}'),
 'versione_materiali',vm,'materiali',materiali,'riepilogo_materiali',riepilogo);
 RETURN base||jsonb_build_object('versione_lettura',2,'dettaglio',dettaglio);
END;
$fn$;


CREATE FUNCTION public.prenota_allegato_rapportino_desktop(
 p_user_id uuid,p_rapportino_id uuid,p_cantiere_id uuid,p_data date,
 p_chiave_client_allegato uuid,p_sha256 text,p_mime_type text,p_byte_size bigint)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF session_user<>'artecna_rapportini_backend' OR p_user_id IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Backend e identita attestata obbligatori'; END IF;
 IF artecna_guardie.utente_puo_modificare_cantiere(p_user_id,p_cantiere_id) IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito'; END IF;
 RETURN artecna_rapportini.prenota_allegato_core(NULL,p_rapportino_id,p_cantiere_id,p_data,
  p_chiave_client_allegato,p_sha256,p_mime_type,p_byte_size);
END;
$fn$;

CREATE FUNCTION public.finalizza_allegato_rapportino_desktop(p_user_id uuid,p_allegato_id uuid,p_lease_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE c uuid;
BEGIN
 IF session_user<>'artecna_rapportini_backend' OR p_user_id IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Backend e identita attestata obbligatori'; END IF;
 SELECT cantiere_id INTO c FROM artecna_rapportini.allegati WHERE id=p_allegato_id;
 IF c IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(p_user_id,c) IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito'; END IF;
 RETURN artecna_rapportini.finalizza_allegato_core(NULL,p_allegato_id,p_lease_id);
END;
$fn$;

DO $reader$
DECLARE src text; next_src text; definition text;
BEGIN
 SELECT prosrc INTO STRICT src FROM pg_proc WHERE oid='public.leggi_rapportino_desktop(uuid,date,uuid,smallint)'::regprocedure;
 IF encode(sha256(convert_to(replace(src,E'\r\n',E'\n'),'UTF8')),'hex')<>'bc0668994f1d48e07681536cbc190e619a93a4bd5a2bebabf8fc3621546445e8' THEN
  RAISE EXCEPTION 'Reader V1 installato divergente'; END IF;
 next_src:=replace(src,'IF p_versione_lettura IS DISTINCT FROM 1 THEN','IF p_versione_lettura IS NULL OR p_versione_lettura NOT IN(1,2) THEN');
 next_src:=replace(next_src,'  RETURN base;',E'  IF p_versione_lettura=2 THEN RETURN artecna_rapportini.arricchisci_lettura_rapportino_v2(base); END IF;\n  RETURN base;');
 definition:=pg_get_functiondef('public.leggi_rapportino_desktop(uuid,date,uuid,smallint)'::regprocedure);
 EXECUTE replace(definition,src,next_src);
END;
$reader$;

-- Neutralize hostile defaults only on the five new functions. No table grants.
DO $acl$
DECLARE sig text; f oid; a record;
BEGIN
 FOREACH sig IN ARRAY ARRAY[
 'artecna_rapportini.arricchisci_lettura_rapportino_v2(jsonb)',
 'artecna_rapportini.prenota_allegato_core(text,uuid,uuid,date,uuid,text,text,bigint)',
 'artecna_rapportini.finalizza_allegato_core(text,uuid,uuid)',
 'public.prenota_allegato_rapportino_desktop(uuid,uuid,uuid,date,uuid,text,text,bigint)',
 'public.finalizza_allegato_rapportino_desktop(uuid,uuid,uuid)'] LOOP
  f:=sig::regprocedure;
  EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f::regprocedure);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f::regprocedure);
  FOR a IN SELECT DISTINCT grantee FROM aclexplode(coalesce((SELECT proacl FROM pg_proc WHERE oid=f),acldefault('f','postgres'::regrole)))
   WHERE grantee NOT IN(0,'postgres'::regrole) LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',f::regprocedure,pg_get_userbyid(a.grantee));
  END LOOP;
  IF sig LIKE 'public.%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO artecna_rapportini_backend',f::regprocedure); END IF;
 END LOOP;
END;
$acl$;

DO $postcheck$
DECLARE f record; sig text; r text;
BEGIN
 FOREACH sig IN ARRAY ARRAY[
 'artecna_rapportini.prenota_allegato_core(text,uuid,uuid,date,uuid,text,text,bigint)',
 'artecna_rapportini.finalizza_allegato_core(text,uuid,uuid)',
 'public.prenota_allegato_rapportino_desktop(uuid,uuid,uuid,date,uuid,text,text,bigint)',
 'public.finalizza_allegato_rapportino_desktop(uuid,uuid,uuid)'] LOOP
  SELECT * INTO STRICT f FROM pg_proc WHERE oid=sig::regprocedure;
  IF f.proowner<>'postgres'::regrole OR NOT f.prosecdef OR f.provolatile<>'v'
   OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] THEN RAISE EXCEPTION 'Metadati RPC inattesi: %',sig; END IF;
  FOREACH r IN ARRAY ARRAY['authenticated','anon','service_role'] LOOP
   IF has_function_privilege(r,f.oid,'EXECUTE') THEN RAISE EXCEPTION 'Accesso diretto foto vietato: % %',sig,r; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM aclexplode(f.proacl) WHERE grantee NOT IN('postgres'::regrole,
    CASE WHEN sig LIKE 'public.%' THEN 'artecna_rapportini_backend'::regrole ELSE 'postgres'::regrole END)
    OR privilege_type<>'EXECUTE' OR is_grantable) THEN RAISE EXCEPTION 'ACL foto inattesa'; END IF;
  IF has_function_privilege('artecna_rapportini_backend',f.oid,'EXECUTE') IS DISTINCT FROM (sig LIKE 'public.%') THEN RAISE EXCEPTION 'ACL backend inattesa'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='artecna_rapportini.arricchisci_lettura_rapportino_v2(jsonb)'::regprocedure
  AND proowner='postgres'::regrole AND NOT prosecdef AND provolatile='s' AND prorettype='jsonb'::regtype
  AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[]
  AND encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='5ee5af07746556b6e18cc2a4cdf53792ccb11d9a561ed150161eba610aa01793')
  OR EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   WHERE p.oid='artecna_rapportini.arricchisci_lettura_rapportino_v2(jsonb)'::regprocedure
   AND (a.grantee<>p.proowner OR a.privilege_type<>'EXECUTE' OR a.is_grantable)) THEN
  RAISE EXCEPTION 'Helper V2: sorgente, metadati o ACL divergenti'; END IF;
END;
$postcheck$;
COMMIT;
