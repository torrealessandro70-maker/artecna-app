import type { PaginaQuadernoNota } from '../../components/note/types'

export type ContestoQuaderno = { tipo: 'progetto' | 'sopralluogo'; id: string }

export function destinazioneQuaderno(contesto: ContestoQuaderno) {
  return contesto.tipo === 'progetto'
    ? { tabella: 'quaderno_progetti', allegati: 'quaderno_allegati', chiave: 'id', conflitto: 'id', cartella: 'quaderni', bucket: 'quaderno-privato' }
    : { tabella: 'note_sopralluogo', allegati: 'note_allegati', chiave: 'sopralluogo_id', conflitto: 'user_id,sopralluogo_id', cartella: 'sopralluoghi', bucket: 'preventivi' }
}

export function percorsoQuaderno(contesto: ContestoQuaderno, userId: string) {
  return `utenti/${userId}/${destinazioneQuaderno(contesto).cartella}/${contesto.id}`
}

// Mantiene integralmente i campi delle pagine, comprese quote, geometrie e metadati legacy.
export function paginePerSalvataggio(
  pagine: PaginaQuadernoNota[], indice: number,
  corrente: Partial<PaginaQuadernoNota>, workspace: Partial<PaginaQuadernoNota>,
) {
  return pagine.map((pagina, index) => ({
    ...pagina,
    ...(index === indice ? corrente : {}),
    ...(index === 0 ? workspace : {}),
  }))
}

export function erroreQuaderno(error: { code?: string; message?: string; details?: string; hint?: string }) {
  const tecnico = [error.code, error.message, error.details, error.hint].filter(Boolean).join(' · ')
  const migrazione = ['42P01', 'PGRST205', 'PGRST204'].includes(error.code || '')
  return `${migrazione ? 'Archivio Quaderno non disponibile: richiede la migrazione 20261022_quaderno_progetti.sql. ' : ''}${tecnico}`
}
