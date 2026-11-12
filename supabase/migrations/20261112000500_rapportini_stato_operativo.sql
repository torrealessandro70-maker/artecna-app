BEGIN;
SET LOCAL search_path = pg_catalog, pg_temp;
SET LOCAL lock_timeout = '5s';

-- Preserve the V3 catalog guard. An unrelated pre-existing drift must fail before any DDL.
LOCK TABLE artecna_distruzione.hard_delete_catalog_expected IN EXCLUSIVE MODE;
LOCK TABLE public.rapportini IN ACCESS EXCLUSIVE MODE;
DO $catalog$
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres'
    OR NOT EXISTS (SELECT FROM pg_proc WHERE oid=to_regprocedure('artecna_distruzione.hard_delete_catalog()')
      AND md5(replace(prosrc,E'\r\n',E'\n'))='e653969ab1719f575d07038a3cbdd143')
    OR (SELECT count(*) FROM artecna_distruzione.hard_delete_catalog_expected) <> 1
    OR (SELECT signature FROM artecna_distruzione.hard_delete_catalog_expected)
       IS DISTINCT FROM artecna_distruzione.hard_delete_catalog()
  THEN RAISE EXCEPTION USING ERRCODE='P2113', MESSAGE='Catalogo hard delete V3 divergente';
  END IF;
END;
$catalog$;

ALTER TABLE public.rapportini
  ADD COLUMN stato_operativo text,
  ADD COLUMN revisione_stato bigint NOT NULL DEFAULT 0,
  ADD CONSTRAINT rapportini_stato_operativo_check CHECK (
    (stato_operativo IS NULL AND revisione_stato = 0) OR
    (stato_operativo IN ('bozza','chiuso') AND stato_operativo IS NOT NULL AND revisione_stato >= 0)
  );
-- Set the default separately so existing rows remain unclassified.
ALTER TABLE public.rapportini ALTER COLUMN stato_operativo SET DEFAULT 'bozza';

CREATE FUNCTION artecna_rapportini.proteggi_stato_operativo()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stato_operativo IS DISTINCT FROM 'bozza' OR NEW.revisione_stato <> 0 THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Nuovo rapportino: stato iniziale bozza';
    END IF;
  ELSIF current_user <> 'postgres' AND
    (NEW.stato_operativo,NEW.revisione_stato) IS DISTINCT FROM (OLD.stato_operativo,OLD.revisione_stato)
  THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Usare la RPC stato operativo';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER rapportino_stato_operativo_guardia
BEFORE INSERT OR UPDATE ON public.rapportini FOR EACH ROW
EXECUTE FUNCTION artecna_rapportini.proteggi_stato_operativo();

-- Invoker: the caller must already be able to read this row through grants/RLS.
CREATE FUNCTION public.leggi_stato_operativo_rapportino(p_id uuid,p_cantiere uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, pg_temp AS $$
  SELECT jsonb_build_object('stato',r.stato_operativo,'revisione_stato',r.revisione_stato::text,
    'revisione_documento',CASE WHEN r.versione_prestazioni=1 THEN r.revisione_prestazioni::text END)
  FROM public.rapportini r WHERE r.id=p_id AND r.cantiere_id IS NOT DISTINCT FROM p_cantiere;
$$;

CREATE FUNCTION public.cambia_stato_operativo_rapportino(p_id uuid,p_cantiere uuid,p_stato text,
  p_revisione_stato bigint,p_revisione_documento bigint)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  u uuid := artecna_guardie.utente_jwt_corrente();
  r public.rapportini;
BEGIN
  IF artecna_guardie.utente_puo_modificare_cantiere(u,p_cantiere) IS DISTINCT FROM true
  THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Rapportino non accessibile'; END IF;
  SELECT * INTO r FROM public.rapportini WHERE id=p_id AND cantiere_id=p_cantiere FOR UPDATE;
  IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(u,p_cantiere) IS DISTINCT FROM true
  THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Rapportino non accessibile'; END IF;
  IF p_stato IS NULL OR p_stato NOT IN ('bozza','chiuso') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Stato operativo non valido';
  END IF;
  IF r.revisione_stato IS DISTINCT FROM p_revisione_stato OR
    (CASE WHEN r.versione_prestazioni=1 THEN r.revisione_prestazioni END) IS DISTINCT FROM p_revisione_documento
  THEN RAISE EXCEPTION USING ERRCODE='PR412', MESSAGE='Rapportino aggiornato: rileggere prima di cambiare stato'; END IF;
  IF (p_stato='chiuso' AND (r.stato_operativo IS NULL OR r.stato_operativo='bozza'))
    OR (p_stato='bozza' AND r.stato_operativo='chiuso')
  THEN
    UPDATE public.rapportini SET stato_operativo=p_stato,revisione_stato=revisione_stato+1 WHERE id=r.id RETURNING * INTO r;
  ELSE RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Transizione operativa non valida';
  END IF;
  RETURN jsonb_build_object('stato',r.stato_operativo,'revisione_stato',r.revisione_stato::text,
    'revisione_documento',CASE WHEN r.versione_prestazioni=1 THEN r.revisione_prestazioni::text END);
END;
$$;

REVOKE ALL ON FUNCTION artecna_rapportini.proteggi_stato_operativo(),
  public.leggi_stato_operativo_rapportino(uuid,uuid),
  public.cambia_stato_operativo_rapportino(uuid,uuid,text,bigint,bigint)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leggi_stato_operativo_rapportino(uuid,uuid),
  public.cambia_stato_operativo_rapportino(uuid,uuid,text,bigint,bigint) TO authenticated;

-- The same catalog implementation now includes the two columns, constraint and trigger.
UPDATE artecna_distruzione.hard_delete_catalog_expected
SET signature=artecna_distruzione.hard_delete_catalog();

COMMIT;
