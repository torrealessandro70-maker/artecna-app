-- Memoria globale: nessuna policy pubblica. Il reader riusa il guard aziendale.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres'
 OR to_regprocedure('artecna_guardie.utente_jwt_corrente()') IS NULL
 OR to_regprocedure('artecna_guardie.utente_puo_operare_impresa(uuid)') IS NULL
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='leggi_memoria_prezzi_preventivo')
 THEN RAISE EXCEPTION 'Prerequisiti reader Memoria prezzi non verificati'; END IF;
END $$;
CREATE FUNCTION public.leggi_memoria_prezzi_preventivo(p_da integer DEFAULT 0,p_limite integer DEFAULT 500)
RETURNS TABLE(id uuid,descrizione text,unita_misura text,prezzo_unitario numeric,fonte text,creato_il timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF NOT coalesce(artecna_guardie.utente_puo_operare_impresa(artecna_guardie.utente_jwt_corrente()),false)
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Memoria prezzi riservata al titolare autorizzato'; END IF;
 IF p_da IS NULL OR p_limite IS NULL OR p_da<0 OR p_limite<1 OR p_limite>500
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Paginazione Memoria prezzi non valida'; END IF;
 RETURN QUERY SELECT m.id,m.descrizione,m.unita_misura,m.prezzo_unitario,m.fonte,m.creato_il
 FROM public.memoria_prezzi m WHERE m.prezzo_unitario>0
 ORDER BY m.creato_il ASC NULLS LAST,m.id ASC OFFSET p_da LIMIT p_limite;
END $$;
REVOKE ALL ON FUNCTION public.leggi_memoria_prezzi_preventivo(integer,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.leggi_memoria_prezzi_preventivo(integer,integer) TO authenticated;
COMMIT;
