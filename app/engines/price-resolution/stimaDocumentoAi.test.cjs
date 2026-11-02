/* eslint-disable @typescript-eslint/no-require-imports -- Offline injected-provider tests: no API, DB or network. */
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const { execFileSync } = require('node:child_process')
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const cache = new Map(), app = path.resolve(__dirname, '../..')
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const m = { exports: {} }; cache.set(file, m.exports)
  const localRequire = id => {
    if (!id.startsWith('.')) return require(id)
    if (['./RicercaPrezziPreventivo', './PrezzoWebVoce', './AnalisiPrezzoVoce'].includes(id)) return { default: () => null, chiaveAnalisiVoce: (_v, i) => String(i) }
    const p = path.resolve(path.dirname(file), id)
    const target = [p + '.ts', p + '.tsx', path.join(p, 'index.ts')].find(fs.existsSync)
    if (!target) throw Error('Modulo locale non trovato: ' + p)
    return load(target)
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { module: m, exports: m.exports, require: localRequire, console, Set, Map, Number, Math, Date })
  return m.exports
}
const api = load(path.join(__dirname, 'stima-documento-ai.ts'))
const { statoPrezzoDocumento, riepilogoPrezziDocumento, preparaBozzaDocumento } = load(path.join(__dirname, 'proposte-documento.ts'))
const { modificaVoceDiagnostica } = load(path.join(__dirname, 'diagnostica-voce.ts'))
const voce = (descrizione = 'Posa pavimento con collante', quantita = 10, unita_misura = 'mq') => ({ codice: '38.21', descrizione, unita_misura,
  quantita, prezzo_unitario: 0, bozzaDocumento: true, priceResolution: { strategy: 'no_match', matched: false } })
const output = (input, price = 25) => ({ stime: input.righe.map(r => ({ id: r.id, prezzo_unitario_proposto: price, unita_interpretata: r.unita,
  tipo: 'stima_artecna_ai', affidabilita: 'media', motivazione: 'Stima della prestazione completa nella U.M. originale; materiale principale escluso per sola posa.',
  riferimenti_utilizzati: [], avvisi: ['Verificare dimensioni e inclusioni'], lavorazione_composita: r.composita,
  quantita_coperta_dal_prezzo: price === null ? null : 1, totale_riga_proposto: price === null ? null : Math.round(price * r.quantita * 100) / 100 })) })

test('batch unico per residui: conserva tre affidabili e due proposte locali, nessuna scrittura', async () => {
  const affidabili = [30.3, 21.71, 8.18].map(p => ({ ...voce(), prezzo_unitario: p, priceResolution: { matched: true, confidence: 1, strategy: 'description_unit', prezzoUnitarioRisolto: p } }))
  const proposte = [22.2, 31.5].map(p => ({ ...voce(), prezzo_unitario: p, propostaPrezzoDocumento: { prezzo_proposto: p, descrizione: voce().descrizione, unita_misura: 'mq' } }))
  const voci = [...affidabili, ...proposte, ...Array.from({ length: 34 }, () => voce())], snapshot = JSON.stringify(voci)
  let calls = 0
  const result = await api.completaBozzaConStime(voci, [], async input => {
    calls++; assert.equal(input.righe.length, 34)
    return api.eseguiStimeDocumento(input, async () => JSON.stringify(output(input)))
  })
  assert.equal(calls, 1); assert.equal(JSON.stringify(voci), snapshot)
  assert.equal(JSON.stringify(result.slice(0, 5)), JSON.stringify(voci.slice(0, 5)))
  const counts = riepilogoPrezziDocumento(result)
  assert.deepEqual({ ...counts }, { prezzo_affidabile: 3, prezzo_proposto: 2, stima_artecna_ai: 34, prezzo_non_determinabile: 0, modificato_utente: 0 })
  assert(result.slice(5).every(v => v.priceResolution.strategy === 'no_match' && v.prezzo_unitario === 25))
})
test('nessun residuo: nessuna chiamata; idempotenza dopo stima', async () => {
  const i = api.preparaInputStimeDocumento([voce()], []), e = { stime: output(i).stime }
  const v = api.applicaStimeDocumento([voce()], i, e)
  assert.equal(JSON.stringify(preparaBozzaDocumento(v, [])), JSON.stringify(v))
  await api.completaBozzaConStime(v, [], () => { throw Error('Non deve chiamare') })
})
test('quantità zero: prezzo proposto, quantità e totale zero; niente conversione U.M.', () => {
  const v = voce('Impianto elettrico completo', 0, 'a corpo'), i = api.preparaInputStimeDocumento([v], [])
  const [r] = api.applicaStimeDocumento([v], i, output(i, 6000))
  assert.equal(r.quantita, 0); assert.equal(r.prezzo_unitario, 6000); assert.equal(r.quantita * r.prezzo_unitario, 0)
  assert.equal(r.stimaPrezzoArtecna.lavorazione_composita, true)
  const bad = output(i); bad.stime[0].unita_interpretata = 'm2'
  assert.throws(() => api.validaOutputStimeDocumento(bad, i))
})
for (const [nome, mutate] of [
  ['ID duplicato', o => { o.stime[1].id = o.stime[0].id }],
  ['ID sconosciuto', o => { o.stime[0].id = 'non-esiste' }],
  ['riga mancante', o => { o.stime.pop() }],
  ['riga aggiunta', o => { o.stime.push(o.stime[0]) }],
  ['prezzo negativo', o => { o.stime[0].prezzo_unitario_proposto = -1 }],
  ['zero dichiarato prezzo unitario', o => { o.stime[0].prezzo_unitario_proposto = 0 }],
  ['prezzo infinito', o => { o.stime[0].prezzo_unitario_proposto = Infinity }],
  ['prezzo stringa', o => { o.stime[0].prezzo_unitario_proposto = '25' }],
  ['fonte inventata', o => { o.stime[0].riferimenti_utilizzati = ['inesistente'] }],
  ['campo extra', o => { o.stime[0].quantita = 20 }],
  ['composita ignorata', o => { o.stime[0].lavorazione_composita = false }],
  ['totale incoerente', o => { o.stime[0].totale_riga_proposto = 25 }],
  ['prezzo già cumulativo', o => { o.stime[0].quantita_coperta_dal_prezzo = 10 }],
]) test(`fail closed: ${nome}`, () => {
  const voci = [voce('Facciata completa'), voce()], i = api.preparaInputStimeDocumento(voci, []), out = output(i)
  mutate(out); assert.throws(() => api.validaOutputStimeDocumento(out, i))
  assert(api.applicaStimeDocumento(voci, i, out).every(v => v.prezzo_unitario === 0 && v.erroreStimaDocumento))
})
test('provider fallito / JSON troncato: nessun retry, messaggio visibile, zero non certificato', async () => {
  const i = api.preparaInputStimeDocumento([voce()], [])
  for (const generate of [async () => { throw Error('timeout') }, async () => '{"stime":']) {
    let calls = 0
    const e = await api.eseguiStimeDocumento(i, async input => { calls++; return generate(input) })
    assert.equal(calls, 1); assert(e.errore); assert.equal(e.stime.length, 0)
    assert.equal(api.applicaStimeDocumento([voce()], i, e)[0].prezzo_unitario, 0)
  }
})
test('prezzo null motivato resta non determinabile; una voce nulla non scarta altre stime valide', () => {
  const voci = [voce(), voce('Fotovoltaico senza potenza', 2, 'corpo')], i = api.preparaInputStimeDocumento(voci, []), o = output(i)
  o.stime[1].prezzo_unitario_proposto = null
  o.stime[1].quantita_coperta_dal_prezzo = null; o.stime[1].totale_riga_proposto = null
  const r = api.applicaStimeDocumento(voci, i, o)
  assert.equal(r[0].prezzo_unitario, 25); assert.equal(statoPrezzoDocumento(r[1]), 'prezzo_non_determinabile'); assert(r[1].erroreStimaDocumento)
})
test('astensione esplicita zero con base e totale null resta senza prezzo e senza stima', () => {
  const voci = [voce(), voce('Impianto elettrico', 0, 'a corpo')], i = api.preparaInputStimeDocumento(voci, []), o = output(i)
  o.stime[1].prezzo_unitario_proposto = 0; o.stime[1].quantita_coperta_dal_prezzo = null; o.stime[1].totale_riga_proposto = null
  const [prima, seconda] = api.applicaStimeDocumento(voci, i, o)
  assert.equal(prima.prezzo_unitario, 25); assert.equal(seconda.prezzo_unitario, 0)
  assert.equal(seconda.stimaPrezzoArtecna, undefined); assert.equal(statoPrezzoDocumento(seconda), 'prezzo_non_determinabile')
})
test('errore economico isolato per riga: scarta la stima incoerente, conserva le altre senza retry', async () => {
  const voci = [voce(), voce()], i = api.preparaInputStimeDocumento(voci, []), o = output(i)
  o.stime[0].totale_riga_proposto = 25
  let calls = 0
  const result = await api.eseguiStimeDocumento(i, async () => { calls++; return JSON.stringify(o) })
  const applied = api.applicaStimeDocumento(voci, i, result)
  assert.equal(calls, 1); assert.equal(applied[0].prezzo_unitario, 0); assert(applied[0].erroreStimaDocumento.includes('scartata'))
  assert.equal(applied[1].prezzo_unitario, 25)
})
test('serramenti: corpo frazionario e riferimento m² non dimostrano un prezzo per corpo', async () => {
  const voci = [voce('Serramenti esterni alluminio', 18.36, 'corpo')]
  const kb = [{ codice: 'SIC_TEST', descrizione: 'Fornitura posa serramenti esterni alluminio', unita_misura: 'm2', prezzo_unitario: 600, fonte: 'Regione Sicilia' }]
  const i = api.preparaInputStimeDocumento(voci, kb), o = output(i, 600)
  o.stime[0].riferimenti_utilizzati = [i.righe[0].riferimenti[0].id]
  const esito = await api.eseguiStimeDocumento(i, async () => JSON.stringify(o))
  const [v] = api.applicaStimeDocumento(voci, i, esito)
  assert.equal(v.prezzo_unitario, 0); assert.equal(v.quantita, 18.36); assert.equal(v.unita_misura, 'corpo')
  assert(v.erroreStimaDocumento.includes('dimensionalmente'))
})
test('identità batch non verificabile: nessuna stima parziale applicata', async () => {
  const voci = [voce(), voce()], i = api.preparaInputStimeDocumento(voci, []), o = output(i)
  o.stime[1].id = 'estraneo'
  const result = await api.eseguiStimeDocumento(i, async () => JSON.stringify(o))
  assert(result.errore); assert.equal(result.stime.length, 0)
})
test('sola posa, descrizione integrale, contesto originale, riferimenti di entrambe le fonti', () => {
  const prezzi = ['ARTECNA', 'Regione Sicilia'].map((fonte, n) => ({ codice: `cod-${n}`, fonte, descrizione: 'Fornitura e posa pavimento con collante', unita_misura: 'm2', prezzo_unitario: 60 }))
  const i = api.preparaInputStimeDocumento([voce()], prezzi, 'Fotovoltaico 3 kW riportato nel documento')
  assert(i.righe[0].ambito.includes('sola posa')); assert.equal(i.righe[0].descrizione, voce().descrizione)
  assert(i.contesto_documento.includes('3 kW')); assert.equal(new Set(i.righe[0].riferimenti.map(r => r.fonte)).size, 2)
  assert(api.istruzioniStimeDocumento.includes('escludi la fornitura'))
  assert(api.istruzioniStimeDocumento.includes('puntellazione'))
})
test('contesto puntuale conserva potenza e note senza modificare parser o quantità; nessun fan-coil per il fotovoltaico', () => {
  const v = { ...voce('Impianto fotovoltaico completo', 2, 'a corpo'), testoOrigine: '39 | 41.9 | impianto | 3kW+3kW | a corpo | 2' }
  const kb = [{ codice: 'TEST', fonte: 'Regione Sicilia', descrizione: 'Fornitura posa impianto ventilconvettore con opere murarie', unita_misura: 'cad', prezzo_unitario: 900 }]
  const i = api.preparaInputStimeDocumento([v], kb)
  assert.equal(i.righe[0].contesto_riga, v.testoOrigine); assert.equal(i.righe[0].quantita, 2)
  assert.equal(i.righe[0].riferimenti.length, 0)
})
for (const campo of ['descrizione', 'unita_misura', 'quantita', 'prezzo_unitario']) test(`modifica ${campo}: invalida stima e non viene sovrascritta`, () => {
  const v = voce(), i = api.preparaInputStimeDocumento([v], [])
  const [s] = api.applicaStimeDocumento([v], i, output(i))
  const edited = modificaVoceDiagnostica(s, campo, campo === 'prezzo_unitario' || campo === 'quantita' ? 99 : 'modificato')
  assert.equal(statoPrezzoDocumento(edited), 'modificato_utente')
  assert.equal(api.applicaStimeDocumento([edited], i, output(i))[0][campo], edited[campo])
  assert.equal(edited.stimaPrezzoArtecna.prezzo_unitario_proposto, 25)
  const pending = { ...v, [campo]: edited[campo] }
  assert.equal(api.applicaStimeDocumento([pending], i, output(i))[0][campo], pending[campo])
})
test('input limitato e strutturato: no campi arbitrari, quantità negative, duplicati, oltre 50 righe', () => {
  const input = api.preparaInputStimeDocumento([voce()], [])
  for (const v of [{ ...input, extra: true }, { ...input, righe: [] }, { ...input, righe: [...input.righe, ...input.righe] },
    { ...input, righe: [{ ...input.righe[0], quantita: -1 }] }, { ...input, righe: Array.from({length:51}, (_,i)=>({...input.righe[0],id:String(i)})) }]) {
    assert.throws(() => api.validaInputStimeDocumento(v))
  }
})
test('UI stima gialla, prezzo/totale in colonna, cinque contatori e dettaglio avvisi', () => {
  const voci = [voce('Facciata completa', 10)], i = api.preparaInputStimeDocumento(voci, [])
  const v = api.applicaStimeDocumento(voci, i, output(i, 80))
  const Panel = load(path.join(app, 'components/RevisionePreventivoAiPanel.tsx')).default, noop = () => { throw Error('No actions during render') }
  const html = renderToStaticMarkup(React.createElement(Panel, {
    messaggioAi: '', descrizionePreventivoAi: '', setDescrizionePreventivoAi: noop, vociPreventivoAi: v, setVociPreventivoAi: noop,
    vociPreventivoAiOriginali: v, prezziRiferimento: [], memoriaRiferimento: [], calcolaMediaPrezziSimili: () => null, verificaPrezzoAnomalo: () => '',
    formatMoney: n => Number(n).toFixed(2), miglioraVocePreventivoAi: noop, salvaInMemoriaPrezzi: noop, generaExcelDefinitivoPreventivoAi: noop,
    salvaRevisionePreventivoAi: noop, preventivoRegistroCantiere: '', setMostraRevisionePreventivoAi: noop,
    excelTable: {}, excelTh: {}, excelTd: {}, buttonPrimary: {}, buttonSecondary: {},
  }))
  for (const t of ['Stima ARTECNA — lavorazione composita', 'Stime ARTECNA', 'Proposte da riferimenti', '800.00', 'value="80"', 'Verificare dimensioni', 'provvisoria']) assert(html.includes(t), t)
  assert(!html.includes('nessun prezzo applicato'))
})
test('perimetro: vecchio percorso singolo e modello conservati, nessun Web/writer nel batch', () => {
  const route = fs.readFileSync(path.join(app, 'api/prezzi/analisi-ai/route.ts'), 'utf8')
  const oldRoute = execFileSync('git', ['show', '3789271d74f9cdf9ee7ea7faca4186814fac3d66:app/api/prezzi/analisi-ai/route.ts'], { cwd: path.dirname(app), encoding: 'utf8' })
  const suffix = s => s.slice(s.indexOf('  const result = await eseguiAnalisiPrezzo')).replace(/\r\n/g, '\n')
  assert.equal(suffix(route), suffix(oldRoute)); assert.equal(api.modelloStimeDocumento, 'gpt-4.1-mini')
  assert(route.includes('maxRetries: 0')); assert(route.indexOf('supabase.auth.getUser') < route.indexOf("parsed?.tipo === 'stima_documento_batch'"))
  const engine = fs.readFileSync(path.join(__dirname, 'stima-documento-ai.ts'), 'utf8')
  assert(!/supabase|fetch\(|\.insert\(|\.update\(|web_search/.test(engine))
  const ui = fs.readFileSync(path.join(app, 'components/RevisionePreventivoAiPanel.tsx'), 'utf8')
  assert(ui.includes('(voce.propostaPrezzoDocumento || voce.stimaPrezzoArtecna) && !voce.priceResolutionInvalidated'))
})

test('route batch autenticata: un solo provider, schema strutturato, modello invariato e nessun retry', async () => {
  const source = fs.readFileSync(path.join(app, 'api/prezzi/analisi-ai/route.ts'), 'utf8')
  const calls = { provider: 0, auth: 0 }, batch = api.preparaInputStimeDocumento([voce()], [])
  class Provider {
    constructor(options) { assert.equal(options.maxRetries, 0) }
    responses = { create: async request => {
      calls.provider++
      assert.equal(request.model, 'gpt-4.1-mini'); assert.equal(request.store, false)
      assert.equal(request.tools, undefined); assert.equal(request.text.format.strict, true)
      assert.equal(request.text.format.schema.properties.stime.maxItems, batch.righe.length)
      assert.equal(JSON.stringify(request.text.format.schema.properties.stime.items.properties.id.enum), JSON.stringify(batch.righe.map(r => r.id)))
      return { status: 'completed', output_text: JSON.stringify(output(batch)) }
    } }
  }
  const m = { exports: {} }, env = { OPENAI_API_KEY: 'test-only-not-a-real-key' }
  const req = id => {
    if (id === 'openai') return { default: Provider }
    if (id.endsWith('supabaseClient')) return { supabase: { auth: { getUser: async token => { calls.auth++; return { data: { user: token === 'valid' ? { id: 'test-user' } : null }, error: null } } } } }
    if (id.endsWith('stima-documento-ai')) return api
    if (id.endsWith('ai-price-analyst')) return { daVerificare: motivazione => ({ esito: 'da_verificare', motivazione }) }
    throw Error(id)
  }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module: m, exports: m.exports, require: req, Response, process: { env } })
  const request = (token, data = batch) => new Request('http://local/api/prezzi/analisi-ai', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(data) })
  assert.equal((await m.exports.POST(request())).status, 401)
  assert.equal((await m.exports.POST(request('invalid'))).status, 401)
  assert.equal(calls.provider, 0)
  assert.equal((await m.exports.POST(request('valid', { ...batch, righe: [] }))).status, 400)
  const success = await m.exports.POST(request('valid'))
  assert.equal(success.status, 200); assert.equal((await success.json()).stime[0].prezzo_unitario_proposto, 25)
  assert.equal(calls.provider, 1)
  delete env.OPENAI_API_KEY
  const failed = await (await m.exports.POST(request('valid'))).json()
  assert(failed.errore); assert.equal(failed.stime.length, 0); assert.equal(calls.provider, 1)
})

test('risposta HTTP malformata non interrompe la bozza e non inventa prezzi', async () => {
  for (const result of [null, {}, { stime: [], errore: { unsafe: true } }]) {
    const [v] = await api.completaBozzaConStime([voce()], [], async () => result)
    assert.equal(v.prezzo_unitario, 0); assert(v.erroreStimaDocumento)
  }
})

test('computo reale: replay risposta batch acquisita, prezzi/totali e metadati nella UI', { skip: !process.env.ARTECNA_LOCAL_STIME_REPORT }, () => {
  const report = JSON.parse(fs.readFileSync(process.env.ARTECNA_LOCAL_STIME_REPORT, 'utf8')), voci = report.voci
  assert.equal(voci.length, 39)
  const stats = riepilogoPrezziDocumento(voci)
  assert.equal(stats.prezzo_affidabile, 3); assert.equal(stats.prezzo_proposto, 2); assert(stats.stima_artecna_ai >= 25)
  assert.equal(Object.values(stats).reduce((s, n) => s + n, 0), 39)
  assert.equal(voci.filter(v => v.priceResolution.strategy === 'no_match').length, 36)
  for (const [i,p] of [[10,30.3],[18,21.71],[27,8.18],[17,31.5],[32,22.2]]) assert.equal(voci[i].prezzo_unitario, p)
  assert.equal(Number(voci.reduce((s, v) => s + v.quantita * v.prezzo_unitario, 0).toFixed(2)), report.subtotale)
  assert(voci.filter(v => v.quantita === 0).every(v => v.totale === 0))
  for (const v of voci.filter(v => v.stimaPrezzoArtecna)) {
    assert.equal(v.unita_misura, v.stimaPrezzoArtecna.unita_originale)
    assert.equal(v.quantita, v.stimaPrezzoArtecna.quantita)
    assert.equal(v.prezzo_unitario, v.stimaPrezzoArtecna.prezzo_unitario_proposto)
    assert.equal(statoPrezzoDocumento(v), 'stima_artecna_ai')
  }
  const Panel = load(path.join(app, 'components/RevisionePreventivoAiPanel.tsx')).default, noop = () => { throw Error('Read-only render') }
  const html = renderToStaticMarkup(React.createElement(Panel, {
    messaggioAi: '', descrizionePreventivoAi: '', setDescrizionePreventivoAi: noop, vociPreventivoAi: voci, setVociPreventivoAi: noop,
    vociPreventivoAiOriginali: voci, prezziRiferimento: [], memoriaRiferimento: [], calcolaMediaPrezziSimili: () => null, verificaPrezzoAnomalo: () => '',
    formatMoney: n => Number(n).toFixed(2), miglioraVocePreventivoAi: noop, salvaInMemoriaPrezzi: noop, generaExcelDefinitivoPreventivoAi: noop,
    salvaRevisionePreventivoAi: noop, preventivoRegistroCantiere: '', setMostraRevisionePreventivoAi: noop,
    excelTable: {}, excelTh: {}, excelTd: {}, buttonPrimary: {}, buttonSecondary: {},
  }))
  assert(html.includes(report.subtotale.toFixed(2)))
  assert(html.includes('Stime ARTECNA')); assert(html.includes('Stima ARTECNA — lavorazione composita'))
  for (const v of voci) assert(html.includes(`value="${v.prezzo_unitario}"`))
})
