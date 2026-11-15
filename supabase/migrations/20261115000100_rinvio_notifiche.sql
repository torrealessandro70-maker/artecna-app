BEGIN;

ALTER TABLE artecna_notifiche.notifica
 ADD COLUMN rinviata_fino_a timestamptz,
 ADD COLUMN rinvio_pubblicazione timestamptz;

CREATE FUNCTION artecna_notifiche.rinvio_attivo(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT coalesce((
  SELECT n.rinviata_fino_a > now() AND n.priorita NOT IN ('alta','urgente')
    AND n.rinvio_pubblicazione = n.published_at
    AND CASE WHEN e.modulo='fatture_da_emettere' THEN n.rinviata_fino_a <=
      ((artecna_contabilita.valuta_acconto_fiscale(e.record_id,now())->>'termine')::date::timestamp AT TIME ZONE 'Europe/Rome')
    ELSE n.rinviata_fino_a <= e.data_evento END
  FROM artecna_notifiche.notifica n JOIN artecna_notifiche.evento_notificabile e ON e.id=n.evento_id
  WHERE n.id=p_id AND n.rinviata_fino_a IS NOT NULL
 ),false);
$$;
REVOKE ALL ON FUNCTION artecna_notifiche.rinvio_attivo(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.lista_notifiche(p_filtro text DEFAULT 'tutte', p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(v) - 'record_id' - 'azione' ORDER BY v.published_at DESC, v.id), '[]')
  FROM (
    SELECT vis.*, (SELECT e.data_evento FROM artecna_notifiche.notifica n
      JOIN artecna_notifiche.evento_notificabile e ON e.id = n.evento_id WHERE n.id = vis.id AND vis.modulo IN ('agenda', 'sopralluoghi','rapportini','pagamenti_fornitori','fatture_da_emettere')) AS data_evento
    FROM artecna_notifiche.visibili(artecna_notifiche.utente_notifiche()) vis
    WHERE NOT artecna_notifiche.rinvio_attivo(vis.id) AND (p_filtro = 'tutte'
      OR (p_filtro = 'fatture_da_emettere' AND modulo='fatture_da_emettere' AND attiva)
      OR (p_filtro = 'da_leggere' AND attiva AND read_at IS NULL)
      OR (p_filtro = 'urgenti' AND attiva AND priorita IN ('alta', 'urgente')))
    ORDER BY published_at DESC, id LIMIT 50 OFFSET greatest(p_offset, 0)
  ) v;
$$;

CREATE OR REPLACE FUNCTION public.contatori_notifiche()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT jsonb_build_object('totale', count(DISTINCT (modulo, record_id)),
    'scadenziario', count(DISTINCT record_id) FILTER (WHERE modulo = 'scadenziario'), 'agenda', count(DISTINCT record_id) FILTER (WHERE modulo = 'agenda'),
    'sopralluoghi', count(DISTINCT record_id) FILTER (WHERE modulo = 'sopralluoghi'),
    'rapportini', count(DISTINCT record_id) FILTER (WHERE modulo = 'rapportini'),
    'fatture_da_emettere', count(DISTINCT record_id) FILTER (WHERE modulo = 'fatture_da_emettere'),
    'pagamenti_fornitori', count(DISTINCT record_id) FILTER (WHERE modulo = 'pagamenti_fornitori'))
  FROM artecna_notifiche.visibili(artecna_notifiche.utente_notifiche())
  WHERE attiva AND read_at IS NULL AND NOT artecna_notifiche.rinvio_attivo(id);
$$;

CREATE FUNCTION public.rinvia_notifica(p_id uuid,p_giorno date)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE
 u uuid:=artecna_notifiche.utente_notifiche();
 n artecna_notifiche.notifica%ROWTYPE;
 e artecna_notifiche.evento_notificabile%ROWTYPE;
 oggi date:=(now() AT TIME ZONE 'Europe/Rome')::date;
 fino timestamptz;
 termine timestamptz;
BEGIN
 IF p_giorno IS NULL OR p_giorno<=oggi OR p_giorno>oggi+90 THEN
   RAISE EXCEPTION 'Scegliere un giorno futuro entro 90 giorni' USING ERRCODE='22023';
 END IF;
 fino:=p_giorno::timestamp AT TIME ZONE 'Europe/Rome';
 PERFORM pg_advisory_xact_lock(714028,1);
 SELECT * INTO n FROM artecna_notifiche.notifica WHERE id=p_id AND recipient_user_id=u FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF n.archived_at IS NOT NULL OR n.resolved_at IS NOT NULL THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT FROM artecna_notifiche.visibili(u) v WHERE v.id=n.id AND v.attiva) THEN RETURN false; END IF;
 IF n.priorita IN ('alta','urgente') THEN RAISE EXCEPTION 'Avviso urgente non rinviabile' USING ERRCODE='22023'; END IF;
 SELECT * INTO STRICT e FROM artecna_notifiche.evento_notificabile WHERE id=n.evento_id;
 termine:=e.data_evento;
 IF e.modulo='fatture_da_emettere' THEN
   termine:=(artecna_contabilita.valuta_acconto_fiscale(e.record_id,now())->>'termine')::date::timestamp AT TIME ZONE 'Europe/Rome';
 END IF;
 IF termine IS NULL OR termine<=now() OR fino>termine THEN
   RAISE EXCEPTION 'Rinvio oltre il termine o termine non verificabile' USING ERRCODE='22023';
 END IF;
 IF n.rinviata_fino_a=fino AND n.rinvio_pubblicazione=n.published_at THEN RETURN true; END IF;
 UPDATE artecna_notifiche.notifica
 SET rinviata_fino_a=fino,rinvio_pubblicazione=n.published_at,read_at=NULL,updated_at=now()
 WHERE id=n.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.rinvia_notifica(uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rinvia_notifica(uuid,date) TO authenticated;

CREATE FUNCTION public.proponi_riconciliazione_acconto(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE a public.acconti_cantiere%ROWTYPE;
 fiscale jsonb;
BEGIN
 PERFORM artecna_contabilita.autorizza_acconto_fiscale(p_id);
 SELECT * INTO STRICT a FROM public.acconti_cantiere WHERE id=p_id;
 fiscale:=artecna_contabilita.valuta_acconto_fiscale(p_id,now());
 IF NOT coalesce((fiscale->>'incasso_confermato')::boolean,false) THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('data_fiscale',fiscale->'data_fiscale','importo',a.importo,'fatture',
  coalesce((
   SELECT jsonb_agg(to_jsonb(c) ORDER BY c.data DESC,c.id)
   FROM (
    SELECT f.id,f.numero_fattura AS numero,f.data_fattura AS data,f.imponibile,f.iva,f.totale,
     greatest(f.totale - coalesce(q.occupata,0),0) AS disponibile,
     coalesce(q.collegata,0) AS collegata,
     CASE WHEN s.fonte=artecna_contabilita.fonte_fattura(f) THEN s.esito ELSE 'da_verificare' END AS esito,
     CASE WHEN s.fonte=artecna_contabilita.fonte_fattura(f) THEN s.tipo END AS tipo
    FROM public.fatture_emesse f
    LEFT JOIN artecna_contabilita.sdi_corrente s ON s.fattura_id=f.id
    LEFT JOIN LATERAL (
     SELECT sum(l.importo) AS occupata,sum(l.importo) FILTER (WHERE l.acconto_id=p_id) AS collegata
     FROM artecna_contabilita.attribuzioni_clienti l WHERE l.fattura_id=f.id AND l.scollegato_at IS NULL
    ) q ON true
    WHERE f.cantiere_id=a.cantiere_id AND f.totale>0 AND s.tipo IS DISTINCT FROM 'TD04'
      AND (q.collegata>0 OR (f.data_fattura=(fiscale->>'data_fiscale')::date AND
        (round(f.imponibile,2)=round(a.importo,2) OR round(f.totale,2)=round(a.importo,2))))
    ORDER BY f.data_fattura DESC,f.id LIMIT 50
   ) c
  ),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.proponi_riconciliazione_acconto(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.proponi_riconciliazione_acconto(uuid) TO authenticated;

COMMIT;
