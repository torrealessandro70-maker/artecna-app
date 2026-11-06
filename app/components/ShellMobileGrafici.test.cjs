/* eslint-disable @typescript-eslint/no-require-imports -- Offline layout/measurement regressions. */
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), cp = require('node:child_process')
const base = '8fb2ed60c5baf9ba0d27b76bc67c74c6dbd69656'
const read = p => fs.readFileSync(p, 'utf8').replace(/\r/g, '')
const old = p => cp.execFileSync('git', ['show', base + ':' + p], { encoding: 'utf8' }).replace(/\r/g, '')
const compile = s => ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
const page = read('app/page.tsx'), ast = ts.createSourceFile('page.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function attributes(tag) {
  let result
  function visit(n) { if (ts.isJsxOpeningElement(n) && n.tagName.getText(ast) === tag) result = n.attributes.properties; ts.forEachChild(n, visit) }
  visit(ast); return result
}
const attr = (tag, name) => attributes(tag).find(a => a.name?.getText(ast) === name)?.initializer?.expression?.getText(ast)
const evaluate = (s, context) => vm.runInNewContext(compile('const result = (' + s + '); result'), context)
const visible = page.match(/const sidebarVisibile = (.*)/)[1]
function shell(width, mobileOpen = false, desktopOpen = true) {
  const state = { isMobile: width < 768, menuMobileAperto: mobileOpen, sidebarAperta: desktopOpen, fontFamily: 'Arial', fontSize: 16 }
  state.sidebarVisibile = evaluate(visible, state)
  return { state, aside: evaluate(attr('aside', 'style'), state), main: evaluate(attr('main', 'style'), state) }
}
for (const width of [480, 720]) test('drawer a ' + width + ' non occupa spazio strutturale, aperto o chiuso', () => {
  for (const open of [false, true]) {
    const s = shell(width, open)
    assert.equal(s.aside.position, 'fixed'); assert.equal(s.aside.width, open ? 260 : 0)
    assert.equal(s.main.flex, 1); assert.equal(s.main.minWidth, 0)
    assert.equal(s.main.padding, '80px 12px 16px'); assert.equal(s.aside.maxWidth, '85vw')
  }
  assert.equal(evaluate(attr('aside', 'inert'), shell(width).state), true)
})
for (const width of [1024, 1600]) test('sidebar desktop a ' + width + ' mantiene larghezza e padding originali', () => {
  for (const open of [true, false]) {
    const s = shell(width, true, open)
    assert.equal(s.aside.position, undefined); assert.equal(s.aside.width, open ? 260 : 0)
    assert.equal(s.main.padding, '80px 25px 25px 25px')
  }
})
test('Escape cambia soltanto lo stato mobile, senza toccare selezioni, dati o scroll', () => {
  const s = shell(480, true), calls = []
  evaluate(attr('aside', 'onKeyDown'), { ...s.state, setMenuMobileAperto: value => calls.push(value) })({ key: 'Escape' })
  assert.deepEqual(calls, [false])
  const t = shell(1024, true)
  evaluate(attr('aside', 'onKeyDown'), { ...t.state, setMenuMobileAperto: value => calls.push(value) })({ key: 'Escape' })
  assert.deepEqual(calls, [false]); assert(page.includes('aria-controls="menu-laterale-principale"'))
  assert(page.includes('window.innerWidth < 768'))
  assert(page.includes("inset: '0 0 0 min(260px, 85vw)'"), 'backdrop is clickable outside the drawer, never over navigation')
  assert(!/supabase|rpc|localStorage|setCantiere|setSezione|scroll/.test(attr('aside', 'onKeyDown')))
})
function mountChart() {
  let size = null, effect, observer, cleanup, closed = true, rect = { width: 0, height: 0 }
  const listeners = new Map()
  class Details { addEventListener(n, f) { listeners.set(n, f) } removeEventListener(n) { listeners.delete(n) } }
  const details = new Details()
  const element = { parentElement: details, getBoundingClientRect: () => rect, closest: () => closed ? details : null }
  const child = { type: 'chart', props: { data: [{ nome: 'Utile', valore: 125 }] } }, exports = {}
  vm.runInNewContext(compile(read('app/components/GraficoDimensionato.tsx')), {
    exports, Number, Math, HTMLDetailsElement: Details,
    ResizeObserver: class { constructor(fn) { observer = fn } observe() {} disconnect() { observer = null } },
    require(id) {
      if (id === 'react') return { useRef: () => ({ current: element }), useState: () => [size, value => size = typeof value === 'function' ? value(size) : value], useEffect: fn => effect ||= fn }
      if (id === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) }
      if (id === 'recharts') return { ResponsiveContainer: 'ResponsiveContainer' }
      throw Error('Unexpected IO: ' + id)
    },
  })
  const render = () => exports.default({ children: child })
  render(); cleanup = effect()
  return { render, child, listeners, resize(width, height) { rect = { width, height }; observer() }, toggle(open) { closed = !open; listeners.get('toggle')() }, cleanup() { cleanup() }, observed: () => observer }
}
test('grafico assente finché details è chiuso, anche con rettangolo residuo positivo', () => {
  const m = mountChart(); assert.equal(m.render().props.children, null)
  m.resize(600, 238); assert.equal(m.render().props.children, null)
  m.toggle(true); const chart = m.render().props.children
  assert.equal(chart.type, 'ResponsiveContainer'); assert.equal(chart.props.width, 600); assert.equal(chart.props.height, 238)
  assert.strictEqual(chart.props.children, m.child)
})
test('zero, valori negativi e non finiti non montano Recharts; apertura successiva recupera', () => {
  const m = mountChart(); m.toggle(true)
  for (const [width, height] of [[0, 0], [-1, -1], [600, 0], [0, 238], [NaN, 238], [Infinity, 238]]) {
    m.resize(width, height); assert.equal(m.render().props.children, null)
  }
  m.resize(480, 238); assert(m.render().props.children)
  m.toggle(false); assert.equal(m.render().props.children, null)
  m.toggle(true); assert(m.render().props.children)
  m.cleanup(); assert.equal(m.listeners.size, 0); assert.equal(m.observed(), null)
})
test('grafici ricevono solo dimensioni reali; nessun valore iniziale fittizio né silenziamento console', () => {
  const s = read('app/components/GraficoDimensionato.tsx')
  assert(s.includes('width={dimensioni.width} height={dimensioni.height}'))
  assert(!/console\.|initialDimension|minHeight|supabase|fetch\(/.test(s))
})
test('dati, KPI, colori e click dei due grafici sono identici alla Production', () => {
  const file = 'app/components/EconomiaGraficiPanel.tsx'
  const normalize = s => s.replace("import GraficoDimensionato from './GraficoDimensionato'\n", '')
    .replace('  ResponsiveContainer,\n', '').replaceAll('<ResponsiveContainer width="100%" height="100%">', '<GraficoDimensionato>')
    .replaceAll('</ResponsiveContainer>', '</GraficoDimensionato>').trimEnd()
  assert.equal(normalize(read(file)), normalize(old(file)))
})
test('VistaOperativa e Attrezzature restano identiche, nessuna modifica dati o RPC', () => {
  for (const file of ['app/components/VistaOperativa.tsx', 'app/components/AttrezzatureCaricatePanel.tsx', 'app/components/AttrezzatureCantierePanel.tsx']) assert.equal(read(file), old(file))
  cp.execFileSync('git', ['-c', 'core.safecrlf=false', 'diff', '--exit-code', base, '--', 'lib', 'supabase', 'app/utils', 'app/engines'])
})
