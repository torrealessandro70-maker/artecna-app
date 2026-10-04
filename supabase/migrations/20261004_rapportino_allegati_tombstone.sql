-- Allegati 3D.1: compatibilità tombstone. SOLO LOCALE, nessuna transizione cleanup.
BEGIN;
DO $preflight$
DECLARE r record;
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres'
    OR pg_catalog.to_regclass('artecna_rapportini.allegati') IS NULL THEN
    RAISE EXCEPTION 'Installazione postgres e registro allegati richiesti';
  END IF;
  IF pg_catalog.to_regprocedure('public.cancella_allegato_rapportino_portale(text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'RPC 3D storica richiesta';
  END IF;
  IF EXISTS (SELECT 1 FROM artecna_rapportini.allegati WHERE stato='cancellato' AND
    (removed_at IS NULL OR foto_cantiere_id IS NOT NULL OR lease_id IS NOT NULL OR lease_until IS NOT NULL)) THEN
    RAISE EXCEPTION 'Tombstone incompatibili: nessuna normalizzazione automatica';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='artecna_rapportini.allegati'::regclass AND conname='allegati_cancellato_post_cleanup') THEN
    RAISE EXCEPTION 'Compatibilità tombstone già installata';
  END IF;
  SELECT p.* INTO r FROM pg_catalog.pg_proc p
    WHERE p.oid='public.cancella_allegato_rapportino_portale(text,uuid)'::regprocedure;
  IF r.proowner<>'postgres'::regrole OR NOT r.prosecdef OR r.provolatile<>'v'
    OR r.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
    OR r.prokind<>'f' OR r.prorettype<>'jsonb'::regtype OR r.proretset
    OR r.proargtypes<>'25 2950'::oidvector
    OR r.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] THEN
    RAISE EXCEPTION 'Metadati 3D storici inattesi';
  END IF;
  IF pg_catalog.strpos(pg_catalog.replace(r.prosrc,E'\r\n',''),E'\r')>0
    OR pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      pg_catalog.replace(r.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')
      <> '8675d9c96cc327c02513e058ff1ca86e7ee7e35f7aa8867d5b7b5e73673f5298' THEN
    RAISE EXCEPTION 'Definizione 3D storica inattesa';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.aclexplode(coalesce(r.proacl,pg_catalog.acldefault('f',r.proowner))) a
      WHERE a.grantee NOT IN ('postgres'::regrole,'artecna_rapportini_backend'::regrole)
        OR a.privilege_type<>'EXECUTE' OR a.is_grantable)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.aclexplode(r.proacl) a WHERE a.grantee='postgres'::regrole AND a.privilege_type='EXECUTE' AND NOT a.is_grantable)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.aclexplode(r.proacl) a WHERE a.grantee='artecna_rapportini_backend'::regrole AND a.privilege_type='EXECUTE' AND NOT a.is_grantable) THEN
    RAISE EXCEPTION 'ACL 3D storiche inattese';
  END IF;
  PERFORM pg_catalog.set_config('artecna_cancella.acl_3d',(SELECT proacl::text FROM pg_catalog.pg_proc WHERE oid='public.cancella_allegato_rapportino_portale(text,uuid)'::regprocedure),true);
  PERFORM pg_catalog.set_config('artecna_cancella.sorgente_attesa','e42cf72a822d8e066b08db13ade38107d1d06ae3e9d8cad4547e60c596a7f68a',true);
  -- Nessun ALTER della proiezione: fallisce prima di creare la RPC se incompatibile.
  FOR r IN SELECT * FROM (VALUES ('id','uuid'),('cantiere_id','uuid'),('rapportino_id','text'),
    ('cantiere','text'),('categoria','text'),('nota','text'),('file_url','text'),('file_path','text'),
    ('immagine_base64','text'),('thumbnail_url','text'),('storage_provider','text'),('sync_status','text')) v(nome,tipo)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.foto_cantiere'::regclass
      AND attname=r.nome AND NOT attisdropped AND atttypid=pg_catalog.to_regtype(r.tipo)) THEN
      RAISE EXCEPTION 'Schema foto incompatibile: %',r.nome;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.foto_cantiere'::regclass
    AND attname='data_foto' AND NOT attisdropped AND atttypid IN ('text'::regtype,'date'::regtype)) THEN
    RAISE EXCEPTION 'Tipo data_foto incompatibile';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.foto_cantiere'::regclass
    AND attname IN ('file_url','file_path','thumbnail_url') AND attnotnull AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Nullable proiezione foto incompatibili';
  END IF;
  PERFORM pg_catalog.set_config('artecna_cancella.rpc_baseline',(
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('oid',p.oid,'def',pg_catalog.pg_get_functiondef(p.oid),
      'owner',p.proowner,'acl',p.proacl::text) ORDER BY p.oid)::text FROM pg_catalog.pg_proc p
    WHERE p.pronamespace='artecna_rapportini'::regnamespace OR p.oid IN (
      'public.crea_sessione_rapportino(text,text)'::regprocedure,'public.verifica_sessione_rapportino(text,uuid)'::regprocedure,
      'public.varianti_rapportino_portale(text,uuid)'::regprocedure,'public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure,
      'public.leggi_rapportino_portale(text,uuid,date,uuid)'::regprocedure,
      'public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint)'::regprocedure,
      'public.finalizza_allegato_rapportino_portale(text,uuid,uuid)'::regprocedure,
      'public.elenca_allegati_rapportino_portale(text,uuid,uuid,date)'::regprocedure,
      'public.autorizza_accesso_allegato_portale(text,uuid)'::regprocedure)),true);
END;
$preflight$;

ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT allegati_cancellato_post_cleanup CHECK (
  stato <> 'cancellato' OR (removed_at IS NOT NULL AND foto_cantiere_id IS NULL AND lease_id IS NULL AND lease_until IS NULL)
);
SELECT pg_catalog.set_config('artecna_cancella.check_atteso',(
  SELECT pg_catalog.pg_get_expr(conbin,conrelid) FROM pg_catalog.pg_constraint
  WHERE conrelid='artecna_rapportini.allegati'::regclass AND conname='allegati_cancellato_post_cleanup'),true);

CREATE OR REPLACE FUNCTION public.cancella_allegato_rapportino_portale(p_sessione text,p_allegato_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_accesso boolean; v_stato text; target record; r record; v_nome text;
  a artecna_rapportini.allegati%ROWTYPE; f public.foto_cantiere%ROWTYPE;
  v_ext text; v_path text;
BEGIN
  IF session_user<>'artecna_rapportini_backend' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso Rapportini non consentito';
  END IF;
  IF p_sessione IS NULL OR p_sessione !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Sessione portale non valida';
  END IF;
  SELECT o.accesso_portale,o.stato INTO v_accesso,v_stato FROM artecna_rapportini.sessioni_portale s
    JOIN public.operai o ON o.id=s.operaio_id WHERE s.token_sha256=pg_catalog.sha256(pg_catalog.convert_to(p_sessione,'UTF8'))
    AND s.revocata_at IS NULL AND s.scade_at>v_now FOR SHARE OF s,o;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Sessione portale assente, scaduta o revocata'; END IF;
  IF v_accesso IS DISTINCT FROM true OR v_stato='sospeso' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso Rapportini non consentito';
  END IF;
  IF p_allegato_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Richiesta allegato non valida';
  END IF;
  -- Prima lettura solo per localizzare il contesto, nessuna decisione sullo stato.
  SELECT rapportino_id,cantiere_id INTO target FROM artecna_rapportini.allegati WHERE id=p_allegato_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto allegato incoerente'; END IF;
  SELECT nome INTO v_nome FROM public.cantieri WHERE id=target.cantiere_id
    AND lavori_conclusi IS DISTINCT FROM true FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito'; END IF;
  -- Ordine globale RPC allegati: Rapportino -> Allegato -> foto_cantiere.
  SELECT id,cantiere_id,data,versione_prestazioni INTO r FROM public.rapportini WHERE id=target.rapportino_id FOR UPDATE;
  IF NOT FOUND OR r.cantiere_id IS DISTINCT FROM target.cantiere_id OR r.data IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto allegato incoerente';
  END IF;
  IF r.versione_prestazioni IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione Rapportino non supportata';
  END IF;
  SELECT * INTO a FROM artecna_rapportini.allegati WHERE id=p_allegato_id FOR UPDATE;
  IF NOT FOUND OR a.rapportino_id IS DISTINCT FROM r.id OR a.cantiere_id IS DISTINCT FROM r.cantiere_id THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto allegato incoerente';
  END IF;
  IF (a.lease_id IS NULL) <> (a.lease_until IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
  END IF;
  IF a.stato='prenotato' THEN
    IF a.finalized_at IS NOT NULL OR a.foto_cantiere_id IS NOT NULL OR a.removed_at IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
  ELSIF a.stato='scaduto' THEN
    IF a.finalized_at IS NOT NULL OR a.foto_cantiere_id IS NOT NULL OR a.removed_at IS NOT NULL
      OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
  ELSIF a.stato='finalizzato' THEN
    IF a.finalized_at IS NULL OR a.foto_cantiere_id IS NULL OR a.removed_at IS NOT NULL
      OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
  ELSIF a.stato='cancellazione_pending' THEN
    -- Provenienza 3D: coppia NULL oppure coppia presente; nessuna lease cleanup in 3D.
    IF a.removed_at IS NULL OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL
      OR (a.finalized_at IS NULL) <> (a.foto_cantiere_id IS NULL) THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
  ELSIF a.stato='cancellato' THEN
    -- Tombstone post-cleanup: finalized_at è storia; nessuna proiezione residua.
    IF a.removed_at IS NULL OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL
      OR a.foto_cantiere_id IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
  ELSE
    RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
  END IF;
  v_ext:=CASE a.mime_type WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' END;
  v_path:='rapportini/'||r.cantiere_id::text||'/'||r.id::text||'/'||a.chiave_client_allegato::text||'.'||v_ext;
  IF v_ext IS NULL OR a.bucket IS DISTINCT FROM 'rapportini-v1' OR a.file_path IS DISTINCT FROM v_path THEN
    RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Oggetto allegato non valido';
  END IF;
  IF a.foto_cantiere_id IS NOT NULL THEN
    -- Ultimo lock nell'ordine globale, solo lettura della proiezione conservata.
    SELECT * INTO f FROM public.foto_cantiere WHERE id=a.foto_cantiere_id FOR SHARE;
    IF NOT FOUND OR f.cantiere_id IS DISTINCT FROM r.cantiere_id OR f.rapportino_id IS DISTINCT FROM r.id::text
      OR f.cantiere IS DISTINCT FROM v_nome OR f.categoria IS DISTINCT FROM 'rapportino'
      OR f.data_foto::text IS DISTINCT FROM r.data::text OR f.nota IS DISTINCT FROM ''
      OR f.file_url IS NOT NULL OR f.file_path IS NOT NULL OR f.immagine_base64 IS DISTINCT FROM ''
      OR f.thumbnail_url IS NOT NULL OR f.storage_provider IS DISTINCT FROM 'cloud'
      OR f.sync_status IS DISTINCT FROM 'not_required' THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Proiezione allegato non valida';
    END IF;
  END IF;
  IF a.stato IN ('prenotato','scaduto','finalizzato') THEN
    UPDATE artecna_rapportini.allegati SET stato='cancellazione_pending',removed_at=v_now,
      lease_id=NULL,lease_until=NULL WHERE id=a.id RETURNING * INTO a;
  END IF;
  RETURN pg_catalog.jsonb_build_object('versione_contratto',1,'esito','successo','allegato_id',a.id,
    'stato',a.stato,'foto_cantiere_id',a.foto_cantiere_id,'removed_at',a.removed_at);
END;
$fn$;

DO $postcheck$
DECLARE
  b oid := 'artecna_rapportini_backend'::regrole;
  f oid := 'public.cancella_allegato_rapportino_portale(text,uuid)'::regprocedure;
  whitelist oid[] := ARRAY['public.crea_sessione_rapportino(text,text)'::regprocedure,
    'public.verifica_sessione_rapportino(text,uuid)'::regprocedure,'public.varianti_rapportino_portale(text,uuid)'::regprocedure,
    'public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure,'public.leggi_rapportino_portale(text,uuid,date,uuid)'::regprocedure,
    'public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint)'::regprocedure,
    'public.finalizza_allegato_rapportino_portale(text,uuid,uuid)'::regprocedure,
      'public.elenca_allegati_rapportino_portale(text,uuid,uuid,date)'::regprocedure,
      'public.autorizza_accesso_allegato_portale(text,uuid)'::regprocedure,
    'public.cancella_allegato_rapportino_portale(text,uuid)'::regprocedure];
  x oid; ruolo text; baseline jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='artecna_rapportini.allegati'::regclass
    AND conname='allegati_cancellato_post_cleanup' AND contype='c' AND convalidated
    AND pg_catalog.pg_get_expr(conbin,conrelid)=pg_catalog.current_setting('artecna_cancella.check_atteso')) THEN
    RAISE EXCEPTION 'CHECK tombstone incompatibile';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid=f
    AND pg_catalog.strpos(pg_catalog.replace(prosrc,E'\r\n',''),E'\r')=0
    AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')
      =pg_catalog.current_setting('artecna_cancella.sorgente_attesa')
    AND proacl::text=pg_catalog.current_setting('artecna_cancella.acl_3d')) THEN
    RAISE EXCEPTION 'Definizione o ACL 3D divergenti';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid=f AND proowner='postgres'::regrole
    AND prosecdef AND provolatile='v' AND prorettype='jsonb'::regtype AND NOT proretset AND prokind='f'
    AND proargtypes='25 2950'::oidvector AND prolang=(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
    AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[]) THEN
    RAISE EXCEPTION 'Metadati cancellazione incompatibili';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) a
    WHERE p.oid=f AND (a.grantee NOT IN (p.proowner,b) OR a.privilege_type<>'EXECUTE' OR a.is_grantable)) THEN
    RAISE EXCEPTION 'ACL cancellazione incompatibili';
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
    OR pg_catalog.has_any_column_privilege(b,'artecna_rapportini.allegati','SELECT,INSERT,UPDATE,REFERENCES')
    OR pg_catalog.has_table_privilege(b,'public.foto_cantiere','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR pg_catalog.has_any_column_privilege(b,'public.foto_cantiere','SELECT,INSERT,UPDATE,REFERENCES')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid IN ('public.rapportini'::regclass,'public.rapportino_prestazioni'::regclass,'public.timbrature'::regclass,'public.operai'::regclass)
      AND (pg_catalog.has_table_privilege(b,oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR pg_catalog.has_any_column_privilege(b,oid,'SELECT,INSERT,UPDATE,REFERENCES'))) THEN
    RAISE EXCEPTION 'Privilegi diretti backend inattesi';
  END IF;
  SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('oid',p.oid,'def',pg_catalog.pg_get_functiondef(p.oid),
    'owner',p.proowner,'acl',p.proacl::text) ORDER BY p.oid) INTO baseline
    FROM pg_catalog.pg_proc p WHERE p.pronamespace='artecna_rapportini'::regnamespace OR (p.oid=ANY(whitelist) AND p.oid<>f);
  IF baseline IS DISTINCT FROM pg_catalog.current_setting('artecna_cancella.rpc_baseline')::jsonb THEN
    RAISE EXCEPTION 'Funzioni precedenti alterate';
  END IF;
END;
$postcheck$;
COMMIT;
