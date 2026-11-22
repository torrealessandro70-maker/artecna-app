/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic offline Excel fixtures. */
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),ts=require('typescript')
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f)
const {centesimiExcel:money,dataExcel:date,analizzaRigheExcel:parse,filtraExcel:filter,filtriVuoti:filters,totaleExcel:sum,leggiExportExcel:read}=require('./riepilogoExcel.ts')
const header=['Data documento','Numero documento','Cliente/Fornitore','Tipo documento','Totale documento','Stato']
const row=(over={})=>Object.values({date:'22/10/2026',number:'15',party:'Cliente sintetico',type:'TD01',amount:'8.467,51',state:'Consegnata',...over})
for(const [input,expected] of [['8.467,51',846751],['19.892,20',1989220],['0,01',1],['-22,45',-2245],['(10,00)',-1000],[122.05,12205],[1.005,null],['1.234',null],['1,234.56',null],['',null],[Infinity,null],[{formula:'1+2',result:3},null]])test('exact cents '+JSON.stringify(input),()=>assert.equal(money(input),expected))
test('Excel dates: 1900, leap-year bug, 1904, real dates and invalid dates',()=>{
 assert.equal(date(1),'1900-01-01');assert.equal(date(60),null);assert.equal(date(61),'1900-03-01');assert.equal(date(0,true),'1904-01-01');assert.equal(date('31/02/2026'),null);assert.equal(date('2026-10-22'),'2026-10-22');assert.equal(date(new Date('2026-10-22T00:00Z')),'2026-10-22')
})
test('document rows only: totals, notes, blanks, repeated headers and formula amounts excluded',()=>{
 const p=parse([header,row(),[],['Totale','','','','8.467,51'],['Nota: esportazione'],header,row({number:'16',amount:{formula:'1+2',result:3}})])
 assert.equal(p.documenti.length,1);assert.equal(sum(p.documenti),846751);assert.equal(p.esclusioni.length,4)
})
test('credit notes signed exactly once, even if source already negative',()=>{
 const p=parse([header,row({amount:100}),row({number:'2',type:'TD04',amount:'22,50'}),row({number:'3',type:'Nota di credito',amount:'-5,00'}),row({number:'4',type:'TD08',amount:1})]);assert.equal(sum(p.documenti),7150)
})
test('exact duplicates counted once and conflicting identity quarantined entirely',()=>{
 let p=parse([header,row(),row()]);assert.equal(p.documenti.length,1);assert.match(p.esclusioni[0].motivo,/Duplicato/)
 p=parse([header,row(),row({amount:'1,00'})]);assert.equal(p.documenti.length,0);assert.equal(p.esclusioni.length,2)
})
test('same number different counterparty or year remains distinct',()=>{
 assert.equal(parse([header,row(),row({party:'Altro cliente'}),row({date:'22/10/2025'})]).documenti.length,3)
})
test('filters and ordering recompute gross totals without modifying original rows',()=>{
 const p=parse([header,row({number:'A',amount:'10,01'}),row({number:'B',date:'01/01/2025',amount:'20,02'})]);const before=JSON.stringify(p)
 assert.equal(sum(filter(p.documenti,{...filters,da:'2026-01-01'})),1001)
 assert.equal(filter(p.documenti,{...filters,numero:'B'})[0].centesimi,2002)
 assert.equal(filter(p.documenti,{...filters,controparte:'assente'}).length,0)
 assert.equal(filter(p.documenti,{...filters,ordine:'importo-desc'})[0].numero,'B');assert.equal(JSON.stringify(p),before)
})
test('missing/ambiguous headers reject file rather than show false zero',()=>{
 assert.throws(()=>parse([['Totale'],[12]]));assert.throws(()=>parse([[...header,'Importo'],row()]));assert.throws(()=>parse([['Data','Numero','Cliente','Totale'],[]]))
})
test('unknown document type and invalid date never enter totals',()=>{
 const p=parse([header,row({type:'Totale'}),row({date:'31/02/2026'}),row({type:'TD99'})]);assert.equal(p.documenti.length,0);assert.equal(p.esclusioni.length,3)
})
test('unsafe sums and excessive rows stop explicitly',()=>{
 assert.throws(()=>sum([{centesimi:Number.MAX_SAFE_INTEGER},{centesimi:1}]));assert.throws(()=>parse(Array.from({length:20001},()=>[])))
})
test('actual XLSX bytes, rich text, numeric amounts, replacement and date1904',async()=>{
 const ExcelJS=require('exceljs');const w=new ExcelJS.Workbook();w.properties.date1904=true;const s=w.addWorksheet('Documenti');s.addRow(header);s.addRow([0,'1',{richText:[{text:'Cliente '},{text:'sintetico'}]},'TD01',100.01,'Inviata']);s.addRow([1,'2','Fornitore sintetico','TD04',10,'Inviata'])
 const bytes=await w.xlsx.writeBuffer();const parsed=await read(bytes);assert.equal(parsed.documenti.length,2);assert.equal(parsed.documenti[0].data,'1904-01-01');assert.equal(sum(parsed.documenti),9001)
 const replacement=new ExcelJS.Workbook();replacement.addWorksheet('Nuovo').addRows([header,row({amount:'5,00'})]);assert.equal(sum((await read(await replacement.xlsx.writeBuffer())).documenti),500)
})
test('multiple document sheets and corrupt file rejected, no silent sheet omission',async()=>{
 const ExcelJS=require('exceljs');const w=new ExcelJS.Workbook();w.addWorksheet('A').addRows([header,row()]);w.addWorksheet('B').addRows([header,row()]);const bytes=await w.xlsx.writeBuffer();await assert.rejects(()=>read(bytes),/solo foglio/)
 await assert.rejects(()=>read(new ArrayBuffer(0)))
 await assert.rejects(()=>read(new Uint8Array([1,2,3]).buffer))
})
test('Bluenext observed headers: preserves textual leading zeros, dates, negative credit and excludes trailing totals',async()=>{
 const ExcelJS=require('exceljs');const w=new ExcelJS.Workbook();const s=w.addWorksheet('Foglio')
 s.addRow(['Num. documento','Data doc.','Tipo','Fornitore','Partita IVA','Importo','Esito invio'])
 s.addRow(['000015',46317,'Fattura','Fornitore sintetico','',100.01,'Consegnata'])
 s.addRow(['000016',46317,'Fattura differita','Fornitore sintetico','',20,'Consegnata'])
 s.addRow(['000017',46317,'Parcella','Fornitore sintetico','',10,'Consegnata'])
 s.addRow(['000018',46317,'Nota di Credito','Fornitore sintetico','',-5.01,'Consegnata'])
 s.addRow(['Totale','','','','',125]);s.addRow(['Calcolo','','','','',250])
 const p=await read(await w.xlsx.writeBuffer());assert.equal(p.documenti.length,4);assert.equal(sum(p.documenti),12500);assert.equal(p.documenti[0].numero,'000015');assert.equal(p.documenti[3].centesimi,-501);assert.equal(p.documenti[0].stato,'Consegnata');assert.equal(p.esclusioni.length,2)
 const changed=w.getWorksheet('Foglio');changed.getCell('D1').value='Cliente';assert.equal((await read(await w.xlsx.writeBuffer())).documenti.length,4)
})
test('exact Bluenext deferred invoice label is included; unrelated labels remain excluded',()=>{
 const p=parse([header,row({number:'D1',type:'Fattura differita art.21. comma 4, lett. a)',amount:'49,00'}),row({number:'D2',type:'Fattura differita art.21. comma 4, lett. a)',amount:'36,61'}),row({number:'D3',type:'Fattura differita art.21. comma 4, lett. a)',amount:'29,30'}),row({number:'X1',type:'Fattura differita sconosciuta',amount:'999,00'})])
 assert.equal(p.documenti.length,3);assert.equal(sum(p.documenti),11491);assert.equal(p.esclusioni.length,1)
})
