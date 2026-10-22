import type { FotoLocaleInCoda } from './fotoRapportinoV1'
import { validaUUIDAllegato } from './contrattoAllegati'
import type { EsitoUploadFotoV1 } from './servizioFotoV1.server'

const codiciFoto = new Set([
  'metodo', 'origine', 'metadati', 'mime', 'identita', 'sessione', 'canale_non_disponibile',
  'storage_non_configurato', 'storage_non_disponibile', 'registro_non_disponibile',
  'registro', 'dimensione', 'hash', 'immagine', 'bytes_assenti', 'lease',
  'scaduta_persistita', 'storage', 'oggetto_assente', 'oggetto_incoerente',
  'finalizzazione', 'servizio_non_disponibile', 'PR401', 'PR409', 'PR412', '42501', '22023', '22P02',
])
export class ErroreHttpFotoV1 extends Error {
  constructor(readonly status: number, readonly codice: string | null) {
    super(`Foto HTTP ${status}${codice ? ` (${codice})` : ''}`)
    this.name = 'ErroreHttpFotoV1'
  }
}
export function messaggioErroreInvioFotoV1(error: unknown): string {
  const dettaglio = error instanceof ErroreHttpFotoV1 ? `${error.message}. ` : ''
  return `${dettaglio}Invio non completato: esito foto non confermato. Il Rapportino non viene risalvato. La foto resta in coda; nessun nuovo invio automatico.`
}

/** Upload F4A; elenco/accesso/mapping FotoPersistita restano al passo successivo. */
export function creaTrasportoHttpFotoV1(endpoint: string, fetcher: typeof fetch = fetch,
  desktopBearer?: () => Promise<string>) {
  if (!endpoint.startsWith('/') || endpoint.startsWith('//')) throw new Error('Endpoint Foto deve essere locale')
  async function caricaFoto(foto: FotoLocaleInCoda): Promise<EsitoUploadFotoV1> {
    if (!foto.contesto.rapportino_id) throw new Error('Salvare prima il Rapportino')
    const headers: Record<string, string> = { 'Content-Type': foto.mime_type, 'x-artecna-foto': JSON.stringify({
      rapportino_id: foto.contesto.rapportino_id, cantiere_id: foto.contesto.cantiere_id, data: foto.contesto.data,
      chiave_client_allegato: foto.chiave_client_allegato, sha256: foto.sha256,
      mime_type: foto.mime_type, byte_size: foto.byte_size }) }
    if (desktopBearer) headers.Authorization = `Bearer ${await desktopBearer()}`
    const response = await fetcher(endpoint, { method: 'POST', credentials: 'same-origin',
      cache: 'no-store', redirect: 'error', headers, body: foto.blob })
    if (!response.ok) {
      let codice: string | null = null
      try {
        const body: unknown = await response.json()
        if (body && typeof body === 'object' && 'codice' in body
          && typeof body.codice === 'string' && codiciFoto.has(body.codice)) codice = body.codice
      } catch { /* Una risposta non JSON conserva lo stato HTTP, senza esporre il corpo. */ }
      throw new ErroreHttpFotoV1(response.status, codice)
    }
    const result = await response.json() as EsitoUploadFotoV1
    if (result.versione_contratto !== 1 || result.rapportino_id !== foto.contesto.rapportino_id
      || result.allegato?.stato !== 'finalizzato' || result.allegato.chiave_client_allegato !== foto.chiave_client_allegato
      || result.allegato.mime_type !== foto.mime_type || result.allegato.byte_size !== foto.byte_size)
      throw new Error('Risposta Foto incoerente')
    validaUUIDAllegato(result.allegato.allegato_id)
    return result
  }
  return { caricaFoto, ritentaFoto: caricaFoto }
}
