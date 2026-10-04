-- Micro-step Allegati 2: solo registro privato. NON applicata al remoto.
-- Nessuna RPC, identità Storage, proiezione foto o modifica del cleanup.
BEGIN;

DO $preflight$
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Installazione riservata a postgres';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace
    WHERE nspname='artecna_rapportini' AND nspowner='postgres'::regrole) THEN
    RAISE EXCEPTION 'Schema privato Rapportini assente o owner incompatibile';
  END IF;
  IF pg_catalog.to_regclass('artecna_rapportini.allegati') IS NOT NULL THEN
    RAISE EXCEPTION 'Registro allegati già presente';
  END IF;
END;
$preflight$;

CREATE TABLE artecna_rapportini.allegati (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  rapportino_id uuid NOT NULL REFERENCES public.rapportini(id) ON DELETE RESTRICT,
  cantiere_id uuid NOT NULL REFERENCES public.cantieri(id) ON DELETE RESTRICT,
  chiave_client_allegato uuid NOT NULL,
  sha256 bytea NOT NULL,
  bucket text NOT NULL,
  file_path text NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL,
  stato text NOT NULL,
  foto_cantiere_id uuid REFERENCES public.foto_cantiere(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.statement_timestamp(),
  finalized_at timestamptz,
  expires_at timestamptz NOT NULL,
  removed_at timestamptz,
  lease_id uuid,
  lease_until timestamptz,
  CONSTRAINT allegati_identita UNIQUE (rapportino_id, chiave_client_allegato),
  CONSTRAINT allegati_oggetto UNIQUE (bucket, file_path),
  CONSTRAINT allegati_foto UNIQUE (foto_cantiere_id),
  CONSTRAINT allegati_sha CHECK (pg_catalog.octet_length(sha256)=32),
  CONSTRAINT allegati_bucket CHECK (bucket='rapportini-v1'),
  CONSTRAINT allegati_mime CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  CONSTRAINT allegati_dimensione CHECK (byte_size BETWEEN 1 AND 4000000),
  CONSTRAINT allegati_stato CHECK (stato IN
    ('prenotato','finalizzato','cancellazione_pending','cancellato','scaduto')),
  CONSTRAINT allegati_path CHECK (pg_catalog.btrim(file_path)<>''
    AND file_path NOT LIKE '/%' AND pg_catalog.strpos(file_path,'..')=0
    AND file_path LIKE 'rapportini/%' AND pg_catalog.length(file_path)>11),
  CONSTRAINT allegati_coerenza CHECK (
    (stato='prenotato' AND finalized_at IS NULL AND removed_at IS NULL AND foto_cantiere_id IS NULL)
    OR (stato='finalizzato' AND finalized_at IS NOT NULL AND removed_at IS NULL AND foto_cantiere_id IS NOT NULL)
    OR (stato='scaduto' AND finalized_at IS NULL AND removed_at IS NULL AND foto_cantiere_id IS NULL)
    OR (stato IN ('cancellazione_pending','cancellato') AND removed_at IS NOT NULL)),
  CONSTRAINT allegati_lease CHECK (
    (lease_id IS NULL AND lease_until IS NULL) OR
    (lease_id IS NOT NULL AND lease_until IS NOT NULL
      AND stato IN ('prenotato','cancellazione_pending')))
);

-- L'indice di identità copre anche le letture per rapportino_id.
CREATE INDEX allegati_cantiere ON artecna_rapportini.allegati(cantiere_id);
CREATE INDEX allegati_scadenza ON artecna_rapportini.allegati(expires_at)
  WHERE stato='prenotato';
-- Nessun indice lease finché non è definito il relativo accesso delle RPC.
-- RLS non è il confine: schema privato, owner postgres, nessun grant diretto.

DO $acl$
DECLARE r record;
BEGIN
  -- Neutralizza anche eventuali default privileges, solo sulla nuova tabella.
  REVOKE ALL ON TABLE artecna_rapportini.allegati FROM PUBLIC;
  FOR r IN SELECT DISTINCT a.grantee, roles.rolname
    FROM pg_catalog.pg_class c
    CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) a
    JOIN pg_catalog.pg_roles roles ON roles.oid=a.grantee
    WHERE c.oid='artecna_rapportini.allegati'::regclass AND a.grantee<>c.relowner
  LOOP
    EXECUTE pg_catalog.format('REVOKE ALL ON TABLE artecna_rapportini.allegati FROM %I',r.rolname);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c
    CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) a
    WHERE c.oid='artecna_rapportini.allegati'::regclass AND a.grantee<>c.relowner)
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
      WHERE attrelid='artecna_rapportini.allegati'::regclass AND attacl IS NOT NULL) THEN
    RAISE EXCEPTION 'ACL registro allegati non private';
  END IF;
  IF pg_catalog.has_schema_privilege('artecna_rapportini_backend','artecna_rapportini','USAGE') THEN
    RAISE EXCEPTION 'Backend con accesso allo schema privato';
  END IF;
END;
$acl$;

-- La cancellazione conserva il riferimento storico: nessun azzeramento implicito.
-- Il protocollo futuro governerà transizioni e cleanup della proiezione.
DO $postcheck$
DECLARE
  v_table oid := pg_catalog.to_regclass('artecna_rapportini.allegati');
  r record;
  v_source smallint[];
  v_target smallint[];
BEGIN
  IF v_table IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE c.oid=v_table AND n.nspname='artecna_rapportini' AND c.relkind='r'
      AND c.relowner='postgres'::regrole AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity
  ) THEN RAISE EXCEPTION 'Post-check allegati: tabella, owner o RLS incompatibili'; END IF;

  FOR r IN SELECT * FROM (VALUES
    ('rapportino_id','public.rapportini'),('cantiere_id','public.cantieri'),
    ('foto_cantiere_id','public.foto_cantiere')) AS expected(colonna,tabella)
  LOOP
    SELECT ARRAY[attnum] INTO v_source FROM pg_catalog.pg_attribute
      WHERE attrelid=v_table AND attname=r.colonna AND NOT attisdropped;
    SELECT ARRAY[attnum] INTO v_target FROM pg_catalog.pg_attribute
      WHERE attrelid=pg_catalog.to_regclass(r.tabella) AND attname='id' AND NOT attisdropped;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid=v_table AND contype='f' AND conkey=v_source
        AND confrelid=pg_catalog.to_regclass(r.tabella) AND confkey=v_target
        AND confdeltype='r' AND convalidated AND NOT condeferrable) THEN
      RAISE EXCEPTION 'Post-check allegati: FK RESTRICT assente per %',r.colonna;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid=v_table AND contype='f' AND (confdeltype='c' OR confupdtype='c')) THEN
    RAISE EXCEPTION 'Post-check allegati: FK CASCADE inattesa';
  END IF;

  FOR r IN SELECT * FROM (VALUES
    ('allegati_identita',ARRAY['rapportino_id','chiave_client_allegato']),
    ('allegati_oggetto',ARRAY['bucket','file_path']),
    ('allegati_foto',ARRAY['foto_cantiere_id'])) AS expected(nome,colonne)
  LOOP
    SELECT pg_catalog.array_agg(a.attnum ORDER BY x.ord) INTO v_source
      FROM pg_catalog.unnest(r.colonne) WITH ORDINALITY x(nome,ord)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=v_table AND a.attname=x.nome AND NOT a.attisdropped;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c
      JOIN pg_catalog.pg_index i ON i.indexrelid=c.conindid
      WHERE c.conrelid=v_table AND c.conname=r.nome AND c.contype='u' AND c.conkey=v_source
        AND c.convalidated AND NOT c.condeferrable AND i.indisunique AND i.indisvalid AND i.indisready) THEN
      RAISE EXCEPTION 'Post-check allegati: UNIQUE incompatibile %',r.nome;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c
    CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) a
    WHERE c.oid=v_table AND a.grantee<>c.relowner) THEN
    RAISE EXCEPTION 'Post-check allegati: grant diretto non owner';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=v_table AND attacl IS NOT NULL) THEN
    RAISE EXCEPTION 'Post-check allegati: ACL colonna inattesa';
  END IF;
  IF pg_catalog.has_schema_privilege('artecna_rapportini_backend','artecna_rapportini','USAGE')
    OR pg_catalog.has_table_privilege('artecna_rapportini_backend',v_table,
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR pg_catalog.has_any_column_privilege('artecna_rapportini_backend',v_table,
      'SELECT,INSERT,UPDATE,REFERENCES') THEN
    RAISE EXCEPTION 'Post-check allegati: privilegi backend inattesi';
  END IF;
END;
$postcheck$;
COMMIT;
