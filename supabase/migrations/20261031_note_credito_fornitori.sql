BEGIN;

-- Prerequisiti fail-stop: nessuna concessione di privilegi in questa migrazione.
-- Owner e corpi sono quelli acquisiti nel precheck TD04; nessun patch dinamico.
DO $td04_prereq$
BEGIN
  IF current_user<>'postgres'
    OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('artecna_distruzione.inizia_contesto(uuid)') AND pg_get_userbyid(proowner)='postgres' AND md5(pg_get_functiondef(oid))='173a6012f8d8c7c7f34e80d945c2bda3')
    OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.elimina_cantiere_definitivamente(uuid,text)') AND pg_get_userbyid(proowner)='artecna_cantieri_delete_rpc' AND md5(pg_get_functiondef(oid))='7ecd6cda40d8a97531f949effc779238') THEN
    RAISE EXCEPTION 'Baseline cleanup TD04 divergente: nessuna applicazione' USING ERRCODE='55000';
  END IF;
  IF NOT pg_has_role(current_user,'artecna_cantieri_delete_rpc','SET')
    OR NOT has_schema_privilege('artecna_cantieri_delete_rpc','public','CREATE') THEN
    RAISE EXCEPTION 'Installazione cleanup TD04: SET owner e CREATE schema public richiesti, non concessi dalla migrazione' USING ERRCODE='42501';
  END IF;
END $td04_prereq$;



-- Registro aggiuntivo: nessuna riscrittura delle quote o dei documenti storici.
CREATE TABLE public.fornitori_rettifiche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id uuid NOT NULL REFERENCES public.fatture_fornitori(id) ON DELETE RESTRICT,
  nota_riga_id uuid NOT NULL REFERENCES public.fatture_fornitori_righe(id) ON DELETE RESTRICT,
  origine_id uuid NOT NULL REFERENCES public.fatture_fornitori(id) ON DELETE RESTRICT,
  origine_riga_id uuid NOT NULL REFERENCES public.fatture_fornitori_righe(id) ON DELETE RESTRICT,
  economia_riga_id uuid REFERENCES public.economia_righe(id) ON DELETE RESTRICT,
  materiale_cantiere_id uuid REFERENCES public.materiali_cantiere(id) ON DELETE RESTRICT,
  materiale_impresa_id uuid REFERENCES public.materiali_impresa(id) ON DELETE RESTRICT,
  spesa_impresa_id uuid REFERENCES public.spese_impresa(id) ON DELETE RESTRICT,
  cantiere_id uuid REFERENCES public.cantieri(id) ON DELETE RESTRICT,
  categoria text NOT NULL CHECK (btrim(categoria)<>''),
  quantita numeric(18,6) NOT NULL CHECK (quantita > 0),
  importo_netto numeric(18,2) NOT NULL CHECK (importo_netto < 0),
  importo_costo numeric(18,2) NOT NULL CHECK (importo_costo < 0),
  data_nota date NOT NULL,
  richiesta_id uuid NOT NULL,
  richiesta jsonb NOT NULL,
  fotografia jsonb NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (nota_id <> origine_id AND nota_riga_id <> origine_riga_id),
  CHECK (num_nonnulls(economia_riga_id, materiale_cantiere_id, materiale_impresa_id, spesa_impresa_id) = 1)
);
CREATE INDEX fornitori_rettifiche_nota ON public.fornitori_rettifiche(nota_id, nota_riga_id);
CREATE INDEX fornitori_rettifiche_origine ON public.fornitori_rettifiche(origine_id, origine_riga_id);
CREATE INDEX fornitori_rettifiche_periodo ON public.fornitori_rettifiche(cantiere_id,data_nota);
CREATE INDEX fornitori_rettifiche_richiesta ON public.fornitori_rettifiche(richiesta_id);
ALTER TABLE public.fornitori_rettifiche ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fornitori_rettifiche FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION artecna_guardie.nc_testo(p_xml xml, p_path text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT valore FROM XMLTABLE('.' PASSING p_xml COLUMNS valore text PATH p_path)
$$;

CREATE FUNCTION artecna_guardie.nc_xml(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, pg_temp AS $$
DECLARE f public.fatture_fornitori%ROWTYPE; x xml; g xml; r xml; rie xml;
  righe jsonb := '[]'; riferimenti jsonb := '[]'; imponibile numeric := 0; iva numeric := 0;
BEGIN
  SELECT * INTO STRICT f FROM public.fatture_fornitori WHERE id = p_id;
  IF nullif(btrim(f.xml_testo), '') IS NULL OR f.xml_testo ~* '<!DOCTYPE|<!ENTITY' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='XML originale verificabile non disponibile';
  END IF;
  x := xmlparse(document f.xml_testo);
  IF coalesce(artecna_guardie.nc_testo(x,'//*[local-name()="CedentePrestatore"]//*[local-name()="IdFiscaleIVA"]/*[local-name()="IdPaese"]'),'') !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'Paese identificativo IVA non verificabile nell’XML' USING ERRCODE='22023';
  END IF;
  IF cardinality(xpath('//*[local-name()="FatturaElettronicaBody"]',x)) <> 1 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='XML con numero di documenti non supportato';
  END IF;
  g := (xpath('//*[local-name()="DatiGeneraliDocumento"]',x))[1];
  IF artecna_guardie.nc_testo(g,'/*/*[local-name()="Divisa"]') IS DISTINCT FROM 'EUR' THEN
    RAISE EXCEPTION 'Divisa XML non EUR o non disponibile: nessuna conversione automatica' USING ERRCODE='22023';
  END IF;
  FOR r IN SELECT unnest(xpath('//*[local-name()="DettaglioLinee"]',x)) LOOP
    righe := righe || jsonb_build_array(jsonb_build_object(
      'numero', artecna_guardie.nc_testo(r,'/*/*[local-name()="NumeroLinea"]'),
      'descrizione', artecna_guardie.nc_testo(r,'/*/*[local-name()="Descrizione"]'),
      'quantita', coalesce(artecna_guardie.nc_testo(r,'/*/*[local-name()="Quantita"]'),'1'),
      'prezzo', artecna_guardie.nc_testo(r,'/*/*[local-name()="PrezzoUnitario"]'),
      'totale', artecna_guardie.nc_testo(r,'/*/*[local-name()="PrezzoTotale"]'),
      'iva', artecna_guardie.nc_testo(r,'/*/*[local-name()="AliquotaIVA"]'),
      'natura', artecna_guardie.nc_testo(r,'/*/*[local-name()="Natura"]')));
  END LOOP;
  FOR r IN SELECT unnest(xpath('//*[local-name()="DatiFattureCollegate"]',x)) LOOP
    riferimenti := riferimenti || jsonb_build_array(jsonb_build_object(
      'numero', artecna_guardie.nc_testo(r,'/*/*[local-name()="IdDocumento"]'),
      'data', artecna_guardie.nc_testo(r,'/*/*[local-name()="Data"]'),
      'linee', to_jsonb(xpath('/*/*[local-name()="RiferimentoNumeroLinea"]/text()',r)::text[])));
  END LOOP;
  IF cardinality(xpath('//*[local-name()="DatiRiepilogo"]',x)) = 0 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Riepilogo IVA XML mancante';
  END IF;
  FOR rie IN SELECT unnest(xpath('//*[local-name()="DatiRiepilogo"]',x)) LOOP
    imponibile := imponibile + artecna_guardie.nc_testo(rie,'/*/*[local-name()="ImponibileImporto"]')::numeric;
    iva := iva + artecna_guardie.nc_testo(rie,'/*/*[local-name()="Imposta"]')::numeric;
  END LOOP;
  IF f.numero_fattura IS DISTINCT FROM artecna_guardie.nc_testo(g,'/*/*[local-name()="Numero"]') OR
    f.data_fattura::text IS DISTINCT FROM artecna_guardie.nc_testo(g,'/*/*[local-name()="Data"]') OR
    f.partita_iva IS DISTINCT FROM artecna_guardie.nc_testo(x,'//*[local-name()="CedentePrestatore"]//*[local-name()="IdFiscaleIVA"]/*[local-name()="IdCodice"]') OR
    round(f.importo_totale,2) IS DISTINCT FROM round(artecna_guardie.nc_testo(g,'/*/*[local-name()="ImportoTotaleDocumento"]')::numeric,2) THEN
    RAISE EXCEPTION 'Testata persistita non coerente con XML originale' USING ERRCODE='22023';
  END IF;
  RETURN jsonb_build_object('id',f.id,'numero',artecna_guardie.nc_testo(g,'/*/*[local-name()="Numero"]'),
    'data',artecna_guardie.nc_testo(g,'/*/*[local-name()="Data"]'),
    'tipo',artecna_guardie.nc_testo(g,'/*/*[local-name()="TipoDocumento"]'),
    'partita_iva',artecna_guardie.nc_testo(x,'//*[local-name()="CedentePrestatore"]//*[local-name()="IdFiscaleIVA"]/*[local-name()="IdCodice"]'),
    'paese',artecna_guardie.nc_testo(x,'//*[local-name()="CedentePrestatore"]//*[local-name()="IdFiscaleIVA"]/*[local-name()="IdPaese"]'),
    'totale_originale',artecna_guardie.nc_testo(g,'/*/*[local-name()="ImportoTotaleDocumento"]'),
    'imponibile_originale',imponibile::text,'iva_originale',iva::text,'righe',righe,'riferimenti',riferimenti);
EXCEPTION WHEN invalid_xml_document OR invalid_xml_content THEN
  RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='XML originale non valido';
END $$;

CREATE FUNCTION artecna_guardie.nc_righe_coerenti(p_id uuid,p_meta jsonb) RETURNS boolean
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT jsonb_array_length(p_meta->'righe')>0
    AND (SELECT count(*)=count(DISTINCT numero_riga) AND count(*)=jsonb_array_length(p_meta->'righe')
      FROM public.fatture_fornitori_righe WHERE fattura_id=p_id)
    AND (SELECT count(*)=count(DISTINCT value->>'numero') FROM jsonb_array_elements(p_meta->'righe'))
    AND NOT EXISTS(SELECT 1 FROM public.fatture_fornitori_righe r WHERE r.fattura_id=p_id
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_meta->'righe') x
        WHERE (x->>'numero')::integer=r.numero_riga AND (x->>'quantita')::numeric=r.quantita
          AND (x->>'prezzo')::numeric=r.prezzo_unitario AND x->>'descrizione'=r.descrizione))
$$;

CREATE FUNCTION artecna_guardie.nc_tipo(p_id uuid) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, pg_temp AS $$
DECLARE f public.fatture_fornitori%ROWTYPE; x xml;
BEGIN
  SELECT * INTO STRICT f FROM public.fatture_fornitori WHERE id=p_id;
  IF nullif(btrim(f.xml_testo),'') IS NULL THEN RETURN f.tipo_documento; END IF;
  IF f.xml_testo ~* '<!DOCTYPE|<!ENTITY' THEN RAISE EXCEPTION 'XML non ammesso' USING ERRCODE='22023'; END IF;
  x := xmlparse(document f.xml_testo);
  IF cardinality(xpath('//*[local-name()="FatturaElettronicaBody"]',x)) <> 1 THEN
    RAISE EXCEPTION 'XML non univoco' USING ERRCODE='22023';
  END IF;
  RETURN artecna_guardie.nc_testo(x,'//*[local-name()="DatiGeneraliDocumento"]/*[local-name()="TipoDocumento"]');
END $$;

-- Le quote vengono lette una volta dalle quattro destinazioni autorevoli.
-- Un nome Cantiere privo di UUID non costituisce una destinazione verificata.
CREATE FUNCTION artecna_guardie.nc_quote(p_origine uuid) RETURNS TABLE (
  tipo text, id uuid, origine_riga_id uuid, cantiere_id uuid, categoria text,
  quantita numeric, netto numeric, costo numeric, numero_riga integer, descrizione text
) LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT 'economia',e.id,r.id,c.cantiere_id,'materiali',e.quantita,e.quantita*e.prezzo_unitario,e.quantita*e.prezzo_unitario,r.numero_riga,r.descrizione
    FROM public.economia_righe e JOIN public.economia_raccolte c ON c.id=e.raccolta_id
    JOIN public.fatture_fornitori_righe r ON r.id=e.fattura_riga_id WHERE r.fattura_id=p_origine
  UNION ALL SELECT 'cantiere',m.id,r.id,m.cantiere_id,'materiali',m.quantita,m.quantita*m.prezzo_unitario,m.totale,r.numero_riga,r.descrizione
    FROM public.materiali_cantiere m JOIN public.fatture_fornitori_righe r ON r.id=m.fattura_riga_id WHERE r.fattura_id=p_origine
  UNION ALL SELECT 'impresa',m.id,r.id,NULL,m.categoria,m.quantita,m.quantita*m.prezzo_unitario,m.totale,r.numero_riga,r.descrizione
    FROM public.materiali_impresa m JOIN public.fatture_fornitori_righe r ON r.id=m.fattura_riga_id WHERE r.fattura_id=p_origine
  UNION ALL SELECT 'spesa',s.id,r.id,NULL,s.categoria,r.quantita,r.quantita*r.prezzo_unitario,s.importo,r.numero_riga,r.descrizione
    FROM public.spese_impresa s JOIN public.fatture_fornitori_righe r ON r.id=s.riga_fattura_id
    WHERE r.fattura_id=p_origine AND s.fattura_id=p_origine
$$;

CREATE FUNCTION artecna_guardie.nc_accesso(p_cantiere uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE u uuid := artecna_guardie.utente_jwt_corrente();
BEGIN
  IF NOT coalesce(artecna_guardie.utente_puo_operare_impresa(u),false)
    OR (p_cantiere IS NOT NULL AND NOT coalesce(artecna_guardie.utente_puo_modificare_cantiere(u,p_cantiere),false)) THEN
    RAISE EXCEPTION 'Operazione riservata al titolare attivo nel contesto autorizzato' USING ERRCODE='42501';
  END IF;
END $$;

CREATE FUNCTION public.leggi_nota_credito_fornitore(p_nota_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE n jsonb; o jsonb; candidati jsonb; candidato uuid; q record; motivo text; righe jsonb; rettifiche jsonb;
BEGIN
  PERFORM artecna_guardie.nc_accesso();
  BEGIN n := artecna_guardie.nc_xml(p_nota_id);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    RETURN jsonb_build_object('stato','da riconciliare','motivo',SQLERRM,'righe','[]'::jsonb,'quote','[]'::jsonb,'rettifiche','[]'::jsonb);
  END;
  IF n->>'tipo' IS DISTINCT FROM 'TD04' THEN RAISE EXCEPTION 'Documento non TD04' USING ERRCODE='22023'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'numero',f.numero_fattura,'data',f.data_fattura) ORDER BY f.id),'[]') INTO candidati
    FROM public.fatture_fornitori f WHERE f.id<>p_nota_id AND nullif(btrim(f.partita_iva),'')=nullif(n->>'partita_iva','')
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(n->'riferimenti') r
      WHERE r->>'numero'=f.numero_fattura AND r->>'data'=f.data_fattura::text);
  IF (SELECT count(DISTINCT (r->>'numero',r->>'data')) FROM jsonb_array_elements(n->'riferimenti') r)>1 THEN
    motivo := 'Più riferimenti originali: riconciliazione separata necessaria';
  ELSIF jsonb_array_length(candidati)<>1 THEN
    motivo := CASE WHEN jsonb_array_length(candidati)=0 THEN 'Origine non disponibile: nessuna rettifica automatica.' ELSE 'Origine ambigua: più documenti corrispondenti.' END;
  ELSE
    candidato := (candidati->0->>'id')::uuid;
    BEGIN o := artecna_guardie.nc_xml(candidato);
    EXCEPTION WHEN SQLSTATE '22023' THEN motivo := 'Origine senza XML verificabile'; END;
    IF o IS NOT NULL AND (o->>'tipo' IN ('TD04','TD08') OR o->>'partita_iva' IS DISTINCT FROM n->>'partita_iva' OR o->>'paese' IS DISTINCT FROM n->>'paese'
      OR o->>'numero' IS DISTINCT FROM candidati->0->>'numero' OR o->>'data' IS DISTINCT FROM candidati->0->>'data') THEN
      motivo := 'Identità fiscale dell’origine non coerente'; o := NULL;
    END IF;
    FOR q IN SELECT * FROM artecna_guardie.nc_quote(candidato) LOOP
      IF nullif(btrim(q.categoria),'') IS NULL THEN motivo := 'Categoria della destinazione non verificata'; END IF;
      IF q.tipo IN ('economia','cantiere') AND q.cantiere_id IS NULL THEN motivo := 'Quota priva di UUID Cantiere'; END IF;
      PERFORM artecna_guardie.nc_accesso(q.cantiere_id);
    END LOOP;
    IF o IS NOT NULL AND NOT artecna_guardie.nc_righe_coerenti(candidato,o) THEN motivo := 'Righe origine non coerenti/univoche rispetto a XML'; o := NULL; END IF;
    IF NOT EXISTS(SELECT 1 FROM artecna_guardie.nc_quote(candidato)) THEN motivo := 'Documento originario non assegnato'; END IF;
  END IF;
  IF NOT artecna_guardie.nc_righe_coerenti(p_nota_id,n) THEN motivo := 'Righe della nota non coerenti/univoche rispetto a XML'; END IF;
  IF EXISTS(SELECT 1 FROM artecna_guardie.nc_quote(p_nota_id)) THEN motivo := 'Nota con assegnazioni ordinarie storiche: riconciliazione specifica necessaria'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.numero_riga,r.id),'[]') INTO righe FROM public.fatture_fornitori_righe r WHERE r.fattura_id=p_nota_id;
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at,r.id),'[]') INTO rettifiche FROM public.fornitori_rettifiche r WHERE r.nota_id=p_nota_id;
  FOR q IN SELECT cantiere_id FROM public.fornitori_rettifiche WHERE nota_id=p_nota_id LOOP PERFORM artecna_guardie.nc_accesso(q.cantiere_id); END LOOP;
  RETURN jsonb_build_object('documento',n,'origine',o,'candidati',candidati,'motivo',motivo,'righe',righe,
    'quote',CASE WHEN motivo IS NULL THEN (SELECT coalesce(jsonb_agg(to_jsonb(quota)||jsonb_build_object('quantita_disponibile',quota.quantita-(SELECT coalesce(sum(rr.quantita),0) FROM public.fornitori_rettifiche rr WHERE CASE quota.tipo WHEN 'economia' THEN rr.economia_riga_id WHEN 'cantiere' THEN rr.materiale_cantiere_id WHEN 'impresa' THEN rr.materiale_impresa_id WHEN 'spesa' THEN rr.spesa_impresa_id END=quota.id),'costo_disponibile',quota.costo+(SELECT coalesce(sum(rr.importo_costo),0) FROM public.fornitori_rettifiche rr WHERE CASE quota.tipo WHEN 'economia' THEN rr.economia_riga_id WHEN 'cantiere' THEN rr.materiale_cantiere_id WHEN 'impresa' THEN rr.materiale_impresa_id WHEN 'spesa' THEN rr.spesa_impresa_id END=quota.id)) ORDER BY quota.origine_riga_id,quota.tipo,quota.id),'[]') FROM artecna_guardie.nc_quote(candidato) quota) ELSE '[]'::jsonb END,
    'rettifiche',rettifiche,'stato',CASE
      WHEN jsonb_array_length(righe)>0 AND (SELECT count(DISTINCT r.nota_riga_id) FROM public.fornitori_rettifiche r WHERE r.nota_id=p_nota_id)=jsonb_array_length(righe) THEN 'rettifica applicata'
      ELSE 'da riconciliare' END);
END $$;

CREATE FUNCTION public.applica_nota_credito_fornitore(p_nota_id uuid,p_origine_id uuid,p_righe jsonb,p_richiesta_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE v jsonb; n jsonb; o jsonb; e jsonb; x jsonb; ox jsonb; payload jsonb; esistente record;
  nr public.fatture_fornitori_righe%ROWTYPE; orr public.fatture_fornitori_righe%ROWTYPE; q record; g record;
  quant numeric; intera numeric; importo numeric; costo numeric; coeff numeric; somma numeric; somma_costi numeric;
  usata_q numeric; usata_netto numeric; usata_costo numeric; nota_riga uuid; categoria text;
BEGIN
  PERFORM artecna_guardie.nc_accesso();
  IF p_richiesta_id IS NULL OR p_nota_id IS NULL OR p_origine_id IS NULL OR jsonb_typeof(p_righe) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_righe)=0 THEN RAISE EXCEPTION 'Richiesta incompleta' USING ERRCODE='22023'; END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'Rettifiche: richiesta una transazione READ COMMITTED' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_richiesta_id::text, 3104));
  SELECT jsonb_agg(value ORDER BY value->>'nota_riga_id',value->>'tipo',value->>'quota_id') INTO payload FROM jsonb_array_elements(p_righe);
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(payload) elemento
    WHERE elemento->'conferma_corrispondenza' IS DISTINCT FROM 'true'::jsonb OR
      (elemento-ARRAY['nota_riga_id','tipo','quota_id','quantita','conferma_corrispondenza'])<>'{}'::jsonb) THEN
    RAISE EXCEPTION 'Confermare esplicitamente la corrispondenza delle righe, senza importi imposti dal client' USING ERRCODE='22023';
  END IF;
  -- Tutte le note della stessa origine si serializzano sul documento originario.
  PERFORM 1 FROM public.fatture_fornitori WHERE id=p_nota_id FOR UPDATE;
  PERFORM 1 FROM public.fatture_fornitori WHERE id=p_origine_id FOR UPDATE;
  v := public.leggi_nota_credito_fornitore(p_nota_id);
  IF v->>'motivo' IS NOT NULL OR v->'origine'->>'id' IS DISTINCT FROM p_origine_id::text THEN
    RAISE EXCEPTION 'Origine/assegnazione non verificata: %',coalesce(v->>'motivo','identità diversa') USING ERRCODE='22023';
  END IF;
  n := v->'documento'; o := v->'origine';
  SELECT * INTO esistente FROM public.fornitori_rettifiche WHERE richiesta_id=p_richiesta_id LIMIT 1;
  IF FOUND THEN
    IF esistente.nota_id<>p_nota_id OR esistente.richiesta IS DISTINCT FROM payload OR esistente.created_by<>artecna_guardie.utente_jwt_corrente() THEN
      RAISE EXCEPTION 'Identificativo richiesta già usato con dati diversi' USING ERRCODE='23505';
    END IF;
    RETURN v;
  END IF;
  IF (n->>'imponibile_originale')::numeric=0 THEN RAISE EXCEPTION 'Imponibile nullo: riconciliazione non automatizzabile' USING ERRCODE='22023'; END IF;
  coeff := CASE WHEN (n->>'imponibile_originale')::numeric>0 THEN -1 ELSE 1 END;
  SELECT sum(round((value->>'totale')::numeric,2)) INTO somma FROM jsonb_array_elements(n->'righe');
  IF somma IS DISTINCT FROM round((n->>'imponibile_originale')::numeric,2)
    OR round((n->>'totale_originale')::numeric,2) IS DISTINCT FROM round((n->>'imponibile_originale')::numeric+(n->>'iva_originale')::numeric,2) THEN
    RAISE EXCEPTION 'Riepilogo/arrotondamenti XML da riconciliare' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(n->'righe') r WHERE (r->>'totale')::numeric*coeff>=0) THEN
    RAISE EXCEPTION 'Nota con componenti di segno misto: riconciliazione specifica necessaria' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(payload) elemento GROUP BY elemento->>'nota_riga_id',elemento->>'tipo',elemento->>'quota_id' HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Quota ripetuta nella richiesta' USING ERRCODE='23505';
  END IF;
  -- Ogni riga di nota viene applicata integralmente in una sola transazione,
  -- eventualmente ripartita su più quote. Altre righe possono restare pendenti.
  FOR g IN SELECT value->>'nota_riga_id' id,sum((value->>'quantita')::numeric) quantita FROM jsonb_array_elements(payload) GROUP BY value->>'nota_riga_id' LOOP
    SELECT * INTO STRICT nr FROM public.fatture_fornitori_righe WHERE id=g.id::uuid AND fattura_id=p_nota_id FOR UPDATE;
    SELECT value INTO STRICT x FROM jsonb_array_elements(n->'righe') WHERE (value->>'numero')::integer=nr.numero_riga;
    IF nr.quantita IS DISTINCT FROM (x->>'quantita')::numeric OR nr.prezzo_unitario IS DISTINCT FROM (x->>'prezzo')::numeric
      OR nr.descrizione IS DISTINCT FROM x->>'descrizione' OR g.quantita IS DISTINCT FROM abs(nr.quantita) OR nr.quantita=0 THEN
      RAISE EXCEPTION 'Riga/quantità della nota non coerente con XML originale' USING ERRCODE='22023';
    END IF;
    IF EXISTS(SELECT 1 FROM public.fornitori_rettifiche WHERE nota_riga_id=nr.id) THEN RAISE EXCEPTION 'Riga della nota già rettificata' USING ERRCODE='23505'; END IF;
  END LOOP;
  FOR e IN SELECT value FROM jsonb_array_elements(payload) LOOP
    SELECT * INTO STRICT nr FROM public.fatture_fornitori_righe WHERE id=(e->>'nota_riga_id')::uuid AND fattura_id=p_nota_id;
    SELECT value INTO STRICT x FROM jsonb_array_elements(n->'righe') WHERE (value->>'numero')::integer=nr.numero_riga;
    CASE e->>'tipo'
      WHEN 'economia' THEN PERFORM 1 FROM public.economia_righe WHERE id=(e->>'quota_id')::uuid FOR UPDATE;
      WHEN 'cantiere' THEN PERFORM 1 FROM public.materiali_cantiere WHERE id=(e->>'quota_id')::uuid FOR UPDATE;
      WHEN 'impresa' THEN PERFORM 1 FROM public.materiali_impresa WHERE id=(e->>'quota_id')::uuid FOR UPDATE;
      WHEN 'spesa' THEN PERFORM 1 FROM public.spese_impresa WHERE id=(e->>'quota_id')::uuid FOR UPDATE;
      ELSE RAISE EXCEPTION 'Destinazione non supportata' USING ERRCODE='22023';
    END CASE;
    SELECT * INTO STRICT q FROM artecna_guardie.nc_quote(p_origine_id) WHERE id=(e->>'quota_id')::uuid AND tipo=e->>'tipo';
    SELECT * INTO STRICT orr FROM public.fatture_fornitori_righe WHERE id=q.origine_riga_id AND fattura_id=p_origine_id FOR UPDATE;
    SELECT value INTO STRICT ox FROM jsonb_array_elements(o->'righe') WHERE (value->>'numero')::integer=orr.numero_riga;
    IF orr.quantita IS DISTINCT FROM (ox->>'quantita')::numeric OR orr.prezzo_unitario IS DISTINCT FROM (ox->>'prezzo')::numeric
      OR orr.descrizione IS DISTINCT FROM ox->>'descrizione' OR orr.quantita<=0 OR orr.prezzo_unitario<=0
      OR x->>'iva' IS NULL OR ox->>'iva' IS NULL OR (x->>'iva')::numeric IS DISTINCT FROM (ox->>'iva')::numeric
      OR nullif(x->>'natura','') IS DISTINCT FROM nullif(ox->>'natura','') THEN
      RAISE EXCEPTION 'Riga origine/IVA non verificabile' USING ERRCODE='22023';
    END IF;
    PERFORM artecna_guardie.nc_accesso(q.cantiere_id);
    quant := (e->>'quantita')::numeric;
    IF quant<=0 OR quant<>round(quant,6) OR q.quantita<=0 OR q.netto<=0 OR q.costo<=0 OR nullif(btrim(q.categoria),'') IS NULL
      OR (q.tipo IN ('economia','cantiere') AND q.cantiere_id IS NULL) THEN RAISE EXCEPTION 'Quota/destinazione non verificabile' USING ERRCODE='22023'; END IF;
    -- Una spesa ha un importo, non un prezzo unitario proprio: il suo netto
    -- verificabile è quello della riga XML, inclusi gli sconti già documentati.
    IF q.tipo='spesa' THEN q.netto := (ox->>'totale')::numeric; END IF;
    IF q.netto<=0 OR round(q.netto,2) IS DISTINCT FROM round((ox->>'totale')::numeric*q.quantita/orr.quantita,2)
      OR (round(q.costo,2) IS DISTINCT FROM round(q.netto,2)
        AND round(q.costo,2) IS DISTINCT FROM round(q.netto*(1+(ox->>'iva')::numeric/100),2)) THEN
      RAISE EXCEPTION 'Valorizzazione originaria non coerente con XML: riconciliazione specifica necessaria' USING ERRCODE='22023';
    END IF;
    SELECT sum(quantita) INTO somma FROM artecna_guardie.nc_quote(p_origine_id) WHERE origine_riga_id=orr.id;
    IF somma>orr.quantita THEN RAISE EXCEPTION 'Origine con quote sovrapposte: riconciliazione necessaria' USING ERRCODE='22023'; END IF;
    -- Riparto al centesimo cumulativo: conserva esattamente il totale XML della riga.
    SELECT coalesce(sum((value->>'quantita')::numeric),0) INTO intera FROM jsonb_array_elements(payload) z
      WHERE z.value->>'nota_riga_id'=e->>'nota_riga_id'
      AND (z.value->>'tipo',z.value->>'quota_id') < (e->>'tipo',e->>'quota_id');
    importo := round((x->>'totale')::numeric*coeff*(intera+quant)/abs(nr.quantita),2)-round((x->>'totale')::numeric*coeff*intera/abs(nr.quantita),2);
    -- La base costo deriva dai decimali XML, NON dal netto già arrotondato:
    -- evita il centesimo spurio, ad esempio -1.97540984 con costo IVA inclusa.
    costo := round((x->>'totale')::numeric*coeff*(intera+quant)/abs(nr.quantita)*q.costo/q.netto,2)
      - round((x->>'totale')::numeric*coeff*intera/abs(nr.quantita)*q.costo/q.netto,2);
    SELECT coalesce(sum(r.quantita),0),coalesce(sum(-r.importo_netto),0),coalesce(sum(-r.importo_costo),0)
      INTO usata_q,usata_netto,usata_costo FROM public.fornitori_rettifiche r
      WHERE CASE q.tipo WHEN 'economia' THEN r.economia_riga_id WHEN 'cantiere' THEN r.materiale_cantiere_id WHEN 'impresa' THEN r.materiale_impresa_id WHEN 'spesa' THEN r.spesa_impresa_id END=q.id;
    IF importo>=0 OR costo>=0 OR -importo>round(q.netto*quant/q.quantita,2) OR -costo>round(q.costo*quant/q.quantita,2) OR quant+usata_q>q.quantita OR -importo+usata_netto>round(q.netto,2) OR -costo+usata_costo>round(q.costo,2) THEN
      RAISE EXCEPTION 'Rettifica eccedente la quota originaria disponibile' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.fornitori_rettifiche(nota_id,nota_riga_id,origine_id,origine_riga_id,economia_riga_id,materiale_cantiere_id,
      materiale_impresa_id,spesa_impresa_id,cantiere_id,categoria,quantita,importo_netto,importo_costo,data_nota,richiesta_id,richiesta,fotografia,created_by)
      VALUES(p_nota_id,nr.id,p_origine_id,orr.id,CASE WHEN q.tipo='economia' THEN q.id END,CASE WHEN q.tipo='cantiere' THEN q.id END,
      CASE WHEN q.tipo='impresa' THEN q.id END,CASE WHEN q.tipo='spesa' THEN q.id END,q.cantiere_id,q.categoria,quant,importo,costo,(n->>'data')::date,
      p_richiesta_id,payload,jsonb_build_object('nota_xml',n,'origine_xml',o,'quota',to_jsonb(q),'riga_nota_originale',to_jsonb(nr),'riga_origine_originale',to_jsonb(orr)),artecna_guardie.utente_jwt_corrente());
  END LOOP;
  RETURN public.leggi_nota_credito_fornitore(p_nota_id);
END $$;

CREATE FUNCTION public.leggi_costi_fornitori_rettificati(p_cantiere_id uuid DEFAULT NULL,p_da date DEFAULT NULL,p_a date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE u uuid := artecna_guardie.utente_jwt_corrente(); quote jsonb; rettifiche jsonb;
BEGIN
  PERFORM artecna_guardie.nc_accesso(p_cantiere_id);
  IF p_da>p_a THEN RAISE EXCEPTION 'Intervallo non valido' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.fatture_fornitori f CROSS JOIN LATERAL artecna_guardie.nc_quote(f.id) q
    WHERE artecna_guardie.nc_tipo(f.id)='TD04' AND (p_cantiere_id IS NULL OR q.cantiere_id=p_cantiere_id)
      AND (q.cantiere_id IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(u,q.cantiere_id))
      AND (p_da IS NULL OR f.data_fattura>=p_da) AND (p_a IS NULL OR f.data_fattura<=p_a)) THEN
    RAISE EXCEPTION 'Costi non certificabili: assegnazioni ordinarie TD04 storiche da riconciliare' USING ERRCODE='22023';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(q)||jsonb_build_object('documento_id',f.id,'data',f.data_fattura) ORDER BY f.id,q.tipo,q.id),'[]') INTO quote
    FROM public.fatture_fornitori f CROSS JOIN LATERAL artecna_guardie.nc_quote(f.id) q
    WHERE artecna_guardie.nc_tipo(f.id) IS DISTINCT FROM 'TD04'
      AND (p_cantiere_id IS NULL OR q.cantiere_id=p_cantiere_id)
      AND (q.cantiere_id IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(u,q.cantiere_id))
      AND (p_da IS NULL OR f.data_fattura>=p_da) AND (p_a IS NULL OR f.data_fattura<=p_a);
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.data_nota,r.id),'[]') INTO rettifiche FROM public.fornitori_rettifiche r
    WHERE (p_cantiere_id IS NULL OR r.cantiere_id=p_cantiere_id)
      AND (r.cantiere_id IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(u,r.cantiere_id))
      AND (p_da IS NULL OR r.data_nota>=p_da) AND (p_a IS NULL OR r.data_nota<=p_a);
  RETURN jsonb_build_object('quote',quote,'rettifiche',rettifiche,'perimetro','Impresa e Cantieri autorizzati; date dei rispettivi documenti');
END $$;

CREATE FUNCTION artecna_guardie.nc_immutabile() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN RAISE EXCEPTION 'Registro rettifiche immutabile' USING ERRCODE='55000'; END $$;
CREATE TRIGGER fornitori_rettifiche_immutabile BEFORE UPDATE OR DELETE ON public.fornitori_rettifiche FOR EACH ROW EXECUTE FUNCTION artecna_guardie.nc_immutabile();
CREATE TRIGGER fornitori_rettifiche_no_truncate BEFORE TRUNCATE ON public.fornitori_rettifiche FOR EACH STATEMENT EXECUTE FUNCTION artecna_guardie.nc_immutabile();

CREATE FUNCTION artecna_guardie.nc_proteggi_quote() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE j jsonb := to_jsonb(NEW); prima jsonb; riga uuid; documento uuid;
BEGIN
  IF TG_OP='UPDATE' THEN prima := to_jsonb(OLD); END IF;
  IF current_setting('transaction_isolation')<>'read committed' AND
    coalesce(j->>'fattura_riga_id',j->>'riga_fattura_id',j->>'fattura_id',prima->>'fattura_riga_id',prima->>'riga_fattura_id',prima->>'fattura_id') IS NOT NULL THEN
    RAISE EXCEPTION 'Quote fattura: richiesta una transazione READ COMMITTED' USING ERRCODE='22023';
  END IF;
  -- Il lock precede il controllo storico: un UPDATE concorrente non deve
  -- usare una fotografia precedente al COMMIT della rettifica.
  riga := coalesce(j->>'fattura_riga_id',j->>'riga_fattura_id')::uuid;
  IF riga IS NOT NULL THEN SELECT fattura_id INTO documento FROM public.fatture_fornitori_righe WHERE id=riga; ELSE documento := (j->>'fattura_id')::uuid; END IF;
  IF documento IS NOT NULL THEN
    IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Quote fattura: richiesta una transazione READ COMMITTED' USING ERRCODE='22023'; END IF;
    PERFORM 1 FROM public.fatture_fornitori WHERE id=documento FOR UPDATE;
  END IF;
  IF TG_OP='UPDATE' THEN
    prima := to_jsonb(OLD);
    IF EXISTS(SELECT 1 FROM public.fornitori_rettifiche r WHERE CASE TG_TABLE_NAME WHEN 'economia_righe' THEN r.economia_riga_id WHEN 'materiali_cantiere' THEN r.materiale_cantiere_id WHEN 'materiali_impresa' THEN r.materiale_impresa_id WHEN 'spese_impresa' THEN r.spesa_impresa_id END=OLD.id)
      AND (j->'quantita',j->'prezzo_unitario',j->'totale',j->'importo',j->'cantiere_id',j->'raccolta_id',j->'categoria',j->'origine',j->'tipo_riga',j->'sorgente_id',j->'dettagli_analitici',j->'unita_misura',j->'cantiere',j->'data_documento',j->'fattura_riga_id',j->'riga_fattura_id',j->'fattura_id')
      IS DISTINCT FROM (prima->'quantita',prima->'prezzo_unitario',prima->'totale',prima->'importo',prima->'cantiere_id',prima->'raccolta_id',prima->'categoria',prima->'origine',prima->'tipo_riga',prima->'sorgente_id',prima->'dettagli_analitici',prima->'unita_misura',prima->'cantiere',prima->'data_documento',prima->'fattura_riga_id',prima->'riga_fattura_id',prima->'fattura_id') THEN
      RAISE EXCEPTION 'Quota originaria con rettifica: dati economici/destinazione protetti' USING ERRCODE='55000';
    END IF;
  END IF;
  IF documento IS NOT NULL THEN
    IF artecna_guardie.nc_tipo(documento)='TD04' AND (TG_OP='INSERT' OR
      (j->'quantita',j->'prezzo_unitario',j->'totale',j->'importo',j->'fattura_riga_id',j->'riga_fattura_id',j->'fattura_id') IS DISTINCT FROM
      (prima->'quantita',prima->'prezzo_unitario',prima->'totale',prima->'importo',prima->'fattura_riga_id',prima->'riga_fattura_id',prima->'fattura_id')) THEN
      RAISE EXCEPTION 'TD04: usare il percorso di rettifica, non assegnazioni positive ordinarie' USING ERRCODE='22023';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER nc_quote_economia BEFORE INSERT OR UPDATE ON public.economia_righe FOR EACH ROW EXECUTE FUNCTION artecna_guardie.nc_proteggi_quote();
CREATE TRIGGER nc_quote_cantiere BEFORE INSERT OR UPDATE ON public.materiali_cantiere FOR EACH ROW EXECUTE FUNCTION artecna_guardie.nc_proteggi_quote();
CREATE TRIGGER nc_quote_impresa BEFORE INSERT OR UPDATE ON public.materiali_impresa FOR EACH ROW EXECUTE FUNCTION artecna_guardie.nc_proteggi_quote();
CREATE TRIGGER nc_quote_spese BEFORE INSERT OR UPDATE ON public.spese_impresa FOR EACH ROW EXECUTE FUNCTION artecna_guardie.nc_proteggi_quote();

CREATE FUNCTION artecna_guardie.nc_proteggi_documenti() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE j jsonb:=to_jsonb(NEW); prima jsonb:=to_jsonb(OLD);
BEGIN
  IF TG_TABLE_NAME='fatture_fornitori_righe' THEN
    IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Righe fattura: richiesta una transazione READ COMMITTED' USING ERRCODE='22023'; END IF;
    PERFORM 1 FROM public.fatture_fornitori WHERE id IN ((j->>'fattura_id')::uuid,(prima->>'fattura_id')::uuid) ORDER BY id FOR UPDATE;
    IF EXISTS(SELECT 1 FROM public.fornitori_rettifiche WHERE nota_id IN ((j->>'fattura_id')::uuid,(prima->>'fattura_id')::uuid)
      OR origine_id IN ((j->>'fattura_id')::uuid,(prima->>'fattura_id')::uuid))
      AND (TG_OP<>'UPDATE' OR (j-'stato') IS DISTINCT FROM (prima-'stato')) THEN
      RAISE EXCEPTION 'Documento con rettifiche: inventario delle righe protetto' USING ERRCODE='55000';
    END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF artecna_guardie.nc_tipo((j->>'fattura_id')::uuid)='TD04' AND
    (TG_OP='INSERT' OR (j->'categoria_economica',j->'cantiere',j->'cantiere_id') IS DISTINCT FROM (prima->'categoria_economica',prima->'cantiere',prima->'cantiere_id'))
    AND (nullif(j->>'categoria_economica','') IS NOT NULL OR nullif(j->>'cantiere','') IS NOT NULL OR j->>'cantiere_id' IS NOT NULL) THEN
    RAISE EXCEPTION 'TD04: classificazione e destinazione solo tramite rettifica' USING ERRCODE='22023';
  END IF;
  END IF;
  IF TG_OP='UPDATE' AND ((TG_TABLE_NAME='fatture_fornitori' AND EXISTS(SELECT 1 FROM public.fornitori_rettifiche WHERE nota_id=OLD.id OR origine_id=OLD.id)
    AND (j-'stato'-'note') IS DISTINCT FROM (prima-'stato'-'note')) OR
    (TG_TABLE_NAME='fatture_fornitori_righe' AND EXISTS(SELECT 1 FROM public.fornitori_rettifiche WHERE nota_riga_id=OLD.id OR origine_riga_id=OLD.id)
    AND (j-'stato') IS DISTINCT FROM (prima-'stato'))) THEN
    RAISE EXCEPTION 'Documento con rettifiche: dati originali protetti' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER nc_documenti_originali BEFORE UPDATE ON public.fatture_fornitori FOR EACH ROW EXECUTE FUNCTION artecna_guardie.nc_proteggi_documenti();
CREATE TRIGGER nc_righe_originali BEFORE INSERT OR UPDATE OR DELETE ON public.fatture_fornitori_righe FOR EACH ROW EXECUTE FUNCTION artecna_guardie.nc_proteggi_documenti();

REVOKE ALL ON FUNCTION artecna_guardie.nc_testo(xml,text),artecna_guardie.nc_xml(uuid),artecna_guardie.nc_tipo(uuid),artecna_guardie.nc_quote(uuid),
  artecna_guardie.nc_accesso(uuid),artecna_guardie.nc_righe_coerenti(uuid,jsonb),artecna_guardie.nc_immutabile(),artecna_guardie.nc_proteggi_quote(),artecna_guardie.nc_proteggi_documenti() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.leggi_nota_credito_fornitore(uuid),public.applica_nota_credito_fornitore(uuid,uuid,jsonb,uuid),public.leggi_costi_fornitori_rettificati(uuid,date,date) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.leggi_nota_credito_fornitore(uuid),public.applica_nota_credito_fornitore(uuid,uuid,jsonb,uuid),public.leggi_costi_fornitori_rettificati(uuid,date,date) TO authenticated;
COMMENT ON TABLE public.fornitori_rettifiche IS 'Rettifiche negative TD04, quote originali immutate. Non è un registro IVA né un pagamento.';
-- Compatibilità F3C3.3: inventario esatto, storico conservato, ordine legacy invariato.
CREATE OR REPLACE FUNCTION artecna_distruzione.inizia_contesto(p_cantiere uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET row_security TO 'off'
AS $function$
  DECLARE u uuid := artecna_guardie.utente_jwt_corrente();
  BEGIN
    IF u IS NULL OR p_cantiere IS NULL THEN RAISE EXCEPTION 'Identita owner obbligatoria'; END IF;
    PERFORM 1 FROM public.cantieri WHERE id=p_cantiere FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cantiere assente'; END IF;
    PERFORM 1 FROM public.utenti_cantiere WHERE cantiere_id=p_cantiere AND user_id=u AND ruolo='owner' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Owner non autorizzato'; END IF;
    -- Solo lock e SELECT prima della prima mutazione del contesto.
    LOCK TABLE public.variante_fonti_memory,public.variante_fonti_visive,public.variante_osservatore_analisi,artecna_rapportini.allegati,artecna_rapportini.richieste,public.acconti_cantiere,public.attrezzi_cantiere,public.cantieri,public.economia_raccolte,public.economia_righe,public.economia_sorgenti,public.fatture_emesse,public.fatture_fornitori_righe,public.foto_cantiere,public.incassi_non_fatturati,public.materiali_cantiere,public.pagamenti_fornitori,public.preventivi_cantiere,public.preventivo_lavorazioni,public.rapportini,public.rapportino_materiali,public.rapportino_prestazioni,public.sal_lavorazioni,public.timbrature,public.utenti_cantiere,public.variante_documenti,public.variante_lavorazioni,public.variante_sorgenti,public.varianti_cantiere IN ROW EXCLUSIVE MODE;
    PERFORM id FROM public.rapportini WHERE cantiere_id=p_cantiere ORDER BY id FOR UPDATE;
    PERFORM id FROM public.varianti_cantiere WHERE cantiere_id=p_cantiere ORDER BY id FOR UPDATE;
    PERFORM id FROM public.economia_raccolte WHERE cantiere_id=p_cantiere ORDER BY id FOR UPDATE;
    IF (SELECT coalesce(jsonb_agg(jsonb_build_object('child',cn.nspname||'.'||c.relname,'name',k.conname,
'columns',(SELECT jsonb_agg(a.attname ORDER BY x.ord) FROM unnest(k.conkey) WITH ORDINALITY x(num,ord) JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=x.num),
'parent',pn.nspname||'.'||p.relname,'keys',(SELECT jsonb_agg(a.attname ORDER BY x.ord) FROM unnest(k.confkey) WITH ORDINALITY x(num,ord) JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=x.num),
'del',CASE k.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END,
'upd',CASE k.confupdtype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END,
'match',k.confmatchtype,'valid',k.convalidated,'defer',k.condeferrable,'deferred',k.condeferred)
ORDER BY (cn.nspname||'.'||c.relname||'.'||k.conname) COLLATE "C"),'[]'::jsonb)
FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace cn ON cn.oid=c.relnamespace JOIN pg_class p ON p.oid=k.confrelid JOIN pg_namespace pn ON pn.oid=p.relnamespace
WHERE k.contype='f' AND pn.nspname='public' AND p.relname=ANY(ARRAY['cantieri','rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere','variante_lavorazioni','variante_documenti','variante_sorgenti','economia_raccolte','economia_sorgenti','economia_righe'])) IS DISTINCT FROM $inventory$[{"child":"artecna_rapportini.allegati","name":"allegati_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"artecna_rapportini.allegati","name":"allegati_foto_cantiere_id_fkey","columns":["foto_cantiere_id"],"parent":"public.foto_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"artecna_rapportini.allegati","name":"allegati_rapportino_id_fkey","columns":["rapportino_id"],"parent":"public.rapportini","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"artecna_rapportini.richieste","name":"richieste_rapportino_id_fkey","columns":["rapportino_id"],"parent":"public.rapportini","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.acconti_cantiere","name":"acconti_cantiere_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.attrezzi_cantiere","name":"attrezzi_cantiere_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.cantieri","name":"cantieri_preventivo_contrattuale_id_fkey","columns":["preventivo_contrattuale_id"],"parent":"public.preventivi_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.economia_raccolte","name":"economia_raccolte_cantiere_fk","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.economia_righe","name":"economia_righe_fattura_riga_fk","columns":["fattura_riga_id"],"parent":"public.fatture_fornitori_righe","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.economia_righe","name":"economia_righe_raccolta_fk","columns":["raccolta_id"],"parent":"public.economia_raccolte","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.economia_righe","name":"economia_righe_sorgente_fk","columns":["sorgente_id","raccolta_id"],"parent":"public.economia_sorgenti","keys":["id","raccolta_id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.economia_sorgenti","name":"economia_sorgenti_raccolta_fk","columns":["raccolta_id"],"parent":"public.economia_raccolte","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.fatture_emesse","name":"fatture_emesse_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.fatture_fornitori_righe","name":"fatture_fornitori_righe_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.fornitori_rettifiche","name":"fornitori_rettifiche_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.fornitori_rettifiche","name":"fornitori_rettifiche_economia_riga_id_fkey","columns":["economia_riga_id"],"parent":"public.economia_righe","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.fornitori_rettifiche","name":"fornitori_rettifiche_materiale_cantiere_id_fkey","columns":["materiale_cantiere_id"],"parent":"public.materiali_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.fornitori_rettifiche","name":"fornitori_rettifiche_nota_riga_id_fkey","columns":["nota_riga_id"],"parent":"public.fatture_fornitori_righe","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.fornitori_rettifiche","name":"fornitori_rettifiche_origine_riga_id_fkey","columns":["origine_riga_id"],"parent":"public.fatture_fornitori_righe","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.foto_cantiere","name":"foto_cantiere_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.incassi_non_fatturati","name":"incassi_non_fatturati_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.materiali_cantiere","name":"materiali_cantiere_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.materiali_cantiere","name":"materiali_cantiere_fattura_riga_fk","columns":["fattura_riga_id"],"parent":"public.fatture_fornitori_righe","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.materiali_impresa","name":"materiali_impresa_fattura_riga_id_fkey","columns":["fattura_riga_id"],"parent":"public.fatture_fornitori_righe","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.pagamenti_fornitori","name":"pagamenti_fornitori_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.preventivi_cantiere","name":"preventivi_cantiere_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.preventivi_cantiere","name":"preventivi_cantiere_preventivo_contrattuale_id_fkey","columns":["preventivo_contrattuale_id"],"parent":"public.preventivi_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.preventivi_cantiere","name":"preventivi_cantiere_variante_id_fkey","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.preventivo_lavorazioni","name":"preventivo_lavorazioni_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.preventivo_lavorazioni","name":"preventivo_lavorazioni_preventivo_id_fkey","columns":["preventivo_id"],"parent":"public.preventivi_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.rapportini","name":"rapportini_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.rapportino_materiali","name":"rapportino_materiali_rapportino_fk","columns":["rapportino_id"],"parent":"public.rapportini","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.rapportino_prestazioni","name":"rapportino_prestazioni_rapportino_id_fkey","columns":["rapportino_id"],"parent":"public.rapportini","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.rapportino_prestazioni","name":"rapportino_prestazioni_variante_id_fkey","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.sal_lavorazioni","name":"sal_lavorazioni_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.sal_lavorazioni","name":"sal_lavorazioni_source_lavorazione_id_fkey","columns":["source_lavorazione_id"],"parent":"public.preventivo_lavorazioni","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.sal_lavorazioni","name":"sal_lavorazioni_variante_source_fk","columns":["source_variante_lavorazione_id"],"parent":"public.variante_lavorazioni","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.timbrature","name":"timbrature_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.utenti_cantiere","name":"utenti_cantiere_cantiere_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"CASCADE","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_documenti","name":"variante_documenti_variante_fk","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_fonti_memory","name":"variante_fonti_memory_variante_id_fkey","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"CASCADE","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_fonti_visive","name":"variante_fonti_visive_foto_cantiere_id_fkey","columns":["foto_cantiere_id"],"parent":"public.foto_cantiere","keys":["id"],"del":"CASCADE","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_fonti_visive","name":"variante_fonti_visive_variante_id_fkey","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"CASCADE","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_lavorazioni","name":"variante_lavorazioni_precedente_fk","columns":["riferimento_variante_lavorazione_id"],"parent":"public.variante_lavorazioni","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_lavorazioni","name":"variante_lavorazioni_preventivo_fk","columns":["riferimento_preventivo_lavorazione_id"],"parent":"public.preventivo_lavorazioni","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_lavorazioni","name":"variante_lavorazioni_sorgente_fk","columns":["variante_sorgente_id"],"parent":"public.variante_sorgenti","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_lavorazioni","name":"variante_lavorazioni_variante_fk","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_osservatore_analisi","name":"variante_osservatore_analisi_variante_id_fkey","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"CASCADE","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_sorgenti","name":"variante_sorgenti_economia_raccolta_fk","columns":["economia_raccolta_id"],"parent":"public.economia_raccolte","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_sorgenti","name":"variante_sorgenti_preventivo_fk","columns":["preventivo_sorgente_id"],"parent":"public.preventivi_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_sorgenti","name":"variante_sorgenti_variante_fk","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.varianti_cantiere","name":"varianti_cantiere_cantiere_fk","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.varianti_cantiere","name":"varianti_cantiere_contratto_fk","columns":["preventivo_contrattuale_id"],"parent":"public.preventivi_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false}]$inventory$::jsonb THEN
      RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Inventario FK distruzione F3C3.3 divergente'; END IF;
    -- TD04: rettifiche immutabili, mai appartenenti al manifest distruttivo.
    -- Tutti i riferimenti sono UUID: nessun confronto su nomi legacy.
    -- Anche la fonte di una quota Impresa può essere associata a questo Cantiere.
    IF EXISTS (
      SELECT 1 FROM public.fornitori_rettifiche x
      LEFT JOIN public.economia_righe e ON e.id=x.economia_riga_id
      LEFT JOIN public.economia_raccolte r ON r.id=e.raccolta_id
      LEFT JOIN public.materiali_cantiere m ON m.id=x.materiale_cantiere_id
      LEFT JOIN public.fatture_fornitori_righe n ON n.id=x.nota_riga_id
      LEFT JOIN public.fatture_fornitori_righe o ON o.id=x.origine_riga_id
      WHERE x.cantiere_id=p_cantiere OR r.cantiere_id=p_cantiere
         OR m.cantiere_id=p_cantiere OR n.cantiere_id=p_cantiere OR o.cantiere_id=p_cantiere
    ) THEN
      RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Storico rettifiche TD04 presente: eliminazione Cantiere non consentita';
    END IF;
    IF EXISTS(SELECT 1 FROM artecna_rapportini.allegati a LEFT JOIN public.rapportini r ON r.id=a.rapportino_id LEFT JOIN public.foto_cantiere f ON f.id=a.foto_cantiere_id WHERE a.cantiere_id=p_cantiere OR r.cantiere_id=p_cantiere OR f.cantiere_id=p_cantiere)
      OR EXISTS(SELECT 1 FROM public.foto_cantiere f LEFT JOIN public.rapportini r ON r.id::text=f.rapportino_id WHERE f.allegato_v1_id IS NOT NULL AND (f.cantiere_id=p_cantiere OR r.cantiere_id=p_cantiere))
      OR EXISTS(SELECT 1 FROM public.rapportini WHERE cantiere_id=p_cantiere AND (versione_prestazioni<>0 OR versione_materiali<>0))
      OR EXISTS(SELECT 1 FROM public.rapportino_prestazioni p JOIN public.rapportini r ON r.id=p.rapportino_id LEFT JOIN public.varianti_cantiere v ON v.id=p.variante_id WHERE r.cantiere_id=p_cantiere OR v.cantiere_id=p_cantiere)
      OR EXISTS(SELECT 1 FROM public.rapportino_materiali m JOIN public.rapportini r ON r.id=m.rapportino_id WHERE r.cantiere_id=p_cantiere)
      OR EXISTS(SELECT 1 FROM artecna_rapportini.richieste q JOIN public.rapportini r ON r.id=q.rapportino_id WHERE r.cantiere_id=p_cantiere)
      OR EXISTS(SELECT 1 FROM public.variante_sorgenti s LEFT JOIN public.varianti_cantiere v ON v.id=s.variante_id LEFT JOIN public.economia_raccolte e ON e.id=s.economia_raccolta_id WHERE s.economia_raccolta_id IS NOT NULL AND (v.cantiere_id=p_cantiere OR e.cantiere_id=p_cantiere)) THEN
      RAISE EXCEPTION USING ERRCODE='P2131',MESSAGE='Cantiere con dipendenze strutturate protette: eliminazione non disponibile'; END IF;
    -- Cleanup di residui ormai inutilizzabili dello stesso backend. Nessun dato applicativo.
    DELETE FROM artecna_distruzione.contesto WHERE backend=pg_backend_pid() AND transazione<>pg_current_xact_id();
    INSERT INTO artecna_distruzione.contesto(transazione,backend,cantiere_id,user_id,ruolo)
      VALUES(pg_current_xact_id(),pg_backend_pid(),p_cantiere,u,'artecna_cantieri_delete_rpc');
    -- La PK vieta un secondo target nella stessa transazione/backend.
  END;
  $function$
;

SET LOCAL ROLE artecna_cantieri_delete_rpc;
CREATE OR REPLACE FUNCTION public.elimina_cantiere_definitivamente(p_cantiere_id uuid, p_conferma text)
 RETURNS TABLE(cantiere_id uuid, eliminato boolean, storage_nuovi bigint, conteggi jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_user uuid;
  v_id uuid;
  v_varianti uuid[];
  v_raccolte uuid[];
  v_economia_sorgenti uuid[];
  v_economia_righe uuid[];
  v_economia_figli constant text[]:=ARRAY['economia_sorgenti','economia_righe']::text[];
  v_preventivi text[];
  v_base_lavorazioni bigint[];
  v_var_lavorazioni bigint[];
  v_tabelle constant text[] := ARRAY['cantieri','rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere','variante_lavorazioni','variante_documenti','variante_sorgenti','variante_fonti_memory','variante_fonti_visive','variante_osservatore_analisi','economia_raccolte','economia_sorgenti','economia_righe']::text[];
  v_figli constant text[] := ARRAY['variante_lavorazioni','variante_documenti','variante_sorgenti','variante_fonti_memory','variante_fonti_visive','variante_osservatore_analisi']::text[];
  v_dirette constant text[] := ARRAY['rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere','economia_raccolte']::text[];
  v_eliminate jsonb := '{}'::jsonb;
  v_n bigint;
  v_integrativi bigint := 0; -- STEP5
  v_totale_lavorazioni bigint;
  v_residuo boolean;
  v_esterna boolean;
  v_on text;
  v_padre text;
  v_figlio text;
  v_sql text;
  v_jobs_prima record;
  v_jobs_vecchi record;
  v_jobs_preparati record;
  v_jobs_dopo record;
  t text;
  fk record;
  m record;
BEGIN
  IF current_user <> 'artecna_cantieri_delete_rpc' THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Ruolo RPC non autorizzato';
  END IF;
  IF p_cantiere_id IS NULL OR p_conferma IS DISTINCT FROM 'ELIMINA' THEN
    RAISE EXCEPTION USING ERRCODE='P2111',MESSAGE='UUID e conferma esatta ELIMINA obbligatori';
  END IF;
  v_user := artecna_guardie.utente_jwt_corrente();
  IF v_user IS NULL THEN RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Utente non autorizzato'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id=p_cantiere_id) THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Cantiere assente o non autorizzato';
  END IF;
  SELECT c.id INTO v_id FROM public.cantieri c WHERE c.id=p_cantiere_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Cantiere assente o non autorizzato'; END IF;
  IF artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Owner non autorizzato';
  END IF;
  PERFORM 1 FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;
  IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Owner non autorizzato dopo lock';
  END IF;
  PERFORM artecna_rapportini.compat_foto_verifica_cantiere(p_cantiere_id);
  PERFORM artecna_distruzione.inizia_contesto(p_cantiere_id);
  IF artecna_distruzione.contesto_valido(p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Contesto non autorizzato';
  END IF;
  -- Blocca testate prima dei figli: impedisce nuovi riferimenti FK mentre opera.
  PERFORM v.id FROM public.varianti_cantiere v WHERE v.cantiere_id=p_cantiere_id ORDER BY v.id FOR UPDATE;
  SELECT coalesce(array_agg(v.id ORDER BY v.id),ARRAY[]::uuid[]) INTO v_varianti FROM public.varianti_cantiere v WHERE v.cantiere_id=p_cantiere_id;
  PERFORM e.id FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere_id ORDER BY e.id FOR UPDATE;
  SELECT coalesce(array_agg(e.id ORDER BY e.id),ARRAY[]::uuid[]) INTO v_raccolte FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere_id;
  FOREACH t IN ARRAY v_tabelle LOOP
    IF t='cantieri' THEN CONTINUE; END IF;
    IF t=ANY(v_economia_figli) THEN v_sql:=format('SELECT 1 FROM public.%I f WHERE f.raccolta_id=ANY($3) ORDER BY f.tableoid,f.ctid FOR UPDATE',t);
    ELSIF t=ANY(v_figli) THEN v_sql:=format('SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2) ORDER BY f.tableoid,f.ctid FOR UPDATE',t);
    ELSE v_sql:=format('SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1 ORDER BY f.tableoid,f.ctid FOR UPDATE',t); END IF;
    FOR m IN EXECUTE v_sql USING p_cantiere_id,v_varianti,v_raccolte LOOP NULL; END LOOP;
  END LOOP;
  SELECT coalesce(array_agg(e.id ORDER BY e.id),ARRAY[]::uuid[]) INTO v_economia_sorgenti FROM public.economia_sorgenti e WHERE e.raccolta_id=ANY(v_raccolte);
  SELECT coalesce(array_agg(e.id ORDER BY e.id),ARRAY[]::uuid[]) INTO v_economia_righe FROM public.economia_righe e WHERE e.raccolta_id=ANY(v_raccolte);
  SELECT coalesce(array_agg(p.id::text ORDER BY p.id::text),ARRAY[]::text[]) INTO v_preventivi FROM public.preventivi_cantiere p WHERE p.cantiere_id=p_cantiere_id;
  SELECT coalesce(array_agg(p.id ORDER BY p.id),ARRAY[]::bigint[]) INTO v_base_lavorazioni FROM public.preventivo_lavorazioni p WHERE p.cantiere_id=p_cantiere_id;
  SELECT coalesce(array_agg(p.id ORDER BY p.id),ARRAY[]::bigint[]) INTO v_var_lavorazioni FROM public.variante_lavorazioni p WHERE p.variante_id=ANY(v_varianti);
  IF (SELECT count(*) FROM pg_catalog.pg_constraint k WHERE k.contype='f' AND k.conrelid IN ('public.economia_raccolte'::regclass,'public.economia_sorgenti'::regclass,'public.economia_righe'::regclass))<>5+artecna_distruzione.numero_fk_economia_rapportino() THEN
    RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Inventario FK Economia divergente'; END IF;
  -- Ogni FK entrante: proprieta parent/child tramite UUID, mai per nome legacy.
  -- Una relazione esterna al manifest e' rifiutata anche se vuota: schema non certificato.
  FOR fk IN SELECT k.*, pn.nspname AS ns_padre,pc.relname AS padre,cn.nspname AS ns_figlio,cc.relname AS figlio
    FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class pc ON pc.oid=k.confrelid
      JOIN pg_catalog.pg_namespace pn ON pn.oid=pc.relnamespace
      JOIN pg_catalog.pg_class cc ON cc.oid=k.conrelid JOIN pg_catalog.pg_namespace cn ON cn.oid=cc.relnamespace
    WHERE k.contype='f' AND pn.nspname='public' AND pc.relname=ANY(v_tabelle)
    ORDER BY k.oid
  LOOP
    -- Inventario intero già verificato prima del contesto; nessuna DELETE dei figli protetti.
    IF (fk.conrelid='artecna_rapportini.allegati'::regclass AND fk.conname='allegati_cantiere_id_fkey') OR (fk.conrelid='artecna_rapportini.allegati'::regclass AND fk.conname='allegati_foto_cantiere_id_fkey') OR (fk.conrelid='artecna_rapportini.allegati'::regclass AND fk.conname='allegati_rapportino_id_fkey') OR (fk.conrelid='artecna_rapportini.richieste'::regclass AND fk.conname='richieste_rapportino_id_fkey') OR (fk.conrelid='public.rapportino_materiali'::regclass AND fk.conname='rapportino_materiali_rapportino_fk') OR (fk.conrelid='public.rapportino_prestazioni'::regclass AND fk.conname='rapportino_prestazioni_rapportino_id_fkey') OR (fk.conrelid='public.rapportino_prestazioni'::regclass AND fk.conname='rapportino_prestazioni_variante_id_fkey') OR (fk.conrelid='public.variante_sorgenti'::regclass AND fk.conname='variante_sorgenti_economia_raccolta_fk') THEN CONTINUE; END IF;
    IF artecna_rapportini.compat_foto_fk_allegati(fk.oid) THEN CONTINUE; END IF;
    -- TD04: solo queste cinque FK già certificate da inizia_contesto.
    -- Il guard precedente rifiuta ogni storico pertinente prima del contesto/DML.
    -- Il registro non entra mai nelle liste v_tabelle/v_dirette da eliminare.
    IF fk.conrelid='public.fornitori_rettifiche'::regclass
      AND fk.conname=ANY(ARRAY['fornitori_rettifiche_cantiere_id_fkey','fornitori_rettifiche_economia_riga_id_fkey','fornitori_rettifiche_materiale_cantiere_id_fkey','fornitori_rettifiche_nota_riga_id_fkey','fornitori_rettifiche_origine_riga_id_fkey']::text[]) THEN
      CONTINUE;
    END IF;
    -- CATALOG ALIGNMENT: global stock is not Cantiere-owned. Never delete it.
    -- The complete FK structure was certified by inizia_contesto before any DML.
    -- Invoice target rows are now FOR UPDATE locked: no new FK reference can commit.
    IF fk.ns_figlio='public' AND fk.figlio='materiali_impresa' AND fk.conname='materiali_impresa_fattura_riga_id_fkey' THEN
      IF EXISTS(SELECT 1 FROM public.materiali_impresa s JOIN public.fatture_fornitori_righe f ON f.id=s.fattura_riga_id WHERE f.cantiere_id=p_cantiere_id) THEN
        RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Riferimento a materiali impresa: eliminazione annullata';
      END IF;
      CONTINUE;
    END IF;
    IF fk.ns_figlio<>'public' OR NOT (fk.figlio=ANY(v_tabelle)) OR NOT fk.convalidated THEN
      RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE=format('Dipendenza non certificata: %s',fk.conname);
    END IF;
    SELECT string_agg(format('f.%I=t.%I',a.attname,b.attname),' AND ' ORDER BY x.ord) INTO v_on
      FROM unnest(fk.conkey,fk.confkey) WITH ORDINALITY x(attnum,refnum,ord)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=x.attnum
      JOIN pg_catalog.pg_attribute b ON b.attrelid=fk.confrelid AND b.attnum=x.refnum;
    -- Le FK che coinvolgono Economia devono appartenere all'esatto grafo V1.
    IF fk.padre IN ('economia_raccolte','economia_sorgenti','economia_righe') OR fk.figlio IN ('economia_raccolte','economia_sorgenti','economia_righe') THEN
      IF fk.ns_padre<>'public' OR fk.ns_figlio<>'public' OR fk.confdeltype<>'r' OR fk.condeferrable OR fk.condeferred
        OR NOT (
          (fk.conname='economia_raccolte_cantiere_fk' AND fk.figlio='economia_raccolte' AND fk.padre='cantieri'
            AND fk.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='cantiere_id')]::smallint[]
            AND fk.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='id')]::smallint[])
          OR (((fk.figlio='economia_sorgenti' AND fk.conname='economia_sorgenti_raccolta_fk') OR (fk.figlio='economia_righe' AND fk.conname='economia_righe_raccolta_fk'))
            AND fk.figlio=ANY(v_economia_figli) AND fk.padre='economia_raccolte'
            AND fk.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='raccolta_id')]::smallint[]
            AND fk.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='id')]::smallint[])
          OR (fk.conname='economia_righe_sorgente_fk' AND fk.figlio='economia_righe' AND fk.padre='economia_sorgenti'
            AND fk.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='sorgente_id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='raccolta_id')]::smallint[]
            AND fk.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='raccolta_id')]::smallint[])
          -- CATALOG ALIGNMENT: certify the existing invoice FK; no domain writer changes.
          OR (fk.conname='economia_righe_fattura_riga_fk' AND fk.figlio='economia_righe' AND fk.padre='fatture_fornitori_righe'
            AND fk.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='fattura_riga_id')]::smallint[]
            AND fk.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='id')]::smallint[])
        ) THEN RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='FK Economia non certificata'; END IF;
    END IF;
    IF fk.padre='cantieri' THEN v_padre:='t.id=$1';
    ELSIF fk.padre=ANY(v_economia_figli) THEN v_padre:='t.raccolta_id=ANY($3)';
    ELSIF fk.padre=ANY(v_figli) THEN v_padre:='t.variante_id=ANY($2)';
    ELSE v_padre:='t.cantiere_id=$1'; END IF;
    IF fk.figlio='cantieri' THEN v_figlio:='f.id=$1';
    ELSIF fk.figlio=ANY(v_economia_figli) THEN v_figlio:='f.raccolta_id=ANY($3)';
    ELSIF fk.figlio=ANY(v_figli) THEN v_figlio:='f.variante_id=ANY($2)';
    ELSE v_figlio:='f.cantiere_id=$1'; END IF;
    v_sql:=format('SELECT EXISTS (SELECT 1 FROM %I.%I f JOIN %I.%I t ON %s WHERE (%s) AND (%s) IS NOT TRUE)',fk.ns_figlio,fk.figlio,fk.ns_padre,fk.padre,v_on,v_padre,v_figlio);
    EXECUTE v_sql INTO v_esterna USING p_cantiere_id,v_varianti,v_raccolte;
    IF v_esterna THEN RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE=format('Riferimento esterno: %s',fk.conname); END IF;
  END LOOP;
  -- CATALOG ALIGNMENT: preserve the existing immutable invoice-assignment policy.
  -- Fail before outbox/DML rather than hitting RESTRICT after a trigger skips DELETE.
  IF EXISTS(SELECT 1 FROM public.materiali_cantiere t WHERE t.cantiere_id=p_cantiere_id AND t.fattura_riga_id IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Assegnazioni materiali fattura immutabili: eliminazione annullata';
  END IF;
  SELECT jsonb_object_agg(q.entita,q.quantita ORDER BY q.entita) INTO conteggi FROM artecna_distruzione.manifest_cantiere(p_cantiere_id) q;
  IF conteggi->>'cantieri' IS DISTINCT FROM '1' THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Manifest iniziale incoerente'; END IF;
  SELECT * INTO v_jobs_prima FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);
  storage_nuovi := artecna_distruzione.prepara_cleanup_storage(p_cantiere_id);
  SELECT * INTO v_jobs_vecchi FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,v_jobs_prima.max_id);
  SELECT * INTO v_jobs_preparati FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);
  IF v_jobs_vecchi.totale IS DISTINCT FROM v_jobs_prima.totale OR v_jobs_vecchi.impronta IS DISTINCT FROM v_jobs_prima.impronta
     OR v_jobs_preparati.totale IS DISTINCT FROM (v_jobs_prima.totale+storage_nuovi) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Outbox preesistente modificata o conteggio incoerente';
  END IF;
  DELETE FROM public.economia_righe e WHERE e.raccolta_id=ANY(v_raccolte);
  GET DIAGNOSTICS v_n=ROW_COUNT;
  v_eliminate:=v_eliminate||jsonb_build_object('economia_righe',v_n);
  DELETE FROM public.economia_sorgenti e WHERE e.raccolta_id=ANY(v_raccolte);
  GET DIAGNOSTICS v_n=ROW_COUNT;
  v_eliminate:=v_eliminate||jsonb_build_object('economia_sorgenti',v_n);
  DELETE FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n=ROW_COUNT;
  v_eliminate:=v_eliminate||jsonb_build_object('economia_raccolte',v_n);
  DELETE FROM public.sal_lavorazioni t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('sal_lavorazioni',v_n);
  DELETE FROM public.variante_documenti t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_documenti',v_n);
  v_totale_lavorazioni := 0;
  LOOP
    DELETE FROM public.variante_lavorazioni t WHERE t.variante_id=ANY(v_varianti)
      AND NOT EXISTS (SELECT 1 FROM public.variante_lavorazioni ref WHERE ref.riferimento_variante_lavorazione_id=t.id);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_totale_lavorazioni := v_totale_lavorazioni + v_n;
    IF v_n=0 THEN
      IF EXISTS (SELECT 1 FROM public.variante_lavorazioni t WHERE t.variante_id=ANY(v_varianti)) THEN
        RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Self-FK Variante: ciclo o dipendenza incompatibile';
      END IF;
      EXIT;
    END IF;
  END LOOP;
  v_eliminate := v_eliminate || jsonb_build_object('variante_lavorazioni',v_totale_lavorazioni);
  DELETE FROM public.variante_sorgenti t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_sorgenti',v_n);
  -- STEP5: only the relation/analysis belongs to the Variante.
  DELETE FROM public.variante_fonti_memory t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_fonti_memory',v_n);
  -- STEP5: only the relation/analysis belongs to the Variante.
  DELETE FROM public.variante_fonti_visive t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_fonti_visive',v_n);
  -- STEP5: only the relation/analysis belongs to the Variante.
  DELETE FROM public.variante_osservatore_analisi t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_osservatore_analisi',v_n);
  -- STEP5: documents precede Variante and base contract; RESTRICT unchanged.
  DELETE FROM public.preventivi_cantiere t WHERE t.cantiere_id=p_cantiere_id AND t.natura='integrativo';
  GET DIAGNOSTICS v_integrativi = ROW_COUNT;
  DELETE FROM public.varianti_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('varianti_cantiere',v_n);
  UPDATE public.cantieri t SET preventivo_contrattuale_id=NULL
    WHERE t.id=p_cantiere_id AND t.preventivo_contrattuale_id IS NOT NULL;
  DELETE FROM public.preventivo_lavorazioni t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('preventivo_lavorazioni',v_n);
  DELETE FROM public.preventivi_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('preventivi_cantiere',v_n+v_integrativi); -- STEP5: include early document deletes;
  DELETE FROM public.foto_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('foto_cantiere',v_n);
  DELETE FROM public.materiali_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('materiali_cantiere',v_n);
  DELETE FROM public.attrezzi_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('attrezzi_cantiere',v_n);
  DELETE FROM public.timbrature t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('timbrature',v_n);
  DELETE FROM public.pagamenti_fornitori t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('pagamenti_fornitori',v_n);
  DELETE FROM public.acconti_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('acconti_cantiere',v_n);
  DELETE FROM public.fatture_emesse t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('fatture_emesse',v_n);
  DELETE FROM public.fatture_fornitori_righe t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('fatture_fornitori_righe',v_n);
  DELETE FROM public.incassi_non_fatturati t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('incassi_non_fatturati',v_n);
  DELETE FROM public.rapportini t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('rapportini',v_n);
  -- Post-check dei dati protetti PRIMA di terminare il contesto.
  FOREACH t IN ARRAY v_tabelle LOOP
    IF t IN ('cantieri','utenti_cantiere') THEN CONTINUE; END IF;
    IF t=ANY(v_economia_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.raccolta_id=ANY($3))',t);
    ELSIF t=ANY(v_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2))',t);
    ELSE v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1)',t); END IF;
    EXECUTE v_sql INTO v_residuo USING p_cantiere_id,v_varianti,v_raccolte;
    IF v_residuo OR (v_eliminate->>t)::bigint IS DISTINCT FROM (conteggi->>t)::bigint THEN
      RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE=format('Residui/conteggi incoerenti: %s',t);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.preventivi_cantiere f WHERE f.id::text=ANY(v_preventivi))
     OR EXISTS (SELECT 1 FROM public.preventivo_lavorazioni f WHERE f.id=ANY(v_base_lavorazioni))
     OR EXISTS (SELECT 1 FROM public.variante_lavorazioni f WHERE f.id=ANY(v_var_lavorazioni)) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Identita target residue';
  END IF;
  SELECT * INTO v_jobs_dopo FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);
  IF to_jsonb(v_jobs_dopo) IS DISTINCT FROM to_jsonb(v_jobs_preparati) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Outbox persa o modificata dopo DELETE';
  END IF;
  PERFORM artecna_distruzione.termina_contesto();
  IF artecna_distruzione.contesto_valido(p_cantiere_id) THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Contesto non terminato'; END IF;
  DELETE FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n IS DISTINCT FROM (conteggi->>'utenti_cantiere')::bigint OR EXISTS (SELECT 1 FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Membership residue/conteggi incoerenti';
  END IF;
  -- Ultima cancellazione applicativa.
  DELETE FROM public.cantieri c WHERE c.id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n<>1 OR EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id=p_cantiere_id) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Cantiere residuo';
  END IF;
  -- Ripete l'intero perimetro con UUID Varianti salvati, senza dipendere da join spariti.
  FOREACH t IN ARRAY v_tabelle LOOP
    IF t='cantieri' THEN v_sql:='SELECT EXISTS (SELECT 1 FROM public.cantieri f WHERE f.id=$1)';
    ELSIF t=ANY(v_economia_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.raccolta_id=ANY($3))',t);
    ELSIF t=ANY(v_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2))',t);
    ELSE v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1)',t); END IF;
    EXECUTE v_sql INTO v_residuo USING p_cantiere_id,v_varianti,v_raccolte;
    IF v_residuo THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE=format('Verifica finale fallita: %s',t); END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.economia_raccolte e WHERE e.id=ANY(v_raccolte))
    OR EXISTS(SELECT 1 FROM public.economia_sorgenti e WHERE e.id=ANY(v_economia_sorgenti))
    OR EXISTS(SELECT 1 FROM public.economia_righe e WHERE e.id=ANY(v_economia_righe)) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Identita Economia residue'; END IF;
  cantiere_id := p_cantiere_id;
  eliminato := true;
  RETURN NEXT;
EXCEPTION WHEN foreign_key_violation THEN
  -- Il blocco EXCEPTION annulla TUTTE le scritture precedenti, poi propaga l'errore.
  RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Dipendenza FK incompatibile: eliminazione annullata',DETAIL=SQLERRM;
END;

  $function$
;
RESET ROLE;

COMMIT;
