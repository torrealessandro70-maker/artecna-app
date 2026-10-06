-- M2.3A: installazione manuale dopo M2.2 e PRIMA di M2.3.
-- Solo helper STEP 3 e due chiamate; nessun backfill o modifica collegamenti storici.
BEGIN;
DO $preflight$
DECLARE x record; baseline record;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'Installazione riservata a postgres'; END IF;
 IF to_regclass('public.rapportino_materiali') IS NULL OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace AND proname='verifica_nuovo_collegamento_variante') OR to_regprocedure('artecna_rapportini.salva_contratto_uno(jsonb,text)') IS NOT NULL THEN RAISE EXCEPTION 'M2.2 assente o riallineamento/M2.3 già presente'; END IF;
 FOR x IN SELECT * FROM (VALUES
 ('artecna_rapportini.applica_prestazioni_rapportino(jsonb)','b4068cd6ae31e7b29d600f3caf44a9050772f5651b5e25f26b0b7f9344e88242',false,'jsonb','plpgsql','v'),
 ('artecna_rapportini.proteggi_prestazione()','82aac3ae4f31bf93044db184f5615926b89b5573fab41402e6857e732da9e15b',true,'trigger','plpgsql','v'),
 ('artecna_rapportini.variante_del_cantiere(uuid,uuid)','e48580eeb3f41380871560441be6cf6bf0fc04b57066e96715dcc1abc89e3fb8',true,'boolean','sql','s'),
 ('artecna_rapportini.proteggi_materiale()','eeb3a4f2b4dbb1090ceebefa0b06c7fb22b0de8e1ebf178e7b1b4dfedbc275d4',true,'trigger','plpgsql','v'),
 ('artecna_rapportini.proteggi_versione_materiali()','d2c1961963c5f4884e41c90bc27d17811da45566dfbf6a09a8564c820492e32b',false,'trigger','plpgsql','v'),
 ('artecna_rapportini.materiali_fail_closed()','24403b1c591f0d61fe602e1ae8bdccd8388df7b4b1b9e5ad2a2620bdc3e08ddc',false,'trigger','plpgsql','v')
 ) b(firma,hash,definer,risultato,lingua,volatilita) LOOP
 SELECT * INTO baseline FROM pg_proc WHERE oid=to_regprocedure(x.firma);
 IF NOT FOUND OR baseline.proowner<>'postgres'::regrole OR baseline.prosecdef IS DISTINCT FROM x.definer OR baseline.provolatile::text<>x.volatilita
 OR baseline.prokind<>'f' OR baseline.proretset OR baseline.pronargdefaults<>0
 OR baseline.prolang<>(SELECT oid FROM pg_language WHERE lanname=x.lingua) OR baseline.prorettype<>to_regtype(x.risultato)
 OR baseline.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[]
 OR position(chr(13) IN replace(baseline.prosrc,chr(13)||chr(10),chr(10)))>0
 OR encode(sha256(convert_to(replace(baseline.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex')<>x.hash THEN RAISE EXCEPTION 'Baseline funzione divergente: %',x.firma; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_rapportini_rpc' AND NOT (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication)) OR has_schema_privilege('artecna_rapportini_backend','artecna_rapportini','USAGE,CREATE') THEN RAISE EXCEPTION 'ACL/ruolo divergenti'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='artecna_rapportini_backend' AND rolcanlogin
   AND NOT (rolinherit OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication))
 OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='artecna_rapportini.applica_prestazioni_rapportino(jsonb)'::regprocedure
   AND proargnames=ARRAY['p_payload']::text[]) THEN RAISE EXCEPTION 'Ruolo backend/firma writer divergenti'; END IF;
 FOR x IN SELECT unnest(ARRAY['public.rapportini','public.rapportino_prestazioni','public.timbrature','public.operai','public.varianti_cantiere']) tabella LOOP
 IF has_table_privilege('artecna_rapportini_backend',x.tabella,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 OR has_any_column_privilege('artecna_rapportini_backend',x.tabella,'SELECT,INSERT,UPDATE,REFERENCES') THEN
 RAISE EXCEPTION 'Accesso diretto backend inatteso'; END IF;
 END LOOP;
 FOR x IN SELECT * FROM (VALUES
 ('artecna_rapportini.applica_prestazioni_rapportino(jsonb)',ARRAY['postgres'::regrole::oid,'artecna_rapportini_rpc'::regrole::oid]),
 ('artecna_rapportini.variante_del_cantiere(uuid,uuid)',ARRAY['postgres'::regrole::oid,'artecna_rapportini_rpc'::regrole::oid]),
 ('artecna_rapportini.proteggi_prestazione()',ARRAY['postgres'::regrole::oid])
 ) a(firma,ruoli) LOOP
 IF EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=to_regprocedure(x.firma) AND (a.is_grantable OR a.privilege_type<>'EXECUTE' OR NOT a.grantee=ANY(x.ruoli)))
 OR EXISTS(SELECT 1 FROM unnest(x.ruoli) r WHERE NOT EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=to_regprocedure(x.firma) AND a.grantee=r AND a.privilege_type='EXECUTE' AND NOT a.is_grantable)) THEN RAISE EXCEPTION 'ACL funzione divergente: %',x.firma; END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.rapportino_prestazioni'::regclass AND NOT tgisinternal)<>2
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.rapportino_prestazioni'::regclass AND tgname='rapportino_prestazioni_guardia' AND tgfoid='artecna_rapportini.proteggi_prestazione()'::regprocedure AND tgtype=31 AND tgenabled='O' AND tgqual IS NULL AND tgattr=''::int2vector)
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.rapportino_prestazioni'::regclass AND tgname='rapportino_prestazioni_costo_storico' AND tgfoid='artecna_rapportini.fotografa_costo()'::regprocedure AND tgtype=23 AND tgenabled='O' AND tgqual IS NULL AND tgattr=''::int2vector) THEN RAISE EXCEPTION 'Trigger Prestazioni divergenti'; END IF;
END;
$preflight$;
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

CREATE TEMP TABLE m23a_catalogo ON COMMIT DROP AS SELECT 'funzione'::text tipo,p.oid::text id,to_jsonb(p) metadata FROM pg_proc p WHERE pronamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace,'artecna_guardie'::regnamespace) AND p.oid<>'artecna_rapportini.applica_prestazioni_rapportino(jsonb)'::regprocedure
 UNION ALL SELECT 'trigger',t.oid::text,to_jsonb(t) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'vincolo',c.oid::text,to_jsonb(c) FROM pg_constraint c WHERE connamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'colonna',a.attrelid::text||':'||a.attnum::text,to_jsonb(a) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'default',d.oid::text,to_jsonb(d) FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid WHERE c.relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'indice',i.indexrelid::text,to_jsonb(i) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE c.relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'tabella',c.oid::text,jsonb_build_object('owner',c.relowner,'acl',c.relacl,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) FROM pg_class c WHERE c.relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'policy',p.oid::text,to_jsonb(p) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'schema',n.oid::text,to_jsonb(n) FROM pg_namespace n WHERE n.oid IN ('public'::regnamespace,'artecna_rapportini'::regnamespace,'artecna_guardie'::regnamespace)
 UNION ALL SELECT 'ruolo',r.oid::text,to_jsonb(r) FROM pg_roles r WHERE rolname IN ('postgres','artecna_rapportini_rpc','artecna_rapportini_backend','anon','authenticated','service_role');
CREATE TEMP TABLE m23a_writer ON COMMIT DROP AS SELECT to_jsonb(p)-'prosrc' metadata FROM pg_proc p WHERE oid='artecna_rapportini.applica_prestazioni_rapportino(jsonb)'::regprocedure;
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

ALTER FUNCTION artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid) OWNER TO postgres;
DO $acl$
DECLARE g record;
BEGIN
 REVOKE ALL ON FUNCTION artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid) FROM PUBLIC;
 FOR g IN SELECT DISTINCT a.grantee FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.oid='artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid)'::regprocedure AND a.grantee<>p.proowner AND a.grantee<>0 LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid) FROM %I',pg_get_userbyid(g.grantee)); END LOOP;
END;
$acl$;
GRANT EXECUTE ON FUNCTION artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid) TO artecna_rapportini_rpc;
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

DO $postcheck$
DECLARE baseline record;
BEGIN
 SELECT * INTO baseline FROM pg_proc WHERE oid=to_regprocedure('artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid)');
 IF NOT FOUND OR baseline.proowner<>'postgres'::regrole OR NOT baseline.prosecdef OR baseline.provolatile<>'v' OR baseline.prokind<>'f' OR baseline.proretset OR baseline.pronargdefaults<>0
 OR baseline.proargnames IS DISTINCT FROM ARRAY['p_variante','p_cantiere']::text[]
 OR baseline.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql') OR baseline.prorettype<>'void'::regtype
 OR baseline.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[]
 OR position(chr(13) IN replace(baseline.prosrc,chr(13)||chr(10),chr(10)))>0
 OR encode(sha256(convert_to(replace(baseline.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex')<>'f5018264d912ea9785b08b788d18e1201145671a172ebcfb36818d6320f7d016' THEN RAISE EXCEPTION 'Helper finale divergente'; END IF;
 IF EXISTS(SELECT 1 FROM aclexplode(coalesce(baseline.proacl,acldefault('f',baseline.proowner))) a WHERE a.is_grantable OR a.privilege_type<>'EXECUTE' OR a.grantee NOT IN ('postgres'::regrole,'artecna_rapportini_rpc'::regrole))
 OR EXISTS(SELECT 1 FROM unnest(ARRAY['postgres'::regrole::oid,'artecna_rapportini_rpc'::regrole::oid]) r WHERE NOT EXISTS(SELECT 1 FROM aclexplode(baseline.proacl) a WHERE a.grantee=r AND a.privilege_type='EXECUTE' AND NOT a.is_grantable)) THEN RAISE EXCEPTION 'ACL helper divergenti'; END IF;
 SELECT * INTO baseline FROM pg_proc WHERE oid='artecna_rapportini.applica_prestazioni_rapportino(jsonb)'::regprocedure;
 IF (to_jsonb(baseline)-'prosrc') IS DISTINCT FROM (SELECT metadata FROM m23a_writer)
 OR position(chr(13) IN replace(baseline.prosrc,chr(13)||chr(10),chr(10)))>0
 OR encode(sha256(convert_to(replace(baseline.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex')<>'e9fa405954943ab75d7f69bb1b53a21b89b60566f0c96c70daa82dc14d95c4ce' THEN RAISE EXCEPTION 'Writer finale divergente'; END IF;
 IF EXISTS((SELECT * FROM m23a_catalogo EXCEPT SELECT * FROM (SELECT 'funzione'::text tipo,p.oid::text id,to_jsonb(p) metadata FROM pg_proc p WHERE pronamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace,'artecna_guardie'::regnamespace) AND p.oid<>'artecna_rapportini.applica_prestazioni_rapportino(jsonb)'::regprocedure
 UNION ALL SELECT 'trigger',t.oid::text,to_jsonb(t) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'vincolo',c.oid::text,to_jsonb(c) FROM pg_constraint c WHERE connamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'colonna',a.attrelid::text||':'||a.attnum::text,to_jsonb(a) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'default',d.oid::text,to_jsonb(d) FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid WHERE c.relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'indice',i.indexrelid::text,to_jsonb(i) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE c.relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'tabella',c.oid::text,jsonb_build_object('owner',c.relowner,'acl',c.relacl,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) FROM pg_class c WHERE c.relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'policy',p.oid::text,to_jsonb(p) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'schema',n.oid::text,to_jsonb(n) FROM pg_namespace n WHERE n.oid IN ('public'::regnamespace,'artecna_rapportini'::regnamespace,'artecna_guardie'::regnamespace)
 UNION ALL SELECT 'ruolo',r.oid::text,to_jsonb(r) FROM pg_roles r WHERE rolname IN ('postgres','artecna_rapportini_rpc','artecna_rapportini_backend','anon','authenticated','service_role')) s)
 UNION ALL (SELECT * FROM (SELECT 'funzione'::text tipo,p.oid::text id,to_jsonb(p) metadata FROM pg_proc p WHERE pronamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace,'artecna_guardie'::regnamespace) AND p.oid<>'artecna_rapportini.applica_prestazioni_rapportino(jsonb)'::regprocedure
 UNION ALL SELECT 'trigger',t.oid::text,to_jsonb(t) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'vincolo',c.oid::text,to_jsonb(c) FROM pg_constraint c WHERE connamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'colonna',a.attrelid::text||':'||a.attnum::text,to_jsonb(a) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'default',d.oid::text,to_jsonb(d) FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid WHERE c.relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'indice',i.indexrelid::text,to_jsonb(i) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE c.relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'tabella',c.oid::text,jsonb_build_object('owner',c.relowner,'acl',c.relacl,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) FROM pg_class c WHERE c.relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'policy',p.oid::text,to_jsonb(p) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace)
 UNION ALL SELECT 'schema',n.oid::text,to_jsonb(n) FROM pg_namespace n WHERE n.oid IN ('public'::regnamespace,'artecna_rapportini'::regnamespace,'artecna_guardie'::regnamespace)
 UNION ALL SELECT 'ruolo',r.oid::text,to_jsonb(r) FROM pg_roles r WHERE rolname IN ('postgres','artecna_rapportini_rpc','artecna_rapportini_backend','anon','authenticated','service_role')) s WHERE NOT (tipo='funzione' AND id='artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid)'::regprocedure::oid::text) EXCEPT SELECT * FROM m23a_catalogo)) THEN RAISE EXCEPTION 'Catalogo storico modificato'; END IF;
END;
$postcheck$;
COMMIT;
