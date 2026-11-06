/* eslint-disable @typescript-eslint/no-require-imports */
// In-memory Auth/RPC/Storage; sharp decoder and HTTP service are real. No network.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const ts=require('typescript'),sharp=require('sharp'),{createHash}=require('node:crypto')
const cache=new Map()
function load(name){
 if(cache.has(name))return cache.get(name)
 const m={exports:{}};cache.set(name,m.exports)
 const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
 new Function('require','module','exports',js)(id=>{
  if(id==='server-only')return{}
  if(id==='./adapterPortalePostgres.server')return{rpcPortalePostgres:()=>{throw Error('Real DB forbidden')}}
  return id.startsWith('./')?load(id.slice(2)):require(id)
 },m,m.exports);cache.set(name,m.exports);return m.exports
}
const {creaRegistroFotoDesktop}=load('registroFotoDesktop.server'),{creaHttpFotoV1,ErroreFotoV1}=load('servizioFotoV1.server')
const {creaLetturaHttpFotoDesktop}=load('letturaFotoDesktop.server')
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const hash=b=>createHash('sha256').update(b).digest('hex')
test('Foto desktop: HTTP, attestazione, isolamento e validazione obbligatoria',async t=>{
 const bytes=await sharp({create:{width:4,height:4,channels:3,background:'#123456'}}).png().toBuffer()
 const input={rapportino_id:uuid(1),cantiere_id:uuid(2),data:'2026-11-06',chiave_client_allegato:uuid(3),sha256:hash(bytes),mime_type:'image/png',byte_size:bytes.length}
 const objectPath=`rapportini/${input.cantiere_id}/${input.rapportino_id}/${input.chiave_client_allegato}.png`
 const request=(headers={},body=bytes,meta=input)=>new Request('http://localhost/api/rapportino/foto',{method:'POST',headers:{origin:'http://localhost','content-type':meta.mime_type,'x-artecna-foto':JSON.stringify(meta),...headers},body})
 function fixture(options={}){
  const calls=[];let object=options.object??null,finalized=false,mobile=0
  const capability={async authorize(token){calls.push('verifyJWT');if(token!=='valid')throw new ErroreFotoV1(401,'identita');return{userId:uuid(9),async list(){calls.push('guard');if(options.denied)throw new ErroreFotoV1(403,'cantiere');return{versione_contratto:1,rapportino_id:input.rapportino_id,allegati:finalized?[{allegato_id:uuid(4),foto_cantiere_id:uuid(5),rapportino_id:input.rapportino_id,mime_type:input.mime_type,byte_size:input.byte_size}]:[]}}}},async resolve(){return{versione_contratto:1,allegato_id:uuid(4),bucket:'rapportini-v1',rapportino_id:input.rapportino_id,cantiere_id:input.cantiere_id,foto_cantiere_id:uuid(5),file_path:objectPath,mime_type:input.mime_type,byte_size:input.byte_size,sha256:input.sha256}}}
  const rpc=async(name,p)=>{calls.push({name,p});assert.equal(p.p_user_id,uuid(9));assert(!('p_sessione'in p))
   if(name==='prenota_allegato_rapportino_desktop')return{data:{versione_contratto:1,esito:'successo',stato:'prenotato',allegato_id:uuid(4),bucket:'rapportini-v1',file_path:objectPath,mime_type:input.mime_type,byte_size:input.byte_size,upload_necessario:true,lease_id:uuid(6),lease_until:new Date(Date.now()+(options.expired?-1000:60000)).toISOString()},error:null}
   assert.equal(name,'finalizza_allegato_rapportino_desktop');assert.equal(p.p_lease_id,uuid(6));assert(object&&hash(object)===input.sha256,'Storage verification must precede finalize');finalized=true
   return{data:{versione_contratto:1,esito:'successo',stato:'finalizzato',allegato_id:uuid(4),foto_cantiere_id:uuid(5)},error:null}
  }
  const storage={async read(){calls.push('storageRead');return object},async create(bucket,p,b){calls.push('create');assert.equal(bucket,'rapportini-v1');assert.equal(p,objectPath);assert.equal(object,null,'no overwrite');object=b;return'created'}}
  const registry=creaRegistroFotoDesktop(capability,rpc)
  const http=creaHttpFotoV1({desktop:registry,mobile:{canale:'mobile',async authorize(){mobile++;throw new ErroreFotoV1(401,'sessione')}},storage})
  return{http,registry,capability,storage,calls,stats:()=>({object,finalized,mobile})}
 }
 await t.test('Bearer valido: upload/finalizzazione/elenco/download e subject attestato',async()=>{
  const f=fixture(),r=await f.http(request({authorization:'Bearer valid',cookie:'artecna_rapportino_sessione='+ 'ab'.repeat(32)},bytes,input));assert.equal(r.status,200);assert(f.stats().finalized);assert.equal(f.stats().mobile,0)
  assert.deepEqual(f.calls.slice(0,2),['verifyJWT','guard']);assert(f.calls.indexOf('create')>f.calls.findIndex(x=>x.name==='prenota_allegato_rapportino_desktop'))
  const get=creaLetturaHttpFotoDesktop({capability:f.capability,storage:f.storage})
  const list=await get(new Request('http://localhost/api/desktop/foto?rapportino_id='+input.rapportino_id,{headers:{authorization:'Bearer valid'}}));assert.equal(list.status,200);assert.equal((await list.json()).allegati.length,1)
  const download=await get(new Request('http://localhost/api/desktop/foto/download?allegato_id='+uuid(4),{headers:{authorization:'Bearer valid'}}));assert.equal(download.status,200);assert.equal(hash(Buffer.from(await download.arrayBuffer())),input.sha256)
 })
 await t.test('subject client rifiutato: nessuna RPC',async()=>{const f=fixture();assert.equal((await f.http(request({authorization:'Bearer valid'},bytes,{...input,p_user_id:uuid(99)}))).status,400);assert.deepEqual(f.calls,[])})
 await t.test('cantiere non autorizzato: nessuna RPC mutante o Storage',async()=>{const f=fixture({denied:true});assert.equal((await f.http(request({authorization:'Bearer valid'}))).status,403);assert.deepEqual(f.calls,['verifyJWT','guard']);assert.equal(f.stats().object,null)})
 await t.test('Bearer invalido con cookie mobile: nessun fallback/RPC/Storage',async()=>{const f=fixture();assert.equal((await f.http(request({authorization:'Bearer invalid',cookie:'artecna_rapportino_sessione='+ 'ab'.repeat(32)}))).status,401);assert.deepEqual(f.calls,['verifyJWT']);assert.equal(f.stats().mobile,0)})
 await t.test('Bearer malformato: negato prima di Auth e backend',async()=>{const f=fixture();assert.equal((await f.http(request({authorization:'Basic bad'}))).status,401);assert.deepEqual(f.calls,[])})
 await t.test('adattatore desktop senza Bearer: negato prima delle RPC',async()=>{const f=fixture();await assert.rejects(()=>f.registry.authorize(request(),input),e=>e.status===401);assert.deepEqual(f.calls,[])})
 await t.test('nessuna identita: ramo mobile senza sessione negato, zero backend',async()=>{const f=fixture();assert.equal((await f.http(request())).status,401);assert.equal(f.stats().mobile,1);assert.deepEqual(f.calls,[])})
 await t.test('byte/hash/MIME falsi: nessuna prenotazione/finalizzazione/upload',async()=>{
  for(const [b,meta]of[[Buffer.from('bad'),{...input,byte_size:3,sha256:hash(Buffer.from('bad'))}],[bytes,{...input,sha256:'aa'.repeat(32)}],[bytes,{...input,mime_type:'image/jpeg'}]]){const f=fixture();assert.equal((await f.http(request({authorization:'Bearer valid'},b,meta))).status,400);assert(!f.calls.some(x=>x.name));assert.equal(f.stats().object,null)}
 })
 await t.test('lease scaduto: nessuna operazione Storage/finalizzazione',async()=>{const f=fixture({expired:true});assert.equal((await f.http(request({authorization:'Bearer valid'}))).status,409);assert(!f.calls.includes('storageRead'));assert(!f.stats().finalized)})
 await t.test('oggetto incoerente esistente: nessuna sovrascrittura/finalizzazione',async()=>{const f=fixture({object:Buffer.from('corrupt')});assert.equal((await f.http(request({authorization:'Bearer valid'}))).status,409);assert(!f.calls.includes('create'));assert(!f.stats().finalized)})
})
