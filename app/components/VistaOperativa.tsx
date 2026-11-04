'use client'

import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

// Reuse the existing main workspace and portal pattern. The originating tree
// stays mounted, so its selected site, tab and local work survive the return.
export default function VistaOperativa({ titolo, contesto, attiva = true, visibile = true, etichettaRitorno = '← Torna al cantiere', onChiudi, occupata, ritornoFocusRef, children }: {
  titolo: string
  contesto?: string
  attiva?: boolean
  visibile?: boolean
  etichettaRitorno?: string
  onChiudi: () => void
  occupata?: boolean
  ritornoFocusRef?: RefObject<HTMLElement | null>
  children: ReactNode
}) {
  const area = typeof document === 'undefined' ? null : document.getElementById('area-lavoro-principale')
  const scrollOrigine = useRef(area?.scrollTop ?? 0)
  const intestazione = useRef<HTMLHeadingElement | null>(null)
  const ripristinaFocus = useCallback(() => {
    ritornoFocusRef?.current?.focus({ preventScroll: true })
  }, [ritornoFocusRef])
  useEffect(() => {
    if (!attiva || !visibile || !area) return
    const scroll = scrollOrigine.current
    intestazione.current?.focus({ preventScroll: true })
    area.scrollTo({ top: 0 })
    return () => {
      area.scrollTo({ top: scroll })
      ripristinaFocus()
    }
  }, [area, attiva, visibile, ripristinaFocus])

  if (!attiva) return children

  const contenuto = <section hidden={!visibile} data-attivita-operativa={visibile ? true : undefined} aria-label={titolo}
    style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', overflowWrap: 'anywhere' }}>
    <header style={{ marginBottom: 20 }}>
      <button type="button" disabled={occupata} onClick={onChiudi} style={{ minHeight: 44, padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#334155', font: 'inherit', cursor: occupata ? 'wait' : 'pointer' }}>{etichettaRitorno}</button>
      <h2 ref={intestazione} tabIndex={-1} style={{ marginBottom: 8 }}>{titolo}</h2>
      {contesto && <p style={{ margin: 0, color: '#64748b' }}>{contesto}</p>}
    </header>
    {children}
    <style>{`
      #area-lavoro-principale:has(> [data-attivita-operativa]) > :not([data-attivita-operativa]) {
        display: none !important;
      }
    `}</style>
  </section>
  return area ? createPortal(contenuto, area) : contenuto
}
