-- Reader aggiuntivo: nessun cambio alla firma legacy, ai dati o alle policy.
-- Pattern certificato: leggi_raccolta_economia_cliente, owner naturale postgres.
-- Nessun trasferimento owner, SET ROLE o privilegio temporaneo.
BEGIN;
DO $$ BEGIN
 IF current_user <> 'postgres'
 OR to_regprocedure('public.leggi_identita_lavorazioni_variante(uuid)') IS NOT NULL
 OR to_regprocedure('artecna_guardie.utente_jwt_corrente()') IS NULL
 OR to_regprocedure('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)') IS NULL
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='leggi_identita_lavorazioni_variante')
 OR NOT has_schema_privilege(current_user,'public','CREATE')
 OR NOT has_schema_privilege(current_user,'artecna_guardie','USAGE')
 OR NOT has_schema_privilege('authenticated','public','USAGE')
 OR NOT has_function_privilege(current_user,'artecna_guardie.utente_jwt_corrente()','EXECUTE')
 OR NOT has_function_privilege(current_user,'artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)','EXECUTE')
 OR EXISTS(SELECT 1 FROM (VALUES ('varianti_cantiere','id'),('varianti_cantiere','cantiere_id'),('variante_lavorazioni','id'),('variante_lavorazioni','variante_id'),('variante_lavorazioni','variante_sorgente_id'),('variante_lavorazioni','indice_voce_sorgente')) t(tabella,colonna) WHERE NOT has_column_privilege(current_user,'public.'||t.tabella,t.colonna,'SELECT'))
 THEN RAISE EXCEPTION 'Prerequisiti reader identità non verificati'; END IF;
END $$;
CREATE FUNCTION public.leggi_identita_lavorazioni_variante(p_variante_id uuid)
RETURNS TABLE(id bigint,variante_id uuid,variante_sorgente_id uuid,indice_voce_sorgente integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE v_user_id uuid; v_cantiere_id uuid; v_claim_sub uuid;
BEGIN
 IF current_user <> 'postgres' THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Contesto interno RPC Varianti non valido';
 END IF;
 BEGIN
  v_user_id := artecna_guardie.utente_jwt_corrente();
  -- Il guard resta autorevole; due rappresentazioni JWT presenti devono concordare.
  v_claim_sub := nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub','')::uuid;
  IF v_claim_sub IS NOT NULL AND v_claim_sub IS DISTINCT FROM v_user_id THEN
   RAISE EXCEPTION USING ERRCODE='P2022',MESSAGE='Identità JWT incoerente';
  END IF;
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
REVOKE ALL ON FUNCTION public.leggi_identita_lavorazioni_variante(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.leggi_identita_lavorazioni_variante(uuid) TO authenticated;
COMMIT;
