// M2.3A: esclusivamente fixture e database isolati, mai Production.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const {spawnSync}=require('node:child_process'),{createHash,randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const {fixture,A,B,OP,V,TOKEN}=require('./fixtureStep3.cjs');
const production=require('./varianteGuardProduction.fixture.json');
const read=n=>fs.readFileSync(path.resolve(__dirname,'../../../supabase/migrations',n),'utf8');
const sql=read('20261006_rapportino_variante_guard_writer.sql');
const finalHash='e9fa405954943ab75d7f69bb1b53a21b89b60566f0c96c70daa82dc14d95c4ce';
const hash=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
const empty=()=>({nuove:[],aggiornate:[],rimosse:[]});
const prest=(extra={})=>({prestazione_id:null,chiave_client:randomUUID(),operaio_id:OP,ora_inizio:'08:00',ora_fine:'12:00',pausa_minuti:0,lavoro_in_economia:true,variante_id:V,...extra});
let day=1;
const payload=(extra={})=>({versione_contratto:1,richiesta_id:randomUUID(),rapportino_id:null,revisione_attesa:null,cantiere_id:A,data:`2026-11-${String(day++).padStart(2,'0')}`,documento:{note:'Note',materiali:'Testo',quantita_materiali:'Quantità'},prestazioni:empty(),...extra});
const write=async(db,p)=>(await db.query('SELECT public.salva_rapportino_con_prestazioni($1::jsonb,$2) v',[JSON.stringify(p),TOKEN])).rows[0].v;
const reject=(f,c)=>assert.rejects(f,e=>e.code===c);
const productionDDL=body=>`CREATE OR REPLACE FUNCTION artecna_rapportini.applica_prestazioni_rapportino(p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $prod$${body}$prod$`;
async function setup(db,body=production.prosrc_lf){
 await db.exec(fixture);await db.exec('ALTER TABLE public.rapportini ADD COLUMN costo_materiali text');
 for(const n of ['20261003_rapportino_prestazioni_step2.sql','20261003_rapportino_servizio_step3.sql','20261003_rapportino_backend_pooler.sql','20261004_rapportino_lettura_portale.sql','20261006_rapportino_materiali_schema.sql'])await db.exec(read(n));
 await db.exec(productionDDL(body));await db.exec('DROP FUNCTION artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid)');
 await db.query('SELECT public.crea_sessione_rapportino($1,$2)',['1234',TOKEN]);
}
const source=async db=>(await db.query("SELECT prosrc FROM pg_proc WHERE oid='artecna_rapportini.applica_prestazioni_rapportino(jsonb)'::regprocedure")).rows[0].prosrc;
async function state(db){const out={};for(const t of ['rapportini','rapportino_prestazioni','rapportino_materiali','timbrature','artecna_rapportini.richieste'])out[t]=(await db.query(`SELECT to_jsonb(t) v FROM ${t} t ORDER BY to_jsonb(t)::text`)).rows;return out;}

test('M2.3A: Production certificata, due sole chiamate, helper storico esatto',()=>{
 assert.equal(hash(production.prosrc_lf),production.sha256_lf);
 const body=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION artecna_rapportini.applica_prestazioni_rapportino'));
 const src=body.slice(body.indexOf('AS $fn$')+7,body.indexOf('$fn$;'));
 assert.equal(hash(src),finalHash);
 assert.equal(src.replace('          IF vi IS NOT NULL THEN PERFORM artecna_rapportini.verifica_nuovo_collegamento_variante(vi,c); END IF;\n','').replace('        IF vi IS NOT NULL AND vi IS DISTINCT FROM old.variante_id THEN\n          PERFORM artecna_rapportini.verifica_nuovo_collegamento_variante(vi,c);\n        END IF;\n',''),production.prosrc_lf);
 const step=read('20261003_rapportino_servizio_step3.sql').replace(/\r\n/g,'\n'),a=step.indexOf('CREATE FUNCTION artecna_rapportini.verifica_nuovo_collegamento_variante');
 assert(sql.includes(step.slice(a,step.indexOf('$fn$;',a)+6)));
 assert(!sql.includes('UPDATE public.rapportino_prestazioni SET variante_id'));
});

test('M2.3A: ordine lock coerente con proponi/approva già auditati',()=>{
 const step=read('20261003_rapportino_servizio_step3.sql');
 const a=step.indexOf('CREATE FUNCTION artecna_rapportini.autorizza('),b=step.indexOf('$fn$;',a),auth=step.slice(a,b);
 assert.match(auth,/FROM public\.cantieri[\s\S]*FOR SHARE/i);
 const installed=require('../economia/ponteEconomiaProduction.fixture.json').funzioni;
 for(const name of ['proponi_variante','approva_variante']){
   const definition=installed.find(s=>s.includes('FUNCTION public.'+name+'('));assert(definition);
   const locks=definition.split(';').filter(s=>/FOR UPDATE/i.test(s)).map(s=>s.match(/FROM public\.(cantieri|varianti_cantiere)/i)[1]);
   assert.deepEqual(locks,['cantieri','varianti_cantiere']);
   assert(!/FROM public\.(rapportini|rapportino_prestazioni)/i.test(definition));
 }
});

test('M2.3A: dominio contratto 1 e compatibilità M2.3',async t=>{
 const db=new PGlite();try{await setup(db);
 await t.test('fingerprint iniziale e helper assente',async()=>{assert.equal(hash(await source(db)),production.sha256_lf);assert.equal((await db.query("SELECT to_regprocedure('artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid)') f")).rows[0].f,null);});
 const before=await state(db);await db.exec(sql);
 await t.test('fingerprint finale, dati e M2.2 immutati',async()=>{assert.equal(hash(await source(db)),finalHash);assert.deepEqual(await state(db),before);});
 await t.test('helper metadata e ACL minime',async()=>{const p=(await db.query("SELECT proowner::regrole::text owner,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid='artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid)'::regprocedure")).rows[0];assert.deepEqual(p,{owner:'postgres',prosecdef:true,provolatile:'v',proconfig:['search_path=pg_catalog, pg_temp']});for(const role of ['anon','authenticated','service_role','artecna_rapportini_backend'])assert.equal((await db.query("SELECT has_function_privilege($1,'artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid)','EXECUTE') p",[role])).rows[0].p,false);});
 for(const status of ['bozza','proposta'])await t.test('nuova verso '+status+' ammessa',async()=>{await db.query('UPDATE varianti_cantiere SET stato=$1 WHERE id=$2',[status,V]);const r=await write(db,payload({prestazioni:{...empty(),nuove:[prest()]}}));assert.equal(r.prestazioni[0].variante_id,V);assert.equal(r.versione_contratto,1);});
 for(const status of ['approvata','annullata'])await t.test('nuova verso '+status+' rifiutata atomicamente',async()=>{await db.query('UPDATE varianti_cantiere SET stato=$1 WHERE id=$2',[status,V]);const before=await state(db);await reject(()=>write(db,payload({prestazioni:{...empty(),nuove:[prest()]}})),'22023');assert.deepEqual(await state(db),before);});
 await db.query('UPDATE varianti_cantiere SET stato=$1 WHERE id=$2',['bozza',V]);
 const other=randomUUID();await db.query("INSERT INTO varianti_cantiere(id,cantiere_id,titolo,stato) VALUES($1,$2,'Altro','bozza')",[other,B]);
 for(const [name,id] of [['altro cantiere',other],['inesistente',randomUUID()]])await t.test('nuova '+name+' rifiutata',()=>reject(()=>write(db,payload({prestazioni:{...empty(),nuove:[prest({variante_id:id})]}})),'22023'));
 const intent=payload({prestazioni:{...empty(),nuove:[prest()]}}),created=await write(db,intent);
 await db.query("UPDATE varianti_cantiere SET stato='approvata' WHERE id=$1",[V]);
 await t.test('retry dopo approvazione identico senza mutazioni',async()=>{const before=await state(db);assert.deepEqual(await write(db,intent),created);assert.deepEqual(await state(db),before);});
 let current=created;
 const update=(id,extra={})=>payload({rapportino_id:current.rapportino_id,revisione_attesa:current.revisione,data:current.data,documento:{},prestazioni:{...empty(),aggiornate:[{...prest(),prestazione_id:current.prestazioni[0].prestazione_id,chiave_client:current.prestazioni[0].chiave_client,variante_id:id,ora_fine:'13:00',...extra}]}});
 await t.test('stessa Variante approvata modificabile, revisione e proiezione storiche',async()=>{const old=current;current=await write(db,update(V));assert.equal(current.revisione,old.revisione+1);assert.equal(current.prestazioni[0].ore,5);});
 const dest=randomUUID();await db.query("INSERT INTO varianti_cantiere(id,cantiere_id,titolo,stato) VALUES($1,$2,'Destinazione','bozza')",[dest,A]);
 await t.test('cambio verso bozza ammesso',async()=>{current=await write(db,update(dest));assert.equal(current.prestazioni[0].variante_id,dest);});
 await db.query("UPDATE varianti_cantiere SET stato='proposta' WHERE id=$1",[V]);
 await t.test('cambio verso proposta ammesso',async()=>{current=await write(db,update(V));assert.equal(current.prestazioni[0].variante_id,V);});
 await db.query("UPDATE varianti_cantiere SET stato='approvata' WHERE id=$1",[dest]);
 await t.test('cambio verso approvata rifiutato atomicamente',async()=>{const before=await state(db);await reject(()=>write(db,update(dest)),'22023');assert.deepEqual(await state(db),before);});
 await t.test('Ordinario e Economia senza Variante invariati',async()=>{const r=await write(db,payload({prestazioni:{...empty(),nuove:[prest({lavoro_in_economia:false,variante_id:null}),prest({variante_id:null})]}}));assert.equal(r.prestazioni.length,2);assert(r.prestazioni.every(p=>p.variante_id===null));});
 await t.test('M2.3 invariata accetta il risultato M2.3A',async()=>{await db.exec(read('20261006_rapportino_materiali_writer.sql'));assert.equal(hash(await source(db)),finalHash);assert.deepEqual(await write(db,intent),created);});
 }finally{await db.close();}
});

test('M2.3A: LF/CRLF, fail-closed e rollback completo',async t=>{
 for(const ending of ['LF','CRLF'])await t.test(ending+' accettato',async()=>{const db=new PGlite();try{await setup(db,ending==='LF'?production.prosrc_lf:production.prosrc_lf.replace(/\n/g,'\r\n'));await db.exec(ending==='LF'?sql:sql.replace(/\n/g,'\r\n'));assert.equal(hash(await source(db)),finalHash);}finally{await db.close();}});
 const cases=[
 ['CR isolato',production.prosrc_lf.replace('DECLARE','DECLARE\r '),null,null],
 ['un carattere',production.prosrc_lf+' ',null,null],
 ['commento',production.prosrc_lf+'-- differenza\n',null,null],
 ['metadata',null,'ALTER FUNCTION artecna_rapportini.applica_prestazioni_rapportino(jsonb) SECURITY DEFINER',null],
 ['ACL',null,'GRANT EXECUTE ON FUNCTION artecna_rapportini.applica_prestazioni_rapportino(jsonb) TO authenticated',null],
 ['trigger',null,'ALTER TABLE rapportino_prestazioni DISABLE TRIGGER rapportino_prestazioni_guardia',null],
 ['ruolo',null,'ALTER ROLE artecna_rapportini_rpc INHERIT',null],
 ['backend SELECT diretto',null,'GRANT SELECT ON rapportino_prestazioni TO artecna_rapportini_backend',null],
 ['helper già presente',null,'CREATE FUNCTION artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid) RETURNS void LANGUAGE sql AS $$ SELECT $$',null],
 ['M2.2 CHECK',null,'ALTER TABLE rapportino_materiali DROP CONSTRAINT rapportino_materiali_quantita_ck',null],
 ['post-check writer',null,null,"ALTER FUNCTION artecna_rapportini.applica_prestazioni_rapportino(jsonb) SECURITY DEFINER;"],
 ['post-check helper ACL',null,null,'GRANT EXECUTE ON FUNCTION artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid) TO authenticated;'],
 ['post-check helper metadata',null,null,'ALTER FUNCTION artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid) SECURITY INVOKER;'],
 ['post-check trigger',null,null,'ALTER TABLE rapportino_prestazioni DISABLE TRIGGER rapportino_prestazioni_guardia;'],
 ['post-check M2.2',null,null,'ALTER TABLE rapportino_materiali DISABLE ROW LEVEL SECURITY;']
 ];
 for(const [name,body,pre,post] of cases)await t.test(name+' rifiutato senza installazione parziale',async()=>{const db=new PGlite();try{await setup(db,body||production.prosrc_lf);if(pre)await db.exec(pre);const old=await source(db),before=await state(db),oldHelper=(await db.query("SELECT to_regprocedure('artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid)') f")).rows[0].f;await assert.rejects(()=>db.exec(post?sql.replace('DO $postcheck$',post+'\nDO $postcheck$'):sql));await db.exec('ROLLBACK');assert.equal(await source(db),old);assert.deepEqual(await state(db),before);assert.equal((await db.query("SELECT to_regprocedure('artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid)') f")).rows[0].f,oldHelper);}finally{await db.close();}});
});

test('M2.3A: PostgreSQL reale, stato Variante serializzato e retry concorrenti',async t=>{
 const {Client}=require('pg'),bin=path.join(os.tmpdir(),'artecna-postgres-test-runtime/pgsql/bin');
 assert(fs.existsSync(path.join(bin,'initdb.exe')),'Runtime PostgreSQL locale obbligatorio');
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'artecna-m23a-concorrenza-'));
 const ctl=(exe,args)=>{const r=spawnSync(path.join(bin,exe),args,{stdio:'ignore',windowsHide:true,timeout:30000});assert.equal(r.status,0,'Runtime PostgreSQL locale');};
 const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const clients=[];let started=false;
 const connect=async user=>{const c=new Client({host:'127.0.0.1',port,database:'postgres',user,connectionTimeoutMillis:5000});await c.connect();await c.query("SET statement_timeout='10s'");clients.push(c);return c;};
 try{
 ctl('initdb.exe',['-D',scratch,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C']);ctl('pg_ctl.exe',['-D',scratch,'-l',path.join(scratch,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -F`,'-w','start']);started=true;
 const admin=await connect('postgres'),db={exec:s=>admin.query(s),query:(s,p)=>admin.query(s,p)};await setup(db);await db.exec(sql);
 const a=await connect('artecna_rapportini_backend'),b=await connect('artecna_rapportini_backend'),modifier=await connect('postgres');
 const waits=async ids=>{for(let i=0;i<100;i++){const n=(await admin.query("SELECT count(*)::integer n FROM pg_stat_activity WHERE pid=ANY($1::integer[]) AND wait_event_type='Lock'",[ids])).rows[0].n;if(n===ids.length)return;await new Promise(r=>setTimeout(r,20));}assert.fail('Lock conteso non osservato');};
 const pid=async c=>(await c.query('SELECT pg_backend_pid() p')).rows[0].p;
 await t.test('FOR SHARE impedisce approvazione concorrente durante il nuovo collegamento',async()=>{
 const modifierPid=await pid(modifier);await a.query('BEGIN');let pending;
 try{await write(a,payload({prestazioni:{...empty(),nuove:[prest()]}}));pending=modifier.query("UPDATE varianti_cantiere SET stato='approvata' WHERE id=$1",[V]);await waits([modifierPid]);}finally{await a.query('COMMIT');}
 await pending;await reject(()=>write(b,payload({prestazioni:{...empty(),nuove:[prest()]}})),'22023');
 });
 await admin.query("UPDATE varianti_cantiere SET stato='bozza' WHERE id=$1",[V]);
 await t.test('stato aggiornato prima del collegamento viene ricontrollato dopo attesa',async()=>{const bPid=await pid(b);await modifier.query('BEGIN');let pending;try{await modifier.query("UPDATE varianti_cantiere SET stato='approvata' WHERE id=$1",[V]);pending=write(b,payload({prestazioni:{...empty(),nuove:[prest()]}})).then(v=>({v}),e=>({e}));await waits([bPid]);}finally{await modifier.query('COMMIT');}assert.equal((await pending).e.code,'22023');});
 await admin.query("UPDATE varianti_cantiere SET stato='bozza' WHERE id=$1",[V]);
 await t.test('retry concorrenti: stesso risultato, una richiesta, una prestazione',async()=>{
 const p=payload({prestazioni:{...empty(),nuove:[prest()]}}),ids=[await pid(a),await pid(b)];await admin.query('BEGIN');let pending;
 try{await admin.query("SELECT pg_advisory_xact_lock(hashtextextended('portale'||$1||$2,0))",[OP,p.richiesta_id]);pending=Promise.allSettled([write(a,p),write(b,p)]);await waits(ids);}finally{await admin.query('COMMIT');}
 const results=await pending;assert(results.every(r=>r.status==='fulfilled'));assert.deepEqual(results[0].value,results[1].value);assert.equal((await admin.query('SELECT count(*)::integer n FROM artecna_rapportini.richieste WHERE richiesta_id=$1',[p.richiesta_id])).rows[0].n,1);assert.equal((await admin.query('SELECT count(*)::integer n FROM rapportino_prestazioni WHERE rapportino_id=$1',[results[0].value.rapportino_id])).rows[0].n,1);
 });
 }finally{await Promise.allSettled(clients.map(c=>c.end()));if(started)ctl('pg_ctl.exe',['-D',scratch,'-m','immediate','-w','stop']);const resolved=path.resolve(scratch),root=path.resolve(os.tmpdir())+path.sep;if(!resolved.startsWith(root)||!path.basename(resolved).startsWith('artecna-m23a-concorrenza-'))throw Error('Cleanup laboratorio fuori scope');fs.rmSync(resolved,{recursive:true,force:true});}
});
