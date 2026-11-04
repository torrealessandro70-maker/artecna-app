/* eslint-disable @typescript-eslint/no-require-imports -- Offline navigation harness, no real services. */
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), cp = require('node:child_process')
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8')
const compile = s => ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
const jsx = (type, props) => ({ type, props })
const nodes = x => x == null ? [] : Array.isArray(x) ? x.flatMap(nodes) : typeof x === 'object' ? [x, ...nodes(x.props?.children)] : []
const text = x => x == null ? '' : Array.isArray(x) ? x.map(text).join('') : typeof x === 'object' ? text(x.props?.children) : String(x)
const button = (t, name) => nodes(t).find(n => n.type === 'button' && text(n) === name)
const child = (t, name) => nodes(t).find(n => n.type === './' + name)
function mount(name, props = {}, extra = {}) {
  const slots = []; let cursor = 0
  const react = {
    useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init; return [slots[i], v => slots[i] = typeof v === 'function' ? v(slots[i]) : v] },
    useRef(init) { const i = cursor++; return slots[i] ?? (slots[i] = { current: init }) },
    useEffect() { cursor++ }, useMemo(fn) { cursor++; return fn() }, useCallback(fn) { cursor++; return fn }, useId() { cursor++; return 'upload-test' },
  }
  const exports = {}
  vm.runInNewContext(compile(read(name)), { exports, ...extra, localStorage: { getItem: () => null, setItem() {} }, require(id) {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id === 'react-dom') return { flushSync: fn => fn(), createPortal: (content, target) => ({ target, content }) }
    return { default: id }
  } })
  return { props, render(next = props) { cursor = 0; return exports.default(next) } }
}
const noWrite = () => assert.fail('No persistent writes allowed')
const focusProps = { aperta: true, onChiudi() {}, contesto: 'prova' }

test('focus usa VistaOperativa e il ritorno ai documenti; nessun nuovo sistema di navigazione', () => {
  const childState = { type: 'input', props: { value: 'file e metadati' } }, m = mount('AnalisiDocumentoFocus.tsx')
  const opened = m.render({ ...focusProps, children: childState }), closed = m.render({ ...focusProps, aperta: false, children: childState })
  assert.equal(opened.type, './VistaOperativa'); assert.equal(opened.props.titolo, 'Analisi documento')
  assert.equal(opened.props.etichettaRitorno, '← Torna ai documenti'); assert.equal(opened.props.onChiudi, focusProps.onChiudi)
  assert.equal(opened.props.attiva, true); assert.equal(closed.props.attiva, true); assert.equal(closed.props.visibile, false)
  assert.strictEqual(opened.props.children.props.children[1], childState); assert.strictEqual(closed.props.children.props.children[1], childState)
})

test('portal stabile anche nascosto: stesso target/figlio, nessun mascheramento della pagina precedente', () => {
  const area = {}, content = { file: 'capitolato.xlsx' }, m = mount('VistaOperativa.tsx', {}, { document: { getElementById: () => area } })
  const open = m.render({ titolo: 'Analisi documento', children: content, onChiudi() {} })
  const closed = m.render({ titolo: 'Analisi documento', children: content, onChiudi() {}, visibile: false })
  assert.strictEqual(open.target, closed.target); assert.strictEqual(open.content.props.children[1], content); assert.strictEqual(closed.content.props.children[1], content)
  assert.equal(open.content.props['data-attivita-operativa'], true); assert.equal(closed.content.props['data-attivita-operativa'], undefined)
  assert.equal(closed.content.props.hidden, true)
  assert(text(nodes(open.content).find(n => n.type === 'style')).includes('display: none !important'))
})

function sopralluogo() {
  const file = { name: 'capitolato.xlsx' }, insights = { destination: { suggested: 'archivio_fascicolo' } }, ritorno = () => {}, doc = { fileAnalisiDocumento: file, nomeFileAnalisiDocumento: file.name, vociAnalizzate: [{}], documentInsights: insights, onDocumentAction: noWrite, caricaFileAnalisiDocumento: noWrite }
  const props = { sopralluogoAperto: { id: 'prova-id', cliente: 'prova' }, fotoSopralluoghi: [], documentIntelligence: doc, tornaAlCantiere: ritorno, buttonPrimary: {}, buttonSecondary: {}, supabase: { rpc: noWrite }, generaPreventivoDaDocumentoAnalizzato: noWrite }
  return { ...mount('SopralluogoDettaglio.tsx', props), file, doc, ritorno }
}

test('Sopralluogo: ingresso isola il focus, ritorno stesso record/tab e contesto cantiere senza scritture', () => {
  const m = sopralluogo(); button(m.render(), 'Documenti').props.onClick()
  const before = m.render(); button(before, 'Analizza documento').props.onClick()
  let t = m.render(), focus = child(t, 'AnalisiDocumentoFocus')
  assert.equal(focus.props.aperta, true); assert.equal(t.props.style.display, 'none')
  assert.strictEqual(child(focus, 'DocumentIntelligencePanel').props.fileAnalisiDocumento, m.file)
  assert.strictEqual(child(focus, 'DocumentIntelligencePanel').props.documentInsights, m.doc.documentInsights)
  focus.props.onChiudi(); t = m.render(); focus = child(t, 'AnalisiDocumentoFocus')
  assert.equal(focus.props.aperta, false); assert.equal(t.props.style.display, 'flex')
  assert.equal(button(t, 'Documenti').props['aria-current'], 'page'); assert.equal(m.props.sopralluogoAperto.id, 'prova-id')
  assert.strictEqual(button(t, '← Torna al cantiere').props.onClick, m.ritorno)
})

test('Sopralluogo: upload, destinazione, azioni e callback Genera identici prima/dopo ingresso', () => {
  const m = sopralluogo(), before = m.render(), original = button(before, '💰 Genera preventivo da documento').props.onClick
  button(before, 'Analizza documento').props.onClick(); const t = m.render(), intelligence = child(t, 'DocumentIntelligencePanel')
  assert.strictEqual(intelligence.props.caricaFileAnalisiDocumento, m.doc.caricaFileAnalisiDocumento)
  assert.strictEqual(intelligence.props.onDocumentAction, m.doc.onDocumentAction)
  assert.equal(button(t, '💰 Genera preventivo da documento').props.onClick.toString(), original.toString())
})

test('Sopralluogo: ritorno occupato durante analisi, stesso progresso ricevuto', () => {
  const m = sopralluogo(); m.doc.progressoAnalisiDocumento = { stato: 'in_corso', testo: 'Documento ricevuto' }
  button(m.render(), 'Analizza documento').props.onClick()
  const f = child(m.render(), 'AnalisiDocumentoFocus')
  assert.equal(f.props.occupata, true); assert.strictEqual(child(f, 'DocumentIntelligencePanel').props.progressoAnalisiDocumento, m.doc.progressoAnalisiDocumento)
})

test('Cantiere: file scelto resta disponibile, analisi è lo stesso callback e Torna conserva lista/risultato', async () => {
  let finish; const pending = new Promise(resolve => { finish = resolve }), calls = []
  const file = { name: 'capitolato.pdf' }, analysis = { vociAnalizzate: [], importoRilevatoDocumento: '', caricaFileAnalisiDocumento: f => { calls.push(f); return pending }, onDocumentAction: noWrite }
  const props = { cantiere: { id: 'cantiere', nome: 'Pidatella' }, panelProps: { analisi: analysis, preventivi: { preventivi: [], formatMoney: String }, caricaFilePreventivo: noWrite, archiviaPreventivoAnalizzato: noWrite, strutturaPreventivoEsistente: noWrite, selezionaPreventivoContrattuale: noWrite } }
  const m = mount('DocumentiCantierePanel.tsx', props), target = { files: [file], value: 'file' }
  nodes(m.render()).find(n => n.type === 'input' && n.props.type === 'file').props.onChange({ target })
  assert.equal(target.value, '')
  button(m.render(), 'Analizza documento').props.onClick(); assert.equal(calls.length, 0)
  button(child(m.render(), 'AnalisiDocumentoFocus'), 'Analizza documento').props.onClick(); let t = m.render(), f = child(t, 'AnalisiDocumentoFocus')
  assert.equal(f.props.aperta, true); assert.equal(f.props.occupata, true); assert.strictEqual(calls[0], file)
  finish(); await pending; await new Promise(setImmediate)
  t = m.render(); f = child(t, 'AnalisiDocumentoFocus'); assert.equal(f.props.occupata, false)
  f.props.onChiudi(); t = m.render(); assert.equal(child(t, 'AnalisiDocumentoFocus').props.aperta, false)
  assert(text(t).includes(file.name)); assert(button(t, 'Apri analisi documento'))
  button(t, 'Apri analisi documento').props.onClick(); assert.equal(calls.length, 1)
  assert.equal(child(m.render(), 'AnalisiDocumentoFocus').props.contesto, 'Pidatella')
})

test('strumenti Cantiere/Fascicolo riusano lo stesso pannello e mantengono selezione e callback', () => {
  const file = { name: 'documento.pdf' }, load = noWrite, props = { cantiereAnalisiDocumento: 'Pidatella', fileAnalisiDocumento: file, caricaFileAnalisiDocumento: load }
  const m = mount('CantieriAnalisiDocumentoPanel.tsx', props); button(m.render(), 'Analizza documento').props.onClick()
  let f = child(m.render(), 'AnalisiDocumentoFocus'); assert.equal(f.props.aperta, true)
  assert.strictEqual(child(f, 'DocumentIntelligencePanel').props.fileAnalisiDocumento, file)
  assert.strictEqual(child(f, 'DocumentIntelligencePanel').props.caricaFileAnalisiDocumento, load)
  f.props.onChiudi(); f = child(m.render(), 'AnalisiDocumentoFocus'); assert.equal(f.props.aperta, false)
  assert.strictEqual(child(f, 'DocumentIntelligencePanel').props.fileAnalisiDocumento, file)
})

test('handler analisi/generazione/archiviazione immutati rispetto al parent, parser e AI fuori diff', () => {
  const extract = (file, source) => {
    source = source.replace(/\r\n/g, '\n'); const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), result = {}
    function visit(n) {
      if (ts.isVariableDeclaration(n) && n.initializer && ['generaDocumento','esegui','selezionaFile','caricaFileAnalisiDocumento','analizzaDocumentoCantiere','gestisciAzioneDocumento','generaPreventivoDaDocumentoAnalizzato','archiviaPreventivoAnalizzato','strutturaPreventivoEsistente'].includes(n.name.getText(ast))) result[n.name.getText(ast)] = n.initializer.getText(ast)
      ts.forEachChild(n, visit)
    } visit(ast); return result
  }
  for (const file of ['app/page.tsx','app/components/SopralluogoDettaglio.tsx','app/components/DocumentiCantierePanel.tsx']) {
    const before = cp.execFileSync('git', ['show', 'HEAD:' + file], { encoding: 'utf8' }), after = fs.readFileSync(file, 'utf8')
    const handlers = extract(file, before); assert(Object.keys(handlers).length > 0); assert.deepEqual(extract(file, after), handlers)
  }
  for (const file of ['app/engines','supabase','lib','app/components/DocumentIntelligencePanel.tsx','app/components/DocumentUploadBox.tsx','app/components/DocumentDestinationSelector.tsx','app/components/ProgressoOperazione.tsx']) assert.equal(cp.spawnSync('git', ['diff','--quiet','HEAD','--',file]).status, 0, file)
})

test('responsive solo CSS e progresso nel focus sticky, nessun resize o timer', () => {
  const s = read('AnalisiDocumentoFocus.tsx'); assert(s.includes("position: 'sticky'")); assert(s.includes('min-width: 0')); assert(s.includes('max-width: 100%')); assert(!s.includes('innerWidth')); assert(!s.includes('setTimeout'))
})


test('page cambia soltanto quattro collegamenti UI del progresso, nessun handler o payload', () => {
  const file = 'app/page.tsx', before = cp.execFileSync('git', ['show', 'HEAD:' + file], { encoding: 'utf8' }), after = fs.readFileSync(file, 'utf8')
  const normalize = s => s.replace(/\r\n/g, '\n').replace(/^\s*progressoAnalisiDocumento(?:=\{progressoAnalisiDocumento\}|,)\n/gm, '')
  assert.equal(normalize(after), normalize(before))
})
