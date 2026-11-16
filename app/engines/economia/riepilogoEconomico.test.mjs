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
