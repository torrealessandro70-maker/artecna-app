-- CANDIDATA LOCALE. Original sources are private evidence, never a parallel financial ledger.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.associa_fattura_bluenext(uuid,text,text[],text,boolean)') IS NULL
 OR to_regprocedure('public.riconcilia_acconto_fattura(uuid,uuid,uuid,uuid,jsonb,jsonb,text,text,boolean,jsonb)') IS NULL
 OR (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
 IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()] THEN RAISE EXCEPTION 'STOP_PREREQUISITI_BLUENEXT'; END IF;
END $$;
CREATE TABLE artecna_contabilita.bluenext_fonti (
 autore uuid NOT NULL,sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),nome text NOT NULL CHECK(length(nome) BETWEEN 1 AND 500),
 tipo text NOT NULL CHECK(tipo IN('xml','zip','xls','xlsx')),contenuto bytea NOT NULL CHECK(octet_length(contenuto) BETWEEN 1 AND 10485760),
 acquisita_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(autore,sha256)
);
CREATE TABLE artecna_contabilita.bluenext_evidenze (
 fattura_id uuid NOT NULL REFERENCES public.fatture_emesse(id) ON DELETE CASCADE,
 autore uuid NOT NULL,fonte_sha text NOT NULL,proiezione jsonb NOT NULL CHECK(jsonb_typeof(proiezione)='object'),
 PRIMARY KEY(fattura_id,autore,fonte_sha),FOREIGN KEY(autore,fonte_sha) REFERENCES artecna_contabilita.bluenext_fonti(autore,sha256) ON DELETE RESTRICT
);
CREATE TABLE artecna_contabilita.bluenext_lotti (
 richiesta uuid PRIMARY KEY,autore uuid NOT NULL,input_sha text NOT NULL,esito jsonb NOT NULL,creato_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE artecna_contabilita.bluenext_fonti ENABLE ROW LEVEL SECURITY;
ALTER TABLE artecna_contabilita.bluenext_evidenze ENABLE ROW LEVEL SECURITY;
ALTER TABLE artecna_contabilita.bluenext_lotti ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artecna_contabilita.bluenext_fonti,artecna_contabilita.bluenext_evidenze,artecna_contabilita.bluenext_lotti FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION artecna_contabilita.pulisci_fonti_bluenext() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 DELETE FROM artecna_contabilita.bluenext_fonti s WHERE (s.autore,s.sha256)=(OLD.autore,OLD.fonte_sha)
 AND NOT EXISTS(SELECT FROM artecna_contabilita.bluenext_evidenze e WHERE (e.autore,e.fonte_sha)=(s.autore,s.sha256));RETURN OLD;
END $$;
CREATE TRIGGER bluenext_fonte_non_referenziata AFTER DELETE ON artecna_contabilita.bluenext_evidenze FOR EACH ROW EXECUTE FUNCTION artecna_contabilita.pulisci_fonti_bluenext();

CREATE FUNCTION artecna_contabilita.xml_originale_bluenext(p_id uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE value text; n integer; BEGIN
 SELECT count(DISTINCT s.sha256),min(convert_from(s.contenuto,'UTF8')) INTO n,value
 FROM artecna_contabilita.bluenext_fonti s JOIN artecna_contabilita.bluenext_evidenze e ON (e.autore,e.fonte_sha)=(s.autore,s.sha256)
 WHERE e.fattura_id=p_id AND s.tipo='xml' AND e.fonte_sha=e.proiezione->>'xml_sha';
 IF n>1 THEN RAISE EXCEPTION 'Originali XML discordanti' USING ERRCODE='23514'; END IF;RETURN value;
END $$;
-- Preserve the fiscal validator; extend only the private source lookup.
DO $gate$ BEGIN IF replace((SELECT prosrc FROM pg_proc WHERE oid='artecna_contabilita.documento_riconciliazione(uuid,jsonb)'::regprocedure),E'\r\n',E'\n') IS DISTINCT FROM replace($expected$
DECLARE f public.fatture_emesse; raw text; documento_xml xml; g xml; gruppi jsonb:='[]'; n numeric; v numeric; rate numeric;
 numero text; giorno text; tipo text; natura text; idx integer:=0; totale numeric:=0; canon jsonb;
BEGIN
 SELECT * INTO STRICT f FROM public.fatture_emesse WHERE id=p_fattura;
 IF artecna_contabilita.totale_fattura_finanziario(f) IS NULL OR coalesce(f.stato,'') NOT IN('emessa','parziale','incassata')
 OR EXISTS(SELECT FROM artecna_contabilita.sdi_corrente WHERE rettifica_id=f.id) THEN RAISE EXCEPTION 'STOP_DOCUMENTO_RETTIFICATO'; END IF;
 IF coalesce(btrim(f.numero_fattura),'')='' OR f.data_fattura IS NULL OR NOT isfinite(f.data_fattura) OR coalesce(btrim(f.cliente),'')='' THEN RAISE EXCEPTION 'STOP_IDENTITA_DOCUMENTO'; END IF;
 IF EXISTS(SELECT FROM public.fatture_emesse z WHERE z.id<>f.id AND z.cantiere_id=f.cantiere_id AND z.numero_fattura=f.numero_fattura AND z.data_fattura=f.data_fattura AND z.cliente=f.cliente)
 THEN RAISE EXCEPTION 'STOP_IDENTITA_DUPLICATA'; END IF;
 raw:=to_jsonb(f)->>'xml_testo';
 IF coalesce(btrim(raw),'')<>'' THEN
  IF raw ~* '<!DOCTYPE|<!ENTITY' THEN RAISE EXCEPTION 'STOP_XML'; END IF;
  documento_xml:=xmlparse(document raw);
  IF cardinality(xpath('//*[local-name()="FatturaElettronicaBody"]',documento_xml))<>1
  OR cardinality(xpath('//*[local-name()="DatiGeneraliDocumento"]',documento_xml))<>1 THEN RAISE EXCEPTION 'STOP_XML'; END IF;
  numero:=(xpath('string(//*[local-name()="DatiGeneraliDocumento"]/*[local-name()="Numero"])',documento_xml))[1]::text;
  giorno:=(xpath('string(//*[local-name()="DatiGeneraliDocumento"]/*[local-name()="Data"])',documento_xml))[1]::text;
  tipo:=(xpath('string(//*[local-name()="DatiGeneraliDocumento"]/*[local-name()="TipoDocumento"])',documento_xml))[1]::text;
  IF numero IS DISTINCT FROM f.numero_fattura OR giorno IS DISTINCT FROM f.data_fattura::text
  OR tipo NOT IN('TD01','TD02') THEN RAISE EXCEPTION 'STOP_IDENTITA_XML'; END IF;
  IF cardinality(xpath('//*[local-name()="DatiGeneraliDocumento"]/*[local-name()="Divisa"]',documento_xml))>1
  OR cardinality(xpath('//*[local-name()="DatiGeneraliDocumento"]/*[local-name()="Divisa"]',documento_xml))=1
   AND (xpath('string(//*[local-name()="DatiGeneraliDocumento"]/*[local-name()="Divisa"])',documento_xml))[1]::text<>'EUR'
  THEN RAISE EXCEPTION 'STOP_VALUTA_DOCUMENTO'; END IF;
  FOREACH g IN ARRAY xpath('//*[local-name()="DatiBeniServizi"]/*[local-name()="DatiRiepilogo"]',documento_xml) LOOP
   IF cardinality(xpath('/*/*[local-name()="ImponibileImporto"]',g))<>1
   OR cardinality(xpath('/*/*[local-name()="Imposta"]',g))<>1
   OR cardinality(xpath('/*/*[local-name()="AliquotaIVA"]',g))<>1 THEN RAISE EXCEPTION 'STOP_RIEPILOGO'; END IF;
   n:=(xpath('string(/*/*[local-name()="ImponibileImporto"])',g))[1]::text::numeric;
   v:=(xpath('string(/*/*[local-name()="Imposta"])',g))[1]::text::numeric;
   rate:=(xpath('string(/*/*[local-name()="AliquotaIVA"])',g))[1]::text::numeric;
   natura:=(xpath('string(/*/*[local-name()="Natura"])',g))[1]::text;
   IF cardinality(xpath('/*/*[local-name()="EsigibilitaIVA"]',g))>1
   OR cardinality(xpath('/*/*[local-name()="EsigibilitaIVA"]',g))=1 AND (xpath('string(/*/*[local-name()="EsigibilitaIVA"])',g))[1]::text<>'I'
   OR natura ~ '^N6' THEN RAISE EXCEPTION 'STOP_REGIME_SPECIALE_DA_VERIFICARE'; END IF;
   IF NOT(n>0 AND n<1e12 AND v>=0 AND v<1e12 AND rate>=0 AND rate<=100)
   OR n<>round(n,2) OR v<>round(v,2) OR v<>round(n*rate/100,2)
   OR (rate=0 AND coalesce(natura,'') !~ '^N[1-7](\.[0-9]+)?$')
   OR (rate>0 AND coalesce(natura,'')<>'') THEN RAISE EXCEPTION 'STOP_IMPORTI_XML'; END IF;
   gruppi:=gruppi||jsonb_build_array(jsonb_build_object('indice',idx,'imponibile',n,'iva',v,'aliquota',rate,'natura',natura));
   idx:=idx+1;totale:=totale+n+v;
  END LOOP;
 ELSE
  canon:=artecna_contabilita.risolvi_iva_persistita(to_jsonb(f),p_verifica);
  IF (canon->>'valida')::boolean IS NOT TRUE THEN RETURN canon; END IF;
  gruppi:=canon->'gruppi';totale:=(canon->>'totale')::numeric;idx:=jsonb_array_length(gruppi);
 END IF;
 IF raw IS NOT NULL AND btrim(raw)<>'' AND (f.imponibile IS DISTINCT FROM (SELECT sum((x->>'imponibile')::numeric) FROM jsonb_array_elements(gruppi) x)
 OR NOT(f.iva=(SELECT sum((x->>'iva')::numeric) FROM jsonb_array_elements(gruppi) x) OR jsonb_array_length(gruppi)=1 AND f.iva=(gruppi->0->>'aliquota')::numeric)) THEN RAISE EXCEPTION 'STOP_XML_PERSISTITI_DISCORDANTI'; END IF;
 IF idx=0 OR totale IS DISTINCT FROM f.totale THEN RAISE EXCEPTION 'STOP_QUADRATURA_DOCUMENTO'; END IF;
 RETURN jsonb_build_object('valida',true,'gruppi',gruppi,'totale',totale,'fonte',CASE WHEN raw IS NOT NULL AND btrim(raw)<>'' THEN 'XML persistito' ELSE canon->>'fonte' END,'canonico',canon,
 'impronta',encode(sha256(convert_to(jsonb_build_array(to_jsonb(f)-'created_at'-'fonte_iva_verificata',gruppi)::text,'UTF8')),'hex'));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('valida',false,'motivo','Fonte fiscale incompleta, discordante o non supportata: nessuna IVA presunta');
END $expected$,E'\r\n',E'\n') THEN RAISE EXCEPTION 'STOP_VALIDATORE_FISCALE_DIVERGENTE'; END IF; END $gate$;
CREATE OR REPLACE FUNCTION artecna_contabilita.documento_riconciliazione(p_fattura uuid,p_verifica jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE f public.fatture_emesse; raw text; documento_xml xml; g xml; gruppi jsonb:='[]'; n numeric; v numeric; rate numeric;
 numero text; giorno text; tipo text; natura text; idx integer:=0; totale numeric:=0; canon jsonb;
BEGIN
 SELECT * INTO STRICT f FROM public.fatture_emesse WHERE id=p_fattura;
 IF artecna_contabilita.totale_fattura_finanziario(f) IS NULL OR coalesce(f.stato,'') NOT IN('emessa','parziale','incassata')
 OR EXISTS(SELECT FROM artecna_contabilita.sdi_corrente WHERE rettifica_id=f.id) THEN RAISE EXCEPTION 'STOP_DOCUMENTO_RETTIFICATO'; END IF;
 IF coalesce(btrim(f.numero_fattura),'')='' OR f.data_fattura IS NULL OR NOT isfinite(f.data_fattura) OR coalesce(btrim(f.cliente),'')='' THEN RAISE EXCEPTION 'STOP_IDENTITA_DOCUMENTO'; END IF;
 IF EXISTS(SELECT FROM public.fatture_emesse z WHERE z.id<>f.id AND z.cantiere_id=f.cantiere_id AND z.numero_fattura=f.numero_fattura AND z.data_fattura=f.data_fattura AND z.cliente=f.cliente)
 THEN RAISE EXCEPTION 'STOP_IDENTITA_DUPLICATA'; END IF;
 raw:=coalesce(nullif(to_jsonb(f)->>'xml_testo',''),artecna_contabilita.xml_originale_bluenext(f.id));
 IF coalesce(btrim(raw),'')<>'' THEN
  IF raw ~* '<!DOCTYPE|<!ENTITY' THEN RAISE EXCEPTION 'STOP_XML'; END IF;
  documento_xml:=xmlparse(document raw);
  IF cardinality(xpath('//*[local-name()="FatturaElettronicaBody"]',documento_xml))<>1
  OR cardinality(xpath('//*[local-name()="DatiGeneraliDocumento"]',documento_xml))<>1 THEN RAISE EXCEPTION 'STOP_XML'; END IF;
  numero:=(xpath('string(//*[local-name()="DatiGeneraliDocumento"]/*[local-name()="Numero"])',documento_xml))[1]::text;
  giorno:=(xpath('string(//*[local-name()="DatiGeneraliDocumento"]/*[local-name()="Data"])',documento_xml))[1]::text;
  tipo:=(xpath('string(//*[local-name()="DatiGeneraliDocumento"]/*[local-name()="TipoDocumento"])',documento_xml))[1]::text;
  IF numero IS DISTINCT FROM f.numero_fattura OR giorno IS DISTINCT FROM f.data_fattura::text
  OR tipo NOT IN('TD01','TD02') THEN RAISE EXCEPTION 'STOP_IDENTITA_XML'; END IF;
  IF cardinality(xpath('//*[local-name()="DatiGeneraliDocumento"]/*[local-name()="Divisa"]',documento_xml))>1
  OR cardinality(xpath('//*[local-name()="DatiGeneraliDocumento"]/*[local-name()="Divisa"]',documento_xml))=1
   AND (xpath('string(//*[local-name()="DatiGeneraliDocumento"]/*[local-name()="Divisa"])',documento_xml))[1]::text<>'EUR'
  THEN RAISE EXCEPTION 'STOP_VALUTA_DOCUMENTO'; END IF;
  FOREACH g IN ARRAY xpath('//*[local-name()="DatiBeniServizi"]/*[local-name()="DatiRiepilogo"]',documento_xml) LOOP
   IF cardinality(xpath('/*/*[local-name()="ImponibileImporto"]',g))<>1
   OR cardinality(xpath('/*/*[local-name()="Imposta"]',g))<>1
   OR cardinality(xpath('/*/*[local-name()="AliquotaIVA"]',g))<>1 THEN RAISE EXCEPTION 'STOP_RIEPILOGO'; END IF;
   n:=(xpath('string(/*/*[local-name()="ImponibileImporto"])',g))[1]::text::numeric;
   v:=(xpath('string(/*/*[local-name()="Imposta"])',g))[1]::text::numeric;
   rate:=(xpath('string(/*/*[local-name()="AliquotaIVA"])',g))[1]::text::numeric;
   natura:=(xpath('string(/*/*[local-name()="Natura"])',g))[1]::text;
   IF cardinality(xpath('/*/*[local-name()="EsigibilitaIVA"]',g))>1
   OR cardinality(xpath('/*/*[local-name()="EsigibilitaIVA"]',g))=1 AND (xpath('string(/*/*[local-name()="EsigibilitaIVA"])',g))[1]::text<>'I'
   OR natura ~ '^N6' THEN RAISE EXCEPTION 'STOP_REGIME_SPECIALE_DA_VERIFICARE'; END IF;
   IF NOT(n>0 AND n<1e12 AND v>=0 AND v<1e12 AND rate>=0 AND rate<=100)
   OR n<>round(n,2) OR v<>round(v,2) OR v<>round(n*rate/100,2)
   OR (rate=0 AND coalesce(natura,'') !~ '^N[1-7](\.[0-9]+)?$')
   OR (rate>0 AND coalesce(natura,'')<>'') THEN RAISE EXCEPTION 'STOP_IMPORTI_XML'; END IF;
   gruppi:=gruppi||jsonb_build_array(jsonb_build_object('indice',idx,'imponibile',n,'iva',v,'aliquota',rate,'natura',natura));
   idx:=idx+1;totale:=totale+n+v;
  END LOOP;
 ELSE
  canon:=artecna_contabilita.risolvi_iva_persistita(to_jsonb(f),p_verifica);
  IF (canon->>'valida')::boolean IS NOT TRUE THEN RETURN canon; END IF;
  gruppi:=canon->'gruppi';totale:=(canon->>'totale')::numeric;idx:=jsonb_array_length(gruppi);
 END IF;
 IF raw IS NOT NULL AND btrim(raw)<>'' AND (f.imponibile IS DISTINCT FROM (SELECT sum((x->>'imponibile')::numeric) FROM jsonb_array_elements(gruppi) x)
 OR NOT(f.iva=(SELECT sum((x->>'iva')::numeric) FROM jsonb_array_elements(gruppi) x) OR jsonb_array_length(gruppi)=1 AND f.iva=(gruppi->0->>'aliquota')::numeric)) THEN RAISE EXCEPTION 'STOP_XML_PERSISTITI_DISCORDANTI'; END IF;
 IF idx=0 OR totale IS DISTINCT FROM f.totale THEN RAISE EXCEPTION 'STOP_QUADRATURA_DOCUMENTO'; END IF;
 RETURN jsonb_build_object('valida',true,'gruppi',gruppi,'totale',totale,'fonte',CASE WHEN raw IS NOT NULL AND btrim(raw)<>'' THEN 'XML persistito' ELSE canon->>'fonte' END,'canonico',canon,
 'impronta',encode(sha256(convert_to(jsonb_build_array(to_jsonb(f)-'created_at'-'fonte_iva_verificata',gruppi)::text,'UTF8')),'hex'));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('valida',false,'motivo','Fonte fiscale incompleta, discordante o non supportata: nessuna IVA presunta');
END $$;

CREATE FUNCTION artecna_contabilita.esamina_ricevuta_bluenext(e jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE receipt xml; raw text; kind text; sid text; nome text; dt text; de text; trasmessa timestamptz; esito_at timestamptz; esito text;
BEGIN
 raw:=e->'ricevuta'->>'xml';
 IF raw IS NULL OR raw ~* '<!DOCTYPE|<!ENTITY' OR octet_length(raw)>2000000 THEN RAISE EXCEPTION 'Ricevuta originale non valida' USING ERRCODE='22023'; END IF;
 receipt:=xmlparse(document raw);kind:=(xpath('local-name(/*)',receipt))[1]::text;
 esito:=CASE kind WHEN 'RicevutaConsegna' THEN 'consegnata' WHEN 'NotificaMancataConsegna' THEN 'mancata_consegna' WHEN 'NotificaScarto' THEN 'scartata' END;
 IF esito IS NULL OR cardinality(xpath('//*[local-name()="IdentificativoSdI"]',receipt))<>1 OR cardinality(xpath('//*[local-name()="NomeFile"]',receipt))<>1
 OR cardinality(xpath('//*[local-name()="DataOraRicezione"]',receipt))<>1 OR cardinality(xpath('//*[local-name()="DataOraConsegna" or local-name()="DataOraMessaADisposizione"]',receipt))<>1
 THEN RAISE EXCEPTION 'Ricevuta incompleta o non univoca' USING ERRCODE='22023'; END IF;
 sid:=(xpath('string(//*[local-name()="IdentificativoSdI"])',receipt))[1]::text;nome:=(xpath('string(//*[local-name()="NomeFile"])',receipt))[1]::text;
 dt:=(xpath('string(//*[local-name()="DataOraRicezione"])',receipt))[1]::text;de:=(xpath('string(//*[local-name()="DataOraConsegna" or local-name()="DataOraMessaADisposizione"])',receipt))[1]::text;
 IF sid !~ '^[0-9]{1,30}$' OR nome IS DISTINCT FROM regexp_replace(e->>'nome','^.*/','')
 OR nullif(e->'report'->>'idSdi','') IS NOT NULL AND sid IS DISTINCT FROM e->'report'->>'idSdi'
 OR dt !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' OR de !~ '(Z|[+-][0-9]{2}:[0-9]{2})$'
 THEN RAISE EXCEPTION 'Identificativo, file o date originali discordanti' USING ERRCODE='22023'; END IF;
 trasmessa:=dt::timestamptz;esito_at:=de::timestamptz;
 IF NOT isfinite(trasmessa) OR NOT isfinite(esito_at) OR trasmessa>now() OR esito_at>now() OR esito_at<trasmessa
 THEN RAISE EXCEPTION 'Date originali non valide' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('esito',esito,'protocollo',sid,'trasmessa_at',trasmessa,'esito_at',esito_at);
END $$;

CREATE FUNCTION public.anteprima_bluenext_integrata(p_documenti jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; e jsonb; x jsonb; f public.fatture_emesse; c uuid; cnt integer; scelta jsonb; report jsonb; out_rows jsonb:='[]';
 errori jsonb; versione jsonb; nome text; key text; keys text[]:='{}'; receipt_data jsonb; current_sdi jsonb; op jsonb;
BEGIN
 u:=artecna_guardie.utente_jwt_corrente();
 IF u IS NULL OR jsonb_typeof(p_documenti) IS DISTINCT FROM 'array' OR jsonb_array_length(p_documenti) NOT BETWEEN 1 AND 30
 OR octet_length(p_documenti::text)>10000000 THEN RAISE EXCEPTION 'Richiesta non valida' USING ERRCODE='42501'; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(p_documenti) LOOP
  errori:='[]';f:=NULL;scelta:=NULL;c:=NULL;report:=e->'report';nome:=e->>'nome';
  x:=artecna_contabilita.leggi_identita_xml_bluenext(e->>'xml');
  IF x IS NULL OR encode(sha256(convert_to(e->>'xml','UTF8')),'hex') IS DISTINCT FROM e->>'xml_sha'
  THEN RAISE EXCEPTION 'XML o impronta non verificabili' USING ERRCODE='22023'; END IF;
  key:=x->>'identita';IF key=ANY(keys) THEN RAISE EXCEPTION 'Identità ripetuta nel lotto' USING ERRCODE='23505'; END IF;keys:=array_append(keys,key);
  IF cardinality(xpath('//*[local-name()="Divisa"]',xmlparse(document e->>'xml')))<>1 OR (xpath('string(//*[local-name()="Divisa"])',xmlparse(document e->>'xml')))[1]::text<>'EUR'
  THEN errori:=errori||'"Valuta diversa da EUR o non documentata"'::jsonb; END IF;
  SELECT count(*) INTO cnt FROM public.fatture_emesse WHERE upper(btrim(numero_fattura))=upper(x->>'numero') AND extract(year FROM data_fattura)=extract(year FROM (x->>'data')::date);
  IF cnt=1 THEN
   SELECT * INTO f FROM public.fatture_emesse WHERE upper(btrim(numero_fattura))=upper(x->>'numero') AND extract(year FROM data_fattura)=extract(year FROM (x->>'data')::date);
   PERFORM artecna_contabilita.autorizza(f.id);c:=f.cantiere_id;
   IF (public.confronta_fattura_bluenext(f.id,e->>'xml',ARRAY[e->>'xml_sha'])->>'esito') NOT IN('Gia associata','Verificabile','Conferma assistita')
   THEN errori:=errori||'"Fattura storica discordante: nessun importo riscritto"'::jsonb; END IF;
   IF coalesce(artecna_contabilita.xml_originale_bluenext(f.id),to_jsonb(f)->>'xml_testo','')<>'' AND coalesce(artecna_contabilita.xml_originale_bluenext(f.id),to_jsonb(f)->>'xml_testo') IS DISTINCT FROM e->>'xml' THEN errori:=errori||'"XML persistito differente"'::jsonb; END IF;
  ELSIF cnt>1 THEN errori:=errori||'"Fattura non univoca"'::jsonb;
  ELSE c:=nullif(e->>'cantiere','')::uuid;
  END IF;
  IF c IS NULL THEN errori:=errori||'"Cantiere non verificato"'::jsonb;
  ELSIF artecna_clienti_sicurezza.puo_scrivere_sorgente(c) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Cantiere non autorizzato' USING ERRCODE='42501'; END IF;
  IF report IS NOT NULL AND report<>'null'::jsonb THEN
   IF jsonb_typeof(report)<>'object' OR upper(btrim(report->>'numero')) IS DISTINCT FROM upper(x->>'numero')
   OR report->>'data' IS DISTINCT FROM x->>'data' OR (report->>'totale')::numeric IS DISTINCT FROM (x->>'totale')::numeric
   OR upper(regexp_replace(btrim(report->>'cliente'),'[[:space:]]+',' ','g')) IS DISTINCT FROM upper(regexp_replace(x->>'cliente','[[:space:]]+',' ','g'))
   OR regexp_replace(upper(report->>'identificativo'),'^IT(?=[0-9]{11}$)','') NOT IN(coalesce(regexp_replace(x->>'partita_iva','^IT(?=[0-9]{11}$)',''),'!'),coalesce(x->>'codice_fiscale','!'))
   OR coalesce(report->>'identificativo','')='' OR coalesce(report->>'fonte','') !~ '^[a-f0-9]{64}$'
   OR coalesce(report->>'idSdi','')<>'' AND report->>'idSdi' !~ '^[0-9]{1,30}$'
   THEN errori:=errori||'"Report intermediario non coerente con XML"'::jsonb; END IF;
  END IF;
  IF f.id IS NOT NULL AND artecna_contabilita.xml_originale_bluenext(f.id) IS NULL AND coalesce(to_jsonb(f)->>'xml_testo','')=''
   AND EXISTS(SELECT FROM artecna_contabilita.attribuzioni_clienti z WHERE z.fattura_id=f.id AND z.scollegato_at IS NULL AND z.riconciliazione IS NOT NULL)
  THEN errori:=errori||'"Riconciliazione già attiva senza XML originale: verificare la fonte prima di aggiornarla"'::jsonb; END IF;
  IF e->'ricevuta' IS NOT NULL AND e->'ricevuta'<>'null'::jsonb THEN
   BEGIN
    receipt_data:=artecna_contabilita.esamina_ricevuta_bluenext(e);
    IF f.id IS NOT NULL THEN
     current_sdi:=public.leggi_fattura_sdi(f.id);
     IF current_sdi->>'esito' IN('consegnata','mancata_consegna','scartata') AND (current_sdi->>'esito',current_sdi->>'protocollo') IS DISTINCT FROM (receipt_data->>'esito',receipt_data->>'protocollo')
     THEN errori:=errori||'"Ricevuta discordante dalla cronologia SdI esistente"'::jsonb; END IF;
    END IF;
   EXCEPTION WHEN data_exception THEN errori:=errori||'"Ricevuta incompleta: verificare identificativo, file e date originali"'::jsonb;
   END;
  END IF;
  -- Independent ordinal numbers are deliberately absent from the matching key.
  -- Only an existing documented gross receipt can qualify: invoice emission is not a payment.
  IF c IS NOT NULL AND x->>'tipo' IN('TD01','TD02') AND (x->>'imponibile')::numeric+(x->>'iva')::numeric=(x->>'totale')::numeric
   AND cardinality(xpath('//*[local-name()="DatiRiepilogo"]/*[local-name()="EsigibilitaIVA"]',xmlparse(document e->>'xml')))=cardinality(xpath('//*[local-name()="DatiRiepilogo"]',xmlparse(document e->>'xml')))
   AND NOT EXISTS(SELECT FROM unnest(xpath('//*[local-name()="EsigibilitaIVA"]/text()',xmlparse(document e->>'xml'))) v WHERE v::text<>'I')
   AND NOT EXISTS(SELECT FROM unnest(xpath('//*[local-name()="Natura"]/text()',xmlparse(document e->>'xml'))) v WHERE v::text LIKE 'N6%') THEN
   SELECT count(*),(jsonb_agg(jsonb_build_object('acconto',a.id,'incasso',i.id,'netto',a.importo,'lordo',i.importo,'data',i.ricevuto_il,'stato_fiscale',public.leggi_acconto_fiscale(a.id)) ORDER BY a.id,i.id))->0 INTO cnt,scelta
   FROM public.acconti_cantiere a JOIN artecna_contabilita.incassi_lordi_clienti i ON i.acconto_id=a.id AND i.cantiere_id=a.cantiere_id
   WHERE a.cantiere_id=c AND a.importo=(x->>'imponibile')::numeric AND a.data_incasso=i.ricevuto_il AND i.ricevuto_il<=(x->>'data')::date
    AND i.importo=(x->>'totale')::numeric AND NOT EXISTS(SELECT FROM artecna_contabilita.quote_lorde_clienti q WHERE q.incasso_id=i.id AND q.revocato_at IS NULL)
    AND NOT EXISTS(SELECT FROM artecna_contabilita.attribuzioni_clienti z WHERE z.acconto_id=a.id AND z.scollegato_at IS NULL)
    AND NOT EXISTS(SELECT FROM artecna_contabilita.imputazioni_acconti z WHERE z.acconto_id=a.id AND z.destinazione='economia' AND z.revisione=(SELECT max(revisione) FROM artecna_contabilita.imputazioni_acconti WHERE acconto_id=a.id));
   IF cnt<>1 THEN scelta:=NULL; END IF;
  END IF;
  IF e->'problemi' IS NOT NULL AND e->'problemi'<>'[]'::jsonb THEN errori:=errori||e->'problemi'; END IF;
  IF e->'operazioni' IS NOT NULL AND e->'operazioni'<>'[]'::jsonb THEN
   IF jsonb_typeof(e->'operazioni')<>'array' OR jsonb_array_length(e->'operazioni')>30 THEN RAISE EXCEPTION 'Proposte manuali non valide' USING ERRCODE='22023'; END IF;
   FOR op IN SELECT value FROM jsonb_array_elements(e->'operazioni') LOOP
    IF op->>'rpc' IS DISTINCT FROM 'riconcilia_acconto_fattura' OR op->'args'->>'p_impronta' IS DISTINCT FROM e->>'xml_sha'
    OR f.id IS NOT NULL AND op->'args'->>'p_fattura' IS DISTINCT FROM f.id::text
    OR op->'args'->>'p_richiesta' IS NULL OR jsonb_typeof(op->'args'->'p_allocazioni') IS DISTINCT FROM 'array'
    THEN RAISE EXCEPTION 'Proposta non legata al documento originale' USING ERRCODE='22023'; END IF;
    PERFORM artecna_contabilita.autorizza_acconto_fiscale((op->'args'->>'p_acconto')::uuid);
    IF (SELECT cantiere_id FROM public.acconti_cantiere WHERE id=(op->'args'->>'p_acconto')::uuid) IS DISTINCT FROM c
    THEN RAISE EXCEPTION 'Proposta di altro cantiere' USING ERRCODE='42501'; END IF;
   END LOOP;
   scelta:=NULL;
  END IF;
  -- Full source photograph for optimistic concurrency. No originals or other-tenant records in the result.
  versione:=jsonb_build_array(to_jsonb(f),
   (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.acconti_cantiere a WHERE cantiere_id=c),
   (SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM artecna_contabilita.incassi_lordi_clienti i WHERE cantiere_id=c),
   (SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM artecna_contabilita.quote_lorde_clienti q JOIN artecna_contabilita.incassi_lordi_clienti i ON i.id=q.incasso_id WHERE i.cantiere_id=c),
   (SELECT jsonb_agg(to_jsonb(z) ORDER BY z.id) FROM artecna_contabilita.attribuzioni_clienti z WHERE z.cantiere_id=c),
   (SELECT jsonb_agg(to_jsonb(z) ORDER BY z.acconto_id,z.revisione) FROM artecna_contabilita.imputazioni_acconti z JOIN public.acconti_cantiere a ON a.id=z.acconto_id WHERE a.cantiere_id=c),
   CASE WHEN f.id IS NOT NULL THEN public.leggi_fattura_sdi(f.id) END);
  out_rows:=out_rows||jsonb_build_array(jsonb_build_object('key',key,'xml_sha',e->>'xml_sha','fattura',f.id,'cantiere',c,'numero',x->>'numero','data',x->>'data',
   'imponibile',x->'imponibile','iva',x->'iva','totale',x->'totale','tipo',x->>'tipo','cliente',x->>'cliente',
   'operazione',CASE WHEN f.id IS NULL THEN 'Nuova' ELSE 'Aggiorna fonti, conserva UUID e importi' END,'manuali',coalesce(jsonb_array_length(e->'operazioni'),0),
   'certa',errori='[]'::jsonb,'problemi',errori,'proposta',scelta,'report',report,'sdi',CASE WHEN f.id IS NOT NULL THEN public.leggi_fattura_sdi(f.id) END,
   'riepilogo',CASE WHEN c IS NOT NULL THEN (SELECT jsonb_build_object('numero',count(*),'totale_registrato',sum(a.importo),'posizioni',jsonb_agg(jsonb_build_object('id',a.id,'descrizione',a.descrizione,'importo',a.importo,'stato',public.leggi_acconto_fiscale(a.id)->>'stato') ORDER BY a.data_incasso,a.id)) FROM public.acconti_cantiere a WHERE a.cantiere_id=c) END,
   'versione',encode(sha256(convert_to(versione::text,'UTF8')),'hex')));
 END LOOP;
 -- Cross-document ambiguity is not resolved by the ordering of the import batch.
 SELECT jsonb_agg(CASE WHEN z->'proposta'<>'null'::jsonb AND (SELECT count(*) FROM jsonb_array_elements(out_rows) a WHERE a->'proposta'->>'incasso'=z->'proposta'->>'incasso')>1
 THEN jsonb_set(z,'{proposta}','null'::jsonb)||jsonb_build_object('avviso','Pagamento candidato a più fatture: riconciliazione manuale necessaria') ELSE z END ORDER BY ord) INTO out_rows
 FROM jsonb_array_elements(out_rows) WITH ORDINALITY AS rows(z,ord);
 RETURN jsonb_build_object('righe',out_rows,'versione',encode(sha256(convert_to(out_rows::text,'UTF8')),'hex'));
END $$;

CREATE FUNCTION public.leggi_esito_bluenext_integrato(p_richiesta uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE r artecna_contabilita.bluenext_lotti; e jsonb; BEGIN
 SELECT * INTO r FROM artecna_contabilita.bluenext_lotti WHERE richiesta=p_richiesta AND autore=artecna_guardie.utente_jwt_corrente();
 FOR e IN SELECT value FROM jsonb_array_elements(r.esito->'righe') LOOP PERFORM artecna_contabilita.autorizza((e->>'fattura')::uuid);END LOOP;RETURN r.esito;
END $$;

CREATE FUNCTION public.conferma_bluenext_integrato(p_richiesta uuid,p_documenti jsonb,p_fonti jsonb,p_versione text,p_riconcilia boolean,p_attestazione boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; preview jsonb; r jsonb; e jsonb; src jsonb; raw bytea; src_sha text; invoice_id uuid; x jsonb; confronto jsonb; esito jsonb:='[]';
 lotto artecna_contabilita.bluenext_lotti; input_sha text; source_keys text[]:='{}'; originale text; doc jsonb; alloc jsonb; action uuid; cnt integer; receipt xml; sid text; trasmessa timestamptz; esito_at timestamptz; sdi text; ref text; revisione bigint; nome text; op jsonb; risultato_manual jsonb:='[]';
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' OR p_richiesta IS NULL OR p_attestazione IS DISTINCT FROM true
 OR jsonb_typeof(p_fonti) IS DISTINCT FROM 'array' OR jsonb_array_length(p_fonti) NOT BETWEEN 1 AND 60 OR octet_length(p_fonti::text)>60000000
 THEN RAISE EXCEPTION 'Conferma o lotto non valido' USING ERRCODE='22023'; END IF;
 PERFORM set_config('lock_timeout','5s',true);
 PERFORM pg_advisory_xact_lock(714028,1);
 u:=artecna_guardie.utente_jwt_corrente();IF u IS NULL THEN RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501'; END IF;
 input_sha:=encode(sha256(convert_to(jsonb_build_array(p_documenti,p_fonti,p_riconcilia,p_attestazione)::text,'UTF8')),'hex');
 SELECT * INTO lotto FROM artecna_contabilita.bluenext_lotti WHERE richiesta=p_richiesta;
 IF FOUND THEN
  IF lotto.autore IS DISTINCT FROM u OR lotto.input_sha IS DISTINCT FROM input_sha THEN RAISE EXCEPTION 'Richiesta discordante' USING ERRCODE='23505'; END IF;
  RETURN public.leggi_esito_bluenext_integrato(p_richiesta);
 END IF;
 -- Prevent source changes between the blocking preview and all dependent writers.
 LOCK TABLE public.fatture_emesse,public.acconti_cantiere,artecna_contabilita.incassi_lordi_clienti,artecna_contabilita.quote_lorde_clienti,artecna_contabilita.attribuzioni_clienti,artecna_contabilita.imputazioni_acconti,artecna_contabilita.fatture_sdi IN SHARE ROW EXCLUSIVE MODE NOWAIT;
 preview:=public.anteprima_bluenext_integrata(p_documenti);
 IF preview->>'versione' IS DISTINCT FROM p_versione OR EXISTS(SELECT FROM jsonb_array_elements(preview->'righe') t WHERE t->'certa' IS DISTINCT FROM 'true'::jsonb)
 THEN RAISE EXCEPTION 'Anteprima cambiata o anomalie non risolte' USING ERRCODE='40001'; END IF;
 FOR src IN SELECT value FROM jsonb_array_elements(p_fonti) LOOP
  raw:=decode(src->>'base64','base64');src_sha:=encode(sha256(raw),'hex');
  IF src_sha IS DISTINCT FROM src->>'sha256' OR src_sha=ANY(source_keys) THEN RAISE EXCEPTION 'Fonte originale discordante o ripetuta' USING ERRCODE='22023'; END IF;
  source_keys:=array_append(source_keys,src_sha);
  INSERT INTO artecna_contabilita.bluenext_fonti(autore,sha256,nome,tipo,contenuto) VALUES(u,src_sha,src->>'nome',src->>'tipo',raw) ON CONFLICT DO NOTHING;
 END LOOP;
 FOR e IN SELECT value FROM jsonb_array_elements(p_documenti) LOOP
  x:=artecna_contabilita.leggi_identita_xml_bluenext(e->>'xml');
  SELECT value INTO STRICT r FROM jsonb_array_elements(preview->'righe') t WHERE t->>'key'=x->>'identita';
  -- Exact XML bytes must be among the private originals, including extracted ZIP entries.
  IF NOT EXISTS(SELECT FROM artecna_contabilita.bluenext_fonti s WHERE s.autore=u AND s.sha256=e->>'xml_sha' AND s.tipo='xml' AND convert_from(s.contenuto,'UTF8')=e->>'xml')
  OR NOT(e->>'xml_sha'=ANY(source_keys)) THEN RAISE EXCEPTION 'Originale XML assente' USING ERRCODE='22023'; END IF;
  IF e->'report' IS NOT NULL AND e->'report'<>'null'::jsonb AND (NOT(e->'report'->>'fonte'=ANY(source_keys)) OR NOT EXISTS(SELECT FROM artecna_contabilita.bluenext_fonti s WHERE s.autore=u AND s.sha256=e->'report'->>'fonte' AND s.tipo IN('xls','xlsx')))
  THEN RAISE EXCEPTION 'Originale report assente' USING ERRCODE='22023'; END IF;
  invoice_id:=(r->>'fattura')::uuid;
  IF invoice_id IS NULL THEN
   doc:=public.importa_fatture_bluenext(ARRAY[e->>'xml'],(r->>'cantiere')::uuid);
   IF doc->0->>'stato'<>'Nuova' THEN RAISE EXCEPTION 'Importazione non confermata' USING ERRCODE='40001'; END IF;invoice_id:=(doc->0->>'id')::uuid;
  ELSE
   confronto:=public.confronta_fattura_bluenext(invoice_id,e->>'xml',ARRAY[e->>'xml_sha']);
   originale:=public.associa_fattura_bluenext(invoice_id,e->>'xml',ARRAY[e->>'xml_sha'],confronto->>'versione',true);
   IF originale NOT IN('Associata','Gia associata') THEN RAISE EXCEPTION 'Associazione non confermata' USING ERRCODE='40001'; END IF;
  END IF;
  FOR src_sha IN SELECT unnest(source_keys) LOOP
   -- A report may cover several invoices; its full original remains private to its uploader.
   IF src_sha IN(e->>'xml_sha',e->>'archivio',e->'report'->>'fonte',e->'ricevuta'->>'fonte',e->'ricevuta'->>'archivio') OR EXISTS(SELECT FROM jsonb_array_elements(coalesce(e->'reports','[]')) v WHERE v->>'fonte'=src_sha) THEN
    INSERT INTO artecna_contabilita.bluenext_evidenze VALUES(invoice_id,u,src_sha,jsonb_build_object('origine','importazione_utente','xml_sha',e->>'xml_sha','report_intermediario',CASE WHEN e->'reports' IS NOT NULL THEN (SELECT jsonb_agg(v) FROM jsonb_array_elements(e->'reports') v WHERE v->>'fonte'=src_sha) ELSE e->'report' END,'ricevuta_originale',false)) ON CONFLICT DO NOTHING;
   END IF;
  END LOOP;
  doc:=NULL;
  IF x->>'tipo' IN('TD01','TD02') THEN
   BEGIN doc:=artecna_contabilita.documento_riconciliazione(invoice_id,NULL);
   EXCEPTION WHEN raise_exception OR data_exception THEN doc:=jsonb_build_object('valida',false,'motivo','Documento da gestire con il percorso fiscale dedicato');END;
  END IF;
  IF doc->'valida'='true'::jsonb THEN
   UPDATE public.fatture_emesse f SET fonte_iva_verificata=jsonb_build_object('semantica','importo','documento_verificato',true,'riferimento','Originale XML SHA256 '||(e->>'xml_sha'),'gruppi',doc->'gruppi','fotografia',artecna_contabilita.fotografia_fonte_iva(to_jsonb(f)),'autore',u,'verificata_at',now()) WHERE f.id=invoice_id;
  END IF;
  -- Excel never manufactures an original SdI evidence or transmission timestamp.
  IF e->'ricevuta' IS NOT NULL AND e->'ricevuta'<>'null'::jsonb THEN
   ref:=e->'ricevuta'->>'xml';
   IF ref ~* '<!DOCTYPE|<!ENTITY' OR octet_length(ref)>2000000 OR NOT EXISTS(SELECT FROM artecna_contabilita.bluenext_fonti s WHERE s.autore=u AND s.sha256=e->'ricevuta'->>'fonte' AND s.contenuto=convert_to(ref,'UTF8')) THEN RAISE EXCEPTION 'Ricevuta originale non verificabile'; END IF;
   doc:=artecna_contabilita.esamina_ricevuta_bluenext(e);sdi:=doc->>'esito';sid:=doc->>'protocollo';trasmessa:=(doc->>'trasmessa_at')::timestamptz;esito_at:=(doc->>'esito_at')::timestamptz;
   doc:=public.leggi_fattura_sdi(invoice_id);revisione:=coalesce((doc->>'revisione')::bigint,0);
   IF doc->>'esito' IN('consegnata','mancata_consegna','scartata') AND (doc->>'esito',doc->>'protocollo') IS DISTINCT FROM (sdi,sid)
   THEN RAISE EXCEPTION 'Esito SdI discordante: verifica manuale della cronologia' USING ERRCODE='23514'; END IF;
   IF revisione=0 OR (doc->>'tipo',doc->>'esito',doc->>'protocollo',(doc->>'trasmessa_at')::timestamptz,(doc->>'esito_at')::timestamptz) IS DISTINCT FROM (x->>'tipo',sdi,sid,trasmessa,esito_at) THEN
    PERFORM public.registra_evidenza_sdi(invoice_id,revisione,x->>'tipo',sdi,trasmessa,esito_at,sid,'Fonte originale SHA256 '||(e->'ricevuta'->>'fonte'),NULL,'[]'::jsonb);
   END IF;
   UPDATE artecna_contabilita.bluenext_evidenze SET proiezione=proiezione||jsonb_build_object('ricevuta_originale',true,'controlli','struttura_nome_id_date','origine_attestata_utente',true,'firma_digitale_verificata',false) WHERE fattura_id=invoice_id AND autore=u AND fonte_sha=e->'ricevuta'->>'fonte';
  END IF;
  doc:=NULL;
  IF p_riconcilia AND r->'proposta' IS NOT NULL AND r->'proposta'<>'null'::jsonb THEN
   doc:=artecna_contabilita.documento_riconciliazione(invoice_id,NULL);
   IF doc->'valida' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Fonte fiscale da verificare' USING ERRCODE='23514'; END IF;
   SELECT jsonb_agg(jsonb_build_object('indice',g->'indice','imponibile',g->'imponibile') ORDER BY (g->>'indice')::integer) INTO alloc FROM jsonb_array_elements(doc->'gruppi') g;
   action:=gen_random_uuid();
   doc:=public.riconcilia_acconto_fattura(action,invoice_id,(r->'proposta'->>'acconto')::uuid,(r->'proposta'->>'incasso')::uuid,NULL,alloc,doc->>'impronta','Originale XML verificato; lotto '||p_richiesta::text,true,NULL);
  END IF;
  risultato_manual:='[]';
  IF p_riconcilia THEN
   FOR op IN SELECT value->'args' FROM jsonb_array_elements(coalesce(e->'operazioni','[]')) LOOP
    doc:=artecna_contabilita.documento_riconciliazione(invoice_id,NULL);
    risultato_manual:=risultato_manual||jsonb_build_array(public.riconcilia_acconto_fattura((op->>'p_richiesta')::uuid,invoice_id,(op->>'p_acconto')::uuid,nullif(op->>'p_incasso','')::uuid,
     nullif(op->'p_nuovo','null'::jsonb),op->'p_allocazioni',doc->>'impronta',op->>'p_fonte_base',coalesce((op->>'p_conferma_fiscale')::boolean,false),NULL));
   END LOOP;
  END IF;
  FOR action IN SELECT DISTINCT acconto_id FROM artecna_contabilita.attribuzioni_clienti WHERE fattura_id=invoice_id AND scollegato_at IS NULL LOOP
   PERFORM artecna_notifiche.riconcilia_acconto_fiscale(action,now());
  END LOOP;
  esito:=esito||jsonb_build_array(jsonb_build_object('fattura',invoice_id,'key',r->>'key','riconciliazione',doc,'proposte_manuali',risultato_manual,'report_intermediario',e->'report','sdi',public.leggi_fattura_sdi(invoice_id)));
 END LOOP;
 -- No unreferenced private originals retained after a partially selected batch.
 DELETE FROM artecna_contabilita.bluenext_fonti s WHERE s.autore=u AND s.sha256=ANY(source_keys) AND NOT EXISTS(SELECT FROM artecna_contabilita.bluenext_evidenze z WHERE (z.autore,z.fonte_sha)=(s.autore,s.sha256));
 doc:=jsonb_build_object('confermato',true,'richiesta',p_richiesta,'righe',esito);
 INSERT INTO artecna_contabilita.bluenext_lotti VALUES(p_richiesta,u,input_sha,doc,now());RETURN doc;
END $$;

CREATE FUNCTION public.leggi_fonte_bluenext(p_fattura uuid,p_sha text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; result jsonb; invoice uuid; BEGIN
 u:=artecna_contabilita.autorizza(p_fattura);
 FOR invoice IN SELECT fattura_id FROM artecna_contabilita.bluenext_evidenze WHERE autore=u AND fonte_sha=p_sha LOOP PERFORM artecna_contabilita.autorizza(invoice);END LOOP;
 SELECT jsonb_build_object('nome',s.nome,'tipo',s.tipo,'sha256',s.sha256,'base64',encode(s.contenuto,'base64')) INTO result
 FROM artecna_contabilita.bluenext_fonti s JOIN artecna_contabilita.bluenext_evidenze e ON (s.autore,s.sha256)=(e.autore,e.fonte_sha)
 WHERE e.fattura_id=p_fattura AND s.autore=u AND s.sha256=p_sha;RETURN result;
END $$;
CREATE FUNCTION public.elenca_fonti_bluenext(p_fattura uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; result jsonb; BEGIN
 u:=artecna_contabilita.autorizza(p_fattura);
 SELECT coalesce(jsonb_agg(jsonb_build_object('nome',s.nome,'tipo',s.tipo,'sha256',s.sha256,'bytes',octet_length(s.contenuto),'acquisita_at',s.acquisita_at,'puo_scaricare',s.autore=u,'evidenza',e.proiezione) ORDER BY s.acquisita_at,s.sha256),'[]') INTO result
 FROM artecna_contabilita.bluenext_fonti s JOIN artecna_contabilita.bluenext_evidenze e ON (s.autore,s.sha256)=(e.autore,e.fonte_sha) WHERE e.fattura_id=p_fattura;RETURN result;
END $$;
REVOKE ALL ON FUNCTION artecna_contabilita.esamina_ricevuta_bluenext(jsonb),artecna_contabilita.xml_originale_bluenext(uuid),artecna_contabilita.pulisci_fonti_bluenext(),public.anteprima_bluenext_integrata(jsonb),public.conferma_bluenext_integrato(uuid,jsonb,jsonb,text,boolean,boolean),public.leggi_esito_bluenext_integrato(uuid),public.leggi_fonte_bluenext(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.anteprima_bluenext_integrata(jsonb),public.conferma_bluenext_integrato(uuid,jsonb,jsonb,text,boolean,boolean),public.leggi_esito_bluenext_integrato(uuid),public.leggi_fonte_bluenext(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.elenca_fonti_bluenext(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.elenca_fonti_bluenext(uuid) TO authenticated;
UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog();
COMMIT;
