/* eslint-disable @typescript-eslint/no-require-imports -- Offline fiscal fixtures, no database or network. */
const test = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), ts = require('typescript')
const { SaxesParser } = require('saxes')
// DOM adapter backed by a real namespace-aware XML parser, not regex extraction.
class XmlNode {
  constructor(name = '') { this.localName = name; this.children = []; this.parts = [] }
  get textContent() { return this.parts.map(p => typeof p === 'string' ? p : p.textContent).join('') }
  getElementsByTagNameNS(ns, name) { return this.children.flatMap(c => [...(c.localName === name ? [c] : []), ...c.getElementsByTagNameNS(ns, name)]) }
}
global.DOMParser = class {
  parseFromString(raw) {
    const doc = new XmlNode(), stack = [doc], parser = new SaxesParser({ xmlns: true })
    parser.on('opentag', tag => { const n = new XmlNode(tag.local); stack.at(-1).children.push(n); stack.at(-1).parts.push(n); stack.push(n) })
    parser.on('closetag', () => stack.pop())
    for (const event of ['text', 'cdata']) parser.on(event, text => stack.at(-1).parts.push(text))
    try { parser.write(raw).close(); return doc } catch { const bad = new XmlNode(); bad.children.push(new XmlNode('parsererror')); return bad }
  }
}
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file)
const { preparaArchivioIva, costruisciProspettoIva } = require('./prospettoIva.ts')
const { fontiInCaricamento } = require('./riepilogo.ts')
const periodo = { da: '2026-01-01', a: '2026-03-31' }
const gruppo = ({ base = '100.00', iva = '22.00', rate = '22.00', extra = '' } = {}) => `<DatiRiepilogo><AliquotaIVA>${rate}</AliquotaIVA><ImponibileImporto>${base}</ImponibileImporto><Imposta>${iva}</Imposta>${extra}</DatiRiepilogo>`
const xml = ({ tipo = 'TD01', valuta = 'EUR', numero = '1', data = '2026-01-12', gruppi = gruppo() } = {}) => `<p:FatturaElettronica xmlns:p="urn:fixture"><FatturaElettronicaHeader><CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>fixture</IdCodice></IdFiscaleIVA></DatiAnagrafici></CedentePrestatore></FatturaElettronicaHeader><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>${tipo}</TipoDocumento><Divisa>${valuta}</Divisa><Numero>${numero}</Numero><Data>${data}</Data></DatiGeneraliDocumento></DatiGenerali><DatiBeniServizi>${gruppi}</DatiBeniServizi></FatturaElettronicaBody></p:FatturaElettronica>`
const ricevuta = (overrides = {}) => ({ id: 'r1', numero_fattura: '1', data_fattura: '2026-01-12', xml_testo: xml(), ...overrides })
const manuale = (overrides = {}) => ({ id: 'e1', numero_fattura: '1', cliente: 'Cliente fixture', data_fattura: '2026-01-12', imponibile: '100.00', iva: '22', totale: '122.00', ...overrides })
function fonti(emesse = [], ricevute = []) { return { ...fontiInCaricamento(), fatture_emesse: { stato: 'pronta', righe: emesse }, fatture_fornitori: { stato: 'pronta', righe: ricevute } } }
const calcola = (f, p = periodo) => costruisciProspettoIva(preparaArchivioIva(f), p)
const doc = (r, fonte = 'fatture_fornitori') => preparaArchivioIva(fonti(fonte === 'fatture_emesse' ? [r] : [], fonte === 'fatture_fornitori' ? [r] : [])).documenti[0]

test('multiple XML tax summaries are summed once, never only the first rate', () => {
  const d = doc(ricevuta({ xml_testo: xml({ gruppi: gruppo() + gruppo({ base: '50', iva: '5', rate: '10' }) }) }))
  assert.equal(d.iva, 2700); assert.equal(d.limitato, false)
})
test('manual rate is a percentage only with explicit coherent base and total; coverage stays limited', () => {
  const p = calcola(fonti([manuale()], [ricevuta()]))
  assert.equal(p.totale.emesse.valore, 2200); assert.equal(p.totale.ricevute.valore, 2200)
  assert.equal(p.totale.differenza, 0); assert.equal(p.totale.stato, 'Limitato')
})
for (const overrides of [{ xml_url: 'https://example.invalid/xml' }, { note: 'Import XML Bluenext' }, { tipo_file: 'xml' }]) test('ambiguous issued XML field is excluded ' + JSON.stringify(overrides), () => {
  const d = doc(manuale(overrides), 'fatture_emesse'); assert.equal(d.iva, null); assert.match(d.motivo, /ambiguo/)
})
for (const overrides of [{ iva: null }, { iva: '' }, { imponibile: null }, { totale: '100' }, { iva: '22,00' }, { iva: '22.123' }, { imponibile: '-100', totale: '-122' }, { cliente: '' }]) test('unverifiable manual inputs never fabricate VAT ' + JSON.stringify(overrides), () => assert.equal(doc(manuale(overrides), 'fatture_emesse').iva, null))
test('PDF/OCR and total-only supplier records are excluded, not divided by 1.22', () => {
  const d = doc(ricevuta({ xml_testo: null, pdf_testo: 'IVA 22%', importo_totale: '122' }))
  assert.equal(d.iva, null); assert.match(d.motivo, /PDF, OCR/)
})
test('explicit XML exemption is zero, missing tax field is not zero', () => {
  assert.equal(doc(ricevuta({ xml_testo: xml({ gruppi: gruppo({ rate: '0', iva: '0', extra: '<Natura>N4</Natura>' }) }) })).iva, 0)
  assert.equal(doc(ricevuta({ xml_testo: xml().replace('<Imposta>22.00</Imposta>', '') })).iva, null)
})
for (const tipo of ['TD04']) for (const sign of ['', '-']) test('credit document sign is applied once ' + sign, () => {
  assert.equal(doc(ricevuta({ xml_testo: xml({ tipo, gruppi: gruppo({ base: sign + '100', iva: sign + '22' }) }) })).iva, -2200)
})
for (const [name, raw] of [
  ['foreign currency', xml({ valuta: 'USD' })], ['special type', xml({ tipo: 'TD17' })],
  ['date mismatch', xml({ data: '2026-02-01' })], ['number mismatch', xml({ numero: '2' })],
  ['missing summary', xml({ gruppi: '' })], ['arithmetic mismatch', xml({ gruppi: gruppo({ iva: '23' }) })],
  ['mixed signs', xml({ tipo: 'TD04', gruppi: gruppo() + gruppo({ base: '-100', iva: '-22' }) })],
  ['ordinary negative', xml({ gruppi: gruppo({ base: '-100', iva: '-22' }) })],
  ['missing nature', xml({ gruppi: gruppo({ rate: '0', iva: '0' }) })],
  ['broken XML', xml().slice(0, -5)], ['multiple bodies', xml().replace('</p:FatturaElettronica>', '<FatturaElettronicaBody/></p:FatturaElettronica>')],
  ['entity declaration', '<!DOCTYPE x [<!ENTITY x "secret">]>' + xml()],
]) test('XML fails closed: ' + name, () => assert.equal(doc(ricevuta({ xml_testo: raw })).iva, null))
test('split/deferred VAT is document-only and explicitly limited', () => {
  const d = doc(ricevuta({ xml_testo: xml({ gruppi: gruppo({ extra: '<EsigibilitaIVA>S</EsigibilitaIVA>' }) }) }))
  assert.equal(d.iva, 2200); assert(d.limitato)
})
test('duplicate IDs and duplicate fiscal identities are excluded rather than silently chosen', () => {
  for (const records of [[ricevuta(), ricevuta()], [ricevuta(), ricevuta({ id: 'r2' })]]) {
    const p = calcola(fonti([], records)); assert.equal(p.totale.ricevute.valore, null); assert.equal(p.totale.ricevute.esclusi, 2)
  }
})
test('ready empty sources mean document zero; unavailable sources never do', () => {
  assert.equal(calcola(fonti()).totale.differenza, 0)
  for (const stato of ['errore', 'caricamento', 'parziale']) { const f = fonti(); f.fatture_fornitori.stato = stato; assert.equal(calcola(f).totale.differenza, null) }
})
test('partial valid totals retain counts and limited state', () => {
  const f = fonti([], [ricevuta(), ricevuta({ id: 'bad', numero_fattura: 'bad', xml_testo: null })]); f.fatture_fornitori.stato = 'parziale'
  const t = calcola(f).totale; assert.equal(t.ricevute.valore, 2200); assert.equal(t.ricevute.esclusi, 1); assert.equal(t.stato, 'Limitato')
})
test('undated documents prevent false complete zero in every month', () => {
  const p = calcola(fonti([], [ricevuta({ data_fattura: '' })]))
  assert(p.righe.every(r => r.differenza === null && r.ricevute.nonDatati === 1))
})
test('monthly chain and quarterly subtotal do not double-count; period starts cumulative at zero', () => {
  const f = fonti([manuale(), manuale({ id: 'feb', numero_fattura: '2', data_fattura: '2026-02-01', imponibile: '200', totale: '244' })])
  const p = calcola(f); assert.deepEqual(p.righe.map(r => r.accumulata), [2200, 6600, 6600, 6600]); assert.equal(p.totale.differenza, 6600)
  assert.equal(calcola(f, { da: '2026-02-01', a: '2026-02-28' }).totale.accumulata, 4400)
})
test('null month breaks cumulative permanently, even when following month is available', () => {
  const p = calcola(fonti([], [ricevuta({ xml_testo: null })]))
  assert.equal(p.righe[1].differenza, 0); assert(p.righe.every(r => r.accumulata === null))
})
test('year view has 12 months and 4 quarter subtotals; clipped dates stay exact', () => {
  const p = calcola(fonti(), { da: '2026-01-01', a: '2026-12-31' }); assert.equal(p.righe.length, 16)
  const partial = calcola(fonti([manuale()]), { da: '2026-01-15', a: '2026-02-10' }); assert.equal(partial.totale.differenza, 0)
  assert.equal(partial.righe.at(-1).periodo.da, '2026-01-15'); assert.equal(partial.righe.at(-1).periodo.a, '2026-02-10')
})
test('invalid ranges and unsafe monetary precision are non determinable', () => {
  assert.equal(calcola(fonti(), { da: '2026-02-30', a: '2026-03-01' }).totale, null)
  assert.equal(calcola(fonti(), { da: '2026-04-01', a: '2026-03-01' }).totale, null)
  assert.equal(doc(manuale({ imponibile: '9999999999999999', totale: '9999999999999999' }), 'fatture_emesse').iva, null)
})
test('calculation leaves all source rows and reader snapshot unchanged', () => { const f = fonti([manuale()], [ricevuta()]); const before = JSON.stringify(f); calcola(f); assert.equal(JSON.stringify(f), before) })

module.exports = { fonti, manuale, ricevuta, periodo }
