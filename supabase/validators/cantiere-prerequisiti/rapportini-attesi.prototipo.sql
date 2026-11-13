BEGIN;

CREATE TABLE artecna_rapportini.configurazione_attesi (
  cantiere_id uuid PRIMARY KEY REFERENCES public.cantieri(id),
  sospeso boolean NOT NULL DEFAULT false,
  sospeso_fino_al date CHECK (isfinite(sospeso_fino_al)),
  rilevanza_giorni smallint DEFAULT 7 CHECK (rilevanza_giorni IN (3, 7, 15, 30)),
  revisione bigint NOT NULL DEFAULT 1 CHECK (revisione > 0),
  aggiornato_at timestamptz NOT NULL DEFAULT now(),
  aggiornato_da uuid NOT NULL,
  CHECK (sospeso OR sospeso_fino_al IS NULL)
);

CREATE TABLE artecna_rapportini.attesi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cantiere_id uuid NOT NULL REFERENCES public.cantieri(id),
  giorno_lavoro date NOT NULL CHECK (isfinite(giorno_lavoro)),
  termine_at timestamptz NOT NULL CHECK (isfinite(termine_at)),
  rilevante_fino_at timestamptz CHECK (isfinite(rilevante_fino_at) AND rilevante_fino_at > termine_at),
  revisione bigint NOT NULL DEFAULT 1 CHECK (revisione > 0),
  creato_at timestamptz NOT NULL DEFAULT now(),
  creato_da uuid NOT NULL,
  aggiornato_at timestamptz NOT NULL DEFAULT now(),
  aggiornato_da uuid NOT NULL,
  UNIQUE (cantiere_id, giorno_lavoro),
  CHECK ((termine_at AT TIME ZONE 'Europe/Rome')::date = giorno_lavoro)
);

ALTER TABLE artecna_rapportini.configurazione_attesi ENABLE ROW LEVEL SECURITY;
ALTER TABLE artecna_rapportini.attesi ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON artecna_rapportini.configurazione_attesi, artecna_rapportini.attesi
  FROM PUBLIC, anon, authenticated, service_role;

-- PostgreSQL maps the autumn overlap to standard time (the later instant).
-- A spring gap is rejected, including when computing the end of relevance.
CREATE FUNCTION artecna_rapportini.istante_attesi(p_locale timestamp)
RETURNS timestamptz LANGUAGE plpgsql STABLE STRICT SET search_path = pg_catalog, pg_temp AS $$
DECLARE v_istante timestamptz := p_locale AT TIME ZONE 'Europe/Rome';
BEGIN
  IF NOT isfinite(p_locale) OR v_istante AT TIME ZONE 'Europe/Rome' <> p_locale THEN
    RAISE EXCEPTION 'Data o ora locale non valida in Europe/Rome' USING ERRCODE = '22023';
  END IF;
  RETURN v_istante;
END;
$$;

CREATE FUNCTION artecna_rapportini.esito_atteso(p_cantiere uuid, p_giorno date)
RETURNS text LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT CASE
    WHEN bool_or(stato_operativo = 'chiuso') THEN 'soddisfatto'
    WHEN bool_or(stato_operativo = 'bozza') THEN 'da_chiudere'
    WHEN count(*) > 0 THEN 'da_classificare'
    ELSE 'mancante'
  END
  FROM public.rapportini WHERE cantiere_id = p_cantiere AND data = p_giorno
$$;

CREATE FUNCTION artecna_rapportini.avvisi_attesi_attivi(p_cantiere uuid, p_ora timestamptz)
RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT coalesce((
    SELECT c.lavori_conclusi IS NOT TRUE
      AND (cfg.sospeso IS NOT TRUE OR (cfg.sospeso_fino_al IS NOT NULL
        AND (p_ora AT TIME ZONE 'Europe/Rome')::date > cfg.sospeso_fino_al))
    FROM public.cantieri c
    LEFT JOIN artecna_rapportini.configurazione_attesi cfg ON cfg.cantiere_id = c.id
    WHERE c.id = p_cantiere
  ), false)
$$;

CREATE FUNCTION artecna_rapportini.blocca_cantiere_attesi(p_cantiere uuid)
RETURNS uuid LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, pg_temp AS $$
DECLARE v_utente uuid := artecna_guardie.utente_jwt_corrente();
BEGIN
  IF artecna_guardie.utente_puo_modificare_cantiere(v_utente,p_cantiere) IS NOT TRUE THEN
    RAISE EXCEPTION 'Cantiere non autorizzato' USING ERRCODE = '42501';
  END IF;
  PERFORM FROM public.cantieri WHERE id = p_cantiere FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cantiere non disponibile' USING ERRCODE = '42501'; END IF;
  PERFORM FROM public.utenti_cantiere
    WHERE cantiere_id = p_cantiere AND user_id = v_utente AND ruolo = 'owner' FOR SHARE;
  IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_utente,p_cantiere) IS NOT TRUE THEN
    RAISE EXCEPTION 'Cantiere non autorizzato' USING ERRCODE = '42501';
  END IF;
  RETURN v_utente;
END;
$$;

CREATE FUNCTION public.configura_rapportini_attesi(
  p_cantiere uuid, p_revisione bigint, p_sospeso boolean, p_fino_al date, p_rilevanza smallint
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  v_utente uuid := artecna_rapportini.blocca_cantiere_attesi(p_cantiere);
  v_revisione bigint;
BEGIN
  SELECT revisione INTO v_revisione FROM artecna_rapportini.configurazione_attesi WHERE cantiere_id = p_cantiere;
  IF coalesce(v_revisione,0) IS DISTINCT FROM p_revisione THEN
    RAISE EXCEPTION 'Configurazione modificata: rileggere prima di salvare' USING ERRCODE = 'PR412';
  END IF;
  INSERT INTO artecna_rapportini.configurazione_attesi
    (cantiere_id,sospeso,sospeso_fino_al,rilevanza_giorni,aggiornato_da)
  VALUES (p_cantiere,p_sospeso,p_fino_al,p_rilevanza,v_utente)
  ON CONFLICT (cantiere_id) DO UPDATE SET
    sospeso = excluded.sospeso, sospeso_fino_al = excluded.sospeso_fino_al,
    rilevanza_giorni = excluded.rilevanza_giorni, aggiornato_da = excluded.aggiornato_da,
    aggiornato_at = now(), revisione = configurazione_attesi.revisione + 1
  RETURNING revisione INTO v_revisione;
  RETURN v_revisione;
END;
$$;

CREATE FUNCTION public.pianifica_rapportini_attesi(p_cantiere uuid, p_revisione_config bigint, p_giornate jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  v_utente uuid := artecna_rapportini.blocca_cantiere_attesi(p_cantiere);
  v_revisione bigint;
  v_giorni integer;
  v_inserite integer;
BEGIN
  SELECT revisione,rilevanza_giorni INTO v_revisione,v_giorni
    FROM artecna_rapportini.configurazione_attesi WHERE cantiere_id = p_cantiere;
  IF coalesce(v_revisione,0) IS DISTINCT FROM p_revisione_config THEN
    RAISE EXCEPTION 'Configurazione modificata: rivedere la pianificazione' USING ERRCODE = 'PR412';
  END IF;
  IF v_revisione IS NULL THEN v_giorni := 7; END IF;
  IF jsonb_typeof(p_giornate) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Giornate da confermare obbligatorie' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_giornate) NOT BETWEEN 1 AND 366 THEN
    RAISE EXCEPTION 'Confermare da 1 a 366 giornate' USING ERRCODE = '22023';
  END IF;
  INSERT INTO artecna_rapportini.attesi
    (cantiere_id,giorno_lavoro,termine_at,rilevante_fino_at,creato_da,aggiornato_da)
  SELECT p_cantiere, g.giorno,
    artecna_rapportini.istante_attesi(g.giorno + g.ora),
    artecna_rapportini.istante_attesi((g.giorno + v_giorni) + g.ora), v_utente, v_utente
  FROM jsonb_to_recordset(p_giornate) AS g(giorno date, ora time)
  ORDER BY g.giorno;
  GET DIAGNOSTICS v_inserite = ROW_COUNT;
  RETURN v_inserite;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Una o piu giornate sono duplicate o gia pianificate' USING ERRCODE = 'PR409';
END;
$$;

REVOKE ALL ON FUNCTION artecna_rapportini.istante_attesi(timestamp),
  artecna_rapportini.esito_atteso(uuid,date), artecna_rapportini.avvisi_attesi_attivi(uuid,timestamptz),
  artecna_rapportini.blocca_cantiere_attesi(uuid),
  public.configura_rapportini_attesi(uuid,bigint,boolean,date,smallint),
  public.pianifica_rapportini_attesi(uuid,bigint,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.configura_rapportini_attesi(uuid,bigint,boolean,date,smallint),
  public.pianifica_rapportini_attesi(uuid,bigint,jsonb) TO authenticated;

-- A production candidate must extend and certify the Hard Delete V3 manifest
-- before registering any catalog change introduced by these foreign keys.
ROLLBACK;
