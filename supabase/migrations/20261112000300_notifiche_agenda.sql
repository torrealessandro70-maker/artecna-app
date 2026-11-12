BEGIN;

ALTER TABLE artecna_notifiche.evento_notificabile
  DROP CONSTRAINT evento_notificabile_ambito_check,
  ADD CHECK (ambito IN ('impresa', 'personale'));
ALTER TABLE artecna_notifiche.notifica
  DROP CONSTRAINT notifica_tipo_avviso_check,
  DROP CONSTRAINT notifica_azione_check,
  ADD CHECK (tipo_avviso IN ('30', '7', '3', '1', 'oggi', 'scaduta')),
  ADD CHECK (azione IN ('apri_scadenza_fiscale', 'apri_attivita_agenda'));
ALTER TABLE artecna_notifiche.preferenze_notifiche
  ADD COLUMN agenda boolean NOT NULL DEFAULT true,
  ADD COLUMN anticipi_agenda integer[] NOT NULL DEFAULT ARRAY[1,0]
    CHECK (array_position(anticipi_agenda, NULL) IS NULL AND anticipi_agenda <@ ARRAY[1,0]);

-- Keep the source table and its hard-delete catalog signature unchanged.
ALTER TABLE artecna_notifiche.evento_notificabile ADD COLUMN agenda_origine jsonb;

CREATE FUNCTION artecna_notifiche.agenda_origine(p_data date, p_inizio time, p_fine time, p_owner uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT jsonb_build_array(p_data - DATE '2000-01-01', extract(epoch FROM p_inizio), extract(epoch FROM p_fine), p_owner);
$$;

CREATE FUNCTION artecna_notifiche.genera_agenda(p_ora timestamptz)
RETURNS integer LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  oggi date := (p_ora AT TIME ZONE 'Europe/Rome')::date;
  inserite integer;
BEGIN
  IF p_ora IS NULL THEN RAISE EXCEPTION 'Ora del batch obbligatoria'; END IF;
  PERFORM pg_advisory_xact_lock(20261112, 1);

  -- Lock relevant source rows before deciding which occurrences to retire.
  PERFORM 1 FROM public.agenda_attivita a
  WHERE (a.stato = 'da_fare' AND a.data <= oggi + 1)
    OR EXISTS (SELECT 1 FROM artecna_notifiche.evento_notificabile e
      WHERE e.modulo = 'agenda' AND e.record_id = a.id AND e.resolved_at IS NULL)
  ORDER BY a.id FOR SHARE OF a;

  WITH chiusi AS (
    UPDATE artecna_notifiche.evento_notificabile e
    SET resolved_at = p_ora, updated_at = p_ora
    WHERE e.modulo = 'agenda' AND e.resolved_at IS NULL AND NOT EXISTS (
      SELECT 1 FROM public.agenda_attivita a
      WHERE a.id = e.record_id AND a.stato = 'da_fare'
        AND e.agenda_origine = artecna_notifiche.agenda_origine(a.data, a.ora_inizio, a.ora_fine, a.user_id)
    )
    RETURNING id
  )
  UPDATE artecna_notifiche.notifica SET resolved_at = p_ora, updated_at = p_ora
  WHERE evento_id IN (SELECT id FROM chiusi) AND resolved_at IS NULL;

  INSERT INTO artecna_notifiche.evento_notificabile
    (modulo, tipo_record, record_id, tipo_evento, data_evento, revisione_sorgente, ambito, agenda_origine)
  SELECT 'agenda', 'attivita_agenda', a.id, 'impegno_agenda',
    (a.data + a.ora_inizio) AT TIME ZONE 'Europe/Rome', 1, 'personale',
    artecna_notifiche.agenda_origine(a.data, a.ora_inizio, a.ora_fine, a.user_id)
  FROM public.agenda_attivita a
  WHERE a.stato = 'da_fare' AND a.data <= oggi + 1
  ORDER BY a.id FOR SHARE OF a
  ON CONFLICT (modulo, tipo_record, record_id, tipo_evento) WHERE resolved_at IS NULL DO NOTHING;

  INSERT INTO artecna_notifiche.notifica
    (evento_id, recipient_user_id, titolo, messaggio, priorita, tipo_avviso, scheduled_at, published_at, azione)
  SELECT e.id, a.user_id, 'Impegno Agenda',
    CASE v.tipo WHEN 'scaduta' THEN 'Impegno scaduto.' WHEN 'oggi' THEN 'Impegno oggi.' ELSE 'Impegno domani.' END,
    CASE v.tipo WHEN 'scaduta' THEN 'urgente' WHEN 'oggi' THEN 'alta' ELSE 'normale' END,
    v.tipo, v.istante, p_ora, 'apri_attivita_agenda'
  FROM artecna_notifiche.evento_notificabile e
  JOIN public.agenda_attivita a ON a.id = e.record_id AND a.stato = 'da_fare'
  LEFT JOIN artecna_notifiche.preferenze_notifiche p ON p.user_id = a.user_id
  CROSS JOIN LATERAL (
    SELECT opzione.tipo, opzione.istante
    FROM (VALUES
      ('1', (a.data - 1)::timestamp AT TIME ZONE 'Europe/Rome', 1),
      ('oggi', a.data::timestamp AT TIME ZONE 'Europe/Rome', 0),
      ('scaduta', greatest(e.data_evento, (a.data + a.ora_fine) AT TIME ZONE 'Europe/Rome'), -1)
    ) opzione(tipo, istante, anticipo)
    WHERE opzione.istante <= p_ora
      AND (opzione.anticipo = -1 OR opzione.anticipo = ANY(coalesce(p.anticipi_agenda, ARRAY[1,0])))
    ORDER BY opzione.anticipo LIMIT 1
  ) v
  WHERE e.modulo = 'agenda' AND e.resolved_at IS NULL AND coalesce(p.generali AND p.in_app AND p.agenda, true)
  ON CONFLICT (evento_id, recipient_user_id, tipo_avviso, scheduled_at) DO NOTHING;
  GET DIAGNOSTICS inserite = ROW_COUNT;
  RETURN inserite;
END;
$$;

CREATE OR REPLACE FUNCTION artecna_notifiche.esegui_generatore_runtime()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  ora_batch timestamptz := pg_catalog.now();
  scadenze integer;
BEGIN
  scadenze := artecna_notifiche.genera_scadenze(ora_batch);
  RETURN scadenze + artecna_notifiche.genera_agenda(ora_batch);
END;
$$;

CREATE FUNCTION artecna_notifiche.utente_notifiche()
RETURNS uuid LANGUAGE plpgsql STABLE SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  utente uuid := auth.uid();
BEGIN
  IF utente IS NULL THEN RAISE EXCEPTION 'Accesso notifiche non autorizzato' USING ERRCODE = '42501'; END IF;
  RETURN utente;
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
      WHEN 'agenda' THEN a.stato = 'da_fare'
        AND e.agenda_origine = artecna_notifiche.agenda_origine(a.data, a.ora_inizio, a.ora_fine, a.user_id)
        AND coalesce(p.generali AND p.in_app AND p.agenda, true)
        AND (n.tipo_avviso = 'scaduta' OR CASE n.tipo_avviso WHEN 'oggi' THEN 0 ELSE 1 END = ANY(coalesce(p.anticipi_agenda, ARRAY[1,0])))
      ELSE s.stato <> 'pagato' AND s.archiviata_at IS NULL AND coalesce(p.generali AND p.in_app AND p.scadenziario, true)
    END
    AND NOT EXISTS (
      SELECT 1 FROM artecna_notifiche.notifica successiva
      WHERE successiva.evento_id = n.evento_id AND successiva.recipient_user_id = n.recipient_user_id
        AND (successiva.scheduled_at > n.scheduled_at OR
          (successiva.scheduled_at = n.scheduled_at AND successiva.tipo_avviso = 'scaduta' AND n.tipo_avviso <> 'scaduta'))
    )
  FROM artecna_notifiche.notifica n
  JOIN artecna_notifiche.evento_notificabile e ON e.id = n.evento_id
  LEFT JOIN artecna_contabilita.scadenze_fiscali s ON e.modulo = 'scadenziario' AND s.id = e.record_id
  LEFT JOIN public.agenda_attivita a ON e.modulo = 'agenda' AND a.id = e.record_id AND a.user_id = p_user
  LEFT JOIN artecna_notifiche.preferenze_notifiche p ON p.user_id = p_user
  WHERE n.recipient_user_id = p_user AND n.archived_at IS NULL
    AND (a.id IS NOT NULL OR (s.id IS NOT NULL AND artecna_guardie.utente_puo_operare_impresa(p_user)));
$$;

CREATE OR REPLACE FUNCTION public.risolvi_destinazione_notifica(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT jsonb_build_object('azione', v.azione, 'record_id', v.record_id)
  FROM artecna_notifiche.visibili(artecna_notifiche.utente_notifiche()) v
  LEFT JOIN artecna_contabilita.scadenze_fiscali s ON v.modulo = 'scadenziario' AND s.id = v.record_id
  WHERE v.id = p_id AND (v.modulo = 'agenda' OR (s.id IS NOT NULL AND s.archiviata_at IS NULL));
$$;


CREATE OR REPLACE FUNCTION public.lista_notifiche(p_filtro text DEFAULT 'tutte', p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(v) - 'record_id' - 'azione' ORDER BY v.published_at DESC, v.id), '[]')
  FROM (
    SELECT vis.*, (SELECT e.data_evento FROM artecna_notifiche.notifica n
      JOIN artecna_notifiche.evento_notificabile e ON e.id = n.evento_id WHERE n.id = vis.id AND vis.modulo = 'agenda') AS data_evento
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
    'scadenziario', count(DISTINCT record_id) FILTER (WHERE modulo = 'scadenziario'), 'agenda', count(DISTINCT record_id) FILTER (WHERE modulo = 'agenda'))
  FROM artecna_notifiche.visibili(artecna_notifiche.utente_notifiche())
  WHERE attiva AND read_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.aggiorna_stato_notifica(p_id uuid, p_azione text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  u uuid := artecna_notifiche.utente_notifiche();
BEGIN
  IF p_azione IS NULL OR p_azione NOT IN ('leggi', 'archivia') THEN
    RAISE EXCEPTION 'Azione notifica non valida' USING ERRCODE = '22023';
  END IF;
  UPDATE artecna_notifiche.notifica n
  SET read_at = CASE WHEN p_azione = 'leggi' THEN coalesce(n.read_at, now()) ELSE n.read_at END,
      archived_at = CASE WHEN p_azione = 'archivia' THEN now() ELSE n.archived_at END,
      updated_at = now()
  WHERE n.id = p_id AND n.recipient_user_id = u AND n.archived_at IS NULL
    AND EXISTS (SELECT 1 FROM artecna_notifiche.visibili(u) v WHERE v.id = n.id);
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.leggi_preferenze_notifiche()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT coalesce(
    (SELECT to_jsonb(p) - 'user_id' - 'updated_at' FROM artecna_notifiche.preferenze_notifiche p
      WHERE p.user_id = artecna_notifiche.utente_notifiche()),
    '{"generali":true,"in_app":true,"scadenziario":true,"anticipi":[30,7,3,0],"agenda":true,"anticipi_agenda":[1,0],"revisione":0}'::jsonb
  )
  FROM (SELECT artecna_notifiche.utente_notifiche() AS id) u
  WHERE u.id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.salva_preferenze_notifiche(p_revisione integer, p_generali boolean,
  p_in_app boolean, p_scadenziario boolean, p_anticipi integer[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  u uuid := artecna_notifiche.utente_notifiche();
  risultato artecna_notifiche.preferenze_notifiche;
BEGIN
  IF p_revisione = 0 THEN
    INSERT INTO artecna_notifiche.preferenze_notifiche (user_id, generali, in_app, scadenziario, anticipi)
    VALUES (u, p_generali, p_in_app, p_scadenziario, p_anticipi)
    ON CONFLICT (user_id) DO NOTHING RETURNING * INTO risultato;
  ELSE
    UPDATE artecna_notifiche.preferenze_notifiche
    SET generali = p_generali, in_app = p_in_app, scadenziario = p_scadenziario,
      anticipi = p_anticipi, revisione = revisione + 1, updated_at = now()
    WHERE user_id = u AND revisione = p_revisione RETURNING * INTO risultato;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Preferenze modificate. Rileggere prima di salvare.' USING ERRCODE = '40001';
  END IF;
  RETURN to_jsonb(risultato) - 'user_id' - 'updated_at';
END;
$$;

CREATE OR REPLACE FUNCTION public.salva_preferenze_notifiche(p_revisione integer, p_generali boolean,
  p_in_app boolean, p_scadenziario boolean, p_anticipi integer[], p_agenda boolean, p_anticipi_agenda integer[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  u uuid := artecna_notifiche.utente_notifiche();
  risultato artecna_notifiche.preferenze_notifiche;
BEGIN
  IF p_revisione = 0 THEN
    INSERT INTO artecna_notifiche.preferenze_notifiche (user_id, generali, in_app, scadenziario, anticipi, agenda, anticipi_agenda)
    VALUES (u, p_generali, p_in_app, p_scadenziario, p_anticipi, p_agenda, p_anticipi_agenda)
    ON CONFLICT (user_id) DO NOTHING RETURNING * INTO risultato;
  ELSE
    UPDATE artecna_notifiche.preferenze_notifiche
    SET generali = p_generali, in_app = p_in_app, scadenziario = p_scadenziario,
      anticipi = p_anticipi, agenda = p_agenda, anticipi_agenda = p_anticipi_agenda, revisione = revisione + 1, updated_at = now()
    WHERE user_id = u AND revisione = p_revisione RETURNING * INTO risultato;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Preferenze modificate. Rileggere prima di salvare.' USING ERRCODE = '40001';
  END IF;
  RETURN to_jsonb(risultato) - 'user_id' - 'updated_at';
END;
$$;

REVOKE ALL ON FUNCTION artecna_notifiche.agenda_origine(date, time, time, uuid), artecna_notifiche.genera_agenda(timestamptz),
  artecna_notifiche.utente_notifiche(), artecna_notifiche.esegui_generatore_runtime()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.salva_preferenze_notifiche(integer, boolean, boolean, boolean, integer[], boolean, integer[])
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.salva_preferenze_notifiche(integer, boolean, boolean, boolean, integer[], boolean, integer[])
  TO authenticated;

COMMIT;
