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
  importa('./contrattiAggiornati.ts', { './riepilogoEconomico': riepilogo, './accordiContrattuali': importa('./accordiContrattuali.ts') })
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

test('Specifica perimetro contrattuale per destinazione esplicita, a parita di documenti', () => {
  const clienteId = 'adf89015-801a-4983-ba8f-3de82821359b'
  const archivioId = '7e567564-ac67-48f5-ae0e-21aba07dfbaa'
  const storicoId = '5b1fc4ec-6ce3-4d75-b3a1-2a8cced86686'
  const daClassificareId = 'e359fca2-6e28-4a14-a4a7-a0dc0827d793'
  const destinazioni = new Map([
    [clienteId, 'lavori_contrattuali'],
    [archivioId, 'archivio_personale'],
    [storicoId, 'lavori_contrattuali'],
    [daClassificareId, 'da_classificare'],
  ])
  const base = { preventivoId: 'contratto-cliente', importo: 31438.4 }
  const contratto = contrattoAggiornato(base, { stato: 'verificato', scomposizione: { totale: 8079.45 } })
  const senzaBase = contrattoAggiornato(null)
  const cantieri = [
    { id: clienteId, nome: 'Omonimo', contratto },
    { id: archivioId, nome: 'Omonimo', contratto: senzaBase },
    { id: storicoId, nome: 'Storico', contratto: senzaBase },
    { id: daClassificareId, nome: 'Da classificare', contratto: senzaBase },
  ]
  const registro = [
    { id: 'fattura-cliente', cantiereId: clienteId, costo: 6590.36, totale: 10000, iva: 909.09 },
    { id: 'fattura-archivio', cantiereId: archivioId, costo: 100, totale: 122, iva: 22 },
  ]
  const prima = structuredClone(registro)
  const commerciali = cantieri.filter(c => destinazioni.get(c.id) === 'lavori_contrattuali')
  const verificati = commerciali.filter(c => c.contratto.stato === 'verificato')
  const archivi = cantieri.filter(c => destinazioni.get(c.id) === 'archivio_personale')
  const daClassificare = cantieri.filter(c => destinazioni.get(c.id) === 'da_classificare')
  const costiGestionali = registro.filter(r => verificati.some(c => c.id === r.cantiereId))
    .reduce((totale, r) => totale + r.costo, 0)
  const parziale = totaleContratti(verificati)
  const completo = totaleContratti([...commerciali, ...daClassificare])
  assert.equal(parziale, 39517.85)
  assert.equal(completo, null)
  assert.equal(commerciali.length - verificati.length, 1)
  assert.equal(daClassificare.length, 1)
  assert.deepEqual(archivi.map(c => c.id), [archivioId])
  assert.equal(totaleContratti(cantieri.filter(c => c.id === clienteId)), 39517.85)
  const gestione = calcolaGestione(parziale, costiGestionali)
  assert.equal(euro(gestione.utile), 32927.49)
  assert.equal(gestione.margine.toFixed(1), '83.3')
  assert.deepEqual(registro, prima)
  assert.equal(registro.reduce((totale, r) => totale + r.costo, 0), 6690.36)
})

test('La designazione esplicita verifica UUID e SAL prima di modificare il riferimento', async () => {
  const { impostaPreventivoContrattuale } = importa('../../utils/preventivoContrattuale.ts')
  const changes = []
  function fakeDb({ hidden = false, foreignSal = false } = {}) {
    return {
      from(table) {
        const filters = {}
        let change
        const query = {
          select: () => query,
          eq: (key, value) => { filters[key] = value; return query },
          or: () => query,
          order: () => query,
          range: () => ({
            data: foreignSal ? [{ cantiere_id: 'C', source_lavorazione_id: 1 }] : [],
            count: foreignSal ? 1 : 0,
          }),
          maybeSingle: () => ({ data: { id: 1, cantiere_id: 'C', preventivo_id: 'ALTRO' } }),
          update: value => { change = value; return query },
          single: () => {
            if (table === 'preventivi_cantiere') {
              assert.deepEqual(filters, { id: 'P', cantiere_id: 'C' })
              return { data: hidden ? null : { id: 'P', cantiere_id: 'C' } }
            }
            assert.equal(table, 'cantieri')
            changes.push([filters, change])
            return { data: { id: 'C', ...change } }
          },
        }
        return query
      },
    }
  }
  await assert.rejects(impostaPreventivoContrattuale(fakeDb({ hidden: true }), 'C', 'P'), /non è disponibile/)
  await assert.rejects(impostaPreventivoContrattuale(fakeDb({ foreignSal: true }), 'C', 'P'), /SAL collegati/)
  assert.deepEqual(changes, [])
  await impostaPreventivoContrattuale(fakeDb(), 'C', 'P')
  assert.deepEqual(changes, [[{ id: 'C' }, { preventivo_contrattuale_id: 'P' }]])
})

test('Classificazione definitiva separa destinazione, conclusione e contratto', () => {
  const { statoLavori, gruppoHome, riepilogoContrattiHome } =
    importa('./classificazioneCantieri.ts', { './contrattiAggiornati': { totaleContratti } })
  const contratto = contrattoAggiornato({ preventivoId: 'P', importo: 31438.4 },
    { stato: 'verificato', scomposizione: { totale: 8079.45 } })
  const sconosciuto = contrattoAggiornato(null)
  const reali = [
    { id: 'a', nome: 'Omonimo', destinazione_amministrativa: 'cantiere_lavori', fase_lavori: 'in_corso', contratto },
    { id: 'b', nome: 'Omonimo', destinazione_amministrativa: 'archivio_acquisti_personali', lavori_conclusi: true, contratto },
    { id: 'c', destinazione_amministrativa: 'cantiere_lavori', fase_lavori: 'in_programma', preventivo: 950, contratto: sconosciuto },
    { id: 'd', destinazione_amministrativa: 'cantiere_lavori', fase_lavori: 'in_corso', lavori_conclusi: true, preventivo: 1200, contratto: sconosciuto },
    { id: 'e', lavori_conclusi: false, contratto: sconosciuto },
  ]
  assert.deepEqual(reali.map(gruppoHome), ['in_corso', 'archivio', 'in_programma', 'concluso', 'da_classificare'])
  assert.equal(statoLavori(reali[4]), 'da_precisare')
  assert.equal(statoLavori({ ...reali[3], lavori_conclusi: false }), 'in_corso')
  const riepilogo = riepilogoContrattiHome(reali, true)
  assert.equal(riepilogo.parziale, 39517.85)
  assert.equal(riepilogo.complessivo, null)
  assert.equal(riepilogo.nonDeterminabili, 2)
  assert.equal(riepilogo.daClassificare, 1)
  assert.equal(riepilogoContrattiHome(reali.slice(0, 2), true).complessivo, 39517.85)
  assert.equal(riepilogoContrattiHome([reali[0], reali[0]], true).parziale, null)
  assert.equal(riepilogoContrattiHome(reali, false).parziale, null)
})
