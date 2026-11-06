/* eslint-disable @typescript-eslint/no-require-imports -- Offline presentation harness; every write RPC is forbidden. */
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), cp = require('node:child_process')
const compile = s => ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
const source = f => fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/\r\n/g, '\n')
const nodes = x => x == null ? [] : Array.isArray(x) ? x.flatMap(nodes) : typeof x === 'object' ? [x, ...nodes(x.props?.children)] : []
const text = x => x == null ? '' : Array.isArray(x) ? x.map(text).join('') : typeof x === 'object' ? text(x.props?.children) : String(x)
const find = (tree, type, label = '') => nodes(tree).find(n => n.type === type && text(n).includes(label))
const jsx = (type, props) => ({ type, props })
function hooks() {
  const slots = []; let cursor = 0, effects = []
  const react = {
    useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init; return [slots[i], v => slots[i] = typeof v === 'function' ? v(slots[i]) : v] },
    useRef(init) { const i = cursor++; return slots[i] ?? (slots[i] = { current: init }) },
    useMemo(fn) { cursor++; return fn() },
    useCallback(fn) { cursor++; return fn },
    useEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) { old?.cleanup?.(); const entry = { deps }; slots[i] = entry; effects.push(() => entry.cleanup = fn()) } },
  }
  return { react, start() { cursor = 0 }, flush() { const pending = effects; effects = []; pending.forEach(f => f()) } }
}
const grouping = {}; vm.runInNewContext(compile(fs.readFileSync(path.join(__dirname, '../lib/gruppiVarianti.ts'), 'utf8')), { exports: grouping });
const focus = {}; vm.runInNewContext(compile(source('VistaOperativa.tsx')), { exports: focus, require(id) { if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }; return {} } })
function mount({ rows = [{ id: 'storica', titolo: 'Storica', stato: 'approvata', numero: 1, importo_delta_approvato: null }] } = {}) {
  const h = hooks(), reads = [], exports = {}
  const db = { rpc(name) { reads.push(name); assert.equal(name, 'leggi_varianti_cantiere', 'No write allowed'); const q = { order() { return q }, range() { return Promise.resolve({ data: rows, error: null }) } }; return q } }
  vm.runInNewContext(compile(source('VariantiCantierePanel.tsx')), { exports, require(id) {
    if (id === 'react') return h.react
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id === './VistaOperativa') return focus
    if (id === '../lib/gruppiVarianti') return grouping
    if (id.endsWith('/supabaseClient')) return { supabase: db }
    return {}
  } })
  const props = { cantiereId: 'cantiere-a' }
  return { reads, render() { h.start(); const tree = exports.default(props); h.flush(); return tree }, async settle() { let tree; for (let i = 0; i < 3; i++) { tree = this.render(); await new Promise(setImmediate) } return tree } }
}
const operational = tree => nodes(tree).find(n => n.type === focus.default && n.props.titolo === 'Nuova variante')
function fill(tree, value) {
  const input = nodes(operational(tree)).find(n => n.type === 'input' && n.props.required)
  input.props.onChange({ target: { value } })
}

test('Nuova variante entra nella vista operativa senza scritture', async () => {
  const m = mount(), before = await m.settle()
  assert.equal(operational(before), undefined)
  find(before, 'button', 'Nuova variante').props.onClick()
  const view = operational(m.render())
  assert.equal(view.props.titolo, 'Nuova variante')
  assert(find(view, 'form')); assert(find(view, 'button', 'Annulla')); assert(find(view, 'button', 'Salva bozza'))
  assert(m.reads.every(n => n === 'leggi_varianti_cantiere'))
})

test('ritorno conserva testo locale, variante selezionata ed elenco montato', async () => {
  const m = mount(); let tree = await m.settle(); find(tree, 'button', 'Varianti approvate (').props.onClick(); tree = m.render()
  find(tree, 'button', 'Apri variante').props.onClick()
  find(m.render(), 'button', 'Nuova variante').props.onClick()
  fill(m.render(), 'Bozza locale da conservare')
  operational(m.render()).props.onChiudi()
  tree = m.render(); assert.equal(operational(tree), undefined)
  assert(find(tree, 'button', 'Nascondi dettaglio'))
  find(tree, 'button', 'Nuova variante').props.onClick()
  tree = m.render()
  assert.equal(nodes(operational(tree)).find(n => n.type === 'input' && n.props.required).props.value, 'Bozza locale da conservare')
})

test('Annulla chiude e mantiene il reset originale', async () => {
  const m = mount(); find(await m.settle(), 'button', 'Nuova variante').props.onClick()
  fill(m.render(), 'Non salvare')
  find(operational(m.render()), 'button', 'Annulla').props.onClick()
  assert.equal(operational(m.render()), undefined)
  find(m.render(), 'button', 'Nuova variante').props.onClick()
  assert.equal(nodes(operational(m.render())).find(n => n.type === 'input' && n.props.required).props.value, '')
})

test('portal nel workspace esistente: intestazione, tutta larghezza, ripristino scroll/focus', () => {
  const h = hooks(), area = { scrollTop: 420, scrollTo({ top }) { this.scrollTop = top } }, calls = [], exports = {}
  vm.runInNewContext(compile(source('VistaOperativa.tsx')), { exports, document: { getElementById(id) { assert.equal(id, 'area-lavoro-principale'); return area } }, require(id) {
    if (id === 'react') return h.react
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id === 'react-dom') return { createPortal(content, target) { assert.equal(target, area); return content } }
  } })
  const ritorno = { current: { focus(options) { calls.push(options) } } }, chiudi = () => calls.push('chiudi')
  h.start(); const tree = exports.default({ titolo: 'Nuova variante', contesto: 'Cantiere A', onChiudi: chiudi, ritornoFocusRef: ritorno, children: 'modulo' })
  assert.equal(tree.props.style.width, '100%'); assert.equal(tree.props.style.minWidth, 0)
  assert(text(tree).includes('Cantiere A')); assert.equal(find(tree, 'button').props.onClick, chiudi)
  assert(text(find(tree, 'style')).includes(':has(> [data-attivita-operativa])'))
  assert(text(find(tree, 'style')).includes('display: none !important'))
  const heading = find(tree, 'h2'); heading.props.ref.current = { focus() { calls.push('titolo') } }
  h.flush(); assert.equal(area.scrollTop, 0); assert(calls.includes('titolo'))
  // Trigger effect cleanup using a new area dependency, without changing the originating screen.
  ritorno.current.focus = () => calls.push('ritorno')
  h.start(); exports.default({ titolo: 'Nuova variante', onChiudi: chiudi, ritornoFocusRef: { current: null }, children: 'modulo' })
  assert.equal(area.scrollTop, 420); assert(calls.includes('ritorno'))
})

test('errori e stato occupato restano nel contenuto operativo, salvataggio invariato', () => {
  const cur = source('VariantiCantierePanel.tsx'), old = cp.execFileSync('git', ['show', 'HEAD:app/components/VariantiCantierePanel.tsx'], { encoding: 'utf8' }).replace(/\r\n/g, '\n')
  const handlers = s => s.slice(s.indexOf('  function resetForm() {', s.indexOf('export default function VariantiCantierePanel')), s.indexOf('  function confermaProposta('))
  assert.equal(handlers(cur), handlers(old))
  const focusMarkup = cur.slice(cur.indexOf('<VistaOperativa titolo="Nuova variante"'), cur.indexOf('</VistaOperativa>', cur.indexOf('<VistaOperativa titolo="Nuova variante"')))
  assert(focusMarkup.includes('occupata={salvataggio}'))
  assert(focusMarkup.includes('{erroreSalvataggio && <p role="alert">'))
  assert(focusMarkup.includes('{salvataggio && <p role="status">'))
  cp.execFileSync('git', ['diff', '--exit-code', '--', 'app/engines/varianti', 'supabase', 'lib'])
})

test('toolbar unica senza guida duplicata, riposo senza form', async () => {
  const m = mount(), tree = await m.settle()
  const toolbar = nodes(tree).find(n => n.props?.role === 'toolbar')
  assert(toolbar); assert.equal(typeof find(toolbar, 'button', '+ Nuova variante').props.onClick === 'function', true)
  assert.equal(nodes(tree).filter(n => n.type === 'button' && text(n) === '+ Nuova variante').length, 1)
  assert(!nodes(tree).some(n => n.props?.onCrea)); assert(!find(tree, 'form'))
})

test('card compatta distingue numero, titolo e badge reale senza mutare i dati', async () => {
  const m = mount(); let tree = await m.settle(); find(tree, 'button', 'Varianti approvate (').props.onClick(); tree = m.render(); const card = find(tree, 'article')
  assert.equal(card.props.style.padding, 12); assert.equal(card.props.style.minWidth, 0)
  assert(text(find(card, 'h4')).includes('Variante 1 — Storica'))
  assert(nodes(card).some(n => n.type === 'span' && text(n) === 'Approvata'))
  assert(!text(card).includes('Stato:')); assert(!nodes(card).some(n => n.props?.tipo === 'variante'))
})

test('titolo storico normalizzato solo in presentazione, nessun cambio di numeri e importi', () => {
  const src = source('VariantiCantierePanel.tsx')
  assert(src.includes("variante.titolo === titoloBozzaSorgenti ? 'Preventivo integrativo'"))
  assert(src.includes('variante.numero !== null ?'))
  assert(src.includes("signDisplay: 'exceptZero'"))
  assert(src.includes('variante.data_variante.slice(0, 10)'))
})

test('Apri variante conserva esattamente il callback e tutti gli handler economici', () => {
  const cur = source('VariantiCantierePanel.tsx'), old = cp.execFileSync('git', ['show', 'HEAD:app/components/VariantiCantierePanel.tsx'], { encoding: 'utf8' }).replace(/\r\n/g, '\n')
  const callback = 'onClick={() => setVarianteApertaId(aperta => aperta === variante.id ? null : variante.id)}'
  assert(cur.includes(callback)); assert(old.includes(callback))
  const logic = s => s.slice(s.indexOf('  async function caricaSorgentiSalvate'), s.indexOf('  return <div style={{ margin:'))
  assert.equal(logic(cur), logic(old))
})


test('layout form e anteprima si adattano al contenitore senza cambiare calcoli', () => {
  const s = source('VariantiCantierePanel.tsx')
  assert(s.includes("gridTemplateColumns: 'minmax(0, 1fr)'"))
  assert(s.includes('@container acquisizione-variante (width < 900px)'))
  assert(s.includes('min-width: 0 !important'))
  for (const label of ['Descrizione', 'UM', 'Quantità', 'Prezzo sorgente', 'Totale sorgente', 'Verifica']) assert(s.includes('data-label="' + label + '"'))
  assert(!s.includes('window.innerWidth'))
})


for (const [stato, badge] of [['bozza','Bozza'],['proposta','Proposta'],['approvata','Approvata'],['rifiutata','Rifiutata'],['annullata','Annullata']]) test('card mostra stato reale separato dal titolo storico: ' + stato, async () => {
  const record = { id: 'storica', titolo: 'Preventivo integrativo - bozza', stato, numero: 12, data_variante: '2026-10-13', importo_delta_approvato: '1411.78' }
  const m = mount({ rows: [record] }); let tree = await m.settle(); find(tree, 'button', stato === 'approvata' ? 'Varianti approvate (' : 'Altre varianti da verificare (').props.onClick(); const card = find(m.render(), 'article')
  assert.equal(text(find(card, 'h4')), 'Variante 12 — Preventivo integrativo')
  assert(nodes(card).some(n => n.type === 'span' && text(n) === badge))
  assert(text(card).includes('13/10/2026')); assert(text(card).includes('1411,78'))
  assert.equal(record.titolo, 'Preventivo integrativo - bozza'); assert.equal(record.numero, 12); assert.equal(record.importo_delta_approvato, '1411.78')
})
