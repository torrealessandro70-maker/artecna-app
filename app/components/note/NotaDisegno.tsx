'use client'

import {
  memo,
  useEffect,
  useId,
  useRef,
  type PointerEvent,
} from 'react'
import type { PuntoNota, SegnoNota, StrumentoDisegno } from './types'

type Props = {
  segni: SegnoNota[]
  onChange: (segni: SegnoNota[]) => void
  strumento: StrumentoDisegno
  colore: string
}

type BloccoScroll = {
  x: number
  y: number
  bodyOverflow: string
  bodyPosition: string
  bodyTop: string
  bodyLeft: string
  bodyWidth: string
  htmlOverscroll: string
  impedisciTouch: (event: TouchEvent) => void
  mantieniPosizione: () => void
}

const LARGHEZZA = 900
const ALTEZZA = 520

function creaTracciatoMorbido(punti: PuntoNota[]) {
  const primo = punti[0]
  if (!primo) return ''
  if (punti.length === 1) return `M ${primo.x} ${primo.y} l 0.01 0`
  if (punti.length === 2) {
    return `M ${primo.x} ${primo.y} L ${punti[1].x} ${punti[1].y}`
  }

  let tracciato = `M ${primo.x} ${primo.y}`

  for (let indice = 1; indice < punti.length - 1; indice += 1) {
    const corrente = punti[indice]
    const successivo = punti[indice + 1]
    const medioX = (corrente.x + successivo.x) / 2
    const medioY = (corrente.y + successivo.y) / 2
    tracciato += ` Q ${corrente.x} ${corrente.y} ${medioX} ${medioY}`
  }

  const ultimo = punti[punti.length - 1]
  return `${tracciato} L ${ultimo.x} ${ultimo.y}`
}

const SegnoRenderizzato = memo(function SegnoRenderizzato({
  segno,
  markerId,
}: {
  segno: SegnoNota
  markerId: string
}) {
  const primo = segno.punti[0]
  const ultimo = segno.punti[segno.punti.length - 1]
  if (!primo || !ultimo) return null

  if (segno.strumento === 'cerchio') {
    return (
      <ellipse
        cx={(primo.x + ultimo.x) / 2}
        cy={(primo.y + ultimo.y) / 2}
        rx={Math.abs(ultimo.x - primo.x) / 2}
        ry={Math.abs(ultimo.y - primo.y) / 2}
        fill="none"
        stroke={segno.colore}
        strokeWidth={segno.spessore}
        vectorEffect="non-scaling-stroke"
      />
    )
  }

  if (segno.strumento === 'freccia') {
    return (
      <line
        x1={primo.x}
        y1={primo.y}
        x2={ultimo.x}
        y2={ultimo.y}
        stroke={segno.colore}
        strokeWidth={segno.spessore}
        markerEnd={`url(#${markerId})`}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    )
  }

  return (
    <path
      d={creaTracciatoMorbido(segno.punti)}
      fill="none"
      stroke={segno.colore}
      strokeWidth={segno.spessore}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={segno.strumento === 'evidenziatore' ? 0.32 : 1}
      vectorEffect="non-scaling-stroke"
    />
  )
})

export default function NotaDisegno({
  segni,
  onChange,
  strumento,
  colore,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pathAttivoRef = useRef<SVGPathElement>(null)
  const lineaAttivaRef = useRef<SVGLineElement>(null)
  const cerchioAttivoRef = useRef<SVGEllipseElement>(null)
  const segnoAttivoRef = useRef<SegnoNota | null>(null)
  const pointerAttivoRef = useRef<number | null>(null)
  const tipoPointerRef = useRef('touch')
  const rettangoloRef = useRef<DOMRect | null>(null)
  const frameRef = useRef<number | null>(null)
  const framePuliziaRef = useRef<number | null>(null)
  const bloccoScrollRef = useRef<BloccoScroll | null>(null)
  const markerId = useId().replace(/:/g, '')

  const nascondiAnteprima = () => {
    pathAttivoRef.current?.setAttribute('visibility', 'hidden')
    lineaAttivaRef.current?.setAttribute('visibility', 'hidden')
    cerchioAttivoRef.current?.setAttribute('visibility', 'hidden')
  }

  const renderizzaAnteprima = () => {
    frameRef.current = null
    const segno = segnoAttivoRef.current
    if (!segno) return

    const primo = segno.punti[0]
    const ultimo = segno.punti[segno.punti.length - 1]
    if (!primo || !ultimo) return

    if (segno.strumento === 'freccia') {
      const linea = lineaAttivaRef.current
      if (!linea) return
      linea.setAttribute('x1', String(primo.x))
      linea.setAttribute('y1', String(primo.y))
      linea.setAttribute('x2', String(ultimo.x))
      linea.setAttribute('y2', String(ultimo.y))
      linea.setAttribute('stroke', segno.colore)
      linea.setAttribute('stroke-width', String(segno.spessore))
      linea.setAttribute('visibility', 'visible')
      return
    }

    if (segno.strumento === 'cerchio') {
      const cerchio = cerchioAttivoRef.current
      if (!cerchio) return
      cerchio.setAttribute('cx', String((primo.x + ultimo.x) / 2))
      cerchio.setAttribute('cy', String((primo.y + ultimo.y) / 2))
      cerchio.setAttribute('rx', String(Math.abs(ultimo.x - primo.x) / 2))
      cerchio.setAttribute('ry', String(Math.abs(ultimo.y - primo.y) / 2))
      cerchio.setAttribute('stroke', segno.colore)
      cerchio.setAttribute('stroke-width', String(segno.spessore))
      cerchio.setAttribute('visibility', 'visible')
      return
    }

    const path = pathAttivoRef.current
    if (!path) return
    path.setAttribute('d', creaTracciatoMorbido(segno.punti))
    path.setAttribute('stroke', segno.colore)
    path.setAttribute('stroke-width', String(segno.spessore))
    path.setAttribute(
      'opacity',
      segno.strumento === 'evidenziatore' ? '0.32' : '1'
    )
    path.setAttribute('visibility', 'visible')
  }

  const pianificaRender = () => {
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(renderizzaAnteprima)
  }

  const bloccaScroll = () => {
    if (bloccoScrollRef.current) return

    const x = window.scrollX
    const y = window.scrollY
    const impedisciTouch = (event: TouchEvent) => event.preventDefault()
    const mantieniPosizione = () => window.scrollTo(x, y)

    bloccoScrollRef.current = {
      x,
      y,
      bodyOverflow: document.body.style.overflow,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyLeft: document.body.style.left,
      bodyWidth: document.body.style.width,
      htmlOverscroll: document.documentElement.style.overscrollBehavior,
      impedisciTouch,
      mantieniPosizione,
    }

    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${y}px`
    document.body.style.left = `-${x}px`
    document.body.style.width = '100%'
    document.documentElement.style.overscrollBehavior = 'none'
    window.addEventListener('touchmove', impedisciTouch, {
      passive: false,
      capture: true,
    })
    window.addEventListener('scroll', mantieniPosizione, { passive: true })
  }

  const ripristinaScroll = () => {
    const blocco = bloccoScrollRef.current
    if (!blocco) return

    window.removeEventListener('touchmove', blocco.impedisciTouch, true)
    window.removeEventListener('scroll', blocco.mantieniPosizione)
    document.body.style.overflow = blocco.bodyOverflow
    document.body.style.position = blocco.bodyPosition
    document.body.style.top = blocco.bodyTop
    document.body.style.left = blocco.bodyLeft
    document.body.style.width = blocco.bodyWidth
    document.documentElement.style.overscrollBehavior = blocco.htmlOverscroll
    bloccoScrollRef.current = null
    window.scrollTo(blocco.x, blocco.y)
  }

  const puntoDaCoordinate = (clientX: number, clientY: number): PuntoNota => {
    const rect = rettangoloRef.current
    if (!rect) return { x: 0, y: 0 }

    return {
      x: Math.max(
        0,
        Math.min(LARGHEZZA, ((clientX - rect.left) / rect.width) * LARGHEZZA)
      ),
      y: Math.max(
        0,
        Math.min(ALTEZZA, ((clientY - rect.top) / rect.height) * ALTEZZA)
      ),
    }
  }

  const aggiungiPunti = (event: PointerEvent<SVGSVGElement>) => {
    const segno = segnoAttivoRef.current
    if (!segno || event.pointerId !== pointerAttivoRef.current) return

    const eventiCoalescenti = event.nativeEvent.getCoalescedEvents?.()
    const eventi =
      eventiCoalescenti && eventiCoalescenti.length > 0
        ? eventiCoalescenti
        : [event.nativeEvent]
    const distanzaMinima = tipoPointerRef.current === 'pen' ? 0.6 : 1.4
    let ultimo = segno.punti[segno.punti.length - 1]

    for (const item of eventi) {
      const punto = puntoDaCoordinate(item.clientX, item.clientY)

      if (segno.strumento === 'freccia' || segno.strumento === 'cerchio') {
        segno.punti = [segno.punti[0], punto]
        ultimo = punto
        continue
      }

      const distanza = Math.hypot(punto.x - ultimo.x, punto.y - ultimo.y)
      if (distanza >= distanzaMinima) {
        segno.punti.push(punto)
        ultimo = punto
      }
    }
  }

  const terminaInterazione = () => {
    pointerAttivoRef.current = null
    rettangoloRef.current = null
    ripristinaScroll()
  }

  const inizia = (event: PointerEvent<SVGSVGElement>) => {
    if (!event.isPrimary || pointerAttivoRef.current !== null) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    event.preventDefault()
    event.stopPropagation()

    if (framePuliziaRef.current !== null) {
      window.cancelAnimationFrame(framePuliziaRef.current)
      framePuliziaRef.current = null
    }
    nascondiAnteprima()

    rettangoloRef.current = event.currentTarget.getBoundingClientRect()
    pointerAttivoRef.current = event.pointerId
    tipoPointerRef.current = event.pointerType
    event.currentTarget.setPointerCapture(event.pointerId)
    bloccaScroll()

    const punto = puntoDaCoordinate(event.clientX, event.clientY)
    segnoAttivoRef.current = {
      id: crypto.randomUUID(),
      strumento,
      colore,
      spessore: strumento === 'evidenziatore' ? 18 : event.pointerType === 'touch' ? 5 : 4,
      punti: [punto],
    }
    renderizzaAnteprima()
  }

  const disegna = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerId !== pointerAttivoRef.current) return
    event.preventDefault()
    event.stopPropagation()
    aggiungiPunti(event)
    pianificaRender()
  }

  const termina = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerId !== pointerAttivoRef.current) return
    event.preventDefault()
    aggiungiPunti(event)

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    renderizzaAnteprima()

    const completato = segnoAttivoRef.current
    segnoAttivoRef.current = null
    terminaInterazione()

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (completato) onChange([...segni, completato])
    framePuliziaRef.current = window.requestAnimationFrame(() => {
      framePuliziaRef.current = null
      nascondiAnteprima()
    })
  }

  const annulla = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerId !== pointerAttivoRef.current) return

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    segnoAttivoRef.current = null
    terminaInterazione()
    nascondiAnteprima()
  }

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const impedisciGestiNativi = (event: Event) => event.preventDefault()
    svg.addEventListener('touchmove', impedisciGestiNativi, { passive: false })
    svg.addEventListener('gesturestart', impedisciGestiNativi, {
      passive: false,
    })

    return () => {
      svg.removeEventListener('touchmove', impedisciGestiNativi)
      svg.removeEventListener('gesturestart', impedisciGestiNativi)
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
      if (framePuliziaRef.current !== null) {
        window.cancelAnimationFrame(framePuliziaRef.current)
      }
      ripristinaScroll()
    }
  }, [])

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${LARGHEZZA} ${ALTEZZA}`}
      onPointerDown={inizia}
      onPointerMove={disegna}
      onPointerUp={termina}
      onPointerCancel={annulla}
      onLostPointerCapture={annulla}
      onContextMenu={(event) => event.preventDefault()}
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
        overscrollBehavior: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
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

      <g aria-hidden="true">
        {segni.map((segno) => (
          <SegnoRenderizzato
            key={segno.id}
            segno={segno}
            markerId={markerId}
          />
        ))}
      </g>

      <g aria-hidden="true" pointerEvents="none">
        <path
          ref={pathAttivoRef}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          visibility="hidden"
        />
        <line
          ref={lineaAttivaRef}
          fill="none"
          strokeLinecap="round"
          markerEnd={`url(#${markerId})`}
          vectorEffect="non-scaling-stroke"
          visibility="hidden"
        />
        <ellipse
          ref={cerchioAttivoRef}
          fill="none"
          vectorEffect="non-scaling-stroke"
          visibility="hidden"
        />
      </g>
    </svg>
  )
}
