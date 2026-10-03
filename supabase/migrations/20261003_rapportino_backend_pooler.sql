-- Adattamento B, successivo a STEP 2 e STEP 3 già applicati e immutabili.
-- Applicazione manuale integrale; nessun segreto e nessun provisioning password.
BEGIN;

DO $preflight$
DECLARE f record;
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Installazione riservata a postgres';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='artecna_rapportini_backend') THEN
    RAISE EXCEPTION 'Ruolo backend già presente: verificare provisioning e applicazione precedente';
  END IF;
  IF to_regclass('artecna_rapportini.sessioni_portale') IS NULL THEN
    RAISE EXCEPTION 'STEP 3 deve essere già installato';
  END IF;
  FOR f IN SELECT firma FROM (VALUES
    ('public.crea_sessione_rapportino(text,text)'),
    ('public.verifica_sessione_rapportino(text,uuid)'),
    ('public.varianti_rapportino_portale(text,uuid)'),
    ('public.salva_rapportino_con_prestazioni(jsonb,text)')) v(firma)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(f.firma)
      AND p.proowner='postgres'::regrole AND p.prosecdef
      AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[]
      AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        WHERE a.grantee=0 AND a.privilege_type='EXECUTE')) THEN
      RAISE EXCEPTION 'RPC STEP 3 assente o owner/modalità/search_path/PUBLIC divergenti: %',f.firma;
    END IF;
  END LOOP;
  -- Versione esatta del writer STEP 3; solo CRLF normalizzato a LF.
  IF NOT EXISTS (SELECT 1 FROM pg_proc p
    WHERE p.oid='public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure
      AND p.proowner='postgres'::regrole AND p.prosecdef
      AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[]
      AND p.prokind='f' AND p.pronargs=2
      AND p.proargnames=ARRAY['p_payload','p_sessione']::text[]
      AND p.proargtypes[0]='jsonb'::regtype AND p.proargtypes[1]='text'::regtype
      AND p.prorettype='jsonb'::regtype AND NOT p.proretset
      AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')
      AND p.pronargdefaults=1 AND pg_get_expr(p.proargdefaults,0)='NULL::text'
      AND encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')
        ='d82761225d035ef22ba09050098823d463c86437b448aa431dbd56f0049f44a8') THEN
    RAISE EXCEPTION 'Versione writer STEP 3 inattesa: firma/default/corpo divergenti';
  END IF;
END;
$preflight$;

-- LOGIN senza PASSWORD è valido: connessione con password impossibile finché
-- un amministratore non esegue il provisioning privato documentato.
CREATE ROLE artecna_rapportini_backend LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS
  NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE artecna_rapportini_backend SET statement_timeout='20s';
ALTER ROLE artecna_rapportini_backend SET lock_timeout='5s';
ALTER ROLE artecna_rapportini_backend SET idle_in_transaction_session_timeout='10s';
GRANT CONNECT ON DATABASE postgres TO artecna_rapportini_backend;
GRANT USAGE ON SCHEMA public TO artecna_rapportini_backend;

-- Corpo STEP 3 completo e deterministico; unica differenza: guardia backend.
-- Nessun trasferimento ownership: firma, default e ACL esistenti conservati.
CREATE OR REPLACE FUNCTION public.salva_rapportino_con_prestazioni(p_payload jsonb,p_sessione text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE
  a record; r public.rapportini%rowtype; rid uuid; req uuid; c uuid; giorno date;
  prev artecna_rapportini.richieste%rowtype; h bytea; result jsonb; dominio jsonb;
  documento jsonb; costo numeric; ore_totali numeric; presenti integer; elenco text;
  context_before text; x record;
BEGIN
  -- Connessione dedicata: session_user resta il LOGIN anche dentro DEFINER.
  IF session_user = 'artecna_rapportini_backend' AND
    (p_sessione IS NULL OR p_sessione !~ '^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Backend Rapportini: sessione portale obbligatoria';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>1048576
    OR NOT(p_payload ?& ARRAY['versione_contratto','richiesta_id','rapportino_id','revisione_attesa','cantiere_id','data','prestazioni'])
    OR p_payload->'versione_contratto' IS DISTINCT FROM '1'::jsonb
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN
      ('versione_contratto','richiesta_id','rapportino_id','revisione_attesa','cantiere_id','data','prestazioni','documento'))
    OR coalesce(p_payload->>'data','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Envelope servizio Rapportino non valido';
  END IF;
  req:=(p_payload->>'richiesta_id')::uuid; c:=(p_payload->>'cantiere_id')::uuid;
  giorno:=(p_payload->>'data')::date; rid:=(p_payload->>'rapportino_id')::uuid;
  IF req IS NULL OR c IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID richiesta/cantiere obbligatori'; END IF;
  SELECT * INTO a FROM artecna_rapportini.autorizza(p_sessione,c);
  PERFORM pg_advisory_xact_lock(hashtextextended(a.canale||a.identita::text||req::text,0));
  h:=sha256(convert_to(p_payload::text,'UTF8'));
  SELECT * INTO prev FROM artecna_rapportini.richieste
    WHERE canale=a.canale AND utente_id=a.identita AND richiesta_id=req;
  IF FOUND THEN
    IF prev.payload_sha256 IS DISTINCT FROM h THEN
      RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Richiesta idempotente con payload differente';
    END IF;
    RETURN prev.risultato;
  END IF;
  documento:=coalesce(p_payload->'documento','{}');
  IF jsonb_typeof(documento) IS DISTINCT FROM 'object' OR EXISTS
    (SELECT 1 FROM jsonb_object_keys(documento) k WHERE k NOT IN ('note','materiali','quantita_materiali')) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Documento non valido o costo client non ammesso';
  END IF;
  FOR x IN SELECT key,value FROM jsonb_each(documento) LOOP
    IF jsonb_typeof(x.value) IS DISTINCT FROM 'string' OR length(x.value#>>'{}')>20000 THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Campo documento non valido';
    END IF;
  END LOOP;
  IF rid IS NULL THEN
    IF p_payload->'rapportino_id' IS DISTINCT FROM 'null'::jsonb
      OR p_payload->'revisione_attesa' IS DISTINCT FROM 'null'::jsonb
      OR p_payload#>'{prestazioni,aggiornate}' IS DISTINCT FROM '[]'::jsonb
      OR p_payload#>'{prestazioni,rimosse}' IS DISTINCT FROM '[]'::jsonb THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Creazione con UUID/revisione/operazioni non validi';
    END IF;
    -- Regola legacy: un documento per cantiere/giorno, senza UNIQUE/backfill.
    PERFORM pg_advisory_xact_lock(hashtextextended('rapportino-giorno:'||c::text||giorno::text,0));
    IF EXISTS(SELECT 1 FROM public.rapportini WHERE cantiere_id=c AND data=giorno) THEN
      RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Rapportino già presente per questa data';
    END IF;
    INSERT INTO public.rapportini(cantiere_id,cantiere,data,versione_prestazioni,
      compilato_da_operaio_id,compilato_da_nome,note,materiali,quantita_materiali)
      SELECT c,nome,giorno,1,CASE WHEN a.canale='portale' THEN a.identita ELSE NULL END,
        a.compilatore_nome,coalesce(documento->>'note',''),coalesce(documento->>'materiali',''),
        coalesce(documento->>'quantita_materiali','') FROM public.cantieri WHERE id=c
      RETURNING * INTO r;
    rid:=r.id;
  ELSE
    SELECT * INTO r FROM public.rapportini WHERE id=rid FOR UPDATE;
    IF NOT FOUND OR r.cantiere_id IS DISTINCT FROM c OR r.data IS DISTINCT FROM giorno THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Rapportino/contesto non valido';
    END IF;
    IF r.versione_prestazioni<>1 THEN
      RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Rapportino legacy: conversione non consentita';
    END IF;
  END IF;
  context_before:=current_setting('artecna.rapportino_sessione',true);
  PERFORM set_config('artecna.rapportino_sessione',coalesce(p_sessione,''),true);
  dominio:=(p_payload-'documento')||jsonb_build_object('rapportino_id',rid,
    'revisione_attesa',CASE WHEN p_payload->'rapportino_id'='null'::jsonb THEN '0'::jsonb ELSE p_payload->'revisione_attesa' END);
  result:=artecna_rapportini.applica_prestazioni_rapportino(dominio);
  PERFORM set_config('artecna.rapportino_sessione',coalesce(context_before,''),true);
  -- Anche le sole modifiche del documento consumano la revisione aggregata.
  IF (result->>'revisione')::bigint=r.revisione_prestazioni AND
    (p_payload->'rapportino_id'='null'::jsonb OR
      (documento ? 'note' AND documento->>'note' IS DISTINCT FROM r.note) OR
      (documento ? 'materiali' AND documento->>'materiali' IS DISTINCT FROM r.materiali) OR
      (documento ? 'quantita_materiali' AND documento->>'quantita_materiali' IS DISTINCT FROM r.quantita_materiali)) THEN
    UPDATE public.rapportini SET revisione_prestazioni=revisione_prestazioni+1 WHERE id=rid;
  END IF;
  -- Costi numerici: arrotondamento a centesimi una sola volta sul totale.
  SELECT coalesce(sum(p.ore*p.costo_orario_interno_storico),0),coalesce(sum(p.ore),0),
    count(DISTINCT p.operaio_id),coalesce(string_agg(format('%s (%s / %s - %sh)',o.nome,
      to_char(p.ora_inizio,'HH24:MI'),to_char(p.ora_fine,'HH24:MI'),p.ore),', ' ORDER BY p.created_at,p.id),'')
    INTO costo,ore_totali,presenti,elenco FROM public.rapportino_prestazioni p
      JOIN public.operai o ON o.id=p.operaio_id WHERE p.rapportino_id=rid AND p.rimossa_at IS NULL;
  UPDATE public.rapportini SET costo_manodopera=round(costo,2)::double precision,
    ore=ore_totali::text,operai=elenco,numero_presenti=presenti::text,
    -- Campo legacy: media delle ore totali per operaio distinto, non per riga.
    ore_per_operaio=CASE WHEN presenti=0 THEN '0' ELSE (ore_totali/presenti)::text END,
    note=CASE WHEN documento ? 'note' THEN documento->>'note' ELSE note END,
    materiali=CASE WHEN documento ? 'materiali' THEN documento->>'materiali' ELSE materiali END,
    quantita_materiali=CASE WHEN documento ? 'quantita_materiali' THEN documento->>'quantita_materiali' ELSE quantita_materiali END
    WHERE id=rid RETURNING * INTO r;
  -- Proiezione ricreabile; l'identità persistente resta quella della prestazione.
  DELETE FROM public.timbrature WHERE rapportino_id=rid AND stato='da rapportino';
  INSERT INTO public.timbrature(prestazione_rapportino_id,rapportino_id,operaio_id,operaio_nome,
    cantiere_id,cantiere,data,ora_entrata,ora_uscita,pausa_minuti,stato)
    SELECT p.id,rid,p.operaio_id,o.nome,c,r.cantiere,to_char(giorno,'YYYY-MM-DD'),
      to_char(p.ora_inizio,'HH24:MI'),to_char(p.ora_fine,'HH24:MI'),p.pausa_minuti,'da rapportino'
      FROM public.rapportino_prestazioni p JOIN public.operai o ON o.id=p.operaio_id
      WHERE p.rapportino_id=rid AND p.rimossa_at IS NULL;
  -- Risposta operativa senza tariffe/costi/stati Economia (STEP 6).
  result:=jsonb_build_object('versione_contratto',1,'rapportino_id',rid,'revisione',r.revisione_prestazioni,
    'cantiere_id',c,'data',to_char(giorno,'YYYY-MM-DD'),'documento',jsonb_build_object(
      'note',r.note,'materiali',r.materiali,'quantita_materiali',r.quantita_materiali),
    'prestazioni',(SELECT coalesce(jsonb_agg(jsonb_build_object('prestazione_id',p.id,
      'chiave_client',p.chiave_client,'operaio_id',p.operaio_id,'operaio_nome',o.nome,
      'ora_inizio',to_char(p.ora_inizio,'HH24:MI'),'ora_fine',to_char(p.ora_fine,'HH24:MI'),
      'pausa_minuti',p.pausa_minuti,'ore',p.ore,'lavoro_in_economia',p.lavoro_in_economia,
      'variante_id',p.variante_id,'revisione',p.revisione,'rimossa_at',p.rimossa_at)
      ORDER BY p.created_at,p.id),'[]') FROM public.rapportino_prestazioni p
        JOIN public.operai o ON o.id=p.operaio_id WHERE p.rapportino_id=rid));
  UPDATE artecna_rapportini.richieste SET payload_sha256=h,risultato=result
    WHERE canale=a.canale AND utente_id=a.identita AND richiesta_id=req;
  RETURN result;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.crea_sessione_rapportino(text,text),
  public.verifica_sessione_rapportino(text,uuid),
  public.varianti_rapportino_portale(text,uuid),
  public.salva_rapportino_con_prestazioni(jsonb,text) TO artecna_rapportini_backend;

-- Transizione: grant service_role STEP 3 conservati per il deploy precedente.
-- Revoca separata dopo provisioning, prova pooler, deploy e verifica utilizzi.
-- Nessuna ACL PUBLIC globale modificata: TEMP/USAGE/rls_auto_enable e statistiche
-- restano eccezioni preesistenti, non grant introdotti da questa migration.
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
      'public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure) LOOP
    IF NOT has_function_privilege(b,f.oid,'EXECUTE') OR f.proowner<>'postgres'::regrole
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
       'public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure))) THEN
    RAISE EXCEPTION 'Grant diretto funzione backend fuori elenco';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE p.prosecdef AND n.nspname<>'information_schema' AND n.nspname !~ '^pg_'
      AND has_schema_privilege(b,n.oid,'USAGE') AND has_function_privilege(b,p.oid,'EXECUTE')
      AND p.oid NOT IN ('public.crea_sessione_rapportino(text,text)'::regprocedure,
        'public.verifica_sessione_rapportino(text,uuid)'::regprocedure,
        'public.varianti_rapportino_portale(text,uuid)'::regprocedure,
        'public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure)
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
