import { validaUUIDAllegato, validaMimeAllegato, LIMITI_ALLEGATI } from './contrattoAllegati'

export class ErroreLetturaFotoDesktop extends Error {
  constructor(readonly status: number) {
    super(status === 401 || status === 403 ? 'Accesso alla foto non consentito' : 'Foto non disponibile. Riprova la lettura.')
  }
}
/** Solo ID e JWT di sessione; nessun fallback a file_url/path della proiezione. */
export async function leggiBlobFotoDesktop(input: { allegato: string; rapportino: string; foto: string },
  token: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<Blob> {
  const allegato = validaUUIDAllegato(input.allegato), rapportino = validaUUIDAllegato(input.rapportino), foto = validaUUIDAllegato(input.foto)
  if (!token) throw new ErroreLetturaFotoDesktop(401)
  const options = { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' as const, signal, redirect: 'error' as const }
  const list = await fetcher(`/api/desktop/foto?rapportino_id=${rapportino}`, options)
  if (!list.ok) throw new ErroreLetturaFotoDesktop(list.status)
  const data = await list.json()
  if (data?.versione_contratto !== 1 || data.rapportino_id !== rapportino || !Array.isArray(data.allegati)
    || data.allegati.filter((a: Record<string, unknown>) => a.allegato_id === allegato && a.foto_cantiere_id === foto && a.rapportino_id === rapportino).length !== 1)
    throw new ErroreLetturaFotoDesktop(409)
  const r = await fetcher(`/api/desktop/foto/download?allegato_id=${allegato}`, options)
  if (!r.ok) throw new ErroreLetturaFotoDesktop(r.status)
  const blob = await r.blob()
  validaMimeAllegato(blob.type)
  if (!blob.size || blob.size > LIMITI_ALLEGATI.byte_size) throw new ErroreLetturaFotoDesktop(409)
  return blob
}
