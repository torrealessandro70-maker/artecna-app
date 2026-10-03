-- STEP 2. Applicazione manuale come postgres; nessun backfill.
-- Il servizio STEP 3 creerà/aggiornerà la testata nella stessa transazione
-- della funzione di dominio. Nessun client attuale viene migrato.
-- Un solo futuro percorso pubblico di scrittura desktop/mobile: la funzione
-- applica_prestazioni_rapportino è interna già da STEP 2, non una RPC client.
-- Concorrenza aggregata: revisione_attesa confronta la revisione del Rapportino
-- sotto FOR UPDATE. revisione della prestazione traccia modifiche/rimozioni e
-- servirà al confronto con la revisione acquisita da Economia; NON è un token
-- di optimistic locking indipendente della riga. Nessuna estensione DTO STEP 1.
-- STEP 6 aggiungerà al dominio e al trigger proteggi_prestazione le guardie:
-- acquisita => vietate rimozione/disattivazione Economia/cambio Variante;
-- orari modificabili con stesso UUID e divergenza dalla revisione acquisita.
-- L'acquisizione userà lo stesso lock del Rapportino per evitare race fra
-- acquisizione e modifica. Nessun percorso alternativo pubblico è previsto.
-- SQL Editor Supabase: postgres non deve poter SET ROLE verso il nuovo ruolo.
-- Tutte le funzioni restano owner postgres per creazione: nessun trasferimento
-- ownership, nessun GRANT di membership o CREATE sullo schema al ruolo interno.
-- I trigger DEFINER eseguono esclusivamente le guardie fisse qui dichiarate;
-- il dominio resta INVOKER e riceve solo EXECUTE tramite ACL esplicita.
BEGIN;
DO $preflight$
DECLARE r record;
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Installazione riservata a postgres';
  END IF;
  IF to_regnamespace('artecna_rapportini') IS NOT NULL
    OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname='artecna_rapportini_rpc')
    OR to_regclass('public.rapportino_prestazioni') IS NOT NULL THEN
    RAISE EXCEPTION 'STEP 2 già presente o collisione: nessuna riapplicazione';
  END IF;
  FOR r IN SELECT * FROM (VALUES
    ('rapportini','id','uuid'),('rapportini','cantiere_id','uuid'),('rapportini','data','date'),
    ('operai','id','uuid'),('varianti_cantiere','id','uuid'),('varianti_cantiere','cantiere_id','uuid'),
    ('timbrature','id','uuid'),('timbrature','rapportino_id','uuid'),('timbrature','operaio_id','uuid'),
    ('timbrature','ora_entrata','text'),('timbrature','ora_uscita','text'),('timbrature','data','text'),
    ('timbrature','pausa_minuti','integer'),('rapportini','costo_manodopera','double precision')
  ) x(tabella,colonna,tipo) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.'||r.tabella)
      AND attname=r.colonna AND NOT attisdropped AND atttypid=to_regtype(r.tipo)) THEN
      RAISE EXCEPTION 'Schema incompatibile: %.% atteso %',r.tabella,r.colonna,r.tipo;
    END IF;
  END LOOP;
  FOR r IN SELECT unnest(ARRAY['rapportini','operai','varianti_cantiere','timbrature']) tabella LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_constraint p JOIN pg_attribute a
      ON a.attrelid=p.conrelid AND a.attname='id'
      WHERE p.conrelid=to_regclass('public.'||r.tabella) AND p.contype='p'
      AND p.conkey=ARRAY[a.attnum] AND p.convalidated) THEN
      RAISE EXCEPTION 'PK id mancante: %',r.tabella;
    END IF;
  END LOOP;
  IF to_regprocedure('artecna_guardie.utente_jwt_corrente()') IS NULL
    OR to_regprocedure('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Guardie mancanti';
  END IF;
END;
$preflight$;

-- Nessun BYPASSRLS, LOGIN o membership client. Le policy seguenti riguardano
-- esclusivamente le due nuove tabelle; nessuna policy Variante viene ampliata.
CREATE ROLE artecna_rapportini_rpc NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE SCHEMA artecna_rapportini;
REVOKE ALL ON SCHEMA artecna_rapportini FROM PUBLIC;
GRANT USAGE ON SCHEMA public,artecna_guardie,artecna_rapportini TO artecna_rapportini_rpc;
GRANT SELECT(id,cantiere_id,data) ON public.rapportini TO artecna_rapportini_rpc;
GRANT SELECT(id) ON public.operai TO artecna_rapportini_rpc;
GRANT SELECT(cantiere_id,user_id,ruolo) ON public.utenti_cantiere TO artecna_rapportini_rpc;
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_jwt_corrente(),
  artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) TO artecna_rapportini_rpc;

-- Unico accesso privilegiato alla Variante: restituisce soltanto un booleano
-- su esistenza e appartenenza, senza esporre record o dati economici.
-- Owner postgres (installer/owner amministrativo), SECURITY DEFINER necessario
-- per leggere la tabella con RLS senza estendere policy o privilegi del dominio.
-- EXECUTE concesso soltanto al ruolo interno dopo la pulizia ACL.
CREATE FUNCTION artecna_rapportini.variante_del_cantiere(p_variante_id uuid,p_cantiere_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO pg_catalog,pg_temp AS $fn$
  SELECT p_variante_id IS NOT NULL AND p_cantiere_id IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.varianti_cantiere
    WHERE id=p_variante_id AND cantiere_id=p_cantiere_id
  );
$fn$;

ALTER TABLE public.rapportini
  ADD COLUMN versione_prestazioni smallint NOT NULL DEFAULT 0 CHECK(versione_prestazioni IN (0,1)),
  ADD COLUMN revisione_prestazioni bigint NOT NULL DEFAULT 0 CHECK(revisione_prestazioni>=0);
GRANT SELECT(versione_prestazioni,revisione_prestazioni),
  UPDATE(versione_prestazioni,revisione_prestazioni) ON public.rapportini TO artecna_rapportini_rpc;

CREATE TABLE public.rapportino_prestazioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rapportino_id uuid NOT NULL REFERENCES public.rapportini(id) ON DELETE RESTRICT,
  operaio_id uuid NOT NULL REFERENCES public.operai(id) ON DELETE RESTRICT,
  chiave_client text NOT NULL CHECK(length(btrim(chiave_client)) BETWEEN 1 AND 200 AND chiave_client=btrim(chiave_client)),
  ora_inizio time without time zone NOT NULL,
  ora_fine time without time zone NOT NULL,
  pausa_minuti integer NOT NULL DEFAULT 0 CHECK(pausa_minuti>=0),
  lavoro_in_economia boolean NOT NULL DEFAULT false,
  variante_id uuid REFERENCES public.varianti_cantiere(id) ON DELETE RESTRICT,
  revisione bigint NOT NULL DEFAULT 0 CHECK(revisione>=0),
  rimossa_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ore numeric GENERATED ALWAYS AS
    ((extract(epoch FROM (ora_fine-ora_inizio))/60-pausa_minuti)/60) STORED,
  CONSTRAINT rapportino_prestazioni_chiave UNIQUE(rapportino_id,chiave_client),
  CONSTRAINT rapportino_prestazioni_minuti CHECK(
    extract(second FROM ora_inizio)=0 AND extract(second FROM ora_fine)=0
    AND ora_inizio<'24:00'::time AND ora_fine<'24:00'::time),
  -- Stesso giorno: fine <= inizio (anche oltre mezzanotte) è rifiutato.
  CONSTRAINT rapportino_prestazioni_intervallo CHECK(
    ora_fine>ora_inizio AND extract(epoch FROM (ora_fine-ora_inizio))/60>pausa_minuti),
  CONSTRAINT rapportino_prestazioni_destinazione CHECK(lavoro_in_economia OR variante_id IS NULL)
);
CREATE INDEX rapportino_prestazioni_variante ON public.rapportino_prestazioni(variante_id) WHERE variante_id IS NOT NULL;
ALTER TABLE public.rapportino_prestazioni ENABLE ROW LEVEL SECURITY;
CREATE POLICY rapportino_prestazioni_dominio ON public.rapportino_prestazioni
  FOR ALL TO artecna_rapportini_rpc USING(true) WITH CHECK(true);

CREATE TABLE artecna_rapportini.richieste (
  utente_id uuid NOT NULL,
  richiesta_id uuid NOT NULL,
  rapportino_id uuid NOT NULL REFERENCES public.rapportini(id) ON DELETE RESTRICT,
  payload_sha256 bytea NOT NULL CHECK(octet_length(payload_sha256)=32),
  risultato jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(utente_id,richiesta_id)
);
ALTER TABLE artecna_rapportini.richieste ENABLE ROW LEVEL SECURITY;
CREATE POLICY rapportino_richieste_dominio ON artecna_rapportini.richieste
  FOR ALL TO artecna_rapportini_rpc USING(true) WITH CHECK(true);
ALTER TABLE public.timbrature ADD COLUMN prestazione_rapportino_id uuid
  REFERENCES public.rapportino_prestazioni(id) ON DELETE RESTRICT;
-- Nullable, nessun backfill e nessuna nuova FK sui riferimenti legacy.

CREATE FUNCTION artecna_rapportini.proteggi_proiezione() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE p public.rapportino_prestazioni%rowtype; c uuid; d date;
BEGIN
  IF NEW.prestazione_rapportino_id IS NULL AND
    (TG_OP='INSERT' OR OLD.prestazione_rapportino_id IS NULL) THEN RETURN NEW; END IF;
  IF current_user NOT IN ('postgres','artecna_rapportini_rpc') THEN
    RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Proiezione prestazione riservata al dominio Rapportini';
  END IF;
  IF NEW.prestazione_rapportino_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO p FROM public.rapportino_prestazioni WHERE id=NEW.prestazione_rapportino_id;
  IF NOT FOUND OR p.rimossa_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Prestazione proiettata assente/rimossa';
  END IF;
  SELECT cantiere_id,data INTO c,d FROM public.rapportini WHERE id=p.rapportino_id;
  IF NEW.rapportino_id IS DISTINCT FROM p.rapportino_id OR NEW.operaio_id IS DISTINCT FROM p.operaio_id
    OR NEW.cantiere_id IS DISTINCT FROM c OR NEW.data IS DISTINCT FROM to_char(d,'YYYY-MM-DD')
    OR NEW.ora_entrata IS DISTINCT FROM to_char(p.ora_inizio,'HH24:MI')
    OR NEW.ora_uscita IS DISTINCT FROM to_char(p.ora_fine,'HH24:MI')
    OR NEW.pausa_minuti IS DISTINCT FROM p.pausa_minuti THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Proiezione timbratura incoerente';
  END IF;
  RETURN NEW;
END;
$fn$;
CREATE TRIGGER rapportino_prestazioni_proiezione BEFORE INSERT OR UPDATE ON public.timbrature
  FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.proteggi_proiezione();

CREATE FUNCTION artecna_rapportini.proteggi_prestazione() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE c uuid;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Richiesta rimozione logica'; END IF;
  IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.rapportino_id IS DISTINCT FROM OLD.rapportino_id
    OR NEW.operaio_id IS DISTINCT FROM OLD.operaio_id OR NEW.chiave_client IS DISTINCT FROM OLD.chiave_client
    OR NEW.created_at IS DISTINCT FROM OLD.created_at OR OLD.rimossa_at IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Identità immutabile o prestazione rimossa';
  END IF;
  SELECT cantiere_id INTO c FROM public.rapportini WHERE id=NEW.rapportino_id FOR SHARE;
  IF c IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Rapportino senza cantiere valido'; END IF;
  IF NEW.variante_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('rapportino-variante:'||NEW.variante_id::text,0));
    IF NOT artecna_rapportini.variante_del_cantiere(NEW.variante_id,c) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Variante fuori cantiere o inesistente';
    END IF;
  END IF;
  IF TG_OP='UPDATE' THEN NEW.revisione:=OLD.revisione+1; NEW.updated_at:=clock_timestamp(); END IF;
  RETURN NEW;
END;
$fn$;
CREATE TRIGGER rapportino_prestazioni_guardia BEFORE INSERT OR UPDATE OR DELETE ON public.rapportino_prestazioni
  FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.proteggi_prestazione();

-- Impedisce ai percorsi legacy di invalidare i riferimenti/versioni strutturati.
CREATE FUNCTION artecna_rapportini.proteggi_testata() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $fn$
BEGIN
  IF TG_OP='INSERT' THEN
    IF (NEW.versione_prestazioni<>0 OR NEW.revisione_prestazioni<>0)
      AND current_user NOT IN ('postgres','artecna_rapportini_rpc') THEN
      RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Versione iniziale riservata al dominio Rapportini';
    END IF;
    RETURN NEW;
  END IF;
    IF (NEW.versione_prestazioni IS DISTINCT FROM OLD.versione_prestazioni OR
        NEW.revisione_prestazioni IS DISTINCT FROM OLD.revisione_prestazioni)
        AND current_user NOT IN ('postgres','artecna_rapportini_rpc') THEN
      RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Revisioni riservate al dominio Rapportini';
    END IF;
    IF OLD.versione_prestazioni=1 AND
      (NEW.cantiere_id IS DISTINCT FROM OLD.cantiere_id OR NEW.data IS DISTINCT FROM OLD.data) THEN
      RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Cambio contesto strutturato riservato al servizio futuro';
    END IF;
  RETURN NEW;
END;
$fn$;
CREATE TRIGGER rapportino_prestazioni_testata BEFORE INSERT OR UPDATE ON public.rapportini
  FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.proteggi_testata();
-- Il controllo Variante deve leggere la tabella privata anche per ruoli legacy.
CREATE FUNCTION artecna_rapportini.proteggi_cantiere_variante() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('rapportino-variante:'||OLD.id::text,0));
  IF NEW.cantiere_id IS DISTINCT FROM OLD.cantiere_id AND EXISTS
    (SELECT 1 FROM public.rapportino_prestazioni WHERE variante_id=OLD.id) THEN
    RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Variante collegata: cantiere immutabile';
  END IF;
  RETURN NEW;
END;
$fn$;
CREATE TRIGGER rapportino_prestazioni_variante BEFORE UPDATE OF cantiere_id ON public.varianti_cantiere
  FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.proteggi_cantiere_variante();

-- Helper interno: STEP 3 lo chiamerà dall'unico servizio transazionale pubblico.
-- SECURITY INVOKER: nessuna elevazione, richiede il ruolo interno autorizzato.
CREATE FUNCTION artecna_rapportini.applica_prestazioni_rapportino(p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE
  u uuid; rid uuid; req uuid; c uuid; rev bigint; ver smallint; h bytea;
  prev artecna_rapportini.richieste%rowtype; old public.rapportino_prestazioni%rowtype;
  ops jsonb; x jsonb; k text; pid uuid; seen uuid[]:='{}'; keys text[]:='{}';
  oi uuid; vi uuid; econ boolean; start_time time; end_time time; pause integer;
  out_result jsonb; current_row record; changed boolean:=false; exists_key boolean;
BEGIN
  u:=artecna_guardie.utente_jwt_corrente();
  IF u IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Identità obbligatoria'; END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>1048576
    OR NOT (p_payload ?& ARRAY['versione_contratto','richiesta_id','rapportino_id','revisione_attesa','cantiere_id','data','prestazioni'])
    OR p_payload->'versione_contratto' IS DISTINCT FROM '1'::jsonb
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) z WHERE z NOT IN
      ('versione_contratto','richiesta_id','rapportino_id','revisione_attesa','cantiere_id','data','prestazioni')) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Envelope Rapportino V1 non valido';
  END IF;
  -- STEP 2 opera su una testata esistente. La creazione null è riservata STEP 3.
  rid:=(p_payload->>'rapportino_id')::uuid; req:=(p_payload->>'richiesta_id')::uuid;
  c:=(p_payload->>'cantiere_id')::uuid;
  IF rid IS NULL OR req IS NULL OR c IS NULL OR
    artecna_guardie.utente_puo_modificare_cantiere(u,c) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Rapportino/owner non autorizzato';
  END IF;
  -- Serializza retry dello stesso utente/richiesta anche su Rapportini diversi.
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text||req::text,0));
  h:=sha256(convert_to(p_payload::text,'UTF8'));
  SELECT * INTO prev FROM artecna_rapportini.richieste WHERE utente_id=u AND richiesta_id=req;
  IF FOUND THEN
    IF prev.payload_sha256 IS DISTINCT FROM h THEN RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Richiesta idempotente con payload differente'; END IF;
    RETURN prev.risultato;
  END IF;
  SELECT cantiere_id,versione_prestazioni,revisione_prestazioni,data INTO current_row
    FROM public.rapportini WHERE id=rid FOR UPDATE;
  IF NOT FOUND OR current_row.cantiere_id IS DISTINCT FROM c OR current_row.data IS NULL
    OR to_char(current_row.data,'YYYY-MM-DD') IS DISTINCT FROM p_payload->>'data' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Rapportino/contesto non valido';
  END IF;
  rev:=current_row.revisione_prestazioni; ver:=current_row.versione_prestazioni;
  IF jsonb_typeof(p_payload->'revisione_attesa') IS DISTINCT FROM 'number'
    OR p_payload->>'revisione_attesa' !~ '^[0-9]+$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Revisione attesa obbligatoria';
  END IF;
  IF (p_payload->>'revisione_attesa')::bigint<>rev THEN
    RAISE EXCEPTION USING ERRCODE='PR412',MESSAGE='Revisione Rapportino obsoleta';
  END IF;
  ops:=p_payload->'prestazioni';
  IF jsonb_typeof(ops) IS DISTINCT FROM 'object' OR NOT (ops ?& ARRAY['nuove','aggiornate','rimosse'])
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(ops) z WHERE z NOT IN ('nuove','aggiornate','rimosse')) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazioni prestazioni non valide';
  END IF;
  FOREACH k IN ARRAY ARRAY['nuove','aggiornate','rimosse'] LOOP
    IF jsonb_typeof(ops->k) IS DISTINCT FROM 'array' OR jsonb_array_length(ops->k)>100 THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Array operazioni non valido';
    END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['nuove','aggiornate'] LOOP
    FOR x IN SELECT value FROM jsonb_array_elements(ops->k) LOOP
      IF jsonb_typeof(x) IS DISTINCT FROM 'object' OR NOT (x ?& ARRAY
        ['prestazione_id','chiave_client','operaio_id','ora_inizio','ora_fine','pausa_minuti','lavoro_in_economia','variante_id'])
        OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z WHERE z NOT IN
        ('prestazione_id','chiave_client','operaio_id','ora_inizio','ora_fine','pausa_minuti','lavoro_in_economia','variante_id'))
        OR jsonb_typeof(x->'chiave_client') IS DISTINCT FROM 'string'
        OR length(btrim(x->>'chiave_client')) NOT BETWEEN 1 AND 200
        OR x->>'chiave_client'<>btrim(x->>'chiave_client')
        OR jsonb_typeof(x->'lavoro_in_economia') IS DISTINCT FROM 'boolean'
        OR jsonb_typeof(x->'pausa_minuti') IS DISTINCT FROM 'number'
        OR x->>'pausa_minuti' !~ '^[0-9]+$'
        OR coalesce(x->>'ora_inizio','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        OR coalesce(x->>'ora_fine','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Prestazione non valida o campo autorevole client';
      END IF;
      IF x->>'chiave_client'=ANY(keys) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Chiave client ripetuta nel payload'; END IF;
      keys:=array_append(keys,x->>'chiave_client');
      oi:=(x->>'operaio_id')::uuid; vi:=(x->>'variante_id')::uuid;
      econ:=(x->>'lavoro_in_economia')::boolean;
      start_time:=(x->>'ora_inizio')::time; end_time:=(x->>'ora_fine')::time; pause:=(x->>'pausa_minuti')::integer;
      IF oi IS NULL OR (NOT econ AND vi IS NOT NULL) OR end_time<=start_time
        OR extract(epoch FROM (end_time-start_time))/60<=pause THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Intervallo o destinazione non validi';
      END IF;
      IF k='nuove' THEN
        IF x->'prestazione_id' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID nuovo assegnato dal server'; END IF;
        SELECT * INTO old FROM public.rapportino_prestazioni WHERE rapportino_id=rid AND chiave_client=x->>'chiave_client' FOR UPDATE;
        exists_key:=FOUND;
        IF exists_key THEN
          IF old.rimossa_at IS NOT NULL OR old.operaio_id IS DISTINCT FROM oi OR old.ora_inizio IS DISTINCT FROM start_time
            OR old.ora_fine IS DISTINCT FROM end_time OR old.pausa_minuti IS DISTINCT FROM pause
            OR old.lavoro_in_economia IS DISTINCT FROM econ OR old.variante_id IS DISTINCT FROM vi THEN
            RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Chiave client già usata per dati differenti';
          END IF;
        ELSE
          INSERT INTO public.rapportino_prestazioni(rapportino_id,operaio_id,chiave_client,ora_inizio,ora_fine,pausa_minuti,lavoro_in_economia,variante_id)
          VALUES(rid,oi,x->>'chiave_client',start_time,end_time,pause,econ,vi);
          changed:=true;
        END IF;
      ELSE
        pid:=(x->>'prestazione_id')::uuid;
        IF pid IS NULL OR pid=ANY(seen) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID aggiornamento non valido/ripetuto'; END IF;
        seen:=array_append(seen,pid);
        SELECT * INTO old FROM public.rapportino_prestazioni WHERE id=pid AND rapportino_id=rid FOR UPDATE;
        IF NOT FOUND OR old.rimossa_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Prestazione assente/rimossa/fuori Rapportino'; END IF;
        -- Revisione aggregata già verificata: nessun client può aggiornare una
        -- prestazione letta da una revisione obsoleta, senza cambiare DTO STEP 1.
        IF old.operaio_id IS DISTINCT FROM oi OR old.chiave_client IS DISTINCT FROM x->>'chiave_client' THEN
          RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Identità prestazione immutabile';
        END IF;
        UPDATE public.rapportino_prestazioni SET ora_inizio=start_time,ora_fine=end_time,
          pausa_minuti=pause,lavoro_in_economia=econ,variante_id=vi WHERE id=pid;
        changed:=true;
      END IF;
    END LOOP;
  END LOOP;
  FOR x IN SELECT value FROM jsonb_array_elements(ops->'rimosse') LOOP
    IF jsonb_typeof(x) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Rimozione per UUID richiesta'; END IF;
    pid:=(x#>>'{}')::uuid;
    IF pid=ANY(seen) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazioni ripetute su UUID'; END IF;
    seen:=array_append(seen,pid);
    UPDATE public.rapportino_prestazioni SET rimossa_at=clock_timestamp() WHERE id=pid AND rapportino_id=rid AND rimossa_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Prestazione da rimuovere assente'; END IF;
    changed:=true;
  END LOOP;
  IF changed OR ver=0 THEN
    UPDATE public.rapportini SET versione_prestazioni=1,revisione_prestazioni=rev+1 WHERE id=rid;
    rev:=rev+1;
  END IF;
  SELECT jsonb_build_object('versione_contratto',1,'rapportino_id',rid,'revisione',rev,
    'prestazioni',coalesce(jsonb_agg(jsonb_build_object(
      'prestazione_id',id,'chiave_client',chiave_client,'operaio_id',operaio_id,
      'ora_inizio',to_char(ora_inizio,'HH24:MI'),'ora_fine',to_char(ora_fine,'HH24:MI'),
      'pausa_minuti',pausa_minuti,'ore',ore,'lavoro_in_economia',lavoro_in_economia,
      'variante_id',variante_id,'revisione',revisione,'rimossa_at',rimossa_at) ORDER BY created_at,id),'[]'::jsonb))
    INTO out_result FROM public.rapportino_prestazioni WHERE rapportino_id=rid;
  INSERT INTO artecna_rapportini.richieste(utente_id,richiesta_id,rapportino_id,payload_sha256,risultato)
    VALUES(u,req,rid,h,out_result);
  RETURN out_result;
END;
$fn$;

GRANT SELECT,INSERT,UPDATE ON public.rapportino_prestazioni TO artecna_rapportini_rpc;
GRANT SELECT,INSERT ON artecna_rapportini.richieste TO artecna_rapportini_rpc;

-- Rimuove anche eventuali ACL ereditate da default privileges permissivi.
DO $acl$
DECLARE r record; g record;
BEGIN
  FOR r IN SELECT c.oid,c.relowner FROM pg_class c WHERE c.oid IN
    ('public.rapportino_prestazioni'::regclass,'artecna_rapportini.richieste'::regclass) LOOP
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC',r.oid::regclass);
    FOR g IN SELECT DISTINCT grantee FROM aclexplode(coalesce((SELECT relacl FROM pg_class WHERE oid=r.oid),acldefault('r',r.relowner)))
      WHERE grantee<>0 AND grantee NOT IN (r.relowner,'artecna_rapportini_rpc'::regrole::oid) LOOP
      EXECUTE format('REVOKE ALL ON TABLE %s FROM %I',r.oid::regclass,pg_get_userbyid(g.grantee));
    END LOOP;
  END LOOP;
  FOR r IN SELECT p.oid,p.proowner FROM pg_proc p WHERE p.pronamespace='artecna_rapportini'::regnamespace LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',r.oid::regprocedure);
    FOR g IN SELECT DISTINCT grantee FROM aclexplode(coalesce((SELECT proacl FROM pg_proc WHERE oid=r.oid),acldefault('f',r.proowner)))
      WHERE grantee<>0 AND grantee<>r.proowner LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',r.oid::regprocedure,pg_get_userbyid(g.grantee));
    END LOOP;
  END LOOP;
END;
$acl$;
GRANT EXECUTE ON FUNCTION artecna_rapportini.variante_del_cantiere(uuid,uuid) TO artecna_rapportini_rpc;
GRANT EXECUTE ON FUNCTION artecna_rapportini.applica_prestazioni_rapportino(jsonb) TO artecna_rapportini_rpc;
DO $postcheck$
DECLARE r text; t text; f record;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH t IN ARRAY ARRAY['public.rapportino_prestazioni','artecna_rapportini.richieste'] LOOP
      IF has_table_privilege(r,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
        RAISE EXCEPTION 'Privilegio client inatteso: % su %',r,t;
      END IF;
    END LOOP;
    IF pg_has_role(r,'artecna_rapportini_rpc','MEMBER') THEN RAISE EXCEPTION 'Membership client inattesa'; END IF;
    IF has_schema_privilege(r,'artecna_rapportini','USAGE,CREATE') THEN RAISE EXCEPTION 'Schema interno esposto al client'; END IF;
    FOR f IN SELECT oid FROM pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace LOOP
      IF has_function_privilege(r,f.oid,'EXECUTE') THEN RAISE EXCEPTION 'Helper interno esposto al client'; END IF;
    END LOOP;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_rapportini_rpc'
    AND (rolbypassrls OR rolcanlogin OR rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolinherit))
    OR has_column_privilege('artecna_rapportini_rpc','public.varianti_cantiere','id','SELECT')
    OR has_column_privilege('artecna_rapportini_rpc','public.varianti_cantiere','cantiere_id','SELECT') THEN
    RAISE EXCEPTION 'Privilegi Variante del dominio troppo ampi';
  END IF;
  -- Verifica tutti gli owner e le modalità, inclusi i trigger privilegiati.
  FOR f IN SELECT p.*,x.definer FROM (VALUES
    ('artecna_rapportini.applica_prestazioni_rapportino(jsonb)',false),
    ('artecna_rapportini.variante_del_cantiere(uuid,uuid)',true),
    ('artecna_rapportini.proteggi_prestazione()',true),
    ('artecna_rapportini.proteggi_cantiere_variante()',true),
    ('artecna_rapportini.proteggi_proiezione()',false),
    ('artecna_rapportini.proteggi_testata()',false)
  ) x(firma,definer) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(x.firma) LOOP
    IF f.oid IS NULL OR f.prosecdef IS DISTINCT FROM f.definer
      OR f.proowner IS DISTINCT FROM 'postgres'::regrole::oid
      OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] THEN
      RAISE EXCEPTION 'Owner/modalità/search_path helper divergenti';
    END IF;
  END LOOP;
  IF NOT has_function_privilege('artecna_rapportini_rpc',
    'artecna_rapportini.applica_prestazioni_rapportino(jsonb)','EXECUTE')
    OR has_schema_privilege('artecna_rapportini_rpc','artecna_rapportini','CREATE') THEN
    RAISE EXCEPTION 'Privilegi dominio divergenti';
  END IF;
  SELECT * INTO f FROM pg_proc WHERE oid='artecna_rapportini.variante_del_cantiere(uuid,uuid)'::regprocedure;
  IF NOT f.prosecdef OR f.proowner<>'postgres'::regrole::oid OR f.prorettype<>'boolean'::regtype::oid
    OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] THEN
    RAISE EXCEPTION 'Contratto helper Variante divergente';
  END IF;
END;
$postcheck$;
COMMIT;
