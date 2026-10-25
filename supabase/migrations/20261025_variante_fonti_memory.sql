-- References only. No Quaderno content, files, economic lines or AI output copied.
BEGIN;
DO $$ BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Installazione riservata a postgres';
  END IF;
  IF to_regprocedure('artecna_guardie.utente_jwt_corrente()') IS NULL
    OR to_regprocedure('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Guardie autorizzative assenti';
  END IF;
END $$;

-- One server-owned revision token for every writer, including direct REST PATCH.
-- Only the five persisted document fields are content. Management flags are not.
CREATE FUNCTION public.quaderno_versione_contenuto() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $$
BEGIN
  NEW.created_at := OLD.created_at;
  IF ROW(NEW.titolo,NEW.testo,NEW.checklist,NEW.disegni,NEW.analisi_ai)
    IS DISTINCT FROM ROW(OLD.titolo,OLD.testo,OLD.checklist,OLD.disegni,OLD.analisi_ai) THEN
    NEW.updated_at := CASE WHEN isfinite(OLD.updated_at)
      THEN greatest(clock_timestamp(),OLD.updated_at + interval '1 microsecond')
      ELSE clock_timestamp() END;
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.quaderno_versione_contenuto() FROM PUBLIC,anon,authenticated,service_role;
-- Existing quaderno_progetto_gestione runs first alphabetically; its locks/guards stay authoritative.
CREATE TRIGGER quaderno_progetto_versione_contenuto
BEFORE UPDATE ON public.quaderno_progetti
FOR EACH ROW EXECUTE FUNCTION public.quaderno_versione_contenuto();

CREATE TABLE public.variante_fonti_memory (
  variante_id uuid NOT NULL REFERENCES public.varianti_cantiere(id) ON DELETE CASCADE,
  source_type text NOT NULL DEFAULT 'quaderno' CHECK (source_type = 'quaderno'),
  source_id uuid NOT NULL REFERENCES public.quaderno_progetti(id) ON DELETE CASCADE,
  source_version timestamptz NOT NULL CHECK (isfinite(source_version)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (variante_id, source_type, source_id)
);
CREATE INDEX variante_fonti_memory_sorgente_idx ON public.variante_fonti_memory(source_id);
ALTER TABLE public.variante_fonti_memory ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.variante_fonti_memory FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.variante_fonti_memory IS
  'Riferimenti vivi, non snapshot immutabili. Eliminare una fonte in archivio rimuove il riferimento; scollegarla non modifica la fonte.';

CREATE FUNCTION public.leggi_fonti_memory_variante(p_variante_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $$
DECLARE u uuid; v public.varianti_cantiere%ROWTYPE; risultato jsonb;
BEGIN
  u := artecna_guardie.utente_jwt_corrente();
  SELECT * INTO v FROM public.varianti_cantiere WHERE id=p_variante_id;
  IF u IS NULL OR NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(u,v.cantiere_id) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Variante non accessibile';
  END IF;
  IF v.stato IS DISTINCT FROM 'bozza' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Fonti disponibili solo in bozza';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'titolo',q.titolo,'testo',q.testo,'updated_at',q.updated_at,
    'source_version',f.source_version,'aggiornato',q.updated_at=f.source_version,
    'disponibile',q.gestione_id IS NULL) ORDER BY q.id),'[]'::jsonb)
  INTO risultato FROM public.variante_fonti_memory f
  JOIN public.quaderno_progetti q ON q.id=f.source_id
  WHERE f.variante_id=v.id AND q.user_id=u AND NOT q.gestione_copia;
  RETURN risultato;
END $$;

CREATE FUNCTION public.modifica_fonte_memory_variante(
  p_variante_id uuid, p_source_id uuid, p_azione text, p_versione timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $$
DECLARE u uuid; v public.varianti_cantiere%ROWTYPE; q public.quaderno_progetti%ROWTYPE;
BEGIN
  u := artecna_guardie.utente_jwt_corrente();
  SELECT * INTO v FROM public.varianti_cantiere WHERE id=p_variante_id FOR UPDATE;
  IF u IS NULL OR NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(u,v.cantiere_id) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Variante non accessibile';
  END IF;
  IF v.stato IS DISTINCT FROM 'bozza' OR p_azione IS NULL OR p_azione NOT IN ('collega','scollega','aggiorna') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Azione non consentita';
  END IF;
  SELECT * INTO q FROM public.quaderno_progetti
    WHERE id=p_source_id AND user_id=u AND NOT gestione_copia FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Quaderno non accessibile';
  END IF;
  IF p_azione='scollega' THEN
    DELETE FROM public.variante_fonti_memory WHERE variante_id=v.id AND source_id=q.id;
    RETURN;
  END IF;
  IF q.gestione_id IS NOT NULL OR p_versione IS NULL OR NOT isfinite(p_versione)
    OR q.updated_at IS DISTINCT FROM p_versione THEN
    RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Rileggere la versione corrente del Quaderno';
  END IF;
  IF p_azione='collega' THEN
    BEGIN
      INSERT INTO public.variante_fonti_memory(variante_id,source_id,source_version)
      VALUES(v.id,q.id,q.updated_at);
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION USING ERRCODE='23505',
        MESSAGE='Questo Quaderno è già collegato alla Variante';
    END;
  ELSE
    UPDATE public.variante_fonti_memory SET source_version=q.updated_at
    WHERE variante_id=v.id AND source_id=q.id;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Collegamento assente'; END IF;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.leggi_fonti_memory_variante(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.modifica_fonte_memory_variante(uuid,uuid,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.leggi_fonti_memory_variante(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.modifica_fonte_memory_variante(uuid,uuid,text,timestamptz) TO authenticated;
COMMIT;
