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
const { confrontaPerimetroPrestazione } = load(path.join(__dirname, 'perimetro-prestazione.ts'))
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

test('due componenti positive con la stessa base di costo sospendono l’intera proposta', async () => {
  const v = await applica(voce, s => {
    const [opera, fornitura] = s.componenti_economiche
    opera.descrizione = 'Installazione dei supporti'
    opera.origine_costo.descrizione = 'Stima costo ancoraggi metallici, minuteria e manodopera per installazione'
    fornitura.descrizione = 'Fornitura di ancoraggio metallico'
  })
  assert.equal(v.prezzo_unitario, 0)
  assert.equal(v.stimaPrezzoArtecna.prezzo_unitario_proposto, 30)
  const val = v.stimaPrezzoArtecna.validazione_tecnica
  assert.equal(val.stato, 'sospesa_da_verificare')
  assert(val.codici.includes('sovrapposizione_componenti_economiche'))
  assert(val.motivi.some(m => m.includes('componenti 1 e 2') && m.includes('ancoraggio metallico')))
})

function sovrappone(titoli, testo = '', basi = []) {
  const r = api.preparaInputStimeDocumento([voce], []).righe[0]
  const s = risposta(r)
  s.componenti_economiche = titoli.map((descrizione, i) => ({
    ...s.componenti_economiche[i % 2], descrizione,
    origine_costo: { tipo: 'ipotesi_tecnica_esplicita', descrizione: basi[i] || 'Tariffa di prova', base_documentale: null },
  }))
  return sem.verificaSemanticaProposta({ ...r, contesto_riga: testo }, s, [])
    .some(x => x.codice === 'sovrapposizione_componenti_economiche')
}
test('inclusioni trasversali tra categorie, anche per noli, servizi e manodopera', () => {
  for (const [a, b] of [
    ['Pacchetto comprensivo di allestimento e noleggio gru', 'Nolo gru'],
    ['Smontaggio, incluso il trasporto alla discarica', 'Trasporto alla discarica'],
    ["Il prezzo include mano d'opera per collaudo", 'Manodopera per collaudo'],
    ['Riparazione', 'Collaudo e riparazioni'],
    ['Fornitura e posa di mensole', 'Fornitura delle mensole'],
  ]) assert(sovrappone([a, b]), a)
  assert(sovrappone(['Montaggio del pannello','Verifica impianto','Tasselli inox'], '', ['Il costo include i tasselli inox']))
})
test('ruoli distinti, esclusioni e unità di tariffa condivisa non sono duplicati', () => {
  for (const [a, b] of [
    ['Fornitura di membrane', 'Posa delle membrane'],
    ['Fornitura e posa delle finestre', 'Fornitura e posa delle porte'],
    ['Il prezzo include tasselli inox', 'Il prezzo include la verniciatura'],
    ['Manodopera per intonaco e stuccatura', 'Materiali per intonaco e stuccatura'],
    ['Materiali per intonaco e finiture', 'Posa intonaco e finitura'],
    ['Preparazione senza trasporto', 'Trasporto'],
    ['Montaggio, fissaggi non compresi', 'Fissaggi'],
    ['Montaggio, non includendo la fornitura dei fissaggi', 'Fissaggi'],
  ]) assert.equal(sovrappone([a,b], '', ['Costo orario della squadra', 'Costo orario della squadra']), false, a)
})
test('stesso materiale per due destinazioni richiede una separazione documentata', () => {
  const parti = ['Primer e tasselli per zona A', 'Fornitura di primer per zona B']
  assert.equal(sovrappone(parti, 'Zone separate: zona A, zona B.'), false)
  assert.equal(sovrappone(parti, 'Trattamento della zona A.'), true)
  assert.equal(sovrappone(['Primer', parti[1]], 'Zona A, zona B.'), true)
})
test('l’oggetto che rappresenta una unità economica deve coincidere con quello da prezzare', async () => {
  const opera = { ...voce, descrizione: 'Posa in opera di maiolica rivestimento' }
  const esito = unita => applica(opera, s => { s.unita_economica.descrizione = unita })
  const errata = await esito('1 metro quadrato di pavimentazione con posa completa, esclusa la maiolica')
  assert.equal(errata.prezzo_unitario, 0)
  const val = errata.stimaPrezzoArtecna.validazione_tecnica
  assert(val.codici.includes('oggetto_economico_non_coerente'))
  assert.equal(val.coerenza_perimetro, 'incompatibile')
  assert(val.differenze_perimetro.some(m => m.includes('rivestimento') && m.includes('pavimento')))
  assert.equal((await esito('1 metro quadrato di maiolica su intonaco esistente')).prezzo_unitario, 30)
  const altra = await applica({ ...voce, descrizione: 'Rimozione di tubazioni' }, s => {
    s.unita_economica.descrizione = 'Rimozione di un infisso'
  })
  assert(altra.stimaPrezzoArtecna.validazione_tecnica.codici.includes('oggetto_economico_non_coerente'))
})
test('componente che valorizza l’intero prezzo per un altro bene è bloccata anche con unità nominalmente corretta', async () => {
  const v = await applica({ ...voce, descrizione: 'Posa di zoccoletto' }, s => {
    s.unita_economica.descrizione = 'Un metro di battiscopa'
    s.componenti_economiche = [{ ...s.componenti_economiche[0], descrizione: 'Posa di serramenti',
      importo_unitario: 30, quantita_tecnica: 1, costo_unitario: 30, subtotale: 30 }]
  })
  assert.equal(v.prezzo_unitario, 0)
  assert(v.stimaPrezzoArtecna.validazione_tecnica.codici.includes('oggetto_economico_non_coerente'))
  const altroBene = await applica({ ...voce, descrizione: 'Posa di rivestimento' }, s => {
    s.unita_economica.descrizione = 'Un metro quadrato di rivestimento'
    s.componenti_economiche[0].descrizione = 'Installazione dei serramenti'
    s.componenti_economiche[1].descrizione = 'Collaudo dei serramenti'
  })
  assert.equal(altroBene.prezzo_unitario, 0)
  assert(altroBene.stimaPrezzoArtecna.validazione_tecnica.codici.includes('oggetto_economico_non_coerente'))
})
test('escludendo, includendo e doppia negazione rispettano la polarità della singola clausola', () => {
  const doc = 'Sola posa di pavimento'
  for (const testo of ['Posa escludendo la fornitura del materiale principale', 'Posa non includendo la fornitura']) {
    assert.equal(giudizio(doc, doc, testo).coerenza_perimetro, 'compatibile', testo)
  }
  for (const testo of ['Posa escludendo il trasporto e includendo la fornitura del pavimento', 'Posa non escludendo la fornitura del pavimento']) {
    assert.equal(giudizio(doc, doc, testo).coerenza_perimetro, 'incompatibile', testo)
  }
})

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
const motivoPerimetro = 'perimetro_prestazione_non_coerente'

for (const [input, stimato] of [
  ['Predisposizione di un impianto di controllo', 'Un impianto di controllo esterno completo'],
  ['Sola posa di un rivestimento', 'Fornitura e posa del rivestimento'],
  ['Rimozione di porta esistente', 'Fornitura della nuova porta'],
  ['Ripristino del pavimento', 'Rifacimento completo del pavimento'],
  ['Revisione caldaia a gas', 'Sostituzione integrale della caldaia'],
  ['Fornitura e posa di un controtelaio per serramenti', 'Fornitura e posa del serramento completo'],
  ['Assistenza muraria per impianto idraulico', 'Realizzazione impianto idraulico'],
  ['Verniciatura parapetto', 'Fornitura del parapetto e vernice'],
  ['Fornitura del modulo per il gruppo di misura', 'Un pacchetto completo chiavi in mano'],
  ['Fornitura e posa della valvola', 'Sola posa della valvola'],
  ['Impianto di controllo completo', 'Predisposizione per il futuro impianto'],
  ['Fornitura del sistema completo', 'Fornitura del solo componente di ricambio'],
]) {
  test('perimetro incompatibile: ' + input + ' / ' + stimato, async () => {
    const v = await applica({ ...voce, descrizione: input }, s => { s.unita_economica.descrizione = stimato })
    assert.equal(v.prezzo_unitario, 0)
    const val = v.stimaPrezzoArtecna.validazione_tecnica
    assert.equal(val.stato, 'sospesa_da_verificare')
    assert(val.codici.includes(motivoPerimetro))
    assert.equal(val.coerenza_perimetro, 'incompatibile')
    assert(val.differenze_perimetro.some(d => d.includes(stimato)))
  })
}

function giudizio(descrizione, unita, motivazione = '', componenti = [], avvisi = []) {
  return confrontaPerimetroPrestazione({ descrizione }, { unita_economica: { descrizione: unita }, motivazione,
    componenti_economiche: componenti.map(([descrizione, importo_unitario]) => ({ descrizione, importo_unitario })), avvisi })
}
test('unità nominalmente corretta: anche motivazione, avviso e componente valorizzata possono smentirla', () => {
  const doc = 'Predisposizione di un impianto di allarme'
  const eccesso = 'Il prezzo include un impianto completo'
  for (const g of [giudizio(doc, doc, eccesso), giudizio(doc, doc, '', [], [eccesso]),
    giudizio(doc, doc, '', [['Fornitura e posa di impianto completo', 40]])]) {
    assert.equal(g.coerenza_perimetro, 'incompatibile')
  }
  assert.equal(giudizio(doc, doc, '', [['Fornitura e posa di impianto completo', 0]]).coerenza_perimetro, 'compatibile')
})
test('riferimenti, esclusioni, ipotesi, beni accessori e costi parziali non ampliano il prezzo', () => {
  const posa = 'Sola posa di pavimento'
  const predisposizione = 'Predisposizione di tubazioni per un impianto completo'
  for (const g of [
    giudizio(posa, posa, 'Il listino comprende fornitura e posa. Il prezzo non include la fornitura.'),
    giudizio(posa, posa, 'I riferimenti mostrano prezzi superiori ma comprendono fornitura e posa.'),
    giudizio(posa, posa, 'Fornitura del materiale principale esclusa. Se si richiede fornitura e posa il prezzo cambia.'),
    giudizio(posa, posa, '', [['Fornitura del collante', 3]]),
    giudizio(predisposizione, predisposizione, 'Impianto completo escluso.'),
    giudizio('Fornitura e posa di controtelaio per serramento completo', 'Un controtelaio completo per serramento'),
    giudizio('Fornitura e posa di impianto completo', 'Un impianto completo', '', [['Fornitura del modulo di controllo', 180]]),
    giudizio('Fornitura e posa di impianto completo', 'Un impianto completo', 'La stima comprende moduli e componenti di controllo.'),
    giudizio('Ripristino della scala', 'Ripristino completo della scala', 'Rifacimento di intonaco.'),
    giudizio('Verniciatura parapetto', 'Verniciatura del parapetto', '', [['Fornitura della vernice', 12]]),
  ]) assert.notEqual(g.coerenza_perimetro, 'incompatibile', g.differenze_perimetro.join(' '))
})
test('prompt circoscrive la stima; il giudizio è derivato e ignora autovalutazioni o citazioni del documento', () => {
  assert.match(api.istruzioniStimeDocumento, /Non ampliare la prestazione richiesta/)
  const g = confrontaPerimetroPrestazione({ descrizione: 'Predisposizione impianto' }, {
    coerenza_perimetro: 'compatibile', unita_economica: { descrizione: 'Intero impianto nuovo completo', base_documentale: 'Predisposizione impianto' },
    motivazione: 'Stima per la predisposizione',
  })
  assert.equal(g.coerenza_perimetro, 'incompatibile')
  assert.equal(giudizio('Opera speciale', 'Unità contabile').coerenza_perimetro, 'non_determinabile')
})
test('azioni coordinate, destinazioni future e note limitative mantengono il loro significato', () => {
  assert.equal(giudizio('Predisposizione impianto', 'Predisposizione e installazione di un impianto completo').coerenza_perimetro, 'incompatibile')
  assert.equal(giudizio('Predisposizione impianto', 'Impianto completo con predisposizione per futuri ampliamenti, esclusa la programmazione').coerenza_perimetro, 'incompatibile')
  assert.equal(giudizio('Rimozione e fornitura di porte', 'Rimozione e fornitura di porte', '', [['Fornitura di porte', 100]]).coerenza_perimetro, 'compatibile')
  assert.equal(giudizio('Predisposizione per impianto', 'Predisposizione', 'Non si tratta di un impianto completo.',
    [['Installazione tubazioni per il futuro impianto', 50]]).coerenza_perimetro, 'compatibile')
  const scope = confrontaPerimetroPrestazione({ descrizione: 'Impianto dati', contesto_tecnico: { annotazioni: 'Solo predisposizione' } },
    { unita_economica: { descrizione: 'Un impianto completo' }, motivazione: '' })
  assert.equal(scope.coerenza_perimetro, 'incompatibile')
})
test('un rifacimento locale ammesso come componente non autorizza il rifacimento di tutta la struttura', () => {
  const doc = 'Ripristino del muro, compreso il rifacimento completo del rivestimento'
  const parte = 'Rifacimento completo del rivestimento'
  assert.equal(giudizio(doc, 'Ripristino del muro', '', [[parte, 100]]).coerenza_perimetro, 'compatibile')
  assert.equal(giudizio(doc, 'Rifacimento completo del muro').coerenza_perimetro, 'incompatibile')
  assert.equal(giudizio(doc.replace('compreso', 'escluso'), 'Ripristino del muro', '', [[parte, 100]]).coerenza_perimetro, 'incompatibile')
})

const archivioPerimetro = process.env.ARTECNA_REPLAY_PERIMETRO
const archivioComponenti = process.env.ARTECNA_REPLAY_COMPONENTI
test('replay scomposizione: 39 righe, restano fuori i costi sovrapposti e il bene diverso', { skip: !archivioComponenti }, async () => {
  const leggi = nome => JSON.parse(fs.readFileSync(path.join(archivioComponenti, nome), 'utf8'))
  const prima = leggi('report-after-validator.json')
  assert.equal(prima.candidate, '12b0fb0c7212dcfb6c3619e138b5b3d0ebe25a37')
  assert.equal(prima.subtotale, 28094.74)
  let chunk = 0
  const finale = await api.orchestraChunkStimeDocumento(leggi('baseline.json'), leggi('input.json'), target => {
    const id = 'chunk-' + (++chunk)
    assert.deepEqual(JSON.parse(JSON.stringify(target)), leggi(id + '-input.json'))
    return api.eseguiStimeDocumento(target, async () => leggi(id + '-response-original.json').output_text)
  })
  const bozza = load(path.join(__dirname, 'proposte-documento.ts'))
  assert.equal(chunk, 6)
  assert.equal(finale.length, 39)
  const nuoviBlocchi = new Map([[20, 'sovrapposizione_componenti_economiche'], [22, 'oggetto_economico_non_coerente']])
  for (const [i, v] of finale.entries()) {
    const vecchia = prima.voci[i]
    assert.equal(v.quantita, vecchia.quantita)
    assert.equal(v.unita_misura, vecchia.unita_misura)
    const nuovo = nuoviBlocchi.get(i + 1)
    if (nuovo) {
      assert.equal(bozza.statoPrezzoDocumento(v), 'stima_ai_sospesa')
      assert.equal(v.prezzo_unitario, 0)
      assert(v.stimaPrezzoArtecna.validazione_tecnica.codici.includes(nuovo))
    } else {
      assert.equal(bozza.statoPrezzoDocumento(v), vecchia.stato)
      assert.equal(v.prezzo_unitario, vecchia.prezzo_unitario)
    }
  }
  for (const n of [12, 27]) assert(finale[n-1].stimaPrezzoArtecna.validazione_tecnica.codici.includes('perimetro_prestazione_non_coerente'))
  const lavica = finale[35].stimaPrezzoArtecna.validazione_tecnica
  assert.deepEqual(Array.from(lavica.codici), ['conteggio_unita_non_documentato'])
  assert.equal(finale.filter(v => v.prezzo_unitario > 0).length, 11)
  assert.equal(Number(finale.reduce((somma, v) => somma + v.quantita * v.prezzo_unitario, 0).toFixed(2)), 23115.74)
})

test('sei risposte reali: la sola videosorveglianza perde 8.000 euro, le altre 38 righe sono conservate', { skip: !archivioPerimetro }, async () => {
  const leggi = nome => JSON.parse(fs.readFileSync(path.join(archivioPerimetro, nome), 'utf8'))
  const prima = leggi('report-after-validator.json')
  assert.equal(prima.candidate, '9fb359b5d542621fd2434b62e0e2c3360102dfc1')
  const bozza = load(path.join(__dirname, 'proposte-documento.ts'))
  let chunk = 0
  const voci = await api.orchestraChunkStimeDocumento(leggi('baseline.json'), leggi('input.json'), target => {
    const prefisso = 'chunk-' + (++chunk)
    assert.deepEqual(JSON.parse(JSON.stringify(target)), leggi(prefisso + '-input.json'))
    return api.eseguiStimeDocumento(target, async () => leggi(prefisso + '-response-original.json').output_text)
  })
  assert.equal(chunk, 6)
  assert.equal(voci.length, 39)
  for (const [i, v] of voci.entries()) {
    const vecchia = prima.voci[i]
    assert.equal(v.unita_misura, vecchia.unita_misura)
    assert.equal(v.quantita, vecchia.quantita)
    if (i === 26) {
      assert.equal(vecchia.stato, 'stima_ai_da_controllare')
      assert.equal(vecchia.prezzo_unitario, 8000)
      assert.equal(bozza.statoPrezzoDocumento(v), 'stima_ai_sospesa')
      assert(v.stimaPrezzoArtecna.validazione_tecnica.codici.includes(motivoPerimetro))
      assert.equal(v.prezzo_unitario, 0)
    } else {
      assert.equal(bozza.statoPrezzoDocumento(v), vecchia.stato)
      assert.equal(v.prezzo_unitario, vecchia.prezzo_unitario)
    }
  }
  assert.equal(voci.filter(v => v.prezzo_unitario > 0).length, 11)
  assert.equal(Number(voci.reduce((tot, v) => tot + v.prezzo_unitario * v.quantita, 0).toFixed(2)), 39870.74)
})

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
