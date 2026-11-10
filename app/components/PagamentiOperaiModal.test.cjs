/* eslint-disable @typescript-eslint/no-require-imports -- Local React harness with mocked saves; no database connections. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const source = fs.readFileSync(path.join(__dirname, 'PagamentiOperaiPanel.tsx'), 'utf8')
const page = fs.readFileSync(path.join(__dirname, '../page.tsx'), 'utf8')
const compile = text => ts.transpileModule(text, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
} }).outputText
const jsx = (type, props) => ({ type, props })
const nodes = x => !x ? [] : Array.isArray(x) ? x.flatMap(nodes) : typeof x === 'object' ? [x, ...nodes(x.props?.children)] : []
const text = x => !x ? '' : Array.isArray(x) ? x.map(text).join('') : typeof x === 'object' ? text(x.props?.children) : String(x)
const button = (tree, name) => nodes(tree).find(n => n.type === 'button' && text(n).includes(name))
const modal = tree => nodes(tree).find(n => n.type === 'dialog')
const input = (tree, label) => nodes(tree).find(n => n.props?.['aria-label'] === label)

function mount(save = async () => true) {
  const slots = [], calls = [], effects = [], dialog = { shows: 0, closes: 0, showModal() { this.shows++ }, close() { this.closes++ } }
  let cursor = 0, writes = 0
  const react = {
    useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = init; return [slots[i], value => { slots[i] = value }] },
    useRef(init) { const i = cursor++; return slots[i] ?? (slots[i] = { current: init }) },
    useEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v, j) => v !== old.deps[j])) {
      old?.cleanup?.(); const entry = { deps }; slots[i] = entry; effects.push(() => { entry.cleanup = fn() })
    } },
  }
  const exports = {}
  vm.runInNewContext(compile(source), { exports, alert() {}, require(id) {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    throw Error('Unexpected dependency: ' + id)
  } })
  const props = {
    cardStyle: {}, buttonPrimary: {}, buttonSecondary: {}, excelTable: {}, excelTh: {}, excelTd: {},
    formatMoney: n => String(n), calcolaOreNumero: () => 1, totaleOreOperaio: () => 1,
    calcolaOre: () => 1, calcolaCostoTimbratura: t => t.costo, parseOra: () => 0,
    totaleMaturatoOperai: 100, totalePagatoOperai: 30, residuoPagamentiOperai: 70,
    scadenzaPagamentiOperai: '', statoScadenzaPagamenti: 'ok', giorniAllaScadenzaPagamenti: null,
    costoOperaiPerCantiere: {}, situazioneCantieri: [], cantieri: [],
    timbrature: [{ operaio_nome: 'Mario', data: '2026-11-10', costo: 100 }],
    operaiAnagrafica: [{ id: 'mario', nome: 'Mario' }],
    pagamentiOperai: [{ id: 'pagamento', operaio_nome: 'Mario', data_pagamento: '2026-11-10', importo: 30 }],
    mostraValutazioneFondi: false, mostraCostiPresenze: false, mostraRiepilogoOperai: true,
    setMostraRiepilogoOperai() {}, pagamentiDataDa: '', pagamentiDataA: '',
    operaioPagamento: '', importoPagamento: '', dataPagamento: '', metodoPagamento: '', notaPagamento: '',
    salvaPagamentoOperaio: async () => { writes++; return save(props) },
    preparaPagamentoRapidoOperaio(nome, importo, tipo) {
      calls.push({ nome, importo, tipo }); props.operaioPagamento = nome
      props.importoPagamento = importo.toFixed(2); props.notaPagamento = tipo
    },
  }
  for (const field of ['Operaio', 'Importo', 'Data', 'Metodo', 'Nota']) {
    props['set' + field + 'Pagamento'] = value => { props[field[0].toLowerCase() + field.slice(1) + 'Pagamento'] = value }
  }
  function render() {
    cursor = 0
    const tree = exports.default(props)
    const node = modal(tree)
    if (node) node.props.ref.current = dialog
    while (effects.length) effects.shift()()
    return tree
  }
  return { render, props, calls, dialog, writes: () => writes }
}
const submit = tree => nodes(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} })
const settle = () => new Promise(setImmediate)

test('saldo keeps the worker-card button and opens a native modal with the residual', () => {
  const m = mount(); button(m.render(), 'Prepara saldo').props.onClick()
  const tree = m.render()
  assert.equal(m.calls[0].nome, 'Mario'); assert.equal(m.calls[0].tipo, 'saldo'); assert.equal(m.calls[0].importo, 70)
  assert.equal(input(modal(tree), 'Operaio').props.value, 'Mario')
  assert.equal(input(modal(tree), 'Importo €').props.value, '70.00')
  assert.equal(m.dialog.shows, 1)
  assert.equal(nodes(tree).filter(n => n.type === 'form').length, 1)
  assert(button(tree, 'Prepara saldo')); assert(button(tree, 'Prepara acconto'))
})
test('acconto selects the worker and leaves the amount editable', () => {
  const m = mount(); button(m.render(), 'Prepara acconto').props.onClick()
  let tree = m.render(); assert.equal(m.calls[0].tipo, 'acconto')
  input(modal(tree), 'Importo €').props.onChange({ target: { value: '25,50' } })
  tree = m.render(); assert.equal(input(modal(tree), 'Importo €').props.value, '25,50')
  assert.equal(input(modal(tree), 'Importo €').props.readOnly, undefined)
})
test('period filter controls the residual used by saldo', () => {
  const m = mount(); m.props.pagamentiDataDa = '2026-11-10'
  m.props.timbrature.push({ operaio_nome: 'Mario', data: '2026-11-09', costo: 200 })
  button(m.render(), 'Prepara saldo').props.onClick(); assert.equal(m.calls[0].importo, 70)
})
test('zero or negative residual disables saldo', () => {
  const m = mount(); m.props.pagamentiOperai[0].importo = 120
  assert.equal(button(m.render(), 'Prepara saldo').props.disabled, true)
  assert.equal(button(m.render(), 'Prepara acconto').props.disabled, false)
})
test('success waits for save/summary reload, closes the modal and renders updated totals', async () => {
  let release
  const m = mount(async props => { await new Promise(resolve => { release = resolve }); props.pagamentiOperai.push({ operaio_nome: 'Mario', importo: 70 }); return true })
  button(m.render(), 'Prepara saldo').props.onClick(); submit(m.render())
  let tree = m.render(); assert(modal(tree)); assert.equal(nodes(modal(tree)).find(n => n.type === 'fieldset').props.disabled, true)
  release(); await settle(); tree = m.render()
  assert.equal(modal(tree), undefined); assert.equal(m.writes(), 1); assert(text(tree).includes('Residuo: 0'))
})
for (const [name, save] of [['validation/database failure', async () => false], ['exception', async () => { throw Error('offline') }]]) {
  test(name + ' keeps the modal and entered amount', async () => {
    const m = mount(save); button(m.render(), 'Prepara acconto').props.onClick()
    input(modal(m.render()), 'Importo €').props.onChange({ target: { value: '20' } })
    submit(m.render()); await settle(); const tree = m.render()
    assert(modal(tree)); assert.equal(input(modal(tree), 'Importo €').props.value, '20'); assert.equal(m.writes(), 1)
  })
}
test('double submit is ignored while saving', async () => {
  let release; const m = mount(() => new Promise(resolve => { release = resolve }))
  button(m.render(), 'Prepara acconto').props.onClick(); const tree = m.render()
  submit(tree); submit(tree); assert.equal(m.writes(), 1)
  release(true); await settle()
})
test('cancel closes the modal without writes; Escape is blocked while saving', async () => {
  let release; const m = mount(() => new Promise(resolve => { release = resolve }))
  button(m.render(), 'Prepara acconto').props.onClick(); button(m.render(), 'Annulla').props.onClick()
  assert.equal(modal(m.render()), undefined); assert.equal(m.writes(), 0)
  button(m.render(), 'Prepara saldo').props.onClick(); submit(m.render()); modal(m.render()).props.onCancel({ preventDefault() {} })
  assert(modal(m.render())); release(true); await settle()
})
test('preparation and modal use no scroll/focus jump to the inline form', () => {
  assert(!/scrollIntoView|scrollTo|\.focus\(/.test(source))
  assert(source.includes('dialog?.showModal()')); assert(source.includes('::backdrop'))
  const start = page.indexOf('const preparaPagamentoRapidoOperaio')
  assert(!/scroll|\.focus\(/.test(page.slice(start, page.indexOf('const caricaCantieri', start))))
})
test('existing writer exposes success only after reloading the summary, with unchanged insert fields', async () => {
  const start = page.indexOf('const salvaPagamentoOperaio ='), end = page.indexOf('const preparaPagamentoRapidoOperaio', start)
  const fn = page.slice(start, end).replace('const salvaPagamentoOperaio =', 'exports.save =')
  const calls = [], exports = {}
  vm.runInNewContext(compile(fn), { exports, operaioPagamento: 'Mario', importoPagamento: '70',
    dataPagamento: '2026-11-10', oggi: '2026-11-10', metodoPagamento: 'Bonifico', notaPagamento: 'Saldo maturato',
    parseImporto: Number, alert() {}, supabase: { from(table) { assert.equal(table, 'pagamenti_operai'); return { async insert(rows) { calls.push(rows[0]); return { error: null } } } } },
    setOperaioPagamento() {}, setImportoPagamento() {}, setDataPagamento() {}, setMetodoPagamento() {}, setNotaPagamento() {},
    async caricaPagamentiOperai() { calls.push('reload') },
  })
  assert.equal(await exports.save(), true); assert.equal(calls[1], 'reload')
  assert.equal(JSON.stringify(calls[0]), JSON.stringify({ operaio_nome: 'Mario', importo: 70, data_pagamento: '2026-11-10', metodo: 'Bonifico', nota: 'Saldo maturato' }))
})


const visibleNodes = x => {
  if (!x) return []
  if (Array.isArray(x)) return x.flatMap(visibleNodes)
  if (typeof x !== 'object') return []
  const children = x.type === 'details' && !x.props.open
    ? [].concat(x.props.children).filter(n => n?.type === 'summary') : x.props?.children
  return [x, ...visibleNodes(children)]
}
const visibleText = x => {
  if (!x) return ''
  if (Array.isArray(x)) return x.map(visibleText).join('')
  if (typeof x !== 'object') return String(x)
  if (x.type === 'details' && !x.props.open) return [].concat(x.props.children).filter(n => n?.type === 'summary').map(visibleText).join('')
  return visibleText(x.props.children)
}
test('all worker summaries and actions remain visible even with the old global flag false', () => {
  const m = mount(); m.props.mostraRiepilogoOperai = false
  m.props.operaiAnagrafica.push({ id: 'luigi', nome: 'Luigi' })
  const tree = m.render(), rendered = visibleText(tree)
  for (const label of ['Totale maturato', 'Totale pagato', 'Residuo da pagare', 'Prossima scadenza', 'Mario', 'Luigi', 'Ore lavorate:', 'Costo maturato:', 'Pagato:', 'Residuo:']) assert(rendered.includes(label), label)
  assert.equal(visibleNodes(tree).filter(n => n.type === 'button' && text(n).includes('Prepara saldo')).length, 2)
  assert.equal(visibleNodes(tree).filter(n => n.type === 'button' && text(n).includes('Prepara acconto')).length, 2)
  assert.equal(button(tree, 'Mostra riepilogo'), undefined)
  assert.equal(button(tree, 'Nascondi riepilogo'), undefined)
})
test('cost allocation and manual payment are closed by default; manual fields reuse the original form', () => {
  const m = mount(); m.props.costoOperaiPerCantiere = { 'Cantiere riservato': 100 }
  const tree = m.render(), details = nodes(tree).filter(n => n.type === 'details')
  const allocation = details.find(n => text(n).includes('Ripartizione costi operai per cantiere'))
  const manual = details.find(n => text(n).includes('Registra pagamento manuale'))
  assert(allocation); assert(manual); assert.equal(allocation.props.open, undefined); assert.equal(manual.props.open, undefined)
  assert(!visibleText(tree).includes('Cantiere riservato'))
  assert(!visibleNodes(tree).some(n => n.type === 'form'))
  assert.equal(nodes(manual).filter(n => n.type === 'form').length, 1)
  assert(nodes(manual).some(n => n.props?.['aria-label'] === 'Importo €'))
})
test('each worker has its own closed Dettagli with costs and history, without a shared control', () => {
  const m = mount(); m.props.operaiAnagrafica.push({ id: 'luigi', nome: 'Luigi' })
  const tree = m.render(), details = nodes(tree).filter(n => n.type === 'details' && n.props['aria-label'])
  assert.equal(details.length, 2)
  for (const [i, name] of ['Mario', 'Luigi'].entries()) {
    const detail = details[i]
    assert.equal(detail.props['aria-label'], 'Dettagli ' + name)
    assert.equal(detail.props.open, undefined); assert.equal(detail.props.name, undefined); assert.equal(detail.props.onToggle, undefined)
    assert(text(detail).includes('Costi maturati per cantiere:')); assert(text(detail).includes('Storico pagamenti:'))
    assert(!nodes(detail).some(n => n.type === 'button' && text(n).includes('Prepara')))
  }
  assert(!visibleText(tree).includes('Costi maturati per cantiere:'))
  assert(!visibleText(tree).includes('Storico pagamenti:'))
})
test('published modal, form, preparation, saving and every monetary calculation are unchanged', () => {
  const cp = require('node:child_process')
  const baseline = cp.execFileSync('git', ['show', '3eec733f09966b84ab3ddc580434c845b9c8e161:app/components/PagamentiOperaiPanel.tsx'], { encoding: 'utf8' }).replace(/\r/g, '')
  const current = source.replace(/\r/g, '')
  const dialog = s => s.slice(s.indexOf('<dialog '), s.indexOf('</dialog>') + '</dialog>'.length)
  assert.equal(dialog(current), dialog(baseline))
  function expressions(s) {
    const out = {}, ast = ts.createSourceFile('panel.tsx', s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const names = new Set(['apriPagamento', 'salvaDalForm', 'formPagamento', 'timbratureOperaioPeriodo', 'costoMaturato', 'totaleOrePeriodo', 'pagamentiOperaioPeriodo', 'pagato', 'residuo', 'timbratureOperaioCantiere', 'costoCantiere', 'oreCantiere'])
    function visit(n) { if (ts.isVariableDeclaration(n) && names.has(n.name.getText(ast))) out[n.name.getText(ast)] = n.initializer.getText(ast); ts.forEachChild(n, visit) }
    visit(ast); return out
  }
  assert.deepEqual(expressions(current), expressions(baseline))
})
