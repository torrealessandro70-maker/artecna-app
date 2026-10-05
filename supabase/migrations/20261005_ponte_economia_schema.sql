-- Ponte Economia -> Variante, micro-step 3: solo schema e protezioni.
-- Baseline: audit Production 2B/2C. Nessuna RPC writer o acquisizione reale.
-- CLEANUP CANTIERE V2: elimina_cantiere_definitivamente resta INVARIATA.
-- Il cleanup storico non gestisce questa nuova FK RESTRICT (oltre alle FK
-- Rapportini/Allegati gia note). Non utilizzare quel cleanup per questi domini
-- prima dell'intervento autonomo V2. Non si indebolisce qui la sua whitelist.
BEGIN;

DO $installazione$
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Installazione riservata a postgres';
  END IF;
  IF to_regclass('public.variante_sorgenti') IS NULL
    OR to_regclass('public.variante_lavorazioni') IS NULL
    OR to_regclass('public.varianti_cantiere') IS NULL
    OR to_regclass('public.economia_raccolte') IS NULL
    OR to_regnamespace('artecna_guardie') IS NULL THEN
    RAISE EXCEPTION 'Baseline ponte Economia assente';
  END IF;
END;
$installazione$;

-- Nessuna modifica dati. Impedisce DML concorrente durante certificazione/DDL.
LOCK TABLE public.varianti_cantiere, public.variante_sorgenti,
  public.variante_lavorazioni, public.economia_raccolte IN ACCESS EXCLUSIVE MODE;

-- Solo oggetti temporanei postgres; eliminati al COMMIT/ROLLBACK.
CREATE TEMP TABLE ponte_economia_baseline ON COMMIT DROP AS
SELECT
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid)
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','artecna_guardie','artecna_distruzione','artecna_rapportini')) AS funzioni,
  (SELECT jsonb_agg(to_jsonb(n) ORDER BY n.oid) FROM pg_catalog.pg_namespace n
    WHERE n.nspname IN ('public','artecna_guardie','artecna_distruzione','artecna_rapportini')) AS schemi,
  (SELECT jsonb_agg(jsonb_build_object('oid',c.oid,'owner',c.relowner,'acl',c.relacl::text,
    'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) ORDER BY c.oid)
    FROM pg_catalog.pg_class c WHERE c.oid IN ('public.variante_sorgenti'::regclass,
      'public.variante_lavorazioni'::regclass,'public.varianti_cantiere'::regclass,
      'public.economia_raccolte'::regclass)) AS tabelle,
  (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum)
    FROM pg_catalog.pg_attribute a WHERE a.attrelid IN ('public.variante_sorgenti'::regclass,
      'public.variante_lavorazioni'::regclass,'public.varianti_cantiere'::regclass,
      'public.economia_raccolte'::regclass) AND a.attnum>0) AS colonne,
  (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM public.variante_sorgenti s) AS righe_sorgenti,
  (SELECT jsonb_agg(to_jsonb(k) ORDER BY k.oid) FROM pg_catalog.pg_constraint k
    WHERE k.conrelid='public.variante_sorgenti'::regclass AND k.contype IN ('p','u','f','x')) AS vincoli_storici;

-- NOT NULL certificati via pg_attribute (PG18 li espone anche come contype n).
-- BASELINE_CATALOGO: valori esatti esportati dal catalogo Production.
DO $preflight$
DECLARE actual jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid='public.variante_sorgenti'::regclass
    AND relowner='postgres'::regrole AND relrowsecurity AND NOT relforcerowsecurity AND relkind='r') THEN
    RAISE EXCEPTION 'Baseline variante_sorgenti owner/RLS inattesa';
  END IF;
  SELECT jsonb_agg(jsonb_build_object('nome',a.attname,'posizione',a.attnum,'tipo',format_type(a.atttypid,a.atttypmod),'nullable',NOT a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'acl',a.attacl::text) ORDER BY a.attnum) INTO actual FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.variante_sorgenti'::regclass AND a.attnum>0 AND NOT a.attisdropped;
  IF actual IS DISTINCT FROM $catalogo$
[
  {
    "nome": "id",
    "posizione": 1,
    "tipo": "uuid",
    "nullable": false,
    "default": "gen_random_uuid()",
    "identity": "",
    "acl": null
  },
  {
    "nome": "variante_id",
    "posizione": 2,
    "tipo": "uuid",
    "nullable": false,
    "default": null,
    "identity": "",
    "acl": "{artecna_cantieri_delete_rpc=w/postgres}"
  },
  {
    "nome": "tipo",
    "posizione": 3,
    "tipo": "text",
    "nullable": false,
    "default": null,
    "identity": "",
    "acl": null
  },
  {
    "nome": "preventivo_sorgente_id",
    "posizione": 4,
    "tipo": "uuid",
    "nullable": true,
    "default": null,
    "identity": "",
    "acl": null
  },
  {
    "nome": "titolo",
    "posizione": 5,
    "tipo": "text",
    "nullable": false,
    "default": null,
    "identity": "",
    "acl": null
  },
  {
    "nome": "nome_file",
    "posizione": 6,
    "tipo": "text",
    "nullable": true,
    "default": null,
    "identity": "",
    "acl": null
  },
  {
    "nome": "formato",
    "posizione": 7,
    "tipo": "text",
    "nullable": true,
    "default": null,
    "identity": "",
    "acl": null
  },
  {
    "nome": "file_sha256",
    "posizione": 8,
    "tipo": "text",
    "nullable": true,
    "default": null,
    "identity": "",
    "acl": null
  },
  {
    "nome": "snapshot_version",
    "posizione": 9,
    "tipo": "integer",
    "nullable": false,
    "default": "1",
    "identity": "",
    "acl": null
  },
  {
    "nome": "snapshot",
    "posizione": 10,
    "tipo": "jsonb",
    "nullable": false,
    "default": null,
    "identity": "",
    "acl": null
  },
  {
    "nome": "created_at",
    "posizione": 11,
    "tipo": "timestamp with time zone",
    "nullable": false,
    "default": "now()",
    "identity": "",
    "acl": null
  }
]
$catalogo$::jsonb THEN RAISE EXCEPTION 'Baseline colonne variante_sorgenti inattesa'; END IF;
  SELECT jsonb_agg(jsonb_build_object('nome',k.conname,'tipo',k.contype,'definizione',pg_get_constraintdef(k.oid),'validated',k.convalidated,'deferrable',k.condeferrable,'deferred',k.condeferred) ORDER BY k.conname) INTO actual FROM pg_catalog.pg_constraint k WHERE k.conrelid='public.variante_sorgenti'::regclass AND k.contype IN ('p','u','f','c','x');
  IF actual IS DISTINCT FROM $catalogo$
[
  {
    "nome": "variante_sorgenti_coerenza_tipo_check",
    "tipo": "c",
    "definizione": "CHECK ((((tipo = 'preventivo_artecna'::text) AND (preventivo_sorgente_id IS NOT NULL) AND (nome_file IS NULL) AND (formato IS NULL) AND (file_sha256 IS NULL)) OR ((tipo = 'file'::text) AND (preventivo_sorgente_id IS NULL) AND (nome_file IS NOT NULL) AND (btrim(nome_file) <> ''::text) AND (formato IS NOT NULL) AND (formato = ANY (ARRAY['pdf'::text, 'excel'::text, 'immagine'::text])))))",
    "validated": true,
    "deferrable": false,
    "deferred": false
  },
  {
    "nome": "variante_sorgenti_pkey",
    "tipo": "p",
    "definizione": "PRIMARY KEY (id)",
    "validated": true,
    "deferrable": false,
    "deferred": false
  },
  {
    "nome": "variante_sorgenti_preventivo_fk",
    "tipo": "f",
    "definizione": "FOREIGN KEY (preventivo_sorgente_id) REFERENCES preventivi_cantiere(id) ON DELETE RESTRICT",
    "validated": true,
    "deferrable": false,
    "deferred": false
  },
  {
    "nome": "variante_sorgenti_snapshot_check",
    "tipo": "c",
    "definizione": "CHECK ((jsonb_typeof(snapshot) = 'object'::text))",
    "validated": true,
    "deferrable": false,
    "deferred": false
  },
  {
    "nome": "variante_sorgenti_snapshot_version_check",
    "tipo": "c",
    "definizione": "CHECK ((snapshot_version > 0))",
    "validated": true,
    "deferrable": false,
    "deferred": false
  },
  {
    "nome": "variante_sorgenti_tipo_check",
    "tipo": "c",
    "definizione": "CHECK ((tipo = ANY (ARRAY['preventivo_artecna'::text, 'file'::text])))",
    "validated": true,
    "deferrable": false,
    "deferred": false
  },
  {
    "nome": "variante_sorgenti_titolo_check",
    "tipo": "c",
    "definizione": "CHECK ((btrim(titolo) <> ''::text))",
    "validated": true,
    "deferrable": false,
    "deferred": false
  },
  {
    "nome": "variante_sorgenti_variante_fk",
    "tipo": "f",
    "definizione": "FOREIGN KEY (variante_id) REFERENCES varianti_cantiere(id) ON DELETE RESTRICT",
    "validated": true,
    "deferrable": false,
    "deferred": false
  }
]
$catalogo$::jsonb THEN RAISE EXCEPTION 'Baseline vincoli variante_sorgenti inattesa'; END IF;
  SELECT jsonb_agg(jsonb_build_object('nome',c.relname,'definizione',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid,'ready',i.indisready,'unique',i.indisunique,'immediate',i.indimmediate) ORDER BY c.relname) INTO actual FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid=i.indexrelid WHERE i.indrelid='public.variante_sorgenti'::regclass;
  IF actual IS DISTINCT FROM $catalogo$
[
  {
    "nome": "variante_sorgenti_file_sha256_unique",
    "definizione": "CREATE UNIQUE INDEX variante_sorgenti_file_sha256_unique ON public.variante_sorgenti USING btree (variante_id, file_sha256) WHERE ((tipo = 'file'::text) AND (file_sha256 IS NOT NULL))",
    "valid": true,
    "ready": true,
    "unique": true,
    "immediate": true
  },
  {
    "nome": "variante_sorgenti_lettura_idx",
    "definizione": "CREATE INDEX variante_sorgenti_lettura_idx ON public.variante_sorgenti USING btree (variante_id, created_at, id)",
    "valid": true,
    "ready": true,
    "unique": false,
    "immediate": true
  },
  {
    "nome": "variante_sorgenti_pkey",
    "definizione": "CREATE UNIQUE INDEX variante_sorgenti_pkey ON public.variante_sorgenti USING btree (id)",
    "valid": true,
    "ready": true,
    "unique": true,
    "immediate": true
  },
  {
    "nome": "variante_sorgenti_preventivo_unique",
    "definizione": "CREATE UNIQUE INDEX variante_sorgenti_preventivo_unique ON public.variante_sorgenti USING btree (variante_id, preventivo_sorgente_id) WHERE (tipo = 'preventivo_artecna'::text)",
    "valid": true,
    "ready": true,
    "unique": true,
    "immediate": true
  }
]
$catalogo$::jsonb THEN RAISE EXCEPTION 'Baseline indici variante_sorgenti inattesa'; END IF;
  IF EXISTS (SELECT 1 FROM public.variante_sorgenti WHERE tipo='raccolta_economia') THEN
    RAISE EXCEPTION 'Sorgenti Economia preesistenti';
  END IF;
  IF to_regprocedure('artecna_guardie.proteggi_ponte_economia()') IS NOT NULL
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE NOT tgisinternal
      AND tgrelid IN ('public.variante_sorgenti'::regclass,'public.variante_lavorazioni'::regclass)
      AND tgname IN ('ponte_economia_sorgenti','ponte_economia_lavorazioni'))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN
        ('variante_sorgenti_economia_raccolta_unique','variante_sorgenti_economia_variante_unique'))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.variante_sorgenti'::regclass
      AND conname='variante_sorgenti_economia_raccolta_fk') THEN
    RAISE EXCEPTION 'Estensione ponte Economia gia presente o nome occupato';
  END IF;
END;
$preflight$;

CREATE TEMP TABLE ponte_economia_struttura_attesa (
  id uuid CONSTRAINT variante_sorgenti_pkey primary key default gen_random_uuid(),
  variante_id uuid not null,
  tipo text not null,
  preventivo_sorgente_id uuid,
  titolo text not null,
  nome_file text,
  formato text,
  file_sha256 text,
  snapshot_version integer not null default 1,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),

  constraint variante_sorgenti_tipo_check
    check (tipo in ('preventivo_artecna', 'file')),
  constraint variante_sorgenti_titolo_check
    check (btrim(titolo) <> ''),
  constraint variante_sorgenti_snapshot_version_check
    check (snapshot_version > 0),
  constraint variante_sorgenti_snapshot_check
    check (jsonb_typeof(snapshot) = 'object'),
  constraint variante_sorgenti_coerenza_tipo_check
    check (
      (
        tipo = 'preventivo_artecna'
        and preventivo_sorgente_id is not null
        and nome_file is null
        and formato is null
        and file_sha256 is null
      )
      or
      (
        tipo = 'file'
        and preventivo_sorgente_id is null
        and nome_file is not null
        and btrim(nome_file) <> ''
        and formato is not null
        and formato in ('pdf', 'excel', 'immagine')
      )
    )
) ON COMMIT DROP;
ALTER TABLE pg_temp.ponte_economia_struttura_attesa
  ADD COLUMN economia_raccolta_id uuid,
  ADD COLUMN economia_revisione_sorgente bigint,
  ADD COLUMN economia_revisione_congelata bigint,
  DROP CONSTRAINT variante_sorgenti_tipo_check,
  DROP CONSTRAINT variante_sorgenti_coerenza_tipo_check,
  ADD CONSTRAINT variante_sorgenti_tipo_check
    CHECK (tipo IN ('preventivo_artecna','file','raccolta_economia')),
  ADD CONSTRAINT variante_sorgenti_coerenza_tipo_check CHECK (
    (
      economia_raccolta_id IS NULL AND economia_revisione_sorgente IS NULL
      AND economia_revisione_congelata IS NULL
      AND (
        (tipo='preventivo_artecna' AND preventivo_sorgente_id IS NOT NULL
          AND nome_file IS NULL AND formato IS NULL AND file_sha256 IS NULL)
        OR
        (tipo='file' AND preventivo_sorgente_id IS NULL
          AND nome_file IS NOT NULL AND btrim(nome_file)<>''
          AND formato IS NOT NULL AND formato IN ('pdf','excel','immagine'))
      )
    )
    OR
    (tipo='raccolta_economia' AND economia_raccolta_id IS NOT NULL
      AND economia_revisione_sorgente IS NOT NULL AND economia_revisione_sorgente>=0
      AND economia_revisione_congelata IS NOT NULL AND economia_revisione_congelata>=0
      -- numeric evita overflow bigint per R=9223372036854775807.
      AND economia_revisione_congelata::numeric IN
        (economia_revisione_sorgente::numeric,economia_revisione_sorgente::numeric+1)
      AND preventivo_sorgente_id IS NULL AND nome_file IS NULL
      AND formato IS NULL AND file_sha256 IS NULL)
  );


ALTER TABLE public.variante_sorgenti
  ADD COLUMN economia_raccolta_id uuid,
  ADD COLUMN economia_revisione_sorgente bigint,
  ADD COLUMN economia_revisione_congelata bigint,
  ADD CONSTRAINT variante_sorgenti_economia_raccolta_fk
    FOREIGN KEY (economia_raccolta_id) REFERENCES public.economia_raccolte(id)
    ON DELETE RESTRICT NOT DEFERRABLE,
  DROP CONSTRAINT variante_sorgenti_tipo_check,
  DROP CONSTRAINT variante_sorgenti_coerenza_tipo_check,
  ADD CONSTRAINT variante_sorgenti_tipo_check
    CHECK (tipo IN ('preventivo_artecna','file','raccolta_economia')),
  ADD CONSTRAINT variante_sorgenti_coerenza_tipo_check CHECK (
    (
      economia_raccolta_id IS NULL AND economia_revisione_sorgente IS NULL
      AND economia_revisione_congelata IS NULL
      AND (
        (tipo='preventivo_artecna' AND preventivo_sorgente_id IS NOT NULL
          AND nome_file IS NULL AND formato IS NULL AND file_sha256 IS NULL)
        OR
        (tipo='file' AND preventivo_sorgente_id IS NULL
          AND nome_file IS NOT NULL AND btrim(nome_file)<>''
          AND formato IS NOT NULL AND formato IN ('pdf','excel','immagine'))
      )
    )
    OR
    (tipo='raccolta_economia' AND economia_raccolta_id IS NOT NULL
      AND economia_revisione_sorgente IS NOT NULL AND economia_revisione_sorgente>=0
      AND economia_revisione_congelata IS NOT NULL AND economia_revisione_congelata>=0
      -- numeric evita overflow bigint per R=9223372036854775807.
      AND economia_revisione_congelata::numeric IN
        (economia_revisione_sorgente::numeric,economia_revisione_sorgente::numeric+1)
      AND preventivo_sorgente_id IS NULL AND nome_file IS NULL
      AND formato IS NULL AND file_sha256 IS NULL)
  );

CREATE UNIQUE INDEX variante_sorgenti_economia_raccolta_unique
  ON public.variante_sorgenti(economia_raccolta_id) WHERE tipo='raccolta_economia';
CREATE UNIQUE INDEX variante_sorgenti_economia_variante_unique
  ON public.variante_sorgenti(variante_id) WHERE tipo='raccolta_economia';

-- Fail-closed: nessuna eccezione writer finche non esiste una RPC controllata.
-- Nessun GUC, token, session flag, ruolo creato o bypass per postgres/browser.
-- Il micro-step 4 dovra sostituire esplicitamente questa guardia con l'eccezione
-- limitata alla creazione atomica del writer. UPDATE/DELETE rimarranno vietati.
CREATE FUNCTION artecna_guardie.proteggi_ponte_economia() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO pg_catalog,pg_temp AS $guardia$
DECLARE ids uuid[]; sorgenti uuid[]; v uuid; coinvolge_economia boolean:=false;
BEGIN
  IF TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME NOT IN ('variante_sorgenti','variante_lavorazioni')
    OR TG_OP NOT IN ('INSERT','UPDATE','DELETE') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Contesto ponte Economia non consentito';
  END IF;
  IF TG_OP='INSERT' THEN ids:=ARRAY[NEW.variante_id];
  ELSIF TG_OP='DELETE' THEN ids:=ARRAY[OLD.variante_id];
  ELSE ids:=ARRAY[OLD.variante_id,NEW.variante_id]; END IF;
  -- Classificazione senza lock di riga: nessuna nuova serializzazione storica.
  IF TG_TABLE_NAME='variante_sorgenti' THEN
    IF TG_OP<>'INSERT' THEN coinvolge_economia:=COALESCE(OLD.tipo='raccolta_economia',false); END IF;
    IF TG_OP<>'DELETE' THEN
      coinvolge_economia:=coinvolge_economia OR COALESCE(NEW.tipo='raccolta_economia',false);
    END IF;
  ELSE
    IF TG_OP='INSERT' THEN sorgenti:=ARRAY[NEW.variante_sorgente_id];
    ELSIF TG_OP='DELETE' THEN sorgenti:=ARRAY[OLD.variante_sorgente_id];
    ELSE sorgenti:=ARRAY[OLD.variante_sorgente_id,NEW.variante_sorgente_id]; END IF;
    coinvolge_economia:=EXISTS (SELECT 1 FROM public.variante_sorgenti s
      WHERE s.id=ANY(sorgenti) AND s.tipo='raccolta_economia');
  END IF;
  coinvolge_economia:=coinvolge_economia OR EXISTS
    (SELECT 1 FROM public.variante_sorgenti s
      WHERE s.variante_id=ANY(ids) AND s.tipo='raccolta_economia');
  IF NOT coinvolge_economia THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  -- Solo il dominio Economia coinvolto richiede questi lock. OLD e NEW
  -- permettono di rilevare anche spostamenti dentro/fuori una dedicata.
  FOR v IN SELECT DISTINCT x FROM unnest(ids) x WHERE x IS NOT NULL ORDER BY x LOOP
    PERFORM 1 FROM public.varianti_cantiere WHERE id=v FOR UPDATE;
  END LOOP;
  IF TG_TABLE_NAME='variante_sorgenti' THEN
    IF TG_OP<>'INSERT' THEN
      IF OLD.tipo='raccolta_economia' THEN
        RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Sorgente Economia immutabile';
      END IF;
    END IF;
    IF TG_OP<>'DELETE' THEN
      IF NEW.tipo='raccolta_economia' THEN
        RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Writer ponte Economia non ancora abilitato';
      END IF;
    END IF;
  ELSE
    -- Protegge anche un riferimento Economia incoerente con variante_id.
    IF TG_OP<>'INSERT' THEN
      IF EXISTS (SELECT 1 FROM public.variante_sorgenti s
        WHERE s.id=OLD.variante_sorgente_id AND s.tipo='raccolta_economia') THEN
        RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Lavorazione Economia immutabile';
      END IF;
    END IF;
    IF TG_OP<>'DELETE' THEN
      IF EXISTS (SELECT 1 FROM public.variante_sorgenti s
        WHERE s.id=NEW.variante_sorgente_id AND s.tipo='raccolta_economia') THEN
        RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Writer ponte Economia non ancora abilitato';
      END IF;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.variante_sorgenti s
    WHERE s.variante_id=ANY(ids) AND s.tipo='raccolta_economia') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Variante Economia dedicata immutabile';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$guardia$;
ALTER FUNCTION artecna_guardie.proteggi_ponte_economia() OWNER TO postgres;
-- Revoca anche grant inattesi derivanti da default privileges sul nuovo helper.
DO $acl_helper$
DECLARE a record;
BEGIN
  REVOKE ALL ON FUNCTION artecna_guardie.proteggi_ponte_economia() FROM PUBLIC;
  FOR a IN SELECT DISTINCT r.rolname FROM pg_catalog.pg_proc p
    CROSS JOIN LATERAL aclexplode(p.proacl) x JOIN pg_catalog.pg_roles r ON r.oid=x.grantee
    WHERE p.oid='artecna_guardie.proteggi_ponte_economia()'::regprocedure AND x.grantee<>p.proowner LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION artecna_guardie.proteggi_ponte_economia() FROM %I',a.rolname);
  END LOOP;
END;
$acl_helper$;

CREATE TRIGGER ponte_economia_sorgenti BEFORE INSERT OR UPDATE OR DELETE
  ON public.variante_sorgenti FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_ponte_economia();
CREATE TRIGGER ponte_economia_lavorazioni BEFORE INSERT OR UPDATE OR DELETE
  ON public.variante_lavorazioni FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_ponte_economia();

COMMENT ON COLUMN public.variante_sorgenti.economia_raccolta_id IS
  'Acquisizione univoca Raccolta Economia. FK RESTRICT: cleanup storico NON compatibile; gestione demandata a CLEANUP CANTIERE V2. Writer non ancora abilitato.';
COMMENT ON COLUMN public.variante_sorgenti.economia_revisione_sorgente IS
  'Revisione attesa della Raccolta prima dell''acquisizione.';
COMMENT ON COLUMN public.variante_sorgenti.economia_revisione_congelata IS
  'Revisione congelata nello snapshot: R oppure R+1 dopo chiusura atomica.';

DO $postcheck$
DECLARE actual jsonb; baseline record;
BEGIN
  SELECT * INTO STRICT baseline FROM pg_temp.ponte_economia_baseline;
  SELECT jsonb_agg(jsonb_build_object('nome',a.attname,'posizione',a.attnum,'tipo',format_type(a.atttypid,a.atttypmod),'nullable',NOT a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'acl',a.attacl::text) ORDER BY a.attnum) INTO actual FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.variante_sorgenti'::regclass AND a.attnum>0 AND NOT a.attisdropped;
  IF actual IS DISTINCT FROM $catalogo$
[
  {
    "nome": "id",
    "posizione": 1,
    "tipo": "uuid",
    "nullable": false,
    "default": "gen_random_uuid()",
    "identity": "",
    "acl": null
  },
  {
    "nome": "variante_id",
    "posizione": 2,
    "tipo": "uuid",
    "nullable": false,
    "default": null,
    "identity": "",
    "acl": "{artecna_cantieri_delete_rpc=w/postgres}"
  },
  {
    "nome": "tipo",
    "posizione": 3,
    "tipo": "text",
    "nullable": false,
    "default": null,
    "identity": "",
    "acl": null
  },
  {
    "nome": "preventivo_sorgente_id",
    "posizione": 4,
    "tipo": "uuid",
    "nullable": true,
    "default": null,
    "identity": "",
    "acl": null
  },
  {
    "nome": "titolo",
    "posizione": 5,
    "tipo": "text",
    "nullable": false,
    "default": null,
    "identity": "",
    "acl": null
  },
  {
    "nome": "nome_file",
    "posizione": 6,
    "tipo": "text",
    "nullable": true,
    "default": null,
    "identity": "",
    "acl": null
  },
  {
    "nome": "formato",
    "posizione": 7,
    "tipo": "text",
    "nullable": true,
    "default": null,
    "identity": "",
    "acl": null
  },
  {
    "nome": "file_sha256",
    "posizione": 8,
    "tipo": "text",
    "nullable": true,
    "default": null,
    "identity": "",
    "acl": null
  },
  {
    "nome": "snapshot_version",
    "posizione": 9,
    "tipo": "integer",
    "nullable": false,
    "default": "1",
    "identity": "",
    "acl": null
  },
  {
    "nome": "snapshot",
    "posizione": 10,
    "tipo": "jsonb",
    "nullable": false,
    "default": null,
    "identity": "",
    "acl": null
  },
  {
    "nome": "created_at",
    "posizione": 11,
    "tipo": "timestamp with time zone",
    "nullable": false,
    "default": "now()",
    "identity": "",
    "acl": null
  },
  {
    "nome": "economia_raccolta_id",
    "posizione": 12,
    "tipo": "uuid",
    "nullable": true,
    "default": null,
    "identity": "",
    "acl": null
  },
  {
    "nome": "economia_revisione_sorgente",
    "posizione": 13,
    "tipo": "bigint",
    "nullable": true,
    "default": null,
    "identity": "",
    "acl": null
  },
  {
    "nome": "economia_revisione_congelata",
    "posizione": 14,
    "tipo": "bigint",
    "nullable": true,
    "default": null,
    "identity": "",
    "acl": null
  }
]
$catalogo$::jsonb THEN RAISE EXCEPTION 'Nuove colonne Economia non certificate'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint k
    WHERE k.conrelid='public.variante_sorgenti'::regclass
      AND k.conname='variante_sorgenti_economia_raccolta_fk' AND k.contype='f'
      AND k.confrelid='public.economia_raccolte'::regclass AND k.confdeltype='r'
      AND k.confupdtype='a' AND k.convalidated AND NOT k.condeferrable AND NOT k.condeferred
      AND k.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE
        attrelid=k.conrelid AND attname='economia_raccolta_id')]::smallint[]
      AND k.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE
        attrelid=k.confrelid AND attname='id')]::smallint[]) THEN
    RAISE EXCEPTION 'FK Economia RESTRICT non certificata';
  END IF;
  SELECT jsonb_agg(jsonb_build_object('nome',k.conname,'tipo',k.contype,'definizione',pg_get_constraintdef(k.oid),'validated',k.convalidated,'deferrable',k.condeferrable,'deferred',k.condeferred) ORDER BY k.conname) INTO actual FROM pg_catalog.pg_constraint k WHERE k.conrelid='public.variante_sorgenti'::regclass AND k.contype='c';
  IF actual IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_object('nome',k.conname,'tipo',k.contype,'definizione',pg_get_constraintdef(k.oid),'validated',k.convalidated,'deferrable',k.condeferrable,'deferred',k.condeferred) ORDER BY k.conname)  FROM pg_catalog.pg_constraint k WHERE k.conrelid='pg_temp.ponte_economia_struttura_attesa'::regclass AND k.contype='c') THEN RAISE EXCEPTION 'Vincoli finali Economia non certificati'; END IF;
  SELECT jsonb_agg(jsonb_build_object('nome',c.relname,'definizione',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid,'ready',i.indisready,'unique',i.indisunique,'immediate',i.indimmediate) ORDER BY c.relname) INTO actual FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid=i.indexrelid WHERE i.indrelid='public.variante_sorgenti'::regclass;
  IF actual IS DISTINCT FROM $catalogo$
[
  {
    "nome": "variante_sorgenti_economia_raccolta_unique",
    "definizione": "CREATE UNIQUE INDEX variante_sorgenti_economia_raccolta_unique ON public.variante_sorgenti USING btree (economia_raccolta_id) WHERE (tipo = 'raccolta_economia'::text)",
    "valid": true,
    "ready": true,
    "unique": true,
    "immediate": true
  },
  {
    "nome": "variante_sorgenti_economia_variante_unique",
    "definizione": "CREATE UNIQUE INDEX variante_sorgenti_economia_variante_unique ON public.variante_sorgenti USING btree (variante_id) WHERE (tipo = 'raccolta_economia'::text)",
    "valid": true,
    "ready": true,
    "unique": true,
    "immediate": true
  },
  {
    "nome": "variante_sorgenti_file_sha256_unique",
    "definizione": "CREATE UNIQUE INDEX variante_sorgenti_file_sha256_unique ON public.variante_sorgenti USING btree (variante_id, file_sha256) WHERE ((tipo = 'file'::text) AND (file_sha256 IS NOT NULL))",
    "valid": true,
    "ready": true,
    "unique": true,
    "immediate": true
  },
  {
    "nome": "variante_sorgenti_lettura_idx",
    "definizione": "CREATE INDEX variante_sorgenti_lettura_idx ON public.variante_sorgenti USING btree (variante_id, created_at, id)",
    "valid": true,
    "ready": true,
    "unique": false,
    "immediate": true
  },
  {
    "nome": "variante_sorgenti_pkey",
    "definizione": "CREATE UNIQUE INDEX variante_sorgenti_pkey ON public.variante_sorgenti USING btree (id)",
    "valid": true,
    "ready": true,
    "unique": true,
    "immediate": true
  },
  {
    "nome": "variante_sorgenti_preventivo_unique",
    "definizione": "CREATE UNIQUE INDEX variante_sorgenti_preventivo_unique ON public.variante_sorgenti USING btree (variante_id, preventivo_sorgente_id) WHERE (tipo = 'preventivo_artecna'::text)",
    "valid": true,
    "ready": true,
    "unique": true,
    "immediate": true
  }
]
$catalogo$::jsonb THEN RAISE EXCEPTION 'Indici finali Economia non certificati'; END IF;
  SELECT jsonb_agg(to_jsonb(k) ORDER BY k.oid) INTO actual FROM pg_catalog.pg_constraint k
    WHERE k.conrelid='public.variante_sorgenti'::regclass AND k.contype IN ('p','u','f','x')
      AND k.conname<>'variante_sorgenti_economia_raccolta_fk';
  IF actual IS DISTINCT FROM baseline.vincoli_storici THEN RAISE EXCEPTION 'FK PK UNIQUE storiche modificate'; END IF;
  SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) INTO actual FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','artecna_guardie','artecna_distruzione','artecna_rapportini')
      AND p.oid<>'artecna_guardie.proteggi_ponte_economia()'::regprocedure;
  IF actual IS DISTINCT FROM baseline.funzioni THEN RAISE EXCEPTION 'RPC storiche o cleanup modificati'; END IF;
  SELECT jsonb_agg(to_jsonb(n) ORDER BY n.oid) INTO actual FROM pg_catalog.pg_namespace n
    WHERE n.nspname IN ('public','artecna_guardie','artecna_distruzione','artecna_rapportini');
  IF actual IS DISTINCT FROM baseline.schemi THEN RAISE EXCEPTION 'ACL schema modificate'; END IF;
  SELECT jsonb_agg(jsonb_build_object('oid',c.oid,'owner',c.relowner,'acl',c.relacl::text,
    'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) ORDER BY c.oid) INTO actual
    FROM pg_catalog.pg_class c WHERE c.oid IN ('public.variante_sorgenti'::regclass,
      'public.variante_lavorazioni'::regclass,'public.varianti_cantiere'::regclass,'public.economia_raccolte'::regclass);
  IF actual IS DISTINCT FROM baseline.tabelle THEN RAISE EXCEPTION 'Owner ACL o RLS modificati'; END IF;
  SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) INTO actual FROM pg_catalog.pg_attribute a
    WHERE a.attrelid IN ('public.variante_sorgenti'::regclass,'public.variante_lavorazioni'::regclass,
      'public.varianti_cantiere'::regclass,'public.economia_raccolte'::regclass) AND a.attnum>0
      AND NOT (a.attrelid='public.variante_sorgenti'::regclass AND a.attnum>11);
  IF actual IS DISTINCT FROM baseline.colonne THEN RAISE EXCEPTION 'Colonne o ACL storiche modificate'; END IF;
  SELECT jsonb_agg(to_jsonb(s)-'economia_raccolta_id'-'economia_revisione_sorgente'-'economia_revisione_congelata'
    ORDER BY s.id) INTO actual FROM public.variante_sorgenti s;
  IF actual IS DISTINCT FROM baseline.righe_sorgenti OR EXISTS
    (SELECT 1 FROM public.variante_sorgenti WHERE tipo='raccolta_economia') THEN
    RAISE EXCEPTION 'Dati sorgenti modificati';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE
    p.oid='artecna_guardie.proteggi_ponte_economia()'::regprocedure AND p.proowner='postgres'::regrole
    AND p.prosecdef AND p.provolatile='v' AND p.prorettype='trigger'::regtype
    AND p.prolang=(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
    AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[])
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
      WHERE p.oid='artecna_guardie.proteggi_ponte_economia()'::regprocedure
        AND (a.grantee<>p.proowner OR a.is_grantable OR a.privilege_type<>'EXECUTE')) THEN
    RAISE EXCEPTION 'Helper privato non certificato';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_trigger WHERE NOT tgisinternal
    AND tgfoid='artecna_guardie.proteggi_ponte_economia()'::regprocedure
    AND ((tgrelid='public.variante_sorgenti'::regclass AND tgname='ponte_economia_sorgenti')
      OR (tgrelid='public.variante_lavorazioni'::regclass AND tgname='ponte_economia_lavorazioni'))
    AND tgtype=31 AND tgenabled='O')<>2 THEN
    RAISE EXCEPTION 'Guardie ponte Economia non certificate';
  END IF;
END;
$postcheck$;
COMMIT;
