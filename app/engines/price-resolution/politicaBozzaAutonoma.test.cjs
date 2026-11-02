/* eslint-disable @typescript-eslint/no-require-imports -- Offline orchestration, no provider/DB imports. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
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


const tech=load(path.join(__dirname,'validazione-tecnica-stime.ts')),draft=load(path.join(__dirname,'proposte-documento.ts'))
const riga=()=>api.preparaInputStimeDocumento(voci(1),[]).righe[0]
const valida=(r,s)=>tech.validaTecnicamenteStima(r,s,[])
test('stima oraria senza fonte esterna entra arancione, mai supportata',()=>{
 const v=voci(1),i=api.preparaInputStimeDocumento(v,[]),out=api.applicaStimeDocumento(v,i,output(i))[0]
 assert.equal(out.prezzo_unitario,30);assert.equal(draft.statoPrezzoDocumento(out),'stima_ai_da_controllare');assert.equal(out.stimaPrezzoArtecna.validazione_tecnica.supporto_economico,'autonomo')
 assert.equal(out.priceResolution.strategy,'no_match');assert.equal(out.quantita*out.prezzo_unitario,240)
})
test('costo documentale realmente citato può essere supportato',()=>{
 const r=riga(),s=stima(r);r.contesto_riga='Costo posatore 40 euro/ora concordato nel documento.'
 s.componenti_economiche[0].origine_costo={tipo:'documento',descrizione:'Costo posatore concordato',base_documentale:r.contesto_riga}
 assert.equal(valida(r,s).stato,'accettata');assert.equal(valida(r,s).supporto_economico,'supportato')
})
test('riferimento completo soltanto consultato non blocca sola posa autonoma',()=>{
 const r=riga(),s=stima(r);r.riferimenti=[{id:'ref',codice:'TEST',fonte:'Fixture',descrizione:'Fornitura e posa pavimento ceramico',unita:'mq',prezzo:80}]
 s.riferimenti_utilizzati=['ref'];s.riferimenti_ancoraggio=[]
 assert.equal(valida(r,s).stato,'accettata');assert.equal(valida(r,s).supporto_economico,'autonomo')
 s.riferimenti_ancoraggio=['ref'];assert.notEqual(valida(r,s).stato,'accettata')
})
test('prezzo semplice nominale è una stima autonoma, non una prova economica',()=>{
 const r=riga(),s=stima(r);Object.assign(s.componenti_economiche[0],{quantita_tecnica:1,unita_tecnica:'mq',costo_unitario:30,metodo_calcolo:'altro_documentato'})
 const t=valida(r,s);assert.equal(t.stato,'accettata');assert.equal(t.supporto_economico,'autonomo');assert(t.avvisi.some(a=>a.includes('non dimostrato')))
})
test('metodo orario con superficie è contraddizione tecnica e resta sospeso',()=>{
 const r=riga(),s=stima(r);s.componenti_economiche[0].unita_tecnica='mq';assert.notEqual(valida(r,s).stato,'accettata')
})
for(const [name,mutate]of [
 ['totale errato',s=>s.totale_riga_proposto=999],['quantità modificata',s=>s.quantita_strutturata=99],
 ['U.M. modificata',s=>s.unita_interpretata='corpo'],['prezzo complessivo',s=>s.quantita_coperta_dal_prezzo=8],
 ['prodotto componente errato',s=>s.componenti_economiche[0].subtotale=99],
 ['fonte documentale inventata',s=>s.componenti_economiche[0].origine_costo={tipo:'documento',descrizione:'Fonte non presente',base_documentale:'Costo 40 euro/ora'}],
])test('hard block: '+name,()=>{const r=riga(),s=stima(r);mutate(s);assert.notEqual(valida(r,s).stato,'accettata')})
test('composito con costi autonomi e componenti complete entra arancione',()=>{
 const r=riga();r.descrizione='Fornitura e posa fossa Imhoff';r.composita=true;const s=stima(r);s.lavorazione_composita=true
 s.componenti_economiche=[['materiale','Vasca',20],['posa','Installazione',10]].map(([categoria,descrizione,importo_unitario])=>({...stima(r).componenti_economiche[0],categoria,descrizione,importo_unitario,quantita_tecnica:1,unita_tecnica:'mq',costo_unitario:importo_unitario,subtotale:importo_unitario,metodo_calcolo:'altro_documentato'}))
 assert.equal(valida(r,s).stato,'accettata');assert.equal(valida(r,s).supporto_economico,'autonomo')
 s.componenti_economiche.pop();assert.notEqual(valida(r,s).stato,'accettata')
})
test('astensione con prezzo e duplicati identità restano bloccati',async()=>{
 const v=voci(2),i=api.preparaInputStimeDocumento(v,[]),o=output(i);o.stime[0].stato_stima='astensione'
 const e=await api.eseguiStimeDocumento(i,async()=>JSON.stringify(o));assert(e.righe_invalide.some(r=>r.id==='riga-1'))
 o.stime[1].id=o.stime[0].id;const bad=await api.eseguiStimeDocumento(i,async()=>JSON.stringify(o));assert(bad.diagnostica_identita)
 const result=api.applicaStimeDocumento(v,i,bad);assert(result.every(r=>r.prezzo_unitario===0));assert.equal(draft.riepilogoPrezziDocumento(result).batch_identity_invalid,2)
})
test('modifica locale del prezzo resta consentita e distinta dalla stima originale',()=>{
 const v=voci(1),i=api.preparaInputStimeDocumento(v,[]),out=api.applicaStimeDocumento(v,i,output(i))[0]
 assert.equal(draft.statoPrezzoDocumento({...out,prezzo_unitario:50}),'modificato_utente')
})

const reperti=process.env.ARTECNA_REPLAY_CHUNK_REPERTI
test('replay reale offline: 39 righe, 11 autonome, 16 prezzi e hard block conservati',{skip:!reperti},async()=>{
 const read=n=>JSON.parse(fs.readFileSync(path.join(reperti,n),'utf8')),base=read('baseline.json'),input=read('input.json'),chunks=read('chunks.json'),before=JSON.stringify(base);let calls=0
 const hashes=chunks.map(c=>fs.readFileSync(path.join(reperti,c.id+'-response-text.json'),'utf8'))
 const result=await api.orchestraChunkStimeDocumento(base,input,context=>{const c=chunks[calls++];assert.equal(JSON.stringify(context),JSON.stringify(c.input));return api.eseguiStimeDocumento(context,async()=>hashes[calls-1])})
 assert.equal(calls,6);assert.equal(JSON.stringify(base),before);assert.equal(result.length,39)
 assert.deepEqual({...draft.riepilogoPrezziDocumento(result)},{prezzo_affidabile:3,proposta_locale:2,stima_ai_supportata:0,stima_ai_da_controllare:11,astensione_ai:6,batch_identity_invalid:0,stima_ai_sospesa:14,stima_ai_scartata:3,prezzo_non_determinabile:0,modificato_utente:0})
 assert.equal(result.filter(v=>v.prezzo_unitario>0).length,16);assert.equal(Number(result.reduce((s,v)=>s+v.quantita*v.prezzo_unitario,0).toFixed(2)),29338.24)
 for(const n of [10,15,20,21,24,29,31,32,35,36,37,38,39])assert.equal(result[n-1].prezzo_unitario,0,'Hard block riga '+n)
 for(let n=0;n<39;n++){assert.equal(result[n].quantita,base[n].quantita);assert.equal(result[n].unita_misura,base[n].unita_misura);if(base[n].prezzo_unitario>0)assert.equal(result[n].prezzo_unitario,base[n].prezzo_unitario)}
 chunks.forEach((c,n)=>assert.equal(fs.readFileSync(path.join(reperti,c.id+'-response-text.json'),'utf8'),hashes[n]))
})
