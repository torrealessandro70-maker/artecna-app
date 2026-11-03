/* eslint-disable @typescript-eslint/no-require-imports -- Offline UI regression harness; no DB, Web or provider calls. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const { execFileSync } = require('node:child_process')
const ts = require('typescript'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const componentFile = path.join(__dirname, 'RevisionePreventivoAiPanel.tsx')
const nodes = x => x == null ? [] : Array.isArray(x) ? x.flatMap(nodes) : typeof x === 'object' ? [x, ...nodes(x.props?.children)] : []
const text = x => x == null ? '' : Array.isArray(x) ? x.map(text).join('') : typeof x === 'object' ? text(x.props?.children) : String(x)
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' }
function hooks() {
  const slots = []; let cursor = 0
  return { begin() { cursor = 0 }, api: {
    useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v }] },
    useRef(init) { const i = cursor++; return slots[i] ?? (slots[i] = { current: init }) },
    useMemo: f => f(), useEffect() {},
  } }
}
function load(file, h, mocks = {}, cache = new Map()) {
  if (cache.has(file)) return cache.get(file)
  const ex = {}; cache.set(file, ex)
  const localRequire = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id]
    if (id === 'react' && h) return h.api
    if (id === 'react/jsx-runtime' && h) return jsx
    if (id.endsWith('/lib/supabaseClient')) return { supabase: {} }
    if (!id.startsWith('.')) return require(id)
    const dest = path.resolve(path.dirname(file), id)
    return load([dest + '.ts', dest + '.tsx', path.join(dest, 'index.ts')].find(fs.existsSync), h, mocks, cache)
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, { exports: ex, require: localRequire, console: { log() {} }, Response,
    window: { addEventListener() {}, removeEventListener() {}, confirm: () => true },
    fetch: mocks.fetch || (() => { throw Error('Unexpected network call') }),
  })
  return ex
}
const rows = [
  { id: 'a', descrizione: 'Posa pavimento', unita_misura: 'm²', quantita: 10, prezzo_unitario: 12 },
  { id: 'b', descrizione: 'Posa rivestimento', unita_misura: 'm²', quantita: 4, prezzo_unitario: 20 },
]
function props() {
  const forbidden = () => { throw Error('Presentation must not write prices or persist') }
  return { messaggioAi: '', descrizionePreventivoAi: 'Fixture locale', setDescrizionePreventivoAi: forbidden,
    vociPreventivoAi: rows, vociPreventivoAiOriginali: rows, setVociPreventivoAi: forbidden,
    prezziRiferimento: [], memoriaRiferimento: [], calcolaMediaPrezziSimili: () => null,
    verificaPrezzoAnomalo: () => '', formatMoney: n => Number(n).toFixed(2) + ' €',
    miglioraVocePreventivoAi: forbidden, salvaInMemoriaPrezzi: forbidden, generaExcelDefinitivoPreventivoAi: forbidden,
    salvaRevisionePreventivoAi: forbidden, preventivoRegistroCantiere: '', setMostraRevisionePreventivoAi: forbidden,
    excelTable: { width: '100%' }, excelTh: { padding: 8 }, excelTd: { padding: 8, verticalAlign: 'top' },
    buttonPrimary: {}, buttonSecondary: {},
  }
}
function renderHtml() {
  return renderToStaticMarkup(React.createElement(load(componentFile).default, props()))
}
test('un pannello nativo per riga, chiuso di default; figli montati e nessun gruppo esclusivo', () => {
  const h = hooks(); h.begin()
  const tree = load(componentFile, h).default(props())
  const details = nodes(tree).filter(n => n.type === 'details' && n.props.className === 'analisi-prezzo-voce')
  assert.equal(details.length, 2)
  for (const panel of details) {
    assert.equal(panel.props.open, undefined)
    assert.equal(panel.props.name, undefined) // Native details can stay open independently.
    assert.match(text(panel), /Analisi prezzo/)
    assert.match(text(panel), /Memoria prezzi ARTECNA/)
    assert(nodes(panel).some(n => typeof n.type === 'function' && n.type.name === 'AnalisiPrezzoVoce'))
    assert(nodes(panel).some(n => typeof n.type === 'function' && n.type.name === 'PrezzoWebVoce'))
  }
})
test('dati principali, azioni e totali restano fuori dal pannello; nessuna modifica al render', () => {
  const before = JSON.stringify(rows), h = hooks(); h.begin()
  const tree = load(componentFile, h).default(props())
  for (const row of nodes(tree).filter(n => n.type === 'tr' && nodes(n).some(c => c.type === 'textarea'))) {
    assert(!nodes(row).some(n => n.type === 'details'))
    assert(nodes(row).some(n => n.type === 'button' && text(n) === 'Elimina'))
  }
  const diagnosticRows = nodes(tree).filter(n => n.type === 'tr' && nodes(n).some(c => c.type === 'details'))
  assert.equal(diagnosticRows.length, 2)
  for (const row of diagnosticRows) {
    assert.equal(nodes(row).find(n => n.type === 'td').props.colSpan, 6)
    assert(!nodes(row).some(n => n.props?.['aria-label']?.startsWith('Prezzo unitario voce')))
    assert(!nodes(row).some(n => n.props?.['aria-label']?.startsWith('Quantità voce')))
  }
  assert.equal(JSON.stringify(rows), before)
  assert.match(text(tree), /Sub totale preventivo200.00 €/)
})
test('markup completo: analisi AI, Ambito e Web restano nello stesso pannello', () => {
  const html = renderHtml()
  assert.equal((html.match(/class="analisi-prezzo-voce"/g) || []).length, 2)
  for (const fragment of html.matchAll(/<details class="analisi-prezzo-voce"[\s\S]*?<\/td>/g)) {
    for (const label of ['Analizza riferimenti prezzo', 'Cerca riferimento Web', 'Seleziona ambito', 'Descrizione completa e criteri tecnici']) assert(fragment[0].includes(label), label)
  }
})
test('tutti gli handler esistenti e i componenti AI/Web sono invariati rispetto al candidato', () => {
  const root = path.resolve(__dirname, '../..'), base = '0aedde250e21a856880433012848544ea2406447'
  const handlers = source => {
    const ast = ts.createSourceFile('ui.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), found = []
    function visit(n) { if (ts.isJsxAttribute(n) && /^on[A-Z]/.test(n.name.text)) found.push(n.getText(ast).replace(/\s+/g, ' ')); ts.forEachChild(n, visit) }
    visit(ast); return found.sort()
  }
  const old = execFileSync('git', ['show', base + ':app/components/RevisionePreventivoAiPanel.tsx'], { cwd: root, encoding: 'utf8' })
  assert.deepEqual(handlers(fs.readFileSync(componentFile, 'utf8')), handlers(old))
  for (const file of ['AnalisiPrezzoVoce.tsx', 'PrezzoWebVoce.tsx']) {
    assert.equal(fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\r\n/g, '\n'), execFileSync('git', ['show', base + ':app/components/' + file], { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n'))
  }
})
test('Analizza riferimenti prezzo usa ancora il proprio handler e la route, solo HTTP mock', async () => {
  const h = hooks(), calls = [], input = { riferimento: 'fixture' }
  const mocks = {
    '../../lib/supabaseClient': { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'mock-only' } } }) } } },
    '../engines/price-resolution/storico-prezzi': { leggiStoricoPrezzi: async () => [] },
    '../engines/price-resolution/ai-price-analyst': {
      preparaAnalisiPrezzo: () => ({ input }), eseguiAnalisiPrezzo: async (_input, callback) => JSON.parse(await callback(input)),
      validaOutputAnalisi: r => r, riferimentiAnalisi: () => [], daVerificare: () => ({ motivazione: 'Verificare' }),
    },
    fetch: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return Response.json({ esito: 'da_verificare', motivazione: 'Mock completato', avvertenze: [], fonti_considerate: [] }) },
  }
  const C = load(path.join(__dirname, 'AnalisiPrezzoVoce.tsx'), h, mocks).default
  const render = () => { h.begin(); return C({ descrizione: rows[0].descrizione, um: 'm²', quantita: 10, prezzo: 12, prezzi: [], memoria: [], onUsa() { throw Error('No application') } }) }
  const button = nodes(render()).find(n => n.type === 'button'); assert.equal(button.props.disabled, false)
  await button.props.onClick()
  assert.equal(calls.length, 1); assert.equal(calls[0].url, '/api/prezzi/analisi-ai')
  assert.match(text(render()), /Mock completato/)
})
test('Ambito e Cerca riferimento Web mantengono stato e handler, senza rete reale', async () => {
  const h = hooks(), calls = []
  const mocks = {
    '../../lib/supabaseClient': { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'mock-only' } } }) } } },
    '../engines/price-resolution/storico-prezzi': { leggiStoricoPrezzi: async () => [], risolviPrezzoPrioritario: () => ({ priceResolution: { matched: false } }) },
    fetch: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return Response.json({ stato: 'NESSUN_RIFERIMENTO_VALIDO', minimo: null, massimo: null, prezzo_proposto: null, percorso: [], fonti: [], numero_riferimenti: 0 }) },
  }
  const C = load(path.join(__dirname, 'PrezzoWebVoce.tsx'), h, mocks).default
  const render = () => { h.begin(); return C({ descrizione: rows[0].descrizione, um: 'm²', prezzi: [], memoria: [], onUsa() { throw Error('No application') }, onInterno() { throw Error('No application') } }) }
  nodes(render()).find(n => n.type === 'select').props.onChange({ target: { value: 'posa' } })
  const tree = render(); assert.equal(nodes(tree).find(n => n.type === 'select').props.value, 'posa')
  const button = nodes(tree).find(n => n.type === 'button'); assert.equal(button.props.disabled, false)
  await button.props.onClick()
  assert.equal(calls.length, 1); assert.equal(calls[0].url, '/api/prezzi/web'); assert.equal(calls[0].body.ambito, 'posa')
  assert.equal(nodes(render()).find(n => n.type === 'select').props.value, 'posa')
})
module.exports = { renderHtml }
