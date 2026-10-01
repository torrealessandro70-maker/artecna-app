-- Preparazione soltanto: nessuna cancellazione, riparazione o modifica persistente.
-- Manifest dei nomi certificati dal DB e dalle migration Varianti.
-- Non abilita alcun percorso di eliminazione; non legge dati applicativi/Storage.
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
