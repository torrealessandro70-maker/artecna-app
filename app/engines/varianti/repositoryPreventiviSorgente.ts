import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mappaLavorazioniPreventivo,
  type RigaPreventivoLavorazioneDb,
  type RisultatoMappingLavorazioniPreventivo,
} from './mappaLavorazioniPreventivo'

type ClientLettura = Pick<SupabaseClient, 'from'>
type RigaDb = Record<string, unknown>

export type PreventivoSorgenteCandidato = {
  id: string
  cantiereId: string
  nomeFile?: string
  dataPreventivo?: string
  createdAt?: string
  importoTotale?: number | string
  numeroLavorazioni: number
}

export type ErroreRepositoryPreventivi = {
  stato: 'errore'
  codice: 'input_non_valido' | 'query_testate' | 'query_lavorazioni' | 'relazione_non_valida'
  messaggio: string
}

export type RisultatoElencoPreventivi =
  | { stato: 'ok'; preventivi: PreventivoSorgenteCandidato[] }
  | ErroreRepositoryPreventivi

export type RisultatoLavorazioniSorgente =
  | ({ stato: 'ok' | 'nessuna_lavorazione'; righe: readonly RigaPreventivoLavorazioneDb[] }
    & RisultatoMappingLavorazioniPreventivo)
  | ErroreRepositoryPreventivi

const idValido = (id: unknown): id is string =>
  typeof id === 'string' && id.trim().length > 0

const testo = (valore: unknown): string | undefined => idValido(valore) ? valore : undefined

// Accetta date ISO verificabili, senza interpretare formati locali ambigui.
const istante = (valore: string | undefined): number | undefined => {
  if (!valore || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(valore)) return undefined
  const giorno = Date.parse(valore.slice(0, 10))
  if (!Number.isFinite(giorno) || new Date(giorno).toISOString().slice(0, 10) !== valore.slice(0, 10)) return undefined
  const tempo = Date.parse(valore)
  return Number.isFinite(tempo) ? tempo : undefined
}

type Pagina = { data: RigaDb[] | null; error: { message: string } | null }

async function leggiPagine(query: (da: number, a: number) => PromiseLike<Pagina>): Promise<RigaDb[]> {
  const righe: RigaDb[] = []
  // Continua fino alla pagina vuota anche se il server impone un limite inferiore a 200.
  for (;;) {
    const { data, error } = await query(righe.length, righe.length + 199)
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Risposta di lettura priva di dati.')
    if (data.length === 0) return righe
    righe.push(...data)
  }
}

const erroreQuery = (
  codice: 'query_testate' | 'query_lavorazioni',
  errore: unknown,
): ErroreRepositoryPreventivi => ({
  stato: 'errore', codice,
  messaggio: errore instanceof Error ? errore.message : 'Caricamento non riuscito.',
})

export async function elencaPreventiviSorgenteVariante(
  db: ClientLettura,
  cantiereId: string,
): Promise<RisultatoElencoPreventivi> {
  if (!idValido(cantiereId)) {
    return { stato: 'errore', codice: 'input_non_valido', messaggio: 'ID cantiere non valido.' }
  }
  let testate: RigaDb[]
  try {
    testate = await leggiPagine((da, a) => db.from('preventivi_cantiere')
      .select('id, cantiere_id, nome_file, data_preventivo, importo_totale, created_at')
      .eq('cantiere_id', cantiereId).order('id', { ascending: true }).range(da, a))
  } catch (errore) {
    return erroreQuery('query_testate', errore)
  }
  const valide = testate.filter(t => idValido(t.id) && t.cantiere_id === cantiereId)
  if (valide.length === 0) return { stato: 'ok', preventivi: [] }

  let righe: RigaDb[]
  try {
    righe = await leggiPagine((da, a) => db.from('preventivo_lavorazioni')
      .select('id, preventivo_id, cantiere_id')
      .eq('cantiere_id', cantiereId).not('preventivo_id', 'is', null)
      .order('id', { ascending: true }).range(da, a))
  } catch (errore) {
    return erroreQuery('query_lavorazioni', errore)
  }
  const conteggi = new Map<string, number>()
  for (const riga of righe) {
    if (riga.cantiere_id === cantiereId && idValido(riga.preventivo_id)) {
      conteggi.set(riga.preventivo_id, (conteggi.get(riga.preventivo_id) ?? 0) + 1)
    }
  }
  const preventivi: PreventivoSorgenteCandidato[] = valide.flatMap(t => {
    const id = t.id as string
    const numeroLavorazioni = conteggi.get(id) ?? 0
    if (!numeroLavorazioni) return []
    return [{
      id, cantiereId, numeroLavorazioni,
      nomeFile: testo(t.nome_file),
      dataPreventivo: testo(t.data_preventivo),
      createdAt: testo(t.created_at),
      importoTotale: typeof t.importo_totale === 'string'
        ? testo(t.importo_totale)
        : typeof t.importo_totale === 'number' && Number.isFinite(t.importo_totale)
          ? t.importo_totale : undefined,
    }]
  })
  preventivi.sort((a, b) => {
    const dataA = istante(a.dataPreventivo) ?? istante(a.createdAt)
    const dataB = istante(b.dataPreventivo) ?? istante(b.createdAt)
    if (dataA !== dataB) {
      if (dataA === undefined) return 1
      if (dataB === undefined) return -1
      return dataB - dataA
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  return { stato: 'ok', preventivi }
}

export async function caricaLavorazioniPreventivoSorgente(
  db: ClientLettura,
  cantiereId: string,
  preventivoId: string,
): Promise<RisultatoLavorazioniSorgente> {
  if (!idValido(cantiereId) || !idValido(preventivoId)) {
    return { stato: 'errore', codice: 'input_non_valido', messaggio: 'ID cantiere o preventivo non valido.' }
  }
  let righe: RigaDb[]
  try {
    righe = await leggiPagine((da, a) => db.from('preventivo_lavorazioni')
      .select('id, preventivo_id, cantiere_id, descrizione, quantita, unita_misura, prezzo_unitario, importo_previsto')
      .eq('preventivo_id', preventivoId).eq('cantiere_id', cantiereId)
      .order('id', { ascending: true }).range(da, a))
  } catch (errore) {
    return erroreQuery('query_lavorazioni', errore)
  }
  if (righe.some(r => r.preventivo_id !== preventivoId || r.cantiere_id !== cantiereId)) {
    return { stato: 'errore', codice: 'relazione_non_valida', messaggio: 'Lavorazioni non appartenenti al preventivo e cantiere richiesti.' }
  }
  return {
    stato: righe.length ? 'ok' : 'nessuna_lavorazione',
    righe,
    ...mappaLavorazioniPreventivo(righe),
  }
}
