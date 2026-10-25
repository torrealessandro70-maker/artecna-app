const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),path=require('path'),ts=require('typescript'),vm=require('vm')
const {id,digest,image,photo,packet,result}=require('./fixture.cjs')
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f)
const {analizzaNotaOsservatore,MODELLO_OSSERVATORE}=require('../osservatore/analizza.ts')
const {payloadOsservatoreVariante,leggiFotoFonti,leggiOsservatore}=require('./contratto.ts')
const {creaServizioOsservatoreVariante}=require('./servizio.ts')

test('parita esatta Osservatore Sopralluogo: hash payload baseline, modello, audio/cap immagini e JSON',async()=>{
 const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'osservatore-baseline.fixture.json'))),transcriptions=[];let request
 const client={audio:{transcriptions:{create:async args=>{transcriptions.push({model:args.model,language:args.language,nome:args.file.name});return{text:'Trascrizione fixture'}}}},responses:{create:async args=>{request=args;return{output_text:'```json\n'+JSON.stringify(baseline.result.data)+'\n```'}}}}
 const actual=await analizzaNotaOsservatore(baseline.input,client,async()=>new Response(new Uint8Array([1,2]),{headers:{'Content-Type':'audio/webm'}}))
 a.equal(digest(JSON.stringify(request)),baseline.requestSHA256);a.deepEqual(transcriptions,baseline.transcriptions);a.deepEqual(actual,baseline.result.data);a.equal(MODELLO_OSSERVATORE,'gpt-4.1-mini');a.equal(request.input[0].content.filter(c=>c.type==='input_image').length,8)
})
test('Osservatore Sopralluogo: default vuoti, audio non leggibile non blocca, nessuna nuova fonte',async()=>{
 let call,trans=0;const client={audio:{transcriptions:{create:async()=>{trans++;return{text:''}}}},responses:{create:async x=>{call=x;return{output_text:JSON.stringify(result)}}}}
 await analizzaNotaOsservatore({audio:[{url:'https://fixture.invalid/audio',nome:'fixture'}]},client,async()=>new Response('',{status:404}));a.equal(trans,0);a.equal(call.input[0].content.length,1);a(call.input[0].content[0].text.includes('Trascrizioni audio: nessuna'))
})
test('adapter Variante: descrizione+Quaderno+foto, immagini mai concatenate alla narrativa/contratto',()=>{
 const p=packet();p.extra={checklist:['NO'],prezzi:[999],contratto:'CONTRATTO NON NARRATIVO',analisi_ai:result}
 const withPhotos=payloadOsservatoreVariante(p,[image]),without=payloadOsservatoreVariante({...p,foto:[]},[])
 a.equal(withPhotos.testo,without.testo);a(withPhotos.testo.includes('Descrizione Variante'));a(withPhotos.testo.includes('Testo Quaderno'));a(!withPhotos.testo.includes(image));a(!withPhotos.testo.includes('CONTRATTO'));a.deepEqual(withPhotos.checklist,[]);a.deepEqual(withPhotos.audio,[]);a.deepEqual(withPhotos.disegni,[]);a.deepEqual(withPhotos.contesto,{})
 a.throws(()=>payloadOsservatoreVariante(p,[]),/incomplete/)
})
test('preview visuale deterministica, versione realmente assente e duplicati response rifiutati',()=>{
 const photos=[photo(8,'foto_sopralluogo'),photo(7)];a.deepEqual(leggiFotoFonti(photos),leggiFotoFonti([...photos].reverse()));a(leggiFotoFonti(photos).every(f=>f.source_version===null));a.throws(()=>leggiFotoFonti([photos[0],photos[0]]),/duplicate/)
 const p=packet();a.equal(leggiOsservatore({fonti:p,analisi:null},id(5)).fonti.foto.length,1);a.throws(()=>leggiOsservatore({fonti:p,analisi:null},id(99)))
})
function service() {
 const state={packet:packet([photo(7),photo(8,'foto_sopralluogo')]),analisi:null,calls:[],count:0}
 const read=async()=>({fonti:state.packet,analisi:state.analisi&&{...state.analisi,allineata:state.analisi.fonti.manifesto.firma===state.packet.manifesto.firma}})
 const deps={authorize:async token=>{state.calls.push('auth');if(token!=='fixture-session')throw Object.assign(Error('denied'),{code:'42501'});return{userId:id(1),read}},photo:async f=>{state.calls.push('photo:'+f.source_id);return{dataUrl:image,sha256:digest(image)}},analyze:async payload=>{state.calls.push('AI');state.payload=payload;state.count++;return result},save:async(user,variante,request,fonti,risultato)=>{state.calls.push('save');state.analisi={id:request,data:'2026-10-25T12:00:00Z',modello:MODELLO_OSSERVATORE,fonti,risultato,allineata:true};state.user=user;state.variante=variante}}
 const request=(body={variante_id:id(5),richiesta_id:id(20)},token='fixture-session')=>new Request('https://app.invalid/api/varianti/osservatore',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify(body)})
 return {state,deps,request}
}
test('HTTP adapter mock: solo POST esplicito, input autorevole e risultato esclusivo Variante',async()=>{
 const {state,deps,request}=service();const response=await creaServizioOsservatoreVariante(deps)(request());a.equal(response.status,200);a.equal(state.count,1);a.equal(state.user,id(1));a.equal(state.variante,id(5));a.equal(state.analisi.fonti.foto_bytes.length,2);a.equal(state.analisi.fonti.manifesto.foto.length,2);a.equal(state.payload.immagini.length,2);a(!JSON.stringify(state.analisi.fonti).includes(image));a(!state.calls.includes('note_sopralluogo'));a.deepEqual(state.calls.slice(-2),['AI','save'])
})
test('HTTP mock: anonimo, fonte client arbitraria e metodo GET non invocano AI/foto',async()=>{
 for(const make of [s=>s.request(undefined,''),s=>s.request(undefined,'foreign'),s=>s.request({variante_id:id(5),richiesta_id:id(20),immagini:['http://127.0.0.1/secret']}),()=>new Request('https://app.invalid/api/varianti/osservatore')]){
  const s=service();const response=await creaServizioOsservatoreVariante(s.deps)(make(s));a(response.status>=400);a.equal(s.state.count,0);a(!s.state.calls.some(c=>c.startsWith('photo:')))
 }
})
test('risposta persa: stessa richiesta piu recente non ripete AI; Rianalizza crea una nuova analisi',async()=>{
 const s=service(),run=creaServizioOsservatoreVariante(s.deps);a.equal((await run(s.request())).status,200);a.equal((await run(s.request())).status,200);a.equal(s.state.count,1)
 const old=s.state.analisi.id;a.equal((await run(s.request({variante_id:id(5),richiesta_id:id(21)}))).status,200);a.equal(s.state.count,2);a.notEqual(s.state.analisi.id,old)
})
test('cambio fonti durante AI conserva provenienza effettiva e segnala non allineata senza retry',async()=>{
 const s=service();const analyze=s.deps.analyze;s.deps.analyze=async payload=>{const r=await analyze(payload);s.state.packet=structuredClone(s.state.packet);s.state.packet.manifesto.firma=digest('changed');return r}
 const response=await creaServizioOsservatoreVariante(s.deps)(s.request());a.equal(response.status,200);a.equal((await response.json()).analisi.allineata,false);a.equal(s.state.count,1)
})
test('errore foto o salvataggio: nessun fallback/modifica Sopralluogo o retry AI',async()=>{
 const s=service();s.deps.photo=async()=>{throw Error('not readable')};a.equal((await creaServizioOsservatoreVariante(s.deps)(s.request())).status,503);a.equal(s.state.count,0)
 const x=service();x.deps.save=async()=>{throw Error('write uncertain')};a.equal((await creaServizioOsservatoreVariante(x.deps)(x.request())).status,503);a.equal(x.state.count,1);a.equal(x.state.analisi,null)
})
test('foto non piu accessibile nello snapshot: nessuna lettura byte o AI; richiesta sovradimensionata rifiutata',async()=>{
 const s=service();s.state.packet.foto[0].disponibile=false;const r=await creaServizioOsservatoreVariante(s.deps)(s.request());a.equal(r.status,409);a.equal(s.state.count,0);a(!s.state.calls.some(x=>x.startsWith('photo:')))
 const x=service();const big=new Request('https://app.invalid/api/varianti/osservatore',{method:'POST',headers:{Authorization:'Bearer fixture'},body:JSON.stringify({variante_id:id(5),richiesta_id:id(20),extra:'x'.repeat(4096)})});a.equal((await creaServizioOsservatoreVariante(x.deps)(big)).status,413);a.equal(x.state.calls.length,0)
})
test('lettura foto riusa il lettore privato esistente e rifiuta URL esterni prima del fetch',async()=>{
 let reads=0,fetches=0
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'foto.server.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={}
 vm.runInNewContext(code,{exports,require:n=>n==='server-only'?{}:n.includes('letturaFotoDesktop.server')?{capabilityFotoDesktop:{fixture:true},creaLetturaHttpFotoDesktop:()=>async req=>{reads++;if(!req.url.includes('/download?allegato_id='))return Response.json({versione_contratto:1,rapportino_id:id(51),allegati:[{allegato_id:id(50),foto_cantiere_id:id(7),rapportino_id:id(51),mime_type:'image/png',byte_size:8}]});return new Response(Buffer.from(image.split(',')[1],'base64'),{headers:{'Content-Type':'image/png'}})}}:n.includes('storageFotoV1.server')?{storageFotoV1Configurato:()=>({fixture:true})}:n==='./servizio'?require('./servizio.ts'):require(n),Buffer,Request,Response,AbortSignal,URL,fetch:async()=>{throw Error('Rete reale disabilitata nei test')},process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.co'}}})
 const read=exports.leggiFotoOsservatore,inline=photo();a.equal((await read(inline,'fixture')).sha256,digest(Buffer.from(image.split(',')[1],'base64')))
 const priv=photo();priv.foto.allegato_v1_id=id(50);priv.foto.rapportino_id=id(51);await read(priv,'fixture');a.equal(reads,2);const forged=structuredClone(priv);forged.source_id=id(88);await a.rejects(read(forged,'fixture'));a.equal(reads,3)
 for(const url of ['https://attacker.invalid/x','http://127.0.0.1/x','https://fixture.supabase.co/storage/v1/object/public/other/a','https://fixture.supabase.co/storage/v1/object/public/preventivi/a?redirect=bad']){
  const f=photo();f.foto.file_url=url;f.foto.file_path='a';await a.rejects(read(f,'fixture',async()=>{fetches++;throw Error('should not fetch')}))
 }a.equal(fetches,0)
 const f=photo();f.foto.file_url='https://fixture.supabase.co/storage/v1/object/public/preventivi/a';f.foto.file_path='a'
 const r=await read(f,'fixture',async(url,options)=>{a.equal(options.redirect,'error');fetches++;return new Response(Buffer.from(image.split(',')[1],'base64'),{headers:{'Content-Type':'image/png'}})});a(r.dataUrl.startsWith('data:image/png'));a.equal(fetches,1)
})
test('grafo import client: nessun modulo server/provider AI nella UI Fonti visive',()=>{
 const root=path.resolve(__dirname,'../../..'),seen=new Set(),options={moduleResolution:ts.ModuleResolutionKind.Bundler,baseUrl:root,paths:{'@/*':['./*']},jsx:ts.JsxEmit.ReactJSX}
 function visit(file){if(seen.has(file))return;seen.add(file);a(!file.includes('.server.'),'Server nel client: '+file)
  const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
  for(const node of ast.statements){if(ts.isImportDeclaration(node)&&!node.importClause?.isTypeOnly){const spec=node.moduleSpecifier.text;a.notEqual(spec,'openai');a.notEqual(spec,'server-only');if(spec.startsWith('.')||spec.startsWith('@/')){const resolved=ts.resolveModuleName(spec,file,options,ts.sys).resolvedModule;a(resolved,'Import mancante '+spec);if(!resolved.resolvedFileName.endsWith('.d.ts'))visit(resolved.resolvedFileName)}}}
 }
 visit(path.join(root,'app/components/VarianteFontiVisivePanel.tsx'));a(seen.size>5)
})
