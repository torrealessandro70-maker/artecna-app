/* eslint-disable @typescript-eslint/no-require-imports */
// Offline generator: isolated native PostgreSQL only. No configured DB/ENV reads.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {withNative}=require('../supabase/validators/cantiere-prerequisiti/native.cjs'),{certifiedInstallerFixture,identityQuery}=require('../supabase/validators/cantiere-prerequisiti/installerBaseline.cjs');
const root=path.resolve(__dirname,'..'),quote=s=>"'"+s.replaceAll("'","''")+"'",md5=s=>crypto.createHash('md5').update(s).digest('hex');
function arg(line){const at=line.indexOf('(SELECT ');assert(at>=0);let d=1,s=false,q=false;for(let i=at+1;i<line.length;i++){const c=line[i];if(s){if(c==="'"){if(line[i+1]==="'")i++;else s=false;}continue;}if(q){if(c==='"'){if(line[i+1]==='"')i++;else q=false;}continue;}if(c==="'"){s=true;continue;}if(c==='"'){q=true;continue;}if(c==='(')d++;if(c===')'&&--d===0)return line.slice(at+1,i);}throw Error('Unbalanced query');}
const params=s=>s.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\b[a-z_][a-z_0-9]*\b/gi,t=>({cid:'$1',targets:'$2',scope:'$2',runtime_ids:'$3'})[t]||t);
withNative(async(db)=>{
 const q=async(s,p=[])=>(await db.query(s,p)).rows;
 for(const n of ['20261108000800_cantiere_hard_delete_finale.sql','20261108000900_cantiere_hard_delete_runtime_v2.sql'])await q(fs.readFileSync(path.join(root,'supabase/migrations',n),'utf8').replace(/\r\n/g,'\n'));
 const source=async s=>(await q('SELECT prosrc FROM pg_proc WHERE oid=$1::regprocedure',['artecna_distruzione.'+s]))[0].prosrc;
 const before={targets:await source('hard_delete_targets(uuid)'),shared:await source('hard_delete_shared_scope(uuid,jsonb)'),preserved:await source('hard_delete_preserved(uuid,jsonb)'),catalog:await source('hard_delete_catalog()')};
 const identity=(await q(identityQuery))[0].identity,baselineCatalog=(await q('SELECT artecna_distruzione.hard_delete_catalog() s'))[0].s;
 const helperQuery="SELECT jsonb_agg(jsonb_build_object('signature',oid::regprocedure::text,'md5',md5(prosrc),'owner',pg_get_userbyid(proowner),'secdef',prosecdef,'config',proconfig,'acl',proacl::text) ORDER BY oid::regprocedure::text COLLATE \"C\") FROM pg_proc WHERE pronamespace='artecna_distruzione'::regnamespace";
 const helpers=(await q(helperQuery))[0].jsonb_agg;
 const rows=[];let seq=0;
 // Shared expansion keeps the exact certified order and positive guard.
 const tail=before.shared.slice(before.shared.indexOf('BEGIN')+5,before.shared.lastIndexOf('RETURN scope;'));
 const sharedPattern=/(IF ([^;]*?) THEN )?SELECT coalesce\(jsonb_agg\(v ORDER BY v::text\),'\[\]'\) INTO ids FROM ([\s\S]*?);scope:=jsonb_set\(scope,ARRAY\['keep:shared:([^']+)'\],ids\);( END IF;)?/g;
 let match;while((match=sharedPattern.exec(tail))){const condition=match[2]||'true',query="SELECT coalesce(jsonb_agg(v ORDER BY v::text),'[]') FROM "+match[3],raw=match[3].match(/^\(SELECT DISTINCT v FROM \(([\s\S]+)\) z\) d$/);assert(raw);rows.push({kind:'shared',seq:++seq,label:match[4],guard:params('SELECT '+condition),query:params(query),batch:params(raw[1]),keys:[...new Set([...(match[2]?condition:query).matchAll(/scope->'([^']+)'/g)].map(m=>m[1]))],always:!match[2]});}assert.equal(seq,76);
 const residual=tail.replace(sharedPattern,'').trim();assert(residual.startsWith('IF EXISTS(')&&residual.includes('Logical edge non classificato'));
 // Preserved restricts and subtracts identities BEFORE fetching whole rows.
 seq=0;for(const line of before.preserved.split('\n').filter(l=>l.startsWith('IF jsonb_array_length('))){
  const label=line.match(/result:=result\|\|jsonb_build_object\('([^']+)'/)[1],query=arg(line),condition=line.slice(3,line.indexOf(' THEN '));
  const from=query.indexOf(' FROM (SELECT DISTINCT * FROM jsonb_to_recordset'),projection=query.slice(query.indexOf('SELECT md5((')+7,from),record=query.match(/AS k\(([^)]+)\)/)[1];
  const relevant=condition.slice('jsonb_array_length('.length,-3);assert(condition.endsWith(')>0'));
  const pk=record.split(',').map(x=>x.trim().match(/^"([^"]+)"/)[1]),keyFields=pk.map(k=>'k."'+k+'"').join(','),join=pk.map(k=>'t."'+k+'"=k."'+k+'"').join(' AND ');
  const exclusions=[...query.matchAll(/jsonb_to_recordset\((coalesce\(targets->'[^']+','\[\]'\))\) AS x\(/g)].map(m=>m[1]);
  // Projection CASE may mention keep identities as normalization, not exclusion.
  const where=query.slice(query.indexOf(' t ON ')+6);const excluded=exclusions.filter(e=>where.includes('jsonb_to_recordset('+e+') AS x('));
  const positive=`SELECT DISTINCT ${keyFields} FROM jsonb_to_recordset(${relevant}) AS k(${record})${[...new Set(excluded)].map(e=>` EXCEPT SELECT ${pk.map(k=>'x."'+k+'"').join(',')} FROM jsonb_to_recordset(${e}) AS x(${record})`).join('')}`;
  assert(projection.startsWith('md5(')&&projection.endsWith(' h'));
  const bounded=`WITH positive_keys AS MATERIALIZED (${positive}) SELECT jsonb_build_object('count',count(*),'digest',md5(coalesce(string_agg(h,'' ORDER BY h),''))) FROM positive_keys k CROSS JOIN LATERAL (SELECT ${projection} FROM ${label} t WHERE ${join} OFFSET 0) matched`;
  rows.push({kind:'preserved',seq:++seq,label,guard:params('SELECT '+condition),query:params(bounded),keys:[...new Set([...condition.matchAll(/targets->'([^']+)'/g)].map(m=>m[1]))],always:false});
 }assert.equal(seq,57);
 assert(rows.every(r=>r.keys.length>0));
 const metadata=`CREATE TABLE artecna_distruzione.hard_delete_runtime_queries(kind text NOT NULL,seq integer NOT NULL,label text NOT NULL,guard_sql text NOT NULL,query_sql text NOT NULL,input_keys text[] NOT NULL,always_emit boolean NOT NULL,batch_sql text NOT NULL,PRIMARY KEY(kind,seq),UNIQUE(kind,label,seq),CHECK(kind IN('shared','preserved')));
REVOKE ALL ON TABLE artecna_distruzione.hard_delete_runtime_queries FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO artecna_distruzione.hard_delete_runtime_queries VALUES ${rows.map(r=>'('+[quote(r.kind),r.seq,quote(r.label),quote(r.guard),quote(r.query),'ARRAY['+r.keys.map(quote).join(',')+']',r.always?'true':'false',quote(r.batch||'')].join(',')+')').join(',\n')};\n`;
 const batchEnd=rows.find(r=>r.kind==='shared'&&r.always).seq-1;assert(rows.filter(r=>r.kind==='shared'&&r.seq<=batchEnd).every(r=>!r.always));
 const shared=`CREATE OR REPLACE FUNCTION artecna_distruzione.hard_delete_shared_scope(cid uuid,scope jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $v3$
DECLARE item record;combined record;pieces text[]:='{}';labels text[]:='{}';enabled boolean;computed_ids jsonb;input_key text;BEGIN
IF (SELECT count(*) FROM artecna_distruzione.hard_delete_runtime_queries WHERE kind='shared')<>76 THEN RAISE EXCEPTION 'Shared metadata missing' USING ERRCODE='P2113';END IF;
FOR item IN SELECT * FROM artecna_distruzione.hard_delete_runtime_queries WHERE kind='shared' AND seq<=${batchEnd} ORDER BY seq LOOP
enabled:=false;FOREACH input_key IN ARRAY item.input_keys LOOP IF jsonb_array_length(coalesce(scope->input_key,'[]'))>0 THEN enabled:=true;EXIT;END IF;END LOOP;
IF enabled THEN pieces:=array_append(pieces,format('SELECT %L label,v value FROM (%s) candidates',item.label,item.batch_sql));labels:=array_append(labels,item.label);END IF;
END LOOP;
IF cardinality(pieces)>0 THEN
FOR combined IN EXECUTE 'WITH generated AS MATERIALIZED ('||array_to_string(pieces,' UNION ALL ')||'), unique_keys AS(SELECT DISTINCT label,value FROM generated) SELECT desired.label,coalesce(jsonb_agg(value ORDER BY value::text) FILTER(WHERE value IS NOT NULL),''[]''::jsonb) ids FROM (SELECT DISTINCT unnest($3::text[]) label) desired LEFT JOIN unique_keys USING(label) GROUP BY desired.label' USING cid,scope,labels LOOP scope:=jsonb_set(scope,ARRAY['keep:shared:'||combined.label],combined.ids);END LOOP;
END IF;
FOR item IN SELECT * FROM artecna_distruzione.hard_delete_runtime_queries WHERE kind='shared' AND seq>${batchEnd} ORDER BY seq LOOP
enabled:=false;FOREACH input_key IN ARRAY item.input_keys LOOP IF jsonb_array_length(coalesce(scope->input_key,'[]'))>0 THEN enabled:=true;EXIT;END IF;END LOOP;
IF enabled THEN EXECUTE item.query_sql INTO computed_ids USING cid,scope;scope:=jsonb_set(scope,ARRAY['keep:shared:'||item.label],computed_ids);ELSIF item.always_emit THEN scope:=jsonb_set(scope,ARRAY['keep:shared:'||item.label],'[]');END IF;
END LOOP;${residual}RETURN scope;END $v3$;\n`;
 const targetLines=before.targets.split('\n').filter(l=>l.startsWith("result:=result||jsonb_build_object('")&&l.includes('(SELECT '));const classification=targetLines.find(l=>l.includes("'keep:artecna_guardie.fatture_classificazione_richieste'"));assert(classification);
 const seeds=targetLines.filter(l=>l!==classification).map(l=>[l.match(/jsonb_build_object\('([^']+)'/)[1],arg(l)]);assert.equal(seeds.length,36);
 const classificationQuery=arg(classification).replaceAll('witness_ids','wids');
 const seedSet=seeds.map(([key,query])=>{const from=query.indexOf(' FROM '),projection=query.match(/jsonb_build_object\([^)]*\)/)[0];assert(from>7);return 'SELECT '+quote(key)+' label,'+projection+' k'+query.slice(from);}).join('\nUNION ALL\n');
 const targets=`CREATE OR REPLACE FUNCTION artecna_distruzione.hard_delete_targets(cid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $v3$
WITH key_rows AS MATERIALIZED(${seedSet}), grouped AS(SELECT label,jsonb_agg(k ORDER BY k::text) ids FROM key_rows GROUP BY label),seed AS MATERIALIZED(SELECT jsonb_object_agg(labels.label,coalesce(ids,'[]'::jsonb)) result,artecna_distruzione.ids_operativi(cid) runtime_ids FROM unnest(ARRAY[${seeds.map(([key])=>quote(key)).join(',')}]) labels(label) LEFT JOIN grouped USING(label)),
known AS MATERIALIZED(SELECT seed.*,ARRAY(SELECT DISTINCT x FROM(SELECT unnest(runtime_ids) x UNION ALL SELECT CASE WHEN r.value->>'id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (r.value->>'id')::uuid END FROM jsonb_each(result) e CROSS JOIN LATERAL jsonb_array_elements(e.value) r WHERE e.key NOT LIKE 'keep:%') ids WHERE x IS NOT NULL ORDER BY x) wids FROM seed)
SELECT artecna_distruzione.hard_delete_shared_scope(cid,result||jsonb_build_object('keep:runtime:ids',to_jsonb(runtime_ids),'keep:runtime:witness_ids',to_jsonb(wids),'keep:artecna_guardie.fatture_classificazione_richieste',(${classificationQuery}))) FROM known $v3$;\n`;
 const preserved=`CREATE OR REPLACE FUNCTION artecna_distruzione.hard_delete_preserved(cid uuid,targets jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $v3$
DECLARE item record;enabled boolean;fingerprint jsonb;input_key text;result jsonb:='{}';runtime_ids uuid[]:=ARRAY(SELECT jsonb_array_elements_text(targets->'keep:runtime:ids'))::uuid[];BEGIN
IF NOT(targets ? 'keep:runtime:ids') OR (SELECT count(*) FROM artecna_distruzione.hard_delete_runtime_queries WHERE kind='preserved')<>57 THEN RAISE EXCEPTION 'Witness metadata missing' USING ERRCODE='P2113';END IF;
FOR item IN SELECT * FROM artecna_distruzione.hard_delete_runtime_queries WHERE kind='preserved' ORDER BY seq LOOP
enabled:=false;FOREACH input_key IN ARRAY item.input_keys LOOP IF jsonb_array_length(coalesce(targets->input_key,'[]'))>0 THEN enabled:=true;EXIT;END IF;END LOOP;
IF enabled THEN EXECUTE item.query_sql INTO fingerprint USING cid,targets,runtime_ids;result:=result||jsonb_build_object(item.label,fingerprint);END IF;
END LOOP;RETURN result||artecna_distruzione.hard_delete_legal_witnesses(targets);END $v3$;\n`;
 // Certified graph: fixed related relations + discovery of new ownership columns,
 // reserved names and FK neighbours. Unrelated application functions excluded.
 const relationSet=new Set([...before.targets.matchAll(/\b(?:FROM|JOIN) ([a-z_][a-z_0-9]*\.[a-z_][a-z_0-9]*)/g),...before.shared.matchAll(/\b(?:FROM|JOIN) ([a-z_][a-z_0-9]*\.[a-z_][a-z_0-9]*)/g)].map(m=>m[1]).filter(t=>!t.startsWith('pg_')));
 for(const r of await q("SELECT n.nspname||'.'||c.relname tab FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='artecna_distruzione' AND c.relkind='r' AND c.relname NOT IN('hard_delete_catalog_expected','hard_delete_plan')"))relationSet.add(r.tab);
 relationSet.add('artecna_distruzione.hard_delete_runtime_queries');
 const names=[...relationSet].sort();
 const dependencies=await q("SELECT p.oid,p.oid::regprocedure::text signature,n.nspname schema,p.proname,p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prokind='f' AND (n.nspname='public' OR starts_with(n.nspname,'artecna_'))");
 const functions=new Set(dependencies.filter(f=>f.schema==='artecna_distruzione'||f.signature.startsWith('public.elimina_cantiere_definitivamente(')).map(f=>f.signature));
 for(const f of await q("SELECT DISTINCT t.tgfoid::regprocedure::text signature FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgrelid=ANY($1::regclass[])",[names.filter(n=>!n.endsWith('hard_delete_runtime_queries'))]))functions.add(f.signature);
 let grew=true;while(grew){grew=false;for(const f of dependencies.filter(f=>functions.has(f.signature)))for(const m of f.prosrc.matchAll(/\b(public|artecna_[a-z_]+)\.([a-z_]+)\s*\(/g))for(const d of dependencies.filter(d=>d.schema===m[1]&&d.proname===m[2]))if(!functions.has(d.signature)){functions.add(d.signature);grew=true;}}
 const catalog=`CREATE OR REPLACE FUNCTION artecna_distruzione.hard_delete_catalog() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $v3$
WITH RECURSIVE base AS MATERIALIZED(SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND (n.nspname||'.'||c.relname=ANY(ARRAY[${names.map(quote).join(',')}]) OR ((n.nspname='public' OR starts_with(n.nspname,'artecna_')) AND (c.relname LIKE 'hard_delete_%' OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname IN('cantiere_id','cantiere','variante_id','raccolta_id','rapportino_id') AND NOT a.attisdropped)))) AND NOT(n.nspname='artecna_distruzione' AND c.relname IN('hard_delete_catalog_expected','hard_delete_plan'))),
rel AS MATERIALIZED(SELECT oid FROM base UNION SELECT k.conrelid FROM pg_constraint k WHERE k.contype='f' AND k.confrelid IN(SELECT oid FROM base) UNION SELECT k.confrelid FROM pg_constraint k WHERE k.contype='f' AND k.conrelid IN(SELECT oid FROM base)),
fun AS MATERIALIZED(SELECT p.oid FROM pg_proc p WHERE p.pronamespace='artecna_distruzione'::regnamespace UNION SELECT to_regprocedure(signature)::oid FROM unnest(ARRAY[${[...functions].sort().map(quote).join(',')}]) signatures(signature) WHERE to_regprocedure(signature) IS NOT NULL UNION SELECT t.tgfoid FROM pg_trigger t WHERE t.tgrelid IN(SELECT oid FROM rel) AND NOT t.tgisinternal),
objects AS(
SELECT 'r:'||n.nspname||'.'||c.relname||':'||pg_get_userbyid(c.relowner)||':'||coalesce(c.relacl::text,'')||':'||c.relrowsecurity||':'||c.relforcerowsecurity x FROM rel JOIN pg_class c USING(oid) JOIN pg_namespace n ON n.oid=c.relnamespace
UNION ALL SELECT 's:'||n.nspname||':'||pg_get_userbyid(n.nspowner)||':'||coalesce(n.nspacl::text,'') FROM pg_namespace n WHERE n.nspname='public' OR n.oid IN(SELECT c.relnamespace FROM rel JOIN pg_class c USING(oid))
UNION ALL SELECT 'c:'||a.attrelid::regclass::text||':'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull FROM pg_attribute a WHERE a.attrelid IN(SELECT oid FROM rel) AND a.attnum>0 AND NOT a.attisdropped
UNION ALL SELECT 'f:'||k.conrelid::regclass::text||':'||k.conname||':'||pg_get_constraintdef(k.oid,true)||':'||k.convalidated FROM pg_constraint k WHERE k.conrelid IN(SELECT oid FROM rel) OR k.confrelid IN(SELECT oid FROM rel)
UNION ALL SELECT 't:'||t.tgrelid::regclass::text||':'||pg_get_triggerdef(t.oid,true)||':'||t.tgenabled::text FROM pg_trigger t WHERE t.tgrelid IN(SELECT oid FROM rel) AND NOT t.tgisinternal
UNION ALL SELECT 'p:'||p.oid::regprocedure::text||':'||md5(p.prosrc)||':'||p.prosecdef||':'||coalesce(p.proconfig::text,'')||':'||pg_get_userbyid(p.proowner)||':'||coalesce(p.proacl::text,'') FROM fun JOIN pg_proc p USING(oid)
UNION ALL SELECT 'm:'||kind||':'||seq||':'||md5(to_jsonb(m)::text) FROM artecna_distruzione.hard_delete_runtime_queries m)
SELECT md5(coalesce(string_agg(x,'' ORDER BY x COLLATE "C"),'')) FROM objects $v3$;\n`;
 const baselineGuard=`DO $$ BEGIN IF current_user<>'postgres' OR session_user<>'postgres' OR (${identityQuery}) IS DISTINCT FROM ${quote(JSON.stringify(identity))}::jsonb OR (${helperQuery}) IS DISTINCT FROM ${quote(JSON.stringify(helpers))}::jsonb OR artecna_distruzione.hard_delete_catalog()<>${quote(baselineCatalog)} OR artecna_distruzione.hard_delete_catalog() IS DISTINCT FROM(SELECT signature FROM artecna_distruzione.hard_delete_catalog_expected) THEN RAISE EXCEPTION '009 baseline drift' USING ERRCODE='P2113';END IF;END $$;\n`;
 const sql=`-- LOCAL RUNTIME V3 CANDIDATE; migration 009 remains immutable.\nBEGIN;SET LOCAL search_path=pg_catalog,pg_temp;\n${baselineGuard}${metadata}${shared}${targets}${preserved}${catalog}UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog();\nCOMMIT;\n`;
 const oldIdentity=(await q(identityQuery))[0].identity;await q(sql);assert.deepEqual((await q(identityQuery))[0].identity,oldIdentity,'RPC owner/source/ACL untouched');
 fs.writeFileSync(path.join(root,'supabase/migrations/20261108001000_cantiere_hard_delete_runtime_v3.sql'),sql);
 const after={targets:await source('hard_delete_targets(uuid)'),shared:await source('hard_delete_shared_scope(uuid,jsonb)'),preserved:await source('hard_delete_preserved(uuid,jsonb)'),catalog:await source('hard_delete_catalog()')};
 fs.writeFileSync(path.join(root,'.run/runtime-v3-design.json'),JSON.stringify({graph_relations:names,metadata_rows:rows.length,helpers:Object.keys(before).map(k=>({helper:k,before_bytes:Buffer.byteLength(before[k]),after_bytes:Buffer.byteLength(after[k]),before_lines:before[k].split('\n').length,after_lines:after[k].split('\n').length,before_md5:md5(before[k]),after_md5:md5(after[k])}))},null,2)+'\n');console.log('LOCAL_RUNTIME_V3_GENERATED');
},{productionActor:true,beforeMigrations:certifiedInstallerFixture}).catch(e=>{console.error(e.stack);process.exitCode=1;});
