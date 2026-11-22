/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic UI tests. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup:render}=require('react-dom/server')
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,f)
require.extensions['.css']=m=>{m.exports={default:{}}}
const {default:Panel,TabellaExport}=require('./RiepilogoExcelPanel.tsx'),{filtriVuoti}=require('../engines/contabilita-ditta/riepilogoExcel.ts')
test('five independent KPI, two file inputs and no false zero for missing sources',()=>{
 const html=render(React.createElement(Panel));assert.equal((html.match(/type="file"/g)||[]).length,2)
 for(const s of ['Riepilogo da export Bluenext','Numero fatture emesse','Totale lordo emesse','Numero documenti ricevuti','Totale lordo ricevute','Differenza lorda','Non disponibile','database','nessuna liquidazione fiscale'])assert(html.toLowerCase().includes(s.toLowerCase()),s)
})
test('separate accessible table, source status and pagination of 25 documents',()=>{
 const documenti=Array.from({length:26},(_,i)=>({id:String(i),riga:i+2,data:'2026-10-22',numero:String(i+1),controparte:'Fixture',tipo:'TD01',centesimi:100,stato:'Inviata'}))
 const html=render(React.createElement(TabellaExport,{titolo:'Fatture emesse',fonte:{nome:'Sintetico.xlsx',dati:{documenti,esclusioni:[{riga:50,motivo:'Duplicato sintetico'}],foglio:'Foglio 1'}},filtri:filtriVuoti}))
 assert(html.includes('Pagina 1 di 2'));assert.equal((html.match(/<tr>/g)||[]).length,26);assert(html.includes('26,00'));assert(html.includes('Duplicato sintetico'));assert(html.includes('Stato'))
})
test('integration preserves IVA and conti panels, no database/storage/network writer',()=>{
 const s=fs.readFileSync(path.join(__dirname,'RiepilogoDittaPanel.tsx'),'utf8');for(const n of ['<RiepilogoExcelPanel','<ProspettoIvaPanel','<ContiDaVerificarePanel'])assert(s.includes(n))
 for(const file of ['RiepilogoExcelPanel.tsx','../engines/contabilita-ditta/riepilogoExcel.ts']){const source=fs.readFileSync(path.join(__dirname,file),'utf8');assert(!/\b(fetch|localStorage|sessionStorage|supabase)\b|\.(insert|update|delete|rpc|upload)\s*\(/.test(source))}
})
