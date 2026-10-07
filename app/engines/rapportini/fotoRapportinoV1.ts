import { LIMITI_ALLEGATI, validaByteSizeAllegato, validaDataAllegato, validaMimeAllegato,
  validaSHA256Allegato, validaUUIDAllegato } from './contrattoAllegati'
import type { ByteSizeAllegato, DataAllegato, MimeAllegato, SHA256Allegato, UUIDAllegato } from './contrattoAllegati'

/** Capability pubblica: nessuna conoscenza di autenticazione o Storage. */
export type ContestoFoto = Readonly<{ cantiere_id: UUIDAllegato; data: DataAllegato; rapportino_id: UUIDAllegato | null }>
export type StatoUploadFoto = 'in_coda' | 'pronta' | 'caricamento' | 'finalizzazione' | 'completata'
  | 'errore' | 'scaduta' | 'richiesta_cancellazione' | 'cancellazione_pending' | 'cancellato'
export type ErroreFoto = Readonly<{ codice: 'file' | 'persistenza' | 'quota_locale' | 'sessione' | 'autorizzazione'
  | 'conflitto' | 'scaduta' | 'integrita' | 'trasporto'; ritentabile: boolean; scadenza_persistita?: true }>
export type FotoLocaleInCoda = Readonly<{
  chiave_client_allegato: UUIDAllegato; blob: Blob; mime_type: MimeAllegato; byte_size: ByteSizeAllegato
  sha256: SHA256Allegato; contesto: ContestoFoto; stato: StatoUploadFoto; creata_at_ms: number
}>
export type FotoPersistita = (
  | Readonly<{ origine: 'LEGACY'; foto_cantiere_id: UUIDAllegato; riferimento_legacy: string }>
  | Readonly<{ origine: 'V1'; allegato_id: UUIDAllegato; chiave_client_allegato: UUIDAllegato;
      mime_type: MimeAllegato; byte_size: ByteSizeAllegato }> & (
      | Readonly<{ stato: 'finalizzato' | 'cancellazione_pending'; foto_cantiere_id: UUIDAllegato }>
      | Readonly<{ stato: 'cancellato'; foto_cantiere_id: null }> )
)
export type EsitoFoto<T> = Readonly<{ ok: true; valore: T }> | Readonly<{ ok: false; errore: ErroreFoto }>
export interface TrasportoFotoRapportinoV1 {
  caricaFoto(foto: FotoLocaleInCoda): Promise<EsitoFoto<FotoPersistita>>
  ritentaFoto(foto: FotoLocaleInCoda): Promise<EsitoFoto<FotoPersistita>>
  elencaFoto(contesto: ContestoFoto): Promise<EsitoFoto<readonly FotoPersistita[]>>
  apriFoto(foto: FotoPersistita): Promise<EsitoFoto<Readonly<{ url: string; expires_at: string | null }>>>
  cancellaFoto(foto: FotoPersistita): Promise<EsitoFoto<'cancellazione_pending' | 'cancellato'>>
}

/** Un risultato SQL normale, NON un'eccezione: va mappato solo dopo il commit RPC. */
export type ScadenzaAllegatoPersistita = Readonly<{
  versione_contratto: 1; esito: 'scaduto_persistito_con_conflitto'; allegato_id: UUIDAllegato;
  stato: 'scaduto'; upload_necessario: false; lease_id: null; lease_until: null
}>
export type EsitoPrenotazioneFoto =
  | Readonly<{ versione_contratto: 1; esito: 'successo'; allegato_id: UUIDAllegato; stato: 'prenotato'; upload_necessario: true }>
  | Readonly<{ versione_contratto: 1; esito: 'successo'; allegato_id: UUIDAllegato; stato: 'finalizzato'; upload_necessario: false }>
  | ScadenzaAllegatoPersistita
export function validaEsitoPrenotazioneFoto(value: unknown): EsitoPrenotazioneFoto {
  if (!value || typeof value !== 'object') throw new Error('Risposta allegato non valida')
  const x = value as Record<string, unknown>
  if (x.esito === 'scaduto_persistito_con_conflitto') return validaScadenzaAllegatoPersistita(value)
  if (x.versione_contratto !== 1 || x.esito !== 'successo') throw new Error('Risposta allegato non valida')
  const id = validaUUIDAllegato(x.allegato_id)
  if (x.stato === 'prenotato' && x.upload_necessario === true)
    return Object.freeze({ versione_contratto: 1, esito: 'successo', allegato_id: id, stato: 'prenotato', upload_necessario: true })
  if (x.stato === 'finalizzato' && x.upload_necessario === false && x.lease_id === null && x.lease_until === null)
    return Object.freeze({ versione_contratto: 1, esito: 'successo', allegato_id: id, stato: 'finalizzato', upload_necessario: false })
  throw new Error('Risposta allegato non valida')
}
export function validaScadenzaAllegatoPersistita(value: unknown): ScadenzaAllegatoPersistita {
  if (!value || typeof value !== 'object') throw new Error('Risposta allegato non valida')
  const x = value as Record<string, unknown>
  if (x.versione_contratto !== 1 || x.esito !== 'scaduto_persistito_con_conflitto' || x.stato !== 'scaduto'
    || x.upload_necessario !== false || x.lease_id !== null || x.lease_until !== null)
    throw new Error('Risposta allegato non valida')
  // Proiezione esplicita: anche se la RPC contiene path interni non vengono restituiti.
  return Object.freeze({ versione_contratto: 1, esito: 'scaduto_persistito_con_conflitto',
    allegato_id: validaUUIDAllegato(x.allegato_id), stato: 'scaduto', upload_necessario: false,
    lease_id: null, lease_until: null })
}
export function conflittoScadenzaDopoCommit(esito: ScadenzaAllegatoPersistita): Readonly<{
  status: 409; codice: 'scaduta'; scadenza_persistita: true; allegato_id: UUIDAllegato
}> {
  const x = validaScadenzaAllegatoPersistita(esito)
  return Object.freeze({ status: 409, codice: 'scaduta', scadenza_persistita: true, allegato_id: x.allegato_id })
}

function validaContesto(x: ContestoFoto): ContestoFoto {
  return Object.freeze({ cantiere_id: validaUUIDAllegato(x.cantiere_id), data: validaDataAllegato(x.data),
    rapportino_id: x.rapportino_id === null ? null : validaUUIDAllegato(x.rapportino_id) })
}
function stessoGiorno(a: ContestoFoto, b: ContestoFoto): boolean {
  return a.cantiere_id === b.cantiere_id && a.data === b.data
}

/** Repository atomico per singola operazione; l'identità è sempre insert-only. */
export interface RepositoryCodaFoto {
  aggiungi(foto: FotoLocaleInCoda): Promise<void>
  elenca(): Promise<readonly FotoLocaleInCoda[]>
  associa(contesto: ContestoFoto, rapportino_id: UUIDAllegato): Promise<void>
  stato(chiave: UUIDAllegato, stato: StatoUploadFoto): Promise<void>
  rimuovi(chiave: UUIDAllegato): Promise<void>
}
export class ErroreCodaFoto extends Error {
  constructor(readonly codice: 'persistenza' | 'quota_locale' | 'integrita') { super('Coda foto non disponibile'); this.name = 'ErroreCodaFoto' }
}
const stati: Readonly<Record<StatoUploadFoto, readonly StatoUploadFoto[]>> = {
  in_coda: ['pronta'], pronta: ['caricamento', 'richiesta_cancellazione'],
  caricamento: ['finalizzazione', 'errore', 'scaduta', 'richiesta_cancellazione'],
  finalizzazione: ['completata', 'errore', 'scaduta', 'richiesta_cancellazione'],
  errore: ['pronta', 'richiesta_cancellazione'], scaduta: ['richiesta_cancellazione'],
  completata: ['richiesta_cancellazione'], richiesta_cancellazione: ['cancellazione_pending'],
  cancellazione_pending: ['cancellato'], cancellato: [],
}
export function cambiaStatoFotoLocale(foto: FotoLocaleInCoda, stato: StatoUploadFoto): FotoLocaleInCoda {
  if (stato !== foto.stato && !stati[foto.stato].includes(stato)) throw new ErroreCodaFoto('integrita')
  if (stato !== 'in_coda' && foto.contesto.rapportino_id === null) throw new ErroreCodaFoto('integrita')
  return Object.freeze({ ...foto, stato })
}
export function associaFotoLocale(foto: FotoLocaleInCoda, contesto: ContestoFoto, id: UUIDAllegato): FotoLocaleInCoda {
  if (!stessoGiorno(foto.contesto, contesto)) return foto
  if (foto.contesto.rapportino_id !== null && foto.contesto.rapportino_id !== id) return foto
  return Object.freeze({ ...foto, contesto: Object.freeze({ ...foto.contesto, rapportino_id: id }),
    stato: foto.stato === 'in_coda' ? 'pronta' : foto.stato })
}

/** L'adapter in memoria è per test e fallback ESPLICITO, mai una promessa di recupero dopo reload. */
export class RepositoryCodaFotoMemoria implements RepositoryCodaFoto {
  private readonly foto = new Map<UUIDAllegato, FotoLocaleInCoda>()
  async aggiungi(foto: FotoLocaleInCoda) {
    if (this.foto.has(foto.chiave_client_allegato)) throw new ErroreCodaFoto('integrita')
    this.foto.set(foto.chiave_client_allegato, foto)
  }
  async elenca() { return [...this.foto.values()] }
  async associa(contesto: ContestoFoto, id: UUIDAllegato) {
    for (const [key, foto] of this.foto) this.foto.set(key, associaFotoLocale(foto, contesto, id))
  }
  async stato(key: UUIDAllegato, stato: StatoUploadFoto) {
    const foto = this.foto.get(key)
    if (!foto) throw new ErroreCodaFoto('integrita')
    this.foto.set(key, cambiaStatoFotoLocale(foto, stato))
  }
  async rimuovi(key: UUIDAllegato) { this.foto.delete(key) }
}

export class CodaFotoRapportinoV1 {
  constructor(private readonly repository: RepositoryCodaFoto,
    private readonly cryptoBrowser: Pick<Crypto, 'randomUUID' | 'subtle'> = globalThis.crypto,
    private readonly adesso: () => number = Date.now) {}
  async aggiungi(blob: Blob, contesto: ContestoFoto): Promise<FotoLocaleInCoda> {
    const mime = validaMimeAllegato(blob.type), size = validaByteSizeAllegato(blob.size), ctx = validaContesto(contesto)
    const digest = await this.cryptoBrowser.subtle.digest('SHA-256', await blob.arrayBuffer())
    const hash = validaSHA256Allegato(Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join(''))
    const tempo = this.adesso()
    if (!Number.isSafeInteger(tempo) || tempo < 0) throw new ErroreCodaFoto('integrita')
    const foto: FotoLocaleInCoda = Object.freeze({ chiave_client_allegato: validaUUIDAllegato(this.cryptoBrowser.randomUUID()),
      blob, mime_type: mime, byte_size: size, sha256: hash, contesto: ctx,
      stato: ctx.rapportino_id === null ? 'in_coda' : 'pronta', creata_at_ms: tempo })
    await this.repository.aggiungi(foto)
    return foto
  }
  async elenca(contesto: ContestoFoto): Promise<readonly FotoLocaleInCoda[]> {
    const ctx = validaContesto(contesto)
    // Un contesto senza UUID vede solo la propria coda non ancora associata.
    return (await this.repository.elenca()).filter(f => stessoGiorno(f.contesto, ctx)
      && f.contesto.rapportino_id === ctx.rapportino_id)
  }
  async writerRiuscito(contesto: ContestoFoto, id: UUIDAllegato) {
    const ctx = validaContesto(contesto), uuid = validaUUIDAllegato(id)
    if (ctx.rapportino_id !== null && ctx.rapportino_id !== uuid) throw new ErroreCodaFoto('integrita')
    await this.repository.associa(ctx, uuid)
  }
  async cambiaStato(key: UUIDAllegato, stato: StatoUploadFoto) { await this.repository.stato(validaUUIDAllegato(key), stato) }
  async recuperaInterrotte(contesto: ContestoFoto) {
    // Il reload non prova che l'operazione remota sia fallita: conserva identità e richiede retry idempotente.
    for (const foto of await this.elenca(contesto))
      if (foto.stato === 'caricamento' || foto.stato === 'finalizzazione') await this.repository.stato(foto.chiave_client_allegato, 'errore')
  }
  async rimuoviLocale(key: UUIDAllegato) {
    const foto = (await this.repository.elenca()).find(f => f.chiave_client_allegato === key)
    // Dopo l'inizio del protocollo remoto si richiede cancellazione, non cleanup locale.
    if (!foto || (foto.stato !== 'in_coda' && foto.stato !== 'pronta')) throw new ErroreCodaFoto('integrita')
    await this.repository.rimuovi(key)
  }
  async pulisciCompletate() {
    for (const foto of await this.repository.elenca())
      if (foto.stato === 'completata' || foto.stato === 'cancellato') await this.repository.rimuovi(foto.chiave_client_allegato)
  }
}

/** F2 controlla MIME dichiarato/peso/hash. Decodifica e 24 MP sono obbligatori nel futuro server F3. */
export const VERIFICA_PIXEL_FOTO = Object.freeze({ implementata: false, fase: 'server_prima_prenotazione', limite: LIMITI_ALLEGATI.pixel })
