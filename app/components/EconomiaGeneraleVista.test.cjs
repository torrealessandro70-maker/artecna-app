/* eslint-disable @typescript-eslint/no-require-imports -- Offline presentation harness with synthetic data; database IO is forbidden. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), cp = require('node:child_process')
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\r/g, '')
const jsx = (type, props) => ({ type, props })
const nodes = x => !x ? [] : Array.isArray(x) ? x.flatMap(nodes) : typeof x === 'object' ? [x, ...nodes(x.props?.children)] : []
const text = x => x == null ? '' : Array.isArray(x) ? x.map(text).join('') : typeof x === 'object' ? text(x.props?.children) : String(x)
const button = (tree, label) => nodes(tree).find(n => n.type === 'button' && text(n) === label)
const details = tree => nodes(tree).filter(n => n.type === 'details')
const visibleText = x => x == null ? '' : Array.isArray(x) ? x.map(visibleText).join('') : typeof x !== 'object' ? String(x) : x.type === 'details' && !x.props.open ? [].concat(x.props.children).filter(c => c?.type === 'summary').map(visibleText).join('') : visibleText(x.props.children)
function hooks() {
  const slots = []; let cursor = 0
  return { react: {
    useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v }] },
    useMemo(fn) { cursor++; return fn() },
    useRef(value) { const i = cursor++; return slots[i] ?? (slots[i] = { current: value }) },
    useEffect() { throw Error('Unexpected effect / IO in presentation test') },
  }, start() { cursor = 0 } }
}
class FixedDate extends Date { constructor(value) { super(value ?? '2026-11-10T12:00:00Z') } }
function loader(h, overrides = {}) {
  const cache = new Map()
  function load(file) {
    const full = path.resolve(__dirname, file)
    if (cache.has(full)) return cache.get(full)
    const out = {}; cache.set(full, out)
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
    } }).outputText, { exports: out, Date: FixedDate, require(id) {
      if (overrides[id]) return overrides[id]
      if (id === 'react') return h.react
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (id.endsWith('.module.css')) return { default: new Proxy({}, { get: (_, k) => String(k) }) }
      if (id === './VistaOperativa') return { default: 'VistaOperativa' }
      if (id === './CollegaIncassoPanel') return { default: 'CollegaPanel', CollegaIncassoAzione: 'CollegaAzione' }
      if (id.endsWith('/attribuzioni')) return { cantiereDocumento: () => 'cantiere-test' }
      if (id.endsWith('/lettura')) return { leggiFontiDitta() { throw Error('DB reads forbidden') } }
      if (id.endsWith('/modificaFattura')) return { EVENTO_FATTURE_AGGIORNATE: 'evento-test' }
      return load(path.relative(__dirname, path.resolve(path.dirname(full), id + '.tsx')).replace(/\.tsx$/, fs.existsSync(path.resolve(path.dirname(full), id + '.tsx')) ? '.tsx' : '.ts'))
    } }, { filename: full })
    return out
  }
  return load
}
const engine = loader(hooks())('../engines/contabilita-ditta/riepilogo.ts')
function sources() {
  const fonti = Object.fromEntries(engine.FONTI.map(f => [f, { stato: 'pronta', righe: [] }]))
  fonti.fatture_emesse.righe.push({ id: 'f1', numero_fattura: 'F1', totale: '120.00', importo_incassato: '30.00', data_fattura: '2026-10-05' })
  fonti.acconti_cantiere.righe.push({ id: 'a1', importo: '10.00', data_incasso: '2026-10-06' }, { id: 'escluso', importo: '20.00', data_incasso: '' })
  fonti.pagamenti_operai = { stato: 'parziale', righe: [{ id: 'p1', importo: '25.00', data_pagamento: '2026-10-07' }] }
  return fonti
}
function view() {
  const h = hooks(), load = loader(h), component = load('RiepilogoDittaPanel.tsx').RiepilogoDittaVista
  const calls = [], props = { fonti: sources(), fotografia: '10/11/2026 12:00', onApri: d => calls.push(d) }
  return { props, calls, render() { h.start(); return component(props) } }
}
const row = (tree, name) => nodes(tree).find(n => n.type === 'tr' && n.props['aria-label'] === name)
const operation = tree => nodes(tree).find(n => n.type === 'VistaOperativa')
const euro = n => (n / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

test('compact table keeps every existing indicator value/state identical to the calculator', () => {
  const m = view(), before = JSON.stringify(m.props.fonti), tree = m.render()
  const expected = engine.costruisciRiepilogo(m.props.fonti, { da: '2026-10-01', a: '2026-12-31' })
  for (const i of expected) { const r = row(tree, i.nome); assert(r, i.nome); assert(text(r).includes(i.stato)); assert(text(r).includes(i.centesimi === null ? 'Non determinabile' : euro(i.centesimi))) }
  assert.equal(nodes(tree).filter(n => n.type === 'tr' && n.props['aria-label']).length, expected.length)
  assert.equal(JSON.stringify(m.props.fonti), before)
  assert(text(tree).includes('Disponibile')); assert(text(tree).includes('Limitato')); assert(text(tree).includes('Non calcolabile'))
})
test('progressive and reference figures retain their scope; missing history is never zero', () => {
  const m = view(), tree = m.render()
  assert(text(row(tree, 'Incassato cumulativo dichiarato sulle fatture')).includes('non filtrato per periodo'))
  for (const name of ['Residui alla data di riferimento', 'Scaduti alla data di riferimento']) {
    assert(text(row(tree, name)).includes('Non determinabile')); assert(text(row(tree, name)).includes('Non calcolabile'))
  }
  assert(text(tree).includes('10/11/2026 12:00'))
})
test('data-quality warnings remain complete under one default-closed disclosure', () => {
  const tree = view().render(), quality = details(tree).filter(d => text(d).startsWith('Fonti, limiti e qualità dei dati'))
  assert.equal(quality.length, 1); assert.equal(quality[0].props.open, undefined)
  for (const warning of ['non una liquidazione IVA', 'non che tutte le fatture esterne siano state importate', 'Nessun utile definitivo', 'possono rappresentare lo stesso denaro', 'Nessun consolidamento arbitrario', 'Materiali, assegnazioni, SAL', 'consultazione separata, non utile contabile o fiscale']) {
    assert(text(quality[0]).includes(warning), warning); assert(!visibleText(tree).includes(warning), warning)
  }
})
test('Mostra dettaglio opens the existing operational view with closed contracts/sources and all excluded records', () => {
  const m = view(); let tree = m.render()
  button(row(tree, 'Acconti registrati'), 'Mostra dettaglio').props.onClick({ currentTarget: {} })
  tree = m.render(); const op = operation(tree); assert(op); assert.equal(op.props.titolo, 'Acconti registrati')
  for (const d of details(op)) assert.equal(d.props.open, undefined)
  assert(text(op).includes('Contratto indicatore')); assert(text(op).includes('Dettaglio delle fonti (2)'))
  assert(text(op).includes('escluso')); assert(text(op).includes('Escluso / non sommato'))
  assert(text(op).includes('Data mancante')); assert(text(op).includes('Scadenza mancante'))
  op.props.onChiudi(); assert.equal(operation(m.render()), undefined)
})
test('contextual actions navigate only to existing destinations without invoking writers', () => {
  const m = view(), tree = m.render()
  button(row(tree, 'Documenti emessi registrati'), 'Apri fatture emesse').props.onClick()
  button(row(tree, 'Documenti ricevuti registrati'), 'Apri fatture ricevute').props.onClick()
  button(row(tree, 'Pagamenti operai registrati'), 'Apri pagamenti operai').props.onClick()
  assert.deepEqual(m.calls, ['fatture-emesse', 'fatture-fornitori', 'pagamenti-operai'])
  assert.equal(operation(m.render()), undefined)
})
test('period, date and snapshot survive opening/closing an operational detail', () => {
  const m = view(); let tree = m.render()
  nodes(tree).find(n => n.type === 'select').props.onChange({ target: { value: 'personalizzato' } })
  tree = m.render(); const inputs = nodes(tree).filter(n => n.type === 'input' && n.props.type === 'date')
  inputs[0].props.onChange({ target: { value: '2026-10-04' } }); inputs[1].props.onChange({ target: { value: '2026-10-08' } })
  tree = m.render(); button(row(tree, 'Documenti emessi registrati'), 'Mostra dettaglio').props.onClick({ currentTarget: {} })
  operation(m.render()).props.onChiudi(); tree = m.render()
  assert(text(tree).includes('2026-10-04')); assert(text(tree).includes('2026-10-08')); assert(text(tree).includes(m.props.fotografia))
})

function expand(x) {
  if (Array.isArray(x)) return x.map(expand)
  if (!x || typeof x !== 'object') return x
  if (typeof x.type === 'function') return expand(x.type(x.props))
  return { ...x, props: { ...x.props, children: expand(x.props?.children) } }
}
function costs() {
  const h = hooks(), load = loader(h, { './RiepilogoDittaPanel': { default: 'Riepilogo' }, './CostiFornitoriRettificati': { default: 'CostiFornitori' } })
  const component = load('EconomiaGeneralePanel.tsx').default
  const props = { client: {}, cardStyle: {}, speseImpresa: [{ categoria: 'attrezzo_ditta', importo: 10 }, { categoria: 'magazzino', importo: 20 }, { categoria: 'spesa_generale', importo: 30 }, { categoria: 'altra', importo: 7 }], formatMoney: n => n.toFixed(2), filtroSpeseImpresa: '', tabellaSpeseImpresaAperta: false, ordineSpeseCampo: 'categoria', ordineSpeseDirezione: 'asc', buttonSecondary: {}, inputStyle: {}, excelTable: {}, excelTh: {}, excelTd: {}, setFiltroSpeseImpresa() {}, setTabellaSpeseImpresaAperta() {}, ordinaSpeseImpresa() {} }
  return { props, render() { h.start(); return component(props) } }
}
test('general costs have a single total, calculated exactly as before and clearly not period-filtered', () => {
  const m = costs(), tree = m.render(), summary = nodes(tree).find(n => n.type === 'Riepilogo')
  const costRow = expand(summary.props.rigaCostiGenerali)
  assert.equal(costRow.type, 'tr'); assert(text(costRow).includes('67.00')); assert(text(costRow).includes('Limitato'))
  assert(text(costRow).includes('non filtrato per periodo')); assert.equal(operation(tree), undefined)
  button(costRow, 'Mostra dettaglio').props.onClick({ currentTarget: {} })
  const op = expand(operation(m.render())); assert(op); assert.equal(op.props.titolo, 'Costi generali impresa')
  assert(text(op).includes('Attrezzi / beni ditta')); assert(text(op).includes('Magazzino')); assert(text(op).includes('Spese generali'))
  assert(!text(op).includes('Totale costi generali')); assert(!text(op).includes('67.00'))
  assert.equal(nodes(op).filter(n => n.type === 'button' && text(n).includes('Mostra dettaglio spese')).length, 1)
  const classification = details(op).find(d => text(d).includes('Classificazioni gestionali preesistenti'))
  assert.equal(classification.props.open, undefined)
  op.props.onChiudi(); assert.equal(operation(m.render()), undefined)
})
test('non-finite legacy cost value is labelled non determinable, never replaced with zero', () => {
  const m = costs(); m.props.speseImpresa = [{ importo: 'invalid' }]
  const r = expand(nodes(m.render()).find(n => n.type === 'Riepilogo').props.rigaCostiGenerali)
  assert(text(r).includes('Non determinabile')); assert(text(r).includes('Non calcolabile')); assert(!text(r).includes('0.00'))
})
test('unrelated economic calculators/readers/writers/schema remain unchanged; cost formulas retain original expressions', () => {
  const root = path.resolve(__dirname, '../..')
  const scope = ['app/engines', 'supabase', 'lib']
  const changed = [['diff', '--name-only', 'HEAD'], ['ls-files', '--others', '--exclude-standard']]
    .flatMap(args => cp.execFileSync('git', [...args, '--', ...scope], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean))
  const migrations = new Set([
    'supabase/migrations/20261111000100_documenti_fiscali_privati.sql',
    'supabase/migrations/20261112000300_notifiche_agenda.sql',
    'supabase/migrations/20261112000400_notifiche_sopralluoghi.sql',
  ])
  const validators = new Set(['browser-fixture.cjs', 'struttura-readonly.sql', 'documenti-fiscali-static.test.cjs',
    'documenti-runtime.test.cjs', 'notifiche-runtime.test.cjs', 'notifiche-agenda-readonly.sql', 'notifiche-sopralluoghi-readonly.sql', 'documenti-storage-emulator.cjs', 'documenti-storage-fixture.sql', 'documenti-struttura-readonly.sql']
    .map(file => 'supabase/validators/scadenziario/' + file))
  assert(changed.every(file => migrations.has(file) || validators.has(file) || /^app\/engines\/contabilita-ditta\/(?:scadenziario(?:Persistenza)?|documentiFiscali)(?:\.test)?\.(ts|cjs)$/.test(file)),
    'Only explicitly listed migrations, adapters and validators may change')
  const baseline = cp.execFileSync('git', ['show', '44d95773f1076c84bc21a09504166dd88a584bec:app/components/CostiGeneraliImpresaSummary.tsx'], { cwd: root, encoding: 'utf8' }).replace(/\r/g, '')
  function formulas(s) { const out = {}, ast = ts.createSourceFile('costs.tsx', s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); function visit(n) { if (ts.isVariableDeclaration(n) && n.name.getText(ast).startsWith('totale')) out[n.name.getText(ast)] = n.initializer.getText(ast); ts.forEachChild(n, visit) } visit(ast); return out }
  assert.deepEqual(formulas(read('CostiGeneraliImpresaSummary.tsx')), formulas(baseline))
})


test('existing page writers/readers and period/source hooks are byte-equivalent apart from native line endings', () => {
  const root = path.resolve(__dirname, '../..')
  const old = file => cp.execFileSync('git', ['show', '44d95773f1076c84bc21a09504166dd88a584bec:app/' + file], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).replace(/\r/g, '')
  function handlers(s) {
    const result = {}, ast = ts.createSourceFile('source.tsx', s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    function visit(n) { if (ts.isVariableDeclaration(n) && /^(salva|elimina|carica|calcola|prepara)/.test(n.name.getText(ast)) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) result[n.name.getText(ast)] = n.initializer.getText(ast); ts.forEachChild(n, visit) }
    visit(ast); return result
  }
  const page = read('../page.tsx')
  const { caricaFotoSopralluoghi: letturaFoto, ...correnti } = handlers(page)
  const { caricaFotoSopralluoghi: letturaFotoPrecedente, ...precedenti } = handlers(old('page.tsx'))
  assert.deepEqual(correnti, precedenti)
  assert.match(letturaFoto, /caricaFotoSopralluoghiPerId\(id\)/)
  const letturaFotoPerId = page.slice(page.indexOf('const caricaFotoSopralluoghiPerId ='), page.indexOf('const caricaFotoSopralluoghi ='))
  assert.deepEqual(calls(letturaFotoPerId, x => /\.(from|select|eq)$/.test(x)), calls(letturaFotoPrecedente, x => /\.(from|select|eq)$/.test(x)))
  function calls(s, match) { const result = [], ast = ts.createSourceFile('source.tsx', s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); function visit(n) { if (ts.isCallExpression(n) && match(n.expression.getText(ast))) result.push(n.getText(ast)); ts.forEachChild(n, visit) } visit(ast); return result }
  assert.deepEqual(calls(read('RiepilogoDittaPanel.tsx'), x => ['useEffect', 'useMemo'].includes(x)), calls(old('components/RiepilogoDittaPanel.tsx'), x => ['useEffect', 'useMemo'].includes(x)))
  assert.deepEqual(calls(read('TabellaSpeseImpresaPanel.tsx'), x => /\.(reduce|filter|sort)$/.test(x)), calls(old('components/TabellaSpeseImpresaPanel.tsx'), x => /\.(reduce|filter|sort)$/.test(x)))
})
