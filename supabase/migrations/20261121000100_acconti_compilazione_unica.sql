-- CANDIDATA LOCALE: richiede autorizzazione separata prima dell'applicazione.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='3s';
DO $$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR to_regprocedure('artecna_contabilita.proteggi_incassi_lordi()') IS NULL
 OR (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
 IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()]
 THEN RAISE EXCEPTION 'Prerequisiti o sigillo Hard Delete divergenti'; END IF;
END $$;
ALTER TABLE public.acconti_cantiere ADD COLUMN compilazione_unica jsonb;
CREATE FUNCTION artecna_contabilita.acconto_compilazione_documentato(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT EXISTS(SELECT FROM artecna_contabilita.acconti_fiscali WHERE acconto_id=p_id AND stato IN('incassato','stornato'))
  OR EXISTS(SELECT FROM artecna_contabilita.incassi_lordi_clienti WHERE acconto_id=p_id)
  OR EXISTS(SELECT FROM artecna_contabilita.imputazioni_acconti WHERE acconto_id=p_id)
  OR EXISTS(SELECT FROM artecna_contabilita.attribuzioni_clienti WHERE acconto_id=p_id AND scollegato_at IS NULL)
$$;
REVOKE ALL ON FUNCTION artecna_contabilita.acconto_compilazione_documentato(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION artecna_contabilita.proteggi_compilazione_acconto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF (OLD.importo,OLD.data_incasso,OLD.metodo,OLD.cantiere_id) IS DISTINCT FROM (NEW.importo,NEW.data_incasso,NEW.metodo,NEW.cantiere_id) THEN
  IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Isolamento non compatibile' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(714028,1);
  IF artecna_contabilita.acconto_compilazione_documentato(OLD.id) THEN
   RAISE EXCEPTION 'Acconto documentato: rettifica esplicita richiesta' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION artecna_contabilita.proteggi_compilazione_acconto() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER acconto_compilazione_guard BEFORE UPDATE OF importo,data_incasso,metodo,cantiere_id ON public.acconti_cantiere
 FOR EACH ROW EXECUTE FUNCTION artecna_contabilita.proteggi_compilazione_acconto();
CREATE FUNCTION public.salva_acconto_compilazione(p_richiesta uuid,p_id uuid,p_cantiere uuid,p_originale jsonb,p_modifiche jsonb,p_proposta jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a public.acconti_cantiere; b public.acconti_cantiere; u uuid:=artecna_guardie.utente_jwt_corrente();
 input jsonb:=jsonb_build_array(p_cantiere,p_originale,p_modifiche,p_proposta); sensibile boolean; nome text; assegnazioni text;
BEGIN
 IF p_richiesta IS NULL OR p_id IS NULL OR u IS NULL
 OR artecna_guardie.utente_puo_operare_impresa(u) IS DISTINCT FROM true
 OR artecna_guardie.utente_puo_modificare_cantiere(u,p_cantiere) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Acconto non autorizzato' USING ERRCODE='42501'; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Isolamento non compatibile' USING ERRCODE='22023'; END IF;
 -- Stesso lock dello stato fiscale e stesso row lock dei writer finanziari.
 PERFORM pg_advisory_xact_lock(714028,1);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,210001));
 SELECT * INTO a FROM public.acconti_cantiere WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF a.cantiere_id IS DISTINCT FROM p_cantiere THEN RAISE EXCEPTION 'Contesto divergente' USING ERRCODE='42501'; END IF;
  IF a.compilazione_unica->>'richiesta'=p_richiesta::text THEN
   IF a.compilazione_unica->'input' IS DISTINCT FROM input THEN RAISE EXCEPTION 'Richiesta riutilizzata' USING ERRCODE='23505'; END IF;
   RETURN to_jsonb(a);
  END IF;
  IF p_originale IS DISTINCT FROM jsonb_build_array(a.descrizione,a.importo,a.data_incasso,a.metodo,a.nota,a.compilazione_unica->>'richiesta')
  THEN RAISE EXCEPTION 'Acconto cambiato: rileggere senza ripetere il salvataggio' USING ERRCODE='40001'; END IF;
 ELSE
  IF p_originale IS NOT NULL THEN RAISE EXCEPTION 'Acconto non disponibile' USING ERRCODE='40001'; END IF;
  SELECT c.nome INTO STRICT nome FROM public.cantieri c WHERE c.id=p_cantiere;
  a.id:=p_id;a.cantiere_id:=p_cantiere;a.cantiere:=nome;
 END IF;
 IF jsonb_typeof(p_modifiche) IS DISTINCT FROM 'object' OR EXISTS(SELECT FROM jsonb_object_keys(p_modifiche) k WHERE k NOT IN('descrizione','importo','data_incasso','metodo','nota'))
 THEN RAISE EXCEPTION 'Campi non ammessi' USING ERRCODE='22023'; END IF;
 b:=jsonb_populate_record(a,p_modifiche);
 sensibile:=(a.importo,a.data_incasso,a.metodo) IS DISTINCT FROM (b.importo,b.data_incasso,b.metodo);
 IF (p_originale IS NULL OR sensibile) AND (b.importo IS NULL OR b.importo<=0 OR b.importo>=1e10 OR b.importo<>round(b.importo,2))
 OR b.data_incasso IS NOT NULL AND NOT isfinite(b.data_incasso)
 OR coalesce(length(b.descrizione),0)>500 OR coalesce(length(b.nota),0)>4000 OR coalesce(length(b.metodo),0)>100
 THEN RAISE EXCEPTION 'Importo, data o testo non validi' USING ERRCODE='22023'; END IF;
 IF p_originale IS NOT NULL AND (sensibile OR p_proposta IS NOT NULL AND p_proposta IS DISTINCT FROM a.compilazione_unica->'proposta') AND (
  artecna_contabilita.acconto_compilazione_documentato(p_id))
 THEN RAISE EXCEPTION 'Dati documentati: usare i percorsi di rettifica fiscali e finanziari; descrizione e note restano modificabili' USING ERRCODE='23514'; END IF;
 IF p_proposta IS NOT NULL THEN
  IF jsonb_typeof(p_proposta) IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_proposta->'lordo') IS DISTINCT FROM 'number'
  OR jsonb_typeof(p_proposta->'aliquota') IS DISTINCT FROM 'number'
  OR (p_proposta->>'aliquota')::numeric NOT IN(0,4,5,10,22)
  OR (p_proposta->>'lordo')::numeric<=0 OR (p_proposta->>'lordo')::numeric>=1e10
  OR (p_proposta->>'lordo')::numeric<>round((p_proposta->>'lordo')::numeric,2)
  OR b.importo IS DISTINCT FROM round((p_proposta->>'lordo')::numeric/(1+(p_proposta->>'aliquota')::numeric/100),2)
  THEN RAISE EXCEPTION 'Proposta IVA incoerente' USING ERRCODE='22023'; END IF;
 END IF;
 -- Una proposta è compilazione persistita, NON una conferma fiscale o un incasso.
 b.compilazione_unica:=jsonb_build_object('richiesta',p_richiesta,'input',input,'proposta',
  CASE WHEN p_proposta IS NOT NULL THEN p_proposta
   WHEN NOT sensibile THEN a.compilazione_unica->'proposta' ELSE NULL END,
  'fonte',jsonb_build_array(b.importo,b.data_incasso,b.metodo));
 IF p_originale IS NULL THEN
  INSERT INTO public.acconti_cantiere(id,cantiere_id,cantiere,descrizione,importo,data_incasso,metodo,nota,compilazione_unica)
  VALUES(b.id,b.cantiere_id,b.cantiere,b.descrizione,b.importo,b.data_incasso,b.metodo,b.nota,b.compilazione_unica);
 ELSE
  SELECT string_agg(format('%I=($1->>%L)::%s',k,k,CASE k WHEN 'importo' THEN 'numeric' WHEN 'data_incasso' THEN 'date' ELSE 'text' END),',' ORDER BY k)
  INTO assegnazioni FROM jsonb_object_keys(p_modifiche) k WHERE to_jsonb(a)->k IS DISTINCT FROM to_jsonb(b)->k;
  EXECUTE 'UPDATE public.acconti_cantiere SET '||coalesce(assegnazioni||',','')||'compilazione_unica=$2 WHERE id=$3'
  USING p_modifiche,b.compilazione_unica,p_id;
 END IF;
 SELECT * INTO STRICT b FROM public.acconti_cantiere WHERE id=p_id;
 RETURN to_jsonb(b);
END $$;
CREATE FUNCTION public.leggi_acconto_compilazione(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a public.acconti_cantiere; f artecna_contabilita.acconti_fiscali;
BEGIN
 PERFORM artecna_contabilita.autorizza_acconto_fiscale(p_id);
 SELECT * INTO STRICT a FROM public.acconti_cantiere WHERE id=p_id;
 SELECT * INTO f FROM artecna_contabilita.acconti_fiscali WHERE acconto_id=p_id ORDER BY revisione DESC LIMIT 1;
 RETURN jsonb_build_object('acconto',to_jsonb(a),'documentato',
  artecna_contabilita.acconto_compilazione_documentato(p_id),
  'regime',f.regime,'coerente',f.fonte=artecna_contabilita.fonte_acconto(a));
END $$;
REVOKE ALL ON FUNCTION public.salva_acconto_compilazione(uuid,uuid,uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.salva_acconto_compilazione(uuid,uuid,uuid,jsonb,jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.leggi_acconto_compilazione(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.leggi_acconto_compilazione(uuid) TO authenticated;
UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog();
COMMIT;
