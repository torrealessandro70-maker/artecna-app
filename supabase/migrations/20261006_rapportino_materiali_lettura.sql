-- M2.4: overload read-only opt-in, dopo M2.2/M2.3. Mobile operativo resta V1.
BEGIN;
DO $preflight$
DECLARE x record; p record; schema_hash text;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'Installazione riservata a postgres'; END IF;
 IF to_regclass('public.rapportino_materiali') IS NULL OR to_regprocedure('public.leggi_rapportino_portale(text,uuid,date,uuid,smallint)') IS NOT NULL THEN RAISE EXCEPTION 'Prerequisiti o collisione M2.4'; END IF;
 FOR x IN SELECT * FROM (VALUES ('public.leggi_rapportino_portale(text,uuid,date,uuid)','postgres',true,'s','jsonb','cefe8ea6ec70c9edf21f5fc9c6a311fb8538d57c59282eff4ebe3dcbca9cbae0'),
('artecna_rapportini.autorizza_lettura_portale(text,uuid)','postgres',true,'s','void','06546d772f0a44910131a21a2ce3e641638e73311e6669ba1f0926d615471ccb'),
('public.salva_rapportino_con_prestazioni(jsonb,text)','postgres',true,'v','jsonb','7659544293c06ad4481a0dc7f6c772aadfad8f0d130310c7f2c99b41e8d080d4'),
('artecna_rapportini.salva_contratto_uno(jsonb,text)','postgres',true,'v','jsonb','d8b72dbee95906c3b4fab477f737049dcd6c506c99cce871227ea5a7bf0e920a'),
('artecna_rapportini.salva_contratto_due(jsonb,text)','postgres',true,'v','jsonb','3fe2903db3f37be9d7f5a8448b7bff6c40601f2eb31636cb08b100e6becd29dd'),
('artecna_rapportini.applica_prestazioni_contratto_due(jsonb)','postgres',false,'v','boolean','870aa773a0b8e5e2dc6fd811fe91a6092f9904ca161b45c44142d46e86dfd309'),
('artecna_rapportini.applica_materiali_contratto_due(uuid,jsonb)','artecna_rapportini_rpc',true,'v','boolean','c97f063e9aff6ca5dd0d3772e0a343de8a9a14763662038bdc770cfe4246880c'),
('artecna_rapportini.proteggi_materiale()','postgres',true,'v','trigger','eeb3a4f2b4dbb1090ceebefa0b06c7fb22b0de8e1ebf178e7b1b4dfedbc275d4'),
('artecna_rapportini.proteggi_versione_materiali()','postgres',false,'v','trigger','d2c1961963c5f4884e41c90bc27d17811da45566dfbf6a09a8564c820492e32b'),
('artecna_rapportini.materiali_fail_closed()','postgres',false,'v','trigger','69f6e5258de386726ece3a71108ea57b3ab299f47ce71922618be984495d6a9f')) b(firma,owner,definer,volatilita,risultato,hash) LOOP
 SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(x.firma);
 IF NOT FOUND OR pg_get_userbyid(p.proowner)<>x.owner OR p.prosecdef IS DISTINCT FROM x.definer OR p.provolatile::text<>x.volatilita
 OR p.prorettype<>to_regtype(x.risultato) OR p.prokind<>'f' OR p.proretset OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql')
 OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[]
 OR position(chr(13) IN replace(p.prosrc,chr(13)||chr(10),chr(10)))>0
 OR encode(sha256(convert_to(replace(p.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex')<>x.hash THEN RAISE EXCEPTION 'Baseline M2.4 divergente: %',x.firma; END IF;
 END LOOP;
 SELECT encode(sha256(convert_to(value::text,'UTF8')),'hex') INTO schema_hash FROM (SELECT jsonb_build_object(
 'versione_materiali',(SELECT jsonb_build_array(format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.rapportini'::regclass AND a.attname='versione_materiali'),
 'colonne',(SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.rapportino_materiali'::regclass AND a.attnum>0 AND NOT a.attisdropped),
 'vincoli',(SELECT jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid),convalidated) ORDER BY conname) FROM pg_constraint WHERE (conrelid='public.rapportino_materiali'::regclass AND contype<>'n') OR (conrelid='public.rapportini'::regclass AND conname IN ('rapportini_versione_materiali_ck','rapportini_materiali_v1_ck'))),
 'indici',(SELECT jsonb_agg(jsonb_build_array(pg_get_indexdef(indexrelid),indisvalid,indisready) ORDER BY pg_get_indexdef(indexrelid)) FROM pg_index WHERE indrelid='public.rapportino_materiali'::regclass),
 'trigger',(SELECT jsonb_agg(jsonb_build_array(tgname,pg_get_triggerdef(oid),tgenabled) ORDER BY tgname) FROM pg_trigger WHERE tgrelid='public.rapportino_materiali'::regclass AND NOT tgisinternal),
 'tabella',(SELECT jsonb_build_array(pg_get_userbyid(relowner),relrowsecurity,relforcerowsecurity) FROM pg_class WHERE oid='public.rapportino_materiali'::regclass),
 'policy',(SELECT jsonb_agg(jsonb_build_array(polname,polcmd,polpermissive,(SELECT array_agg(pg_get_userbyid(r) ORDER BY pg_get_userbyid(r)) FROM unnest(polroles) r),pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid)) ORDER BY polname) FROM pg_policy WHERE polrelid='public.rapportino_materiali'::regclass)
 ) value) s;
 IF schema_hash<>'9b48813c210412ca1008583ed01e5b612687089c4f1e483f3c6b03edfa8b901c' THEN RAISE EXCEPTION 'Schema M2.2/M2.3 divergente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_rapportini_backend' AND rolcanlogin AND NOT (rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member='artecna_rapportini_backend'::regrole)
 OR has_schema_privilege('artecna_rapportini_backend','artecna_rapportini','USAGE,CREATE')
 OR NOT has_function_privilege('artecna_rapportini_backend','public.leggi_rapportino_portale(text,uuid,date,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Ruolo/ACL lettura divergenti'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_rapportini_rpc' AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN RAISE EXCEPTION 'Ruolo dominio divergente'; END IF;
 FOR x IN SELECT oid FROM pg_class WHERE oid IN ('public.rapportini'::regclass,'public.rapportino_prestazioni'::regclass,'public.rapportino_materiali'::regclass,'public.timbrature'::regclass,'public.operai'::regclass,'public.varianti_cantiere'::regclass) LOOP
 IF has_table_privilege('artecna_rapportini_backend',x.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege('artecna_rapportini_backend',x.oid,'SELECT,INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION 'ACL backend divergenti'; END IF; END LOOP;
 IF EXISTS(SELECT 1 FROM pg_proc pr CROSS JOIN LATERAL aclexplode(coalesce(pr.proacl,acldefault('f',pr.proowner))) a WHERE pr.oid='public.leggi_rapportino_portale(text,uuid,date,uuid)'::regprocedure
 AND (a.grantee NOT IN('postgres'::regrole,'artecna_rapportini_backend'::regrole) OR a.is_grantable OR a.privilege_type<>'EXECUTE')) THEN RAISE EXCEPTION 'ACL V1 divergenti'; END IF;
END;
$preflight$;
CREATE TEMP TABLE m24_funzioni ON COMMIT DROP AS SELECT oid,to_jsonb(p) metadata FROM pg_proc p WHERE pronamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace);
CREATE TEMP TABLE m24_dati ON COMMIT DROP AS SELECT 'rapportini' tipo,to_jsonb(r) valore FROM public.rapportini r
 UNION ALL SELECT 'prestazioni',to_jsonb(r) FROM public.rapportino_prestazioni r
 UNION ALL SELECT 'materiali',to_jsonb(r) FROM public.rapportino_materiali r
 UNION ALL SELECT 'richieste',to_jsonb(r) FROM artecna_rapportini.richieste r;
CREATE FUNCTION public.leggi_rapportino_portale(p_sessione text,p_cantiere_id uuid,p_data date,p_rapportino_id uuid,p_versione_lettura smallint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE base jsonb; dettaglio jsonb; materiali jsonb; riepilogo jsonb; rid uuid; vm smallint;
BEGIN
 IF p_versione_lettura IS DISTINCT FROM 2 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione lettura non supportata'; END IF;
 -- La firma storica mantiene identica autorizzazione, snapshot, selezione e coerenza UUID.
 base:=public.leggi_rapportino_portale(p_sessione,p_cantiere_id,p_data,p_rapportino_id);
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
-- Revoca anche grant da eventuali default privileges: solo oggetto nuovo.
DO $acl$ DECLARE p record; a record; BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid='public.leggi_rapportino_portale(text,uuid,date,uuid,smallint)'::regprocedure;
 REVOKE ALL ON FUNCTION public.leggi_rapportino_portale(text,uuid,date,uuid,smallint) FROM PUBLIC;
 FOR a IN SELECT DISTINCT grantee FROM aclexplode(p.proacl) WHERE grantee<>0 AND grantee<>p.proowner LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',p.oid::regprocedure,pg_get_userbyid(a.grantee)); END LOOP;
END; $acl$;
GRANT EXECUTE ON FUNCTION public.leggi_rapportino_portale(text,uuid,date,uuid,smallint) TO artecna_rapportini_backend;
DO $postcheck$ DECLARE x record; p record; role_name text; BEGIN
 IF (SELECT encode(sha256(convert_to(value::text,'UTF8')),'hex') FROM (SELECT jsonb_build_object(
 'versione_materiali',(SELECT jsonb_build_array(format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.rapportini'::regclass AND a.attname='versione_materiali'),
 'colonne',(SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.rapportino_materiali'::regclass AND a.attnum>0 AND NOT a.attisdropped),
 'vincoli',(SELECT jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid),convalidated) ORDER BY conname) FROM pg_constraint WHERE (conrelid='public.rapportino_materiali'::regclass AND contype<>'n') OR (conrelid='public.rapportini'::regclass AND conname IN ('rapportini_versione_materiali_ck','rapportini_materiali_v1_ck'))),
 'indici',(SELECT jsonb_agg(jsonb_build_array(pg_get_indexdef(indexrelid),indisvalid,indisready) ORDER BY pg_get_indexdef(indexrelid)) FROM pg_index WHERE indrelid='public.rapportino_materiali'::regclass),
 'trigger',(SELECT jsonb_agg(jsonb_build_array(tgname,pg_get_triggerdef(oid),tgenabled) ORDER BY tgname) FROM pg_trigger WHERE tgrelid='public.rapportino_materiali'::regclass AND NOT tgisinternal),
 'tabella',(SELECT jsonb_build_array(pg_get_userbyid(relowner),relrowsecurity,relforcerowsecurity) FROM pg_class WHERE oid='public.rapportino_materiali'::regclass),
 'policy',(SELECT jsonb_agg(jsonb_build_array(polname,polcmd,polpermissive,(SELECT array_agg(pg_get_userbyid(r) ORDER BY pg_get_userbyid(r)) FROM unnest(polroles) r),pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid)) ORDER BY polname) FROM pg_policy WHERE polrelid='public.rapportino_materiali'::regclass)
 ) value) s)<>'9b48813c210412ca1008583ed01e5b612687089c4f1e483f3c6b03edfa8b901c' THEN RAISE EXCEPTION 'Schema materiali modificato'; END IF;
 FOR x IN SELECT * FROM m24_funzioni LOOP
 IF (SELECT to_jsonb(hist) FROM pg_proc hist WHERE oid=x.oid) IS DISTINCT FROM x.metadata THEN RAISE EXCEPTION 'Funzione storica modificata'; END IF; END LOOP;
 SELECT * INTO p FROM pg_proc WHERE oid='public.leggi_rapportino_portale(text,uuid,date,uuid,smallint)'::regprocedure;
 IF p.proowner<>'postgres'::regrole OR NOT p.prosecdef OR p.provolatile<>'s' OR p.prorettype<>'jsonb'::regtype OR p.pronargdefaults<>0
 OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql') OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[]
 OR position(chr(13) IN replace(p.prosrc,chr(13)||chr(10),chr(10)))>0
 OR encode(sha256(convert_to(replace(p.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex')<>'aa1ebade9903f61d16f07e229668f01ef2bc87041c9cbe743b43df25b4fed2f5' THEN RAISE EXCEPTION 'Overload V2 divergente'; END IF;
 IF EXISTS(SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee NOT IN(p.proowner,'artecna_rapportini_backend'::regrole) OR a.is_grantable OR a.privilege_type<>'EXECUTE')
 OR NOT EXISTS(SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee='artecna_rapportini_backend'::regrole AND a.privilege_type='EXECUTE' AND NOT a.is_grantable) THEN RAISE EXCEPTION 'ACL overload divergenti'; END IF;
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
 IF has_function_privilege(role_name,p.oid,'EXECUTE') THEN RAISE EXCEPTION 'Overload esposto'; END IF; END LOOP;
 IF has_schema_privilege('artecna_rapportini_backend','artecna_rapportini','USAGE,CREATE') THEN RAISE EXCEPTION 'Schema privato esposto'; END IF;
 FOR x IN SELECT oid FROM pg_class WHERE oid IN ('public.rapportini'::regclass,'public.rapportino_prestazioni'::regclass,'public.rapportino_materiali'::regclass,'public.timbrature'::regclass,'public.operai'::regclass,'public.varianti_cantiere'::regclass) LOOP
 IF has_table_privilege('artecna_rapportini_backend',x.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege('artecna_rapportini_backend',x.oid,'SELECT,INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION 'Tabella esposta al backend'; END IF; END LOOP;
 IF EXISTS(SELECT * FROM m24_dati EXCEPT (SELECT 'rapportini',to_jsonb(r) FROM public.rapportini r UNION ALL SELECT 'prestazioni',to_jsonb(r) FROM public.rapportino_prestazioni r UNION ALL SELECT 'materiali',to_jsonb(r) FROM public.rapportino_materiali r UNION ALL SELECT 'richieste',to_jsonb(r) FROM artecna_rapportini.richieste r))
 OR EXISTS((SELECT 'rapportini',to_jsonb(r) FROM public.rapportini r UNION ALL SELECT 'prestazioni',to_jsonb(r) FROM public.rapportino_prestazioni r UNION ALL SELECT 'materiali',to_jsonb(r) FROM public.rapportino_materiali r UNION ALL SELECT 'richieste',to_jsonb(r) FROM artecna_rapportini.richieste r) EXCEPT SELECT * FROM m24_dati) THEN RAISE EXCEPTION 'Dati modificati'; END IF;
END; $postcheck$;
COMMIT;
