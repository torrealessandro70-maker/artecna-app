BEGIN;

ALTER TABLE artecna_notifiche.preferenze_notifiche
  ADD COLUMN pagamenti_fornitori boolean NOT NULL DEFAULT true,
  ADD COLUMN anticipi_pagamenti_fornitori integer[] NOT NULL DEFAULT ARRAY[3,0]
    CHECK (array_position(anticipi_pagamenti_fornitori,NULL) IS NULL AND anticipi_pagamenti_fornitori <@ ARRAY[7,3,0]);

ALTER TABLE artecna_notifiche.notifica DROP CONSTRAINT notifica_azione_check,
  ADD CONSTRAINT notifica_azione_check CHECK (azione IN (
    'apri_scadenza_fiscale','apri_attivita_agenda','apri_sopralluogo','apri_rapportino_atteso','apri_debito_fornitore'));

CREATE FUNCTION artecna_notifiche.debito_fornitore_eleggibile(d public.pagamenti_fornitori)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
  SELECT coalesce(
    (d.origine_debito='manuale' AND d.fattura_id IS NULL OR d.origine_debito='fattura' AND d.fattura_id IS NOT NULL)
    AND d.verificato_at IS NOT NULL AND d.verificato_da IS NOT NULL AND d.annullato_at IS NULL
    AND isfinite(d.data_scadenza)
    AND d.importo_totale > 0 AND d.importo_totale < 'Infinity'::numeric
    AND d.importo_pagato >= 0 AND d.importo_pagato < d.importo_totale
    AND trunc(d.importo_totale,2)=d.importo_totale AND trunc(d.importo_pagato,2)=d.importo_pagato,false);
$$;

CREATE FUNCTION artecna_notifiche.avviso_debito_fornitore(scadenza date, oggi date, anticipi integer[])
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
  SELECT tipo FROM (VALUES (-1,'scaduta'),(0,'oggi'),(3,'3'),(7,'7')) a(giorni,tipo)
  WHERE (giorni=-1 OR giorni=ANY(anticipi)) AND scadenza-giorni<=oggi
  ORDER BY giorni LIMIT 1;
$$;

CREATE FUNCTION artecna_notifiche.genera_pagamenti_fornitori(p_ora timestamptz)
RETURNS integer LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
DECLARE
  oggi date := (p_ora AT TIME ZONE 'Europe/Rome')::date;
  inserite integer;
BEGIN
  PERFORM pg_advisory_xact_lock(0, 20261114);
  PERFORM d.id FROM public.pagamenti_fornitori d
    WHERE artecna_notifiche.debito_fornitore_eleggibile(d)
      OR EXISTS (SELECT FROM artecna_notifiche.evento_notificabile e
        WHERE e.modulo='pagamenti_fornitori' AND e.record_id=d.id AND e.resolved_at IS NULL)
    ORDER BY d.id FOR SHARE OF d;

  UPDATE artecna_notifiche.evento_notificabile e SET resolved_at=p_ora,updated_at=p_ora
  WHERE e.modulo='pagamenti_fornitori' AND e.tipo_record='debito_fornitore' AND e.resolved_at IS NULL
    AND NOT EXISTS (SELECT FROM public.pagamenti_fornitori d
      WHERE d.id=e.record_id AND artecna_notifiche.debito_fornitore_eleggibile(d)
        AND e.data_evento=(d.data_scadenza::timestamp AT TIME ZONE 'Europe/Rome'));

  UPDATE artecna_notifiche.notifica n SET resolved_at=p_ora,updated_at=p_ora
  FROM artecna_notifiche.evento_notificabile e
  WHERE n.evento_id=e.id AND e.modulo='pagamenti_fornitori' AND e.tipo_record='debito_fornitore'
    AND n.resolved_at IS NULL AND (e.resolved_at IS NOT NULL
      OR NOT coalesce(artecna_guardie.utente_puo_operare_impresa(n.recipient_user_id),false)
      OR EXISTS (SELECT FROM artecna_notifiche.preferenze_notifiche p
        WHERE p.user_id=n.recipient_user_id AND NOT (p.generali AND p.in_app AND p.pagamenti_fornitori)));

  INSERT INTO artecna_notifiche.evento_notificabile AS e
    (modulo,tipo_record,record_id,tipo_evento,data_evento,revisione_sorgente,ambito)
  SELECT 'pagamenti_fornitori','debito_fornitore',d.id,'scadenza_debito',
    d.data_scadenza::timestamp AT TIME ZONE 'Europe/Rome',d.revisione_debito,'impresa'
  FROM public.pagamenti_fornitori d
  WHERE artecna_notifiche.debito_fornitore_eleggibile(d) AND d.data_scadenza<=oggi+7
  ON CONFLICT (modulo,tipo_record,record_id,tipo_evento) WHERE resolved_at IS NULL
  DO UPDATE SET revisione_sorgente=excluded.revisione_sorgente,updated_at=p_ora
  WHERE e.revisione_sorgente IS DISTINCT FROM excluded.revisione_sorgente;

  INSERT INTO artecna_notifiche.notifica AS n
    (evento_id,recipient_user_id,titolo,messaggio,priorita,tipo_avviso,scheduled_at,published_at,azione)
  SELECT e.id,u.user_id,'Pagamento fornitore',
    CASE a.tipo WHEN 'scaduta' THEN 'Scadenza superata.' WHEN 'oggi' THEN 'Scadenza oggi.'
      ELSE 'Scadenza in avvicinamento.' END,
    CASE a.tipo WHEN 'scaduta' THEN 'alta' ELSE 'normale' END,a.tipo,
    (giorno.scadenza + CASE a.tipo WHEN 'scaduta' THEN 1 WHEN 'oggi' THEN 0 WHEN '3' THEN -3 ELSE -7 END)::timestamp
      AT TIME ZONE 'Europe/Rome',p_ora,'apri_debito_fornitore'
  FROM artecna_notifiche.evento_notificabile e
  CROSS JOIN public.utenti_impresa u
  LEFT JOIN artecna_notifiche.preferenze_notifiche p ON p.user_id=u.user_id
  CROSS JOIN LATERAL (SELECT (e.data_evento AT TIME ZONE 'Europe/Rome')::date AS scadenza) giorno
  CROSS JOIN LATERAL (SELECT artecna_notifiche.avviso_debito_fornitore(giorno.scadenza,oggi,
    coalesce(p.anticipi_pagamenti_fornitori,ARRAY[3,0])) AS tipo) a
  WHERE e.modulo='pagamenti_fornitori' AND e.tipo_record='debito_fornitore' AND e.resolved_at IS NULL
    AND artecna_guardie.utente_puo_operare_impresa(u.user_id)
    AND coalesce(p.generali AND p.in_app AND p.pagamenti_fornitori,true) AND a.tipo IS NOT NULL
  ON CONFLICT (evento_id,recipient_user_id,tipo_avviso,scheduled_at)
  DO UPDATE SET resolved_at=NULL,updated_at=p_ora WHERE n.resolved_at IS NOT NULL;
  GET DIAGNOSTICS inserite=ROW_COUNT;
  RETURN inserite;
END;
$$;

REVOKE ALL ON FUNCTION artecna_notifiche.debito_fornitore_eleggibile(public.pagamenti_fornitori),
  artecna_notifiche.avviso_debito_fornitore(date,date,integer[]),
  artecna_notifiche.genera_pagamenti_fornitori(timestamptz) FROM PUBLIC,anon,authenticated,service_role;

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
  RETURN inserite + artecna_notifiche.genera_pagamenti_fornitori(ora_batch);
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
    AND (e.modulo = 'pagamenti_fornitori' OR NOT EXISTS (
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
  LEFT JOIN artecna_notifiche.preferenze_notifiche p ON p.user_id = p_user
  WHERE n.recipient_user_id = p_user AND n.archived_at IS NULL
    AND (d.id IS NOT NULL OR r.id IS NOT NULL OR a.id IS NOT NULL OR q.id IS NOT NULL OR (s.id IS NOT NULL AND artecna_guardie.utente_puo_operare_impresa(p_user)));
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
  WHERE v.id = p_id AND (v.modulo IN ('agenda', 'sopralluoghi','rapportini') OR (v.modulo='pagamenti_fornitori' AND v.attiva) OR (s.id IS NOT NULL AND s.archiviata_at IS NULL));
$$;


CREATE OR REPLACE FUNCTION public.lista_notifiche(p_filtro text DEFAULT 'tutte', p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(v) - 'record_id' - 'azione' ORDER BY v.published_at DESC, v.id), '[]')
  FROM (
    SELECT vis.*, (SELECT e.data_evento FROM artecna_notifiche.notifica n
      JOIN artecna_notifiche.evento_notificabile e ON e.id = n.evento_id WHERE n.id = vis.id AND vis.modulo IN ('agenda', 'sopralluoghi','rapportini','pagamenti_fornitori')) AS data_evento
    FROM artecna_notifiche.visibili(artecna_notifiche.utente_notifiche()) vis
    WHERE p_filtro = 'tutte'
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
    'pagamenti_fornitori', count(DISTINCT record_id) FILTER (WHERE modulo = 'pagamenti_fornitori'))
  FROM artecna_notifiche.visibili(artecna_notifiche.utente_notifiche())
  WHERE attiva AND read_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.leggi_preferenze_notifiche()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT coalesce(
    (SELECT to_jsonb(p) - 'user_id' - 'updated_at' FROM artecna_notifiche.preferenze_notifiche p
      WHERE p.user_id = artecna_notifiche.utente_notifiche()),
    '{"generali":true,"in_app":true,"scadenziario":true,"anticipi":[30,7,3,0],"agenda":true,"anticipi_agenda":[1,0],"sopralluoghi":true,"anticipi_sopralluoghi":[1,0],"rapportini":true,"pagamenti_fornitori":true,"anticipi_pagamenti_fornitori":[3,0],"revisione":0}'::jsonb
  )
  FROM (SELECT artecna_notifiche.utente_notifiche() AS id) u
  WHERE u.id IS NOT NULL;
$$;

CREATE FUNCTION public.salva_preferenze_notifiche(p_revisione integer, p_generali boolean,
  p_in_app boolean, p_scadenziario boolean, p_anticipi integer[], p_agenda boolean, p_anticipi_agenda integer[],
  p_sopralluoghi boolean, p_anticipi_sopralluoghi integer[], p_rapportini boolean,
  p_pagamenti_fornitori boolean, p_anticipi_pagamenti_fornitori integer[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  u uuid := artecna_notifiche.utente_notifiche();
  risultato artecna_notifiche.preferenze_notifiche;
BEGIN
  PERFORM public.salva_preferenze_notifiche(p_revisione, p_generali, p_in_app, p_scadenziario, p_anticipi, p_agenda, p_anticipi_agenda, p_sopralluoghi, p_anticipi_sopralluoghi, p_rapportini);
  UPDATE artecna_notifiche.preferenze_notifiche
  SET pagamenti_fornitori = p_pagamenti_fornitori,
      anticipi_pagamenti_fornitori = p_anticipi_pagamenti_fornitori
  WHERE user_id = u RETURNING * INTO STRICT risultato;
  RETURN to_jsonb(risultato) - 'user_id' - 'updated_at';
END;
$$;

REVOKE ALL ON FUNCTION public.salva_preferenze_notifiche(integer,boolean,boolean,boolean,integer[],boolean,integer[],boolean,integer[],boolean,boolean,integer[])
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.salva_preferenze_notifiche(integer,boolean,boolean,boolean,integer[],boolean,integer[],boolean,integer[],boolean,boolean,integer[])
  TO authenticated;

COMMIT;
