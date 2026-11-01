/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS node:test harness for the existing TypeScript sources. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const XLSX = require('xlsx')

const app = path.resolve(__dirname, '../..')
const quiet = { log() {}, group() {}, groupEnd() {}, table() {}, warn() {}, error() {} }
const cache = new Map()
function load(file, overrides = {}) {
  file = path.resolve(file)
  if (cache.has(file) && !Object.keys(overrides).length) return cache.get(file)
  const loaded = { exports: {} }
  const localRequire = (id) => {
    if (id in overrides) return overrides[id]
    if (id.startsWith('.') || id.startsWith('@/')) {
      const target = id.startsWith('@/') ? path.resolve(app, '..', id.slice(2)) : path.resolve(path.dirname(file), id)
      const resolved = [target, target + '.ts', target + '.tsx', path.join(target, 'index.ts')].find((p) => fs.existsSync(p) && fs.statSync(p).isFile())
      return load(resolved)
    }
    return require(id)
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module: loaded, exports: loaded.exports, require: localRequire, console: quiet, Date, Number, Math, Set })
  if (!Object.keys(overrides).length) cache.set(file, loaded.exports)
  return loaded.exports
}
const { parseExcelDocument } = load(path.join(__dirname, 'excel.ts'))
const { detectDocumentHeader } = load(path.join(__dirname, 'header-detector.ts'))
const { creaVoceAnalizzataExcel, totaleVoceAnalizzata } = load(path.join(__dirname, 'voci-analizzate.ts'))
const headers = ['N°', 'Tariffa', 'Descrizione lavori', 'Ubicazione / Dimensioni', 'U.M.', 'Quantità', 'Annotazioni', 'Pagina PDF']
function fileFor(rows, bookType = 'xlsx') {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Computo')
  const bytes = XLSX.write(wb, { type: 'buffer', bookType })
  return {
    name: `Computo_metrico_estratto_per_preventivo.${bookType}`,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  }
}
const example = (code = '38.1', quantity = 2) => [1, code, 'Lavorazione del computo', 'Piano terra', 'mq', quantity, '', 1]

test('A: intestazioni reali; Tariffa prevale su N° in entrambi gli ordini', () => {
  const result = detectDocumentHeader([headers])
  assert.equal(result.columns.codice, 1)
  assert.equal(result.columns.descrizione, 2)
  assert.equal(result.columns.unitaMisura, 4)
  assert.equal(result.columns.quantita, 5)
  assert.equal(detectDocumentHeader([['Tariffa', 'N°', 'Descrizione lavori']]).columns.codice, 0)
  assert.equal(detectDocumentHeader([['N°', 'Descrizione lavori']]).columns.codice, 0)
})
for (const code of ['38.1', '41.6', '2.2.1.1', 'SIC24_1.1', 'codice-Misto']) {
  test(`B/C: codice ${code} e descrizione autorevole conservati`, async () => {
    const doc = await parseExcelDocument(fileFor([headers, example(code)]))
    assert.equal(doc.rows.length, 1)
    assert.equal(doc.rows[0].rowType, 'voce')
    assert.equal(doc.rows[0].codice, code)
    assert.equal(doc.rows[0].descrizione, 'Lavorazione del computo')
    assert.equal(doc.rows[0].unitaMisura, 'mq')
    assert.equal(doc.rows[0].quantita, 2)
  })
}
test('D: quantità senza prezzi produce una voce senza inventare importi', async () => {
  const doc = await parseExcelDocument(fileFor([headers, example()]))
  const voce = creaVoceAnalizzataExcel(doc.rows[0])
  assert.equal(voce.quantita, 2)
  assert.equal(voce.prezzo, undefined)
  assert.equal(voce.totale, undefined)
  assert.equal(totaleVoceAnalizzata(voce), 0)
  assert.equal(doc.warnings.length, 0)
})
test('E: prezzo/totale Euro numerici e mapping preservati, prezzo file prioritario', async () => {
  const doc = await parseExcelDocument(fileFor([[...headers, 'Prezzo unitario €', 'Totale €'], [...example(), '1.234,56 €', '2.500,00 €']]))
  const voce = creaVoceAnalizzataExcel(doc.rows[0], 999)
  assert.equal(voce.codice, '38.1')
  assert.equal(voce.descrizione, 'Lavorazione del computo')
  assert.equal(voce.unita, 'mq')
  assert.equal(voce.quantita, 2)
  assert.equal(voce.prezzo, 1234.56)
  assert.equal(voce.prezzo_unitario, 1234.56)
  assert.equal(voce.totale, 2500)
  assert.equal(totaleVoceAnalizzata(voce), 2500)
})
for (const format of ['xlsx', 'xls']) {
  test(`F: fixture ${format}, 39 righe → 39 voci strutturate nello stesso ordine`, async () => {
    const codes = Array.from({ length: 39 }, (_, i) => ['38.1', '41.6', '2.2.1.1'][i % 3])
    const doc = await parseExcelDocument(fileFor([headers, ...codes.map((code, i) => [i + 1, code, `Lavorazione ${i + 1}`, 'Piano terra', 'mq', i + 1, '', 1])], format))
    assert.equal(doc.rows.length, 39)
    assert.equal(doc.rows.filter((r) => r.rowType === 'voce').length, 39)
    assert.equal(doc.rows.map((r) => r.codice).join(','), codes.join(','))
    assert.equal(doc.rows[38].descrizione, 'Lavorazione 39')
    assert.equal(doc.rows[38].quantita, 39)
    assert.equal(doc.warnings.length, 0)
  })
}
test('G: precedenza totale esplicito (anche zero), prodotto se completo, altrimenti zero', () => {
  assert.equal(totaleVoceAnalizzata({ totale: 30, quantita: 2, prezzo: 10 }), 30)
  assert.equal(totaleVoceAnalizzata({ totale: 0, quantita: 2, prezzo: 10 }), 0)
  assert.equal(totaleVoceAnalizzata({ quantita: 2, prezzo: 10 }), 20)
  assert.equal(totaleVoceAnalizzata({ quantita: 2 }), 0)
  assert.equal(totaleVoceAnalizzata({ prezzo: 10 }), 0)
  assert.equal(totaleVoceAnalizzata({ quantita: NaN, prezzo: 10 }), 0)
})
test('H: header parziale e zero voci sono diagnosticati, righe non perse dal parser', async () => {
  const doc = await parseExcelDocument(fileFor([['U.M.', 'Quantità', 'Titolo ignoto'], ['mq', 2, 'Lavorazione']]))
  assert.equal(doc.rows.length, 1)
  assert.equal(doc.rows[0].rowType, 'altro')
  assert(doc.warnings.some((w) => w.includes('parzialmente') && w.includes('Descrizione')))
  assert(doc.warnings.some((w) => w.includes('nessuna lavorazione')))
})
test('header assente: warning visibile e compatibilità marcatori legacy', async () => {
  const doc = await parseExcelDocument(fileFor([['Testo non strutturato', 'VOCE'], ['Misura', 'MISURA']]))
  assert(doc.warnings.some((w) => w.includes('non riconosciuta')))
  assert.equal(doc.rows[0].rowType, 'voce')
  assert.equal(doc.rows[1].rowType, 'misura')
})
test('quantità zero valida e totale senza prezzo conservato', async () => {
  const doc = await parseExcelDocument(fileFor([[...headers, 'Totale €'], [...example('38.1', 0), 25]]))
  assert.equal(doc.rows[0].rowType, 'voce')
  assert.equal(doc.rows[0].quantita, 0)
  assert.equal(creaVoceAnalizzataExcel(doc.rows[0]).totale, 25)
})

const jsx = (type, props) => ({ type, props })
const text = (x) => Array.isArray(x) ? x.map(text).join('') : x?.props ? text(x.props.children) : x == null ? '' : String(x)
const nodes = (x, out = []) => {
  if (Array.isArray(x)) x.forEach((v) => nodes(v, out))
  else if (x?.props) { out.push(x); nodes(x.props.children, out) }
  return out
}
test('G/H UI: totale corretto e warning renderizzati; nessuna azione applicativa', () => {
  const Panel = load(path.join(app, 'components/DocumentIntelligencePanel.tsx'), {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    './DocumentDestinationSelector': {}, './DocumentUploadBox': {}, './ui/DocumentUnderstandingCard': {},
  }).default
  const tree = Panel({ fileAnalisiDocumento: {}, nomeFileAnalisiDocumento: 'computo.xlsx', testoEstrattoDocumento: '', importoRilevatoDocumento: '',
    vociAnalizzate: [{ totale: 30, quantita: 2, prezzo: 10 }, { quantita: 2, prezzo: 5 }, { quantita: 3 }],
    accettaExcel: true, warningsAnalisiDocumento: ['Nessuna lavorazione riconosciuta'], inputStyle: {}, caricaFileAnalisiDocumento() {} })
  assert(text(tree).includes((40).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })))
  assert(nodes(tree).some((n) => n.props.role === 'status' && text(n).includes('Nessuna lavorazione riconosciuta')))
})
test('totali PDF e altri pannelli invariati: fallback nuovo limitato al Fascicolo XLS/XLSX', () => {
  const Panel = load(path.join(app, 'components/DocumentIntelligencePanel.tsx'), {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    './DocumentDestinationSelector': {}, './DocumentUploadBox': {}, './ui/DocumentUnderstandingCard': {},
  }).default
  for (const props of [{ nomeFileAnalisiDocumento: 'scan.pdf', accettaExcel: true }, { nomeFileAnalisiDocumento: 'computo.xlsx', accettaExcel: false }]) {
    const tree = Panel({ ...props, fileAnalisiDocumento: {}, vociAnalizzate: [{ quantita: 2, prezzo: 10 }], inputStyle: {}, caricaFileAnalisiDocumento() {} })
    assert(text(tree).includes((0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })))
  }
})
test('input XLS/XLSX abilitato solo dove richiesto; invoca il loader una volta', async () => {
  const Upload = load(path.join(app, 'components/DocumentUploadBox.tsx'), { 'react/jsx-runtime': { jsx, jsxs: jsx } }).default
  let calls = 0
  const props = { titolo: 'Documenti', nomeFileAnalisiDocumento: '', inputStyle: {}, caricaFileAnalisiDocumento: async () => { calls++ } }
  const normal = nodes(Upload(props)).find((n) => n.type === 'input')
  assert(!normal.props.accept.includes('.xls'))
  const input = nodes(Upload({ ...props, accettaExcel: true })).find((n) => n.type === 'input')
  assert(input.props.accept.includes('.xlsx') && input.props.accept.includes('.xls'))
  const event = { target: { files: [fileFor([headers, example()])], value: 'selected' } }
  await input.props.onChange(event)
  assert.equal(calls, 1)
  assert.equal(event.target.value, '')
})
test('integrazione handler reale con Storage simulato: 39 voci, mapping e importo UI', async () => {
  const source = fs.readFileSync(path.join(app, 'page.tsx'), 'utf8')
  const body = source.slice(source.indexOf('const analizzaDocumentoCantiere ='), source.indexOf('const provaImportoDaPdf ='))
  const result = {}, alerts = []
  let uploads = 0
  const sandbox = {
    console: quiet, Date, Number, Math, analisiPreventivoRef: {}, cantiereSelezionatoDaId: { id: 'fixture' }, cantiereScheda: 'Fixture',
    supabase: { storage: { from: () => ({ upload: async () => { uploads++; return {} }, getPublicUrl: () => ({ data: { publicUrl: 'fixture' } }) }) } },
    parseExcelDocument, creaVoceAnalizzataExcel, totaleVoceAnalizzata, prezziarioSicilia: [], matchDocumentRowPrice: () => ({}),
    buildDocumentProfileFromText: () => ({}), buildDocumentInsights: () => ({}),
    alert: (message) => alerts.push(message),
  }
  for (const state of ['FileUrlAnalisi', 'FilePathAnalisi', 'FileTipoAnalisi', 'VociAnalizzate', 'WarningsAnalisiExcel', 'ImportoRilevatoDocumento', 'FileAnalisiDocumento', 'NomeFileAnalisiDocumento', 'TestoEstrattoDocumento', 'DocumentInsightsDocumento', 'AnalisiInCorso']) sandbox['set' + state] = (value) => { result[state] = value }
  vm.createContext(sandbox)
  vm.runInContext(ts.transpileModule(body + '\nglobalThis.run = analizzaDocumentoCantiere', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, sandbox)
  const file = fileFor([[...headers, 'Prezzo unitario €', 'Totale €'], ...Array.from({ length: 39 }, (_, i) => [i + 1, '2.2.1.1', `Lavorazione ${i + 1}`, '', 'mq', 2, '', 1, 10, 25])])
  await sandbox.run({ target: { files: [file] } })
  assert.equal(uploads, 1)
  assert.equal(alerts.length, 0)
  assert.equal(result.VociAnalizzate.length, 39)
  assert.equal(result.VociAnalizzate[0].codice, '2.2.1.1')
  assert.equal(result.VociAnalizzate[0].totale, 25)
  assert.equal(result.ImportoRilevatoDocumento, '975,00')
  assert.equal(result.WarningsAnalisiExcel.length, 0)
  assert.equal(result.AnalisiInCorso, false)
  assert(source.includes('warningsAnalisiDocumento: warningsAnalisiExcel'))
})
