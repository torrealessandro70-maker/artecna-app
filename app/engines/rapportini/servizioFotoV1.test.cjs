// Storage e registro simulati; decoder sharp reale. Nessuna Storage API/Production.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const ts=require('typescript'),sharp=require('sharp'),{createHash}=require('node:crypto')
const cache=new Map(),calls=[]
let rpc=async()=>({data:{id:'worker'},error:null})
function load(name){
 if(cache.has(name))return cache.get(name)
 const m={exports:{}};cache.set(name,m.exports)
 const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
 new Function('require','module','exports',js)(id=>{
  if(id==='server-only')return{}
  if(id==='./adapterPortalePostgres.server')return{rpcPortalePostgres:async(n,p)=>{calls.push({n,p});return rpc(n,p)}}
  if(id==='./servizioRapportini.server')return{tokenSessioneRapportino:h=>h?.match(/artecna_rapportino_sessione=([a-f0-9]{64})/)?.[1]??null}
  return id.startsWith('./')?load(id.slice(2)):require(id)
 },m,m.exports);cache.set(name,m.exports);return m.exports
}
const service=load('servizioFotoV1.server'),{creaTrasportoHttpFotoV1}=load('trasportoHttpFotoV1')
const {registroFotoMobile}=load('registroFotoMobile.server')
const uuid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`
const digest=b=>createHash('sha256').update(b).digest('hex')
let bytes,input
function request(p=input,b=bytes,headers={}){return new Request('http://localhost/api/rapportino/foto',{method:'POST',headers:{origin:'http://localhost','content-type':p.mime_type,'x-artecna-foto':JSON.stringify(p),...headers},body:b})}
function fixture(options={}){
 let object=null,state='prenotato',active=false,reserves=0,creates=0,finalizes=0
 const canonical=`rapportini/${input.cantiere_id}/${input.rapportino_id}/${input.chiave_client_allegato}.png`
 const row=()=>({versione_contratto:1,esito:'successo',allegato_id:uuid(5),stato:state,upload_necessario:state!=='finalizzato',bucket:'rapportini-v1',file_path:canonical,mime_type:input.mime_type,byte_size:input.byte_size,lease_id:state==='finalizzato'?null:uuid(6),lease_until:state==='finalizzato'?null:new Date(Date.now()+120000).toISOString()})
 const operation={reserve:async()=>{reserves++;if(options.concurrent&&active&&state!=='finalizzato')throw new service.ErroreFotoV1(409,'PR409');active=true;if(options.reserveError)throw Error('risposta prenotazione persa');return {...row(),...options.row}},finalize:async(id,lease)=>{assert.equal(id,uuid(5));assert.equal(lease,uuid(6));finalizes++;if(options.finalError)throw Error('DB rollback');state='finalizzato';if(options.lostFinalize&&finalizes===1)throw Error('risposta finalizzazione persa');return{versione_contratto:1,esito:'successo',allegato_id:uuid(5),stato:state,foto_cantiere_id:uuid(7)}}}
 const mobile={canale:'mobile',authorize:async(req)=>{if(options.deny)throw new service.ErroreFotoV1(403,'autorizzazione');return operation}}
 const storage={read:async(bucket,p,max)=>{assert.equal(bucket,'rapportini-v1');assert.equal(p,canonical);assert.equal(max,4000000);return options.corrupt?Buffer.from('diverso'):object},create:async(bucket,p,b,mime)=>{assert.equal(p,canonical);assert.equal(mime,'image/png');creates++;if(object)return'exists';object=Buffer.from(b);if(options.lostUpload)throw Error('risposta upload persa');return'created'}}
 const http=service.creaHttpFotoV1({mobile,storage})
 return{http,mobile,storage,operation,stats:()=>({reserves,creates,finalizes,state,object})}
}
test('F4A servizio e HTTP: decoder reale, DB/Storage simulati',async t=>{
 const run=async(name,fn)=>{let error;await t.test(name,async()=>{try{await fn()}catch(e){error=e;throw e}});if(error)throw error}
 bytes=await sharp({create:{width:3,height:2,channels:3,background:'#123456'}}).png().toBuffer()
 input={rapportino_id:uuid(1),cantiere_id:uuid(2),data:'2026-10-08',chiave_client_allegato:uuid(3),sha256:digest(bytes),mime_type:'image/png',byte_size:bytes.length}
 await run('upload e finalizzazione, DTO senza bucket/path/lease',async()=>{const f=fixture();const r=await f.http(request());assert.equal(r.status,200);const body=await r.json();assert.deepEqual(Object.keys(body).sort(),['allegato','rapportino_id','versione_contratto']);assert.equal(body.allegato.stato,'finalizzato');assert.deepEqual(f.stats(),{reserves:1,creates:1,finalizes:1,state:'finalizzato',object:bytes})})
 await run('JPEG/PNG/WebP decodificati realmente',async()=>{for(const [format,mime]of[['jpeg','image/jpeg'],['png','image/png'],['webp','image/webp']]){const b=await sharp(bytes)[format]().toBuffer();await service.verificaBytesFotoV1(b,{...input,sha256:digest(b),mime_type:mime,byte_size:b.length})}})
 await run('byte invalidi, MIME falso, hash/peso falsi prima della prenotazione',async()=>{const bad=Buffer.from('non immagine');for(const [p,b]of[[{...input,sha256:digest(bad),byte_size:bad.length},bad],[{...input,mime_type:'image/jpeg'},bytes],[{...input,sha256:'a'.repeat(64)},bytes],[{...input,byte_size:1},bytes]]){const f=fixture();assert.equal((await f.http(request(p,b))).status,400);assert.equal(f.stats().reserves,0)}})
 await run('limite 4MB in streaming e limite 24MP',async()=>{const f=fixture();assert.equal((await f.http(request(input,Buffer.alloc(4000001)))).status,413);assert.equal(f.stats().reserves,0);const b=await sharp({create:{width:5000,height:5000,channels:3,background:'#fff'}}).png().toBuffer();await assert.rejects(()=>service.verificaBytesFotoV1(b,{...input,byte_size:b.length,sha256:digest(b)}),e=>e.codice==='immagine')})
 await run('immagine troncata rifiutata',async()=>{const b=bytes.subarray(0,bytes.length-20);await assert.rejects(()=>service.verificaBytesFotoV1(b,{...input,byte_size:b.length,sha256:digest(b)}),e=>e.codice==='immagine')})
 await run('origine, autorizzazione e campi path client negati',async()=>{for(const req of[request(input,bytes,{origin:'http://evil'}),request({...input,bucket:'preventivi'}),request({...input,file_path:'evil'})]){const f=fixture();assert([400,403].includes((await f.http(req)).status));assert.equal(f.stats().reserves,0)}const f=fixture({deny:true});assert.equal((await f.http(request())).status,403);assert.equal(f.stats().creates,0)})
 await run('isolamento Desktop/Mobile, nessun fallback cookie',async()=>{const f=fixture();assert.equal((await f.http(request(input,bytes,{authorization:'Bearer jwt',cookie:'artecna_rapportino_sessione='+'a'.repeat(64)}))).status,503);assert.equal(f.stats().reserves,0);let desktopCalls=0;const desktop={canale:'desktop',authorize:async req=>{assert.equal(req.headers.get('authorization'),'Bearer trusted-test');desktopCalls++;return f.operation}};const h=service.creaHttpFotoV1({mobile:{canale:'mobile',authorize:async()=>{throw Error('Mobile non deve essere chiamato')}},desktop,storage:f.storage});assert.equal((await h(request(input,bytes,{authorization:'Bearer trusted-test'}))).status,200);assert.equal(desktopCalls,1)})
 await run('Mobile adapter sessione e RPC autorevoli, materiali V2 senza writer',async()=>{calls.length=0;rpc=async()=>({data:{id:'worker'},error:null});await assert.rejects(()=>registroFotoMobile.authorize(request(),input),e=>e.status===401);const op=await registroFotoMobile.authorize(request(input,bytes,{cookie:'artecna_rapportino_sessione='+'a'.repeat(64)}),input);await op.reserve();await op.finalize(uuid(5),uuid(6));assert.deepEqual(calls.map(x=>x.n),['verifica_sessione_rapportino','prenota_allegato_rapportino_portale','finalizza_allegato_rapportino_portale']);assert.equal(calls[1].p.p_rapportino_id,input.rapportino_id);assert(!calls.some(x=>x.n.includes('salva')));rpc=async()=>({data:null,error:{code:'42501'}});await assert.rejects(()=>registroFotoMobile.authorize(request(input,bytes,{cookie:'artecna_rapportino_sessione='+'a'.repeat(64)}),input),e=>e.status===403)})
 await run('Storage assente fail-closed, nessuna prenotazione',async()=>{const f=fixture();const h=service.creaHttpFotoV1({mobile:f.mobile});assert.equal((await h(request())).status,503);assert.equal(f.stats().reserves,0)})
 await run('upload committato con risposta persa riconciliato via rilettura',async()=>{const f=fixture({lostUpload:true});assert.equal((await f.http(request())).status,200);assert.equal(f.stats().creates,1);assert.equal(f.stats().finalizes,1)})
 await run('finalizzazione committata con risposta persa, stesso lease e nessun duplicato',async()=>{const f=fixture({lostFinalize:true});assert.equal((await f.http(request())).status,200);assert.equal(f.stats().finalizes,2);assert.equal((await f.http(request())).status,200);assert.equal(f.stats().creates,1);assert.equal(f.stats().finalizes,2)})
 await run('oggetto incoerente non sovrascritto/non finalizzato',async()=>{const f=fixture({corrupt:true});assert.equal((await f.http(request())).status,409);assert.equal(f.stats().creates,0);assert.equal(f.stats().finalizes,0)})
 await run('path divergente dal registro abort prima di Storage',async()=>{const f=fixture({row:{file_path:'arbitrario'}});assert.equal((await f.http(request())).status,503);assert.equal(f.stats().creates,0)})
 await run('lease concorrente: un successo e un conflitto',async()=>{
  const f=fixture({concurrent:true}),reserve=f.operation.reserve
  let signalAcquired,release,timer,first
  const acquired=new Promise(resolve=>{signalAcquired=resolve})
  const barrier=new Promise(resolve=>{release=resolve})
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Timeout barriera lease: 5s')),5000)})
  f.operation.reserve=async()=>{const result=await reserve();if(f.stats().reserves===1){signalAcquired();await barrier}return result}
  try{
   first=f.http(request())
   await Promise.race([acquired,deadline])
   assert.equal(f.stats().state,'prenotato');assert.equal(f.stats().creates,0);assert.equal(f.stats().finalizes,0)
   const concurrent=await Promise.race([f.http(request()),deadline])
   assert.equal(concurrent.status,409);assert.deepEqual(await concurrent.json(),{codice:'PR409'})
   assert.equal(f.stats().reserves,2);assert.equal(f.stats().creates,0);assert.equal(f.stats().finalizes,0)
   release()
   assert.equal((await Promise.race([first,deadline])).status,200)
   assert.equal(f.stats().creates,1);assert.equal(f.stats().finalizes,1)
  }finally{release();clearTimeout(timer);if(first)await first}
 })
 await run('retry dopo finalizzazione: stessa chiave/byte, nessun upload o foto duplicati',async()=>{
  const f=fixture({concurrent:true}),initial=await f.http(request())
  assert.equal(initial.status,200);const result=await initial.json(),before=f.stats()
  const retry=await f.http(request());assert.equal(retry.status,200);assert.deepEqual(await retry.json(),result)
  assert.equal(f.stats().reserves,2);assert.equal(f.stats().creates,before.creates);assert.equal(f.stats().finalizes,before.finalizes)
  assert.equal(f.stats().creates,1);assert.equal(f.stats().finalizes,1);assert.deepEqual(f.stats().object,bytes)
 })
 await run('rollback DB simulato conserva prenotazione e oggetto per recupero',async()=>{const f=fixture({finalError:true});assert.equal((await f.http(request())).status,503);assert.equal(f.stats().state,'prenotato');assert.deepEqual(f.stats().object,bytes)})
 await run('risposta prenotazione persa non autorizza upload; scadenza dopo commit',async()=>{const f=fixture({reserveError:true});assert.equal((await f.http(request())).status,503);assert.equal(f.stats().creates,0);const expired=fixture({row:{esito:'scaduto_persistito_con_conflitto',stato:'scaduto',upload_necessario:false,lease_id:null,lease_until:null}});assert.equal((await expired.http(request())).status,409);assert.equal(expired.stats().creates,0)})
 await run('trasporto HTTP: Blob, stessa chiave retry, risposta HTTP persa',async()=>{const f=fixture();let lost=true;const transport=creaTrasportoHttpFotoV1('/api/rapportino/foto',async(url,init)=>{const response=await f.http(new Request('http://localhost'+url,init));if(lost){lost=false;throw Error('risposta HTTP persa')}return response});const photo={contesto:{rapportino_id:input.rapportino_id,cantiere_id:input.cantiere_id,data:input.data},chiave_client_allegato:input.chiave_client_allegato,sha256:input.sha256,mime_type:input.mime_type,byte_size:input.byte_size,blob:new Blob([bytes],{type:'image/png'})};await assert.rejects(()=>transport.caricaFoto(photo));const result=await transport.ritentaFoto(photo);assert.equal(result.allegato.allegato_id,uuid(5));assert.equal(f.stats().creates,1);assert.equal(f.stats().finalizes,1)})
})
