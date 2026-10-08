import type { FotoLocaleInCoda } from './fotoRapportinoV1'
import { validaUUIDAllegato } from './contrattoAllegati'
import type { EsitoUploadFotoV1 } from './servizioFotoV1.server'

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
    if (!response.ok) throw new Error(`Foto HTTP ${response.status}`)
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
