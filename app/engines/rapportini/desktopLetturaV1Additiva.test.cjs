// PostgreSQL nativo isolato, dati sintetici, nessuna connessione Production.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),net=require('node:net'),vm=require('node:vm'),ts=require('typescript');
const {spawnSync}=require('node:child_process'),{randomUUID:uuid}=require('node:crypto'),{Client}=require('pg');
const {fixture,A,B,OP,OP2,RAP,V,USER}=require('./fixtureStep3.cjs');
const read=n=>fs.readFileSync(path.resolve(__dirname,'../../../supabase/migrations',n),'utf8');
const migration=read('20261025_rapportino_desktop_lettura_v1.sql');
const old=read('20261007_rapportino_desktop_lettura.sql').replace(/\r\n/g,'\n');
const production=require('./desktopLetturaProduction.fixture.json');
const exportsValidator={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'validaLetturaPortale.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsValidator});

test('migrazione additiva: builder V1 riusato, solo due CREATE, nessun writer/portale sostituito',()=>{
 const start=old.indexOf('CREATE FUNCTION artecna_rapportini.costruisci_lettura_rapportino_v1('),end=old.indexOf('$fn$;',start)+5;
 a(migration.includes(old.slice(start,end)));a.equal((migration.match(/CREATE FUNCTION /g)||[]).length,2);
 a(!/CREATE OR REPLACE|ALTER TABLE|CREATE TABLE|CREATE TRIGGER|FOR UPDATE|FOR SHARE|pg_advisory|INSERT INTO|UPDATE public\.|DELETE FROM/i.test(migration));
 a(!migration.includes('CREATE FUNCTION public.leggi_rapportino_portale'));a(!migration.includes('salva_rapportino_con_prestazioni'));
});

test('PostgreSQL nativo: installazione additiva, due prestazioni V1, READ ONLY e isolamento identita',async t=>{
 const bin=process.env.ARTECNA_TEST_PG_BIN || 'C:/Users/torre/AppData/Local/Temp/artecna-postgres17-minimal-runtime/pgsql/bin';a(fs.existsSync(path.join(bin,'initdb.exe')),'PostgreSQL nativo obbligatorio');
 const root=path.resolve(__dirname,'../../../..'),scratch=fs.mkdtempSync(path.join(root,'native-'));
 const ctl=(name,args)=>{const r=spawnSync(path.join(bin,name),args,{encoding:'utf8',windowsHide:true,timeout:30000});if(r.status!==0)throw Error(`${name}: ${r.stderr||r.stdout}`);return r.stdout;};
 const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const c=new Client({host:'127.0.0.1',port,user:'postgres',database:'postgres'});let started=false;
 const value=async(sql,p)=>(await c.query(sql,p)).rows[0].v;
 const snapFunctions=async()=>JSON.stringify((await c.query("SELECT p.oid,to_jsonb(p) v FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','artecna_rapportini','artecna_guardie') ORDER BY p.oid")).rows);
 const snapData=async()=>{const out=[];for(const table of ['rapportini','rapportino_prestazioni','timbrature','operai','utenti_cantiere','varianti_cantiere']){
  const order=table==='utenti_cantiere'?'cantiere_id,user_id':'id';out.push((await c.query(`SELECT to_jsonb(x) v FROM public.${table} x ORDER BY ${order}`)).rows);
 }return JSON.stringify(out);};
 const desktop=async(rid,date,cant=A,user=USER,role='authenticated',version=1)=>{
  await c.query('BEGIN READ ONLY');try{await c.query(`SET LOCAL ROLE ${role}`);await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify(user?{sub:user,role}:{role})]);
   a.equal(await value("SELECT current_setting('transaction_read_only') v"),'on');
   return await value('SELECT public.leggi_rapportino_desktop($1,$2,$3,$4::smallint) v',[cant,date,rid,version]);
  }finally{await c.query('ROLLBACK');}
 };
 const create=async(date,rows)=>{const rid=uuid();await c.query('INSERT INTO public.rapportini(id,cantiere_id,data,versione_prestazioni) VALUES($1,$2,$3,1)',[rid,A,date]);for(const r of rows)await c.query('INSERT INTO public.rapportino_prestazioni(rapportino_id,operaio_id,chiave_client,ora_inizio,ora_fine,pausa_minuti,lavoro_in_economia,variante_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[rid,r.op||OP,uuid(),r.start,r.end,r.pause||0,!!r.econ,r.econ?V:null]);return rid;};
 try{
  ctl('initdb.exe',['-D',scratch,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C']);ctl('pg_ctl.exe',['-D',scratch,'-l',path.join(scratch,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -F`,'-w','start']);started=true;await c.connect();
  console.log('PostgreSQL',await value("SELECT current_setting('server_version') v"),'cluster',scratch);
  await c.query(fixture);
  for(const n of ['20261003_rapportino_prestazioni_step2.sql','20261003_rapportino_servizio_step3.sql','20261003_rapportino_backend_pooler.sql','20261004_rapportino_lettura_portale.sql'])await c.query(read(n));
  for(const f of production.filter(f=>f.schema==='artecna_guardie'))await c.query(f.definizione);
  const functionsBefore=await snapFunctions();await c.query(migration);
  const added=(await c.query("SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='public' AND p.proname='leggi_rapportino_desktop') OR (n.nspname='artecna_rapportini' AND p.proname='costruisci_lettura_rapportino_v1')")).rows.map(r=>r.oid);
  const after=(await c.query("SELECT p.oid,to_jsonb(p) v FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','artecna_rapportini','artecna_guardie') ORDER BY p.oid")).rows.filter(r=>!added.includes(r.oid));a.equal(JSON.stringify(after),functionsBefore);
  await t.test('preflight rifiuta seconda installazione senza sostituire funzioni',async()=>{const before=await snapFunctions();await a.rejects(c.query(migration),/gia presente o conflitto/);await c.query('ROLLBACK');a.equal(await snapFunctions(),before);});
  const cases=[['ordinario due operai','2026-10-21',[{start:'08:00',end:'13:00'},{op:OP2,start:'08:00',end:'13:00'}]],['economia due operai','2026-10-22',[{start:'10:00',end:'13:00',econ:true},{op:OP2,start:'10:00',end:'13:00',econ:true}]],['misto stesso operaio','2026-10-23',[{start:'07:00',end:'11:00'},{start:'11:00',end:'15:00',econ:true}]]];
  let mixed;
  for(const [name,date,rows] of cases){const rid=await create(date,rows);if(name.startsWith('misto'))mixed=rid;
   await t.test(name+' restituisce esattamente due righe e DTO valido',async()=>{const before=await snapData();const dto=await desktop(rid,date);a.equal(dto.dettaglio.prestazioni.length,2);a(exportsValidator.letturaPortaleValida(dto,{cantiere_id:A,data:date,rapportino_id:rid}));for(const [i,p]of dto.dettaglio.prestazioni.entries()){a.equal(p.ora_inizio,rows[i].start);a.equal(p.ora_fine,rows[i].end);a.equal(p.lavoro_in_economia,!!rows[i].econ);a.equal(p.variante_id,rows[i].econ?V:null);}a.equal(await snapData(),before);});
  }
  await t.test('legacy e assente mantengono il contratto senza inventare righe',async()=>{a.equal((await desktop(RAP,'2026-09-21')).dettaglio,null);const d=await desktop(null,'2026-12-01');a.equal(d.presente,false);});
  await t.test('altro utente, anonimo e identita assente rifiutati',async()=>{await a.rejects(desktop(mixed,'2026-10-23',A,uuid()),e=>e.code==='42501');await a.rejects(desktop(mixed,'2026-10-23',A,null),e=>e.code==='PR401');await a.rejects(desktop(mixed,'2026-10-23',A,null,'anon'),e=>e.code==='42501');});
  await t.test('UUID fuori contesto e versione non supportata rifiutati',async()=>{await a.rejects(desktop(RAP,'2026-10-23'),e=>e.code==='PR409');await a.rejects(desktop(mixed,'2026-10-23',A,USER,'authenticated',2),e=>e.code==='22023');await a.rejects(desktop(mixed,'2026-10-23',B),e=>e.code==='42501');});
  await t.test('builder privato e nessun grant implicito da default privileges',async()=>{for(const role of ['anon','service_role'])a.equal(await value("SELECT has_function_privilege($1,'public.leggi_rapportino_desktop(uuid,date,uuid,smallint)','EXECUTE') v",[role]),false);a.equal(await value("SELECT has_function_privilege('authenticated','artecna_rapportini.costruisci_lettura_rapportino_v1(uuid,date,uuid)','EXECUTE') v"),false);});
 }finally{await c.end().catch(()=>{});if(started)ctl('pg_ctl.exe',['-D',scratch,'-m','immediate','-w','stop']);console.log('Cluster locale arrestato; log conservati:',scratch);}
});
