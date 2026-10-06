const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const cache = new Map()
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const exports = {}; cache.set(file, exports)
  const jsx = (type, props) => ({ type, props })
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { exports, require: n => n === 'react/jsx-runtime' ? { jsx, jsxs: jsx }
    : load(path.resolve(path.dirname(file), n) + '.ts') })
  return exports
}
const m = load(path.join(__dirname, '../engines/rapportini/materialiBozzaV1.ts'))
const save = load(path.join(__dirname, '../engines/rapportini/salvataggioBozzaV1.ts'))
const Panel = load(path.join(__dirname, 'DiagnosticaMaterialiMobile.tsx')).default
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
function props(withRow = true) {
  let bozza = m.creaBozzaRapportinoV2(ID, '2026-10-06')
  bozza.prestazioni.nuove.push({ prestazione_id: null, chiave_client: 'prestazione', operaio_id: ID,
    ora_inizio: '08:00', ora_fine: '12:00', pausa_minuti: 0, lavoro_in_economia: false, variante_id: null })
  if (withRow) {
    bozza = m.aggiungiMaterialeBozza(bozza, () => ID)
    bozza = m.modificaMaterialeBozza(bozza, ID, { descrizione: 'Collante', quantita: '2', unita_misura: 'sacco' })
  }
  return { bozza, operai: [{ id: ID, nome: 'NOME RISERVATO' }], varianti: { cantiere_id: ID, stato: 'non_caricate', varianti: [] },
    salvabile: true, disabled: false, retryDisponibile: false, conflitto: false, riletturaFallita: false, salvataggioInCorso: false }
}
function text(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (Array.isArray(node)) return node.map(text).join('')
  if (typeof node === 'object') return text(node.props?.children)
  return String(node)
}
function render(p) { p.salvabile = save.bozzaV1Salvabile(p.bozza, p.varianti); return text(Panel(p)) }
test('M2.6D nessun materiale: pannello assente', () => assert.equal(Panel(props(false)), null))
test('M2.6D Collante/2/sacco: validazione reale, delta OK, Salva abilitato', () => {
  const s = render(props()); for (const expected of ['materiali_validi: true', 'delta_materiali: OK',
    'quantita_raw: [2]', 'quantita_normalizzata: 2.000000', 'bozza_salvabile: true', 'disabled_finale: false']) assert(s.includes(expected))
})
test('M2.6D quantità incompleta: INVALIDA e dominio MATERIALI', () => {
  const p = props(); p.bozza.materialiStrutturati.righe[0].quantita = '2,'
  const s = render(p); assert(s.includes('quantita_normalizzata: INVALIDA')); assert(s.includes('dominio_bloccante: MATERIALI')); assert(s.includes('disabled_finale: true'))
})
test('M2.6D UM vuota: errore sanitizzato', () => {
  const p = props(); p.bozza.materialiStrutturati.righe[0].unita_misura = ''
  assert(render(p).includes('Inserisci l’unità di misura.'))
})
test('M2.6D descrizione con spazio finale: errore senza contenuto', () => {
  const p = props(); p.bozza.materialiStrutturati.righe[0].descrizione = 'Collante '
  const s = render(p); assert(s.includes('Verifica la descrizione')); assert(!s.includes('Collante'))
})
test('M2.6D costo vuoto/null valido', () => {
  for (const cost of [null, '']) { const p = props(); p.bozza.materialiStrutturati.righe[0].costo_unitario = cost
    const s = render(p); assert(s.includes('costo: VUOTO')); assert(s.includes('materiali_validi: true')) }
})
test('M2.6D nessuna mutazione bozza/intento e nessuna callback', () => {
  const p = props(), before = JSON.stringify(p.bozza), intento = Object.freeze({ richiesta_id: ID })
  p.onChange = p.onSalva = () => assert.fail('Callback invocata')
  Panel(p); Panel(p); assert.equal(JSON.stringify(p.bozza), before); assert.equal(intento.richiesta_id, ID)
  const source = fs.readFileSync(path.join(__dirname, 'DiagnosticaMaterialiMobile.tsx'), 'utf8')
  assert.doesNotMatch(source, /fetch\(|console\.|onChange\(|onSalva\(|setBozza|localStorage/)
})
test('M2.6D nessun segreto renderizzato; flag reali e slot solo Mobile', () => {
  const p = props(); p.bozza.materialiStrutturati.righe[0].note = 'NOTA RISERVATA'; p.retryDisponibile = true
  p.conflitto = true; p.riletturaFallita = true; p.salvataggioInCorso = true; p.disabled = true
  const s = text(Panel(p)); for (const secret of [ID, 'Collante', 'NOTA RISERVATA', 'NOME RISERVATO']) assert(!s.includes(secret))
  for (const field of ['retry_disponibile', 'conflitto', 'rilettura_fallita', 'salvataggio_attivo', 'disabled_finale']) assert(s.includes(field + ': true'))
  const shared = fs.readFileSync(path.join(__dirname, '../components/RapportinoPrestazioniEditorV1.tsx'), 'utf8')
  assert(!shared.includes("import DiagnosticaMaterialiMobile")); assert(shared.includes('{diagnosticaMateriali}'))
})
