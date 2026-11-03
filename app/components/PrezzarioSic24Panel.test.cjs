/* eslint-disable @typescript-eslint/no-require-imports -- Offline component harness; database operations are mocked. */
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const { execFileSync } = require('node:child_process')
const file = path.join(__dirname, 'PrezzarioSic24Panel.tsx'), root = path.resolve(__dirname, '../..')
const nodes = x => x == null ? [] : Array.isArray(x) ? x.flatMap(nodes) : typeof x === 'object' ? [x, ...nodes(x.props?.children)] : []
const text = x => x == null ? '' : Array.isArray(x) ? x.map(text).join('') : typeof x === 'object' ? text(x.props?.children) : String(x)
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' }
const tick = () => new Promise(resolve => setImmediate(resolve))
function hooks() {
  const slots = []; let cursor = 0, pending = []
  return { begin() { cursor = 0 }, flush() { const effects = pending; pending = []; effects.forEach(f => f()) }, api: {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }] },
    useRef(init) { const i = cursor++; return slots[i] ?? (slots[i] = { current: init }) },
    useEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v, n) => !Object.is(v, old[n]))) { slots[i] = deps; pending.push(fn) } },
  } }
}
function load(f, h, cache = new Map()) {
  if (cache.has(f)) return cache.get(f)
  const ex = {}; cache.set(f, ex)
  const localRequire = id => {
    if (id === 'react') return h.api
    if (id === 'react/jsx-runtime') return jsx
    if (!id.startsWith('.')) return require(id)
    const target = path.resolve(path.dirname(f), id)
    return load([target + '.ts', target + '.tsx', path.join(target, 'index.ts')].find(fs.existsSync), h, cache)
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { exports: ex, require: localRequire, window: { confirm() { throw Error('No destructive actions') } } })
  return ex
}
const fixture = Array.from({ length: 31 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  codice: `SIC24_1.1.${i + 1}`, descrizione: `Lavorazione comune ${i + 1}. ` + 'Descrizione tecnica completa con inclusioni, esclusioni e oneri documentati. '.repeat(12),
  unita_misura: 'm²', prezzo_unitario: 24.14 + i, incidenza_manodopera: 31.96, prezzo_manodopera: 7.71,
  fonte: 'Regione Sicilia', anno: 2024, versione: 'SIC24', tipo_prezzo: 'regional_price_list' }))
function mount(overrides = []) {
  const operations = [], h = hooks()
  const db = { from(table) {
    const state = { table, filters: {}, single: false }, q = {}
    for (const op of ['select', 'eq', 'like', 'order', 'range', 'in']) q[op] = (...args) => {
      operations.push({ op, args }); if (op === 'eq' || op === 'in') state.filters[args[0]] = args[1]; return q
    }
    q.single = () => { state.single = true; return q }
    q.then = callback => Promise.resolve({ error: null, data: state.single ? fixture.find(r => r.id === state.filters.id)
      : state.filters.tipo_prezzo === 'artecna' ? overrides.filter(r => state.filters.origine_prezzario_id.includes(r.origine_prezzario_id)) : fixture }).then(callback)
    for (const op of ['insert', 'update', 'delete', 'upsert']) q[op] = () => { throw Error('Unexpected write: ' + op) }
    return q
  } }
  const C = load(file, h).default
  const render = () => { h.begin(); const tree = C({ supabase: db }); h.flush(); return tree }
  const settle = async () => { let tree; for (let i = 0; i < 4; i++) { tree = render(); await tick() } return tree }
  return { render, settle, operations }
}
const cards = tree => nodes(tree).filter(n => n.type === 'article')
const button = (tree, label) => {
  const found = nodes(tree).find(n => n.type === 'button' && (text(n) === label || n.props['aria-label'] === label))
  assert(found, label); return found
}
test('30 card autonome con descrizioni complete e metadati numerici separati, dati immutati', async () => {
  const before = JSON.stringify(fixture), m = mount(), tree = await m.settle()
  assert.equal(cards(tree).length, 30)
  assert(!nodes(tree).some(n => n.type === 'table'))
  for (const [i, card] of cards(tree).entries()) {
    assert.equal(card.props['aria-label'], 'Voce ' + fixture[i].codice)
    assert(card.props.style.border); assert(card.props.style.padding > 0); assert(card.props.style.marginBottom > 0)
    assert(text(card).includes(fixture[i].descrizione))
    const metadata = nodes(card).find(n => n.type === 'dl')
    for (const label of ['U.M.', 'Prezzo unitario', '% Manodopera', 'Manodopera €/U.M.', 'Fonte', 'Anno', 'Versione']) assert(text(metadata).includes(label), label)
    assert.equal(nodes(metadata).filter(n => n.type === 'dd' && n.props.style.fontVariantNumeric === 'tabular-nums').length, 3)
    assert.equal(nodes(card).filter(n => n.type === 'button').length, 1)
  }
  assert.equal(JSON.stringify(fixture), before)
  assert(m.operations.some(o => o.op === 'range' && o.args[0] === 0 && o.args[1] === 499))
})
test('paginazione invariata: 30 voci, pagina successiva con la 31ª, ritorno alla prima', async () => {
  const m = mount(); let tree = await m.settle()
  button(tree, 'Pagina successiva').props.onClick(); tree = await m.settle()
  assert.equal(cards(tree).length, 1); assert(text(cards(tree)[0]).includes(fixture[30].codice))
  button(tree, 'Pagina precedente').props.onClick(); tree = await m.settle()
  assert.equal(cards(tree).length, 30); assert(text(cards(tree)[0]).includes(fixture[0].codice))
})
test('ricerca codice/descrizione e navigazione risultati conservano evidenziazione e pagina', async () => {
  const m = mount(); let tree = await m.settle()
  const search = value => nodes(tree).find(n => n.type === 'input' && n.props['aria-label'] === 'Ricerca prezzario SIC24').props.onChange({ target: { value } })
  search(fixture[30].codice); tree = await m.settle()
  assert.equal(cards(tree).length, 1); assert(nodes(cards(tree)[0]).some(n => n.type === 'mark'))
  search('lavorazione comune'); tree = await m.settle()
  button(tree, 'Risultato SIC24 precedente').props.onClick(); tree = await m.settle()
  assert.equal(cards(tree).length, 1); assert(text(cards(tree)[0]).includes(fixture[30].codice))
  button(tree, 'Risultato SIC24 successivo').props.onClick(); tree = await m.settle()
  assert.equal(cards(tree).length, 30)
})
test('Personalizza per ARTECNA apre il form con la stessa origine tramite sole letture mock', async () => {
  const m = mount(); let tree = await m.settle()
  const b = button(cards(tree)[0], 'Personalizza per ARTECNA'); assert.equal(b.props.disabled, false)
  await b.props.onClick(); tree = await m.settle()
  assert(nodes(tree).some(n => n.type === 'form' && n.props['aria-label'] === 'Personalizzazione ARTECNA'))
  assert(text(tree).includes(fixture[0].id))
  button(tree, 'Annulla').props.onClick(); tree = await m.settle()
  assert(!nodes(tree).some(n => n.type === 'form'))
})
test('confronto e comandi di una personalizzazione esistente restano disponibili', async () => {
  const override = { ...fixture[0], id: '00000000-0000-4000-8000-000000000099', origine_prezzario_id: fixture[0].id, prezzo_unitario: 55, tipo_prezzo: 'artecna' }
  const tree = await mount([override]).settle(), card = cards(tree)[0]
  assert(text(card).includes('UFFICIALE')); assert(text(card).includes('ARTECNA'))
  assert(button(card, 'Modifica personalizzazione')); assert(button(card, 'Rimuovi personalizzazione'))
})
test('reader, filtri, effetti, paginazione e tutti gli handler sono identici al parent', () => {
  const base = 'ab124f0b6ab06f5c07143a95220240f522ffe850'
  const previous = execFileSync('git', ['show', base + ':app/components/PrezzarioSic24Panel.tsx'], { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n')
  const current = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  assert.equal(current.slice(0, current.indexOf('  return <section')), previous.slice(0, previous.indexOf('  return <section')).replace('HTMLTableRowElement', 'HTMLElement'))
  const handlers = source => {
    const ast = ts.createSourceFile('ui.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), result = []
    function visit(n) { if (ts.isJsxAttribute(n) && /^on[A-Z]/.test(n.name.text)) result.push(n.getText(ast).replace(/\s+/g, ' ')); ts.forEachChild(n, visit) }
    visit(ast); return result.sort()
  }
  assert.deepEqual(handlers(current), handlers(previous))
  for (const f of ['app/utils/ricercaPrezzari.ts', 'app/engines/price-import/prezzario-sic24.ts', 'app/engines/price-import/override-prezzario.ts']) {
    assert.equal(fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n'), execFileSync('git', ['show', base + ':' + f], { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n'))
  }
})
