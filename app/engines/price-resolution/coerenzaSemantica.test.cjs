/* eslint-disable @typescript-eslint/no-require-imports -- Offline tests, only the pricing engine is loaded. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const vm = require('node:vm')

const modules = new Map()
function load(file) {
  if (modules.has(file)) return modules.get(file)
  const exports = {}
  modules.set(file, exports)
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  vm.runInNewContext(outputText, { exports, require(name) {
    assert(name.startsWith('.'), 'Solo moduli locali')
    const target = path.resolve(path.dirname(file), name)
    return load(fs.existsSync(target + '.ts') ? target + '.ts' : path.join(target, 'index.ts'))
  } })
  return exports
}
const api = load(path.join(__dirname, 'stima-documento-ai.ts'))
const sem = load(path.join(__dirname, 'coerenza-semantica.ts'))
const voce = { descrizione: 'Posa sola finitura', unita_misura: 'mq', quantita: 2,
  prezzo_unitario: 0, bozzaDocumento: true, priceResolution: { matched: false, strategy: 'no_match' } }

function risposta(r, modifiche = {}) {
  return {
    id: r.id, tipo: 'stima_artecna_ai', stato_stima: 'proposta', affidabilita: 'bassa',
    prezzo_unitario_proposto: 30, unita_interpretata: r.unita, quantita_strutturata: r.quantita,
    quantita_coperta_dal_prezzo: 1, totale_riga_proposto: 30 * r.quantita, totale_riga_previsto: 30 * r.quantita,
    lavorazione_composita: r.composita, motivazione: 'Stima autonoma per singolo corpo.',
    avvisi: [], riferimenti_utilizzati: [], riferimenti_ancoraggio: [], scorporo_fornitura: null,
    unita_economica: { descrizione: 'Un singolo corpo', base_documentale: r.descrizione },
    esclusioni_componenti: [], metodo_calcolo: 'analisi_unitaria', prezzo_unitario_derivato: 30, totale_componenti: 30,
    componenti_economiche: [
      { categoria: 'posa', descrizione: 'Installazione', importo_unitario: 20 },
      { categoria: 'opere_accessorie', descrizione: 'Collaudo', importo_unitario: 10 },
    ].map(c => ({ ...c, riferimento_id: null, quantita_tecnica: 0.5, unita_tecnica: 'h',
      costo_unitario: c.importo_unitario * 2, subtotale: c.importo_unitario, metodo_calcolo: 'ore_squadra',
      origine_costo: { tipo: 'ipotesi_tecnica_esplicita', descrizione: 'Costo stimato per ora di lavoro della squadra.', base_documentale: null } })),
    ...modifiche,
  }
}

async function applica(v, modifica) {
  const i = api.preparaInputStimeDocumento([v], [])
  const s = risposta(i.righe[0])
  modifica?.(s)
  const esito = await api.eseguiStimeDocumento(i, async () => JSON.stringify({ stime: [s] }))
  return api.applicaStimeDocumento([v], i, esito)[0]
}
function astensione(s, motivo) {
  Object.assign(s, { stato_stima: 'astensione', prezzo_unitario_proposto: null, totale_componenti: null,
    prezzo_unitario_derivato: null, quantita_coperta_dal_prezzo: null, totale_riga_proposto: null,
    totale_riga_previsto: null, componenti_economiche: [], motivazione: motivo })
}

for (const nome of ['smaltimento','nolo','verniciatura','ringhiera','trasporto','gru mobile']) {
  test('inclusione ed esclusione della componente ' + nome, async () => {
    const v = await applica(voce, s => { s.motivazione = 'Il prezzo comprende ' + nome; s.avvisi = [nome + ' escluso'] })
    assert.equal(v.prezzo_unitario, 0)
    assert(v.stimaPrezzoArtecna.validazione_tecnica.codici.includes('contraddizione_inclusione_esclusione'))
  })
}
test('facciata: lista al plurale ed esclusione singolare sospendono il prezzo', async () => {
  const v = await applica(voce, s => {
    s.motivazione = 'Il pacchetto comprende materiali, manodopera, ponteggi e sfridi.'
    s.esclusioni_componenti = [{ componente: 'ponteggio', voce_copertura_id: 'altra', motivazione: 'Quotato nella voce separata.' }]
  })
  assert.equal(v.diagnosticaStimaDocumento.motivo, 'stima_ai_sospesa')
})
test('esclusione coerente e perimetri distinti conservano la stima autonoma', async () => {
  const v = await applica(voce, s => {
    s.motivazione = 'La stima non include il nolo. Comprende materiali di consumo.'
    s.avvisi = ['Nolo escluso.', 'Materiali principali esclusi.', 'Il riferimento comprende il nolo.']
  })
  assert.equal(v.diagnosticaStimaDocumento.motivo, 'stima_ai_da_controllare')
  assert.equal(v.prezzo_unitario, 30)
})
test('catalogo: componente espressamente inclusa e voce autonoma equivalente', () => {
  const r = api.preparaInputStimeDocumento([voce], []).righe[0]
  const catalogo = [{ ...r, id: 'seconda', descrizione: 'Nolo gru' }]
  assert(sem.verificaSemanticaProposta(r, risposta(r, { motivazione: 'Il prezzo include nolo gru' }), catalogo)
    .some(x => x.codice === 'sovrapposizione_componente'))
  assert.equal(sem.verificaSemanticaProposta(r, risposta(r, { motivazione: 'Nolo gru escluso' }), catalogo).length, 0)
})
test('elettrico, circa 50 punti: quantità zero conserva 30 €/corpo e totale zero', async () => {
  const v = await applica({ ...voce, descrizione: 'Impianto elettrico completo per edificio, circa 50 punti',
    unita_misura: 'a corpo', quantita: 0 })
  assert.equal(v.prezzo_unitario, 30)
  assert.equal(v.quantita * v.prezzo_unitario, 0)
  assert.equal(v.diagnosticaStimaDocumento.motivo, 'stima_ai_da_controllare')
})
test('astensione giustificata solo dallo zero è scartata; una lacuna tecnica distinta resta valida', async () => {
  const v = { ...voce, quantita: 0 }
  const bad = await applica(v, s => astensione(s, 'Quantità zero, quindi non posso stimare il prezzo unitario.'))
  assert(bad.diagnosticaStimaDocumento.codici.includes('astensione_solo_quantita_zero'))
  const ok = await applica(v, s => astensione(s, 'Quantità zero. Mancano le specifiche del quadro elettrico.'))
  assert.equal(ok.diagnosticaStimaDocumento.motivo, 'astensione_ai')
})
test('due impianti da 3 kW: dato presente sia per proposta sia per astensione', async () => {
  const v = { ...voce, descrizione: 'Impianto fotovoltaico', quantita: 2, unita_misura: 'a corpo',
    contestoTecnicoDocumento: { ubicazioneDimensioni: 'Piano terra 3 kW; piano primo 3 kW' } }
  const bad = await applica(v, s => astensione(s, 'Potenza assente.'))
  assert.equal(bad.diagnosticaStimaDocumento.motivo, 'stima_ai_scartata')
  assert(bad.diagnosticaStimaDocumento.codici.includes('contraddizione_input_output'))
  const prezzo = await applica(v, s => { s.avvisi = ['Manca la potenza.'] })
  assert(prezzo.stimaPrezzoArtecna.validazione_tecnica.codici.includes('contraddizione_input_output'))
  const ok = await applica(v, s => astensione(s, '3 kW per impianto. Manca la scheda tecnica dei moduli.'))
  assert.equal(ok.diagnosticaStimaDocumento.motivo, 'astensione_ai')
})
test('assenza esplicita di U.M., quantità, punti o dimensioni e assenza qualificata', () => {
  const r = { ...voce, unita: 'corpo', descrizione: '4 punti', contesto_riga: '', contesto_tecnico: { ubicazioneDimensioni: '2×3' } }
  for (const frase of ['U.M. assente.', 'Quantità non indicata.', 'Manca il numero di punti.', 'Mancano le dimensioni.']) {
    assert(sem.contraddizioniDocumento(r, { motivazione: frase }).length, frase)
  }
  assert.equal(sem.contraddizioniDocumento(r, { motivazione: 'Mancano le dimensioni del quadro.' }).length, 0)
})
test('metodo orario espresso a m² è sospeso', async () => {
  const v = await applica(voce, s => { s.componenti_economiche[0].unita_tecnica = 'm²' })
  assert.equal(v.prezzo_unitario, 0)
  assert(v.stimaPrezzoArtecna.validazione_tecnica.codici.includes('metodo_orario_um_incoerente'))
})
test('forfait di quattro punti: richiede evidenza di quattro pacchetti distinti', async () => {
  const v = { ...voce, descrizione: 'Installazione impianto, 4 punti', quantita: 4, unita_misura: 'a corpo' }
  const pacchetto = s => { s.motivazione = 'Prezzo per singolo corpo, pacchetto completo di quattro punti.' }
  const bad = await applica(v, pacchetto)
  assert.equal(bad.prezzo_unitario, 0)
  assert(bad.stimaPrezzoArtecna.validazione_tecnica.codici.includes('forfait_quantita_multipla'))
  const ok = await applica({ ...v, testoOrigine: 'Fornitura di 4 impianti distinti, ciascuno da 4 punti.' }, pacchetto)
  assert.equal(ok.prezzo_unitario, 30)
})

const archivio = process.env.ARTECNA_REPLAY_SEMANTICO
test('sei risposte archiviate: solo la facciata perde il prezzo della bozza', { skip: !archivio }, async () => {
  const leggi = nome => JSON.parse(fs.readFileSync(path.join(archivio, nome), 'utf8'))
  const prima = leggi('summary.json').rows
  const input = leggi('input.json')
  const base = leggi('baseline.json')
  let chunk = 0
  const voci = await api.orchestraChunkStimeDocumento(base, input, target => {
    const prefisso = 'chunk-' + (++chunk)
    assert.deepEqual(JSON.parse(JSON.stringify(target)), leggi(prefisso + '-input.json'))
    return api.eseguiStimeDocumento(target, async () => JSON.stringify(leggi(prefisso + '-response-text.json')))
  })
  const bozza = load(path.join(__dirname, 'proposte-documento.ts'))
  assert.equal(chunk, 6)
  assert.equal(voci.length, 39)
  for (const [i, v] of voci.entries()) {
    assert.equal(v.unita_misura, prima[i].um)
    assert.equal(v.quantita, prima[i].quantita)
    if (prima[i].n === 32) {
      assert.equal(v.prezzo_unitario, 0)
      assert.equal(bozza.statoPrezzoDocumento(v), 'stima_ai_sospesa')
      assert(v.stimaPrezzoArtecna.validazione_tecnica.codici.includes('contraddizione_inclusione_esclusione'))
    } else {
      assert.equal(v.prezzo_unitario, prima[i].prezzo)
      assert.equal(bozza.statoPrezzoDocumento(v), prima[i].stato)
    }
  }
  assert.equal(voci.filter(v => v.prezzo_unitario > 0).length, 15)
  assert.equal(Number(voci.reduce((tot, v) => tot + v.prezzo_unitario * v.quantita, 0).toFixed(2)), 27970.73)
})
