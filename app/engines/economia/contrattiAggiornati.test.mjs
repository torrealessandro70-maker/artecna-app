import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function importa(file, dipendenze = {}) {
  const exports = {}
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  new Function('exports', 'require', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(exports, nome => dipendenze[nome])
  return exports
}
const riepilogo = importa('./riepilogoEconomico.ts')
const { attribuzioneCosto, baseContrattuale, calcolaGestione, chiaveContratto, contrattoAggiornato, creaLettoreContratti, totaleContratti } =
  importa('./contrattiAggiornati.ts', { './riepilogoEconomico': riepilogo })
const tick = () => new Promise(setImmediate)
const euro = n => Math.round(n * 100) / 100

test('Contratto UUID, riduzioni, costi registrati e aggregazione intera', () => {
  const c = { id: 'A', nome: 'Omonimo', preventivo_contrattuale_id: 'P' }
  const p = { id: 'P', cantiere_id: 'A', importo_totale: '31438.40' }
  const base = baseContrattuale(c, p)
  assert.deepEqual(base, { preventivoId: 'P', importo: 31438.4 })
  assert.equal(baseContrattuale(c, { ...p, cantiere_id: 'B' }), null)
  assert.equal(baseContrattuale(c, { ...p, natura: 'integrativo' }), null)
  assert.equal(attribuzioneCosto({ cantiere: c.nome, cantiere_id: 'B' }, c, false), 'esterna')
  assert.equal(attribuzioneCosto({ cantiere: c.nome, cantiere_id: 'A' }, c, false), 'inclusa')
  assert.equal(attribuzioneCosto({ cantiere: c.nome }, c, false), 'ambigua')
  assert.equal(attribuzioneCosto({ cantiere: c.nome }, c, true), 'inclusa')
  const stato = totale => ({ stato: 'verificato', scomposizione: { totale } })
  const testa = contrattoAggiornato(base, stato(7851.99))
  assert.deepEqual([testa.base, testa.delta, testa.aggiornato], [31438.4, 7851.99, 39290.39])
  const gestione = calcolaGestione(testa.aggiornato, 6590.36)
  assert.equal(euro(gestione.utile), 32700.03)
  assert.equal(gestione.margine.toFixed(1), '83.2')
  assert.deepEqual(calcolaGestione(testa.aggiornato, null), { utile: null, margine: null })
  const ridotto = contrattoAggiornato({ ...base, importo: 100 }, stato(-20))
  assert.equal(ridotto.aggiornato, 80)
  assert.equal(totaleContratti([{ id: 'A', contratto: testa }, { id: 'B', contratto: ridotto }]), 39370.39)
  assert.equal(totaleContratti([{ id: 'A', contratto: testa }, { id: 'A', contratto: testa }]), null)
  const errore = contrattoAggiornato(base, { stato: 'errore', motivo: 'RPC sintetica' })
  assert.equal(errore.base, 31438.4)
  assert.equal(calcolaGestione(errore.aggiornato, 100).utile, null)
  assert.equal(totaleContratti([{ id: 'A', contratto: errore }]), null)
  assert.equal(contrattoAggiornato(base).stato, 'caricamento')
  assert.equal(contrattoAggiornato(null).stato, 'non_determinabile')
})

test('Lettura certificata condivisa, approvazione, errori e cambio di cantiere', async () => {
  const richieste = ['A', 'B', 'C', 'D', 'E'].map(id => ({ cantiereId: id, preventivoId: 'P' + id }))
  const inCoda = [], conteggio = new Map()
  const righe = [
    ...[1200, 2000, 550, 1000, 3000, 101.99].map((valore, i) => ({
      id: 'V' + i, cantiere_id: 'A', preventivo_contrattuale_id: 'PA', stato: 'approvata', importo_delta_approvato: valore,
    })),
    { id: 'bozza', cantiere_id: 'A', preventivo_contrattuale_id: 'PA', stato: 'bozza', importo_delta_approvato: 227.46 },
    { id: 'proposta', cantiere_id: 'A', preventivo_contrattuale_id: 'PA', stato: 'proposta', importo_delta_approvato: 100 },
  ]
  const client = { rpc(nome, args) {
    return { order() { return this }, range() {
      if (nome !== 'leggi_varianti_cantiere') return Promise.resolve({ data: [] })
      const id = args.p_cantiere_id
      conteggio.set(id, (conteggio.get(id) ?? 0) + 1)
      return new Promise(resolve => inCoda.push({ id, risolvi: resolve }))
    } }
  } }
  const lettore = creaLettoreContratti(client)
  const leggi = indice => lettore.snapshot().get(chiaveContratto(richieste[indice]))
  lettore.sincronizza(richieste)
  lettore.sincronizza(richieste)
  assert.deepEqual(inCoda.map(x => x.id), ['A', 'B', 'C'])
  assert.equal(leggi(0).stato, 'caricamento')
  inCoda.shift().risolvi({ data: righe })
  inCoda.shift().risolvi({ data: [] })
  inCoda.shift().risolvi({ error: { code: '42501' } })
  await tick()
  assert.equal(leggi(0).scomposizione.totale, 7851.99)
  assert.equal(leggi(1).scomposizione.totale, 0)
  assert.equal(leggi(2).stato, 'errore')
  assert.deepEqual(inCoda.map(x => x.id), ['D', 'E'])
  lettore.invalida('A')
  inCoda.shift().risolvi({ data: [] })
  inCoda.shift().risolvi({ data: [] })
  assert.equal(leggi(0).stato, 'caricamento')
  const riaperta = inCoda.shift()
  riaperta.risolvi({ data: righe.map(r => r.id === 'proposta' ? { ...r, stato: 'approvata' } : r) })
  await tick()
  assert.equal(leggi(0).scomposizione.totale, 7951.99)
  assert.deepEqual([...conteggio], [['A', 2], ['B', 1], ['C', 1], ['D', 1], ['E', 1]])
  lettore.invalida('A')
  inCoda.shift().risolvi({ data: righe.map(r => r.id === 'proposta' ? { ...r, stato: 'rifiutata' } : r) })
  await tick()
  assert.equal(leggi(0).scomposizione.totale, 7851.99)
  lettore.sincronizza([richieste[1]])
  assert.equal(leggi(0), undefined)
  assert.equal(leggi(1).scomposizione.totale, 0)
})
