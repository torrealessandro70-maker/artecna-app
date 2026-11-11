/* eslint-disable @typescript-eslint/no-require-imports -- Loopback test service, not Supabase Storage certification. Synthetic PDFs only. */
const crypto = require('node:crypto'), assert = require('node:assert/strict')
exports.storageEmulator = function ({ roleCall, artifact }) {
 const fs = require('node:fs'), path = require('node:path'), files = new Map(), tokens = new Map(), events = []
 const bucket = 'documenti-fiscali-privati'
 const token = (name, mode, ttl) => { const key=crypto.randomUUID();tokens.set(key,{name,mode,until:Date.now()+ttl*1000});return key }
 const authorize = async (name,upload) => {
  assert.match(name,/^documenti\/[0-9a-f-]{36}\.pdf$/)
  assert.equal((await roleCall(c=>c.query('SELECT public.documento_fiscale_storage_consentito($1,$2) ok',[name,upload]))).rows[0].ok,true)
 }
 const clientSource = `client.storage={from(bucket){if(bucket!=='${bucket}')throw Error('LOCAL_BUCKET');const request=async(action,body)=>{const r=await fetch('/storage-fixture/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return r.json()};return{createSignedUploadUrl:(path,options)=>request('reserve',{path,options}),async uploadToSignedUrl(path,token,file,options){const r=await fetch('/storage-fixture/upload?token='+encodeURIComponent(token),{method:'PUT',body:file,headers:{'Content-Type':options.contentType}});return r.json()},createSignedUrl:(path,ttl,options)=>request('sign',{path,ttl,options})}}}`
 const handle = async (req,res) => {
  const url=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store')
  try {
   if(url.pathname==='/storage-fixture/pdf'){
    const t=tokens.get(url.searchParams.get('token'));assert(t&&t.mode==='read'&&t.until>Date.now());const bytes=files.get(t.name);assert(bytes);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','inline; filename="fixture.pdf"');res.removeHeader('Content-Security-Policy');return res.end(bytes)
   }
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;assert(size<=10485760);chunks.push(chunk)}const bytes=Buffer.concat(chunks)
   res.setHeader('Content-Type','application/json')
   if(url.pathname==='/storage-fixture/upload'){
    const t=tokens.get(url.searchParams.get('token'));assert(t&&t.mode==='upload'&&t.until>Date.now());await authorize(t.name,true);assert.equal(req.headers['content-type'],'application/pdf');assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert(!files.has(t.name));
    await roleCall(c=>c.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES($1,$2,$3)",[bucket,t.name,{mimetype:'application/pdf',size:bytes.length}]));files.set(t.name,bytes);events.push({action:'upload',name:t.name,size:bytes.length});return res.end(JSON.stringify({data:{path:t.name},error:null}))
   }
   const b=JSON.parse(bytes.toString());
   if(url.pathname==='/storage-fixture/reserve'){assert.equal(b.options.upsert,false);await authorize(b.path,true);const key=token(b.path,'upload',7200);events.push({action:'reserve',name:b.path});return res.end(JSON.stringify({data:{path:b.path,token:key},error:null}))}
   if(url.pathname==='/storage-fixture/sign'){assert.equal(b.ttl,120);await authorize(b.path,false);assert(files.has(b.path));const key=token(b.path,'read',120);events.push({action:'sign',name:b.path,ttl:120});return res.end(JSON.stringify({data:{signedUrl:'/storage-fixture/pdf?token='+key},error:null}))}
   throw Error('LOCAL_ROUTE')
  }catch(e){res.statusCode=403;res.end(JSON.stringify({data:null,error:{message:e.message}}))}
 }
 return {clientSource,handle,rpcNames:['elenca_documenti_fiscali','crea_documento_fiscale','aggiorna_documento_fiscale','archivia_documento_fiscale','conferma_upload_documento_fiscale','collega_documento_scadenza','scollega_documento_scadenza'],save(){fs.writeFileSync(path.join(artifact,'STORAGE-EMULATED.json'),JSON.stringify({real_storage_service:false,events,objects:[...files].map(([name,b])=>({name,size:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}))},null,2))}}
}
