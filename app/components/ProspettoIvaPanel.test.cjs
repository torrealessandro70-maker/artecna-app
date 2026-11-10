/* eslint-disable @typescript-eslint/no-require-imports -- Read-only UI rendered offline with synthetic documents. */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript')
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, file)
require.extensions['.css'] = module => { module.exports = { default: {} } }
const Panel = require('./ProspettoIvaPanel.tsx').default
const { fontiInCaricamento } = require('../engines/contabilita-ditta/riepilogo.ts')
const periodo = { da: '2026-01-01', a: '2026-03-31' }
function sources() { return { ...fontiInCaricamento(), fatture_emesse: { stato: 'pronta', righe: [{ id: 'e1', cliente: 'Cliente fixture', numero_fattura: '1', data_fattura: '2026-01-12', imponibile: '100', iva: '22', totale: '122' }] }, fatture_fornitori: { stato: 'pronta', righe: [] } } }
const render = (fonti = sources(), p = periodo) => renderToStaticMarkup(React.createElement(Panel, { fonti, periodo: p }))
test('VAT summary visible, exact consultation title, expandable month/quarter table closed initially', () => {
  const html = render()
  assert(html.includes('<h3>Differenza IVA sui documenti registrati</h3>'))
  assert(html.indexOf('Differenza del periodo:') < html.indexOf('<details>'))
  assert(html.includes('22,00')); assert(html.includes('Limitato'))
  assert(html.includes('<summary>Mostra prospetto mensile e trimestrale</summary>'))
  assert(!/<details[^>]*\bopen\b/.test(html))
  for (const heading of ['Periodo', 'IVA emesse', 'IVA ricevute', 'Differenza', 'Differenza accumulata', 'Copertura']) assert(html.includes(`scope="col">${heading}</th>`))
  assert(html.includes('2026-01')); assert(html.includes('2026-02')); assert(html.includes('2026-03')); assert(html.includes('Subtotale T1'))
  assert(!html.includes('IVA da versare'))
})
test('unknown source is explicitly non determinable, no fabricated difference', () => {
  const f = sources(); f.fatture_fornitori = { stato: 'errore', righe: [], limite: 'Fonte non autorizzata' }
  const html = render(f); assert(html.includes('Differenza del periodo: Non determinabile')); assert(html.includes('Fonte non autorizzata'))
})
test('exclusions and methodology remain inspectable; no write, upload, or AI controls', () => {
  const f = sources(); f.fatture_fornitori.righe.push({ id: 'r1', numero_fattura: 'PDF fixture', data_fattura: '2026-01-12', importo_totale: '122' })
  const html = render(f)
  assert(html.includes('1 esclusi')); assert(html.includes('PDF fixture')); assert(html.includes('nessuna IVA dedotta da PDF'))
  assert(html.includes('senza saldi precedenti')); assert(html.includes('non certifica la detraibilità'))
  assert(!/<(?:button|input|form)\b/.test(html))
})
test('same existing period is used; year renders all months, invalid range reports failure', () => {
  assert(render(sources(), { da: '2026-01-01', a: '2026-12-31' }).includes('Subtotale T4'))
  assert(render(sources(), { da: '', a: '' }).includes('Intervallo non valido'))
  const container = fs.readFileSync(require('node:path').join(__dirname, 'RiepilogoDittaPanel.tsx'), 'utf8')
  assert(container.includes('<ProspettoIvaPanel fonti={fonti} periodo={periodo} onApriScadenziario={onApriScadenziario} />'))
})
test('new production modules contain no network calls, persistence, writer or mutation API', () => {
  for (const file of ['ProspettoIvaPanel.tsx', '../engines/contabilita-ditta/prospettoIva.ts']) {
    const code = fs.readFileSync(require('node:path').join(__dirname, file), 'utf8')
    assert(!/\b(fetch|localStorage|sessionStorage|useEffect)\b|\.(insert|update|delete|rpc|upload)\s*\(/.test(code))
  }
})

test('optional schedule navigation does not prefill VAT amounts, dates or invoke a writer', () => {
  let calls=0
  const html=renderToStaticMarkup(React.createElement(Panel,{fonti:sources(),periodo,onApriScadenziario(){calls++}}))
  assert(html.includes('type="button">Apri scadenziario</button>'));assert.equal(calls,0);assert(!/<(?:input|form)\b/.test(html))
})
