BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
LOCK TABLE artecna_distruzione.hard_delete_catalog_expected IN EXCLUSIVE MODE;
CREATE TEMP TABLE bluenext_catalogo_prima (voce text NOT NULL) ON COMMIT DROP;
DO $pre$
DECLARE corpo text; terminale constant text := 'SELECT md5(coalesce(string_agg(x,'''' ORDER BY x COLLATE "C"),'''')) FROM objects';
BEGIN
 SELECT btrim(prosrc,E' \r\n\t') INTO STRICT corpo FROM pg_proc WHERE oid='artecna_distruzione.hard_delete_catalog()'::regprocedure;
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR md5((SELECT prosrc FROM pg_proc WHERE oid='artecna_distruzione.hard_delete_catalog()'::regprocedure))<>'e653969ab1719f575d07038a3cbdd143'
 OR (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
    IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()]
 OR right(corpo,length(terminale))<>terminale THEN
  RAISE EXCEPTION 'Baseline Hard Delete V3 divergente';
 END IF;
 EXECUTE 'INSERT INTO pg_temp.bluenext_catalogo_prima '||left(corpo,length(corpo)-length(terminale))||'SELECT x FROM objects';
END
$pre$;

ALTER TABLE public.fatture_emesse
 ADD COLUMN bluenext_associazione jsonb,
 ADD CONSTRAINT fatture_emesse_bluenext_associazione CHECK (
  bluenext_associazione IS NULL OR (bluenext_identita IS NOT NULL AND jsonb_typeof(bluenext_associazione)='object')
 );

CREATE FUNCTION artecna_contabilita.bluenext_associazione_riservata()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF current_user IN ('anon','authenticated','service_role') THEN
  IF TG_OP='INSERT' THEN
   IF num_nonnulls(NEW.bluenext_associazione,NEW.bluenext_identita,NEW.bluenext_impronta,NEW.bluenext_tipo)<>0 THEN
    RAISE EXCEPTION 'Metadati Bluenext riservati alle RPC' USING ERRCODE='42501';
   END IF;
  ELSIF (NEW.bluenext_associazione,NEW.bluenext_identita,NEW.bluenext_impronta,NEW.bluenext_tipo)
    IS DISTINCT FROM (OLD.bluenext_associazione,OLD.bluenext_identita,OLD.bluenext_impronta,OLD.bluenext_tipo) THEN
   RAISE EXCEPTION 'Metadati Bluenext riservati alle RPC' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER bluenext_associazione_riservata BEFORE INSERT OR UPDATE ON public.fatture_emesse
 FOR EACH ROW EXECUTE FUNCTION artecna_contabilita.bluenext_associazione_riservata();

CREATE FUNCTION artecna_contabilita.leggi_identita_xml_bluenext(contenuto text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE doc xml; d record; imponibile numeric; imposta numeric; clienti text[]; cliente text; identita text; impronta text;
BEGIN
   IF contenuto IS NULL OR octet_length(contenuto)>2000000 OR contenuto ~* '<!DOCTYPE|<!ENTITY' THEN
    RAISE EXCEPTION 'XML non ammesso' USING ERRCODE='22023';
   END IF;
   doc:=xmlparse(document contenuto);
   IF cardinality(xpath('/*/*[local-name()="FatturaElettronicaBody"]',doc))<>1 THEN
    RAISE EXCEPTION 'Un solo documento per XML' USING ERRCODE='22023';
   END IF;
   SELECT * INTO STRICT d FROM XMLTABLE('/*' PASSING doc COLUMNS
    numero text PATH '*[local-name()="FatturaElettronicaBody"]/*[local-name()="DatiGenerali"]/*[local-name()="DatiGeneraliDocumento"]/*[local-name()="Numero"]',
    giorno text PATH '*[local-name()="FatturaElettronicaBody"]/*[local-name()="DatiGenerali"]/*[local-name()="DatiGeneraliDocumento"]/*[local-name()="Data"]',
    tipo text PATH '*[local-name()="FatturaElettronicaBody"]/*[local-name()="DatiGenerali"]/*[local-name()="DatiGeneraliDocumento"]/*[local-name()="TipoDocumento"]',
    totale numeric PATH '*[local-name()="FatturaElettronicaBody"]/*[local-name()="DatiGenerali"]/*[local-name()="DatiGeneraliDocumento"]/*[local-name()="ImportoTotaleDocumento"]',
    paese text PATH '*[local-name()="FatturaElettronicaHeader"]/*[local-name()="CedentePrestatore"]/*[local-name()="DatiAnagrafici"]/*[local-name()="IdFiscaleIVA"]/*[local-name()="IdPaese"]',
    cedente text PATH '*[local-name()="FatturaElettronicaHeader"]/*[local-name()="CedentePrestatore"]/*[local-name()="DatiAnagrafici"]/*[local-name()="IdFiscaleIVA"]/*[local-name()="IdCodice"]',
    cliente xml PATH '*[local-name()="FatturaElettronicaHeader"]/*[local-name()="CessionarioCommittente"]/*[local-name()="DatiAnagrafici"]'
   );
   SELECT ARRAY[idiva,cf,coalesce(nullif(btrim(denominazione),''),nullif(btrim(concat_ws(' ',nome,cognome)),''))]
    INTO STRICT clienti FROM XMLTABLE('/*' PASSING d.cliente COLUMNS
    idiva text PATH 'concat(*[local-name()="IdFiscaleIVA"]/*[local-name()="IdPaese"],*[local-name()="IdFiscaleIVA"]/*[local-name()="IdCodice"])',
    cf text PATH '*[local-name()="CodiceFiscale"]',
    denominazione text PATH '*[local-name()="Anagrafica"]/*[local-name()="Denominazione"]',
    nome text PATH '*[local-name()="Anagrafica"]/*[local-name()="Nome"]',
    cognome text PATH '*[local-name()="Anagrafica"]/*[local-name()="Cognome"]');
   cliente:=clienti[3];
   SELECT sum(x.netto),sum(x.iva) INTO imponibile,imposta
   FROM XMLTABLE('/*/*[local-name()="FatturaElettronicaBody"]/*[local-name()="DatiBeniServizi"]/*[local-name()="DatiRiepilogo"]' PASSING doc COLUMNS
    netto numeric PATH '*[local-name()="ImponibileImporto"]' NOT NULL,
    iva numeric PATH '*[local-name()="Imposta"]' NOT NULL) x;
   IF coalesce(d.paese,'') !~ '^[A-Z]{2}$' OR coalesce(d.cedente,'') !~ '^[A-Za-z0-9]{2,28}$'
      OR nullif(btrim(d.numero),'') IS NULL OR coalesce(d.giorno,'') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      OR d.tipo IS NULL OR d.tipo NOT IN ('TD01','TD02','TD04')
      OR coalesce(nullif(btrim(clienti[1]),''),nullif(btrim(clienti[2]),'')) IS NULL OR cliente IS NULL THEN
    RETURN NULL;
   ELSIF imponibile IS NULL OR imposta IS NULL OR d.totale IS NULL
       OR d.totale<>round(d.totale,2) OR imponibile<>round(imponibile,2) OR imposta<>round(imposta,2)
       OR greatest(abs(d.totale),abs(imponibile),abs(imposta))>999999999999.99 THEN
    RETURN NULL;
   ELSE
    identita:=encode(sha256(convert_to(jsonb_build_array(upper(d.paese||d.cedente),extract(year FROM d.giorno::date),upper(btrim(d.numero)))::text,'UTF8')),'hex');
    impronta:=encode(sha256(convert_to(contenuto,'UTF8')),'hex');
    RETURN jsonb_build_object('numero',btrim(d.numero),'data',d.giorno,'tipo',d.tipo,'cedente',upper(d.paese||d.cedente),
     'partita_iva',nullif(upper(btrim(clienti[1])),''),'codice_fiscale',nullif(upper(btrim(clienti[2])),''),
     'cliente',cliente,'imponibile',imponibile,'iva',imposta,'totale',d.totale,'identita',identita,'impronta',impronta);
   END IF;
EXCEPTION WHEN data_exception OR no_data_found OR too_many_rows THEN
 RETURN NULL;
END $$;

CREATE FUNCTION public.confronta_fattura_bluenext(p_fattura uuid,p_xml text,p_impronte text[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE
 f public.fatture_emesse; x jsonb; storico jsonb; versione text; esito text;
 tipo_sdi text; appartenenze integer; storico_raw jsonb;
BEGIN
 SELECT * INTO f FROM public.fatture_emesse WHERE id=p_fattura;
 IF NOT FOUND OR artecna_clienti_sicurezza.puo_scrivere_sorgente(f.cantiere_id) IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Fattura non accessibile' USING ERRCODE='42501';
 END IF;
 x:=artecna_contabilita.leggi_identita_xml_bluenext(p_xml);
 IF x IS NULL THEN RETURN jsonb_build_object('esito','Metadati insufficienti'); END IF;
 SELECT s.tipo INTO tipo_sdi FROM artecna_contabilita.sdi_corrente s
 WHERE s.fattura_id=f.id AND s.fonte=artecna_contabilita.fonte_fattura(f);
 storico_raw:=to_jsonb(f);
 storico:=jsonb_build_object('numero',f.numero_fattura,'data',f.data_fattura,'cliente',f.cliente,
  'imponibile',f.imponibile,'iva',f.iva,'totale',f.totale,'tipo',coalesce(tipo_sdi,
    CASE WHEN storico_raw->>'tipo_documento' IN ('TD01','TD02','TD04') THEN storico_raw->>'tipo_documento' END),
  'cedente',NULL,'partita_iva',nullif(upper(btrim(storico_raw->>'partita_iva')),''),
  'codice_fiscale',nullif(upper(btrim(storico_raw->>'codice_fiscale')),''));
 versione:=encode(sha256(convert_to(jsonb_build_array(f.id,f.cantiere_id,storico,x->>'impronta')::text,'UTF8')),'hex');
 SELECT count(*) INTO appartenenze FROM public.fatture_emesse
 WHERE upper(btrim(numero_fattura))=upper(x->>'numero')
   AND extract(year FROM data_fattura)=extract(year FROM (x->>'data')::date);
 esito:=CASE
  WHEN coalesce(cardinality(p_impronte),0)<>1 OR p_impronte[1] IS DISTINCT FROM x->>'impronta' THEN 'XML discordanti'
  WHEN EXISTS(SELECT FROM public.fatture_emesse WHERE bluenext_identita=x->>'identita' AND id<>p_fattura)
    OR (f.bluenext_identita IS NOT NULL AND (f.bluenext_identita,f.bluenext_impronta) IS DISTINCT FROM (x->>'identita',x->>'impronta')) THEN 'XML discordanti'
  WHEN appartenenze>1 THEN 'Candidata storica non univoca'
  WHEN nullif(btrim(f.numero_fattura),'') IS NULL OR f.data_fattura IS NULL
    OR nullif(btrim(f.cliente),'') IS NULL OR num_nonnulls(f.imponibile,f.iva,f.totale)<>3 THEN 'Metadati insufficienti'
  WHEN upper(btrim(f.numero_fattura))<>upper(x->>'numero') OR f.data_fattura<>(x->>'data')::date
    OR upper(regexp_replace(btrim(f.cliente),'[[:space:]]+',' ','g'))<>upper(regexp_replace(x->>'cliente','[[:space:]]+',' ','g'))
    OR (f.imponibile,f.iva,f.totale) IS DISTINCT FROM ((x->>'imponibile')::numeric,(x->>'iva')::numeric,(x->>'totale')::numeric)
    OR (storico->>'tipo' IS NOT NULL AND storico->>'tipo'<>x->>'tipo')
    OR (f.bluenext_tipo IS NOT NULL AND f.bluenext_tipo<>x->>'tipo')
    OR (tipo_sdi IS NOT NULL AND tipo_sdi<>x->>'tipo')
    OR (storico_raw->>'tipo_documento' IN ('TD01','TD02','TD04') AND storico_raw->>'tipo_documento'<>x->>'tipo')
    OR (storico->>'partita_iva' IS NOT NULL AND storico->>'partita_iva' IS DISTINCT FROM x->>'partita_iva')
    OR (storico->>'codice_fiscale' IS NOT NULL AND storico->>'codice_fiscale' IS DISTINCT FROM x->>'codice_fiscale')
    THEN 'Differenze effettive'
  WHEN f.bluenext_impronta IS NOT NULL THEN 'Gia associata'
  WHEN storico->>'tipo' IS NULL THEN 'Conferma assistita'
  ELSE 'Verificabile'
 END;
 RETURN jsonb_build_object('esito',esito,'storico',storico,'xml',x,'versione',versione);
END $$;

CREATE FUNCTION public.associa_fattura_bluenext(p_fattura uuid,p_xml text,p_impronte text[],p_versione text,
 p_conferma_tipo_xml boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE confronto jsonb; x jsonb; esito text;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION 'Usare READ COMMITTED' USING ERRCODE='22023';
 END IF;
 -- Stesso lock dell'import canonico. NOWAIT evita l'inversione con gli UPDATE legacy.
 PERFORM pg_advisory_xact_lock(714028,1);
 LOCK TABLE public.fatture_emesse IN SHARE ROW EXCLUSIVE MODE NOWAIT;
 confronto:=public.confronta_fattura_bluenext(p_fattura,p_xml,p_impronte);
 esito:=confronto->>'esito';
 IF esito='Gia associata' THEN RETURN esito; END IF;
 IF esito NOT IN ('Verificabile','Conferma assistita') THEN RETURN esito; END IF;
 IF p_versione IS DISTINCT FROM confronto->>'versione' THEN RETURN 'Candidata modificata'; END IF;
 IF esito='Conferma assistita' AND p_conferma_tipo_xml IS DISTINCT FROM true THEN
  RETURN 'Conferma esplicita del tipo XML necessaria';
 END IF;
 x:=confronto->'xml';
 UPDATE public.fatture_emesse SET
  bluenext_identita=x->>'identita', bluenext_impronta=x->>'impronta', bluenext_tipo=x->>'tipo',
  bluenext_associazione=jsonb_build_object('origine','bluenext_storico','autore',auth.uid(),
   'associata_at',clock_timestamp(),'versione_confronto',p_versione,
   'tipo_storico',confronto->'storico'->'tipo','tipo_xml',x->>'tipo','fonte_tipo','xml_bluenext',
   'conferma_tipo_legacy',esito='Conferma assistita')
 WHERE id=p_fattura;
 RETURN 'Associata';
END $$;

REVOKE ALL ON FUNCTION artecna_contabilita.bluenext_associazione_riservata(),artecna_contabilita.leggi_identita_xml_bluenext(text)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.confronta_fattura_bluenext(uuid,text,text[]),public.associa_fattura_bluenext(uuid,text,text[],text,boolean)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.confronta_fattura_bluenext(uuid,text,text[]),public.associa_fattura_bluenext(uuid,text,text[],text,boolean)
 TO authenticated;

CREATE TEMP TABLE bluenext_catalogo_dopo (voce text NOT NULL) ON COMMIT DROP;
DO $hd$
DECLARE corpo text; delta text[]; attesi text[];
DECLARE terminale constant text := 'SELECT md5(coalesce(string_agg(x,'''' ORDER BY x COLLATE "C"),'''')) FROM objects';
BEGIN
 SELECT btrim(prosrc,E' \r\n\t') INTO STRICT corpo FROM pg_proc WHERE oid='artecna_distruzione.hard_delete_catalog()'::regprocedure;
 EXECUTE 'INSERT INTO pg_temp.bluenext_catalogo_dopo '||left(corpo,length(corpo)-length(terminale))||'SELECT x FROM objects';
 SELECT array_agg(voce ORDER BY voce COLLATE "C") INTO delta
 FROM (SELECT voce FROM pg_temp.bluenext_catalogo_dopo EXCEPT ALL SELECT voce FROM pg_temp.bluenext_catalogo_prima) x;
 SELECT array_agg(voce ORDER BY voce COLLATE "C") INTO attesi FROM (
  VALUES ('c:public.fatture_emesse:bluenext_associazione:jsonb:false')
  UNION ALL SELECT 'f:public.fatture_emesse:'||conname||':'||pg_get_constraintdef(oid,true)||':'||convalidated
  FROM pg_constraint WHERE conrelid='public.fatture_emesse'::regclass AND conname='fatture_emesse_bluenext_associazione'
  UNION ALL SELECT 't:public.fatture_emesse:'||pg_get_triggerdef(oid,true)||':'||tgenabled::text
  FROM pg_trigger WHERE tgrelid='public.fatture_emesse'::regclass AND tgname='bluenext_associazione_riservata'
  UNION ALL SELECT 'p:'||oid::regprocedure::text||':'||md5(prosrc)||':'||prosecdef||':'||coalesce(proconfig::text,'')||':'||pg_get_userbyid(proowner)||':'||coalesce(proacl::text,'')
  FROM pg_proc WHERE oid='artecna_contabilita.bluenext_associazione_riservata()'::regprocedure
 ) x(voce);
 IF cardinality(attesi)<>4 OR delta IS DISTINCT FROM attesi OR EXISTS(
  SELECT voce FROM pg_temp.bluenext_catalogo_prima EXCEPT ALL SELECT voce FROM pg_temp.bluenext_catalogo_dopo
 ) THEN
  RAISE EXCEPTION 'Delta inatteso del catalogo Hard Delete V3: %',delta;
 END IF;
 UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog();
END
$hd$;
COMMIT;
