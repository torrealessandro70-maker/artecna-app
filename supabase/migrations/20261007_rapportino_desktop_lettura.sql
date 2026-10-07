-- U2.0B: lettura Desktop authenticated; baseline CSV Production U2.0A.
-- Nessuna modifica writer, Auth, tabelle applicative o ACL storiche.
-- Normalizzazione fingerprint esclusivamente CRLF -> LF; CR isolati vietati.
-- Varianti Mobile conserva verifica_sessione_rapportino e i lock storici:
-- il wrapper resta VOLATILE e non supporta BEGIN READ ONLY (25006), come Production.
-- Builder, letture Mobile V1/V2 e tutte le nuove RPC Desktop sono invece READ ONLY.
BEGIN;
DO $preflight$
DECLARE x jsonb; baseline_fun record; acl jsonb; execute_check jsonb;
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'Installazione riservata a postgres'; END IF;
  IF (SELECT nspowner FROM pg_namespace WHERE nspname='artecna_rapportini') IS DISTINCT FROM 'postgres'::regrole::oid
    OR to_regnamespace('artecna_guardie') IS NULL
    OR to_regclass('public.utenti_cantiere') IS NULL
    OR to_regclass('public.rapportino_materiali') IS NULL THEN RAISE EXCEPTION 'Schema baseline assente/divergente'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_rapportini_backend' AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls)
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_rapportini_rpc' AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls)
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated')
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon')
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role')
    OR has_schema_privilege('artecna_rapportini_backend','artecna_rapportini','USAGE') THEN RAISE EXCEPTION 'Ruoli baseline divergenti'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['public.rapportini','public.rapportino_prestazioni',
    'public.rapportino_materiali','public.timbrature','public.operai','public.varianti_cantiere']) AS tabella(nome)
    WHERE has_table_privilege('artecna_rapportini_backend',tabella.nome,'SELECT,INSERT,UPDATE,DELETE')
      OR has_any_column_privilege('artecna_rapportini_backend',tabella.nome,'SELECT,INSERT,UPDATE')) THEN
    RAISE EXCEPTION 'Accesso diretto backend inatteso';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE (n.nspname='public' AND p.proname IN('leggi_rapportino_desktop','varianti_rapportino_desktop'))
      OR (n.nspname='artecna_rapportini' AND p.proname IN('costruisci_lettura_rapportino_v1','arricchisci_lettura_rapportino_v2','costruisci_varianti_rapportino'))) THEN RAISE EXCEPTION 'Collisione RPC/builder U2.0B'; END IF;
  FOR x IN SELECT value FROM jsonb_array_elements($baseline$[
    {"firma":"artecna_rapportini.autorizza(text,uuid)","args":"p_sessione text, p_cantiere uuid DEFAULT NULL::uuid","defaults":1,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"v","result":"TABLE(identita uuid, canale text, compilatore_nome text)","config":["search_path=pg_catalog, pg_temp"],"hash":"519ee4902869995b5a6c3e924fed14f1662507b32a56fd14792e4d38c263b9ae","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_rapportini_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":false},{"ruolo":"artecna_rapportini_rpc","execute":true},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":false}]},
    {"firma":"artecna_rapportini.autorizza_lettura_portale(text,uuid)","args":"p_sessione text, p_cantiere_id uuid","defaults":0,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"s","result":"void","config":["search_path=pg_catalog, pg_temp"],"hash":"06546d772f0a44910131a21a2ce3e641638e73311e6669ba1f0926d615471ccb","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":false},{"ruolo":"artecna_rapportini_rpc","execute":false},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":false}]},
    {"firma":"public.leggi_rapportino_portale(text,uuid,date,uuid,smallint)","args":"p_sessione text, p_cantiere_id uuid, p_data date, p_rapportino_id uuid, p_versione_lettura smallint","defaults":0,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"s","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"aa1ebade9903f61d16f07e229668f01ef2bc87041c9cbe743b43df25b4fed2f5","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_rapportini_backend","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":true},{"ruolo":"artecna_rapportini_rpc","execute":false},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":false}]},
    {"firma":"public.leggi_rapportino_portale(text,uuid,date,uuid)","args":"p_sessione text, p_cantiere_id uuid, p_data date, p_rapportino_id uuid DEFAULT NULL::uuid","defaults":1,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"s","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"cefe8ea6ec70c9edf21f5fc9c6a311fb8538d57c59282eff4ebe3dcbca9cbae0","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_rapportini_backend","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":true},{"ruolo":"artecna_rapportini_rpc","execute":false},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":false}]},
    {"firma":"artecna_rapportini.salva_contratto_due(jsonb,text)","args":"p_payload jsonb, p_sessione text","defaults":0,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"v","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"3fe2903db3f37be9d7f5a8448b7bff6c40601f2eb31636cb08b100e6becd29dd","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":false},{"ruolo":"artecna_rapportini_rpc","execute":false},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":false}]},
    {"firma":"artecna_rapportini.salva_contratto_uno(jsonb,text)","args":"p_payload jsonb, p_sessione text","defaults":0,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"v","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"d8b72dbee95906c3b4fab477f737049dcd6c506c99cce871227ea5a7bf0e920a","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":false},{"ruolo":"artecna_rapportini_rpc","execute":false},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":false}]},
    {"firma":"public.salva_rapportino_con_prestazioni(jsonb,text)","args":"p_payload jsonb, p_sessione text DEFAULT NULL::text","defaults":1,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"v","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"7659544293c06ad4481a0dc7f6c772aadfad8f0d130310c7f2c99b41e8d080d4","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"authenticated","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"service_role","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_rapportini_backend","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":true},{"ruolo":"artecna_rapportini_rpc","execute":false},{"ruolo":"authenticated","execute":true},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":true}]},
    {"firma":"artecna_guardie.utente_jwt_corrente()","args":"","defaults":0,"owner":"postgres","lang":"sql","definer":false,"vol":"s","result":"uuid","config":["search_path=pg_catalog, pg_temp"],"hash":"9ab5ea099e74ec09e83b1505c51a3647791195aed7c742dcc3f257dfc7d2f300","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_varianti_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_sal_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_preventivi_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_cantieri_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_cantieri_delete_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_economia_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_rapportini_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_ponte_economia_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":false},{"ruolo":"artecna_rapportini_rpc","execute":true},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":false}]},
    {"firma":"artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)","args":"p_user_id uuid, p_cantiere_id uuid","defaults":0,"owner":"postgres","lang":"sql","definer":false,"vol":"s","result":"boolean","config":["search_path=pg_catalog, pg_temp"],"hash":"b14c8c5608e62555b6abb8ffbc8412a1023103805add2325ec40c89761b69d2e","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_varianti_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_sal_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_preventivi_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_cantieri_delete_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_economia_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_rapportini_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_ponte_economia_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":false},{"ruolo":"artecna_rapportini_rpc","execute":true},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":false}]},
    {"firma":"public.varianti_rapportino_portale(text,uuid)","args":"p_sessione text, p_cantiere_id uuid","defaults":0,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"v","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"2903f3fdc4e0682ec99f210810ec34db51c5227503ab96394a70afb7890b8a69","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"service_role","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_rapportini_backend","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":true},{"ruolo":"artecna_rapportini_rpc","execute":false},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":true}]},
    {"firma":"public.verifica_sessione_rapportino(text,uuid)","args":"p_sessione text, p_cantiere_id uuid","defaults":0,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"v","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"4a830a572c8e54db14076b4814a5a10d14c47dd925570dc8deae1f2404df3405","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"service_role","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_rapportini_backend","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":true},{"ruolo":"artecna_rapportini_rpc","execute":false},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":true}]}
  ]$baseline$::jsonb) LOOP
    SELECT * INTO baseline_fun FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(x->>'firma');
    IF NOT FOUND THEN RAISE EXCEPTION 'Funzione baseline assente: %',x->>'firma'; END IF;
    IF pg_catalog.pg_get_function_arguments(baseline_fun.oid) IS DISTINCT FROM x->>'args'
      OR baseline_fun.pronargdefaults IS DISTINCT FROM (x->>'defaults')::integer
      OR pg_catalog.pg_get_userbyid(baseline_fun.proowner) IS DISTINCT FROM x->>'owner'
      OR (SELECT lanname FROM pg_catalog.pg_language WHERE oid=baseline_fun.prolang) IS DISTINCT FROM x->>'lang'
      OR baseline_fun.prokind<>'f' OR baseline_fun.prosecdef IS DISTINCT FROM (x->>'definer')::boolean
      OR baseline_fun.provolatile::text IS DISTINCT FROM x->>'vol'
      OR pg_catalog.pg_get_function_result(baseline_fun.oid) IS DISTINCT FROM x->>'result'
      OR pg_catalog.to_jsonb(baseline_fun.proconfig) IS DISTINCT FROM x->'config'
      OR position(E'\r' IN replace(baseline_fun.prosrc,E'\r\n',E'\n'))>0
      OR encode(sha256(convert_to(replace(baseline_fun.prosrc,E'\r\n',E'\n'),'UTF8')),'hex') IS DISTINCT FROM x->>'hash' THEN
      RAISE EXCEPTION 'Metadata/default/fingerprint divergenti: %',x->>'firma';
    END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),
      'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
      'privilegio',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantee,a.grantor,a.privilege_type),'[]'::jsonb) INTO acl
      FROM aclexplode(coalesce(baseline_fun.proacl,acldefault('f',baseline_fun.proowner))) a;
    IF EXISTS((SELECT value FROM jsonb_array_elements(acl) EXCEPT SELECT value FROM jsonb_array_elements(x->'acl'))
      UNION ALL (SELECT value FROM jsonb_array_elements(x->'acl') EXCEPT SELECT value FROM jsonb_array_elements(acl))) THEN
      RAISE EXCEPTION 'ACL baseline divergente: %',x->>'firma';
    END IF;
  END LOOP;
END;
$preflight$;

-- Snapshot cataloghi; nessuna tabella applicativa viene scritta.
CREATE TEMP TABLE u20b_catalogo ON COMMIT DROP AS
 SELECT 'schema' tipo,n.oid id,to_jsonb(n) valore FROM pg_namespace n WHERE n.nspname IN('public','artecna_rapportini','artecna_guardie')
 UNION ALL SELECT 'relazione',c.oid,to_jsonb(c) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','artecna_rapportini','artecna_guardie')
 UNION ALL SELECT 'ruolo',r.oid,to_jsonb(r) FROM pg_roles r
 UNION ALL SELECT 'membership',m.oid,to_jsonb(m) FROM pg_auth_members m;
CREATE TEMP TABLE u20b_colonne ON COMMIT DROP AS
 SELECT a.attrelid,a.attnum,a.attacl FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN('public','artecna_rapportini','artecna_guardie');
CREATE TEMP TABLE u20b_funzioni ON COMMIT DROP AS
 SELECT p.oid,to_jsonb(p) valore FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN('public','artecna_rapportini','artecna_guardie');

CREATE FUNCTION artecna_rapportini.costruisci_lettura_rapportino_v1(p_cantiere_id uuid, p_data date, p_rapportino_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE n bigint; v1 boolean; non_supportata boolean; r record; dettaglio jsonb;
BEGIN
  IF p_cantiere_id IS NULL OR p_data IS NULL OR NOT pg_catalog.isfinite(p_data)
    OR p_data < DATE '0001-01-01' OR p_data > DATE '9999-12-31' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Cantiere e data validi obbligatori';
  END IF;
  IF p_rapportino_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.rapportini r0
    WHERE r0.id=p_rapportino_id AND r0.cantiere_id=p_cantiere_id AND r0.data=p_data) THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='UUID e contesto Rapportino incoerenti';
  END IF;
  SELECT pg_catalog.count(*),pg_catalog.bool_or(r0.versione_prestazioni=1),
    pg_catalog.bool_or(r0.versione_prestazioni IS NULL OR r0.versione_prestazioni NOT IN (0,1))
    INTO n,v1,non_supportata FROM public.rapportini r0
    WHERE r0.cantiere_id=p_cantiere_id AND r0.data=p_data;
  IF non_supportata THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione Rapportino non supportata';
  END IF;
  IF n>1 AND v1 THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto Rapportino strutturato ambiguo';
  END IF;
  IF n=0 THEN
    RETURN pg_catalog.jsonb_build_object('versione_lettura',1,'cantiere_id',p_cantiere_id,
      'data',pg_catalog.to_char(p_data,'YYYY-MM-DD'),'presente',false,
      'versione_prestazioni',NULL,'rapportino_id',NULL,'dettaglio',NULL);
  END IF;
  -- V0 storico: ORDER BY created_at DESC (NULLS FIRST implicito) come /stato.
  -- Timestamp uguali: id DESC è lo spareggio deterministico prima non definito.
  -- L'UUID opzionale verifica la scelta; non forza la selezione di un V0 più vecchio.
  SELECT r0.id,r0.versione_prestazioni,r0.revisione_prestazioni,
    r0.note,r0.materiali,r0.quantita_materiali INTO r FROM public.rapportini r0
    WHERE r0.cantiere_id=p_cantiere_id AND r0.data=p_data
    ORDER BY r0.created_at DESC,r0.id DESC LIMIT 1;
  IF p_rapportino_id IS NOT NULL AND p_rapportino_id<>r.id THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='UUID e contesto Rapportino incoerenti';
  END IF;
  dettaglio:=NULL;
  IF r.versione_prestazioni=1 THEN
    dettaglio:=pg_catalog.jsonb_build_object('versione_contratto',1,'rapportino_id',r.id,
      'revisione',r.revisione_prestazioni,'cantiere_id',p_cantiere_id,
      'data',pg_catalog.to_char(p_data,'YYYY-MM-DD'),'documento',pg_catalog.jsonb_build_object(
        'note',coalesce(r.note,''),'materiali',coalesce(r.materiali,''),
        'quantita_materiali',coalesce(r.quantita_materiali,'')),
      'prestazioni',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'prestazione_id',p.id,'chiave_client',p.chiave_client,'operaio_id',p.operaio_id,
        'operaio_nome',o.nome,'ora_inizio',pg_catalog.to_char(p.ora_inizio,'HH24:MI'),
        'ora_fine',pg_catalog.to_char(p.ora_fine,'HH24:MI'),'pausa_minuti',p.pausa_minuti,
        'lavoro_in_economia',p.lavoro_in_economia,'variante_id',p.variante_id,
        'ore',p.ore,'revisione',p.revisione,'rimossa_at',p.rimossa_at)
        ORDER BY p.created_at,p.id),'[]'::jsonb)
        FROM public.rapportino_prestazioni p JOIN public.operai o ON o.id=p.operaio_id
        WHERE p.rapportino_id=r.id));
  END IF;
  RETURN pg_catalog.jsonb_build_object('versione_lettura',1,'cantiere_id',p_cantiere_id,
    'data',pg_catalog.to_char(p_data,'YYYY-MM-DD'),'presente',true,
    'versione_prestazioni',r.versione_prestazioni,'rapportino_id',r.id,'dettaglio',dettaglio);
END;
$fn$;

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

CREATE FUNCTION artecna_rapportini.costruisci_varianti_rapportino(p_cantiere_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $fn$
BEGIN
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'numero',numero,
    'etichetta',titolo,'selezionabile',stato='bozza') ORDER BY numero NULLS LAST,id),'[]')
    FROM public.varianti_cantiere WHERE cantiere_id=p_cantiere_id);
END;
$fn$;

CREATE FUNCTION public.leggi_rapportino_desktop(p_cantiere_id uuid, p_data date, p_rapportino_id uuid, p_versione_lettura smallint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE identita uuid; base jsonb;
BEGIN
  identita:=artecna_guardie.utente_jwt_corrente();
  IF identita IS NULL THEN RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Identità Desktop obbligatoria'; END IF;
  IF p_cantiere_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.cantieri WHERE id=p_cantiere_id)
    OR artecna_guardie.utente_puo_modificare_cantiere(identita,p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito';
  END IF;
  IF p_versione_lettura IS NULL OR p_versione_lettura NOT IN(1,2) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione lettura non supportata';
  END IF;
  base:=artecna_rapportini.costruisci_lettura_rapportino_v1(p_cantiere_id,p_data,p_rapportino_id);
  IF p_versione_lettura=2 THEN RETURN artecna_rapportini.arricchisci_lettura_rapportino_v2(base); END IF;
  RETURN base;
END;
$fn$;

CREATE FUNCTION public.varianti_rapportino_desktop(p_cantiere_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE identita uuid;
BEGIN
  identita:=artecna_guardie.utente_jwt_corrente();
  IF identita IS NULL THEN RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Identità Desktop obbligatoria'; END IF;
  IF p_cantiere_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.cantieri WHERE id=p_cantiere_id)
    OR artecna_guardie.utente_puo_modificare_cantiere(identita,p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito';
  END IF;
  RETURN artecna_rapportini.costruisci_varianti_rapportino(p_cantiere_id);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.leggi_rapportino_portale(p_sessione text, p_cantiere_id uuid, p_data date, p_rapportino_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $fn$
BEGIN
  IF session_user <> 'artecna_rapportini_backend' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Lettura riservata al backend portale';
  END IF;
  IF p_cantiere_id IS NULL OR p_data IS NULL OR NOT pg_catalog.isfinite(p_data)
    OR p_data < DATE '0001-01-01' OR p_data > DATE '9999-12-31' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Cantiere e data validi obbligatori';
  END IF;
  PERFORM artecna_rapportini.autorizza_lettura_portale(p_sessione,p_cantiere_id);
  RETURN artecna_rapportini.costruisci_lettura_rapportino_v1(p_cantiere_id,p_data,p_rapportino_id);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.leggi_rapportino_portale(p_sessione text, p_cantiere_id uuid, p_data date, p_rapportino_id uuid, p_versione_lettura smallint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $fn$
DECLARE base jsonb;
BEGIN
 IF p_versione_lettura IS DISTINCT FROM 2 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione lettura non supportata'; END IF;
 base:=public.leggi_rapportino_portale(p_sessione,p_cantiere_id,p_data,p_rapportino_id);
 RETURN artecna_rapportini.arricchisci_lettura_rapportino_v2(base);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.varianti_rapportino_portale(p_sessione text, p_cantiere_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $fn$
BEGIN
  PERFORM public.verifica_sessione_rapportino(p_sessione,p_cantiere_id);
  RETURN artecna_rapportini.costruisci_varianti_rapportino(p_cantiere_id);
END;
$fn$;

-- Oggetti nuovi: elimina anche ACL introdotte dai default privileges.
DO $acl$
DECLARE f record; a record;
BEGIN
 FOR f IN SELECT p.oid,p.proowner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='public' AND p.proname IN('leggi_rapportino_desktop','varianti_rapportino_desktop'))
 OR (n.nspname='artecna_rapportini' AND p.proname IN('costruisci_lettura_rapportino_v1','arricchisci_lettura_rapportino_v2','costruisci_varianti_rapportino')) LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.oid::regprocedure);
   FOR a IN SELECT DISTINCT grantee FROM aclexplode(coalesce((SELECT proacl FROM pg_proc WHERE oid=f.oid),acldefault('f',f.proowner))) WHERE grantee NOT IN(0,f.proowner) LOOP
     EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',f.oid::regprocedure,pg_get_userbyid(a.grantee));
   END LOOP;
 END LOOP;
END;
$acl$;
REVOKE ALL ON FUNCTION artecna_rapportini.costruisci_lettura_rapportino_v1(uuid,date,uuid) FROM anon,authenticated,service_role,artecna_rapportini_backend,artecna_rapportini_rpc;
REVOKE ALL ON FUNCTION artecna_rapportini.arricchisci_lettura_rapportino_v2(jsonb) FROM anon,authenticated,service_role,artecna_rapportini_backend,artecna_rapportini_rpc;
REVOKE ALL ON FUNCTION artecna_rapportini.costruisci_varianti_rapportino(uuid) FROM anon,authenticated,service_role,artecna_rapportini_backend,artecna_rapportini_rpc;
REVOKE ALL ON FUNCTION public.leggi_rapportino_desktop(uuid,date,uuid,smallint) FROM anon,authenticated,service_role,artecna_rapportini_backend,artecna_rapportini_rpc;
REVOKE ALL ON FUNCTION public.varianti_rapportino_desktop(uuid) FROM anon,authenticated,service_role,artecna_rapportini_backend,artecna_rapportini_rpc;
GRANT EXECUTE ON FUNCTION public.leggi_rapportino_desktop(uuid,date,uuid,smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.varianti_rapportino_desktop(uuid) TO authenticated;

DO $postcheck$
DECLARE x jsonb; baseline_fun record; acl jsonb; execute_check jsonb; ruolo text;
BEGIN
 FOR x IN SELECT value FROM jsonb_array_elements($baseline$[
    {"firma":"artecna_rapportini.autorizza(text,uuid)","args":"p_sessione text, p_cantiere uuid DEFAULT NULL::uuid","defaults":1,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"v","result":"TABLE(identita uuid, canale text, compilatore_nome text)","config":["search_path=pg_catalog, pg_temp"],"hash":"519ee4902869995b5a6c3e924fed14f1662507b32a56fd14792e4d38c263b9ae","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_rapportini_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":false},{"ruolo":"artecna_rapportini_rpc","execute":true},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":false}]},
    {"firma":"artecna_rapportini.autorizza_lettura_portale(text,uuid)","args":"p_sessione text, p_cantiere_id uuid","defaults":0,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"s","result":"void","config":["search_path=pg_catalog, pg_temp"],"hash":"06546d772f0a44910131a21a2ce3e641638e73311e6669ba1f0926d615471ccb","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":false},{"ruolo":"artecna_rapportini_rpc","execute":false},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":false}]},
    {"firma":"public.leggi_rapportino_portale(text,uuid,date,uuid,smallint)","args":"p_sessione text, p_cantiere_id uuid, p_data date, p_rapportino_id uuid, p_versione_lettura smallint","defaults":0,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"s","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"3df9a1e8e28d3a57d2a1004fd0687c336afa6c52edadfc5a17842693f99779f2","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_rapportini_backend","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":true},{"ruolo":"artecna_rapportini_rpc","execute":false},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":false}]},
    {"firma":"public.leggi_rapportino_portale(text,uuid,date,uuid)","args":"p_sessione text, p_cantiere_id uuid, p_data date, p_rapportino_id uuid DEFAULT NULL::uuid","defaults":1,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"s","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"b136737e8b241dd4d3603ed417ec3d826cb4b3bef8ea843ec1c4a94afbaca9c0","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_rapportini_backend","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":true},{"ruolo":"artecna_rapportini_rpc","execute":false},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":false}]},
    {"firma":"artecna_rapportini.salva_contratto_due(jsonb,text)","args":"p_payload jsonb, p_sessione text","defaults":0,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"v","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"3fe2903db3f37be9d7f5a8448b7bff6c40601f2eb31636cb08b100e6becd29dd","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":false},{"ruolo":"artecna_rapportini_rpc","execute":false},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":false}]},
    {"firma":"artecna_rapportini.salva_contratto_uno(jsonb,text)","args":"p_payload jsonb, p_sessione text","defaults":0,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"v","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"d8b72dbee95906c3b4fab477f737049dcd6c506c99cce871227ea5a7bf0e920a","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":false},{"ruolo":"artecna_rapportini_rpc","execute":false},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":false}]},
    {"firma":"public.salva_rapportino_con_prestazioni(jsonb,text)","args":"p_payload jsonb, p_sessione text DEFAULT NULL::text","defaults":1,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"v","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"7659544293c06ad4481a0dc7f6c772aadfad8f0d130310c7f2c99b41e8d080d4","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"authenticated","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"service_role","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_rapportini_backend","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":true},{"ruolo":"artecna_rapportini_rpc","execute":false},{"ruolo":"authenticated","execute":true},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":true}]},
    {"firma":"artecna_guardie.utente_jwt_corrente()","args":"","defaults":0,"owner":"postgres","lang":"sql","definer":false,"vol":"s","result":"uuid","config":["search_path=pg_catalog, pg_temp"],"hash":"9ab5ea099e74ec09e83b1505c51a3647791195aed7c742dcc3f257dfc7d2f300","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_varianti_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_sal_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_preventivi_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_cantieri_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_cantieri_delete_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_economia_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_rapportini_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_ponte_economia_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":false},{"ruolo":"artecna_rapportini_rpc","execute":true},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":false}]},
    {"firma":"artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)","args":"p_user_id uuid, p_cantiere_id uuid","defaults":0,"owner":"postgres","lang":"sql","definer":false,"vol":"s","result":"boolean","config":["search_path=pg_catalog, pg_temp"],"hash":"b14c8c5608e62555b6abb8ffbc8412a1023103805add2325ec40c89761b69d2e","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_varianti_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_sal_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_preventivi_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_cantieri_delete_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_economia_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_rapportini_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_ponte_economia_rpc","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":false},{"ruolo":"artecna_rapportini_rpc","execute":true},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":false}]},
    {"firma":"public.varianti_rapportino_portale(text,uuid)","args":"p_sessione text, p_cantiere_id uuid","defaults":0,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"v","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"a1ff244aee4cd8fdaa818c6cb46afef7514f2627d6dda409d79494c0ee7b23fa","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"service_role","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_rapportini_backend","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":true},{"ruolo":"artecna_rapportini_rpc","execute":false},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":true}]},
    {"firma":"public.verifica_sessione_rapportino(text,uuid)","args":"p_sessione text, p_cantiere_id uuid","defaults":0,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"v","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"4a830a572c8e54db14076b4814a5a10d14c47dd925570dc8deae1f2404df3405","acl":[{"grantee":"postgres","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"service_role","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"},{"grantee":"artecna_rapportini_backend","grantor":"postgres","grantable":false,"privilegio":"EXECUTE"}],"execute":[{"ruolo":"anon","execute":false},{"ruolo":"artecna_rapportini_backend","execute":true},{"ruolo":"artecna_rapportini_rpc","execute":false},{"ruolo":"authenticated","execute":false},{"ruolo":"postgres","execute":true},{"ruolo":"service_role","execute":true}]},
    {"firma":"artecna_rapportini.costruisci_lettura_rapportino_v1(uuid,date,uuid)","args":"p_cantiere_id uuid, p_data date, p_rapportino_id uuid","defaults":0,"owner":"postgres","lang":"plpgsql","definer":false,"vol":"s","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"44199784658278669514869f4f973aa33671c8691065aacd35006d34ffe58964","acl":[{"grantor":"postgres","grantee":"postgres","privilegio":"EXECUTE","grantable":false}],"execute":[{"ruolo":"postgres","execute":true},{"ruolo":"anon","execute":false},{"ruolo":"authenticated","execute":false},{"ruolo":"service_role","execute":false},{"ruolo":"artecna_rapportini_backend","execute":false},{"ruolo":"artecna_rapportini_rpc","execute":false}]},
    {"firma":"artecna_rapportini.arricchisci_lettura_rapportino_v2(jsonb)","args":"p_lettura_v1 jsonb","defaults":0,"owner":"postgres","lang":"plpgsql","definer":false,"vol":"s","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"5ee5af07746556b6e18cc2a4cdf53792ccb11d9a561ed150161eba610aa01793","acl":[{"grantor":"postgres","grantee":"postgres","privilegio":"EXECUTE","grantable":false}],"execute":[{"ruolo":"postgres","execute":true},{"ruolo":"anon","execute":false},{"ruolo":"authenticated","execute":false},{"ruolo":"service_role","execute":false},{"ruolo":"artecna_rapportini_backend","execute":false},{"ruolo":"artecna_rapportini_rpc","execute":false}]},
    {"firma":"artecna_rapportini.costruisci_varianti_rapportino(uuid)","args":"p_cantiere_id uuid","defaults":0,"owner":"postgres","lang":"plpgsql","definer":false,"vol":"s","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"f49def710632ad1fa5d0de32298d8d0f93cbd0929489f330eed72ba53ea6a69e","acl":[{"grantor":"postgres","grantee":"postgres","privilegio":"EXECUTE","grantable":false}],"execute":[{"ruolo":"postgres","execute":true},{"ruolo":"anon","execute":false},{"ruolo":"authenticated","execute":false},{"ruolo":"service_role","execute":false},{"ruolo":"artecna_rapportini_backend","execute":false},{"ruolo":"artecna_rapportini_rpc","execute":false}]},
    {"firma":"public.leggi_rapportino_desktop(uuid,date,uuid,smallint)","args":"p_cantiere_id uuid, p_data date, p_rapportino_id uuid, p_versione_lettura smallint","defaults":0,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"s","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"3b7602514a3670a7eb94f7d70c0437dc647cf8b4d574387dc4c22af966cb9bba","acl":[{"grantor":"postgres","grantee":"postgres","privilegio":"EXECUTE","grantable":false},{"grantor":"postgres","grantee":"authenticated","privilegio":"EXECUTE","grantable":false}],"execute":[{"ruolo":"postgres","execute":true},{"ruolo":"anon","execute":false},{"ruolo":"authenticated","execute":true},{"ruolo":"service_role","execute":false},{"ruolo":"artecna_rapportini_backend","execute":false},{"ruolo":"artecna_rapportini_rpc","execute":false}]},
    {"firma":"public.varianti_rapportino_desktop(uuid)","args":"p_cantiere_id uuid","defaults":0,"owner":"postgres","lang":"plpgsql","definer":true,"vol":"s","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"hash":"b5d924cbc264d81bd41d99f2759659d7f8d94745d15ef9689fd7556830a5fedf","acl":[{"grantor":"postgres","grantee":"postgres","privilegio":"EXECUTE","grantable":false},{"grantor":"postgres","grantee":"authenticated","privilegio":"EXECUTE","grantable":false}],"execute":[{"ruolo":"postgres","execute":true},{"ruolo":"anon","execute":false},{"ruolo":"authenticated","execute":true},{"ruolo":"service_role","execute":false},{"ruolo":"artecna_rapportini_backend","execute":false},{"ruolo":"artecna_rapportini_rpc","execute":false}]}
  ]$baseline$::jsonb) LOOP
    SELECT * INTO baseline_fun FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(x->>'firma');
    IF NOT FOUND THEN RAISE EXCEPTION 'Funzione baseline assente: %',x->>'firma'; END IF;
    IF pg_catalog.pg_get_function_arguments(baseline_fun.oid) IS DISTINCT FROM x->>'args'
      OR baseline_fun.pronargdefaults IS DISTINCT FROM (x->>'defaults')::integer
      OR pg_catalog.pg_get_userbyid(baseline_fun.proowner) IS DISTINCT FROM x->>'owner'
      OR (SELECT lanname FROM pg_catalog.pg_language WHERE oid=baseline_fun.prolang) IS DISTINCT FROM x->>'lang'
      OR baseline_fun.prokind<>'f' OR baseline_fun.prosecdef IS DISTINCT FROM (x->>'definer')::boolean
      OR baseline_fun.provolatile::text IS DISTINCT FROM x->>'vol'
      OR pg_catalog.pg_get_function_result(baseline_fun.oid) IS DISTINCT FROM x->>'result'
      OR pg_catalog.to_jsonb(baseline_fun.proconfig) IS DISTINCT FROM x->'config'
      OR position(E'\r' IN replace(baseline_fun.prosrc,E'\r\n',E'\n'))>0
      OR encode(sha256(convert_to(replace(baseline_fun.prosrc,E'\r\n',E'\n'),'UTF8')),'hex') IS DISTINCT FROM x->>'hash' THEN
      RAISE EXCEPTION 'Metadata/default/fingerprint divergenti: %',x->>'firma';
    END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),
      'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
      'privilegio',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantee,a.grantor,a.privilege_type),'[]'::jsonb) INTO acl
      FROM aclexplode(coalesce(baseline_fun.proacl,acldefault('f',baseline_fun.proowner))) a;
    IF EXISTS((SELECT value FROM jsonb_array_elements(acl) EXCEPT SELECT value FROM jsonb_array_elements(x->'acl'))
      UNION ALL (SELECT value FROM jsonb_array_elements(x->'acl') EXCEPT SELECT value FROM jsonb_array_elements(acl))) THEN
      RAISE EXCEPTION 'ACL baseline divergente: %',x->>'firma';
    END IF;
    FOR execute_check IN SELECT value FROM jsonb_array_elements(x->'execute') LOOP
      IF has_function_privilege(execute_check->>'ruolo',baseline_fun.oid,'EXECUTE')
        IS DISTINCT FROM (execute_check->>'execute')::boolean THEN
        RAISE EXCEPTION 'EXECUTE effettivo divergente: %',x->>'firma';
      END IF;
    END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM u20b_funzioni s JOIN pg_proc p ON p.oid=s.oid
   WHERE (to_jsonb(p)-'prosrc') IS DISTINCT FROM (s.valore-'prosrc')
     OR (p.oid NOT IN('public.leggi_rapportino_portale(text,uuid,date,uuid)'::regprocedure,
       'public.leggi_rapportino_portale(text,uuid,date,uuid,smallint)'::regprocedure,
       'public.varianti_rapportino_portale(text,uuid)'::regprocedure) AND to_jsonb(p) IS DISTINCT FROM s.valore))
   OR EXISTS(SELECT 1 FROM u20b_funzioni s WHERE NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=s.oid)) THEN RAISE EXCEPTION 'Funzioni/ACL storiche alterate'; END IF;
 IF EXISTS(SELECT 1 FROM u20b_catalogo s LEFT JOIN (
   SELECT 'schema' tipo,n.oid id,to_jsonb(n) valore FROM pg_namespace n
   UNION ALL SELECT 'relazione',c.oid,to_jsonb(c) FROM pg_class c
   UNION ALL SELECT 'ruolo',r.oid,to_jsonb(r) FROM pg_roles r
   UNION ALL SELECT 'membership',m.oid,to_jsonb(m) FROM pg_auth_members m
 ) c USING(tipo,id) WHERE c.valore IS DISTINCT FROM s.valore)
 OR EXISTS(SELECT 1 FROM u20b_colonne s LEFT JOIN pg_attribute a ON a.attrelid=s.attrelid AND a.attnum=s.attnum
   WHERE a.attacl IS DISTINCT FROM s.attacl OR a.attrelid IS NULL) THEN RAISE EXCEPTION 'Cataloghi/privilegi storici alterati'; END IF;
 FOREACH ruolo IN ARRAY ARRAY['anon','authenticated','service_role','artecna_rapportini_backend','artecna_rapportini_rpc'] LOOP
   IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='artecna_rapportini' AND p.proname IN('costruisci_lettura_rapportino_v1','arricchisci_lettura_rapportino_v2','costruisci_varianti_rapportino')
       AND has_function_privilege(ruolo,p.oid,'EXECUTE')) THEN RAISE EXCEPTION 'Builder privato esposto'; END IF;
   IF ruolo<>'authenticated' AND (has_function_privilege(ruolo,'public.leggi_rapportino_desktop(uuid,date,uuid,smallint)','EXECUTE')
     OR has_function_privilege(ruolo,'public.varianti_rapportino_desktop(uuid)','EXECUTE')) THEN RAISE EXCEPTION 'RPC Desktop esposta'; END IF;
 END LOOP;
 IF has_schema_privilege('artecna_rapportini_backend','artecna_rapportini','USAGE') THEN RAISE EXCEPTION 'Schema privato esposto'; END IF;
END;
$postcheck$;
COMMIT;
