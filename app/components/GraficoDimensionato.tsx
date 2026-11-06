'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { ResponsiveContainer } from 'recharts'

// Closed details and workspaces hidden by VistaOperativa have no usable chart
// viewport. Keep only the measuring wrapper mounted until it is visible again.
export default function GraficoDimensionato({ children }: { children: ReactElement }) {
  const contenitore = useRef<HTMLDivElement>(null)
  const [dimensioni, setDimensioni] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const elemento = contenitore.current
    if (!elemento) return
    const misura = () => {
      const { width, height } = elemento.getBoundingClientRect()
      const visibile = !elemento.closest('details:not([open])')
      const w = Math.floor(width), h = Math.floor(height)
      const valide = visibile && Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0
      setDimensioni(prima => valide
        ? prima?.width === w && prima.height === h ? prima : { width: w, height: h }
        : prima === null ? prima : null)
    }
    const dettagli: HTMLDetailsElement[] = []
    for (let padre = elemento.parentElement; padre; padre = padre.parentElement) {
      if (padre instanceof HTMLDetailsElement) {
        dettagli.push(padre)
        padre.addEventListener('toggle', misura)
      }
    }
    const observer = new ResizeObserver(misura)
    observer.observe(elemento)
    misura()
    return () => {
      observer.disconnect()
      dettagli.forEach(dettaglio => dettaglio.removeEventListener('toggle', misura))
    }
  }, [])

  return <div ref={contenitore} data-grafico-dimensionato style={{ width: '100%', height: '100%', minWidth: 0 }}>
    {dimensioni && <ResponsiveContainer width={dimensioni.width} height={dimensioni.height}>{children}</ResponsiveContainer>}
  </div>
}
