-- Additive Step 4. No Storage writes, photo copies, economic RPC changes or AI calls.
BEGIN;
DO $$ BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN RAISE EXCEPTION 'Installazione riservata a postgres'; END IF;
  IF to_regprocedure('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)') IS NULL
    OR to_regclass('public.variante_fonti_memory') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='artecna_rapportini_backend') THEN
    RAISE EXCEPTION 'Prerequisiti Fonti/guardie/backend assenti';
  END IF;
END $$;

-- Keep the installed Quaderno FK and RPC contract untouched. Concrete generated
-- FKs enforce both kinds of photo identity without duplicating any photo fields.
CREATE TABLE public.variante_fonti_visive (
  variante_id uuid NOT NULL REFERENCES public.varianti_cantiere(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK(source_type IN ('foto_cantiere','foto_sopralluogo')),
  source_id uuid NOT NULL,
  source_version timestamptz CHECK(source_version IS NULL), -- no reliable revision exists
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  foto_cantiere_id uuid GENERATED ALWAYS AS (CASE WHEN source_type='foto_cantiere' THEN source_id END) STORED
    REFERENCES public.foto_cantiere(id) ON DELETE CASCADE,
  foto_sopralluogo_id uuid GENERATED ALWAYS AS (CASE WHEN source_type='foto_sopralluogo' THEN source_id END) STORED
    REFERENCES public.foto_sopralluogo(id) ON DELETE CASCADE,
  PRIMARY KEY(variante_id,source_type,source_id)
);
CREATE INDEX variante_fonti_visive_source_idx ON public.variante_fonti_visive(source_type,source_id);
ALTER TABLE public.variante_fonti_visive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.variante_fonti_visive FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE public.variante_osservatore_analisi (
  id uuid PRIMARY KEY,
  variante_id uuid NOT NULL REFERENCES public.varianti_cantiere(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  modello text NOT NULL CHECK(modello='gpt-4.1-mini'),
  fonti jsonb NOT NULL CHECK(jsonb_typeof(fonti)='object'),
  risultato jsonb NOT NULL CHECK(jsonb_typeof(risultato)='object')
);
CREATE INDEX variante_osservatore_ultima_idx ON public.variante_osservatore_analisi(variante_id,created_at DESC,id);
ALTER TABLE public.variante_osservatore_analisi ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.variante_osservatore_analisi FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION artecna_guardie.foto_fonti_variante(p_user uuid,p_variante uuid,p_collegate boolean)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp SET timezone TO 'UTC' AS $$
DECLARE v public.varianti_cantiere%ROWTYPE; risultato jsonb;
BEGIN
  SELECT * INTO v FROM public.varianti_cantiere WHERE id=p_variante;
  IF p_user IS NULL OR NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(p_user,v.cantiere_id) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Variante non accessibile';
  END IF;
  IF v.stato IS DISTINCT FROM 'bozza' OR p_collegate IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Richiesta non consentita'; END IF;
  WITH foto AS (
    SELECT 'foto_cantiere'::text AS tipo,f.id,to_jsonb(f) AS doc,'cantiere'::text AS origine,
      NULL::text AS sopralluogo_id
    FROM public.foto_cantiere f WHERE f.cantiere_id=v.cantiere_id
    UNION ALL
    SELECT 'foto_sopralluogo',f.id,to_jsonb(f),'sopralluogo',f.sopralluogo_id::text
    FROM public.foto_sopralluogo f WHERE EXISTS (
      SELECT 1 FROM public.cantieri c JOIN public.preventivi_cantiere p
        ON p.id IN (c.origine_preventivo_id,c.preventivo_contrattuale_id)
      WHERE c.id=v.cantiere_id AND p.cantiere_id=c.id AND p.sopralluogo_id::text=f.sopralluogo_id::text
    )
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('source_id',f.id,'source_type',f.tipo,
    'source_version',NULL,'origine',f.origine,'sopralluogo_id',f.sopralluogo_id,
    'impronta',encode(sha256(convert_to(f.doc::text,'UTF8')),'hex'),
    'collegata',l.source_id IS NOT NULL,'disponibile',true,
    'foto',f.doc || jsonb_build_object('id',f.id,'cantiere',coalesce(f.doc->>'cantiere',''),
      'nota',coalesce(f.doc->>'nota',''),'immagine_base64',coalesce(f.doc->>'immagine_base64',''),
      'allegato_v1_id',f.doc->'allegato_v1_id')) ORDER BY f.tipo,f.id),'[]'::jsonb)
  INTO risultato FROM foto f LEFT JOIN public.variante_fonti_visive l
    ON l.variante_id=v.id AND l.source_type=f.tipo AND l.source_id=f.id
  WHERE NOT p_collegate OR l.source_id IS NOT NULL;
  IF p_collegate THEN
    -- A reference that has lost context remains removable, without disclosing
    -- the now inaccessible photo/metadata. Its changed fingerprint invalidates analysis.
    SELECT risultato || coalesce(jsonb_agg(jsonb_build_object('source_id',l.source_id,'source_type',l.source_type,
      'source_version',NULL,'origine',CASE WHEN l.source_type='foto_cantiere' THEN 'cantiere' ELSE 'sopralluogo' END,
      'sopralluogo_id',NULL,'collegata',true,'disponibile',false,
      'impronta',encode(sha256(convert_to('fonte_non_accessibile','UTF8')),'hex'),
      'foto',jsonb_build_object('id',l.source_id,'cantiere','','nota','','immagine_base64','','allegato_v1_id',NULL))),'[]'::jsonb)
    INTO risultato FROM public.variante_fonti_visive l WHERE l.variante_id=v.id
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(risultato) x WHERE x->>'source_id'=l.source_id::text AND x->>'source_type'=l.source_type);
  END IF;
  RETURN (SELECT coalesce(jsonb_agg(x ORDER BY x->>'source_type',x->>'source_id'),'[]'::jsonb) FROM jsonb_array_elements(risultato) x);
END $$;
REVOKE ALL ON FUNCTION artecna_guardie.foto_fonti_variante(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role,artecna_rapportini_backend;

CREATE FUNCTION public.leggi_foto_fonti_variante(p_variante_id uuid,p_collegate boolean DEFAULT true)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $$
  SELECT artecna_guardie.foto_fonti_variante(artecna_guardie.utente_jwt_corrente(),p_variante_id,p_collegate)
$$;

CREATE FUNCTION public.modifica_foto_fonti_variante(p_variante_id uuid,p_fonti jsonb,p_azione text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $$
DECLARE u uuid; v public.varianti_cantiere%ROWTYPE; f jsonb; fonte uuid; tipo text;
BEGIN
  u:=artecna_guardie.utente_jwt_corrente();
  SELECT * INTO v FROM public.varianti_cantiere WHERE id=p_variante_id FOR UPDATE;
  IF u IS NULL OR NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(u,v.cantiere_id) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Variante non accessibile';
  END IF;
  IF v.stato IS DISTINCT FROM 'bozza' OR p_azione IS NULL OR p_azione NOT IN ('collega','scollega')
    OR jsonb_typeof(p_fonti) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Richiesta foto non valida';
  END IF;
  IF jsonb_array_length(p_fonti) NOT BETWEEN 1 AND 8 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Selezionare da una a otto foto'; END IF;
  FOR f IN SELECT value FROM jsonb_array_elements(p_fonti) ORDER BY value->>'source_type',value->>'source_id' LOOP
    tipo:=f->>'source_type'; fonte:=(f->>'source_id')::uuid;
    IF tipo IS NULL OR tipo NOT IN ('foto_cantiere','foto_sopralluogo') OR fonte IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identita foto non valida';
    END IF;
    IF p_azione='scollega' THEN
      -- Only the reference is deleted; never touches a parent photo or Storage.
      DELETE FROM public.variante_fonti_visive WHERE variante_id=v.id AND source_type=tipo AND source_id=fonte;
      CONTINUE;
    END IF;
    IF tipo='foto_cantiere' THEN PERFORM 1 FROM public.foto_cantiere WHERE id=fonte FOR SHARE;
    ELSE PERFORM 1 FROM public.foto_sopralluogo WHERE id=fonte FOR SHARE; END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(artecna_guardie.foto_fonti_variante(u,v.id,false)) x
      WHERE x->>'source_type'=tipo AND x->>'source_id'=fonte::text) THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Foto non accessibile nel contesto della Variante';
    END IF;
    BEGIN
      INSERT INTO public.variante_fonti_visive(variante_id,source_type,source_id) VALUES(v.id,tipo,fonte);
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='Questa foto è già collegata alla Variante';
    END;
  END LOOP;
  IF (SELECT count(*) FROM public.variante_fonti_visive WHERE variante_id=v.id)>8 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Massimo otto foto per analisi Osservatore';
  END IF;
END $$;

CREATE FUNCTION artecna_guardie.pacchetto_osservatore_variante(p_user uuid,p_variante uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp SET timezone TO 'UTC' AS $$
DECLARE v public.varianti_cantiere%ROWTYPE; quaderni jsonb; foto jsonb; manifesto jsonb;
BEGIN
  -- This helper enforces membership/bozza even when there are no photos.
  foto:=artecna_guardie.foto_fonti_variante(p_user,p_variante,true);
  SELECT * INTO STRICT v FROM public.varianti_cantiere WHERE id=p_variante;
  IF EXISTS (SELECT 1 FROM public.variante_fonti_memory l LEFT JOIN public.quaderno_progetti q ON q.id=l.source_id
    WHERE l.variante_id=v.id AND (q.id IS NULL OR q.user_id IS DISTINCT FROM p_user OR q.gestione_copia OR q.gestione_id IS NOT NULL)) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Quaderno collegato non disponibile: rileggere le fonti';
  END IF;
  IF jsonb_array_length(foto)<>(SELECT count(*) FROM public.variante_fonti_visive WHERE variante_id=v.id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Foto collegata non piu accessibile: scollegare il riferimento';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',q.id,'titolo',q.titolo,'testo',q.testo,
    'updated_at',q.updated_at,'source_version',l.source_version,'aggiornato',q.updated_at=l.source_version,'disponibile',true) ORDER BY q.id),'[]'::jsonb)
  INTO quaderni FROM public.variante_fonti_memory l JOIN public.quaderno_progetti q ON q.id=l.source_id WHERE l.variante_id=v.id;
  manifesto:=jsonb_build_object('versione',1,'variante',jsonb_build_object('source_id',v.id,
    'impronta',encode(sha256(convert_to(jsonb_build_array(v.titolo,v.descrizione)::text,'UTF8')),'hex')),
    'quaderni',(SELECT coalesce(jsonb_agg(jsonb_build_object('source_id',x->>'id','source_version',x->>'updated_at') ORDER BY x->>'id'),'[]'::jsonb) FROM jsonb_array_elements(quaderni) x),
    'foto',(SELECT coalesce(jsonb_agg(jsonb_build_object('source_id',x->>'source_id','source_type',x->>'source_type','source_version',NULL,'impronta',x->>'impronta') ORDER BY x->>'source_type',x->>'source_id'),'[]'::jsonb) FROM jsonb_array_elements(foto) x));
  manifesto:=manifesto || jsonb_build_object('firma',encode(sha256(convert_to(manifesto::text,'UTF8')),'hex'));
  RETURN jsonb_build_object('variante',jsonb_build_object('id',v.id,'stato',v.stato,'titolo',v.titolo,'descrizione',coalesce(v.descrizione,'')),
    'cantiere_id',v.cantiere_id,'quaderni',quaderni,'foto',foto,'manifesto',manifesto);
END $$;
REVOKE ALL ON FUNCTION artecna_guardie.pacchetto_osservatore_variante(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,artecna_rapportini_backend;

CREATE FUNCTION public.leggi_osservatore_variante(p_variante_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $$
DECLARE u uuid; pacchetto jsonb; a public.variante_osservatore_analisi%ROWTYPE;
BEGIN
  u:=artecna_guardie.utente_jwt_corrente();
  pacchetto:=artecna_guardie.pacchetto_osservatore_variante(u,p_variante_id);
  SELECT * INTO a FROM public.variante_osservatore_analisi WHERE variante_id=p_variante_id ORDER BY created_at DESC,id DESC LIMIT 1;
  RETURN jsonb_build_object('fonti',pacchetto,'analisi',CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id',a.id,'data',a.created_at,'modello',a.modello,'fonti',a.fonti,'risultato',a.risultato,
    'allineata',a.fonti->'manifesto'->>'firma'=pacchetto->'manifesto'->>'firma') END);
END $$;

-- Only the already authenticated server backend may persist an AI result.
-- No client-supplied text/images are accepted by the HTTP adapter; it reads the packet itself.
CREATE FUNCTION artecna_guardie.salva_osservatore_variante(p_user uuid,p_variante uuid,p_id uuid,p_fonti jsonb,p_risultato jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $$
DECLARE v public.varianti_cantiere%ROWTYPE;
BEGIN
  IF session_user <> 'artecna_rapportini_backend' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Backend richiesto'; END IF;
  SELECT * INTO v FROM public.varianti_cantiere WHERE id=p_variante FOR UPDATE;
  IF p_user IS NULL OR NOT FOUND OR v.stato IS DISTINCT FROM 'bozza'
    OR artecna_guardie.utente_puo_modificare_cantiere(p_user,v.cantiere_id) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Variante non accessibile';
  END IF;
  IF p_id IS NULL OR jsonb_typeof(p_fonti) IS DISTINCT FROM 'object' OR jsonb_typeof(p_risultato) IS DISTINCT FROM 'object'
    OR p_fonti->'manifesto'->'variante'->>'source_id' IS DISTINCT FROM p_variante::text
    OR coalesce(p_fonti->'manifesto'->>'firma','') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Risultato Osservatore non valido';
  END IF;
  IF jsonb_typeof(p_fonti->'foto_bytes') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_fonti->'manifesto'->'foto') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Provenienza immagini incompleta';
  END IF;
  IF jsonb_array_length(p_fonti->'foto_bytes')<>jsonb_array_length(p_fonti->'manifesto'->'foto')
    OR jsonb_array_length(p_fonti->'foto_bytes')>8 OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_fonti->'manifesto'->'foto') f
      WHERE (SELECT count(*) FROM jsonb_array_elements(p_fonti->'foto_bytes') b
        WHERE b->>'source_id'=f->>'source_id' AND b->>'source_type'=f->>'source_type'
          AND coalesce(b->>'sha256','') ~ '^[0-9a-f]{64}$')<>1
    ) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Provenienza immagini incoerente'; END IF;
  INSERT INTO public.variante_osservatore_analisi(id,variante_id,user_id,modello,fonti,risultato)
    VALUES(p_id,p_variante,p_user,'gpt-4.1-mini',p_fonti,p_risultato);
  RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION artecna_guardie.salva_osservatore_variante(uuid,uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA artecna_guardie TO artecna_rapportini_backend;
GRANT EXECUTE ON FUNCTION artecna_guardie.salva_osservatore_variante(uuid,uuid,uuid,jsonb,jsonb) TO artecna_rapportini_backend;

REVOKE ALL ON FUNCTION public.leggi_foto_fonti_variante(uuid,boolean) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.modifica_foto_fonti_variante(uuid,jsonb,text) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.leggi_osservatore_variante(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.leggi_foto_fonti_variante(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.modifica_foto_fonti_variante(uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leggi_osservatore_variante(uuid) TO authenticated;
COMMIT;
