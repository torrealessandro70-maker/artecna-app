BEGIN;
-- Solo infrastruttura privata: nessuna RPC pubblica di eliminazione.
-- Baseline pg_get_functiondef certificate; CRLF dell'allegato normalizzati a LF.
-- Non cambia owner/ACL/config delle guardie. Installazione come postgres,
-- proprietario gia certificato: nessuna membership o CREATE temporanei necessari.
DO $migration$
DECLARE
  r record;
  prima pg_catalog.pg_proc%ROWTYPE;
  dopo pg_catalog.pg_proc%ROWTYPE;
  snapshots jsonb := '{}'::jsonb;
  corpi jsonb := '{}'::jsonb;
  deroghe jsonb := '{}'::jsonb;
  trigger_prima jsonb;
  trigger_dopo jsonb;
  nuovo text;
  ddl text;
  delimitatore text;
  posizione integer;
  n integer;
  v_proconfig_atteso text[];
  v_newline text;
  v_newline_guardie jsonb := '{}'::jsonb;
  v_corpo_atteso text;
  v_deroga text;
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres'
     OR current_setting('server_version_num')::integer / 10000 <> 17 THEN
    RAISE EXCEPTION 'Installazione prevista come postgres su PostgreSQL 17';
  END IF;
  IF to_regnamespace('artecna_distruzione') IS NOT NULL THEN
    RAISE EXCEPTION 'Schema artecna_distruzione gia presente';
  END IF;
  IF to_regprocedure('public.elimina_cantiere_definitivamente(uuid)') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace ns ON ns.oid=p.pronamespace
                WHERE ns.nspname='public' AND p.proname='elimina_cantiere_definitivamente') THEN
    RAISE EXCEPTION 'RPC pubblica di eliminazione inattesa';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='artecna_cantieri_rpc'
                 AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb)
     OR pg_has_role('authenticated','artecna_cantieri_rpc','MEMBER')
     OR pg_has_role('anon','artecna_cantieri_rpc','MEMBER') THEN
    RAISE EXCEPTION 'Ruolo tecnico assente o accessibile ai client';
  END IF;
  FOR r IN SELECT * FROM (VALUES
('proteggi_contrattuale_cantiere', true, $baseline0$
BEGIN
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
$baseline0$, $deroga0$
  IF OLD.preventivo_contrattuale_id IS NOT NULL
     AND NEW.preventivo_contrattuale_id IS NULL
     AND (to_jsonb(NEW) - 'preventivo_contrattuale_id')
         IS NOT DISTINCT FROM (to_jsonb(OLD) - 'preventivo_contrattuale_id')
     AND artecna_distruzione.contesto_valido(OLD.id) THEN
    RETURN NEW;
  END IF;
$deroga0$),
('proteggi_preventivo_base', true, $baseline1$
BEGIN
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
$baseline1$, $deroga1$
  IF TG_OP = 'DELETE' THEN
    IF artecna_distruzione.contesto_valido(OLD.cantiere_id) THEN
      RETURN OLD;
    END IF;
  END IF;
$deroga1$),
('proteggi_lavorazione_base', true, $baseline2$
BEGIN
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
$baseline2$, $deroga2$
  IF TG_OP = 'DELETE' THEN
    IF artecna_distruzione.contesto_valido(OLD.cantiere_id) THEN
      RETURN OLD;
    END IF;
  END IF;
$deroga2$),
('proteggi_variante_testata', false, $baseline3$
DECLARE
    percorso_interno boolean :=
        current_user = 'artecna_varianti_rpc';
BEGIN
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
$baseline3$, $deroga3$
  IF TG_OP = 'DELETE' AND current_user = 'artecna_cantieri_rpc' THEN
    IF artecna_distruzione.contesto_valido(OLD.cantiere_id) THEN
      RETURN OLD;
    END IF;
  END IF;
$deroga3$),
('proteggi_variante_figlio', false, $baseline4$
DECLARE
    proprietari uuid[];
    proprietario uuid;
    stato_proprietario text;
BEGIN
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
$baseline4$, $deroga4$
  IF TG_OP = 'DELETE' AND current_user = 'artecna_cantieri_rpc'
     AND TG_TABLE_SCHEMA = 'public'
     AND TG_TABLE_NAME IN ('variante_lavorazioni', 'variante_documenti') THEN
    IF artecna_distruzione.contesto_variante_valido(OLD.variante_id) THEN
      RETURN OLD;
    END IF;
  END IF;
$deroga4$)
  ) AS m(nome, definer, corpo, deroga)
  LOOP
    SELECT p.* INTO prima FROM pg_catalog.pg_proc p
      WHERE p.oid=to_regprocedure(format('artecna_guardie.%I()',r.nome));
    IF NOT FOUND THEN RAISE EXCEPTION 'Guardia % assente',r.nome; END IF;
    -- Accetta solo LF uniforme o CRLF uniforme; niente CR isolati.
    IF strpos(prima.prosrc, chr(13) || chr(10)) > 0 THEN
      IF strpos(replace(prima.prosrc, chr(13) || chr(10), ''), chr(13)) > 0
         OR strpos(replace(prima.prosrc, chr(13) || chr(10), ''), chr(10)) > 0 THEN
        RAISE EXCEPTION 'Newline misti o CR isolati nella guardia %', r.nome;
      END IF;
      v_newline := chr(13) || chr(10);
    ELSE
      IF strpos(prima.prosrc, chr(13)) > 0 OR strpos(prima.prosrc, chr(10)) = 0 THEN
        RAISE EXCEPTION 'Newline inattesi nella guardia %', r.nome;
      END IF;
      v_newline := chr(10);
    END IF;
    -- Adatta solo la baseline; il prosrc installato resta intatto.
    v_corpo_atteso := replace(replace(r.corpo, chr(13) || chr(10), chr(10)), chr(10), v_newline);
    v_newline_guardie := v_newline_guardie || jsonb_build_object(r.nome, v_newline);
    IF r.definer THEN
      v_proconfig_atteso := ARRAY['search_path=pg_catalog, pg_temp','row_security=off']::text[];
    ELSE
      v_proconfig_atteso := ARRAY['search_path=pg_catalog, pg_temp']::text[];
    END IF;
    IF prima.proowner <> 'postgres'::regrole OR prima.prokind <> 'f'
       OR prima.prorettype <> 'trigger'::regtype OR prima.prolang <> (SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
       OR prima.prosecdef IS DISTINCT FROM r.definer
       OR prima.proconfig IS DISTINCT FROM v_proconfig_atteso
       OR prima.prosrc IS DISTINCT FROM v_corpo_atteso
       OR (SELECT count(*) FROM pg_catalog.aclexplode(coalesce(prima.proacl,acldefault('f',prima.proowner)))) <> 1
       OR NOT EXISTS (SELECT 1 FROM pg_catalog.aclexplode(coalesce(prima.proacl,acldefault('f',prima.proowner))) a
                      WHERE a.grantee='postgres'::regrole AND a.grantor='postgres'::regrole
                        AND a.privilege_type='EXECUTE' AND NOT a.is_grantable) THEN
      RAISE EXCEPTION 'Baseline/attributi/ACL guardia % divergenti',r.nome;
    END IF;
    snapshots := snapshots || jsonb_build_object(r.nome,to_jsonb(prima));
    corpi := corpi || jsonb_build_object(r.nome,r.corpo);
    deroghe := deroghe || jsonb_build_object(r.nome,r.deroga);
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
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t
      WHERE t.tgrelid=to_regclass(format('public.%I',r.tabella)) AND t.tgname=r.nome
        AND t.tgfoid=to_regprocedure(format('artecna_guardie.%I()',r.funzione))
        AND t.tgenabled='O' AND NOT t.tgisinternal AND t.tgtype=r.tipo AND t.tgnargs=0
        AND t.tgqual IS NULL AND t.tgattr=''::int2vector) THEN
      RAISE EXCEPTION 'Trigger % divergente',r.nome;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t WHERE NOT t.tgisinternal
    AND t.tgfoid IN (SELECT (value->>'oid')::oid FROM jsonb_each(snapshots))
    AND NOT (t.tgrelid::regclass::text IN ('cantieri','public.cantieri','preventivi_cantiere','public.preventivi_cantiere',
      'preventivo_lavorazioni','public.preventivo_lavorazioni','varianti_cantiere','public.varianti_cantiere',
      'variante_lavorazioni','public.variante_lavorazioni','variante_documenti','public.variante_documenti'))) THEN
    RAISE EXCEPTION 'Utilizzatore guardia non certificato';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.variante_sorgenti'::regclass AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Guardia applicativa variante_sorgenti inattesa';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.preventivi_cantiere'::regclass
     AND tgname='guardia_archiviazione_preventivo' AND tgenabled='O' AND NOT tgisinternal
     AND tgtype=23 AND tgfoid=to_regprocedure('artecna_guardie.proteggi_archiviazione_preventivo()')) THEN
    RAISE EXCEPTION 'Guardia archiviazione divergente';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_trigger WHERE NOT tgisinternal
      AND tgfoid IN (SELECT (value->>'oid')::oid FROM jsonb_each(snapshots))) <> 6 THEN
    RAISE EXCEPTION 'Numero utilizzatori guardie divergente';
  END IF;
  -- Snapshot di tutti i trigger sulle tabelle interessate, inclusa archiviazione.
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) INTO trigger_prima FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid IN ('public.cantieri'::regclass,'public.preventivi_cantiere'::regclass,
      'public.preventivo_lavorazioni'::regclass,'public.varianti_cantiere'::regclass,
      'public.variante_lavorazioni'::regclass,'public.variante_documenti'::regclass,'public.variante_sorgenti'::regclass);
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('artecna_guardie.utente_jwt_corrente()')
    AND proowner='postgres'::regrole AND NOT prosecdef AND provolatile='s' AND prorettype='uuid'::regtype
    AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[]) THEN
    RAISE EXCEPTION 'Helper JWT divergente';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)')
    AND proowner='postgres'::regrole AND NOT prosecdef AND provolatile='s' AND prorettype='bool'::regtype
    AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[]) THEN
    RAISE EXCEPTION 'Helper owner divergente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.crea_cantiere_con_owner(text,double precision)')
    AND proowner='artecna_cantieri_rpc'::regrole AND prosecdef
    AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[]) THEN
    RAISE EXCEPTION 'Dominio tecnico cantieri divergente';
  END IF;
  EXECUTE 'CREATE SCHEMA artecna_distruzione AUTHORIZATION postgres';
  EXECUTE 'REVOKE ALL ON SCHEMA artecna_distruzione FROM PUBLIC, authenticated, anon';
  EXECUTE 'GRANT USAGE ON SCHEMA artecna_distruzione TO artecna_cantieri_rpc';
  EXECUTE 'CREATE TABLE artecna_distruzione.contesto (
    transazione xid8 NOT NULL, backend integer NOT NULL, cantiere_id uuid NOT NULL,
    user_id uuid NOT NULL, ruolo name NOT NULL CHECK (ruolo = ''artecna_cantieri_rpc''),
    created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    PRIMARY KEY (transazione, backend))';
  EXECUTE 'REVOKE ALL ON TABLE artecna_distruzione.contesto FROM PUBLIC, authenticated, anon, artecna_cantieri_rpc';

  EXECUTE $ddl$CREATE FUNCTION artecna_distruzione.inizia_contesto(p_cantiere uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog, pg_temp SET row_security TO off
  AS $body$
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
  $body$$ddl$;
  EXECUTE $ddl$CREATE FUNCTION artecna_distruzione.contesto_valido(p_cantiere uuid)
  RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog, pg_temp SET row_security TO off
  AS $body$
    SELECT EXISTS (SELECT 1 FROM artecna_distruzione.contesto c
      WHERE c.transazione=pg_current_xact_id_if_assigned() AND c.backend=pg_backend_pid()
        AND c.cantiere_id=p_cantiere AND c.ruolo='artecna_cantieri_rpc'
        AND c.user_id=artecna_guardie.utente_jwt_corrente()
        AND EXISTS (SELECT 1 FROM public.utenti_cantiere u
          WHERE u.cantiere_id=c.cantiere_id AND u.user_id=c.user_id AND u.ruolo='owner'));
  $body$$ddl$;
  EXECUTE $ddl$CREATE FUNCTION artecna_distruzione.contesto_variante_valido(p_variante uuid)
  RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog, pg_temp SET row_security TO off
  AS $body$
  DECLARE c uuid;
  BEGIN
    SELECT cantiere_id INTO c FROM public.varianti_cantiere WHERE id=p_variante FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
    RETURN artecna_distruzione.contesto_valido(c);
  END;
  $body$$ddl$;
  EXECUTE $ddl$CREATE FUNCTION artecna_distruzione.termina_contesto()
  RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog, pg_temp SET row_security TO off
  AS $body$
    DELETE FROM artecna_distruzione.contesto
      WHERE transazione=pg_current_xact_id_if_assigned() AND backend=pg_backend_pid()
        AND user_id=artecna_guardie.utente_jwt_corrente();
  $body$$ddl$;
  EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA artecna_distruzione FROM PUBLIC, authenticated, anon';
  EXECUTE 'GRANT EXECUTE ON FUNCTION artecna_distruzione.inizia_contesto(uuid),
    artecna_distruzione.contesto_valido(uuid), artecna_distruzione.contesto_variante_valido(uuid),
    artecna_distruzione.termina_contesto() TO artecna_cantieri_rpc';
  -- Le guardie definer verificano come postgres (owner); le invoker entrano
  -- negli helper solo come artecna_cantieri_rpc. Nessun EXECUTE client necessario.
  -- Autorizzazione owner letta direttamente: nessun GRANT aggiuntivo al helper pubblico.

  FOR r IN SELECT key AS nome, value AS attributi FROM jsonb_each(snapshots)
  LOOP
    SELECT * INTO prima FROM pg_catalog.pg_proc WHERE oid=(r.attributi->>'oid')::oid;
    v_newline := v_newline_guardie->>r.nome;
    v_deroga := replace(replace(deroghe->>r.nome, chr(13) || chr(10), chr(10)), chr(10), v_newline);
    posizione := strpos(prima.prosrc, ('BEGIN' || v_newline));
    IF posizione=0 OR strpos(prima.prosrc,'artecna_distruzione')<>0 THEN
      RAISE EXCEPTION 'Ancoraggio BEGIN guardia % inatteso',r.nome;
    END IF;
    nuovo := overlay(prima.prosrc placing v_deroga from posizione+length(('BEGIN' || v_newline)) for 0);
    IF overlay(nuovo placing '' from posizione+length(('BEGIN' || v_newline)) for length(v_deroga)) IS DISTINCT FROM prima.prosrc THEN
      RAISE EXCEPTION 'Patch guardia % non reversibile',r.nome;
    END IF;
    ddl := pg_get_functiondef(prima.oid);
    SELECT count(*),min(m[1]) INTO n,delimitatore
      FROM regexp_matches(ddl,'(?n)^AS ([$][A-Za-z_][A-Za-z_0-9]*[$]|[$][$])','g') AS x(m);
    IF n<>1 OR strpos(nuovo,delimitatore)<>0 THEN RAISE EXCEPTION 'Delimitatore guardia % inatteso',r.nome; END IF;
    posizione := strpos(ddl,'AS '||delimitatore)+length('AS '||delimitatore);
    IF substring(ddl from posizione for length(prima.prosrc)) IS DISTINCT FROM prima.prosrc
       OR substring(ddl from posizione+length(prima.prosrc) for length(delimitatore)) IS DISTINCT FROM delimitatore THEN
      RAISE EXCEPTION 'Wrapper guardia % divergente',r.nome;
    END IF;
    EXECUTE overlay(ddl placing nuovo from posizione for length(prima.prosrc));
    SELECT * INTO dopo FROM pg_catalog.pg_proc WHERE oid=prima.oid;
    IF dopo.prosrc IS DISTINCT FROM nuovo OR (to_jsonb(dopo)-'prosrc') IS DISTINCT FROM (r.attributi-'prosrc') THEN
      RAISE EXCEPTION 'Post-check attributi guardia % fallito',r.nome;
    END IF;
  END LOOP;
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) INTO trigger_dopo FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid IN ('public.cantieri'::regclass,'public.preventivi_cantiere'::regclass,
      'public.preventivo_lavorazioni'::regclass,'public.varianti_cantiere'::regclass,
      'public.variante_lavorazioni'::regclass,'public.variante_documenti'::regclass,'public.variante_sorgenti'::regclass);
  IF trigger_dopo IS DISTINCT FROM trigger_prima THEN RAISE EXCEPTION 'Trigger modificati'; END IF;
  FOR r IN SELECT rolname FROM pg_catalog.pg_roles WHERE rolname IN ('authenticated','anon')
  LOOP
    IF has_schema_privilege(r.rolname,'artecna_distruzione','USAGE')
       OR has_table_privilege(r.rolname,'artecna_distruzione.contesto','SELECT,INSERT,UPDATE,DELETE')
       OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace ns ON ns.oid=p.pronamespace
          WHERE ns.nspname='artecna_distruzione' AND has_function_privilege(r.rolname,p.oid,'EXECUTE')) THEN
      RAISE EXCEPTION 'ACL client % non chiuse',r.rolname;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace ns ON ns.oid=p.pronamespace,
      LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE ns.nspname='artecna_distruzione' AND (a.grantee NOT IN ('postgres'::regrole,'artecna_cantieri_rpc'::regrole)
        OR a.privilege_type<>'EXECUTE' OR a.is_grantable)) THEN RAISE EXCEPTION 'ACL helper inattese'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_namespace ns,
      LATERAL aclexplode(coalesce(ns.nspacl,acldefault('n',ns.nspowner))) a
      WHERE ns.nspname='artecna_distruzione' AND
        (a.grantee NOT IN ('postgres'::regrole,'artecna_cantieri_rpc'::regrole)
         OR (a.grantee='artecna_cantieri_rpc'::regrole AND (a.privilege_type<>'USAGE' OR a.is_grantable))))
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c,
      LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid='artecna_distruzione.contesto'::regclass AND a.grantee<>'postgres'::regrole) THEN
    RAISE EXCEPTION 'ACL schema/struttura inattese';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace ns ON ns.oid=p.pronamespace
       WHERE ns.nspname='artecna_distruzione' AND p.proowner='postgres'::regrole AND p.prosecdef
         AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp','row_security=off']::text[]) <> 4 THEN
    RAISE EXCEPTION 'Helper privati mancanti o attributi divergenti';
  END IF;
  IF has_table_privilege('artecna_cantieri_rpc','artecna_distruzione.contesto','SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'Ruolo tecnico con accesso diretto al contesto';
  END IF;
END;
$migration$;
-- COMMIT rende inutilizzabili i record tramite xid8; ROLLBACK annulla creazione.
-- Cleanup esplicito prima di eliminare utenti_cantiere nella futura RPC.
-- La sicurezza non dipende dal cleanup: backend, xid8 e JWT devono coincidere.
COMMIT;
