/* eslint-disable @typescript-eslint/no-require-imports -- Offline orchestration, no provider/DB imports. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto')
const cache=new Map()
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const m={exports:{}};cache.set(file,m.exports)
  const req=id=>{if(/openai|supabase|web-fallback/.test(id))throw Error('Provider/DB forbidden');if(!id.startsWith('.'))return require(id);const p=path.resolve(path.dirname(file),id);return load([p+'.ts',p+'.tsx',path.join(p,'index.ts')].find(fs.existsSync))}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:req,Set,Map,Number,Math,Date,console});return m.exports}
const api=load(path.join(__dirname,'stima-documento-ai.ts'))
const voci=(count=34)=>Array.from({length:count},(_,i)=>({codice:'DOC-'+i,descrizione:'Posa pavimento ceramico zona '+i,quantita:8,unita_misura:'mq',prezzo_unitario:0,bozzaDocumento:true,
  testoOrigine:'DETTAGLIO_RIGA_'+(i+1),priceResolution:{strategy:'no_match',matched:false}}))
const stima=r=>({id:r.id,stato_stima:'proposta',prezzo_unitario_proposto:30,unita_interpretata:r.unita,tipo:'stima_artecna_ai',affidabilita:'alta',motivazione:'Sola posa: 0,75 ore uomo per unità originale a 40 euro/ora, ipotesi tecnica esplicita.',
  riferimenti_utilizzati:[],avvisi:[],lavorazione_composita:r.composita,quantita_coperta_dal_prezzo:1,totale_riga_proposto:30*r.quantita,quantita_strutturata:r.quantita,totale_riga_previsto:30*r.quantita,
  unita_economica:{descrizione:'Una unità originale',base_documentale:r.descrizione},riferimenti_ancoraggio:[],metodo_calcolo:'analisi_unitaria',totale_componenti:30,prezzo_unitario_derivato:30,scorporo_fornitura:null,esclusioni_componenti:[],
  componenti_economiche:[{categoria:'posa',descrizione:'Lavoro del posatore',importo_unitario:30,riferimento_id:null,quantita_tecnica:0.75,unita_tecnica:'h',costo_unitario:40,subtotale:30,metodo_calcolo:'ore_uomo',origine_costo:{tipo:'ipotesi_tecnica_esplicita',descrizione:'Ipotesi tecnica esplicita del costo orario del posatore, non certificata',base_documentale:null}}]})
const output=i=>({stime:i.righe.map(stima)})
const richiedi=i=>api.eseguiStimeDocumento(i,async()=>JSON.stringify(output(i)))

test('34 target: partizione deterministica 6/6/6/6/6/4, ID originali senza rinumerazione',()=>{
  const i=api.preparaInputStimeDocumento(voci(),[]),chunks=api.creaChunkStimeDocumento(i)
  assert.equal(JSON.stringify(chunks.map(c=>c.input.righe.length)),'[6,6,6,6,6,4]')
  assert.equal(JSON.stringify(chunks.flatMap(c=>c.input.righe.map(r=>r.id))),JSON.stringify(i.righe.map(r=>r.id)))
  chunks.forEach((c,n)=>{assert.equal(c.id,'chunk-'+(n+1));assert.equal(api.schemaStimeDocumentoPerInput(c.input).properties.stime.maxItems,c.input.righe.length)})
})
test('catalogo compatto conserva stato/prezzo e richiami tardivi, senza riferimenti o contesti estranei',()=>{
  const v=voci();v[12].descrizione='Adeguamento muro di confine '+ 'descrizione '.repeat(60)+' con ringhiera';v[33].prezzo_unitario=20
  const i=api.preparaInputStimeDocumento(v,[],'TESTO GLOBALE DA NON RIPETERE'),c=api.creaChunkStimeDocumento(i)[0].input
  assert.equal(c.perimetro_lavorazioni.length,34);assert(c.perimetro_lavorazioni.every(v=>v.descrizione.length<=320))
  assert(c.perimetro_lavorazioni[12].richiami_componenti.includes('ringhiera'))
  assert.equal(c.perimetro_lavorazioni[33].prezzo_unitario,20);assert(c.perimetro_lavorazioni[33].stato_prezzo)
  assert(!JSON.stringify(c).includes('DETTAGLIO_RIGA_13'));assert(!JSON.stringify(c).includes('TESTO GLOBALE DA NON RIPETERE'))
  assert(c.perimetro_lavorazioni.every(v=>!('riferimenti'in v)&&!('contesto_riga'in v)))
})
for(const [name,mutate]of [['duplicato',o=>o.stime[1].id=o.stime[0].id],['mancante',o=>o.stime.pop()],['estraneo',o=>o.stime[0].id='estraneo']])test(`identità ${name}: fallisce solo un chunk, gli altri 28 prezzi sono utilizzabili`,async()=>{
  const v=voci(),snapshot=JSON.stringify(v);let calls=0
  const result=await api.completaBozzaConStime(v,[],async i=>{calls++;const o=output(i);if(calls===2)mutate(o);return api.eseguiStimeDocumento(i,async()=>JSON.stringify(o))})
  assert.equal(calls,6);assert.equal(result.length,34);assert.equal(result.filter(v=>v.prezzo_unitario===30).length,28)
  assert(result.slice(6,12).every(v=>v.prezzo_unitario===0&&v.diagnosticaStimaDocumento.motivo==='batch_identity_invalid'))
  const d=result[6].diagnosticaStimaDocumento.identita;assert(d.missing_ids.length);assert.equal(d.duplicate_ids.length,name==='duplicato'?1:0);assert.equal(d.unexpected_ids.length,name==='estraneo'?1:0)
  assert.equal(JSON.stringify(v),snapshot)
})
test('identità invalida anche su risultato HTTP non verificato: nessun bypass del controllo client',async()=>{
  let calls=0;const r=await api.completaBozzaConStime(voci(8),[],async i=>{calls++;const o=output(i);if(calls===1)o.stime[1].id=o.stime[0].id;return o})
  assert(r.slice(0,6).every(v=>v.diagnosticaStimaDocumento.motivo==='batch_identity_invalid'));assert(r.slice(6).every(v=>v.prezzo_unitario===30))
})
test('errore trasporto non provoca retry e non scarta altri chunk',async()=>{
  let calls=0;const r=await api.completaBozzaConStime(voci(8),[],async i=>{if(++calls===1)throw Error('timeout');return richiedi(i)})
  assert.equal(calls,2);assert(r.slice(0,6).every(v=>v.prezzo_unitario===0&&v.erroreStimaDocumento));assert(r.slice(6).every(v=>v.prezzo_unitario===30))
})
test('astensione positiva o zero è invalida; null esplicito resta ND senza errore di chunk',async()=>{
  const v=voci(4),r=await api.completaBozzaConStime(v,[],i=>{const o=output(i)
    for(let n=0;n<3;n++){Object.assign(o.stime[n],{stato_stima:'astensione',prezzo_unitario_proposto:[13000,0,null][n],quantita_coperta_dal_prezzo:null,totale_riga_proposto:null,totale_riga_previsto:null,totale_componenti:null,prezzo_unitario_derivato:null,componenti_economiche:[],motivazione:'Dati economici insufficienti'})}
    return api.eseguiStimeDocumento(i,async()=>JSON.stringify(o))})
  assert.equal(r[0].diagnosticaStimaDocumento.motivo,'stima_ai_scartata');assert.equal(r[1].diagnosticaStimaDocumento.motivo,'stima_ai_scartata')
  assert.equal(r[2].diagnosticaStimaDocumento.motivo,'astensione_ai');assert.equal(r[2].prezzo_unitario,0);assert.equal(r[3].prezzo_unitario,30)
})
test('componente circolare e composito senza scomposizione restano sospesi',async()=>{
  const v=voci(3);v[1].descrizione='Revisione tetto composita'
  const r=await api.completaBozzaConStime(v,[],i=>{const o=output(i);Object.assign(o.stime[0].componenti_economiche[0],{quantita_tecnica:1,unita_tecnica:'mq',costo_unitario:30,metodo_calcolo:'altro_documentato'});o.stime[1].componenti_economiche=[];return api.eseguiStimeDocumento(i,async()=>JSON.stringify(o))})
  assert.equal(r[0].diagnosticaStimaDocumento.motivo,'stima_ai_sospesa');assert(r[0].stimaPrezzoArtecna.validazione_tecnica.codici.includes('componente_circolare_o_metodo_incoerente'))
  assert.equal(r[1].diagnosticaStimaDocumento.motivo,'stima_ai_sospesa');assert(r[1].stimaPrezzoArtecna.validazione_tecnica.codici.includes('scomposizione_assente'))
  assert.equal(r[2].prezzo_unitario,30)
})
test('nessuna revisione parziale: solo risultato finale, progress counters e richieste sequenziali',async()=>{
  const v=voci(8),before=JSON.stringify(v),pending=[],events=[];let done=false
  const promise=api.completaBozzaConStime(v,[],i=>new Promise(resolve=>pending.push(()=>resolve(output(i)))),'',p=>events.push(p)).then(r=>{done=true;return r})
  assert.equal(pending.length,1);assert.equal(done,false);pending.shift()();await new Promise(setImmediate)
  assert.equal(pending.length,1);assert.equal(done,false);assert.equal(JSON.stringify(v),before)
  assert(events.some(e=>e.completati===1&&e.totale===2));assert(events.every(e=>!('voci'in e)))
  pending.shift()();const r=await promise;assert.equal(done,true);assert.equal(r.length,8);assert(r.every(v=>v.prezzo_unitario===30));assert.equal(JSON.stringify(v),before)
  assert.equal(events.at(-1).fase,'completata')
})
test('sovrapposizioni valutate globalmente anche quando le motivazioni arrivano da chunk distinti',async()=>{
  const v=voci(8);v[0].descrizione='Fornitura e posa ringhiera in ferro';v[6].descrizione='Pittura della ringhiera'
  const r=await api.completaBozzaConStime(v,[],i=>{const o=output(i);for(const s of o.stime)if(s.id==='riga-1')s.motivazione='Ringhiera completa con verniciatura finale inclusa';return api.eseguiStimeDocumento(i,async()=>JSON.stringify(o))})
  assert(r[0].stimaPrezzoArtecna.validazione_tecnica.codici.includes('sovrapposizione_verniciatura'))
  assert(r[6].stimaPrezzoArtecna.validazione_tecnica.codici.includes('sovrapposizione_verniciatura'));assert.equal(r[6].prezzo_unitario,0)
})
test('pagina mantiene una sola azione e aggiorna entrambe le revisioni dopo await aggregazione',()=>{
  const src=fs.readFileSync(path.resolve(__dirname,'../../page.tsx'),'utf8'),start=src.indexOf('const vociBozzaDocumento = await completaBozzaConStime('),end=src.indexOf('setMostraRevisionePreventivoAi(true)',start),fragment=src.slice(start,end)
  assert(start>0);assert.equal((fragment.match(/setVociPreventivoAi\(/g)||[]).length,1);assert.equal((fragment.match(/setVociPreventivoAiOriginali\(/g)||[]).length,1)
  assert(fragment.indexOf('setVociPreventivoAi(')>fragment.indexOf('testoEstrattoDocumento,'))
})

const dir=process.env.ARTECNA_CHUNK_REPERTI
test('payload reali: solo target completi, output e schema drasticamente ridotti; limiti route invariati',{skip:!dir},()=>{
  const input=JSON.parse(fs.readFileSync(path.join(dir,'input.json'))),raw=JSON.parse(JSON.parse(fs.readFileSync(path.join(dir,'response-original.json'))).output_text)
  const chunks=api.creaChunkStimeDocumento(input),bytes=x=>Buffer.byteLength(JSON.stringify(x)),full=bytes(input),fullOut=bytes(raw)
  assert.equal(JSON.stringify(chunks.map(c=>c.input.righe.length)),'[6,6,6,6,6,4]')
  assert.equal(new Set(chunks.flatMap(c=>c.input.righe.map(r=>r.id))).size,34)
  for(const c of chunks){const ids=new Set(c.input.righe.map(r=>r.id)),out={stime:raw.stime.filter(s=>ids.has(s.id))};assert(bytes(c.input)<full*0.45);assert(bytes(out)<fullOut*0.45)
    for(const r of c.input.righe){assert.equal(JSON.stringify(r.riferimenti),JSON.stringify(api.validaInputStimeDocumento(input).righe.find(v=>v.id===r.id).riferimenti))}
  }
  const route=fs.readFileSync(path.resolve(__dirname,'../../api/prezzi/analisi-ai/route.ts'),'utf8')
  assert(route.includes('max_output_tokens: 16000'));assert(route.includes('timeout: 150000'));assert(route.includes('maxRetries: 0'));assert.equal(api.modelloStimeDocumento,'gpt-4.1-mini')
})
test('replay offline partizionato per ID, senza riparazione: falliscono solo chunk 3 e 4',{skip:!dir},async()=>{
  const names=['input.json','response-original.json','report.json'],hashes=()=>names.map(n=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,n))).digest('hex')),before=hashes()
  const [input,response,report]=names.map(n=>JSON.parse(fs.readFileSync(path.join(dir,n)))),raw=JSON.parse(response.output_text),failures=[]
  const r=await api.orchestraChunkStimeDocumento(report.voci,input,async c=>{const ids=new Set(c.righe.map(r=>r.id));const esito=await api.eseguiStimeDocumento(c,async()=>JSON.stringify({stime:raw.stime.filter(s=>ids.has(s.id))}));if(esito.diagnostica_identita)failures.push(esito.diagnostica_identita);return esito})
  assert.equal(failures.length,2);assert(failures.some(d=>d.duplicate_ids.includes('riga-16')));assert(failures.some(d=>d.missing_ids.includes('riga-24')))
  assert.equal(r.filter(v=>v.diagnosticaStimaDocumento?.motivo==='batch_identity_invalid').length,12);assert.equal(r.length,39)
  assert(r.filter(v=>v.diagnosticaStimaDocumento?.motivo==='batch_identity_invalid').every(v=>['chunk-3','chunk-4'].includes(v.diagnosticaStimaDocumento.chunk_id)))
  for(let i=0;i<r.length;i++){assert.equal(r[i].quantita,report.voci[i].quantita);if(report.voci[i].prezzo_unitario>0)assert.equal(r[i].prezzo_unitario,report.voci[i].prezzo_unitario)}
  assert.equal(JSON.stringify(hashes()),JSON.stringify(before))
})
