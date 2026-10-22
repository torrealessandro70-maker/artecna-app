import { createElement, type CSSProperties, type ReactNode } from 'react'

// Solo questo contenitore scorre: i comandi restano nel flusso esterno.
export const stileRighePrezzari: CSSProperties = {
  maxHeight: '60dvh', overflow: 'auto', overscrollBehavior: 'contain',
  minWidth: 0, width: '100%', position: 'relative',
}

export function portaRigaInVista(contenitore: HTMLElement | null, riga: HTMLElement | null) {
  if (!contenitore || !riga || !contenitore.contains(riga)) return
  const area = contenitore.getBoundingClientRect(), rect = riga.getBoundingClientRect()
  const top = area.top + contenitore.clientTop
  const bottom = top + contenitore.clientHeight
  // Una riga più alta dell'area viene allineata all'inizio, senza muovere antenati.
  const delta = rect.top < top || rect.height > contenitore.clientHeight
    ? rect.top - top : rect.bottom > bottom ? rect.bottom - bottom : 0
  if (delta) contenitore.scrollTo({ top: contenitore.scrollTop + delta, behavior: 'smooth' })
}

// Estratta dal Listino ARTECNA: solo rendering, nessuna normalizzazione dei dati.
export function evidenziaRicerca(value: string | null, query: string): ReactNode {
  const text = value || ''
  if (!query) return text
  const parti: ReactNode[] = []
  let offset = 0, posizione = text.toLowerCase().indexOf(query.toLowerCase())
  while (posizione !== -1) {
    parti.push(text.slice(offset, posizione), createElement('mark', { key: posizione }, text.slice(posizione, posizione + query.length)))
    offset = posizione + query.length
    posizione = text.toLowerCase().indexOf(query.toLowerCase(), offset)
  }
  parti.push(text.slice(offset))
  return parti
}
