// Fetch Storage, Auth e registro simulati; decoder sharp reale. Nessuna rete.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),sharp=require('sharp'),{createHash}=require('node:crypto')
const cache=new Map()
function load(name){
 if(cache.has(name))return cache.get(name)
 const m={exports:{}}
 const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
 new Function('require','module','exports',js)(id=>id==='server-only'?{}:id==='./adapterPortalePostgres.server'?{risolviFotoDesktopPostgres:async()=>{throw Error('no DB')}}:id.startsWith('./')?load(id.slice(2)):require(id),m,m.exports)
 cache.set(name,m.exports);return m.exports
}
const {creaStorageFotoV1}=load('storageFotoV1.server'),service=load('servizioFotoV1.server'),desktop=load('letturaFotoDesktop.server')
const uuid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`
const key=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from('{"role":"service_role"}').toString('base64url')+'.local-test-signature'
const config={url:'http://127.0.0.1:54321',serviceRoleKey:key}
const canonical=`rapportini/${uuid(1)}/${uuid(2)}/${uuid(3)}.png`,hash=b=>createHash('sha256').update(b).digest('hex')
const err=(status,code)=>Response.json({code,message:'raw provider details'},{status})
function fixture(options={}){
 let stored=options.stored??null,posts=0,gets=0;const calls=[]
 const fetcher=async(url,init)=>{
  calls.push({url,init});assert.equal(url,config.url+'/storage/v1/object/rapportini-v1/'+canonical)
  assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.equal(init.headers.apikey,key);assert.equal(init.headers.Authorization,'Bearer '+key)
  if(init.method==='GET'){gets++;return stored?new Response(stored,{headers:{'content-type':'image/png'}}):err(404,'NoSuchKey')}
  assert.equal(init.method,'POST');posts++;assert.equal(init.headers['x-upsert'],'false')
  if(stored)return err(409,'ResourceAlreadyExists')
  stored=Buffer.from(init.body);if(options.lost)throw Error('lost '+key)
  return Response.json({Key:'rapportini-v1/'+canonical})
 }
 return{storage:creaStorageFotoV1({...config,fetcher}),stats:()=>({stored,posts,gets}),calls}
}
test('F4D adapter server e integrazione servizi, Storage simulato',async t=>{
 const run=async(n,fn)=>{let failure;await t.test(n,async()=>{try{await fn()}catch(e){failure=e;throw e}});if(failure)throw failure}
 const bytes=await sharp({create:{width:3,height:2,channels:3,background:'#123456'}}).png().toBuffer()
 await run('create-only, GET privato e SHA dei byte riletti',async()=>{const f=fixture();assert.equal(await f.storage.read('rapportini-v1',canonical,4000000),null);assert.equal(await f.storage.create('rapportini-v1',canonical,bytes,'image/png'),'created');assert.equal(hash(await f.storage.read('rapportini-v1',canonical,4000000)),hash(bytes));assert.equal(f.calls.length,3)})
 await run('oggetto gia presente e concorrenza non sovrascrivono',async()=>{const f=fixture();assert.deepEqual((await Promise.all([f.storage.create('rapportini-v1',canonical,bytes,'image/png'),f.storage.create('rapportini-v1',canonical,bytes,'image/png')])).sort(),['created','exists']);assert.deepEqual(f.stats().stored,bytes);assert.equal(await f.storage.create('rapportini-v1',canonical,bytes,'image/png'),'exists')})
 await run('errori duplicate espliciti e conflitti sconosciuti distinti',async()=>{for(const [status,code,expected]of [[400,'Duplicate','exists'],[409,'KeyAlreadyExists','exists'],[409,'already_exists','exists'],[409,'ResourceLocked',null]]){const s=creaStorageFotoV1({...config,fetcher:async()=>err(status,code)});if(expected)assert.equal(await s.create('rapportini-v1',canonical,bytes,'image/png'),expected);else await assert.rejects(()=>s.create('rapportini-v1',canonical,bytes,'image/png'),e=>e.status===503)}})
 await run('bucket/path/traversal/URL non ammessi prima della rete',async()=>{let calls=0;const s=creaStorageFotoV1({...config,fetcher:async()=>{calls++;throw Error('network')}});for(const [bucket,p]of [['preventivi',canonical],['rapportini-v1','../x'],['rapportini-v1',canonical+'?x=1'],['rapportini-v1','https://invalid/a'],['rapportini-v1',canonical.replace(uuid(1),'NOT-UUID')]]){await assert.rejects(()=>s.read(bucket,p,4000000));await assert.rejects(()=>s.create(bucket,p,bytes,'image/png'))}assert.equal(calls,0)})
 await run('peso, MIME/estensione e byte non immagine rifiutati',async()=>{let calls=0;const s=creaStorageFotoV1({...config,fetcher:async()=>{calls++;return Response.json({})}});for(const [b,m]of [[bytes,'image/jpeg'],[bytes,'image/gif'],[Buffer.alloc(0),'image/png'],[Buffer.alloc(4000001),'image/png'],[Buffer.from('fake'),'image/png']])await assert.rejects(()=>s.create('rapportini-v1',canonical,b,m));assert.equal(calls,0)})
 await run('JPEG/WebP reali e limite pixel',async()=>{for(const [format,ext,mime]of [['jpeg','jpg','image/jpeg'],['webp','webp','image/webp']]){const b=await sharp(bytes)[format]().toBuffer(),s=creaStorageFotoV1({...config,fetcher:async()=>Response.json({})});assert.equal(await s.create('rapportini-v1',canonical.replace('.png','.'+ext),b,mime),'created')}const b=await sharp({create:{width:5000,height:5000,channels:3,background:'#fff'}}).png().toBuffer();await assert.rejects(()=>fixture().storage.create('rapportini-v1',canonical,b,'image/png'))})
 await run('oggetto assente distinto da bucket assente, diniego e 404 ambiguo',async()=>{for(const [status,code]of [[404,'NoSuchBucket'],[404,'not_found'],[403,'AccessDenied'],[500,'InternalError']]){const s=creaStorageFotoV1({...config,fetcher:async()=>err(status,code)});await assert.rejects(()=>s.read('rapportini-v1',canonical,4000000),e=>e.status===503)}})
 await run('lettura limitata anche senza Content-Length',async()=>{for(const headers of [{'content-type':'image/png'},{'content-type':'image/png','content-length':'4000001'}]){let cancelled=false;const s=creaStorageFotoV1({...config,fetcher:async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(4000001))},cancel(){cancelled=true}}),{headers})});await assert.rejects(()=>s.read('rapportini-v1',canonical,4000000));assert.equal(cancelled,true)}await assert.rejects(()=>fixture().storage.read('rapportini-v1',canonical,4000001))})
 await run('MIME letto divergente e corpo vuoto negati',async()=>{for(const [b,m]of [[bytes,'text/html'],[new Uint8Array(0),'image/png']]){const s=creaStorageFotoV1({...config,fetcher:async()=>new Response(b,{headers:{'content-type':m}})});await assert.rejects(()=>s.read('rapportini-v1',canonical,4000000))}})
 await run('rete/timeout sanitizzati senza credenziali e nessun retry adapter',async()=>{let calls=0;const s=creaStorageFotoV1({...config,timeoutMs:10,fetcher:async(u,o)=>{calls++;return new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(Error(key))))}});await assert.rejects(()=>s.read('rapportini-v1',canonical,4000000),e=>e.message==='storage_non_disponibile'&&!String(e).includes(key));assert.equal(calls,1);const network=creaStorageFotoV1({...config,fetcher:async()=>{throw Error(key)}});await assert.rejects(()=>network.create('rapportini-v1',canonical,bytes,'image/png'),e=>!String(e).includes(key))})
 await run('config non privilegiata o URL arbitrario rifiutati',()=>{for(const c of [{...config,serviceRoleKey:'anon'},{...config,url:'https://evil.invalid'},{...config,url:config.url+'/?redirect=x'},{...config,url:'http://user:pass@localhost:54321'}])assert.throws(()=>creaStorageFotoV1(c),e=>e.codice==='storage_non_configurato');assert.deepEqual(Object.keys(fixture().storage).sort(),['create','read'])})
 await run('servizio Mobile riconcilia upload con risposta persa e retry finalizzato',async()=>{
  const f=fixture({lost:true});let state='prenotato',finalizes=0
  const input={cantiere_id:uuid(1),rapportino_id:uuid(2),chiave_client_allegato:uuid(3),data:'2026-10-08',mime_type:'image/png',byte_size:bytes.length,sha256:hash(bytes)}
  const mobile={canale:'mobile',authorize:async()=>({reserve:async()=>({versione_contratto:1,esito:'successo',allegato_id:uuid(4),stato:state,upload_necessario:state==='prenotato',bucket:'rapportini-v1',file_path:canonical,mime_type:'image/png',byte_size:bytes.length,lease_id:state==='prenotato'?uuid(5):null,lease_until:state==='prenotato'?new Date(Date.now()+120000).toISOString():null}),finalize:async()=>{finalizes++;state='finalizzato';return{versione_contratto:1,esito:'successo',allegato_id:uuid(4),foto_cantiere_id:uuid(6),stato:state}}})}
  const http=service.creaHttpFotoV1({mobile,storage:f.storage}),req=()=>new Request('http://localhost/api/rapportino/foto',{method:'POST',headers:{'content-type':'image/png','x-artecna-foto':JSON.stringify(input)},body:bytes})
  assert.equal((await http(req())).status,200);assert.equal(finalizes,1);assert.equal(f.stats().posts,1);assert.equal((await http(req())).status,200);assert.equal(f.stats().posts,1);assert.equal(finalizes,1)
 })
 await run('Desktop autorizzato verifica SHA e negato non raggiunge Storage',async()=>{
  const f=fixture({stored:bytes});let deny=false
  const capability={authorize:async()=>{if(deny)throw new service.ErroreFotoV1(403,'membership');return{userId:uuid(7)}},resolve:async()=>({versione_contratto:1,allegato_id:uuid(4),rapportino_id:uuid(2),cantiere_id:uuid(1),foto_cantiere_id:uuid(6),bucket:'rapportini-v1',file_path:canonical,mime_type:'image/png',byte_size:bytes.length,sha256:hash(bytes)})}
  const http=desktop.creaLetturaHttpFotoDesktop({capability,storage:f.storage}),req=()=>new Request('http://localhost/api/desktop/foto/download?allegato_id='+uuid(4),{headers:{authorization:'Bearer test'}})
  const r=await http(req());assert.equal(r.status,200);assert.equal(hash(Buffer.from(await r.arrayBuffer())),hash(bytes));deny=true;assert.equal((await http(req())).status,403);assert.equal(f.stats().gets,1)
 })
 await run('wiring server-only e nessun segreto/client Storage diretto',()=>{const src=fs.readFileSync(path.join(__dirname,'storageFotoV1.server.ts'),'utf8');assert(src.startsWith("import 'server-only'"));assert(!src.includes('NEXT_PUBLIC_SUPABASE_SERVICE'));for(const p of ['../../../app/api/rapportino/foto/route.ts','../../../app/api/desktop/foto/download/route.ts'])assert(fs.readFileSync(path.resolve(__dirname,p),'utf8').includes('storageFotoV1Configurato'));assert(!JSON.stringify(fixture().storage).includes(key))})
})
