/* eslint-disable @typescript-eslint/no-require-imports -- Offline injected data only; no provider or DB. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto')
const cache=new Map()
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const m={exports:{}};cache.set(file,m.exports)
  const req=id=>{if(/openai|supabase|web-fallback/.test(id))throw Error('Network/provider/DB forbidden');if(!id.startsWith('.'))return require(id);const p=path.resolve(path.dirname(file),id);return load([p+'.ts',p+'.tsx',path.join(p,'index.ts')].find(fs.existsSync))}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:req,console,Set,Map,Math,Number,Date});return m.exports}
const api=load(path.join(__dirname,'stima-documento-ai.ts')),tech=load(path.join(__dirname,'validazione-tecnica-stime.ts'))
const voce=(q=8)=>({descrizione:'Posa pavimento ceramico con collante',unita_misura:'mq',quantita:q,prezzo_unitario:0,bozzaDocumento:true,priceResolution:{strategy:'no_match',matched:false}})
const make=()=>api.preparaInputStimeDocumento([voce()],[])
const stima=r=>({id:r.id,stato_stima:'proposta',prezzo_unitario_proposto:30,unita_interpretata:r.unita,tipo:'stima_artecna_ai',affidabilita:'alta',motivazione:'Sola manodopera: 0,75 ore uomo per unità originale a 40 euro/ora, ipotesi tecnica esplicita, materiale principale escluso.',
  riferimenti_utilizzati:[],avvisi:[],lavorazione_composita:false,quantita_coperta_dal_prezzo:1,totale_riga_proposto:30*r.quantita,quantita_strutturata:r.quantita,totale_riga_previsto:30*r.quantita,
  unita_economica:{descrizione:'Una unità originale',base_documentale:r.descrizione},riferimenti_ancoraggio:[],metodo_calcolo:'analisi_unitaria',totale_componenti:30,prezzo_unitario_derivato:30,scorporo_fornitura:null,esclusioni_componenti:[],
  componenti_economiche:[{categoria:'posa',descrizione:'Manodopera del posatore per un metro quadrato',importo_unitario:30,riferimento_id:null,quantita_tecnica:0.75,unita_tecnica:'h',costo_unitario:40,subtotale:30,metodo_calcolo:'ore_uomo',origine_costo:{tipo:'ipotesi_tecnica_esplicita',descrizione:'Ipotesi dichiarata di costo orario del posatore, non listino certificato',base_documentale:null}}]})
const giudica=(r,s)=>tech.validaTecnicamenteStima(r,s,[])

for(const [name,mutate,duplicates,missing,unexpected]of [
  ['duplicato',o=>o.stime.push(o.stime[0]),['riga-1'],[],[]],
  ['mancante',o=>o.stime.pop(),[],['riga-1'],[]],
  ['estraneo',o=>o.stime[0].id='estraneo',[],['riga-1'],['estraneo']],
  ['duplicato ed estraneo',o=>{o.stime=[{...o.stime[0],id:'altro'},{...o.stime[0],id:'altro'}]},['altro'],['riga-1'],['altro']],
])test(`identità ${name}: diagnostica completa e fail-safe anche su esito contraffatto`,async()=>{
  const i=make(),o={stime:[stima(i.righe[0])]};mutate(o)
  const e=await api.eseguiStimeDocumento(i,async()=>JSON.stringify(o))
  assert(e.errore);assert.equal(e.stime.length,0)
  for(const [k,v]of [['duplicate_ids',duplicates],['missing_ids',missing],['unexpected_ids',unexpected]])assert.equal(JSON.stringify(e.diagnostica_identita[k]),JSON.stringify(v))
  const applied=api.applicaStimeDocumento([voce()],i,o)[0];assert.equal(applied.prezzo_unitario,0);assert(applied.erroreStimaDocumento.includes('missing_ids'))
})
test('identità: ID vuoto/oggetto malformato non viene ricostruito',async()=>{
  const i=make();for(const s of [null,{}, {id:''},{id:5}]){const e=await api.eseguiStimeDocumento(i,async()=>JSON.stringify({stime:[s]}));assert(e.errore);assert.equal(JSON.stringify(e.diagnostica_identita.invalid_positions),'[1]')}
})
test('identità: ordine risposta libero, associazione esclusivamente per ID',()=>{
  const v=[voce(),{...voce(),descrizione:'Posa maiolica rivestimento'}],i=api.preparaInputStimeDocumento(v,[]),o={stime:i.righe.map(stima).reverse()}
  const result=api.applicaStimeDocumento(v,i,o);assert(result.every(v=>v.prezzo_unitario===30));assert.equal(result[0].stimaPrezzoArtecna.id,'riga-1')
})
test('astensione valida, completa e motivata mantiene la copertura identitaria',async()=>{
  const i=make(),s={...stima(i.righe[0]),stato_stima:'astensione',prezzo_unitario_proposto:null,quantita_coperta_dal_prezzo:null,totale_riga_proposto:null,totale_riga_previsto:null,totale_componenti:null,prezzo_unitario_derivato:null,componenti_economiche:[],motivazione:'Non stimabile: costo orario non dimostrato'}
  const e=await api.eseguiStimeDocumento(i,async()=>JSON.stringify({stime:[s]}));assert(!e.errore);assert.equal(e.stime.length,1);assert.equal(e.stime[0].prezzo_unitario_proposto,null)
  s.stato_stima='proposta';assert.throws(()=>api.validaOutputStimeDocumento({stime:[s]},i),/astensione/)
})
test('schema e prompt mantengono id unico e impongono astensione/prova quantitativa',()=>{
  const schema=api.schemaStimeDocumentoPerInput(make()).properties.stime
  assert.equal(schema.minItems,1);assert.equal(schema.maxItems,1)
  for(const k of ['stato_stima','metodo_calcolo','totale_componenti','prezzo_unitario_derivato'])assert(schema.items.required.includes(k))
  for(const k of ['quantita_tecnica','unita_tecnica','costo_unitario','subtotale','origine_costo'])assert(schema.items.properties.componenti_economiche.items.required.includes(k))
  for(const text of ['voce_id è il campo JSON id','UNA SOLA VOLTA','astensione','ore uomo/squadra'])assert(api.istruzioniStimeDocumento.includes(text))
})

test('sola posa quantitativa: 0,75 ore × 40 = 30 per m², applicata con avviso di ipotesi',()=>{
  const i=make(),s=stima(i.righe[0]);assert.equal(api.validaOutputStimeDocumento({stime:[s]},i).length,1)
  const v=api.applicaStimeDocumento([voce()],i,{stime:[s]})[0];assert.equal(v.prezzo_unitario,30);assert.equal(v.quantita*v.prezzo_unitario,240)
  assert(v.stimaPrezzoArtecna.validazione_tecnica.avvisi.some(a=>a.includes('non certificato')))
})
test('riferimento semplice pertinente continua a passare senza inventare analisi autonome',()=>{
  const r={...make().righe[0],riferimenti:[{id:'prezzo',codice:'TEST',fonte:'Fixture',descrizione:voce().descrizione,unita:'mq',prezzo:30}]},s=stima(r)
  delete s.metodo_calcolo;delete s.totale_componenti;delete s.prezzo_unitario_derivato;s.componenti_economiche=[];s.riferimenti_utilizzati=['prezzo'];s.riferimenti_ancoraggio=['prezzo']
  assert.equal(giudica(r,s).stato,'accettata')
})
for(const [name,mutate,code]of [
  ['costo mancante',s=>delete s.componenti_economiche[0].costo_unitario,'base_componente_assente'],
  ['quantità tecnica assente',s=>delete s.componenti_economiche[0].quantita_tecnica,'base_componente_assente'],
  ['prodotto errato',s=>s.componenti_economiche[0].quantita_tecnica=2,'calcolo_componente_incoerente'],
  ['somma diversa dal dichiarato',s=>s.totale_componenti=60,'totale_analisi_incoerente'],
  ['prezzo derivato diverso',s=>s.prezzo_unitario_derivato=60,'totale_analisi_incoerente'],
  ['totale riga diverso',s=>s.totale_riga_proposto=999,'totale_analisi_incoerente'],
  ['totale previsto diverso',s=>s.totale_riga_previsto=999,'totale_analisi_incoerente'],
  ['circolo posa=prezzo',s=>Object.assign(s.componenti_economiche[0],{quantita_tecnica:1,unita_tecnica:'mq',costo_unitario:30,metodo_calcolo:'altro_documentato'}),'componente_circolare_o_metodo_incoerente'],
  ['ore con U.M. mq',s=>s.componenti_economiche[0].unita_tecnica='mq','componente_circolare_o_metodo_incoerente'],
  ['fonte generica',s=>s.componenti_economiche[0].origine_costo={tipo:'documento',descrizione:'Costo comune',base_documentale:null},'origine_costo_non_verificata'],
  ['numero quantità non prova costo',s=>s.componenti_economiche[0].origine_costo={tipo:'documento',descrizione:'Presunto costo',base_documentale:'Quantità 40 mq'},'origine_costo_non_verificata'],
])test(`prova economica blocca ${name}`,()=>{const r=make().righe[0],s=stima(r);r.contesto_riga='Quantità 40 mq';mutate(s);const v=giudica(r,s);assert.notEqual(v.stato,'accettata');assert(v.codici.includes(code),JSON.stringify(v))})
test('materiale principale non diventa sola posa nemmeno con prodotto numerico corretto',()=>{
  const r=make().righe[0],s=stima(r),c=s.componenti_economiche[0];Object.assign(c,{categoria:'materiale',descrizione:'Piastrelle ceramiche',metodo_calcolo:'materiale',unita_tecnica:'mq'})
  assert(giudica(r,s).codici.includes('materiale_principale_incluso'))
})
test('quantità zero preservata, analisi unitaria positiva e totale zero',()=>{
  const v=voce(0),i=api.preparaInputStimeDocumento([v],[]),s=stima(i.righe[0]);const a=api.applicaStimeDocumento([v],i,{stime:[s]})[0]
  assert.equal(a.prezzo_unitario,30);assert.equal(a.quantita,0);assert.equal(a.quantita*a.prezzo_unitario,0)
})
test('componente locale quantitativa usa costo del riferimento, non prezzo arbitrario',()=>{
  const r={...make().righe[0],riferimenti:[{id:'posa',codice:'TEST',fonte:'Fixture',descrizione:voce().descrizione,unita:'mq',prezzo:15}]},s=stima(r)
  s.componenti_economiche=[{...s.componenti_economiche[0],descrizione:voce().descrizione,riferimento_id:'posa',quantita_tecnica:2,unita_tecnica:'mq',costo_unitario:15,metodo_calcolo:'riferimento_locale',origine_costo:{tipo:'riferimento_locale',descrizione:'Due unità tecniche al costo del riferimento ricevuto',base_documentale:null}}]
  assert.equal(giudica(r,s).stato,'accettata')
  s.componenti_economiche[0].costo_unitario=16
  assert(giudica(r,s).codici.includes('origine_costo_non_verificata'))
})
test('costo documentale richiede citazione economica reale, non dichiarazione inventata',()=>{
  const r=make().righe[0],s=stima(r),c=s.componenti_economiche[0];r.contesto_riga='Costo concordato del posatore: 40 euro per ora.'
  c.origine_costo={tipo:'documento',descrizione:'Costo orario indicato nel documento ricevuto',base_documentale:r.contesto_riga}
  assert.equal(giudica(r,s).stato,'accettata')
  c.origine_costo.base_documentale='Costo concordato del posatore: 45 euro per ora.'
  assert(giudica(r,s).codici.includes('origine_costo_non_verificata'))
})
test('solo affidabilità alta non sana una base circolare',()=>{
  const r=make().righe[0],s=stima(r);delete s.componenti_economiche[0].quantita_tecnica
  for(const affidabilita of ['alta','media','bassa'])assert.notEqual(giudica(r,{...s,affidabilita}).stato,'accettata')
})
test('Imhoff composita con componenti nominali ma senza costi/quantità resta sospesa',()=>{
  const r={...make().righe[0],descrizione:'Fornitura e posa fossa Imhoff',composita:true},s=stima(r)
  s.componenti_economiche=[{categoria:'materiale',descrizione:'Vasca Imhoff',importo_unitario:20,riferimento_id:null},{categoria:'posa',descrizione:'Installazione vasca',importo_unitario:10,riferimento_id:null}]
  const v=giudica(r,s);assert.equal(v.stato,'sospesa_da_verificare');assert(v.codici.includes('base_componente_assente'))
})

const dir=process.env.ARTECNA_BATCH_REPERTI
test('risposta reale: duplicati 16/39 e mancanti 24/30; nessun prezzo applicato e reperti immutati',{skip:!dir},async()=>{
  const names=['input.json','response-original.json','report.json'],bytes=names.map(n=>fs.readFileSync(path.join(dir,n))),hashes=bytes.map(b=>crypto.createHash('sha256').update(b).digest('hex'))
  const [input,response,report]=bytes.map(b=>JSON.parse(b)),before=JSON.stringify(report.voci)
  const result=await api.eseguiStimeDocumento(input,async()=>response.output_text)
  assert(result.errore);assert.equal(result.stime.length,0)
  assert.equal(JSON.stringify(result.diagnostica_identita.duplicate_ids),'["riga-16","riga-39"]');assert.equal(JSON.stringify(result.diagnostica_identita.missing_ids),'["riga-24","riga-30"]');assert.equal(JSON.stringify(result.diagnostica_identita.unexpected_ids),'[]')
  const applied=api.applicaStimeDocumento(report.voci,input,result)
  assert.equal(applied.length,39);assert.equal(Number(applied.reduce((sum,v)=>sum+v.quantita*v.prezzo_unitario,0).toFixed(2)),12570.74)
  assert.equal(JSON.stringify(report.voci),before)
  assert.equal(JSON.stringify(hashes),JSON.stringify(names.map(n=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,n))).digest('hex'))))
})
for(const [name,pattern]of [['vespaio',/vespaio/i],['controtelai',/telaio esterno/i],['posa pavimento',/^Posa in opera di pavimento/i],['posa rivestimento',/^Posa in opera di maiolica/i],['tetto',/Revisione di copertura/i],['facciata',/ripristino di facciata/i],['muro',/muro di confine/i],['zoccolatura',/zoccolatura in pietra/i],['serramenti',/^Fornitura e posa in opera di serramenti esterni/i],['ringhiera',/^Fornitura e posa in opera di ringhiera/i]])test(`risposta reale isolata ${name}: nessuna accettazione senza prova`,{skip:!dir},()=>{
  const input=JSON.parse(fs.readFileSync(path.join(dir,'input.json'))),response=JSON.parse(JSON.parse(fs.readFileSync(path.join(dir,'response-original.json'))).output_text)
  const r=input.righe.find(r=>pattern.test(r.descrizione));assert(r,name);const s=response.stime.find(s=>s.id===r.id);assert(s,name)
  const result=giudica(r,s);assert.notEqual(result.stato,'accettata',JSON.stringify(result));assert(result.codici.includes('prova_economica_assente'))
})
