/* eslint-disable @typescript-eslint/no-require-imports -- Offline application harness, no DB or provider calls. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const { execFileSync } = require('node:child_process')
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const app = path.resolve(__dirname, '../..'), cache = new Map()
const quiet = { log() {}, table() {}, group() {}, groupEnd() {}, warn() {} }
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const loaded = { exports: {} }
  cache.set(file, loaded.exports)
  const localRequire = id => {
    if (!id.startsWith('.')) return require(id)
    if (['./RicercaPrezziPreventivo', './PrezzoWebVoce', './AnalisiPrezzoVoce'].includes(id)) return { default: () => null, chiaveAnalisiVoce: (_v, i) => String(i) }
    if (id.endsWith('/ai-price-analyst') || id.endsWith('/web-fallback')) return new Proxy({}, { get: () => () => { throw Error('AI/Web forbidden') } })
    const target = path.resolve(path.dirname(file), id)
    return load([target + '.ts', target + '.tsx', path.join(target, 'index.ts')].find(fs.existsSync))
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { module: loaded, exports: loaded.exports, require: localRequire, console: quiet, Date, Math, Number, Set, Map })
  cache.set(file, loaded.exports)
  return loaded.exports
}
const { preparaBozzaDocumento, statoPrezzoDocumento, riepilogoPrezziDocumento } = load(path.join(__dirname, 'proposte-documento.ts'))
const { resolvePrice } = load(path.join(__dirname, 'resolver.ts'))
const { modificaVoceDiagnostica, esitoDiagnosticaVoce } = load(path.join(__dirname, 'diagnostica-voce.ts'))
const { createPreventivoRevision } = load(path.join(app, 'engines/preventivo/index.ts'))
const ref = (codice, descrizione, prezzo_unitario, unita_misura = 'm2', fonte = 'Regione Sicilia') => ({ codice, descrizione, prezzo_unitario, unita_misura, fonte, tipo_prezzo: fonte === 'ARTECNA' ? 'artecna' : 'regional_price_list' })
const ponteggio = 'Approntamento di ponteggio in elementi portanti metallici sistema a telaio, compreso il nolo manutenzione e controllo per tutto il tempo necessario ai lavori.'
const imper = 'Fornitura e posa in opera di impermeabilizzazione con malta tipo Mapei o similari con due strati e rete.'
const pavimento = 'Posa in opera di pavimento con collante e stuccatura di fuga.'
const noMatch = (descrizione, unita_misura = 'mq', quantita = 1) => ({ descrizione, unita_misura, quantita, prezzo_unitario: 0,
  priceResolution: { strategy: 'no_match', matched: false, confidence: 0, prezzoUnitarioRisolto: 0 } })
const prezzi = [
  ref('ART_PONTEGGIO', 'Montaggio e smontaggio ponteggio metallico completo in sicurezza, compresi oneri di posa, certificazioni e manutenzione durante i lavori', 22.2, 'm2', 'ARTECNA'),
  ref('SIC24_26.1.1.1', 'Approntamento di ponteggio a telaio per i primi 30 giorni', 8.68),
  ref('SIC24_3.7.9', 'Fornitura e posa in opera di malta cementizia bicomponente per impermeabilizzazione di solai e balconi, in due mani con rete in fibra di vetro', 31.5),
  ref('SIC24_BITUME', 'Impermeabilizzazione con malta di asfalto e bitume in due strati e rete', 28.07),
  ref('SIC24_PAVIMENTO', 'Fornitura e collocazione di pavimento in cotto con collanti e stuccatura di fuga', 89.95),
  ref('VETRO', 'Fornitura e posa di lastre di vetro con collante e stuccatura', 30.87),
  ref('CADITOIA', 'Fornitura e posa di caditoia stradale', 224.13),
]
test('ponteggio: proposta ARTECNA in colonna prezzo e totale, matching originale no_match', () => {
  const [v] = preparaBozzaDocumento([noMatch(ponteggio, 'mq', 150)], prezzi)
  assert.equal(v.prezzo_unitario, 22.2)
  assert.equal(v.quantita * v.prezzo_unitario, 3330)
  assert.equal(v.priceResolution.strategy, 'no_match')
  assert.equal(esitoDiagnosticaVoce(v), 'unresolved')
  assert.equal(statoPrezzoDocumento(v), 'prezzo_proposto')
  assert.equal(v.propostaPrezzoDocumento.fonte_proposta, 'ARTECNA')
  assert(v.propostaPrezzoDocumento.avvisi.some(a => a.includes('durata del nolo')))
})
test('impermeabilizzazione: riferimento tecnico pertinente, non bitume e nessun +25%', () => {
  const pannello = ref('PANNELLO', 'Fornitura e posa in opera di pannello in doppia lastra con impermeabilizzazione accessoria con malta cementizia bicomponente in due mani e rete', 139.74)
  const [v] = preparaBozzaDocumento([noMatch(imper, 'mq', 24.4)], [...prezzi, pannello])
  assert.equal(v.prezzo_unitario, 31.5)
  assert.equal(v.propostaPrezzoDocumento.codice_riferimento, 'SIC24_3.7.9')
  assert.equal(Number((v.quantita * v.prezzo_unitario).toFixed(2)), 768.6)
})
test('rete con armatura di rinforzo: ciclo impermeabilizzante, non consolidamento strutturale', () => {
  const ciclo = { ...prezzi[2], descrizione: prezzi[2].descrizione + ', interponendo come armatura di rinforzo una rete in fibra di vetro alcali resistente.' }
  const [v] = preparaBozzaDocumento([noMatch(imper)], [ciclo])
  assert.equal(v.prezzo_unitario, 31.5)
  assert.equal(v.propostaPrezzoDocumento.metodo_proposta, 'riferimento_tecnico_impermeabilizzazione')
  assert.equal(v.priceResolution.strategy, 'no_match')
})
test('prezzi esistenti affidabili e documentali non vengono sovrascritti', () => {
  for (const prezzo of [30.3, 21.71, 8.18]) {
    const v = { ...noMatch(ponteggio), prezzo_unitario: prezzo, priceResolution: { matched: true, strategy: 'similarity', confidence: .97, prezzoUnitarioRisolto: prezzo } }
    const [r] = preparaBozzaDocumento([v], prezzi)
    assert.equal(r.prezzo_unitario, prezzo)
    assert.equal(statoPrezzoDocumento(r), 'prezzo_affidabile')
  }
  assert.equal(preparaBozzaDocumento([{ ...noMatch(ponteggio), prezzo_unitario: 42 }], prezzi)[0].prezzo_unitario, 42)
})
test('sola posa: niente prezzo di fornitura+posa, vetro o quota inventata', () => {
  const [v] = preparaBozzaDocumento([noMatch(pavimento)], prezzi)
  assert.equal(v.prezzo_unitario, 0)
  assert.equal(statoPrezzoDocumento(v), 'prezzo_non_determinabile')
})
test('pacchetti compositi restano non determinabili anche con memoria identica', () => {
  for (const d of ['Facciata completa', 'Impianto elettrico completo', 'Impianto idrico completo', 'Fotovoltaico completo', 'Fossa Imhoff e scavi', 'Apertura su muratura portante con IPE', 'Revisione tetto', 'Muro di confine e ringhiera', 'Vespaio aerato con getto']) {
    const [v] = preparaBozzaDocumento([noMatch(d)], [ref('X', d, 100)], [ref('MEM', d, 100)])
    assert.equal(v.prezzo_unitario, 0)
    assert.equal(statoPrezzoDocumento(v), 'prezzo_non_determinabile')
  }
})
test('U.M. incompatibile: nessuna conversione implicita per serramenti o demolizioni', () => {
  const [v] = preparaBozzaDocumento([noMatch('Fornitura e posa di serramenti esterni in alluminio', 'corpo')], [ref('INFISSI', 'Fornitura e posa di serramenti esterni in alluminio', 577.2)])
  assert.equal(v.prezzo_unitario, 0)
  assert.equal(preparaBozzaDocumento([noMatch(ponteggio, 'corpo')], prezzi)[0].prezzo_unitario, 0)
})
test('durata parziale e inclusioni in contrasto non diventano prezzi del pacchetto completo', () => {
  assert.equal(preparaBozzaDocumento([noMatch(ponteggio)], prezzi.filter(p => p.fonte !== 'ARTECNA'))[0].prezzo_unitario, 0)
  const d = 'Demolizione muratura con carico e trasporto in discarica'
  assert.equal(preparaBozzaDocumento([noMatch(d, 'm3')], [ref('D', 'Demolizione muratura, escluso il trasporto', 306.75, 'm3')])[0].prezzo_unitario, 0)
})
test('prezzi discordanti della stessa fonte: non sceglie arbitrariamente', () => {
  const altro = { ...prezzi[0], codice: 'ART_ALTRO', prezzo_unitario: 30 }
  assert.equal(preparaBozzaDocumento([noMatch(ponteggio)], [...prezzi, altro])[0].prezzo_unitario, 0)
})
test('memoria realmente passata: riuso media compatibile senza nuove letture o maggiorazioni', () => {
  const mem = [ref('M1', ponteggio, 20, 'mq', 'Memoria ARTECNA'), ref('M2', ponteggio, 24, 'mq', 'Memoria ARTECNA')]
  const [v] = preparaBozzaDocumento([noMatch(ponteggio)], [], mem)
  assert.equal(v.prezzo_unitario, 22)
  assert.equal(v.propostaPrezzoDocumento.metodo_proposta, 'media_memoria_compatibile')
  assert.equal(preparaBozzaDocumento([noMatch(ponteggio)], [], [{ ...mem[0], fonte: 'fallback da verificare' }])[0].prezzo_unitario, 0)
})
test('non muta input/KB, è idempotente e conserva provenienza serializzabile', () => {
  const input = [noMatch(ponteggio)], prima = JSON.stringify({ input, prezzi })
  const r = preparaBozzaDocumento(input, prezzi)
  assert.equal(JSON.stringify({ input, prezzi }), prima)
  assert.equal(JSON.stringify(preparaBozzaDocumento(r, prezzi)), JSON.stringify(r))
  const p = JSON.parse(JSON.stringify(r))[0].propostaPrezzoDocumento
  for (const key of ['prezzo_proposto','fonte_proposta','codice_riferimento','confidence','metodo_proposta','motivazione','avvisi']) assert(key in p)
})
test('correzioni prezzo/descrizione/U.M. invalidano esito, preservando proposta originale e cronologia', () => {
  const [v] = preparaBozzaDocumento([noMatch(ponteggio)], prezzi)
  for (const [campo, valore] of [['prezzo_unitario', 25], ['descrizione', 'Altro'], ['unita_misura', 'corpo']]) {
    const r = modificaVoceDiagnostica(v, campo, valore)
    assert.equal(statoPrezzoDocumento(r), 'modificato_utente')
    assert.equal(r.propostaPrezzoDocumento.prezzo_proposto, 22.2)
    assert.equal(preparaBozzaDocumento([r], prezzi)[0][campo], valore)
  }
  assert.equal(statoPrezzoDocumento(v), 'prezzo_proposto')
})

async function generaOffline(vociAnalizzate, prezziarioSicilia) {
  const source = fs.readFileSync(path.join(app, 'page.tsx'), 'utf8')
  const start = source.indexOf('const generaPreventivoDaDocumentoAnalizzato ='), end = source.indexOf('const miglioraVocePreventivoAi =', start)
  const chiamate = { insert: null, voci: null, originali: null }
  const supabase = { from: table => { assert.equal(table, 'preventivi_cantiere'); return { insert: dati => {
    chiamate.insert = JSON.parse(JSON.stringify(dati)); return { select: () => ({ single: async () => ({ data: { id: 'mock-no-db' }, error: null }) }) }
  } } } }
  const context = { console: quiet, resolvePrice, createPreventivoRevision, preparaBozzaDocumento, supabase,
    completaBozzaConStime: async voci => voci, setMessaggioAi() {}, testoEstrattoDocumento: '',
    vociAnalizzate, prezziarioSicilia, memoriaPrezziValidi: [], nomeFileAnalisiDocumento: 'fixture.xlsx', alert() {},
    setPreventivoAiGenerato() {}, setVociPreventivoAi: v => { chiamate.voci = v }, setVociPreventivoAiOriginali: v => { chiamate.originali = v },
    setDescrizionePreventivoAi() {}, setMostraRevisionePreventivoAi() {}, caricaEconomia: async () => {} }
  vm.createContext(context)
  vm.runInContext(ts.transpileModule(source.slice(start, end) + '\nglobalThis.genera = generaPreventivoDaDocumentoAnalizzato;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context)
  assert.equal(await context.genera({ id: 'test', cliente: 'Fixture locale' }), true)
  return chiamate
}
test('integrazione generatore: proposte solo nello stato locale, non nella scrittura iniziale esistente', async () => {
  const r = await generaOffline([{ descrizione: ponteggio, unita: 'mq', unita_misura: 'mq', quantita: 150 }], prezzi)
  assert.equal(r.insert[0].json_voci_ai[0].prezzo_unitario, 0)
  assert.equal(r.insert[0].json_voci_ai[0].propostaPrezzoDocumento, undefined)
  assert.equal(r.insert[0].importo_totale, 0)
  assert.equal(r.voci[0].prezzo_unitario, 22.2)
  assert.equal(r.originali[0].prezzo_unitario, 22.2)
})
test('UI: prezzo proposto nella colonna esistente, totale e contatori separati, riferimenti consultabili', () => {
  const Panel = load(path.join(app, 'components/RevisionePreventivoAiPanel.tsx')).default
  const voci = preparaBozzaDocumento([noMatch(ponteggio, 'mq', 150), noMatch('Facciata completa')], prezzi)
  const vietato = () => { throw Error('Nessuna azione durante render') }
  const props = { messaggioAi: '', descrizionePreventivoAi: '', setDescrizionePreventivoAi: vietato,
    vociPreventivoAi: voci, setVociPreventivoAi: vietato, vociPreventivoAiOriginali: voci, prezziRiferimento: prezzi, memoriaRiferimento: [],
    calcolaMediaPrezziSimili: () => null, verificaPrezzoAnomalo: () => '', formatMoney: n => Number(n).toFixed(2),
    miglioraVocePreventivoAi: vietato, salvaInMemoriaPrezzi: vietato, generaExcelDefinitivoPreventivoAi: vietato, salvaRevisionePreventivoAi: vietato,
    preventivoRegistroCantiere: '', setMostraRevisionePreventivoAi: vietato, excelTable: {}, excelTh: {}, excelTd: {}, buttonPrimary: {}, buttonSecondary: {} }
  const html = renderToStaticMarkup(React.createElement(Panel, props))
  for (const text of ['Prezzo proposto — controllare','Prezzo non determinabile','Riferimenti locali da verificare','ARTECNA','3330.00','Matching originale: no_match']) assert(html.includes(text), text)
  assert.match(html, /Proposte da riferimenti<\/dt><dd[^>]*>1<\/dd>/)
  assert.match(html, /Prezzi affidabili<\/dt><dd[^>]*>0<\/dd>/)
  assert.match(html, /value="22.2"/)
  assert(!html.includes('nessun prezzo applicato'))
  assert(!html.includes('Risolte automaticamente'))
})
test('perimetro: resolver, soglie, parser, analisi singola/Web, SQL e salvataggio revisione invariati', () => {
  const root = path.resolve(app, '..'), base = '66b845903c98f0fe3e2f9cb037daf58d026972ec'
  for (const file of ['app/engines/price-resolution/resolver.ts','app/engines/price-resolution/normalizer.ts','app/engines/price-resolution/diagnostica-voce.ts',
    'app/engines/price-resolution/revisione-ai.ts','app/engines/price-resolution/descrizione-semantica.ts','app/engines/price-resolution/ai-price-analyst.ts',
    'app/engines/price-resolution/web-fallback.ts','app/engines/confidence/confidence.ts','app/engines/document-parser/excel.ts','app/engines/document-parser/voci-analizzate.ts',
    'app/engines/document-intelligence/pdf-ocr.ts','app/api/prezzi/web/route.ts']) {
    assert.equal(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show',`${base}:${file}`],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n'),file)
  }
  const section = text => text.slice(text.indexOf('const salvaRevisionePreventivoAi ='), text.indexOf('const generaExcelDefinitivoPreventivoAi =')).replace(/\r\n/g,'\n')
  assert.equal(section(fs.readFileSync(path.join(app,'page.tsx'),'utf8')), section(execFileSync('git',['show',`${base}:app/page.tsx`],{cwd:root,encoding:'utf8'})))
})
test('computo reale e snapshot storico: conteggi, proposte e subtotale riproducibili', { skip: !process.env.ARTECNA_LOCAL_PRICE_SNAPSHOT }, async () => {
  const XLSX = require('xlsx'), crypto = require('node:crypto'), bytes = fs.readFileSync(process.env.ARTECNA_LOCAL_PRICE_SNAPSHOT)
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'55d8aec1e6255bbb0fe7f2a6d450d9f2730d7b1201971280be026e38f36a8d97')
  const csv = XLSX.read(bytes.toString('utf8'), {type:'string',raw:true})
  const kb = XLSX.utils.sheet_to_json(csv.Sheets[csv.SheetNames[0]],{defval:null}).map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v==='\\N'?null:k==='prezzo_unitario'?Number(v):v])))
  // The application orders by description; the historical CSV is ordered by ID.
  // Sort only this in-memory copy. No change to the export or resolver tie-breaking.
  kb.sort((a,b)=>a.descrizione<b.descrizione?-1:a.descrizione>b.descrizione?1:0)
  const wb = XLSX.read(fs.readFileSync(process.env.ARTECNA_LOCAL_COMPUTO),{type:'buffer'})
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1}).slice(1)
  const inputs = rows.map(r=>({codice:String(r[1]),descrizione:r[2],unita:r[4],unita_misura:r[4],quantita:r[5]}))
  const result = await generaOffline(inputs,kb), voci = result.voci, stats = riepilogoPrezziDocumento(voci)
  const totale=voci.reduce((s,v)=>s+v.quantita*v.prezzo_unitario,0)
  console.log(JSON.stringify({snapshot:'15/10/2026, ordinato per descrizione; non certifica Production attuale',stats,subtotale:Number(totale.toFixed(2)),voci:voci.map((v,i)=>({n:i+1,codice:v.codice,prezzo:v.prezzo_unitario,stato:statoPrezzoDocumento(v),proposta:v.propostaPrezzoDocumento}))}))
  assert.equal(voci.length,39)
  assert(voci.every((v,i)=>v.unita_misura===inputs[i].unita))
  for(const [i,p] of [[10,30.3],[18,21.71],[27,8.18]]) { assert.equal(voci[i].prezzo_unitario,p); assert.equal(statoPrezzoDocumento(voci[i]),'prezzo_affidabile') }
  assert.equal(voci[32].prezzo_unitario,22.2)
  assert.equal(voci[17].prezzo_unitario,31.5)
  assert.equal(voci[19].prezzo_unitario,0)
  assert.equal(voci[31].prezzo_unitario,0)
  assert.equal(voci[36].prezzo_unitario,0)
  assert.equal(voci.filter(v=>v.priceResolution.strategy==='no_match').length,36)
  assert.equal(Number(result.insert[0].importo_totale.toFixed(2)),8472.14)
})
