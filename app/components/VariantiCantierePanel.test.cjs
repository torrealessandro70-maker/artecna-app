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
test('tabella sorgente: 17 righe, colonne proporzionate e dati originali separati dal layout', async () => {
  const m = mount({ contrattoId: pid, candidates: [{ id: pid, numeroLavorazioni: 17, nomeFile: 'Pidatella' }] }); let tree = await m.open()
  await find(tree, 'button', 'Consulta preventivo contrattuale').props.onClick(); tree = await m.settle()
  const table = nodes(tree).find(n => n.type === 'table' && n.props.className === 'anteprima-lavorazioni-variante')
  assert(table); assert.equal(table.props.style.tableLayout, 'fixed'); assert.equal(table.props.style.width, '100%')
  assert.deepEqual(Array.from(nodes(table).filter(n => n.type === 'col'), n => n.props.style.width), ['38%', '7%', '10%', '14%', '14%', '17%'])
  assert.deepEqual(Array.from(nodes(table).filter(n => n.type === 'th'), text), ['Descrizione', 'UM', 'Quantità', 'Prezzo sorgente', 'Totale sorgente', 'Verifica'])
  const rows = nodes(find(table, 'tbody', '')).filter(n => n.type === 'tr'); assert.equal(rows.length, 17)
  const cells = nodes(rows[0]).filter(n => n.type === 'td'); assert.deepEqual(cells.slice(0, 5).map(text), ['Lavorazione 0', 'm', '1', '10', '10'])
  assert.equal(m.writes.length, 0)
})
test('layout circoscritto: intestazioni e numeri non spezzati, card sotto 900; handler e righe invariati', () => {
  const file = path.join(__dirname, 'VariantiCantierePanel.tsx'), s = fs.readFileSync(file, 'utf8')
  assert(s.includes('.anteprima-lavorazioni-variante th { white-space: nowrap; }'))
  assert(s.includes('td:nth-child(n+3):nth-child(-n+5) { white-space: nowrap; overflow-wrap: normal; text-align: right; }'))
  assert(s.includes('@container acquisizione-variante (width < 900px)')); assert(s.includes('.anteprima-lavorazioni-variante colgroup { display: none; }')); assert(s.includes('content: attr(data-label)'))
  const old = require('node:child_process').execFileSync('git', ['show', '3ea2784ec64a3f88c07fd9e42640760f97306631:app/components/VariantiCantierePanel.tsx'], { encoding: 'utf8', maxBuffer: 2e6 })
  const extract = source => { const sf = ts.createSourceFile('panel.tsx', source.replace(/\r/g, ''), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), handlers = [], bodies = []; function walk(n) { if (ts.isJsxAttribute(n) && /^on[A-Z]/.test(n.name.getText(sf))) handlers.push(n.getText(sf)); if (ts.isJsxElement(n) && n.openingElement.tagName.getText(sf) === 'tbody' && n.getText(sf).includes('anteprima.proposta.lavorazioni')) bodies.push(n.getText(sf)); ts.forEachChild(n, walk) } walk(sf); return { handlers, bodies } }
  assert.deepEqual(extract(s), extract(old))
})
function mount({ variants = [], candidates = [{ id: testa, numeroLavorazioni: 7, nomeFile: 'Testa' }], response, sources = [], contrattoId = null, mockAcquisizione = false } = {}) {
  const slots = [], calls = [], reads = [], writes = []; let cursor = 0, effects = []
  const react = {
    useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v }] },
    useRef(init) { const i = cursor++; return slots[i] ?? (slots[i] = { current: init }) },
    useEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) { old?.cleanup?.(); const entry = { deps }; slots[i] = entry; effects.push(() => { entry.cleanup = fn() }) } },
    useMemo(fn) { cursor++; return fn() },
  }
  const db = { from(table) { assert.equal(table, 'cantieri'); const q = { select() { return q }, eq() { return q }, async maybeSingle() { return { data: { id: 'cantiere', preventivo_contrattuale_id: contrattoId }, error: null } } }; return q }, rpc(name, args) { if (mockAcquisizione && name === 'aggiungi_sorgente_variante') { writes.push({ name, args }); return Promise.resolve({ data: null, error: { message: 'Mock capture only' } }) } reads.push({ name, args }); assert.equal(name, 'leggi_sorgenti_variante', 'No write RPC allowed'); const q = { order() { return q }, range() { return Promise.resolve({ data: sources.filter(s => s.variante_id === args.p_variante_id), error: null }) } }; return q } }
  const jsx = (type, props) => ({ type, props }), exports = {}
  const repository = {
    elencaPreventiviSorgenteVariante(_db, id) { calls.push(id); return response ?? Promise.resolve({ stato: 'ok', preventivi: candidates }) },
    async caricaLavorazioniPreventivoSorgente(_db, cantiereId, id) { reads.push({ name: 'anteprima', id }); return { stato: 'ok', anomalie: [], voci: Array.from({ length: candidates.find(p => p.id === id).numeroLavorazioni }, (_, i) => ({ id: String(i), descrizione: 'Lavorazione ' + i, unitaMisura: 'm', quantita: 1, prezzoUnitario: 10, totale: 10 })), cantiereId } },
  }
  const adapterExports = {}
  const compile = s => ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(compile(fs.readFileSync(path.join(__dirname, '../engines/varianti/adattaPreventivoAVariante.ts'), 'utf8')), { exports: adapterExports })
  vm.runInNewContext(compile(fs.readFileSync(path.join(__dirname, 'VariantiCantierePanel.tsx'), 'utf8').replace('  const numero = (valore: number | undefined)', '  exports.handlers = { aggiungiSorgente, confermaLavorazioni, revisionaTutteLeSorgenti, revisionaSorgente };\n  const numero = (valore: number | undefined)') + '\nexport { AnteprimaPreventivoVariante };'), { exports, structuredClone, require(id) {
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
  const open = async () => { const tree = await settle(); find(tree, 'button', '+ Variante da preventivo').props.onClick(); return settle() }
  return { settle, open, calls, reads, writes, handlers: () => exports.handlers }
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

for (const [id, count] of [[pid, 17], [testa, 7]]) test('contrattuale visibile e consultabile ma non acquisibile: ' + id, async () => {
  const m = mount({ contrattoId: id, candidates: [{ id, numeroLavorazioni: count, nomeFile: 'Contratto' }] }); let tree = await m.open()
  assert.equal(find(tree, 'option', 'Preventivo contrattuale').props.disabled, true)
  assert(text(tree).includes('È disponibile il preventivo contrattuale, ma non può essere acquisito come nuove lavorazioni.'))
  assert(!text(tree).includes(empty))
  // Even a forged change event cannot select the disabled contract.
  find(tree, 'select', 'Seleziona un preventivo').props.onChange({ target: { value: id } }); tree = await m.settle()
  assert.equal(find(tree, 'select', 'Seleziona un preventivo').props.value, '')
  await find(tree, 'button', 'Consulta preventivo contrattuale').props.onClick(); tree = await m.settle()
  assert(text(tree).includes('Lavorazione ' + (count - 1)))
  assert(!find(tree, 'button', 'Aggiungi alle sorgenti'))
  await m.handlers().aggiungiSorgente(); m.handlers().revisionaSorgente(); tree = await m.settle()
  assert(text(tree).includes('consultabile, non utilizzabile come nuove lavorazioni'))
  assert(m.reads.every(r => r.name === 'anteprima')); assert.equal(m.writes.length, 0)
})

test('contratto più distinta: solo UUID distinto acquisibile, payload invariato (mock senza DB)', async () => {
  const variants = history(['bozza']), m = mount({ variants, contrattoId: pid, mockAcquisizione: true, candidates: [
    { id: pid, numeroLavorazioni: 17, nomeFile: 'Identico nome', importoTotale: 21700 },
    { id: testa, numeroLavorazioni: 7, nomeFile: 'Identico nome', importoTotale: 21700 },
  ] }); let tree = await m.open()
  const options = nodes(tree).filter(n => n.type === 'option' && [pid, testa].includes(n.props.value))
  assert.equal(options.find(n => n.props.value === pid).props.disabled, true)
  assert.equal(options.find(n => n.props.value === testa).props.disabled, false)
  find(tree, 'select', 'Seleziona un preventivo').props.onChange({ target: { value: testa } }); tree = await m.settle()
  await find(tree, 'button', 'Carica anteprima').props.onClick(); tree = await m.settle()
  await find(tree, 'button', 'Aggiungi alle sorgenti').props.onClick()
  assert.equal(m.writes.length, 1); const payload = m.writes[0].args
  assert.equal(payload.p_variante_id, variants[0].id); assert.equal(payload.p_preventivo_sorgente_id, testa)
  assert.equal(payload.p_tipo, 'preventivo_artecna'); assert.equal(payload.p_snapshot.proposta.preventivoSorgenteId, testa)
  assert.equal(payload.p_snapshot.proposta.lavorazioni.length, 7)
})

test('contrattuale già salvato in bozza: vietata revisione/conferma anche invocando gli handler', async () => {
  const variants = history(['bozza']), sources = [{ id: '11111111-1111-4111-8111-111111111111', variante_id: variants[0].id, titolo: 'Contratto salvato', snapshot_version: 1, tipo: 'preventivo_artecna', preventivo_sorgente_id: pid, nome_file: null, formato: null }]
  const m = mount({ variants, sources, contrattoId: pid }); let tree = await m.open()
  assert.equal(find(tree, 'button', 'Revisiona tutte le sorgenti').props.disabled, true)
  await m.handlers().revisionaTutteLeSorgenti(); await m.handlers().confermaLavorazioni(); tree = await m.settle()
  assert(text(tree).includes('consultabile, non utilizzabile come nuove lavorazioni'))
  assert(m.reads.every(r => r.name === 'leggi_sorgenti_variante')); assert.equal(m.writes.length, 0)
})

test('storico Pidatella e nuova raccolta: nessuna scrittura e solo contratto disabilitato', async () => {
  const m = mount({ variants: history(), contrattoId: pid, candidates: [{ id: pid, numeroLavorazioni: 17 }] }); let tree = await m.open()
  assert(!text(tree).includes(empty)); assert.equal(m.calls.length, 0)
  find(tree, 'button', 'Nuova raccolta').props.onClick(); tree = await m.settle()
  assert.equal(m.calls.length, 1); assert.equal(find(tree, 'option', 'Preventivo contrattuale').props.disabled, true)
  assert.equal(m.reads.length, 0); assert.equal(m.writes.length, 0)
})


test('Variante da preventivo: un solo comando, focus isolato e ritorno solo locale', async () => {
  const m = mount({ variants: history() }); let tree = await m.settle()
  assert.equal(nodes(tree).filter(n => n.type === 'button' && text(n) === '+ Variante da preventivo').length, 1)
  assert(!nodes(tree).some(n => n.props?.titolo === 'Nuova variante da preventivo'))
  tree = await m.open()
  let focus = nodes(tree).find(n => n.props?.titolo === 'Nuova variante da preventivo')
  assert(focus); assert.equal(focus.props.attiva, true); assert.equal(focus.props.etichettaRitorno, '← Torna alle varianti')
  assert(find(focus, 'select', 'Seleziona una Variante'))
  find(focus, 'button', 'Nuova raccolta').props.onClick(); tree = await m.settle()
  assert.equal(m.calls.length, 1)
  focus = nodes(tree).find(n => n.props?.titolo === 'Nuova variante da preventivo')
  focus.props.onChiudi(); tree = await m.settle()
  assert(!nodes(tree).some(n => n.props?.titolo === 'Nuova variante da preventivo'))
  tree = await m.open(); assert(text(tree).includes('17 voci') || text(tree).includes('7 voci'))
  assert.equal(m.writes.length, 0)
})
