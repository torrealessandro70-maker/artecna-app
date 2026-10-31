/* eslint-disable @typescript-eslint/no-require-imports -- Test Node locale con transpiler TypeScript, come le suite esistenti. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file)
const { riepilogaCostiFornitori, deltaRettifiche, rettificheCompatibiliConBase, leggiNotaCredito, applicaNotaCredito } = require('./note-credito.ts')
const { motivoNonSelezionabile } = require('../economia/fattureMateriali.ts')
const quota = { tipo: 'cantiere', id: 'quota-1', costo: 100 }
const rettifica = { id: 'rettifica-1', importo_costo: -20, materiale_cantiere_id: 'quota-1', economia_riga_id: null }
const dati = { quote: [quota], rettifiche: [rettifica] }

test('Costo originale più rettifica negativa, senza sommare il documento', () => {
  assert.deepEqual(riepilogaCostiFornitori(dati), { originali: 100, rettifiche: -20, netto: 80 })
})
test('Nota pendente non diminuisce i costi', () => {
  assert.equal(riepilogaCostiFornitori({ quote: [quota], rettifiche: [] }).netto, 100)
})
test('Quote duplicate non diventano un totale plausibile', () => {
  assert.throws(() => riepilogaCostiFornitori({ quote: [quota, quota], rettifiche: [] }), /duplicata/)
})
test('Rettifiche duplicate non vengono sottratte due volte', () => {
  assert.throws(() => riepilogaCostiFornitori({ quote: [quota], rettifiche: [rettifica, rettifica] }), /duplicata/)
})
test('Rettifica positiva rifiutata', () => {
  assert.throws(() => riepilogaCostiFornitori({ quote: [], rettifiche: [{ ...rettifica, importo_costo: 20 }] }), /segno/)
})
test('Fonte mancante non è zero', () => {
  for (const costo of [null, undefined, '', ' ', 'errore']) {
    assert.throws(() => riepilogaCostiFornitori({ quote: [{ ...quota, costo }], rettifiche: [] }), /indisponibile/)
  }
})
test('Delta include solo rettifiche; separazione della base legacy da Economia', () => {
  const v = { ...dati, rettifiche: [...dati.rettifiche, { ...rettifica, id: 'rettifica-2', importo_costo: -5, materiale_cantiere_id: null, economia_riga_id: 'q-economia' }] }
  assert.equal(deltaRettifiche(v), -25)
  assert.equal(deltaRettifiche(v, 'materiali_cantiere'), -20)
  assert.equal(deltaRettifiche(v, 'economia'), -5)
})
test('Fattura ordinaria con prezzo negativo resta non selezionabile', () => {
  assert.match(motivoNonSelezionabile({ id: '00000000-0000-4000-8000-000000000011', quantita: 1, prezzo_unitario: -2, unita_misura: 'pz', descrizione: 'Componente sintetico' }), /prezzo/i)
})
test('Fattura ordinaria valida mantiene il predicato preesistente', () => {
  assert.equal(motivoNonSelezionabile({ id: '00000000-0000-4000-8000-000000000011', quantita: 1, prezzo_unitario: 2, unita_misura: 'pz', descrizione: 'Componente sintetico' }), null)
})
test('Lettura della riconciliazione non invoca il writer', async () => {
  const calls = []
  await leggiNotaCredito({ rpc: async (n, p) => { calls.push([n, p]); return { data: { stato: 'da riconciliare', righe: [], quote: [], rettifiche: [] }, error: null } } }, 'nota')
  assert.deepEqual(calls, [['leggi_nota_credito_fornitore', { p_nota_id: 'nota' }]])
})
test('Writer usa identificativi espliciti e chiave idempotente, nessun importo imposto dal client', async () => {
  const calls = [], righe = [{ nota_riga_id: 'riga', tipo: 'cantiere', quota_id: 'quota', quantita: '2', conferma_corrispondenza: true }]
  await applicaNotaCredito({ rpc: async (n, p) => { calls.push([n, p]); return { data: { stato: 'da riconciliare', righe: [], quote: [], rettifiche: [] }, error: null } } }, 'nota', 'origine', righe, 'richiesta')
  assert.deepEqual(calls, [['applica_nota_credito_fornitore', { p_nota_id: 'nota', p_origine_id: 'origine', p_righe: righe, p_richiesta_id: 'richiesta' }]])
})
test('Errore RPC esposto, senza sostituire dati mancanti con array vuoti', async () => {
  await assert.rejects(leggiNotaCredito({ rpc: async () => ({ data: null, error: { message: 'Lettura negata' } }) }, 'nota'), /Lettura negata/)
})

 test('Base legacy deve contenere univocamente la fonte originale prima della rettifica', () => {
   assert.equal(rettificheCompatibiliConBase(dati, ['quota-1']), true)
   assert.equal(rettificheCompatibiliConBase(dati, []), false)
   assert.equal(rettificheCompatibiliConBase(dati, ['quota-1','quota-1']), false)
 })
 test('Risposta incompleta non entra nel rendering come dati disponibili', async () => {
   await assert.rejects(leggiNotaCredito({ rpc: async () => ({ data: {}, error: null }) }, 'nota'), /risposta incompleta/)
 })
