import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
function importa(file, dipendenze = {}) {
  const exports = {}
  new Function('exports', 'require', ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(exports, nome => dipendenze[nome])
  return exports
}
const accordi = importa('./accordiContrattuali.ts')
const contratti = importa('./contrattiAggiornati.ts', { './accordiContrattuali': accordi })
const righe = [850, 750].map((v, i) => ({ id: i + 1, ordine: i + 1, descrizione: 'Voce verificata', quantita: 1,
  unita_misura: 'corpo', prezzo_unitario: v, importo_previsto: v, importo_contrattuale: v * 0.75,
  prezzo_unitario_contrattuale: v * 0.75, conguaglio: 0 }))
const snapshot = { versione: 1, richiesta: 'fixture', revisione: 1, preventivo_id: 'P', cantiere_id: 'C',
  totale_originale: 1600, importo_concordato: 1200, ribasso_percentuale: 25, righe }
const doc = { id: 'P', cantiere_id: 'C', importo_totale: 800, accordo_contrattuale: snapshot }

test('Ribasso verificato usa il concordato e preserva il totale documentale e le varianti', () => {
  assert.equal(accordi.importoContrattoPreventivo(doc), 1200)
  assert.equal(doc.importo_totale, 800)
  assert.equal(contratti.baseContrattuale({ id: 'C', preventivo_contrattuale_id: 'P' }, doc).importo, 1200)
  assert.equal(contratti.contrattoAggiornato({ preventivoId: 'P', importo: 1200 },
    { stato: 'verificato', scomposizione: { totale: 227.46 } }).aggiornato, 1427.46)
  assert.equal(accordi.importoContrattoPreventivo({ ...doc, accordo_contrattuale: null }), 800)
})
test('Snapshot alterati, doppioni, precisione e importi sconosciuti restano non verificabili', () => {
  for (const a of [
    { ...snapshot, cantiere_id: 'ALTRO' },
    { ...snapshot, importo_concordato: 1199 },
    { ...snapshot, righe: [righe[0], righe[0]] },
    { ...snapshot, righe: [{ ...righe[0], importo_contrattuale: 637.501 }, righe[1]] },
    { ...snapshot, righe: [] },
  ]) assert.equal(accordi.importoContrattoPreventivo({ ...doc, accordo_contrattuale: a }), null)
  assert.equal(accordi.importoContrattoPreventivo({ importo_totale: null }), null)
})
test('Prodotti decimali e arrotondamento half-up indipendenti dalla virgola mobile', () => {
  assert.equal(accordi.importoOriginaleVoce('1', '1.005'), 1.01)
  assert.equal(accordi.importoOriginaleVoce('2,5', '3,333333'), 8.33)
  assert.throws(() => accordi.importoOriginaleVoce('', '3'))
  assert.throws(() => accordi.importoOriginaleVoce('1', '0.0000001'))
})

test('Contratti verificati TESTA e PIDATELLA mantengono i delta approvati senza ribasso', () => {
  for (const [importo, delta, aggiornato] of [[31438.4, 8079.45, 39517.85], [21700, 1050.05, 22750.05]]) {
    const base = contratti.baseContrattuale({ id: 'C', preventivo_contrattuale_id: 'P' }, { id: 'P', cantiere_id: 'C', importo_totale: importo })
    assert.equal(contratti.contrattoAggiornato(base, { stato: 'verificato', scomposizione: { totale: delta } }).aggiornato, aggiornato)
  }
})

test('Stampa SAL espone originali, ribasso e importi concordati senza alterare il maturato', () => {
  const stampa = importa('../../utils/stampaSalCliente.ts')
  const dati = { cantiere: 'Pernicone sintetico', preventivoContrattuale: { nome: 'Originale.pdf', importo: 1200 },
    accontiRicevuti: 0, contratto: { incrementi: 0, riduzioni: 0, aggiornamenti: [] },
    righe: righe.map(r => ({ descrizione: r.descrizione, importoContrattuale: r.importo_contrattuale,
      percentuale: 50, importoMaturato: r.importo_contrattuale / 2, accordo: { ...r, ribasso_percentuale: 25 } })) }
  assert.equal(stampa.calcolaStampaSal(dati, { detrazioneAccontoPercentuale: 0, ivaPercentuale: 0 }).totaleMaturato, 600)
  const html = stampa.documentoSalCliente(dati, { detrazioneAccontoPercentuale: 0, ivaPercentuale: 0 })
  assert.ok(html.includes('850,00') && html.includes('637,50') && html.includes('Ribasso 25%'))
  assert.ok(html.includes('562,50') && html.includes('Conguaglio'))
})
