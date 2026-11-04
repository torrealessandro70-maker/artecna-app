/* eslint-disable @typescript-eslint/no-require-imports -- Offline UI and operation-state regression harness. */
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), cp = require('node:child_process')
const compile = s => ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
const source = name => fs.readFileSync(path.join(__dirname, name), 'utf8')
const nodes = x => x == null ? [] : Array.isArray(x) ? x.flatMap(nodes) : typeof x === 'object' ? [x, ...nodes(x.props?.children)] : []
const text = x => x == null ? '' : Array.isArray(x) ? x.map(text).join('') : typeof x === 'object' ? text(x.props?.children) : String(x)
const find = (tree, type, label = '') => nodes(tree).find(n => n.type === type && text(n).includes(label))
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function mount(name, props = {}) {
  const slots = []; let cursor = 0
  const react = { useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v }] }, useRef(init) { const i = cursor++; return slots[i] ?? (slots[i] = { current: init }) }, useEffect() { cursor++ }, useMemo(fn) { cursor++; return fn() } }
  const exports = {}, jsx = (type, props) => ({ type, props }), child = id => Object.assign(() => null, { displayName: id })
  vm.runInNewContext(compile(source(name)), { exports, require(id) { if (id === 'react') return react; if (id === 'react-dom') return { flushSync: fn => fn() }; if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }; if (id === './ProgressoOperazione') return progress; return { default: child(id) } }, localStorage: { getItem() { return null }, setItem() {} } })
  return { props, render() { cursor = 0; return exports.default(props) } }
}
const progress = {}; vm.runInNewContext(compile(source('ProgressoOperazione.tsx')), { exports: progress, require: () => ({ jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }) })
const bar = tree => nodes(tree).find(n => n.props?.role === 'progressbar')

test('barra iniziale assente, lettura indeterminata animata e stato errore accessibile', () => {
  assert.equal(progress.default({ progresso: null }), null)
  const tree = progress.default({ progresso: { stato: 'in_corso', testo: 'Lettura del documento...' } })
  assert.equal(bar(tree).props['aria-valuenow'], undefined)
  assert(nodes(tree).some(n => n.props?.className === 'artecna-progresso-indeterminato'))
  assert(text(tree).includes('potrebbe richiedere qualche minuto'))
  assert(nodes(progress.default({ progresso: { stato: 'errore', testo: 'Errore durante l’analisi' } })).some(n => n.props?.role === 'alert'))
  assert.equal(bar(progress.default({ progresso: { stato: 'completata', testo: 'Preventivo pronto' } })).props['aria-valuenow'], 100)
})
for (const [done, active] of [[0, 1], [3, 4], [6, null]]) test(`contatori reali: chunk ${active ?? done}/6, completati ${done}`, () => {
  const p = progress.progressoPrezziDocumento({ fase: 'analisi', completati: done, totale: 6, in_corso: active })
  assert.equal(p.testo, `Analisi prezzi — ${active ?? done} di 6`)
  assert.equal(bar(progress.default({ progresso: p })).props['aria-valuenow'], 100 * done / 6)
})
test('aggregazione/validazione e preparazione non sono falsamente presentate come preventivo pronto', () => {
  for (const fase of ['aggregazione', 'completata']) {
    const p = progress.progressoPrezziDocumento({ fase, completati: 6, totale: 6, in_corso: null })
    assert.equal(p.stato, 'in_corso'); assert.equal(p.totale, undefined)
    assert(p.testo.includes(fase === 'aggregazione' ? 'Validazione tecnica' : 'Preparazione bozza'))
  }
})
test('selezione immediata, input disabilitato, doppio invio impedito e rilascio in errore', async () => {
  const d = deferred(); let calls = 0
  const m = mount('DocumentUploadBox.tsx', { titolo: 'Documenti', nomeFileAnalisiDocumento: '', inputStyle: {}, caricaFileAnalisiDocumento() { calls++; return d.promise } })
  let tree = m.render(); const input = find(tree, 'input'), target = { files: [{ name: 'Capitolato.pdf' }], value: 'file' }
  const pending = input.props.onChange({ target }); await input.props.onChange({ target }); tree = m.render()
  assert.equal(calls, 1); assert(text(tree).includes('Documento ricevuto: Capitolato.pdf')); assert.equal(find(tree, 'input').props.disabled, true)
  const widget = nodes(tree).find(n => n.type === progress.default); assert.equal(widget.props.progresso.stato, 'in_corso')
  d.reject(Error('lettura')); await pending; tree = m.render(); assert.equal(find(tree, 'input').props.disabled, false)
  assert.equal(nodes(tree).find(n => n.type === progress.default).props.progresso.stato, 'errore'); assert.equal(target.value, '')
})
test('generazione: preparazione, callback chunk, completamento e niente doppia generazione', async () => {
  const d = deferred(); let calls = 0, callback
  const m = mount('SopralluogoDettaglio.tsx', { sopralluogoAperto: { id: 'smoke' }, fotoSopralluoghi: [], buttonPrimary: {}, buttonSecondary: {}, documentIntelligence: { vociAnalizzate: [{}] }, generaPreventivoDaDocumentoAnalizzato(_s, cb) { calls++; callback = cb; return d.promise } })
  let tree = m.render(); const click = find(tree, 'button', 'Genera preventivo da documento').props.onClick
  const pending = click(); await click(); tree = m.render(); assert.equal(calls, 1)
  assert.equal(nodes(tree).find(n => n.type === progress.default).props.progresso.testo, 'Preparazione preventivo...')
  for (const completati of [0, 3, 6]) { callback({ fase: 'analisi', completati, totale: 6, in_corso: completati < 6 ? completati + 1 : null }); tree = m.render(); assert.equal(nodes(tree).find(n => n.type === progress.default).props.progresso.completati, completati) }
  callback({ fase: 'aggregazione', completati: 6, totale: 6, in_corso: null }); tree = m.render(); assert(nodes(tree).find(n => n.type === progress.default).props.progresso.testo.includes('Validazione tecnica'))
  d.resolve(true); await pending; tree = m.render(); assert.equal(nodes(tree).find(n => n.type === progress.default).props.progresso.testo, 'Preventivo pronto')
})
for (const throws of [false, true]) test('generazione non riuscita conserva la bozza: ' + throws, async () => {
  const draft = { id: 'bozza-esistente' }, m = mount('SopralluogoDettaglio.tsx', { sopralluogoAperto: { id: 'smoke' }, fotoSopralluoghi: [], preventivoAiGenerato: draft, documentIntelligence: { vociAnalizzate: [{}] }, async generaPreventivoDaDocumentoAnalizzato() { if (throws) throw Error('trasporto'); return false } })
  await find(m.render(), 'button', 'Genera preventivo da documento').props.onClick(); const p = nodes(m.render()).find(n => n.type === progress.default).props.progresso
  assert.equal(p.stato, 'errore'); assert(p.testo.includes('conservata')); assert.equal(m.props.preventivoAiGenerato, draft)
})
function controller({ upload, read } = {}) {
  const page = source('../page.tsx'), sf = ts.createSourceFile('page.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let declaration
  const visit = n => { if (ts.isVariableDeclaration(n) && n.name.getText(sf) === 'caricaFileAnalisiDocumento') declaration = n; ts.forEachChild(n, visit) }; visit(sf)
  const states = [], lock = { current: false }, calls = [], values = {}
  const ctx = { exports: {}, invioAnalisiDocumento: lock, analisiPreventivoRef: { current: null }, cantiereSelezionatoDaId: { id: 'smoke' }, cantiereScheda: 'SMOKE', supabase: { storage: { from() { return { upload() { calls.push('upload'); return upload?.promise ?? Promise.resolve({ error: null }) }, getPublicUrl() { return { data: { publicUrl: 'mock://documento' } } } } } } }, async leggiPdfTesto() { calls.push('lettura'); return read?.promise ?? 'Testo capitolato' }, parsePreventivoItems() { return [{ descrizione: 'Voce', totale: 10 }] }, buildDocumentProfileFromText() { return { total: { value: 10 } } }, buildDocumentInsights() { return {} }, parseImporto: Number, console: { error() {} }, alert() {}, setProgressoAnalisiDocumento(p) { states.push(p) } }
  for (const name of ['FileUrlAnalisi', 'FilePathAnalisi', 'FileTipoAnalisi', 'VociAnalizzate', 'WarningsAnalisiExcel', 'ImportoRilevatoDocumento', 'FileAnalisiDocumento', 'NomeFileAnalisiDocumento', 'TestoEstrattoDocumento', 'DocumentInsightsDocumento', 'AnalisiInCorso']) ctx['set' + name] = v => { values[name] = v }
  let parser
  const findParser = n => { if (ts.isVariableDeclaration(n) && n.name.getText(sf) === 'analizzaDocumentoCantiere') parser = n; ts.forEachChild(n, findParser) }; findParser(sf)
  vm.runInNewContext(compile('const analizzaDocumentoCantiere = ' + parser.initializer.getText(sf) + '; exports.run = ' + declaration.initializer.getText(sf)), ctx)
  return { run: () => ctx.exports.run({ name: 'Capitolato.pdf' }), states, calls, values, lock }
}
test('controller reale: ricezione/upload, lettura, estrazione, completamento e lock senza doppio upload', async () => {
  const upload = deferred(), read = deferred(), c = controller({ upload, read }), pending = c.run()
  assert(c.states.at(-1).testo.includes('Documento ricevuto')); await c.run(); assert.equal(c.calls.length, 1)
  upload.resolve({ error: null }); await new Promise(setImmediate); assert.equal(c.values.AnalisiInCorso, true)
  read.resolve('Testo capitolato'); await pending; assert.equal(c.states.at(-1).testo, 'Analisi completata'); assert.equal(c.values.VociAnalizzate.length, 1); assert.equal(c.lock.current, false)
})
for (const phase of ['upload', 'lettura']) test('controller reale: stato errore ' + phase, async () => {
  const upload = deferred(), read = deferred(), c = controller({ upload, read }), pending = c.run()
  upload.resolve({ error: phase === 'upload' ? { message: 'negato' } : null }); if (phase === 'lettura') { await new Promise(setImmediate); read.reject(Error('parser')) }
  await pending; assert.equal(c.states.at(-1).stato, 'errore'); assert.equal(c.lock.current, false)
})
test('Nuovo sopralluogo affiancato ad Archivio, handler originali e flex wrap', () => {
  const m = mount('SopralluoghiPanel.tsx', { sopralluogoModificaId: null, buttonPrimary: {}, cardStyle: {} }); let panel = m.render()
  const list = nodes(panel).find(n => n.props?.azioneNuovo); const nuovo = find(list.props.azioneNuovo, 'button', 'Nuovo sopralluogo'); assert(nuovo)
  nuovo.props.onClick(); panel = m.render(); assert(text(nodes(panel).find(n => n.props?.azioneNuovo).props.azioneNuovo).includes('Chiudi nuovo'))
  let archive = null; const l = mount('SopralluoghiList.tsx', { azioneNuovo: list.props.azioneNuovo, sopralluoghi: [], mostraElencoSopralluoghi: false, setMostraElencoSopralluoghi: v => { archive = v }, buttonSecondary: {} }).render()
  const nav = nodes(l).find(n => n.props?.['aria-label'] === 'Navigazione sopralluoghi'); assert.equal(nav.props.style.flexWrap, 'wrap'); assert(find(nav, 'button', 'Nuovo sopralluogo')); find(nav, 'button', 'Archivio sopralluoghi').props.onClick(); assert.equal(archive, true)
})
test('payload AI/modello e salvataggio immutati; solo il callback osservatore viene aggiunto', () => {
  const old = cp.execFileSync('git', ['show', '8b7d3b2932e830631d4f8d09d459cedeab1d4a72:app/page.tsx'], { encoding: 'utf8' }).replace(/\r\n/g, '\n'), cur = source('../page.tsx').replace(/\r\n/g, '\n')
  const body = s => s.slice(s.indexOf('const generaPreventivoDaDocumentoAnalizzato ='), s.indexOf('const miglioraVocePreventivoAi ='))
  assert.equal(body(cur).replace(" onProgress?.({ fase: 'prezzi' })\n", '').replace(', onProgress?: (p: ProgressoGenerazioneDocumento) => void', '').replace('   onProgress,\n', '').replace(/ if \(vociBozzaDocumento\.some\(v => v\.erroreStimaDocumento\)\) onProgress\?\.\(\{\n   fase: 'errore', messaggio: 'Analisi prezzi non completata\. La bozza è disponibile per la revisione\.',\n \}\)\n/, ''), body(old))
})

test('errore reale stime: bozza conservata, barra errore non sovrascritta da Preventivo pronto', async () => {
  const m = mount('SopralluogoDettaglio.tsx', { sopralluogoAperto: { id: 'smoke' }, fotoSopralluoghi: [], documentIntelligence: { vociAnalizzate: [{}] }, async generaPreventivoDaDocumentoAnalizzato(_s, cb) { cb({ fase: 'errore', messaggio: 'Analisi prezzi non completata. La bozza è disponibile per la revisione.' }); return true } })
  await find(m.render(), 'button', 'Genera preventivo da documento').props.onClick()
  const p = nodes(m.render()).find(n => n.type === progress.default).props.progresso
  assert.equal(p.stato, 'errore'); assert(p.testo.includes('bozza è disponibile')); assert(!p.testo.includes('Preventivo pronto'))
})

// Deferred provider promises control the wait; no timers, HTTP, DB or OpenAI.
test('progresso nel header sticky durante attesa, cambio sezione e voci non più presenti', async () => {
  const d = deferred(); let callback, calls = 0
  const m = mount('SopralluogoDettaglio.tsx', { sopralluogoAperto: { id: 'smoke' }, fotoSopralluoghi: [], documentIntelligence: { vociAnalizzate: [{}] }, generaPreventivoDaDocumentoAnalizzato(_s, cb) { calls++; callback = cb; return d.promise } })
  const click = find(m.render(), 'button', 'Genera preventivo da documento').props.onClick
  const pending = click()
  const headerProgress = () => {
    const header = find(m.render(), 'header')
    assert.equal(header.props.style.position, 'sticky')
    return nodes(header).find(n => n.type === progress.default).props.progresso
  }
  assert.equal(headerProgress().testo, 'Preparazione preventivo...')
  assert.equal(find(m.render(), 'button', 'Generazione in corso').props.disabled, true)
  callback({ fase: 'prezzi' })
  assert.equal(headerProgress().testo, 'Generazione prezzi in corso...')
  assert.equal(bar(progress.default({ progresso: headerProgress() })).props['aria-valuenow'], undefined)
  await click(); assert.equal(calls, 1)
  m.props.documentIntelligence.vociAnalizzate = []
  find(m.render(), 'button', 'AI').props.onClick()
  await new Promise(setImmediate)
  assert.equal(headerProgress().stato, 'in_corso')
  for (let n = 1; n <= 6; n++) {
    callback({ fase: 'analisi', completati: n - 1, totale: 6, in_corso: n })
    assert.equal(headerProgress().testo, `Analisi prezzi — ${n} di 6`)
  }
  callback({ fase: 'aggregazione', completati: 6, totale: 6, in_corso: null })
  assert(headerProgress().testo.includes('Validazione tecnica'))
  callback({ fase: 'completata', completati: 6, totale: 6, in_corso: null })
  assert.equal(headerProgress().testo, 'Preparazione bozza')
  d.resolve(true); await pending
  assert.equal(headerProgress().testo, 'Preventivo pronto')
})
