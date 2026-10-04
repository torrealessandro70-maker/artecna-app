-- Allegati 3C: solo letture snapshot. NON applicata al remoto.
BEGIN;
DO $preflight$
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'Installazione riservata a postgres'; END IF;
  IF pg_catalog.to_regprocedure('public.elenca_allegati_rapportino_portale(text,uuid,uuid,date)') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.autorizza_accesso_allegato_portale(text,uuid)') IS NOT NULL
    OR pg_catalog.to_regprocedure('artecna_rapportini.accesso_allegato_finalizzato(uuid,uuid,uuid,date)') IS NOT NULL THEN
    RAISE EXCEPTION 'Lettura allegati già presente';
  END IF;
  PERFORM pg_catalog.set_config('artecna_lettura_allegati.rpc_baseline',(
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('oid',p.oid,'def',pg_catalog.pg_get_functiondef(p.oid),
      'owner',p.proowner,'acl',p.proacl::text) ORDER BY p.oid)::text FROM pg_catalog.pg_proc p
    WHERE p.pronamespace='artecna_rapportini'::regnamespace OR p.oid IN (
      'public.crea_sessione_rapportino(text,text)'::regprocedure,'public.verifica_sessione_rapportino(text,uuid)'::regprocedure,
      'public.varianti_rapportino_portale(text,uuid)'::regprocedure,'public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure,
      'public.leggi_rapportino_portale(text,uuid,date,uuid)'::regprocedure,
      'public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint)'::regprocedure,
      'public.finalizza_allegato_rapportino_portale(text,uuid,uuid)'::regprocedure)),true);
END;
$preflight$;

-- Comune alle due letture; eseguibile solo dall'owner tramite RPC controllate.
CREATE FUNCTION artecna_rapportini.accesso_allegato_finalizzato(p_id uuid,p_rapportino uuid,p_cantiere uuid,p_data date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE a record; f record; v_ext text; v_path text;
BEGIN
  SELECT id,rapportino_id,cantiere_id,chiave_client_allegato,stato,bucket,file_path,mime_type,byte_size,
    finalized_at,foto_cantiere_id,removed_at,lease_id,lease_until INTO a FROM artecna_rapportini.allegati WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Allegato non disponibile'; END IF;
  IF a.rapportino_id IS DISTINCT FROM p_rapportino OR a.cantiere_id IS DISTINCT FROM p_cantiere THEN
    RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Contesto allegato non valido';
  END IF;
  IF a.stato IN ('prenotato','scaduto','cancellazione_pending','cancellato') THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Allegato non disponibile';
  END IF;
  IF a.stato IS DISTINCT FROM 'finalizzato' OR a.finalized_at IS NULL OR a.foto_cantiere_id IS NULL
    OR a.removed_at IS NOT NULL OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL
    OR a.chiave_client_allegato IS NULL OR a.byte_size IS NULL OR a.byte_size NOT BETWEEN 1 AND 4000000 THEN
    RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
  END IF;
  v_ext:=CASE a.mime_type WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' END;
  v_path:='rapportini/'||p_cantiere::text||'/'||p_rapportino::text||'/'||a.chiave_client_allegato::text||'.'||v_ext;
  IF v_ext IS NULL OR a.bucket IS DISTINCT FROM 'rapportini-v1' OR a.file_path IS DISTINCT FROM v_path THEN
    RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Oggetto allegato non valido';
  END IF;
  SELECT cantiere_id,rapportino_id,categoria,data_foto,file_url,file_path,immagine_base64,thumbnail_url,
    storage_provider,sync_status INTO f FROM public.foto_cantiere WHERE id=a.foto_cantiere_id;
  IF NOT FOUND OR f.cantiere_id IS DISTINCT FROM p_cantiere OR f.rapportino_id IS DISTINCT FROM p_rapportino::text
    OR f.categoria IS DISTINCT FROM 'rapportino' OR f.data_foto::text IS DISTINCT FROM p_data::text
    OR f.file_url IS NOT NULL OR f.file_path IS NOT NULL OR f.immagine_base64 IS DISTINCT FROM ''
    OR f.thumbnail_url IS NOT NULL OR f.storage_provider IS DISTINCT FROM 'cloud' OR f.sync_status IS DISTINCT FROM 'not_required' THEN
    RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Proiezione allegato non valida';
  END IF;
  -- Solo server: non è il DTO browser AutorizzazioneAccessoAllegato (URL futuro).
  RETURN pg_catalog.jsonb_build_object('versione_contratto',1,'allegato_id',a.id,'bucket',a.bucket,
    'file_path',a.file_path,'mime_type',a.mime_type,'byte_size',a.byte_size);
END;
$fn$;

CREATE FUNCTION public.elenca_allegati_rapportino_portale(p_sessione text,p_rapportino_id uuid,p_cantiere_id uuid,p_data date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE r record; a record; v_allegati jsonb := '[]'::jsonb;
BEGIN
  IF session_user<>'artecna_rapportini_backend' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso Rapportini non consentito'; END IF;
  IF p_rapportino_id IS NULL OR p_cantiere_id IS NULL OR p_data IS NULL OR NOT pg_catalog.isfinite(p_data)
    OR p_data<DATE '0001-01-01' OR p_data>DATE '9999-12-31' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Contesto Rapportino non valido';
  END IF;
  PERFORM artecna_rapportini.autorizza_lettura_portale(p_sessione,p_cantiere_id);
  SELECT cantiere_id,data,versione_prestazioni INTO r FROM public.rapportini WHERE id=p_rapportino_id;
  IF NOT FOUND OR r.cantiere_id IS DISTINCT FROM p_cantiere_id OR r.data IS DISTINCT FROM p_data THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto Rapportino incoerente';
  END IF;
  IF r.versione_prestazioni IS DISTINCT FROM 1 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione Rapportino non supportata'; END IF;
  -- Contratto pubblico ElencoAllegati: solo finalizzati, nessuno stato UI aggiuntivo.
  FOR a IN SELECT id,chiave_client_allegato,mime_type,byte_size FROM artecna_rapportini.allegati
    WHERE rapportino_id=p_rapportino_id AND stato='finalizzato' ORDER BY created_at,id LOOP
    PERFORM artecna_rapportini.accesso_allegato_finalizzato(a.id,p_rapportino_id,p_cantiere_id,p_data);
    v_allegati:=v_allegati||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('allegato_id',a.id,
      'chiave_client_allegato',a.chiave_client_allegato,'stato','finalizzato','mime_type',a.mime_type,'byte_size',a.byte_size));
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('versione_contratto',1,'rapportino_id',p_rapportino_id,'allegati',v_allegati);
END;
$fn$;

CREATE FUNCTION public.autorizza_accesso_allegato_portale(p_sessione text,p_allegato_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE a record; r record; abilitato boolean; stato_operaio text;
BEGIN
  IF session_user<>'artecna_rapportini_backend' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso Rapportini non consentito'; END IF;
  IF p_sessione IS NULL OR p_sessione !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Sessione portale non valida'; END IF;
  -- Stessa semantica PIN di 3A/3B, verificata prima di cercare un allegato.
  SELECT o.accesso_portale,o.stato INTO abilitato,stato_operaio FROM artecna_rapportini.sessioni_portale s
    JOIN public.operai o ON o.id=s.operaio_id WHERE s.token_sha256=pg_catalog.sha256(pg_catalog.convert_to(p_sessione,'UTF8'))
    AND s.revocata_at IS NULL AND s.scade_at>pg_catalog.statement_timestamp();
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Sessione portale assente, scaduta o revocata'; END IF;
  IF abilitato IS DISTINCT FROM true OR stato_operaio='sospeso' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso Rapportini non consentito'; END IF;
  IF p_allegato_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Allegato non valido'; END IF;
  SELECT rapportino_id,cantiere_id INTO a FROM artecna_rapportini.allegati WHERE id=p_allegato_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Allegato non disponibile'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cantieri WHERE id=a.cantiere_id AND lavori_conclusi IS DISTINCT FROM true) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito';
  END IF;
  SELECT cantiere_id,data,versione_prestazioni INTO r FROM public.rapportini WHERE id=a.rapportino_id;
  IF NOT FOUND OR r.cantiere_id IS DISTINCT FROM a.cantiere_id OR r.data IS NULL OR NOT pg_catalog.isfinite(r.data) THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto Rapportino incoerente';
  END IF;
  IF r.versione_prestazioni IS DISTINCT FROM 1 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione Rapportino non supportata'; END IF;
  RETURN artecna_rapportini.accesso_allegato_finalizzato(p_allegato_id,a.rapportino_id,a.cantiere_id,r.data);
END;
$fn$;

DO $acl$
DECLARE f oid; r record;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.elenca_allegati_rapportino_portale(text,uuid,uuid,date)'::regprocedure,
    'public.autorizza_accesso_allegato_portale(text,uuid)'::regprocedure,
    'artecna_rapportini.accesso_allegato_finalizzato(uuid,uuid,uuid,date)'::regprocedure] LOOP
    EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f::regprocedure);
    FOR r IN SELECT DISTINCT roles.rolname FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) a
      JOIN pg_catalog.pg_roles roles ON roles.oid=a.grantee WHERE p.oid=f AND a.grantee<>p.proowner LOOP
      EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION %s FROM %I',f::regprocedure,r.rolname);
    END LOOP;
  END LOOP;
END;
$acl$;
GRANT EXECUTE ON FUNCTION public.elenca_allegati_rapportino_portale(text,uuid,uuid,date),
  public.autorizza_accesso_allegato_portale(text,uuid) TO artecna_rapportini_backend;

DO $postcheck$
DECLARE b oid := 'artecna_rapportini_backend'::regrole; x oid; r record; ruolo text; baseline jsonb;
  nuove oid[] := ARRAY['public.elenca_allegati_rapportino_portale(text,uuid,uuid,date)'::regprocedure,
    'public.autorizza_accesso_allegato_portale(text,uuid)'::regprocedure];
  helper oid := 'artecna_rapportini.accesso_allegato_finalizzato(uuid,uuid,uuid,date)'::regprocedure;
  whitelist oid[] := ARRAY['public.crea_sessione_rapportino(text,text)'::regprocedure,
    'public.verifica_sessione_rapportino(text,uuid)'::regprocedure,'public.varianti_rapportino_portale(text,uuid)'::regprocedure,
    'public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure,'public.leggi_rapportino_portale(text,uuid,date,uuid)'::regprocedure,
    'public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint)'::regprocedure,
    'public.finalizza_allegato_rapportino_portale(text,uuid,uuid)'::regprocedure,
    'public.elenca_allegati_rapportino_portale(text,uuid,uuid,date)'::regprocedure,
    'public.autorizza_accesso_allegato_portale(text,uuid)'::regprocedure];
BEGIN
  FOREACH x IN ARRAY nuove||ARRAY[helper] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid=x AND proowner='postgres'::regrole
      AND prosecdef AND provolatile='s' AND prorettype='jsonb'::regtype AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[]) THEN
      RAISE EXCEPTION 'Metadati lettura allegati incompatibili';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) a
      WHERE p.oid=x AND ((a.grantee<>p.proowner AND (x=helper OR a.grantee<>b)) OR a.is_grantable OR a.privilege_type<>'EXECUTE')) THEN
      RAISE EXCEPTION 'ACL lettura allegati incompatibili';
    END IF;
    FOREACH ruolo IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF pg_catalog.has_function_privilege(ruolo,x,'EXECUTE') THEN RAISE EXCEPTION 'Funzione lettura accessibile a ruolo non autorizzato'; END IF;
    END LOOP;
  END LOOP;
  FOREACH x IN ARRAY whitelist LOOP
    IF NOT pg_catalog.has_function_privilege(b,x,'EXECUTE') OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p
      CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) a WHERE p.oid=x AND a.grantee=b AND a.privilege_type='EXECUTE' AND NOT a.is_grantable) THEN
      RAISE EXCEPTION 'Whitelist backend incompleta';
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) a
    WHERE a.grantee=b AND (p.oid<>ALL(whitelist) OR a.is_grantable OR a.privilege_type<>'EXECUTE'))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace AND pg_catalog.has_function_privilege(b,oid,'EXECUTE')) THEN
    RAISE EXCEPTION 'Funzione fuori whitelist accessibile al backend';
  END IF;
  IF pg_catalog.has_schema_privilege(b,'artecna_rapportini','USAGE,CREATE') THEN RAISE EXCEPTION 'Schema privato accessibile al backend'; END IF;
  FOREACH ruolo IN ARRAY ARRAY['artecna_rapportini.allegati','public.foto_cantiere','public.rapportini','public.rapportino_prestazioni','public.timbrature','public.operai'] LOOP
    IF pg_catalog.has_table_privilege(b,ruolo,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR pg_catalog.has_any_column_privilege(b,ruolo,'SELECT,INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION 'Privilegi diretti backend inattesi'; END IF;
  END LOOP;
  SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('oid',p.oid,'def',pg_catalog.pg_get_functiondef(p.oid),
    'owner',p.proowner,'acl',p.proacl::text) ORDER BY p.oid) INTO baseline FROM pg_catalog.pg_proc p
    WHERE (p.pronamespace='artecna_rapportini'::regnamespace AND p.oid<>helper) OR (p.oid=ANY(whitelist) AND p.oid<>ALL(nuove));
  IF baseline IS DISTINCT FROM pg_catalog.current_setting('artecna_lettura_allegati.rpc_baseline')::jsonb THEN RAISE EXCEPTION 'Funzioni precedenti alterate'; END IF;
END;
$postcheck$;
COMMIT;
