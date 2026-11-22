/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic read-only UI. */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript')
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, file)
require.extensions['.css'] = module => { module.exports = { default: {} } }
const {default: Panel, DettagliIva} = require('./ProspettoIvaPanel.tsx')
const {preparaArchivioIva, costruisciProspettoIva} = require('../engines/contabilita-ditta/prospettoIva.ts')
const { fontiInCaricamento } = require('../engines/contabilita-ditta/riepilogo.ts')
const periodo = { da: '2026-01-01', a: '2026-03-31' }
function sources() { return { ...fontiInCaricamento(), fatture_emesse: { stato: 'pronta', righe: [{ id: 'e1', cliente: 'Cliente fixture', numero_fattura: '1', data_fattura: '2026-01-12', imponibile: '100', iva: '22', totale: '122' }] }, fatture_fornitori: { stato: 'pronta', righe: [] } } }
const render = (fonti = sources(), p = periodo, extra = {}) => renderToStaticMarkup(React.createElement(Panel, { fonti, periodo: p, ...extra }))
const detail = (fonti=sources(), p=periodo, extra={}) => {const archivio=preparaArchivioIva(fonti);return renderToStaticMarkup(React.createElement(DettagliIva,{fonti,periodo:p,archivio,prospetto:costruisciProspettoIva(archivio,p),...extra}))}

test('compact summary always exposes both VAT amounts, difference, coverage and independent fiscal balance', () => {
  const html = render()
  for (const label of ['IVA esposta sulle fatture emesse','IVA esposta sulle fatture ricevute','Differenza IVA documentale','Posizione documentale','Saldo fiscale','Non determinabile','Limitato','Dettaglio IVA e fonti fiscali']) assert(html.includes(label),label)
  assert(html.includes('22,00'));assert(!html.includes('<table'));assert(!html.includes('<select'))
  assert(html.includes('non certifica la detraibilità'));assert(html.includes('non certifica l’esigibilità'));assert(html.includes('non significa IVA 0%'))
})
test('unknown source stays unknown and never produces a documented debt or credit', () => {
  const f=sources();f.fatture_fornitori={stato:'errore',righe:[],limite:'Fonte non autorizzata'}
  assert(render(f).includes('Differenza del periodo: Non determinabile'));assert(detail(f).includes('Fonte non autorizzata'))
})
test('detail preserves month/quarter periods, exclusions, and missing fiscal evidence', () => {
  const f=sources();f.fatture_fornitori.righe.push({id:'r1',numero_fattura:'PDF fixture',data_fattura:'2026-01-12',importo_totale:'122'})
  const html=detail(f)
  for(const text of ['2026-01','2026-02','2026-03','Subtotale T1','PDF fixture','Nessuna IVA stimata da PDF/OCR','Credito precedente','Versamenti e compensazioni','Interessi trimestrali','Credito residuo','Quietanze F24','Reverse charge']) assert(html.includes(text),text)
  for (const label of ['Tutti','Inclusi','Esclusi','Da verificare']) assert(html.includes(label))
  assert(detail(sources(),{da:'2026-01-01',a:'2026-12-31'}).includes('Subtotale T4'))
  assert(render(sources(),{da:'',a:''}).includes('Intervallo non valido'))
})
test('source document navigation is safe and does not execute callbacks on render',()=>{
  let calls=0;const f=sources();f.fatture_emesse.righe[0].pdf_url='https://example.invalid/f.pdf'
  let html=detail(f,periodo,{onApri(){calls++}});assert(html.includes('Apri documento 1'));assert(html.includes('rel="noopener noreferrer"'));assert(html.includes('Apri registro emesse'));assert.equal(calls,0)
  f.fatture_emesse.righe[0].pdf_url='javascript:alert(1)';html=detail(f);assert(!html.includes('javascript:'));assert(html.includes('Documento originale non disponibile'))
})
test('shared period places VAT above general table, detail uses existing VistaOperativa',()=>{
  const source=fs.readFileSync(require('node:path').join(__dirname,'RiepilogoDittaPanel.tsx'),'utf8')
  assert(source.indexOf('<ProspettoIvaPanel ')<source.indexOf('aria-label="Tabella riepilogo ditta"'))
  assert(source.includes('periodo={periodo} onApriScadenziario={onApriScadenziario} onApri={onApri}'))
  const panel=fs.readFileSync(require('node:path').join(__dirname,'ProspettoIvaPanel.tsx'),'utf8');assert(panel.includes('<VistaOperativa'));assert(panel.includes('ritornoFocusRef={ritornoRef}'))
})
test('schedule opens only on explicit action, pure modules contain no writers or IO',()=>{
  let calls=0;assert(render(sources(),periodo,{onApriScadenziario(){calls++}}).includes('Apri scadenziario'));assert.equal(calls,0)
  for(const name of ['ProspettoIvaPanel.tsx','../engines/contabilita-ditta/prospettoIva.ts']) {const s=fs.readFileSync(require('node:path').join(__dirname,name),'utf8');assert(!/\b(fetch|localStorage|sessionStorage)\b|\.(insert|update|delete|rpc|upload)\s*\(/.test(s))}
})

test('operational view opens/closes and document filters and navigation change only local UI state',()=>{
  const vm=require('node:vm'),path=require('node:path'),slots=[];let cursor=0
  const jsx=(type,props)=>({type,props}),text=x=>x==null?'':Array.isArray(x)?x.map(text).join(''):typeof x==='object'?text(x.props?.children):String(x)
  const nodes=x=>!x?[]:Array.isArray(x)?x.flatMap(nodes):typeof x==='object'?[x,...nodes(x.props?.children)]:[]
  const hooks={useMemo:fn=>{cursor++;return fn()},useRef:v=>{const i=cursor++;return slots[i]??(slots[i]={current:v})},useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],next=>{slots[i]=next}]}}
  const compiled=ts.transpileModule(fs.readFileSync(path.join(__dirname,'ProspettoIvaPanel.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText
  const out={};vm.runInNewContext(compiled,{exports:out,require:id=>id==='react'?hooks:id==='react/jsx-runtime'?{jsx,jsxs:jsx}:id==='./VistaOperativa'?{default:'VistaOperativa'}:id.endsWith('.css')?{default:{}}:require(id)})
  const f=sources();f.fatture_fornitori.righe.push({id:'excluded',numero_fattura:'PDF escluso',data_fattura:'2026-01-12'})
  const props={fonti:f,periodo},renderPanel=()=>{cursor=0;return out.default(props)}
  let tree=renderPanel();assert(!nodes(tree).some(n=>n.type==='VistaOperativa'))
  nodes(tree).find(n=>n.type==='button'&&text(n)==='Dettaglio IVA e fonti fiscali').props.onClick()
  tree=renderPanel();const overlay=nodes(tree).find(n=>n.type==='VistaOperativa');assert(overlay)
  overlay.props.onChiudi();assert(!nodes(renderPanel()).some(n=>n.type==='VistaOperativa'))
  slots.length=0;const archivio=preparaArchivioIva(f),calls=[]
  const renderDetail=()=>{cursor=0;return out.DettagliIva({...props,archivio,prospetto:costruisciProspettoIva(archivio,periodo),onApri:value=>calls.push(value)})}
  tree=renderDetail();assert(text(tree).includes('PDF escluso'));assert(nodes(tree).filter(n=>n.type==='li').length===2)
  nodes(tree).find(n=>n.type==='select').props.onChange({target:{value:'esclusi'}})
  tree=renderDetail();assert(nodes(tree).filter(n=>n.type==='li').length===1);assert(text(tree).includes('PDF escluso'))
  nodes(tree).find(n=>n.type==='button'&&text(n).startsWith('Apri registro')).props.onClick();assert.deepEqual(calls,['fatture-fornitori'])
  nodes(tree).find(n=>n.type==='select').props.onChange({target:{value:'inclusi'}})
  assert(nodes(renderDetail()).filter(n=>n.type==='li').length===1)
  nodes(tree).find(n=>n.type==='select').props.onChange({target:{value:'verificare'}})
  assert(nodes(renderDetail()).filter(n=>n.type==='li').length===2)
})
