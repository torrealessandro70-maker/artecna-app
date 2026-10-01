BEGIN;
-- Solo manifest e outbox privata; nessuna cancellazione applicativa o Storage API.
-- Identita UUID e path registrati: mai nomi legacy, URL o prefissi inferiti.
-- Le righe outbox sono storiche: nessuna FK verso cantieri o record sorgenti.
-- V1 non ha worker: pending/failed/completed sono predisposti, non consumati.
-- Il futuro worker dovra gestire retry e verificare eventuali riferimenti condivisi
-- prima della rimozione fisica; un riferimento non prova esclusivita del file.
DO $migration$
DECLARE
  r record;
  p pg_catalog.pg_proc%ROWTYPE;
  ns_prima jsonb;
  contesto_prima jsonb;
  funzioni_prima jsonb;
  trigger_prima jsonb;
  v_colonne smallint[];
  v_config_atteso text[];
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres'
     OR current_setting('server_version_num')::integer / 10000 <> 17 THEN
    RAISE EXCEPTION 'Installazione prevista come postgres su PostgreSQL 17';
  END IF;
  SELECT to_jsonb(n) INTO ns_prima FROM pg_catalog.pg_namespace n WHERE n.nspname='artecna_distruzione';
  IF ns_prima IS NULL OR (ns_prima->>'nspowner')::oid <> 'postgres'::regrole THEN
    RAISE EXCEPTION 'Schema privato assente o owner divergente';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_namespace n,
    LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
    WHERE n.nspname='artecna_distruzione' AND (a.grantee NOT IN ('postgres'::regrole,'artecna_cantieri_rpc'::regrole)
      OR (a.grantee='artecna_cantieri_rpc'::regrole AND (a.privilege_type<>'USAGE' OR a.is_grantable))))
     OR NOT has_schema_privilege('artecna_cantieri_rpc','artecna_distruzione','USAGE')
     OR pg_has_role('authenticated','artecna_cantieri_rpc','MEMBER')
     OR pg_has_role('anon','artecna_cantieri_rpc','MEMBER') THEN
    RAISE EXCEPTION 'ACL schema/ruolo tecnico divergenti';
  END IF;
  SELECT to_jsonb(c) INTO contesto_prima FROM pg_catalog.pg_class c
    WHERE c.oid=to_regclass('artecna_distruzione.contesto') AND c.relkind='r' AND c.relowner='postgres'::regrole;
  IF contesto_prima IS NULL OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c,
    LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    WHERE c.oid='artecna_distruzione.contesto'::regclass AND a.grantee<>'postgres'::regrole) THEN
    RAISE EXCEPTION 'Contesto assente o ACL/owner divergenti';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('transazione','xid8'),('backend','int4'),('cantiere_id','uuid'),
    ('user_id','uuid'),('ruolo','name'),('created_at','timestamptz')) AS m(colonna,tipo)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='artecna_distruzione.contesto'::regclass
      AND attname=r.colonna AND attnum>0 AND NOT attisdropped AND attnotnull
      AND atttypid=to_regtype('pg_catalog.'||r.tipo)) THEN RAISE EXCEPTION 'Colonna contesto % divergente',r.colonna; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint k WHERE k.conrelid='artecna_distruzione.contesto'::regclass
    AND k.contype='p' AND k.convalidated AND k.conkey=ARRAY[
      (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=k.conrelid AND attname='transazione'),
      (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=k.conrelid AND attname='backend')]::smallint[]) THEN
    RAISE EXCEPTION 'Chiave contesto divergente';
  END IF;
  FOR r IN SELECT * FROM (VALUES
('artecna_distruzione.inizia_contesto(uuid)','void',$helper0$
  DECLARE u uuid := artecna_guardie.utente_jwt_corrente();
  BEGIN
    IF u IS NULL OR p_cantiere IS NULL THEN RAISE EXCEPTION 'Identita owner obbligatoria'; END IF;
    PERFORM 1 FROM public.cantieri WHERE id=p_cantiere FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cantiere assente'; END IF;
    PERFORM 1 FROM public.utenti_cantiere WHERE cantiere_id=p_cantiere AND user_id=u AND ruolo='owner' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Owner non autorizzato'; END IF;
    -- Cleanup di residui ormai inutilizzabili dello stesso backend. Nessun dato applicativo.
    DELETE FROM artecna_distruzione.contesto WHERE backend=pg_backend_pid() AND transazione<>pg_current_xact_id();
    INSERT INTO artecna_distruzione.contesto(transazione,backend,cantiere_id,user_id,ruolo)
      VALUES(pg_current_xact_id(),pg_backend_pid(),p_cantiere,u,'artecna_cantieri_rpc');
    -- La PK vieta un secondo target nella stessa transazione/backend.
  END;
  $helper0$),
('artecna_distruzione.contesto_valido(uuid)','bool',$helper1$
    SELECT EXISTS (SELECT 1 FROM artecna_distruzione.contesto c
      WHERE c.transazione=pg_current_xact_id_if_assigned() AND c.backend=pg_backend_pid()
        AND c.cantiere_id=p_cantiere AND c.ruolo='artecna_cantieri_rpc'
        AND c.user_id=artecna_guardie.utente_jwt_corrente()
        AND EXISTS (SELECT 1 FROM public.utenti_cantiere u
          WHERE u.cantiere_id=c.cantiere_id AND u.user_id=c.user_id AND u.ruolo='owner'));
  $helper1$),
('artecna_distruzione.contesto_variante_valido(uuid)','bool',$helper2$
  DECLARE c uuid;
  BEGIN
    SELECT cantiere_id INTO c FROM public.varianti_cantiere WHERE id=p_variante FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
    RETURN artecna_distruzione.contesto_valido(c);
  END;
  $helper2$),
('artecna_distruzione.termina_contesto()','void',$helper3$
    DELETE FROM artecna_distruzione.contesto
      WHERE transazione=pg_current_xact_id_if_assigned() AND backend=pg_backend_pid()
        AND user_id=artecna_guardie.utente_jwt_corrente();
  $helper3$)
  ) AS m(firma,tipo,corpo)
  LOOP
    SELECT f.* INTO p FROM pg_catalog.pg_proc f WHERE f.oid=to_regprocedure(r.firma);
    IF NOT FOUND THEN RAISE EXCEPTION 'Helper contesto % assente',r.firma; END IF;
    IF strpos(replace(p.prosrc,chr(13)||chr(10),''),chr(13))>0
       OR (strpos(p.prosrc,chr(13)||chr(10))>0
           AND strpos(replace(p.prosrc,chr(13)||chr(10),''),chr(10))>0) THEN
      RAISE EXCEPTION 'Newline installati misti o CR isolati';
    END IF;
    IF p.proowner<>'postgres'::regrole OR p.prokind<>'f' OR NOT p.prosecdef OR p.provolatile<>'v'
       OR p.prorettype<>to_regtype('pg_catalog.'||r.tipo)
       OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp','row_security=off']::text[]
       OR replace(p.prosrc,chr(13)||chr(10),chr(10)) IS DISTINCT FROM replace(r.corpo,chr(13)||chr(10),chr(10))
       OR NOT has_function_privilege('artecna_cantieri_rpc',p.oid,'EXECUTE')
       OR EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
         WHERE a.grantee NOT IN ('postgres'::regrole,'artecna_cantieri_rpc'::regrole)
            OR a.privilege_type<>'EXECUTE' OR a.is_grantable) THEN
      RAISE EXCEPTION 'Helper contesto % divergente',r.firma;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
('proteggi_contrattuale_cantiere',true,$guard0$
BEGIN

  IF OLD.preventivo_contrattuale_id IS NOT NULL
     AND NEW.preventivo_contrattuale_id IS NULL
     AND (to_jsonb(NEW) - 'preventivo_contrattuale_id')
         IS NOT DISTINCT FROM (to_jsonb(OLD) - 'preventivo_contrattuale_id')
     AND artecna_distruzione.contesto_valido(OLD.id) THEN
    RETURN NEW;
  END IF;
  IF OLD.preventivo_contrattuale_id
       IS DISTINCT FROM NEW.preventivo_contrattuale_id
  THEN
    IF artecna_guardie.base_congelata(
      OLD.preventivo_contrattuale_id,
      OLD.id
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P2001',
        MESSAGE =
          'Il preventivo contrattuale è congelato: esistono varianti approvate. Non è possibile sostituirlo o rimuoverlo.';
    END IF;
  END IF;

  RETURN NEW;
END;
$guard0$),
('proteggi_preventivo_base',true,$guard1$
BEGIN

  IF TG_OP = 'DELETE' THEN
    IF artecna_distruzione.contesto_valido(OLD.cantiere_id) THEN
      RETURN OLD;
    END IF;
  END IF;
  IF artecna_guardie.base_congelata(OLD.id) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2001',
      MESSAGE =
        'Questo preventivo costituisce una base contrattuale congelata da varianti approvate. Modifica ed eliminazione non consentite.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$guard1$),
('proteggi_lavorazione_base',true,$guard2$
BEGIN

  IF TG_OP = 'DELETE' THEN
    IF artecna_distruzione.contesto_valido(OLD.cantiere_id) THEN
      RETURN OLD;
    END IF;
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF artecna_guardie.base_congelata(OLD.preventivo_id) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P2001',
        MESSAGE =
          'La lavorazione appartiene a una base contrattuale congelata. Modifica, spostamento ed eliminazione non consentiti.';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF artecna_guardie.base_congelata(NEW.preventivo_id) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P2001',
        MESSAGE =
          'Non è possibile aggiungere o spostare lavorazioni in una base contrattuale congelata.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$guard2$),
('proteggi_variante_testata',false,$guard3$
DECLARE
    percorso_interno boolean :=
        current_user = 'artecna_varianti_rpc';
BEGIN

  IF TG_OP = 'DELETE' AND current_user = 'artecna_cantieri_rpc' THEN
    IF artecna_distruzione.contesto_valido(OLD.cantiere_id) THEN
      RETURN OLD;
    END IF;
  END IF;
    IF TG_OP = 'INSERT' THEN
        IF NEW.stato IS DISTINCT FROM 'bozza'
           OR NEW.numero IS NOT NULL
           OR NEW.importo_delta_approvato IS NOT NULL
           OR NEW.approvata_at IS NOT NULL
           OR NEW.riferimento_approvazione IS NOT NULL THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2002',
                MESSAGE =
                    'Una variante deve nascere in bozza, senza numero o metadati di approvazione';
        END IF;

        RETURN NEW;
    END IF;

    IF OLD.stato IN ('approvata', 'rifiutata', 'annullata') THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2002',
            MESSAGE =
                'La variante storica non può essere modificata o eliminata';
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.stato IS DISTINCT FROM 'bozza' THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2002',
                MESSAGE = 'È eliminabile soltanto una variante in bozza';
        END IF;

        -- Le FK RESTRICT restano responsabili dei riferimenti presenti.
        RETURN OLD;
    END IF;

    IF percorso_interno THEN
        IF NOT (
            (OLD.stato = 'bozza'
             AND NEW.stato IN ('proposta', 'annullata'))
            OR
            (OLD.stato = 'proposta'
             AND NEW.stato IN ('approvata', 'rifiutata', 'annullata'))
        ) THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2002',
                MESSAGE = 'Transizione interna Variante non consentita';
        END IF;

        IF (
            to_jsonb(NEW) - ARRAY[
                'stato', 'numero', 'importo_delta_approvato',
                'approvata_at', 'riferimento_approvazione', 'updated_at'
            ]::text[]
        ) IS DISTINCT FROM (
            to_jsonb(OLD) - ARRAY[
                'stato', 'numero', 'importo_delta_approvato',
                'approvata_at', 'riferimento_approvazione', 'updated_at'
            ]::text[]
        ) THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2002',
                MESSAGE =
                    'La transizione interna non può modificare il contenuto della variante';
        END IF;

        -- Il numero può essere assegnato solo durante la proposta.
        IF NOT (OLD.stato = 'bozza' AND NEW.stato = 'proposta')
           AND NEW.numero IS DISTINCT FROM OLD.numero THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2002',
                MESSAGE =
                    'Il numero Variante è assegnabile soltanto durante la proposta';
        END IF;

        -- I CHECK strutturali esistenti validano numero e metadati.
        RETURN NEW;
    END IF;

    IF OLD.stato IS DISTINCT FROM 'bozza' THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2002',
            MESSAGE =
                'La variante proposta non è modificabile tramite CRUD ordinario';
    END IF;

    IF (
        to_jsonb(NEW) - ARRAY[
            'titolo', 'descrizione', 'data_variante', 'updated_at'
        ]::text[]
    ) IS DISTINCT FROM (
        to_jsonb(OLD) - ARRAY[
            'titolo', 'descrizione', 'data_variante', 'updated_at'
        ]::text[]
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2002',
            MESSAGE =
                'In bozza sono modificabili soltanto titolo, descrizione e data';
    END IF;

    RETURN NEW;
END;
$guard3$),
('proteggi_variante_figlio',false,$guard4$
DECLARE
    proprietari uuid[];
    proprietario uuid;
    stato_proprietario text;
BEGIN

  IF TG_OP = 'DELETE' AND current_user = 'artecna_cantieri_rpc'
     AND TG_TABLE_SCHEMA = 'public'
     AND TG_TABLE_NAME IN ('variante_lavorazioni', 'variante_documenti') THEN
    IF artecna_distruzione.contesto_variante_valido(OLD.variante_id) THEN
      RETURN OLD;
    END IF;
  END IF;
    IF TG_OP = 'INSERT' THEN
        proprietari := ARRAY[NEW.variante_id];
    ELSIF TG_OP = 'DELETE' THEN
        proprietari := ARRAY[OLD.variante_id];
    ELSE
        proprietari := ARRAY[OLD.variante_id, NEW.variante_id];
    END IF;

    IF array_position(proprietari, NULL::uuid) IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2002',
            MESSAGE = 'La variante proprietaria è obbligatoria';
    END IF;

    -- Ordine deterministico quando vengono coinvolte due testate.
    FOR proprietario IN
        SELECT DISTINCT x.id
        FROM unnest(proprietari) AS x(id)
        ORDER BY x.id
    LOOP
        SELECT v.stato
        INTO stato_proprietario
        FROM public.varianti_cantiere v
        WHERE v.id = proprietario
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2002',
                MESSAGE =
                    'Variante proprietaria assente o non accessibile';
        END IF;

        IF stato_proprietario IS DISTINCT FROM 'bozza' THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2002',
                MESSAGE =
                    'Righe e documenti sono modificabili soltanto in bozza';
        END IF;
    END LOOP;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$guard4$)
  ) AS m(nome,definer,corpo)
  LOOP
    SELECT f.* INTO p FROM pg_catalog.pg_proc f WHERE f.oid=to_regprocedure(format('artecna_guardie.%I()',r.nome));
    IF NOT FOUND THEN RAISE EXCEPTION 'Guardia % assente',r.nome; END IF;
    IF strpos(replace(p.prosrc,chr(13)||chr(10),''),chr(13))>0
       OR (strpos(p.prosrc,chr(13)||chr(10))>0
           AND strpos(replace(p.prosrc,chr(13)||chr(10),''),chr(10))>0) THEN
      RAISE EXCEPTION 'Newline installati misti o CR isolati';
    END IF;
    IF r.definer THEN
      v_config_atteso := ARRAY['search_path=pg_catalog, pg_temp','row_security=off']::text[];
    ELSE
      v_config_atteso := ARRAY['search_path=pg_catalog, pg_temp']::text[];
    END IF;
    IF p.proowner<>'postgres'::regrole OR p.prokind<>'f' OR p.prorettype<>'trigger'::regtype
       OR p.prosecdef IS DISTINCT FROM r.definer
       OR replace(p.prosrc,chr(13)||chr(10),chr(10)) IS DISTINCT FROM replace(r.corpo,chr(13)||chr(10),chr(10))
       OR p.proconfig IS DISTINCT FROM v_config_atteso
       OR EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
         WHERE a.grantee<>'postgres'::regrole OR a.privilege_type<>'EXECUTE' OR a.is_grantable) THEN
      RAISE EXCEPTION 'Guardia % senza deroga certificata o attributi divergenti',r.nome;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
    ('cantieri','guardia_contrattuale_cantiere','proteggi_contrattuale_cantiere',19),
    ('preventivi_cantiere','guardia_preventivo_base','proteggi_preventivo_base',27),
    ('preventivo_lavorazioni','guardia_lavorazione_base','proteggi_lavorazione_base',31),
    ('varianti_cantiere','guardia_variante_testata','proteggi_variante_testata',31),
    ('variante_lavorazioni','guardia_variante_lavorazioni','proteggi_variante_figlio',31),
    ('variante_documenti','guardia_variante_documenti','proteggi_variante_figlio',31)
  ) AS m(tabella,nome,funzione,tipo)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid=to_regclass(format('public.%I',r.tabella))
      AND t.tgname=r.nome AND t.tgfoid=to_regprocedure(format('artecna_guardie.%I()',r.funzione))
      AND t.tgenabled='O' AND NOT t.tgisinternal AND t.tgtype=r.tipo) THEN RAISE EXCEPTION 'Trigger % divergente',r.nome; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.variante_sorgenti'::regclass AND NOT tgisinternal)
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc f JOIN pg_catalog.pg_namespace n ON n.oid=f.pronamespace
       WHERE n.nspname='public' AND f.proname='elimina_cantiere_definitivamente') THEN
    RAISE EXCEPTION 'Guardia sorgenti/RPC pubblica inattesa';
  END IF;
  IF to_regclass('artecna_distruzione.cleanup_storage') IS NOT NULL
     OR to_regprocedure('artecna_distruzione.manifest_cantiere(uuid)') IS NOT NULL
     OR to_regprocedure('artecna_distruzione.prepara_cleanup_storage(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Oggetti micro-step 3 gia presenti';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='preventivi' AND public=true) THEN
    RAISE EXCEPTION 'Bucket preventivi certificato assente o non pubblico';
  END IF;
  SELECT jsonb_agg(to_jsonb(f) ORDER BY f.oid) INTO funzioni_prima FROM pg_catalog.pg_proc f
    JOIN pg_catalog.pg_namespace n ON n.oid=f.pronamespace
    WHERE n.nspname='artecna_distruzione' OR (n.nspname='artecna_guardie' AND f.proname IN
      ('proteggi_contrattuale_cantiere','proteggi_preventivo_base','proteggi_lavorazione_base','proteggi_variante_testata','proteggi_variante_figlio'));
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) INTO trigger_prima FROM pg_catalog.pg_trigger t;

  EXECUTE $ddl$CREATE TABLE artecna_distruzione.cleanup_storage (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cantiere_id uuid NOT NULL,
    bucket text NOT NULL CHECK (btrim(bucket)<>''),
    path text NOT NULL CHECK (btrim(path)<>''),
    stato text NOT NULL DEFAULT 'pending' CHECK (stato IN ('pending','failed','completed')),
    tentativi integer NOT NULL DEFAULT 0 CHECK (tentativi>=0),
    ultimo_errore text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    completed_at timestamptz,
    CONSTRAINT cleanup_storage_identita UNIQUE (cantiere_id,bucket,path),
    CONSTRAINT cleanup_storage_completamento CHECK ((stato='completed')=(completed_at IS NOT NULL))
  )$ddl$;
  EXECUTE 'REVOKE ALL ON TABLE artecna_distruzione.cleanup_storage FROM PUBLIC, authenticated, anon, artecna_cantieri_rpc';
  EXECUTE 'REVOKE ALL ON SEQUENCE artecna_distruzione.cleanup_storage_id_seq FROM PUBLIC, authenticated, anon, artecna_cantieri_rpc';

  EXECUTE $ddl$CREATE FUNCTION artecna_distruzione.manifest_cantiere(p_cantiere uuid)
  RETURNS TABLE(entita text,quantita bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path TO pg_catalog, pg_temp SET row_security TO off
  AS $body$
  BEGIN
    IF NOT artecna_distruzione.contesto_valido(p_cantiere) THEN RAISE EXCEPTION 'Contesto cantiere non valido'; END IF;
    RETURN QUERY
    SELECT q.entita,q.quantita FROM (
SELECT 'rapportini'::text, count(*)::bigint FROM public.rapportini WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'foto_cantiere'::text, count(*)::bigint FROM public.foto_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'timbrature'::text, count(*)::bigint FROM public.timbrature WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'materiali_cantiere'::text, count(*)::bigint FROM public.materiali_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'attrezzi_cantiere'::text, count(*)::bigint FROM public.attrezzi_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'pagamenti_fornitori'::text, count(*)::bigint FROM public.pagamenti_fornitori WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'acconti_cantiere'::text, count(*)::bigint FROM public.acconti_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'fatture_emesse'::text, count(*)::bigint FROM public.fatture_emesse WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'fatture_fornitori_righe'::text, count(*)::bigint FROM public.fatture_fornitori_righe WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'incassi_non_fatturati'::text, count(*)::bigint FROM public.incassi_non_fatturati WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'sal_lavorazioni'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'preventivo_lavorazioni'::text, count(*)::bigint FROM public.preventivo_lavorazioni WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'preventivi_cantiere'::text, count(*)::bigint FROM public.preventivi_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'varianti_cantiere'::text, count(*)::bigint FROM public.varianti_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'utenti_cantiere'::text, count(*)::bigint FROM public.utenti_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'cantieri'::text, count(*)::bigint FROM public.cantieri WHERE id=p_cantiere
UNION ALL
SELECT 'variante_lavorazioni'::text, count(*)::bigint FROM public.variante_lavorazioni f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_documenti'::text, count(*)::bigint FROM public.variante_documenti f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_sorgenti'::text, count(*)::bigint FROM public.variante_sorgenti f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_lavorazioni_con_riferimento_variante'::text, count(*)::bigint FROM public.variante_lavorazioni f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere AND f.riferimento_variante_lavorazione_id IS NOT NULL
UNION ALL
SELECT 'sal_lavorazioni_con_source_lavorazione_id'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere AND source_lavorazione_id IS NOT NULL
UNION ALL
SELECT 'sal_lavorazioni_con_source_variante_lavorazione_id'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere AND source_variante_lavorazione_id IS NOT NULL
    ) AS q(entita,quantita) ORDER BY q.entita;
  END;
  $body$$ddl$;
  EXECUTE $ddl$CREATE FUNCTION artecna_distruzione.prepara_cleanup_storage(p_cantiere uuid)
  RETURNS bigint LANGUAGE plpgsql VOLATILE SECURITY DEFINER
  SET search_path TO pg_catalog, pg_temp SET row_security TO off
  AS $body$
  DECLARE v_inserite bigint;
  BEGIN
    IF NOT artecna_distruzione.contesto_valido(p_cantiere) THEN RAISE EXCEPTION 'Contesto cantiere non valido'; END IF;
    WITH riferimenti(path) AS (
      SELECT file_path::text FROM public.preventivi_cantiere WHERE cantiere_id=p_cantiere
      UNION ALL SELECT file_path::text FROM public.foto_cantiere WHERE cantiere_id=p_cantiere
      UNION ALL SELECT file_path::text FROM public.materiali_cantiere WHERE cantiere_id=p_cantiere
      UNION ALL SELECT file_path::text FROM public.attrezzi_cantiere WHERE cantiere_id=p_cantiere
      UNION ALL SELECT d.storage_path::text FROM public.variante_documenti d
        JOIN public.varianti_cantiere v ON v.id=d.variante_id WHERE v.cantiere_id=p_cantiere
    ), inserite AS (
      INSERT INTO artecna_distruzione.cleanup_storage(cantiere_id,bucket,path)
      SELECT DISTINCT p_cantiere,'preventivi',r.path FROM riferimenti r
        WHERE r.path IS NOT NULL AND btrim(r.path)<>''
      ON CONFLICT ON CONSTRAINT cleanup_storage_identita DO NOTHING
      RETURNING id
    ) SELECT count(*) INTO v_inserite FROM inserite;
    RETURN v_inserite;
  END;
  $body$$ddl$;
  EXECUTE 'REVOKE ALL ON FUNCTION artecna_distruzione.manifest_cantiere(uuid), artecna_distruzione.prepara_cleanup_storage(uuid) FROM PUBLIC, authenticated, anon';
  EXECUTE 'GRANT EXECUTE ON FUNCTION artecna_distruzione.manifest_cantiere(uuid), artecna_distruzione.prepara_cleanup_storage(uuid) TO artecna_cantieri_rpc';

  IF (SELECT to_jsonb(n) FROM pg_catalog.pg_namespace n WHERE n.nspname='artecna_distruzione') IS DISTINCT FROM ns_prima
     OR (SELECT to_jsonb(c) FROM pg_catalog.pg_class c WHERE c.oid='artecna_distruzione.contesto'::regclass) IS DISTINCT FROM contesto_prima THEN
    RAISE EXCEPTION 'Schema/contesto preesistente modificato';
  END IF;
  IF (SELECT jsonb_agg(to_jsonb(f) ORDER BY f.oid) FROM pg_catalog.pg_proc f
      WHERE f.oid IN (SELECT (value->>'oid')::oid FROM jsonb_array_elements(funzioni_prima))) IS DISTINCT FROM funzioni_prima
     OR (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_catalog.pg_trigger t) IS DISTINCT FROM trigger_prima THEN
    RAISE EXCEPTION 'Funzioni/guardie/trigger preesistenti modificati';
  END IF;
  SELECT array_agg(a.attnum ORDER BY x.pos) INTO v_colonne
    FROM unnest(ARRAY['cantiere_id','bucket','path']) WITH ORDINALITY x(nome,pos)
    JOIN pg_catalog.pg_attribute a ON a.attrelid='artecna_distruzione.cleanup_storage'::regclass AND a.attname=x.nome
      AND a.attnum>0 AND NOT a.attisdropped;
  IF cardinality(v_colonne)<>3 OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid='artecna_distruzione.cleanup_storage'::regclass AND conname='cleanup_storage_identita'
        AND contype='u' AND convalidated AND conkey=v_colonne)
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='artecna_distruzione.cleanup_storage'::regclass AND contype='f') THEN
    RAISE EXCEPTION 'Deduplicazione/FK outbox divergenti';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('manifest_cantiere','s','record'),('prepara_cleanup_storage','v','int8')) AS m(nome,volatilita,tipo)
  LOOP
    SELECT f.* INTO p FROM pg_catalog.pg_proc f WHERE f.oid=to_regprocedure(format('artecna_distruzione.%I(uuid)',r.nome));
    IF NOT FOUND THEN RAISE EXCEPTION 'Helper nuovo % assente',r.nome; END IF;
    IF p.proowner<>'postgres'::regrole OR NOT p.prosecdef OR p.provolatile::text<>r.volatilita
       OR p.prorettype<>to_regtype('pg_catalog.'||r.tipo)
       OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp','row_security=off']::text[]
       OR NOT has_function_privilege('artecna_cantieri_rpc',p.oid,'EXECUTE')
       OR EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
         WHERE a.grantee NOT IN ('postgres'::regrole,'artecna_cantieri_rpc'::regrole) OR a.privilege_type<>'EXECUTE' OR a.is_grantable) THEN
      RAISE EXCEPTION 'Attributi/ACL helper nuovo % divergenti',r.nome;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid='artecna_distruzione.cleanup_storage'::regclass
      AND relkind='r' AND relowner='postgres'::regrole)
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c,
       LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
       WHERE c.oid IN ('artecna_distruzione.cleanup_storage'::regclass,'artecna_distruzione.cleanup_storage_id_seq'::regclass)
         AND a.grantee<>'postgres'::regrole) THEN RAISE EXCEPTION 'Owner/ACL outbox/sequence divergenti'; END IF;
  FOR r IN SELECT rolname FROM pg_catalog.pg_roles WHERE rolname IN ('authenticated','anon')
  LOOP
    IF has_schema_privilege(r.rolname,'artecna_distruzione','USAGE')
       OR has_table_privilege(r.rolname,'artecna_distruzione.cleanup_storage','SELECT,INSERT,UPDATE,DELETE')
       OR has_function_privilege(r.rolname,'artecna_distruzione.manifest_cantiere(uuid)','EXECUTE')
       OR has_function_privilege(r.rolname,'artecna_distruzione.prepara_cleanup_storage(uuid)','EXECUTE') THEN
      RAISE EXCEPTION 'Accesso client % inatteso',r.rolname;
    END IF;
  END LOOP;
  IF has_table_privilege('artecna_cantieri_rpc','artecna_distruzione.cleanup_storage','SELECT,INSERT,UPDATE,DELETE')
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc f JOIN pg_catalog.pg_namespace n ON n.oid=f.pronamespace
       WHERE n.nspname='public' AND f.proname='elimina_cantiere_definitivamente') THEN
    RAISE EXCEPTION 'Accesso diretto tecnico o RPC pubblica inattesi';
  END IF;
END;
$migration$;
COMMIT;
