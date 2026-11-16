/* eslint-disable @typescript-eslint/no-require-imports -- Chrome fixture on loopback. */
const { test } = require('node:test')
const browser = require('./browser/attesi-page-browser.cjs')

test('Chrome carica il pannello Economia con sei varianti e una registrazione a zero esclusa', async () => {
  const cantiere = 'C'
  const varianti = Array.from({ length: 6 }, (_, i) => ({
    id: 'V' + i, cantiere_id: cantiere, preventivo_contrattuale_id: 'P',
    stato: 'approvata', importo_delta_approvato: 50,
  }))
  const motivo = 'Voce senza valore economico'
  const fonti = varianti.map((v, i) => {
    const raccolta = 'R' + i
    const registrazioni = [
      { id: 'lavoro', tipo_riga: 'manodopera', origine: 'rapportino', sorgente_id: null, indice_voce_sorgente: null, importo: 45, esclusa_proposta: false },
      { id: 'generica', tipo_riga: 'generica', origine: 'manuale', sorgente_id: null, indice_voce_sorgente: null, importo: 5, esclusa_proposta: false },
    ]
    if (i === 4) registrazioni.push({
      id: 'esclusa', tipo_riga: 'materiale', origine: 'file', sorgente_id: 'file',
      indice_voce_sorgente: 0, importo: 0, quantita: 1, prezzo_unitario: 0, esclusa_proposta: true,
      dettagli_analitici: { proposta_non_economica: { versione: 1, esclusa: true, motivo, storico: [{ esclusa: true, motivo }] } },
    })
    return {
      id: 'S' + i, variante_id: v.id, tipo: 'raccolta_economia', economia_raccolta_id: raccolta,
      economia_revisione_sorgente: 1, economia_revisione_congelata: 2, snapshot_version: 1,
      snapshot: { raccolta_id: raccolta, cantiere_id: cantiere, revisione_sorgente: 1, revisione_congelata: 2,
        totale: 50, versione_prezzi_cliente: 1, versione_esclusioni: 1, numero_registrazioni: registrazioni.length,
        numero_incluse: 2, numero_escluse: registrazioni.length - 2, registrazioni },
    }
  })
  const risposte = {
    varianti: () => varianti,
    sorgenti: id => fonti.filter(s => s.variante_id === id),
    dettaglio: id => fonti.find(s => s.id === id),
  }
  await browser(async (chiave, args) => risposte[chiave](...args), cantiere, {
    entry: 'economia-varianti-entry.mjs', owner: 'U', modes: ['economia'],
    commands: {
      leggi_varianti_cantiere: ['varianti', 'p_cantiere_id'],
      leggi_sorgenti_variante: ['sorgenti', 'p_variante_id'],
      leggi_sorgente_variante: ['dettaglio', 'p_sorgente_id'],
    },
  })
})
