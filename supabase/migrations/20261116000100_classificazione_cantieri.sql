BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
LOCK TABLE artecna_distruzione.hard_delete_catalog_expected IN EXCLUSIVE MODE;
DO $check$
BEGIN
  IF (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
     IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()]
  THEN RAISE EXCEPTION 'Baseline Hard Delete V3 divergente'; END IF;
END
$check$;

ALTER TABLE public.cantieri
  ADD COLUMN destinazione_amministrativa text CHECK (destinazione_amministrativa IN ('cantiere_lavori','archivio_acquisti_personali')),
  ADD COLUMN fase_lavori text CHECK (fase_lavori IN ('in_programma','in_corso'));

CREATE FUNCTION artecna_guardie.proteggi_classificazione_cantiere()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.destinazione_amministrativa IS NOT NULL OR NEW.fase_lavori IS NOT NULL THEN
      RAISE EXCEPTION 'Salvare la classificazione sul cantiere esistente' USING ERRCODE='42501';
    END IF;
  ELSIF (NEW.destinazione_amministrativa, NEW.fase_lavori) IS DISTINCT FROM
        (OLD.destinazione_amministrativa, OLD.fase_lavori)
    AND current_user <> (
      SELECT pg_get_userbyid(proowner) FROM pg_proc
      WHERE oid='public.salva_classificazione_cantiere(uuid,text,text,boolean,text,text,boolean)'::regprocedure
    )
  THEN
    RAISE EXCEPTION 'Classificazione non autorizzata' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION artecna_guardie.proteggi_classificazione_cantiere() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER cantieri_classificazione_guardia
  BEFORE INSERT OR UPDATE OF destinazione_amministrativa,fase_lavori ON public.cantieri
  FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_classificazione_cantiere();

CREATE FUNCTION public.salva_classificazione_cantiere(
  p_id uuid, p_attesa_destinazione text, p_attesa_fase text, p_attesa_concluso boolean,
  p_destinazione text, p_stato text, p_conferma_destinazione boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE
  u uuid := artecna_guardie.utente_jwt_corrente();
  c public.cantieri;
BEGIN
  IF artecna_guardie.utente_puo_modificare_cantiere(u,p_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Classificazione non autorizzata' USING ERRCODE='42501';
  END IF;
  SELECT * INTO c FROM public.cantieri WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(u,p_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Classificazione non autorizzata' USING ERRCODE='42501';
  END IF;
  IF (c.destinazione_amministrativa,c.fase_lavori,c.lavori_conclusi) IS DISTINCT FROM
     (p_attesa_destinazione,p_attesa_fase,p_attesa_concluso) THEN
    RAISE EXCEPTION 'Classificazione cambiata: riaprire il cantiere' USING ERRCODE='40001';
  END IF;
  IF (p_destinazione IS NOT NULL AND p_destinazione NOT IN ('cantiere_lavori','archivio_acquisti_personali'))
     OR coalesce(p_stato,'') NOT IN ('mantieni','in_programma','in_corso','concluso','da_precisare')
     OR (p_destinazione IS DISTINCT FROM 'cantiere_lavori' AND p_stato <> 'mantieni')
     OR (p_destinazione IS DISTINCT FROM c.destinazione_amministrativa AND p_conferma_destinazione IS DISTINCT FROM true) THEN
    RAISE EXCEPTION 'Classificazione o conferma non valida' USING ERRCODE='22023';
  END IF;
  UPDATE public.cantieri SET destinazione_amministrativa=p_destinazione,
    fase_lavori=CASE WHEN p_stato IN ('in_programma','in_corso') THEN p_stato
                   WHEN p_stato='da_precisare' THEN NULL ELSE c.fase_lavori END,
    lavori_conclusi=CASE WHEN p_stato='concluso' THEN true
                       WHEN p_stato IN ('in_programma','in_corso') THEN false
                       WHEN p_stato='da_precisare' AND c.lavori_conclusi IS TRUE THEN false
                       ELSE c.lavori_conclusi END
  WHERE id=p_id RETURNING * INTO c;
  RETURN jsonb_build_object('id',c.id,'destinazione_amministrativa',c.destinazione_amministrativa,
                            'fase_lavori',c.fase_lavori,'lavori_conclusi',c.lavori_conclusi);
END
$$;
REVOKE ALL ON FUNCTION public.salva_classificazione_cantiere(uuid,text,text,boolean,text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.salva_classificazione_cantiere(uuid,text,text,boolean,text,text,boolean) TO authenticated;

UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog();
COMMIT;
