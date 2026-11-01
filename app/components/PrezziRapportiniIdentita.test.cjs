/* eslint-disable @typescript-eslint/no-require-imports -- Local UI regression tests with synthetic transport. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const root = path.resolve(__dirname, '../..')
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const R = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const rows = [
  { id: '11111111-1111-4111-8111-111111111111', operaioId: A, operativo: { data: '2026-10-28', operaio: 'TORRE ALESSANDRO', qualifica: null } },
  { id: '22222222-2222-4222-8222-222222222222', operaioId: B, operativo: { data: '2026-10-28', operaio: 'TORRE GRAZIANO', qualifica: 'Operaio specializzato' } },
  { id: '33333333-3333-4333-8333-333333333333', operaioId: A, operativo: { data: '2026-10-29', operaio: 'TORRE ALESSANDRO', qualifica: null } },
].map((r, i) => ({ ordine: i + 1, descrizione: 'Preso materiali, lamiere e idraulica x sottoscala', um: 'h', quantita: 5, prezzo: null, note: null, origine: 'rapportino', ...r }))

function loader(extra = {}) {
  const cache = {}
  return function load(file, suffix = '') {
    file = path.resolve(file)
    if (cache[file]) return cache[file]
    const loadedModule = { exports: {} }; cache[file] = loadedModule.exports
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8') + suffix, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, console, Error, Set, Map, require: n => extra[n] ?? (n.includes('supabaseClient') ? { supabase: extra.client } : n.startsWith('.') ? load(path.resolve(path.dirname(file), n) + '.ts') : require(n)) })
    return loadedModule.exports
  }
}
const helpers = loader()(path.join(root, 'app/engines/economia/prezziRapportiniIdentita.ts'))
const nodes = (x, out = []) => { if (Array.isArray(x)) x.forEach(v => nodes(v, out)); else if (x?.props) { out.push(x); nodes(x.props.children, out) } return out }
const text = x => Array.isArray(x) ? x.map(text).join('') : x?.props ? text(x.props.children) : typeof x === 'string' || typeof x === 'number' ? String(x) : ''
function harness(righe = rows) {
  const hooks = [], effects = [], calls = []; let index = 0, reads = 0
  const react = {
    useState(v) { const i = index++; if (!(i in hooks)) hooks[i] = v; return [hooks[i], v => hooks[i] = typeof v === 'function' ? v(hooks[i]) : v] },
    useRef(v) { const i = index++; if (!(i in hooks)) hooks[i] = { current: v }; return hooks[i] },
    useEffect(fn) { const i = index++; if (!(i in hooks)) { hooks[i] = true; effects.push(fn) } },
  }
  const client = { rpc: async (name, p) => {
    calls.push([name, p])
    if (name === 'leggi_tariffe_manodopera_economia') return { data: [], error: null }
    assert.equal(name, 'valorizza_manodopera_economia')
    return { error: null, data: { raccolta: { id: R, revisione: p.p_revisione_attesa + 1 }, riga: { id: p.p_riga_id, raccolta_id: R, prezzo_unitario: Number(p.p_prezzo_cliente), prezzo_cliente_confermato_at: '2026-11-01T10:00:00Z' } } }
  } }
  const jsx = (type, props, key) => ({ type, props, key })
  const Component = loader({ react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' }, client })(path.join(root, 'app/components/PrezziRapportiniEconomia.tsx')).default
  const props = { raccolta: { id: R, revisione: 1, stato: 'bozza' }, righe, onRileggi: async () => { reads++ } }
  function render() { index = 0; const tree = Component(props); effects.splice(0).forEach(fn => fn()); return tree }
  const row = id => nodes(render()).find(n => n.type === 'article' && n.key === id)
  const input = id => nodes(render()).find(n => n.props['aria-label'] === 'Prezzo fatturabile ' + id)
  const button = name => nodes(render()).find(n => n.type === 'button' && text(n) === name)
  return { render, row, input, button, calls, props, reads: () => reads }
}

test('descrizioni e cinque ore duplicate: date, nomi e chiavi UUID distinti', () => {
  const h = harness()
  assert(text(h.row(rows[0].id)).includes('28/10/2026 · TORRE ALESSANDRO'))
  assert(text(h.row(rows[1].id)).includes('28/10/2026 · TORRE GRAZIANO'))
  assert(text(h.row(rows[2].id)).includes('29/10/2026 · TORRE ALESSANDRO'))
  assert.equal(nodes(h.render()).filter(n => n.type === 'article').length, 3)
})
test('qualifica solo quando disponibile; nessun valore artificiale', () => {
  const h = harness()
  assert(text(h.row(rows[1].id)).includes('Operaio specializzato'))
  assert(!text(h.row(rows[0].id)).includes('Qualifica'))
  assert.equal(helpers.identitaPrezziRapportino(rows[0]).qualifica, null)
})
test('tariffa locale sulla registrazione UUID corretta, totale riga e totale manodopera', () => {
  const h = harness(rows.map(r => ({ ...r, prezzo: 20 })))
  h.input(rows[1].id).props.onChange({ target: { value: '30,00' } })
  assert.equal(h.input(rows[0].id).props.value, '20')
  assert.equal(h.input(rows[1].id).props.value, '30,00')
  assert(text(h.row(rows[1].id)).includes('150,00'))
  assert(text(h.render()).includes('350,00'))
  assert.equal(h.calls.length, 0)
})
test('Applica a tutte invariato: solo prezzo persistito null, nessun salvataggio automatico', () => {
  const h = harness([{ ...rows[0], prezzo: 25 }, rows[1], rows[2]])
  nodes(h.render()).find(n => n.props['aria-label'] === 'Tariffa per tutte').props.onChange({ target: { value: '30' } })
  h.button('Applica a tutte').props.onClick()
  assert.equal(h.input(rows[0].id).props.value, '25')
  assert.equal(h.input(rows[1].id).props.value, '30')
  assert.equal(h.input(rows[2].id).props.value, '30')
  assert(text(h.render()).includes('425,00'))
  assert.equal(h.calls.length, 0)
})
test('stesso operaio su date diverse: solo ID coincidente, prezzi persistiti intatti', () => {
  const h = harness([...rows, { ...rows[0], id: '4', prezzo: 45 }])
  h.input(rows[0].id).props.onChange({ target: { value: '30' } })
  nodes(h.row(rows[0].id)).find(n => n.type === 'button' && text(n) === 'Applica a tutte le ore di questo operaio').props.onClick()
  assert.equal(h.input(rows[2].id).props.value, '30')
  assert.equal(h.input(rows[1].id).props.value, '')
  assert.equal(h.input('4').props.value, '45')
  assert.equal(h.calls.length, 0)
})
test('omonimi, UUID mancante o non valido: nessuna associazione per nome', () => {
  const h = harness(rows.map((r, i) => ({ ...r, operaioId: i === 0 ? null : i === 1 ? 'non-un-id' : B, operativo: { ...r.operativo, operaio: 'STESSO NOME' } })))
  assert(!text(h.row(rows[0].id)).includes('Applica a tutte le ore'))
  assert(!text(h.row(rows[1].id)).includes('Applica a tutte le ore'))
  const updated = helpers.prezziPerOperaio([{ ...rows[0], operaioId: A }, { ...rows[1], operativo: rows[0].operativo }], rows[0].id, '30', {})
  assert.deepEqual(Object.keys(updated), [rows[0].id])
})
test('salvataggio soltanto dopo conferma esplicita e con UUID registrazione selezionata', async () => {
  const h = harness()
  h.input(rows[1].id).props.onChange({ target: { value: '30' } })
  h.button('Verifica prezzi').props.onClick()
  assert.equal(h.calls.length, 0)
  h.button('Conferma valorizzazione').props.onClick()
  for (let i = 0; i < 8; i++) await new Promise(r => setImmediate(r))
  const writes = h.calls.filter(([n]) => n === 'valorizza_manodopera_economia')
  assert.equal(writes.length, 1)
  assert.equal(writes[0][1].p_riga_id, rows[1].id)
  assert.equal(writes[0][1].p_prezzo_cliente, '30')
  assert.equal(h.reads(), 1)
})
test('raccolta chiusa e sola lettura restano non modificabili', () => {
  const h = harness(); h.props.raccolta.stato = 'chiusa'; assert.equal(h.render(), null)
  h.props.raccolta.stato = 'bozza'; h.props.solaLettura = true; assert.equal(h.render(), null)
})
test('mapper preserva ID autorevole prima della sostituzione del nome', () => {
  const p = path.join(root, 'app/components/VariantiCantierePanel.tsx')
  const s = fs.readFileSync(p, 'utf8')
  assert(s.includes("operaioId: r.origine === 'rapportino' && typeof operativo.operaio === 'string' ? operativo.operaio : null"))
  assert(s.includes('operativo = operativoPrestazioneAcquisita(r, cantiereId)'))
  assert(s.includes("supabase.from('operai').select('id,nome').in('id', operai)"))
})
test('layout adattabile: campi e comandi non impongono larghezze desktop', () => {
  const h = harness(), row = h.row(rows[0].id)
  assert.equal(row.props.style.minWidth, 0)
  assert.equal(h.input(rows[0].id).props.style.maxWidth, '100%')
  const label = nodes(row).find(n => n.type === 'label')
  assert.equal(label.props.style.flexWrap, 'wrap')
})

module.exports = { rows, R }
