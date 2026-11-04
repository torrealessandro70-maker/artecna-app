/* eslint-disable @typescript-eslint/no-require-imports -- Offline component regression harness; all writes fail. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const title = 'Preventivo integrativo - bozza', empty = 'Nessun preventivo strutturato disponibile per questo cantiere.'
const pid = '4d756d94-649e-4011-8da4-4bf51d48ee52', testa = '3649af73-e3ff-4604-8007-1a9a0599cd69'
const history = (states = ['approvata', 'approvata', 'approvata']) => states.map((stato, i) => ({ id: `00000000-0000-4000-8000-00000000000${i}`, titolo: title, stato, numero: i + 1, data_variante: '2026-10-21' }))
const nodes = x => x == null ? [] : Array.isArray(x) ? x.flatMap(nodes) : typeof x === 'object' ? [x, ...nodes(x.props?.children)] : []
const text = x => x == null ? '' : Array.isArray(x) ? x.map(text).join('') : typeof x === 'object' ? text(x.props?.children) : String(x)
const find = (tree, type, label) => nodes(tree).find(n => n.type === type && text(n).includes(label))
const tick = () => new Promise(resolve => setImmediate(resolve))
function mount({ variants = [], candidates = [{ id: testa, numeroLavorazioni: 7, nomeFile: 'Testa' }], response, sources = [] } = {}) {
  const slots = [], calls = [], reads = []; let cursor = 0, effects = []
  const react = {
    useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v }] },
    useRef(init) { const i = cursor++; return slots[i] ?? (slots[i] = { current: init }) },
    useEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) { old?.cleanup?.(); const entry = { deps }; slots[i] = entry; effects.push(() => { entry.cleanup = fn() }) } },
    useMemo(fn) { cursor++; return fn() },
  }
  const db = { rpc(name, args) { reads.push({ name, args }); assert.equal(name, 'leggi_sorgenti_variante', 'No write RPC allowed'); const q = { order() { return q }, range() { return Promise.resolve({ data: sources.filter(s => s.variante_id === args.p_variante_id), error: null }) } }; return q } }
  const jsx = (type, props) => ({ type, props }), exports = {}
  const repository = {
    elencaPreventiviSorgenteVariante(_db, id) { calls.push(id); return response ?? Promise.resolve({ stato: 'ok', preventivi: candidates }) },
    async caricaLavorazioniPreventivoSorgente(_db, cantiereId, id) { reads.push({ name: 'anteprima', id }); return { stato: 'ok', anomalie: [], voci: Array.from({ length: candidates.find(p => p.id === id).numeroLavorazioni }, (_, i) => ({ id: String(i), descrizione: 'Lavorazione ' + i, unitaMisura: 'm', quantita: 1, prezzoUnitario: 10, totale: 10 })), cantiereId } },
  }
  const adapterExports = {}
  const compile = s => ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(compile(fs.readFileSync(path.join(__dirname, '../engines/varianti/adattaPreventivoAVariante.ts'), 'utf8')), { exports: adapterExports })
  vm.runInNewContext(compile(fs.readFileSync(path.join(__dirname, 'VariantiCantierePanel.tsx'), 'utf8') + '\nexport { AnteprimaPreventivoVariante };'), { exports, structuredClone, require(id) {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id.endsWith('/supabaseClient')) return { supabase: db }
    if (id.endsWith('/repositoryPreventiviSorgente')) return repository
    if (id.endsWith('/adattaPreventivoAVariante')) return adapterExports
    return {}
  } })
  const props = { cantiereId: 'cantiere', elencoVarianti: { tipo: 'elenco', cantiereId: 'cantiere', righe: variants }, variantiCorrenti: variants, onVarianteAggiornata() { assert.fail('No update') }, onApriVarianteEconomia() { assert.fail('No update') } }
  const render = () => { cursor = 0; const tree = exports.AnteprimaPreventivoVariante(props); const pending = effects; effects = []; pending.forEach(f => f()); return tree }
  const settle = async () => { let tree; for (let i = 0; i < 6; i++) { tree = render(); await tick() } return tree }
  const open = async () => { const tree = await settle(); find(tree, 'button', '+ Nuova variante da preventivo').props.onClick(); return settle() }
  return { settle, open, calls, reads }
}
test('Pidatella: tre storiche, Nuova raccolta diretta carica 17 voci senza scritture', async () => {
  const m = mount({ variants: history(), candidates: [{ id: pid, numeroLavorazioni: 17, nomeFile: 'Pidatella' }] }); let tree = await m.open()
  assert.equal(m.calls.length, 0); assert(!text(tree).includes(empty)); assert(text(tree).includes('Seleziona una variante esistente oppure avvia una nuova raccolta.'))
  const start = find(tree, 'button', 'Nuova raccolta'); assert(start); assert.equal(start.props.disabled, false); start.props.onClick(); tree = await m.settle()
  assert.equal(m.calls.length, 1); assert(text(tree).includes('17 voci')); assert.equal(m.reads.length, 0)
  find(tree, 'select', 'Seleziona un preventivo').props.onChange({ target: { value: pid } }); tree = await m.settle(); await find(tree, 'button', 'Carica anteprima').props.onClick(); tree = await m.settle()
  assert(text(tree).includes('Lavorazione 16')); assert.equal(m.reads.filter(r => r.name === 'anteprima').length, 1)
  assert.equal(find(tree, 'select', 'Seleziona una Variante').props.children[1].length, 3)
})
test('Testa: senza storiche carica direttamente il candidato con 7 voci', async () => {
  const m = mount(); let tree = await m.open(); assert.equal(m.calls.length, 1); assert(text(tree).includes('7 voci')); assert(!text(tree).includes(empty))
  find(tree, 'select', 'Seleziona un preventivo').props.onChange({ target: { value: testa } }); tree = await m.settle(); await find(tree, 'button', 'Carica anteprima').props.onClick(); tree = await m.settle(); assert(text(tree).includes('Lavorazione 6'))
})
test('lista vuota solo dopo risposta riuscita, mai prima o durante il caricamento', async () => {
  let resolve; const response = new Promise(r => { resolve = r }); const m = mount({ response }); let tree = await m.open()
  assert(text(tree).includes('Caricamento preventivi')); assert(!text(tree).includes(empty)); resolve({ stato: 'ok', preventivi: [] }); tree = await m.settle(); assert(text(tree).includes(empty))
})
test('errore repository non viene presentato come lista vuota', async () => {
  const m = mount({ response: Promise.resolve({ stato: 'errore', messaggio: 'Lettura non disponibile' }) }); const tree = await m.open(); assert(text(tree).includes('Lettura non disponibile')); assert(!text(tree).includes(empty))
})
for (const stato of ['approvata', 'rifiutata', 'annullata', 'proposta']) test(`storica ${stato}: sorgenti consultabili e nuova raccolta locale`, async () => {
  const variants = history([stato]); const sources = [{ id: '11111111-1111-4111-8111-111111111111', variante_id: variants[0].id, titolo: 'Sorgente storica', snapshot_version: 1, tipo: 'preventivo_artecna', preventivo_sorgente_id: pid, nome_file: null, formato: null }]
  const m = mount({ variants, sources }); let tree = await m.open(); assert(text(tree).includes(`Variante in stato ${stato}`)); assert(text(tree).includes('Sorgente storica')); assert.equal(m.calls.length, 0); assert(!text(tree).includes(empty))
  assert.equal(find(tree, 'button', 'Revisiona tutte le sorgenti').props.disabled, true)
  find(tree, 'button', 'Nuova raccolta').props.onClick(); tree = await m.settle(); assert.equal(m.calls.length, 1); assert(text(tree).includes('7 voci')); assert(m.reads.every(r => r.name === 'leggi_sorgenti_variante'))
})
test('bozza esistente: selezione automatica e sorgenti modificabili conservate', async () => {
  const m = mount({ variants: history(['bozza']) }); const tree = await m.open(); assert.equal(m.calls.length, 1); assert.equal(find(tree, 'select', 'Seleziona un preventivo').props.disabled, false); assert(!find(tree, 'button', 'Nuova raccolta'))
})
test('tre storiche: selezione resta consultabile e risposta tardiva non mostra un falso vuoto', async () => {
  let resolve; const variants = history(), response = new Promise(r => { resolve = r })
  const m = mount({ variants, response }); let tree = await m.open()
  find(tree, 'button', 'Nuova raccolta').props.onClick(); tree = await m.settle(); assert.equal(m.calls.length, 1)
  find(tree, 'select', 'Seleziona una Variante').props.onChange({ target: { value: variants[1].id } }); tree = await m.settle()
  assert(text(tree).includes('Variante N. 2')); assert(text(tree).includes('sorgenti e lavorazioni sono in sola lettura'))
  resolve({ stato: 'ok', preventivi: [] }); tree = await m.settle()
  assert(!text(tree).includes(empty)); assert.equal(find(tree, 'select', 'Seleziona un preventivo').props.disabled, true)
  assert(m.reads.every(r => r.name === 'leggi_sorgenti_variante'))
})
