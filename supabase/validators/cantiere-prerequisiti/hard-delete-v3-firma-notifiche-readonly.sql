BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog, pg_temp;

DO $validate$
DECLARE
  historical CONSTANT text := 'ecab5c38a5d6ac48d190bbe99cd5a740';
  expected_current CONSTANT text := '111feadfb0a82a15caf9fbcf53e0c1b6';
  catalog_md5 CONSTANT text := 'e653969ab1719f575d07038a3cbdd143';
  terminal CONSTANT text := 'SELECT md5(coalesce(string_agg(x,'''' ORDER BY x COLLATE "C"),'''')) FROM objects';
  signed_fks CONSTANT text[] := ARRAY[
    'f:artecna_notifiche.notifica:notifica_recipient_user_id_fkey:FOREIGN KEY (recipient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE:true',
    'f:artecna_notifiche.preferenze_notifiche:preferenze_notifiche_user_id_fkey:FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE:true'
  ];
  catalog_body text;
  registered text;
  actual text;
  reconstructed text;
  without_fks text;
  fk_count bigint;
  present_fks text[];
BEGIN
  IF session_user <> 'postgres' OR current_user <> 'postgres' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Attore postgres richiesto';
  END IF;

  SELECT p.prosrc INTO STRICT catalog_body
  FROM pg_proc p
  WHERE p.oid = 'artecna_distruzione.hard_delete_catalog()'::regprocedure
    AND p.proowner = 'postgres'::regrole AND p.prosecdef AND p.provolatile = 's'
    AND p.proconfig = ARRAY['search_path=pg_catalog, pg_temp'];
  IF md5(catalog_body) IS DISTINCT FROM catalog_md5 THEN
    RAISE EXCEPTION USING ERRCODE = 'P2113', MESSAGE = 'Corpo del catalogo hard delete V3 divergente';
  END IF;

  SELECT signature INTO STRICT registered
  FROM artecna_distruzione.hard_delete_catalog_expected;
  IF registered IS NULL OR registered NOT IN (historical,expected_current) THEN
    RAISE EXCEPTION USING ERRCODE = 'P2113', MESSAGE = 'Firma registrata divergente';
  END IF;

  SELECT array_agg('f:' || c.conrelid::regclass::text || ':' || c.conname || ':'
      || pg_get_constraintdef(c.oid, true) || ':' || c.convalidated ORDER BY c.conrelid::regclass::text)
  INTO present_fks
  FROM pg_constraint c
  WHERE c.contype = 'f' AND c.confrelid = 'auth.users'::regclass
    AND (c.conrelid,c.conname) IN (
      ('artecna_notifiche.notifica'::regclass,'notifica_recipient_user_id_fkey'),
      ('artecna_notifiche.preferenze_notifiche'::regclass,'preferenze_notifiche_user_id_fkey')
    );
  IF present_fks IS DISTINCT FROM signed_fks THEN
    RAISE EXCEPTION USING ERRCODE = 'P2113', MESSAGE = 'Definizioni FK notifiche divergenti';
  END IF;

  actual := artecna_distruzione.hard_delete_catalog();
  IF actual IS DISTINCT FROM expected_current THEN
    RAISE EXCEPTION USING ERRCODE = 'P2113', MESSAGE = 'Firma catalogo corrente divergente';
  END IF;

  -- Reuse the hash-verified V3 inventory. Replace only its terminal aggregate
  -- in a read-only query, binding the exact two signed FK entries as data.
  catalog_body := btrim(catalog_body,E' \t\r\n');
  IF right(catalog_body,length(terminal)) IS DISTINCT FROM terminal THEN
    RAISE EXCEPTION USING ERRCODE = 'P2113', MESSAGE = 'Aggregazione catalogo V3 divergente';
  END IF;
  EXECUTE left(catalog_body,length(catalog_body)-length(terminal)) ||
    $projection$SELECT
      md5(coalesce(string_agg(x,'' ORDER BY x COLLATE "C"),'')),
      md5(coalesce(string_agg(x,'' ORDER BY x COLLATE "C") FILTER (WHERE x <> ALL($1::text[])),'')),
      count(*) FILTER (WHERE x = ANY($1::text[]))
    FROM objects$projection$
  INTO reconstructed, without_fks, fk_count
  USING signed_fks;
  IF reconstructed IS DISTINCT FROM actual OR without_fks IS DISTINCT FROM historical OR fk_count <> 2 THEN
    RAISE EXCEPTION USING ERRCODE = 'P2113', MESSAGE = 'Le due FK non spiegano esattamente la divergenza';
  END IF;

  RAISE NOTICE 'catalogo corrente %, firma registrata %, catalogo senza le due FK %',
    actual, registered, without_fks;
  IF registered = historical THEN
    RAISE NOTICE 'PRECHECK_GREEN: firma storica da riallineare';
  ELSE
    RAISE NOTICE 'POSTCHECK_GREEN: firma gia allineata';
  END IF;
END;
$validate$;

ROLLBACK;
