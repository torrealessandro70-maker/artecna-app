// U2.0B: PostgreSQL 17.6 isolato, baseline dell'audit Production; nessun accesso remoto.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const {spawnSync}=require('node:child_process'),{randomUUID,createHash}=require('node:crypto'),{Client}=require('pg');
const {fixture,A,B,OP,OP2,RAP,V,USER,TOKEN}=require('./fixtureStep3.cjs');
const production=require('./desktopLetturaProduction.fixture.json');
const read=n=>fs.readFileSync(path.resolve(__dirname,'../../../supabase/migrations',n),'utf8');
const migration=read('20261007_rapportino_desktop_lettura.sql');
const normalized=s=>s.replace(/\r\n/g,'\n');
const body=s=>s.split('$function$')[1];
const hash=s=>createHash('sha256').update(normalized(s),'utf8').digest('hex');
const empty=()=>({nuove:[],aggiornate:[],rimosse:[]});
const preflight=migration.slice(0,migration.indexOf('CREATE TEMP TABLE'))+'ROLLBACK;';

test('U2.0B: fixture completa certificata, normalizzazione soltanto CRLF e builder senza lock/DML',()=>{
 assert.equal(production.length,11);
 for(const f of production){assert.equal(hash(body(f.definizione)),f.sha256_prosrc_lf);assert(!normalized(body(f.definizione)).includes('\r'));assert(migration.includes(f.sha256_prosrc_lf));}
 for(const s of migration.matchAll(/CREATE FUNCTION artecna_rapportini\.[\s\S]*?\$fn\$;/g)){
   assert.match(s[0],/STABLE SECURITY INVOKER/);assert(!/\b(FOR UPDATE|FOR SHARE|INSERT INTO|UPDATE public\.|DELETE FROM|pg_advisory|DEFAULT)\b/i.test(s[0]));
 }
 assert(!migration.includes('artecna_economia_riconcilia_rpc'));
 assert.match(migration,/selezionabile',stato='bozza'/);
});

test('U2.0B: pre/post-check, parità Mobile/Desktop e READ ONLY su PostgreSQL reale',async t=>{
 const bin=path.join(os.tmpdir(),'artecna-postgres17-minimal-runtime/pgsql/bin');
 assert(fs.existsSync(path.join(bin,'initdb.exe')),'PostgreSQL reale obbligatorio');
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'artecna-u20b-'));
 const ctl=(name,args)=>{const r=spawnSync(path.join(bin,name),args,{stdio:'ignore',windowsHide:true,timeout:30000});assert.equal(r.status,0,`Runtime locale ${name}`);};
 const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const c=new Client({host:'127.0.0.1',port,user:'postgres',database:'postgres'});let started=false;
 const rows=async(s,p)=>(await c.query(s,p)).rows;
 const value=async(s,p)=>(await rows(s,p))[0].v;
 const snapshot=async()=>JSON.stringify(await rows(`SELECT oid,to_jsonb(p) v FROM pg_proc p WHERE pronamespace IN('public'::regnamespace,'artecna_rapportini'::regnamespace,'artecna_guardie'::regnamespace) ORDER BY oid`));
 const dataSnapshot=async()=>{
   const data=[];for(const table of ['rapportini','rapportino_prestazioni','rapportino_materiali','timbrature','operai','varianti_cantiere'])data.push(await rows(`SELECT to_jsonb(t) v FROM public.${table} t ORDER BY id`));
   data.push(await rows('SELECT to_jsonb(t) v FROM artecna_rapportini.sessioni_portale t ORDER BY token_sha256'));return JSON.stringify(data);
 };
 const mobile=async(date,rid=null,version=1,cant=A,token=TOKEN,ro=true)=>{
   await c.query('SET SESSION AUTHORIZATION artecna_rapportini_backend');
   try{await c.query(ro?'BEGIN READ ONLY':'BEGIN');return await value(version===1?'SELECT public.leggi_rapportino_portale($1,$2,$3,$4) v':'SELECT public.leggi_rapportino_portale($1,$2,$3,$4,$5::smallint) v',version===1?[token,cant,date,rid]:[token,cant,date,rid,version]);}
   finally{await c.query('ROLLBACK');await c.query('RESET SESSION AUTHORIZATION');}
 };
 const variantsMobile=async(ro=false)=>{
   await c.query('SET SESSION AUTHORIZATION artecna_rapportini_backend');
   try{await c.query(ro?'BEGIN READ ONLY':'BEGIN');return await value('SELECT public.varianti_rapportino_portale($1,$2) v',[TOKEN,A]);}
   finally{await c.query('ROLLBACK');await c.query('RESET SESSION AUTHORIZATION');}
 };
 const desktop=async(date,rid=null,version=1,cant=A,user=USER,variants=false)=>{
   await c.query('BEGIN READ ONLY');
   try{await c.query('SET LOCAL ROLE authenticated');await c.query("SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims',$1,true)",[JSON.stringify(user?{sub:user,role:'authenticated'}:{role:'authenticated'})]);
     return await value(variants?'SELECT public.varianti_rapportino_desktop($1) v':'SELECT public.leggi_rapportino_desktop($1,$2,$3,$4::smallint) v',variants?[cant]:[cant,date,rid,version]);}
   finally{await c.query('ROLLBACK');}
 };
 const outcome=async f=>{try{return {json:await f()};}catch(e){return {code:e.code,message:e.message};}};
 const transaction=async f=>{await c.query('BEGIN');try{return await f();}finally{await c.query('ROLLBACK');}};
 try{
   ctl('initdb.exe',['-D',scratch,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C']);
   ctl('pg_ctl.exe',['-D',scratch,'-l',path.join(scratch,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -F`,'-w','start']);started=true;await c.connect();
   assert.equal(await value("SELECT current_setting('server_version') v"),'17.6');
   await c.query(fixture);await c.query('ALTER TABLE public.rapportini ADD COLUMN costo_materiali text');
   for(const n of ['20261003_rapportino_prestazioni_step2.sql','20261003_rapportino_servizio_step3.sql','20261003_rapportino_backend_pooler.sql','20261004_rapportino_lettura_portale.sql','20261006_rapportino_materiali_schema.sql','20261006_rapportino_materiali_writer.sql','20261006_rapportino_materiali_lettura.sql'])await c.query(read(n));
   for(const f of production)for(const a of JSON.parse(f.acl_effettiva_catalogo))if(!await value('SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$1) v',[a.grantee]))await c.query(`CREATE ROLE ${a.grantee} NOLOGIN NOINHERIT`);
   for(const f of production){
     await c.query(f.definizione);
     const grants=await rows('SELECT DISTINCT grantee,pg_get_userbyid(grantee) name FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid=$1::regprocedure))',[f.firma]);
     await c.query(`REVOKE ALL ON FUNCTION ${f.firma} FROM PUBLIC`);
     for(const a of grants)if(a.grantee!==0&&a.name!=='postgres')await c.query(`REVOKE ALL ON FUNCTION ${f.firma} FROM ${a.name}`);
     for(const a of JSON.parse(f.acl_effettiva_catalogo))if(a.grantee!=='postgres')await c.query(`GRANT EXECUTE ON FUNCTION ${f.firma} TO ${a.grantee}`);
   }
   await c.query('SELECT public.crea_sessione_rapportino($1,$2)',['1234',TOKEN]);
   await c.query("INSERT INTO public.utenti_cantiere VALUES($1,$2,'owner')",[B,USER]);
   for(const stato of ['proposta','approvata','annullata'])await c.query('INSERT INTO public.varianti_cantiere(id,cantiere_id,numero,titolo,stato) VALUES($1,$2,2,$3,$3)',[randomUUID(),A,stato]);
   const newPrest=(operaio=OP)=>({prestazione_id:null,chiave_client:randomUUID(),operaio_id:operaio,ora_inizio:'08:00',ora_fine:'12:00',pausa_minuti:0,lavoro_in_economia:false,variante_id:null});
   const write=async payload=>value('SELECT public.salva_rapportino_con_prestazioni($1::jsonb,$2) v',[JSON.stringify(payload),TOKEN]);
   const p={versione_contratto:1,richiesta_id:randomUUID(),rapportino_id:null,revisione_attesa:null,cantiere_id:A,data:'2026-10-07',documento:{note:'Giornata',materiali:'Legacy',quantita_materiali:'Due'},prestazioni:{...empty(),nuove:[newPrest(),newPrest()]}};
   const v1=await write(p);
   const p2={...p,versione_contratto:2,richiesta_id:randomUUID(),data:'2026-10-08',documento:{note:'Giornata V2'},prestazioni:{...empty(),nuove:[newPrest()]},materiali:{...empty(),nuove:[{materiale_id:null,chiave_client:randomUUID(),descrizione:'Collante',unita_misura:'sacco',quantita:'2.000000',costo_unitario:null,note:''},{materiale_id:null,chiave_client:randomUUID(),descrizione:'Omaggio',unita_misura:'pz',quantita:'1.000000',costo_unitario:'0.000000',note:''}]}};
   const v2=await write(p2);
   const update={...p2,richiesta_id:randomUUID(),rapportino_id:v2.rapportino_id,revisione_attesa:v2.revisione,prestazioni:{...empty(),rimosse:[v2.prestazioni[0].prestazione_id]},materiali:{...empty(),rimosse:[v2.materiali.find(m=>m.descrizione==='Omaggio').materiale_id]}};
   await write(update);
   const dup=randomUUID();await c.query('INSERT INTO public.rapportini(id,cantiere_id,data,created_at) VALUES($1,$2,$3,$4)',[dup,A,'2026-09-21','2099-01-01']);
   const single=randomUUID();await c.query('INSERT INTO public.rapportini(id,cantiere_id,data) VALUES($1,$2,$3)',[single,A,'2026-09-20']);
   const singleBaseline=await mobile('2026-09-20');
   const cases=[['assente','2026-10-09',null,1],['V0 duplicati','2026-09-21',null,1],['V0 UUID precedente','2026-09-21',RAP,1],['V1','2026-10-07',v1.rapportino_id,1],['V1 materiali non adottati','2026-10-07',v1.rapportino_id,2],['V2 tombstone','2026-10-08',v2.rapportino_id,2],['UUID incoerente','2026-10-07',RAP,1],['versione invalida Mobile','2026-10-07',null,9],['data invalida',null,null,1]];
   const baseline=[];for(const [,date,rid,version]of cases)baseline.push(await outcome(()=>mobile(date,rid,version)));
   const oldVariants=await variantsMobile(),oldReadonlyVariants=await outcome(()=>variantsMobile(true));
   const badSession=await outcome(()=>mobile('2026-10-07',null,1,A,'cd'.repeat(32)));
   const restricted=await outcome(()=>mobile('2026-10-07',null,1,B));
   const before=await snapshot();
   for(const newline of ['LF','CRLF'])await t.test(`preflight Production ${newline}`,async()=>{
     await transaction(async()=>{for(const f of production)await c.query(newline==='LF'?normalized(f.definizione):normalized(f.definizione).replace(/\n/g,'\r\n'));await c.query(preflight);});assert.equal(await snapshot(),before);
   });
   const target=production.find(f=>f.nome==='autorizza_lettura_portale');
   const faults=[
     ['CR isolato',target.definizione.replace('$function$', '$function$\r')],
     ['un carattere',target.definizione.replace('Sessione','Sessionf')],
     ['whitespace reale',target.definizione.replace('$function$', '$function$ ')],
     ['commento',target.definizione.replace('$function$', '$function$-- divergenza\n')],
     ['metadata',`ALTER FUNCTION ${target.firma} VOLATILE`],
     ['default',"ALTER FUNCTION public.leggi_rapportino_portale(text,uuid,date,uuid) CALLED ON NULL INPUT; CREATE OR REPLACE FUNCTION public.leggi_rapportino_portale(p_sessione text,p_cantiere_id uuid,p_data date,p_rapportino_id uuid DEFAULT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $function$"+body(production.find(f=>f.nome==='leggi_rapportino_portale'&&f.numero_default==='1').definizione)+'$function$;'],
     ['ACL',`GRANT EXECUTE ON FUNCTION ${target.firma} TO authenticated`],
     ['EXECUTE ereditato', 'GRANT artecna_rapportini_backend TO authenticated'],
   ];
   for(const [label,change]of faults)await t.test(`preflight rifiuta ${label}, rollback totale`,async()=>{
     await c.query('BEGIN');await c.query(change);await assert.rejects(()=>c.query(migration),e=>e.code==='P0001');await c.query('ROLLBACK');assert.equal(await snapshot(),before);
     assert.equal(await value("SELECT to_regprocedure('public.leggi_rapportino_desktop(uuid,date,uuid,smallint)') v"),null);
   });
   for(const [label,change]of [['metadata','ALTER FUNCTION public.leggi_rapportino_desktop(uuid,date,uuid,smallint) SECURITY INVOKER;'],['ACL builder','GRANT EXECUTE ON FUNCTION artecna_rapportini.costruisci_varianti_rapportino(uuid) TO authenticated;'],['writer','ALTER FUNCTION public.salva_rapportino_con_prestazioni(jsonb,text) STABLE;'],['grant tabella','GRANT SELECT ON public.rapportino_materiali TO artecna_rapportini_backend;']])await t.test(`post-check rifiuta ${label}, rollback totale`,async()=>{
     await assert.rejects(()=>c.query(migration.replace('DO $postcheck$',change+'\nDO $postcheck$')),e=>e.code==='P0001');await c.query('ROLLBACK');assert.equal(await snapshot(),before);
   });
   await t.test('installazione CRLF, post-check LF e writer/helper/ACL storici intatti',async()=>{await c.query(normalized(migration).replace(/\n/g,'\r\n'));for(const f of production.filter(f=>!['leggi_rapportino_portale','varianti_rapportino_portale'].includes(f.nome)))assert.equal(await value("SELECT encode(sha256(convert_to(replace(prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex') v FROM pg_proc WHERE oid=$1::regprocedure",[f.firma]),f.sha256_prosrc_lf);});
   const dataBefore=await dataSnapshot();
   await t.test('V0 singolo: parità Production/Mobile/Desktop',async()=>{assert.deepEqual(await mobile('2026-09-20'),singleBaseline);assert.deepEqual(await desktop('2026-09-20'),singleBaseline);assert.equal(singleBaseline.rapportino_id,single);});
   for(let i=0;i<cases.length;i++)await t.test(`Mobile parità Production: ${cases[i][0]}`,async()=>{const [,date,rid,version]=cases[i];assert.deepEqual(await outcome(()=>mobile(date,rid,version)),baseline[i]);});
   await t.test('Mobile Varianti: bozza soltanto e limite READ ONLY storico invariato',async()=>{
     assert.deepEqual(await variantsMobile(),oldVariants);assert.deepEqual(await outcome(()=>variantsMobile(true)),oldReadonlyVariants);assert.equal(oldReadonlyVariants.code,'25006');
     const list=Array.isArray(oldVariants)?oldVariants:oldVariants.varianti;assert(list.length>=4);
     for(const v of list)assert.equal(v.selezionabile,await value('SELECT stato=\'bozza\' v FROM public.varianti_cantiere WHERE id=$1',[v.id]));
   });
   for(const [label,date,rid,version]of cases.slice(0,6))await t.test(`Desktop READ ONLY parità ${label}`,async()=>{assert.deepEqual(await outcome(()=>desktop(date,rid,version)),await outcome(()=>mobile(date,rid,version)));});
   await t.test('Desktop Varianti READ ONLY identiche al Mobile',async()=>assert.deepEqual(await desktop(null,null,1,A,USER,true),oldVariants));
   await t.test('V1 più righe stesso operaio; V2 numerici stringa, null/zero, tombstone e riepilogo attivo',async()=>{
     const one=(await desktop('2026-10-07')).dettaglio;assert.equal(one.prestazioni.length,2);assert(one.prestazioni.every(p=>p.operaio_id===OP));assert.equal(one.documento.note,'Giornata');
     const two=(await desktop('2026-10-08',null,2)).dettaglio;assert.equal(two.versione_materiali,1);assert(two.prestazioni[0].rimossa_at);assert.equal(two.materiali.length,2);
     const active=two.materiali.find(m=>!m.rimossa_at),removed=two.materiali.find(m=>m.rimossa_at);assert.equal(active.quantita,'2.000000');assert.equal(active.costo_unitario,null);assert.equal(active.costo_totale,null);assert.equal(removed.costo_unitario,'0.000000');assert.equal(removed.costo_totale,'0.00');
     assert.deepEqual(two.riepilogo_materiali,{totale_materiali_valorizzati:'0.00',numero_materiali_da_valorizzare:1,valorizzazione_completa:false});assert.equal(two.documento.note,'Giornata V2');assert(two.documento_legacy_materiali);
     const notAdopted=(await desktop('2026-10-07',null,2)).dettaglio;assert.equal(notAdopted.versione_materiali,0);assert.deepEqual(notAdopted.materiali,[]);assert.deepEqual(notAdopted.documento_legacy_materiali,{materiali:'Legacy',quantita_materiali:'Due'});
   });
   for(const [label,date,rid,version,cant,user,code]of [['JWT assente','2026-10-07',null,1,A,null,'PR401'],['non owner','2026-10-07',null,1,A,OP,'42501'],['cantiere assente','2026-10-07',null,1,randomUUID(),USER,'42501'],['UUID cantiere NULL','2026-10-07',null,1,null,USER,'42501'],['versione invalida','2026-10-07',null,3,A,USER,'22023'],['versione NULL','2026-10-07',null,null,A,USER,'22023'],['UUID incoerente','2026-10-07',RAP,1,A,USER,'PR409']])await t.test(`Desktop ${label}`,async()=>assert.equal((await outcome(()=>desktop(date,rid,version,cant,user))).code,code));
   await t.test('Desktop owner su cantiere concluso; Mobile negato',async()=>{assert.equal((await desktop('2026-10-07',null,2,B)).presente,false);assert.deepEqual(await outcome(()=>mobile('2026-10-07',null,1,B)),restricted);});
   await t.test('Mobile sessione assente: errore invariato',async()=>assert.deepEqual(await outcome(()=>mobile('2026-10-07',null,1,A,'cd'.repeat(32))),badSession));
   await t.test('Desktop Varianti JWT assente/non-owner/cantiere assente/concluso',async()=>{
     assert.equal((await outcome(()=>desktop(null,null,1,A,null,true))).code,'PR401');assert.equal((await outcome(()=>desktop(null,null,1,A,OP,true))).code,'42501');assert.equal((await outcome(()=>desktop(null,null,1,randomUUID(),USER,true))).code,'42501');assert.deepEqual(await desktop(null,null,1,B,USER,true),[]);
   });
   await t.test('letture READ ONLY: nessuna modifica di dati/sessioni/revisioni',async()=>assert.equal(await dataSnapshot(),dataBefore));
   const sessionOriginal=(await rows('SELECT created_at,scade_at,revocata_at FROM artecna_rapportini.sessioni_portale'))[0];
   const restoreSession=async()=>{await c.query('UPDATE artecna_rapportini.sessioni_portale SET created_at=$1,scade_at=$2,revocata_at=$3',[sessionOriginal.created_at,sessionOriginal.scade_at,sessionOriginal.revocata_at]);await c.query("UPDATE public.operai SET stato='attivo' WHERE id=$1",[OP]);};
   for(const [label,change,code]of [['scaduta',"UPDATE artecna_rapportini.sessioni_portale SET created_at=statement_timestamp()-interval '2 days',scade_at=statement_timestamp()-interval '1 day'",'PR401'],['revocata',"UPDATE artecna_rapportini.sessioni_portale SET revocata_at=statement_timestamp()",'PR401'],['sospeso',`UPDATE public.operai SET stato='sospeso' WHERE id='${OP}'`,'42501']])await t.test(`Mobile ${label}: stesso codice/messaggio prima e dopo estrazione`,async()=>{
     const wrapper=production.find(f=>f.nome==='leggi_rapportino_portale'&&f.numero_default==='1').definizione;
     const upgraded=await value("SELECT pg_get_functiondef('public.leggi_rapportino_portale(text,uuid,date,uuid)'::regprocedure) v");
     try{await c.query(change);const after=await outcome(()=>mobile('2026-10-07'));await c.query(wrapper);const old=await outcome(()=>mobile('2026-10-07'));assert.deepEqual(after,old);assert.equal(after.code,code);}
     finally{await c.query(upgraded);await restoreSession();}
   });
   await t.test('ambiguità V1 e UUID: PR409 identico Mobile/Desktop',async()=>{
     const id=randomUUID();await c.query('INSERT INTO public.rapportini(id,cantiere_id,data) VALUES($1,$2,$3)',[id,A,'2026-10-07']);
     try{assert.equal((await outcome(()=>mobile('2026-10-07'))).code,'PR409');assert.deepEqual(await outcome(()=>desktop('2026-10-07')),await outcome(()=>mobile('2026-10-07')));}finally{await c.query('DELETE FROM public.rapportini WHERE id=$1',[id]);}
   });
   await t.test('ACL Desktop/Builder e nessun nuovo accesso diretto del backend',async()=>{
     for(const role of ['anon','authenticated','service_role','artecna_rapportini_backend','artecna_rapportini_rpc']){
       for(const sig of ['public.leggi_rapportino_desktop(uuid,date,uuid,smallint)','public.varianti_rapportino_desktop(uuid)'])assert.equal(await value('SELECT has_function_privilege($1,$2,\'EXECUTE\') v',[role,sig]),role==='authenticated');
       for(const sig of ['artecna_rapportini.costruisci_lettura_rapportino_v1(uuid,date,uuid)','artecna_rapportini.arricchisci_lettura_rapportino_v2(jsonb)','artecna_rapportini.costruisci_varianti_rapportino(uuid)'])assert.equal(await value('SELECT has_function_privilege($1,$2,\'EXECUTE\') v',[role,sig]),false);
       for(const f of production)assert.equal(await value('SELECT has_function_privilege($1,$2,\'EXECUTE\') v',[role,f.firma]),JSON.parse(f.execute_effettivo_ruoli).find(x=>x.ruolo===role)?.execute??false);
     }
     for(const table of ['rapportini','rapportino_prestazioni','rapportino_materiali','timbrature','operai','varianti_cantiere'])assert.equal(await value("SELECT has_table_privilege('artecna_rapportini_backend',$1,'SELECT,INSERT,UPDATE,DELETE') v",['public.'+table]),false);
     assert.equal(await value("SELECT has_schema_privilege('artecna_rapportini_backend','artecna_rapportini','USAGE') v"),false);
   });
   // pg restituisce Date a precisione millisecondo: i timestamp di sessione ripristinati
   // dai test negativi non partecipano a questo secondo confronto. Il confronto integrale
   // precedente certifica che tutte le letture, incluse le sessioni, sono senza side effect.
   const afterData=await dataSnapshot();assert.equal(JSON.stringify(JSON.parse(afterData).slice(0,-1)),JSON.stringify(JSON.parse(dataBefore).slice(0,-1)));
 }finally{
   await c.end().catch(()=>{});if(started)ctl('pg_ctl.exe',['-D',scratch,'-m','immediate','-w','stop']);
   assert(path.resolve(scratch).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(scratch,{recursive:true,force:true});
 }
});
