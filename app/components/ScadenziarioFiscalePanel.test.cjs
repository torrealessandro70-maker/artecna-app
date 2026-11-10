/* eslint-disable @typescript-eslint/no-require-imports -- Stateful UI harness with synthetic local data; IO forbidden. */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const jsx = (type, props) => ({ type, props })
const nodes = x => x == null ? [] : Array.isArray(x) ? x.flatMap(nodes) : typeof x === 'object' ? [x, ...nodes(x.props?.children)] : []
const text = x => x == null ? '' : Array.isArray(x) ? x.map(text).join('') : typeof x === 'object' ? text(x.props?.children) : String(x)
const expand = x => Array.isArray(x) ? x.map(expand) : x && typeof x === 'object' ? typeof x.type === 'function' ? expand(x.type(x.props)) : { ...x, props: { ...x.props, children: expand(x.props?.children) } } : x
const button = (tree, label) => nodes(tree).find(n => n.type === 'button' && text(n) === label)
const field = (tree, label) => { const l = nodes(tree).find(n => n.type === 'label' && text(n) === label); assert(l, label); return nodes(tree).find(n => n.props?.id === l.props.htmlFor) }
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-11-10T12:00:00Z'])) } }
function model(persistenza) {
  const slots = []; let cursor = 0
  const react = {
    useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v }] },
    useRef(value) { const i = cursor++; return slots[i] ?? (slots[i] = { current: value }) }, useMemo(fn) { cursor++; return fn() }, useId() { return `test-${cursor++}` },
    useEffect() { cursor++ },
  }
  const cache = new Map()
  function load(file) {
    const full = path.resolve(__dirname, file); if (cache.has(full)) return cache.get(full)
    const exports = {}; cache.set(full, exports)
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, Error, Date: FixedDate, crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' }, require(id) {
      if (id === 'react') return react
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (id === './VistaOperativa') return { default: 'VistaOperativa' }
      if (id.endsWith('.module.css')) return { default: {} }
      const candidate = path.resolve(path.dirname(full), id)
      return load(path.relative(__dirname, candidate + (fs.existsSync(candidate + '.tsx') ? '.tsx' : '.ts')))
    } }, { filename: full })
    return exports
  }
  const Component = load('ScadenziarioFiscalePanel.tsx').default
  const m = { render() { cursor = 0; return expand(Component(persistenza ? { persistenza } : undefined)) }, click(label) { const b = button(m.render(), label); assert(b, label); assert(!b.props.disabled); b.props.onClick() }, fill(label, value) { field(m.render(), label).props.onChange({ target: { value } }) }, submit() { nodes(m.render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }) } }
  m.open = () => m.click('Apri scadenziario locale')
  m.new = () => m.click('Nuova scadenza locale')
  m.complete = (extra = {}) => { m.fill('Periodo di riferimento', extra.periodo || 'T4 fixture'); m.fill('Data scadenza', extra.data || '2026-12-01'); m.fill('Importo previsto (€) — vuoto se da verificare', extra.importo ?? '100,25'); m.submit() }
  return m
}
const operation = tree => nodes(tree).find(n => n.type === 'VistaOperativa')
const rows = tree => nodes(tree).filter(n => n.type === 'tr' && nodes(n).some(e => e.type === 'details'))
test('empty compact summary exposes all required KPIs and memory-only limitation', () => {
  const m = model(), tree = m.render(); assert.equal(operation(tree), undefined)
  for (const label of ['Prossima scadenza aperta', 'Previsto entro 30 giorni', 'Previsto entro 60 giorni', 'Previsto entro 90 giorni', 'Scadenze aperte', 'Bozza locale non salvata.']) assert(text(tree).includes(label))
  assert(text(tree).includes('si perdono')); assert(!text(tree).includes('IVA da versare'))
})
test('existing VistaOperativa opens without IO, empty state does not certify no obligations', () => {
  const m = model(); m.open(); assert.equal(operation(m.render()).props.titolo, 'Scadenziario fiscale e contributivo')
  assert(text(m.render()).includes('non certifica l’assenza di obblighi'))
})
test('new form has all types/states, no default deadline or invented amount', () => {
  const m = model(); m.open(); m.new(); const tree = m.render()
  assert.equal(field(tree, 'Data scadenza').props.value, ''); assert.equal(field(tree, 'Importo previsto (€) — vuoto se da verificare').props.value, '')
  assert.equal(field(tree, 'Stato').props.value, 'Da verificare')
  for (const value of ['IVA', 'INPS', 'INAIL', 'IRPEF', 'Ritenute', 'F24', 'Altro', 'Previsto', 'Da verificare', 'Da pagare', 'Pagato']) assert(nodes(tree).some(n => n.type === 'option' && text(n) === value))
  assert(field(tree, 'Nota')); assert(field(tree, 'Riferimento / documento (solo testo)'))
})
test('explicit manual entry updates summary, keeps details individual and closed', () => {
  const m = model(); m.open(); m.new(); m.complete()
  assert.equal(rows(m.render()).length, 1); assert.equal(nodes(m.render()).filter(n => n.type === 'form').length, 0)
  assert(text(m.render()).includes('100,25 €')); assert(text(m.render()).includes('Nessun pagamento registrato'))
  for (const d of nodes(m.render()).filter(n => n.type === 'details')) assert.equal(d.props.open, undefined)
})
test('unknown amount remains verifiable rather than zero; partial totals are labelled', () => {
  const m = model(); m.open(); m.new(); m.complete({ importo: '' })
  assert(text(m.render()).includes('Parziale: 1 importi mancanti')); assert(text(rows(m.render())[0]).includes('Da verificare'))
})
test('F24 initially excluded from totals, remains open, can explicitly opt in', () => {
  const m = model(); m.open(); m.new(); m.fill('Tipo', 'F24')
  const checkbox = nodes(m.render()).find(n => n.type === 'input' && n.props.type === 'checkbox'); assert.equal(checkbox.props.checked, false)
  m.complete({ importo: '300' }); assert(text(m.render()).includes('1 voci riepilogative escluse'))
  m.click('Modifica bozza F24 · 2026-12-01')
  nodes(m.render()).find(n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: true } }); m.submit()
  assert.equal(rows(m.render()).length, 1); assert(!text(m.render()).includes('1 voci riepilogative escluse'))
})
test('custom contribution and document reference retained as escaped text, no upload/link', () => {
  const m = model(); m.open(); m.new(); m.fill('Tipo', 'Altro'); m.fill('Altro tributo / contributo', 'Cassa edile')
  m.fill('Nota', 'Verificare documento fixture'); m.fill('Riferimento / documento (solo testo)', 'F24 fixture 01'); m.complete()
  assert(text(rows(m.render())[0]).includes('Cassa edile')); assert(text(rows(m.render())[0]).includes('F24 fixture 01'))
  assert(!nodes(m.render()).some(n => n.type === 'a' || (n.type === 'input' && n.props.type === 'file')))
})
test('edit to Pagato removes open total without recording payment or duplicating rows', () => {
  const m = model(); m.open(); m.new(); m.complete(); m.click('Modifica bozza IVA · 2026-12-01'); m.fill('Stato', 'Pagato')
  const confirm = nodes(m.render()).find(n => n.type === 'label' && text(n) === 'Confermo esplicitamente che l’obbligo è chiuso')
  nodes(confirm).find(n => n.type === 'input').props.onChange({ target: { checked: true } }); m.submit()
  assert.equal(rows(m.render()).length, 0)
  nodes(m.render()).find(n => n.type === 'select' && n.props['aria-label'] === 'Filtro scadenze').props.onChange({ target: { value: 'Pagate' } })
  assert.equal(rows(m.render()).length, 1); assert(text(rows(m.render())[0]).includes('Pagato'))
  assert(text(m.render()).includes('0 · di cui 0 oltre data')); assert(text(m.render()).includes('Nessun pagamento registrato'))
})
test('closing/reopening operational view preserves rows and unfinished form while parent mounted', () => {
  const m = model(); m.open(); m.new(); m.complete(); m.new(); m.fill('Nota', 'Appunto non salvato')
  operation(m.render()).props.onChiudi(); assert.equal(operation(m.render()), undefined)
  m.open(); assert.equal(rows(m.render()).length, 1); assert.equal(field(m.render(), 'Nota').props.value, 'Appunto non salvato')
})
test('cancel discards draft without adding a row; fresh mount has no persistence', () => {
  const m = model(); m.open(); m.new(); m.fill('Nota', 'Appunto'); m.click('Annulla'); assert.equal(rows(m.render()).length, 0)
  m.new(); m.complete(); const fresh = model(); fresh.open(); assert.equal(rows(fresh.render()).length, 0)
})
test('invalid dates/amounts and duplicate records show error without mutating rows', () => {
  const m = model(); m.open(); m.new(); m.complete({ importo: '-2' }); assert.equal(rows(m.render()).length, 0)
  assert(nodes(m.render()).some(n => n.props?.role === 'alert'))
  m.fill('Importo previsto (€) — vuoto se da verificare', '100'); m.submit(); m.new(); m.complete(); assert.equal(rows(m.render()).length, 1)
  assert(text(m.render()).includes('già presente'))
})
test('consultation date changes local windows only; invalid date ignored', () => {
  const m = model(); m.open(); m.new(); m.complete()
  const consult = () => nodes(m.render()).find(n => n.type === 'input' && n.props.type === 'date' && !n.props.id)
  consult().props.onChange({ target: { value: '2026-02-30' } }); assert.equal(consult().props.value, '2026-11-10')
  consult().props.onChange({ target: { value: '2026-12-02' } }); assert(text(m.render()).includes('1 · di cui 1 oltre data'))
})
test('new modules have no database, browser persistence, file or network operations', () => {
  for (const file of ['ScadenziarioFiscalePanel.tsx', '../engines/contabilita-ditta/scadenziario.ts']) {
    const code = fs.readFileSync(path.join(__dirname, file), 'utf8')
    assert(!/supabase|localStorage|sessionStorage|indexedDB|\bfetch\s*\(|\.rpc\s*\(|\.from\s*\(|\.upload\s*\(|navigator\./.test(code))
  }
  assert(fs.readFileSync(path.join(__dirname, 'EconomiaGeneralePanel.tsx'), 'utf8').includes('<ScadenziarioPersistentePanel client={client} aperto='))
})

test('persistent mode never shows zero KPIs or enables writers after unavailable reader', () => {
  const p = { righe: [], pronta: false, occupata: false, errore: 'Accesso non disponibile', onRileggi() {}, onSalva() { throw Error('forbidden') }, onArchivia() { throw Error('forbidden') } }
  const m = model(p); assert(!text(m.render()).includes('0,00 €')); assert(text(m.render()).includes('Accesso non disponibile'))
  m.open(); assert(button(m.render(), 'Nuova scadenza').props.disabled); assert(text(m.render()).includes('nessun fallback'))
})
test('persistent create keeps stable UUID, blocks double-submit, closes form only after acknowledgment', async () => {
  let resolve, calls = 0
  const p = { righe: [], pronta: true, occupata: false, errore: '', onRileggi() {}, onSalva(r) { calls++; return new Promise(done => { resolve = () => { p.righe.push(r); done() } }) }, async onArchivia() {} }
  const m = model(p); m.open(); m.click('Nuova scadenza'); m.fill('Periodo di riferimento', 'fixture'); m.fill('Data scadenza', '2026-12-01')
  m.submit(); m.submit(); assert.equal(calls, 1); assert.equal(rows(m.render()).length, 0); assert(nodes(m.render()).some(n => n.type === 'form'))
  resolve(); await new Promise(done => setImmediate(done)); assert.equal(rows(m.render()).length, 1); assert(text(m.render()).includes('Scadenza salvata nell’archivio'))
})

const filtroUi=(m,value)=>nodes(m.render()).find(n=>n.type==='select'&&n.props['aria-label']==='Filtro scadenze').props.onChange({target:{value}})
const tick=()=>new Promise(resolve=>setImmediate(resolve))
test('payment modal has known default, date today, full save closes and updates paid filter without side effects',async()=>{
  const m=model();m.open();m.new();m.complete({importo:'100'});m.click('Segna pagato')
  assert(nodes(m.render()).some(n=>n.type==='dialog'));assert.equal(field(m.render(),'Importo pagato (€)').props.value,'100.00');assert.equal(field(m.render(),'Data pagamento').props.value,'2026-11-10')
  m.submit();await tick();assert(!nodes(m.render()).some(n=>n.type==='dialog'));assert.equal(rows(m.render()).length,0);filtroUi(m,'Pagate');assert.equal(rows(m.render()).length,1);assert(text(m.render()).includes('Pagato: 100,00 €'));assert(text(m.render()).includes('Nessun pagamento o movimento economico generato'))
})
test('partial payment remains open and details show exact paid/residual values',async()=>{
  const m=model();m.open();m.new();m.complete({importo:'100'});m.click('Segna pagato');m.fill('Importo pagato (€)','40');m.submit();await tick()
  assert.equal(rows(m.render()).length,1);assert(text(rows(m.render())[0]).includes('Da pagare'));assert(text(rows(m.render())[0]).includes('Pagato: 40,00 € | Residuo: 60,00 €'))
})
test('unknown planned amount stays blank, residual indeterminate, cancellation writes nothing',()=>{
  const m=model();m.open();m.new();m.complete({importo:''});m.click('Segna pagato');assert.equal(field(m.render(),'Importo pagato (€)').props.value,'');assert(text(m.render()).includes('Residuo: Da verificare'));m.click('Annulla pagamento');assert.equal(rows(m.render()).length,1);assert(!nodes(m.render()).some(n=>n.type==='dialog'))
})
test('paid status in general form requires explicit closure confirmation',()=>{
  const m=model();m.open();m.new();m.fill('Stato','Pagato');m.complete();assert.equal(rows(m.render()).length,0);assert(text(m.render()).includes('Confermare esplicitamente'))
})
test('operational rows have five compact columns, individual closed details and neutral deadline evidence',()=>{
  const m=model();m.open();m.new();m.complete({data:'2026-11-10'});const tree=m.render();assert.equal(nodes(tree).filter(n=>n.type==='th'&&n.props.scope==='col').length,5);assert(text(tree).includes('Oggi'));assert(text(tree).includes('Totale scaduto'));assert(nodes(tree).filter(n=>n.type==='details').every(n=>n.props.open===undefined));filtroUi(m,'Archiviate');assert.equal(rows(m.render()).length,0)
})
test('F24 displays explicit duplicate warning and defaults excluded',()=>{
  const m=model();m.open();m.new();m.fill('Tipo','F24');assert(text(m.render()).includes('Escluso dai totali per evitare possibili duplicazioni'));assert.equal(nodes(m.render()).find(n=>n.type==='input'&&n.props.type==='checkbox').props.checked,false)
})
test('archive requires separate confirmation with reason and retains revision at dialog opening',async()=>{
  let writes=0,observed;const r={id:'x',tipo:'IVA',periodo:'T4',dataScadenza:'2026-12-01',importoCentesimi:100,stato:'Pagato',nota:'',riferimento:'',includiNeiTotali:true,revisione:'3'}
  const p={righe:[r],pronta:true,occupata:false,errore:'',onRileggi(){},async onSalva(){throw Error('forbidden')},async onArchivia(...args){writes++;observed=args;p.righe=[];p.archiviate=[{...r,archiviataAt:'date'}]}}
  const m=model(p);m.open();filtroUi(m,'Pagate');m.click('Archivia scadenza IVA · 2026-12-01');assert.equal(writes,0)
  const input=nodes(m.render()).find(n=>n.type==='input'&&n.props.maxLength===2000);input.props.onChange({target:{value:'Conclusa'}});m.submit();await tick();assert.equal(writes,1);assert.deepEqual(observed,['x','Conclusa','3']);assert.equal(rows(m.render()).length,0);filtroUi(m,'Archiviate');assert.equal(rows(m.render()).length,1);assert(text(m.render()).includes('Archiviata — stato conservato'))
})
