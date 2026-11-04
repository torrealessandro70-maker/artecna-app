/* eslint-disable @typescript-eslint/no-require-imports -- Offline component tests; database writes are forbidden. */
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const C = 'bd5492c4-2cf2-4f4f-9a38-679d5d154740', P = '4d756d94-649e-4011-8da4-4bf51d48ee52', H = '6efb7b4f-c38e-4c26-bc7d-111e8f0aa187'
const money = n => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
const parse = v => Number(String(v ?? '').replace(',', '.')) || 0
const nodes = x => x == null ? [] : Array.isArray(x) ? x.flatMap(nodes) : typeof x === 'object' ? [x, ...nodes(x.props?.children)] : []
const text = x => x == null ? '' : Array.isArray(x) ? x.map(text).join('') : typeof x === 'object' ? text(x.props?.children) : String(x)
const records = () => [{ id: P, cantiere_id: C, cantiere: 'PIDATELLA SIMONE', nome_file: 'PDF Pidatella', importo_totale: 21700, file_tipo: 'pdf', file_url: 'https://example.test/preventivo.pdf' }, { id: H, cantiere_id: C, cantiere: 'Nome storico differente', nome_file: 'Storico Excel Pidatella', importo_totale: 21700, json_voci_ai: Array(18).fill({ descrizione: 'Voce storica' }) }]
function mount(preventivi, preventivoId = P, extra = {}) {
  let cursor = 0; const slots = [], exports = {}, jsx = (type, props) => ({ type, props })
  const forbidden = () => assert.fail('Unexpected database operation or data mutation')
  const react = { useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v }] }, useRef(init) { const i = cursor++; return slots[i] ?? (slots[i] = { current: init }) } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, 'PreventiviEconomiaPanel.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require(id) { if (id === 'react') return react; if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }; return { eliminaPreventivoConFile: forbidden } }, confirm: forbidden, alert: forbidden })
  const props = { contratto: { cantiereId: C, preventivoId, seleziona: forbidden }, preventivoCantiere: 999999, mostraPreventiviCantiere: true, setMostraPreventiviCantiere() {}, preventivi, setPreventivi: forbidden, cantiereScheda: 'PIDATELLA SIMONE', formatMoney: money, parseImporto: parse, supabase: { from: forbidden, rpc: forbidden }, caricaEconomia: forbidden, buttonSecondary: {}, ...extra }
  const render = () => { cursor = 0; return exports.default(props) }
  return { render }
}
const summary = tree => text(tree.props.children.slice(0, 3))
test('Pidatella: due documenti da 21700, un solo contratto autorevole e lista integra', () => {
  const data = records(), before = JSON.stringify(data), m = mount(data); let tree = m.render()
  assert(summary(tree).includes('Documenti caricati: 2')); assert(summary(tree).includes('Preventivo contrattuale: ' + money(21700))); assert(!text(tree).includes(money(43400))); assert(!text(tree).includes('Importo usato nel totale'))
  assert(text(tree).includes('PDF Pidatella')); assert(text(tree).includes('Storico Excel Pidatella'))
  assert.equal(nodes(tree).filter(n => n.type === 'strong' && n.props.role === 'status' && text(n) === 'Preventivo contrattuale').length, 1)
  const preview = nodes(tree).find(n => n.type === 'button' && text(n).includes('Mostra anteprima')); assert(preview); preview.props.onClick(); tree = m.render()
  assert(nodes(tree).some(n => n.type === 'iframe' && n.props.src === data[0].file_url)); assert.equal(JSON.stringify(data), before)
})
test('Testa: contratto unico con importo 31438.40', () => {
  const data = [{ id: '3649af73-e3ff-4604-8007-1a9a0599cd69', cantiere_id: C, nome_file: 'Testa', importo_totale: 31438.4 }]
  const tree = mount(data, data[0].id).render(); assert(summary(tree).includes('Documenti caricati: 1')); assert(summary(tree).includes(money(31438.4)))
})
test('contratto e documento di importo diverso: solo ID contrattuale nel riepilogo', () => {
  const data = records(); data[1].importo_totale = 12345; const tree = mount(data).render()
  assert(summary(tree).includes(money(21700))); assert(!summary(tree).includes(money(12345))); assert(text(tree).includes(money(12345)))
})
test('stesso importo senza contratto non prova alcuna identità e non viene sommato', () => {
  const tree = mount(records(), null).render(); assert(summary(tree).includes('Documenti caricati: 2')); assert(summary(tree).includes('Nessun preventivo contrattuale impostato.')); assert(!summary(tree).includes(money(21700))); assert(!text(tree).includes(money(43400))); assert(text(tree).includes('Storico Excel Pidatella'))
})
test('UUID contrattuale non disponibile: nessun fallback a nome, stato o importo', () => {
  const tree = mount(records(), 'missing').render(); assert(summary(tree).includes('Preventivo contrattuale non disponibile.')); assert(!summary(tree).includes(money(21700)))
})
test('importo corretto del contratto segue importoUsato e non quello dello storico', () => {
  const data = records(); data[0].importo_corretto = '22000.50'; data[1].importo_corretto = '90000'; const tree = mount(data).render()
  assert(summary(tree).includes(money(22000.5))); assert(!summary(tree).includes(money(90000))); assert(text(tree).includes(money(90000)))
})
test('senza configurazione contratto o documenti: solo conteggio, nessuna somma', () => {
  assert.equal(summary(mount(records(), null, { contratto: undefined }).render()), 'Documenti caricati: 1')
  const tree = mount([], null).render(); assert(summary(tree).includes('Documenti caricati: 0')); assert(!summary(tree).includes('0,00'))
})
