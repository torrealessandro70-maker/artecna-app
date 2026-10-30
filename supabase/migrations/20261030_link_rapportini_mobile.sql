BEGIN;

DO $$
BEGIN
 IF current_user <> 'postgres'
 OR to_regclass('public.impostazioni_app') IS NULL
 OR to_regprocedure('artecna_guardie.utente_jwt_corrente()') IS NULL
 OR to_regprocedure('artecna_guardie.utente_puo_operare_impresa(uuid)') IS NULL
 OR NOT has_schema_privilege(current_user,'public','CREATE')
 OR NOT has_table_privilege(current_user,'public.impostazioni_app','TRIGGER')
 THEN RAISE EXCEPTION 'Prerequisiti impostazioni/guard/principal non verificati'; END IF;
 IF EXISTS(SELECT 1 FROM public.impostazioni_app WHERE chiave='rapportini_mobile_url')
 THEN RAISE EXCEPTION 'Chiave portale già presente: verificare prima di applicare'; END IF;
END $$;

CREATE FUNCTION public.link_rapportini_mobile_url_valido(p_url text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT coalesce(p_url IS NOT NULL AND p_url=btrim(p_url) AND length(p_url) BETWEEN 1 AND 2048
 AND p_url !~ '[[:space:][:cntrl:]]' AND position(chr(92) in p_url)=0
 AND ((left(p_url,1)='/' AND left(p_url,2)<>'//')
   OR p_url ~* '^https://[^/?#@[:space:]]+([/?#].*)?$'),false)
$$;

-- Solo la nuova chiave è protetta. Le altre impostazioni conservano il comportamento esistente.
CREATE FUNCTION public.proteggi_link_rapportini_mobile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE protetta boolean;
BEGIN
 IF TG_OP='TRUNCATE' THEN
  IF EXISTS(SELECT 1 FROM public.impostazioni_app WHERE chiave='rapportini_mobile_url')
  THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Impostazione portale protetta: TRUNCATE non consentito'; END IF;
  RETURN NULL;
 END IF;
 protetta := CASE WHEN TG_OP='INSERT' THEN NEW.chiave='rapportini_mobile_url'
  WHEN TG_OP='DELETE' THEN OLD.chiave='rapportini_mobile_url'
  ELSE OLD.chiave='rapportini_mobile_url' OR NEW.chiave='rapportini_mobile_url' END;
 IF protetta THEN
  IF artecna_guardie.utente_puo_operare_impresa(artecna_guardie.utente_jwt_corrente()) IS NOT TRUE
  THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Modifica link riservata al titolare attivo'; END IF;
  IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.chiave IS DISTINCT FROM OLD.chiave)
  THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Identità impostazione portale non modificabile'; END IF;
  IF TG_OP<>'DELETE' AND public.link_rapportini_mobile_url_valido(NEW.valore) IS NOT TRUE
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Link portale non valido'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER impostazioni_link_rapportini_guard BEFORE INSERT OR UPDATE OR DELETE ON public.impostazioni_app
 FOR EACH ROW EXECUTE FUNCTION public.proteggi_link_rapportini_mobile();
CREATE TRIGGER impostazioni_link_rapportini_truncate BEFORE TRUNCATE ON public.impostazioni_app
 FOR EACH STATEMENT EXECUTE FUNCTION public.proteggi_link_rapportini_mobile();

CREATE FUNCTION public.leggi_link_rapportini_mobile() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; v text; presente boolean;
BEGIN
 u := artecna_guardie.utente_jwt_corrente();
 IF u IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso gestionale richiesto'; END IF;
 SELECT valore INTO v FROM public.impostazioni_app WHERE chiave='rapportini_mobile_url';
 presente := FOUND;
 RETURN jsonb_build_object('url',CASE WHEN presente THEN v ELSE '/rapportino' END,
  'configurato',presente,'modificabile',coalesce(artecna_guardie.utente_puo_operare_impresa(u),false));
END $$;

CREATE FUNCTION public.salva_link_rapportini_mobile(p_url text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; v text := btrim(p_url); prossimo bigint;
BEGIN
 u := artecna_guardie.utente_jwt_corrente();
 IF u IS NULL OR artecna_guardie.utente_puo_operare_impresa(u) IS NOT TRUE
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Modifica link riservata al titolare attivo'; END IF;
 IF public.link_rapportini_mobile_url_valido(v) IS NOT TRUE
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Link portale non valido'; END IF;
 -- L'archivio esistente non ha un default su id: nessuna nuova sequenza o tabella.
 -- Il lock serializza anche i writer legacy durante il primo inserimento della chiave.
 LOCK TABLE public.impostazioni_app IN SHARE ROW EXCLUSIVE MODE;
 UPDATE public.impostazioni_app SET valore=v WHERE chiave='rapportini_mobile_url' RETURNING valore INTO v;
 IF NOT FOUND THEN
  SELECT coalesce(max(id),0)+1 INTO prossimo FROM public.impostazioni_app;
  v := btrim(p_url);
  INSERT INTO public.impostazioni_app(id,chiave,valore) VALUES(prossimo,'rapportini_mobile_url',v) RETURNING valore INTO v;
 END IF;
 RETURN jsonb_build_object('url',v,'configurato',true,'modificabile',true);
END $$;

REVOKE ALL ON FUNCTION public.link_rapportini_mobile_url_valido(text),public.proteggi_link_rapportini_mobile(),
 public.leggi_link_rapportini_mobile(),public.salva_link_rapportini_mobile(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.leggi_link_rapportini_mobile(),public.salva_link_rapportini_mobile(text) TO authenticated;

COMMIT;
