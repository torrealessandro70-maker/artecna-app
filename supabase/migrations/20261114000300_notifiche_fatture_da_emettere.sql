BEGIN;

CREATE FUNCTION artecna_contabilita.valuta_acconto_fiscale(p_id uuid, p_ora timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE a public.acconti_cantiere; h artecna_contabilita.acconti_fiscali; coperto numeric; pendente numeric;
 pendente_tempestivo numeric; scartata boolean; incerto boolean; termine date; oggi date:=(p_ora AT TIME ZONE 'Europe/Rome')::date; stato text;
BEGIN
 IF p_id IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO STRICT a FROM public.acconti_cantiere WHERE id=p_id;
 SELECT * INTO h FROM artecna_contabilita.acconti_fiscali WHERE acconto_id=p_id ORDER BY revisione DESC LIMIT 1;
 IF h.fonte=artecna_contabilita.fonte_acconto(a) AND h.stato='incassato' AND h.regime='ordinario' THEN
  termine:=h.data_fiscale+12;
 END IF;
 WITH quote AS (
  SELECT l.importo, s.esito, s.trasmessa_at,
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
  GROUP BY l.id,l.importo,l.fattura_id,s.esito,s.trasmessa_at,s.tipo,s.fonte,f
 )
 SELECT coalesce(sum(greatest(importo-storno,0)) FILTER (WHERE valida AND esito IN ('consegnata','mancata_consegna')),0),
  coalesce(sum(greatest(importo-storno,0)) FILTER (WHERE valida AND esito='inviata'),0),
  coalesce(sum(greatest(importo-storno,0)) FILTER (WHERE valida AND esito='inviata'
    AND (trasmessa_at AT TIME ZONE 'Europe/Rome')::date<=termine),0),
  coalesce(bool_or(valida AND esito='scartata'),false),
  coalesce(bool_or(incerta OR valida IS DISTINCT FROM true OR esito='da_verificare'),false)
 INTO coperto,pendente,pendente_tempestivo,scartata,incerto FROM quote;
 stato:=CASE
 WHEN h.fonte IS DISTINCT FROM artecna_contabilita.fonte_acconto(a) THEN 'Da verificare'
 WHEN h.stato='previsto' THEN 'Non ancora incassato'
 WHEN h.stato='stornato' THEN 'Stornato'
 WHEN termine IS NOT NULL AND scartata AND coperto<a.importo THEN 'Da correggere e ritrasmettere'
 WHEN termine IS NULL OR incerto OR EXISTS (
  SELECT FROM artecna_contabilita.sdi_corrente n
  JOIN public.fatture_emesse f ON f.id=n.fattura_id
  WHERE n.tipo='TD04' AND n.rettifica_id IS NULL AND n.esito<>'scartata' AND f.cantiere_id=a.cantiere_id
 ) THEN 'Da verificare'
 WHEN coperto>=a.importo THEN 'Regolarizzato'
 WHEN coperto+pendente_tempestivo>=a.importo THEN 'In attesa dell’esito SdI'
 WHEN coperto+pendente>=a.importo THEN 'Trasmissione oltre il termine da verificare'
 WHEN oggi>termine THEN 'Scaduto'
 ELSE 'Fattura da emettere' END;
 RETURN jsonb_build_object('stato',stato,'revisione',coalesce(h.revisione,0),'termine',termine,
  'giorni_residui',termine-oggi,'copertura',coperto,'data_fiscale',h.data_fiscale,
  'incasso_confermato',coalesce(h.stato='incassato' AND h.fonte=artecna_contabilita.fonte_acconto(a),false));
END $$;

REVOKE ALL ON FUNCTION artecna_contabilita.valuta_acconto_fiscale(uuid,timestamptz)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.leggi_acconto_fiscale(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM artecna_contabilita.autorizza_acconto_fiscale(p_id);
 RETURN artecna_contabilita.valuta_acconto_fiscale(p_id,now()) - 'incasso_confermato';
END $$;


ALTER TABLE artecna_notifiche.preferenze_notifiche
 ADD COLUMN fatture_da_emettere boolean NOT NULL DEFAULT true,
 ADD COLUMN anticipi_fatture_da_emettere integer[] NOT NULL DEFAULT ARRAY[7,3,1,0]
 CHECK (array_position(anticipi_fatture_da_emettere,NULL) IS NULL AND anticipi_fatture_da_emettere <@ ARRAY[7,3,1,0]);
ALTER TABLE artecna_notifiche.notifica
 DROP CONSTRAINT notifica_azione_check,
 ADD CONSTRAINT notifica_azione_check CHECK (azione IN ('apri_scadenza_fiscale','apri_attivita_agenda','apri_sopralluogo','apri_rapportino_atteso','apri_debito_fornitore','apri_acconto_fiscale')),
 DROP CONSTRAINT notifica_tipo_avviso_check,
 ADD CONSTRAINT notifica_tipo_avviso_check CHECK (tipo_avviso IN ('30','7','3','1','oggi','scaduta','fiscale'));

CREATE FUNCTION artecna_notifiche.riconcilia_acconto_fiscale(p_id uuid,p_ora timestamptz)
RETURNS integer LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
DECLARE
 c uuid; dati jsonb; termine date; data_incasso timestamptz; giorni integer; stato text;
 evento uuid; modificate integer; attivo boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(714028,1);
 SELECT cantiere_id INTO c FROM public.acconti_cantiere WHERE id=p_id;
 IF c IS NOT NULL THEN dati:=artecna_contabilita.valuta_acconto_fiscale(p_id,p_ora); END IF;
 termine:=(dati->>'termine')::date;
 giorni:=(dati->>'giorni_residui')::integer;
 stato:=dati->>'stato';
 data_incasso:=(dati->>'data_fiscale')::date::timestamp AT TIME ZONE 'Europe/Rome';
 attivo:=coalesce((dati->>'incasso_confermato')::boolean,false) AND data_incasso IS NOT NULL AND stato<>'Regolarizzato';
 UPDATE artecna_notifiche.evento_notificabile
 SET resolved_at=p_ora,updated_at=p_ora
 WHERE modulo='fatture_da_emettere' AND record_id=p_id AND resolved_at IS NULL
   AND (NOT attivo OR data_evento IS DISTINCT FROM data_incasso);
 UPDATE artecna_notifiche.notifica n SET resolved_at=p_ora,updated_at=p_ora
 FROM artecna_notifiche.evento_notificabile e
 WHERE n.evento_id=e.id AND e.modulo='fatture_da_emettere' AND e.record_id=p_id AND n.resolved_at IS NULL
 AND (e.resolved_at IS NOT NULL
 OR NOT coalesce(artecna_guardie.utente_puo_operare_impresa(n.recipient_user_id) AND artecna_guardie.utente_puo_modificare_cantiere(n.recipient_user_id,c),false)
 OR EXISTS(SELECT FROM artecna_notifiche.preferenze_notifiche p WHERE p.user_id=n.recipient_user_id AND NOT(p.generali AND p.in_app AND p.fatture_da_emettere)));
 IF NOT attivo THEN RETURN 0; END IF;
 INSERT INTO artecna_notifiche.evento_notificabile AS e(modulo,tipo_record,record_id,tipo_evento,data_evento,revisione_sorgente,ambito)
 VALUES ('fatture_da_emettere','acconto_fiscale',p_id,'obbligo_fattura',data_incasso,(dati->>'revisione')::bigint,'impresa')
 ON CONFLICT (modulo,tipo_record,record_id,tipo_evento) WHERE resolved_at IS NULL
 DO UPDATE SET revisione_sorgente=excluded.revisione_sorgente,updated_at=p_ora
 RETURNING id INTO evento;
 INSERT INTO artecna_notifiche.notifica AS n(evento_id,recipient_user_id,titolo,messaggio,priorita,tipo_avviso,scheduled_at,published_at,azione)
 SELECT evento,u.user_id,CASE WHEN termine IS NULL THEN 'Verificare obbligo fattura' ELSE 'Fattura da emettere' END,
 CASE WHEN termine IS NULL THEN 'Incasso confermato. Se è un anticipo sul prezzo dei lavori, verifica tempestivamente l’obbligo e il termine applicabile.'
 WHEN stato='Fattura da emettere' AND promemoria.anticipo IS NOT NULL
 THEN CASE WHEN promemoria.anticipo=0 THEN 'Termine oggi.' ELSE 'Promemoria: termine entro '||promemoria.anticipo||' giorni.' END
 WHEN stato='Scaduto' THEN 'Scadenza superata da verificare' ELSE stato END,
 CASE WHEN stato IN ('Scaduto','Da correggere e ritrasmettere','Trasmissione oltre il termine da verificare') THEN 'urgente'
 WHEN termine IS NULL OR (stato='Fattura da emettere' AND promemoria.anticipo=0) THEN 'alta' ELSE 'normale' END,
 'fiscale',data_incasso,p_ora,'apri_acconto_fiscale'
 FROM public.utenti_impresa u LEFT JOIN artecna_notifiche.preferenze_notifiche p ON p.user_id=u.user_id
 CROSS JOIN LATERAL (SELECT min(x) AS anticipo FROM unnest(coalesce(p.anticipi_fatture_da_emettere,ARRAY[7,3,1,0])) x WHERE x>=giorni) promemoria
 WHERE artecna_guardie.utente_puo_operare_impresa(u.user_id)
 AND artecna_guardie.utente_puo_modificare_cantiere(u.user_id,c)
 AND coalesce(p.generali AND p.in_app AND p.fatture_da_emettere,true)
 ON CONFLICT(evento_id,recipient_user_id,tipo_avviso,scheduled_at)
 DO UPDATE SET titolo=excluded.titolo,messaggio=excluded.messaggio,priorita=excluded.priorita,resolved_at=NULL,read_at=NULL,
 published_at=p_ora,updated_at=p_ora
 WHERE n.messaggio IS DISTINCT FROM excluded.messaggio OR n.priorita IS DISTINCT FROM excluded.priorita OR n.resolved_at IS NOT NULL;
 GET DIAGNOSTICS modificate=ROW_COUNT;
 RETURN modificate;
END $$;

CREATE FUNCTION artecna_notifiche.genera_fatture_da_emettere(p_ora timestamptz)
RETURNS integer LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
DECLARE acconto uuid; totale integer:=0;
BEGIN
 PERFORM pg_advisory_xact_lock(714028,1);
 FOR acconto IN
 SELECT acconto_id FROM artecna_contabilita.acconti_fiscali
 UNION SELECT record_id FROM artecna_notifiche.evento_notificabile WHERE modulo='fatture_da_emettere' AND resolved_at IS NULL
 LOOP
  totale:=totale+artecna_notifiche.riconcilia_acconto_fiscale(acconto,p_ora);
 END LOOP;
 RETURN totale;
END $$;

CREATE FUNCTION artecna_notifiche.dopo_revisione_acconto_fiscale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 PERFORM artecna_notifiche.riconcilia_acconto_fiscale(NEW.acconto_id,now());
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION artecna_notifiche.riconcilia_acconto_fiscale(uuid,timestamptz),
 artecna_notifiche.genera_fatture_da_emettere(timestamptz),
 artecna_notifiche.dopo_revisione_acconto_fiscale() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notifica_revisione_acconto_fiscale AFTER INSERT ON artecna_contabilita.acconti_fiscali
 FOR EACH ROW EXECUTE FUNCTION artecna_notifiche.dopo_revisione_acconto_fiscale();
CREATE OR REPLACE FUNCTION artecna_notifiche.esegui_generatore_runtime()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  ora_batch timestamptz := pg_catalog.now();
  inserite integer;
BEGIN
  inserite := artecna_notifiche.genera_scadenze(ora_batch);
  inserite := inserite + artecna_notifiche.genera_agenda(ora_batch);
  inserite := inserite + artecna_notifiche.genera_sopralluoghi(ora_batch);
  inserite := inserite + artecna_notifiche.genera_rapportini_attesi(ora_batch);
  inserite := inserite + artecna_notifiche.genera_pagamenti_fornitori(ora_batch);
  RETURN inserite + artecna_notifiche.genera_fatture_da_emettere(ora_batch);
END;
$$;

CREATE OR REPLACE FUNCTION artecna_notifiche.visibili(p_user uuid)
RETURNS TABLE (id uuid, titolo text, messaggio text, priorita text, modulo text, published_at timestamptz,
  read_at timestamptz, resolved_at timestamptz, record_id uuid, azione text, attiva boolean)
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT n.id, n.titolo, n.messaggio, n.priorita, e.modulo, n.published_at,
    n.read_at, n.resolved_at, e.record_id, n.azione,
    n.resolved_at IS NULL AND e.resolved_at IS NULL AND
    CASE e.modulo
      WHEN 'fatture_da_emettere' THEN ac.id IS NOT NULL AND coalesce(p.generali AND p.in_app AND p.fatture_da_emettere,true)
        AND (artecna_contabilita.valuta_acconto_fiscale(ac.id,now())->>'data_fiscale')::date=(e.data_evento AT TIME ZONE 'Europe/Rome')::date
        AND (artecna_contabilita.valuta_acconto_fiscale(ac.id,now())->>'incasso_confermato')::boolean
        AND artecna_contabilita.valuta_acconto_fiscale(ac.id,now())->>'stato'<>'Regolarizzato'
      WHEN 'pagamenti_fornitori' THEN artecna_notifiche.debito_fornitore_eleggibile(d)
        AND e.data_evento = (d.data_scadenza::timestamp AT TIME ZONE 'Europe/Rome')
        AND coalesce(p.generali AND p.in_app AND p.pagamenti_fornitori,true)
        AND n.tipo_avviso = artecna_notifiche.avviso_debito_fornitore(
          d.data_scadenza, (now() AT TIME ZONE 'Europe/Rome')::date, coalesce(p.anticipi_pagamenti_fornitori,ARRAY[3,0]))
      WHEN 'rapportini' THEN r.termine_at = e.data_evento
        AND now() >= r.termine_at
        AND (r.rilevante_fino_at IS NULL OR now() < r.rilevante_fino_at)
        AND artecna_rapportini.avvisi_attesi_attivi(r.cantiere_id,now())
        AND artecna_rapportini.esito_atteso(r.cantiere_id,r.giorno_lavoro) <> 'soddisfatto'
        AND coalesce(p.generali AND p.in_app AND p.rapportini,true)
      WHEN 'agenda' THEN a.stato = 'da_fare'
        AND e.agenda_origine = artecna_notifiche.agenda_origine(a.data, a.ora_inizio, a.ora_fine, a.user_id)
        AND coalesce(p.generali AND p.in_app AND p.agenda, true)
        AND (n.tipo_avviso = 'scaduta' OR CASE n.tipo_avviso WHEN 'oggi' THEN 0 ELSE 1 END = ANY(coalesce(p.anticipi_agenda, ARRAY[1,0])))
      WHEN 'sopralluoghi' THEN q.stato = 'da_preventivare'
        AND e.sopralluogo_origine = artecna_notifiche.sopralluogo_orario(q.data_sopralluogo, q.ora_appuntamento)
        AND now() < e.data_evento
        AND coalesce(p.generali AND p.in_app AND p.sopralluoghi, true)
        AND (CASE n.tipo_avviso WHEN 'oggi' THEN 0 ELSE 1 END) = ANY(coalesce(p.anticipi_sopralluoghi, ARRAY[1,0]))
      ELSE s.stato <> 'pagato' AND s.archiviata_at IS NULL AND coalesce(p.generali AND p.in_app AND p.scadenziario, true)
    END
    AND (e.modulo IN ('pagamenti_fornitori','fatture_da_emettere') OR NOT EXISTS (
      SELECT 1 FROM artecna_notifiche.notifica successiva
      WHERE successiva.evento_id = n.evento_id AND successiva.recipient_user_id = n.recipient_user_id
        AND (successiva.scheduled_at > n.scheduled_at OR
          (successiva.scheduled_at = n.scheduled_at AND successiva.tipo_avviso = 'scaduta' AND n.tipo_avviso <> 'scaduta'))
    ))
  FROM artecna_notifiche.notifica n
  JOIN artecna_notifiche.evento_notificabile e ON e.id = n.evento_id
  LEFT JOIN artecna_contabilita.scadenze_fiscali s ON e.modulo = 'scadenziario' AND s.id = e.record_id
  LEFT JOIN public.agenda_attivita a ON e.modulo = 'agenda' AND a.id = e.record_id AND a.user_id = p_user
  LEFT JOIN public.sopralluoghi q ON e.modulo = 'sopralluoghi' AND q.id = e.record_id
    AND artecna_notifiche.puo_ricevere_sopralluoghi(p_user)
  LEFT JOIN artecna_rapportini.attesi r ON e.modulo='rapportini'
    AND e.tipo_record='rapportino_atteso' AND r.id=e.record_id
    AND artecna_guardie.utente_puo_modificare_cantiere(p_user,r.cantiere_id)
  LEFT JOIN public.pagamenti_fornitori d ON e.modulo='pagamenti_fornitori'
    AND e.tipo_record='debito_fornitore' AND d.id=e.record_id
    AND artecna_guardie.utente_puo_operare_impresa(p_user)
  LEFT JOIN public.acconti_cantiere ac ON e.modulo='fatture_da_emettere' AND ac.id=e.record_id
    AND artecna_guardie.utente_puo_operare_impresa(p_user)
    AND artecna_guardie.utente_puo_modificare_cantiere(p_user,ac.cantiere_id)
  LEFT JOIN artecna_notifiche.preferenze_notifiche p ON p.user_id = p_user
  WHERE n.recipient_user_id = p_user AND n.archived_at IS NULL
    AND (ac.id IS NOT NULL OR d.id IS NOT NULL OR r.id IS NOT NULL OR a.id IS NOT NULL OR q.id IS NOT NULL OR (s.id IS NOT NULL AND artecna_guardie.utente_puo_operare_impresa(p_user)));
$$;

CREATE OR REPLACE FUNCTION public.risolvi_destinazione_notifica(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT jsonb_build_object('azione', v.azione, 'record_id', v.record_id) ||
    CASE WHEN r.id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
      'cantiere_id',r.cantiere_id,'giorno_lavoro',r.giorno_lavoro,
      'bozza_id',(SELECT CASE WHEN count(*)=1 AND bool_and(x.stato_operativo='bozza')
                         THEN min(x.id::text)::uuid END
                  FROM public.rapportini x WHERE x.cantiere_id=r.cantiere_id AND x.data=r.giorno_lavoro)
    ) END
  FROM artecna_notifiche.visibili(artecna_notifiche.utente_notifiche()) v
  LEFT JOIN artecna_contabilita.scadenze_fiscali s ON v.modulo = 'scadenziario' AND s.id = v.record_id
  LEFT JOIN artecna_rapportini.attesi r ON v.modulo='rapportini' AND r.id=v.record_id
  WHERE v.id = p_id AND (v.modulo IN ('agenda', 'sopralluoghi','rapportini') OR (v.modulo IN ('pagamenti_fornitori','fatture_da_emettere') AND v.attiva) OR (s.id IS NOT NULL AND s.archiviata_at IS NULL));
$$;


CREATE OR REPLACE FUNCTION public.lista_notifiche(p_filtro text DEFAULT 'tutte', p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(v) - 'record_id' - 'azione' ORDER BY v.published_at DESC, v.id), '[]')
  FROM (
    SELECT vis.*, (SELECT e.data_evento FROM artecna_notifiche.notifica n
      JOIN artecna_notifiche.evento_notificabile e ON e.id = n.evento_id WHERE n.id = vis.id AND vis.modulo IN ('agenda', 'sopralluoghi','rapportini','pagamenti_fornitori','fatture_da_emettere')) AS data_evento
    FROM artecna_notifiche.visibili(artecna_notifiche.utente_notifiche()) vis
    WHERE p_filtro = 'tutte'
      OR (p_filtro = 'fatture_da_emettere' AND modulo='fatture_da_emettere' AND attiva)
      OR (p_filtro = 'da_leggere' AND attiva AND read_at IS NULL)
      OR (p_filtro = 'urgenti' AND attiva AND priorita IN ('alta', 'urgente'))
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
  WHERE attiva AND read_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.leggi_preferenze_notifiche()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT coalesce(
    (SELECT to_jsonb(p) - 'user_id' - 'updated_at' FROM artecna_notifiche.preferenze_notifiche p
      WHERE p.user_id = artecna_notifiche.utente_notifiche()),
    '{"generali":true,"in_app":true,"scadenziario":true,"anticipi":[30,7,3,0],"agenda":true,"anticipi_agenda":[1,0],"sopralluoghi":true,"anticipi_sopralluoghi":[1,0],"rapportini":true,"pagamenti_fornitori":true,"anticipi_pagamenti_fornitori":[3,0],"fatture_da_emettere":true,"anticipi_fatture_da_emettere":[7,3,1,0],"revisione":0}'::jsonb
  )
  FROM (SELECT artecna_notifiche.utente_notifiche() AS id) u
  WHERE u.id IS NOT NULL;
$$;


CREATE FUNCTION public.salva_preferenze_notifiche(p_revisione integer, p_generali boolean,
  p_in_app boolean, p_scadenziario boolean, p_anticipi integer[], p_agenda boolean, p_anticipi_agenda integer[],
  p_sopralluoghi boolean, p_anticipi_sopralluoghi integer[], p_rapportini boolean,
  p_pagamenti_fornitori boolean, p_anticipi_pagamenti_fornitori integer[],
  p_fatture_da_emettere boolean, p_anticipi_fatture_da_emettere integer[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  u uuid := artecna_notifiche.utente_notifiche();
  risultato artecna_notifiche.preferenze_notifiche;
BEGIN
  PERFORM public.salva_preferenze_notifiche(p_revisione, p_generali, p_in_app, p_scadenziario, p_anticipi, p_agenda, p_anticipi_agenda, p_sopralluoghi, p_anticipi_sopralluoghi, p_rapportini, p_pagamenti_fornitori, p_anticipi_pagamenti_fornitori);
  UPDATE artecna_notifiche.preferenze_notifiche
  SET fatture_da_emettere = p_fatture_da_emettere,
      anticipi_fatture_da_emettere = p_anticipi_fatture_da_emettere
  WHERE user_id = u RETURNING * INTO STRICT risultato;
  RETURN to_jsonb(risultato) - 'user_id' - 'updated_at';
END;
$$;

REVOKE ALL ON FUNCTION public.salva_preferenze_notifiche(integer,boolean,boolean,boolean,integer[],boolean,integer[],boolean,integer[],boolean,boolean,integer[],boolean,integer[])
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.salva_preferenze_notifiche(integer,boolean,boolean,boolean,integer[],boolean,integer[],boolean,integer[],boolean,boolean,integer[],boolean,integer[])
  TO authenticated;


CREATE FUNCTION public.leggi_destinazione_acconto_fiscale(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE u uuid;
BEGIN
 u:=artecna_contabilita.autorizza_acconto_fiscale(p_id);
 RETURN (artecna_contabilita.valuta_acconto_fiscale(p_id,now()) - 'incasso_confermato') || (
 SELECT jsonb_build_object('cantiere_id', a.cantiere_id, 'fatture',
  coalesce((SELECT jsonb_agg(jsonb_build_object('id',f.id,'numero',f.numero_fattura,'tipo',s.tipo,'esito',s.esito) ORDER BY f.id)
  FROM public.fatture_emesse f
  LEFT JOIN artecna_contabilita.sdi_corrente s ON s.fattura_id=f.id
  WHERE artecna_guardie.utente_puo_modificare_cantiere(u,f.cantiere_id)
  AND EXISTS(SELECT FROM artecna_contabilita.attribuzioni_clienti l
   WHERE l.fattura_id=f.id AND l.acconto_id=a.id AND l.scollegato_at IS NULL)), '[]'::jsonb))
 FROM public.acconti_cantiere a WHERE a.id=p_id);
END $$;
REVOKE ALL ON FUNCTION public.leggi_destinazione_acconto_fiscale(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.leggi_destinazione_acconto_fiscale(uuid) TO authenticated;

COMMIT;
