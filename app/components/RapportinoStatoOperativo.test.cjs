/* eslint-disable @typescript-eslint/no-require-imports -- Offline component and RPC fixture. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, 'RapportinoStatoOperativo.tsx'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
const children = node => Array.isArray(node) ? node.flatMap(children) : node?.props ? [node, ...children(node.props.children)] : []
const text = node => Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : String(node ?? '')
const flush = () => new Promise(resolve => setImmediate(resolve))

function fixture() {
  const slots = [], effectSlots = [], reads = [], writes = []
  let cursor = 0, effectCursor = 0
  let server = { stato: 'bozza', revisione_stato: '0', revisione_documento: '3' }
  let conflict = false
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
    },
    useEffect(fn, deps) {
      const index = effectCursor++
      const previous = effectSlots[index]
      if (previous?.deps.every((dep, i) => Object.is(dep, deps[i]))) return
      previous?.cleanup?.()
      effectSlots[index] = { deps, cleanup: fn() }
    },
  }
  const supabase = { rpc(name, args) {
    if (name === 'leggi_stato_operativo_rapportino') {
      reads.push(args)
      return { abortSignal: async () => ({ data: server }) }
    }
    assert.equal(name, 'cambia_stato_operativo_rapportino')
    writes.push(args)
    if (conflict) return Promise.resolve({ error: { code: 'PR412' } })
    server = { ...server, stato: args.p_stato, revisione_stato: String(Number(server.revisione_stato) + 1) }
    return Promise.resolve({ data: server })
  } }
  const exports = {}
  const jsx = (type, props) => ({ type, props })
  vm.runInNewContext(compiled, { exports, AbortController, require(name) {
    if (name === 'react') return react
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (name.endsWith('supabaseClient')) return { supabase }
    if (name.endsWith('materialiBozzaV1')) return { deltaMaterialiBozza: bozza => bozza.delta }
    throw new Error(name)
  } })
  const render = (props = {}) => {
    cursor = 0
    effectCursor = 0
    return exports.default({ id: 'rapporto', cantiereId: 'cantiere', revisioneDocumento: 3, disabilitato: false, onBusy() {}, ...props })
  }
  return { render, reads, writes, dirty: exports.rapportinoConModificheLocali,
    remoteConflict() { conflict = true; server = { stato: 'chiuso', revisione_stato: '1', revisione_documento: '4' } } }
}
const button = tree => children(tree).find(node => node.type === 'button')

test('modifiche locali a documento, prestazioni o materiali disabilitano la transizione', async () => {
  const h = fixture()
  const documento = { note: '', materiali: '', quantita_materiali: '' }
  const bozza = { baseline: { documento }, documento, prestazioni: { nuove: [], aggiornate: [], rimosse: [] } }
  assert.equal(h.dirty(bozza), false)
  assert.equal(h.dirty({ ...bozza, documento: { ...documento, note: 'modifica' } }), true)
  assert.equal(h.dirty({ ...bozza, prestazioni: { ...bozza.prestazioni, rimosse: ['a'] } }), true)
  assert.equal(h.dirty({ ...bozza, materialiStrutturati: { versione_materiali: 1 }, delta: { nuove: [{}] } }), true)
  h.render()
  await flush()
  for (const props of [{ modificheLocali: true }, { disabilitato: true }]) {
    const action = button(h.render(props))
    assert.equal(action.props.disabled, true)
    action.props.onClick()
  }
  assert.equal(h.writes.length, 0)
})

test('Chiudi e Riapri usano la revisione confermata, senza cambiare revisione documento', async () => {
  const h = fixture()
  h.render()
  await flush()
  assert.equal(text(button(h.render())).trim(), 'Chiudi rapportino')
  button(h.render()).props.onClick()
  await flush()
  assert.equal(text(button(h.render())).trim(), 'Riapri rapportino')
  button(h.render()).props.onClick()
  await flush()
  assert.equal(text(button(h.render())).trim(), 'Chiudi rapportino')
  assert.deepEqual(h.writes.map(x => [x.p_stato, x.p_revisione_stato, x.p_revisione_documento]), [
    ['chiuso', '0', '3'], ['bozza', '1', '3'],
  ])
})

test('PR412 rilegge solo lo stato e blocca una transizione su documento obsoleto', async () => {
  const h = fixture()
  h.render()
  await flush()
  h.remoteConflict()
  button(h.render()).props.onClick()
  await flush()
  assert.match(text(h.render()), /Conflitto/)
  await flush()
  const tree = h.render()
  assert.equal(text(button(tree)).trim(), 'Riapri rapportino')
  assert.equal(button(tree).props.disabled, true)
  assert.match(text(tree), /Le modifiche locali restano nell’editor/)
  assert.equal(h.reads.length, 2)
  assert.equal(h.writes.length, 1)
})
