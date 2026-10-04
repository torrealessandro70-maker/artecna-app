-- Allegati 3B: finalizzazione DB, senza accesso Storage. SOLO LOCALE.
BEGIN;
DO $preflight$
DECLARE r record;
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres'
    OR pg_catalog.to_regclass('artecna_rapportini.allegati') IS NULL THEN
    RAISE EXCEPTION 'Installazione postgres e registro allegati richiesti';
  END IF;
  IF pg_catalog.to_regprocedure('public.finalizza_allegato_rapportino_portale(text,uuid,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Finalizzazione allegati già presente';
  END IF;
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
  PERFORM pg_catalog.set_config('artecna_finalizza.rpc_baseline',(
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('oid',p.oid,'def',pg_catalog.pg_get_functiondef(p.oid),
      'owner',p.proowner,'acl',p.proacl::text) ORDER BY p.oid)::text FROM pg_catalog.pg_proc p
    WHERE p.pronamespace='artecna_rapportini'::regnamespace OR p.oid IN (
      'public.crea_sessione_rapportino(text,text)'::regprocedure,'public.verifica_sessione_rapportino(text,uuid)'::regprocedure,
      'public.varianti_rapportino_portale(text,uuid)'::regprocedure,'public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure,
      'public.leggi_rapportino_portale(text,uuid,date,uuid)'::regprocedure,
      'public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint)'::regprocedure)),true);
END;
$preflight$;

CREATE FUNCTION public.finalizza_allegato_rapportino_portale(p_sessione text,p_allegato_id uuid,p_lease_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_accesso boolean; v_stato text; target record; r record; v_nome text;
  a artecna_rapportini.allegati%ROWTYPE; f public.foto_cantiere%ROWTYPE;
  v_foto uuid; v_esito text := 'successo';
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
  IF p_allegato_id IS NULL OR p_lease_id IS NULL THEN
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
    IF a.finalized_at IS NOT NULL OR a.removed_at IS NOT NULL OR a.foto_cantiere_id IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
    IF a.expires_at<=v_now THEN
      UPDATE artecna_rapportini.allegati SET stato='scaduto',lease_id=NULL,lease_until=NULL
        WHERE id=a.id RETURNING * INTO a;
      v_esito:='scaduto_persistito_con_conflitto';
    ELSE
      IF a.lease_id IS DISTINCT FROM p_lease_id OR a.lease_until IS NULL OR a.lease_until<=v_now THEN
        RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Tentativo allegato non valido';
      END IF;
      v_foto:=pg_catalog.gen_random_uuid();
      INSERT INTO public.foto_cantiere(id,cantiere_id,cantiere,rapportino_id,categoria,data_foto,nota,
        file_url,file_path,immagine_base64,thumbnail_url,storage_provider,sync_status)
      VALUES(v_foto,r.cantiere_id,v_nome,r.id::text,'rapportino',r.data,'',NULL,NULL,'',NULL,'cloud','not_required');
      UPDATE artecna_rapportini.allegati SET stato='finalizzato',foto_cantiere_id=v_foto,finalized_at=v_now,
        lease_id=NULL,lease_until=NULL WHERE id=a.id RETURNING * INTO a;
    END IF;
  ELSIF a.stato='finalizzato' THEN
    IF a.finalized_at IS NULL OR a.removed_at IS NOT NULL OR a.foto_cantiere_id IS NULL
      OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
    -- Solo verifica: mai ricreare o riparare una proiezione mancante/incoerente.
    SELECT * INTO f FROM public.foto_cantiere WHERE id=a.foto_cantiere_id FOR SHARE;
    IF NOT FOUND OR f.cantiere_id IS DISTINCT FROM r.cantiere_id OR f.rapportino_id IS DISTINCT FROM r.id::text
      OR f.cantiere IS DISTINCT FROM v_nome OR f.categoria IS DISTINCT FROM 'rapportino'
      OR f.data_foto::text IS DISTINCT FROM r.data::text OR f.nota IS DISTINCT FROM ''
      OR f.file_url IS NOT NULL OR f.file_path IS NOT NULL OR f.immagine_base64 IS DISTINCT FROM ''
      OR f.thumbnail_url IS NOT NULL OR f.storage_provider IS DISTINCT FROM 'cloud'
      OR f.sync_status IS DISTINCT FROM 'not_required' THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Proiezione allegato non valida';
    END IF;
  ELSIF a.stato='scaduto' THEN
    IF a.finalized_at IS NOT NULL OR a.removed_at IS NOT NULL OR a.foto_cantiere_id IS NOT NULL
      OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Allegato non riutilizzabile';
  ELSIF a.stato='cancellazione_pending' THEN
    IF a.removed_at IS NULL THEN RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido'; END IF;
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Allegato non riutilizzabile';
  ELSIF a.stato='cancellato' THEN
    IF a.removed_at IS NULL OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Allegato non riutilizzabile';
  ELSE
    RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
  END IF;
  RETURN pg_catalog.jsonb_build_object('versione_contratto',1,'esito',v_esito,'allegato_id',a.id,
    'stato',a.stato,'foto_cantiere_id',a.foto_cantiere_id,'finalized_at',a.finalized_at);
END;
$fn$;

DO $acl$
DECLARE r record; f oid := 'public.finalizza_allegato_rapportino_portale(text,uuid,uuid)'::regprocedure;
BEGIN
  REVOKE ALL ON FUNCTION public.finalizza_allegato_rapportino_portale(text,uuid,uuid) FROM PUBLIC;
  FOR r IN SELECT DISTINCT roles.rolname FROM pg_catalog.pg_proc p
    CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) a JOIN pg_catalog.pg_roles roles ON roles.oid=a.grantee
    WHERE p.oid=f AND a.grantee<>p.proowner LOOP
    EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION public.finalizza_allegato_rapportino_portale(text,uuid,uuid) FROM %I',r.rolname);
  END LOOP;
END;
$acl$;
GRANT EXECUTE ON FUNCTION public.finalizza_allegato_rapportino_portale(text,uuid,uuid) TO artecna_rapportini_backend;

DO $postcheck$
DECLARE
  b oid := 'artecna_rapportini_backend'::regrole;
  f oid := 'public.finalizza_allegato_rapportino_portale(text,uuid,uuid)'::regprocedure;
  whitelist oid[] := ARRAY['public.crea_sessione_rapportino(text,text)'::regprocedure,
    'public.verifica_sessione_rapportino(text,uuid)'::regprocedure,'public.varianti_rapportino_portale(text,uuid)'::regprocedure,
    'public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure,'public.leggi_rapportino_portale(text,uuid,date,uuid)'::regprocedure,
    'public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint)'::regprocedure,
    'public.finalizza_allegato_rapportino_portale(text,uuid,uuid)'::regprocedure];
  x oid; ruolo text; baseline jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid=f AND proowner='postgres'::regrole
    AND prosecdef AND provolatile='v' AND prorettype='jsonb'::regtype
    AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[]) THEN
    RAISE EXCEPTION 'Metadati finalizzazione incompatibili';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) a
    WHERE p.oid=f AND (a.grantee NOT IN (p.proowner,b) OR a.privilege_type<>'EXECUTE' OR a.is_grantable)) THEN
    RAISE EXCEPTION 'ACL finalizzazione incompatibili';
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
    OR pg_catalog.has_any_column_privilege(b,'public.foto_cantiere','SELECT,INSERT,UPDATE,REFERENCES') THEN
    RAISE EXCEPTION 'Privilegi diretti backend inattesi';
  END IF;
  SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('oid',p.oid,'def',pg_catalog.pg_get_functiondef(p.oid),
    'owner',p.proowner,'acl',p.proacl::text) ORDER BY p.oid) INTO baseline
    FROM pg_catalog.pg_proc p WHERE p.pronamespace='artecna_rapportini'::regnamespace OR (p.oid=ANY(whitelist) AND p.oid<>f);
  IF baseline IS DISTINCT FROM pg_catalog.current_setting('artecna_finalizza.rpc_baseline')::jsonb THEN
    RAISE EXCEPTION 'Funzioni precedenti alterate';
  END IF;
END;
$postcheck$;
COMMIT;
