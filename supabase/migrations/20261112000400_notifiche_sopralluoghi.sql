BEGIN;

ALTER TABLE artecna_notifiche.evento_notificabile ADD COLUMN sopralluogo_origine timestamp;
ALTER TABLE artecna_notifiche.notifica
  DROP CONSTRAINT notifica_azione_check,
  ADD CHECK (azione IN ('apri_scadenza_fiscale', 'apri_attivita_agenda', 'apri_sopralluogo'));
ALTER TABLE artecna_notifiche.preferenze_notifiche
  ADD COLUMN sopralluoghi boolean NOT NULL DEFAULT true,
  ADD COLUMN anticipi_sopralluoghi integer[] NOT NULL DEFAULT ARRAY[1,0]
    CHECK (array_position(anticipi_sopralluoghi, NULL) IS NULL AND anticipi_sopralluoghi <@ ARRAY[1,0]);

-- A populated appointment time distinguishes an appointment from the form's default date.
-- Skip nonexistent local times at the spring DST transition.
CREATE FUNCTION artecna_notifiche.sopralluogo_orario(p_data date, p_ora text)
RETURNS timestamp LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT CASE WHEN ((locale AT TIME ZONE 'Europe/Rome') AT TIME ZONE 'Europe/Rome') = locale THEN locale END
  FROM (SELECT CASE WHEN isfinite(p_data) AND btrim(p_ora) ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
    THEN p_data + btrim(p_ora)::time END AS locale) a;
$$;

-- The audited legacy archive is shared. If it gains row-level access rules, fail closed
-- until those rules can be evaluated for each recipient.
CREATE FUNCTION artecna_notifiche.puo_ricevere_sopralluoghi(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT artecna_guardie.utente_puo_operare_impresa(p_user) IS TRUE
    AND has_table_privilege('authenticated', 'public.sopralluoghi', 'SELECT')
    AND EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.sopralluoghi'::regclass AND NOT relrowsecurity);
$$;

CREATE FUNCTION artecna_notifiche.genera_sopralluoghi(p_ora timestamptz)
RETURNS integer LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  oggi date := (p_ora AT TIME ZONE 'Europe/Rome')::date;
  inserite integer;
BEGIN
  IF p_ora IS NULL THEN RAISE EXCEPTION 'Ora del batch obbligatoria'; END IF;
  PERFORM pg_advisory_xact_lock(20261112, 1);

  PERFORM 1 FROM public.sopralluoghi s
  WHERE (s.stato = 'da_preventivare' AND s.data_sopralluogo BETWEEN oggi AND oggi + 1)
     OR EXISTS (SELECT 1 FROM artecna_notifiche.evento_notificabile e
       WHERE e.modulo = 'sopralluoghi' AND e.record_id = s.id AND e.resolved_at IS NULL)
  ORDER BY s.id FOR SHARE OF s;

  WITH chiusi AS (
    UPDATE artecna_notifiche.evento_notificabile e SET resolved_at = p_ora, updated_at = p_ora
    WHERE e.modulo = 'sopralluoghi' AND e.resolved_at IS NULL
      AND (e.data_evento <= p_ora OR NOT EXISTS (
        SELECT 1 FROM public.sopralluoghi s WHERE s.id = e.record_id AND s.stato = 'da_preventivare'
          AND e.sopralluogo_origine = artecna_notifiche.sopralluogo_orario(s.data_sopralluogo, s.ora_appuntamento)))
    RETURNING id
  )
  UPDATE artecna_notifiche.notifica SET resolved_at = p_ora, updated_at = p_ora
  WHERE evento_id IN (SELECT id FROM chiusi) AND resolved_at IS NULL;

  INSERT INTO artecna_notifiche.evento_notificabile
    (modulo, tipo_record, record_id, tipo_evento, data_evento, revisione_sorgente, ambito, sopralluogo_origine)
  SELECT 'sopralluoghi', 'sopralluogo', s.id, 'appuntamento', a.locale AT TIME ZONE 'Europe/Rome', 1, 'impresa', a.locale
  FROM public.sopralluoghi s
  CROSS JOIN LATERAL (SELECT artecna_notifiche.sopralluogo_orario(s.data_sopralluogo, s.ora_appuntamento) AS locale) a
  WHERE s.stato = 'da_preventivare' AND s.data_sopralluogo BETWEEN oggi AND oggi + 1
    AND (a.locale AT TIME ZONE 'Europe/Rome') > p_ora
  ORDER BY s.id FOR SHARE OF s
  ON CONFLICT (modulo, tipo_record, record_id, tipo_evento) WHERE resolved_at IS NULL DO NOTHING;

  INSERT INTO artecna_notifiche.notifica
    (evento_id, recipient_user_id, titolo, messaggio, priorita, tipo_avviso, scheduled_at, published_at, azione)
  SELECT e.id, u.user_id, 'Sopralluogo programmato',
    CASE WHEN v.anticipo = 0 THEN 'Appuntamento oggi.' ELSE 'Appuntamento domani.' END,
    CASE WHEN v.anticipo = 0 THEN 'alta' ELSE 'normale' END,
    CASE WHEN v.anticipo = 0 THEN 'oggi' ELSE '1' END,
    oggi::timestamp AT TIME ZONE 'Europe/Rome', p_ora, 'apri_sopralluogo'
  FROM artecna_notifiche.evento_notificabile e
  JOIN public.sopralluoghi s ON s.id = e.record_id AND s.stato = 'da_preventivare'
    AND e.sopralluogo_origine = artecna_notifiche.sopralluogo_orario(s.data_sopralluogo, s.ora_appuntamento)
  CROSS JOIN public.utenti_impresa u
  LEFT JOIN artecna_notifiche.preferenze_notifiche p ON p.user_id = u.user_id
  CROSS JOIN LATERAL (SELECT s.data_sopralluogo - oggi AS anticipo) v
  WHERE e.modulo = 'sopralluoghi' AND e.resolved_at IS NULL AND e.data_evento > p_ora
    AND artecna_notifiche.puo_ricevere_sopralluoghi(u.user_id)
    AND coalesce(p.generali AND p.in_app AND p.sopralluoghi, true)
    AND v.anticipo = ANY(coalesce(p.anticipi_sopralluoghi, ARRAY[1,0]))
  ON CONFLICT (evento_id, recipient_user_id, tipo_avviso, scheduled_at) DO NOTHING;
  GET DIAGNOSTICS inserite = ROW_COUNT;
  RETURN inserite;
END;
$$;

CREATE OR REPLACE FUNCTION artecna_notifiche.esegui_generatore_runtime()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  ora_batch timestamptz := pg_catalog.now();
  inserite integer;
BEGIN
  inserite := artecna_notifiche.genera_scadenze(ora_batch);
  inserite := inserite + artecna_notifiche.genera_agenda(ora_batch);
  RETURN inserite + artecna_notifiche.genera_sopralluoghi(ora_batch);
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
      WHEN 'sopralluoghi' THEN q.stato = 'da_preventivare'
        AND e.sopralluogo_origine = artecna_notifiche.sopralluogo_orario(q.data_sopralluogo, q.ora_appuntamento)
        AND now() < e.data_evento
        AND coalesce(p.generali AND p.in_app AND p.sopralluoghi, true)
        AND (CASE n.tipo_avviso WHEN 'oggi' THEN 0 ELSE 1 END) = ANY(coalesce(p.anticipi_sopralluoghi, ARRAY[1,0]))
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
  LEFT JOIN public.sopralluoghi q ON e.modulo = 'sopralluoghi' AND q.id = e.record_id
    AND artecna_notifiche.puo_ricevere_sopralluoghi(p_user)
  LEFT JOIN artecna_notifiche.preferenze_notifiche p ON p.user_id = p_user
  WHERE n.recipient_user_id = p_user AND n.archived_at IS NULL
    AND (a.id IS NOT NULL OR q.id IS NOT NULL OR (s.id IS NOT NULL AND artecna_guardie.utente_puo_operare_impresa(p_user)));
$$;

CREATE OR REPLACE FUNCTION public.risolvi_destinazione_notifica(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT jsonb_build_object('azione', v.azione, 'record_id', v.record_id)
  FROM artecna_notifiche.visibili(artecna_notifiche.utente_notifiche()) v
  LEFT JOIN artecna_contabilita.scadenze_fiscali s ON v.modulo = 'scadenziario' AND s.id = v.record_id
  WHERE v.id = p_id AND (v.modulo IN ('agenda', 'sopralluoghi') OR (s.id IS NOT NULL AND s.archiviata_at IS NULL));
$$;


CREATE OR REPLACE FUNCTION public.lista_notifiche(p_filtro text DEFAULT 'tutte', p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(v) - 'record_id' - 'azione' ORDER BY v.published_at DESC, v.id), '[]')
  FROM (
    SELECT vis.*, (SELECT e.data_evento FROM artecna_notifiche.notifica n
      JOIN artecna_notifiche.evento_notificabile e ON e.id = n.evento_id WHERE n.id = vis.id AND vis.modulo IN ('agenda', 'sopralluoghi')) AS data_evento
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
    'sopralluoghi', count(DISTINCT record_id) FILTER (WHERE modulo = 'sopralluoghi'))
  FROM artecna_notifiche.visibili(artecna_notifiche.utente_notifiche())
  WHERE attiva AND read_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.leggi_preferenze_notifiche()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT coalesce(
    (SELECT to_jsonb(p) - 'user_id' - 'updated_at' FROM artecna_notifiche.preferenze_notifiche p
      WHERE p.user_id = artecna_notifiche.utente_notifiche()),
    '{"generali":true,"in_app":true,"scadenziario":true,"anticipi":[30,7,3,0],"agenda":true,"anticipi_agenda":[1,0],"sopralluoghi":true,"anticipi_sopralluoghi":[1,0],"revisione":0}'::jsonb
  )
  FROM (SELECT artecna_notifiche.utente_notifiche() AS id) u
  WHERE u.id IS NOT NULL;
$$;

CREATE FUNCTION public.salva_preferenze_notifiche(p_revisione integer, p_generali boolean,
  p_in_app boolean, p_scadenziario boolean, p_anticipi integer[], p_agenda boolean, p_anticipi_agenda integer[],
  p_sopralluoghi boolean, p_anticipi_sopralluoghi integer[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  u uuid := artecna_notifiche.utente_notifiche();
  risultato artecna_notifiche.preferenze_notifiche;
BEGIN
  PERFORM public.salva_preferenze_notifiche(p_revisione, p_generali, p_in_app, p_scadenziario, p_anticipi, p_agenda, p_anticipi_agenda);
  UPDATE artecna_notifiche.preferenze_notifiche
  SET sopralluoghi = p_sopralluoghi, anticipi_sopralluoghi = p_anticipi_sopralluoghi
  WHERE user_id = u RETURNING * INTO STRICT risultato;
  RETURN to_jsonb(risultato) - 'user_id' - 'updated_at';
END;
$$;

REVOKE ALL ON FUNCTION artecna_notifiche.sopralluogo_orario(date, text),
  artecna_notifiche.puo_ricevere_sopralluoghi(uuid), artecna_notifiche.genera_sopralluoghi(timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.salva_preferenze_notifiche(integer, boolean, boolean, boolean, integer[], boolean, integer[], boolean, integer[])
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.salva_preferenze_notifiche(integer, boolean, boolean, boolean, integer[], boolean, integer[], boolean, integer[])
  TO authenticated;

COMMIT;
