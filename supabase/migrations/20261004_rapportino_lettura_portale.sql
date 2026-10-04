-- Lettura portale additiva: STEP 2/3 e backend pooler restano immutabili.
-- Applicare in futuro integralmente come postgres; nessuna applicazione remota in questo step.
BEGIN;

DO $preflight$
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Installazione riservata a postgres';
  END IF;
  IF to_regclass('artecna_rapportini.sessioni_portale') IS NULL
    OR to_regclass('public.rapportino_prestazioni') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='artecna_rapportini_backend') THEN
    RAISE EXCEPTION 'STEP 2/3 e backend pooler devono essere installati';
  END IF;
  IF to_regprocedure('public.leggi_rapportino_portale(text,uuid,date,uuid)') IS NOT NULL
    OR to_regprocedure('artecna_rapportini.autorizza_lettura_portale(text,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Lettura portale già presente: verificare applicazione precedente';
  END IF;
END;
$preflight$;

-- STABLE: stesso snapshot della chiamata pubblica, nessun FOR SHARE.
-- La scadenza è valutata all'inizio dello statement, non della transazione.
CREATE FUNCTION artecna_rapportini.autorizza_lettura_portale(p_sessione text,p_cantiere_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE abilitato boolean; stato_operaio text;
BEGIN
  IF p_sessione IS NULL OR p_sessione !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Sessione portale assente o non valida';
  END IF;
  SELECT o.accesso_portale,o.stato INTO abilitato,stato_operaio
    FROM artecna_rapportini.sessioni_portale s JOIN public.operai o ON o.id=s.operaio_id
    WHERE s.token_sha256=pg_catalog.sha256(pg_catalog.convert_to(p_sessione,'UTF8'))
      AND s.revocata_at IS NULL AND s.scade_at>pg_catalog.statement_timestamp();
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Sessione portale assente, scaduta o revocata';
  END IF;
  IF abilitato IS DISTINCT FROM true OR stato_operaio='sospeso' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso Rapportini non consentito';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id=p_cantiere_id
    AND c.lavori_conclusi IS DISTINCT FROM true) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito';
  END IF;
END;
$fn$;

CREATE FUNCTION public.leggi_rapportino_portale(
  p_sessione text,p_cantiere_id uuid,p_data date,p_rapportino_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE n bigint; v1 boolean; non_supportata boolean; r record; dettaglio jsonb;
BEGIN
  IF session_user <> 'artecna_rapportini_backend' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Lettura riservata al backend portale';
  END IF;
  IF p_cantiere_id IS NULL OR p_data IS NULL OR NOT pg_catalog.isfinite(p_data)
    OR p_data < DATE '0001-01-01' OR p_data > DATE '9999-12-31' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Cantiere e data validi obbligatori';
  END IF;
  PERFORM artecna_rapportini.autorizza_lettura_portale(p_sessione,p_cantiere_id);
  IF p_rapportino_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.rapportini r0
    WHERE r0.id=p_rapportino_id AND r0.cantiere_id=p_cantiere_id AND r0.data=p_data) THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='UUID e contesto Rapportino incoerenti';
  END IF;
  SELECT pg_catalog.count(*),pg_catalog.bool_or(r0.versione_prestazioni=1),
    pg_catalog.bool_or(r0.versione_prestazioni IS NULL OR r0.versione_prestazioni NOT IN (0,1))
    INTO n,v1,non_supportata FROM public.rapportini r0
    WHERE r0.cantiere_id=p_cantiere_id AND r0.data=p_data;
  IF non_supportata THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione Rapportino non supportata';
  END IF;
  IF n>1 AND v1 THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto Rapportino strutturato ambiguo';
  END IF;
  IF n=0 THEN
    RETURN pg_catalog.jsonb_build_object('versione_lettura',1,'cantiere_id',p_cantiere_id,
      'data',pg_catalog.to_char(p_data,'YYYY-MM-DD'),'presente',false,
      'versione_prestazioni',NULL,'rapportino_id',NULL,'dettaglio',NULL);
  END IF;
  -- V0 storico: ORDER BY created_at DESC (NULLS FIRST implicito) come /stato.
  -- Timestamp uguali: id DESC è lo spareggio deterministico prima non definito.
  -- L'UUID opzionale verifica la scelta; non forza la selezione di un V0 più vecchio.
  SELECT r0.id,r0.versione_prestazioni,r0.revisione_prestazioni,
    r0.note,r0.materiali,r0.quantita_materiali INTO r FROM public.rapportini r0
    WHERE r0.cantiere_id=p_cantiere_id AND r0.data=p_data
    ORDER BY r0.created_at DESC,r0.id DESC LIMIT 1;
  IF p_rapportino_id IS NOT NULL AND p_rapportino_id<>r.id THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='UUID e contesto Rapportino incoerenti';
  END IF;
  dettaglio:=NULL;
  IF r.versione_prestazioni=1 THEN
    dettaglio:=pg_catalog.jsonb_build_object('versione_contratto',1,'rapportino_id',r.id,
      'revisione',r.revisione_prestazioni,'cantiere_id',p_cantiere_id,
      'data',pg_catalog.to_char(p_data,'YYYY-MM-DD'),'documento',pg_catalog.jsonb_build_object(
        'note',coalesce(r.note,''),'materiali',coalesce(r.materiali,''),
        'quantita_materiali',coalesce(r.quantita_materiali,'')),
      'prestazioni',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'prestazione_id',p.id,'chiave_client',p.chiave_client,'operaio_id',p.operaio_id,
        'operaio_nome',o.nome,'ora_inizio',pg_catalog.to_char(p.ora_inizio,'HH24:MI'),
        'ora_fine',pg_catalog.to_char(p.ora_fine,'HH24:MI'),'pausa_minuti',p.pausa_minuti,
        'lavoro_in_economia',p.lavoro_in_economia,'variante_id',p.variante_id,
        'ore',p.ore,'revisione',p.revisione,'rimossa_at',p.rimossa_at)
        ORDER BY p.created_at,p.id),'[]'::jsonb)
        FROM public.rapportino_prestazioni p JOIN public.operai o ON o.id=p.operaio_id
        WHERE p.rapportino_id=r.id));
  END IF;
  RETURN pg_catalog.jsonb_build_object('versione_lettura',1,'cantiere_id',p_cantiere_id,
    'data',pg_catalog.to_char(p_data,'YYYY-MM-DD'),'presente',true,
    'versione_prestazioni',r.versione_prestazioni,'rapportino_id',r.id,'dettaglio',dettaglio);
END;
$fn$;

REVOKE ALL ON FUNCTION artecna_rapportini.autorizza_lettura_portale(text,uuid)
  FROM PUBLIC,anon,authenticated,service_role,artecna_rapportini_backend;
REVOKE ALL ON FUNCTION public.leggi_rapportino_portale(text,uuid,date,uuid)
  FROM PUBLIC,anon,authenticated,service_role,artecna_rapportini_backend;
GRANT EXECUTE ON FUNCTION public.leggi_rapportino_portale(text,uuid,date,uuid)
  TO artecna_rapportini_backend;
DO $lettura_check$
DECLARE f record; ruolo text;
BEGIN
  FOR f IN SELECT p.* FROM pg_proc p WHERE p.oid IN (
    'public.leggi_rapportino_portale(text,uuid,date,uuid)'::regprocedure,
    'artecna_rapportini.autorizza_lettura_portale(text,uuid)'::regprocedure) LOOP
    IF f.proowner<>'postgres'::regrole OR NOT f.prosecdef OR f.provolatile<>'s'
      OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[]
      OR EXISTS (SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a
        WHERE a.grantee=0 AND a.privilege_type='EXECUTE') THEN
      RAISE EXCEPTION 'Metadati lettura o ACL PUBLIC divergenti';
    END IF;
    FOREACH ruolo IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF has_function_privilege(ruolo,f.oid,'EXECUTE') THEN
        RAISE EXCEPTION 'Funzione lettura accessibile a ruolo non autorizzato: %',ruolo;
      END IF;
    END LOOP;
  END LOOP;
END;
$lettura_check$;

DO $postcheck$
DECLARE b oid; f record; obj record;
BEGIN
  SELECT oid INTO b FROM pg_roles WHERE rolname='artecna_rapportini_backend'
    AND rolcanlogin AND NOT (rolinherit OR rolsuper OR rolbypassrls
      OR rolcreatedb OR rolcreaterole OR rolreplication);
  IF b IS NULL OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member=b) THEN
    RAISE EXCEPTION 'Attributi o membership backend inattesi';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_auth_members WHERE roleid=b
    AND member<>'postgres'::regrole) THEN
    RAISE EXCEPTION 'Ruolo backend assumibile da altri ruoli';
  END IF;
  IF NOT has_database_privilege(b,'postgres','CONNECT')
    OR has_database_privilege(b,'postgres','CREATE')
    OR NOT has_schema_privilege(b,'public','USAGE')
    OR has_schema_privilege(b,'public','CREATE')
    OR has_schema_privilege(b,'artecna_rapportini','USAGE,CREATE') THEN
    RAISE EXCEPTION 'Privilegi database/schema backend inattesi';
  END IF;
  FOR obj IN SELECT c.oid,n.nspname,c.relname,c.relkind FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname<>'information_schema' AND n.nspname !~ '^pg_'
      AND c.relkind IN ('r','p','v','m','f','S') LOOP
    IF obj.relkind='S' THEN
      IF has_sequence_privilege(b,obj.oid,'USAGE,SELECT,UPDATE') THEN
        RAISE EXCEPTION 'Sequenza accessibile al backend: %.%',obj.nspname,obj.relname;
      END IF;
    ELSE
      IF has_table_privilege(b,obj.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR (has_table_privilege(b,obj.oid,'SELECT') AND NOT
          (obj.nspname='extensions' AND obj.relname IN ('pg_stat_statements','pg_stat_statements_info')))
        OR has_any_column_privilege(b,obj.oid,'INSERT,UPDATE,REFERENCES')
        OR (has_any_column_privilege(b,obj.oid,'SELECT') AND NOT
          (obj.nspname='extensions' AND obj.relname IN ('pg_stat_statements','pg_stat_statements_info'))) THEN
        RAISE EXCEPTION 'Tabella/colonna accessibile al backend: %.%',obj.nspname,obj.relname;
      END IF;
    END IF;
  END LOOP;
  FOR f IN SELECT p.oid,p.proowner,p.prosecdef,p.proconfig FROM pg_proc p
    WHERE p.oid IN ('public.crea_sessione_rapportino(text,text)'::regprocedure,
      'public.verifica_sessione_rapportino(text,uuid)'::regprocedure,
      'public.varianti_rapportino_portale(text,uuid)'::regprocedure,
      'public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure,
      'public.leggi_rapportino_portale(text,uuid,date,uuid)'::regprocedure) LOOP
    -- Ogni firma della whitelist deve avere EXECUTE effettivo e un grant diretto
    -- EXECUTE non delegabile; nessun conteggio globale delle righe ACL.
    IF NOT has_function_privilege(b,f.oid,'EXECUTE') OR NOT EXISTS (
      SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
      WHERE p.oid=f.oid AND a.grantee=b AND a.privilege_type='EXECUTE' AND NOT a.is_grantable
    ) OR f.proowner<>'postgres'::regrole
      OR NOT f.prosecdef OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] THEN
      RAISE EXCEPTION 'RPC backend/owner/modalità/search_path divergenti';
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace
    AND has_function_privilege(b,oid,'EXECUTE')) THEN
    RAISE EXCEPTION 'Helper interno accessibile al backend';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
    WHERE a.grantee=b AND (a.privilege_type<>'EXECUTE' OR a.is_grantable OR p.oid NOT IN
      ('public.crea_sessione_rapportino(text,text)'::regprocedure,
       'public.verifica_sessione_rapportino(text,uuid)'::regprocedure,
       'public.varianti_rapportino_portale(text,uuid)'::regprocedure,
       'public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure,
      'public.leggi_rapportino_portale(text,uuid,date,uuid)'::regprocedure))) THEN
    RAISE EXCEPTION 'Grant diretto funzione backend fuori elenco';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE p.prosecdef AND n.nspname<>'information_schema' AND n.nspname !~ '^pg_'
      AND has_schema_privilege(b,n.oid,'USAGE') AND has_function_privilege(b,p.oid,'EXECUTE')
      AND p.oid NOT IN ('public.crea_sessione_rapportino(text,text)'::regprocedure,
        'public.verifica_sessione_rapportino(text,uuid)'::regprocedure,
        'public.varianti_rapportino_portale(text,uuid)'::regprocedure,
        'public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure,
      'public.leggi_rapportino_portale(text,uuid,date,uuid)'::regprocedure)
      AND NOT (n.nspname='public' AND p.proname='rls_auto_enable' AND p.pronargs=0
        AND EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
          WHERE a.grantee=0 AND a.privilege_type='EXECUTE'))) THEN
    RAISE EXCEPTION 'Funzione SECURITY DEFINER accessibile oltre alle eccezioni PUBLIC certificate';
  END IF;
  IF NOT has_function_privilege('authenticated','public.salva_rapportino_con_prestazioni(jsonb,text)','EXECUTE')
    OR has_function_privilege('anon','public.salva_rapportino_con_prestazioni(jsonb,text)','EXECUTE') THEN
    RAISE EXCEPTION 'ACL writer desktop/anon divergenti';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE oid IN ('public.rapportino_prestazioni'::regclass,
    'artecna_rapportini.richieste'::regclass,'artecna_rapportini.sessioni_portale'::regclass)
    AND NOT relrowsecurity) THEN RAISE EXCEPTION 'RLS dominio inattiva'; END IF;
END;
$postcheck$;
COMMIT;
