/* eslint-disable @typescript-eslint/no-require-imports -- Offline UI navigation, no Supabase or provider imports. */
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), cp = require('node:child_process')
const source = name => fs.readFileSync(path.join(__dirname, name), 'utf8')
const compile = s => ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
const nodes = x => x == null ? [] : Array.isArray(x) ? x.flatMap(nodes) : typeof x === 'object' ? [x, ...nodes(x.props?.children)] : []
const text = x => x == null ? '' : Array.isArray(x) ? x.map(text).join('') : typeof x === 'object' ? text(x.props?.children) : String(x)
const jsx = (type, props) => ({ type, props })
function mount(props = {}) {
  const slots = []; let cursor = 0, effects = []
  const react = {
    useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init; return [slots[i], v => slots[i] = typeof v === 'function' ? v(slots[i]) : v] },
    useRef(init) { const i = cursor++; return slots[i] ?? (slots[i] = { current: init }) },
    useCallback(fn) { cursor++; return fn },
    useEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) { old?.cleanup?.(); const next = { deps }; slots[i] = next; effects.push(() => next.cleanup = fn()) } },
  }
  const children = new Map(), modules = {}, portalCalls = []
  function load(file) {
    const exports = {}; vm.runInNewContext(compile(source(file)), { exports, require(id) {
      if (id === 'react') return react
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (id === 'react-dom') return { createPortal(content, target) { portalCalls.push(target); return content } }
      if (id === './VistaOperativa') return modules.focus
      if (!children.has(id)) children.set(id, () => null)
      return { default: children.get(id) }
    } }); return exports
  }
  modules.focus = load('VistaOperativa.tsx'); const panel = load('SopralluoghiPanel.tsx'), header = load('SopralluogoDettaglioHeader.tsx')
  const p = { sopralluogoModificaId: null, sopralluoghi: [{ id: 'collegato' }], buttonPrimary: {}, buttonSecondary: {}, ...props }
  const render = () => { cursor = 0; const tree = panel.default(p), pending = effects; effects = []; pending.forEach(fn => fn()); return tree }
  const findChild = (tree, name) => nodes(tree).find(n => n.type === children.get('./' + name))
  const focus = tree => nodes(tree).find(n => n.type === modules.focus.default)
  const open = () => { const list = findChild(render(), 'SopralluoghiList'); nodes(list.props.azioneNuovo).find(n => n.type === 'button').props.onClick(); return render() }
  const edit = sopralluogo => {
    const propsHeader = { sopralluogoAperto: sopralluogo, buttonPrimary: {}, buttonSecondary: {}, coloreStatoSopralluogo: () => '#fff', setSopralluogoAperto: v => p.sopralluogoAperto = v }
    for (const name of ['SopralluogoModificaId', 'ClienteSopralluogo', 'TelefonoSopralluogo', 'IndirizzoSopralluogo', 'DataSopralluogo', 'OraSopralluogo', 'TipoLavoroSopralluogo', 'NoteSopralluogo', 'PromemoriaSopralluogo', 'GeolocalizzazioneSopralluogo']) propsHeader['set' + name] = v => p[name[0].toLowerCase() + name.slice(1)] = v
    const tree = header.default(propsHeader)
    nodes(tree).find(n => n.type === 'button' && text(n).includes('Modifica sopralluogo')).props.onClick()
    render(); return render()
  }
  return { props: p, render, open, edit, focus, findChild, focusComponent: modules.focus.default, portalCalls, resetCursor() { cursor = 0 }, flush() { const pending = effects; effects = []; pending.forEach(fn => fn()) } }
}

test('click Nuovo sopralluogo apre VistaOperativa con ritorno corretto e stesso form', () => {
  const m = mount({ salvaSopralluogo() { assert.fail('Nessuna scrittura all’ingresso') } }), tree = m.open(), focus = m.focus(tree)
  assert(focus); assert.equal(focus.props.attiva, true)
  assert.equal(focus.props.titolo, 'Nuovo sopralluogo'); assert.equal(focus.props.etichettaRitorno, '← Torna ai sopralluoghi')
  assert(m.findChild(focus, 'SopralluogoForm'))
  assert.strictEqual(m.findChild(focus, 'SopralluogoForm').props.salvaSopralluogo, m.props.salvaSopralluogo)
})

test('ritorno generale conserva lista, filtri del componente montato e campi locali', () => {
  const m = mount({ clienteSopralluogo: 'Bozza locale', mostraElencoSopralluoghi: true })
  const before = m.findChild(m.render(), 'SopralluoghiList'), active = m.focus(m.open())
  active.props.onChiudi(); const returned = m.render(), after = m.findChild(returned, 'SopralluoghiList')
  assert.equal(m.focus(returned), undefined); assert.strictEqual(after.type, before.type)
  assert.strictEqual(after.props.sopralluoghi, before.props.sopralluoghi); assert.equal(after.props.mostraElencoSopralluoghi, true)
  assert.equal(m.findChild(m.focus(m.open()), 'SopralluogoForm').props.clienteSopralluogo, 'Bozza locale')
})

test('contesto cantiere resta in memoria e il ritorno non esce dai sopralluoghi contestuali', () => {
  let back = 0; const context = { id: 'cantiere-id', nome: 'Cantiere corrente' }
  const m = mount({ contestoCantiere: context, tornaAlCantiere() { back++ } }), active = m.focus(m.open())
  assert.equal(active.props.contesto, context.nome); active.props.onChiudi()
  assert.strictEqual(m.props.contestoCantiere, context); assert.equal(back, 0)
  assert(nodes(m.render()).some(n => n.props?.['data-cantiere-id'] === context.id))
})

test('modifica in focus; dopo reset originale dell’id il form aperto torna alla modalità nuova', () => {
  const m = mount({ sopralluogoModificaId: 'esistente' }); m.render()
  assert.equal(m.focus(m.render()).props.titolo, 'Modifica sopralluogo')
  assert.equal(m.focus(m.render()).props.attiva, true)
  m.props.sopralluogoModificaId = null
  assert.equal(m.focus(m.render()).props.attiva, true)
  assert.equal(m.focus(m.render()).props.titolo, 'Nuovo sopralluogo')
})

test('salvataggio originale: callback identico, nessuna chiusura/reset aggiunta dal wrapper', async () => {
  let calls = 0; const save = async () => { calls++ }, m = mount({ salvaSopralluogo: save })
  const active = m.focus(m.open()), form = m.findChild(active, 'SopralluogoForm')
  assert.strictEqual(form.props.salvaSopralluogo, save); assert.equal(calls, 0)
  await form.props.salvaSopralluogo(); assert.equal(calls, 1)
  assert.equal(m.focus(m.render()).props.attiva, true)
})

test('nessuna nuova semantica Annulla: il form originale non lo prevede e la chiusura conserva i campi', () => {
  const m = mount({ clienteSopralluogo: 'Da conservare' }), active = m.focus(m.open())
  active.props.onChiudi(); m.open()
  assert.equal(m.findChild(m.focus(m.render()), 'SopralluogoForm').props.clienteSopralluogo, 'Da conservare')
  assert(!source('SopralluogoForm.tsx').includes('Annulla'))
})

test('VistaOperativa inattiva restituisce soltanto il contenuto; default Varianti invariato', () => {
  const m = mount(), child = { type: 'form', props: {} }
  m.resetCursor(); assert.strictEqual(m.focusComponent({ attiva: false, titolo: 'Modifica', onChiudi() {}, children: child }), child)
  m.resetCursor(); const normal = m.focusComponent({ titolo: 'Nuova variante', onChiudi() {}, children: child })
  assert(text(normal).includes('← Torna al cantiere'))
  m.resetCursor(); const scoped = m.focusComponent({ titolo: 'Nuovo sopralluogo', etichettaRitorno: '← Torna ai sopralluoghi', onChiudi() {}, children: child })
  assert(text(scoped).includes('← Torna ai sopralluoghi'))
  assert(text(scoped).includes('display: none !important')); assert.equal(scoped.props.style.width, '100%')
})

test('responsive condiviso dal form sopralluogo; salvataggio, Varianti, Quaderno e DB non modificati', () => {
  const current = source('SopralluoghiPanel.tsx'), old = cp.execFileSync('git', ['show', 'HEAD:app/components/SopralluoghiPanel.tsx'], { encoding: 'utf8' })
  const sf = s => ts.createSourceFile('panel.tsx', s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const form = s => { const file = sf(s); let result; const visit = n => { if (ts.isJsxSelfClosingElement(n) && n.tagName.getText(file) === 'SopralluogoForm') result = n.getText(file).replace(/\r\n/g, '\n'); ts.forEachChild(n, visit) }; visit(file); return result }
  assert.equal(form(current), form(old)); assert(current.includes('min-width: 0; max-width: 100%; box-sizing: border-box;'))
  cp.execFileSync('git', ['diff', '--exit-code', '--', 'app/page.tsx', 'app/components/SopralluogoForm.tsx', 'app/components/VariantiCantierePanel.tsx', 'app/components/SopralluogoAppunti.tsx', 'app/engines', 'supabase', 'lib'])
})

const sopralluogoEsistente = { id: 'esistente', cliente: 'Cliente esistente', telefono: '123', indirizzo: 'Via di prova', data_sopralluogo: '2026-10-30', ora_appuntamento: '09:00', tipo_lavoro: 'Verifica', note: 'Nota originale', promemoria: 'Chiamare', geolocalizzazione: 'Posizione', stato: 'da_preventivare' }
test('azione reale Modifica sopralluogo precompila lo stesso form e apre focus senza scrivere', () => {
  let writes = 0; const m = mount({ salvaSopralluogo() { writes++ } }), view = m.focus(m.edit(sopralluogoEsistente))
  assert.equal(view.props.attiva, true); assert.equal(view.props.titolo, 'Modifica sopralluogo')
  assert.equal(view.props.etichettaRitorno, '← Torna ai sopralluoghi')
  const form = m.findChild(view, 'SopralluogoForm')
  assert.equal(form.props.clienteSopralluogo, sopralluogoEsistente.cliente)
  assert.equal(form.props.noteSopralluogo, sopralluogoEsistente.note)
  assert.equal(form.props.oraSopralluogo, '09:00')
  assert.equal(m.props.sopralluogoModificaId, 'esistente'); assert.equal(m.props.sopralluogoAperto, null)
  assert.strictEqual(form.props.salvaSopralluogo, m.props.salvaSopralluogo); assert.equal(writes, 0)
})
test('Torna dalla modifica generale chiude solo focus: lista, ID e campi non salvati restano', () => {
  const ultimo = { id: 'esistente' }, m = mount({ ultimoSopralluogo: ultimo, mostraElencoSopralluoghi: true })
  const list = m.findChild(m.render(), 'SopralluoghiList')
  const view = m.focus(m.edit(sopralluogoEsistente)); m.props.clienteSopralluogo = 'Modifica locale non salvata'
  view.props.onChiudi(); const tree = m.render(), restored = m.findChild(tree, 'SopralluoghiList')
  assert.equal(m.focus(tree), undefined); assert.strictEqual(restored.type, list.type)
  assert.strictEqual(restored.props.sopralluoghi, list.props.sopralluoghi); assert.equal(restored.props.mostraElencoSopralluoghi, true)
  assert.equal(m.props.sopralluogoModificaId, 'esistente'); assert.equal(m.props.clienteSopralluogo, 'Modifica locale non salvata')
  assert.strictEqual(m.props.ultimoSopralluogo, ultimo)
})
test('Torna dalla modifica contestuale conserva UUID e callback Torna al cantiere', () => {
  let back = 0; const context = { id: 'cantiere-id', nome: 'Cantiere corrente' }, ritorno = () => back++
  const m = mount({ contestoCantiere: context, tornaAlCantiere: ritorno })
  const view = m.focus(m.edit(sopralluogoEsistente)); assert.equal(view.props.contesto, context.nome)
  view.props.onChiudi(); const tree = m.render()
  assert(nodes(tree).some(n => n.props?.['data-cantiere-id'] === context.id))
  const button = nodes(tree).find(n => n.type === 'button' && text(n) === '← Torna al cantiere')
  assert.strictEqual(button.props.onClick, ritorno); assert.equal(back, 0); button.props.onClick(); assert.equal(back, 1)
})
test('Salva modifica usa il callback originale; dopo successo resta aperto col reset già previsto', async () => {
  let calls = 0; const m = mount({ salvaSopralluogo: async () => { calls++; m.props.sopralluogoModificaId = null; m.props.clienteSopralluogo = '' } })
  const view = m.focus(m.edit(sopralluogoEsistente)), form = m.findChild(view, 'SopralluogoForm')
  assert.strictEqual(form.props.salvaSopralluogo, m.props.salvaSopralluogo)
  await form.props.salvaSopralluogo(); assert.equal(calls, 1)
  assert.equal(m.focus(m.render()).props.attiva, true); assert.equal(m.focus(m.render()).props.titolo, 'Nuovo sopralluogo')
})
test('nessun Annulla o blocco uscita inventato; ingresso, form e salvataggio invariati', () => {
  assert(!source('SopralluogoForm.tsx').includes('Annulla'))
  assert(!source('SopralluoghiPanel.tsx').includes('beforeunload'))
  cp.execFileSync('git', ['diff', '--exit-code', '--', 'app/page.tsx', 'app/components/SopralluogoForm.tsx', 'app/components/SopralluogoDettaglioHeader.tsx', 'app/components/VistaOperativa.tsx'])
})
