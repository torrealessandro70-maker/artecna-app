BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
LOCK TABLE artecna_distruzione.hard_delete_catalog_expected IN EXCLUSIVE MODE;

-- Full reconstructed definitions from the immutable milestone on PostgreSQL 17.6.
-- See rapportini-attesi-hard-delete-reference.json for the DDL and provenance.
DO $previous$
DECLARE
  expected record;
  observed record;
  difference record;
BEGIN
  FOR expected IN SELECT * FROM (VALUES
    ('artecna_distruzione.hard_delete_targets(uuid)', '2604900705b41764b99584066de8c590', 'e92d14170d0e5f13babd5efa6f04a939'),
    ('public.elimina_cantiere_definitivamente(uuid,text)', 'cd58df95bd568aabecfc4f9866b9bb06', '9262aba322f48c6b456c78570e2cbb3a')
  ) AS v(identity,ddl_md5,body_md5) LOOP
    SELECT p.procost,p.proparallel::text AS parallel,md5(p.prosrc) AS body_md5,
      md5(pg_get_functiondef(p.oid)) AS ddl_md5
    INTO observed FROM pg_proc p WHERE p.oid=to_regprocedure(expected.identity);
    FOR difference IN SELECT * FROM (VALUES
      ('procost','100',observed.procost::text),
      ('proparallel','u',observed.parallel),
      ('prosrc MD5',expected.body_md5,observed.body_md5),
      ('pg_get_functiondef MD5',expected.ddl_md5,observed.ddl_md5)
    ) AS v(attributo,atteso,osservato) WHERE atteso IS DISTINCT FROM osservato LOOP
      RAISE EXCEPTION 'Funzione %: %, atteso %, osservato %',
        expected.identity,difference.attributo,difference.atteso,difference.osservato USING ERRCODE='P2113';
    END LOOP;
  END LOOP;
END;
$previous$;

CREATE TEMP TABLE attesi_catalogo_prima (voce text NOT NULL) ON COMMIT DROP;
DO $pre$
DECLARE corpo text;
DECLARE terminale constant text := 'SELECT md5(coalesce(string_agg(x,'''' ORDER BY x COLLATE "C"),'''')) FROM objects';
BEGIN
  SELECT prosrc INTO STRICT corpo FROM pg_proc
    WHERE oid='artecna_distruzione.hard_delete_catalog()'::regprocedure;
  IF session_user <> 'postgres' OR current_user <> 'postgres'
    OR md5(corpo) <> 'e653969ab1719f575d07038a3cbdd143'
    OR (SELECT count(*) FROM artecna_distruzione.hard_delete_catalog_expected) <> 1
    OR (SELECT signature FROM artecna_distruzione.hard_delete_catalog_expected)
       IS DISTINCT FROM artecna_distruzione.hard_delete_catalog() THEN
    RAISE EXCEPTION 'Contratto Hard Delete V3 divergente' USING ERRCODE='P2113';
  END IF;
  corpo := btrim(corpo,E' \r\n\t');
  IF right(corpo,length(terminale)) <> terminale THEN
    RAISE EXCEPTION 'Aggregazione catalogo inattesa' USING ERRCODE='P2113';
  END IF;
  EXECUTE 'INSERT INTO pg_temp.attesi_catalogo_prima ' ||
    left(corpo,length(corpo)-length(terminale)) || 'SELECT x FROM objects';
END;
$pre$;

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

CREATE FUNCTION public.leggi_rapportini_attesi(p_cantiere uuid,p_da date,p_a date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE v_config jsonb;
BEGIN
  IF artecna_guardie.utente_puo_modificare_cantiere(
    artecna_guardie.utente_jwt_corrente(),p_cantiere) IS NOT TRUE THEN
    RAISE EXCEPTION 'Cantiere non autorizzato' USING ERRCODE = '42501';
  END IF;
  IF p_da IS NULL OR p_a IS NULL OR NOT isfinite(p_da) OR NOT isfinite(p_a)
      OR p_a < p_da OR p_a - p_da > 366 THEN
    RAISE EXCEPTION 'Intervallo non valido' USING ERRCODE = '22023';
  END IF;
  SELECT to_jsonb(c) - 'aggiornato_da' - 'aggiornato_at' INTO v_config
    FROM artecna_rapportini.configurazione_attesi c WHERE c.cantiere_id=p_cantiere;
  RETURN jsonb_build_object(
    'configurazione', coalesce(v_config,
      '{"sospeso":false,"sospeso_fino_al":null,"rilevanza_giorni":7,"revisione":0}'::jsonb),
    'avvisi_attivi', artecna_rapportini.avvisi_attesi_attivi(p_cantiere,now()),
    'giornate', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,'giorno_lavoro',a.giorno_lavoro,'termine_at',a.termine_at,
      'rilevante_fino_at',a.rilevante_fino_at,'revisione',a.revisione,
      'esito',artecna_rapportini.esito_atteso(a.cantiere_id,a.giorno_lavoro))
      ORDER BY a.giorno_lavoro),'[]'::jsonb)
      FROM artecna_rapportini.attesi a WHERE a.cantiere_id=p_cantiere
      AND a.giorno_lavoro BETWEEN p_da AND p_a)
  );
END;
$$;

CREATE FUNCTION public.modifica_rapportino_atteso(
  p_cantiere uuid,p_id uuid,p_revisione bigint,p_ora time,p_rilevanza smallint
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  v_utente uuid := artecna_rapportini.blocca_cantiere_attesi(p_cantiere);
  v_atteso artecna_rapportini.attesi;
BEGIN
  SELECT * INTO v_atteso FROM artecna_rapportini.attesi
    WHERE id=p_id AND cantiere_id=p_cantiere FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Giornata pianificata non disponibile' USING ERRCODE = 'PR409';
  END IF;
  IF v_atteso.revisione IS DISTINCT FROM p_revisione THEN
    RAISE EXCEPTION 'Giornata modificata: rileggere prima di salvare' USING ERRCODE = 'PR412';
  END IF;
  IF p_ora IS NULL OR p_ora >= time '24:00'
      OR (p_rilevanza IS NOT NULL AND p_rilevanza NOT IN (3,7,15,30)) THEN
    RAISE EXCEPTION 'Ora o rilevanza non valida' USING ERRCODE = '22023';
  END IF;
  UPDATE artecna_rapportini.attesi SET
    termine_at=artecna_rapportini.istante_attesi(v_atteso.giorno_lavoro + p_ora),
    rilevante_fino_at=artecna_rapportini.istante_attesi((v_atteso.giorno_lavoro + p_rilevanza) + p_ora),
    revisione=v_atteso.revisione+1, aggiornato_at=now(), aggiornato_da=v_utente
    WHERE id=v_atteso.id;
  RETURN v_atteso.revisione+1;
END;
$$;

REVOKE ALL ON FUNCTION public.leggi_rapportini_attesi(uuid,date,date),
  public.modifica_rapportino_atteso(uuid,uuid,bigint,time,smallint)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leggi_rapportini_attesi(uuid,date,date),
  public.modifica_rapportino_atteso(uuid,uuid,bigint,time,smallint) TO authenticated;


-- Lock order is root, obligations, events, then notifications. The producer
-- must acquire a root row lock before reading obligations for publication.
CREATE FUNCTION artecna_rapportini.manifest_attesi(p_cantiere uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  WITH obblighi AS (
    SELECT id FROM artecna_rapportini.attesi WHERE cantiere_id=p_cantiere
  ), eventi AS (
    SELECT e.id FROM artecna_notifiche.evento_notificabile e JOIN obblighi a ON a.id=e.record_id
    WHERE e.modulo='rapportini' AND e.tipo_record='rapportino_atteso'
  )
  SELECT jsonb_build_object(
    'artecna_rapportini.configurazione_attesi', (SELECT coalesce(jsonb_agg(jsonb_build_object('cantiere_id',cantiere_id)),'[]')
      FROM artecna_rapportini.configurazione_attesi WHERE cantiere_id=p_cantiere),
    'artecna_rapportini.attesi', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id) ORDER BY id),'[]') FROM obblighi),
    'artecna_notifiche.evento_notificabile', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id) ORDER BY id),'[]') FROM eventi),
    'artecna_notifiche.notifica', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',n.id) ORDER BY n.id),'[]')
      FROM artecna_notifiche.notifica n JOIN eventi e ON e.id=n.evento_id))
$$;

CREATE FUNCTION artecna_rapportini.elimina_attesi_manifest(p_manifest jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE
  v_tabella text;
  v_chiave text;
  v_righe bigint;
BEGIN
  FOREACH v_tabella IN ARRAY ARRAY['artecna_notifiche.notifica','artecna_notifiche.evento_notificabile',
    'artecna_rapportini.attesi','artecna_rapportini.configurazione_attesi'] LOOP
    IF jsonb_typeof(p_manifest->v_tabella) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Manifest attesi incompleto' USING ERRCODE='P2114';
    END IF;
    v_chiave := CASE WHEN v_tabella='artecna_rapportini.configurazione_attesi' THEN 'cantiere_id' ELSE 'id' END;
    EXECUTE format('DELETE FROM %s t USING jsonb_array_elements($1) k WHERE t.%I=(k->>%L)::uuid',
      v_tabella::regclass,v_chiave,v_chiave) USING p_manifest->v_tabella;
    GET DIAGNOSTICS v_righe=ROW_COUNT;
    IF v_righe <> jsonb_array_length(p_manifest->v_tabella) THEN
      RAISE EXCEPTION 'Cancellazione attesi divergente per %',v_tabella USING ERRCODE='P2114';
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION artecna_rapportini.manifest_attesi(uuid),
  artecna_rapportini.elimina_attesi_manifest(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION artecna_rapportini.manifest_attesi(uuid),
  artecna_rapportini.elimina_attesi_manifest(jsonb) TO artecna_cantieri_delete_rpc;
-- The existing invoker-side FK verification needs SELECT on both new relations.
GRANT SELECT ON artecna_rapportini.attesi,artecna_rapportini.configurazione_attesi TO artecna_cantieri_delete_rpc;
CREATE POLICY attesi_hard_delete_read ON artecna_rapportini.attesi
  FOR SELECT TO artecna_cantieri_delete_rpc USING (true);
CREATE POLICY configurazione_attesi_hard_delete_read ON artecna_rapportini.configurazione_attesi
  FOR SELECT TO artecna_cantieri_delete_rpc USING (true);

GRANT artecna_cantieri_delete_rpc TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY postgres;
DO $acl$ BEGIN IF has_schema_privilege('artecna_cantieri_delete_rpc','public','CREATE') THEN RAISE EXCEPTION 'CREATE preesistente inatteso'; END IF; END $acl$;
GRANT CREATE ON SCHEMA public TO artecna_cantieri_delete_rpc;
DO $extend$
DECLARE
  v_fun regprocedure;
  v_old text;
  v_new text;
  v_anchor text;
  v_ddl text;
  v_result text;
  v_args text;
BEGIN
  v_fun := 'artecna_distruzione.hard_delete_targets(uuid)'::regprocedure;
  SELECT prosrc INTO STRICT v_old FROM pg_proc WHERE oid=v_fun;
  SELECT pg_get_functiondef(v_fun),pg_get_function_result(v_fun),pg_get_function_identity_arguments(v_fun)
    INTO v_ddl,v_result,v_args;
  IF v_args IS DISTINCT FROM 'cid uuid' OR v_result IS DISTINCT FROM 'jsonb'
    OR NOT EXISTS (SELECT FROM pg_proc p WHERE p.oid=v_fun
      AND md5(p.prosrc)='e92d14170d0e5f13babd5efa6f04a939'
      AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='sql')
      AND p.provolatile='s' AND p.proparallel='u' AND NOT p.proisstrict AND NOT p.proretset
      AND p.pronargdefaults=0 AND p.prosecdef AND NOT p.proleakproof
      AND p.proowner='postgres'::regrole AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']
      AND p.proacl::text='{postgres=X/postgres,artecna_cantieri_delete_rpc=X/postgres}') THEN
    RAISE EXCEPTION 'Contratto precedente manifest V3 inatteso' USING ERRCODE='P2113';
  END IF;
  v_anchor := 'FROM known ';
  IF strpos(v_old,v_anchor)=0 OR strpos(v_old,'artecna_rapportini.manifest_attesi')>0 THEN
    RAISE EXCEPTION 'Manifest V3 inatteso' USING ERRCODE='P2113';
  END IF;
  v_new := v_old;
  -- Append to the final projection without changing its pre-existing witnesses.
  v_anchor := 'SELECT artecna_distruzione.hard_delete_shared_scope';
  v_new := replace(v_new,v_anchor,'SELECT artecna_rapportini.manifest_attesi(cid) || artecna_distruzione.hard_delete_shared_scope');
  IF v_new=v_old THEN RAISE EXCEPTION 'Proiezione manifest V3 inattesa' USING ERRCODE='P2113'; END IF;
  UPDATE pg_temp.attesi_catalogo_prima
  SET voce=replace(voce, ':'||md5(v_old)||':', ':'||md5(v_new)||':')
  WHERE voce LIKE 'p:artecna_distruzione.hard_delete_targets(uuid):'||md5(v_old)||':%';
  IF NOT FOUND THEN RAISE EXCEPTION 'Identita manifest V3 inattesa' USING ERRCODE='P2113'; END IF;
  v_ddl := replace(v_ddl,v_old,v_new);
  EXECUTE v_ddl;
  IF pg_get_functiondef(v_fun) IS DISTINCT FROM v_ddl THEN
    RAISE EXCEPTION 'Nuova definizione manifest V3 inattesa' USING ERRCODE='P2113';
  END IF;

  v_fun := 'public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure;
  SELECT prosrc INTO STRICT v_old FROM pg_proc WHERE oid=v_fun;
  SELECT pg_get_functiondef(v_fun),pg_get_function_result(v_fun),pg_get_function_identity_arguments(v_fun)
    INTO v_ddl,v_result,v_args;
  IF v_args IS DISTINCT FROM 'p_cantiere_id uuid, p_conferma text'
    OR v_result IS DISTINCT FROM 'TABLE(cantiere_id uuid, eliminato boolean, storage_nuovi bigint, conteggi jsonb)'
    OR NOT EXISTS (SELECT FROM pg_proc p WHERE p.oid=v_fun
      AND md5(p.prosrc)='9262aba322f48c6b456c78570e2cbb3a'
      AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')
      AND p.provolatile='v' AND p.proparallel='u' AND NOT p.proisstrict AND p.proretset
      AND p.pronargdefaults=0 AND p.prosecdef AND NOT p.proleakproof
      AND p.proowner='artecna_cantieri_delete_rpc'::regrole
      AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']
      AND p.proacl::text='{artecna_cantieri_delete_rpc=X/artecna_cantieri_delete_rpc,authenticated=X/artecna_cantieri_delete_rpc}') THEN
    RAISE EXCEPTION 'Contratto precedente cancellazione V3 inatteso' USING ERRCODE='P2113';
  END IF;
  v_anchor := 'DELETE FROM public.cantieri WHERE id=cid;';
  IF (length(v_old)-length(replace(v_old,v_anchor,'')))/length(v_anchor)<>1 THEN
    RAISE EXCEPTION 'Cancellazione root V3 inattesa' USING ERRCODE='P2113';
  END IF;
  v_new := replace(v_old,v_anchor,'PERFORM artecna_rapportini.elimina_attesi_manifest(targets);' || chr(10) || v_anchor);
  UPDATE pg_temp.attesi_catalogo_prima
  SET voce=replace(voce, ':'||md5(v_old)||':', ':'||md5(v_new)||':')
  WHERE voce LIKE 'p:public.elimina_cantiere_definitivamente(uuid,text):'||md5(v_old)||':%';
  IF NOT FOUND THEN RAISE EXCEPTION 'Identita cancellazione V3 inattesa' USING ERRCODE='P2113'; END IF;
  v_new := replace(pg_get_functiondef(v_fun),v_old,v_new);
  SET LOCAL ROLE artecna_cantieri_delete_rpc;
  EXECUTE v_new;
  RESET ROLE;
  IF pg_get_functiondef(v_fun) IS DISTINCT FROM v_new THEN
    RAISE EXCEPTION 'Nuova definizione cancellazione V3 inattesa' USING ERRCODE='P2113';
  END IF;
END;
$extend$;
REVOKE CREATE ON SCHEMA public FROM artecna_cantieri_delete_rpc;
REVOKE artecna_cantieri_delete_rpc FROM postgres GRANTED BY postgres RESTRICT;

-- Declared PostgreSQL 17.6 catalog entries for the two new relations.
INSERT INTO pg_temp.attesi_catalogo_prima VALUES
  ('c:artecna_rapportini.attesi:aggiornato_at:timestamp with time zone:true'),
  ('c:artecna_rapportini.attesi:aggiornato_da:uuid:true'),
  ('c:artecna_rapportini.attesi:cantiere_id:uuid:true'),
  ('c:artecna_rapportini.attesi:creato_at:timestamp with time zone:true'),
  ('c:artecna_rapportini.attesi:creato_da:uuid:true'),
  ('c:artecna_rapportini.attesi:giorno_lavoro:date:true'),
  ('c:artecna_rapportini.attesi:id:uuid:true'),
  ('c:artecna_rapportini.attesi:revisione:bigint:true'),
  ('c:artecna_rapportini.attesi:rilevante_fino_at:timestamp with time zone:false'),
  ('c:artecna_rapportini.attesi:termine_at:timestamp with time zone:true'),
  ('c:artecna_rapportini.configurazione_attesi:aggiornato_at:timestamp with time zone:true'),
  ('c:artecna_rapportini.configurazione_attesi:aggiornato_da:uuid:true'),
  ('c:artecna_rapportini.configurazione_attesi:cantiere_id:uuid:true'),
  ('c:artecna_rapportini.configurazione_attesi:revisione:bigint:true'),
  ('c:artecna_rapportini.configurazione_attesi:rilevanza_giorni:smallint:false'),
  ('c:artecna_rapportini.configurazione_attesi:sospeso:boolean:true'),
  ('c:artecna_rapportini.configurazione_attesi:sospeso_fino_al:date:false'),
  ('f:artecna_rapportini.attesi:attesi_cantiere_id_fkey:FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id):true'),
  ('f:artecna_rapportini.attesi:attesi_cantiere_id_giorno_lavoro_key:UNIQUE (cantiere_id, giorno_lavoro):true'),
  ('f:artecna_rapportini.attesi:attesi_check1:CHECK ((termine_at AT TIME ZONE ''Europe/Rome''::text)::date = giorno_lavoro):true'),
  ('f:artecna_rapportini.attesi:attesi_check:CHECK (isfinite(rilevante_fino_at) AND rilevante_fino_at > termine_at):true'),
  ('f:artecna_rapportini.attesi:attesi_giorno_lavoro_check:CHECK (isfinite(giorno_lavoro)):true'),
  ('f:artecna_rapportini.attesi:attesi_pkey:PRIMARY KEY (id):true'),
  ('f:artecna_rapportini.attesi:attesi_revisione_check:CHECK (revisione > 0):true'),
  ('f:artecna_rapportini.attesi:attesi_termine_at_check:CHECK (isfinite(termine_at)):true'),
  ('f:artecna_rapportini.configurazione_attesi:configurazione_attesi_cantiere_id_fkey:FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id):true'),
  ('f:artecna_rapportini.configurazione_attesi:configurazione_attesi_check:CHECK (sospeso OR sospeso_fino_al IS NULL):true'),
  ('f:artecna_rapportini.configurazione_attesi:configurazione_attesi_pkey:PRIMARY KEY (cantiere_id):true'),
  ('f:artecna_rapportini.configurazione_attesi:configurazione_attesi_revisione_check:CHECK (revisione > 0):true'),
  ('f:artecna_rapportini.configurazione_attesi:configurazione_attesi_rilevanza_giorni_check:CHECK (rilevanza_giorni = ANY (ARRAY[3, 7, 15, 30])):true'),
  ('f:artecna_rapportini.configurazione_attesi:configurazione_attesi_sospeso_fino_al_check:CHECK (isfinite(sospeso_fino_al)):true'),
  ('r:artecna_rapportini.attesi:postgres:{postgres=arwdDxtm/postgres,artecna_cantieri_delete_rpc=r/postgres}:true:false'),
  ('r:artecna_rapportini.configurazione_attesi:postgres:{postgres=arwdDxtm/postgres,artecna_cantieri_delete_rpc=r/postgres}:true:false');

CREATE TEMP TABLE attesi_catalogo_dopo (voce text NOT NULL) ON COMMIT DROP;
DO $verify$
DECLARE
  corpo text;
  terminale constant text := 'SELECT md5(coalesce(string_agg(x,'''' ORDER BY x COLLATE "C"),'''')) FROM objects';
BEGIN
  SELECT btrim(prosrc,E' \r\n\t') INTO STRICT corpo FROM pg_proc
    WHERE oid='artecna_distruzione.hard_delete_catalog()'::regprocedure;
  IF right(corpo,length(terminale)) <> terminale THEN
    RAISE EXCEPTION 'Aggregazione catalogo inattesa' USING ERRCODE='P2113';
  END IF;
  EXECUTE 'INSERT INTO pg_temp.attesi_catalogo_dopo ' ||
    left(corpo,length(corpo)-length(terminale)) || 'SELECT x FROM objects';

  IF EXISTS (
    (SELECT voce FROM pg_temp.attesi_catalogo_prima EXCEPT ALL SELECT voce FROM pg_temp.attesi_catalogo_dopo)
    UNION ALL
    (SELECT voce FROM pg_temp.attesi_catalogo_dopo EXCEPT ALL SELECT voce FROM pg_temp.attesi_catalogo_prima)
  ) THEN
    RAISE EXCEPTION 'Delta catalogo Rapportini attesi inatteso' USING ERRCODE='P2113';
  END IF;
  IF EXISTS (
    WITH expected(rel,col,expr) AS (VALUES
      ('attesi','id','gen_random_uuid()'),
      ('attesi','revisione','1'),
      ('attesi','creato_at','now()'),
      ('attesi','aggiornato_at','now()'),
      ('configurazione_attesi','sospeso','false'),
      ('configurazione_attesi','rilevanza_giorni','7'),
      ('configurazione_attesi','revisione','1'),
      ('configurazione_attesi','aggiornato_at','now()')
    ), actual AS (
      SELECT c.relname::text,a.attname::text,pg_get_expr(d.adbin,d.adrelid)
      FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid
      JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
      WHERE c.oid IN ('artecna_rapportini.attesi'::regclass,'artecna_rapportini.configurazione_attesi'::regclass)
    )
    (SELECT * FROM expected EXCEPT ALL SELECT * FROM actual)
    UNION ALL (SELECT * FROM actual EXCEPT ALL SELECT * FROM expected)
  ) THEN
    RAISE EXCEPTION 'Default Rapportini attesi divergenti' USING ERRCODE='P2113';
  END IF;

  IF EXISTS (
    WITH expected(rel,nome,def,unico,valido,pronto) AS (VALUES
      ('attesi','attesi_pkey','CREATE UNIQUE INDEX attesi_pkey ON artecna_rapportini.attesi USING btree (id)',true,true,true),
      ('attesi','attesi_cantiere_id_giorno_lavoro_key','CREATE UNIQUE INDEX attesi_cantiere_id_giorno_lavoro_key ON artecna_rapportini.attesi USING btree (cantiere_id, giorno_lavoro)',true,true,true),
      ('configurazione_attesi','configurazione_attesi_pkey','CREATE UNIQUE INDEX configurazione_attesi_pkey ON artecna_rapportini.configurazione_attesi USING btree (cantiere_id)',true,true,true)
    ), actual AS (
      SELECT t.relname::text,i.relname::text,pg_get_indexdef(i.oid),x.indisunique,x.indisvalid,x.indisready
      FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_class t ON t.oid=x.indrelid
      WHERE t.oid IN ('artecna_rapportini.attesi'::regclass,'artecna_rapportini.configurazione_attesi'::regclass)
    )
    (SELECT * FROM expected EXCEPT ALL SELECT * FROM actual)
    UNION ALL (SELECT * FROM actual EXCEPT ALL SELECT * FROM expected)
  ) THEN
    RAISE EXCEPTION 'Indici Rapportini attesi divergenti' USING ERRCODE='P2113';
  END IF;

  UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog();
END;
$verify$;

COMMIT;