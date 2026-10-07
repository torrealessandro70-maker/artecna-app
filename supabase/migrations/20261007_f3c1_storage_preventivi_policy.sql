-- F3C1: preparazione locale, NON applicata a Production.
-- Baseline F3A/F3B PostgreSQL 17: sette policy permissive su storage.objects.
-- PUBLIC comprende anon/authenticated. Le sei policy PUBLIC sono bucket-scoped;
-- il problema era esclusivamente ALL TO anon USING true WITH CHECK true.
-- Nessun bucket, grant, RPC, ENV o dato viene modificato.
-- Eseguire con autorità owner della tabella e arresto del runner al primo errore.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
SET LOCAL idle_in_transaction_session_timeout = '30s';

DO $f3c1$
DECLARE
  v_schema oid;
  v_table oid;
  v_anon oid;
  v_target oid;
  v_schema_before jsonb;
  v_table_before jsonb;
  v_policies_before jsonb;
  v_target_before jsonb;
  v_current jsonb;
  v_filter constant text := '(bucket_id = ''preventivi''::text)';
BEGIN
  SELECT oid INTO v_schema FROM pg_catalog.pg_namespace WHERE nspname='storage';
  IF v_schema IS NULL THEN RAISE EXCEPTION 'F3C1: schema storage assente'; END IF;
  SELECT oid INTO v_table FROM pg_catalog.pg_class
    WHERE relnamespace=v_schema AND relname='objects' AND relkind='r';
  IF v_table IS NULL THEN RAISE EXCEPTION 'F3C1: storage.objects assente o tipo inatteso'; END IF;

  -- Blocca DML e DDL concorrenti fino al COMMIT; timeout evita attese indefinite.
  LOCK TABLE storage.objects IN ACCESS EXCLUSIVE MODE;
  SELECT pg_catalog.to_jsonb(n) INTO v_schema_before
    FROM pg_catalog.pg_namespace n WHERE n.oid=v_schema AND n.nspname='storage';
  SELECT pg_catalog.to_jsonb(c) INTO v_table_before
    FROM pg_catalog.pg_class c WHERE c.oid=v_table AND c.relnamespace=v_schema
      AND c.relname='objects' AND c.relkind='r';
  IF v_schema_before IS NULL OR v_table_before IS NULL
    OR (v_table_before->>'relrowsecurity')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'F3C1: identità tabella o RLS inattesa';
  END IF;
  SELECT oid INTO v_anon FROM pg_catalog.pg_roles WHERE rolname='anon';
  IF v_anon IS NULL THEN RAISE EXCEPTION 'F3C1: ruolo anon assente'; END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_policy
      WHERE polrelid=v_table AND polname='full access preventivi') <> 1 THEN
    RAISE EXCEPTION 'F3C1: policy target assente o non univoca';
  END IF;
  SELECT oid,pg_catalog.to_jsonb(p) INTO v_target,v_target_before
    FROM pg_catalog.pg_policy p WHERE polrelid=v_table AND polname='full access preventivi';
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy p WHERE p.oid=v_target
      AND p.polrelid=v_table AND p.polpermissive AND p.polcmd='*'
      AND p.polroles=ARRAY[v_anon]::oid[]
      AND pg_catalog.pg_get_expr(p.polqual,p.polrelid)='true'
      AND pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)='true') THEN
    RAISE EXCEPTION 'F3C1: baseline target divergente';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_policy WHERE polrelid=v_table) <> 7 THEN
    RAISE EXCEPTION 'F3C1: inventario policy divergente';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('Allow delete for authenticated users 1wl1hj8_0','d',v_filter,NULL::text),
      ('Allow delete for authenticated users 1wl1hj8_1','r',v_filter,NULL::text),
      ('allow all preventivi storage 1wl1hj8_0','r',v_filter,NULL::text),
      ('allow all preventivi storage 1wl1hj8_1','a',NULL::text,v_filter),
      ('allow all preventivi storage 1wl1hj8_2','w',v_filter,NULL::text),
      ('allow all preventivi storage 1wl1hj8_3','d',v_filter,NULL::text)
    ) e(nome,comando,using_expr,check_expr)
    LEFT JOIN pg_catalog.pg_policy p ON p.polrelid=v_table AND p.polname=e.nome
    WHERE p.oid IS NULL OR p.polcmd::text IS DISTINCT FROM e.comando
      OR p.polpermissive IS DISTINCT FROM true OR p.polroles IS DISTINCT FROM ARRAY[0]::oid[]
      OR pg_catalog.pg_get_expr(p.polqual,p.polrelid) IS DISTINCT FROM e.using_expr
      OR pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) IS DISTINCT FROM e.check_expr
  ) THEN RAISE EXCEPTION 'F3C1: baseline delle sei policy PUBLIC divergente'; END IF;
  SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) ORDER BY p.oid) INTO v_policies_before
    FROM pg_catalog.pg_policy p WHERE p.polrelid=v_table AND p.oid<>v_target;

  ALTER POLICY "full access preventivi" ON storage.objects
    USING (bucket_id = 'preventivi') WITH CHECK (bucket_id = 'preventivi');

  -- F3C1_POSTCHECK: nessun errore viene assorbito, COMMIT solo dopo i controlli.
  SELECT pg_catalog.to_jsonb(p) INTO v_current FROM pg_catalog.pg_policy p WHERE p.oid=v_target;
  IF v_current IS NULL OR (v_current-'polqual'-'polwithcheck')
      IS DISTINCT FROM (v_target_before-'polqual'-'polwithcheck')
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy p WHERE p.oid=v_target
      AND pg_catalog.pg_get_expr(p.polqual,p.polrelid)=v_filter
      AND pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)=v_filter) THEN
    RAISE EXCEPTION 'F3C1: post-check target fallito';
  END IF;
  SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) ORDER BY p.oid) INTO v_current
    FROM pg_catalog.pg_policy p WHERE p.polrelid=v_table AND p.oid<>v_target;
  IF v_current IS DISTINCT FROM v_policies_before
    OR (SELECT count(*) FROM pg_catalog.pg_policy WHERE polrelid=v_table)<>7
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid=v_table AND NOT polpermissive) THEN
    RAISE EXCEPTION 'F3C1: post-check inventario fallito';
  END IF;
  -- Confronto dell'intera riga catalogo: comprende owner, ACL e RLS/FORCE RLS.
  SELECT pg_catalog.to_jsonb(c) INTO v_current FROM pg_catalog.pg_class c WHERE c.oid=v_table;
  IF v_current IS DISTINCT FROM v_table_before THEN
    RAISE EXCEPTION 'F3C1: post-check tabella/ACL/RLS fallito';
  END IF;
  SELECT pg_catalog.to_jsonb(n) INTO v_current FROM pg_catalog.pg_namespace n WHERE n.oid=v_schema;
  IF v_current IS DISTINCT FROM v_schema_before THEN
    RAISE EXCEPTION 'F3C1: post-check schema/ACL fallito';
  END IF;
END;
$f3c1$;
COMMIT;
