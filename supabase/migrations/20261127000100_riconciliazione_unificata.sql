-- CANDIDATA LOCALE. Nessuna applicazione Production autorizzata.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.leggi_acconto_compilazione(uuid)') IS NULL
 OR to_regprocedure('artecna_notifiche.riconcilia_acconto_fiscale(uuid,timestamp with time zone)') IS NULL
 OR (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
 IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()]
 THEN RAISE EXCEPTION 'STOP_PREREQUISITI_RICONCILIAZIONE'; END IF;
END $$;
-- No new ledger: provenance on the existing contractual allocation and a typed link.
ALTER TABLE artecna_contabilita.attribuzioni_clienti ADD COLUMN riconciliazione jsonb;
ALTER TABLE artecna_contabilita.quote_lorde_clienti ADD COLUMN attribuzione_id uuid
 REFERENCES artecna_contabilita.attribuzioni_clienti(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX quota_lorda_attribuzione_univoca ON artecna_contabilita.quote_lorde_clienti(attribuzione_id)
 WHERE attribuzione_id IS NOT NULL;


-- Explicit document verification metadata, never a rewrite of historical amounts.
ALTER TABLE public.fatture_emesse ADD COLUMN fonte_iva_verificata jsonb;
CREATE FUNCTION artecna_contabilita.fotografia_fonte_iva(p jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_array(coalesce(p->>'id',''),coalesce(p->>'numero_fattura',''),coalesce(p->>'data_fattura',''),coalesce(p->>'cliente',''),
 round((p->>'imponibile')::numeric*100)::bigint,round((p->>'iva')::numeric*100)::bigint,round((p->>'totale')::numeric*100)::bigint,
 p->'bluenext_identita',p->'bluenext_impronta',p->'bluenext_tipo',p->'xml_url',p->'pdf_url',p->'note',p->'tipo_documento',p->'tipo_file')
$$;
CREATE FUNCTION artecna_contabilita.risolvi_iva_persistita(p jsonb,p_verifica jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE b numeric; field numeric; total numeric; tax numeric; proof jsonb; semantic text; blu boolean; groups jsonb; g jsonb; out_groups jsonb:='[]';
 n numeric; v numeric; rate numeric; nature text; nb numeric:=0; nt numeric:=0; idx integer:=0; code text; explanation text;
BEGIN
 BEGIN b:=(p->>'imponibile')::numeric;field:=(p->>'iva')::numeric;total:=(p->>'totale')::numeric;
 EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'DATI_INCOMPLETI' USING DETAIL='Identità e importi del documento da verificare.'; END;
 IF coalesce(p->>'id','')='' OR btrim(coalesce(p->>'numero_fattura',''))='' OR coalesce(p->>'data_fattura','') !~ '^\d{4}-\d{2}-\d{2}$'
 OR btrim(coalesce(p->>'cliente',''))='' OR b IS NULL OR field IS NULL OR total IS NULL OR NOT(b>0 AND b<1e12 AND field>=0 AND field<1e12 AND total>0 AND total<1e12)
 OR b<>round(b,2) OR field<>round(field,2) OR total<>round(total,2) THEN RAISE EXCEPTION 'DATI_INCOMPLETI' USING DETAIL='Identità e importi del documento da verificare.'; END IF;
 IF p->>'bluenext_tipo'='TD04' OR p->>'tipo_documento'='TD04' OR coalesce(p->>'tipo_documento','') NOT IN('','fattura','TD01','TD02') THEN RAISE EXCEPTION 'TIPO_NON_SUPPORTATO' USING DETAIL='Nota di credito o tipo speciale: usare il percorso fiscale dedicato.'; END IF;
 blu:=coalesce(p->>'bluenext_identita','') ~ '^[a-f0-9]{64}$' AND coalesce(p->>'bluenext_impronta','') ~ '^[a-f0-9]{64}$' AND p->>'bluenext_tipo' IN('TD01','TD02');
 proof:=coalesce(p_verifica,p->'fonte_iva_verificata','{}');
 IF p_verifica IS NULL AND p->'fonte_iva_verificata' IS NOT NULL AND p->'fonte_iva_verificata'<>'null'::jsonb AND p->'fonte_iva_verificata'<>'{}'::jsonb
 AND proof->'fotografia' IS DISTINCT FROM artecna_contabilita.fotografia_fonte_iva(p) THEN RAISE EXCEPTION 'FONTE_CAMBIATA' USING DETAIL='Dati modificati dopo la verifica documentale: ripetere il confronto con la fonte originale.'; END IF;
 IF jsonb_typeof(proof)<>'object' OR EXISTS(SELECT FROM jsonb_object_keys(proof) k WHERE k NOT IN('semantica','riferimento','documento_verificato','gruppi','fotografia','autore','verificata_at'))
 OR length(proof->>'riferimento')>500 OR length(proof::text)>50000
 OR proof->'documento_verificato' IS DISTINCT FROM 'true'::jsonb OR coalesce(length(btrim(proof->>'riferimento')),0)<8 OR coalesce(proof->>'semantica','') NOT IN('importo','aliquota') THEN
 semantic:=CASE WHEN blu THEN 'importo' END;
 RAISE EXCEPTION 'VERIFICA_DOCUMENTALE_RICHIESTA' USING DETAIL=CASE WHEN blu THEN 'Bluenext conserva un importo IVA aggregato. Verificare il documento originale; nessuna aliquota unica è deducibile.' ELSE 'Convenzione IVA storica non documentata. Verificare se il campo indica imposta o aliquota e confrontare il documento originale.' END;
 END IF;
 semantic:=proof->>'semantica';
 IF blu AND semantic<>'importo' THEN RAISE EXCEPTION 'PROVENIENZA_DISCORDANTE' USING DETAIL='La provenienza Bluenext documenta un importo IVA, non una percentuale.'; END IF;
 IF semantic='aliquota' AND (coalesce(p->>'xml_url','')<>'' OR p->>'tipo_file'='xml' OR coalesce(p->>'note','') ~* 'import\s+xml') THEN RAISE EXCEPTION 'PROVENIENZA_DISCORDANTE' USING DETAIL='Import XML storico: il campo IVA non può essere trattato come aliquota manuale.'; END IF;
 IF semantic='aliquota' AND field>100 THEN RAISE EXCEPTION 'ALIQUOTA_NON_VALIDA' USING DETAIL='Aliquota documentata fuori intervallo.'; END IF;
 tax:=CASE WHEN semantic='importo' THEN field ELSE round(b*field/100,2) END;
 IF b+tax<>total THEN RAISE EXCEPTION 'QUADRATURA_DISCORDANTE' USING DETAIL='Imponibile, imposta e lordo non quadrano al centesimo; verificare altre componenti o arrotondamenti documentali.'; END IF;
 groups:=proof->'gruppi';
 IF groups IS NULL OR groups='null'::jsonb THEN groups:=jsonb_build_array(jsonb_build_object('imponibile',b,'iva',tax,'aliquota',CASE WHEN semantic='aliquota' THEN field END,'natura',NULL)); END IF;
 IF jsonb_typeof(groups)<>'array' OR jsonb_array_length(groups) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'RIEPILOGHI_NON_VALIDI' USING DETAIL='Riepiloghi fiscali mancanti o non validi.'; END IF;
 FOR g IN SELECT value FROM jsonb_array_elements(groups) LOOP
  n:=(g->>'imponibile')::numeric;v:=(g->>'iva')::numeric;rate:=(g->>'aliquota')::numeric;nature:=nullif(g->>'natura','');
  IF n IS NULL OR v IS NULL OR NOT(n>0 AND n<1e12 AND v>=0 AND v<1e12) OR n<>round(n,2) OR v<>round(v,2)
  OR NOT(g ? 'aliquota') OR rate IS NOT NULL AND (rate<0 OR rate>100 OR rate<>round(rate,2) OR v<>round(n*rate/100,2))
  OR rate IS NULL AND (jsonb_array_length(groups)<>1 OR nature IS NOT NULL)
  OR rate=0 AND coalesce(nature,'') !~ '^N[1-7](\.[0-9]+)?$' OR rate>0 AND nature IS NOT NULL
  THEN RAISE EXCEPTION 'RIEPILOGHI_NON_VALIDI' USING DETAIL='Riepiloghi, aliquote, natura e imposte non coerenti. Nessuna aliquota stimata.'; END IF;
  out_groups:=out_groups||jsonb_build_array(jsonb_build_object('indice',idx,'imponibile',n,'iva',v,'aliquota',rate,'natura',nature));idx:=idx+1;nb:=nb+n;nt:=nt+v;
 END LOOP;
 IF nb<>b OR nt<>tax THEN RAISE EXCEPTION 'RIEPILOGHI_DISCORDANTI' USING DETAIL='I riepiloghi documentali non coincidono con gli importi persistiti.'; END IF;
 RETURN jsonb_build_object('versione',1,'valida',true,'codice','DOCUMENTALE_ATTESTATA','motivo',CASE WHEN EXISTS(SELECT FROM jsonb_array_elements(out_groups) x WHERE x->>'aliquota' IS NULL) THEN 'Imposta aggregata verificata: aliquote non disponibili, consentita solo l’intera quota residua.' ELSE 'Riepiloghi verificati sul documento originale; trasmissione SdI e incasso restano indipendenti.' END,
 'fonte',CASE WHEN blu THEN 'Bluenext e verifica documentale' ELSE 'Verifica documentale esplicita' END,'livello','DOCUMENTALE_ATTESTATA','imponibile',b,'iva_importo',tax,'totale',total,'semantica',semantic,'gruppi',out_groups);
EXCEPTION WHEN OTHERS THEN
 GET STACKED DIAGNOSTICS code=MESSAGE_TEXT,explanation=PG_EXCEPTION_DETAIL;
 IF code NOT IN('DATI_INCOMPLETI','TIPO_NON_SUPPORTATO','FONTE_CAMBIATA','VERIFICA_DOCUMENTALE_RICHIESTA','PROVENIENZA_DISCORDANTE','ALIQUOTA_NON_VALIDA','QUADRATURA_DISCORDANTE','RIEPILOGHI_NON_VALIDI','RIEPILOGHI_DISCORDANTI') THEN code:='RIEPILOGHI_NON_VALIDI';explanation:='Riepiloghi, aliquote, natura e imposte non coerenti. Nessuna aliquota stimata.'; END IF;
 RETURN jsonb_build_object('versione',1,'valida',false,'codice',code,'motivo',explanation,'fonte','Da verificare','livello','NON_VERIFICABILE','imponibile',b,'iva_importo',NULL,'totale',total,'semantica',CASE WHEN code='VERIFICA_DOCUMENTALE_RICHIESTA' THEN semantic END,'gruppi','[]'::jsonb);
END $$;
CREATE FUNCTION artecna_contabilita.proteggi_fonte_iva() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF current_user IN('anon','authenticated','service_role') AND ((TG_OP='INSERT' AND NEW.fonte_iva_verificata IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.fonte_iva_verificata IS DISTINCT FROM OLD.fonte_iva_verificata)) THEN
 RAISE EXCEPTION 'Verifica documentale riservata alla riconciliazione autorizzata' USING ERRCODE='42501'; END IF;RETURN NEW;
END $$;
CREATE TRIGGER fonte_iva_riservata BEFORE INSERT OR UPDATE ON public.fatture_emesse FOR EACH ROW EXECUTE FUNCTION artecna_contabilita.proteggi_fonte_iva();
REVOKE ALL ON FUNCTION artecna_contabilita.fotografia_fonte_iva(jsonb),artecna_contabilita.risolvi_iva_persistita(jsonb,jsonb),artecna_contabilita.proteggi_fonte_iva() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION artecna_contabilita.documento_riconciliazione(p_fattura uuid,p_verifica jsonb DEFAULT NULL) RETURNS jsonb
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
END $$;
REVOKE ALL ON FUNCTION artecna_contabilita.documento_riconciliazione(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.leggi_riconciliazione_unificata(p_fattura uuid DEFAULT NULL,p_acconto uuid DEFAULT NULL,p_verifica jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE c uuid; ca uuid; u uuid;
BEGIN
 IF p_fattura IS NOT NULL THEN
  u:=artecna_contabilita.autorizza(p_fattura);SELECT cantiere_id INTO c FROM public.fatture_emesse WHERE id=p_fattura;
 END IF;
 IF p_acconto IS NOT NULL THEN
  u:=artecna_contabilita.autorizza_acconto_fiscale(p_acconto);SELECT cantiere_id INTO ca FROM public.acconti_cantiere WHERE id=p_acconto;
  IF c IS NOT NULL AND c IS DISTINCT FROM ca THEN RAISE EXCEPTION 'Contesti discordanti' USING ERRCODE='42501'; END IF;c:=ca;
 END IF;
 IF c IS NULL THEN RAISE EXCEPTION 'Contesto assente' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('versione',1,'autore',u,'cantiere_id',c,'cantiere',(SELECT nome FROM public.cantieri WHERE id=c),
 'acconti',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'descrizione',a.descrizione,'importo',a.importo,'data',a.data_incasso,
 'proposta',a.compilazione_unica,'attribuito',(SELECT coalesce(sum(l.importo),0) FROM artecna_contabilita.attribuzioni_clienti l WHERE l.acconto_id=a.id AND l.scollegato_at IS NULL),
 'fiscale',public.leggi_acconto_fiscale(a.id)) ORDER BY a.data_incasso,a.id) FROM public.acconti_cantiere a WHERE a.cantiere_id=c),'[]'),
 'fatture',coalesce((SELECT jsonb_agg(jsonb_build_object('id',f.id,'numero',f.numero_fattura,'data',f.data_fattura,'cliente',f.cliente,
 'totale',f.totale,'documento',artecna_contabilita.documento_riconciliazione(f.id,CASE WHEN f.id=p_fattura THEN p_verifica END),'sdi',coalesce(public.leggi_fattura_sdi(f.id),'{}'::jsonb),
 'collegamenti_netto',coalesce((SELECT jsonb_agg(jsonb_build_object('id',z.id,'acconto_id',z.acconto_id,'importo',z.importo,'attiva',z.scollegato_at IS NULL,'unificata',z.riconciliazione IS NOT NULL)) FROM artecna_contabilita.attribuzioni_clienti z WHERE z.fattura_id=f.id),'[]'),
 'attribuito_netto',(SELECT coalesce(sum(l.importo),0) FROM artecna_contabilita.attribuzioni_clienti l WHERE l.fattura_id=f.id AND l.scollegato_at IS NULL),
 'quote',coalesce((SELECT jsonb_agg(jsonb_build_object('id',q.id,'attribuzione_id',q.attribuzione_id,'incasso_id',q.incasso_id,'importo',q.importo,'revocata',q.revocato_at IS NOT NULL,
 'allocazioni',l.riconciliazione->'allocazioni')) FROM artecna_contabilita.quote_lorde_clienti q LEFT JOIN artecna_contabilita.attribuzioni_clienti l ON l.id=q.attribuzione_id WHERE q.fattura_id=f.id),'[]')) ORDER BY f.data_fattura,f.id) FROM public.fatture_emesse f WHERE f.cantiere_id=c),'[]'),
 'incassi',coalesce((SELECT jsonb_agg(to_jsonb(i)||jsonb_build_object('disponibile',i.importo-(SELECT coalesce(sum(q.importo),0) FROM artecna_contabilita.quote_lorde_clienti q WHERE q.incasso_id=i.id AND q.revocato_at IS NULL))) FROM artecna_contabilita.incassi_lordi_clienti i WHERE i.cantiere_id=c),'[]'));
END $$;

CREATE FUNCTION public.riconcilia_acconto_fattura(p_richiesta uuid,p_fattura uuid,p_acconto uuid,p_incasso uuid,
 p_nuovo jsonb,p_allocazioni jsonb,p_impronta text,p_fonte_base text,p_conferma_fiscale boolean DEFAULT false,p_verifica jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; a public.acconti_cantiere; f public.fatture_emesse; i artecna_contabilita.incassi_lordi_clienti;
 l artecna_contabilita.attribuzioni_clienti; q artecna_contabilita.quote_lorde_clienti; d jsonb; input jsonb;
 parte jsonb; gruppo jsonb; alloc jsonb:='[]'; n numeric; v numeric; prima numeric; netto numeric:=0; lordo numeric:=0; idx integer; ids integer[]:='{}'; rev bigint; h artecna_contabilita.acconti_fiscali;
BEGIN
 PERFORM pg_advisory_xact_lock(714028,1);
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Usare READ COMMITTED' USING ERRCODE='22023'; END IF;
 u:=artecna_contabilita.autorizza(p_fattura);PERFORM artecna_contabilita.autorizza_acconto_fiscale(p_acconto);
 input:=jsonb_build_array(p_fattura,p_acconto,p_incasso,p_nuovo,p_allocazioni,p_impronta,p_fonte_base,p_conferma_fiscale,p_verifica);
 SELECT z.* INTO q FROM artecna_contabilita.quote_lorde_clienti z LEFT JOIN artecna_contabilita.attribuzioni_clienti x ON x.id=z.attribuzione_id
 WHERE z.id=p_richiesta OR x.riconciliazione->>'richiesta'=p_richiesta::text;
 IF FOUND THEN
  IF q.attribuzione_id IS NULL THEN RAISE EXCEPTION 'Identità richiesta occupata' USING ERRCODE='23505'; END IF;
  SELECT * INTO STRICT l FROM artecna_contabilita.attribuzioni_clienti WHERE id=q.attribuzione_id;
  IF l.riconciliazione->>'autore' IS DISTINCT FROM u::text OR l.riconciliazione->'input' IS DISTINCT FROM input THEN RAISE EXCEPTION 'Richiesta discordante' USING ERRCODE='23505'; END IF;
  RETURN jsonb_build_object('confermato',true,'revocata',q.revocato_at IS NOT NULL,'richiesta',p_richiesta,'fiscale',public.leggi_acconto_fiscale(p_acconto));
 END IF;
 SELECT * INTO STRICT f FROM public.fatture_emesse WHERE id=p_fattura FOR NO KEY UPDATE;
 SELECT * INTO STRICT a FROM public.acconti_cantiere WHERE id=p_acconto FOR NO KEY UPDATE;
 IF p_richiesta IS NULL OR a.cantiere_id IS DISTINCT FROM f.cantiere_id OR a.cantiere_id IS NULL
 OR a.importo IS NULL OR a.importo<=0 OR coalesce(length(btrim(p_fonte_base)),0)<8
 OR artecna_contabilita.totale_fattura_finanziario(f) IS NULL
 OR EXISTS(SELECT FROM artecna_contabilita.sdi_corrente WHERE rettifica_id=f.id OR fattura_id=f.id AND tipo='TD04')
 THEN RAISE EXCEPTION 'Contesto o base storica non documentati' USING ERRCODE='23514'; END IF;
 d:=artecna_contabilita.documento_riconciliazione(f.id,p_verifica);
 IF (d->>'valida')::boolean IS NOT TRUE OR d->>'impronta' IS DISTINCT FROM p_impronta
 OR jsonb_typeof(p_allocazioni) IS DISTINCT FROM 'array' OR jsonb_array_length(p_allocazioni)=0
 THEN RAISE EXCEPTION 'Fonte cambiata o non verificabile' USING ERRCODE='40001'; END IF;
 IF p_verifica IS NOT NULL THEN
  IF coalesce(to_jsonb(f)->>'xml_testo','')<>'' OR jsonb_typeof(p_verifica)<>'object' THEN RAISE EXCEPTION 'Fonte XML prioritaria o verifica non valida' USING ERRCODE='22023'; END IF;
  UPDATE public.fatture_emesse SET fonte_iva_verificata=p_verifica||jsonb_build_object('fotografia',artecna_contabilita.fotografia_fonte_iva(to_jsonb(f)),'autore',u,'verificata_at',now()) WHERE id=f.id;
 END IF;
 IF EXISTS(SELECT FROM artecna_contabilita.attribuzioni_clienti z WHERE z.fattura_id=f.id AND z.scollegato_at IS NULL AND z.riconciliazione IS NOT NULL AND z.riconciliazione->>'impronta' IS DISTINCT FROM d->>'impronta') THEN RAISE EXCEPTION 'Fonte diversa dalle quote attive: revocare e verificare prima di ripartire' USING ERRCODE='23514'; END IF;
 FOR parte IN SELECT value FROM jsonb_array_elements(p_allocazioni) LOOP
  idx:=(parte->>'indice')::integer;n:=(parte->>'imponibile')::numeric;
  IF idx=ANY(ids) OR idx<0 OR NOT(n>0 AND n<1e12) OR n<>round(n,2) THEN RAISE EXCEPTION 'Ripartizione non valida' USING ERRCODE='22023'; END IF;
  ids:=array_append(ids,idx);gruppo:=d->'gruppi'->idx;
  IF gruppo IS NULL THEN RAISE EXCEPTION 'Riepilogo assente' USING ERRCODE='22023'; END IF;
  SELECT coalesce(sum((x->>'imponibile')::numeric),0) INTO prima FROM artecna_contabilita.attribuzioni_clienti z
  CROSS JOIN LATERAL jsonb_array_elements(z.riconciliazione->'allocazioni') x
  WHERE z.fattura_id=f.id AND z.scollegato_at IS NULL AND (x->>'indice')::integer=idx;
  IF prima+n>(gruppo->>'imponibile')::numeric THEN RAISE EXCEPTION 'Disponibilità imponibile esaurita' USING ERRCODE='23514'; END IF;
  IF gruppo->>'aliquota' IS NULL THEN
   IF n<>(gruppo->>'imponibile')::numeric-prima THEN RAISE EXCEPTION 'Aliquote non disponibili: serve il riepilogo originale per una quota parziale' USING ERRCODE='23514'; END IF;
   SELECT (gruppo->>'iva')::numeric-coalesce(sum((x->>'iva')::numeric),0) INTO v FROM artecna_contabilita.attribuzioni_clienti z CROSS JOIN LATERAL jsonb_array_elements(z.riconciliazione->'allocazioni') x WHERE z.fattura_id=f.id AND z.scollegato_at IS NULL AND (x->>'indice')::integer=idx;
  ELSE
   v:=round((prima+n)*(gruppo->>'aliquota')::numeric/100,2)-round(prima*(gruppo->>'aliquota')::numeric/100,2);
  END IF;
  alloc:=alloc||jsonb_build_array(jsonb_build_object('indice',idx,'imponibile',n,'iva',v));netto:=netto+n;lordo:=lordo+n+v;
 END LOOP;
 -- Reuse a single exact legacy allocation; never infer ambiguous historical tax splits.
 IF EXISTS(SELECT FROM artecna_contabilita.attribuzioni_clienti WHERE fattura_id=f.id AND scollegato_at IS NULL AND riconciliazione IS NULL
 AND (acconto_id<>a.id OR importo<>netto OR jsonb_array_length(d->'gruppi')<>1)) THEN RAISE EXCEPTION 'Storico da riconciliare manualmente' USING ERRCODE='23514'; END IF;
 SELECT * INTO l FROM artecna_contabilita.attribuzioni_clienti WHERE fattura_id=f.id AND acconto_id=a.id AND scollegato_at IS NULL AND riconciliazione IS NULL;
 IF FOUND AND (SELECT count(*) FROM artecna_contabilita.attribuzioni_clienti WHERE fattura_id=f.id AND acconto_id=a.id AND scollegato_at IS NULL AND riconciliazione IS NULL)<>1
 THEN RAISE EXCEPTION 'Storico ambiguo' USING ERRCODE='23514'; END IF;
 IF (SELECT coalesce(sum(importo),0) FROM artecna_contabilita.attribuzioni_clienti WHERE fattura_id=f.id AND scollegato_at IS NULL AND id IS DISTINCT FROM l.id)+netto
 >(SELECT sum((g->>'imponibile')::numeric) FROM jsonb_array_elements(d->'gruppi') g)
 THEN RAISE EXCEPTION 'Capienza netta fattura insufficiente' USING ERRCODE='23514'; END IF;
 IF (SELECT coalesce(sum(importo),0) FROM artecna_contabilita.attribuzioni_clienti WHERE acconto_id=a.id AND scollegato_at IS NULL AND id IS DISTINCT FROM l.id)+netto>a.importo
 THEN RAISE EXCEPTION 'Disponibilità contrattuale insufficiente' USING ERRCODE='23514'; END IF;
 IF p_incasso IS NOT NULL AND p_nuovo IS NOT NULL OR p_incasso IS NULL AND p_nuovo IS NULL THEN RAISE EXCEPTION 'Selezionare un pagamento' USING ERRCODE='22023'; END IF;
 IF p_nuovo IS NOT NULL THEN
  IF coalesce((p_nuovo->>'verificato')::boolean,false) IS NOT TRUE
  OR EXISTS(SELECT FROM artecna_contabilita.incassi_lordi_clienti WHERE acconto_id=a.id) AND coalesce((p_nuovo->>'distinto')::boolean,false) IS NOT TRUE
  THEN RAISE EXCEPTION 'Riutilizzare il pagamento esistente o verificare lo storico' USING ERRCODE='23514'; END IF;
  PERFORM public.conferma_incasso_lordo_cliente(p_richiesta,a.id,(p_nuovo->>'importo')::numeric,(p_nuovo->>'data')::date,p_nuovo->>'metodo',p_nuovo->>'riferimento',p_nuovo->>'fonte');
  p_incasso:=p_richiesta;
 END IF;
 SELECT * INTO STRICT i FROM artecna_contabilita.incassi_lordi_clienti WHERE id=p_incasso FOR UPDATE;
 IF i.acconto_id<>a.id OR i.cantiere_id<>a.cantiere_id THEN RAISE EXCEPTION 'Pagamento di altro acconto' USING ERRCODE='42501'; END IF;
 IF (SELECT coalesce(sum(importo),0) FROM artecna_contabilita.quote_lorde_clienti WHERE incasso_id=i.id AND revocato_at IS NULL)>i.importo
 OR (SELECT coalesce(sum(importo),0) FROM artecna_contabilita.quote_lorde_clienti WHERE fattura_id=f.id AND revocato_at IS NULL)>f.totale
 THEN RAISE EXCEPTION 'Quote storiche eccedenti da verificare' USING ERRCODE='23514'; END IF;
 IF l.id IS NULL THEN
  PERFORM public.collega_incasso_cliente(p_richiesta,f.id,a.id,netto,true);
  SELECT * INTO STRICT l FROM artecna_contabilita.attribuzioni_clienti WHERE id=p_richiesta;
 END IF;
 UPDATE artecna_contabilita.attribuzioni_clienti SET riconciliazione=jsonb_build_object('richiesta',p_richiesta,'autore',u,'input',input,'allocazioni',alloc,'impronta',p_impronta,'fonte_base',p_fonte_base) WHERE id=l.id;
 SELECT * INTO q FROM artecna_contabilita.quote_lorde_clienti WHERE incasso_id=i.id AND fattura_id=f.id AND revocato_at IS NULL AND attribuzione_id IS NULL AND importo=lordo;
 IF FOUND THEN
  IF (SELECT count(*) FROM artecna_contabilita.quote_lorde_clienti WHERE incasso_id=i.id AND fattura_id=f.id AND revocato_at IS NULL AND attribuzione_id IS NULL AND importo=lordo)<>1
  THEN RAISE EXCEPTION 'Quote lorde storiche ambigue' USING ERRCODE='23514'; END IF;
 ELSE
  PERFORM public.attribuisci_incasso_lordo_cliente(p_richiesta,i.id,f.id,lordo);
  SELECT * INTO STRICT q FROM artecna_contabilita.quote_lorde_clienti WHERE id=p_richiesta;
 END IF;
 UPDATE artecna_contabilita.quote_lorde_clienti SET attribuzione_id=l.id WHERE id=q.id;
 IF p_conferma_fiscale THEN
  SELECT * INTO h FROM artecna_contabilita.acconti_fiscali WHERE acconto_id=a.id ORDER BY revisione DESC LIMIT 1;
  IF h.stato IS DISTINCT FROM 'incassato' OR h.fonte IS DISTINCT FROM artecna_contabilita.fonte_acconto(a) THEN
   IF (SELECT coalesce(sum(importo),0) FROM artecna_contabilita.attribuzioni_clienti WHERE acconto_id=a.id AND scollegato_at IS NULL)<>a.importo THEN RAISE EXCEPTION 'Incasso parziale: stato fiscale completo da verificare' USING ERRCODE='23514'; END IF;
   IF a.data_incasso IS DISTINCT FROM i.ricevuto_il THEN RAISE EXCEPTION 'Date discordanti: verificare lo stato fiscale' USING ERRCODE='23514'; END IF;
   PERFORM public.registra_acconto_fiscale(a.id,coalesce(h.revisione,0),'incassato','ordinario',i.ricevuto_il,p_fonte_base);
  END IF;
 END IF;
 PERFORM artecna_notifiche.riconcilia_acconto_fiscale(a.id,now());
 RETURN jsonb_build_object('confermato',true,'revocata',false,'richiesta',p_richiesta,'fiscale',public.leggi_acconto_fiscale(a.id));
END $$;

-- Deferred consistency: old entry points cannot revoke only half of a paired relation.
CREATE FUNCTION artecna_contabilita.verifica_coppia_riconciliazione() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE l artecna_contabilita.attribuzioni_clienti; q artecna_contabilita.quote_lorde_clienti; i artecna_contabilita.incassi_lordi_clienti;
BEGIN
 IF TG_TABLE_NAME='attribuzioni_clienti' THEN
  SELECT * INTO l FROM artecna_contabilita.attribuzioni_clienti WHERE id=NEW.id;
  IF l.riconciliazione IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO q FROM artecna_contabilita.quote_lorde_clienti WHERE attribuzione_id=l.id;
 ELSE
  SELECT * INTO q FROM artecna_contabilita.quote_lorde_clienti WHERE id=NEW.id;
  IF q.attribuzione_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO l FROM artecna_contabilita.attribuzioni_clienti WHERE id=q.attribuzione_id;
 END IF;
 SELECT * INTO i FROM artecna_contabilita.incassi_lordi_clienti WHERE id=q.incasso_id;
 IF q.id IS NULL OR l.id IS NULL OR l.riconciliazione IS NULL OR i.acconto_id IS DISTINCT FROM l.acconto_id
 OR q.fattura_id IS DISTINCT FROM l.fattura_id OR i.cantiere_id IS DISTINCT FROM l.cantiere_id
 OR (q.revocato_at IS NULL) IS DISTINCT FROM (l.scollegato_at IS NULL)
 THEN RAISE EXCEPTION 'Riconciliazione indivisibile: usare Revoca riconciliazione' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION artecna_contabilita.verifica_coppia_riconciliazione() FROM PUBLIC,anon,authenticated,service_role;
CREATE CONSTRAINT TRIGGER coppia_riconciliazione_netto AFTER INSERT OR UPDATE ON artecna_contabilita.attribuzioni_clienti
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION artecna_contabilita.verifica_coppia_riconciliazione();
CREATE CONSTRAINT TRIGGER coppia_riconciliazione_lordo AFTER INSERT OR UPDATE ON artecna_contabilita.quote_lorde_clienti
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION artecna_contabilita.verifica_coppia_riconciliazione();
CREATE FUNCTION public.revoca_riconciliazione_unificata(p_richiesta uuid,p_quota uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE q artecna_contabilita.quote_lorde_clienti; l artecna_contabilita.attribuzioni_clienti;
BEGIN
 PERFORM pg_advisory_xact_lock(714028,1);
 IF current_setting('transaction_isolation')<>'read committed' OR p_richiesta IS NULL THEN RAISE EXCEPTION 'Richiesta non valida' USING ERRCODE='22023'; END IF;
 SELECT * INTO STRICT q FROM artecna_contabilita.quote_lorde_clienti WHERE id=p_quota;
 PERFORM artecna_contabilita.autorizza(q.fattura_id);
 SELECT * INTO STRICT l FROM artecna_contabilita.attribuzioni_clienti WHERE id=q.attribuzione_id;
 PERFORM artecna_contabilita.autorizza_acconto_fiscale(l.acconto_id);
 PERFORM FROM public.fatture_emesse WHERE id=q.fattura_id FOR NO KEY UPDATE;
 PERFORM FROM public.acconti_cantiere WHERE id=l.acconto_id FOR NO KEY UPDATE;
 PERFORM FROM artecna_contabilita.incassi_lordi_clienti WHERE id=q.incasso_id FOR UPDATE;
 PERFORM public.revoca_quota_lorda_cliente(p_richiesta,q.id);
 PERFORM public.scollega_incasso_cliente(p_richiesta,l.id);
 PERFORM artecna_notifiche.riconcilia_acconto_fiscale(l.acconto_id,now());
 RETURN jsonb_build_object('confermato',true,'richiesta',p_richiesta,'revocata',true,'fiscale',public.leggi_acconto_fiscale(l.acconto_id));
END $$;
REVOKE ALL ON FUNCTION public.leggi_riconciliazione_unificata(uuid,uuid,jsonb),
 public.riconcilia_acconto_fattura(uuid,uuid,uuid,uuid,jsonb,jsonb,text,text,boolean,jsonb),
 public.revoca_riconciliazione_unificata(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.leggi_riconciliazione_unificata(uuid,uuid,jsonb),
 public.riconcilia_acconto_fattura(uuid,uuid,uuid,uuid,jsonb,jsonb,text,text,boolean,jsonb),
 public.revoca_riconciliazione_unificata(uuid,uuid) TO authenticated;
UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog();
COMMIT;
