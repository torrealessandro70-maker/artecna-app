/* eslint-disable @typescript-eslint/no-require-imports -- Offline UI harness, no real database writes. */
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const nodes = x => x == null ? [] : Array.isArray(x) ? x.flatMap(nodes) : typeof x === 'object' ? [x, ...nodes(x.props?.children)] : []
const text = x => x == null ? '' : Array.isArray(x) ? x.map(text).join('') : typeof x === 'object' ? text(x.props?.children) : String(x)
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' }
function hooks() {
  const slots = []; let cursor = 0
  return { begin() { cursor = 0 }, api: {
    useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = init; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v }] },
    useRef(init) { const i = cursor++; return slots[i] ?? (slots[i] = { current: init }) },
  } }
}
const fixture = () => [
  { id: '0:2', foglio: 'Opere', riga: 2, codiceOriginale: 'A', prezzoDocumentale: 12.345, quantita: 4, testoOriginale: 'A | Opera completa | m² | 12.345', avvisi: [], form: { codice: 'A', descrizione: 'Opera completa', unita_misura: 'm²', prezzo_unitario: '12.345', categoria: '', zona: '', regione: '', note: '' } },
  { id: '0:3', foglio: 'Opere', riga: 3, codiceOriginale: 'B', testoOriginale: 'B | Opera incompleta', avvisi: [], form: { codice: 'B', descrizione: 'Opera incompleta', unita_misura: 'cad', prezzo_unitario: '', categoria: '', zona: '', regione: '', note: '' } },
  { id: '1:2', foglio: 'Impianti', riga: 2, codiceOriginale: 'C', prezzoDocumentale: 50, testoOriginale: 'C | Duplicato | cad | 50', avvisi: [], form: { codice: 'C', descrizione: 'Duplicato', unita_misura: 'cad', prezzo_unitario: '50', categoria: '', zona: '', regione: '', note: '' } },
]
function mount(options = {}) {
  const h = hooks(), reads = [], writes = [], confirms = [], busy = [], saved = []
  const db = {}, ex = {}, file = path.join(__dirname, 'ImportaPreventivoExcelListinoPanel.tsx')
  const compare = rows => rows.map(riga => ({ riga, errori: Number(riga.form.prezzo_unitario) > 0 ? [] : ['Prezzo mancante'], matches: riga.form.codice === 'C' ? [{ id: 'actual-C', codice: 'C', descrizione: 'Voce esistente', unita_misura: 'cad', prezzo_unitario: 60 }] : [], duplicatiFile: [] }))
  const mocks = {
    leggiPreventivoListino: async f => { reads.push(f.name); return { righe: fixture(), avvisi: [] } },
    confrontaPreventivoListino: compare, haConflittoPreventivo: p => p.matches.length > 0,
    codiceNuovaVocePreventivo: r => r.form.codice,
    importaPreventivoListino: async (...args) => { writes.push(args); return options.import ? options.import(...args) : { salvate: args[2].map(s => s.id) } },
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports: ex, window: { confirm: message => { confirms.push(message); return options.confirm ?? false } }, require: id => id === 'react' ? h.api : id === 'react/jsx-runtime' ? jsx : id === './VistaOperativa' ? { default: 'VistaOperativa' } : id.endsWith('/listino-manuale') ? { leggiListinoManuale: async () => { reads.push('listino'); return [] } } : mocks })
  const render = () => { h.begin(); return ex.default({ supabase: db, disabled: false, manodoperaDisponibile: false, onBusyChange: b => busy.push(b), onSaved: async count => { saved.push(count); if (options.refreshError) throw Error('refresh failed') } }) }
  return { render, reads, writes, confirms, busy, saved }
}
const button = (t, label) => { const b = nodes(t).find(n => n.type === 'button' && text(n) === label); assert(b, label); return b }
const field = (t, label) => { const f = nodes(t).find(n => n.props['aria-label'] === label); assert(f, label); return f }
function open(m) { button(m.render(), 'Importa da preventivo Excel').props.onClick(); return m.render() }
async function upload(m) { await field(open(m), 'Preventivo Excel per Listino').props.onChange({ target: { files: [{ name: 'attendibile.xlsx' }], value: 'x' } }); return m.render() }
const select = (m, label = 'Importa Opere riga 2') => { field(m.render(), label).props.onChange({ target: { checked: true } }); return m.render() }
test('separate entry opens isolated VistaOperativa and returns locally without reads or writes', () => {
  const m = mount(), t = open(m), vista = nodes(t).find(n => n.type === 'VistaOperativa')
  assert.equal(vista.props.titolo, 'Importa voci da preventivo Excel'); assert.equal(vista.props.etichettaRitorno, '← Torna al Listino ARTECNA')
  assert.equal(nodes(vista).filter(n => n.type === 'article').length, 0)
  vista.props.onChiudi(); assert(!nodes(m.render()).some(n => n.type === 'VistaOperativa')); assert.equal(m.reads.length, 0); assert.equal(m.writes.length, 0)
})
test('upload is read only, all rows visible, initial selection empty and incomplete/duplicate checkboxes disabled', async () => {
  const m = mount(), t = await upload(m)
  assert.equal(nodes(t).filter(n => n.type === 'article').length, 3)
  assert(text(t).includes('Voci lette: 3 · Selezionate: 0 · Da completare: 1 · Possibili duplicati: 1'))
  assert.equal(field(t, 'Importa Opere riga 3').props.disabled, true); assert.equal(field(t, 'Importa Impianti riga 2').props.disabled, true)
  assert.equal(field(t, 'Prezzo unitario € Opere riga 2').props.readOnly, true)
  assert.equal(field(t, 'Prezzo unitario € Opere riga 3').props.readOnly, false)
  assert.equal(m.writes.length, 0); assert.deepEqual(m.reads, ['attendibile.xlsx', 'listino']); assert.deepEqual(m.busy, [true, false])
})
test('select/deselect all only selects valid resolved rows; manual completion unlocks incomplete row', async () => {
  const m = mount(); let t = await upload(m)
  button(t, 'Seleziona tutto').props.onClick(); t = m.render(); assert(text(t).includes('Selezionate: 1'))
  button(t, 'Deseleziona tutto').props.onClick(); assert(text(m.render()).includes('Selezionate: 0'))
  field(m.render(), 'Prezzo unitario € Opere riga 3').props.onChange({ target: { value: '90' } }); t = m.render()
  assert.equal(field(t, 'Importa Opere riga 3').props.disabled, false); button(t, 'Seleziona tutto').props.onClick(); assert(text(m.render()).includes('Selezionate: 2'))
  assert.equal(m.writes.length, 0)
})
test('conflict defaults to skip, offers only add-new, never update; changing decision clears selection', async () => {
  const m = mount(); let t = await upload(m), f = field(t, 'Gestione conflitto Impianti riga 2')
  assert.equal(f.props.value, 'salta'); assert.equal(nodes(f).filter(n => n.type === 'option').length, 2); assert(!text(f).includes('Aggiorna'))
  f.props.onChange({ target: { value: 'nuova' } }); t = select(m, 'Importa Impianti riga 2'); assert(text(t).includes('Selezionate: 1'))
  field(t, 'Gestione conflitto Impianti riga 2').props.onChange({ target: { value: 'salta' } }); assert(text(m.render()).includes('Selezionate: 0')); assert.equal(m.writes.length, 0)
})
test('confirmation cancellation never invokes writer and retains preview + selection', async () => {
  const m = mount(); await upload(m); const t = select(m)
  await button(t, 'Importa voci selezionate').props.onClick()
  assert.deepEqual(m.confirms, ['Stai per aggiungere 1 voci al Listino ARTECNA. Continuare?']); assert.equal(m.writes.length, 0)
  assert(text(m.render()).includes('Selezionate: 1')); assert(nodes(m.render()).some(n => n.type === 'VistaOperativa'))
})
test('confirmed import sends only selected rows, refreshes Listino and returns after success', async () => {
  const m = mount({ confirm: true }); await upload(m); const t = select(m)
  await button(t, 'Importa voci selezionate').props.onClick()
  assert.equal(m.writes.length, 1); assert.equal(m.writes[0][2].length, 1); assert.equal(m.writes[0][2][0].id, '0:2'); assert.equal(m.writes[0][5], true)
  assert.deepEqual(m.saved, [1]); assert(!nodes(m.render()).some(n => n.type === 'VistaOperativa'))
})
test('partial failure removes acknowledged rows and blocks retry until fresh comparison', async () => {
  const m = mount({ confirm: true, import: async () => ({ salvate: ['0:2'], errore: 'network failure; rileggi' }) }); await upload(m)
  await button(select(m), 'Importa voci selezionate').props.onClick(); let t = m.render()
  assert.equal(nodes(t).filter(n => n.type === 'article').length, 2); assert.equal(button(t, 'Importa voci selezionate').props.disabled, true)
  assert.equal(button(t, 'Seleziona tutto').props.disabled, true); await button(t, 'Rileggi Listino e confronta di nuovo').props.onClick(); t = m.render()
  assert.equal(button(t, 'Seleziona tutto').props.disabled, false); assert.equal(m.writes.length, 1)
})
test('failed refresh cannot leave acknowledged rows available for duplicate import', async () => {
  const m = mount({ confirm: true, refreshError: true }); await upload(m)
  await button(select(m), 'Importa voci selezionate').props.onClick(); const t = m.render()
  assert(!nodes(t).some(n => n.props['aria-label'] === 'Importa Opere riga 2')); assert.equal(button(t, 'Importa voci selezionate').props.disabled, true)
})
test('busy lock prevents concurrent uploads and repeated confirmed writes', async () => {
  let finish
  const m = mount({ confirm: true, import: () => new Promise(resolve => { finish = resolve }) }); await upload(m)
  const b = button(select(m), 'Importa voci selezionate'), pending = b.props.onClick()
  await b.props.onClick(); assert.equal(m.writes.length, 1); assert.equal(m.confirms.length, 1)
  assert.equal(field(m.render(), 'Preventivo Excel per Listino').props.disabled, true)
  finish({ salvate: ['0:2'] }); await pending
})
test('mobile cards use wrapping grids and touch controls, parent keeps old Listino state mounted', async () => {
  const m = mount(), t = await upload(m), grid = field(t, 'Voci del preventivo Excel')
  assert.equal(grid.props.style.gridTemplateColumns, 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))')
  assert.equal(field(t, 'Descrizione Opere riga 2').props.rows, 4)
  for (const n of nodes(t).filter(n => n.type === 'article' || n.type === 'input' || n.type === 'textarea')) assert.equal(n.props.style.minWidth ?? 0, 0)
  assert(button(t, 'Importa voci selezionate').props.style.minHeight >= 44)
  const parent = fs.readFileSync(path.join(__dirname, 'ListinoArtecnaPanel.tsx'), 'utf8')
  assert(parent.includes('<ImportaFileArtecnaPanel')); assert(parent.includes('<ImportaPreventivoExcelListinoPanel'))
  assert(parent.includes('setRows(await leggiListinoManuale(supabase))')); assert(parent.includes('voci importate nel Listino ARTECNA'))
})
