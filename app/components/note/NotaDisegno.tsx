'use client'

import { useEffect, useId, useRef, type PointerEvent } from 'react'
import type { PuntoNota, SegnoNota, StrumentoDisegno } from './types'

type Props = {
  segni: SegnoNota[]
  onChange: (segni: SegnoNota[]) => void
  strumento: StrumentoDisegno
  colore: string
  spessore: number
}

const LARGHEZZA = 900
const ALTEZZA = 520

export default function NotaDisegno({
  segni,
  onChange,
  strumento,
  colore,
  spessore,
}: Props) {

  const svgRef = useRef<SVGSVGElement>(null)
  const segnoAttivo = useRef<SegnoNota | null>(null)
  const markerId = useId().replace(/:/g, '')

useEffect(() => {
  const svg = svgRef.current
  if (!svg) return

  const bloccaScroll = (event: TouchEvent) => {
    if (segnoAttivo.current) {
      event.preventDefault()
    }
  }

  svg.addEventListener('touchmove', bloccaScroll, { passive: false })

  return () => {
    svg.removeEventListener('touchmove', bloccaScroll)
  }
}, [])

  const puntoDaEvento = (event: PointerEvent<SVGSVGElement>): PuntoNota => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }

    return {
      x: ((event.clientX - rect.left) / rect.width) * LARGHEZZA,
      y: ((event.clientY - rect.top) / rect.height) * ALTEZZA,
    }
  }

   const cancellaSegniVicini = (punto: PuntoNota) => {
    const raggioGomma = Math.max(spessore * 3, 18)

    const segniFiltrati = segni.filter((segno) => {
      return !segno.punti.some((p) => {
        const distanza = Math.hypot(p.x - punto.x, p.y - punto.y)
        return distanza <= raggioGomma
      })
    })

    onChange(segniFiltrati)
  }

  const inizia = (event: PointerEvent<SVGSVGElement>) => {
    event.preventDefault()
    event.stopPropagation()

    event.currentTarget.setPointerCapture(event.pointerId)

    const punto = puntoDaEvento(event)

    if (strumento === 'gomma') {
      cancellaSegniVicini(punto)
      return
    }

    const nuovoSegno: SegnoNota = {
      id: crypto.randomUUID(),
      strumento,
      colore,
      spessore: strumento === 'evidenziatore' ? Math.max(spessore, 14) : spessore,
      punti: [punto, punto],
    }

    segnoAttivo.current = nuovoSegno
    onChange([...segni, nuovoSegno])
  }

  const disegna = (event: PointerEvent<SVGSVGElement>) => {
    const punto = puntoDaEvento(event)

    if (strumento === 'gomma') {
      cancellaSegniVicini(punto)
      return
    }

    if (!segnoAttivo.current) return

    const attivo = segnoAttivo.current
    const punti =
      attivo.strumento === 'penna' || attivo.strumento === 'evidenziatore'
        ? [...attivo.punti, punto]
        : [attivo.punti[0], punto]

    segnoAttivo.current = { ...attivo, punti }
    onChange(
      segni.map((segno) =>
        segno.id === attivo.id ? { ...attivo, punti } : segno
      )
    )
  }

  const termina = () => {
    segnoAttivo.current = null
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${LARGHEZZA} ${ALTEZZA}`}
      onPointerDown={inizia}
      onPointerMove={disegna}
      onPointerUp={termina}
      onPointerCancel={termina}
      style={{
        width: '100%',
        minHeight: 300,
        display: 'block',
        border: '1px solid #cbd5e1',
        borderRadius: 12,
        backgroundColor: '#fff',
        backgroundImage:
          'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        touchAction: 'none',
        cursor: 'crosshair',
      }}
      aria-label="Area di disegno della nota"
    >
      <defs>
        <marker
          id={markerId}
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="context-stroke" />
        </marker>
      </defs>

      {segni.map((segno) => {
        const primo = segno.punti[0]
        const ultimo = segno.punti[segno.punti.length - 1]
        if (!primo || !ultimo) return null
if (segno.strumento === 'rettangolo') {
  return (
    <rect
      key={segno.id}
      x={Math.min(primo.x, ultimo.x)}
      y={Math.min(primo.y, ultimo.y)}
      width={Math.abs(ultimo.x - primo.x)}
      height={Math.abs(ultimo.y - primo.y)}
      fill="none"
      stroke={segno.colore}
      strokeWidth={segno.spessore}
    />
  )
}
        if (segno.strumento === 'cerchio') {
          return (
            <ellipse
              key={segno.id}
              cx={(primo.x + ultimo.x) / 2}
              cy={(primo.y + ultimo.y) / 2}
              rx={Math.abs(ultimo.x - primo.x) / 2}
              ry={Math.abs(ultimo.y - primo.y) / 2}
              fill="none"
              stroke={segno.colore}
              strokeWidth={segno.spessore}
            />
          )
        }
if (segno.strumento === 'linea') {
  return (
    <line
      key={segno.id}
      x1={primo.x}
      y1={primo.y}
      x2={ultimo.x}
      y2={ultimo.y}
      stroke={segno.colore}
      strokeWidth={segno.spessore}
      strokeLinecap="round"
    />
  )
}
        if (segno.strumento === 'freccia') {
          return (
            <line
              key={segno.id}
              x1={primo.x}
              y1={primo.y}
              x2={ultimo.x}
              y2={ultimo.y}
              stroke={segno.colore}
              strokeWidth={segno.spessore}
              markerEnd={`url(#${markerId})`}
              strokeLinecap="round"
            />
          )
        }

        return (
          <polyline
            key={segno.id}
            points={segno.punti.map((punto) => `${punto.x},${punto.y}`).join(' ')}
            fill="none"
            stroke={segno.colore}
            strokeWidth={segno.spessore}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={segno.strumento === 'evidenziatore' ? 0.32 : 1}
          />
        )
      })}
    </svg>
  )
}
