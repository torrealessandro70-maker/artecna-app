-- Entry point manuale: delega integralmente autorizzazioni, lock, idempotenza,
-- residui, genealogia e lavorazioni atomiche al writer Step 5 installato.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.salva_preventivo_integrativo_generato(uuid,uuid,text,text,jsonb)') IS NULL
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='salva_preventivo_integrativo_manuale')
 THEN RAISE EXCEPTION 'Prerequisiti entry point manuale non verificati'; END IF;
 IF (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.salva_preventivo_integrativo_generato(uuid,uuid,text,text,jsonb)'::regprocedure)
 IS DISTINCT FROM 'artecna_varianti_rpc' OR has_schema_privilege('artecna_varianti_rpc','public','CREATE')
 THEN RAISE EXCEPTION 'Ownership o privilegi temporanei inattesi'; END IF;
END $$;
GRANT artecna_varianti_rpc TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY postgres;
GRANT CREATE ON SCHEMA public TO artecna_varianti_rpc;
GRANT SELECT(cliente_ai,nome_file,data_preventivo) ON public.preventivi_cantiere TO artecna_varianti_rpc;
GRANT UPDATE(origine_ai,provenienza_generazione,cliente_ai,nome_file,data_preventivo) ON public.preventivi_cantiere TO artecna_varianti_rpc;
SET ROLE artecna_varianti_rpc;
CREATE FUNCTION public.salva_preventivo_integrativo_manuale(
 p_variante_id uuid,p_richiesta_id uuid,p_firma text,p_descrizione text,p_voci jsonb,p_metadati jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE esito jsonb;
BEGIN
 IF jsonb_typeof(p_metadati) IS DISTINCT FROM 'object' OR EXISTS(
  SELECT 1 FROM jsonb_object_keys(p_metadati) k WHERE k NOT IN('cliente','titolo','data')
 ) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Metadati manuali non validi'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_metadati) m WHERE jsonb_typeof(m.value)<>'string' OR length(btrim(m.value#>>'{}'))=0)
 OR (p_metadati ? 'data' AND (p_metadati->>'data') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Completa i metadati manuali'; END IF;
 IF jsonb_typeof(p_voci) IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Voci manuali non valide';
 END IF;
 IF jsonb_array_length(p_voci)=0 OR EXISTS(
  SELECT 1 FROM jsonb_array_elements(p_voci) v WHERE v->>'origine_documento' IS DISTINCT FROM 'manuale'
 ) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Origine manuale richiesta per ogni voce'; END IF;
 esito:=public.salva_preventivo_integrativo_generato(p_variante_id,p_richiesta_id,p_firma,p_descrizione,p_voci);
 IF (esito->>'gia_salvato')::boolean THEN
  IF NOT EXISTS(SELECT 1 FROM public.preventivi_cantiere WHERE id=p_richiesta_id
   AND provenienza_generazione->'metadati_manuali'=p_metadati AND provenienza_generazione->>'origine'='manuale')
  THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='Richiesta manuale già utilizzata con metadati diversi'; END IF;
  RETURN esito;
 END IF;
 UPDATE public.preventivi_cantiere SET origine_ai=false,
  cliente_ai=coalesce(p_metadati->>'cliente',cliente_ai),nome_file=coalesce(p_metadati->>'titolo',nome_file),
  data_preventivo=coalesce((p_metadati->>'data')::date,data_preventivo),
  provenienza_generazione=provenienza_generazione||jsonb_build_object('origine','manuale','metadati_manuali',p_metadati)
 WHERE id=p_richiesta_id AND variante_id=p_variante_id AND natura='integrativo';
 IF NOT FOUND THEN RAISE EXCEPTION 'Documento manuale non confermato'; END IF;
 RETURN esito;
END $$;
REVOKE ALL ON FUNCTION public.salva_preventivo_integrativo_manuale(uuid,uuid,text,text,jsonb,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.salva_preventivo_integrativo_manuale(uuid,uuid,text,text,jsonb,jsonb) TO authenticated;
RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM artecna_varianti_rpc;
REVOKE artecna_varianti_rpc FROM postgres GRANTED BY postgres RESTRICT;
COMMIT;
