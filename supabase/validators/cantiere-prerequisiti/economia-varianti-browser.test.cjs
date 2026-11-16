/* eslint-disable @typescript-eslint/no-require-imports -- Chrome fixture on loopback. */
const { test } = require('node:test')
const browser = require('./browser/attesi-page-browser.cjs')
const assert = require('node:assert/strict')

test('Chrome: Home, Panoramica ed Economia riusano il contratto e rispettano il proprio perimetro di costo', async () => {
  let letture = 0
  const v = (id, importo, stato = 'approvata') => ({
    id, cantiere_id: 'C', preventivo_contrattuale_id: 'P', stato, importo_delta_approvato: importo,
  })
  const approvate = [1200, 2000, 550, 1000, 3000, 101.99].map((importo, i) => v('V' + i, importo))
  await browser(async chiave => {
    if (chiave === 'rettifiche') return {
      quote: [], rettifiche: [{ id: 'N', materiale_cantiere_id: 'M', importo_costo: -100 }], perimetro: 'Fixture TD04',
    }
    if (chiave === 'varianti') return [...approvate, v('Bozza', 227.46, ++letture === 1 ? 'bozza' : 'approvata')]
    return []
  }, 'C', {
    entry: 'contratti-dashboard-entry.mjs', owner: 'U', modes: ['contratti'],
    commands: {
      leggi_varianti_cantiere: ['varianti', 'p_cantiere_id'],
      leggi_sorgenti_variante: ['sorgenti', 'p_variante_id'],
      leggi_costi_fornitori_rettificati: ['rettifiche', 'p_cantiere_id'],
      leggi_raccolte_economia: ['raccolte', 'p_cantiere_id'],
    },
  })
  // Le due letture del contratto sono prima e dopo invalidazione. Gli eventuali
  // controlli successivi sono del dettaglio operativo, indipendente dal contratto.
  assert.ok(letture >= 2)
})

test('Chrome carica il pannello Economia con sei varianti e una registrazione a zero esclusa', async () => {
  const cantiere = 'C'
  const varianti = Array.from({ length: 6 }, (_, i) => ({
    id: 'V' + i, cantiere_id: cantiere, preventivo_contrattuale_id: 'P',
    stato: 'approvata', importo_delta_approvato: 50,
  }))
  const motivo = 'Voce senza valore economico'
  const fattura = { version: 1, fattura_riga_id: 'F', quantita: 1, prezzo_unitario_originale: 8,
    prezzo_unitario_economia: 0, totale_economia: 0, unita_misura_economia: 'pz', data_fattura: '2026-10-05' }
  const esclusa = {
    id: 'esclusa', raccolta_id: 'R4', tipo_riga: 'materiale', origine: 'fattura_fornitore', sorgente_id: 'fonte-fattura',
    indice_voce_sorgente: null, fattura_riga_id: 'F', quantita: 1, prezzo_unitario: 0, descrizione: 'Esclusa sintetica', unita_misura: 'pz',
    dettagli_analitici: { fattura, proposta_non_economica: { versione: 1, esclusa: true, motivo, storico: [{ esclusa: true, motivo }] } },
  }
  const fonti = varianti.map((v, i) => {
    const raccolta = 'R' + i
    const registrazioni = [
      { id: 'lavoro', tipo_riga: 'manodopera', origine: 'rapportino', sorgente_id: null, indice_voce_sorgente: null, importo: 45, esclusa_proposta: false },
      { id: 'generica', tipo_riga: 'generica', origine: 'manuale', sorgente_id: null, indice_voce_sorgente: null, importo: 5, esclusa_proposta: false },
    ]
    if (i === 4) registrazioni.push({ ...esclusa, importo: 0, esclusa_proposta: true })
    return {
      id: 'S' + i, variante_id: v.id, tipo: 'raccolta_economia', economia_raccolta_id: raccolta,
      economia_revisione_sorgente: 1, economia_revisione_congelata: 2, snapshot_version: 1,
      snapshot: { raccolta_id: raccolta, cantiere_id: cantiere, revisione_sorgente: 1, revisione_congelata: 2,
        totale: 50, versione_prezzi_cliente: 1, versione_esclusioni: 1, numero_registrazioni: registrazioni.length,
        numero_incluse: 2, numero_escluse: registrazioni.length - 2, registrazioni },
    }
  })
  const raccolta = { id: 'R4', cantiere_id: cantiere, stato: 'chiusa', revisione: 2 }
  const risposte = {
    varianti: () => varianti,
    sorgenti: id => fonti.filter(s => s.variante_id === id),
    dettaglio: id => fonti.find(s => s.id === id),
    raccolte: async () => {
      await new Promise(resolve => setTimeout(resolve, 500))
      return [raccolta]
    },
    raccolta: () => ({ raccolta, righe: [esclusa], sorgenti: [{
      id: esclusa.sorgente_id, raccolta_id: raccolta.id, tipo: 'fattura_fornitore', formato: 'fattura', snapshot_version: 1, snapshot: fattura,
    }] }),
  }
  const contesto = {
    entry: 'economia-varianti-entry.mjs', owner: 'U',
    commands: {
      leggi_varianti_cantiere: ['varianti', 'p_cantiere_id'],
      leggi_sorgenti_variante: ['sorgenti', 'p_variante_id'],
      leggi_sorgente_variante: ['dettaglio', 'p_sorgente_id'],
      leggi_raccolte_economia: ['raccolte', 'p_cantiere_id'],
      leggi_raccolta_economia: ['raccolta', 'p_raccolta_id'],
    },
  }
  await browser(async (chiave, args) => risposte[chiave](...args), cantiere, { ...contesto, modes: ['economia'] })
  await browser(async (chiave, args) => {
    const risultato = await risposte[chiave](...args)
    if (chiave === 'raccolte') throw Object.assign(Error('Fixture RPC'), { code: '42501' })
    return risultato
  }, cantiere, { ...contesto, modes: ['economia-errore'] })
})


test('Chrome: classifica per UUID solo dopo conferma e aggiorna i gruppi Home', async () => {
  await browser(async () => [], 'C', { entry: 'classificazione-cantieri-entry.mjs', owner: 'U', modes: ['classificazione'] })
})
