import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('./riepilogoEconomico.ts', import.meta.url), 'utf8')
const exports = {}
new Function('exports', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(exports)
const { leggiScomposizioneVarianti, scomponiVarianti } = exports
const { materialiDaContabilizzare, leggiMaterialiDaContabilizzare } = exports
const variante = { stato: 'approvata', cantiere_id: 'C', preventivo_contrattuale_id: 'P' }
const ordinaria = { ...variante, id: 'V1', importo_delta_approvato: 100 }
const economia = { ...variante, id: 'V2', importo_delta_approvato: 50 }
const fonte = {
  id: 'S', variante_id: 'V2', tipo: 'raccolta_economia', economia_raccolta_id: 'R',
  economia_revisione_sorgente: 1, economia_revisione_congelata: 2, snapshot_version: 1,
  snapshot: { raccolta_id: 'R', cantiere_id: 'C', revisione_sorgente: 1, revisione_congelata: 2,
    numero_registrazioni: 1, totale: 50, registrazioni: [{ id: 'riga', tipo_riga: 'manodopera', importo: 50 }] },
}

function client({ rpcErrore, codice, dettaglio = fonte } = {}) {
  return { rpc(nome, parametri) {
    const data = nome === 'leggi_varianti_cantiere' ? [ordinaria, economia]
      : nome === 'leggi_sorgenti_variante' ? parametri.p_variante_id === 'V2' ? [fonte] : []
      : dettaglio
    const risposta = nome === rpcErrore ? { data: null, error: { code: codice } } : { data, error: null }
    return nome === 'leggi_sorgente_variante' ? Promise.resolve(risposta)
      : { order() { return this }, async range() { return risposta } }
  } }
}

test('Conserva la scomposizione di varianti ordinarie ed Economia approvate', async () => {
  const esito = await leggiScomposizioneVarianti(client(), 'C', 'P')
  assert.deepEqual([esito.totale, esito.ordinarie, esito.manodopera, esito.materiali], [150, 100, 50, 0])
})

test('Distingue autorizzazione, RPC mancante e sorgente incompleta', async () => {
  for (const [rpcErrore, codice, messaggio] of [
    ['leggi_varianti_cantiere', 'P2021', /Elenco varianti.*accesso/],
    ['leggi_sorgenti_variante', 'PGRST202', /Elenco sorgenti.*RPC non disponibile/],
    ['leggi_sorgente_variante', 'P0002', /Dettaglio sorgente.*dati incompleti/],
  ]) {
    await assert.rejects(leggiScomposizioneVarianti(client({ rpcErrore, codice }), 'C', 'P'), messaggio)
  }
})

test('Uno snapshot incoerente fallisce la validazione', async () => {
  const dettaglio = { ...fonte, snapshot: { ...fonte.snapshot, totale: 49 } }
  await assert.rejects(leggiScomposizioneVarianti(client({ dettaglio }), 'C', 'P'), /Validazione contratto e snapshot/)
})

const motivo = 'Voce senza valore economico'
const inclusa = {
  id: 'lavoro', tipo_riga: 'manodopera', origine: 'rapportino', sorgente_id: null,
  indice_voce_sorgente: null, esclusa_proposta: false, importo: 40,
}
const generica = {
  id: 'generica', tipo_riga: 'generica', origine: 'manuale', sorgente_id: null,
  indice_voce_sorgente: null, esclusa_proposta: false, importo: 5,
}
const materiale = {
  id: 'materiale', tipo_riga: 'materiale', origine: 'file', sorgente_id: 'file',
  indice_voce_sorgente: 0, esclusa_proposta: false, importo: 5, quantita: 1,
  prezzo_unitario: 5, descrizione: 'Materiale', unita_misura: 'pz',
}
const esclusa = {
  ...materiale, id: 'esclusa', origine: 'fattura_fornitore', sorgente_id: 'fattura',
  indice_voce_sorgente: null, esclusa_proposta: true, prezzo_unitario: 0, importo: 0,
  dettagli_analitici: { proposta_non_economica: { versione: 1, esclusa: true, motivo, storico: [{ esclusa: true, motivo }] } },
}
const snapshot = {
  ...fonte.snapshot, versione_esclusioni: 1, versione_prezzi_cliente: 1,
  numero_registrazioni: 4, numero_incluse: 3, numero_escluse: 1,
  registrazioni: [inclusa, generica, materiale, esclusa],
}
const valuta = snap => scomponiVarianti([economia], [{ ...fonte, snapshot: snap }], 'C', 'P')

test('Legge sei varianti approvate, conserva le generiche e contabilizza soltanto le righe incluse', async () => {
  const varianti = Array.from({ length: 6 }, (_, i) => ({ ...economia, id: 'V' + i }))
  const fonti = varianti.map((v, i) => ({
    ...fonte, id: 'S' + i, variante_id: v.id, economia_raccolta_id: 'R' + i,
    snapshot: { ...snapshot, raccolta_id: 'R' + i },
  }))
  fonti[4].snapshot = { ...fonti[4].snapshot, registrazioni: [inclusa, generica, materiale, { ...esclusa, importo: null }] }
  const elenco = [
    ...Array.from({ length: 199 }, (_, i) => ({ ...economia, id: 'Bozza' + i, stato: 'bozza' })),
    ...varianti,
  ]
  const pagineVarianti = []
  const rpc = { rpc(nome, args) {
    if (nome === 'leggi_sorgente_variante') return Promise.resolve({ data: fonti.find(s => s.id === args.p_sorgente_id) })
    const data = nome === 'leggi_varianti_cantiere' ? elenco : fonti.filter(s => s.variante_id === args.p_variante_id)
    return { order() { return this }, async range(da, a) {
      if (nome === 'leggi_varianti_cantiere') pagineVarianti.push([da, a])
      return { data: data.slice(da, a + 1) }
    } }
  } }
  const esito = await leggiScomposizioneVarianti(rpc, 'C', 'P')
  assert.deepEqual(pagineVarianti, [[0, 199], [200, 399]])
  assert.deepEqual([esito.totale, esito.ordinarie, esito.manodopera, esito.materiali, esito.generiche], [300, 0, 240, 30, 30])
  assert.equal(esito.dettaglioMateriali.length, 6)
  assert.equal(esito.identitaMateriali.length, 6)
})

test('Blocca importi inclusi invalidi, origini incompatibili e snapshot alterati', () => {
  for (const snap of [
    ...[undefined, null, 0, -1, 39.999, '40.000000001', 'non numerico'].map(importo => ({
      ...snapshot, registrazioni: [{ ...inclusa, importo }, generica, materiale, esclusa],
    })),
    ...[
      { ...esclusa, id: inclusa.id }, { ...esclusa, importo: undefined },
      { ...esclusa, importo: 1 }, { ...esclusa, esclusa_proposta: 'true' },
      { ...esclusa, dettagli_analitici: null },
      { ...esclusa, tipo_riga: 'generica', origine: 'manuale', sorgente_id: null },
      { ...esclusa, indice_voce_sorgente: 0 },
    ].map(r => ({ ...snapshot, registrazioni: [inclusa, generica, materiale, r] })),
    { ...snapshot, registrazioni: [{ ...inclusa, sorgente_id: 'estraneo' }, generica, materiale, esclusa] },
    { ...snapshot, numero_registrazioni: 5 }, { ...snapshot, numero_incluse: 4 },
    { ...snapshot, numero_escluse: 0 }, { ...snapshot, totale: 49 },
    { ...snapshot, revisione_congelata: 3 }, { ...snapshot, versione_esclusioni: 2 },
    { ...snapshot, versione_prezzi_cliente: null },
    { ...snapshot, registrazioni: [{ ...inclusa, importo: 41 }, generica, materiale, esclusa], totale: 51 },
  ]) assert.throws(() => valuta(snap), /Riepilogo non verificabile/)
})

const approvati = { materiali: 10, dettaglioMateriali: [], identitaMateriali: [] }
function raccolta(id, opzioni = {}) {
  const prezzo = opzioni.prezzo ?? 5
  const fattura = { version: 1, fattura_riga_id: 'F', quantita: 2,
    prezzo_unitario_originale: 8, prezzo_unitario_economia: prezzo, totale_economia: 2 * prezzo,
    unita_misura_economia: 'pz', data_fattura: '2026-09-10' }
  const sorgente = { id: id + 'S', raccolta_id: id, tipo: 'fattura_fornitore', formato: 'fattura', snapshot_version: 1, snapshot: fattura }
  return {
    raccolta: { id, cantiere_id: 'C', stato: 'chiusa', revisione: 1 },
    sorgenti: [sorgente],
    righe: [{ id: id + 'R', raccolta_id: id, sorgente_id: sorgente.id, origine: 'fattura_fornitore',
      tipo_riga: 'materiale', fattura_riga_id: 'F', indice_voce_sorgente: null, quantita: 2, prezzo_unitario: prezzo, descrizione: 'Materiale sintetico',
      unita_misura: 'pz', dettagli_analitici: { fattura, ...(opzioni.esclusa ? esclusa.dettagli_analitici : {}) } }],
  }
}
const eseguiMateriali = (dati, valori = approvati) => materialiDaContabilizzare(dati, valori, 'C')
const fase = nome => error => error.fase === nome

test('Deduplicazione: zero verificato e stessa fattura in raccolte distinte', () => {
  assert.deepEqual(eseguiMateriali([]), { righe: [], daContabilizzare: 0, totaleOperativo: 10 })
  const valori = { ...approvati, identitaMateriali: [{ raccoltaId: 'A', rigaId: 'AR', sorgenteId: 'AS', fatturaRigaId: 'F' }] }
  assert.equal(eseguiMateriali([raccolta('A')], valori).daContabilizzare, 0)
  const esito = eseguiMateriali([raccolta('A'), raccolta('B')], valori)
  assert.equal(esito.daContabilizzare, 10)
  assert.equal(esito.totaleOperativo, 20)
  assert.deepEqual(esito.righe.map(r => r.id), ['B:BR'])
})

test('Diagnosi distingue identità duplicate, snapshot fattura e valori operativi', () => {
  const duplicata = raccolta('A')
  duplicata.sorgenti.push(duplicata.sorgenti[0])
  assert.throws(() => eseguiMateriali([duplicata]), fase('identita'))
  const incoerente = raccolta('A')
  incoerente.sorgenti[0].snapshot = { ...incoerente.sorgenti[0].snapshot, version: 2 }
  assert.throws(() => eseguiMateriali([incoerente]), fase('snapshot'))
  const arrotondamento = raccolta('A')
  arrotondamento.sorgenti[0].snapshot.totale_economia = 10.001
  assert.throws(() => eseguiMateriali([arrotondamento]), fase('valori'))
  const zero = raccolta('A', { prezzo: 0, esclusa: true })
  assert.throws(() => eseguiMateriali([zero]), fase('valori'))
})

test('Diagnosi distingue storico, raccolta, RPC e rete senza riportare payload', async () => {
  const rpc = (varianti, raccolte) => ({ rpc(nome) {
    if (nome === 'leggi_varianti_cantiere') return { order() { return this }, async range() { return varianti } }
    if (nome === 'leggi_raccolte_economia') return raccolte()
    throw Error('RPC sintetica non attesa')
  } })
  await assert.rejects(leggiMaterialiDaContabilizzare(rpc({ data: [{ ...variante, id: 'V', preventivo_contrattuale_id: null }] }, () => ({})), 'C', approvati), fase('storico'))
  await assert.rejects(leggiMaterialiDaContabilizzare(rpc({ data: [] }, () => ({ data: [{}] })), 'C', approvati), fase('raccolta'))
  await assert.rejects(leggiMaterialiDaContabilizzare(rpc({ data: [] }, () => ({ error: { code: '42501', message: 'dato riservato' } })), 'C', approvati),
    error => error.fase === 'raccolta' && error.categoria === 'rpc' && !error.message.includes('dato riservato'))
  await assert.rejects(leggiMaterialiDaContabilizzare(rpc({ data: [] }, () => { throw new TypeError('Failed to fetch') }), 'C', approvati),
    error => error.fase === 'raccolta' && error.categoria === 'rete')
})

test('Un materiale congelato in un contratto precedente resta escluso dal totale operativo', async () => {
  const storico = { ...economia, preventivo_contrattuale_id: 'P-storico', importo_delta_approvato: 10 }
  const dettaglio = raccolta('A')
  const congelata = { ...fonte, economia_raccolta_id: 'A', snapshot: {
    ...fonte.snapshot, raccolta_id: 'A', totale: 10, registrazioni: [{ ...dettaglio.righe[0], importo: 10 }],
  } }
  const risposte = {
    leggi_varianti_cantiere: [storico], leggi_sorgenti_variante: [congelata],
    leggi_sorgente_variante: congelata, leggi_raccolte_economia: [dettaglio.raccolta], leggi_raccolta_economia: dettaglio,
  }
  const client = { rpc(nome) {
    const risposta = { data: risposte[nome] }
    return ['leggi_varianti_cantiere', 'leggi_sorgenti_variante'].includes(nome)
      ? { order() { return this }, async range() { return risposta } } : Promise.resolve(risposta)
  } }
  assert.equal((await leggiMaterialiDaContabilizzare(client, 'C', approvati)).daContabilizzare, 0)
})

function fixtureEsclusioneCongelata() {
  const varianti = [], fonti = [], dettagli = []
  let progressivo = 0
  for (let n = 1; n <= 6; n++) {
    const id = 'C' + n
    const d = raccolta(id)
    d.righe = []
    d.sorgenti = []
    function aggiungi(identita, prezzo, esclusione = false) {
      const { righe: [r], sorgenti: [s] } = raccolta(id, { prezzo, esclusa: esclusione })
      r.id = identita
      s.id = r.sorgente_id = 'S-' + identita
      r.fattura_riga_id = s.snapshot.fattura_riga_id = 'F-' + identita
      r.quantita = s.snapshot.quantita = 1
      s.snapshot.totale_economia = prezzo
      d.righe.push(r)
      d.sorgenti.push(s)
      return { ...structuredClone(r), importo: prezzo, esclusa_proposta: esclusione }
    }
    const registrazioni = Array.from({ length: [66, 1, 1, 1, 1, 0][n - 1] }, () => {
      progressivo++
      return aggiungi('A' + progressivo, progressivo === 70 ? 28.38 : 28.69)
    })
    registrazioni.push({ ...inclusa, id: 'L' + n, importo: 974 })
    const totale = registrazioni.reduce((cent, r) => cent + Math.round(r.importo * 100), 0) / 100
    if (n === 1) registrazioni.push(aggiungi('R67', 0, true))
    if (n === 2) [12.5, 25, 7.5, 40].forEach((prezzo, i) => aggiungi('OP' + (i + 1), prezzo))
    const v = { ...economia, id: 'V' + n, importo_delta_approvato: totale }
    varianti.push(v)
    fonti.push({ ...fonte, id: 'VS' + n, variante_id: v.id, economia_raccolta_id: id, snapshot: {
      ...snapshot, raccolta_id: id, totale, numero_registrazioni: registrazioni.length,
      numero_escluse: n === 1 ? 1 : 0, numero_incluse: registrazioni.length - (n === 1 ? 1 : 0), registrazioni,
    } })
    dettagli.push(d)
  }
  const valori = scomponiVarianti(varianti, fonti, 'C', 'P')
  const client = { rpc(nome, args) {
    const dati = {
      leggi_varianti_cantiere: () => varianti,
      leggi_sorgenti_variante: () => fonti.filter(s => s.variante_id === args.p_variante_id),
      leggi_sorgente_variante: () => fonti.find(s => s.id === args.p_sorgente_id),
      leggi_raccolte_economia: () => dettagli.map(d => d.raccolta),
      leggi_raccolta_economia: () => dettagli.find(d => d.raccolta.id === args.p_raccolta_id),
    }
    const data = dati[nome]()
    return ['leggi_varianti_cantiere', 'leggi_sorgenti_variante'].includes(nome)
      ? { order() { return this }, async range(da, a) { return { data: data.slice(da, a + 1) } } }
      : Promise.resolve({ data })
  } }
  return { varianti, valori, dettagli, client }
}

test('Sei varianti, settanta approvati, quattro candidati positivi e C1/R67 esclusa a zero', async () => {
  const { varianti, valori, dettagli, client } = fixtureEsclusioneCongelata()
  assert.equal(varianti.length, 6)
  assert.equal(valori.identitaMateriali.filter(x => !x.esclusione).length, 70)
  assert.equal(valori.dettaglioMateriali.length, 70)
  assert.equal(valori.identitaMateriali.find(x => x.esclusione).rigaId, 'R67')
  assert.equal(dettagli[0].righe[66].id, 'R67')
  assert.deepEqual([valori.materiali, valori.manodopera, valori.totale, Math.round((31438.40 + valori.totale) * 100) / 100],
    [2007.99, 5844, 7851.99, 39290.39])
  const esito = await leggiMaterialiDaContabilizzare(client, 'C', valori)
  assert.deepEqual(esito.righe.map(r => [r.id, r.totale]), [['C2:OP1', 12.5], ['C2:OP2', 25], ['C2:OP3', 7.5], ['C2:OP4', 40]])
  assert.equal(esito.daContabilizzare, 85)
  assert.equal(esito.totaleOperativo, 2092.99)
})

test('Ogni candidata incoerente blocca il risultato e C1/R67 richiede la stessa identità e gli stessi metadati', async () => {
  for (let i = 1; i <= 4; i++) {
    const { valori, dettagli, client } = fixtureEsclusioneCongelata()
    dettagli[1].righe.find(r => r.id === 'OP' + i).dettagli_analitici.fattura.totale_economia += 0.01
    await assert.rejects(leggiMaterialiDaContabilizzare(client, 'C', valori), fase('valori'))
  }
  for (const modifica of [
    r => { r.id = 'R68' },
    (r, d) => {
      d.sorgenti.find(s => s.id === r.sorgente_id).id = 'S-alternativa'
      r.sorgente_id = 'S-alternativa'
    },
    r => { r.quantita = r.dettagli_analitici.fattura.quantita = 2 },
    r => { r.dettagli_analitici.proposta_non_economica = { ...r.dettagli_analitici.proposta_non_economica, motivo: 'Metadati variati' } },
  ]) {
    const { valori, dettagli, client } = fixtureEsclusioneCongelata()
    modifica(dettagli[0].righe.find(r => r.id === 'R67'), dettagli[0])
    await assert.rejects(leggiMaterialiDaContabilizzare(client, 'C', valori), fase('identita'))
  }
  const { valori, dettagli, client } = fixtureEsclusioneCongelata()
  dettagli[0].righe.push(dettagli[0].righe.find(r => r.id === 'R67'))
  await assert.rejects(leggiMaterialiDaContabilizzare(client, 'C', valori), fase('identita'))
})
