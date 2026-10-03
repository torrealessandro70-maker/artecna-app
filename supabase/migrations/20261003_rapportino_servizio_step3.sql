-- STEP 3: applicazione manuale integrale come postgres, dopo STEP 2.
-- Nessun backfill, nessuna migrazione client, nessun trasferimento ownership.
-- Unico writer strutturato pubblico: salva_rapportino_con_prestazioni.
-- Il costo interno è una fotografia dell'Anagrafica, mai una tariffa modificabile.
BEGIN;
DO $preflight$
DECLARE x record;
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres' THEN
    RAISE EXCEPTION 'Installazione riservata a postgres';
  END IF;
  IF to_regprocedure('artecna_rapportini.applica_prestazioni_rapportino(jsonb)') IS NULL
    OR to_regclass('artecna_rapportini.sessioni_portale') IS NOT NULL THEN
    RAISE EXCEPTION 'STEP 2 assente oppure STEP 3 già presente';
  END IF;
  -- Il remoto certificato contiene zero prestazioni: nessuna tariffa storica
  -- viene inventata per prestazioni preesistenti.
  IF EXISTS(SELECT 1 FROM public.rapportino_prestazioni) THEN
    RAISE EXCEPTION 'Prestazioni già presenti: necessaria decisione sul costo storico, nessun backfill';
  END IF;
  IF EXISTS(SELECT 1 FROM artecna_rapportini.richieste) THEN
    RAISE EXCEPTION 'Richieste STEP 2 già presenti: verificare compatibilità risultati prima di installare STEP 3';
  END IF;
  FOR x IN SELECT * FROM (VALUES
    ('operai','costo_orario','numeric(10,2)'),('operai','nome','text'),
    ('operai','stato','text'),('operai','accesso_portale','boolean'),('operai','pin','text'),
    ('cantieri','nome','text'),('cantieri','lavori_conclusi','boolean'),
    ('rapportini','cantiere','text'),('rapportini','ore','text'),('rapportini','operai','text'),
    ('rapportini','numero_presenti','text'),('rapportini','ore_per_operaio','text'),
    ('rapportini','note','text'),('rapportini','materiali','text'),('rapportini','quantita_materiali','text'),
    ('rapportini','compilato_da_operaio_id','uuid'),('rapportini','compilato_da_nome','text'),
    ('timbrature','operaio_nome','text'),('timbrature','cantiere','text'),('timbrature','stato','text')
  ) v(tabella,colonna,tipo) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.'||x.tabella)
      AND attname=x.colonna AND NOT attisdropped AND format_type(atttypid,atttypmod)=x.tipo) THEN
      RAISE EXCEPTION 'Schema incompatibile: %.% atteso %',x.tabella,x.colonna,x.tipo;
    END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    RAISE EXCEPTION 'Ruolo server service_role assente';
  END IF;
END;
$preflight$;

ALTER TABLE public.rapportino_prestazioni ADD COLUMN costo_orario_interno_storico numeric(10,2) NOT NULL
  CHECK(costo_orario_interno_storico>=0 AND costo_orario_interno_storico::text NOT IN ('NaN','Infinity','-Infinity'));
COMMENT ON COLUMN public.rapportino_prestazioni.costo_orario_interno_storico IS
  'Fotografia immutabile di operai.costo_orario alla creazione; zero valido, NULL vietato. Non è tariffa cliente.';
CREATE FUNCTION artecna_rapportini.fotografa_costo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.costo_orario_interno_storico IS DISTINCT FROM OLD.costo_orario_interno_storico THEN
      RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Costo storico prestazione immutabile';
    END IF;
  ELSE
    IF NEW.costo_orario_interno_storico IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Costo prestazione assegnato esclusivamente dal server';
    END IF;
    -- FOR SHARE serializza la fotografia con modifiche concurrenti in Anagrafica.
    SELECT costo_orario INTO NEW.costo_orario_interno_storico FROM public.operai
      WHERE id=NEW.operaio_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operaio inesistente'; END IF;
    IF NEW.costo_orario_interno_storico IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Costo orario operaio non valorizzato';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
CREATE TRIGGER rapportino_prestazioni_costo_storico BEFORE INSERT OR UPDATE ON public.rapportino_prestazioni
  FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.fotografa_costo();

CREATE TABLE artecna_rapportini.sessioni_portale (
  token_sha256 bytea PRIMARY KEY CHECK(octet_length(token_sha256)=32),
  operaio_id uuid NOT NULL REFERENCES public.operai(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  scade_at timestamptz NOT NULL,
  revocata_at timestamptz,
  CHECK(scade_at>created_at)
);
ALTER TABLE artecna_rapportini.sessioni_portale ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timbrature ADD CONSTRAINT timbrature_prestazione_stato
  CHECK(prestazione_rapportino_id IS NULL OR stato IS NOT DISTINCT FROM 'da rapportino');
CREATE UNIQUE INDEX timbrature_prestazione_rapportino_unica ON public.timbrature(prestazione_rapportino_id)
  WHERE prestazione_rapportino_id IS NOT NULL;
-- Nessuna policy client o ruolo interno: esclusivamente funzioni owner postgres.
-- Separa il namespace di idempotenza JWT da quello dei lavoratori del portale.
ALTER TABLE artecna_rapportini.richieste ADD COLUMN canale text NOT NULL DEFAULT 'desktop'
  CHECK(canale IN ('desktop','portale'));
ALTER TABLE artecna_rapportini.richieste DROP CONSTRAINT richieste_pkey,
  ADD PRIMARY KEY(canale,utente_id,richiesta_id);

CREATE FUNCTION artecna_rapportini.autorizza(p_sessione text,p_cantiere uuid DEFAULT NULL)
RETURNS TABLE(identita uuid,canale text,compilatore_nome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
BEGIN
  IF p_sessione IS NOT NULL THEN
    IF p_sessione !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Sessione portale non valida';
    END IF;
    SELECT o.id,'portale',o.nome INTO identita,canale,compilatore_nome
      FROM artecna_rapportini.sessioni_portale s JOIN public.operai o ON o.id=s.operaio_id
      WHERE s.token_sha256=sha256(convert_to(p_sessione,'UTF8'))
        AND s.revocata_at IS NULL AND s.scade_at>clock_timestamp()
        AND o.accesso_portale IS TRUE AND o.stato IS DISTINCT FROM 'sospeso'
      FOR SHARE OF s,o;
    IF identita IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Sessione portale assente, scaduta o operaio non abilitato';
    END IF;
  ELSE
    identita:=artecna_guardie.utente_jwt_corrente(); canale:='desktop'; compilatore_nome:=NULL;
    IF identita IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Identità obbligatoria'; END IF;
  END IF;
  IF p_cantiere IS NOT NULL THEN
    PERFORM 1 FROM public.cantieri WHERE id=p_cantiere
      AND (canale='desktop' OR lavori_conclusi IS DISTINCT FROM true) FOR SHARE;
    IF NOT FOUND OR (canale='desktop' AND
      artecna_guardie.utente_puo_modificare_cantiere(identita,p_cantiere) IS DISTINCT FROM true) THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito';
    END IF;
  END IF;
  RETURN NEXT;
END;
$fn$;

-- Solo backend: mai anon/authenticated. Il token casuale è generato da Node,
-- conservato soltanto in cookie HttpOnly; nel database viene salvato il digest.
CREATE FUNCTION public.crea_sessione_rapportino(p_pin text,p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE o record; n integer;
BEGIN
  IF p_pin IS NULL OR length(p_pin) NOT BETWEEN 1 AND 100 OR p_token IS NULL
    OR p_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Richiesta accesso non valida';
  END IF;
  SELECT count(*) INTO n FROM public.operai WHERE pin=p_pin;
  IF n<>1 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='PIN non valido'; END IF;
  SELECT id,nome,accesso_portale,stato INTO o FROM public.operai WHERE pin=p_pin FOR SHARE;
  IF o.accesso_portale IS DISTINCT FROM true OR o.stato='sospeso' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Operaio non abilitato';
  END IF;
  INSERT INTO artecna_rapportini.sessioni_portale(token_sha256,operaio_id,scade_at)
    VALUES(sha256(convert_to(p_token,'UTF8')),o.id,clock_timestamp()+interval '8 hours');
  RETURN jsonb_build_object('operaio',jsonb_build_object('id',o.id,'nome',o.nome),
    'operai',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'nome',nome) ORDER BY nome,id),'[]')
      FROM public.operai WHERE stato IS DISTINCT FROM 'sospeso'),
    'cantieri',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'nome',nome) ORDER BY nome,id),'[]')
      FROM public.cantieri WHERE lavori_conclusi IS DISTINCT FROM true));
END;
$fn$;
CREATE FUNCTION public.verifica_sessione_rapportino(p_sessione text,p_cantiere_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE a record;
BEGIN
  IF p_sessione IS NULL OR p_cantiere_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Sessione e cantiere obbligatori';
  END IF;
  SELECT * INTO a FROM artecna_rapportini.autorizza(p_sessione,p_cantiere_id);
  RETURN jsonb_build_object('id',a.identita,'nome',a.compilatore_nome);
END;
$fn$;
CREATE FUNCTION public.varianti_rapportino_portale(p_sessione text,p_cantiere_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
BEGIN
  PERFORM public.verifica_sessione_rapportino(p_sessione,p_cantiere_id);
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'numero',numero,
    'etichetta',titolo,'selezionabile',stato IN ('bozza','proposta')) ORDER BY numero NULLS LAST,id),'[]')
    FROM public.varianti_cantiere WHERE cantiere_id=p_cantiere_id);
END;
$fn$;

-- La UI legacy può continuare a scrivere documenti versione 0, ma non può
-- alterare/cancellare testate o proiezioni strutturate attraverso ACL legacy.
CREATE FUNCTION artecna_rapportini.proteggi_strutturato() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE protetto boolean;
BEGIN
  IF current_user IN ('postgres','artecna_rapportini_rpc') THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_TABLE_NAME='rapportini' THEN
    protetto:=OLD.versione_prestazioni=1;
  ELSE
    SELECT EXISTS(SELECT 1 FROM public.rapportini WHERE versione_prestazioni=1 AND
      ((TG_OP<>'INSERT' AND id=OLD.rapportino_id) OR (TG_OP<>'DELETE' AND id=NEW.rapportino_id))) INTO protetto;
  END IF;
  IF protetto THEN RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Rapportino strutturato: usare il servizio unico'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$fn$;
CREATE TRIGGER rapportino_strutturato_guardia BEFORE UPDATE OR DELETE ON public.rapportini
  FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.proteggi_strutturato();
CREATE TRIGGER timbratura_strutturata_guardia BEFORE INSERT OR UPDATE OR DELETE ON public.timbrature
  FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.proteggi_strutturato();

-- Solo nuovi collegamenti/cambi di destinazione: quelli esistenti restano validi.
-- Il lock impedisce un cambio di stato concorrente durante il collegamento.
CREATE FUNCTION artecna_rapportini.verifica_nuovo_collegamento_variante(p_variante uuid,p_cantiere uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE v record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('rapportino-variante:'||p_variante::text,0));
  SELECT cantiere_id,stato INTO v FROM public.varianti_cantiere WHERE id=p_variante FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Variante inesistente';
  END IF;
  IF v.cantiere_id IS DISTINCT FROM p_cantiere OR v.stato NOT IN ('bozza','proposta') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Nuovo collegamento consentito solo a Variante dello stesso cantiere in bozza o proposta';
  END IF;
END;
$fn$;

-- Il dominio STEP 2 è ridefinito mantenendo validazioni/UUID/lock/guardie,
-- con identità portale, namespace idempotenza e regola nuovi collegamenti.
CREATE OR REPLACE FUNCTION artecna_rapportini.applica_prestazioni_rapportino(p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE
  u uuid; channel text; actor record; rid uuid; req uuid; c uuid; rev bigint; ver smallint; h bytea;
  prev artecna_rapportini.richieste%rowtype; old public.rapportino_prestazioni%rowtype;
  ops jsonb; x jsonb; k text; pid uuid; seen uuid[]:='{}'; keys text[]:='{}';
  oi uuid; vi uuid; econ boolean; start_time time; end_time time; pause integer;
  out_result jsonb; current_row record; changed boolean:=false; exists_key boolean;
BEGIN
  SELECT * INTO actor FROM artecna_rapportini.autorizza(nullif(current_setting('artecna.rapportino_sessione',true),''),(p_payload->>'cantiere_id')::uuid);
  u:=actor.identita; channel:=actor.canale;
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
    actor.identita IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Rapportino/owner non autorizzato';
  END IF;
  -- Serializza retry dello stesso utente/richiesta anche su Rapportini diversi.
  PERFORM pg_advisory_xact_lock(hashtextextended(channel||u::text||req::text,0));
  h:=sha256(convert_to(p_payload::text,'UTF8'));
  SELECT * INTO prev FROM artecna_rapportini.richieste WHERE canale=channel AND utente_id=u AND richiesta_id=req;
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
          IF vi IS NOT NULL THEN PERFORM artecna_rapportini.verifica_nuovo_collegamento_variante(vi,c); END IF;
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
        IF vi IS NOT NULL AND vi IS DISTINCT FROM old.variante_id THEN
          PERFORM artecna_rapportini.verifica_nuovo_collegamento_variante(vi,c);
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
  INSERT INTO artecna_rapportini.richieste(canale,utente_id,richiesta_id,rapportino_id,payload_sha256,risultato)
    VALUES(channel,u,req,rid,h,out_result);
  RETURN out_result;
END;
$fn$;

-- Funzione pubblica unica. La sessione mobile è fornita dal backend, il JWT
-- desktop è verificato da PostgREST; nessun ID compilatore nel contratto.
CREATE FUNCTION public.salva_rapportino_con_prestazioni(p_payload jsonb,p_sessione text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE
  a record; r public.rapportini%rowtype; rid uuid; req uuid; c uuid; giorno date;
  prev artecna_rapportini.richieste%rowtype; h bytea; result jsonb; dominio jsonb;
  documento jsonb; costo numeric; ore_totali numeric; presenti integer; elenco text;
  context_before text; x record;
BEGIN
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

-- ACL esplicite anche in presenza di default privileges legacy permissivi.
DO $acl$
DECLARE f record; g record;
BEGIN
  REVOKE ALL ON artecna_rapportini.sessioni_portale FROM PUBLIC;
  FOR g IN SELECT DISTINCT grantee FROM aclexplode((SELECT relacl FROM pg_class
    WHERE oid='artecna_rapportini.sessioni_portale'::regclass)) WHERE grantee<>0 AND grantee<>'postgres'::regrole::oid LOOP
    EXECUTE format('REVOKE ALL ON artecna_rapportini.sessioni_portale FROM %I',pg_get_userbyid(g.grantee));
  END LOOP;
  FOR f IN SELECT oid FROM pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace
    OR oid IN ('public.crea_sessione_rapportino(text,text)'::regprocedure,
      'public.verifica_sessione_rapportino(text,uuid)'::regprocedure,
      'public.varianti_rapportino_portale(text,uuid)'::regprocedure,
      'public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.oid::regprocedure);
    FOR g IN SELECT DISTINCT grantee FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid=f.oid))
      WHERE grantee<>0 AND grantee<>'postgres'::regrole::oid LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',f.oid::regprocedure,pg_get_userbyid(g.grantee));
    END LOOP;
  END LOOP;
END;
$acl$;
GRANT EXECUTE ON FUNCTION artecna_rapportini.variante_del_cantiere(uuid,uuid),
  artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid),
  artecna_rapportini.autorizza(text,uuid),artecna_rapportini.applica_prestazioni_rapportino(jsonb) TO artecna_rapportini_rpc;
GRANT EXECUTE ON FUNCTION public.crea_sessione_rapportino(text,text),
  public.verifica_sessione_rapportino(text,uuid),public.varianti_rapportino_portale(text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.salva_rapportino_con_prestazioni(jsonb,text) TO authenticated,service_role;
DO $postcheck$
DECLARE r text; f record;
BEGIN
  IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN ('public.rapportino_prestazioni'::regclass,
    'artecna_rapportini.richieste'::regclass,'artecna_rapportini.sessioni_portale'::regclass) AND NOT relrowsecurity) THEN
    RAISE EXCEPTION 'RLS tabelle strutturate/sessioni non attiva';
  END IF;
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_table_privilege(r,'public.rapportino_prestazioni','SELECT,INSERT,UPDATE,DELETE')
      OR has_table_privilege(r,'artecna_rapportini.richieste','SELECT,INSERT,UPDATE,DELETE')
      OR has_table_privilege(r,'artecna_rapportini.sessioni_portale','SELECT,INSERT,UPDATE,DELETE')
      OR pg_has_role(r,'artecna_rapportini_rpc','MEMBER')
      OR has_schema_privilege(r,'artecna_rapportini','USAGE,CREATE') THEN
      RAISE EXCEPTION 'ACL/membership client inattese: %',r;
    END IF;
    FOR f IN SELECT oid FROM pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace LOOP
      IF has_function_privilege(r,f.oid,'EXECUTE') THEN RAISE EXCEPTION 'Helper interno esposto'; END IF;
    END LOOP;
    IF has_function_privilege(r,'public.crea_sessione_rapportino(text,text)','EXECUTE')
      OR has_function_privilege(r,'public.verifica_sessione_rapportino(text,uuid)','EXECUTE')
      OR has_function_privilege(r,'public.varianti_rapportino_portale(text,uuid)','EXECUTE') THEN
      RAISE EXCEPTION 'RPC sessione riservate al backend';
    END IF;
  END LOOP;
  IF has_function_privilege('anon','public.salva_rapportino_con_prestazioni(jsonb,text)','EXECUTE')
    OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_rapportini_rpc' AND
      (rolcanlogin OR rolsuper OR rolbypassrls OR rolinherit OR rolcreaterole OR rolcreatedb OR rolreplication)) THEN
    RAISE EXCEPTION 'Writer anon o ruolo interno insicuro';
  END IF;
  IF NOT has_function_privilege('authenticated','public.salva_rapportino_con_prestazioni(jsonb,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.salva_rapportino_con_prestazioni(jsonb,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Writer completo non disponibile ai ruoli previsti';
  END IF;
  FOR f IN SELECT * FROM pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace OR oid IN
    ('public.crea_sessione_rapportino(text,text)'::regprocedure,'public.verifica_sessione_rapportino(text,uuid)'::regprocedure,
     'public.varianti_rapportino_portale(text,uuid)'::regprocedure,'public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure) LOOP
    IF f.proowner<>'postgres'::regrole::oid OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[] THEN
      RAISE EXCEPTION 'Owner/search_path divergenti';
    END IF;
    IF f.prosecdef IS DISTINCT FROM (f.proname NOT IN
      ('applica_prestazioni_rapportino','proteggi_proiezione','proteggi_testata','proteggi_strutturato')) THEN
      RAISE EXCEPTION 'Modalità DEFINER/INVOKER divergenti';
    END IF;
  END LOOP;
END;
$postcheck$;
COMMIT;
