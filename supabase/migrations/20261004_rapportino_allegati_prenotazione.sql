-- Allegati 3A: solo prenotazione. NON applicare al remoto in questo micro-step.
BEGIN;
DO $preflight$
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres'
    OR pg_catalog.to_regclass('artecna_rapportini.allegati') IS NULL THEN
    RAISE EXCEPTION 'Installazione postgres e registro allegati richiesti';
  END IF;
  IF pg_catalog.to_regprocedure('public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint)') IS NOT NULL THEN
    RAISE EXCEPTION 'Prenotazione allegati già presente';
  END IF;
  -- Certificato transazionale delle funzioni esistenti: nessuna loro modifica.
  PERFORM pg_catalog.set_config('artecna_allegati.rpc_baseline',(
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('oid',p.oid,'def',pg_catalog.pg_get_functiondef(p.oid),
      'owner',p.proowner,'acl',p.proacl::text) ORDER BY p.oid)::text
    FROM pg_catalog.pg_proc p WHERE p.pronamespace='artecna_rapportini'::regnamespace
      OR p.oid IN ('public.crea_sessione_rapportino(text,text)'::regprocedure,
      'public.verifica_sessione_rapportino(text,uuid)'::regprocedure,
      'public.varianti_rapportino_portale(text,uuid)'::regprocedure,
      'public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure,
      'public.leggi_rapportino_portale(text,uuid,date,uuid)'::regprocedure)),true);
END;
$preflight$;

CREATE FUNCTION public.prenota_allegato_rapportino_portale(
  p_sessione text,p_rapportino_id uuid,p_cantiere_id uuid,p_data date,
  p_chiave_client_allegato uuid,p_sha256 text,p_mime_type text,p_byte_size bigint
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_accesso boolean; v_stato text; v_rapportino record;
  v_hash bytea; v_path text; v_ext text; v_count bigint;
  a artecna_rapportini.allegati%ROWTYPE;
  v_esito text := 'successo';
  v_upload_necessario boolean;
BEGIN
  IF session_user<>'artecna_rapportini_backend' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso Rapportini non consentito';
  END IF;
  IF p_sessione IS NULL OR p_sessione !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Sessione portale non valida';
  END IF;
  SELECT o.accesso_portale,o.stato INTO v_accesso,v_stato
    FROM artecna_rapportini.sessioni_portale s JOIN public.operai o ON o.id=s.operaio_id
    WHERE s.token_sha256=pg_catalog.sha256(pg_catalog.convert_to(p_sessione,'UTF8'))
      AND s.revocata_at IS NULL AND s.scade_at>v_now FOR SHARE OF s,o;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Sessione portale assente, scaduta o revocata';
  END IF;
  IF v_accesso IS DISTINCT FROM true OR v_stato='sospeso' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso Rapportini non consentito';
  END IF;
  IF p_rapportino_id IS NULL OR p_cantiere_id IS NULL OR p_data IS NULL
    OR NOT pg_catalog.isfinite(p_data) OR p_chiave_client_allegato IS NULL
    OR p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$'
    OR p_mime_type IS NULL OR p_mime_type NOT IN ('image/jpeg','image/png','image/webp')
    OR p_byte_size IS NULL OR p_byte_size NOT BETWEEN 1 AND 4000000 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Richiesta allegato non valida';
  END IF;
  PERFORM 1 FROM public.cantieri WHERE id=p_cantiere_id
    AND lavori_conclusi IS DISTINCT FROM true FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito';
  END IF;
  -- Lock per Rapportino: serializza identità e quota, anche per chiavi diverse.
  -- Nessun UPDATE testata/revisione. Nessun advisory lock globale.
  SELECT cantiere_id,data,versione_prestazioni INTO v_rapportino
    FROM public.rapportini WHERE id=p_rapportino_id FOR UPDATE;
  IF NOT FOUND OR v_rapportino.cantiere_id IS DISTINCT FROM p_cantiere_id
    OR v_rapportino.data IS DISTINCT FROM p_data THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto Rapportino incoerente';
  END IF;
  IF v_rapportino.versione_prestazioni IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione Rapportino non supportata';
  END IF;
  v_hash:=pg_catalog.decode(p_sha256,'hex');
  v_ext:=CASE p_mime_type WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' ELSE 'webp' END;
  v_path:='rapportini/'||p_cantiere_id::text||'/'||p_rapportino_id::text||'/'||p_chiave_client_allegato::text||'.'||v_ext;
  SELECT * INTO a FROM artecna_rapportini.allegati
    WHERE rapportino_id=p_rapportino_id AND chiave_client_allegato=p_chiave_client_allegato FOR UPDATE;
  IF FOUND THEN
    IF a.rapportino_id IS DISTINCT FROM p_rapportino_id OR a.cantiere_id IS DISTINCT FROM p_cantiere_id
      OR a.chiave_client_allegato IS DISTINCT FROM p_chiave_client_allegato OR a.sha256 IS DISTINCT FROM v_hash
      OR a.mime_type IS DISTINCT FROM p_mime_type OR a.byte_size IS DISTINCT FROM p_byte_size
      OR a.bucket IS DISTINCT FROM 'rapportini-v1' OR a.file_path IS DISTINCT FROM v_path THEN
      RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Identità allegato in conflitto';
    END IF;
    -- Integrità storica: nessuna riparazione implicita, neppure della lease.
    IF (a.lease_id IS NULL) <> (a.lease_until IS NULL) THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
    IF a.stato='cancellato' THEN
      IF a.removed_at IS NULL OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
      END IF;
      RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Allegato non riutilizzabile';
    ELSIF a.stato='cancellazione_pending' THEN
      IF a.removed_at IS NULL THEN
        RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
      END IF;
      RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Allegato non riutilizzabile';
    ELSIF a.stato='finalizzato' THEN
      IF a.finalized_at IS NULL OR a.removed_at IS NOT NULL OR a.foto_cantiere_id IS NULL
        OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
      END IF;
      v_esito:='successo';
      v_upload_necessario:=false;
    ELSIF a.stato='scaduto' THEN
      IF a.finalized_at IS NOT NULL OR a.removed_at IS NOT NULL OR a.foto_cantiere_id IS NOT NULL
        OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
      END IF;
      v_esito:='scaduto_persistito_con_conflitto';
      v_upload_necessario:=false;
    ELSIF a.stato='prenotato' THEN
      IF a.finalized_at IS NOT NULL OR a.removed_at IS NOT NULL OR a.foto_cantiere_id IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
      END IF;
      IF a.expires_at<=v_now THEN
        UPDATE artecna_rapportini.allegati SET stato='scaduto',lease_id=NULL,lease_until=NULL
          WHERE id=a.id RETURNING * INTO a;
        -- Esito normale: permette il COMMIT. Il futuro Node lo tradurrà in 409.
        v_esito:='scaduto_persistito_con_conflitto';
        v_upload_necessario:=false;
      ELSIF a.lease_until>v_now THEN
        RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Operazione allegato in corso';
      ELSE
        UPDATE artecna_rapportini.allegati SET lease_id=pg_catalog.gen_random_uuid(),lease_until=v_now+interval '2 minutes'
          WHERE id=a.id RETURNING * INTO a;
        v_upload_necessario:=true;
      END IF;
    ELSE
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
  ELSE
    -- Contano prenotazioni temporalmente valide, finalizzati e cancellazioni pendenti.
    SELECT count(*) INTO v_count FROM artecna_rapportini.allegati WHERE rapportino_id=p_rapportino_id
      AND (stato IN ('finalizzato','cancellazione_pending') OR (stato='prenotato' AND expires_at>v_now));
    IF v_count>=20 THEN
      RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Limite allegati raggiunto';
    END IF;
    INSERT INTO artecna_rapportini.allegati(rapportino_id,cantiere_id,chiave_client_allegato,
      sha256,bucket,file_path,mime_type,byte_size,stato,expires_at,lease_id,lease_until)
    VALUES(p_rapportino_id,p_cantiere_id,p_chiave_client_allegato,v_hash,'rapportini-v1',v_path,
      p_mime_type,p_byte_size,'prenotato',v_now+interval '24 hours',pg_catalog.gen_random_uuid(),v_now+interval '2 minutes')
      RETURNING * INTO a;
    v_upload_necessario:=true;
  END IF;
  -- Contratto INTERNO backend: mai inoltrare bucket/path/lease al browser.
  RETURN pg_catalog.jsonb_build_object('versione_contratto',1,'esito',v_esito,
    'allegato_id',a.id,'stato',a.stato,'upload_necessario',v_upload_necessario,
    'bucket',a.bucket,'file_path',a.file_path,'mime_type',a.mime_type,'byte_size',a.byte_size,
    'lease_id',a.lease_id,'lease_until',a.lease_until,'expires_at',a.expires_at);
END;
$fn$;

DO $acl$
DECLARE r record; f oid := 'public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint)'::regprocedure;
BEGIN
  REVOKE ALL ON FUNCTION public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint) FROM PUBLIC;
  FOR r IN SELECT DISTINCT roles.rolname FROM pg_catalog.pg_proc p
    CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) a JOIN pg_catalog.pg_roles roles ON roles.oid=a.grantee
    WHERE p.oid=f AND a.grantee<>p.proowner LOOP
    EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint) FROM %I',r.rolname);
  END LOOP;
END;
$acl$;
GRANT EXECUTE ON FUNCTION public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint) TO artecna_rapportini_backend;

DO $postcheck$
DECLARE
  b oid := 'artecna_rapportini_backend'::regrole;
  f oid := 'public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint)'::regprocedure;
  whitelist oid[] := ARRAY['public.crea_sessione_rapportino(text,text)'::regprocedure,
    'public.verifica_sessione_rapportino(text,uuid)'::regprocedure,'public.varianti_rapportino_portale(text,uuid)'::regprocedure,
    'public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure,'public.leggi_rapportino_portale(text,uuid,date,uuid)'::regprocedure,
    'public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint)'::regprocedure];
  x oid; ruolo text; baseline jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid=f AND proowner='postgres'::regrole
    AND prosecdef AND provolatile='v' AND prorettype='jsonb'::regtype
    AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[]) THEN
    RAISE EXCEPTION 'Metadati prenotazione incompatibili';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) a
    WHERE p.oid=f AND (a.grantee NOT IN (p.proowner,b) OR a.privilege_type<>'EXECUTE' OR a.is_grantable)) THEN
    RAISE EXCEPTION 'ACL prenotazione incompatibili';
  END IF;
  FOREACH ruolo IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF pg_catalog.has_function_privilege(ruolo,f,'EXECUTE') THEN RAISE EXCEPTION 'RPC accessibile a ruolo non autorizzato'; END IF;
  END LOOP;
  FOREACH x IN ARRAY whitelist LOOP
    IF NOT pg_catalog.has_function_privilege(b,x,'EXECUTE') OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) a
      WHERE p.oid=x AND a.grantee=b AND a.privilege_type='EXECUTE' AND NOT a.is_grantable) THEN
      RAISE EXCEPTION 'Whitelist backend incompleta';
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) a
    WHERE a.grantee=b AND (p.oid<>ALL(whitelist) OR a.is_grantable OR a.privilege_type<>'EXECUTE'))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace
      AND pg_catalog.has_function_privilege(b,oid,'EXECUTE')) THEN
    RAISE EXCEPTION 'Funzione fuori whitelist accessibile al backend';
  END IF;
  IF pg_catalog.has_schema_privilege(b,'artecna_rapportini','USAGE,CREATE')
    OR pg_catalog.has_table_privilege(b,'artecna_rapportini.allegati','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR pg_catalog.has_any_column_privilege(b,'artecna_rapportini.allegati','SELECT,INSERT,UPDATE,REFERENCES') THEN
    RAISE EXCEPTION 'Privilegi diretti backend inattesi';
  END IF;
  SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('oid',p.oid,'def',pg_catalog.pg_get_functiondef(p.oid),
    'owner',p.proowner,'acl',p.proacl::text) ORDER BY p.oid) INTO baseline
    FROM pg_catalog.pg_proc p WHERE p.pronamespace='artecna_rapportini'::regnamespace OR (p.oid=ANY(whitelist) AND p.oid<>f);
  IF baseline IS DISTINCT FROM pg_catalog.current_setting('artecna_allegati.rpc_baseline')::jsonb THEN
    RAISE EXCEPTION 'Funzioni precedenti alterate';
  END IF;
END;
$postcheck$;
COMMIT;
