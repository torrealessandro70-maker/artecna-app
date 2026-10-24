const {PGlite}=require('@electric-sql/pglite'),{test}=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),p=require('path'),ts=require('typescript'),Module=require('module');
const root=p.resolve(__dirname,'../../..'),u='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',source='33333333-3333-4333-8333-333333333333',s1='44444444-4444-4444-8444-444444444444',s2='55555555-5555-4555-8555-555555555555';
const vm=require('vm');
function bind(name,ctx){const text=fs.readFileSync(p.join(root,'app/components/SopralluogoAppunti.tsx'),'utf8'),ast=ts.createSourceFile('editor.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found;function walk(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)found=n.initializer;ts.forEachChild(n,walk)}walk(ast);if(!found)throw Error('Handler assente '+name);return vm.runInNewContext(ts.transpileModule('('+found.getText(ast)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{structuredClone,JSON,Map,Error,...ctx})}
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const resolve=Module._resolveFilename;Module._resolveFilename=function(n,...args){return resolve.call(this,n.startsWith('@/')?p.join(root,n.slice(2)):n,...args)};
global.FileReader=class{readAsDataURL(b){b.arrayBuffer().then(v=>{this.result='data:'+b.type+';base64,'+Buffer.from(v).toString('base64');this.onload()}).catch(()=>this.onerror())}};
const {richiamaProgetto}=require(p.join(root,'app/engines/quaderno/richiamo.ts')),ops=require(p.join(root,'app/engines/quaderno/operazioni.ts'));
const doc={titolo:'Nota esistente',testo:'BOZZA',checklist:[],disegni:[{id:'pagina-esistente',titolo:'Pagina',disegni:[],sfondoDisegno:null,oggettiGrafici:[],workspaceY:0}],analisi_ai:null};
async function banco(){
 const db=new PGlite();await db.exec(`create schema auth;create schema storage;create role authenticated;create role anon;create table auth.users(id uuid primary key);insert into auth.users values('${u}'),('${other}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;create table storage.buckets(id text primary key,name text,public boolean);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema auth,storage,public to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated,anon;create policy generale on storage.objects for all to public using(true) with check(true);create table public.sopralluoghi(id uuid primary key);insert into sopralluoghi values('${s1}'),('${s2}');grant select on sopralluoghi to authenticated;`);
 for(const file of ['20260618_note_sopralluogo.sql','20261022_quaderno_progetti.sql','20261023_quaderno_richiamo_sopralluogo.sql'])await db.exec(fs.readFileSync(p.join(root,'supabase/migrations',file),'utf8').replace('create extension if not exists pgcrypto;',''));
 await db.exec('grant select,insert,update,delete on note_sopralluogo,note_allegati to authenticated,anon');
 const user=(fn,uid=u,role='authenticated')=>db.transaction(async tx=>{await tx.exec('set local role '+role);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);return fn(tx)});
 const src={...doc,titolo:'Sorgente autentica',testo:'TESTO SORGENTE',disegni:[{...doc.disegni[0],id:'page-source',oggettiGrafici:[{id:'img',tipo:'immagine',sorgente:'quaderno-storage:'+encodeURIComponent('source/image'),transform:{x:0,y:0,width:10,height:10,rotation:0}}]}]};
 await user(tx=>tx.query('insert into quaderno_progetti(id,user_id,titolo,testo,checklist,disegni) values($1,$2,$3,$4,$5,$6)',[source,u,src.titolo,src.testo,'[]',JSON.stringify(src.disegni)]));
 const bytes=new Map([['quaderno-privato:source/image',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=','base64')],{type:'image/png'})],['quaderno-privato:source/file',new Blob(['ALLEGATO'],{type:'text/plain'})]]);
 await user(tx=>tx.query("insert into quaderno_allegati(id,nota_id,user_id,nome_file,tipo,mime_type,storage_bucket,storage_path) values(gen_random_uuid(),$1,$2,'prova.txt','allegato','text/plain','quaderno-privato','source/file')",[source,u]));
 const journal=new Map(),archivio={leggi:async k=>structuredClone(journal.get(k)),scrivi:async r=>{journal.set(r.chiave,structuredClone(r))},elimina:async k=>{journal.delete(k)}};
 const flags={},calls=[],removed=[];
 const functions={prepara_richiamo_quaderno:['p_id','p_sopralluogo','p_sorgente','p_sorgente_versione','p_documento','p_assets','p_versione'],completa_richiamo_quaderno:['p_richiamo'],esito_richiamo_quaderno:['p_id'],annulla_richiamo_quaderno:['p_id','p_sopralluogo'],conferma_richiamo_quaderno:['p_id','p_pulizia'],salva_nota_quaderno:['p_sopralluogo','p_documento','p_versione']};
 const rpc=async(name,args,uid=u)=>user(tx=>tx.query('select public.'+name+'('+functions[name].map((_,i)=>'$'+(i+1)).join(',')+') r',functions[name].map(k=>typeof args[k]==='object'&&args[k]!==null?JSON.stringify(args[k]):args[k]??null)),uid).then(r=>r.rows[0].r);
 const client={auth:{getUser:async()=>({data:{user:{id:u}},error:null})},from(table){const filters=[];const b={select(){return b},eq(k,v){filters.push([k,v]);return b},is(k,v){filters.push([k,v]);return b},single:()=>run(true),maybeSingle:()=>run(true),then:(yes,no)=>run(false).then(yes,no)};async function run(single){try{const rows=(await user(tx=>tx.query('select * from '+table))).rows.filter(r=>filters.every(([k,v])=>r[k]===v));return{data:single?rows[0]||null:rows,error:null}}catch(error){return{error,data:null}}}return b},rpc:async(name,args)=>{calls.push(name);try{const data=await rpc(name,args);if(flags.commitLost&&name==='completa_richiamo_quaderno')throw Error('risposta commit persa');return{data,error:null}}catch(error){return{error,data:null}}},storage:{from(bucket){return{download:async path=>({data:bytes.get(bucket+':'+path),error:bytes.has(bucket+':'+path)?null:Error('File assente')}),upload:async(path,blob)=>{try{await user(tx=>tx.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,path]));bytes.set(bucket+':'+path,blob);if(flags.uploadLost)throw Error('risposta upload persa');return{data:{path},error:null}}catch(error){return{error,data:null}}},remove:async paths=>{removed.push(...paths);await user(tx=>tx.query('delete from storage.objects where bucket_id=$1 and name=any($2::text[])',[bucket,paths]));paths.forEach(path=>bytes.delete(bucket+':'+path));return{error:null}}}}}};
 const start=(sop=s1,current=doc,version=null)=>richiamaProgetto({supabase:client,progettoId:source,sopralluogoId:sop,attuale:current,versioneNota:version,ancoraAttivo:()=>true,archivio});
 return{db,user,client,rpc,flags,calls,removed,bytes,journal,archivio,start};
}
test('protocollo recuperabile con runtime reale e SQL PGlite; SDK/Auth/Storage adattati',async t=>{
 const h=await banco();t.after(()=>h.db.close());
 let first;
 await t.test('commit perso e riapertura: stesso ID, risultato server, una sola copia',async()=>{
  h.flags.commitLost=true;await a.rejects(h.start(),e=>{console.log('ERRORE SIMULATO:',e.message);return true});
  const pending=await ops.trovaOperazione(h.client,s1,h.archivio);a(pending.id);a.equal(pending.id,pending.locale.preparazione.p_id);
  first=await ops.risolviOperazione(h.client,pending.id);a.equal(first.richiamo.stato,'completato');a.equal(first.nota.disegni.length,2);a.equal(first.allegati.length,2);
  await a.rejects(h.start());a.equal((await h.db.query('select * from quaderno_richiami_sopralluogo')).rows.length,1);
  const again=await h.rpc('completa_richiamo_quaderno',{p_richiamo:pending.id});a.deepEqual(again.nota,first.nota);a.equal(h.removed.length,0);
  await h.rpc('conferma_richiamo_quaderno',{p_id:pending.id,p_pulizia:false});await h.archivio.elimina(pending.locale.chiave);h.flags.commitLost=false;
 });
 await t.test('due richiami intenzionali e sorgente eliminata: copie indipendenti',async()=>{
  const second=await h.start(s1,first.nota,first.nota.updated_at);a.notEqual(second.richiamo.id,first.richiamo.id);a.equal(second.nota.disegni.length,3);a.notEqual(second.nota.disegni[1].id,second.nota.disegni[2].id);
  await h.rpc('conferma_richiamo_quaderno',{p_id:second.richiamo.id,p_pulizia:false});await h.archivio.elimina(ops.chiaveOperazione(u,s1));
  const cancelled=await ops.pulisciAnnullato(h.client,second.richiamo.id,s1);a.equal(cancelled.richiamo.stato,'completato');a.equal(h.removed.length,0);
 });
 await t.test('upload riuscito risposta persa: manifesto durevole, annullamento prima impedisce complete e consente pulizia',async()=>{
  h.flags.uploadLost=true;await a.rejects(h.start(s2));const pending=await ops.trovaOperazione(h.client,s2,h.archivio);
  const esito=await ops.risolviOperazione(h.client,pending.id);a.equal(esito.richiamo.assets.length,2);a(h.bytes.has('quaderno-sopralluoghi:'+esito.richiamo.assets[0].storage_path));
  await ops.pulisciAnnullato(h.client,pending.id,s2);a.equal(h.removed.length,2);await a.rejects(h.rpc('completa_richiamo_quaderno',{p_richiamo:pending.id}),e=>e.code==='55000');
  a.equal((await h.db.query('select * from note_sopralluogo where sopralluogo_id=$1',[s2])).rows.length,0);h.flags.uploadLost=false;await h.archivio.elimina(pending.locale.chiave);
 });
 await t.test('stesso ID con altro payload rifiutato, anche dopo completamento',async()=>{
  const r=(await h.db.query('select * from quaderno_richiami_sopralluogo where id=$1',[first.richiamo.id])).rows[0];
  await a.rejects(h.rpc('prepara_richiamo_quaderno',{p_id:r.id,p_sopralluogo:r.sopralluogo_id,p_sorgente:r.sorgente_id,p_sorgente_versione:r.sorgente_updated_at,p_versione:r.versione_base,p_documento:{...r.input_documento,testo:'DIVERSO'},p_assets:r.assets}),e=>e.code==='22023');
 });
 await t.test('nota assente, creazione concorrente e salvataggio ordinario obsoleto: 40001 senza sovrascrittura',async()=>{
  const server=await h.rpc('salva_nota_quaderno',{p_sopralluogo:s2,p_documento:{...doc,testo:'CONCORRENTE'},p_versione:null});
  await a.rejects(h.rpc('salva_nota_quaderno',{p_sopralluogo:s2,p_documento:doc,p_versione:null}),e=>e.code==='40001');
  const updated=await h.rpc('salva_nota_quaderno',{p_sopralluogo:s2,p_documento:{...doc,testo:'AGGIORNATO'},p_versione:server.updated_at});
  await a.rejects(h.rpc('salva_nota_quaderno',{p_sopralluogo:s2,p_documento:doc,p_versione:server.updated_at}),e=>e.code==='40001');a.equal((await h.db.query('select testo from note_sopralluogo where id=$1',[updated.id])).rows[0].testo,'AGGIORNATO');
 });
 await t.test('target inesistente, altro utente, anon e contenuto provenienza server',async()=>{
  await a.rejects(h.rpc('salva_nota_quaderno',{p_sopralluogo:crypto.randomUUID(),p_documento:doc,p_versione:null}),e=>e.code==='42501');
  await a.rejects(h.rpc('esito_richiamo_quaderno',{p_id:first.richiamo.id},other),e=>e.code==='42501');
  const rows=await h.user(tx=>tx.query("select * from storage.objects where bucket_id='quaderno-sopralluoghi'"),other);a.equal(rows.rows.length,0);
  const anon=await h.user(tx=>tx.query("select * from storage.objects where bucket_id='quaderno-sopralluoghi'"),'','anon');a.equal(anon.rows.length,0);
  a.equal(first.nota.disegni[1].provenienzaQuaderno.titolo,'Sorgente autentica');
  await h.user(tx=>tx.query('delete from quaderno_progetti where id=$1',[source]));
  const after=await ops.risolviOperazione(h.client,first.richiamo.id);a(after.allegati.length);for(const f of after.allegati)a(h.bytes.has('quaderno-sopralluoghi:'+f.storage_path));
 });
 await t.test('tombstone prima della preparazione e upload dopo annullamento rifiutati',async()=>{
  const id=crypto.randomUUID();const r=await h.rpc('annulla_richiamo_quaderno',{p_id:id,p_sopralluogo:s2});a.equal(r.richiamo.stato,'annullato');
  await a.rejects(h.rpc('completa_richiamo_quaderno',{p_richiamo:id}),e=>e.code==='55000');
  await a.rejects(h.user(tx=>tx.query("insert into storage.objects(bucket_id,name) values('quaderno-sopralluoghi',$1)",['utenti/'+u+'/richiami/'+id+'/'+crypto.randomUUID()])));
  await h.rpc('conferma_richiamo_quaderno',{p_id:id,p_pulizia:true});
 });
});
test('handler reali editor: conflitto, Annulla, blocco salvataggio e riconciliazione senza sovrascrittura',async t=>{
 const h=await banco();t.after(()=>h.db.close());
 const server=await h.rpc('salva_nota_quaderno',{p_sopralluogo:s1,p_documento:{...doc,testo:'CONCORRENTE'},p_versione:null});
 let message='',reload=0;const ctx={documentoId:s1,pronto:true,progettoQuadernoId:undefined,richiamoAperto:false,
 salvataggioInCorsoRef:{current:false},richiamoBusyRef:{current:false},richiamoIncertoRef:{current:false},versioneNotaRef:{current:null},
 preparaContenuto:()=>structuredClone(doc),supabase:h.client,rpcQuaderno:ops.rpcQuaderno,archivioOperazioni:h.archivio,chiaveOperazione:ops.chiaveOperazione,
 setSalvataggioInCorso(){},setStato:v=>{message=v},setQuadernoDirty(){},setRichiamoIncerto(){},setRichiamoAperto(){},setBozzaSeparata(){},erroreQuaderno:e=>[e.code,e.message].join(' ')};
 const save=bind('salvaNota',ctx);a.equal(await save(),null);a(ctx.richiamoIncertoRef.current);a(message.includes('40001'));a((await h.archivio.leggi(ops.chiaveOperazione(u,s1))).conflitto);
 // Annulla del pannello cambia soltanto l'apertura; il ref conflitto resta vero.
 ctx.richiamoAperto=false;const calls=h.calls.length;a.equal(await bind('salvaNota',ctx)(),null);a.equal(h.calls.length,calls);
 const recover=bind('riconciliaRichiamo',{...ctx,bozzaSeparata:doc,setRichiamoInCorso(){},setOperazioneDaRiprendere(){},setRicaricaNota(){reload++},documentoAttivoRef:{current:s1},trovaOperazione:(s,id)=>ops.trovaOperazione(s,id,h.archivio)});
 await recover(false);a.equal(reload,1);a.equal((await h.db.query('select testo from note_sopralluogo where id=$1',[server.id])).rows[0].testo,'CONCORRENTE');
 a.equal((await h.archivio.leggi(ops.chiaveOperazione(u,s1)+':bozza')).bozza.testo,'BOZZA');
});
test('preparazione su nota assente, creazione concorrente prima del completamento: 40001 conserva la nuova nota',async t=>{
 const h=await banco();t.after(()=>h.db.close());h.flags.uploadLost=true;await a.rejects(h.start());
 const pending=await ops.trovaOperazione(h.client,s1,h.archivio),result=await ops.risolviOperazione(h.client,pending.id);
 for(const file of result.richiamo.assets)if(!h.bytes.has('quaderno-sopralluoghi:'+file.storage_path)){
  const r=await h.client.storage.from('quaderno-sopralluoghi').upload(file.storage_path,new Blob(['FILE DI PROVA']));
  // Il banco continua a perdere risposte, ma il record Storage e stato inserito.
  a(r.error);
 }
 const server=await h.rpc('salva_nota_quaderno',{p_sopralluogo:s1,p_documento:{...doc,testo:'NOTA CREATA ALTROVE'},p_versione:null});
 await a.rejects(h.rpc('completa_richiamo_quaderno',{p_richiamo:pending.id}),e=>e.code==='40001');
 a.equal((await h.db.query('select testo from note_sopralluogo where id=$1',[server.id])).rows[0].testo,'NOTA CREATA ALTROVE');
 await ops.pulisciAnnullato(h.client,pending.id,s1);
 a.equal((await h.db.query('select testo from note_sopralluogo where id=$1',[server.id])).rows[0].testo,'NOTA CREATA ALTROVE');
});
test('handler reale copia: modifiche locali durante attesa non dichiarate salvate',async t=>{
 const h=await banco();t.after(()=>h.db.close());let current=structuredClone(doc),release,started;
 const ready=new Promise(r=>started=r),wait=new Promise(r=>release=r);let applied=0;
 const ctx={documentoId:s1,documentoAttivoRef:{current:s1},richiamoBusyRef:{current:false},salvataggioInCorsoRef:{current:false},richiamoIncertoRef:{current:false},versioneNotaRef:{current:null},
 preparaContenuto:()=>current,supabase:h.client,setRichiamoInCorso(){},setRichiamoIncerto(){},setBozzaSeparata(){},setOperazioneDaRiprendere(){},setStato(){},
 richiamaProgetto:async args=>{const result=await h.start(s1,args.attuale);started();await wait;return result},applicaEsitoPersistito:()=>{applied++},archivioOperazioni:h.archivio,chiaveOperazione:ops.chiaveOperazione,
 trovaOperazione:(s,id)=>ops.trovaOperazione(s,id,h.archivio),EsitoRichiamoIncerto:require(p.join(root,'app/engines/quaderno/richiamo.ts')).EsitoRichiamoIncerto,erroreQuaderno:e=>e.message};
 const pending=bind('aggiungiDallArchivio',ctx)(source);await ready;current={...current,testo:'MODIFICA DURANTE COPIA'};release();await a.rejects(pending);
 a.equal(applied,0);a(ctx.richiamoIncertoRef.current);a.equal((await h.archivio.leggi(ops.chiaveOperazione(u,s1))).bozza.testo,'MODIFICA DURANTE COPIA');
 a.equal((await h.db.query('select testo from note_sopralluogo')).rows[0].testo.includes('MODIFICA DURANTE COPIA'),false);
});
test('ripresa completata rilegge la nota attuale, non il documento pianificato; hash manifesto vincolato all ID',async t=>{
 const h=await banco();t.after(()=>h.db.close());const first=await h.start();
 const updated=await h.rpc('salva_nota_quaderno',{p_sopralluogo:s1,p_documento:{...first.nota,testo:'MODIFICA SERVER SUCCESSIVA'},p_versione:first.nota.updated_at});
 const resumed=await h.rpc('completa_richiamo_quaderno',{p_richiamo:first.richiamo.id});a.equal(resumed.nota.testo,updated.testo);a.equal(resumed.nota.disegni.length,2);
 const row=(await h.db.query('select * from quaderno_richiami_sopralluogo where id=$1',[first.richiamo.id])).rows[0],assets=structuredClone(row.assets);assets[0].sha256='0'.repeat(64);
 await a.rejects(h.rpc('prepara_richiamo_quaderno',{p_id:row.id,p_sopralluogo:row.sopralluogo_id,p_sorgente:row.sorgente_id,p_sorgente_versione:row.sorgente_updated_at,p_versione:row.versione_base,p_documento:row.input_documento,p_assets:assets}),e=>e.code==='22023');
});
test('due immagini identiche riaperte mantengono distinti i riferimenti privati delle copie',async()=>{
 const storage=require(p.join(root,'app/engines/quaderno/storagePrivato.ts')),refs=new Map();
 const one=storage.riferimentoFileQuaderno('utenti/u/richiami/r1/x','quaderno-sopralluoghi'),two=storage.riferimentoFileQuaderno('utenti/u/richiami/r2/x','quaderno-sopralluoghi');
 const resolved=await storage.risolviSorgentiPrivate([one,two],{storage:{from:()=>({download:async()=>({data:new Blob(['STESSI BYTE'],{type:'image/png'}),error:null})})}},refs);
 a.notEqual(resolved[0],resolved[1]);a.deepEqual(storage.ripristinaSorgentiPrivate(resolved,refs),[one,two]);
});

test('annullamento UUID mai preparato con altro richiamo aperto: tombstone durevole senza liberare asset',async t=>{
 const h=await banco();t.after(()=>h.db.close());h.flags.uploadLost=true;await a.rejects(h.start(s1));
 const A=(await h.db.query('select * from quaderno_richiami_sopralluogo')).rows[0],B=crypto.randomUUID();a.equal(A.confermato_at,null);a(A.assets.length);
 const cancel=()=>h.rpc('annulla_richiamo_quaderno',{p_id:B,p_sopralluogo:s1});
 const b=(await cancel()).richiamo;a.equal(b.stato,'annullato');a.deepEqual(b.assets,[]);a(b.confermato_at);a(b.pulito_at);
 a.deepEqual((await h.db.query('select * from quaderno_richiami_sopralluogo where id=$1',[A.id])).rows[0],A);
 a.deepEqual((await cancel()).richiamo,b);
 const late=async()=>{await a.rejects(h.rpc('prepara_richiamo_quaderno',{p_id:B,p_sopralluogo:s1,p_sorgente:A.sorgente_id,p_sorgente_versione:A.sorgente_updated_at,p_documento:A.input_documento,p_assets:[],p_versione:A.versione_base}),e=>e.code==='22023');await a.rejects(h.rpc('completa_richiamo_quaderno',{p_richiamo:B}),e=>e.code==='55000')};
 await late();await h.rpc('annulla_richiamo_quaderno',{p_id:A.id,p_sopralluogo:s1});
 const dirty=(await h.db.query('select * from quaderno_richiami_sopralluogo where id=$1',[A.id])).rows[0];a.equal(dirty.confermato_at,null);a.equal(dirty.pulito_at,null);
 await a.rejects(h.rpc('conferma_richiamo_quaderno',{p_id:A.id,p_pulizia:true}),e=>e.code==='55000');
 await ops.pulisciAnnullato(h.client,A.id,s1);await late();a.deepEqual((await cancel()).richiamo,b);
 const C=crypto.randomUUID();const c=(await h.rpc('annulla_richiamo_quaderno',{p_id:C,p_sopralluogo:s2})).richiamo;a.equal(c.stato,'annullato');a(c.confermato_at);a(c.pulito_at);a.deepEqual((await h.rpc('annulla_richiamo_quaderno',{p_id:C,p_sopralluogo:s2})).richiamo,c);
 a.equal((await h.db.query('select stato from quaderno_richiami_sopralluogo where id=$1',[B])).rows[0].stato,'annullato');
});
