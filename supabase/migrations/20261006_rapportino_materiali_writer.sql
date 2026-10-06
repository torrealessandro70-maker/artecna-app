-- M2.3: applicazione manuale dopo M2.2; nessuna lettura V2/UI/cleanup.
-- Contratto 1 congelato; contratto 2: un intento, una revisione aggregata.
-- Lock: autorizzazione (sessione/compilatore e cantiere SHARE) -> richiesta advisory
-- -> giorno advisory in creazione / Rapportino UPDATE -> Prestazioni (con i lock
-- storici Variante e costo operaio) -> Materiali -> proiezione Timbrature.
-- Nessun nuovo ordine tra domini: ogni mutazione è serializzata dal Rapportino.
-- Decimali client: stringhe non negative con esattamente sei cifre decimali,
-- al massimo dodici cifre intere; quantità strettamente positiva.
-- No-op Materiali non aggiorna la riga; UPDATE Prestazioni mantiene la semantica
-- storica. L'adozione 0->1 consuma una revisione anche senza righe.
-- costo_materiali legacy mai sincronizzato; CLEANUP CANTIERE V2 resta separato.
BEGIN;
DO $preflight$
DECLARE x record; p record;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'Installazione riservata a postgres'; END IF;
 IF to_regclass('public.rapportino_materiali') IS NULL OR to_regprocedure('artecna_rapportini.salva_contratto_uno(jsonb,text)') IS NOT NULL THEN RAISE EXCEPTION 'M2.2 assente o M2.3 già presente'; END IF;
 FOR x IN SELECT * FROM (VALUES
 ('public.salva_rapportino_con_prestazioni(jsonb,text)','d8b72dbee95906c3b4fab477f737049dcd6c506c99cce871227ea5a7bf0e920a',true,'jsonb'),
 ('artecna_rapportini.applica_prestazioni_rapportino(jsonb)','e9fa405954943ab75d7f69bb1b53a21b89b60566f0c96c70daa82dc14d95c4ce',false,'jsonb'),
 ('artecna_rapportini.proteggi_materiale()','eeb3a4f2b4dbb1090ceebefa0b06c7fb22b0de8e1ebf178e7b1b4dfedbc275d4',true,'trigger'),
 ('artecna_rapportini.proteggi_versione_materiali()','d2c1961963c5f4884e41c90bc27d17811da45566dfbf6a09a8564c820492e32b',false,'trigger'),
 ('artecna_rapportini.materiali_fail_closed()','24403b1c591f0d61fe602e1ae8bdccd8388df7b4b1b9e5ad2a2620bdc3e08ddc',false,'trigger')
 ) b(firma,hash,definer,risultato) LOOP
 SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(x.firma);
 IF NOT FOUND OR p.proowner<>'postgres'::regrole OR p.prosecdef IS DISTINCT FROM x.definer OR p.provolatile<>'v'
 OR p.prokind<>'f' OR p.proretset
 OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql') OR p.prorettype<>to_regtype(x.risultato)
 OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[]
 OR position(chr(13) IN replace(p.prosrc,chr(13)||chr(10),chr(10)))>0
 OR encode(sha256(convert_to(replace(p.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex')<>x.hash THEN
 RAISE EXCEPTION 'Baseline funzione divergente: %',x.firma; END IF;
 END LOOP;
 IF NOT has_function_privilege('authenticated','public.salva_rapportino_con_prestazioni(jsonb,text)','EXECUTE')
 OR NOT has_function_privilege('artecna_rapportini_backend','public.salva_rapportino_con_prestazioni(jsonb,text)','EXECUTE')
 OR has_function_privilege('anon','public.salva_rapportino_con_prestazioni(jsonb,text)','EXECUTE')
 OR has_schema_privilege('artecna_rapportini_backend','artecna_rapportini','USAGE,CREATE')
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_rapportini_rpc' AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication)) THEN RAISE EXCEPTION 'ACL/ruolo baseline divergenti'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc pr CROSS JOIN LATERAL aclexplode(coalesce(pr.proacl,acldefault('f',pr.proowner))) a
 WHERE pr.oid='public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure
 AND (a.is_grantable OR a.privilege_type<>'EXECUTE' OR a.grantee NOT IN ('postgres'::regrole,'authenticated'::regrole,'service_role'::regrole,'artecna_rapportini_backend'::regrole)))
 OR EXISTS(SELECT 1 FROM pg_proc pr CROSS JOIN LATERAL aclexplode(coalesce(pr.proacl,acldefault('f',pr.proowner))) a
 WHERE pr.oid='artecna_rapportini.applica_prestazioni_rapportino(jsonb)'::regprocedure
 AND (a.is_grantable OR a.privilege_type<>'EXECUTE' OR a.grantee NOT IN ('postgres'::regrole,'artecna_rapportini_rpc'::regrole))) THEN RAISE EXCEPTION 'ACL baseline writer/helper divergenti'; END IF;
END;
$preflight$;
-- Snapshot per post-check: tutte le funzioni storiche salvo l'unico ingresso e il veto M2.2.
CREATE TEMP TABLE m23_funzioni ON COMMIT DROP AS SELECT oid,to_jsonb(p) metadata FROM pg_proc p
 WHERE pronamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 AND oid NOT IN ('public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure,'artecna_rapportini.materiali_fail_closed()'::regprocedure);
CREATE TEMP TABLE m23_acl ON COMMIT DROP AS SELECT proacl FROM pg_proc WHERE oid='public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure;
CREATE TEMP TABLE m23_legacy ON COMMIT DROP AS SELECT id,materiali,quantita_materiali,costo_materiali,versione_materiali FROM public.rapportini;
CREATE TEMP TABLE m23_struttura ON COMMIT DROP AS
 SELECT 'colonna'::text tipo,attname nome,to_jsonb(a) definizione FROM pg_attribute a WHERE attrelid='public.rapportino_materiali'::regclass AND attnum>0
 UNION ALL SELECT 'vincolo',conname,to_jsonb(c) FROM pg_constraint c WHERE conrelid='public.rapportino_materiali'::regclass
 UNION ALL SELECT 'trigger',tgname,to_jsonb(t) FROM pg_trigger t WHERE tgrelid='public.rapportino_materiali'::regclass;
DO $schema_preflight$
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
  IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=t AND NOT convalidated)
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
$schema_preflight$;
DO $checks$ DECLARE x record; BEGIN
 FOR x IN SELECT * FROM (VALUES ('rapportini_materiali_v1_ck','CHECK (((versione_materiali = 0) OR (versione_prestazioni = 1)))'),
('rapportini_versione_materiali_ck','CHECK ((versione_materiali = ANY (ARRAY[0, 1])))'),
('rapportino_materiali_chiave_ck','CHECK (((chiave_client COLLATE "C") = (((chiave_client)::uuid)::text COLLATE "C")))'),
('rapportino_materiali_costo_ck','CHECK (((costo_unitario IS NULL) OR ((costo_unitario >= (0)::numeric) AND ((costo_unitario)::text <> ''NaN''::text))))'),
('rapportino_materiali_descrizione_ck','CHECK (((descrizione = btrim(descrizione)) AND ((length(descrizione) >= 1) AND (length(descrizione) <= 2000))))'),
('rapportino_materiali_identita','UNIQUE (rapportino_id, chiave_client)'),
('rapportino_materiali_note_ck','CHECK ((length(note) <= 20000))'),
('rapportino_materiali_pkey','PRIMARY KEY (id)'),
('rapportino_materiali_quantita_ck','CHECK (((quantita > (0)::numeric) AND ((quantita)::text <> ''NaN''::text)))'),
('rapportino_materiali_rapportino_fk','FOREIGN KEY (rapportino_id) REFERENCES rapportini(id) ON DELETE RESTRICT'),
('rapportino_materiali_revisione_ck','CHECK ((revisione >= 0))'),
('rapportino_materiali_um_ck','CHECK (((unita_misura = btrim(unita_misura)) AND ((length(unita_misura) >= 1) AND (length(unita_misura) <= 50))))')) c(nome,definizione) LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname=x.nome AND conrelid=CASE WHEN x.nome LIKE 'rapportini_%' THEN 'public.rapportini'::regclass ELSE 'public.rapportino_materiali'::regclass END
 AND pg_get_constraintdef(oid)=x.definizione AND convalidated) THEN RAISE EXCEPTION 'Vincolo M2.2 divergente: %',x.nome; END IF; END LOOP;
 IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.rapportino_materiali'::regclass AND contype<>'n')<>10 THEN RAISE EXCEPTION 'Vincolo materiali inatteso'; END IF;
END; $checks$;
DO $defaults$ DECLARE x record; BEGIN
 FOR x IN SELECT * FROM (VALUES ('id','gen_random_uuid()'),('note','''''::text'),('revisione','0'),('created_at','now()'),('updated_at','now()')) d(nome,espressione) LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid='public.rapportino_materiali'::regclass AND a.attname=x.nome AND pg_get_expr(d.adbin,d.adrelid)=x.espressione) THEN RAISE EXCEPTION 'Default M2.2 divergente'; END IF; END LOOP;
 IF EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid='public.rapportino_materiali'::regclass AND a.attname NOT IN ('id','note','revisione','created_at','updated_at','costo_totale')) THEN RAISE EXCEPTION 'Default M2.2 inatteso'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure
 AND proargnames=ARRAY['p_payload','p_sessione']::text[] AND pronargdefaults=1 AND pg_get_expr(proargdefaults,0)='NULL::text') THEN RAISE EXCEPTION 'Firma/default writer divergenti'; END IF;
END; $defaults$;
-- Installer PostgreSQL >=16: il grant provider resta intatto. Nessun flag runtime.
CREATE TEMP TABLE m23_membership ON COMMIT DROP AS
 SELECT to_jsonb(m) metadata FROM pg_auth_members m;
CREATE TEMP TABLE m23_installer ON COMMIT DROP AS
 SELECT r.rolsuper superuser,n.nspacl schema_acl,
   pg_has_role('postgres','artecna_rapportini_rpc','USAGE') uso_rpc,
   pg_has_role('postgres','artecna_rapportini_rpc','SET') set_rpc
 FROM pg_roles r CROSS JOIN pg_namespace n
 WHERE r.rolname='postgres' AND n.nspname='artecna_rapportini';
DO $installer_preflight$
BEGIN
 IF current_setting('server_version_num')::integer<160000
 OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='artecna_rapportini' AND nspowner='postgres'::regrole)
 OR NOT has_schema_privilege('artecna_rapportini_rpc','artecna_rapportini','USAGE')
 OR has_schema_privilege('artecna_rapportini_rpc','artecna_rapportini','CREATE') THEN
 RAISE EXCEPTION 'Baseline installer/schema divergente'; END IF;
 IF NOT (SELECT superuser FROM m23_installer) THEN
   IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='postgres' AND rolcreaterole)
   OR pg_has_role('postgres','artecna_rapportini_rpc','USAGE')
   OR pg_has_role('postgres','artecna_rapportini_rpc','SET')
   OR (SELECT count(*) FROM pg_auth_members WHERE roleid='artecna_rapportini_rpc'::regrole AND member='postgres'::regrole)<>1
   OR NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='artecna_rapportini_rpc'::regrole AND member='postgres'::regrole
     AND grantor<>'postgres'::regrole AND admin_option AND NOT inherit_option AND NOT set_option) THEN
   RAISE EXCEPTION 'Membership installer divergente'; END IF;
 END IF;
END;
$installer_preflight$;
CREATE FUNCTION artecna_rapportini.salva_contratto_uno(p_payload jsonb,p_sessione text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
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
-- Solo applicazione prestazioni: stesso corpo operativo STEP 3, nessun intento/revisione aggregata.
CREATE FUNCTION artecna_rapportini.applica_prestazioni_contratto_due(p_payload jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE rid uuid:=(p_payload->>'rapportino_id')::uuid; c uuid:=(p_payload->>'cantiere_id')::uuid;
 old public.rapportino_prestazioni%rowtype; ops jsonb; x jsonb; k text; pid uuid;
 seen uuid[]:='{}'; keys text[]:='{}'; oi uuid; vi uuid; econ boolean; start_time time; end_time time; pause integer;
 changed boolean:=false; exists_key boolean;
BEGIN
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
  RETURN changed;
END;
$fn$;
CREATE OR REPLACE FUNCTION artecna_rapportini.materiali_fail_closed() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $fn$
BEGIN
 IF current_user<>'artecna_rapportini_rpc' OR TG_OP='DELETE' THEN
 RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Materiali riservati al writer Rapportino'; END IF;
 RETURN NEW;
END;
$fn$;

-- L'unico helper con elevazione al ruolo interno: adozione e DML materiali, senza DELETE.
CREATE FUNCTION artecna_rapportini.applica_materiali_contratto_due(p_rapportino uuid,p_ops jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE x jsonb; k text; mid uuid; key text; q numeric; cost numeric;
 old public.rapportino_materiali%rowtype; seen uuid[]:='{}'; keys text[]:='{}'; changed boolean:=false;
BEGIN
 IF jsonb_typeof(p_ops) IS DISTINCT FROM 'object' OR NOT(p_ops ?& ARRAY['nuove','aggiornate','rimosse'])
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_ops) z WHERE z NOT IN ('nuove','aggiornate','rimosse')) THEN
 RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazioni materiali non valide'; END IF;
 FOREACH k IN ARRAY ARRAY['nuove','aggiornate','rimosse'] LOOP
 IF jsonb_typeof(p_ops->k) IS DISTINCT FROM 'array' OR jsonb_array_length(p_ops->k)>100 THEN
 RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Array materiali non valido'; END IF; END LOOP;
 UPDATE public.rapportini SET versione_materiali=1 WHERE id=p_rapportino AND versione_prestazioni=1 AND versione_materiali=0;
 changed:=FOUND;
 IF NOT EXISTS(SELECT 1 FROM public.rapportini WHERE id=p_rapportino AND versione_prestazioni=1 AND versione_materiali=1) THEN
 RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Padre materiali non valido'; END IF;
 FOREACH k IN ARRAY ARRAY['nuove','aggiornate'] LOOP
 FOR x IN SELECT value FROM jsonb_array_elements(p_ops->k) LOOP
 IF jsonb_typeof(x) IS DISTINCT FROM 'object' OR NOT(x ?& ARRAY['materiale_id','chiave_client','descrizione','unita_misura','quantita','costo_unitario','note'])
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z WHERE z NOT IN ('materiale_id','chiave_client','descrizione','unita_misura','quantita','costo_unitario','note'))
 OR jsonb_typeof(x->'chiave_client') IS DISTINCT FROM 'string'
 OR jsonb_typeof(x->'descrizione') IS DISTINCT FROM 'string' OR x->>'descrizione'<>btrim(x->>'descrizione') OR length(x->>'descrizione') NOT BETWEEN 1 AND 2000
 OR jsonb_typeof(x->'unita_misura') IS DISTINCT FROM 'string' OR x->>'unita_misura'<>btrim(x->>'unita_misura') OR length(x->>'unita_misura') NOT BETWEEN 1 AND 50
 OR jsonb_typeof(x->'note') IS DISTINCT FROM 'string' OR length(x->>'note')>20000
 OR jsonb_typeof(x->'quantita') IS DISTINCT FROM 'string' OR coalesce(x->>'quantita','') !~ '^(0|[1-9][0-9]{0,11})[.][0-9]{6}$'
 OR (x->'costo_unitario' IS DISTINCT FROM 'null'::jsonb AND (jsonb_typeof(x->'costo_unitario') IS DISTINCT FROM 'string'
 OR coalesce(x->>'costo_unitario','') !~ '^(0|[1-9][0-9]{0,11})[.][0-9]{6}$')) THEN
 RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Materiale o decimale non valido'; END IF;
 key:=x->>'chiave_client';
 BEGIN
 IF key COLLATE "C" IS DISTINCT FROM (key::uuid)::text COLLATE "C" THEN
 RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Chiave materiale non canonica'; END IF;
 EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Chiave materiale non valida'; END;
 IF key=ANY(keys) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Chiave materiale ripetuta'; END IF;
 keys:=array_append(keys,key);
 -- Solo dopo formato/range, nessun cast typmod usato per arrotondare input.
 q:=(x->>'quantita')::numeric; cost:=(x->>'costo_unitario')::numeric;
 IF q<=0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Quantità materiale non positiva'; END IF;
 IF k='nuove' THEN
 IF x->'materiale_id' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità nuova assegnata dal server'; END IF;
 SELECT * INTO old FROM public.rapportino_materiali WHERE rapportino_id=p_rapportino AND chiave_client=key FOR UPDATE;
 IF FOUND THEN
 IF old.rimossa_at IS NOT NULL OR old.descrizione IS DISTINCT FROM x->>'descrizione' OR old.unita_misura IS DISTINCT FROM x->>'unita_misura'
 OR old.quantita IS DISTINCT FROM q OR old.costo_unitario IS DISTINCT FROM cost OR old.note IS DISTINCT FROM x->>'note' THEN
 RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Chiave materiale già utilizzata'; END IF;
 ELSE
 INSERT INTO public.rapportino_materiali(rapportino_id,chiave_client,descrizione,unita_misura,quantita,costo_unitario,note)
 VALUES(p_rapportino,key,x->>'descrizione',x->>'unita_misura',q,cost,x->>'note'); changed:=true;
 END IF;
 ELSE
 IF jsonb_typeof(x->'materiale_id') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità materiale obbligatoria'; END IF;
 BEGIN mid:=(x->>'materiale_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità materiale non valida'; END;
 IF mid IS NULL OR mid=ANY(seen) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità materiale ripetuta'; END IF;
 seen:=array_append(seen,mid);
 SELECT * INTO old FROM public.rapportino_materiali WHERE id=mid AND rapportino_id=p_rapportino FOR UPDATE;
 IF NOT FOUND OR old.rimossa_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Materiale assente/rimosso/fuori Rapportino'; END IF;
 IF old.chiave_client IS DISTINCT FROM key THEN RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Identità materiale immutabile'; END IF;
 IF old.descrizione IS DISTINCT FROM x->>'descrizione' OR old.unita_misura IS DISTINCT FROM x->>'unita_misura'
 OR old.quantita IS DISTINCT FROM q OR old.costo_unitario IS DISTINCT FROM cost OR old.note IS DISTINCT FROM x->>'note' THEN
 UPDATE public.rapportino_materiali SET descrizione=x->>'descrizione',unita_misura=x->>'unita_misura',quantita=q,costo_unitario=cost,note=x->>'note' WHERE id=mid;
 changed:=true; END IF;
 END IF;
 END LOOP; END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(p_ops->'rimosse') LOOP
 IF jsonb_typeof(x) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Rimozione materiale per UUID'; END IF;
 BEGIN mid:=(x#>>'{}')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità materiale non valida'; END;
 IF mid=ANY(seen) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazione materiale ripetuta'; END IF;
 seen:=array_append(seen,mid);
 UPDATE public.rapportino_materiali SET rimossa_at=statement_timestamp() WHERE id=mid AND rapportino_id=p_rapportino AND rimossa_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Materiale da rimuovere assente'; END IF;
 changed:=true;
 END LOOP;
 RETURN changed;
END;
$fn$;
-- Solo autorizzazioni DDL temporanee, nella stessa transazione della migration.
DO $installer_prepare$
BEGIN
 IF NOT (SELECT superuser FROM m23_installer) THEN
   GRANT artecna_rapportini_rpc TO postgres WITH INHERIT FALSE GRANTED BY postgres;
   GRANT artecna_rapportini_rpc TO postgres WITH SET TRUE GRANTED BY postgres;
 END IF;
 GRANT CREATE ON SCHEMA artecna_rapportini TO artecna_rapportini_rpc;
END;
$installer_prepare$;
ALTER FUNCTION artecna_rapportini.applica_materiali_contratto_due(uuid,jsonb) OWNER TO artecna_rapportini_rpc;
REVOKE CREATE ON SCHEMA artecna_rapportini FROM artecna_rapportini_rpc;
-- Top-level, mai dentro SECURITY DEFINER. Nessuna ereditarietà temporanea.
SET LOCAL ROLE artecna_rapportini_rpc;
DO $materiali_acl$
DECLARE g record;
BEGIN
 REVOKE ALL ON FUNCTION artecna_rapportini.applica_materiali_contratto_due(uuid,jsonb) FROM PUBLIC;
 FOR g IN SELECT DISTINCT a.grantee FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
   WHERE p.oid='artecna_rapportini.applica_materiali_contratto_due(uuid,jsonb)'::regprocedure
   AND a.grantee<>0 AND a.grantee<>p.proowner LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION artecna_rapportini.applica_materiali_contratto_due(uuid,jsonb) FROM %I',pg_get_userbyid(g.grantee));
 END LOOP;
END;
$materiali_acl$;
GRANT EXECUTE ON FUNCTION artecna_rapportini.applica_materiali_contratto_due(uuid,jsonb) TO postgres;
SET LOCAL ROLE postgres;
DO $installer_restore$
BEGIN
 IF NOT (SELECT superuser FROM m23_installer) THEN
   REVOKE artecna_rapportini_rpc FROM postgres GRANTED BY postgres RESTRICT;
 END IF;
END;
$installer_restore$;
GRANT SELECT,INSERT,UPDATE ON public.rapportino_materiali TO artecna_rapportini_rpc;
GRANT SELECT(versione_materiali),UPDATE(versione_materiali) ON public.rapportini TO artecna_rapportini_rpc;
CREATE POLICY rapportino_materiali_dominio ON public.rapportino_materiali FOR ALL TO artecna_rapportini_rpc USING(true) WITH CHECK(true);
CREATE FUNCTION artecna_rapportini.salva_contratto_due(p_payload jsonb,p_sessione text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
DECLARE
  a record; r public.rapportini%rowtype; rid uuid; req uuid; c uuid; giorno date;
  prev artecna_rapportini.richieste%rowtype; h bytea; result jsonb; dominio jsonb;
  documento jsonb; costo numeric; ore_totali numeric; presenti integer; elenco text;
  changed boolean; materiali_changed boolean; x record;
BEGIN
  -- Connessione dedicata: session_user resta il LOGIN anche dentro DEFINER.
  IF session_user = 'artecna_rapportini_backend' AND
    (p_sessione IS NULL OR p_sessione !~ '^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Backend Rapportini: sessione portale obbligatoria';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>1048576
    OR NOT(p_payload ?& ARRAY['versione_contratto','richiesta_id','rapportino_id','revisione_attesa','cantiere_id','data','prestazioni','materiali'])
    OR p_payload->'versione_contratto' IS DISTINCT FROM '2'::jsonb
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN
      ('versione_contratto','richiesta_id','rapportino_id','revisione_attesa','cantiere_id','data','prestazioni','documento','materiali'))
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
    (SELECT 1 FROM jsonb_object_keys(documento) k WHERE k NOT IN ('note')) THEN
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
      OR p_payload#>'{prestazioni,rimosse}' IS DISTINCT FROM '[]'::jsonb
      OR p_payload#>'{materiali,aggiornate}' IS DISTINCT FROM '[]'::jsonb
      OR p_payload#>'{materiali,rimosse}' IS DISTINCT FROM '[]'::jsonb THEN
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
        a.compilatore_nome,coalesce(documento->>'note',''),'',
        '' FROM public.cantieri WHERE id=c
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
  IF p_payload->'rapportino_id' IS DISTINCT FROM 'null'::jsonb AND
    (jsonb_typeof(p_payload->'revisione_attesa') IS DISTINCT FROM 'number' OR p_payload->>'revisione_attesa' !~ '^[0-9]+$') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Revisione attesa non valida'; END IF;
  IF p_payload->'rapportino_id' IS DISTINCT FROM 'null'::jsonb AND (p_payload->>'revisione_attesa')::bigint<>r.revisione_prestazioni THEN
    RAISE EXCEPTION USING ERRCODE='PR412',MESSAGE='Revisione Rapportino obsoleta'; END IF;
  dominio:=p_payload||jsonb_build_object('rapportino_id',rid);
  changed:=artecna_rapportini.applica_prestazioni_contratto_due(dominio);
  materiali_changed:=artecna_rapportini.applica_materiali_contratto_due(rid,p_payload->'materiali');
  -- Un solo incremento; nessun helper possiede la revisione aggregata.
  IF changed OR materiali_changed OR p_payload->'rapportino_id'='null'::jsonb OR
    (documento ? 'note' AND documento->>'note' IS DISTINCT FROM r.note) THEN
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
    note=CASE WHEN documento ? 'note' THEN documento->>'note' ELSE note END
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
  result:=jsonb_build_object('versione_contratto',2,'rapportino_id',rid,'revisione',r.revisione_prestazioni,
    'cantiere_id',c,'data',to_char(giorno,'YYYY-MM-DD'),'documento',jsonb_build_object(
      'note',r.note),
    'prestazioni',(SELECT coalesce(jsonb_agg(jsonb_build_object('prestazione_id',p.id,
      'chiave_client',p.chiave_client,'operaio_id',p.operaio_id,'operaio_nome',o.nome,
      'ora_inizio',to_char(p.ora_inizio,'HH24:MI'),'ora_fine',to_char(p.ora_fine,'HH24:MI'),
      'pausa_minuti',p.pausa_minuti,'ore',p.ore,'lavoro_in_economia',p.lavoro_in_economia,
      'variante_id',p.variante_id,'revisione',p.revisione,'rimossa_at',p.rimossa_at)
      ORDER BY p.created_at,p.id),'[]') FROM public.rapportino_prestazioni p
        JOIN public.operai o ON o.id=p.operaio_id WHERE p.rapportino_id=rid));
  result:=result||jsonb_build_object('versione_materiali',r.versione_materiali,
    'materiali',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'materiale_id',m.id,'chiave_client',m.chiave_client,'descrizione',m.descrizione,'unita_misura',m.unita_misura,
      'quantita',m.quantita::text,'costo_unitario',m.costo_unitario::text,'costo_totale',m.costo_totale::text,
      'note',m.note,'revisione',m.revisione,'rimossa_at',m.rimossa_at) ORDER BY m.created_at,m.id),'[]')
      FROM public.rapportino_materiali m WHERE m.rapportino_id=rid),
    'riepilogo_materiali',(SELECT jsonb_build_object(
      'totale_materiali_valorizzati',coalesce(sum(m.costo_totale),0.00)::text,
      'numero_materiali_da_valorizzare',count(*) FILTER(WHERE m.costo_unitario IS NULL),
      'valorizzazione_completa',count(*) FILTER(WHERE m.costo_unitario IS NULL)=0)
      FROM public.rapportino_materiali m WHERE m.rapportino_id=rid AND m.rimossa_at IS NULL));
  INSERT INTO artecna_rapportini.richieste(canale,utente_id,richiesta_id,rapportino_id,payload_sha256,risultato)
    VALUES(a.canale,a.identita,req,rid,h,result);
  RETURN result;
END;
$fn$;
CREATE OR REPLACE FUNCTION public.salva_rapportino_con_prestazioni(p_payload jsonb,p_sessione text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $fn$
BEGIN
 IF p_payload->'versione_contratto'='2'::jsonb THEN RETURN artecna_rapportini.salva_contratto_due(p_payload,p_sessione); END IF;
 RETURN artecna_rapportini.salva_contratto_uno(p_payload,p_sessione);
END;
$fn$;
-- Nessun EXECUTE diretto per browser/backend, nessuna membership permanente nuova.
DO $acl$
DECLARE f record; a record;
BEGIN
 FOR f IN SELECT * FROM pg_proc WHERE oid IN (
 'artecna_rapportini.salva_contratto_uno(jsonb,text)'::regprocedure,
 'artecna_rapportini.salva_contratto_due(jsonb,text)'::regprocedure,
 'artecna_rapportini.applica_prestazioni_contratto_due(jsonb)'::regprocedure) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.oid::regprocedure);
 FOR a IN SELECT DISTINCT grantee FROM aclexplode(f.proacl) WHERE grantee<>0 AND grantee<>f.proowner LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',f.oid::regprocedure,pg_get_userbyid(a.grantee)); END LOOP;
 END LOOP;
END;
$acl$;
DO $postcheck$
DECLARE x record; p record;
BEGIN
 IF (SELECT proacl FROM pg_proc WHERE oid='public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure) IS DISTINCT FROM (SELECT proacl FROM m23_acl) THEN RAISE EXCEPTION 'ACL ingresso modificata'; END IF;
 FOR x IN SELECT * FROM m23_funzioni LOOP
 IF (SELECT to_jsonb(hist) FROM pg_proc hist WHERE oid=x.oid) IS DISTINCT FROM x.metadata THEN RAISE EXCEPTION 'Funzione storica modificata'; END IF; END LOOP;
 IF EXISTS(SELECT * FROM m23_legacy EXCEPT SELECT id,materiali,quantita_materiali,costo_materiali,versione_materiali FROM public.rapportini)
 OR EXISTS(SELECT id,materiali,quantita_materiali,costo_materiali,versione_materiali FROM public.rapportini EXCEPT SELECT * FROM m23_legacy) THEN RAISE EXCEPTION 'Legacy o versione alterati durante installazione'; END IF;
 IF encode(sha256(convert_to(replace((SELECT prosrc FROM pg_proc WHERE oid='artecna_rapportini.salva_contratto_uno(jsonb,text)'::regprocedure),chr(13)||chr(10),chr(10)),'UTF8')),'hex')<>'d8b72dbee95906c3b4fab477f737049dcd6c506c99cce871227ea5a7bf0e920a' THEN RAISE EXCEPTION 'Contratto 1 non identico'; END IF;
 FOR x IN SELECT * FROM (VALUES
 ('artecna_rapportini.salva_contratto_uno(jsonb,text)','d8b72dbee95906c3b4fab477f737049dcd6c506c99cce871227ea5a7bf0e920a'),
 ('artecna_rapportini.applica_prestazioni_contratto_due(jsonb)','870aa773a0b8e5e2dc6fd811fe91a6092f9904ca161b45c44142d46e86dfd309'),
 ('artecna_rapportini.materiali_fail_closed()','69f6e5258de386726ece3a71108ea57b3ab299f47ce71922618be984495d6a9f'),
 ('artecna_rapportini.applica_materiali_contratto_due(uuid,jsonb)','c97f063e9aff6ca5dd0d3772e0a343de8a9a14763662038bdc770cfe4246880c'),
 ('artecna_rapportini.salva_contratto_due(jsonb,text)','3fe2903db3f37be9d7f5a8448b7bff6c40601f2eb31636cb08b100e6becd29dd'),
 ('public.salva_rapportino_con_prestazioni(jsonb,text)','7659544293c06ad4481a0dc7f6c772aadfad8f0d130310c7f2c99b41e8d080d4')
 ) n(firma,hash) LOOP
 SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(x.firma);
 IF NOT FOUND OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql') OR p.provolatile<>'v'
 OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[]
 OR position(chr(13) IN replace(p.prosrc,chr(13)||chr(10),chr(10)))>0
 OR encode(sha256(convert_to(replace(p.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex')<>x.hash
 OR p.proowner<>(CASE WHEN x.firma='artecna_rapportini.applica_materiali_contratto_due(uuid,jsonb)' THEN 'artecna_rapportini_rpc'::regrole ELSE 'postgres'::regrole END)
 OR p.prorettype<>(CASE WHEN x.firma='artecna_rapportini.materiali_fail_closed()' THEN 'trigger'::regtype WHEN x.firma IN ('artecna_rapportini.applica_materiali_contratto_due(uuid,jsonb)','artecna_rapportini.applica_prestazioni_contratto_due(jsonb)') THEN 'boolean'::regtype ELSE 'jsonb'::regtype END)
 OR p.prosecdef IS DISTINCT FROM (x.firma NOT IN ('artecna_rapportini.applica_prestazioni_contratto_due(jsonb)','artecna_rapportini.materiali_fail_closed()')) THEN RAISE EXCEPTION 'Writer metadata/fingerprint divergenti'; END IF;
 IF x.firma LIKE 'artecna_rapportini.%' AND EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE a.is_grantable OR a.privilege_type<>'EXECUTE' OR a.grantee NOT IN(p.proowner,'postgres'::regrole)) THEN RAISE EXCEPTION 'ACL helper divergente'; END IF;
 END LOOP;
 FOR x IN SELECT unnest(ARRAY['anon','authenticated','service_role','artecna_rapportini_backend']) ruolo LOOP
 IF has_table_privilege(x.ruolo,'public.rapportino_materiali','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 OR has_any_column_privilege(x.ruolo,'public.rapportino_materiali','SELECT,INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION 'Materiali esposti'; END IF;
 FOR p IN SELECT oid FROM pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace LOOP
 IF has_function_privilege(x.ruolo,p.oid,'EXECUTE') THEN RAISE EXCEPTION 'Helper esposto'; END IF; END LOOP;
 END LOOP;
 IF has_table_privilege('artecna_rapportini_rpc','public.rapportino_materiali','DELETE,TRUNCATE,REFERENCES,TRIGGER')
 OR NOT has_table_privilege('artecna_rapportini_rpc','public.rapportino_materiali','SELECT')
 OR NOT has_table_privilege('artecna_rapportini_rpc','public.rapportino_materiali','INSERT')
 OR NOT has_table_privilege('artecna_rapportini_rpc','public.rapportino_materiali','UPDATE')
 OR EXISTS(SELECT 1 FROM pg_class WHERE oid='public.rapportino_materiali'::regclass AND (NOT relrowsecurity OR relowner<>'postgres'::regrole))
 OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.rapportino_materiali'::regclass)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.rapportino_materiali'::regclass AND polroles=ARRAY['artecna_rapportini_rpc'::regrole::oid]
 AND polcmd='*' AND pg_get_expr(polqual,polrelid)='true' AND pg_get_expr(polwithcheck,polrelid)='true') THEN RAISE EXCEPTION 'ACL/RLS dominio divergenti'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.oid='public.rapportino_materiali'::regclass
 AND (a.grantee NOT IN(c.relowner,'artecna_rapportini_rpc'::regrole) OR a.is_grantable OR (a.grantee<>c.relowner AND a.privilege_type NOT IN ('SELECT','INSERT','UPDATE'))))
 OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.rapportino_materiali'::regclass AND attacl IS NOT NULL) THEN RAISE EXCEPTION 'ACL tabella/colonna inattesa'; END IF;
 FOR x IN SELECT * FROM m23_struttura LOOP
 IF x.tipo='colonna' THEN SELECT to_jsonb(a) INTO p FROM pg_attribute a WHERE attrelid='public.rapportino_materiali'::regclass AND attname=x.nome;
 ELSIF x.tipo='vincolo' THEN SELECT to_jsonb(c) INTO p FROM pg_constraint c WHERE conrelid='public.rapportino_materiali'::regclass AND conname=x.nome;
 ELSE SELECT to_jsonb(tr) INTO p FROM pg_trigger tr WHERE tgrelid='public.rapportino_materiali'::regclass AND tgname=x.nome; END IF;
 IF p.to_jsonb IS DISTINCT FROM x.definizione THEN RAISE EXCEPTION 'Struttura M2.2 alterata'; END IF;
 END LOOP;
END;
$postcheck$;
DO $installer_postcheck$
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR EXISTS((SELECT metadata FROM m23_membership EXCEPT SELECT to_jsonb(m) FROM pg_auth_members m)
   UNION ALL (SELECT to_jsonb(m) FROM pg_auth_members m EXCEPT SELECT metadata FROM m23_membership))
 OR (SELECT nspacl FROM pg_namespace WHERE nspname='artecna_rapportini') IS DISTINCT FROM (SELECT schema_acl FROM m23_installer)
 OR NOT has_schema_privilege('artecna_rapportini_rpc','artecna_rapportini','USAGE')
 OR has_schema_privilege('artecna_rapportini_rpc','artecna_rapportini','CREATE')
 OR pg_has_role('postgres','artecna_rapportini_rpc','USAGE') IS DISTINCT FROM (SELECT uso_rpc FROM m23_installer)
 OR pg_has_role('postgres','artecna_rapportini_rpc','SET') IS DISTINCT FROM (SELECT set_rpc FROM m23_installer) THEN
 RAISE EXCEPTION 'Autorizzazioni temporanee installer non ripristinate'; END IF;
 IF NOT (SELECT superuser FROM m23_installer) AND (
   pg_has_role('postgres','artecna_rapportini_rpc','SET')
   OR NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='artecna_rapportini_rpc'::regrole AND member='postgres'::regrole
     AND admin_option AND NOT inherit_option AND NOT set_option)
   OR EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='artecna_rapportini_rpc'::regrole AND member='postgres'::regrole AND grantor='postgres'::regrole)
 ) THEN RAISE EXCEPTION 'Membership installer finale divergente'; END IF;
END;
$installer_postcheck$;
COMMIT;
