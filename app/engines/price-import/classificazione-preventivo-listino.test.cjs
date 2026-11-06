/* eslint-disable @typescript-eslint/no-require-imports -- Binary workbook regression fixtures; no real writes. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),XLSX=require('xlsx')
function load(f,cache=new Map()){
 if(cache.has(f))return cache.get(f);const exports={};cache.set(f,exports)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {exports,File,crypto:require('node:crypto').webcrypto,console:{group(){},log(){},table(){},groupEnd(){}},require:id=>id.startsWith('.')?load(path.resolve(path.dirname(f),id+'.ts'),cache):require(id)})
 return exports
}
const api=load(path.join(__dirname,'preventivo-listino.ts'))
const parse=async wb=>(await api.leggiPreventivoListino(new File([XLSX.write(wb,{type:'buffer',bookType:'xlsx'})],'regressione.xlsx'))).righe
const counts=r=>Object.fromEntries(['voce_listino','supporto_voce','strutturale','incompleta_reale','da_verificare'].map(k=>[k,r.filter(x=>x.classificazione===k).length]))
function fixture(hidden=false,extra=0){
 const wb=XLSX.utils.book_new(),main=XLSX.utils.aoa_to_sheet([['N°','Descrizione','U.M.','Quantità','Prezzo unitario'],...Array.from({length:14},(_,i)=>[i+1,'Descrizione completa opera '+i,'mq',10,12.345+i]),
 ...['CRITERI DI MISURA E LIMITI','TOTALE PARZIALE','VOCI QUANTIFICATE','QUANTITÀ COMPILATE','TOTALE OFFERTA','CRONOPROGRAMMA LAVORI','SCHEMA PAGAMENTI','Acconto alla conferma','GARANZIA E ACCETTAZIONE','Condizioni contrattuali',...Array.from({length:extra},(_,i)=>'Istruzione offerta '+i)].map(v=>[v])])
 if(hidden){main['!rows']=[];for(let i=2;i<8;i++)main['!rows'][i]={hidden:true}}
 XLSX.utils.book_append_sheet(wb,main,'Preventivo')
 const support=XLSX.utils.aoa_to_sheet([['CRITERI DI MISURA E RIFERIMENTI'],['Data della bozza'],['Note sui prezzi'],['Note sulle fonti'],['Note sulle quantità'],[],
 ['Voce','Lavorazione / U.M.','Prezzo proposto','Criterio di misura','Ipotesi / esclusioni','Confronto e provenienza','Fonte consultata (URL)'],
 ...Array.from({length:14},(_,i)=>[i+1,'Sintesi opera '+i+' [mq]',12.345+i,'Criterio','Esclusione','Benchmark 999 €/mq','https://example.invalid/fonte']),[],['FONTI GENERALI'],[],['Fonte uno'],['Fonte due'],['Fonte tre'],['Fonte quattro']])
 for(let i=0;i<14;i++){support['C'+(8+i)].f='Preventivo!E'+(2+i);support['C'+(8+i)].z='0.00" €"'}
 XLSX.utils.book_append_sheet(wb,support,'Criteri e fonti');return wb
}
test('Sotto-equivalent binary fixture: 14 candidates, 14 support, 21 structural, 0 truly incomplete, 6 hidden',async()=>{
 const r=await parse(fixture(true));assert.equal(r.length,49);assert.deepEqual(counts(r),{voce_listino:14,supporto_voce:14,strutturale:21,incompleta_reale:0,da_verificare:0});assert.equal(r.filter(x=>x.nascosta).length,6)
})
test('previous-equivalent binary fixture: 14 candidates, 14 support and 35 structural, no false incompleteness',async()=>{
 const r=await parse(fixture(false,14));assert.equal(r.length,63);assert.equal(counts(r).voce_listino,14);assert.equal(counts(r).supporto_voce,14);assert.equal(counts(r).strutturale,35);assert.equal(counts(r).incompleta_reale,0)
})
test('titles, subtotals, payment conditions, headers and sources retain original row/sheet/text/reason',async()=>{
 const r=await parse(fixture()),structural=r.filter(x=>x.classificazione==='strutturale')
 for(const word of ['CRITERI DI MISURA','TOTALE PARZIALE','SCHEMA PAGAMENTI','Acconto alla conferma','Fonte uno','Voce | Lavorazione'])assert(structural.some(x=>x.testoOriginale.includes(word)),word)
 for(const s of structural){assert(s.id);assert(s.foglio);assert(s.riga>0);assert(s.motivoClassificazione);assert(!api.rigaCandidataPreventivo(s))}
})
test('support uses exact formula cell + UM + document price, even when descriptions are abbreviated',async()=>{
 const r=await parse(fixture()),support=r.filter(x=>x.classificazione==='supporto_voce')
 assert.equal(support.length,14)
 for(let i=0;i<14;i++){assert.equal(support[i].supportoDi.riga,i+2);assert.equal(support[i].supportoDi.foglio,'Preventivo');assert.equal(support[i].datiSupporto.prezzo,12.345+i);assert.equal(support[i].datiSupporto.unita,'m2');assert(support[i].motivoClassificazione.includes('Riferimento Excel'))}
})
test('support cannot become an inserted duplicate, even if manually passed to import helper',async()=>{
 const r=await parse(fixture()),s=r.find(x=>x.classificazione==='supporto_voce');let reads=0
 await assert.rejects(api.importaPreventivoListino({from(){reads++;throw Error('Unexpected database access')}},api.confrontaPreventivoListino([s],[],false),[{id:s.id,conflitto:'nuova'}],'f.xlsx',false,true),/Riga esclusa/)
 assert.equal(reads,0)
})
test('mismatching price, UM, external/complex/unknown formula or ambiguous reference stays da_verificare',async()=>{
 for(const mutate of [w=>w.Sheets['Criteri e fonti'].C8.v=1,w=>w.Sheets['Criteri e fonti'].B8.v='Sintesi [ml]',w=>w.Sheets['Criteri e fonti'].C8.f='[other.xlsx]Preventivo!E2',w=>w.Sheets['Criteri e fonti'].C8.f='SUM(Preventivo!E2:E3)',w=>w.Sheets['Criteri e fonti'].C8.f='Preventivo!E999']){
  const w=fixture();mutate(w);const r=await parse(w),s=r.find(x=>x.foglio==='Criteri e fonti'&&x.riga===8);assert.equal(s.classificazione,'da_verificare');assert(!s.supportoDi);assert(!api.rigaCandidataPreventivo(s))
 }
})
test('support description without both unit and price stays da_verificare rather than being discarded as structural',async()=>{
 const w=fixture();w.Sheets['Criteri e fonti'].B8.v='Sintesi da verificare';delete w.Sheets['Criteri e fonti'].C8;const r=await parse(w),s=r.find(x=>x.foglio==='Criteri e fonti'&&x.riga===8)
 assert.equal(s.classificazione,'da_verificare');assert.equal(s.datiSupporto.descrizione,'Sintesi da verificare');assert.equal(s.datiSupporto.unita,'');assert.equal(s.datiSupporto.prezzo,undefined);assert(!api.rigaCandidataPreventivo(s))
})
test('without formula, only unique exact normalized description + unit + price links support; no fuzzy match',async()=>{
 for(const exact of [true,false]){const w=fixture();delete w.Sheets['Criteri e fonti'].C8.f;w.Sheets['Criteri e fonti'].B8.v=(exact?' DESCRIZIONE completa opera 0 ':'Descrizione completa opera 0 con aggiunte')+' [mq]';const r=await parse(w),s=r.find(x=>x.foglio==='Criteri e fonti'&&x.riga===8);assert.equal(s.classificazione,exact?'supporto_voce':'da_verificare')}
})
test('ambiguous exact matches stay excluded; quoted absolute formula resolves the specific original price cell',async()=>{
 const w=fixture();delete w.Sheets['Criteri e fonti'].C8.f;w.Sheets['Criteri e fonti'].B8.v='Descrizione completa opera 0 [mq]';w.Sheets.Preventivo.B3.v=w.Sheets.Preventivo.B2.v;w.Sheets.Preventivo.E3.v=w.Sheets.Preventivo.E2.v
 let r=await parse(w);assert.equal(r.find(x=>x.foglio==='Criteri e fonti'&&x.riga===8).classificazione,'da_verificare')
 w.Sheets['Criteri e fonti'].C8.f="'Preventivo'!$E$2";r=await parse(w);assert.equal(r.find(x=>x.foglio==='Criteri e fonti'&&x.riga===8).supportoDi.riga,2)
})
test('combined headers are recognized only with support-sheet context, anchors and coherent rows',async()=>{
 const w=fixture();w.SheetNames[1]='Vendita';w.Sheets.Vendita=w.Sheets['Criteri e fonti'];delete w.Sheets['Criteri e fonti'];const r=await parse(w)
 assert.equal(r.filter(x=>x.classificazione==='supporto_voce').length,0);assert(r.filter(x=>x.foglio==='Vendita').every(x=>!x.datiSupporto));assert.equal(r.filter(x=>x.foglio==='Preventivo'&&x.classificazione==='voce_listino').length,14)
})
test('a genuine row missing description, UM or price remains editable incompleta_reale; totals and notes never supply its price',async()=>{
 const w=XLSX.utils.book_new();XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([['Codice','Descrizione','U.M.','Prezzo','Totale','Note'],['A','','mq',10],['B','Opera senza unità','',20],['C','Opera senza prezzo','cad','',999,'Benchmark 200 €/cad']]),'Opere');const r=await parse(w)
 assert.equal(r.length,3);assert(r.every(x=>x.classificazione==='incompleta_reale'));assert(r.every(api.rigaCandidataPreventivo));assert.equal(r[2].form.prezzo_unitario,'')
})
test('hidden metadata comes from XLSX row flags, not SUBTOTAL or price; hidden row needs explicit local activation',async()=>{
 const r=await parse(fixture(true)),hidden=r.find(x=>x.nascosta);let reads=0;const db={from(){reads++;throw Error('Reached existing reader')}}
 await assert.rejects(api.importaPreventivoListino(db,api.confrontaPreventivoListino([hidden],[],false),[{id:hidden.id,conflitto:'salta'}],'f.xlsx',false,true),/nascosta/);assert.equal(reads,0)
 const enabled={...hidden,nascostaAbilitata:true};await assert.rejects(api.importaPreventivoListino(db,api.confrontaPreventivoListino([enabled],[],false),[{id:enabled.id,conflitto:'salta'}],'f.xlsx',false,true),/Reached existing reader/);assert.equal(reads,1)
})
test('numeric document precision is untouched; no prices extracted from benchmark, total or uncached support formula',async()=>{
 const w=fixture();w.Sheets['Criteri e fonti'].C8={t:'n',f:'Preventivo!E2'};const r=await parse(w),main=r.find(x=>x.foglio==='Preventivo'&&x.riga===2),support=r.find(x=>x.foglio==='Criteri e fonti'&&x.riga===8)
 assert.equal(main.prezzoDocumentale,12.345);assert.equal(main.form.prezzo_unitario,'12.345');assert.equal(support.classificazione,'da_verificare');assert.equal(support.datiSupporto.prezzo,undefined)
})
for(const [env,expected] of [['ARTECNA_PREVENTIVO_SOTTO',[49,21,6]],['ARTECNA_PREVENTIVO_PRECEDENTE',[63,35,0]]])test('real workbook read-only: '+env,{skip:!process.env[env]},async()=>{
 const p=process.env[env],b=fs.readFileSync(p),hash=require('node:crypto').createHash('sha256').update(b).digest('hex'),r=(await api.leggiPreventivoListino(new File([b],path.basename(p)))).righe
 assert.equal(r.length,expected[0]);assert.equal(counts(r).voce_listino,14);assert.equal(counts(r).supporto_voce,14);assert.equal(counts(r).strutturale,expected[1]);assert.equal(counts(r).incompleta_reale,0);assert.equal(counts(r).da_verificare,0);assert.equal(r.filter(x=>x.nascosta).length,expected[2]);assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex'),hash)
})
