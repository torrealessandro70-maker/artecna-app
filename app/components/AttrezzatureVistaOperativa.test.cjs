/* eslint-disable @typescript-eslint/no-require-imports -- Offline UI regression; no database access. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), cp = require('node:child_process')
const baseline = '1e4c0c5bf833009591f027f3228a059485004e4e'
const read = f => fs.readFileSync(f, 'utf8')
const compile = s => ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
const jsx = (type, props) => ({ type, props })
const nodes = x => Array.isArray(x) ? x.flatMap(nodes) : x?.props ? [x, ...nodes(x.props.children)] : []
const text = x => Array.isArray(x) ? x.map(text).join('') : x?.props ? text(x.props.children) : typeof x === 'string' ? x : ''
const button = (tree, label) => nodes(tree).find(n => n.type === 'button' && text(n) === label)
function hooks() {
  const slots = []; let cursor = 0
  return { start() { cursor = 0 }, react: {
    useId: () => 'fixture-id',
    useRef(init) { const i = cursor++; return slots[i] ||= { current: init } },
    useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = init; return [slots[i], value => slots[i] = typeof value === 'function' ? value(slots[i]) : value] },
  } }
}
function load(file, h, dependencies = {}) {
  const exports = {}
  vm.runInNewContext(compile(read(file)), { exports, require(id) {
    if (id === 'react') return h.react
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id in dependencies) return dependencies[id]
    if (id === './VistaOperativa' || id === './PrezzoMaterialeInput') return { default: id }
    throw new Error('Unexpected dependency / possible IO: ' + id)
  } })
  return exports
}
const rows = [
  { id: '00000000-0000-4000-8000-000000000001', cantiere: 'TESTA ANTONINO', descrizione: 'Trapano', fornitore: 'A', quantita: 2, prezzo_unitario: 10, totale: 20, nota: 'Prima' },
  { id: '00000000-0000-4000-8000-000000000002', cantiere: 'TESTA ANTONINO', descrizione: 'Ponteggio', fornitore: 'B', quantita: 4, prezzo_unitario: 30, totale: 120, nota: 'Seconda' },
]
function mount() {
  const h = hooks(), calls = [], setters = {}
  const form = (initial = {}) => {
    const f = { salva() { calls.push('save') } }
    for (const key of ['descrizione', 'quantita', 'prezzo', 'fornitore', 'data', 'nomeFile', 'nota']) {
      f[key] = initial[key] || ''
      f['set' + key[0].toUpperCase() + key.slice(1)] = value => f[key] = value
    }
    return f
  }
  const p = { contestuale: true, cantiereScheda: 'TESTA ANTONINO', attrezziCantiere: rows, form: form(), formatMoney: String,
    buttonSecondary: {}, onElimina: a => calls.push(['delete', a.id]), modifica: { id: null, form: form(), chiudi() { p.modifica.id = null } } }
  // Execute the real existing preparation handler, with its original setters.
  for (const [name, field] of Object.entries({ Descrizione: 'descrizione', Quantita: 'quantita', Prezzo: 'prezzo', Fornitore: 'fornitore', DataDocumento: 'data', NomeFile: 'nomeFile', Nota: 'nota' })) {
    setters['set' + name + 'AttrezzoModifica'] = p.modifica.form['set' + field[0].toUpperCase() + field.slice(1)]
  }
  setters.setAttrezzoInModifica = id => p.modifica.id = id
  const page = read('app/page.tsx')
  const prepare = page.slice(page.indexOf('  const preparaModificaAttrezzo ='), page.indexOf('  const annullaModificaAttrezzo ='))
  p.modifica.apri = vm.runInNewContext(compile(prepare + '\npreparaModificaAttrezzo'), setters)
  const manual = {}; vm.runInNewContext(compile(read('app/utils/attrezzoManuale.ts')), { exports: manual })
  const component = load('app/components/AttrezzatureCaricatePanel.tsx', h, { '../utils/attrezzoManuale': manual }).default
  const render = () => { h.start(); return component(p) }
  const focus = () => nodes(render()).find(n => n.type === './VistaOperativa')
  return { p, calls, render, focus, enter() { button(render(), '+ Nuova attrezzatura').props.onClick({ currentTarget: {} }) } }
}

test('Nuova apre il form unico isolato con campi originali e callback invariato; nessun IO', () => {
  const m = mount(); assert(!m.focus()); assert(!nodes(m.render()).some(n => n.type === 'textarea'))
  m.enter(); const focus = m.focus()
  assert.equal(focus.props.titolo, 'Nuova attrezzatura')
  assert.equal(focus.props.etichettaRitorno, '← Torna ad Attrezzature')
  assert.equal(button(focus, 'Salva attrezzatura').props.onClick, m.p.form.salva)
  assert(!nodes(focus).some(n => n.type === 'table'))
  assert.equal(nodes(m.render()).filter(n => n.type === 'textarea').length, 1)
  for (const name of ['Descrizione attrezzatura', 'Quantità', 'Fornitore / provenienza', 'Data documento', 'Nome file', 'Nota']) assert(nodes(focus).some(n => n.props['aria-label'] === name))
  assert.deepEqual(m.calls, [])
})

test('ritorno e riapertura conservano bozza nuova, ordinamento e contesto senza scrivere', () => {
  const m = mount(); button(m.render(), 'Descrizione ↕').props.onClick(); m.enter()
  nodes(m.focus()).find(n => n.props['aria-label'] === 'Descrizione attrezzatura').props.onChange({ target: { value: 'Bozza' } })
  m.focus().props.onChiudi(); assert(!m.focus())
  assert(nodes(m.render()).some(n => n.props['aria-sort'] === 'ascending'))
  m.enter(); assert.equal(nodes(m.focus()).find(n => n.type === 'input').props.value, 'Bozza')
  assert.equal(m.focus().props.contesto, 'TESTA ANTONINO'); assert.deepEqual(m.calls, [])
})

test('due righe aprono due UUID reali e dati diversi tramite handler esistente; ritorno senza save', () => {
  const m = mount()
  for (const row of rows) {
    const tr = nodes(m.render()).find(n => n.type === 'tr' && text(n).includes(row.descrizione))
    button(tr, 'Modifica').props.onClick({ currentTarget: {} })
    assert.equal(m.p.modifica.id, row.id)
    assert.equal(m.p.modifica.form.descrizione, row.descrizione)
    assert.equal(m.p.modifica.form.nota, row.nota)
    assert.equal(m.p.modifica.form.quantita, String(row.quantita))
    assert.equal(m.focus().props.titolo, 'Modifica attrezzatura')
    assert.equal(button(m.focus(), 'Salva attrezzatura').props.onClick, m.p.modifica.form.salva)
    m.focus().props.onChiudi(); assert(!m.focus())
  }
  assert.deepEqual(m.calls, [])
})

test('salvataggio modifica chiude quando il writer originale azzera ID; nuova resta aperta', () => {
  const m = mount(); button(m.render(), 'Modifica').props.onClick({ currentTarget: {} })
  m.p.modifica.id = null; assert(!m.focus())
  m.enter(); m.p.form.setDescrizione(''); assert(m.focus())
})

test('ID globale residuo non riapre una modifica senza azione locale sulla riga', () => {
  const m = mount()
  m.p.modifica.id = rows[1].id
  assert(!m.focus())
  m.enter(); assert.equal(m.focus().props.titolo, 'Nuova attrezzatura')
  assert.equal(button(m.focus(), 'Salva attrezzatura').props.onClick, m.p.form.salva)
  m.focus().props.onChiudi(); assert(!m.focus()); assert.deepEqual(m.calls, [])
})

test('eliminazione mantiene il callback e il record della riga; preview legacy invariata', () => {
  const m = mount(), tr = nodes(m.render()).find(n => n.type === 'tr' && text(n).includes('Ponteggio'))
  button(tr, 'Elimina').props.onClick(); assert.deepEqual(m.calls, [['delete', rows[1].id]])
  const file = 'app/components/AttrezzatureCaricatePanel.tsx', old = cp.execFileSync('git', ['show', baseline + ':' + file], { encoding: 'utf8' })
  const legacy = s => s.replace(/\r/g, '').split('  return (\n    <div style={{ padding: 12')[1].trimEnd()
  assert.equal(legacy(read(file)), legacy(old))
})

test('ricerca e filtro cantiere restano montati e invariati durante il focus', () => {
  const h = hooks(), panel = load('app/components/AttrezzatureCantierePanel.tsx', h, {
    './AttrezzatureCaricatePanel': { default: 'panel' },
    '../utils/suggerimentiAttrezzature': { suggerimentiAttrezzature: () => ({ attrezzature: [], fornitori: [] }), acquistiAttrezzatureDisponibili: () => [] },
    '../utils/suggerimentiMateriali': { ultimoPrezzoMateriale: () => undefined },
  }).default
  const p = { cantiere: { id: 'site', nome: 'TESTA ANTONINO' }, panelProps: mount().p, fattureFornitori: [], righeAttrezzatureFatture: [] }
  const render = () => { h.start(); return panel(p) }
  let tree = render(), inputs = nodes(tree).filter(n => n.type === 'input')
  inputs[0].props.onChange({ target: { value: 'Trap' } }); inputs[1].props.onChange({ target: { value: 'A' } })
  tree = render(); const child = nodes(tree).find(n => n.type === 'panel')
  assert.deepEqual(child.props.attrezziCantiere.map(r => r.id), [rows[0].id])
  assert.equal(nodes(tree).filter(n => n.type === 'input')[0].props.value, 'Trap')
  assert.equal(nodes(tree).filter(n => n.type === 'input')[1].props.value, 'A')
  assert.equal(child.props.totaleAttrezzature, 140)
})

test('reader, writer, validazioni, calcoli ed elimina byte-identici alla Production', () => {
  const old = cp.execFileSync('git', ['show', baseline + ':app/page.tsx'], { encoding: 'utf8' })
  const cur = read('app/page.tsx').replace(/\r/g, '')
  const handlers = s => {
    const result = {}, ast = ts.createSourceFile('page.tsx', s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const names = ['caricaEconomia', 'caricaRigheAttrezzatureFatture', 'aggiungiAttrezzo', 'preparaModificaAttrezzo', 'annullaModificaAttrezzo', 'salvaModificaAttrezzo', 'eliminaAttrezzatura']
    function visit(n) {
      if (ts.isVariableDeclaration(n) && names.includes(n.name.getText(ast))) result[n.name.getText(ast)] = n.getText(ast).replace(/\r/g, '')
      ts.forEachChild(n, visit)
    }
    visit(ast); assert.equal(Object.keys(result).length, names.length); return result
  }
  assert.deepEqual(handlers(cur), handlers(old))
  cp.execFileSync('git', ['diff', '--exit-code', baseline, '--', 'supabase', 'lib', 'app/utils', 'app/engines'])
})

test('form responsive e portal isolano tutto il workspace e ripristinano scroll', () => {
  const s = read('app/components/AttrezzatureCaricatePanel.tsx'), vista = read('app/components/VistaOperativa.tsx')
  assert(s.includes('minmax(min(240px, 100%), 1fr)'))
  assert(s.includes("boxSizing: 'border-box'")); assert(s.includes('minHeight: 44'))
  assert(vista.includes('createPortal(contenuto, area)')); assert(vista.includes('display: none !important'))
  assert(vista.includes('area.scrollTo({ top: scroll })'))
})
