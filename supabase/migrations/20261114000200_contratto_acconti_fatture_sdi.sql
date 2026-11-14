BEGIN;
LOCK TABLE artecna_distruzione.hard_delete_catalog_expected IN SHARE MODE;
DO $hd$ BEGIN
 IF (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
 IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()] THEN
  RAISE EXCEPTION 'Catalogo Hard Delete V3 divergente';
 END IF;
END $hd$;

CREATE TABLE artecna_contabilita.acconti_fiscali (
 acconto_id uuid NOT NULL,
 revisione bigint NOT NULL,
 stato text NOT NULL CHECK (stato IN ('previsto','incassato','da_verificare','stornato')),
 regime text NOT NULL CHECK (regime IN ('ordinario','da_verificare')),
 data_fiscale date,
 fonte jsonb NOT NULL,
 autore uuid NOT NULL,
 registrato_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 motivo text NOT NULL,
 PRIMARY KEY(acconto_id,revisione)
);

CREATE TABLE artecna_contabilita.fatture_sdi (
 fattura_id uuid NOT NULL,
 revisione bigint NOT NULL,
 tipo text NOT NULL CHECK (tipo IN ('TD01','TD02','TD04')),
 esito text NOT NULL CHECK (esito IN ('bozza','inviata','consegnata','mancata_consegna','scartata','da_verificare')),
 trasmessa_at timestamptz,
 esito_at timestamptz,
 protocollo text,
 ricevuta text,
 rettifica_id uuid,
 fonte jsonb NOT NULL,
 autore uuid NOT NULL,
 registrato_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 provenienza text NOT NULL DEFAULT 'manuale',
 PRIMARY KEY(fattura_id,revisione),
 CHECK (rettifica_id IS NULL OR (tipo='TD04' AND rettifica_id<>fattura_id))
);

CREATE TABLE artecna_contabilita.storni_acconti (
 nota_id uuid NOT NULL,
 revisione bigint NOT NULL,
 attribuzione_id uuid NOT NULL,
 quota numeric(14,2) NOT NULL CHECK (quota>0),
 PRIMARY KEY(nota_id,revisione,attribuzione_id),
 FOREIGN KEY(nota_id,revisione) REFERENCES artecna_contabilita.fatture_sdi(fattura_id,revisione)
);

ALTER TABLE artecna_contabilita.acconti_fiscali ENABLE ROW LEVEL SECURITY;
ALTER TABLE artecna_contabilita.fatture_sdi ENABLE ROW LEVEL SECURITY;
ALTER TABLE artecna_contabilita.storni_acconti ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artecna_contabilita.acconti_fiscali,artecna_contabilita.fatture_sdi,artecna_contabilita.storni_acconti
 FROM PUBLIC,anon,authenticated,service_role;

-- Logical identities preserve fiscal history through the certified source lifecycle.
-- A missing or changed source cannot contribute certified coverage.
CREATE FUNCTION artecna_contabilita.fonte_acconto(a public.acconti_cantiere)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_array(a.cantiere_id,a.importo,a.data_incasso)
$$;

CREATE FUNCTION artecna_contabilita.fonte_fattura(f public.fatture_emesse)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_array(f.cantiere_id,f.numero_fattura,f.data_fattura,f.cliente,f.totale,f.xml_url,f.pdf_url)
$$;

CREATE FUNCTION artecna_contabilita.autorizza_acconto_fiscale(p_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid:=artecna_guardie.utente_jwt_corrente(); c uuid;
BEGIN
 SELECT cantiere_id INTO c FROM public.acconti_cantiere WHERE id=p_id;
 IF c IS NULL OR artecna_guardie.utente_puo_operare_impresa(u) IS NOT TRUE
 OR artecna_guardie.utente_puo_modificare_cantiere(u,c) IS NOT TRUE THEN
  RAISE EXCEPTION 'Acconto non accessibile' USING ERRCODE='42501';
 END IF;
 RETURN u;
END $$;

CREATE VIEW artecna_contabilita.sdi_corrente AS
 SELECT DISTINCT ON (fattura_id) * FROM artecna_contabilita.fatture_sdi ORDER BY fattura_id,revisione DESC;
REVOKE ALL ON artecna_contabilita.sdi_corrente FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.registra_acconto_fiscale(p_id uuid,p_revisione bigint,p_stato text,p_regime text,p_data date,p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; a public.acconti_cantiere; rev bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(714028,1);
 u:=artecna_contabilita.autorizza_acconto_fiscale(p_id);
 SELECT * INTO STRICT a FROM public.acconti_cantiere WHERE id=p_id;
 SELECT coalesce(max(revisione),0) INTO rev FROM artecna_contabilita.acconti_fiscali WHERE acconto_id=p_id;
 IF p_revisione IS DISTINCT FROM rev THEN RAISE EXCEPTION 'Acconto aggiornato in altra sessione' USING ERRCODE='40001'; END IF;
 IF nullif(btrim(p_motivo),'') IS NULL OR length(p_motivo)>500
 OR (p_stato='incassato' AND (p_data IS NULL OR NOT isfinite(p_data) OR p_data>(now() AT TIME ZONE 'Europe/Rome')::date
 OR a.importo IS NULL OR a.importo<=0 OR a.importo>999999999999.99 OR a.importo<>round(a.importo,2)))
 OR (p_stato<>'incassato' AND p_data IS NOT NULL) THEN
  RAISE EXCEPTION 'Conferma, importo, data o motivo non validi' USING ERRCODE='22023';
 END IF;
 INSERT INTO artecna_contabilita.acconti_fiscali
 VALUES(p_id,rev+1,p_stato,p_regime,p_data,artecna_contabilita.fonte_acconto(a),u,clock_timestamp(),btrim(p_motivo));
END $$;

CREATE FUNCTION public.registra_evidenza_sdi(p_id uuid,p_revisione bigint,p_tipo text,p_esito text,
 p_trasmessa timestamptz,p_esito_at timestamptz,p_protocollo text,p_ricevuta text,p_rettifica uuid,p_quote jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; f public.fatture_emesse; originale public.fatture_emesse; precedente artecna_contabilita.sdi_corrente;
 quota record; totale numeric:=0; esito_valido text:=p_esito;
BEGIN
 PERFORM pg_advisory_xact_lock(714028,1);
 u:=artecna_contabilita.autorizza(p_id);
 SELECT * INTO STRICT f FROM public.fatture_emesse WHERE id=p_id;
 SELECT * INTO precedente FROM artecna_contabilita.sdi_corrente WHERE fattura_id=p_id;
 IF p_revisione IS DISTINCT FROM coalesce(precedente.revisione,0) THEN RAISE EXCEPTION 'Fattura aggiornata in altra sessione' USING ERRCODE='40001'; END IF;
 IF p_tipo IS DISTINCT FROM precedente.tipo AND precedente.tipo IS NOT NULL THEN
  RAISE EXCEPTION 'Tipo fiscale gia registrato' USING ERRCODE='22023';
 END IF;
 IF jsonb_typeof(p_quote) IS DISTINCT FROM 'array' OR length(p_ricevuta)>500 OR length(p_protocollo)>150
 OR (p_trasmessa IS NOT NULL AND (NOT isfinite(p_trasmessa) OR p_trasmessa>now()))
 OR (p_esito_at IS NOT NULL AND (NOT isfinite(p_esito_at) OR p_esito_at>now() OR p_esito_at<p_trasmessa)) THEN
  RAISE EXCEPTION 'Riferimenti SdI non validi' USING ERRCODE='22023';
 END IF;
 IF p_esito IN ('consegnata','mancata_consegna','scartata') AND
 (p_trasmessa IS NULL OR p_esito_at IS NULL OR nullif(btrim(p_ricevuta),'') IS NULL)
 OR p_esito='inviata' AND p_trasmessa IS NULL THEN esito_valido:='da_verificare'; END IF;
 IF p_tipo='TD04' AND EXISTS(SELECT FROM artecna_contabilita.attribuzioni_clienti WHERE fattura_id=p_id AND scollegato_at IS NULL) THEN
  RAISE EXCEPTION 'Scollegare le attribuzioni positive prima di classificare la nota' USING ERRCODE='23514';
 END IF;
 IF precedente.rettifica_id IS NOT NULL AND p_rettifica IS DISTINCT FROM precedente.rettifica_id THEN
  RAISE EXCEPTION 'La nota conserva la fattura rettificata' USING ERRCODE='22023';
 END IF;
 IF p_rettifica IS NOT NULL THEN
  PERFORM artecna_contabilita.autorizza(p_rettifica);
  SELECT * INTO STRICT originale FROM public.fatture_emesse WHERE id=p_rettifica;
  IF p_tipo<>'TD04' OR p_rettifica=p_id OR originale.cantiere_id IS DISTINCT FROM f.cantiere_id
  OR NOT EXISTS(SELECT FROM artecna_contabilita.sdi_corrente WHERE fattura_id=p_rettifica AND tipo IN ('TD01','TD02')) THEN
   RAISE EXCEPTION 'Fattura rettificata non valida' USING ERRCODE='22023';
  END IF;
 END IF;
 FOR quota IN SELECT * FROM jsonb_to_recordset(p_quote) AS q(attribuzione_id uuid,quota numeric) LOOP
  IF p_rettifica IS NULL OR quota.quota IS NULL OR quota.quota<=0 OR quota.quota>999999999999.99 OR quota.quota<>round(quota.quota,2)
  OR NOT EXISTS(SELECT FROM artecna_contabilita.attribuzioni_clienti a
   WHERE a.id=quota.attribuzione_id AND a.fattura_id=p_rettifica AND a.scollegato_at IS NULL
   AND a.importo>=quota.quota+coalesce((
    SELECT sum(s.quota) FROM artecna_contabilita.storni_acconti s
    JOIN artecna_contabilita.sdi_corrente n ON (n.fattura_id,n.revisione)=(s.nota_id,s.revisione)
    WHERE s.attribuzione_id=a.id AND s.nota_id<>p_id AND n.esito<>'scartata'),0)) THEN
   RAISE EXCEPTION 'Quota di storno non disponibile' USING ERRCODE='23514';
  END IF;
  totale:=totale+quota.quota;
 END LOOP;
 IF jsonb_array_length(p_quote)>0 AND (f.totale IS NULL OR abs(f.totale)>999999999999.99 OR totale>abs(f.totale)) THEN
  RAISE EXCEPTION 'Quote superiori al totale della nota' USING ERRCODE='23514';
 END IF;
 INSERT INTO artecna_contabilita.fatture_sdi(fattura_id,revisione,tipo,esito,trasmessa_at,esito_at,protocollo,ricevuta,rettifica_id,fonte,autore)
 VALUES(p_id,p_revisione+1,p_tipo,esito_valido,p_trasmessa,p_esito_at,nullif(btrim(p_protocollo),''),nullif(btrim(p_ricevuta),''),p_rettifica,artecna_contabilita.fonte_fattura(f),u);
 INSERT INTO artecna_contabilita.storni_acconti
 SELECT p_id,p_revisione+1,q.attribuzione_id,q.quota FROM jsonb_to_recordset(p_quote) AS q(attribuzione_id uuid,quota numeric);
END $$;

CREATE FUNCTION public.leggi_acconto_fiscale(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a public.acconti_cantiere; h artecna_contabilita.acconti_fiscali; coperto numeric; pendente numeric;
 incerto boolean; termine date; oggi date:=(now() AT TIME ZONE 'Europe/Rome')::date; stato text;
BEGIN
 PERFORM artecna_contabilita.autorizza_acconto_fiscale(p_id);
 SELECT * INTO STRICT a FROM public.acconti_cantiere WHERE id=p_id;
 SELECT * INTO h FROM artecna_contabilita.acconti_fiscali WHERE acconto_id=p_id ORDER BY revisione DESC LIMIT 1;
 IF h.fonte=artecna_contabilita.fonte_acconto(a) AND h.stato='incassato' AND h.regime='ordinario' THEN
  termine:=h.data_fiscale+12;
 END IF;
 WITH quote AS (
  SELECT l.importo, s.esito,
    s.tipo IN ('TD01','TD02') AND s.fonte=artecna_contabilita.fonte_fattura(f) AS valida,
    coalesce(sum(q.quota) FILTER (WHERE n.esito IN ('consegnata','mancata_consegna')
       AND n.fonte=artecna_contabilita.fonte_fattura(nf)),0) AS storno,
    EXISTS(SELECT FROM artecna_contabilita.sdi_corrente x
      LEFT JOIN public.fatture_emesse nx ON nx.id=x.fattura_id
      WHERE x.rettifica_id=l.fattura_id AND x.esito<>'scartata'
      AND (x.esito NOT IN ('consegnata','mancata_consegna')
        OR x.fonte IS DISTINCT FROM artecna_contabilita.fonte_fattura(nx)
        OR abs(nx.totale) IS DISTINCT FROM
        (SELECT sum(z.quota) FROM artecna_contabilita.storni_acconti z WHERE (z.nota_id,z.revisione)=(x.fattura_id,x.revisione)))) AS incerta
  FROM artecna_contabilita.attribuzioni_clienti l
  LEFT JOIN public.fatture_emesse f ON f.id=l.fattura_id
  LEFT JOIN artecna_contabilita.sdi_corrente s ON s.fattura_id=f.id
  LEFT JOIN artecna_contabilita.storni_acconti q ON q.attribuzione_id=l.id
  LEFT JOIN artecna_contabilita.sdi_corrente n ON (n.fattura_id,n.revisione,n.rettifica_id)=(q.nota_id,q.revisione,l.fattura_id)
  LEFT JOIN public.fatture_emesse nf ON nf.id=n.fattura_id
  WHERE l.acconto_id=p_id AND l.scollegato_at IS NULL AND l.verificato
  GROUP BY l.id,l.importo,l.fattura_id,s.esito,s.tipo,s.fonte,f
 )
 SELECT coalesce(sum(greatest(importo-storno,0)) FILTER (WHERE valida AND esito IN ('consegnata','mancata_consegna')),0),
  coalesce(sum(greatest(importo-storno,0)) FILTER (WHERE valida AND esito='inviata'),0),
  coalesce(bool_or(incerta OR valida IS DISTINCT FROM true OR esito='da_verificare'),false)
 INTO coperto,pendente,incerto FROM quote;
 stato:=CASE
 WHEN h.fonte IS DISTINCT FROM artecna_contabilita.fonte_acconto(a) THEN 'Da verificare'
 WHEN h.stato='previsto' THEN 'Non ancora incassato'
 WHEN h.stato='stornato' THEN 'Stornato'
 WHEN termine IS NULL OR incerto OR EXISTS (
  SELECT FROM artecna_contabilita.sdi_corrente n
  JOIN public.fatture_emesse f ON f.id=n.fattura_id
  WHERE n.tipo='TD04' AND n.rettifica_id IS NULL AND n.esito<>'scartata' AND f.cantiere_id=a.cantiere_id
 ) THEN 'Da verificare'
 WHEN coperto>=a.importo THEN 'Regolarizzato'
 WHEN oggi>termine THEN 'Scaduto'
 WHEN coperto+pendente>=a.importo THEN 'In attesa dell’esito SdI'
 ELSE 'Fattura da emettere' END;
 RETURN jsonb_build_object('stato',stato,'revisione',coalesce(h.revisione,0),'termine',termine,
  'giorni_residui',termine-oggi,'copertura',coperto,'data_fiscale',h.data_fiscale);
END $$;

CREATE FUNCTION public.leggi_fattura_sdi(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE s artecna_contabilita.sdi_corrente; f public.fatture_emesse;
BEGIN
 PERFORM artecna_contabilita.autorizza(p_id);
 SELECT * INTO STRICT f FROM public.fatture_emesse WHERE id=p_id;
 SELECT * INTO s FROM artecna_contabilita.sdi_corrente WHERE fattura_id=p_id;
 RETURN jsonb_build_object('revisione',coalesce(s.revisione,0),'tipo',s.tipo,
  'esito',CASE WHEN s.fonte=artecna_contabilita.fonte_fattura(f) THEN s.esito ELSE 'da_verificare' END,
  'trasmessa_at',s.trasmessa_at,'esito_at',s.esito_at,'protocollo',s.protocollo,'ricevuta',s.ricevuta,
  'rettifica_id',s.rettifica_id,'quote',coalesce((SELECT jsonb_agg(jsonb_build_object('attribuzione_id',q.attribuzione_id,'quota',q.quota) ORDER BY q.attribuzione_id)
    FROM artecna_contabilita.storni_acconti q WHERE (q.nota_id,q.revisione)=(s.fattura_id,s.revisione)),'[]'::jsonb));
END $$;

REVOKE ALL ON FUNCTION artecna_contabilita.fonte_acconto(public.acconti_cantiere),
 artecna_contabilita.fonte_fattura(public.fatture_emesse),artecna_contabilita.autorizza_acconto_fiscale(uuid),
 public.registra_acconto_fiscale(uuid,bigint,text,text,date,text),
 public.registra_evidenza_sdi(uuid,bigint,text,text,timestamptz,timestamptz,text,text,uuid,jsonb),
 public.leggi_acconto_fiscale(uuid),public.leggi_fattura_sdi(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.registra_acconto_fiscale(uuid,bigint,text,text,date,text),
 public.registra_evidenza_sdi(uuid,bigint,text,text,timestamptz,timestamptz,text,text,uuid,jsonb),
 public.leggi_acconto_fiscale(uuid),public.leggi_fattura_sdi(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.collega_incasso_cliente(p_richiesta_id uuid,p_fattura_id uuid,p_acconto_id uuid,p_importo numeric,p_verificato boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid; f public.fatture_emesse%ROWTYPE; a public.acconti_cantiere%ROWTYPE;
 l artecna_contabilita.attribuzioni_clienti%ROWTYPE; sf numeric; sa numeric; tipo text;
BEGIN
 -- Lo stesso lock è acquisito dai guard dei writer legacy: tutte le quote sono
 -- ricontrollate dopo attese reali, mai sulla disponibilità inviata dal client.
 PERFORM pg_advisory_xact_lock(714028,1);
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Usare una transazione READ COMMITTED per le attribuzioni'; END IF;
 u:=artecna_contabilita.autorizza(p_fattura_id);
 IF p_richiesta_id IS NULL OR p_acconto_id IS NULL OR p_verificato IS DISTINCT FROM true
 OR p_importo IS NULL OR p_importo::text IN ('NaN','Infinity','-Infinity')
 OR p_importo<=0 OR p_importo>999999999999.99 OR p_importo<>round(p_importo,2)
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Conferma e importo monetario non validi'; END IF;
 SELECT * INTO l FROM artecna_contabilita.attribuzioni_clienti WHERE id=p_richiesta_id;
 IF FOUND THEN
  IF l.creato_da<>u OR l.fattura_id<>p_fattura_id OR l.acconto_id<>p_acconto_id OR l.importo<>p_importo
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità richiesta già usata per un’altra operazione'; END IF;
  -- Anche una richiesta già scollegata resta tale: un retry non la riapre.
  RETURN to_jsonb(l);
 END IF;
 SELECT * INTO f FROM public.fatture_emesse WHERE id=p_fattura_id;
 SELECT * INTO a FROM public.acconti_cantiere WHERE id=p_acconto_id;
 IF NOT FOUND OR a.cantiere_id IS DISTINCT FROM f.cantiere_id OR a.cantiere_id IS NULL
 OR a.data_incasso IS NULL OR a.importo IS NULL OR a.importo::text IN ('NaN','Infinity','-Infinity')
 OR a.importo<=0 OR a.importo<>round(a.importo,2)
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Acconto non disponibile nel contesto verificato'; END IF;
 SELECT s.tipo INTO tipo FROM artecna_contabilita.sdi_corrente s WHERE s.fattura_id=f.id;
 tipo:=coalesce(tipo,to_jsonb(f)->>'tipo_documento');
 IF f.totale IS NULL OR f.totale::text IN ('NaN','Infinity','-Infinity') OR f.totale<=0 OR f.totale<>round(f.totale,2)
 OR f.data_fattura IS NULL OR coalesce(btrim(f.cliente),'')=''
 OR coalesce(f.stato,'') NOT IN ('emessa','parziale','incassata')
 OR (tipo IS NOT NULL AND tipo NOT IN ('fattura','TD01','TD02'))
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Documento non supportato: verificare totale, tipo e stato'; END IF;
 IF EXISTS(SELECT 1 FROM artecna_contabilita.attribuzioni_clienti WHERE acconto_id=a.id AND scollegato_at IS NULL
   AND (cantiere_id<>f.cantiere_id OR cliente_confermato<>btrim(f.cliente)))
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Acconto già attribuito a un cliente diverso'; END IF;
 SELECT coalesce(sum(importo),0) INTO sf FROM artecna_contabilita.attribuzioni_clienti WHERE fattura_id=f.id AND scollegato_at IS NULL;
 SELECT coalesce(sum(importo),0) INTO sa FROM artecna_contabilita.attribuzioni_clienti WHERE acconto_id=a.id AND scollegato_at IS NULL;
 IF sf+p_importo>f.totale OR sa+p_importo>a.importo
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Quota superiore alla disponibilità del movimento o del documento'; END IF;
 INSERT INTO artecna_contabilita.attribuzioni_clienti(id,fattura_id,acconto_id,cantiere_id,cliente_confermato,importo,verificato,creato_da)
 VALUES(p_richiesta_id,f.id,a.id,f.cantiere_id,btrim(f.cliente),p_importo,true,u) RETURNING * INTO l;
 RETURN to_jsonb(l);
END $$;
DO $hd$ BEGIN
 IF (SELECT array_agg(signature) FROM artecna_distruzione.hard_delete_catalog_expected)
 IS DISTINCT FROM ARRAY[artecna_distruzione.hard_delete_catalog()] THEN
  RAISE EXCEPTION 'Delta inatteso del catalogo Hard Delete V3';
 END IF;
END $hd$;
COMMIT;
