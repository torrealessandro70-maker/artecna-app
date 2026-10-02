'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type JsonObject = Record<string, unknown>
type Reading = { raw: JsonObject; raccolta: JsonObject; righe: JsonObject[]; sorgenti: JsonObject[] }
type TestContext = {
  userId: string
  nome: string
  cantiereId: string | null
  raccoltaId?: string
  sorgenteId?: string
  reading?: Reading
  revisione?: number
  stato?: string
  eliminato?: boolean
}
type Result = { status: 'GREEN' | 'ERROR'; detail: unknown }
const HASH_TEST = '0000000000000000000000000000000000000000000000000000000000000001'
const TITLES = [
  'Crea cantiere sacrificabile', 'Crea raccolta', 'Salva sorgente sintetica e tre righe',
  'Leggi raccolta con prezzo NULL', 'Prova chiusura prematura', 'Valorizza Posa test',
  'Prova revisione obsoleta', 'Chiudi raccolta', 'Prova immutabilita',
  'Verifica elenco raccolte', 'ELIMINA CANTIERE TEST',
]

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
function object(value: unknown): JsonObject {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), 'Oggetto JSON atteso')
  return value as JsonObject
}
function uuid(value: unknown): string {
  ensure(typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value), 'UUID non valido')
  return value
}
function numeric(value: unknown): number {
  ensure((typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)), 'Numero non valido')
  return Number(value)
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value !== null && typeof value === 'object') {
    const record = value as JsonObject
    return '{' + Object.keys(record).sort().map(key => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}'
  }
  return JSON.stringify(value) ?? 'undefined'
}
function errorDetail(error: unknown): unknown {
  if (error instanceof Error) return { ...Object.fromEntries(Object.getOwnPropertyNames(error).map(key => [key, (error as unknown as JsonObject)[key]])), name: error.name, message: error.message }
  return error
}
function localDate(): string {
  const date = new Date()
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
}

export default function TestEconomiaPage() {
  if (process.env.NODE_ENV !== 'development') return <main className="p-8">Harness disponibile soltanto in sviluppo.</main>
  return <EconomiaHarness />
}

function EconomiaHarness() {
  // Nessun UUID da URL, input o storage: solo risposte delle RPC di questa istanza.
  const context = useRef<TestContext | null>(null)
  const completed = useRef(0)
  const busy = useRef(false)
  const stopped = useRef(false)
  const [view, setView] = useState<TestContext | null>(null)
  const [done, setDone] = useState(0)
  const [running, setRunning] = useState<number | null>(null)
  const [results, setResults] = useState<Record<number, Result>>({})

  function current(): TestContext {
    ensure(context.current, 'Contesto test assente')
    return context.current
  }
  function publish() { setView(context.current ? { ...context.current } : null) }
  async function session() {
    const response = await supabase.auth.getUser()
    if (response.error) throw response.error
    ensure(response.data.user, 'Accedi con la normale sessione autenticata dell’app')
    if (context.current) ensure(response.data.user.id === context.current.userId, 'Sessione cambiata: harness bloccato')
    return response.data.user.id
  }

  async function run(step: number) {
    if (process.env.NODE_ENV !== 'development' || busy.current || stopped.current || step !== completed.current + 1) return
    busy.current = true
    setRunning(step)
    const trace: unknown[] = []
    // Qualunque errore inatteso blocca il harness: nessun retry automatico di scritture.
    async function request(name: string, args: JsonObject) {
      await session()
      const response = await supabase.rpc(name, args)
      trace.push({ rpc: name, parametri: args, risposta: { data: response.data, error: response.error, status: response.status, statusText: response.statusText } })
      await session()
      return response
    }
    async function success(name: string, args: JsonObject): Promise<unknown> {
      const response = await request(name, args)
      if (response.error) throw response.error
      ensure(response.data !== null, 'Risposta RPC assente: ' + name)
      return response.data
    }
    async function expectedError(name: string, args: JsonObject, code: string) {
      const response = await request(name, args)
      ensure(response.error, 'La RPC doveva fallire, ma ha avuto successo: ' + name)
      ensure(response.error.code === code, 'SQLSTATE inatteso: atteso ' + code + ', ricevuto ' + response.error.code)
      if (code === 'PT409') ensure(response.status === 409, 'HTTP inatteso per conflitto revisione: atteso 409, ricevuto ' + response.status)
      trace.push({ erroreAtteso: response.error })
    }
    async function root(present: boolean) {
      const test = current()
      ensure(test.cantiereId, 'UUID cantiere test assente')
      await session()
      const response = await supabase.from('cantieri').select('id,nome,preventivo').eq('id', test.cantiereId).maybeSingle()
      trace.push({ verificaRoot: { data: response.data, error: response.error } })
      if (response.error) throw response.error
      await session()
      if (present) {
        ensure(response.data && response.data.id === test.cantiereId && response.data.nome === test.nome && numeric(response.data.preventivo) === 0, 'Root test non conforme')
      } else ensure(response.data === null, 'Root ancora presente dopo eliminazione')
    }
    function raccolta(value: unknown, revision: number, state: string): JsonObject {
      const record = object(value)
      const test = current()
      const id = uuid(record.id)
      ensure(record.cantiere_id === test.cantiereId, 'Raccolta di un altro cantiere')
      if (test.raccoltaId) ensure(id === test.raccoltaId, 'Identita raccolta diversa')
      ensure(numeric(record.numero) === 1 && numeric(record.revisione) === revision && record.stato === state, 'Numero/stato/revisione inattesi')
      ensure(record.titolo === 'Test Economia V1', 'Titolo raccolta inatteso')
      return record
    }
    async function read(revision: number, state: string, priced: boolean): Promise<Reading> {
      const test = current()
      ensure(test.raccoltaId && test.sorgenteId, 'Identita test incomplete')
      const raw = object(await success('leggi_raccolta_economia', { p_raccolta_id: test.raccoltaId }))
      const record = raccolta(raw.raccolta, revision, state)
      ensure(Array.isArray(raw.righe) && raw.righe.length === 3 && Array.isArray(raw.sorgenti) && raw.sorgenti.length === 1, 'Attese tre righe e una sorgente')
      const rows = raw.righe.map(object)
      const sources = raw.sorgenti.map(object)
      const source = sources[0]
      ensure(source.id === test.sorgenteId && source.raccolta_id === test.raccoltaId && source.tipo === 'file' && source.nome_file === 'test-economia-v1.xlsx' && source.formato === 'excel' && source.file_sha256 === HASH_TEST && numeric(source.snapshot_version) === 1, 'Sorgente sintetica non conforme')
      ensure(canonical(source.snapshot) === canonical({ test: true, harness: 'Economia V1', file_reale: false }), 'Snapshot sintetico diverso')
      const expected = [
        { descrizione: 'Demolizione test', um: 'mq', q: 10, p: 20, totale: 200 },
        { descrizione: 'Posa test', um: 'mq', q: 10, p: priced ? 30 : null, totale: priced ? 300 : null },
        { descrizione: 'Trasporto test', um: 'cad', q: 1, p: 50, totale: 50 },
      ]
      const ids = new Set<string>()
      rows.forEach((row, i) => {
        ids.add(uuid(row.id))
        const exp = expected[i]
        ensure(row.raccolta_id === test.raccoltaId && numeric(row.ordine) === i + 1 && row.descrizione === exp.descrizione && row.unita_misura === exp.um && numeric(row.quantita) === exp.q, 'Riga test non conforme: ' + (i + 1))
        ensure(row.origine === 'file' && row.sorgente_id === test.sorgenteId && numeric(row.indice_voce_sorgente) === i, 'Provenienza riga non conforme')
        ensure(row.tipo_riga === 'generica' && row.dettagli_analitici === null, 'Compatibilità generica legacy non conforme')
        ensure(exp.p === null ? row.prezzo_unitario === null : numeric(row.prezzo_unitario) === exp.p, 'Prezzo non conforme')
        ensure(exp.totale === null ? row.totale === null : numeric(row.totale) === exp.totale, 'Totale riga non conforme')
      })
      ensure(ids.size === 3 && numeric(raw.righe_non_valorizzate) === (priced ? 0 : 1) && numeric(raw.totale) === (priced ? 550 : 250), 'Riepilogo non conforme')
      const result = { raw, raccolta: record, righe: rows, sorgenti: sources }
      test.reading = result
      test.revisione = revision
      test.stato = state
      publish()
      return result
    }
    function modifyPosa(price: number, notes?: string) {
      const row = current().reading?.righe[1]
      ensure(row && row.descrizione === 'Posa test', 'Riga Posa non acquisita dalla lettura autorevole')
      return { righe_da_modificare: [{ id: uuid(row.id), ordine: row.ordine, descrizione: row.descrizione, unita_misura: row.unita_misura, quantita: row.quantita, prezzo_unitario: price, note: notes ?? row.note }] }
    }
    async function unchanged(revision: number, state: string, priced: boolean, previous: Reading) {
      const after = await read(revision, state, priced)
      ensure(canonical(after.raw) === canonical(previous.raw), 'Dati/revisione cambiati dopo errore atteso')
    }

    try {
      const userId = await session()
      if (step === 1) {
        ensure(!context.current, 'Cantiere gia creato in questa istanza')
        context.current = { userId, nome: '__TEST_ECONOMIA_V1__' + Date.now() + '_' + crypto.randomUUID().slice(0, 8), cantiereId: null }
        publish()
        const data = await success('crea_cantiere_con_owner', { p_nome: current().nome, p_preventivo: 0 })
        ensure(Array.isArray(data) && data.length === 1, 'La creazione deve restituire esattamente una root')
        const created = object(data[0])
        current().cantiereId = uuid(created.id)
        publish()
        ensure(created.nome === current().nome && numeric(created.preventivo) === 0, 'Risposta creazione non conforme')
        await root(true)
      } else {
        ensure(current().cantiereId && !current().eliminato, 'Cantiere test non operativo')
        await root(true)
        if (step === 2) {
          const value = await success('crea_raccolta_economia', { p_cantiere_id: current().cantiereId, p_titolo: 'Test Economia V1', p_data: localDate(), p_note: 'Harness runtime Economia V1' })
          const created = object(value)
          current().raccoltaId = uuid(created.id)
          publish()
          raccolta(created, 0, 'bozza')
          current().revisione = 0
          current().stato = 'bozza'
        } else if (step === 3) {
          ensure(current().raccoltaId, 'UUID raccolta assente')
          const sourceId = crypto.randomUUID()
          const payload = {
            sorgenti_da_aggiungere: [{ id: sourceId, nome_file: 'test-economia-v1.xlsx', formato: 'excel', file_sha256: HASH_TEST, snapshot_version: 1, snapshot: { test: true, harness: 'Economia V1', file_reale: false } }],
            righe_da_creare: [
              { ordine: 1, descrizione: 'Demolizione test', unita_misura: 'mq', quantita: 10, prezzo_unitario: 20 },
              { ordine: 2, descrizione: 'Posa test', unita_misura: 'mq', quantita: 10, prezzo_unitario: null },
              { ordine: 3, descrizione: 'Trasporto test', unita_misura: 'cad', quantita: 1, prezzo_unitario: 50 },
            ].map((row, i) => ({ ...row, note: null, origine: 'file', sorgente_id: sourceId, indice_voce_sorgente: i })),
          }
          const saved = object(await success('salva_bozza_economia', { p_raccolta_id: current().raccoltaId, p_revisione_attesa: 0, p_payload: payload }))
          raccolta(saved.raccolta, 1, 'bozza')
          ensure(numeric(saved.righe_non_valorizzate) === 1 && numeric(saved.totale) === 250, 'Riepilogo salvataggio inatteso')
          current().sorgenteId = sourceId
          current().revisione = 1
        } else if (step === 4) {
          await read(1, 'bozza', false)
        } else if (step === 5) {
          const previous = current().reading
          ensure(previous, 'Lettura precedente assente')
          await expectedError('chiudi_raccolta_economia', { p_raccolta_id: current().raccoltaId, p_revisione_attesa: 1 }, '22023')
          await unchanged(1, 'bozza', false, previous)
        } else if (step === 6) {
          const saved = object(await success('salva_bozza_economia', { p_raccolta_id: current().raccoltaId, p_revisione_attesa: 1, p_payload: modifyPosa(30) }))
          raccolta(saved.raccolta, 2, 'bozza')
          await read(2, 'bozza', true)
        } else if (step === 7) {
          const previous = current().reading
          ensure(previous, 'Lettura precedente assente')
          await expectedError('salva_bozza_economia', { p_raccolta_id: current().raccoltaId, p_revisione_attesa: 1, p_payload: modifyPosa(30, 'REVISIONE_OBSOLETA_NON_DEVE_SCRIVERE') }, 'PT409')
          await unchanged(2, 'bozza', true, previous)
        } else if (step === 8) {
          const closed = object(await success('chiudi_raccolta_economia', { p_raccolta_id: current().raccoltaId, p_revisione_attesa: 2 }))
          raccolta(closed.raccolta, 3, 'chiusa')
          await read(3, 'chiusa', true)
        } else if (step === 9) {
          const previous = current().reading
          ensure(previous, 'Lettura precedente assente')
          await expectedError('salva_bozza_economia', { p_raccolta_id: current().raccoltaId, p_revisione_attesa: 3, p_payload: modifyPosa(30, 'CHIUSA_NON_DEVE_SCRIVERE') }, '55000')
          await unchanged(3, 'chiusa', true, previous)
        } else if (step === 10) {
          const list = await success('leggi_raccolte_economia', { p_cantiere_id: current().cantiereId })
          ensure(Array.isArray(list) && list.length === 1, 'Attesa esattamente una raccolta nel cantiere test')
          const item = object(list[0])
          raccolta(item, 3, 'chiusa')
          ensure(numeric(item.totale) === 550 && numeric(item.righe_non_valorizzate) === 0, 'Riepilogo elenco inatteso')
        } else if (step === 11) {
          ensure(completed.current === 10 && current().stato === 'chiusa' && current().revisione === 3, 'Prerequisiti eliminazione non GREEN')
          const data = await success('elimina_cantiere_definitivamente', { p_cantiere_id: current().cantiereId, p_conferma: 'ELIMINA' })
          ensure(Array.isArray(data) && data.length === 1, 'Risposta eliminazione inattesa')
          const deletion = object(data[0])
          ensure(deletion.eliminato === true && deletion.cantiere_id === current().cantiereId, 'Eliminazione non confermata per la root test')
          const counts = object(deletion.conteggi)
          ensure(numeric(counts.economia_raccolte) === 1 && numeric(counts.economia_sorgenti) === 1 && numeric(counts.economia_righe) === 3, 'Conteggi Economia eliminazione non conformi')
          await root(false)
          current().eliminato = true
        }
      }
      await session()
      publish()
      completed.current = step
      setDone(step)
      setResults(prev => ({ ...prev, [step]: { status: 'GREEN', detail: trace } }))
    } catch (error) {
      stopped.current = true
      publish()
      setResults(prev => ({ ...prev, [step]: { status: 'ERROR', detail: { errore: errorDetail(error), chiamate: trace, messaggio: 'Harness bloccato. Nessuna ripetizione automatica o recupero dopo refresh.' } } }))
    } finally {
      busy.current = false
      setRunning(null)
    }
  }

  return <main className="mx-auto max-w-5xl space-y-6 p-6 text-slate-900">
    <header className="space-y-2">
      <h1 className="text-2xl font-semibold">Economia V1 — harness runtime DEV</h1>
      <p>Undici click separati. Opera soltanto sul cantiere sacrificabile creato da questa istanza. Nessun file reale, parser o Storage.</p>
      <p className="text-sm text-slate-600">Gli UUID restano solo in memoria: un refresh li perde. Un errore inatteso blocca i passi successivi e i retry.</p>
    </header>
    <section className="rounded border border-slate-300 bg-slate-50 p-4 text-sm">
      <dl className="space-y-1 break-all">
        <div><dt className="inline font-semibold">Cantiere test: </dt><dd className="inline">{view?.cantiereId ?? 'Non creato'}</dd></div>
        <div><dt className="inline font-semibold">Nome: </dt><dd className="inline">{view?.nome ?? '—'}</dd></div>
        <div><dt className="inline font-semibold">Raccolta: </dt><dd className="inline">{view?.raccoltaId ?? 'Non creata'}</dd></div>
        <div><dt className="inline font-semibold">Revisione / stato: </dt><dd className="inline">{view?.revisione ?? '—'} / {view?.stato ?? '—'}{view?.eliminato ? ' / cantiere eliminato' : ''}</dd></div>
      </dl>
      {view?.reading && <p className="mt-3 font-medium">{numeric(view.reading.raw.righe_non_valorizzate) > 0 ? 'Totale parziale: 250,00 €. Una riga non valorizzata; prezzo e totale Posa sono NULL.' : 'Totale completo: 550,00 €. Tutte le righe valorizzate.'}</p>}
    </section>
    {TITLES.map((title, index) => {
      const step = index + 1
      const result = results[step]
      return <section key={step} className={'space-y-3 rounded border p-4 ' + (step === 11 ? 'mt-8 border-red-400 bg-red-50' : 'border-slate-200')}>
        <h2 className="font-semibold">{step}. {title}</h2>
        {step === 11 && <p className="text-sm text-red-800">Cancella definitivamente la root test e la raccolta chiusa. Abilitato solo dopo dieci step GREEN.</p>}
        <button type="button" disabled={running !== null || stopped.current || step !== done + 1} onClick={() => void run(step)} className={'rounded px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 ' + (step === 11 ? 'bg-red-700' : 'bg-slate-800')}>
          {running === step ? 'In corso…' : title}
        </button>
        {result && <div aria-live="polite"><p className={result.status === 'GREEN' ? 'font-semibold text-green-700' : 'font-semibold text-red-700'}>{result.status}</p><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(result.detail, null, 2)}</pre></div>}
      </section>
    })}
    <EconomiaAnaliticaHarness />
  </main>
}

const ANALYTIC_TITLES = [
  'Crea cantiere e raccolta analitici sacrificabili', 'Salva snapshot v2, quattro righe analitiche e una legacy',
  'Verifica normalizzazione, dettagli, snapshot e indici', 'Chiusura con tariffa NULL rifiutata',
  'Valorizza tariffa e imposta prezzo materiale NULL', 'Chiusura con prezzo materiale NULL rifiutata',
  'Rettifica materiale a zero: distinto da NULL', 'PT409 su salvataggio e chiusura obsoleti',
  'Rollback di sorgente e righe dopo errore analitico', 'Schema, precisione, indici e provenienza invalidi rifiutati',
  'Modifica analitica e modifica legacy; snapshot invariato', 'Data operativa incompleta blocca chiusura',
  'Chiudi con qualifica vuota e warning documentale', 'Immutabilità analitica dopo chiusura',
  'Verifica elenco e compatibilità legacy', 'ELIMINA CANTIERE ANALITICO TEST',
]

function fixtureAnalitica(nome: string) {
  const maps = {
    manodopera: ['cantiere','codice_variante','data','operaio','qualifica','ora_inizio','ora_fine','pausa_min','ore_dichiarate','tariffa_dichiarata','totale_dichiarato','riferimento','note'],
    materiale: ['cantiere','codice_variante','data','materiale','um','quantita_dichiarata','prezzo_dichiarato','totale_dichiarato','fornitore','documento','riferimento_rapportino','note'],
  }
  const cell = (valore: string | number | null, formula: string | null = null, formato = 'General') => ({
    tipo: valore === null ? 'z' : typeof valore === 'number' ? 'n' : 's',
    valore: valore === null ? null : String(valore), formula, formato,
    visualizzato: valore === null ? null : String(valore),
  })
  const fogli: Record<string, { riga_intestazioni: number; righe: Record<string, unknown> }> = {
    'Manodopera economia': { riga_intestazioni: 5, righe: {} },
    'Materiali economia': { riga_intestazioni: 4, righe: {} },
  }
  const snapshot = { version: 2, template: 'ARTECNA_Template_Import_Varianti_Extra_v2', date1904: false, fogli }
  const rows = [
    { tipo: 'manodopera' as const, riga: 6, q: 5, p: 20, rawQ: 4.999999999999993, rawTotal: 99.99999999999986 },
    { tipo: 'manodopera' as const, riga: 7, q: 4, p: null, rawQ: 4, rawTotal: null },
    { tipo: 'materiale' as const, riga: 5, q: 2, p: 9.7, rawQ: 2, rawTotal: 19.4 },
    { tipo: 'materiale' as const, riga: 6, q: 1, p: 0, rawQ: 1, rawTotal: 0 },
  ].map((v, i) => {
    const labor = v.tipo === 'manodopera', sheet = labor ? 'Manodopera economia' : 'Materiali economia'
    const values = labor
      ? [nome,'VAR-TEST-001',46286,'Operaio test',null,0.3125,labor && v.riga === 7 ? 0.4791666666666667 : 0.520833333333333,0,v.rawQ,v.p,v.rawTotal,'Rapportino 21/09/2027','Note originali']
      : [nome,'VAR-TEST-001',46286,'Materiale test','pz',v.rawQ,v.p,v.rawTotal,null,null,null,'Note originali']
    const cells = Object.fromEntries(values.map((value, c) => {
      const column = String.fromCharCode(65 + c)
      const formula = (labor && (column === 'I' || column === 'K')) || (!labor && column === 'H') ? (column === 'I' ? 'IF(OR(F'+v.riga+'="",G'+v.riga+'=""),"",MAX(0,MOD(G'+v.riga+'-F'+v.riga+',1)*24-H'+v.riga+'/60))' : (labor ? 'I' : 'F')+v.riga+'*'+(labor ? 'J' : 'G')+v.riga) : null
      return [column+v.riga,cell(value,formula,(labor && ['I','J','K'].includes(column)) || (!labor && ['F','G','H'].includes(column)) ? '0.00' : 'General')]
    }))
    fogli[sheet].righe[String(v.riga)] = { celle: cells, warnings: [] }
    const details = {
      version: 1,
      sorgente: { foglio_sorgente: sheet, riga_sorgente: v.riga, ...Object.fromEntries(maps[v.tipo].map((k,c) => [k,String.fromCharCode(65+c)+v.riga])) },
      operativo: labor
        ? { cantiere_dichiarato: nome, codice_variante: 'VAR-TEST-001', data: '2026-09-21', operaio: 'Operaio test', qualifica: null, ora_inizio: '07:30', ora_fine: v.riga === 7 ? '11:30' : '12:30', pausa_min: 0, riferimento: 'Rapportino 21/09/2027' }
        : { cantiere_dichiarato: nome, codice_variante: 'VAR-TEST-001', data: '2026-09-21', fornitore: null, documento: null, riferimento_rapportino: null },
      normalizzazione: { regola: 'artecna_template_extra_v2_precisione_v1', quantita: { decimali: 2, origine: 'sorgente', motivazione: null }, prezzo_unitario: { decimali: 2, origine: 'sorgente', motivazione: null } },
      warnings: { sorgente: [], operativo: [] },
    }
    return { ordine: i+1, descrizione: labor ? 'Manodopera test' : 'Materiale test', unita_misura: labor ? 'h' : 'pz', quantita: v.q, prezzo_unitario: v.p,
      note: 'Note operative', origine: 'file', indice_voce_sorgente: 2*(v.riga-1)+(labor ? 0 : 1), tipo_riga: v.tipo, dettagli_analitici: details }
  })
  // Riga incompleta esclusa dalle righe operative, integralmente nello snapshot.
  const incomplete = structuredClone(object(fogli['Materiali economia'].righe['6']))
  const originalCells = object(incomplete.celle)
  incomplete.celle = Object.fromEntries(Object.entries(originalCells).map(([k,v]) => [k.replace('6','21'),k === 'D6' ? cell(null) : v]))
  incomplete.warnings = [{ codice: 'materiale_mancante', campi: ['materiale'] }]
  fogli['Materiali economia'].righe['21'] = incomplete
  return { snapshot, rows }
}

function EconomiaAnaliticaHarness() {
  const ctx = useRef<{ userId: string; nome: string; cantiereId: string; raccoltaId?: string; sourceId?: string; snapshot?: unknown; reading?: JsonObject } | null>(null)
  const busy = useRef(false)
  const completed = useRef(0)
  const stopped = useRef(false)
  const [done,setDone] = useState(0)
  const [running,setRunning] = useState<number | null>(null)
  const [results,setResults] = useState<Record<number,Result>>({})
  async function run(step: number) {
    if (process.env.NODE_ENV !== 'development' || busy.current || stopped.current || step !== completed.current+1) return
    busy.current = true; setRunning(step)
    const trace: unknown[] = []
    const current = () => { ensure(ctx.current,'Contesto analitico assente'); return ctx.current }
    async function session() {
      const r = await supabase.auth.getUser()
      if (r.error) throw r.error
      ensure(r.data.user && (!ctx.current || r.data.user.id === ctx.current.userId),'Sessione assente/cambiata')
      return r.data.user.id
    }
    async function rpc(name: string,args: JsonObject,code?: string) {
      await session()
      const r = await supabase.rpc(name,args)
      trace.push({ rpc: name, args, data: r.data, error: r.error, status: r.status })
      await session()
      if (code) {
        ensure(r.error?.code === code,'Errore atteso '+code+', ricevuto '+r.error?.code)
        if (code === 'PT409') ensure(r.status === 409,'PT409 deve avere HTTP 409')
      } else if (r.error) throw r.error
      return r.data
    }
    async function read() {
      const c = current()
      const raw = object(await rpc('leggi_raccolta_economia',{p_raccolta_id:c.raccoltaId}))
      const collection = object(raw.raccolta)
      ensure(collection.id === c.raccoltaId && collection.cantiere_id === c.cantiereId,'Identità raccolta analitica inattesa')
      ensure(Array.isArray(raw.righe) && Array.isArray(raw.sorgenti),'Lettura analitica non valida')
      c.reading = raw
      return raw
    }
    const revision = () => numeric(object(current().reading?.raccolta).revisione)
    const rows = () => { const r=current().reading?.righe; ensure(Array.isArray(r),'Righe assenti'); return r.map(object) }
    const change = (row: JsonObject,fields: JsonObject) => ({ id:uuid(row.id), ordine:row.ordine, descrizione:row.descrizione, unita_misura:row.unita_misura, quantita:row.quantita, prezzo_unitario:row.prezzo_unitario, note:row.note, ...fields })
    async function save(payload: JsonObject,expected = revision()) {
      const v=object(await rpc('salva_bozza_economia',{p_raccolta_id:current().raccoltaId,p_revisione_attesa:expected,p_payload:payload}))
      ensure(numeric(object(v.raccolta).revisione)===expected+1,'Incremento revisione inatteso')
      return read()
    }
    async function reject(payload: JsonObject,code='22023',expected=revision()) {
      const before=canonical(current().reading)
      await rpc('salva_bozza_economia',{p_raccolta_id:current().raccoltaId,p_revisione_attesa:expected,p_payload:payload},code)
      ensure(canonical(await read())===before,'Rollback incompleto dopo errore')
    }
    async function rejectClose(code='22023',expected=revision()) {
      const before=canonical(current().reading)
      await rpc('chiudi_raccolta_economia',{p_raccolta_id:current().raccoltaId,p_revisione_attesa:expected},code)
      ensure(canonical(await read())===before,'Chiusura fallita ha modificato la raccolta')
    }
    const rectified = (row: JsonObject,price: number | null) => {
      const details=structuredClone(object(row.dettagli_analitici))
      object(details.normalizzazione).prezzo_unitario={decimali:2,origine:'rettifica',motivazione:'Rettifica esplicita del test runtime'}
      return change(row,{prezzo_unitario:price,dettagli_analitici:details})
    }
    try {
      const userId=await session()
      if (step === 1) {
        ensure(!ctx.current,'Test già creato')
        const nome='__TEST_ECONOMIA_ANALITICA__'+Date.now()+'_'+crypto.randomUUID().slice(0,8)
        const created=await rpc('crea_cantiere_con_owner',{p_nome:nome,p_preventivo:0})
        ensure(Array.isArray(created)&&created.length===1,'Root test non verificabile')
        ctx.current={userId,nome,cantiereId:uuid(object(created[0]).id)}
        const c=object(await rpc('crea_raccolta_economia',{p_cantiere_id:current().cantiereId,p_titolo:'Test Economia analitica',p_data:localDate(),p_note:null}))
        current().raccoltaId=uuid(c.id)
        await read()
      } else if (step === 2) {
        const fixture=fixtureAnalitica(current().nome), sourceId=crypto.randomUUID()
        current().sourceId=sourceId; current().snapshot=structuredClone(fixture.snapshot)
        const bytes=new TextEncoder().encode(JSON.stringify(fixture.snapshot))
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')
        await save({sorgenti_da_aggiungere:[{id:sourceId,nome_file:'fixture-analitica.xlsx',formato:'excel',file_sha256:hash,snapshot_version:2,snapshot:fixture.snapshot}],
          righe_da_creare:[...fixture.rows.map(r=>({...r,sorgente_id:sourceId})),{ordine:5,descrizione:'Legacy manuale',unita_misura:'cad',quantita:1,prezzo_unitario:3,note:null,origine:'manuale',sorgente_id:null,indice_voce_sorgente:null}]})
      } else if (step === 3) {
        const raw=await read(), r=rows(), sources=(raw.sorgenti as unknown[]).map(object)
        ensure(r.length===5&&sources.length===1,'Attese cinque righe e una sorgente')
        ensure(canonical(sources[0].snapshot)===canonical(current().snapshot)&&numeric(sources[0].snapshot_version)===2,'Snapshot v2 cambiato')
        ensure(numeric(r[0].quantita)===5&&numeric(r[0].totale)===100,'Floating point non normalizzato')
        ensure(r[1].prezzo_unitario===null&&r[1].totale===null&&numeric(r[3].prezzo_unitario)===0&&numeric(r[3].totale)===0,'NULL e zero confusi')
        ensure(r.map(x=>x.indice_voce_sorgente).slice(0,4).join(',')==='10,12,9,11','Indici pari/dispari errati')
        ensure(r[4].tipo_riga==='generica'&&r[4].dettagli_analitici===null,'Legacy non compatibile')
        const details=object(r[0].dettagli_analitici), warnings=object(details.warnings).sorgente
        ensure(Array.isArray(warnings)&&warnings.some(w=>object(w).codice==='qualifica_mancante')&&warnings.some(w=>object(w).codice==='riferimento_data_discordante'),'Warnings originali persi')
      } else if (step === 4 || step === 6) await rejectClose()
      else if (step === 5) await save({righe_da_modificare:[rectified(rows()[1],8),rectified(rows()[2],null)]})
      else if (step === 7) {
        await save({righe_da_modificare:[rectified(rows()[2],0)]})
        ensure(rows()[2].prezzo_unitario!==null&&numeric(rows()[2].prezzo_unitario)===0&&numeric(current().reading?.righe_non_valorizzate)===0,'Zero non valorizzato')
      } else if (step === 8) {
        await reject({righe_da_modificare:[change(rows()[4],{note:'NON SCRIVERE'})]},'PT409',revision()-1)
        await rejectClose('PT409',revision()-1)
      } else if (step === 9) {
        const fixture=fixtureAnalitica(current().nome), sourceId=crypto.randomUUID()
        const bad=structuredClone(fixture.rows[0]); bad.indice_voce_sorgente=11
        await reject({sorgenti_da_aggiungere:[{id:sourceId,nome_file:'rollback.xlsx',formato:'excel',file_sha256:'f'.repeat(64),snapshot_version:2,snapshot:fixture.snapshot}],
          righe_da_creare:[{ordine:6,descrizione:'Non deve restare',unita_misura:'cad',quantita:1,prezzo_unitario:1,origine:'manuale',sorgente_id:null,indice_voce_sorgente:null}, {...bad,ordine:7,sorgente_id:sourceId}]})
      } else if (step === 10) {
        const row=rows()[0]
        await reject({righe_da_modificare:[change(row,{tipo_riga:'materiale'})]})
        const wrong=structuredClone(object(row.dettagli_analitici)); object(wrong.sorgente).riga_sorgente=7
        await reject({righe_da_modificare:[change(row,{dettagli_analitici:wrong})]})
        const version=structuredClone(object(row.dettagli_analitici)); version.version=2
        await reject({righe_da_modificare:[change(row,{dettagli_analitici:version})]})
        await reject({righe_da_modificare:[change(row,{quantita:5.001,dettagli_analitici:row.dettagli_analitici})]})
        await reject({righe_da_modificare:[change(rows()[2],{descrizione:'',dettagli_analitici:rows()[2].dettagli_analitici})]})
        const fixture=fixtureAnalitica(current().nome),bad=structuredClone(fixture.rows[0]); bad.indice_voce_sorgente=9
        await reject({righe_da_creare:[{...bad,ordine:6,sorgente_id:current().sourceId}]})
        const extra=structuredClone(object(row.dettagli_analitici)); extra.campo_non_ammesso=true
        await reject({righe_da_modificare:[change(row,{dettagli_analitici:extra})]})
      } else if (step === 11) {
        const row=rows()[0],details=structuredClone(object(row.dettagli_analitici))
        object(details.operativo).riferimento='Riferimento operativo corretto'
        await save({righe_da_modificare:[change(row,{note:'Note corrette',dettagli_analitici:details}),change(rows()[4],{prezzo_unitario:4})]})
        const source=object((current().reading?.sorgenti as unknown[])[0])
        ensure(canonical(source.snapshot)===canonical(current().snapshot),'Snapshot originale modificato')
        ensure(numeric(rows()[4].prezzo_unitario)===4&&rows()[4].tipo_riga==='generica','Modifica legacy fallita')
      } else if (step === 12) {
        const row=rows()[2],details=structuredClone(object(row.dettagli_analitici)); object(details.operativo).data=null
        await save({righe_da_modificare:[change(row,{dettagli_analitici:details})]})
        await rejectClose()
        object(details.operativo).data='2026-09-21'
        await save({righe_da_modificare:[change(rows()[2],{dettagli_analitici:details})]})
      } else if (step === 13) {
        const rev=revision()
        const result=object(await rpc('chiudi_raccolta_economia',{p_raccolta_id:current().raccoltaId,p_revisione_attesa:rev}))
        ensure(object(result.raccolta).stato==='chiusa'&&numeric(object(result.raccolta).revisione)===rev+1,'Chiusura non conforme')
        await read()
      } else if (step === 14) {
        await reject({righe_da_modificare:[change(rows()[0],{note:'CHIUSA NON SCRIVERE'})]},'55000')
        await reject({righe_da_eliminare:[rows()[0].id]},'55000')
        await reject({riordino:[{id:rows()[0].id,ordine:6}]},'55000')
      } else if (step === 15) {
        const list=await rpc('leggi_raccolte_economia',{p_cantiere_id:current().cantiereId})
        ensure(Array.isArray(list)&&list.length===1&&object(list[0]).stato==='chiusa','Elenco analitico non conforme')
        ensure(numeric(object(list[0]).totale)===136&&numeric(object(list[0]).righe_non_valorizzate)===0,'Totale finale inatteso')
      } else if (step === 16) {
        const deleted=await rpc('elimina_cantiere_definitivamente',{p_cantiere_id:current().cantiereId,p_conferma:'ELIMINA'})
        ensure(Array.isArray(deleted)&&deleted.length===1&&object(deleted[0]).eliminato===true,'Eliminazione analitica non confermata')
        const counts=object(object(deleted[0]).conteggi)
        ensure(numeric(counts.economia_raccolte)===1&&numeric(counts.economia_sorgenti)===1&&numeric(counts.economia_righe)===5,'Conteggi cleanup errati')
      }
      completed.current=step; setDone(step); setResults(p=>({...p,[step]:{status:'GREEN',detail:trace}}))
    } catch(error) {
      stopped.current=true; setResults(p=>({...p,[step]:{status:'ERROR',detail:{error:errorDetail(error),trace}}}))
    } finally { busy.current=false; setRunning(null) }
  }
  return <section className="mt-12 space-y-4 border-t pt-8">
    <h2 className="text-xl font-semibold">Economia analitica — 16 step aggiuntivi</h2>
    <p>Eseguire solo dopo la nuova migration. Usa un secondo cantiere sacrificabile e snapshot sintetici; i 11 test legacy sopra restano separati. Nessun file reale o Storage.</p>
    {ANALYTIC_TITLES.map((title,i)=><section key={title} className="space-y-2 rounded border p-4">
      <h3>{i+1}. {title}</h3>
      {i===15&&<p>Elimina definitivamente solo il cantiere creato da questi test analitici.</p>}
      <button type="button" disabled={running!==null||stopped.current||done!==i} onClick={()=>void run(i+1)} className="rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-40">{running===i+1?'In corso…':title}</button>
      {results[i+1]&&<div aria-live="polite"><p>{results[i+1].status}</p><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(results[i+1].detail,null,2)}</pre></div>}
    </section>)}
  </section>
}
