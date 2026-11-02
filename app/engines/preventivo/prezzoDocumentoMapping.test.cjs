/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS node:test harness loads the application TypeScript in memory. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { execFileSync } = require('node:child_process')
const app = path.resolve(__dirname, '../..')
const quiet = { log() {}, table() {}, group() {}, groupEnd() {}, warn() {} }
const cache = new Map()
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const loaded = { exports: {} }
  cache.set(file, loaded.exports)
  const localRequire = (id) => {
    if (!id.startsWith('.')) return require(id)
    const target = path.resolve(path.dirname(file), id)
    return load([target + '.ts', path.join(target, 'index.ts')].find(fs.existsSync))
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: loaded, exports: loaded.exports, require: localRequire, console: quiet, Date, Number, Math, Set })
  cache.set(file, loaded.exports)
  return loaded.exports
}
const { resolvePrice } = load(path.join(app, 'engines/price-resolution/resolver.ts'))
const { createPreventivoRevision } = load(path.join(__dirname, 'index.ts'))
const { esitoDiagnosticaVoce } = load(path.join(app, 'engines/price-resolution/diagnostica-voce.ts'))

// Executes the real conversion up to the physical fence before any persistence.
function convert(vociAnalizzate, prezziarioSicilia) {
  const source = fs.readFileSync(path.join(app, 'page.tsx'), 'utf8')
  const start = source.indexOf('const generaPreventivoDaDocumentoAnalizzato =')
  const end = source.indexOf('  const { data: preventivoDocumentoCreato', start)
  assert(start >= 0 && end > start)
  const prefix = source.slice(start, end)
  assert(!prefix.includes('supabase'))
  const sandbox = { console: quiet, resolvePrice, createPreventivoRevision, vociAnalizzate, prezziarioSicilia, nomeFileAnalisiDocumento: 'fixture.xlsx' }
  vm.createContext(sandbox)
  vm.runInContext(ts.transpileModule(prefix + '\nreturn { vociRisolte, preventivoRevision, vociDocumento }; }\nglobalThis.run = generaPreventivoDaDocumentoAnalizzato;', {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, sandbox)
  return sandbox.run({ id: 'fixture-no-db' })
}
const words = (prefix, n) => Array.from({ length: n }, (_, i) => prefix + String(i).padStart(3, '0'))
const tramezzi = words('tramezzi', 35), massetto = words('massetto', 62), pittura = ['tinteggiatura', 'pareti', 'finitura']
const fixtures = [
  { name: 'A 97,1%', tokens: tramezzi, reference: tramezzi.slice(0, 34), codice: '2.2.1.1', quantita: 84.81, prezzo: 30.3, confidence: 34 / 35 },
  { name: 'B 98,4%', tokens: massetto, reference: massetto.slice(0, 61), codice: '38.20', quantita: 140, prezzo: 21.71, confidence: 61 / 62 },
  { name: 'C similarity 100%', tokens: pittura, reference: pittura, codice: '38.28', quantita: 350, prezzo: 8.18, confidence: 1 },
]
function input(f, extra = {}) { return { codice: f.codice, descrizione: f.tokens.join(' '), unita: 'mq', quantita: f.quantita, ...extra } }
function reference(f) { return { codice: 'SIC24_' + f.codice, descrizione: f.reference.join(' '), unita_misura: 'mq', prezzo_unitario: f.prezzo } }
for (const f of fixtures) {
  test(`${f.name}: prezzo canonico, diagnostica e totale revisione coerenti senza alias iniziale`, async () => {
    const result = await convert([input(f)], [reference(f)])
    const voce = result.vociDocumento[0], resolved = result.vociRisolte[0], revision = result.preventivoRevision.voci[0]
    assert.equal(voce.priceResolution.strategy, 'similarity')
    assert.equal(voce.priceResolution.confidence, f.confidence)
    assert.equal(voce.priceResolution.prezzoUnitarioCandidato, f.prezzo)
    assert.equal(voce.priceResolution.prezzoUnitarioRisolto, f.prezzo)
    assert.equal(resolved.prezzo, f.prezzo)
    assert.equal(resolved.prezzo_unitario, f.prezzo)
    assert.equal(resolved.prezzoUnitario, f.prezzo)
    assert.equal(revision.prezzoUnitario, f.prezzo)
    assert.equal(voce.prezzo_unitario, f.prezzo)
    assert.equal(revision.totale, f.quantita * f.prezzo)
    assert.equal(esitoDiagnosticaVoce(voce), 'resolved')
  })
}
test('D: prezzo documento prioritario, candidato matching conservato separatamente', async () => {
  const f = fixtures[0], result = await convert([input(f, { prezzo: 42, prezzo_unitario: 42 })], [reference(f)])
  const voce = result.vociDocumento[0]
  assert.equal(voce.prezzo_unitario, 42)
  assert.equal(voce.priceResolution.prezzoUnitarioRisolto, 42)
  assert.equal(voce.priceResolution.prezzoUnitarioCandidato, 30.3)
  assert.equal(voce.priceResolution.matched, true)
  assert.equal(result.preventivoRevision.voci[0].totale, 84.81 * 42)
  assert.equal(esitoDiagnosticaVoce(voce), 'resolved')
})
test('alias iniziale a zero non nasconde il prezzo canonico risolto', async () => {
  const f = fixtures[0], r = await convert([input(f, { prezzo: 0, prezzo_unitario: 0 })], [reference(f)])
  assert.equal(r.preventivoRevision.voci[0].prezzoUnitario, 30.3)
})
test('E: no_match senza prezzo conserva zero e categoria Non risolta', async () => {
  const r = await convert([{ descrizione: 'nessuna corrispondenza', quantita: 3, unita: 'mq' }], [])
  const v = r.vociDocumento[0]
  assert.equal(v.prezzo_unitario, 0)
  assert.equal(v.priceResolution.prezzoUnitarioRisolto, 0)
  assert.equal(v.priceResolution.prezzoUnitarioCandidato, undefined)
  assert.equal(r.preventivoRevision.voci[0].totale, 0)
  assert.equal(esitoDiagnosticaVoce(v), 'unresolved')
})
test('matching assente e prezzo documento disponibile restano informazioni distinte', async () => {
  const r = await convert([{ descrizione: 'prezzo documentale', quantita: 2, unita: 'mq', prezzo: 12 }], [])
  assert.equal(r.vociDocumento[0].prezzo_unitario, 12)
  assert.equal(r.vociDocumento[0].priceResolution.matched, false)
  assert.equal(esitoDiagnosticaVoce(r.vociDocumento[0]), 'unresolved')
})
test('F: match trovato ma prezzo perso, non valido o incoerente va in review senza cancellare il match', () => {
  for (const applied of [undefined, 0, NaN, Infinity, -1, 20]) {
    const v = { prezzo_unitario: applied, priceResolution: { matched: true, strategy: 'similarity', confidence: 0.984, prezzoUnitarioRisolto: 21.71 } }
    assert.equal(esitoDiagnosticaVoce(v), 'review')
    assert.equal(v.priceResolution.matched, true)
    assert.equal(v.priceResolution.prezzoUnitarioRisolto, 21.71)
  }
  assert.equal(esitoDiagnosticaVoce({ prezzo_unitario: 21.71, priceResolution: { matched: true, confidence: 0.984, prezzoUnitarioRisolto: 21.71 } }), 'resolved')
})
test('categorie legacy con prezzo disponibile, confidence e modifica manuale preservate', () => {
  assert.equal(esitoDiagnosticaVoce({ prezzo_unitario: 10, priceResolution: { matched: true, confidence: 0.98 } }), 'resolved')
  assert.equal(esitoDiagnosticaVoce({ prezzo_unitario: 10, priceResolution: { matched: true, confidence: 0.8 } }), 'review')
  assert.equal(esitoDiagnosticaVoce({ priceResolutionInvalidated: true }), 'modified')
})
test('G: 39 righe equivalenti, tre prezzi applicati e subtotale 8.472,14 €', async () => {
  const inputs = [...fixtures.map(f => input(f)), ...Array.from({ length: 36 }, (_, i) => ({ descrizione: 'zznomatch' + i, quantita: 1, unita: 'mq' }))]
  const r = await convert(inputs, fixtures.map(reference))
  assert.equal(r.vociDocumento.length, 39)
  assert.equal(r.vociDocumento.filter(v => v.prezzo_unitario > 0).length, 3)
  const stats = r.vociDocumento.reduce((s, v) => { s[esitoDiagnosticaVoce(v)]++; return s }, { resolved: 0, review: 0, unresolved: 0, modified: 0 })
  assert.deepEqual(stats, { resolved: 3, review: 0, unresolved: 36, modified: 0 })
  assert.equal(Number(r.preventivoRevision.totals.imponibile.toFixed(2)), 8472.14)
  assert.notEqual(r.preventivoRevision.totals.imponibile, 2863)
})
test('prezzi non finiti non diventano importi applicati', async () => {
  const r = await convert([{ descrizione: 'test', quantita: 2, unita: 'mq', prezzo: Infinity }], [])
  assert.equal(r.preventivoRevision.voci[0].prezzoUnitario, 0)
})
test('strategie, soglie, normalizzazione, parser, PDF e archiviazione invariati', () => {
  const root = path.resolve(app, '..'), base = 'f34533ceea0b0cae9ea8bfd8e08dacbd8741cb88'
  const old = file => execFileSync('git', ['show', `${base}:${file}`], { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n')
  for (const file of ['app/engines/price-resolution/resolver.ts', 'app/engines/price-resolution/normalizer.ts',
    'app/engines/price-resolution/similarity.ts', ...['index', 'similarity', 'exact-code', 'normalized-code', 'description', 'description-unit'].map(f => `app/engines/price-resolution/strategies/${f}.ts`),
    'app/engines/confidence/confidence.ts', 'app/engines/document-parser/excel.ts', 'app/engines/document-parser/voci-analizzate.ts',
    'app/engines/document-intelligence/pdf-ocr.ts', 'app/components/DocumentiCantierePanel.tsx', 'app/engines/preventivo/document-adapter.ts']) {
    assert.equal(fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n'), old(file), file)
  }
})
