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
 ADD COLUMN bluenext_identita text,
 ADD COLUMN bluenext_impronta text,
 ADD COLUMN bluenext_tipo text,
 ADD CONSTRAINT fatture_emesse_bluenext_metadati CHECK (
   (bluenext_identita IS NULL AND bluenext_impronta IS NULL AND bluenext_tipo IS NULL)
   OR (bluenext_identita ~ '^[a-f0-9]{64}$' AND bluenext_impronta ~ '^[a-f0-9]{64}$'
       AND bluenext_tipo IN ('TD01','TD02','TD04')
       AND num_nonnulls(bluenext_identita,bluenext_impronta,bluenext_tipo)=3)
 );
CREATE UNIQUE INDEX fatture_emesse_bluenext_identita ON public.fatture_emesse(bluenext_identita)
 WHERE bluenext_identita IS NOT NULL;

CREATE FUNCTION artecna_contabilita.bluenext_metadati_riservati()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF current_user IN ('anon','authenticated') THEN
  IF TG_OP='INSERT' THEN
   IF NEW.bluenext_identita IS NOT NULL OR NEW.bluenext_impronta IS NOT NULL OR NEW.bluenext_tipo IS NOT NULL THEN
    RAISE EXCEPTION 'Metadati XML riservati alla RPC' USING ERRCODE='42501';
   END IF;
  ELSIF (NEW.bluenext_identita,NEW.bluenext_impronta,NEW.bluenext_tipo)
        IS DISTINCT FROM (OLD.bluenext_identita,OLD.bluenext_impronta,OLD.bluenext_tipo) THEN
   RAISE EXCEPTION 'Metadati XML riservati alla RPC' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION artecna_contabilita.bluenext_metadati_riservati() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER bluenext_metadati_riservati BEFORE INSERT OR UPDATE ON public.fatture_emesse
 FOR EACH ROW EXECUTE FUNCTION artecna_contabilita.bluenext_metadati_riservati();

CREATE FUNCTION public.importa_fatture_bluenext(p_documenti text[],p_cantiere uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE
 contenuto text; doc xml; d record; r public.fatture_emesse%ROWTYPE; esiti jsonb:='[]';
 imponibile numeric; imposta numeric; identita text; impronta text; stato text;
 clienti text[]; cliente text; corrispondenze integer; id_salvato uuid;
 passaggio integer; impronte jsonb:='{}'; conflitti text[]:=ARRAY[]::text[];
BEGIN
 IF artecna_clienti_sicurezza.puo_scrivere_sorgente(p_cantiere) IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Importazione non autorizzata' USING ERRCODE='42501';
 END IF;
 IF current_setting('transaction_isolation')<>'read committed' OR coalesce(cardinality(p_documenti),0) NOT BETWEEN 1 AND 50 THEN
  RAISE EXCEPTION 'Batch non valido: da 1 a 50 documenti' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(714028,1);
 IF artecna_clienti_sicurezza.puo_scrivere_sorgente(p_cantiere) IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Importazione non autorizzata' USING ERRCODE='42501';
 END IF;
 FOR passaggio IN 1..2 LOOP
 FOREACH contenuto IN ARRAY p_documenti LOOP
  stato:='Errore'; id_salvato:=NULL;
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
    giorno date PATH '*[local-name()="FatturaElettronicaBody"]/*[local-name()="DatiGenerali"]/*[local-name()="DatiGeneraliDocumento"]/*[local-name()="Data"]',
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
      OR nullif(btrim(d.numero),'') IS NULL OR d.giorno IS NULL OR NOT isfinite(d.giorno)
      OR d.tipo IS NULL OR d.tipo NOT IN ('TD01','TD02','TD04')
      OR coalesce(nullif(btrim(clienti[1]),''),nullif(btrim(clienti[2]),'')) IS NULL OR cliente IS NULL THEN
    stato:='Ambigua';
   ELSIF imponibile IS NULL OR imposta IS NULL OR d.totale IS NULL
       OR d.totale<>round(d.totale,2) OR imponibile<>round(imponibile,2) OR imposta<>round(imposta,2)
       OR greatest(abs(d.totale),abs(imponibile),abs(imposta))>999999999999.99 THEN
    stato:='Errore';
   ELSE
    identita:=encode(sha256(convert_to(jsonb_build_array(upper(d.paese||d.cedente),extract(year FROM d.giorno),upper(btrim(d.numero)))::text,'UTF8')),'hex');
    impronta:=encode(sha256(convert_to(contenuto,'UTF8')),'hex');
    IF passaggio=1 THEN
     IF impronte ? identita AND impronte->>identita<>impronta THEN
      conflitti:=array_append(conflitti,identita);
     END IF;
     impronte:=impronte||jsonb_build_object(identita,impronta);
     CONTINUE;
    END IF;
    IF identita=ANY(conflitti) THEN
     esiti:=esiti||jsonb_build_array(jsonb_build_object('stato','Ambigua','id',NULL));
     CONTINUE;
    END IF;
    SELECT * INTO r FROM public.fatture_emesse WHERE bluenext_identita=identita;
    IF FOUND THEN
     stato:=CASE WHEN r.bluenext_impronta=impronta AND r.bluenext_tipo=d.tipo AND r.data_fattura=d.giorno
           AND r.totale=d.totale AND r.imponibile=imponibile AND r.iva=imposta
           AND r.cliente=cliente AND upper(btrim(r.numero_fattura))=upper(btrim(d.numero))
           AND (p_cantiere IS NULL OR r.cantiere_id=p_cantiere)
           AND artecna_clienti_sicurezza.puo_scrivere_sorgente(r.cantiere_id)
        THEN 'Già presente' ELSE 'Ambigua' END;
    ELSE
     SELECT count(*) INTO corrispondenze FROM public.fatture_emesse
      WHERE upper(btrim(numero_fattura))=upper(btrim(d.numero)) AND extract(year FROM data_fattura)=extract(year FROM d.giorno);
     IF corrispondenze>0 THEN
      stato:='Ambigua';
     ELSE
      INSERT INTO public.fatture_emesse(numero_fattura,data_fattura,cliente,imponibile,iva,totale,cantiere_id,
          importo_incassato,stato,bluenext_identita,bluenext_impronta,bluenext_tipo)
      VALUES (btrim(d.numero),d.giorno,cliente,imponibile,imposta,d.totale,p_cantiere,
          0,'emessa',identita,impronta,d.tipo) RETURNING id INTO id_salvato;
      stato:='Nuova';
     END IF;
    END IF;
   END IF;
  EXCEPTION WHEN no_data_found OR too_many_rows THEN
   stato:='Ambigua';
  WHEN data_exception THEN
   stato:='Errore';
  END;
  IF passaggio=2 THEN esiti:=esiti||jsonb_build_array(jsonb_build_object('stato',stato,'id',id_salvato)); END IF;
 END LOOP;
 END LOOP;
 RETURN esiti;
END $$;
REVOKE ALL ON FUNCTION public.importa_fatture_bluenext(text[],uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.importa_fatture_bluenext(text[],uuid) TO authenticated;

ALTER TABLE artecna_notifiche.notifica ADD COLUMN archiviazioni_fiscali timestamptz[];

CREATE FUNCTION artecna_notifiche.riemerge_criticita_fiscale()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF OLD.archived_at IS NOT NULL AND NEW.azione='apri_acconto_fiscale'
    AND NEW.priorita='urgente' AND NEW.published_at IS DISTINCT FROM OLD.published_at
    AND (NEW.priorita,NEW.messaggio) IS DISTINCT FROM (OLD.priorita,OLD.messaggio) THEN
  NEW.archiviazioni_fiscali:=array_append(OLD.archiviazioni_fiscali,OLD.archived_at);
  NEW.archived_at:=NULL;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION artecna_notifiche.riemerge_criticita_fiscale() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER riemerge_criticita_fiscale BEFORE UPDATE OF published_at ON artecna_notifiche.notifica
 FOR EACH ROW EXECUTE FUNCTION artecna_notifiche.riemerge_criticita_fiscale();

CREATE OR REPLACE FUNCTION public.proponi_riconciliazione_acconto(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a public.acconti_cantiere%ROWTYPE;
 fiscale jsonb;
BEGIN
 PERFORM artecna_contabilita.autorizza_acconto_fiscale(p_id);
 SELECT * INTO STRICT a FROM public.acconti_cantiere WHERE id=p_id;
 fiscale:=artecna_contabilita.valuta_acconto_fiscale(p_id,now());
 IF NOT coalesce((fiscale->>'incasso_confermato')::boolean,false) THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('data_fiscale',fiscale->'data_fiscale','importo',a.importo,'cantiere_id',a.cantiere_id,'fatture',
  coalesce((
   SELECT jsonb_agg(to_jsonb(c) ORDER BY c.data DESC,c.id)
   FROM (
    SELECT f.id,f.cliente,f.numero_fattura AS numero,f.data_fattura AS data,f.imponibile,f.iva,f.totale,
     greatest(f.totale - coalesce(q.occupata,0),0) AS disponibile,
     coalesce(q.collegata,0) AS collegata,
     CASE WHEN s.fonte=artecna_contabilita.fonte_fattura(f) THEN s.esito ELSE 'da_verificare' END AS esito,
     CASE WHEN s.fonte=artecna_contabilita.fonte_fattura(f) THEN s.tipo ELSE f.bluenext_tipo END AS tipo
    FROM public.fatture_emesse f
    LEFT JOIN artecna_contabilita.sdi_corrente s ON s.fattura_id=f.id
    LEFT JOIN LATERAL (
     SELECT sum(l.importo) AS occupata,sum(l.importo) FILTER (WHERE l.acconto_id=p_id) AS collegata
     FROM artecna_contabilita.attribuzioni_clienti l WHERE l.fattura_id=f.id AND l.scollegato_at IS NULL
    ) q ON true
    WHERE f.cantiere_id=a.cantiere_id AND f.totale>0 AND s.tipo IS DISTINCT FROM 'TD04' AND f.bluenext_tipo IS DISTINCT FROM 'TD04'
      AND (q.collegata>0 OR (f.data_fattura IS NOT NULL AND btrim(coalesce(f.cliente,''))<>''
       AND NOT EXISTS(SELECT FROM artecna_contabilita.attribuzioni_clienti l WHERE l.acconto_id=p_id
        AND l.scollegato_at IS NULL AND l.cliente_confermato<>btrim(f.cliente))))
    ORDER BY (q.collegata>0) DESC NULLS LAST,
      abs(f.data_fattura-(fiscale->>'data_fiscale')::date),f.id LIMIT 50
   ) c
  ),'[]'::jsonb));
END $$;

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
  VALUES ('c:public.fatture_emesse:bluenext_identita:text:false'),
   ('c:public.fatture_emesse:bluenext_impronta:text:false'),
   ('c:public.fatture_emesse:bluenext_tipo:text:false')
  UNION ALL SELECT 'f:public.fatture_emesse:'||conname||':'||pg_get_constraintdef(oid,true)||':'||convalidated
  FROM pg_constraint WHERE conrelid='public.fatture_emesse'::regclass AND conname='fatture_emesse_bluenext_metadati'
  UNION ALL SELECT 't:public.fatture_emesse:'||pg_get_triggerdef(oid,true)||':'||tgenabled::text
  FROM pg_trigger WHERE tgrelid='public.fatture_emesse'::regclass AND tgname='bluenext_metadati_riservati'
  UNION ALL SELECT 'p:'||oid::regprocedure::text||':'||md5(prosrc)||':'||prosecdef||':'||coalesce(proconfig::text,'')||':'||pg_get_userbyid(proowner)||':'||coalesce(proacl::text,'')
  FROM pg_proc WHERE oid='artecna_contabilita.bluenext_metadati_riservati()'::regprocedure
 ) x(voce);
 IF cardinality(attesi)<>6 OR delta IS DISTINCT FROM attesi OR EXISTS(
  SELECT voce FROM pg_temp.bluenext_catalogo_prima EXCEPT ALL SELECT voce FROM pg_temp.bluenext_catalogo_dopo
 ) THEN
  RAISE EXCEPTION 'Delta inatteso del catalogo Hard Delete V3: %',delta;
 END IF;
 UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog();
END
$hd$;
COMMIT;
