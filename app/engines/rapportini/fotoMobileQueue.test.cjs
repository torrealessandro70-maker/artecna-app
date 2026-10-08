// Browser/IndexedDB emulati per test controllati. Non certifica un browser reale o Storage API.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const ts=require('typescript'),{webcrypto}=require('node:crypto')
const cache=new Map()
function load(name){if(cache.has(name))return cache.get(name);const m={exports:{}};const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',js)(id=>load(id.slice(2)),m,m.exports);cache.set(name,m.exports);return m.exports}
const {FotoMobileQueue,factoryFotoOperaio,lockFotoOperaio,statoVisibileFoto}=load('fotoMobileQueue')
const {CodaFotoRapportinoV1}=load('fotoRapportinoV1'),{RepositoryCodaFotoIndexedDB}=load('codaFotoIndexedDB')
const {creaTrasportoHttpFotoV1}=load('trasportoHttpFotoV1')
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`
const ctx={cantiere_id:id(1),data:'2026-10-08',rapportino_id:null},saved={...ctx,rapportino_id:id(2)}
const blob=()=>new Blob(['bytes-test'],{type:'image/jpeg'})
const lock=action=>action()
function indexedDBFixture(){
 const databases=new Map(),opened=[]
 const factory={open(name){opened.push(name);if(!databases.has(name))databases.set(name,new Map());const persistent=databases.get(name);let closed=false
  const db={close(){closed=true},transaction(){if(closed)throw Error('DB chiuso');const staged=new Map(persistent),tx={error:null,abort(){this.error=new Error('abort');queueMicrotask(()=>this.onabort?.())},objectStore(){return store}}
   const store={transaction:tx,add(f){if(staged.has(f.chiave_client_allegato)){tx.abort();return}staged.set(f.chiave_client_allegato,structuredClone(f))},put(f){staged.set(f.chiave_client_allegato,structuredClone(f))},delete(k){staged.delete(k)},getAll(){const r={};queueMicrotask(()=>{r.result=[...staged.values()].map(f=>structuredClone(f));r.onsuccess?.({target:r})});return r}}
   setImmediate(()=>{if(!tx.error){persistent.clear();for(const [k,v]of staged)persistent.set(k,v);tx.oncomplete?.()}});return tx}}
  const req={result:db};queueMicrotask(()=>req.onsuccess?.());return req}}
 return{factory,opened}
}
async function setup(fixture,owner=id(3),transport={ritentaFoto:async()=>({ok:true})}){const repo=await RepositoryCodaFotoIndexedDB.apri(factoryFotoOperaio(fixture.factory,owner));const queue=new FotoMobileQueue(new CodaFotoRapportinoV1(repo,webcrypto),lock,transport);return{repo,queue}}
test('F4B coda Mobile: IndexedDB emulato, trasporto controllato',async t=>{
 const run=async(n,fn)=>{let e;await t.test(n,async()=>{try{await fn()}catch(error){e=error;throw error}});if(e)throw e}
 await run('selezione Blob/hash e persistente solo dopo commit, attesa UUID',async()=>{const db=indexedDBFixture(),{queue}=await setup(db);await queue.inizializza(ctx);const f=await queue.aggiungi(blob(),ctx);assert.equal(f.stato,'in_coda');assert.equal(f.blob instanceof Blob,true);assert.equal(f.sha256.length,64);assert.equal(statoVisibileFoto(f),'In attesa');assert.equal((await queue.elenca(ctx)).length,1);await assert.rejects(()=>queue.invia(f.chiave_client_allegato,ctx));assert.equal((await queue.elenca(ctx))[0].stato,'in_coda')})
 await run('UUID restituito: associa senza risalvare, materiali V2 usa stesso contesto',async()=>{const db=indexedDBFixture(),{queue}=await setup(db);const f=await queue.aggiungi(blob(),ctx);const list=await queue.inizializza(saved);assert.equal(list[0].contesto.rapportino_id,id(2));assert.equal(list[0].chiave_client_allegato,f.chiave_client_allegato);assert.equal(list[0].stato,'pronta');assert.equal((await queue.elenca(ctx)).length,0)})
 await run('reload conserva Blob/chiave e recupera stato incerto senza invio automatico',async()=>{const db=indexedDBFixture();let sends=0;const a=await setup(db,id(3),{ritentaFoto:async()=>{sends++}});const f=await a.queue.aggiungi(blob(),saved);await a.repo.stato(f.chiave_client_allegato,'caricamento');a.queue.disattiva();a.repo.chiudi();const b=await setup(db,id(3));const list=await b.queue.inizializza(saved);assert.equal(list[0].stato,'errore');assert.equal(list[0].chiave_client_allegato,f.chiave_client_allegato);assert.equal(await list[0].blob.text(),'bytes-test');assert.equal(sends,0)})
 await run('operai separati, nessun import della vecchia coda globale',async()=>{const db=indexedDBFixture(),a=await setup(db,id(3)),b=await setup(db,id(4));await a.queue.aggiungi(blob(),saved);assert.equal((await b.queue.inizializza(saved)).length,0);assert.equal((await a.queue.elenca(saved)).length,1);assert.deepEqual(db.opened,['artecna-rapportino-foto-v1-operaio-'+id(3),'artecna-rapportino-foto-v1-operaio-'+id(4)]);a.queue.disattiva();await assert.rejects(()=>a.queue.aggiungi(blob(),saved),/Sessione/);assert(!JSON.stringify(db.opened).includes('token'))})
 await run('contesto differente non associa/rende visibili foto',async()=>{const db=indexedDBFixture(),{queue}=await setup(db);await queue.aggiungi(blob(),ctx);assert.equal((await queue.inizializza({...saved,cantiere_id:id(9)})).length,0);assert.equal((await queue.elenca(ctx))[0].contesto.rapportino_id,null)})
 await run('HTTP 503 poi retry manuale, chiave/Blob invariati, nessun writer',async()=>{const db=indexedDBFixture(),requests=[];let fail=true;const transport=creaTrasportoHttpFotoV1('/api/rapportino/foto',async(url,options)=>{assert.equal(url,'/api/rapportino/foto');const metadata=JSON.parse(options.headers['x-artecna-foto']);requests.push(metadata);assert.equal(options.body instanceof Blob,true);if(fail)return new Response('{}',{status:503});return Response.json({versione_contratto:1,rapportino_id:metadata.rapportino_id,allegato:{allegato_id:id(8),chiave_client_allegato:metadata.chiave_client_allegato,mime_type:metadata.mime_type,byte_size:metadata.byte_size,stato:'finalizzato'}})});const {queue}=await setup(db,id(3),transport);const f=await queue.aggiungi(blob(),saved);await assert.rejects(()=>queue.invia(f.chiave_client_allegato,saved),/503/);assert.equal((await queue.elenca(saved))[0].stato,'errore');fail=false;await queue.invia(f.chiave_client_allegato,saved);assert.deepEqual(requests[0],requests[1]);assert.equal((await queue.elenca(saved))[0].stato,'completata');await assert.rejects(()=>queue.invia(f.chiave_client_allegato,saved));assert.equal(requests.length,2)})
 await run('lock Web Locks esclude altre schede; indisponibile fail-closed',async()=>{const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');try{Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(name,options,fn)=>{assert.equal(name,'artecna-foto-mobile-'+id(3));assert.equal(options.ifAvailable,true);return fn(null)}}}});let called=false;await assert.rejects(()=>lockFotoOperaio(id(3))(async()=>{called=true}),/altra|un’altra/);assert.equal(called,false);Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});await assert.rejects(()=>lockFotoOperaio(id(3))(async()=>{}),/sicuro/)}finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator}})
 await run('UI/route wiring: anteprima object URL, coda e nessun upload diretto',async()=>{const ui=fs.readFileSync(path.join(__dirname,'../../components/FotoRapportinoMobileV1.tsx'),'utf8'),page=fs.readFileSync(path.join(__dirname,'../../rapportino/page.tsx'),'utf8'),route=fs.readFileSync(path.join(__dirname,'../../api/rapportino/foto/route.ts'),'utf8');assert(ui.includes('URL.createObjectURL(blob)'));assert(ui.includes('URL.revokeObjectURL(value)'));assert(ui.includes('capture="environment"'));assert(ui.includes('accept="image/jpeg,image/png,image/webp"'));assert(ui.includes('Riprova invio'));assert(!ui.includes('supabase.storage'));assert(page.includes('validaUUIDAllegato(statoRapportino.rapportinoId)'));assert(route.includes('creaHttpFotoV1({ mobile: registroFotoMobile, storage: storageFotoV1Configurato() })'));assert(!route.includes('desktop:'));assert(!route.includes('registroFotoDesktop'));assert(!route.includes('process.env'))})
 await run('route Mobile reale: Storage non configurato nega prima della prenotazione',async()=>{
  const modules=new Map()
  function server(name){
   if(modules.has(name))return modules.get(name)
   const m={exports:{}},src=fs.readFileSync(path.join(__dirname,name+'.ts'),'utf8')
   const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
   new Function('require','module','exports','process',js)(p=>p==='server-only'?{}:p.startsWith('./')?server(p.slice(2)):require(p),m,m.exports,{env:{}})
   modules.set(name,m.exports);return m.exports
  }
  const storage=server('storageFotoV1.server');assert.equal(storage.storageFotoV1Configurato(),undefined)
  let authorizations=0,reservations=0
  const mobile={canale:'mobile',authorize:async()=>{authorizations++;return{reserve:async()=>{reservations++;throw Error('prenotazione non consentita')},finalize:async()=>assert.fail('finalizzazione')}}}
  const route={exports:{}},src=fs.readFileSync(path.join(__dirname,'../../api/rapportino/foto/route.ts'),'utf8')
  const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  new Function('require','module','exports',js)(p=>p.endsWith('/servizioFotoV1.server')?server('servizioFotoV1.server'):p.endsWith('/registroFotoMobile.server')?{registroFotoMobile:mobile}:p.endsWith('/storageFotoV1.server')?storage:assert.fail('import inatteso '+p),route,route.exports)
  const input={...saved,chiave_client_allegato:id(5),sha256:'a'.repeat(64),mime_type:'image/jpeg',byte_size:1}
  const response=await route.exports.POST(new Request('http://localhost/api/rapportino/foto',{method:'POST',headers:{'content-type':'image/jpeg','x-artecna-foto':JSON.stringify(input)},body:new Uint8Array([1])}))
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{codice:'storage_non_configurato'});assert.equal(authorizations,1);assert.equal(reservations,0)
 })
})
