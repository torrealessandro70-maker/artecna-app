BEGIN;
-- RPC atomica. Nessuna Storage API, worker o frontend. Non applicata da questo file-tool.
-- P2111 input; P2112 autorizzazione; P2113 dipendenze/cicli; P2114 post-check.
-- Preflight read-only dei nomi certificati dal DB e dalle migration Varianti.
-- Tutte le 27 FK del manifest hanno ON DELETE certificato e verificato.
-- Non certifica l'assenza di altre dipendenze, ne immutabilita futura dello schema.

DO $preflight$
DECLARE
  r record;
  v_tabella oid;
  v_padre oid;
  v_colonna smallint;
  v_colonna_padre smallint;
  v_tipo oid;
  v_fk record;
  v_funzione oid;
  v_trigger record;
  v_ruolo oid;
  v_owner oid;
BEGIN
  -- Identita UUID: cantieri.id, mai cantieri.cantiere_id.
  -- Tipi esatti; nessun requisito aggiuntivo di nullabilita.
  FOR r IN
    SELECT * FROM (VALUES
      ('cantieri', 'id', 'uuid'),
      ('rapportini', 'cantiere_id', 'uuid'),
      ('foto_cantiere', 'cantiere_id', 'uuid'),
      ('timbrature', 'cantiere_id', 'uuid'),
      ('materiali_cantiere', 'cantiere_id', 'uuid'),
      ('attrezzi_cantiere', 'cantiere_id', 'uuid'),
      ('pagamenti_fornitori', 'cantiere_id', 'uuid'),
      ('acconti_cantiere', 'cantiere_id', 'uuid'),
      ('fatture_emesse', 'cantiere_id', 'uuid'),
      ('fatture_fornitori_righe', 'cantiere_id', 'uuid'),
      ('incassi_non_fatturati', 'cantiere_id', 'uuid'),
      ('preventivi_cantiere', 'cantiere_id', 'uuid'),
      ('preventivo_lavorazioni', 'cantiere_id', 'uuid'),
      ('sal_lavorazioni', 'cantiere_id', 'uuid'),
      ('varianti_cantiere', 'cantiere_id', 'uuid'),
      ('utenti_cantiere', 'cantiere_id', 'uuid'),
      ('varianti_cantiere', 'id', 'uuid'),
      ('variante_lavorazioni', 'id', 'int8'),
      ('variante_lavorazioni', 'variante_id', 'uuid'),
      ('variante_sorgenti', 'id', 'uuid'),
      ('variante_sorgenti', 'variante_id', 'uuid'),
      ('variante_documenti', 'variante_id', 'uuid')
    ) AS m(tabella, colonna, tipo)
  LOOP
    v_tabella := pg_catalog.to_regclass(pg_catalog.format('public.%I', r.tabella));
    IF v_tabella IS NULL OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class WHERE oid = v_tabella AND relkind IN ('r', 'p')
    ) THEN
      RAISE EXCEPTION 'Preflight: tabella public.% mancante o non tabella', r.tabella;
    END IF;
    SELECT a.atttypid INTO v_tipo FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = v_tabella AND a.attname = r.colonna
        AND a.attnum > 0 AND NOT a.attisdropped;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Preflight: colonna public.%.% mancante', r.tabella, r.colonna;
    END IF;
    IF v_tipo IS DISTINCT FROM pg_catalog.to_regtype('pg_catalog.' || r.tipo)::oid THEN
      RAISE EXCEPTION 'Preflight: tipo public.%.% incompatibile: atteso %, trovato %',
        r.tabella, r.colonna, r.tipo, pg_catalog.format_type(v_tipo, NULL);
    END IF;
  END LOOP;

  -- Colonne dei riferimenti fisici: solo esistenza, senza leggere file o valori.
  FOR r IN
    SELECT * FROM (VALUES
      ('preventivi_cantiere', 'file_path'),
      ('foto_cantiere', 'file_path'),
      ('materiali_cantiere', 'file_path'),
      ('attrezzi_cantiere', 'file_path'),
      ('variante_documenti', 'storage_path')
    ) AS m(tabella, colonna)
  LOOP
    v_tabella := pg_catalog.to_regclass(pg_catalog.format('public.%I', r.tabella));
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = v_tabella AND a.attname = r.colonna
        AND a.attnum > 0 AND NOT a.attisdropped
    ) THEN
      RAISE EXCEPTION 'Preflight: colonna Storage public.%.% mancante', r.tabella, r.colonna;
    END IF;
  END LOOP;

  -- codici pg_constraint.confdeltype: a=NO ACTION, r=RESTRICT, c=CASCADE.
  -- Estremi e colonne esatti, FK monocolonna, nome esatto, validazione obbligatoria.
  FOR r IN
    SELECT * FROM (VALUES
      ('cantieri', 'cantieri_preventivo_contrattuale_id_fkey', 'preventivo_contrattuale_id', 'preventivi_cantiere', 'id', 'r'),
      ('preventivi_cantiere', 'preventivi_cantiere_cantiere_id_fkey', 'cantiere_id', 'cantieri', 'id', 'a'),
      ('varianti_cantiere', 'varianti_cantiere_cantiere_fk', 'cantiere_id', 'cantieri', 'id', 'r'),
      ('varianti_cantiere', 'varianti_cantiere_contratto_fk', 'preventivo_contrattuale_id', 'preventivi_cantiere', 'id', 'r'),
      ('sal_lavorazioni', 'sal_lavorazioni_source_lavorazione_id_fkey', 'source_lavorazione_id', 'preventivo_lavorazioni', 'id', 'r'),
      ('sal_lavorazioni', 'sal_lavorazioni_variante_source_fk', 'source_variante_lavorazione_id', 'variante_lavorazioni', 'id', 'r'),
      ('variante_lavorazioni', 'variante_lavorazioni_variante_fk', 'variante_id', 'varianti_cantiere', 'id', 'r'),
      ('variante_lavorazioni', 'variante_lavorazioni_sorgente_fk', 'variante_sorgente_id', 'variante_sorgenti', 'id', 'r'),
      ('variante_lavorazioni', 'variante_lavorazioni_preventivo_fk', 'riferimento_preventivo_lavorazione_id', 'preventivo_lavorazioni', 'id', 'r'),
      ('variante_lavorazioni', 'variante_lavorazioni_precedente_fk', 'riferimento_variante_lavorazione_id', 'variante_lavorazioni', 'id', 'r'),
      ('variante_documenti', 'variante_documenti_variante_fk', 'variante_id', 'varianti_cantiere', 'id', 'r'),
      ('variante_sorgenti', 'variante_sorgenti_variante_fk', 'variante_id', 'varianti_cantiere', 'id', 'r'),
      ('utenti_cantiere', 'utenti_cantiere_cantiere_fkey', 'cantiere_id', 'cantieri', 'id', 'c'),
      ('preventivo_lavorazioni', 'preventivo_lavorazioni_preventivo_id_fkey', 'preventivo_id', 'preventivi_cantiere', 'id', 'r'),
      ('variante_sorgenti', 'variante_sorgenti_preventivo_fk', 'preventivo_sorgente_id', 'preventivi_cantiere', 'id', 'r'),
      ('rapportini', 'rapportini_cantiere_id_fkey', 'cantiere_id', 'cantieri', 'id', 'a'),
      ('foto_cantiere', 'foto_cantiere_cantiere_id_fkey', 'cantiere_id', 'cantieri', 'id', 'a'),
      ('timbrature', 'timbrature_cantiere_id_fkey', 'cantiere_id', 'cantieri', 'id', 'a'),
      ('materiali_cantiere', 'materiali_cantiere_cantiere_id_fkey', 'cantiere_id', 'cantieri', 'id', 'a'),
      ('attrezzi_cantiere', 'attrezzi_cantiere_cantiere_id_fkey', 'cantiere_id', 'cantieri', 'id', 'a'),
      ('pagamenti_fornitori', 'pagamenti_fornitori_cantiere_id_fkey', 'cantiere_id', 'cantieri', 'id', 'a'),
      ('acconti_cantiere', 'acconti_cantiere_cantiere_id_fkey', 'cantiere_id', 'cantieri', 'id', 'a'),
      ('sal_lavorazioni', 'sal_lavorazioni_cantiere_id_fkey', 'cantiere_id', 'cantieri', 'id', 'a'),
      ('preventivo_lavorazioni', 'preventivo_lavorazioni_cantiere_id_fkey', 'cantiere_id', 'cantieri', 'id', 'a'),
      ('fatture_fornitori_righe', 'fatture_fornitori_righe_cantiere_id_fkey', 'cantiere_id', 'cantieri', 'id', 'a'),
      ('fatture_emesse', 'fatture_emesse_cantiere_id_fkey', 'cantiere_id', 'cantieri', 'id', 'a'),
      ('incassi_non_fatturati', 'incassi_non_fatturati_cantiere_id_fkey', 'cantiere_id', 'cantieri', 'id', 'a')
    ) AS m(tabella, vincolo, colonna, padre, colonna_padre, azione)
  LOOP
    v_tabella := pg_catalog.to_regclass(pg_catalog.format('public.%I', r.tabella));
    v_padre := pg_catalog.to_regclass(pg_catalog.format('public.%I', r.padre));
    IF v_tabella IS NULL OR v_padre IS NULL THEN
      RAISE EXCEPTION 'Preflight FK %: tabella public.% o public.% mancante', r.vincolo, r.tabella, r.padre;
    END IF;
    SELECT a.attnum INTO v_colonna FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = v_tabella AND a.attname = r.colonna AND a.attnum > 0 AND NOT a.attisdropped;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Preflight FK %: colonna public.%.% mancante', r.vincolo, r.tabella, r.colonna;
    END IF;
    SELECT a.attnum INTO v_colonna_padre FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = v_padre AND a.attname = r.colonna_padre AND a.attnum > 0 AND NOT a.attisdropped;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Preflight FK %: colonna public.%.% mancante', r.vincolo, r.padre, r.colonna_padre;
    END IF;
    SELECT k.* INTO v_fk FROM pg_catalog.pg_constraint k
      WHERE k.conrelid = v_tabella AND k.conname = r.vincolo;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Preflight: FK public.%.% mancante', r.tabella, r.vincolo;
    END IF;
    IF v_fk.contype IS DISTINCT FROM 'f' OR v_fk.confrelid IS DISTINCT FROM v_padre
      OR v_fk.conkey IS DISTINCT FROM ARRAY[v_colonna]::smallint[]
      OR v_fk.confkey IS DISTINCT FROM ARRAY[v_colonna_padre]::smallint[] THEN
      RAISE EXCEPTION 'Preflight: definizione FK public.%.% incompatibile: %',
        r.tabella, r.vincolo, pg_catalog.pg_get_constraintdef(v_fk.oid, true);
    END IF;
    IF v_fk.convalidated IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Preflight: FK public.%.% non validata', r.tabella, r.vincolo;
    END IF;
    IF r.azione IS NOT NULL AND v_fk.confdeltype::text IS DISTINCT FROM r.azione THEN
      RAISE EXCEPTION 'Preflight: ON DELETE FK public.%.% incompatibile: atteso codice %, trovato %',
        r.tabella, r.vincolo, r.azione, v_fk.confdeltype;
    END IF;
  END LOOP;

  -- Legame trigger/funzione esatto. Solo O (origin) e A (always) sono abilitati
  -- per il normale percorso applicativo; R (replica-only) e D sono rifiutati.
  FOR r IN
    SELECT * FROM (VALUES
      ('cantieri', 'guardia_contrattuale_cantiere', 'proteggi_contrattuale_cantiere'),
      ('preventivi_cantiere', 'guardia_preventivo_base', 'proteggi_preventivo_base'),
      ('preventivo_lavorazioni', 'guardia_lavorazione_base', 'proteggi_lavorazione_base'),
      ('varianti_cantiere', 'guardia_variante_testata', 'proteggi_variante_testata'),
      ('variante_lavorazioni', 'guardia_variante_lavorazioni', 'proteggi_variante_figlio'),
      ('variante_documenti', 'guardia_variante_documenti', 'proteggi_variante_figlio')
    ) AS m(tabella, nome_trigger, funzione)
  LOOP
    v_tabella := pg_catalog.to_regclass(pg_catalog.format('public.%I', r.tabella));
    v_funzione := pg_catalog.to_regprocedure(pg_catalog.format('artecna_guardie.%I()', r.funzione));
    IF v_funzione IS NULL OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc WHERE oid = v_funzione AND prokind = 'f'
        AND prorettype = 'pg_catalog.trigger'::regtype
    ) THEN
      RAISE EXCEPTION 'Preflight: funzione guardia artecna_guardie.%() mancante o incompatibile', r.funzione;
    END IF;
    SELECT t.* INTO v_trigger FROM pg_catalog.pg_trigger t
      WHERE t.tgrelid = v_tabella AND t.tgname = r.nome_trigger AND NOT t.tgisinternal;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Preflight: trigger public.%.% mancante', r.tabella, r.nome_trigger;
    END IF;
    IF v_trigger.tgfoid IS DISTINCT FROM v_funzione THEN
      RAISE EXCEPTION 'Preflight: funzione trigger public.%.% incompatibile', r.tabella, r.nome_trigger;
    END IF;
    IF v_trigger.tgenabled NOT IN ('O', 'A') THEN
      RAISE EXCEPTION 'Preflight: trigger public.%.% non abilitato sul percorso origin: %',
        r.tabella, r.nome_trigger, v_trigger.tgenabled;
    END IF;
    -- Le guardie DELETE devono restare DELETE; quella contrattuale deve restare UPDATE.
    IF (v_trigger.tgtype::integer & CASE WHEN r.tabella = 'cantieri' THEN 16 ELSE 8 END) = 0 THEN
      RAISE EXCEPTION 'Preflight: evento trigger public.%.% incompatibile', r.tabella, r.nome_trigger;
    END IF;
  END LOOP;

  FOR r IN
    SELECT * FROM (VALUES
      ('artecna_guardie.utente_jwt_corrente()', 'uuid'),
      ('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)', 'bool')
    ) AS m(firma, tipo)
  LOOP
    v_funzione := pg_catalog.to_regprocedure(r.firma);
    IF v_funzione IS NULL OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc WHERE oid = v_funzione AND prokind = 'f'
        AND prorettype = pg_catalog.to_regtype('pg_catalog.' || r.tipo)
    ) THEN
      RAISE EXCEPTION 'Preflight: helper % mancante o ritorno incompatibile (atteso %)', r.firma, r.tipo;
    END IF;
  END LOOP;

  SELECT oid INTO v_ruolo FROM pg_catalog.pg_roles WHERE rolname = 'artecna_cantieri_rpc';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Preflight: ruolo artecna_cantieri_rpc mancante';
  END IF;
  v_funzione := pg_catalog.to_regprocedure('public.crea_cantiere_con_owner(text,double precision)');
  IF v_funzione IS NULL THEN
    RAISE EXCEPTION 'Preflight: funzione public.crea_cantiere_con_owner(text,double precision) mancante';
  END IF;
  SELECT proowner INTO v_owner FROM pg_catalog.pg_proc WHERE oid = v_funzione AND prokind = 'f';
  IF NOT FOUND OR v_owner IS DISTINCT FROM v_ruolo THEN
    RAISE EXCEPTION 'Preflight: owner public.crea_cantiere_con_owner(text,double precision) incompatibile: atteso artecna_cantieri_rpc';
  END IF;
END;
$preflight$;

DO $install$
DECLARE
  r record;
  p pg_catalog.pg_proc%ROWTYPE;
  ns_prima jsonb;
  contesto_prima jsonb;
  funzioni_prima jsonb;
  trigger_prima jsonb;
  v_colonne smallint[];
  v_config_atteso text[];
  v_acl_public jsonb;
  v_membership jsonb;

  v_newrole oid;
  v_role_shared jsonb;
  v_member_shared jsonb;
  v_member_created jsonb;
  v_temp_member_prima jsonb;
  v_table_acl jsonb;
  v_proc_before pg_catalog.pg_proc%rowtype;
  v_proc_after pg_catalog.pg_proc%rowtype;
  v_src_new text;
  v_src_expected text;
  v_def text;
  v_delim text;
  v_anchor text;
  v_matches text[];
  v_position integer;
  v_selfgrant text;
  v_snapshot record;
  v_acl_before jsonb;
  v_acl_after jsonb;
  v_guardie_namespace jsonb;
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
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='preventivi' AND public=true) THEN
    RAISE EXCEPTION 'Bucket preventivi certificato assente o non pubblico';
  END IF;
  SELECT jsonb_agg(to_jsonb(f) ORDER BY f.oid) INTO funzioni_prima FROM pg_catalog.pg_proc f
    JOIN pg_catalog.pg_namespace n ON n.oid=f.pronamespace
    WHERE n.nspname IN ('artecna_distruzione','artecna_guardie') OR f.proowner='artecna_cantieri_rpc'::regrole;
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) INTO trigger_prima FROM pg_catalog.pg_trigger t;


  -- P2111-P2114: verificati liberi nel repository; controllo anche le funzioni installate.
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc f JOIN pg_catalog.pg_namespace n ON n.oid=f.pronamespace
    WHERE n.nspname IN ('public','artecna_guardie','artecna_distruzione') AND f.prosrc ~ 'P211[1-4]') THEN
    RAISE EXCEPTION 'SQLSTATE P2111-P2114 gia presenti nel DB';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc f JOIN pg_catalog.pg_namespace n ON n.oid=f.pronamespace
    WHERE n.nspname='public' AND f.proname='elimina_cantiere_definitivamente')
     OR to_regprocedure('artecna_distruzione.impronta_cleanup_storage(uuid,bigint)') IS NOT NULL
     OR to_regprocedure('artecna_distruzione.owner_autorizzato(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'RPC/helper micro-step 4 gia presenti';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='artecna_cantieri_rpc'
    AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND rolbypassrls)
     OR pg_has_role('authenticated','artecna_cantieri_rpc','MEMBER') OR pg_has_role('anon','artecna_cantieri_rpc','MEMBER') THEN
    RAISE EXCEPTION 'Ruolo tecnico/RLS non conforme; nessun attributo ruolo viene modificato';
  END IF;
  FOR r IN SELECT * FROM (VALUES
('manifest_cantiere','s','record',$outboxhelper0$
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
  $outboxhelper0$),
('prepara_cleanup_storage','v','int8',$outboxhelper1$
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
  $outboxhelper1$)
  ) AS m(nome,volatilita,tipo,corpo)
  LOOP
    SELECT f.* INTO p FROM pg_catalog.pg_proc f WHERE f.oid=to_regprocedure(format('artecna_distruzione.%I(uuid)',r.nome));
    IF NOT FOUND THEN RAISE EXCEPTION 'Helper outbox % assente',r.nome; END IF;
    IF strpos(replace(p.prosrc,chr(13)||chr(10),''),chr(13))>0
      OR (strpos(p.prosrc,chr(13)||chr(10))>0 AND strpos(replace(p.prosrc,chr(13)||chr(10),''),chr(10))>0) THEN
      RAISE EXCEPTION 'Newline helper outbox misti o CR isolati';
    END IF;
    IF p.proowner<>'postgres'::regrole OR NOT p.prosecdef OR p.provolatile::text<>r.volatilita
      OR p.prorettype<>to_regtype('pg_catalog.'||r.tipo)
      OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp','row_security=off']::text[]
      OR replace(p.prosrc,chr(13)||chr(10),chr(10)) IS DISTINCT FROM replace(r.corpo,chr(13)||chr(10),chr(10))
      OR NOT has_function_privilege('artecna_cantieri_rpc',p.oid,'EXECUTE')
      OR EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        WHERE a.grantee NOT IN ('postgres'::regrole,'artecna_cantieri_rpc'::regrole) OR a.privilege_type<>'EXECUTE' OR a.is_grantable) THEN
      RAISE EXCEPTION 'Helper outbox % divergente',r.nome;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid=to_regclass('artecna_distruzione.cleanup_storage') AND relowner='postgres'::regrole AND relkind='r')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='artecna_distruzione.cleanup_storage'::regclass AND contype='f')
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='artecna_distruzione.cleanup_storage'::regclass
      AND conname='cleanup_storage_identita' AND contype='u' AND convalidated AND conkey=ARRAY[
        (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='artecna_distruzione.cleanup_storage'::regclass AND attname='cantiere_id'),
        (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='artecna_distruzione.cleanup_storage'::regclass AND attname='bucket'),
        (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='artecna_distruzione.cleanup_storage'::regclass AND attname='path')]::smallint[])
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c,LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid='artecna_distruzione.cleanup_storage'::regclass AND a.grantee<>'postgres'::regrole) THEN
    RAISE EXCEPTION 'Outbox/UNIQUE/FK/ACL divergenti';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('id','int8',true),('cantiere_id','uuid',true),('bucket','text',true),
    ('path','text',true),('stato','text',true),('tentativi','int4',true),('ultimo_errore','text',true),
    ('created_at','timestamptz',true),('updated_at','timestamptz',true),('completed_at','timestamptz',false)) AS m(colonna,tipo,obbligatoria)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='artecna_distruzione.cleanup_storage'::regclass
      AND attname=r.colonna AND attnum>0 AND NOT attisdropped AND attnotnull=r.obbligatoria
      AND atttypid=to_regtype('pg_catalog.'||r.tipo) AND (r.colonna<>'id' OR attidentity='a')) THEN
      RAISE EXCEPTION 'Colonna outbox % divergente',r.colonna;
    END IF;
  END LOOP;
  IF pg_get_serial_sequence('artecna_distruzione.cleanup_storage','id') IS NULL
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c,LATERAL aclexplode(coalesce(c.relacl,acldefault('S',c.relowner))) a
      WHERE c.oid=pg_get_serial_sequence('artecna_distruzione.cleanup_storage','id')::regclass AND a.grantee<>'postgres'::regrole) THEN
    RAISE EXCEPTION 'Identity/ACL sequenza outbox divergenti';
  END IF;
  -- La self-FK certificata deve restare immediata, non deferrable.
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.variante_lavorazioni'::regclass
    AND conname='variante_lavorazioni_precedente_fk' AND NOT condeferrable AND NOT condeferred) THEN
    RAISE EXCEPTION 'Self-FK differibile inattesa';
  END IF;
  SELECT to_jsonb(n) INTO v_guardie_namespace FROM pg_catalog.pg_namespace n WHERE n.nspname='artecna_guardie';
  -- Baseline aggiuntive autorevoli dalla ricognizione DB 17.6.
  FOR r IN SELECT value AS certificato FROM jsonb_array_elements($certificato$[{"acl":["postgres=X/postgres"],"firma":"artecna_guardie.proteggi_archiviazione_preventivo()","owner":"postgres","config":["search_path=pg_catalog, pg_temp"],"schema":"artecna_guardie","volatility":"v","definizione":"CREATE OR REPLACE FUNCTION artecna_guardie.proteggi_archiviazione_preventivo()\n RETURNS trigger\n LANGUAGE plpgsql\n SET search_path TO 'pg_catalog', 'pg_temp'\nAS $function$\r\nBEGIN\r\n  IF TG_OP = 'INSERT' THEN\r\n    IF NEW.archiviazione_key IS NULL\r\n       AND NEW.archiviazione_payload_hash IS NULL THEN\r\n      RETURN NEW;\r\n    END IF;\r\n\r\n    IF NEW.archiviazione_key IS NULL\r\n       OR NEW.archiviazione_payload_hash IS NULL THEN\r\n      RAISE EXCEPTION USING\r\n        ERRCODE = 'P2049',\r\n        MESSAGE = 'Key e fingerprint devono essere valorizzati insieme';\r\n    END IF;\r\n\r\n    IF current_user <> 'artecna_preventivi_rpc' THEN\r\n      RAISE EXCEPTION USING\r\n        ERRCODE = 'P2049',\r\n        MESSAGE = 'Metadati di archiviazione riservati alla RPC dedicata';\r\n    END IF;\r\n\r\n    RETURN NEW;\r\n  END IF;\r\n\r\n  IF TG_OP = 'UPDATE' THEN\r\n    IF NEW.archiviazione_key IS DISTINCT FROM OLD.archiviazione_key\r\n       OR NEW.archiviazione_payload_hash\r\n          IS DISTINCT FROM OLD.archiviazione_payload_hash THEN\r\n      RAISE EXCEPTION USING\r\n        ERRCODE = 'P2049',\r\n        MESSAGE = 'Key e fingerprint di archiviazione sono immutabili';\r\n    END IF;\r\n\r\n    RETURN NEW;\r\n  END IF;\r\n\r\n  RAISE EXCEPTION USING\r\n    ERRCODE = 'P2049',\r\n    MESSAGE = 'Operazione inattesa nella guardia di archiviazione';\r\nEND;\r\n$function$\n","security_definer":false,"execute_effettivo":{"anon":false,"postgres":true,"authenticated":false,"artecna_cantieri_rpc":false}},{"acl":["postgres=X/postgres","artecna_sal_rpc=X/postgres","artecna_varianti_rpc=X/postgres","artecna_preventivi_rpc=X/postgres","artecna_cantieri_rpc=X/postgres"],"firma":"artecna_guardie.utente_jwt_corrente()","owner":"postgres","config":["search_path=pg_catalog, pg_temp"],"schema":"artecna_guardie","volatility":"s","definizione":"CREATE OR REPLACE FUNCTION artecna_guardie.utente_jwt_corrente()\n RETURNS uuid\n LANGUAGE sql\n STABLE\n SET search_path TO 'pg_catalog', 'pg_temp'\nAS $function$\n  select \n  coalesce(\n    nullif(current_setting('request.jwt.claim.sub', true), ''),\n    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')\n  )::uuid\n$function$\n","security_definer":false,"execute_effettivo":{"anon":false,"postgres":true,"authenticated":false,"artecna_cantieri_rpc":true}},{"acl":["postgres=X/postgres","artecna_sal_rpc=X/postgres","artecna_varianti_rpc=X/postgres","artecna_preventivi_rpc=X/postgres"],"firma":"artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)","owner":"postgres","config":["search_path=pg_catalog, pg_temp"],"schema":"artecna_guardie","volatility":"s","definizione":"CREATE OR REPLACE FUNCTION artecna_guardie.utente_puo_modificare_cantiere(p_user_id uuid, p_cantiere_id uuid)\n RETURNS boolean\n LANGUAGE sql\n STABLE\n SET search_path TO 'pg_catalog', 'pg_temp'\nAS $function$\r\n            SELECT EXISTS (\r\n                SELECT 1\r\n                FROM public.utenti_cantiere AS u\r\n                WHERE p_user_id IS NOT NULL\r\n                  AND p_cantiere_id IS NOT NULL\r\n                  AND u.user_id = p_user_id\r\n                  AND u.cantiere_id = p_cantiere_id\r\n                  AND u.ruolo = 'owner'\r\n            )\r\n        $function$\n","security_definer":false,"execute_effettivo":{"anon":false,"postgres":true,"authenticated":false,"artecna_cantieri_rpc":false}},{"acl":["artecna_cantieri_rpc=X/artecna_cantieri_rpc","authenticated=X/artecna_cantieri_rpc"],"firma":"public.crea_cantiere_con_owner(text,double precision)","owner":"artecna_cantieri_rpc","config":["search_path=pg_catalog, pg_temp"],"schema":"public","volatility":"v","definizione":"CREATE OR REPLACE FUNCTION public.crea_cantiere_con_owner(p_nome text, p_preventivo double precision DEFAULT 0)\n RETURNS TABLE(id uuid, nome text, preventivo double precision, created_at timestamp without time zone, lavori_conclusi boolean)\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog', 'pg_temp'\nAS $function$\r\nDECLARE\r\n  v_user uuid;\r\n  v_id uuid;\r\n  v_nome text;\r\n  v_count bigint;\r\n  v_owner_count bigint;\r\n  v_owner_exact boolean;\r\nBEGIN\r\n  BEGIN\r\n    v_user := artecna_guardie.utente_jwt_corrente();\r\n  EXCEPTION\r\n    WHEN invalid_text_representation THEN\r\n      RAISE EXCEPTION USING\r\n        ERRCODE = 'P2061',\r\n        MESSAGE = 'Identità JWT non valida';\r\n  END;\r\n\r\n  IF v_user IS NULL THEN\r\n    RAISE EXCEPTION USING\r\n      ERRCODE = 'P2061',\r\n      MESSAGE = 'Identità JWT obbligatoria';\r\n  END IF;\r\n\r\n  v_nome := pg_catalog.btrim(p_nome);\r\n\r\n  IF v_nome IS NULL OR v_nome = '' THEN\r\n    RAISE EXCEPTION USING\r\n      ERRCODE = 'P2062',\r\n      MESSAGE = 'Nome cantiere obbligatorio';\r\n  END IF;\r\n\r\n  -- NaN in PostgreSQL è maggiore dei valori numerici ordinari.\r\n  -- Il confronto esclude NaN e entrambe le infinità.\r\n  IF p_preventivo IS NULL\r\n     OR p_preventivo < 0\r\n     OR NOT (p_preventivo < 'Infinity'::double precision) THEN\r\n    RAISE EXCEPTION USING\r\n      ERRCODE = 'P2062',\r\n      MESSAGE = 'Preventivo non valido: richiesto valore finito >= 0';\r\n  END IF;\r\n\r\n  v_id := pg_catalog.gen_random_uuid();\r\n\r\n  INSERT INTO public.cantieri AS c (\r\n    id, nome, preventivo\r\n  )\r\n  VALUES (\r\n    v_id, v_nome, p_preventivo\r\n  );\r\n\r\n  GET DIAGNOSTICS v_count = ROW_COUNT;\r\n\r\n  IF v_count <> 1 THEN\r\n    RAISE EXCEPTION USING\r\n      ERRCODE = 'P2063',\r\n      MESSAGE = 'Inserimento cantiere non confermato';\r\n  END IF;\r\n\r\n  INSERT INTO public.utenti_cantiere AS uc (\r\n    cantiere_id, user_id, ruolo\r\n  )\r\n  VALUES (\r\n    v_id, v_user, 'owner'\r\n  );\r\n\r\n  GET DIAGNOSTICS v_count = ROW_COUNT;\r\n\r\n  IF v_count <> 1 THEN\r\n    RAISE EXCEPTION USING\r\n      ERRCODE = 'P2064',\r\n      MESSAGE = 'Inserimento owner non confermato';\r\n  END IF;\r\n\r\n  -- Verifica che per il nuovo UUID esista una sola membership,\r\n  -- esattamente quella richiesta.\r\n  SELECT\r\n    count(*),\r\n    bool_and(uc.user_id = v_user AND uc.ruolo = 'owner')\r\n  INTO v_owner_count, v_owner_exact\r\n  FROM public.utenti_cantiere AS uc\r\n  WHERE uc.cantiere_id = v_id;\r\n\r\n  IF v_owner_count <> 1 OR v_owner_exact IS DISTINCT FROM true THEN\r\n    RAISE EXCEPTION USING\r\n      ERRCODE = 'P2064',\r\n      MESSAGE = 'Membership owner risultante non conforme';\r\n  END IF;\r\n\r\n  -- Rilettura dopo entrambe le scritture e dopo i trigger immediati.\r\n  SELECT\r\n    c.id, c.nome, c.preventivo, c.created_at, c.lavori_conclusi\r\n  INTO\r\n    id, nome, preventivo, created_at, lavori_conclusi\r\n  FROM public.cantieri AS c\r\n  WHERE c.id = v_id;\r\n\r\n  IF NOT FOUND\r\n     OR id IS DISTINCT FROM v_id\r\n     OR nome IS DISTINCT FROM v_nome\r\n     OR preventivo IS DISTINCT FROM p_preventivo\r\n     OR created_at IS NULL\r\n     OR lavori_conclusi IS DISTINCT FROM false THEN\r\n    RAISE EXCEPTION USING\r\n      ERRCODE = 'P2065',\r\n      MESSAGE = 'Cantiere risultante non conforme';\r\n  END IF;\r\n\r\n  RETURN NEXT;\r\n  RETURN;\r\n\r\n  -- Nessun handler esterno che trasformi un errore in successo.\r\n  -- FK, UNIQUE, CHECK e altri errori inattesi vengono propagati.\r\nEND;\r\n$function$\n","security_definer":true,"execute_effettivo":{"anon":false,"postgres":true,"authenticated":true,"artecna_cantieri_rpc":true}}]$certificato$::jsonb)
  LOOP
    SELECT f.* INTO p FROM pg_catalog.pg_proc f WHERE f.oid=to_regprocedure(r.certificato->>'firma');
    IF NOT FOUND THEN RAISE EXCEPTION 'Funzione certificata assente: %',r.certificato->>'firma'; END IF;
    IF strpos(replace(p.prosrc,chr(13)||chr(10),''),chr(13))>0
      OR (strpos(p.prosrc,chr(13)||chr(10))>0 AND strpos(replace(p.prosrc,chr(13)||chr(10),''),chr(10))>0) THEN
      RAISE EXCEPTION 'Newline funzione certificata misti o CR isolati';
    END IF;
    IF pg_get_userbyid(p.proowner) IS DISTINCT FROM r.certificato->>'owner'
      OR p.prosecdef IS DISTINCT FROM (r.certificato->>'security_definer')::boolean
      OR p.provolatile::text IS DISTINCT FROM r.certificato->>'volatility'
      OR to_jsonb(p.proconfig) IS DISTINCT FROM r.certificato->'config'
      OR to_jsonb(coalesce(p.proacl,acldefault('f',p.proowner))) IS DISTINCT FROM r.certificato->'acl'
      OR replace(pg_get_functiondef(p.oid),chr(13)||chr(10),chr(10))
         IS DISTINCT FROM replace(r.certificato->>'definizione',chr(13)||chr(10),chr(10)) THEN
      RAISE EXCEPTION 'Baseline/attributi/ACL certificati divergenti: %',r.certificato->>'firma';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_catalog.pg_proc WHERE proowner='artecna_cantieri_rpc'::regrole)<>1
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE proowner='artecna_cantieri_rpc'::regrole
      AND prosrc ~ 'artecna_distruzione') THEN
    RAISE EXCEPTION 'Consumatori del ruolo condiviso diversi dalla ricognizione';
  END IF;
  SELECT to_jsonb(pr) INTO v_role_shared FROM pg_catalog.pg_roles pr WHERE pr.rolname='artecna_cantieri_rpc';
  SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.oid),'[]'::jsonb) INTO v_member_shared
    FROM pg_catalog.pg_auth_members m WHERE m.roleid='artecna_cantieri_rpc'::regrole OR m.member='artecna_cantieri_rpc'::regrole;
  IF (SELECT count(*) FROM pg_catalog.pg_auth_members WHERE roleid='artecna_cantieri_rpc'::regrole OR member='artecna_cantieri_rpc'::regrole)<>1
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid='artecna_cantieri_rpc'::regrole
      AND member='postgres'::regrole AND grantor='supabase_admin'::regrole AND admin_option AND NOT inherit_option AND NOT set_option) THEN
    RAISE EXCEPTION 'Membership ruolo condiviso divergente';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='artecna_cantieri_delete_rpc') THEN
    RAISE EXCEPTION 'Ruolo dedicato gia esistente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres' AND rolcreaterole AND rolbypassrls AND NOT rolsuper) THEN
    RAISE EXCEPTION 'Amministratore non conforme alla ricognizione';
  END IF;
  FOR r IN SELECT value AS certificato FROM jsonb_array_elements($acl_certificato$[{"tabella":"acconti_cantiere","acl":["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"colonne":[{"nome":"id","acl":null},{"nome":"created_at","acl":null},{"nome":"cantiere","acl":null},{"nome":"descrizione","acl":null},{"nome":"importo","acl":null},{"nome":"data_incasso","acl":null},{"nome":"metodo","acl":null},{"nome":"nota","acl":null},{"nome":"cantiere_id","acl":null}]},{"tabella":"attrezzi_cantiere","acl":["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"colonne":[{"nome":"id","acl":null},{"nome":"cantiere","acl":null},{"nome":"descrizione","acl":null},{"nome":"categoria","acl":null},{"nome":"quantita","acl":null},{"nome":"prezzo_unitario","acl":null},{"nome":"totale","acl":null},{"nome":"fornitore","acl":null},{"nome":"data_documento","acl":null},{"nome":"nome_file","acl":null},{"nome":"nota","acl":null},{"nome":"created_at","acl":null},{"nome":"file_url","acl":null},{"nome":"file_tipo","acl":null},{"nome":"anteprima_testo","acl":null},{"nome":"file_path","acl":null},{"nome":"cantiere_id","acl":null}]},{"tabella":"cantieri","acl":["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres","artecna_varianti_rpc=r/postgres","artecna_sal_rpc=r/postgres"],"colonne":[{"nome":"id","acl":["artecna_varianti_rpc=w/postgres","artecna_sal_rpc=rw/postgres","artecna_preventivi_rpc=rw/postgres","artecna_cantieri_rpc=ar/postgres"]},{"nome":"nome","acl":["artecna_preventivi_rpc=r/postgres","artecna_cantieri_rpc=ar/postgres"]},{"nome":"created_at","acl":["artecna_cantieri_rpc=r/postgres"]},{"nome":"preventivo","acl":["artecna_cantieri_rpc=ar/postgres"]},{"nome":"data_inizio_lavori","acl":null},{"nome":"data_fine_lavori","acl":null},{"nome":"lavori_conclusi","acl":["artecna_cantieri_rpc=r/postgres"]},{"nome":"origine_preventivo_id","acl":null},{"nome":"preventivo_contrattuale_id","acl":["artecna_sal_rpc=r/postgres"]}]},{"tabella":"fatture_emesse","acl":["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"colonne":[{"nome":"id","acl":null},{"nome":"numero_fattura","acl":null},{"nome":"data_fattura","acl":null},{"nome":"cliente","acl":null},{"nome":"cantiere","acl":null},{"nome":"imponibile","acl":null},{"nome":"iva","acl":null},{"nome":"totale","acl":null},{"nome":"importo_incassato","acl":null},{"nome":"stato","acl":null},{"nome":"note","acl":null},{"nome":"created_at","acl":null},{"nome":"xml_url","acl":null},{"nome":"pdf_url","acl":null},{"nome":"cantiere_id","acl":null}]},{"tabella":"fatture_fornitori_righe","acl":["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"colonne":[{"nome":"id","acl":null},{"nome":"fattura_id","acl":null},{"nome":"numero_riga","acl":null},{"nome":"descrizione","acl":null},{"nome":"quantita","acl":null},{"nome":"prezzo_unitario","acl":null},{"nome":"totale_riga","acl":null},{"nome":"cantiere","acl":null},{"nome":"stato","acl":null},{"nome":"created_at","acl":null},{"nome":"aliquota_iva","acl":null},{"nome":"unita_misura","acl":null},{"nome":"categoria_economica","acl":null},{"nome":"cantiere_id","acl":null}]},{"tabella":"foto_cantiere","acl":["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"colonne":[{"nome":"id","acl":null},{"nome":"cantiere","acl":null},{"nome":"nota","acl":null},{"nome":"immagine_base64","acl":null},{"nome":"created_at","acl":null},{"nome":"data_foto","acl":null},{"nome":"geolocalizzazione","acl":null},{"nome":"categoria","acl":null},{"nome":"file_url","acl":null},{"nome":"file_path","acl":null},{"nome":"thumbnail_url","acl":null},{"nome":"storage_provider","acl":null},{"nome":"sync_status","acl":null},{"nome":"rapportino_id","acl":null},{"nome":"sopralluogo_id","acl":null},{"nome":"cantiere_id","acl":null}]},{"tabella":"incassi_non_fatturati","acl":["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"colonne":[{"nome":"id","acl":null},{"nome":"data_incasso","acl":null},{"nome":"cliente","acl":null},{"nome":"cantiere","acl":null},{"nome":"descrizione","acl":null},{"nome":"importo","acl":null},{"nome":"metodo","acl":null},{"nome":"stato","acl":null},{"nome":"note","acl":null},{"nome":"created_at","acl":null},{"nome":"cantiere_id","acl":null}]},{"tabella":"materiali_cantiere","acl":["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"colonne":[{"nome":"id","acl":null},{"nome":"cantiere","acl":null},{"nome":"descrizione","acl":null},{"nome":"quantita","acl":null},{"nome":"prezzo_unitario","acl":null},{"nome":"totale","acl":null},{"nome":"fornitore","acl":null},{"nome":"data_documento","acl":null},{"nome":"nome_file","acl":null},{"nome":"created_at","acl":null},{"nome":"file_url","acl":null},{"nome":"file_tipo","acl":null},{"nome":"anteprima_testo","acl":null},{"nome":"nota","acl":null},{"nome":"file_path","acl":null},{"nome":"cantiere_id","acl":null}]},{"tabella":"pagamenti_fornitori","acl":["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"colonne":[{"nome":"id","acl":null},{"nome":"fornitore_nome","acl":null},{"nome":"cantiere","acl":null},{"nome":"descrizione","acl":null},{"nome":"importo_totale","acl":null},{"nome":"importo_pagato","acl":null},{"nome":"data_documento","acl":null},{"nome":"data_scadenza","acl":null},{"nome":"metodo","acl":null},{"nome":"nota","acl":null},{"nome":"created_at","acl":null},{"nome":"cantiere_id","acl":null}]},{"tabella":"preventivi_cantiere","acl":["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres","artecna_varianti_rpc=r/postgres"],"colonne":[{"nome":"id","acl":["artecna_sal_rpc=rw/postgres","artecna_preventivi_rpc=ar/postgres"]},{"nome":"cantiere","acl":["artecna_preventivi_rpc=ar/postgres"]},{"nome":"importo_totale","acl":["artecna_preventivi_rpc=ar/postgres"]},{"nome":"nome_file","acl":["artecna_preventivi_rpc=ar/postgres"]},{"nome":"note","acl":["artecna_preventivi_rpc=ar/postgres"]},{"nome":"created_at","acl":null},{"nome":"file_url","acl":["artecna_preventivi_rpc=ar/postgres"]},{"nome":"file_tipo","acl":["artecna_preventivi_rpc=ar/postgres"]},{"nome":"anteprima_testo","acl":["artecna_preventivi_rpc=ar/postgres"]},{"nome":"file_path","acl":["artecna_preventivi_rpc=ar/postgres"]},{"nome":"sopralluogo_id","acl":null},{"nome":"origine_ai","acl":null},{"nome":"stato_preventivo","acl":["artecna_preventivi_rpc=ar/postgres"]},{"nome":"descrizione_ai","acl":null},{"nome":"json_voci_ai","acl":null},{"nome":"approvato","acl":["artecna_preventivi_rpc=ar/postgres"]},{"nome":"data_approvazione","acl":null},{"nome":"cliente_ai","acl":null},{"nome":"telefono_ai","acl":null},{"nome":"indirizzo_ai","acl":null},{"nome":"data_preventivo","acl":null},{"nome":"cantiere_id","acl":["artecna_sal_rpc=r/postgres","artecna_preventivi_rpc=ar/postgres"]},{"nome":"archiviazione_key","acl":["artecna_preventivi_rpc=ar/postgres"]},{"nome":"archiviazione_payload_hash","acl":["artecna_preventivi_rpc=ar/postgres"]}]},{"tabella":"preventivo_lavorazioni","acl":["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres","artecna_varianti_rpc=r/postgres"],"colonne":[{"nome":"id","acl":["artecna_sal_rpc=rw/postgres","artecna_preventivi_rpc=r/postgres"]},{"nome":"cantiere","acl":["artecna_preventivi_rpc=ar/postgres"]},{"nome":"descrizione","acl":["artecna_preventivi_rpc=ar/postgres","artecna_sal_rpc=r/postgres"]},{"nome":"importo_previsto","acl":["artecna_sal_rpc=r/postgres","artecna_preventivi_rpc=ar/postgres"]},{"nome":"quantita","acl":["artecna_sal_rpc=r/postgres","artecna_preventivi_rpc=ar/postgres"]},{"nome":"prezzo_unitario","acl":["artecna_sal_rpc=r/postgres","artecna_preventivi_rpc=ar/postgres"]},{"nome":"unita_misura","acl":["artecna_sal_rpc=r/postgres","artecna_preventivi_rpc=ar/postgres"]},{"nome":"fonte","acl":["artecna_preventivi_rpc=ar/postgres"]},{"nome":"created_at","acl":null},{"nome":"cantiere_id","acl":["artecna_sal_rpc=r/postgres","artecna_preventivi_rpc=ar/postgres"]},{"nome":"preventivo_id","acl":["artecna_sal_rpc=r/postgres","artecna_preventivi_rpc=ar/postgres"]}]},{"tabella":"rapportini","acl":["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"colonne":[{"nome":"id","acl":null},{"nome":"cantiere","acl":null},{"nome":"data","acl":null},{"nome":"ore","acl":null},{"nome":"note","acl":null},{"nome":"created_at","acl":null},{"nome":"operai","acl":null},{"nome":"numero_presenti","acl":null},{"nome":"ore_per_operaio","acl":null},{"nome":"materiali","acl":null},{"nome":"quantita_materiali","acl":null},{"nome":"costo_materiali","acl":null},{"nome":"costo_manodopera","acl":null},{"nome":"cantiere_id","acl":null},{"nome":"compilato_da_operaio_id","acl":null},{"nome":"compilato_da_nome","acl":null}]},{"tabella":"sal_lavorazioni","acl":["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres","artecna_varianti_rpc=r/postgres","artecna_sal_rpc=r/postgres"],"colonne":[{"nome":"id","acl":["artecna_sal_rpc=r/postgres"]},{"nome":"cantiere","acl":["artecna_sal_rpc=a/postgres"]},{"nome":"descrizione","acl":["artecna_sal_rpc=a/postgres"]},{"nome":"importo_previsto","acl":["artecna_sal_rpc=ar/postgres"]},{"nome":"percentuale","acl":["artecna_sal_rpc=arw/postgres"]},{"nome":"importo_maturato","acl":["artecna_sal_rpc=arw/postgres"]},{"nome":"note","acl":["artecna_sal_rpc=a/postgres"]},{"nome":"data_aggiornamento","acl":["artecna_sal_rpc=arw/postgres"]},{"nome":"created_at","acl":null},{"nome":"completata","acl":["artecna_sal_rpc=arw/postgres"]},{"nome":"cantiere_id","acl":["artecna_sal_rpc=ar/postgres"]},{"nome":"source_lavorazione_id","acl":["artecna_sal_rpc=r/postgres"]},{"nome":"source_variante_lavorazione_id","acl":["artecna_sal_rpc=ar/postgres"]}]},{"tabella":"timbrature","acl":["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"colonne":[{"nome":"id","acl":null},{"nome":"operaio_nome","acl":null},{"nome":"cantiere","acl":null},{"nome":"data","acl":null},{"nome":"ora_entrata","acl":null},{"nome":"ora_uscita","acl":null},{"nome":"stato","acl":null},{"nome":"created_at","acl":null},{"nome":"cantiere_id","acl":null},{"nome":"rapportino_id","acl":null},{"nome":"operaio_id","acl":null},{"nome":"pausa_minuti","acl":null}]},{"tabella":"utenti_cantiere","acl":["postgres=arwdDxtm/postgres"],"colonne":[{"nome":"cantiere_id","acl":["artecna_sal_rpc=r/postgres","artecna_varianti_rpc=r/postgres","artecna_preventivi_rpc=r/postgres","artecna_cantieri_rpc=ar/postgres"]},{"nome":"user_id","acl":["artecna_sal_rpc=r/postgres","artecna_varianti_rpc=r/postgres","artecna_preventivi_rpc=r/postgres","artecna_cantieri_rpc=ar/postgres"]},{"nome":"ruolo","acl":["artecna_sal_rpc=r/postgres","artecna_varianti_rpc=r/postgres","artecna_preventivi_rpc=r/postgres","artecna_cantieri_rpc=ar/postgres"]},{"nome":"created_at","acl":null}]},{"tabella":"variante_documenti","acl":["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres"],"colonne":[{"nome":"id","acl":null},{"nome":"variante_id","acl":null},{"nome":"nome_file","acl":null},{"nome":"storage_path","acl":null},{"nome":"mime_type","acl":null},{"nome":"tipo","acl":null},{"nome":"note","acl":null},{"nome":"created_at","acl":null}]},{"tabella":"variante_lavorazioni","acl":["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres","artecna_varianti_rpc=ar/postgres","artecna_sal_rpc=r/postgres"],"colonne":[{"nome":"id","acl":["artecna_sal_rpc=r/postgres"]},{"nome":"variante_id","acl":["artecna_sal_rpc=r/postgres","artecna_varianti_rpc=a/postgres"]},{"nome":"numero_riga","acl":["artecna_varianti_rpc=a/postgres"]},{"nome":"operazione","acl":["artecna_sal_rpc=r/postgres","artecna_varianti_rpc=a/postgres"]},{"nome":"descrizione","acl":["artecna_varianti_rpc=a/postgres"]},{"nome":"unita_misura","acl":["artecna_sal_rpc=r/postgres","artecna_varianti_rpc=a/postgres"]},{"nome":"quantita_delta","acl":["artecna_sal_rpc=r/postgres","artecna_varianti_rpc=a/postgres"]},{"nome":"prezzo_unitario","acl":["artecna_sal_rpc=r/postgres","artecna_varianti_rpc=a/postgres"]},{"nome":"delta_contratto","acl":["artecna_sal_rpc=r/postgres","artecna_varianti_rpc=a/postgres"]},{"nome":"riferimento_preventivo_lavorazione_id","acl":["artecna_sal_rpc=r/postgres"]},{"nome":"riferimento_variante_lavorazione_id","acl":["artecna_sal_rpc=r/postgres"]},{"nome":"note","acl":null},{"nome":"created_at","acl":null},{"nome":"variante_sorgente_id","acl":null},{"nome":"indice_voce_sorgente","acl":null}]},{"tabella":"variante_sorgenti","acl":["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres","artecna_varianti_rpc=ard/postgres"],"colonne":[{"nome":"id","acl":null},{"nome":"variante_id","acl":null},{"nome":"tipo","acl":null},{"nome":"preventivo_sorgente_id","acl":null},{"nome":"titolo","acl":null},{"nome":"nome_file","acl":null},{"nome":"formato","acl":null},{"nome":"file_sha256","acl":null},{"nome":"snapshot_version","acl":null},{"nome":"snapshot","acl":null},{"nome":"created_at","acl":null}]},{"tabella":"varianti_cantiere","acl":["postgres=arwdDxtm/postgres","anon=arwdDxtm/postgres","authenticated=arwdDxtm/postgres","service_role=arwdDxtm/postgres","artecna_varianti_rpc=r/postgres","artecna_sal_rpc=r/postgres"],"colonne":[{"nome":"id","acl":["artecna_sal_rpc=r/postgres"]},{"nome":"cantiere_id","acl":["artecna_sal_rpc=r/postgres","artecna_varianti_rpc=a/postgres"]},{"nome":"preventivo_contrattuale_id","acl":["artecna_sal_rpc=r/postgres","artecna_varianti_rpc=a/postgres"]},{"nome":"numero","acl":["artecna_varianti_rpc=w/postgres"]},{"nome":"titolo","acl":["artecna_varianti_rpc=a/postgres"]},{"nome":"descrizione","acl":["artecna_varianti_rpc=a/postgres"]},{"nome":"stato","acl":["artecna_varianti_rpc=w/postgres","artecna_sal_rpc=r/postgres"]},{"nome":"data_variante","acl":["artecna_varianti_rpc=a/postgres"]},{"nome":"importo_delta_approvato","acl":["artecna_varianti_rpc=w/postgres"]},{"nome":"approvata_at","acl":["artecna_varianti_rpc=w/postgres"]},{"nome":"riferimento_approvazione","acl":["artecna_varianti_rpc=w/postgres"]},{"nome":"created_at","acl":null},{"nome":"updated_at","acl":["artecna_varianti_rpc=w/postgres"]}]}]$acl_certificato$::jsonb)
  LOOP
    IF (SELECT jsonb_build_object('tabella',c.relname,'acl',to_jsonb(coalesce(c.relacl,acldefault('r',c.relowner))),
      'colonne',(SELECT jsonb_agg(jsonb_build_object('nome',a.attname,'acl',to_jsonb(a.attacl)) ORDER BY a.attnum)
        FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped))
      FROM pg_catalog.pg_class c WHERE c.oid=to_regclass('public.'||(r.certificato->>'tabella'))) IS DISTINCT FROM r.certificato THEN
      RAISE EXCEPTION 'ACL tabella/colonne divergenti: %',r.certificato->>'tabella';
    END IF;
    IF has_table_privilege('artecna_cantieri_rpc','public.'||(r.certificato->>'tabella'),'SELECT,UPDATE,DELETE') THEN
      RAISE EXCEPTION 'Privilegi di tabella inattesi per ruolo condiviso';
    END IF;
  END LOOP;
  -- Snapshot canonico di tutte le ACL applicative; dopo si esclude soltanto il nuovo ruolo.
  SELECT jsonb_agg(jsonb_build_object('tabella',c.oid,'acl',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
      FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a),
    'colonne',(SELECT jsonb_agg(jsonb_build_object('attnum',b.attnum,'acl',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
      FROM aclexplode(b.attacl) a)) ORDER BY b.attnum) FROM pg_catalog.pg_attribute b WHERE b.attrelid=c.oid AND b.attnum>0 AND NOT b.attisdropped)) ORDER BY c.oid)
    INTO v_table_acl FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('acconti_cantiere','attrezzi_cantiere','cantieri','fatture_emesse','fatture_fornitori_righe','foto_cantiere','incassi_non_fatturati','materiali_cantiere','pagamenti_fornitori','preventivi_cantiere','preventivo_lavorazioni','rapportini','sal_lavorazioni','timbrature','utenti_cantiere','variante_documenti','variante_lavorazioni','variante_sorgenti','varianti_cantiere');
  SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable) INTO v_acl_public
    FROM pg_catalog.pg_namespace n,LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='public';
  LOCK TABLE artecna_distruzione.contesto IN ACCESS EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM artecna_distruzione.contesto) THEN
    RAISE EXCEPTION 'Contesto non vuoto: migrazione ruolo vietata';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_constraint WHERE conrelid='artecna_distruzione.contesto'::regclass)<>2
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='artecna_distruzione.contesto'::regclass
      AND conname='contesto_ruolo_check' AND contype='c' AND convalidated
      AND pg_get_constraintdef(oid,true)=$check_old$CHECK (ruolo = 'artecna_cantieri_rpc'::name)$check_old$) THEN
    RAISE EXCEPTION 'CHECK contesto divergente';
  END IF;
  -- PostgreSQL 17: il creatore CREATEROLE+BYPASSRLS puo creare questo ruolo.
  -- Mantiene soltanto la membership amministrativa implicita, senza SET/INHERIT.
  v_selfgrant := current_setting('createrole_self_grant');
  PERFORM set_config('createrole_self_grant','',true);
  EXECUTE 'CREATE ROLE artecna_cantieri_delete_rpc NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS';
  PERFORM set_config('createrole_self_grant',v_selfgrant,true);
  SELECT oid INTO v_newrole FROM pg_catalog.pg_roles WHERE rolname='artecna_cantieri_delete_rpc';
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid=v_newrole
      AND (member<>'postgres'::regrole OR NOT admin_option OR inherit_option OR set_option))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=v_newrole)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid=v_newrole AND member='postgres'::regrole AND admin_option) THEN
    RAISE EXCEPTION 'Membership implicita del nuovo ruolo inattesa';
  END IF;
  IF has_schema_privilege(v_newrole,'public','CREATE') THEN RAISE EXCEPTION 'CREATE public iniziale inatteso per ruolo nuovo'; END IF;
  SELECT jsonb_agg(to_jsonb(m) ORDER BY m.oid) INTO v_member_created FROM pg_catalog.pg_auth_members m WHERE m.roleid=v_newrole;
  SELECT to_jsonb(m) INTO v_temp_member_prima FROM pg_catalog.pg_auth_members m
    WHERE m.roleid=v_newrole AND m.member='postgres'::regrole AND m.grantor='postgres'::regrole;
  EXECUTE 'ALTER TABLE artecna_distruzione.contesto DROP CONSTRAINT contesto_ruolo_check';
  EXECUTE $ddl$ALTER TABLE artecna_distruzione.contesto ADD CONSTRAINT contesto_ruolo_check CHECK (ruolo = 'artecna_cantieri_delete_rpc'::name)$ddl$;
  -- Cambia solo quattro literal: due helper e due guardie, preservando i prosrc runtime.
  FOR r IN SELECT * FROM (VALUES ('artecna_distruzione.inizia_contesto(uuid)'),('artecna_distruzione.contesto_valido(uuid)'),
    ('artecna_guardie.proteggi_variante_testata()'),('artecna_guardie.proteggi_variante_figlio()')) AS q(firma)
  LOOP
    SELECT f.* INTO v_proc_before FROM pg_catalog.pg_proc f WHERE f.oid=to_regprocedure(r.firma);
    IF (length(v_proc_before.prosrc)-length(replace(v_proc_before.prosrc,$old_role$'artecna_cantieri_rpc'$old_role$,'')))
      /length($old_role$'artecna_cantieri_rpc'$old_role$)<>1
      OR strpos(v_proc_before.prosrc,$new_role$'artecna_cantieri_delete_rpc'$new_role$)>0 THEN
      RAISE EXCEPTION 'Marker di ruolo non univoco: %',r.firma;
    END IF;
    v_src_new := replace(v_proc_before.prosrc,$old_role$'artecna_cantieri_rpc'$old_role$,$new_role$'artecna_cantieri_delete_rpc'$new_role$);
    IF convert_to(replace(v_src_new,$new_role$'artecna_cantieri_delete_rpc'$new_role$,$old_role$'artecna_cantieri_rpc'$old_role$),'UTF8')
      IS DISTINCT FROM convert_to(v_proc_before.prosrc,'UTF8') THEN RAISE EXCEPTION 'Patch non reversibile'; END IF;
    v_def := pg_get_functiondef(v_proc_before.oid);
    v_matches := regexp_match(v_def,E'\nAS (\\$[A-Za-z_][A-Za-z_0-9]*\\$|\\$\\$)');
    IF v_matches IS NULL THEN RAISE EXCEPTION 'Delimitatore AS non riconosciuto'; END IF;
    v_delim := v_matches[1];
    v_anchor := chr(10)||'AS '||v_delim;
    IF (length(v_def)-length(replace(v_def,v_anchor,'')))/length(v_anchor)<>1 THEN RAISE EXCEPTION 'AS non univoco'; END IF;
    v_position := strpos(v_def,v_anchor)+length(v_anchor);
    IF substr(v_def,v_position,length(v_proc_before.prosrc)) IS DISTINCT FROM v_proc_before.prosrc
      OR substr(v_def,v_position+length(v_proc_before.prosrc),length(v_delim)) IS DISTINCT FROM v_delim
      OR strpos(v_src_new,v_delim)>0 THEN RAISE EXCEPTION 'Wrapper/prosrc non coincidenti'; END IF;
    EXECUTE overlay(v_def placing v_src_new from v_position for length(v_proc_before.prosrc));
    SELECT f.* INTO v_proc_after FROM pg_catalog.pg_proc f WHERE f.oid=v_proc_before.oid;
    IF v_proc_after.prosrc IS DISTINCT FROM v_src_new
      OR (to_jsonb(v_proc_after)-'prosrc') IS DISTINCT FROM (to_jsonb(v_proc_before)-'prosrc') THEN
      RAISE EXCEPTION 'Attributi/prosrc alterati oltre marker: %',r.firma;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES ('inizia_contesto(uuid)'),('contesto_valido(uuid)'),('contesto_variante_valido(uuid)'),
    ('termina_contesto()'),('manifest_cantiere(uuid)'),('prepara_cleanup_storage(uuid)')) AS q(firma)
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION artecna_distruzione.'||r.firma||' FROM artecna_cantieri_rpc, PUBLIC, authenticated, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION artecna_distruzione.'||r.firma||' TO artecna_cantieri_delete_rpc';
  END LOOP;
  EXECUTE 'REVOKE USAGE ON SCHEMA artecna_distruzione FROM artecna_cantieri_rpc';
  EXECUTE 'GRANT USAGE ON SCHEMA artecna_distruzione TO artecna_cantieri_delete_rpc';
  -- Privilegi applicativi permanenti necessari, confinati al NUOVO ruolo dedicato NOLOGIN.
  -- UPDATE solo sulla colonna usata per il lock; la RPC non la modifica (salvo contratto -> NULL).
  FOR r IN SELECT * FROM (VALUES ('cantieri','preventivo_contrattuale_id'),('rapportini','cantiere_id'),('foto_cantiere','cantiere_id'),('timbrature','cantiere_id'),('materiali_cantiere','cantiere_id'),('attrezzi_cantiere','cantiere_id'),('pagamenti_fornitori','cantiere_id'),('acconti_cantiere','cantiere_id'),('fatture_emesse','cantiere_id'),('fatture_fornitori_righe','cantiere_id'),('incassi_non_fatturati','cantiere_id'),('sal_lavorazioni','cantiere_id'),('preventivo_lavorazioni','cantiere_id'),('preventivi_cantiere','cantiere_id'),('varianti_cantiere','cantiere_id'),('utenti_cantiere','cantiere_id'),('variante_lavorazioni','variante_id'),('variante_documenti','variante_id'),('variante_sorgenti','variante_id')) AS m(tabella,colonna)
  LOOP
    EXECUTE format('GRANT SELECT, DELETE ON TABLE public.%I TO artecna_cantieri_delete_rpc',r.tabella);
    EXECUTE format('GRANT UPDATE (%I) ON TABLE public.%I TO artecna_cantieri_delete_rpc',r.colonna,r.tabella);
  END LOOP;
  EXECUTE 'GRANT USAGE ON SCHEMA public, artecna_guardie TO artecna_cantieri_delete_rpc';
  -- EXECUTE diretti: nessun wrapper owner aggiuntivo. Gli altri grantee restano invariati.
  EXECUTE 'GRANT EXECUTE ON FUNCTION artecna_guardie.utente_jwt_corrente(), artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) TO artecna_cantieri_delete_rpc';
  EXECUTE $ddl$CREATE FUNCTION artecna_distruzione.impronta_cleanup_storage(p_cantiere uuid,p_limite bigint)
  RETURNS TABLE(totale bigint,max_id bigint,impronta text) LANGUAGE plpgsql VOLATILE SECURITY DEFINER
  SET search_path TO pg_catalog, pg_temp SET row_security TO off
  AS $impronta$
  BEGIN
    IF artecna_distruzione.contesto_valido(p_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Contesto non valido per outbox'; END IF;
    PERFORM j.id FROM artecna_distruzione.cleanup_storage j
      WHERE j.cantiere_id=p_cantiere AND (p_limite IS NULL OR j.id<=p_limite) ORDER BY j.id FOR SHARE;
    RETURN QUERY SELECT count(*)::bigint,coalesce(max(j.id),0)::bigint,
      encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(j) ORDER BY j.id)::text,'[]'),'UTF8')),'hex')
      FROM artecna_distruzione.cleanup_storage j WHERE j.cantiere_id=p_cantiere AND (p_limite IS NULL OR j.id<=p_limite);
  END;
  $impronta$$ddl$;
  EXECUTE 'REVOKE ALL ON FUNCTION artecna_distruzione.impronta_cleanup_storage(uuid,bigint) FROM PUBLIC, authenticated, anon';
  EXECUTE 'GRANT EXECUTE ON FUNCTION artecna_distruzione.impronta_cleanup_storage(uuid,bigint) TO artecna_cantieri_delete_rpc';
  IF v_temp_member_prima IS NULL THEN
    EXECUTE 'GRANT artecna_cantieri_delete_rpc TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY postgres';
  ELSE
    EXECUTE 'GRANT artecna_cantieri_delete_rpc TO postgres WITH SET TRUE GRANTED BY postgres';
  END IF;
  EXECUTE 'GRANT CREATE ON SCHEMA public TO artecna_cantieri_delete_rpc';
  EXECUTE 'SET LOCAL ROLE artecna_cantieri_delete_rpc';
  EXECUTE $rpcddl$CREATE FUNCTION public.elimina_cantiere_definitivamente(p_cantiere_id uuid,p_conferma text)
  RETURNS TABLE(cantiere_id uuid,eliminato boolean,storage_nuovi bigint,conteggi jsonb)
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog, pg_temp
  AS $rpcbody$
DECLARE
  v_user uuid;
  v_id uuid;
  v_varianti uuid[];
  v_preventivi text[];
  v_base_lavorazioni bigint[];
  v_var_lavorazioni bigint[];
  v_tabelle constant text[] := ARRAY['cantieri','rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere','variante_lavorazioni','variante_documenti','variante_sorgenti']::text[];
  v_figli constant text[] := ARRAY['variante_lavorazioni','variante_documenti','variante_sorgenti']::text[];
  v_dirette constant text[] := ARRAY['rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere']::text[];
  v_eliminate jsonb := '{}'::jsonb;
  v_n bigint;
  v_totale_lavorazioni bigint;
  v_residuo boolean;
  v_esterna boolean;
  v_on text;
  v_padre text;
  v_figlio text;
  v_sql text;
  v_jobs_prima record;
  v_jobs_vecchi record;
  v_jobs_preparati record;
  v_jobs_dopo record;
  t text;
  fk record;
  m record;
BEGIN
  IF current_user <> 'artecna_cantieri_delete_rpc' THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Ruolo RPC non autorizzato';
  END IF;
  IF p_cantiere_id IS NULL OR p_conferma IS DISTINCT FROM 'ELIMINA' THEN
    RAISE EXCEPTION USING ERRCODE='P2111',MESSAGE='UUID e conferma esatta ELIMINA obbligatori';
  END IF;
  v_user := artecna_guardie.utente_jwt_corrente();
  IF v_user IS NULL THEN RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Utente non autorizzato'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id=p_cantiere_id) THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Cantiere assente o non autorizzato';
  END IF;
  SELECT c.id INTO v_id FROM public.cantieri c WHERE c.id=p_cantiere_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Cantiere assente o non autorizzato'; END IF;
  IF artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Owner non autorizzato';
  END IF;
  PERFORM 1 FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;
  IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Owner non autorizzato dopo lock';
  END IF;
  PERFORM artecna_distruzione.inizia_contesto(p_cantiere_id);
  IF artecna_distruzione.contesto_valido(p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Contesto non autorizzato';
  END IF;
  -- Blocca testate prima dei figli: impedisce nuovi riferimenti FK mentre opera.
  PERFORM v.id FROM public.varianti_cantiere v WHERE v.cantiere_id=p_cantiere_id ORDER BY v.id FOR UPDATE;
  SELECT coalesce(array_agg(v.id ORDER BY v.id),ARRAY[]::uuid[]) INTO v_varianti FROM public.varianti_cantiere v WHERE v.cantiere_id=p_cantiere_id;
  FOREACH t IN ARRAY v_tabelle LOOP
    IF t='cantieri' THEN CONTINUE; END IF;
    IF t=ANY(v_figli) THEN v_sql:=format('SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2) ORDER BY f.tableoid,f.ctid FOR UPDATE',t);
    ELSE v_sql:=format('SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1 ORDER BY f.tableoid,f.ctid FOR UPDATE',t); END IF;
    FOR m IN EXECUTE v_sql USING p_cantiere_id,v_varianti LOOP NULL; END LOOP;
  END LOOP;
  SELECT coalesce(array_agg(p.id::text ORDER BY p.id::text),ARRAY[]::text[]) INTO v_preventivi FROM public.preventivi_cantiere p WHERE p.cantiere_id=p_cantiere_id;
  SELECT coalesce(array_agg(p.id ORDER BY p.id),ARRAY[]::bigint[]) INTO v_base_lavorazioni FROM public.preventivo_lavorazioni p WHERE p.cantiere_id=p_cantiere_id;
  SELECT coalesce(array_agg(p.id ORDER BY p.id),ARRAY[]::bigint[]) INTO v_var_lavorazioni FROM public.variante_lavorazioni p WHERE p.variante_id=ANY(v_varianti);
  -- Ogni FK entrante: proprieta parent/child tramite UUID, mai per nome legacy.
  -- Una relazione esterna al manifest e' rifiutata anche se vuota: schema non certificato.
  FOR fk IN SELECT k.*, pn.nspname AS ns_padre,pc.relname AS padre,cn.nspname AS ns_figlio,cc.relname AS figlio
    FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class pc ON pc.oid=k.confrelid
      JOIN pg_catalog.pg_namespace pn ON pn.oid=pc.relnamespace
      JOIN pg_catalog.pg_class cc ON cc.oid=k.conrelid JOIN pg_catalog.pg_namespace cn ON cn.oid=cc.relnamespace
    WHERE k.contype='f' AND pn.nspname='public' AND pc.relname=ANY(v_tabelle)
    ORDER BY k.oid
  LOOP
    IF fk.ns_figlio<>'public' OR NOT (fk.figlio=ANY(v_tabelle)) OR NOT fk.convalidated THEN
      RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE=format('Dipendenza non certificata: %s',fk.conname);
    END IF;
    SELECT string_agg(format('f.%I=t.%I',a.attname,b.attname),' AND ' ORDER BY x.ord) INTO v_on
      FROM unnest(fk.conkey,fk.confkey) WITH ORDINALITY x(attnum,refnum,ord)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=x.attnum
      JOIN pg_catalog.pg_attribute b ON b.attrelid=fk.confrelid AND b.attnum=x.refnum;
    IF fk.padre='cantieri' THEN v_padre:='t.id=$1';
    ELSIF fk.padre=ANY(v_figli) THEN v_padre:='t.variante_id=ANY($2)';
    ELSE v_padre:='t.cantiere_id=$1'; END IF;
    IF fk.figlio='cantieri' THEN v_figlio:='f.id=$1';
    ELSIF fk.figlio=ANY(v_figli) THEN v_figlio:='f.variante_id=ANY($2)';
    ELSE v_figlio:='f.cantiere_id=$1'; END IF;
    v_sql:=format('SELECT EXISTS (SELECT 1 FROM %I.%I f JOIN %I.%I t ON %s WHERE (%s) AND (%s) IS NOT TRUE)',fk.ns_figlio,fk.figlio,fk.ns_padre,fk.padre,v_on,v_padre,v_figlio);
    EXECUTE v_sql INTO v_esterna USING p_cantiere_id,v_varianti;
    IF v_esterna THEN RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE=format('Riferimento esterno: %s',fk.conname); END IF;
  END LOOP;
  SELECT jsonb_object_agg(q.entita,q.quantita ORDER BY q.entita) INTO conteggi FROM artecna_distruzione.manifest_cantiere(p_cantiere_id) q;
  IF conteggi->>'cantieri' IS DISTINCT FROM '1' THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Manifest iniziale incoerente'; END IF;
  SELECT * INTO v_jobs_prima FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);
  storage_nuovi := artecna_distruzione.prepara_cleanup_storage(p_cantiere_id);
  SELECT * INTO v_jobs_vecchi FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,v_jobs_prima.max_id);
  SELECT * INTO v_jobs_preparati FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);
  IF v_jobs_vecchi.totale IS DISTINCT FROM v_jobs_prima.totale OR v_jobs_vecchi.impronta IS DISTINCT FROM v_jobs_prima.impronta
     OR v_jobs_preparati.totale IS DISTINCT FROM (v_jobs_prima.totale+storage_nuovi) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Outbox preesistente modificata o conteggio incoerente';
  END IF;
  DELETE FROM public.sal_lavorazioni t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('sal_lavorazioni',v_n);
  DELETE FROM public.variante_documenti t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_documenti',v_n);
  v_totale_lavorazioni := 0;
  LOOP
    DELETE FROM public.variante_lavorazioni t WHERE t.variante_id=ANY(v_varianti)
      AND NOT EXISTS (SELECT 1 FROM public.variante_lavorazioni ref WHERE ref.riferimento_variante_lavorazione_id=t.id);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_totale_lavorazioni := v_totale_lavorazioni + v_n;
    IF v_n=0 THEN
      IF EXISTS (SELECT 1 FROM public.variante_lavorazioni t WHERE t.variante_id=ANY(v_varianti)) THEN
        RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Self-FK Variante: ciclo o dipendenza incompatibile';
      END IF;
      EXIT;
    END IF;
  END LOOP;
  v_eliminate := v_eliminate || jsonb_build_object('variante_lavorazioni',v_totale_lavorazioni);
  DELETE FROM public.variante_sorgenti t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_sorgenti',v_n);
  DELETE FROM public.varianti_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('varianti_cantiere',v_n);
  UPDATE public.cantieri t SET preventivo_contrattuale_id=NULL
    WHERE t.id=p_cantiere_id AND t.preventivo_contrattuale_id IS NOT NULL;
  DELETE FROM public.preventivo_lavorazioni t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('preventivo_lavorazioni',v_n);
  DELETE FROM public.preventivi_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('preventivi_cantiere',v_n);
  DELETE FROM public.foto_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('foto_cantiere',v_n);
  DELETE FROM public.materiali_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('materiali_cantiere',v_n);
  DELETE FROM public.attrezzi_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('attrezzi_cantiere',v_n);
  DELETE FROM public.timbrature t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('timbrature',v_n);
  DELETE FROM public.pagamenti_fornitori t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('pagamenti_fornitori',v_n);
  DELETE FROM public.acconti_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('acconti_cantiere',v_n);
  DELETE FROM public.fatture_emesse t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('fatture_emesse',v_n);
  DELETE FROM public.fatture_fornitori_righe t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('fatture_fornitori_righe',v_n);
  DELETE FROM public.incassi_non_fatturati t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('incassi_non_fatturati',v_n);
  DELETE FROM public.rapportini t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('rapportini',v_n);
  -- Post-check dei dati protetti PRIMA di terminare il contesto.
  FOREACH t IN ARRAY v_tabelle LOOP
    IF t IN ('cantieri','utenti_cantiere') THEN CONTINUE; END IF;
    IF t=ANY(v_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2))',t);
    ELSE v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1)',t); END IF;
    EXECUTE v_sql INTO v_residuo USING p_cantiere_id,v_varianti;
    IF v_residuo OR (v_eliminate->>t)::bigint IS DISTINCT FROM (conteggi->>t)::bigint THEN
      RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE=format('Residui/conteggi incoerenti: %s',t);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.preventivi_cantiere f WHERE f.id::text=ANY(v_preventivi))
     OR EXISTS (SELECT 1 FROM public.preventivo_lavorazioni f WHERE f.id=ANY(v_base_lavorazioni))
     OR EXISTS (SELECT 1 FROM public.variante_lavorazioni f WHERE f.id=ANY(v_var_lavorazioni)) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Identita target residue';
  END IF;
  SELECT * INTO v_jobs_dopo FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);
  IF to_jsonb(v_jobs_dopo) IS DISTINCT FROM to_jsonb(v_jobs_preparati) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Outbox persa o modificata dopo DELETE';
  END IF;
  PERFORM artecna_distruzione.termina_contesto();
  IF artecna_distruzione.contesto_valido(p_cantiere_id) THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Contesto non terminato'; END IF;
  DELETE FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n IS DISTINCT FROM (conteggi->>'utenti_cantiere')::bigint OR EXISTS (SELECT 1 FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Membership residue/conteggi incoerenti';
  END IF;
  -- Ultima cancellazione applicativa.
  DELETE FROM public.cantieri c WHERE c.id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n<>1 OR EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id=p_cantiere_id) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Cantiere residuo';
  END IF;
  -- Ripete l'intero perimetro con UUID Varianti salvati, senza dipendere da join spariti.
  FOREACH t IN ARRAY v_tabelle LOOP
    IF t='cantieri' THEN v_sql:='SELECT EXISTS (SELECT 1 FROM public.cantieri f WHERE f.id=$1)';
    ELSIF t=ANY(v_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2))',t);
    ELSE v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1)',t); END IF;
    EXECUTE v_sql INTO v_residuo USING p_cantiere_id,v_varianti;
    IF v_residuo THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE=format('Verifica finale fallita: %s',t); END IF;
  END LOOP;
  cantiere_id := p_cantiere_id;
  eliminato := true;
  RETURN NEXT;
EXCEPTION WHEN foreign_key_violation THEN
  -- Il blocco EXCEPTION annulla TUTTE le scritture precedenti, poi propaga l'errore.
  RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Dipendenza FK incompatibile: eliminazione annullata',DETAIL=SQLERRM;
END;

  $rpcbody$$rpcddl$;
  EXECUTE 'REVOKE ALL ON FUNCTION public.elimina_cantiere_definitivamente(uuid,text) FROM PUBLIC, anon, artecna_cantieri_rpc';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.elimina_cantiere_definitivamente(uuid,text) TO authenticated, artecna_cantieri_delete_rpc';
  EXECUTE 'RESET ROLE';
  EXECUTE 'REVOKE CREATE ON SCHEMA public FROM artecna_cantieri_delete_rpc';
  IF v_temp_member_prima IS NULL THEN
    EXECUTE 'REVOKE artecna_cantieri_delete_rpc FROM postgres GRANTED BY postgres RESTRICT';
  ELSE
    EXECUTE format('GRANT artecna_cantieri_delete_rpc TO postgres WITH ADMIN %s, INHERIT %s, SET %s GRANTED BY postgres',
      v_temp_member_prima->>'admin_option',v_temp_member_prima->>'inherit_option',v_temp_member_prima->>'set_option');
  END IF;
  SELECT f.* INTO p FROM pg_catalog.pg_proc f WHERE f.oid=to_regprocedure('public.elimina_cantiere_definitivamente(uuid,text)');
  IF NOT FOUND THEN RAISE EXCEPTION 'RPC assente dopo creazione'; END IF;
  IF p.proowner<>v_newrole OR NOT p.prosecdef OR p.prokind<>'f' OR p.provolatile<>'v'
    OR p.prorettype<>'record'::regtype OR NOT p.proretset OR p.pronargs<>2
    OR p.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
    OR p.proallargtypes IS DISTINCT FROM ARRAY['uuid'::regtype::oid,'text'::regtype::oid,'uuid'::regtype::oid,'bool'::regtype::oid,'int8'::regtype::oid,'jsonb'::regtype::oid]
    OR p.proargmodes IS DISTINCT FROM ARRAY['i','i','t','t','t','t']::"char"[]
    OR p.proargnames IS DISTINCT FROM ARRAY['p_cantiere_id','p_conferma','cantiere_id','eliminato','storage_nuovi','conteggi']::text[]
    OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[]
    OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE') OR NOT has_function_privilege(v_newrole,p.oid,'EXECUTE')
    OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('artecna_cantieri_rpc',p.oid,'EXECUTE')
    OR EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE a.grantee NOT IN ('authenticated'::regrole,v_newrole) OR a.privilege_type<>'EXECUTE' OR a.is_grantable) THEN
    RAISE EXCEPTION 'Firma/owner/sicurezza/ACL RPC divergenti';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE oid=v_newrole AND NOT rolcanlogin AND NOT rolsuper
      AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND NOT rolreplication AND rolbypassrls)
    OR (SELECT count(*) FROM pg_catalog.pg_proc WHERE proowner=v_newrole)<>1
    OR (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.oid) FROM pg_catalog.pg_auth_members m WHERE m.roleid=v_newrole) IS DISTINCT FROM v_member_created
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=v_newrole)
    OR pg_has_role('postgres',v_newrole,'SET') OR pg_has_role('postgres',v_newrole,'USAGE')
    OR has_schema_privilege(v_newrole,'public','CREATE')
    OR current_setting('createrole_self_grant') IS DISTINCT FROM v_selfgrant THEN
    RAISE EXCEPTION 'Ruolo dedicato/membership/CREATE temporanei divergenti';
  END IF;
  FOR r IN SELECT oid,rolname FROM pg_catalog.pg_roles WHERE rolname IN ('authenticated','anon','service_role','artecna_cantieri_rpc')
  LOOP
    IF pg_has_role(r.oid,v_newrole,'MEMBER') THEN RAISE EXCEPTION 'Membership client/condiviso vietata: %',r.rolname; END IF;
  END LOOP;
  IF (SELECT to_jsonb(pr) FROM pg_catalog.pg_roles pr WHERE pr.rolname='artecna_cantieri_rpc') IS DISTINCT FROM v_role_shared
    OR (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.oid),'[]'::jsonb) FROM pg_catalog.pg_auth_members m
      WHERE m.roleid='artecna_cantieri_rpc'::regrole OR m.member='artecna_cantieri_rpc'::regrole) IS DISTINCT FROM v_member_shared THEN
    RAISE EXCEPTION 'Ruolo condiviso/attributi/membership modificati';
  END IF;
  -- Confronta tutte le ACL applicative preesistenti, comprese quelle di colonna.
  IF (SELECT jsonb_agg(jsonb_build_object('tabella',c.oid,'acl',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
      FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee<>v_newrole),
    'colonne',(SELECT jsonb_agg(jsonb_build_object('attnum',b.attnum,'acl',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
      FROM aclexplode(b.attacl) a WHERE a.grantee<>v_newrole)) ORDER BY b.attnum) FROM pg_catalog.pg_attribute b WHERE b.attrelid=c.oid AND b.attnum>0 AND NOT b.attisdropped)) ORDER BY c.oid)
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('cantieri','rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere','variante_lavorazioni','variante_documenti','variante_sorgenti')) IS DISTINCT FROM v_table_acl THEN
    RAISE EXCEPTION 'ACL applicative/colonne preesistenti modificate';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('cantieri','preventivo_contrattuale_id'),('rapportini','cantiere_id'),('foto_cantiere','cantiere_id'),('timbrature','cantiere_id'),('materiali_cantiere','cantiere_id'),('attrezzi_cantiere','cantiere_id'),('pagamenti_fornitori','cantiere_id'),('acconti_cantiere','cantiere_id'),('fatture_emesse','cantiere_id'),('fatture_fornitori_righe','cantiere_id'),('incassi_non_fatturati','cantiere_id'),('sal_lavorazioni','cantiere_id'),('preventivo_lavorazioni','cantiere_id'),('preventivi_cantiere','cantiere_id'),('varianti_cantiere','cantiere_id'),('utenti_cantiere','cantiere_id'),('variante_lavorazioni','variante_id'),('variante_documenti','variante_id'),('variante_sorgenti','variante_id')) AS q(tabella,colonna)
  LOOP
    IF NOT has_table_privilege(v_newrole,'public.'||r.tabella,'SELECT') OR NOT has_table_privilege(v_newrole,'public.'||r.tabella,'DELETE')
      OR NOT has_column_privilege(v_newrole,'public.'||r.tabella,r.colonna,'UPDATE')
      OR has_table_privilege('artecna_cantieri_rpc','public.'||r.tabella,'SELECT,UPDATE,DELETE')
      OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c,LATERAL aclexplode(c.relacl) a WHERE c.oid=to_regclass('public.'||r.tabella)
        AND a.grantee=v_newrole AND (a.privilege_type NOT IN ('SELECT','DELETE') OR a.is_grantable))
      OR EXISTS (SELECT 1 FROM pg_catalog.pg_attribute b,LATERAL aclexplode(b.attacl) a WHERE b.attrelid=to_regclass('public.'||r.tabella)
        AND a.grantee=v_newrole AND (b.attname<>r.colonna OR a.privilege_type<>'UPDATE' OR a.is_grantable)) THEN
      RAISE EXCEPTION 'Privilegi dedicati/condivisi divergenti: %',r.tabella;
    END IF;
  END LOOP;
  -- Tutte le funzioni preesistenti: solamente quattro prosrc e otto ACL possono cambiare.
  FOR v_snapshot IN SELECT value FROM jsonb_array_elements(funzioni_prima)
  LOOP
    SELECT f.* INTO v_proc_after FROM pg_catalog.pg_proc f WHERE f.oid=(v_snapshot.value->>'oid')::oid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Funzione preesistente rimossa'; END IF;
    IF v_proc_after.oid NOT IN (to_regprocedure('artecna_distruzione.inizia_contesto(uuid)'),to_regprocedure('artecna_distruzione.contesto_valido(uuid)'),
      to_regprocedure('artecna_distruzione.contesto_variante_valido(uuid)'),to_regprocedure('artecna_distruzione.termina_contesto()'),
      to_regprocedure('artecna_distruzione.manifest_cantiere(uuid)'),to_regprocedure('artecna_distruzione.prepara_cleanup_storage(uuid)'),
      to_regprocedure('artecna_guardie.proteggi_variante_testata()'),to_regprocedure('artecna_guardie.proteggi_variante_figlio()'),
      to_regprocedure('artecna_guardie.utente_jwt_corrente()'),to_regprocedure('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)'))
      AND to_jsonb(v_proc_after) IS DISTINCT FROM v_snapshot.value THEN
      RAISE EXCEPTION 'Funzione non migrata deve essere integralmente invariata: %',v_proc_after.oid::regprocedure;
    END IF;
    v_src_expected := v_snapshot.value->>'prosrc';
    IF v_proc_after.oid IN (to_regprocedure('artecna_distruzione.inizia_contesto(uuid)'),to_regprocedure('artecna_distruzione.contesto_valido(uuid)'),
      to_regprocedure('artecna_guardie.proteggi_variante_testata()'),to_regprocedure('artecna_guardie.proteggi_variante_figlio()')) THEN
      v_src_expected := replace(v_src_expected,$old_role$'artecna_cantieri_rpc'$old_role$,$new_role$'artecna_cantieri_delete_rpc'$new_role$);
    END IF;
    IF v_proc_after.prosrc IS DISTINCT FROM v_src_expected
      OR (to_jsonb(v_proc_after)-'prosrc'-'proacl') IS DISTINCT FROM (v_snapshot.value-'prosrc'-'proacl') THEN
      RAISE EXCEPTION 'Prosrc/attributi preesistenti modificati oltre lo scope: %',v_proc_after.oid::regprocedure;
    END IF;
    SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable) INTO v_acl_before
      FROM aclexplode(coalesce((SELECT array_agg(value #>> '{}')::aclitem[] FROM jsonb_array_elements(nullif(v_snapshot.value->'proacl','null'::jsonb))),
        acldefault('f',(v_snapshot.value->>'proowner')::oid))) a;
    IF v_proc_after.pronamespace=to_regnamespace('artecna_distruzione') AND v_proc_after.proname IN
      ('inizia_contesto','contesto_valido','contesto_variante_valido','termina_contesto','manifest_cantiere','prepara_cleanup_storage') THEN
      SELECT jsonb_agg(item ORDER BY (item->>'grantor')::oid,(item->>'grantee')::oid,item->>'privilege_type',(item->>'is_grantable')::boolean)
        INTO v_acl_before FROM (SELECT value || jsonb_build_object('grantee',v_newrole) AS item FROM jsonb_array_elements(v_acl_before)
          WHERE (value->>'grantee')::oid='artecna_cantieri_rpc'::regrole
          UNION ALL SELECT value AS item FROM jsonb_array_elements(v_acl_before) WHERE (value->>'grantee')::oid<>'artecna_cantieri_rpc'::regrole) q;
    ELSIF v_proc_after.oid IN (to_regprocedure('artecna_guardie.utente_jwt_corrente()'),to_regprocedure('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)')) THEN
      SELECT jsonb_agg(value ORDER BY (value->>'grantor')::oid,(value->>'grantee')::oid,value->>'privilege_type',(value->>'is_grantable')::boolean)
        INTO v_acl_before FROM jsonb_array_elements(v_acl_before || jsonb_build_array(jsonb_build_object('grantor','postgres'::regrole::oid,
          'grantee',v_newrole,'privilege_type','EXECUTE','is_grantable',false)));
    END IF;
    SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable) INTO v_acl_after
      FROM aclexplode(coalesce(v_proc_after.proacl,acldefault('f',v_proc_after.proowner))) a;
    IF v_acl_after IS DISTINCT FROM v_acl_before THEN RAISE EXCEPTION 'ACL funzione fuori scope: %',v_proc_after.oid::regprocedure; END IF;
  END LOOP;
  IF (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_catalog.pg_trigger t) IS DISTINCT FROM trigger_prima THEN
    RAISE EXCEPTION 'Trigger modificati';
  END IF;
  IF (SELECT to_jsonb(c) FROM pg_catalog.pg_class c WHERE c.oid='artecna_distruzione.contesto'::regclass) IS DISTINCT FROM contesto_prima
    OR EXISTS (SELECT 1 FROM artecna_distruzione.contesto)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='artecna_distruzione.contesto'::regclass
      AND conname='contesto_ruolo_check' AND convalidated AND pg_get_constraintdef(oid,true)=$check_new$CHECK (ruolo = 'artecna_cantieri_delete_rpc'::name)$check_new$) THEN
    RAISE EXCEPTION 'Contesto/CHECK/attributi divergenti';
  END IF;
  IF (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
      FROM pg_catalog.pg_namespace n,LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
      WHERE n.nspname='public' AND a.grantee<>v_newrole) IS DISTINCT FROM v_acl_public
    OR (SELECT to_jsonb(n)-'nspacl' FROM pg_catalog.pg_namespace n WHERE n.nspname='artecna_distruzione') IS DISTINCT FROM (ns_prima-'nspacl')
    OR (SELECT to_jsonb(n)-'nspacl' FROM pg_catalog.pg_namespace n WHERE n.nspname='artecna_guardie') IS DISTINCT FROM (v_guardie_namespace-'nspacl') THEN
    RAISE EXCEPTION 'Attributi/ACL schema fuori scope';
  END IF;
  -- ACL private esatte: postgres UC, nuovo ruolo U; nessun vecchio ruolo/client.
  IF NOT has_schema_privilege(v_newrole,'artecna_distruzione','USAGE')
    OR has_schema_privilege('artecna_cantieri_rpc','artecna_distruzione','USAGE')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_namespace n,LATERAL aclexplode(n.nspacl) a WHERE n.nspname='artecna_distruzione'
      AND (a.grantee NOT IN ('postgres'::regrole,v_newrole) OR (a.grantee=v_newrole AND (a.privilege_type<>'USAGE' OR a.is_grantable)))) THEN
    RAISE EXCEPTION 'ACL schema privato divergenti';
  END IF;
  IF (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
      FROM pg_catalog.pg_namespace n,LATERAL aclexplode(n.nspacl) a WHERE n.nspname='artecna_distruzione') IS DISTINCT FROM
    (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
      FROM aclexplode(ARRAY['postgres=UC/postgres','artecna_cantieri_delete_rpc=U/postgres']::aclitem[]) a) THEN
    RAISE EXCEPTION 'ACL schema privato non corrispondenti alla migrazione certificata';
  END IF;
  SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable) INTO v_acl_after
    FROM pg_catalog.pg_namespace n,LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
    WHERE n.nspname='artecna_guardie' AND a.grantee<>v_newrole;
  SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable) INTO v_acl_before
    FROM aclexplode(coalesce((SELECT array_agg(value #>> '{}')::aclitem[] FROM jsonb_array_elements(nullif(v_guardie_namespace->'nspacl','null'::jsonb))),
      acldefault('n',(v_guardie_namespace->>'nspowner')::oid))) a;
  IF v_acl_after IS DISTINCT FROM v_acl_before THEN RAISE EXCEPTION 'ACL guardie preesistenti modificate'; END IF;
  IF has_table_privilege(v_newrole,'artecna_distruzione.cleanup_storage','SELECT,INSERT,UPDATE,DELETE')
    OR has_table_privilege(v_newrole,'artecna_distruzione.contesto','SELECT,INSERT,UPDATE,DELETE')
    OR has_sequence_privilege(v_newrole,pg_get_serial_sequence('artecna_distruzione.cleanup_storage','id'),'USAGE,SELECT,UPDATE') THEN
    RAISE EXCEPTION 'Accesso diretto a infrastruttura privata vietato';
  END IF;
  FOR r IN SELECT oid,rolname FROM pg_catalog.pg_roles WHERE rolname IN ('authenticated','anon','artecna_cantieri_rpc')
  LOOP
    IF has_schema_privilege(r.oid,'artecna_distruzione','USAGE') OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc f
      WHERE f.pronamespace=to_regnamespace('artecna_distruzione') AND has_function_privilege(r.oid,f.oid,'EXECUTE')) THEN
      RAISE EXCEPTION 'Accesso residuo ai helper distruttivi: %',r.rolname;
    END IF;
  END LOOP;
  SELECT f.* INTO p FROM pg_catalog.pg_proc f WHERE f.oid=to_regprocedure('artecna_distruzione.impronta_cleanup_storage(uuid,bigint)');
  IF NOT FOUND THEN RAISE EXCEPTION 'Helper impronta assente'; END IF;
  IF p.proowner<>'postgres'::regrole OR NOT p.prosecdef OR p.prokind<>'f' OR p.provolatile<>'v'
    OR p.prorettype<>'record'::regtype OR NOT p.proretset
    OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp','row_security=off']::text[]
    OR NOT has_function_privilege(v_newrole,p.oid,'EXECUTE')
    OR EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE a.grantee NOT IN ('postgres'::regrole,v_newrole) OR a.privilege_type<>'EXECUTE' OR a.is_grantable) THEN
    RAISE EXCEPTION 'Helper impronta: attributi/ACL divergenti';
  END IF;
END;
$install$;
COMMIT;
