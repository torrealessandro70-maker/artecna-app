/* eslint-disable @typescript-eslint/no-require-imports -- Pure local calendar/money fixtures, no database. */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript')
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, f)
const { nuovaBozzaScadenza, validaBozzaScadenza, applicaScadenzaLocale, riepilogaScadenze, bozzaDaScadenza, formattaImportoScadenza, TIPI_SCADENZA, STATI_SCADENZA } = require('./scadenziario.ts')
const bozza = (extra = {}) => ({ ...nuovaBozzaScadenza(), periodo: 'T4 fixture', dataScadenza: '2026-11-10', importo: '100,25', ...extra })
const voce = (id, extra = {}) => validaBozzaScadenza(bozza(extra), id)
const oggi = '2026-11-10'
test('all required types/statuses, no seeded dates or amounts', () => {
  assert.deepEqual([...TIPI_SCADENZA], ['IVA', 'INPS', 'INAIL', 'IRPEF', 'Ritenute', 'F24'])
  assert.deepEqual([...STATI_SCADENZA], ['Previsto', 'Da verificare', 'Da pagare', 'Pagato'])
  assert.equal(nuovaBozzaScadenza().dataScadenza, ''); assert.equal(nuovaBozzaScadenza().importo, '')
  assert.equal(nuovaBozzaScadenza().stato, 'Da verificare')
})
for (const [input, expected] of [['', null], ['  ', null], ['0', 0], ['0,01', 1], ['12.34', 1234], ['12,3', 1230], ['90071992547409.91', Number.MAX_SAFE_INTEGER]]) test('manual amount preserved exactly: ' + input, () => assert.equal(voce('x', { importo: input }).importoCentesimi, expected))
for (const input of ['-1', '1.234,50', '1,234.50', '1.001', '1e2', 'NaN', 'Infinity', '90071992547409.92']) test('reject ambiguous/negative/unsafe amount: ' + input, () => assert.throws(() => voce('x', { importo: input }), /Importo/))
test('exact cents survive edit and display without float rounding', () => {
  const r = voce('max', { importo: '90071992547409.91' }); assert.equal(bozzaDaScadenza(r).importo, '90071992547409.91')
  assert.equal(formattaImportoScadenza(r.importoCentesimi), '90.071.992.547.409,91 €')
  assert.equal(formattaImportoScadenza(null), 'Da verificare')
})
for (const extra of [{ periodo: '' }, { tipo: ' ' }, { dataScadenza: '2026-02-30' }, { dataScadenza: '' }, { stato: 'stimato' }, { includiNeiTotali: 'true' }, { nota: 'a'.repeat(2001) }]) test('invalid local record fails closed ' + JSON.stringify(extra).slice(0, 90), () => assert.throws(() => voce('x', extra)))
test('custom contribution is explicit; leap-day accepted only when real', () => {
  assert.equal(voce('x', { tipo: 'Cassa edile', dataScadenza: '2028-02-29' }).tipo, 'Cassa edile')
  assert.throws(() => voce('x', { dataScadenza: '2027-02-29' }))
})
test('today and exact 30/60/90-day endpoints included, next day excluded, cumulative windows', () => {
  const dates = ['2026-11-09', '2026-11-10', '2026-12-10', '2026-12-11', '2027-01-09', '2027-01-10', '2027-02-08', '2027-02-09']
  const r = riepilogaScadenze(dates.map((d, i) => voce(String(i), { dataScadenza: d, importo: '1' })), oggi)
  assert.equal(r.scadute, 1); assert.equal(r.entro30.centesimi, 200); assert.equal(r.entro60.centesimi, 400); assert.equal(r.entro90.centesimi, 600)
  assert.equal(r.prossima.dataScadenza, oggi); assert.equal(r.arretrati.centesimi, 100)
})
test('UTC calendar day arithmetic stays exact across daylight-saving boundary', () => {
  const r = riepilogaScadenze([voce('x', { dataScadenza: '2026-03-31', importo: '10' })], '2026-03-01')
  assert.equal(r.entro30.centesimi, 1000)
})
test('Pagato is omitted from open totals and next deadline; other manual states retained', () => {
  const rows = STATI_SCADENZA.map((stato, i) => voce(String(i), { stato, importo: '1' }))
  const r = riepilogaScadenze(rows, oggi); assert.equal(r.aperte, 3); assert.equal(r.entro30.centesimi, 300)
  assert.equal(riepilogaScadenze([rows[3]], oggi).prossima, null)
})
test('unknown amount is counted separately, no fake zero; explicit zero remains known', () => {
  const r = riepilogaScadenze([voce('1', { importo: '' }), voce('2', { importo: '0' }), voce('3', { importo: '1' })], oggi)
  assert.deepEqual(r.entro30, { centesimi: 100, note: 2, importiMancanti: 1, riepilogative: 0 })
})
test('summary F24 can stay operationally open without double-counting its component taxes', () => {
  const r = riepilogaScadenze([voce('iva', { importo: '100' }), voce('inps', { tipo: 'INPS', importo: '200' }), voce('f24', { tipo: 'F24', importo: '300', includiNeiTotali: false })], oggi)
  assert.equal(r.aperte, 3); assert.equal(r.entro30.centesimi, 30000); assert.equal(r.entro30.riepilogative, 1)
})
test('all-past deadlines remain explicitly overdue, none substituted as future', () => {
  const r = riepilogaScadenze([voce('past', { dataScadenza: '2026-11-09' })], oggi)
  assert.equal(r.prossima, null); assert.equal(r.scadute, 1); assert.equal(r.entro90.centesimi, 0)
})
test('chronological order stable, input not mutated', () => {
  const rows = [voce('z', { dataScadenza: '2026-12-01' }), voce('b'), voce('a')], original = JSON.stringify(rows)
  assert.deepEqual(riepilogaScadenze(rows, oggi).ordinate.map(r => r.id), ['a', 'b', 'z']); assert.equal(JSON.stringify(rows), original)
})
test('add/edit are immutable; update replaces one entry, no new duplicate', () => {
  const rows = [voce('a')], before = JSON.stringify(rows), changed = voce('a', { importo: '200' })
  assert.equal(applicaScadenzaLocale(rows, changed, 'a')[0].importoCentesimi, 20000); assert.equal(JSON.stringify(rows), before)
  assert.throws(() => applicaScadenzaLocale(rows, changed, null), /Identità/)
  assert.throws(() => applicaScadenzaLocale(rows, voce('b'), 'b'), /non trovata/)
  assert.throws(() => applicaScadenzaLocale(rows, voce('b'), null), /stesso tipo/)
})
test('unsafe aggregate cannot produce a plausible rounded total', () => {
  const r = riepilogaScadenze([voce('1', { importo: '90071992547409.91' }), voce('2', { importo: '1' })], oggi)
  assert.equal(r.entro30.centesimi, null)
})
test('invalid date, IDs, states and raw amounts cannot reach summary', () => {
  assert.throws(() => riepilogaScadenze([], '2026-02-30'))
  for (const extra of [{ importoCentesimi: -1 }, { importoCentesimi: NaN }, { stato: 'automatico' }, { dataScadenza: '' }, { includiNeiTotali: null }]) assert.throws(() => riepilogaScadenze([{ ...voce('x'), ...extra }], oggi))
  assert.throws(() => riepilogaScadenze([voce('x'), voce('x')], oggi))
})
