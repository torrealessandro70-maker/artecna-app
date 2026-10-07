-- F3C3 SOLO LOCALE: proiezioni V1; nessun bucket, Storage API, ENV o cleanup.
-- Baseline incorporata F3A Production 17.6. OID/nome dei trigger RI generati
-- dal motore non sono portabili: confrontati vincolo, funzione e stato.
-- ACL legacy immutate: writer senza DML tabella, capability privata mono-uso
-- legata a LOGIN backend, xid8, pid, foto e allegato. Nessuna GUC autorizza.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL idle_in_transaction_session_timeout='30s';
SET LOCAL search_path TO pg_catalog,public;
LOCK TABLE public.cantieri,public.rapportini IN SHARE MODE;
LOCK TABLE artecna_rapportini.allegati,public.foto_cantiere IN ACCESS EXCLUSIVE MODE;
CREATE FUNCTION pg_temp.f3c3_tabella(p_table regclass) RETURNS jsonb LANGUAGE sql SET search_path TO pg_catalog,public AS $catalog$
SELECT jsonb_build_object('owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl::text,
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'position',a.attnum,'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated,'acl',a.attacl::text) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',coalesce((SELECT jsonb_agg(jsonb_build_object('name',k.conname,'type',k.contype,'valid',k.convalidated,'deferrable',k.condeferrable,'deferred',k.condeferred,'definition',pg_get_constraintdef(k.oid,true)) ORDER BY k.conname COLLATE "C") FROM pg_constraint k WHERE k.conrelid=c.oid),'[]'::jsonb),
 'indexes',coalesce((SELECT jsonb_agg(jsonb_build_object('name',x.relname,'valid',i.indisvalid,'ready',i.indisready,'unique',i.indisunique,'primary',i.indisprimary,'definition',pg_get_indexdef(i.indexrelid)) ORDER BY x.relname COLLATE "C") FROM pg_index i JOIN pg_class x ON x.oid=i.indexrelid WHERE i.indrelid=c.oid),'[]'::jsonb),
 'triggers',coalesce((SELECT jsonb_agg(jsonb_build_object('function',p.proname,'constraint',k.conname,'enabled',t.tgenabled,'internal',t.tgisinternal,'deferrable',t.tgdeferrable,'deferred',t.tginitdeferred) ORDER BY k.conname COLLATE "C",p.proname COLLATE "C") FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid LEFT JOIN pg_constraint k ON k.oid=t.tgconstraint WHERE t.tgrelid=c.oid),'[]'::jsonb)) FROM pg_class c WHERE c.oid=p_table AND c.relkind='r';
$catalog$;
CREATE FUNCTION pg_temp.f3c3_storage() RETURNS jsonb LANGUAGE sql SET search_path TO pg_catalog,public AS $storage$
 SELECT jsonb_build_object('schema',(SELECT jsonb_build_object('owner',nspowner,'acl',nspacl::text) FROM pg_namespace WHERE nspname='storage'),
 'tables',(SELECT jsonb_agg(jsonb_build_object('oid',c.oid,'owner',c.relowner,'acl',c.relacl::text,'rls',c.relrowsecurity,'force',c.relforcerowsecurity) ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace=to_regnamespace('storage') AND c.relkind='r'),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace=to_regnamespace('storage')),
 'buckets',(SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.id),'[]'::jsonb) FROM storage.buckets b));
$storage$;
CREATE TEMP TABLE f3c3_state(key text PRIMARY KEY,value jsonb) ON COMMIT DROP;
DO $preflight$
DECLARE e record; p record; actual jsonb;
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'F3C3: installer postgres richiesto'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_foto_v1_writer')
  OR to_regclass('artecna_rapportini.f3c3_capability') IS NOT NULL
  OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace AND (proname LIKE 'f3c3_%' OR proname='crea_proiezione_foto_v1')) THEN
  RAISE EXCEPTION 'F3C3: oggetti già presenti'; END IF;
 FOR e IN SELECT key,value FROM jsonb_each($tables${"public.foto_cantiere":{"owner":"postgres","rls":false,"force_rls":false,"acl":"{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres,artecna_cantieri_delete_rpc=rd/postgres}","columns":[{"name":"id","type":"uuid","position":1,"not_null":true,"default":"uuid_generate_v4()","identity":"","generated":"","acl":null},{"name":"cantiere","type":"text","position":2,"not_null":false,"default":null,"identity":"","generated":"","acl":null},{"name":"nota","type":"text","position":3,"not_null":false,"default":null,"identity":"","generated":"","acl":null},{"name":"immagine_base64","type":"text","position":4,"not_null":false,"default":null,"identity":"","generated":"","acl":null},{"name":"created_at","type":"timestamp without time zone","position":5,"not_null":false,"default":"now()","identity":"","generated":"","acl":null},{"name":"data_foto","type":"text","position":6,"not_null":false,"default":null,"identity":"","generated":"","acl":null},{"name":"geolocalizzazione","type":"text","position":7,"not_null":false,"default":null,"identity":"","generated":"","acl":null},{"name":"categoria","type":"text","position":8,"not_null":false,"default":null,"identity":"","generated":"","acl":null},{"name":"file_url","type":"text","position":9,"not_null":false,"default":null,"identity":"","generated":"","acl":null},{"name":"file_path","type":"text","position":10,"not_null":false,"default":null,"identity":"","generated":"","acl":null},{"name":"thumbnail_url","type":"text","position":11,"not_null":false,"default":null,"identity":"","generated":"","acl":null},{"name":"storage_provider","type":"text","position":12,"not_null":false,"default":"'cloud'::text","identity":"","generated":"","acl":null},{"name":"sync_status","type":"text","position":13,"not_null":false,"default":"'not_required'::text","identity":"","generated":"","acl":null},{"name":"rapportino_id","type":"text","position":14,"not_null":false,"default":null,"identity":"","generated":"","acl":null},{"name":"sopralluogo_id","type":"text","position":15,"not_null":false,"default":null,"identity":"","generated":"","acl":null},{"name":"cantiere_id","type":"uuid","position":16,"not_null":false,"default":null,"identity":"","generated":"","acl":"{artecna_cantieri_delete_rpc=w/postgres}"}],"constraints":[{"name":"foto_cantiere_cantiere_id_fkey","type":"f","valid":true,"deferrable":false,"deferred":false,"definition":"FOREIGN KEY (cantiere_id) REFERENCES cantieri(id)"},{"name":"foto_cantiere_pkey","type":"p","valid":true,"deferrable":false,"deferred":false,"definition":"PRIMARY KEY (id)"}],"indexes":[{"name":"foto_cantiere_pkey","valid":true,"ready":true,"unique":true,"primary":true,"definition":"CREATE UNIQUE INDEX foto_cantiere_pkey ON public.foto_cantiere USING btree (id)"}],"triggers":[{"function":"RI_FKey_noaction_upd","constraint":"allegati_foto_cantiere_id_fkey","enabled":"O","internal":true,"deferrable":false,"deferred":false},{"function":"RI_FKey_restrict_del","constraint":"allegati_foto_cantiere_id_fkey","enabled":"O","internal":true,"deferrable":false,"deferred":false},{"function":"RI_FKey_check_ins","constraint":"foto_cantiere_cantiere_id_fkey","enabled":"O","internal":true,"deferrable":false,"deferred":false},{"function":"RI_FKey_check_upd","constraint":"foto_cantiere_cantiere_id_fkey","enabled":"O","internal":true,"deferrable":false,"deferred":false}]},"artecna_rapportini.allegati":{"owner":"postgres","rls":false,"force_rls":false,"acl":"{postgres=arwdDxtm/postgres}","columns":[{"name":"id","type":"uuid","position":1,"not_null":true,"default":"gen_random_uuid()","identity":"","generated":"","acl":null},{"name":"rapportino_id","type":"uuid","position":2,"not_null":true,"default":null,"identity":"","generated":"","acl":null},{"name":"cantiere_id","type":"uuid","position":3,"not_null":true,"default":null,"identity":"","generated":"","acl":null},{"name":"chiave_client_allegato","type":"uuid","position":4,"not_null":true,"default":null,"identity":"","generated":"","acl":null},{"name":"sha256","type":"bytea","position":5,"not_null":true,"default":null,"identity":"","generated":"","acl":null},{"name":"bucket","type":"text","position":6,"not_null":true,"default":null,"identity":"","generated":"","acl":null},{"name":"file_path","type":"text","position":7,"not_null":true,"default":null,"identity":"","generated":"","acl":null},{"name":"mime_type","type":"text","position":8,"not_null":true,"default":null,"identity":"","generated":"","acl":null},{"name":"byte_size","type":"bigint","position":9,"not_null":true,"default":null,"identity":"","generated":"","acl":null},{"name":"stato","type":"text","position":10,"not_null":true,"default":null,"identity":"","generated":"","acl":null},{"name":"foto_cantiere_id","type":"uuid","position":11,"not_null":false,"default":null,"identity":"","generated":"","acl":null},{"name":"created_at","type":"timestamp with time zone","position":12,"not_null":true,"default":"statement_timestamp()","identity":"","generated":"","acl":null},{"name":"finalized_at","type":"timestamp with time zone","position":13,"not_null":false,"default":null,"identity":"","generated":"","acl":null},{"name":"expires_at","type":"timestamp with time zone","position":14,"not_null":true,"default":null,"identity":"","generated":"","acl":null},{"name":"removed_at","type":"timestamp with time zone","position":15,"not_null":false,"default":null,"identity":"","generated":"","acl":null},{"name":"lease_id","type":"uuid","position":16,"not_null":false,"default":null,"identity":"","generated":"","acl":null},{"name":"lease_until","type":"timestamp with time zone","position":17,"not_null":false,"default":null,"identity":"","generated":"","acl":null}],"constraints":[{"name":"allegati_bucket","type":"c","valid":true,"deferrable":false,"deferred":false,"definition":"CHECK (bucket = 'rapportini-v1'::text)"},{"name":"allegati_cancellato_post_cleanup","type":"c","valid":true,"deferrable":false,"deferred":false,"definition":"CHECK (stato <> 'cancellato'::text OR removed_at IS NOT NULL AND foto_cantiere_id IS NULL AND lease_id IS NULL AND lease_until IS NULL)"},{"name":"allegati_cantiere_id_fkey","type":"f","valid":true,"deferrable":false,"deferred":false,"definition":"FOREIGN KEY (cantiere_id) REFERENCES cantieri(id) ON DELETE RESTRICT"},{"name":"allegati_coerenza","type":"c","valid":true,"deferrable":false,"deferred":false,"definition":"CHECK (stato = 'prenotato'::text AND finalized_at IS NULL AND removed_at IS NULL AND foto_cantiere_id IS NULL OR stato = 'finalizzato'::text AND finalized_at IS NOT NULL AND removed_at IS NULL AND foto_cantiere_id IS NOT NULL OR stato = 'scaduto'::text AND finalized_at IS NULL AND removed_at IS NULL AND foto_cantiere_id IS NULL OR (stato = ANY (ARRAY['cancellazione_pending'::text, 'cancellato'::text])) AND removed_at IS NOT NULL)"},{"name":"allegati_dimensione","type":"c","valid":true,"deferrable":false,"deferred":false,"definition":"CHECK (byte_size >= 1 AND byte_size <= 4000000)"},{"name":"allegati_foto","type":"u","valid":true,"deferrable":false,"deferred":false,"definition":"UNIQUE (foto_cantiere_id)"},{"name":"allegati_foto_cantiere_id_fkey","type":"f","valid":true,"deferrable":false,"deferred":false,"definition":"FOREIGN KEY (foto_cantiere_id) REFERENCES foto_cantiere(id) ON DELETE RESTRICT"},{"name":"allegati_identita","type":"u","valid":true,"deferrable":false,"deferred":false,"definition":"UNIQUE (rapportino_id, chiave_client_allegato)"},{"name":"allegati_lease","type":"c","valid":true,"deferrable":false,"deferred":false,"definition":"CHECK (lease_id IS NULL AND lease_until IS NULL OR lease_id IS NOT NULL AND lease_until IS NOT NULL AND (stato = ANY (ARRAY['prenotato'::text, 'cancellazione_pending'::text])))"},{"name":"allegati_mime","type":"c","valid":true,"deferrable":false,"deferred":false,"definition":"CHECK (mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text]))"},{"name":"allegati_oggetto","type":"u","valid":true,"deferrable":false,"deferred":false,"definition":"UNIQUE (bucket, file_path)"},{"name":"allegati_path","type":"c","valid":true,"deferrable":false,"deferred":false,"definition":"CHECK (btrim(file_path) <> ''::text AND file_path !~~ '/%'::text AND strpos(file_path, '..'::text) = 0 AND file_path ~~ 'rapportini/%'::text AND length(file_path) > 11)"},{"name":"allegati_pkey","type":"p","valid":true,"deferrable":false,"deferred":false,"definition":"PRIMARY KEY (id)"},{"name":"allegati_rapportino_id_fkey","type":"f","valid":true,"deferrable":false,"deferred":false,"definition":"FOREIGN KEY (rapportino_id) REFERENCES rapportini(id) ON DELETE RESTRICT"},{"name":"allegati_sha","type":"c","valid":true,"deferrable":false,"deferred":false,"definition":"CHECK (octet_length(sha256) = 32)"},{"name":"allegati_stato","type":"c","valid":true,"deferrable":false,"deferred":false,"definition":"CHECK (stato = ANY (ARRAY['prenotato'::text, 'finalizzato'::text, 'cancellazione_pending'::text, 'cancellato'::text, 'scaduto'::text]))"}],"indexes":[{"name":"allegati_cantiere","valid":true,"ready":true,"unique":false,"primary":false,"definition":"CREATE INDEX allegati_cantiere ON artecna_rapportini.allegati USING btree (cantiere_id)"},{"name":"allegati_foto","valid":true,"ready":true,"unique":true,"primary":false,"definition":"CREATE UNIQUE INDEX allegati_foto ON artecna_rapportini.allegati USING btree (foto_cantiere_id)"},{"name":"allegati_identita","valid":true,"ready":true,"unique":true,"primary":false,"definition":"CREATE UNIQUE INDEX allegati_identita ON artecna_rapportini.allegati USING btree (rapportino_id, chiave_client_allegato)"},{"name":"allegati_oggetto","valid":true,"ready":true,"unique":true,"primary":false,"definition":"CREATE UNIQUE INDEX allegati_oggetto ON artecna_rapportini.allegati USING btree (bucket, file_path)"},{"name":"allegati_pkey","valid":true,"ready":true,"unique":true,"primary":true,"definition":"CREATE UNIQUE INDEX allegati_pkey ON artecna_rapportini.allegati USING btree (id)"},{"name":"allegati_scadenza","valid":true,"ready":true,"unique":false,"primary":false,"definition":"CREATE INDEX allegati_scadenza ON artecna_rapportini.allegati USING btree (expires_at) WHERE (stato = 'prenotato'::text)"}],"triggers":[{"function":"RI_FKey_check_ins","constraint":"allegati_cantiere_id_fkey","enabled":"O","internal":true,"deferrable":false,"deferred":false},{"function":"RI_FKey_check_upd","constraint":"allegati_cantiere_id_fkey","enabled":"O","internal":true,"deferrable":false,"deferred":false},{"function":"RI_FKey_check_ins","constraint":"allegati_foto_cantiere_id_fkey","enabled":"O","internal":true,"deferrable":false,"deferred":false},{"function":"RI_FKey_check_upd","constraint":"allegati_foto_cantiere_id_fkey","enabled":"O","internal":true,"deferrable":false,"deferred":false},{"function":"RI_FKey_check_ins","constraint":"allegati_rapportino_id_fkey","enabled":"O","internal":true,"deferrable":false,"deferred":false},{"function":"RI_FKey_check_upd","constraint":"allegati_rapportino_id_fkey","enabled":"O","internal":true,"deferrable":false,"deferred":false}]}}$tables$::jsonb)
 LOOP
  actual:=pg_temp.f3c3_tabella(e.key::regclass);
  IF actual IS DISTINCT FROM e.value THEN RAISE EXCEPTION 'F3C3: baseline tabella divergente %',e.key; END IF;
  INSERT INTO f3c3_state VALUES(e.key,actual);
 END LOOP;
 FOR e IN SELECT value FROM jsonb_array_elements($functions$[{"signature":"artecna_rapportini.accesso_allegato_finalizzato(uuid,uuid,uuid,date)","owner":"postgres","definer":true,"volatility":"s","language":"plpgsql","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"defaults":0,"strict":false,"setof":false,"identity":"p_id uuid, p_rapportino uuid, p_cantiere uuid, p_data date","acl":"{postgres=X/postgres}","hash":"5b18982a90d493080fed1b496330b80b48f7ff3853f51e93928f12b2b3ed0d02"},{"signature":"public.cancella_allegato_rapportino_portale(text,uuid)","owner":"postgres","definer":true,"volatility":"v","language":"plpgsql","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"defaults":0,"strict":false,"setof":false,"identity":"p_sessione text, p_allegato_id uuid","acl":"{postgres=X/postgres,artecna_rapportini_backend=X/postgres}","hash":"e42cf72a822d8e066b08db13ade38107d1d06ae3e9d8cad4547e60c596a7f68a"},{"signature":"public.finalizza_allegato_rapportino_portale(text,uuid,uuid)","owner":"postgres","definer":true,"volatility":"v","language":"plpgsql","result":"jsonb","config":["search_path=pg_catalog, pg_temp"],"defaults":0,"strict":false,"setof":false,"identity":"p_sessione text, p_allegato_id uuid, p_lease_id uuid","acl":"{postgres=X/postgres,artecna_rapportini_backend=X/postgres}","hash":"d74ede6c91552f15ff3c5f0d2fbc4c1cd7ff953a19c44dce4b45a52e2b84fdd8"}]$functions$::jsonb)
 LOOP
  SELECT p0.*,l.lanname,pg_get_userbyid(p0.proowner) owner INTO p FROM pg_proc p0 JOIN pg_language l ON l.oid=p0.prolang WHERE p0.oid=to_regprocedure(e.value->>'signature');
  IF NOT FOUND OR p.owner IS DISTINCT FROM e.value->>'owner' OR p.prosecdef IS DISTINCT FROM (e.value->>'definer')::boolean
   OR p.provolatile::text IS DISTINCT FROM e.value->>'volatility' OR p.lanname IS DISTINCT FROM e.value->>'language'
   OR pg_get_function_result(p.oid) IS DISTINCT FROM e.value->>'result' OR to_jsonb(p.proconfig) IS DISTINCT FROM e.value->'config'
   OR p.pronargdefaults IS DISTINCT FROM (e.value->>'defaults')::integer OR p.proisstrict IS DISTINCT FROM (e.value->>'strict')::boolean
   OR p.proretset IS DISTINCT FROM (e.value->>'setof')::boolean OR pg_get_function_identity_arguments(p.oid) IS DISTINCT FROM e.value->>'identity'
   OR p.proacl::text IS DISTINCT FROM e.value->>'acl' OR strpos(replace(p.prosrc,E'\r\n',''),E'\r')>0
   OR encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex') IS DISTINCT FROM e.value->>'hash' THEN
   RAISE EXCEPTION 'F3C3: funzione baseline divergente %',e.value->>'signature'; END IF;
 END LOOP;
 INSERT INTO f3c3_state VALUES('functions',(SELECT jsonb_agg(to_jsonb(snapshot_proc) ORDER BY snapshot_proc.oid) FROM pg_proc snapshot_proc WHERE snapshot_proc.pronamespace='artecna_rapportini'::regnamespace OR snapshot_proc.oid IN ('public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint)'::regprocedure,'public.finalizza_allegato_rapportino_portale(text,uuid,uuid)'::regprocedure,'public.elenca_allegati_rapportino_portale(text,uuid,uuid,date)'::regprocedure,'public.autorizza_accesso_allegato_portale(text,uuid)'::regprocedure,'public.cancella_allegato_rapportino_portale(text,uuid)'::regprocedure)));
 INSERT INTO f3c3_state VALUES('photos',(SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY id),'[]'::jsonb) FROM public.foto_cantiere f));
 INSERT INTO f3c3_state VALUES('allegati',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]'::jsonb) FROM artecna_rapportini.allegati a));
 INSERT INTO f3c3_state VALUES('storage',pg_temp.f3c3_storage());
 INSERT INTO f3c3_state VALUES('schema',(SELECT to_jsonb(n) FROM pg_namespace n WHERE n.oid='artecna_rapportini'::regnamespace));
END;
$preflight$;

ALTER TABLE public.foto_cantiere ADD COLUMN allegato_v1_id uuid;
ALTER TABLE public.foto_cantiere ADD CONSTRAINT foto_cantiere_allegato_v1_key UNIQUE(allegato_v1_id);
ALTER TABLE public.foto_cantiere ADD CONSTRAINT foto_cantiere_allegato_v1_fkey FOREIGN KEY(allegato_v1_id)
 REFERENCES artecna_rapportini.allegati(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE TABLE artecna_rapportini.f3c3_capability(foto_id uuid PRIMARY KEY,allegato_id uuid NOT NULL,
 tx xid8 NOT NULL,backend_pid integer NOT NULL);
REVOKE ALL ON artecna_rapportini.f3c3_capability FROM PUBLIC,anon,authenticated,service_role,artecna_rapportini_backend,artecna_rapportini_rpc;
CREATE FUNCTION artecna_rapportini.f3c3_verifica_proiezione(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE a artecna_rapportini.allegati%ROWTYPE; f public.foto_cantiere%ROWTYPE; r record; c record;
BEGIN
 SELECT * INTO a FROM artecna_rapportini.allegati WHERE id=p_id;
 IF NOT FOUND THEN
  IF EXISTS(SELECT 1 FROM public.foto_cantiere WHERE allegato_v1_id=p_id) THEN
   RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='F3C3: marker orfano'; END IF;
  RETURN;
 END IF;
 IF a.stato IN ('prenotato','scaduto','cancellato') AND a.foto_cantiere_id IS NOT NULL
  OR a.stato='finalizzato' AND (a.foto_cantiere_id IS NULL OR a.finalized_at IS NULL)
  OR a.stato='cancellazione_pending' AND ((a.foto_cantiere_id IS NULL)<>(a.finalized_at IS NULL)) THEN
  RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='F3C3: stato/proiezione incoerente'; END IF;
 IF a.foto_cantiere_id IS NULL THEN
  IF EXISTS(SELECT 1 FROM public.foto_cantiere WHERE allegato_v1_id=a.id) THEN
   RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='F3C3: proiezione inattesa'; END IF;
  RETURN;
 END IF;
 SELECT id,cantiere_id,data INTO r FROM public.rapportini WHERE id=a.rapportino_id;
 IF NOT FOUND OR r.cantiere_id IS DISTINCT FROM a.cantiere_id OR r.data IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='F3C3: contesto rapporto incoerente'; END IF;
 SELECT nome INTO c FROM public.cantieri WHERE id=a.cantiere_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='F3C3: cantiere assente'; END IF;
 SELECT * INTO f FROM public.foto_cantiere WHERE id=a.foto_cantiere_id;
 IF NOT FOUND OR f.allegato_v1_id IS DISTINCT FROM a.id
  OR f.cantiere_id IS DISTINCT FROM a.cantiere_id OR f.rapportino_id IS DISTINCT FROM a.rapportino_id::text
  OR f.cantiere IS DISTINCT FROM c.nome OR f.data_foto IS DISTINCT FROM r.data::text
  OR f.categoria IS DISTINCT FROM 'rapportino' OR f.nota IS DISTINCT FROM ''
  OR f.file_url IS NOT NULL OR f.file_path IS NOT NULL OR f.thumbnail_url IS NOT NULL
  OR f.immagine_base64 IS DISTINCT FROM '' OR f.storage_provider IS DISTINCT FROM 'cloud'
  OR f.sync_status IS DISTINCT FROM 'not_required' OR f.sopralluogo_id IS NOT NULL
  OR f.geolocalizzazione IS NOT NULL THEN
  RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='F3C3: reciprocità/proiezione incoerente'; END IF;
END;
$fn$;
-- Zero collegamenti: UPDATE zero righe, nessuna classificazione euristica V0.
UPDATE public.foto_cantiere f SET allegato_v1_id=a.id FROM artecna_rapportini.allegati a WHERE a.foto_cantiere_id=f.id;
DO $backfill$
DECLARE v_row record;
BEGIN
 FOR v_row IN SELECT id FROM artecna_rapportini.allegati LOOP PERFORM artecna_rapportini.f3c3_verifica_proiezione(v_row.id); END LOOP;
 IF EXISTS(SELECT 1 FROM public.foto_cantiere f WHERE f.allegato_v1_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM artecna_rapportini.allegati a WHERE a.id=f.allegato_v1_id AND a.foto_cantiere_id=f.id)) THEN RAISE EXCEPTION 'F3C3: backfill ambiguo'; END IF;
END;
$backfill$;
CREATE ROLE artecna_foto_v1_writer NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA artecna_rapportini TO artecna_foto_v1_writer;
CREATE FUNCTION artecna_rapportini.f3c3_inserisci_proiezione(p_id uuid,p_lease uuid) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE a artecna_rapportini.allegati%ROWTYPE; r record; v_nome text; v_foto uuid;
BEGIN
 IF session_user<>'artecna_rapportini_backend' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='F3C3: writer riservato'; END IF;
 SELECT * INTO a FROM artecna_rapportini.allegati WHERE id=p_id;
 IF NOT FOUND OR a.stato<>'prenotato' OR a.foto_cantiere_id IS NOT NULL
  OR p_lease IS NULL OR a.lease_id IS DISTINCT FROM p_lease
  OR a.lease_until IS NULL OR a.lease_until<=statement_timestamp() OR a.expires_at<=statement_timestamp() THEN
  RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Tentativo allegato non valido'; END IF;
 SELECT id,cantiere_id,data,versione_prestazioni INTO r FROM public.rapportini WHERE id=a.rapportino_id;
 IF NOT FOUND OR r.cantiere_id IS DISTINCT FROM a.cantiere_id OR r.data IS NULL OR r.versione_prestazioni IS DISTINCT FROM 1 THEN
  RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='F3C3: contesto writer incoerente'; END IF;
 SELECT nome INTO v_nome FROM public.cantieri WHERE id=a.cantiere_id AND lavori_conclusi IS DISTINCT FROM true;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito'; END IF;
 v_foto:=gen_random_uuid();
 INSERT INTO artecna_rapportini.f3c3_capability(foto_id,allegato_id,tx,backend_pid)
 VALUES(v_foto,a.id,pg_current_xact_id(),pg_backend_pid());
 INSERT INTO public.foto_cantiere(id,cantiere_id,cantiere,rapportino_id,categoria,data_foto,nota,
  file_url,file_path,immagine_base64,thumbnail_url,storage_provider,sync_status,allegato_v1_id)
 VALUES(v_foto,r.cantiere_id,v_nome,r.id::text,'rapportino',r.data,'',NULL,NULL,'',NULL,'cloud','not_required',a.id);
 IF EXISTS(SELECT 1 FROM artecna_rapportini.f3c3_capability WHERE foto_id=v_foto) THEN
  RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='F3C3: capability non consumata'; END IF;
 RETURN v_foto;
END;
$fn$;
CREATE FUNCTION artecna_rapportini.crea_proiezione_foto_v1(p_id uuid,p_lease uuid) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
BEGIN
 IF session_user<>'artecna_rapportini_backend' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='F3C3: writer riservato'; END IF;
 RETURN artecna_rapportini.f3c3_inserisci_proiezione(p_id,p_lease);
END;
$fn$;
CREATE FUNCTION artecna_rapportini.f3c3_guardia_foto() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE protetta boolean; consumed uuid;
BEGIN
 IF TG_OP='INSERT' THEN
  protetta:=NEW.allegato_v1_id IS NOT NULL OR EXISTS(SELECT 1 FROM artecna_rapportini.allegati WHERE foto_cantiere_id=NEW.id);
  IF protetta THEN
   IF session_user<>'artecna_rapportini_backend' OR NEW.allegato_v1_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='F3C3: proiezione V1 protetta'; END IF;
   DELETE FROM artecna_rapportini.f3c3_capability WHERE foto_id=NEW.id AND allegato_id=NEW.allegato_v1_id
    AND tx=pg_current_xact_id() AND backend_pid=pg_backend_pid() RETURNING foto_id INTO consumed;
   IF consumed IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='F3C3: proiezione V1 protetta'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 protetta:=OLD.allegato_v1_id IS NOT NULL OR EXISTS(SELECT 1 FROM artecna_rapportini.allegati WHERE foto_cantiere_id=OLD.id);
 IF TG_OP='UPDATE' THEN
  protetta:=protetta OR NEW.allegato_v1_id IS NOT NULL OR EXISTS(SELECT 1 FROM artecna_rapportini.allegati WHERE foto_cantiere_id=NEW.id);
 END IF;
 IF protetta THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='F3C3: proiezione V1 protetta'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$fn$;
CREATE FUNCTION artecna_rapportini.f3c3_guardia_truncate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM public.foto_cantiere WHERE allegato_v1_id IS NOT NULL)
  OR EXISTS(SELECT 1 FROM artecna_rapportini.allegati WHERE foto_cantiere_id IS NOT NULL) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='F3C3: TRUNCATE con proiezioni V1 negato'; END IF;
 RETURN NULL;
END;
$fn$;
CREATE FUNCTION artecna_rapportini.f3c3_reciprocita() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE v_id uuid;
BEGIN
 IF TG_TABLE_SCHEMA='artecna_rapportini' THEN
  IF TG_OP<>'INSERT' THEN PERFORM artecna_rapportini.f3c3_verifica_proiezione(OLD.id); END IF;
  IF TG_OP<>'DELETE' THEN PERFORM artecna_rapportini.f3c3_verifica_proiezione(NEW.id); END IF;
 ELSE
  IF TG_OP<>'INSERT' AND OLD.allegato_v1_id IS NOT NULL THEN PERFORM artecna_rapportini.f3c3_verifica_proiezione(OLD.allegato_v1_id); END IF;
  IF TG_OP<>'DELETE' AND NEW.allegato_v1_id IS NOT NULL THEN PERFORM artecna_rapportini.f3c3_verifica_proiezione(NEW.allegato_v1_id); END IF;
  FOR v_id IN SELECT id FROM artecna_rapportini.allegati WHERE foto_cantiere_id=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END
  LOOP PERFORM artecna_rapportini.f3c3_verifica_proiezione(v_id); END LOOP;
 END IF;
 RETURN NULL;
END;
$fn$;
CREATE TRIGGER f3c3_foto_dml BEFORE INSERT OR UPDATE OR DELETE ON public.foto_cantiere
 FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.f3c3_guardia_foto();
CREATE TRIGGER f3c3_foto_truncate BEFORE TRUNCATE ON public.foto_cantiere
 FOR EACH STATEMENT EXECUTE FUNCTION artecna_rapportini.f3c3_guardia_truncate();
CREATE CONSTRAINT TRIGGER f3c3_foto_reciprocita AFTER INSERT OR UPDATE OR DELETE ON public.foto_cantiere
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.f3c3_reciprocita();
CREATE CONSTRAINT TRIGGER f3c3_allegati_reciprocita AFTER INSERT OR UPDATE OR DELETE ON artecna_rapportini.allegati
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.f3c3_reciprocita();
-- Neutralizza anche default privileges ostili: solo owner inizialmente.
DO $new_acl$
DECLARE p record; a record;
BEGIN
 FOR p IN SELECT oid,proowner FROM pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace AND (proname LIKE 'f3c3_%' OR proname='crea_proiezione_foto_v1') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',p.oid::regprocedure);
  FOR a IN SELECT DISTINCT grantee FROM aclexplode(coalesce((SELECT proacl FROM pg_proc WHERE oid=p.oid),acldefault('f',p.proowner))) WHERE grantee<>p.proowner AND grantee<>0 LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',p.oid::regprocedure,pg_get_userbyid(a.grantee));
  END LOOP;
 END LOOP;
 -- Neutralizza tutti i default sulla tabella privata, non soltanto ruoli noti.
 FOR a IN SELECT DISTINCT grantee FROM aclexplode((SELECT relacl FROM pg_class WHERE oid='artecna_rapportini.f3c3_capability'::regclass)) WHERE grantee<>'postgres'::regrole AND grantee<>0 LOOP
  EXECUTE format('REVOKE ALL ON artecna_rapportini.f3c3_capability FROM %I',pg_get_userbyid(a.grantee));
 END LOOP;
END;
$new_acl$;
GRANT EXECUTE ON FUNCTION artecna_rapportini.f3c3_inserisci_proiezione(uuid,uuid) TO artecna_foto_v1_writer;
-- Trasferimento owner con soli permessi installer temporanei, PostgreSQL 17.
GRANT CREATE ON SCHEMA artecna_rapportini TO artecna_foto_v1_writer;
DO $installer$
BEGIN
 IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) THEN
  GRANT artecna_foto_v1_writer TO postgres WITH INHERIT FALSE GRANTED BY postgres;
  GRANT artecna_foto_v1_writer TO postgres WITH SET TRUE GRANTED BY postgres;
 END IF;
END;
$installer$;
ALTER FUNCTION artecna_rapportini.crea_proiezione_foto_v1(uuid,uuid) OWNER TO artecna_foto_v1_writer;
SET LOCAL ROLE artecna_foto_v1_writer;
GRANT EXECUTE ON FUNCTION artecna_rapportini.crea_proiezione_foto_v1(uuid,uuid) TO postgres;
RESET ROLE;
REVOKE CREATE ON SCHEMA artecna_rapportini FROM artecna_foto_v1_writer;
DO $restore_installer$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='artecna_foto_v1_writer'::regrole AND member='postgres'::regrole AND grantor='postgres'::regrole) THEN
  REVOKE artecna_foto_v1_writer FROM postgres GRANTED BY postgres RESTRICT;
 END IF;
END;
$restore_installer$;

DO $replace_functions$
DECLARE definition text; old text;
BEGIN
 definition:=replace(pg_get_functiondef('public.finalizza_allegato_rapportino_portale(text,uuid,uuid)'::regprocedure),E'\r\n',E'\n');
 old:=$old_insert$      v_foto:=pg_catalog.gen_random_uuid();
      INSERT INTO public.foto_cantiere(id,cantiere_id,cantiere,rapportino_id,categoria,data_foto,nota,
        file_url,file_path,immagine_base64,thumbnail_url,storage_provider,sync_status)
      VALUES(v_foto,r.cantiere_id,v_nome,r.id::text,'rapportino',r.data,'',NULL,NULL,'',NULL,'cloud','not_required');$old_insert$;
 old:=replace(old,E'\r\n',E'\n');
 IF strpos(definition,old)=0 THEN RAISE EXCEPTION 'F3C3: costruzione storica assente'; END IF;
 definition:=replace(definition,old,'      v_foto:=artecna_rapportini.crea_proiezione_foto_v1(a.id,p_lease_id);');
 definition:=replace(definition,'IF NOT FOUND OR f.cantiere_id','IF NOT FOUND OR f.allegato_v1_id IS DISTINCT FROM a.id OR f.cantiere_id');
 EXECUTE definition;
 definition:=replace(pg_get_functiondef('artecna_rapportini.accesso_allegato_finalizzato(uuid,uuid,uuid,date)'::regprocedure),E'\r\n',E'\n');
 definition:=replace(definition,'SELECT cantiere_id,rapportino_id,categoria','SELECT allegato_v1_id,cantiere_id,rapportino_id,categoria');
 definition:=replace(definition,'IF NOT FOUND OR f.cantiere_id','IF NOT FOUND OR f.allegato_v1_id IS DISTINCT FROM a.id OR f.cantiere_id');
 EXECUTE definition;
END;
$replace_functions$;
SET CONSTRAINTS ALL IMMEDIATE;
-- F3C3_POSTCHECK: punto di iniezione guasti solo nei test isolati.
DO $postcheck$
DECLARE e record; p record; actual jsonb; before jsonb; v_id uuid; v_role text;
BEGIN
 FOR e IN SELECT key,value FROM f3c3_state WHERE key IN ('public.foto_cantiere','artecna_rapportini.allegati') LOOP
  actual:=pg_temp.f3c3_tabella(e.key::regclass);
  IF actual->'owner' IS DISTINCT FROM e.value->'owner' OR actual->'rls' IS DISTINCT FROM e.value->'rls'
   OR actual->'force_rls' IS DISTINCT FROM e.value->'force_rls' OR actual->'acl' IS DISTINCT FROM e.value->'acl' THEN RAISE EXCEPTION 'F3C3: owner/ACL/RLS cambiati'; END IF;
  IF e.key='public.foto_cantiere' THEN
   IF (SELECT jsonb_agg(x ORDER BY (x->>'position')::integer) FROM jsonb_array_elements(actual->'columns') x WHERE x->>'name'<>'allegato_v1_id') IS DISTINCT FROM e.value->'columns'
    OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.foto_cantiere'::regclass AND attname='allegato_v1_id' AND atttypid='uuid'::regtype AND NOT attnotnull AND attacl IS NULL AND NOT atthasdef AND attnum=17)
    OR jsonb_array_length(actual->'columns')<>17 THEN RAISE EXCEPTION 'F3C3: colonne cambiate'; END IF;
   IF (SELECT jsonb_agg(x ORDER BY x->>'name' COLLATE "C") FROM jsonb_array_elements(actual->'constraints') x WHERE x->>'name' NOT IN ('foto_cantiere_allegato_v1_key','foto_cantiere_allegato_v1_fkey','f3c3_foto_reciprocita')) IS DISTINCT FROM e.value->'constraints'
    OR (SELECT jsonb_agg(x ORDER BY x->>'name' COLLATE "C") FROM jsonb_array_elements(actual->'indexes') x WHERE x->>'name'<>'foto_cantiere_allegato_v1_key') IS DISTINCT FROM e.value->'indexes' THEN RAISE EXCEPTION 'F3C3: vincoli/indici legacy cambiati'; END IF;
  ELSE
   IF actual->'columns' IS DISTINCT FROM e.value->'columns' OR (SELECT jsonb_agg(x ORDER BY x->>'name' COLLATE "C") FROM jsonb_array_elements(actual->'constraints') x WHERE x->>'name'<>'f3c3_allegati_reciprocita') IS DISTINCT FROM e.value->'constraints' OR actual->'indexes' IS DISTINCT FROM e.value->'indexes' THEN RAISE EXCEPTION 'F3C3: registro cambiato'; END IF;
  END IF;
  IF (SELECT jsonb_agg(x ORDER BY x->>'constraint' COLLATE "C",x->>'function' COLLATE "C") FROM jsonb_array_elements(actual->'triggers') x WHERE (x->>'internal')::boolean AND x->>'constraint'<>'foto_cantiere_allegato_v1_fkey') IS DISTINCT FROM e.value->'triggers' THEN RAISE EXCEPTION 'F3C3: trigger RI cambiati'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.foto_cantiere'::regclass AND conname='foto_cantiere_allegato_v1_fkey' AND contype='f' AND convalidated AND confrelid='artecna_rapportini.allegati'::regclass AND confdeltype='r' AND confupdtype='a' AND conkey=ARRAY[17]::smallint[] AND confkey=ARRAY[1]::smallint[] AND NOT condeferrable)
  OR NOT EXISTS(SELECT 1 FROM pg_constraint k JOIN pg_index i ON i.indexrelid=k.conindid WHERE k.conrelid='public.foto_cantiere'::regclass AND k.conname='foto_cantiere_allegato_v1_key' AND k.contype='u' AND k.conkey=ARRAY[17]::smallint[] AND k.convalidated AND i.indisvalid AND i.indisready AND i.indisunique) THEN RAISE EXCEPTION 'F3C3: FK/UNIQUE invalidi'; END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid IN ('public.foto_cantiere'::regclass,'artecna_rapportini.allegati'::regclass) AND NOT tgisinternal AND tgname LIKE 'f3c3_%' AND tgenabled='O')<>4
  OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid IN ('public.foto_cantiere'::regclass,'artecna_rapportini.allegati'::regclass) AND NOT tgisinternal AND tgname NOT LIKE 'f3c3_%')
  OR (SELECT count(*) FROM pg_trigger WHERE tgname IN ('f3c3_foto_reciprocita','f3c3_allegati_reciprocita') AND tgrelid IN ('public.foto_cantiere'::regclass,'artecna_rapportini.allegati'::regclass) AND tgdeferrable AND tginitdeferred)<>2
  OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.foto_cantiere'::regclass AND tgname='f3c3_foto_dml' AND tgtype=31 AND tgfoid='artecna_rapportini.f3c3_guardia_foto()'::regprocedure AND NOT tgdeferrable)
  OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.foto_cantiere'::regclass AND tgname='f3c3_foto_truncate' AND tgtype=34 AND tgfoid='artecna_rapportini.f3c3_guardia_truncate()'::regprocedure AND NOT tgdeferrable)
  OR (SELECT count(*) FROM pg_trigger WHERE (tgrelid='public.foto_cantiere'::regclass AND tgname='f3c3_foto_reciprocita' OR tgrelid='artecna_rapportini.allegati'::regclass AND tgname='f3c3_allegati_reciprocita') AND tgtype=29 AND tgfoid='artecna_rapportini.f3c3_reciprocita()'::regprocedure AND tgdeferrable AND tginitdeferred)<>2 THEN RAISE EXCEPTION 'F3C3: guardie inattese'; END IF;
 FOR v_id IN SELECT id FROM artecna_rapportini.allegati LOOP PERFORM artecna_rapportini.f3c3_verifica_proiezione(v_id); END LOOP;
 IF (SELECT coalesce(jsonb_agg(to_jsonb(f)-'allegato_v1_id' ORDER BY id),'[]'::jsonb) FROM public.foto_cantiere f) IS DISTINCT FROM (SELECT value FROM f3c3_state WHERE key='photos')
  OR (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]'::jsonb) FROM artecna_rapportini.allegati a) IS DISTINCT FROM (SELECT value FROM f3c3_state WHERE key='allegati') THEN RAISE EXCEPTION 'F3C3: dati preesistenti cambiati'; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements((SELECT value FROM f3c3_state WHERE key='functions')) LOOP
  SELECT to_jsonb(p0) INTO actual FROM pg_proc p0 WHERE p0.oid=(e.value->>'oid')::oid;
  IF (e.value->>'oid')::oid IN ('public.finalizza_allegato_rapportino_portale(text,uuid,uuid)'::regprocedure,'artecna_rapportini.accesso_allegato_finalizzato(uuid,uuid,uuid,date)'::regprocedure) THEN
   IF actual-'prosrc' IS DISTINCT FROM e.value-'prosrc' THEN RAISE EXCEPTION 'F3C3: metadata/ACL RPC cambiati'; END IF;
  ELSIF actual IS DISTINCT FROM e.value THEN RAISE EXCEPTION 'F3C3: altra RPC cambiata'; END IF;
 END LOOP;
 FOR e IN SELECT key,value FROM jsonb_each($hashes${"public.finalizza_allegato_rapportino_portale(text,uuid,uuid)":"fbd491fe3adb0d7ac680ed8364fba041dafdf4b96bade7760b827fafb46c58c1","artecna_rapportini.accesso_allegato_finalizzato(uuid,uuid,uuid,date)":"627df2345e6e7e3c5e11bf8eb4f908cfdaaecdcc1c36b98869cab653b3c94b1b"}$hashes$::jsonb) LOOP
  IF (SELECT encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') FROM pg_proc WHERE oid=e.key::regprocedure) IS DISTINCT FROM e.value#>>'{}' THEN RAISE EXCEPTION 'F3C3: fingerprint finale errata'; END IF;
 END LOOP;
 -- PG17 CREATEROLE crea il grant ADMIN provider al creatore: non conferisce
 -- SET/INHERIT. Si ammette solo postgres amministratore, nessun client.
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE member='artecna_foto_v1_writer'::regrole OR roleid='artecna_foto_v1_writer'::regrole AND NOT (member='postgres'::regrole AND admin_option AND NOT inherit_option AND NOT set_option AND grantor<>'postgres'::regrole))
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_foto_v1_writer' AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication)
  OR has_schema_privilege('artecna_foto_v1_writer','artecna_rapportini','CREATE') THEN RAISE EXCEPTION 'F3C3: ruolo writer non minimo'; END IF;
 FOR p IN SELECT oid,proname,proowner,proacl,prosecdef,proconfig FROM pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace AND (proname LIKE 'f3c3_%' OR proname='crea_proiezione_foto_v1') LOOP
  IF p.proowner IS DISTINCT FROM (CASE WHEN p.proname='crea_proiezione_foto_v1' THEN 'artecna_foto_v1_writer'::regrole ELSE 'postgres'::regrole END) THEN RAISE EXCEPTION 'F3C3: owner helper inatteso'; END IF;
  IF NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] THEN RAISE EXCEPTION 'F3C3: metadata helper'; END IF;
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role','artecna_rapportini_backend','artecna_rapportini_rpc'] LOOP
   IF has_function_privilege(v_role,p.oid,'EXECUTE') THEN RAISE EXCEPTION 'F3C3: helper eseguibile da client'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 OR a.is_grantable OR a.privilege_type<>'EXECUTE' OR a.grantee NOT IN ('postgres'::regrole,'artecna_foto_v1_writer'::regrole)) THEN RAISE EXCEPTION 'F3C3: ACL helper inattesa'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace AND (proname LIKE 'f3c3_%' OR proname='crea_proiezione_foto_v1'))<>6 THEN RAISE EXCEPTION 'F3C3: inventario helper inatteso'; END IF;
 FOR e IN SELECT key,value FROM jsonb_each($helper_hashes${"f3c3_verifica_proiezione":"0d889a9545f5534e78cfd6b3c31d954cce2b4f2dc80032504d18852a484dc534","f3c3_inserisci_proiezione":"eef2c8f726b8b0b8524a26ec69d22f8945fb6c9f9007955ccfa7a19e9ab44d5f","crea_proiezione_foto_v1":"df599076db8cd64324b4eed2e0190135e9613476d5277ab152ee188fc940c33a","f3c3_guardia_foto":"f1f27e8730f68998a7cb8c06671da99ad3a07fb60c356b1604dd3dca7dcf062a","f3c3_guardia_truncate":"8fcac4dbddaa4d7bcf3e851451f1dddd6ba77b4d0a6759dc5a250bb155273dc4","f3c3_reciprocita":"6b91320eb49ce37380c3e5815b666fb6e0f25a39fbea86e8841e7a90ad288791"}$helper_hashes$::jsonb) LOOP
  IF (SELECT encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') FROM pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace AND proname=e.key) IS DISTINCT FROM e.value#>>'{}' THEN RAISE EXCEPTION 'F3C3: fingerprint helper errata'; END IF;
 END LOOP;
 SELECT to_jsonb(n) INTO actual FROM pg_namespace n WHERE oid='artecna_rapportini'::regnamespace;
 before:=(SELECT value FROM f3c3_state WHERE key='schema');
 IF actual-'nspacl' IS DISTINCT FROM before-'nspacl'
  OR (SELECT to_jsonb(array_agg(a ORDER BY ordinality)) FROM pg_namespace n CROSS JOIN LATERAL unnest(n.nspacl) WITH ORDINALITY acl(a,ordinality) WHERE n.oid='artecna_rapportini'::regnamespace AND split_part(a::text,'=',1)<>'artecna_foto_v1_writer') IS DISTINCT FROM before->'nspacl'
  OR NOT has_schema_privilege('artecna_foto_v1_writer','artecna_rapportini','USAGE') THEN RAISE EXCEPTION 'F3C3: ACL schema legacy cambiata'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='artecna_rapportini.crea_proiezione_foto_v1(uuid,uuid)'::regprocedure AND proowner='artecna_foto_v1_writer'::regrole)
  OR NOT has_function_privilege('artecna_foto_v1_writer','artecna_rapportini.f3c3_inserisci_proiezione(uuid,uuid)','EXECUTE')
  OR has_table_privilege('artecna_foto_v1_writer','public.foto_cantiere','INSERT,UPDATE,DELETE,TRUNCATE')
  OR has_any_column_privilege('artecna_foto_v1_writer','public.foto_cantiere','INSERT,UPDATE') THEN RAISE EXCEPTION 'F3C3: capability writer inattesa'; END IF;
 IF EXISTS(SELECT 1 FROM artecna_rapportini.f3c3_capability)
  OR EXISTS(SELECT 1 FROM aclexplode((SELECT relacl FROM pg_class WHERE oid='artecna_rapportini.f3c3_capability'::regclass)) a WHERE a.grantee<>'postgres'::regrole) THEN RAISE EXCEPTION 'F3C3: capability non privata/vuota'; END IF;
 IF pg_temp.f3c3_storage() IS DISTINCT FROM (SELECT value FROM f3c3_state WHERE key='storage') THEN RAISE EXCEPTION 'F3C3: Storage cambiato'; END IF;
END;
$postcheck$;
DROP FUNCTION pg_temp.f3c3_tabella(regclass);
DROP FUNCTION pg_temp.f3c3_storage();
COMMIT;
