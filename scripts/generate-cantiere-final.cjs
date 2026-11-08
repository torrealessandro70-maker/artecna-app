/* eslint-disable @typescript-eslint/no-require-imports */
// Offline only: the certified schema fixture plus migrations 001–007 are the inputs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {withNative}=require('../supabase/validators/cantiere-prerequisiti/native.cjs');
const root=path.resolve(__dirname,'..'),output=path.join(root,'supabase/migrations/20261108000800_cantiere_hard_delete_finale.sql');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const direct=['cantieri','rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere','economia_raccolte','memoria_prezzi'];
const variant=['variante_lavorazioni','variante_documenti','variante_sorgenti','variante_fonti_memory','variante_fonti_visive','variante_osservatore_analisi'];
const predicates=Object.fromEntries(direct.map(t=>['public.'+t,t==='cantieri'?'t.id=cid':'t.cantiere_id=cid']));
for(const t of variant)predicates['public.'+t]='t.variante_id IN (SELECT id FROM public.varianti_cantiere WHERE cantiere_id=cid)';
for(const t of ['economia_righe','economia_sorgenti'])predicates['public.'+t]='t.raccolta_id IN (SELECT id FROM public.economia_raccolte WHERE cantiere_id=cid)';
for(const t of ['public.rapportino_prestazioni','public.rapportino_materiali','artecna_rapportini.richieste'])predicates[t]='t.rapportino_id IN (SELECT id FROM public.rapportini WHERE cantiere_id=cid)';
predicates['artecna_rapportini.allegati']='t.cantiere_id=cid';
predicates['artecna_rapportini.f3c3_capability']='t.foto_id IN (SELECT id FROM public.foto_cantiere WHERE cantiere_id=cid) OR t.allegato_id IN (SELECT id FROM artecna_rapportini.allegati WHERE cantiere_id=cid)';
const order=['artecna_rapportini.richieste','public.sal_lavorazioni','public.variante_fonti_memory','public.variante_fonti_visive','public.variante_osservatore_analisi','public.variante_documenti','public.variante_lavorazioni','public.variante_sorgenti','public.economia_righe','public.economia_sorgenti','public.economia_raccolte','public.timbrature','public.rapportino_materiali','public.rapportino_prestazioni','artecna_rapportini.f3c3_capability','artecna_rapportini.allegati','public.foto_cantiere','public.rapportini','public.preventivo_lavorazioni','public.preventivi_cantiere','public.varianti_cantiere','public.materiali_cantiere','public.attrezzi_cantiere','public.pagamenti_fornitori','public.acconti_cantiere','public.incassi_non_fatturati','public.memoria_prezzi'];
// Only these legal rows may be changed by the installed detach contract.
const legal={
 'public.fatture_emesse':'t.cantiere_id=cid',
 'public.fatture_fornitori_righe':'t.cantiere_id=cid',
 'public.fornitori_rettifiche':"t.cantiere_id=cid OR t.economia_riga_id IN (SELECT e.id FROM public.economia_righe e JOIN public.economia_raccolte r ON r.id=e.raccolta_id WHERE r.cantiere_id=cid) OR t.materiale_cantiere_id IN (SELECT id FROM public.materiali_cantiere WHERE cantiere_id=cid)",
 'artecna_contabilita.attribuzioni_clienti':'t.cantiere_id=cid',
 'artecna_guardie.fatture_classificazione_richieste':"t.payload::text ~* cid::text OR t.risultato::text ~* cid::text",
 'public.agenda_attivita':"t.collegamento->>'tipo'='cantiere' AND t.collegamento->>'id'=cid::text",
 'artecna_contabilita.archivio_quote':'true',
 'artecna_contabilita.archivio_attribuzioni':'true'
};
const sqlCatalog=`SELECT md5(coalesce(string_agg(x,'' ORDER BY x COLLATE "C"),'')) FROM (
 SELECT 'c:'||n.nspname||'.'||c.relname||':'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull x FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped WHERE c.relkind='r' AND (n.nspname='public' OR n.nspname LIKE 'artecna_%') AND c.relname NOT LIKE 'hard_delete_%'
 UNION ALL SELECT 'f:'||k.conrelid::regclass::text||':'||k.conname||':'||pg_get_constraintdef(k.oid)||':'||k.convalidated FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE k.contype IN ('f','p','u','c') AND (n.nspname='public' OR n.nspname LIKE 'artecna_%') AND c.relname NOT LIKE 'hard_delete_%'
 UNION ALL SELECT 't:'||t.tgrelid::regclass::text||':'||pg_get_triggerdef(t.oid)||':'||t.tgenabled::text||':'||md5(p.prosrc) FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND (n.nspname='public' OR n.nspname LIKE 'artecna_%')
 UNION ALL SELECT 'p:'||n.nspname||'.'||p.proname||':'||pg_get_function_identity_arguments(p.oid)||':'||md5(p.prosrc)||':'||p.prosecdef||':'||coalesce(p.proconfig::text,'') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='public' OR n.nspname LIKE 'artecna_%') AND p.proname NOT LIKE 'hard_delete_%'
) s`;
withNative(async db=>{
 const query=async(s,p)=>(await db.query(s,p)).rows;
 await query('SET search_path=pg_catalog,pg_temp');
 const baselineHash=(await query(sqlCatalog))[0].md5;
 const tables=(await query("SELECT n.nspname||'.'||c.relname tab FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND (n.nspname='public' OR n.nspname IN ('artecna_rapportini','artecna_contabilita','artecna_guardie')) ORDER BY 1")).map(x=>x.tab);
 const pk={};for(const tab of tables)pk[tab]=(await query("SELECT a.attname FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(n,o) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.n WHERE c.conrelid=$1::regclass AND c.contype='p' ORDER BY k.o",[tab])).map(x=>x.attname);
 for(const tab of Object.keys(predicates))assert(pk[tab]?.length,tab);
 const key=(tab,alias='t')=>`jsonb_build_object(${pk[tab].flatMap(k=>[quote(k),`${alias}."${k}"`]).join(',')})`;
 const list=(tab,pred)=>`SELECT coalesce(jsonb_agg(${key(tab)} ORDER BY ${key(tab)}::text),'[]') FROM ${tab} t WHERE ${pred}`;
 let sql=`-- Final canonical hard delete. Prepared locally; no Production execution.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
DO $$ BEGIN IF current_user<>'postgres' THEN RAISE EXCEPTION 'Installer inatteso'; END IF; END $$;
CREATE FUNCTION artecna_distruzione.hard_delete_catalog() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $catalog$ ${sqlCatalog} $catalog$;
DO $$ BEGIN IF artecna_distruzione.hard_delete_catalog() IS DISTINCT FROM '${baselineHash}' THEN RAISE EXCEPTION 'Catalogo certificato 001-007 divergente' USING ERRCODE='P2113'; END IF; END $$;
CREATE TABLE artecna_distruzione.hard_delete_catalog_expected (signature text NOT NULL);
-- Transient identity-only plan: serialized PKs, never a file/JSON source domain.
CREATE TABLE artecna_distruzione.hard_delete_plan (tx xid8 NOT NULL,backend integer NOT NULL,cantiere uuid NOT NULL,targets text NOT NULL CHECK(jsonb_typeof(targets::jsonb)='object'),PRIMARY KEY(tx,backend));
ALTER TABLE artecna_distruzione.hard_delete_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE artecna_distruzione.hard_delete_catalog_expected ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION artecna_distruzione.hard_delete_owned(tab text,j jsonb) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM artecna_distruzione.hard_delete_plan p CROSS JOIN LATERAL jsonb_array_elements(coalesce(p.targets::jsonb->tab,'[]')) k
 WHERE p.tx=pg_current_xact_id_if_assigned() AND p.backend=pg_backend_pid() AND p.cantiere=artecna_distruzione.target_prerequisiti()
 AND artecna_distruzione.contesto_valido(p.cantiere) AND j @> k.value)
$$;
CREATE FUNCTION artecna_distruzione.hard_delete_targets(cid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE result jsonb:='{}'; BEGIN
${Object.entries(predicates).map(([tab,p])=>`result:=result||jsonb_build_object(${quote(tab)},(${list(tab,p)}));`).join('\n')}
${Object.entries(legal).map(([tab,p])=>`result:=result||jsonb_build_object(${quote('keep:'+tab)},(${list(tab,p)}));`).join('\n')}
RETURN result; END $$;
CREATE FUNCTION artecna_distruzione.hard_delete_lock(cid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ BEGIN
 IF artecna_distruzione.target_prerequisiti() IS DISTINCT FROM cid THEN RAISE EXCEPTION 'Contesto autorizzato assente' USING ERRCODE='42501'; END IF;
 LOCK TABLE ${tables.sort().join(',')} IN SHARE ROW EXCLUSIVE MODE;
END $$;
CREATE OR REPLACE FUNCTION artecna_distruzione.manifest_cantiere(p_cantiere uuid) RETURNS TABLE(entita text,quantita bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET row_security=off AS $$ BEGIN
 IF artecna_distruzione.contesto_valido(p_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Contesto assente' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT key,jsonb_array_length(value)::bigint FROM jsonb_each(artecna_distruzione.hard_delete_targets(p_cantiere)) WHERE key NOT LIKE 'keep:%' ORDER BY key;
END $$;
CREATE FUNCTION artecna_distruzione.hard_delete_blockers(cid uuid) RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE blockers text[]:='{}';legacy_source record;legacy_row record;ids uuid[];target_name text;targets jsonb;fk record;joins text;bad boolean; BEGIN
 IF artecna_distruzione.hard_delete_catalog() IS DISTINCT FROM (SELECT signature FROM artecna_distruzione.hard_delete_catalog_expected) THEN RETURN ARRAY['catalogo']; END IF;
 SELECT nome INTO target_name FROM public.cantieri WHERE id=cid;
 FOR legacy_source IN SELECT * FROM artecna_distruzione.legacy_sorgenti ORDER BY tabella LOOP
  FOR legacy_row IN EXECUTE format('SELECT to_jsonb(t) j FROM %s t WHERE cantiere_id IS NULL',legacy_source.relation) LOOP
   ids:=artecna_distruzione.legacy_derivazione(legacy_source.tabella,legacy_row.j);
   IF cid=ANY(ids) OR (cardinality(ids)=0 AND legacy_row.j->>'cantiere'=target_name) THEN blockers:=array_append(blockers,'legacy_ambiguo');EXIT; END IF;
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM artecna_distruzione.legacy_da_risolvere WHERE approved_cantiere=cid) THEN blockers:=array_append(blockers,'legacy_ambiguo'); END IF;
 IF EXISTS(SELECT 1 FROM artecna_rapportini.allegati WHERE cantiere_id=cid AND lease_until>clock_timestamp()) THEN blockers:=array_append(blockers,'upload_in_corso'); END IF;
 -- Concordance of every populated ownership path, including logical non-FK edges.
 IF EXISTS(SELECT 1 FROM artecna_rapportini.allegati a JOIN public.rapportini r ON r.id=a.rapportino_id WHERE (a.cantiere_id=cid OR r.cantiere_id=cid) AND a.cantiere_id IS DISTINCT FROM r.cantiere_id)
 OR EXISTS(SELECT 1 FROM public.foto_cantiere f JOIN public.rapportini r ON r.id::text=f.rapportino_id WHERE (f.cantiere_id=cid OR r.cantiere_id=cid) AND f.cantiere_id IS DISTINCT FROM r.cantiere_id)
 OR EXISTS(SELECT 1 FROM public.timbrature t JOIN public.rapportini r ON r.id=t.rapportino_id WHERE (t.cantiere_id=cid OR r.cantiere_id=cid) AND t.cantiere_id IS DISTINCT FROM r.cantiere_id)
 OR EXISTS(SELECT 1 FROM public.rapportino_prestazioni p JOIN public.rapportini r ON r.id=p.rapportino_id JOIN public.varianti_cantiere v ON v.id=p.variante_id WHERE (r.cantiere_id=cid OR v.cantiere_id=cid) AND r.cantiere_id IS DISTINCT FROM v.cantiere_id)
 OR EXISTS(SELECT 1 FROM public.variante_sorgenti s JOIN public.varianti_cantiere v ON v.id=s.variante_id JOIN public.economia_raccolte e ON e.id=s.economia_raccolta_id WHERE (v.cantiere_id=cid OR e.cantiere_id=cid) AND v.cantiere_id IS DISTINCT FROM e.cantiere_id)
 THEN blockers:=array_append(blockers,'ownership_discordante'); END IF;
 targets:=artecna_distruzione.hard_delete_targets(cid);
 FOR fk IN SELECT k.*,k.conrelid::regclass::text child,k.confrelid::regclass::text parent FROM pg_constraint k WHERE k.contype='f' AND targets ? k.confrelid::regclass::text LOOP
  SELECT string_agg(format('f.%I=p.%I',a.attname,b.attname),' AND ' ORDER BY u.o) INTO joins FROM unnest(fk.conkey,fk.confkey) WITH ORDINALITY u(a,b,o) JOIN pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=u.a JOIN pg_attribute b ON b.attrelid=fk.confrelid AND b.attnum=u.b;
  IF targets ? fk.child THEN
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s f JOIN %s p ON %s WHERE EXISTS(SELECT 1 FROM jsonb_array_elements($1->$2) k WHERE to_jsonb(p) @> k.value) IS DISTINCT FROM EXISTS(SELECT 1 FROM jsonb_array_elements($1->$3) k WHERE to_jsonb(f) @> k.value))',fk.conrelid::regclass,fk.confrelid::regclass,joins) INTO bad USING targets,fk.parent,fk.child;
  ELSIF fk.child IN ('public.fornitori_rettifiche','public.fatture_emesse','public.fatture_fornitori_righe','artecna_contabilita.attribuzioni_clienti','artecna_distruzione.contesto','artecna_distruzione.contesto_prerequisiti','artecna_distruzione.quote_da_eliminare') THEN CONTINUE;
  ELSE
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s f JOIN %s p ON %s WHERE EXISTS(SELECT 1 FROM jsonb_array_elements($1->$2) k WHERE to_jsonb(p) @> k.value))',fk.conrelid::regclass,fk.confrelid::regclass,joins) INTO bad USING targets,fk.parent;
  END IF;
  IF bad THEN blockers:=array_append(blockers,'relazione_esterna');EXIT;END IF;
 END LOOP;
 RETURN blockers; END $$;
CREATE OR REPLACE FUNCTION artecna_distruzione.inizia_contesto(p_cantiere uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET row_security=off AS $$
BEGIN
 IF artecna_distruzione.target_prerequisiti() IS DISTINCT FROM p_cantiere THEN RAISE EXCEPTION 'Contesto autorizzato assente' USING ERRCODE='42501'; END IF;
 INSERT INTO artecna_distruzione.contesto(transazione,backend,cantiere_id,user_id,ruolo) VALUES(pg_current_xact_id(),pg_backend_pid(),p_cantiere,artecna_guardie.utente_jwt_corrente(),'artecna_cantieri_delete_rpc');
END $$;
`;
 // Preserve every original guard body; add only DELETE permission for rows in the
 // frozen, private tx/backend/JWT-owner plan. No INSERT or arbitrary UPDATE bypass.
 const patches=['public.proteggi_provenienza_economia_rapportino()','artecna_rapportini.proteggi_prestazione()','artecna_rapportini.proteggi_strutturato()','artecna_rapportini.proteggi_materiale()','artecna_rapportini.materiali_fail_closed()','artecna_guardie.proteggi_ponte_economia()','artecna_rapportini.f3c3_guardia_foto()'];
 for(const sig of patches){
  const p=(await query('SELECT pg_get_functiondef(oid) def,prosrc FROM pg_proc WHERE oid=$1::regprocedure',[sig]))[0];
  let extra="\n IF TG_OP='DELETE' THEN IF current_user IN ('postgres','artecna_cantieri_delete_rpc') THEN IF artecna_distruzione.hard_delete_owned(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,to_jsonb(OLD)) THEN RETURN OLD; END IF; END IF; END IF;\n";
  if(sig.includes('f3c3_guardia_foto'))extra+=` IF TG_OP='UPDATE' AND NEW.allegato_v1_id IS NULL AND (to_jsonb(NEW)-'allegato_v1_id') IS NOT DISTINCT FROM (to_jsonb(OLD)-'allegato_v1_id') AND artecna_distruzione.hard_delete_owned('public.foto_cantiere',to_jsonb(OLD)) THEN RETURN NEW; END IF;\n`;
  const def=p.def.replace(/\bBEGIN\b/,m=>m+extra);assert.notEqual(def,p.def);sql+=def+';\n';
 }
 // Composite keys, full pre-mutation identities and unrelated row fingerprints.
 sql+=`CREATE FUNCTION artecna_distruzione.hard_delete_preserved(cid uuid,targets jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE result jsonb:='{}'; BEGIN
${tables.map(tab=>{
  const exclude=tab.startsWith('artecna_contabilita.archivio_')?`EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->${quote('keep:'+tab)},'[]')) k WHERE to_jsonb(t) @> k.value)`:predicates[tab]?`NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->${quote(tab)},'[]')) k WHERE to_jsonb(t) @> k.value)`:legal[tab]?`NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->${quote('keep:'+tab)},'[]')) k WHERE to_jsonb(t) @> k.value)`:'true';
 return `result:=result||jsonb_build_object(${quote(tab)},(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) FROM ${tab} t WHERE ${exclude}));`;
 }).join('\n')}
RETURN result;END $$;
`;
 // Add internal exclusion keys for legal changes; same identities excluded both
 // before and after detach, never re-derived from vanished ownership columns.
 // Extend OUT fields while keeping the canonical input signature and legacy
 // columns. DROP is RESTRICT: an unexpected database dependency stops migration.
 sql+=`DROP FUNCTION public.elimina_cantiere_definitivamente(uuid,text);
CREATE FUNCTION public.elimina_cantiere_definitivamente(p_cantiere_id uuid,p_conferma text)
RETURNS TABLE(cantiere_id uuid,eliminato boolean,storage_nuovi bigint,conteggi jsonb,storage_jobs_created bigint,storage_objects_preserved_shared bigint,legal_records_preserved bigint,legacy_resolved_deleted bigint,manifest_fingerprint text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cid uuid:=p_cantiere_id;targets jsonb;preserved jsonb;after_keep jsonb;blockers text[];tab text;n bigint;expected bigint;total bigint;oldmax bigint;objects jsonb;shared bigint;legal_count bigint;legacy_count bigint;
BEGIN
 IF current_user<>'artecna_cantieri_delete_rpc' OR cid IS NULL OR p_conferma IS DISTINCT FROM 'ELIMINA' THEN RAISE EXCEPTION 'UUID e conferma esatta ELIMINA obbligatori' USING ERRCODE='P2111'; END IF;
 PERFORM artecna_distruzione.apri_contesto_prerequisiti(cid,p_conferma);
 -- Coarse, deterministic locks protect logical links without FK as well as FK
 -- links. Do not replace with root locks alone. No network I/O under these locks.
 PERFORM artecna_distruzione.hard_delete_lock(cid);
 blockers:=artecna_distruzione.hard_delete_blockers(cid);
 IF cardinality(blockers)>0 THEN RAISE EXCEPTION 'Hard delete bloccato: %',array_to_string(blockers,', ') USING ERRCODE='P2113'; END IF;
 PERFORM artecna_distruzione.inizia_contesto(cid);
 targets:=artecna_distruzione.hard_delete_targets(cid);
 INSERT INTO artecna_distruzione.hard_delete_plan VALUES(pg_current_xact_id(),pg_backend_pid(),cid,targets::text);
 preserved:=artecna_distruzione.hard_delete_preserved(cid,targets);
 SELECT coalesce(max(id),0) INTO oldmax FROM artecna_distruzione.cleanup_storage;
 SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('bucket',r.bucket,'path',r.path)),'[]') INTO objects FROM artecna_distruzione.storage_riferimenti r
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->r.source_table,'[]')) k WHERE r.source_id=k.value);
 -- Prepare exclusive keys BEFORE source DELETE. A live reference outside the
 -- frozen target set preserves the object. Existing jobs are never overwritten.
 INSERT INTO artecna_distruzione.cleanup_storage(cantiere_id,bucket,path)
 SELECT cid,o->>'bucket',o->>'path' FROM jsonb_array_elements(objects) o WHERE NOT EXISTS(
 SELECT 1 FROM artecna_distruzione.storage_riferimenti r WHERE r.bucket=o->>'bucket' AND r.path=o->>'path'
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(targets->r.source_table,'[]')) k WHERE r.source_id=k.value)) ON CONFLICT DO NOTHING;
 SELECT coalesce(sum(jsonb_array_length(value)),0) INTO legal_count FROM jsonb_each(targets) WHERE key IN ('keep:public.fornitori_rettifiche','keep:public.fatture_emesse','keep:public.fatture_fornitori_righe','keep:artecna_contabilita.attribuzioni_clienti');
 SELECT coalesce(sum(jsonb_array_length(targets->tabella)),0) INTO legacy_count FROM artecna_distruzione.legacy_sorgenti;
 PERFORM artecna_distruzione.detach_contabile_cantiere();
 UPDATE public.agenda_attivita SET collegamento=NULL WHERE collegamento->>'tipo'='cantiere' AND collegamento->>'id'=cid::text;
 UPDATE public.cantieri SET preventivo_contrattuale_id=NULL WHERE id=cid AND preventivo_contrattuale_id IS NOT NULL;
 UPDATE public.foto_cantiere f SET allegato_v1_id=NULL WHERE f.cantiere_id=cid AND f.allegato_v1_id IS NOT NULL;
 conteggi:='{}';
${order.flatMap(tab=>tab==='public.preventivi_cantiere'?['@integrativi']:tab==='public.varianti_cantiere'?[tab,'public.preventivi_cantiere']:[tab]).map(entry=>{
 const tab=entry==='@integrativi'?'public.preventivi_cantiere':entry;
 const self=tab==='public.variante_lavorazioni'?`AND NOT EXISTS(SELECT 1 FROM public.variante_lavorazioni r WHERE r.riferimento_variante_lavorazione_id=t.id)`:tab==='public.preventivi_cantiere'?`AND NOT EXISTS(SELECT 1 FROM public.preventivi_cantiere r WHERE r.preventivo_contrattuale_id=t.id)`:'';
 return `total:=${tab==='public.preventivi_cantiere'&&entry!=='@integrativi'?"coalesce((conteggi->>'public.preventivi_cantiere')::bigint,0)":'0'}; LOOP
 DELETE FROM ${tab} t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->${quote(tab)}) k WHERE ${key(tab)}=k.value) ${self} ${entry==='@integrativi'?"AND t.natura='integrativo'":''};
 GET DIAGNOSTICS n=ROW_COUNT;total:=total+n;EXIT WHEN n=0;END LOOP;
 expected:=jsonb_array_length(targets->${quote(tab)});${entry==='@integrativi'?'':`IF total<>expected THEN RAISE EXCEPTION 'Delete/manifest divergente: ${tab}' USING ERRCODE='P2114'; END IF;`}
 conteggi:=conteggi||jsonb_build_object(${quote(tab)},total);`;
 }).join('\n')}
 -- Source triggers may enqueue candidates with remaining global references.
 -- Remove only NEW jobs created in this transaction for those shared objects;
 -- preserve every pre-existing job. No destructive shared job is committed.
 SELECT count(*) INTO shared FROM jsonb_array_elements(objects) o WHERE EXISTS(SELECT 1 FROM artecna_distruzione.storage_riferimenti r WHERE r.bucket=o->>'bucket' AND r.path=o->>'path');
 DELETE FROM artecna_distruzione.cleanup_storage j WHERE j.id>oldmax AND EXISTS(SELECT 1 FROM artecna_distruzione.storage_riferimenti r WHERE r.bucket=j.bucket AND r.path=j.path);
 SELECT count(*) INTO storage_nuovi FROM artecna_distruzione.cleanup_storage WHERE id>oldmax;
 IF EXISTS(SELECT 1 FROM artecna_distruzione.quote_da_eliminare x WHERE x.cantiere_id=cid) OR EXISTS(SELECT 1 FROM public.fornitori_rettifiche x WHERE x.cantiere_id=cid) OR EXISTS(SELECT 1 FROM artecna_contabilita.attribuzioni_clienti x WHERE x.cantiere_id=cid) THEN RAISE EXCEPTION 'Detach residuo' USING ERRCODE='P2114'; END IF;
 PERFORM artecna_distruzione.termina_contesto();
 PERFORM artecna_distruzione.chiudi_contesto_prerequisiti();
 DELETE FROM artecna_distruzione.hard_delete_plan WHERE tx=pg_current_xact_id() AND backend=pg_backend_pid();
 DELETE FROM public.utenti_cantiere WHERE utenti_cantiere.cantiere_id=cid;
 DELETE FROM public.cantieri WHERE id=cid;GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Root residuo' USING ERRCODE='P2114'; END IF;
 -- Verify AFTER every mutation, by SAVED keys, independently of vanished parents.
${Object.keys(predicates).map(tab=>`IF EXISTS(SELECT 1 FROM ${tab} t WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(targets->${quote(tab)}) k WHERE ${key(tab)}=k.value)) THEN RAISE EXCEPTION 'Identita residua: ${tab}' USING ERRCODE='P2114'; END IF;`).join('\n')}
 after_keep:=artecna_distruzione.hard_delete_preserved(cid,targets);
 IF preserved IS DISTINCT FROM after_keep THEN RAISE EXCEPTION 'Dati estranei/shared modificati' USING ERRCODE='P2114',DETAIL=(SELECT string_agg(key,', ' ORDER BY key) FROM jsonb_each(preserved) WHERE value IS DISTINCT FROM after_keep->key); END IF;
 conteggi:=conteggi||jsonb_build_object('storage_jobs_created',storage_nuovi,'storage_objects_preserved_shared',shared,'legal_records_preserved',legal_count,'legacy_resolved_deleted',legacy_count,'manifest_fingerprint',md5(targets::text),'public.cantieri',1,'public.utenti_cantiere',jsonb_array_length(targets->'public.utenti_cantiere'));
 storage_jobs_created:=storage_nuovi;storage_objects_preserved_shared:=shared;legal_records_preserved:=legal_count;legacy_resolved_deleted:=legacy_count;manifest_fingerprint:=md5(targets::text);
 cantiere_id:=cid;eliminato:=true;RETURN NEXT;
END $$;
ALTER FUNCTION public.elimina_cantiere_definitivamente(uuid,text) OWNER TO artecna_cantieri_delete_rpc;
REVOKE ALL ON FUNCTION public.elimina_cantiere_definitivamente(uuid,text) FROM PUBLIC,anon,service_role;
REVOKE DELETE ON public.cantieri FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.elimina_cantiere_definitivamente(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.preflight_eliminazione_cantiere(p_cantiere_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE b text[];result jsonb; BEGIN
 IF artecna_guardie.utente_jwt_corrente() IS NULL OR NOT EXISTS(SELECT 1 FROM public.cantieri c JOIN public.utenti_cantiere u ON u.cantiere_id=c.id WHERE c.id=p_cantiere_id AND u.user_id=artecna_guardie.utente_jwt_corrente() AND u.ruolo='owner') THEN RAISE EXCEPTION 'Accesso negato' USING ERRCODE='42501'; END IF;
 b:=artecna_distruzione.hard_delete_blockers(p_cantiere_id);
 result:=jsonb_build_object('versione',1,'entita','cantiere','id',p_cantiere_id,'stato',CASE WHEN cardinality(b)=0 THEN 'eliminabile' ELSE 'bloccato' END,'verifica_completa',true,'categorie',CASE WHEN cardinality(b)=0 THEN '[]'::jsonb ELSE '["altri_collegamenti"]'::jsonb END,'azione_consigliata',CASE WHEN cardinality(b)=0 THEN 'conferma_eliminazione' ELSE 'segna_concluso' END,'blockers',to_jsonb(b),'verificato_at',statement_timestamp());
 RETURN result;
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function THEN RETURN jsonb_build_object('versione',1,'entita','cantiere','id',p_cantiere_id,'stato','non_verificabile','verifica_completa',false,'categorie','[]'::jsonb,'azione_consigliata','nessuna','verificato_at',statement_timestamp());END $$;
REVOKE ALL ON FUNCTION public.preflight_eliminazione_cantiere(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.preflight_eliminazione_cantiere(uuid) TO authenticated;
GRANT SELECT,INSERT,DELETE ON artecna_distruzione.hard_delete_plan TO artecna_cantieri_delete_rpc;
CREATE POLICY hard_delete_plan_rpc ON artecna_distruzione.hard_delete_plan TO artecna_cantieri_delete_rpc USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,DELETE ON artecna_distruzione.cleanup_storage TO artecna_cantieri_delete_rpc;
DO $$ BEGIN EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE %s TO artecna_cantieri_delete_rpc',pg_get_serial_sequence('artecna_distruzione.cleanup_storage','id')); END $$;
GRANT SELECT ON artecna_distruzione.storage_riferimenti,artecna_distruzione.legacy_sorgenti TO artecna_cantieri_delete_rpc;
GRANT SELECT,DELETE ON artecna_rapportini.allegati,artecna_rapportini.richieste,artecna_rapportini.f3c3_capability,public.rapportino_prestazioni,public.rapportino_materiali,public.memoria_prezzi TO artecna_cantieri_delete_rpc;
GRANT SELECT,UPDATE ON public.agenda_attivita TO artecna_cantieri_delete_rpc;
GRANT UPDATE(allegato_v1_id) ON public.foto_cantiere TO artecna_cantieri_delete_rpc;
GRANT SELECT ON public.fornitori_rettifiche,artecna_contabilita.attribuzioni_clienti TO artecna_cantieri_delete_rpc;
DO $acl$ DECLARE p record; BEGIN FOR p IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='artecna_distruzione'::regnamespace AND proname LIKE 'hard_delete_%' LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',p.sig);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO artecna_cantieri_delete_rpc',p.sig);
END LOOP;END $acl$;
REVOKE ALL ON artecna_distruzione.hard_delete_plan,artecna_distruzione.hard_delete_catalog_expected FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO artecna_distruzione.hard_delete_catalog_expected SELECT artecna_distruzione.hard_delete_catalog();
COMMIT;
`;
 fs.writeFileSync(output,sql);console.log(output);
}).catch(e=>{console.error(e);process.exitCode=1});
