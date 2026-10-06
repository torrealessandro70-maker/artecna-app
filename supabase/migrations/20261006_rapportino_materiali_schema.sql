-- M2.2: solo schema; nessun writer/lettura contratto 2. Applicazione manuale.
-- costo_materiali/materiali/quantita_materiali legacy non vengono modificati.
-- CLEANUP CANTIERE V2 dovrà gestire rapportino_materiali prima dei Rapportini.
BEGIN;
DO $preflight$
DECLARE x record;
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Installazione riservata a postgres';
  END IF;
  IF to_regclass('public.rapportini') IS NULL OR to_regclass('public.rapportino_materiali') IS NOT NULL
    OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.rapportini'::regclass
      AND attname='versione_materiali' AND NOT attisdropped)
    OR to_regprocedure('artecna_rapportini.proteggi_versione_materiali()') IS NOT NULL
    OR to_regprocedure('artecna_rapportini.proteggi_materiale()') IS NOT NULL
    OR to_regprocedure('artecna_rapportini.materiali_fail_closed()') IS NOT NULL THEN
    RAISE EXCEPTION 'Schema materiali già presente o collisione';
  END IF;
  FOR x IN SELECT * FROM (VALUES ('id','uuid',true),('versione_prestazioni','smallint',true),
    ('revisione_prestazioni','bigint',true),('materiali','text',false),
    ('quantita_materiali','text',false),('costo_materiali','text',false)) e(nome,tipo,obbligatorio) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.rapportini'::regclass
      AND a.attname=x.nome AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)=x.tipo
      AND a.attnotnull=x.obbligatorio AND a.attgenerated='') THEN
      RAISE EXCEPTION 'Colonna Rapportini incompatibile: %',x.nome;
    END IF;
    IF x.nome IN ('materiali','quantita_materiali','costo_materiali') AND EXISTS(
      SELECT 1 FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
      WHERE d.adrelid='public.rapportini'::regclass AND a.attname=x.nome
        AND pg_get_expr(d.adbin,d.adrelid) IS DISTINCT FROM 'NULL::text') THEN
      RAISE EXCEPTION 'Default legacy inatteso';
    END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.rapportini'::regclass
    AND contype='p' AND conkey=ARRAY[(SELECT attnum FROM pg_attribute
      WHERE attrelid='public.rapportini'::regclass AND attname='id')] AND convalidated)
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_rapportini_rpc'
      AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls)
    OR has_schema_privilege('artecna_rapportini_backend','artecna_rapportini','USAGE') THEN
    RAISE EXCEPTION 'Identità/ruolo Rapportini incompatibili';
  END IF;
  FOR x IN SELECT unnest(ARRAY[
    'public.salva_rapportino_con_prestazioni(jsonb,text)',
    'artecna_rapportini.applica_prestazioni_rapportino(jsonb)',
    'public.leggi_rapportino_portale(text,uuid,date,uuid)',
    'artecna_rapportini.proteggi_testata()',
    'artecna_rapportini.proteggi_strutturato()']) firma LOOP
    IF to_regprocedure(x.firma) IS NULL THEN RAISE EXCEPTION 'Baseline mancante: %',x.firma; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid IN (
      'artecna_rapportini.proteggi_testata()'::regprocedure,
      'artecna_rapportini.proteggi_strutturato()'::regprocedure)
      AND (p.proowner<>'postgres'::regrole OR p.prosecdef OR p.provolatile<>'v'
        OR p.prorettype<>'trigger'::regtype OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql')
        OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp'])) THEN
    RAISE EXCEPTION 'Metadata guardie storiche divergenti';
  END IF;
END;
$preflight$;
-- Snapshot transazionale metadata/definizioni: nessuna funzione storica sostituita.
CREATE TEMP TABLE m22_funzioni ON COMMIT DROP AS
  SELECT oid,to_jsonb(p) AS metadata FROM pg_proc p
  WHERE pronamespace IN ('artecna_rapportini'::regnamespace,'public'::regnamespace);
CREATE TEMP TABLE m22_legacy ON COMMIT DROP AS
  SELECT id,materiali,quantita_materiali,costo_materiali FROM public.rapportini;
CREATE TEMP TABLE m22_trigger ON COMMIT DROP AS
  SELECT oid,to_jsonb(t) AS metadata FROM pg_trigger t WHERE tgrelid='public.rapportini'::regclass;

ALTER TABLE public.rapportini
  ADD COLUMN versione_materiali smallint NOT NULL DEFAULT 0,
  ADD CONSTRAINT rapportini_versione_materiali_ck CHECK(versione_materiali IN (0,1)),
  ADD CONSTRAINT rapportini_materiali_v1_ck CHECK(versione_materiali=0 OR versione_prestazioni=1);

CREATE TABLE public.rapportino_materiali (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  rapportino_id uuid NOT NULL,
  chiave_client text NOT NULL,
  descrizione text NOT NULL,
  unita_misura text NOT NULL,
  quantita numeric(18,6) NOT NULL,
  costo_unitario numeric(18,6),
  costo_totale numeric(30,2) GENERATED ALWAYS AS (
    CASE WHEN costo_unitario IS NULL THEN NULL ELSE round(quantita*costo_unitario,2) END) STORED,
  note text NOT NULL DEFAULT '',
  revisione bigint NOT NULL DEFAULT 0,
  rimossa_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rapportino_materiali_rapportino_fk FOREIGN KEY(rapportino_id)
    REFERENCES public.rapportini(id) ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT rapportino_materiali_identita UNIQUE(rapportino_id,chiave_client),
  -- Parser UUID nativo + round-trip canonico esatto; nessuna normalizzazione client.
  CONSTRAINT rapportino_materiali_chiave_ck CHECK(chiave_client COLLATE "C" = (chiave_client::uuid)::text COLLATE "C"),
  CONSTRAINT rapportino_materiali_descrizione_ck CHECK(descrizione=btrim(descrizione) AND length(descrizione) BETWEEN 1 AND 2000),
  CONSTRAINT rapportino_materiali_um_ck CHECK(unita_misura=btrim(unita_misura) AND length(unita_misura) BETWEEN 1 AND 50),
  -- typmod limita scala/range; il writer futuro rifiuterà precisioni prima del cast.
  CONSTRAINT rapportino_materiali_quantita_ck CHECK(quantita>0 AND quantita::text<>'NaN'),
  CONSTRAINT rapportino_materiali_costo_ck CHECK(costo_unitario IS NULL OR
    (costo_unitario>=0 AND costo_unitario::text<>'NaN')),
  CONSTRAINT rapportino_materiali_note_ck CHECK(length(note)<=20000),
  CONSTRAINT rapportino_materiali_revisione_ck CHECK(revisione>=0)
);
CREATE INDEX rapportino_materiali_attivi ON public.rapportino_materiali(rapportino_id,created_at,id)
  WHERE rimossa_at IS NULL;
ALTER TABLE public.rapportino_materiali ENABLE ROW LEVEL SECURITY;
-- Nessuna policy operativa/DML neppure al ruolo interno prima di M2.3.

CREATE FUNCTION artecna_rapportini.proteggi_versione_materiali() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $fn$
BEGIN
  IF TG_OP='UPDATE' AND OLD.versione_materiali=1 AND NEW.versione_materiali<>1 THEN
    RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Gestione materiali irreversibile';
  END IF;
  IF (TG_OP='INSERT' AND NEW.versione_materiali<>0)
    OR (TG_OP='UPDATE' AND NEW.versione_materiali IS DISTINCT FROM OLD.versione_materiali) THEN
    IF current_user <> 'artecna_rapportini_rpc' THEN
      RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Versione materiali riservata al dominio Rapportini';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
CREATE TRIGGER rapportino_materiali_versione BEFORE INSERT OR UPDATE ON public.rapportini
  FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.proteggi_versione_materiali();

CREATE FUNCTION artecna_rapportini.proteggi_materiale() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE r record;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Richiesta rimozione logica'; END IF;
  IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.rapportino_id IS DISTINCT FROM OLD.rapportino_id
    OR NEW.chiave_client IS DISTINCT FROM OLD.chiave_client OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR OLD.rimossa_at IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Identità immutabile o materiale rimosso';
  END IF;
  SELECT versione_prestazioni,versione_materiali INTO r FROM public.rapportini WHERE id=NEW.rapportino_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Rapportino padre assente';
  END IF;
  IF r.versione_prestazioni IS DISTINCT FROM 1 OR r.versione_materiali IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Materiali strutturati non adottati';
  END IF;
  IF TG_OP='INSERT' THEN
    NEW.revisione:=0; NEW.created_at:=statement_timestamp();
  ELSE NEW.revisione:=OLD.revisione+1;
  END IF;
  NEW.updated_at:=statement_timestamp();
  RETURN NEW;
END;
$fn$;
CREATE FUNCTION artecna_rapportini.materiali_fail_closed() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $fn$
BEGIN
  RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Writer materiali non ancora disponibile';
END;
$fn$;
CREATE TRIGGER a_rapportino_materiali_integrita BEFORE INSERT OR UPDATE OR DELETE ON public.rapportino_materiali
  FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.proteggi_materiale();
CREATE TRIGGER z_rapportino_materiali_fail_closed BEFORE INSERT OR UPDATE OR DELETE ON public.rapportino_materiali
  FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.materiali_fail_closed();

DO $acl$
DECLARE x record; g record;
BEGIN
  REVOKE ALL ON public.rapportino_materiali FROM PUBLIC;
  FOR x IN SELECT DISTINCT a.grantee FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
    WHERE c.oid='public.rapportino_materiali'::regclass AND a.grantee<>c.relowner LOOP
    EXECUTE format('REVOKE ALL ON public.rapportino_materiali FROM %I',pg_get_userbyid(x.grantee));
  END LOOP;
  FOR x IN SELECT p.oid,p.proowner FROM pg_proc p WHERE p.oid IN (
    'artecna_rapportini.proteggi_versione_materiali()'::regprocedure,
    'artecna_rapportini.proteggi_materiale()'::regprocedure,
    'artecna_rapportini.materiali_fail_closed()'::regprocedure) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',x.oid::regprocedure);
    FOR g IN SELECT p.oid,a.grantee FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
      WHERE p.oid IN ('artecna_rapportini.proteggi_versione_materiali()'::regprocedure,
        'artecna_rapportini.proteggi_materiale()'::regprocedure,'artecna_rapportini.materiali_fail_closed()'::regprocedure)
        AND a.grantee<>p.proowner LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',g.oid::regprocedure,pg_get_userbyid(g.grantee));
    END LOOP;
  END LOOP;
END;
$acl$;

-- Capture struttura attesa per certificare invarianti senza contare ACL globali.
CREATE TEMP TABLE m22_struttura ON COMMIT DROP AS
  SELECT 'colonna'::text tipo,attname nome,to_jsonb(a) definizione FROM pg_attribute a
    WHERE attrelid='public.rapportino_materiali'::regclass AND attnum>0
  UNION ALL SELECT 'vincolo',conname,to_jsonb(c) FROM pg_constraint c
    WHERE conrelid IN ('public.rapportino_materiali'::regclass,'public.rapportini'::regclass)
      AND (conrelid='public.rapportino_materiali'::regclass OR conname IN ('rapportini_versione_materiali_ck','rapportini_materiali_v1_ck'));
CREATE TEMP TABLE m22_nuove_guardie ON COMMIT DROP AS
  SELECT oid,to_jsonb(p) metadata FROM pg_proc p WHERE oid IN (
    'artecna_rapportini.proteggi_versione_materiali()'::regprocedure,
    'artecna_rapportini.proteggi_materiale()'::regprocedure,
    'artecna_rapportini.materiali_fail_closed()'::regprocedure);

DO $postcheck$
DECLARE x record; t oid:='public.rapportino_materiali'::regclass;
BEGIN
  FOR x IN SELECT * FROM (VALUES
    ('id','uuid',true),('rapportino_id','uuid',true),('chiave_client','text',true),
    ('descrizione','text',true),('unita_misura','text',true),('quantita','numeric(18,6)',true),
    ('costo_unitario','numeric(18,6)',false),('costo_totale','numeric(30,2)',false),
    ('note','text',true),('revisione','bigint',true),('rimossa_at','timestamp with time zone',false),
    ('created_at','timestamp with time zone',true),('updated_at','timestamp with time zone',true)) e(nome,tipo,obbligatorio) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=t AND attname=x.nome AND NOT attisdropped
      AND format_type(atttypid,atttypmod)=x.tipo AND attnotnull=x.obbligatorio
      AND attgenerated=CASE WHEN x.nome='costo_totale' THEN 's'::"char" ELSE ''::"char" END) THEN
      RAISE EXCEPTION 'Schema materiali incompatibile: %',x.nome;
    END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=t AND relowner='postgres'::regrole
    AND relrowsecurity AND NOT relforcerowsecurity AND relkind='r')
    OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=t) THEN RAISE EXCEPTION 'Materiali owner/RLS incompatibili'; END IF;
  IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
      WHERE c.oid=t AND a.grantee<>c.relowner)
    OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=t AND attacl IS NOT NULL)
    OR has_schema_privilege('artecna_rapportini_backend','artecna_rapportini','USAGE') THEN
    RAISE EXCEPTION 'ACL materiali inattese';
  END IF;
  FOR x IN SELECT unnest(ARRAY['anon','authenticated','service_role',
    'artecna_rapportini_backend','artecna_rapportini_rpc']) ruolo LOOP
    IF has_table_privilege(x.ruolo,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege(x.ruolo,t,'SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'Privilegio effettivo materiali inatteso: %',x.ruolo;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid=t AND attnum>0 AND NOT attisdropped)<>13
    OR NOT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=t AND a.attname='costo_totale' AND a.attgenerated='s'
        AND format_type(a.atttypid,a.atttypmod)='numeric(30,2)'
        AND regexp_replace(pg_get_expr(d.adbin,d.adrelid),'[[:space:]]','','g')=
          'CASEWHEN(costo_unitarioISNULL)THENNULL::numericELSEround((quantita*costo_unitario),2)END')
    OR NOT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid='public.rapportini'::regclass AND a.attname='versione_materiali'
        AND a.atttypid='smallint'::regtype AND a.attnotnull AND pg_get_expr(d.adbin,d.adrelid)='0') THEN
    RAISE EXCEPTION 'Schema/default/formula materiali inattesi';
  END IF;
  IF EXISTS(SELECT 1 FROM public.rapportini WHERE versione_materiali<>0)
    OR EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=t AND NOT convalidated)
    OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=t AND contype='f'
      AND confrelid='public.rapportini'::regclass AND confdeltype='r' AND NOT condeferrable)
    OR NOT EXISTS(SELECT 1 FROM pg_index i WHERE indexrelid='public.rapportino_materiali_attivi'::regclass
      AND indisvalid AND indisready AND NOT indisunique AND indnkeyatts=3 AND indnatts=3
      AND (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(i.indkey::smallint[])
        WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=t AND a.attnum=k.num)=
        ARRAY['rapportino_id','created_at','id']
      AND pg_get_expr(indpred,indrelid)='(rimossa_at IS NULL)') THEN
    RAISE EXCEPTION 'Versioni/vincoli/indice materiali incompatibili';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=t AND contype='p' AND convalidated
      AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=t AND attname='id')])
    OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=t AND contype='u' AND convalidated AND NOT condeferrable
      AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=t AND attname='rapportino_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid=t AND attname='chiave_client')])
    OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=t AND contype='f' AND convalidated
      AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=t AND attname='rapportino_id')]
      AND confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.rapportini'::regclass AND attname='id')]
      AND confrelid='public.rapportini'::regclass AND confdeltype='r' AND confupdtype='a' AND NOT condeferrable)
    OR EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid IN(t,'public.rapportini'::regclass)
      AND (conrelid=t OR conname IN('rapportini_versione_materiali_ck','rapportini_materiali_v1_ck')) AND NOT convalidated) THEN
    RAISE EXCEPTION 'PK/FK/UNIQUE materiali incompatibili';
  END IF;
  FOR x IN SELECT * FROM m22_funzioni LOOP
    IF (SELECT to_jsonb(p) FROM pg_proc p WHERE oid=x.oid) IS DISTINCT FROM x.metadata THEN
      RAISE EXCEPTION 'Funzione storica modificata'; END IF;
  END LOOP;
  FOR x IN SELECT * FROM m22_trigger LOOP
    IF (SELECT to_jsonb(tr) FROM pg_trigger tr WHERE oid=x.oid) IS DISTINCT FROM x.metadata THEN
      RAISE EXCEPTION 'Trigger storico modificato'; END IF;
  END LOOP;
  FOR x IN SELECT * FROM m22_nuove_guardie LOOP
    IF (SELECT to_jsonb(p) FROM pg_proc p WHERE oid=x.oid) IS DISTINCT FROM x.metadata THEN
      RAISE EXCEPTION 'Nuova guardia materiali modificata'; END IF;
  END LOOP;
  IF EXISTS(SELECT * FROM m22_legacy EXCEPT SELECT id,materiali,quantita_materiali,costo_materiali FROM public.rapportini)
    OR EXISTS(SELECT id,materiali,quantita_materiali,costo_materiali FROM public.rapportini EXCEPT SELECT * FROM m22_legacy) THEN
    RAISE EXCEPTION 'Dati legacy modificati'; END IF;
  FOR x IN SELECT * FROM m22_struttura LOOP
    IF x.tipo='colonna' THEN
      IF (SELECT to_jsonb(a) FROM pg_attribute a WHERE attrelid=t AND attname=x.nome) IS DISTINCT FROM x.definizione
        THEN RAISE EXCEPTION 'Colonna materiali alterata'; END IF;
    ELSE
      IF (SELECT to_jsonb(c) FROM pg_constraint c WHERE conname=x.nome
        AND conrelid IN (t,'public.rapportini'::regclass)) IS DISTINCT FROM x.definizione
        THEN RAISE EXCEPTION 'Vincolo materiali alterato'; END IF;
    END IF;
  END LOOP;
  FOR x IN SELECT p.* FROM pg_proc p WHERE p.oid IN (
    'artecna_rapportini.proteggi_versione_materiali()'::regprocedure,
    'artecna_rapportini.proteggi_materiale()'::regprocedure,
    'artecna_rapportini.materiali_fail_closed()'::regprocedure) LOOP
    IF x.proowner<>'postgres'::regrole OR x.provolatile<>'v'
      OR x.prorettype<>'trigger'::regtype OR x.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql')
      OR x.prosecdef IS DISTINCT FROM (x.oid='artecna_rapportini.proteggi_materiale()'::regprocedure)
      OR x.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']
      OR EXISTS(SELECT 1 FROM aclexplode(x.proacl) a WHERE a.grantee<>x.proowner) THEN
      RAISE EXCEPTION 'Guardia materiali metadata/ACL inattese'; END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_trigger WHERE tgrelid=t AND NOT tgisinternal AND tgenabled='O')<>2
    OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=t AND tgname='a_rapportino_materiali_integrita'
      AND tgfoid='artecna_rapportini.proteggi_materiale()'::regprocedure AND tgtype=31 AND tgenabled='O')
    OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=t AND tgname='z_rapportino_materiali_fail_closed'
      AND tgfoid='artecna_rapportini.materiali_fail_closed()'::regprocedure AND tgtype=31 AND tgenabled='O')
    OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.rapportini'::regclass
      AND tgname='rapportino_materiali_versione' AND tgenabled='O'
      AND tgfoid='artecna_rapportini.proteggi_versione_materiali()'::regprocedure AND tgtype=23) THEN
    RAISE EXCEPTION 'Guardie materiali mancanti'; END IF;
END;
$postcheck$;
COMMIT;
