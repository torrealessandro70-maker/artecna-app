/** Dominio puro allegati: nessuna dipendenza da API, DB o provider Storage. */
declare const uuidCanonico: unique symbol
declare const hashCanonico: unique symbol
declare const dimensioneValida: unique symbol
declare const dataCanonica: unique symbol
export type UUIDAllegato = string & { readonly [uuidCanonico]: true }
export type SHA256Allegato = string & { readonly [hashCanonico]: true }
export type ByteSizeAllegato = number & { readonly [dimensioneValida]: true }
export type DataAllegato = string & { readonly [dataCanonica]: true }
export type MimeAllegato = 'image/jpeg' | 'image/png' | 'image/webp'
export type StatoAllegato = 'prenotato' | 'finalizzato' | 'cancellazione_pending' | 'cancellato' | 'scaduto'

export const LIMITI_ALLEGATI = Object.freeze({ byte_size: 4_000_000, numero: 20,
  pixel: 24_000_000, lease_ms: 120_000, prenotazione_ms: 86_400_000 })

/** Input applicativo: hash/MIME/peso saranno verificati dal futuro server sui byte. */
export type RichiestaPrenotazioneAllegato = Readonly<{
  rapportino_id: UUIDAllegato; cantiere_id: UUIDAllegato; data: DataAllegato
  chiave_client_allegato: UUIDAllegato; sha256: SHA256Allegato
  mime_type: MimeAllegato; byte_size: ByteSizeAllegato
}>
type MetadatiAllegato = Readonly<{
  allegato_id: UUIDAllegato; chiave_client_allegato: UUIDAllegato
  mime_type: MimeAllegato; byte_size: ByteSizeAllegato
}>
export type AllegatoFinalizzato = MetadatiAllegato & Readonly<{ stato: 'finalizzato' }>
export type EsitoPrenotazioneAllegato = Readonly<{ versione_contratto: 1; rapportino_id: UUIDAllegato }> & (
  | Readonly<{ allegato: MetadatiAllegato & Readonly<{ stato: 'prenotato' }> }>
  | Readonly<{ allegato: AllegatoFinalizzato }>
)
export type ElencoAllegati = Readonly<{
  versione_contratto: 1; rapportino_id: UUIDAllegato; allegati: readonly AllegatoFinalizzato[]
}>
export type AutorizzazioneAccessoAllegato = Readonly<{
  versione_contratto: 1; allegato_id: UUIDAllegato; url: string; expires_at: string
}>
export type RichiestaCancellazioneAllegato = Readonly<{ allegato_id: UUIDAllegato }>
export type EsitoCancellazioneAllegato = Readonly<{
  versione_contratto: 1; allegato_id: UUIDAllegato; stato: 'cancellazione_pending' | 'cancellato'
}>

/** Tempi interni in millisecondi UTC; mai serializzare questo oggetto al browser. */
export type LeaseAllegatoInterna = Readonly<{
  lease_id: UUIDAllegato; iniziata_at_ms: number; scade_at_ms: number
}>
export type TentativoAllegatoInterno = Readonly<{
  lease: LeaseAllegatoInterna
  errore: null | Readonly<{ fase: 'upload' | 'verifica' | 'finalizza';
    codice: 'trasporto' | 'oggetto_incoerente' | 'sessione' | 'servizio'; ritentabile: boolean }>
}>
/** Timestamp di finalizzazione/rimozione come nel registro; i tempi operativi restano millisecondi. */
export type AllegatoInterno = RichiestaPrenotazioneAllegato & Readonly<{
  id: UUIDAllegato; bucket: 'rapportini-v1'; file_path: string
  created_at_ms: number; expires_at_ms: number
}> & (
  | Readonly<{ stato: 'prenotato'; foto_cantiere_id: null; finalized_at: null; removed_at: null;
      lease: LeaseAllegatoInterna | null; tentativo: TentativoAllegatoInterno | null }>
  | Readonly<{ stato: 'scaduto'; foto_cantiere_id: null; finalized_at: null; removed_at: null;
      lease: null; tentativo: null }>
  | Readonly<{ stato: 'finalizzato'; foto_cantiere_id: UUIDAllegato; finalized_at: string; removed_at: null;
      lease: null; tentativo: null }>
  | (Readonly<{ stato: 'cancellazione_pending'; removed_at: string; lease: null; tentativo: null }> & (
      | Readonly<{ foto_cantiere_id: null; finalized_at: null }>
      | Readonly<{ foto_cantiere_id: UUIDAllegato; finalized_at: string }>
    ))
  | Readonly<{ stato: 'cancellato'; foto_cantiere_id: null; finalized_at: string | null; removed_at: string;
      lease: null; tentativo: null }>
)

export function validaUUIDAllegato(value: unknown): UUIDAllegato {
  if (typeof value !== 'string' || value.length !== 36 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value))
    throw new Error('UUID allegato non canonico')
  return value as UUIDAllegato
}
export function validaSHA256Allegato(value: unknown): SHA256Allegato {
  if (typeof value !== 'string' || value.length !== 64 || !/^[0-9a-f]{64}$/.test(value)) throw new Error('SHA-256 allegato non canonico')
  return value as SHA256Allegato
}
export function validaMimeAllegato(value: unknown): MimeAllegato {
  if (value !== 'image/jpeg' && value !== 'image/png' && value !== 'image/webp')
    throw new Error('Formato allegato non consentito')
  return value
}
export function validaByteSizeAllegato(value: unknown): ByteSizeAllegato {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > LIMITI_ALLEGATI.byte_size)
    throw new Error('Dimensione allegato non valida')
  return value as ByteSizeAllegato
}
export function validaDataAllegato(value: unknown): DataAllegato {
  if (typeof value !== 'string' || value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(Date.parse(value + 'T00:00:00.000Z'))
    || new Date(value + 'T00:00:00.000Z').toISOString().slice(0, 10) !== value)
    throw new Error('Data allegato non valida')
  return value as DataAllegato
}
export function validaRichiestaPrenotazioneAllegato(value: unknown): RichiestaPrenotazioneAllegato {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Richiesta allegato non valida')
  const x = value as Record<string, unknown>
  const keys = ['rapportino_id','cantiere_id','data','chiave_client_allegato','sha256','mime_type','byte_size']
  if (Object.keys(x).length !== keys.length || keys.some(k => !Object.prototype.hasOwnProperty.call(x, k)))
    throw new Error('Campi richiesta allegato non validi')
  return Object.freeze({ rapportino_id: validaUUIDAllegato(x.rapportino_id), cantiere_id: validaUUIDAllegato(x.cantiere_id),
    data: validaDataAllegato(x.data), chiave_client_allegato: validaUUIDAllegato(x.chiave_client_allegato),
    sha256: validaSHA256Allegato(x.sha256), mime_type: validaMimeAllegato(x.mime_type), byte_size: validaByteSizeAllegato(x.byte_size) })
}

export function costruisciPathAllegato(input: Pick<RichiestaPrenotazioneAllegato,
  'cantiere_id' | 'rapportino_id' | 'chiave_client_allegato' | 'mime_type'>): string {
  const c = validaUUIDAllegato(input.cantiere_id), r = validaUUIDAllegato(input.rapportino_id)
  const k = validaUUIDAllegato(input.chiave_client_allegato), mime = validaMimeAllegato(input.mime_type)
  const estensioni: Record<MimeAllegato, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  return `rapportini/${c}/${r}/${k}.${estensioni[mime]}`
}

const transizioni: Readonly<Record<StatoAllegato, readonly StatoAllegato[]>> = {
  prenotato: ['finalizzato', 'scaduto', 'cancellazione_pending'],
  finalizzato: ['cancellazione_pending'],
  scaduto: ['cancellazione_pending'],
  cancellazione_pending: ['cancellato'],
  cancellato: [],
}
/** Nessun self-loop: i retry non costituiscono transizioni persistenti. */
export function transizioneAllegatoConsentita(da: StatoAllegato, a: StatoAllegato): boolean {
  return transizioni[da]?.includes(a) ?? false
}
export function transizionaAllegato(da: StatoAllegato, a: StatoAllegato): StatoAllegato {
  if (!transizioneAllegatoConsentita(da, a)) throw new Error('Transizione allegato non consentita')
  return a
}
export type DecisioneIdempotenzaAllegato = 'nuova_identita' | 'conflitto' | 'retry_compatibile'
  | 'restituisci_finalizzato' | 'cancellazione_in_corso' | 'tombstone' | 'prenotazione_scaduta'
export function valutaIdempotenzaAllegato(esistente: AllegatoInterno,
  input: RichiestaPrenotazioneAllegato, adesso_ms: number): DecisioneIdempotenzaAllegato {
  validaTempo(adesso_ms)
  if (esistente.rapportino_id !== input.rapportino_id || esistente.chiave_client_allegato !== input.chiave_client_allegato)
    return 'nuova_identita'
  if (esistente.cantiere_id !== input.cantiere_id || esistente.data !== input.data
    || esistente.sha256 !== input.sha256 || esistente.mime_type !== input.mime_type || esistente.byte_size !== input.byte_size)
    return 'conflitto'
  switch (esistente.stato) {
    case 'finalizzato': return 'restituisci_finalizzato'
    case 'cancellato': return 'tombstone'
    case 'cancellazione_pending': return 'cancellazione_in_corso'
    case 'scaduto': return 'prenotazione_scaduta'
    case 'prenotato': return prenotazioneAllegatoScaduta(esistente.expires_at_ms, adesso_ms)
      ? 'prenotazione_scaduta' : 'retry_compatibile'
  }
}
function validaTempo(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Tempo allegato non valido')
}
export function scadenzaPrenotazioneAllegato(created_at_ms: number): number {
  validaTempo(created_at_ms)
  const scadenza = created_at_ms + LIMITI_ALLEGATI.prenotazione_ms
  validaTempo(scadenza)
  return scadenza
}
export function prenotazioneAllegatoScaduta(expires_at_ms: number, adesso_ms: number): boolean {
  validaTempo(expires_at_ms); validaTempo(adesso_ms)
  return adesso_ms >= expires_at_ms
}
export function creaLeaseAllegato(lease_id: UUIDAllegato, iniziata_at_ms: number): LeaseAllegatoInterna {
  validaTempo(iniziata_at_ms)
  const scade_at_ms = iniziata_at_ms + LIMITI_ALLEGATI.lease_ms
  validaTempo(scade_at_ms)
  return Object.freeze({ lease_id: validaUUIDAllegato(lease_id), iniziata_at_ms, scade_at_ms })
}
export function leaseAllegatoValida(lease: LeaseAllegatoInterna, lease_id: UUIDAllegato, adesso_ms: number): boolean {
  validaTempo(adesso_ms); validaTempo(lease.iniziata_at_ms); validaTempo(lease.scade_at_ms)
  return lease.lease_id === lease_id && lease.scade_at_ms - lease.iniziata_at_ms === LIMITI_ALLEGATI.lease_ms
    && adesso_ms >= lease.iniziata_at_ms && adesso_ms < lease.scade_at_ms
}
function metadatiPubblici(x: AllegatoInterno): MetadatiAllegato {
  return Object.freeze({ allegato_id: x.id, chiave_client_allegato: x.chiave_client_allegato,
    mime_type: x.mime_type, byte_size: x.byte_size })
}
/** Proiezioni esplicite: nessuno spread dello stato interno nei DTO browser. */
export function allegatoFinalizzatoPubblico(x: AllegatoInterno): AllegatoFinalizzato {
  if (x.stato !== 'finalizzato') throw new Error('Allegato non disponibile')
  return Object.freeze({ ...metadatiPubblici(x), stato: 'finalizzato' })
}
export function esitoPrenotazioneAllegatoPubblico(x: AllegatoInterno): EsitoPrenotazioneAllegato {
  if (x.stato !== 'prenotato' && x.stato !== 'finalizzato') throw new Error('Prenotazione allegato non disponibile')
  if (x.stato === 'finalizzato') return Object.freeze({ versione_contratto: 1,
    rapportino_id: x.rapportino_id, allegato: allegatoFinalizzatoPubblico(x) })
  return Object.freeze({ versione_contratto: 1, rapportino_id: x.rapportino_id,
    allegato: Object.freeze({ ...metadatiPubblici(x), stato: 'prenotato' as const }) })
}
export function elencoAllegatiPubblico(rapportino_id: UUIDAllegato, allegati: readonly AllegatoInterno[]): ElencoAllegati {
  // Fail-closed: non nascondere un contesto incoerente, anche per righe non finalizzate.
  if (allegati.some(x => x.rapportino_id !== rapportino_id)) throw new Error('Contesto allegati incoerente')
  return Object.freeze({ versione_contratto: 1, rapportino_id,
    allegati: Object.freeze(allegati.filter(x => x.stato === 'finalizzato').map(allegatoFinalizzatoPubblico)) })
}
export function esitoCancellazioneAllegatoPubblico(x: AllegatoInterno): EsitoCancellazioneAllegato {
  if (x.stato !== 'cancellazione_pending' && x.stato !== 'cancellato') throw new Error('Cancellazione allegato non disponibile')
  return Object.freeze({ versione_contratto: 1, allegato_id: x.id, stato: x.stato })
}
