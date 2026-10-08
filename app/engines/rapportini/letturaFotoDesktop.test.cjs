// Trasporto, Auth, registro e Storage simulati: nessuna rete o Storage API reale.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const {createHash}=require('node:crypto')
const cache=new Map();let authResult, rpcResult, resolved, verified=[],sqlCalls=[]
function load(name){
 if(cache.has(name))return cache.get(name)
 const m={exports:{}}
 const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
 new Function('require','module','exports',js)(id=>{
  if(id==='server-only')return{}
  if(id==='@supabase/supabase-js')return{createClient:(url,key,opts)=>({auth:{getUser:async token=>{verified.push({token,opts});return authResult}},rpc:async(n,p)=>{sqlCalls.push({n,p});return rpcResult}})}
  if(id==='./adapterPortalePostgres.server')return{risolviFotoDesktopPostgres:async(id,user)=>{sqlCalls.push({id,user});return resolved}}
  return id.startsWith('./')?load(id.slice(2)):require(id)
 },m,m.exports);cache.set(name,m.exports);return m.exports
}
const server=load('letturaFotoDesktop.server'),browser=load('letturaFotoDesktop')
const uuid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`
const bytes=Buffer.from('verified bytes'),digest=createHash('sha256').update(bytes).digest('hex')
const item={allegato_id:uuid(1),foto_cantiere_id:uuid(2),rapportino_id:uuid(3),mime_type:'image/png',byte_size:bytes.length}
const listing={versione_contratto:1,rapportino_id:uuid(3),allegati:[item]}
const object={versione_contratto:1,...item,cantiere_id:uuid(4),bucket:'rapportini-v1',file_path:`rapportini/${uuid(4)}/${uuid(3)}/${uuid(5)}.png`,sha256:digest}
function request(download=false,query,headers={authorization:'Bearer verified-token'}){return new Request('http://localhost/api/desktop/foto'+(download?'/download':'')+'?'+(query??(download?'allegato_id='+uuid(1):'rapportino_id='+uuid(3))),{headers})}
function fixture(options={}){
 let reads=0,auth=0,resolves=0
 const capability={authorize:async token=>{auth++;assert.equal(token,'verified-token');if(options.deny)throw new (load('servizioFotoV1.server').ErroreFotoV1)(403,'membership');return{userId:uuid(6),list:async id=>{assert.equal(id,uuid(3));return options.list??listing}}},resolve:async(id,user)=>{resolves++;assert.equal(id,uuid(1));assert.equal(user,uuid(6));if(options.resolveError)throw new (load('servizioFotoV1.server').ErroreFotoV1)(options.resolveError,'reciprocita');return options.object??object}}
 const storage={read:async(b,p,max)=>{reads++;assert.equal(b,'rapportini-v1');assert.equal(p,object.file_path);assert.equal(max,4000000);return options.bytes===undefined?bytes:options.bytes}}
 return{http:server.creaLetturaHttpFotoDesktop({capability,...(options.noStorage?{}:{storage})}),stats:()=>({reads,auth,resolves})}
}
test('F4C.2 lettura Desktop HTTP e client',async t=>{
 const run=async(n,fn)=>{let failure;await t.test(n,async()=>{try{await fn()}catch(e){failure=e;throw e}});if(failure)throw failure}
 await run('elenco proietta mapping pubblico senza path/hash/credenziali',async()=>{const f=fixture({list:{...listing,secret:'server',allegati:[{...item,file_path:'private'}]}}),r=await f.http(request());assert.equal(r.status,200);assert.deepEqual(await r.json(),listing);assert.equal(f.stats().reads,0);assert.equal(r.headers.get('cache-control'),'private, no-store')})
 await run('JWT mancante e cookie Mobile non autorizzano Desktop',async()=>{const f=fixture();assert.equal((await f.http(request(false,undefined,{cookie:'artecna_rapportino_sessione=abc'}))).status,401);assert.equal(f.stats().auth,0)})
 await run('non autorizzato non legge Storage',async()=>{const f=fixture({deny:true});assert.equal((await f.http(request(true))).status,403);assert.equal(f.stats().reads,0)})
 await run('URL/path/subject/bucket client e parametri duplicati rifiutati',async()=>{for(const extra of ['path=x','bucket=x','user_id='+uuid(6),'url=https://invalid','allegato_id='+uuid(1)]){const f=fixture();assert.equal((await f.http(request(true,'allegato_id='+uuid(1)+'&'+extra))).status,400);assert.equal(f.stats().auth,0)}})
 await run('download verificato hash/peso e privato no-store',async()=>{const f=fixture(),r=await f.http(request(true));assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes);assert.equal(r.headers.get('content-type'),'image/png');assert.equal(r.headers.get('vary'),'Authorization');assert.equal(f.stats().resolves,1)})
 await run('resolver nega altro cantiere e marker/reciprocita divergenti',async()=>{for(const status of [403,409]){const f=fixture({resolveError:status});assert.equal((await f.http(request(true))).status,status);assert.equal(f.stats().reads,0)}})
 await run('Storage assente fail-closed dopo resolver',async()=>{const f=fixture({noStorage:true});assert.equal((await f.http(request(true))).status,503);assert.equal(f.stats().resolves,1);assert.equal(f.stats().reads,0)})
 await run('oggetto mancante, corrotto o bucket/path divergente',async()=>{for(const [opts,status]of [[{bytes:null},404],[{bytes:Buffer.from('corrotto')},409],[{object:{...object,bucket:'preventivi'}},503],[{object:{...object,file_path:'arbitrario'}},503]])assert.equal((await fixture(opts).http(request(true))).status,status)})
 await run('elenco altro Rapportino e mapping duplicato rifiutati',async()=>{for(const list of [{...listing,rapportino_id:uuid(8)},{...listing,allegati:[item,item]}])assert.equal((await fixture({list}).http(request())).status,503)})
 await run('client verifica reciprocita prima di download, retry manuale e nessun URL Storage',async()=>{
  const calls=[],signal=new AbortController().signal,input={allegato:uuid(1),foto:uuid(2),rapportino:uuid(3)}
  let failing=true
  const fetcher=async(url,opts)=>{calls.push(url);assert.equal(opts.headers.Authorization,'Bearer browser-token');assert.equal(opts.cache,'no-store');return url.includes('/download')?(failing?new Response('{}',{status:503}):new Response(bytes,{headers:{'content-type':'image/png'}})):Response.json(listing)}
  await assert.rejects(()=>browser.leggiBlobFotoDesktop(input,'browser-token',signal,fetcher),e=>e.status===503)
  assert.equal(calls.length,2);failing=false;const blob=await browser.leggiBlobFotoDesktop(input,'browser-token',signal,fetcher);assert.equal(blob.size,bytes.length);assert.equal(calls.length,4)
  let downloads=0;await assert.rejects(()=>browser.leggiBlobFotoDesktop({...input,foto:uuid(9)},'token',signal,async()=>{downloads++;return Response.json(listing)}),e=>e.status===409);assert.equal(downloads,1)
 })
 await run('adapter Auth verifica JWT e trasmette solo subject verificato al resolver',async()=>{
  const previousUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,previousKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  try{
   process.env.NEXT_PUBLIC_SUPABASE_URL='http://localhost:54321';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='local-test-only'
   authResult={data:{user:{id:uuid(6)}},error:null};rpcResult={data:listing,error:null};resolved=object
   const op=await server.capabilityFotoDesktop.authorize('test-jwt');assert.equal(op.userId,uuid(6));assert.deepEqual(await op.list(uuid(3)),listing)
   await server.capabilityFotoDesktop.resolve(uuid(1),op.userId);assert.deepEqual(sqlCalls.at(-1),{id:uuid(1),user:uuid(6)});assert.equal(verified.at(-1).token,'test-jwt')
   assert.equal(verified.at(-1).opts.auth.persistSession,false);assert.equal(verified.at(-1).opts.global.headers.Authorization,'Bearer test-jwt')
   authResult={data:{user:null},error:{message:'bad JWT'}};await assert.rejects(()=>server.capabilityFotoDesktop.authorize('bad'),e=>e.status===401)
   rpcResult={data:null,error:{code:'42501'}};await assert.rejects(()=>op.list(uuid(3)),e=>e.status===403)
  }finally{if(previousUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previousUrl;if(previousKey===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=previousKey}
 })
})
