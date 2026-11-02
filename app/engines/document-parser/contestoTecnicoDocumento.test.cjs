/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS node:test harness for the existing TypeScript sources. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const XLSX = require('xlsx')

const app = path.resolve(__dirname, '../..')
const quiet = { log() {}, group() {}, groupEnd() {}, table() {}, warn() {}, error() {} }
const cache = new Map()
function load(file, overrides = {}) {
  file = path.resolve(file)
  if (cache.has(file) && !Object.keys(overrides).length) return cache.get(file)
  const loaded = { exports: {} }; cache.set(file, loaded.exports)
  const localRequire = (id) => {
    if (/openai|supabase|web-fallback/.test(id)) throw Error('AI/DB/Web forbidden in offline test')
    if (id in overrides) return overrides[id]
    if (id.startsWith('.') || id.startsWith('@/')) {
      const target = id.startsWith('@/') ? path.resolve(app, '..', id.slice(2)) : path.resolve(path.dirname(file), id)
      const resolved = [target, target + '.ts', target + '.tsx', path.join(target, 'index.ts')].find((p) => fs.existsSync(p) && fs.statSync(p).isFile())
      return load(resolved)
    }
    return require(id)
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module: loaded, exports: loaded.exports, require: localRequire, console: quiet, Date, Number, Math, Set })
  if (!Object.keys(overrides).length) cache.set(file, loaded.exports)
  return loaded.exports
}
const { parseExcelDocument } = load(path.join(__dirname, 'excel.ts'))
const { creaVoceAnalizzataExcel } = load(path.join(__dirname, 'voci-analizzate.ts'))

const api=load(path.join(app,'engines/price-resolution/stima-documento-ai.ts'))
const engine=load(path.join(app,'engines/preventivo/index.ts'))
const resolvePrice=load(path.join(app,'engines/price-resolution/resolver.ts')).resolvePrice
const headers=['N°','Tariffa','Descrizione lavori','Ubicazione / Dimensioni','U.M.','Quantità','Annotazioni','Pagina PDF']
function file(rows){const b=XLSX.utils.book_new();XLSX.utils.book_append_sheet(b,XLSX.utils.aoa_to_sheet(rows),'Computo estratto');const bytes=XLSX.write(b,{type:'buffer',bookType:'xlsx'});return{name:'computo.xlsx',arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}}
async function pipeline(input){
 const parsed=await parseExcelDocument(input),analyzed=parsed.rows.filter(r=>r.rowType==='voce').map(r=>creaVoceAnalizzataExcel(r))
 const page=fs.readFileSync(path.join(app,'page.tsx'),'utf8'),start=page.indexOf('const generaPreventivoDaDocumentoAnalizzato ='),end=page.indexOf('  const { data: preventivoDocumentoCreato',start)
 const prefix=page.slice(start,end);assert(!prefix.includes('supabase'))
 const context={console:quiet,resolvePrice,createPreventivoRevision:engine.createPreventivoRevision,vociAnalizzate:analyzed,prezziarioSicilia:[],nomeFileAnalisiDocumento:input.name}
 vm.createContext(context);vm.runInContext(ts.transpileModule(prefix+'return {preventivoRevision,vociDocumento}; };\nglobalThis.run=generaPreventivoDaDocumentoAnalizzato;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context)
 const {preventivoRevision,vociDocumento}=await context.run({id:'offline'})
 // Execute the actual post-persistence enrichment expression, never its DB/network neighbours.
 const line=page.split('\n').find(s=>s.includes('preparaBozzaDocumento(vociDocumento.map'))
 assert(line);const expression=line.trim().slice(0,line.trim().lastIndexOf(', knowledgeBasePrezzi,'))
 const enriched=vm.runInNewContext(expression,{vociDocumento,preventivoRevision,knowledgeBasePrezzi:[],memoriaPrezziValidi:[],preparaBozzaDocumento:load(path.join(app,'engines/price-resolution/proposte-documento.ts')).preparaBozzaDocumento})
 const inputAi=api.validaInputStimeDocumento(api.preparaInputStimeDocumento(enriched,[])),chunks=api.creaChunkStimeDocumento(inputAi)
 return{parsed,analyzed,preventivoRevision,vociDocumento,inputAi,chunks}
}
test('fotovoltaico: quantità due e potenza per ubicazione sono dati distinti',async()=>{
 const r=await pipeline(file([headers,[1,'FV','Impianto fotovoltaico completo','PIANO TERRA 3 kW: 1; PIANO PRIMO 3 kW: 1','a corpo',2,'Due ubicazioni','9']]))
 const a=r.inputAi.righe[0];assert.equal(a.quantita,2);assert.equal(a.unita,'a corpo');assert.equal(a.contesto_tecnico.ubicazioneDimensioni,'PIANO TERRA 3 kW: 1; PIANO PRIMO 3 kW: 1');assert.equal(a.contesto_tecnico.annotazioni,'Due ubicazioni')
 assert.equal(r.preventivoRevision.voci[0].contestoTecnicoDocumento.paginaPdf,'9');assert.equal(a.contesto_riga,r.parsed.rows[0].rawText)
 assert(!('contestoTecnicoDocumento' in r.vociDocumento[0]));assert(!('testoOrigine' in r.vociDocumento[0]))
})
test('quantità zero, punti tecnici e totale zero non vengono reinterpretati',async()=>{
 const r=await pipeline(file([headers,[1,'EL','Impianto elettrico circa 50 punti','Piano terra','a corpo',0,'Totale computo zero',5]])),a=r.inputAi.righe[0]
 assert.equal(a.quantita,0);assert(a.descrizione.includes('50 punti'));assert.equal(r.preventivoRevision.voci[0].totale,0);assert.equal(a.contesto_tecnico.annotazioni,'Totale computo zero')
})
test('condizionamento: quattro punti e quantità contabile quattro restano distinti',async()=>{
 const r=await pipeline(file([headers,[1,'CL','Impianto condizionamento n. 4 punti','PIANO TERRA n. 2; PIANO PRIMO n. 2','a corpo',4,'',5]])),a=r.inputAi.righe[0]
 assert.equal(a.quantita,4);assert(a.descrizione.includes('4 punti'));assert(a.contesto_tecnico.ubicazioneDimensioni.includes('n. 2'));assert.equal(a.unita,'a corpo')
})
test('serramenti, muro e zoccolatura: dimensioni e annotazioni conservate senza conversioni',async()=>{
 const rows=[[1,'SR','Serramenti alluminio 4/20/4','PORTE: 4×1,20×2,40','corpo',18.36,'Punto interrogativo',8],[2,'MU','Muro con ringhiera','MURO ESTERNO: 10,00','a corpo',10,'SOLO PILASTRI E ... MURETTO',8],[3,'ZO','Zoccolatura altezza 70 cm','MURO ESTERNO: 10,00','a corpo',10,'',8]]
 const r=await pipeline(file([headers,...rows]));r.inputAi.righe.forEach((a,i)=>{assert.equal(a.unita,rows[i][4]);assert.equal(a.quantita,rows[i][5]);assert.equal(a.contesto_tecnico.ubicazioneDimensioni,rows[i][3]);assert.equal(a.descrizione,rows[i][2])});assert.equal(r.inputAi.righe[0].contesto_tecnico.annotazioni,'Punto interrogativo')
})
test('sola posa: superficie, collante e stuccatura arrivano al chunk senza prezzo inventato',async()=>{
 const r=await pipeline(file([headers,[1,'PS','Posa pavimento con collante e stuccatura','Piano terra: 45; piano primo: 45','mq',90,'Formato 60×60',4]])),a=r.chunks[0].input.righe[0]
 assert.equal(a.ambito,'sola posa, materiale principale escluso');assert.equal(a.quantita,90);assert.equal(a.contesto_tecnico.annotazioni,'Formato 60×60');assert(a.descrizione.includes('collante'));assert.equal(r.vociDocumento[0].prezzo_unitario,0)
})
test('contesto facoltativo: nessun dato mancante viene inventato; input legacy resta valido',async()=>{
 const r=await pipeline(file([['Tariffa','Descrizione lavori','U.M.','Quantità'],['X','Posa pavimento','mq',2]]));assert.equal(r.inputAi.righe[0].contesto_tecnico,undefined)
 const bad=JSON.parse(JSON.stringify(r.inputAi));bad.righe[0].contesto_tecnico={quantita:99};assert.throws(()=>api.validaInputStimeDocumento(bad));bad.righe[0].contesto_tecnico={annotazioni:42};assert.throws(()=>api.validaInputStimeDocumento(bad))
})
test('prompt distingue dati tecnici, quantità zero, unità originali e componenti separate',()=>{
 for(const t of ['QUANTITÀ CONTABILE STRUTTURATA','CARATTERISTICHE TECNICHE','Quantità contabile zero non impone astensione','nessuna conversione implicita','la stima deve escludere la componente già valorizzata separatamente'])assert(api.istruzioniStimeDocumento.includes(t),t)
})
const reale=process.env.ARTECNA_COMPUTO_REALE
test('computo reale: 39/39, tutte le colonne documentali e i sei casi fino al prompt',{skip:!reale},async()=>{
 const bytes=fs.readFileSync(reale),book=XLSX.read(bytes,{type:'buffer'}),raw=XLSX.utils.sheet_to_json(book.Sheets['Computo estratto'],{header:1,raw:false,defval:''})
 const r=await pipeline({name:path.basename(reale),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)})
 assert.equal(r.parsed.rows.filter(r=>r.rowType==='voce').length,39);assert.equal(r.inputAi.righe.length,39)
 const targets=r.chunks.flatMap(c=>c.input.righe);assert.equal(targets.length,39);assert.equal(new Set(targets.map(r=>r.id)).size,39)
 r.inputAi.righe.forEach((a,i)=>{assert.equal(a.codice,raw[i+1][1]);assert.equal(a.descrizione,raw[i+1][2]);assert.equal(a.unita,raw[i+1][4]);assert.equal(a.quantita,r.parsed.rows[i].quantita);assert.equal(a.contesto_tecnico.ubicazioneDimensioni||'',raw[i+1][3]);assert.equal(a.contesto_tecnico.annotazioni||'',raw[i+1][6]);assert.equal(a.contesto_tecnico.paginaPdf,raw[i+1][7]);assert.equal(a.contesto_tecnico.numeroVoce,raw[i+1][0])})
 assert.equal(targets[38].quantita,2);assert(targets[38].contesto_tecnico.ubicazioneDimensioni.includes('3 kW'));assert.equal(targets[24].quantita,0);assert(targets[24].descrizione.includes('50 punti'));assert.equal(targets[23].quantita,4);assert(targets[23].descrizione.includes('4 punti'));assert.equal(targets[36].quantita,18.36);assert.equal(targets[36].unita,'corpo')
})

test('policy, matching, route e algoritmi chunk restano identici al parent approvato',()=>{
 const cp=require('node:child_process'),root=path.dirname(app),base='caae926e80a550fa3a4427caf4f96f9bad6c270c',old=f=>cp.execFileSync('git',['show',base+':'+f],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n'),now=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n')
 for(const f of ['app/engines/price-resolution/validazione-tecnica-stime.ts','app/engines/price-resolution/proposte-documento.ts','app/engines/price-resolution/resolver.ts','app/engines/price-resolution/normalizer.ts','app/engines/price-resolution/similarity.ts','app/engines/document-parser/header-detector.ts','app/api/prezzi/analisi-ai/route.ts','app/engines/document-intelligence/pdf-ocr.ts'])assert.equal(now(f),old(f),f)
 const before='preparaBozzaDocumento(vociDocumento.map((v, i) => ({ ...v, testoOrigine: vociAnalizzate[i]?.testoOrigine })), knowledgeBasePrezzi, memoriaPrezziValidi)',after='preparaBozzaDocumento(vociDocumento.map((v, i) => ({ ...v, testoOrigine: preventivoRevision.voci[i]?.testoOrigine, contestoTecnicoDocumento: preventivoRevision.voci[i]?.contestoTecnicoDocumento })), knowledgeBasePrezzi, memoriaPrezziValidi)'
 assert(now('app/page.tsx').includes(after));assert.equal(now('app/page.tsx').replace(after,before),old('app/page.tsx'),'entire page including persistence unchanged except allowed pass-through')
 const declaration=(src,name)=>{const ast=ts.createSourceFile('source.ts',src,ts.ScriptTarget.Latest,true);let found;function visit(node){if((ts.isVariableDeclaration(node)||ts.isFunctionDeclaration(node))&&node.name?.getText(ast)===name)found=node.getText(ast);ts.forEachChild(node,visit)}visit(ast);assert(found,name);return found}
 for(const name of ['creaChunkStimeDocumento','orchestraChunkStimeDocumento','completaBozzaConStime','validaOutputStimeDocumento','schemaStimeDocumento','modelloStimeDocumento'])assert.equal(declaration(now('app/engines/price-resolution/stima-documento-ai.ts'),name),declaration(old('app/engines/price-resolution/stima-documento-ai.ts'),name),name)
 for(const name of ['normalizzaValoreCella','convertiNumeroExcel','creaRawText','rilevaTipoRiga','estraiCodiceEDescrizioneVoce'])assert.equal(declaration(now('app/engines/document-parser/excel.ts'),name),declaration(old('app/engines/document-parser/excel.ts'),name),name)
 assert.equal(declaration(now('app/engines/document-intelligence/preventivo-items.ts'),'parsePreventivoItems'),declaration(old('app/engines/document-intelligence/preventivo-items.ts'),'parsePreventivoItems'))
})
