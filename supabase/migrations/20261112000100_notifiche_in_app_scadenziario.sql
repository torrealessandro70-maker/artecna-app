BEGIN;

CREATE SCHEMA artecna_notifiche;
REVOKE ALL ON SCHEMA artecna_notifiche FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE artecna_notifiche.evento_notificabile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo text NOT NULL,
  tipo_record text NOT NULL,
  record_id uuid NOT NULL,
  tipo_evento text NOT NULL,
  data_evento timestamptz NOT NULL,
  occorrenza uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  revisione_sorgente bigint NOT NULL,
  ambito text NOT NULL CHECK (ambito = 'impresa'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE UNIQUE INDEX evento_attivo_origine ON artecna_notifiche.evento_notificabile
  (modulo, tipo_record, record_id, tipo_evento) WHERE resolved_at IS NULL;

CREATE TABLE artecna_notifiche.notifica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES artecna_notifiche.evento_notificabile(id),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titolo text NOT NULL,
  messaggio text NOT NULL,
  priorita text NOT NULL CHECK (priorita IN ('normale', 'alta', 'urgente')),
  tipo_avviso text NOT NULL CHECK (tipo_avviso IN ('30', '7', '3', 'oggi', 'scaduta')),
  scheduled_at timestamptz NOT NULL,
  published_at timestamptz NOT NULL,
  read_at timestamptz,
  resolved_at timestamptz,
  archived_at timestamptz,
  azione text NOT NULL CHECK (azione = 'apri_scadenza_fiscale'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- evento_id identifica modulo, tipo, record e occorrenza.
  UNIQUE (evento_id, recipient_user_id, tipo_avviso, scheduled_at)
);
CREATE INDEX notifica_destinatario ON artecna_notifiche.notifica (recipient_user_id, published_at DESC, id);

CREATE TABLE artecna_notifiche.preferenze_notifiche (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  generali boolean NOT NULL DEFAULT true,
  in_app boolean NOT NULL DEFAULT true,
  scadenziario boolean NOT NULL DEFAULT true,
  anticipi integer[] NOT NULL DEFAULT ARRAY[30,7,3,0]
    CHECK (array_position(anticipi, NULL) IS NULL AND anticipi <@ ARRAY[30,7,3,0]),
  revisione integer NOT NULL DEFAULT 1 CHECK (revisione > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE artecna_notifiche.evento_notificabile ENABLE ROW LEVEL SECURITY;
ALTER TABLE artecna_notifiche.notifica ENABLE ROW LEVEL SECURITY;
ALTER TABLE artecna_notifiche.preferenze_notifiche ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA artecna_notifiche FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION artecna_notifiche.risolvi_eventi(p_record uuid, p_ora timestamptz)
RETURNS void LANGUAGE sql SET search_path = pg_catalog, pg_temp AS $$
  WITH chiusi AS (
    UPDATE artecna_notifiche.evento_notificabile
    SET resolved_at = p_ora, updated_at = p_ora
    WHERE modulo = 'scadenziario' AND tipo_record = 'scadenza_fiscale'
      AND record_id = p_record AND resolved_at IS NULL
    RETURNING id
  )
  UPDATE artecna_notifiche.notifica
  SET resolved_at = p_ora, updated_at = p_ora
  WHERE evento_id IN (SELECT id FROM chiusi) AND resolved_at IS NULL;
$$;

CREATE FUNCTION artecna_notifiche.scadenza_cambiata()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM artecna_notifiche.risolvi_eventi(OLD.id, now());
  ELSIF NEW.data_scadenza IS DISTINCT FROM OLD.data_scadenza OR
      NEW.stato = 'pagato' OR NEW.archiviata_at IS NOT NULL THEN
    PERFORM artecna_notifiche.risolvi_eventi(NEW.id, now());
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER scadenza_notifiche_risolvi
AFTER UPDATE OF data_scadenza, stato, archiviata_at OR DELETE
ON artecna_contabilita.scadenze_fiscali
FOR EACH ROW EXECUTE FUNCTION artecna_notifiche.scadenza_cambiata();

CREATE FUNCTION artecna_notifiche.genera_scadenze(p_ora timestamptz DEFAULT now())
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  oggi date := (p_ora AT TIME ZONE 'Europe/Rome')::date;
  inserite integer;
BEGIN
  IF p_ora IS NULL THEN RAISE EXCEPTION 'Ora del batch obbligatoria'; END IF;
  PERFORM pg_advisory_xact_lock(20261112, 1);

  INSERT INTO artecna_notifiche.evento_notificabile AS e
    (modulo, tipo_record, record_id, tipo_evento, data_evento, revisione_sorgente, ambito)
  SELECT 'scadenziario', 'scadenza_fiscale', s.id, 'obbligo_fiscale',
    s.data_scadenza::timestamp AT TIME ZONE 'Europe/Rome', s.revisione, 'impresa'
  FROM artecna_contabilita.scadenze_fiscali s
  WHERE s.stato <> 'pagato' AND s.archiviata_at IS NULL AND s.data_scadenza <= oggi + 30
  ORDER BY s.id
  FOR SHARE OF s
  ON CONFLICT (modulo, tipo_record, record_id, tipo_evento) WHERE resolved_at IS NULL
  DO UPDATE SET revisione_sorgente = excluded.revisione_sorgente, updated_at = p_ora
  WHERE e.revisione_sorgente IS DISTINCT FROM excluded.revisione_sorgente;

  WITH destinatari AS MATERIALIZED (
    SELECT u.user_id, coalesce(p.anticipi, ARRAY[30,7,3,0]) AS anticipi
    FROM public.utenti_impresa u
    LEFT JOIN artecna_notifiche.preferenze_notifiche p ON p.user_id = u.user_id
    WHERE artecna_guardie.utente_puo_operare_impresa(u.user_id)
      AND coalesce(p.generali AND p.in_app AND p.scadenziario, true)
  ), maturate AS (
    SELECT e.id, d.user_id, a.tipo, a.giorno
    FROM artecna_notifiche.evento_notificabile e
    JOIN artecna_contabilita.scadenze_fiscali s ON s.id = e.record_id
    CROSS JOIN destinatari d
    CROSS JOIN LATERAL (
      SELECT v.tipo, s.data_scadenza - v.anticipo AS giorno
      FROM (VALUES (30,'30'), (7,'7'), (3,'3'), (0,'oggi'), (-1,'scaduta')) v(anticipo,tipo)
      WHERE (v.anticipo = -1 OR v.anticipo = ANY(d.anticipi))
        AND s.data_scadenza - v.anticipo <= oggi
      ORDER BY v.anticipo LIMIT 1
    ) a
    WHERE e.modulo = 'scadenziario' AND e.tipo_record = 'scadenza_fiscale'
      AND e.tipo_evento = 'obbligo_fiscale' AND e.resolved_at IS NULL
      AND s.stato <> 'pagato' AND s.archiviata_at IS NULL
  )
  INSERT INTO artecna_notifiche.notifica
    (evento_id, recipient_user_id, titolo, messaggio, priorita, tipo_avviso, scheduled_at, published_at, azione)
  SELECT id, user_id, 'Scadenza fiscale',
    CASE tipo WHEN 'scaduta' THEN 'Scadenza superata.' WHEN 'oggi' THEN 'Scadenza oggi.'
      ELSE 'Scadenza in avvicinamento.' END,
    CASE tipo WHEN 'scaduta' THEN 'urgente' WHEN 'oggi' THEN 'alta' ELSE 'normale' END,
    tipo, giorno::timestamp AT TIME ZONE 'Europe/Rome', p_ora, 'apri_scadenza_fiscale'
  FROM maturate
  ON CONFLICT (evento_id, recipient_user_id, tipo_avviso, scheduled_at) DO NOTHING;
  GET DIAGNOSTICS inserite = ROW_COUNT;
  RETURN inserite;
END;
$$;

CREATE FUNCTION artecna_notifiche.visibili(p_user uuid)
RETURNS TABLE (id uuid, titolo text, messaggio text, priorita text, modulo text, published_at timestamptz,
  read_at timestamptz, resolved_at timestamptz, record_id uuid, azione text, attiva boolean)
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT n.id, n.titolo, n.messaggio, n.priorita, e.modulo, n.published_at,
    n.read_at, n.resolved_at, s.id, n.azione,
    n.resolved_at IS NULL AND e.resolved_at IS NULL AND s.stato <> 'pagato' AND s.archiviata_at IS NULL
    AND coalesce(p.generali AND p.in_app AND p.scadenziario, true)
    AND NOT EXISTS (
      SELECT 1 FROM artecna_notifiche.notifica successiva
      WHERE successiva.evento_id = n.evento_id
        AND successiva.recipient_user_id = n.recipient_user_id
        AND successiva.scheduled_at > n.scheduled_at
    )
  FROM artecna_notifiche.notifica n
  JOIN artecna_notifiche.evento_notificabile e ON e.id = n.evento_id
    AND e.modulo = 'scadenziario' AND e.tipo_record = 'scadenza_fiscale'
  JOIN artecna_contabilita.scadenze_fiscali s ON s.id = e.record_id
  LEFT JOIN artecna_notifiche.preferenze_notifiche p ON p.user_id = n.recipient_user_id
  WHERE n.recipient_user_id = p_user AND n.archived_at IS NULL
    AND artecna_guardie.utente_puo_operare_impresa(p_user);
$$;

CREATE FUNCTION public.lista_notifiche(p_filtro text DEFAULT 'tutte', p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(v) - 'record_id' - 'azione' ORDER BY v.published_at DESC, v.id), '[]')
  FROM (
    SELECT *
    FROM artecna_notifiche.visibili(artecna_contabilita.scadenza_autorizza())
    WHERE p_filtro = 'tutte'
      OR (p_filtro = 'da_leggere' AND attiva AND read_at IS NULL)
      OR (p_filtro = 'urgenti' AND attiva AND priorita IN ('alta', 'urgente'))
    ORDER BY published_at DESC, id LIMIT 50 OFFSET greatest(p_offset, 0)
  ) v;
$$;

CREATE FUNCTION public.contatori_notifiche()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT jsonb_build_object('totale', count(DISTINCT (modulo, record_id)),
    'scadenziario', count(DISTINCT record_id) FILTER (WHERE modulo = 'scadenziario'))
  FROM artecna_notifiche.visibili(artecna_contabilita.scadenza_autorizza())
  WHERE attiva AND read_at IS NULL;
$$;

CREATE FUNCTION public.aggiorna_stato_notifica(p_id uuid, p_azione text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  u uuid := artecna_contabilita.scadenza_autorizza();
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

CREATE FUNCTION public.risolvi_destinazione_notifica(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT jsonb_build_object('azione', v.azione, 'record_id', v.record_id)
  FROM artecna_notifiche.visibili(artecna_contabilita.scadenza_autorizza()) v
  JOIN artecna_contabilita.scadenze_fiscali s ON s.id = v.record_id
  WHERE v.id = p_id AND s.archiviata_at IS NULL;
$$;

CREATE FUNCTION public.leggi_preferenze_notifiche()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT coalesce(
    (SELECT to_jsonb(p) - 'user_id' - 'updated_at' FROM artecna_notifiche.preferenze_notifiche p
      WHERE p.user_id = artecna_contabilita.scadenza_autorizza()),
    '{"generali":true,"in_app":true,"scadenziario":true,"anticipi":[30,7,3,0],"revisione":0}'::jsonb
  )
  FROM (SELECT artecna_contabilita.scadenza_autorizza() AS id) u
  WHERE u.id IS NOT NULL;
$$;

CREATE FUNCTION public.salva_preferenze_notifiche(p_revisione integer, p_generali boolean,
  p_in_app boolean, p_scadenziario boolean, p_anticipi integer[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  u uuid := artecna_contabilita.scadenza_autorizza();
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

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA artecna_notifiche FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.lista_notifiche(text, integer), public.contatori_notifiche(),
  public.aggiorna_stato_notifica(uuid, text), public.risolvi_destinazione_notifica(uuid),
  public.leggi_preferenze_notifiche(), public.salva_preferenze_notifiche(integer, boolean, boolean, boolean, integer[])
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lista_notifiche(text, integer), public.contatori_notifiche(),
  public.aggiorna_stato_notifica(uuid, text), public.risolvi_destinazione_notifica(uuid),
  public.leggi_preferenze_notifiche(), public.salva_preferenze_notifiche(integer, boolean, boolean, boolean, integer[])
  TO authenticated;

COMMIT;
