/* eslint-disable @typescript-eslint/no-require-imports -- Offline UI regression, all services mocked. */
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), cp = require('node:child_process')
const root = path.resolve(__dirname, '../..'), read = f => fs.readFileSync(path.join(root, f), 'utf8')
const compile = s => ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
const jsx = (type, props) => ({ type, props })
const nodes = x => x == null ? [] : Array.isArray(x) ? x.flatMap(nodes) : typeof x === 'object' ? [x, ...nodes(x.props?.children)] : []
const text = x => x == null ? '' : Array.isArray(x) ? x.map(text).join('') : typeof x === 'object' ? text(x.props?.children) : String(x)
const button = (t, label) => nodes(t).find(n => n.type === 'button' && text(n) === label)
const tick = () => new Promise(setImmediate), cid = '11111111-1111-4111-8111-111111111111'
function load(file, mocks = {}, h = {}) {
  const exports = {}
  vm.runInNewContext(compile(read(file)), { exports, structuredClone, require(id) {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id === 'react') return h
    if (id in mocks) return mocks[id]
    return { default: id }
  } })
  return exports
}
function hooks() {
  const slots = []; let cursor = 0, effects = []
  const react = {
    useState(v) { const i = cursor++; if (!(i in slots)) slots[i] = typeof v === 'function' ? v() : v; return [slots[i], v => slots[i] = typeof v === 'function' ? v(slots[i]) : v] },
    useRef(v) { const i = cursor++; return slots[i] ?? (slots[i] = { current: v }) },
    useEffect(fn, deps) { const i = cursor++, prev = slots[i]; if (!prev || deps.some((v, j) => !Object.is(v, prev.deps[j]))) { slots[i] = { deps }; effects.push(() => { prev?.cleanup?.(); slots[i].cleanup = fn() }) } },
    useMemo(fn) { cursor++; return fn() },
  }
  return { react, render(fn) { cursor = 0; const t = fn(); const pending = effects; effects = []; pending.forEach(f => f()); return t } }
}
const credits = load('app/engines/fatture/note-credito.ts')
const acconti = load('app/engines/economia/accontiCantiere.ts')
const supplier = { quote: [{ tipo: 'economia', id: 'q1', costo: 1675.02 }], rettifiche: [], perimetro: 'Fixture offline' }
const money = n => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
const costView = load('app/components/CostiFornitoriRettificati.tsx', { '../engines/fatture/note-credito': credits }).CostiFornitoriVista

test('KPI fornitori riusa l’aggregazione originale e mostra gli stessi importi', () => {
  const before = JSON.stringify(supplier), t = costView({ dati: supplier, errore: '', compatta: true, soloKpi: true })
  assert(text(t).includes(money(1675.02))); assert(text(t).includes('Quote originali: ' + money(1675.02)))
  assert(text(t).includes('Rettifiche applicate: ' + money(0))); assert.equal(JSON.stringify(supplier), before)
  assert(!nodes(t).some(n => n.type === 'details'))
})
test('Costi: spiegazioni e fonti consultabili chiuse di default; UI legacy preservata', () => {
  const t = costView({ dati: supplier, errore: '', compatta: true })
  for (const label of ['Dettagli sul calcolo', 'Fonti originali e rettifiche']) {
    const d = nodes(t).find(n => n.type === 'details' && text(n).includes(label)); assert(d); assert(!d.props.open)
  }
  assert(text(costView({ dati: supplier, errore: '' })).includes('Costi fornitori assegnati e rettifiche'))
})
test('errore/caricamento dei costi non diventano falsamente zero', () => {
  for (const errore of ['', 'Fonte indisponibile']) {
    const t = costView({ dati: null, errore, compatta: true, soloKpi: true }); assert(!text(t).includes(money(0)))
    assert(nodes(t).some(n => n.props?.role === (errore ? 'alert' : 'status')))
  }
})

function dashboard() {
  const h = hooks(), writes = [], save = () => writes.push('save')
  const mocks = {
    './CostiFornitoriRettificati': { CostiFornitoriVista: costView, useCostiFornitori: () => ({ dati: supplier, errore: '' }) },
    '../engines/fatture/note-credito': credits,
    '../engines/economia/accontiCantiere': acconti,
    '../engines/economia/riepilogoEconomico': { leggiCostoQuoteFattura: async () => 1675.02, leggiScomposizioneVarianti: async () => ({ totale: 100, ordinarie: 100, manodopera: 0, materiali: 0 }), leggiMaterialiDaContabilizzare: async () => null, aggiungiCostoQuote: () => ({ materiali: 1675.02, costi: 2675.02 }) },
  }
  const Component = load('app/components/EconomiaCantierePanel.tsx', mocks, h.react).default
  const props = { cantiere: { id: cid, nome: 'Fixture' }, panelProps: { contrattoBase: { preventivoId: 'contratto', importo: 30000 }, periodo: { economiaDataDa: '', economiaDataA: '' }, riepilogo: { formatMoney: money, totaleMaterialiEconomia: 0, totaleCostiCantiere: 1000, totaleManodoperaCantiere: 1000, totaleAttrezziEconomia: 0 }, costi: { materialiCantiere: [] }, sal: { supabase: {}, salLavorazioni: [], salvaSalLavorazione: save }, acconti: { statoAcconti: 'caricato', accontiCantiere: [{ id: 'a', cantiere_id: cid, cantiere: 'Fixture', importo: 17665.02 }], salvaAcconto: save } } }
  const render = () => h.render(() => Component(props)), settle = async () => { let t; for (let i = 0; i < 4; i++) { t = render(); await tick() } return t }
  return { render, settle, props, writes }
}
test('dashboard mantiene acconti esatti in alto; solo la tab attiva rende il suo contenuto', async () => {
  const m = dashboard(); let t = await m.settle()
  assert(text(t).includes(money(17665.02))); assert.equal(button(t, 'Riepilogo').props['aria-pressed'], true)
  assert(!nodes(t).some(n => n.type === './AccontiEconomiaPanel')); assert(!nodes(t).some(n => n.type === './SalDettagliatoPanel'))
  button(t, 'Costi').props.onClick(); t = m.render()
  assert.equal(button(t, 'Costi').props['aria-pressed'], true)
  assert(nodes(t).some(n => n.type === costView && n.props.compatta && !n.props.soloKpi)); assert(!nodes(t).some(n => n.props?.['aria-label'] === 'Riepilogo economico'))
  button(t, 'SAL e acconti').props.onClick(); t = m.render()
  const panel = nodes(t).find(n => n.type === './AccontiEconomiaPanel')
  assert.equal(panel.props.totaleAccontiCantiere, 17665.02); assert.strictEqual(panel.props.salvaAcconto, m.props.panelProps.acconti.salvaAcconto)
  assert.strictEqual(nodes(t).find(n => n.type === './SalDettagliatoPanel').props.salvaSalLavorazione, m.props.panelProps.sal.salvaSalLavorazione)
  button(t, 'Rapportini').props.onClick(); t = m.render(); assert(nodes(t).some(n => n.type === './VariantiCantierePanel' && n.props.economiaRapportini))
  assert(!nodes(t).some(n => n.type === './AccontiEconomiaPanel')); assert.equal(m.writes.length, 0)
})

const raccolte = Array.from({ length: 6 }, (_, i) => ({ id: `00000000-0000-4000-8000-00000000000${i + 1}`, cantiere_id: cid, numero: i + 1, revisione: 2, stato: 'chiusa', titolo: `ARTECNA_Template_Import_Varianti_Extra_v${i + 2}.xlsx`, data: '2026-10-05', totale: [3268.2, 1200, 875.5, 500, 4312.4, 600][i], righe_non_valorizzate: 0 }))
function collectionMount({ operativo = true, empty = false, allowCreate = false } = {}) {
  const h = hooks(), reads = [], writes = [], opened = [], original = read('app/components/VariantiCantierePanel.tsx') + '\nexport { RaccolteEconomiaRegistrate };'
  const db = { rpc: async (name, args) => {
    if (name === 'leggi_raccolte_economia_cliente') { reads.push({ name, args }); return { data: empty ? [] : raccolte, error: null } }
    if (name === 'leggi_raccolta_economia_cliente') { reads.push({ name, args }); const r = raccolte.find(r => r.id === args.p_raccolta_id); return { data: { raccolta: r, totale: r.totale, righe_non_valorizzate: 0, righe: [{ id: '99999999-9999-4999-8999-999999999999', raccolta_id: r.id, ordine: 1, tipo_riga: 'generica', descrizione: 'Voce sintetica con descrizione lunga — nessuna scrittura', unita_misura: 'corpo', quantita: 1, prezzo_unitario: r.totale, totale: r.totale, note: null, origine: 'manuale' }] }, error: null } }
    if (name === 'crea_raccolta_economia' && allowCreate) { writes.push({ name, args }); return { data: { ...raccolte[0], stato: 'bozza', revisione: 0 }, error: null } }
    assert.fail('Unexpected RPC ' + name)
  } }
  const exports = {}; vm.runInNewContext(compile(original), { exports, structuredClone, require(id) { if (id === 'react') return h.react; if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }; if (id === '../../lib/supabaseClient') return { supabase: db }; if (id === '../engines/economia/precheckProposta') return { numeroRigaProposta: n => n === null ? null : Number(n) }; return { default: id } } })
  const props = { cantiereId: cid, aggiornamento: 0, varianti: [], elencoPronto: true, onApriVariante: id => opened.push(id), onCreata() {}, operativo }
  const render = () => h.render(() => exports.RaccolteEconomiaRegistrate(props)), settle = async () => { let t; for (let i = 0; i < 4; i++) { t = render(); await tick() } return t }
  return { props, render, settle, reads, writes, opened }
}
test('raccolte 1–6: card compatte con stessi numeri, date, revisioni e totali', async () => {
  const m = collectionMount(), t = await m.settle(), cards = nodes(t).filter(n => n.type === 'article')
  assert.equal(cards.length, 6)
  cards.forEach((c, i) => { assert(text(c).includes('Raccolta n. ' + (i + 1))); assert(text(c).includes('05/10/2026')); assert(text(c).includes('Rev. 2')); assert(text(c).includes(money(raccolte[i].totale))); assert(text(c).includes('0 righe non valorizzate')); assert.equal(c.props.style.padding, 12) })
  assert.equal(m.writes.length, 0)
})
test('Apri chiama il reader originale, focus operativo isolato, Torna conserva elenco e cantiere', async () => {
  const m = collectionMount(); let t = await m.settle(); await button(t, 'Apri').props.onClick(); t = await m.settle()
  const f = nodes(t).find(n => n.type === './VistaOperativa' && n.props.titolo !== 'Raccolte lavori in economia'); assert.equal(f.props.attiva, true); assert.equal(f.props.titolo, 'Raccolta n. 1 — Lavori in economia'); assert.equal(f.props.etichettaRitorno, '← Torna alle raccolte')
  assert.equal(m.reads.filter(r => r.name === 'leggi_raccolta_economia_cliente').length, 1)
  assert.equal(m.reads.at(-1).args.p_raccolta_id, raccolte[0].id)
  f.props.onChiudi(); t = m.render(); assert.equal(nodes(t).filter(n => n.type === 'article').length, 6); assert.equal(m.props.cantiereId, cid); assert.equal(m.writes.length, 0)
})
test('consultazione non operativa resta inline e callback proposta conserva lo stesso ID', async () => {
  for (const operativo of [false, true]) {
    const m = collectionMount({ operativo }); await button(await m.settle(), 'Apri').props.onClick(); const t = await m.settle(), f = nodes(t).find(n => n.type === './VistaOperativa' && n.props.titolo !== 'Raccolte lavori in economia')
    assert.equal(f.props.attiva, operativo)
    nodes(t).find(n => n.type === './UsaRaccoltaEconomiaInVariante').props.onApri('variante-originale'); assert.deepEqual(m.opened, ['variante-originale']); assert.equal(m.writes.length, 0)
  }
})
test('Crea nuova raccolta apre solo il form; Torna e Annulla non scrivono e conservano il titolo', async () => {
  const m = collectionMount({ empty: true }); button(await m.settle(), 'Crea nuova raccolta').props.onClick(); let t = m.render(), f = nodes(t).find(n => n.type === './VistaOperativa' && n.props.titolo !== 'Raccolte lavori in economia')
  assert.equal(f.props.titolo, 'Nuova raccolta lavori in economia'); assert.equal(f.props.etichettaRitorno, '← Torna a Economia')
  nodes(f).find(n => n.type === 'input').props.onChange({ target: { value: 'Titolo locale' } }); f.props.onChiudi(); t = m.render(); assert(!nodes(t).some(n => n.type === './VistaOperativa' && n.props.titolo !== 'Raccolte lavori in economia'))
  button(t, 'Crea nuova raccolta').props.onClick(); t = m.render(); assert.equal(nodes(t).find(n => n.type === 'input').props.value, 'Titolo locale')
  button(t, 'Annulla creazione').props.onClick(); assert.equal(m.writes.length, 0)
})
test('Conferma creazione conserva writer e payload originali esclusivamente in mock', async () => {
  const m = collectionMount({ empty: true, allowCreate: true }); button(await m.settle(), 'Crea nuova raccolta').props.onClick()
  await button(m.render(), 'Conferma creazione raccolta').props.onClick()
  assert.equal(m.writes.length, 1); assert.equal(m.writes[0].name, 'crea_raccolta_economia'); assert.equal(m.writes[0].args.p_cantiere_id, cid); assert.equal(m.writes[0].args.p_titolo, 'Lavori in economia — Rapportini'); assert.equal(m.writes[0].args.p_note, null)
})
test('formule, hook, reader e writer restano identici al parent', () => {
  const file = 'app/components/EconomiaCantierePanel.tsx', current = read(file).replace(/\r\n/g, '\n'), before = cp.execFileSync('git', ['show', 'HEAD:' + file], { encoding: 'utf8' }).replace(/\r\n/g, '\n')
  assert.equal(current.split('  return (')[0], before.split('  return (')[0])
  for (const file of ['app/components/VariantiCantierePanel.tsx','app/components/PrestazioniRapportiniEconomia.tsx']) {
    const extract = s => { s = s.replace(/\r\n/g, '\n'); const ast = ts.createSourceFile(file, s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), result = {}; function walk(n) { if (ts.isFunctionDeclaration(n) && n.name && n.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)) result[n.name.text + Object.keys(result).length] = n.getText(ast); ts.forEachChild(n, walk) } walk(ast); return result }
    assert.deepEqual(extract(read(file)), extract(cp.execFileSync('git', ['show', 'HEAD:' + file], { encoding: 'utf8' })))
  }
  // AccontiEconomiaPanel può evolvere nel layout; i callback sono certificati da GestioneAccontiFocus.
  for (const file of ['app/engines','supabase','lib','app/components/AccontiSalPanel.tsx','app/components/SalDettagliatoPanel.tsx','app/components/PrezziRapportiniEconomia.tsx','app/components/PrezziMaterialiEconomia.tsx']) assert.equal(cp.spawnSync('git', ['diff','--quiet','HEAD','--',file]).status, 0, file)
})
test('layout basato sul contenitore: KPI impilabili, tab a capo, dettagli operativi adattivi', () => {
  const s = read('app/components/EconomiaCantierePanel.tsx'), v = read('app/components/VariantiCantierePanel.tsx')
  assert(s.includes('minmax(min(100%, 220px), 1fr)')); assert(s.includes("flexWrap: 'wrap'")); assert(v.includes('@container raccolta-economia'))
  assert(v.includes('data-label={colonne[i]}')); assert(!s.includes('window.innerWidth'))
})



test('Raccolte: accesso compatto, elenco in focus, dettaglio e ritorni senza scritture', async () => {
 const m = collectionMount(); let t = await m.settle(); const list = () => nodes(t).find(n => n.type === './VistaOperativa' && n.props.titolo === 'Raccolte lavori in economia');
 assert.equal(list().props.visibile, false); assert(!nodes(t).some(n => n.type === 'details')); button(t, 'Raccolte lavori in economia').props.onClick(); t = m.render(); assert.equal(list().props.visibile, true); assert.equal(nodes(list()).filter(n => n.type === 'article').length, 6);
 await button(t, 'Apri').props.onClick(); t = await m.settle(); assert.equal(list().props.visibile, false); const detail = nodes(t).find(n => n.type === './VistaOperativa' && n.props.titolo.startsWith('Raccolta n.')); assert.equal(detail.props.etichettaRitorno, '← Torna alle raccolte'); detail.props.onChiudi(); t = m.render(); assert.equal(list().props.visibile, true); list().props.onChiudi(); t = m.render(); assert.equal(list().props.visibile, false); assert.equal(m.writes.length, 0);
});
