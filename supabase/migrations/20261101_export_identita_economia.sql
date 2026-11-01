-- Reader aggiuntivo: nessun cambio alla firma legacy, ai dati o alle policy.
BEGIN;
DO $$ BEGIN
 IF current_user <> 'postgres'
 OR to_regprocedure('public.leggi_identita_lavorazioni_variante(uuid)') IS NOT NULL
 OR to_regprocedure('artecna_guardie.utente_jwt_corrente()') IS NULL
 OR to_regprocedure('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)') IS NULL
 OR NOT has_column_privilege('artecna_varianti_rpc','public.variante_lavorazioni','variante_sorgente_id','SELECT')
 OR NOT has_column_privilege('artecna_varianti_rpc','public.variante_lavorazioni','indice_voce_sorgente','SELECT')
 THEN RAISE EXCEPTION 'Prerequisiti reader identità non verificati'; END IF;
END $$;
CREATE FUNCTION public.leggi_identita_lavorazioni_variante(p_variante_id uuid)
RETURNS TABLE(id bigint,variante_id uuid,variante_sorgente_id uuid,indice_voce_sorgente integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v_user_id uuid; v_cantiere_id uuid;
BEGIN
 IF current_user <> 'artecna_varianti_rpc' THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Contesto interno RPC Varianti non valido';
 END IF;
 BEGIN v_user_id := artecna_guardie.utente_jwt_corrente();
 EXCEPTION WHEN invalid_text_representation THEN
  RAISE EXCEPTION USING ERRCODE='P2022',MESSAGE='Identità utente non valida';
 END;
 IF v_user_id IS NULL OR p_variante_id IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='P2022',MESSAGE='Identità utente e variante sono obbligatorie';
 END IF;
 SELECT v.cantiere_id INTO v_cantiere_id FROM public.varianti_cantiere v WHERE v.id=p_variante_id;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user_id,v_cantiere_id) IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION USING ERRCODE='P2024',MESSAGE='Variante non disponibile o non autorizzata';
 END IF;
 RETURN QUERY SELECT l.id,l.variante_id,l.variante_sorgente_id,l.indice_voce_sorgente
 FROM public.variante_lavorazioni l WHERE l.variante_id=p_variante_id ORDER BY l.id;
END $$;
ALTER FUNCTION public.leggi_identita_lavorazioni_variante(uuid) OWNER TO artecna_varianti_rpc;
REVOKE ALL ON FUNCTION public.leggi_identita_lavorazioni_variante(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.leggi_identita_lavorazioni_variante(uuid) TO authenticated;
COMMIT;
