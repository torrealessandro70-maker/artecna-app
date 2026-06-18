'use client'

import {
  memo,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type Touch as ReactTouch,
  type TouchEvent as ReactTouchEvent,
  type TouchList as ReactTouchList,
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
const ALTEZZA_BASE = 520
const INCREMENTO_ALTEZZA = 260

function calcolaAltezzaNecessaria(segni: SegnoNota[]) {
  const puntoPiuBasso = segni.reduce(
    (massimo, segno) =>
      Math.max(massimo, ...segno.punti.map((punto) => punto.y)),
    0
  )
  const altezzaRichiesta = Math.max(ALTEZZA_BASE, puntoPiuBasso + 120)
  return (
    ALTEZZA_BASE +
    Math.ceil((altezzaRichiesta - ALTEZZA_BASE) / INCREMENTO_ALTEZZA) *
      INCREMENTO_ALTEZZA
  )
}

const strumentiDisponibili: Array<{
  valore: StrumentoDisegno
  etichetta: string
}> = [
  { valore: 'penna', etichetta: 'Penna' },
  { valore: 'evidenziatore', etichetta: 'Evidenzia' },
  { valore: 'linea', etichetta: 'Linea' },
  { valore: 'freccia', etichetta: 'Freccia' },
  { valore: 'rettangolo', etichetta: 'Rettangolo' },
  { valore: 'cerchio', etichetta: 'Cerchio' },
  { valore: 'gomma', etichetta: 'Gomma' },
]

const coloriDisponibili = [
  '#111827',
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#f59e0b',
]

const dimensioniDisponibili = [
  { valore: 3, etichetta: 'Piccolo' },
  { valore: 5, etichetta: 'Medio' },
  { valore: 8, etichetta: 'Grande' },
]

function distanzaDalSegmento(
  punto: PuntoNota,
  inizio: PuntoNota,
  fine: PuntoNota
) {
  const deltaX = fine.x - inizio.x
  const deltaY = fine.y - inizio.y
  const lunghezzaQuadrata = deltaX * deltaX + deltaY * deltaY
  if (lunghezzaQuadrata === 0) {
    return Math.hypot(punto.x - inizio.x, punto.y - inizio.y)
  }

  const posizione = Math.max(
    0,
    Math.min(
      1,
      ((punto.x - inizio.x) * deltaX + (punto.y - inizio.y) * deltaY) /
        lunghezzaQuadrata
    )
  )
  const proiezioneX = inizio.x + posizione * deltaX
  const proiezioneY = inizio.y + posizione * deltaY
  return Math.hypot(punto.x - proiezioneX, punto.y - proiezioneY)
}

function segnoColpito(segno: SegnoNota, punto: PuntoNota, tolleranza: number) {
  const primo = segno.punti[0]
  const ultimo = segno.punti[segno.punti.length - 1]
  if (!primo || !ultimo) return false

  if (segno.strumento === 'cerchio') {
    const raggioX = Math.abs(ultimo.x - primo.x) / 2
    const raggioY = Math.abs(ultimo.y - primo.y) / 2
    if (raggioX === 0 || raggioY === 0) return false
    const centroX = (primo.x + ultimo.x) / 2
    const centroY = (primo.y + ultimo.y) / 2
    const distanzaNormalizzata = Math.sqrt(
      ((punto.x - centroX) / raggioX) ** 2 +
        ((punto.y - centroY) / raggioY) ** 2
    )
    return (
      Math.abs(distanzaNormalizzata - 1) * Math.min(raggioX, raggioY) <=
      tolleranza
    )
  }

  if (segno.strumento === 'rettangolo') {
    const sinistra = Math.min(primo.x, ultimo.x)
    const destra = Math.max(primo.x, ultimo.x)
    const alto = Math.min(primo.y, ultimo.y)
    const basso = Math.max(primo.y, ultimo.y)
    const angoli = [
      { x: sinistra, y: alto },
      { x: destra, y: alto },
      { x: destra, y: basso },
      { x: sinistra, y: basso },
    ]
    return angoli.some(
      (angolo, indice) =>
        distanzaDalSegmento(
          punto,
          angolo,
          angoli[(indice + 1) % angoli.length]
        ) <= tolleranza
    )
  }

  for (let indice = 1; indice < segno.punti.length; indice += 1) {
    if (
      distanzaDalSegmento(
        punto,
        segno.punti[indice - 1],
        segno.punti[indice]
      ) <= tolleranza
    ) {
      return true
    }
  }

  return Math.hypot(punto.x - primo.x, punto.y - primo.y) <= tolleranza
}

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

  if (segno.strumento === 'rettangolo') {
    return (
      <rect
        x={Math.min(primo.x, ultimo.x)}
        y={Math.min(primo.y, ultimo.y)}
        width={Math.abs(ultimo.x - primo.x)}
        height={Math.abs(ultimo.y - primo.y)}
        fill="none"
        stroke={segno.colore}
        strokeWidth={segno.spessore}
        vectorEffect="non-scaling-stroke"
      />
    )
  }

  if (segno.strumento === 'freccia' || segno.strumento === 'linea') {
    return (
      <line
        x1={primo.x}
        y1={primo.y}
        x2={ultimo.x}
        y2={ultimo.y}
        stroke={segno.colore}
        strokeWidth={segno.spessore}
        markerEnd={
          segno.strumento === 'freccia' ? `url(#${markerId})` : undefined
        }
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
  const rettangoloAttivoRef = useRef<SVGRectElement>(null)
  const segnoAttivoRef = useRef<SegnoNota | null>(null)
  const pointerAttivoRef = useRef<number | null>(null)
  const touchAttivoRef = useRef<number | null>(null)
  const tipoPointerRef = useRef('touch')
  const ultimoPointerMoveRef = useRef(0)
  const rettangoloRef = useRef<DOMRect | null>(null)
  const frameRef = useRef<number | null>(null)
  const framePuliziaRef = useRef<number | null>(null)
  const bloccoScrollRef = useRef<BloccoScroll | null>(null)
  const ultimoUsoGommaPointerRef = useRef(0)
  const [altezzaFoglio, setAltezzaFoglio] = useState(() =>
    calcolaAltezzaNecessaria(segni)
  )
  const altezzaFoglioRef = useRef(altezzaFoglio)
  const espansioneInCorsoRef = useRef(false)
  const [strumentoAttivo, setStrumentoAttivo] =
    useState<StrumentoDisegno>(strumento)
  const [strumentoEsternoPrecedente, setStrumentoEsternoPrecedente] =
    useState<StrumentoDisegno>(strumento)
  const [coloreAttivo, setColoreAttivo] = useState(colore)
  const [coloreEsternoPrecedente, setColoreEsternoPrecedente] =
    useState(colore)
  const [spessoreAttivo, setSpessoreAttivo] = useState(5)
  const [storico, setStorico] = useState<{
    annulla: SegnoNota[][]
    ripristina: SegnoNota[][]
    segniCorrenti: SegnoNota[]
  }>({ annulla: [], ripristina: [], segniCorrenti: segni })
  const markerId = useId().replace(/:/g, '')

  if (strumento !== strumentoEsternoPrecedente) {
    setStrumentoEsternoPrecedente(strumento)
    setStrumentoAttivo(strumento)
  }

  if (colore !== coloreEsternoPrecedente) {
    setColoreEsternoPrecedente(colore)
    setColoreAttivo(colore)
  }

  if (storico.segniCorrenti !== segni) {
    setStorico({ annulla: [], ripristina: [], segniCorrenti: segni })
  }

  const altezzaRichiesta = useMemo(
    () => calcolaAltezzaNecessaria(segni),
    [segni]
  )
  if (altezzaRichiesta > altezzaFoglio) {
    setAltezzaFoglio(altezzaRichiesta)
  }

  useLayoutEffect(() => {
    altezzaFoglioRef.current = altezzaFoglio
  }, [altezzaFoglio])

  const applicaModifica = (nuoviSegni: SegnoNota[]) => {
    setStorico({
      annulla: [...storico.annulla, segni].slice(-50),
      ripristina: [],
      segniCorrenti: nuoviSegni,
    })
    onChange(nuoviSegni)
  }

  const annullaUltimaModifica = () => {
    const precedente = storico.annulla[storico.annulla.length - 1]
    if (!precedente) return
    setStorico({
      annulla: storico.annulla.slice(0, -1),
      ripristina: [...storico.ripristina, segni],
      segniCorrenti: precedente,
    })
    onChange(precedente)
  }

  const ripristinaUltimaModifica = () => {
    const successivo = storico.ripristina[storico.ripristina.length - 1]
    if (!successivo) return
    setStorico({
      annulla: [...storico.annulla, segni].slice(-50),
      ripristina: storico.ripristina.slice(0, -1),
      segniCorrenti: successivo,
    })
    onChange(successivo)
  }

  const nascondiAnteprima = () => {
    pathAttivoRef.current?.setAttribute('visibility', 'hidden')
    lineaAttivaRef.current?.setAttribute('visibility', 'hidden')
    cerchioAttivoRef.current?.setAttribute('visibility', 'hidden')
    rettangoloAttivoRef.current?.setAttribute('visibility', 'hidden')
  }

  const renderizzaAnteprima = () => {
    frameRef.current = null
    const segno = segnoAttivoRef.current
    if (!segno) return

    const primo = segno.punti[0]
    const ultimo = segno.punti[segno.punti.length - 1]
    if (!primo || !ultimo) return

    if (segno.strumento === 'freccia' || segno.strumento === 'linea') {
      const linea = lineaAttivaRef.current
      if (!linea) return
      linea.setAttribute('x1', String(primo.x))
      linea.setAttribute('y1', String(primo.y))
      linea.setAttribute('x2', String(ultimo.x))
      linea.setAttribute('y2', String(ultimo.y))
      linea.setAttribute('stroke', segno.colore)
      linea.setAttribute('stroke-width', String(segno.spessore))
      linea.setAttribute(
        'marker-end',
        segno.strumento === 'freccia' ? `url(#${markerId})` : 'none'
      )
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

    if (segno.strumento === 'rettangolo') {
      const rettangolo = rettangoloAttivoRef.current
      if (!rettangolo) return
      rettangolo.setAttribute('x', String(Math.min(primo.x, ultimo.x)))
      rettangolo.setAttribute('y', String(Math.min(primo.y, ultimo.y)))
      rettangolo.setAttribute('width', String(Math.abs(ultimo.x - primo.x)))
      rettangolo.setAttribute('height', String(Math.abs(ultimo.y - primo.y)))
      rettangolo.setAttribute('stroke', segno.colore)
      rettangolo.setAttribute('stroke-width', String(segno.spessore))
      rettangolo.setAttribute('visibility', 'visible')
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
        Math.min(
          altezzaFoglioRef.current,
          ((clientY - rect.top) / rect.height) * altezzaFoglioRef.current
        )
      ),
    }
  }

  const espandiFoglioSeNecessario = (punto: PuntoNota) => {
    if (
      punto.y < altezzaFoglioRef.current - 70 ||
      espansioneInCorsoRef.current
    ) {
      return
    }

    espansioneInCorsoRef.current = true
    const nuovaAltezza = altezzaFoglioRef.current + INCREMENTO_ALTEZZA
    altezzaFoglioRef.current = nuovaAltezza
    setAltezzaFoglio(nuovaAltezza)

    window.requestAnimationFrame(() => {
      rettangoloRef.current = svgRef.current?.getBoundingClientRect() || null
      espansioneInCorsoRef.current = false
    })
  }

  const aggiungiPunto = (punto: PuntoNota) => {
    const segno = segnoAttivoRef.current
    if (!segno) return

    espandiFoglioSeNecessario(punto)

    const distanzaMinima = tipoPointerRef.current === 'pen' ? 0.6 : 1.4
    const ultimo = segno.punti[segno.punti.length - 1]

    if (
      segno.strumento === 'freccia' ||
      segno.strumento === 'linea' ||
      segno.strumento === 'rettangolo' ||
      segno.strumento === 'cerchio'
    ) {
      segno.punti = [segno.punti[0], punto]
      return
    }

    const distanza = Math.hypot(punto.x - ultimo.x, punto.y - ultimo.y)
    if (distanza >= distanzaMinima) {
      segno.punti.push(punto)
    }
  }

  const aggiungiPuntiPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (
      !segnoAttivoRef.current ||
      event.pointerId !== pointerAttivoRef.current
    ) {
      return
    }

    const eventiCoalescenti = event.nativeEvent.getCoalescedEvents?.()
    const eventi =
      eventiCoalescenti && eventiCoalescenti.length > 0
        ? eventiCoalescenti
        : [event.nativeEvent]

    for (const item of eventi) {
      aggiungiPunto(puntoDaCoordinate(item.clientX, item.clientY))
    }
  }

  const terminaInterazione = () => {
    pointerAttivoRef.current = null
    touchAttivoRef.current = null
    rettangoloRef.current = null
    ripristinaScroll()
  }

  const creaSegno = (
    clientX: number,
    clientY: number,
    tipoInput: string
  ) => {
    tipoPointerRef.current = tipoInput
    const punto = puntoDaCoordinate(clientX, clientY)
    segnoAttivoRef.current = {
      id: crypto.randomUUID(),
      strumento: strumentoAttivo,
      colore: coloreAttivo,
      spessore:
        strumentoAttivo === 'evidenziatore'
          ? spessoreAttivo * 4
          : spessoreAttivo,
      punti: [punto],
    }
    renderizzaAnteprima()
  }

  const completaSegno = () => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    renderizzaAnteprima()

    const completato = segnoAttivoRef.current
    segnoAttivoRef.current = null
    terminaInterazione()

    if (completato) applicaModifica([...segni, completato])
    framePuliziaRef.current = window.requestAnimationFrame(() => {
      framePuliziaRef.current = null
      nascondiAnteprima()
    })
  }

  const usaGomma = (punto: PuntoNota) => {
    let indiceDaEliminare = -1

    for (let indice = segni.length - 1; indice >= 0; indice -= 1) {
      if (segnoColpito(segni[indice], punto, 24)) {
        indiceDaEliminare = indice
        break
      }
    }

    if (indiceDaEliminare < 0) return
    applicaModifica(segni.filter((_, indice) => indice !== indiceDaEliminare))
  }

  const inizia = (event: PointerEvent<SVGSVGElement>) => {
    if (segnoAttivoRef.current || pointerAttivoRef.current !== null) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    event.preventDefault()
    event.stopPropagation()

    if (framePuliziaRef.current !== null) {
      window.cancelAnimationFrame(framePuliziaRef.current)
      framePuliziaRef.current = null
    }
    nascondiAnteprima()

    rettangoloRef.current = event.currentTarget.getBoundingClientRect()

    if (strumentoAttivo === 'gomma') {
      ultimoUsoGommaPointerRef.current = performance.now()
      usaGomma(puntoDaCoordinate(event.clientX, event.clientY))
      rettangoloRef.current = null
      return
    }

    pointerAttivoRef.current = event.pointerId
    bloccaScroll()

    creaSegno(event.clientX, event.clientY, event.pointerType)

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Safari iPad può rifiutare la cattura della Pencil: il tratto prosegue
      // con gli eventi sul foglio e con il fallback touch.
    }
  }

  const disegna = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerId !== pointerAttivoRef.current) return
    event.preventDefault()
    event.stopPropagation()
    ultimoPointerMoveRef.current = performance.now()
    aggiungiPuntiPointer(event)
    pianificaRender()
  }

  const termina = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerId !== pointerAttivoRef.current) return
    event.preventDefault()
    aggiungiPuntiPointer(event)

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // La cattura è opzionale e può essere già stata persa da Safari.
    }

    completaSegno()
  }

  const annulla = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerId !== pointerAttivoRef.current) return

    if (touchAttivoRef.current !== null) {
      pointerAttivoRef.current = null
      return
    }

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    segnoAttivoRef.current = null
    terminaInterazione()
    nascondiAnteprima()
  }

  const tipoTouchSafari = (touch: ReactTouch) => {
    const touchConTipo = touch as ReactTouch & { touchType?: string }
    return touchConTipo.touchType === 'stylus' ? 'pen' : 'touch'
  }

  const trovaTouch = (lista: ReactTouchList) => {
    if (touchAttivoRef.current === null) return lista.item(0)

    for (let indice = 0; indice < lista.length; indice += 1) {
      const touch = lista.item(indice)
      if (touch?.identifier === touchAttivoRef.current) return touch
    }
    return null
  }

  const iniziaTouch = (event: ReactTouchEvent<SVGSVGElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const touch = event.changedTouches.item(0)
    if (!touch) return

    touchAttivoRef.current = touch.identifier

    // Se pointerdown ha già creato il tratto, il touch diventa soltanto il
    // canale di riserva per gli iPad che non inviano pointermove della Pencil.
    if (segnoAttivoRef.current) return

    if (framePuliziaRef.current !== null) {
      window.cancelAnimationFrame(framePuliziaRef.current)
      framePuliziaRef.current = null
    }
    nascondiAnteprima()
    rettangoloRef.current = event.currentTarget.getBoundingClientRect()

    if (strumentoAttivo === 'gomma') {
      if (performance.now() - ultimoUsoGommaPointerRef.current >= 500) {
        usaGomma(puntoDaCoordinate(touch.clientX, touch.clientY))
      }
      touchAttivoRef.current = null
      rettangoloRef.current = null
      return
    }

    bloccaScroll()
    creaSegno(
      touch.clientX,
      touch.clientY,
      tipoTouchSafari(touch)
    )
  }

  const disegnaTouch = (event: ReactTouchEvent<SVGSVGElement>) => {
    if (!segnoAttivoRef.current) return
    event.preventDefault()
    event.stopPropagation()

    // Su browser conformi il Pointer Event resta la fonte principale. Il
    // fallback interviene solo se Safari non lo aggiorna da almeno due frame.
    if (
      pointerAttivoRef.current !== null &&
      performance.now() - ultimoPointerMoveRef.current < 32
    ) {
      return
    }

    const touch = trovaTouch(event.touches)
    if (!touch) return
    aggiungiPunto(puntoDaCoordinate(touch.clientX, touch.clientY))
    pianificaRender()
  }

  const terminaTouch = (event: ReactTouchEvent<SVGSVGElement>) => {
    if (!segnoAttivoRef.current) return
    const touch = trovaTouch(event.changedTouches)
    if (!touch) return

    event.preventDefault()
    aggiungiPunto(puntoDaCoordinate(touch.clientX, touch.clientY))
    completaSegno()
  }

  const annullaTouch = (event: ReactTouchEvent<SVGSVGElement>) => {
    if (!segnoAttivoRef.current) return
    event.preventDefault()
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
    <div style={{ width: '100%' }}>
      <div
        role="toolbar"
        aria-label="Strumenti di disegno"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
          padding: 8,
          border: '1px solid #cbd5e1',
          borderRadius: 12,
          background: '#f8fafc',
        }}
      >
        <span
          style={{
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 6px',
            fontSize: 13,
            fontWeight: 800,
            color: '#334155',
          }}
        >
          Strumenti
        </span>
        {strumentiDisponibili.map((item) => {
          const selezionato = strumentoAttivo === item.valore

          return (
            <button
              key={item.valore}
              type="button"
              aria-pressed={selezionato}
              onClick={() => setStrumentoAttivo(item.valore)}
              style={{
                minWidth: 86,
                minHeight: 48,
                padding: '9px 12px',
                flex: '0 0 auto',
                border: selezionato
                  ? '3px solid #1d4ed8'
                  : '1px solid #94a3b8',
                borderRadius: 10,
                background: selezionato ? '#dbeafe' : '#fff',
                color: selezionato ? '#1e3a8a' : '#0f172a',
                fontWeight: selezionato ? 800 : 600,
                boxShadow: selezionato
                  ? '0 0 0 2px rgba(37, 99, 235, 0.18)'
                  : 'none',
                cursor: 'pointer',
              }}
            >
              {item.etichetta}
            </button>
          )
        })}

        <span
          aria-hidden="true"
          style={{ width: 1, height: 38, background: '#cbd5e1' }}
        />

        <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>
          Tratto
        </span>
        {dimensioniDisponibili.map((dimensione) => {
          const selezionata = spessoreAttivo === dimensione.valore
          return (
            <button
              key={dimensione.valore}
              type="button"
              aria-label={`Dimensione ${dimensione.etichetta}`}
              aria-pressed={selezionata}
              onClick={() => setSpessoreAttivo(dimensione.valore)}
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                border: selezionata
                  ? '3px solid #1d4ed8'
                  : '1px solid #94a3b8',
                background: selezionata ? '#dbeafe' : '#fff',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: Math.max(8, dimensione.valore * 2),
                  height: Math.max(8, dimensione.valore * 2),
                  borderRadius: '50%',
                  background: '#111827',
                }}
              />
            </button>
          )
        })}

        <span
          aria-hidden="true"
          style={{ width: 1, height: 38, background: '#cbd5e1' }}
        />

        <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>
          Colore
        </span>
        {coloriDisponibili.map((coloreDisponibile) => {
          const selezionato = coloreAttivo === coloreDisponibile
          return (
            <button
              key={coloreDisponibile}
              type="button"
              aria-label={`Colore ${coloreDisponibile}`}
              aria-pressed={selezionato}
              onClick={() => setColoreAttivo(coloreDisponibile)}
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                border: selezionato
                  ? '4px solid #fff'
                  : '2px solid #cbd5e1',
                background: coloreDisponibile,
                boxShadow: selezionato ? '0 0 0 3px #1d4ed8' : 'none',
                cursor: 'pointer',
              }}
            />
          )
        })}

        <span
          aria-hidden="true"
          style={{ width: 1, height: 38, background: '#cbd5e1' }}
        />

        <button
          type="button"
          onClick={annullaUltimaModifica}
          disabled={storico.annulla.length === 0}
          style={{
            minHeight: 48,
            padding: '9px 14px',
            border: '1px solid #94a3b8',
            borderRadius: 10,
            background: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Annulla
        </button>
        <button
          type="button"
          onClick={ripristinaUltimaModifica}
          disabled={storico.ripristina.length === 0}
          style={{
            minHeight: 48,
            padding: '9px 14px',
            border: '1px solid #94a3b8',
            borderRadius: 10,
            background: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Ripristina
        </button>
        <button
          type="button"
          onClick={() => segni.length > 0 && applicaModifica([])}
          disabled={segni.length === 0}
          style={{
            minHeight: 48,
            padding: '9px 14px',
            border: '1px solid #dc2626',
            borderRadius: 10,
            background: '#fff',
            color: '#991b1b',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Pulisci
        </button>
      </div>

      <svg
      ref={svgRef}
      viewBox={`0 0 ${LARGHEZZA} ${altezzaFoglio}`}
      onPointerDown={inizia}
      onPointerMove={disegna}
      onPointerUp={termina}
      onPointerCancel={annulla}
      onTouchStart={iniziaTouch}
      onTouchMove={disegnaTouch}
      onTouchEnd={terminaTouch}
      onTouchCancel={annullaTouch}
      onContextMenu={(event) => event.preventDefault()}
      style={{
        width: '100%',
        aspectRatio: `${LARGHEZZA} / ${altezzaFoglio}`,
        height: 'auto',
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
        <rect
          ref={rettangoloAttivoRef}
          fill="none"
          vectorEffect="non-scaling-stroke"
          visibility="hidden"
        />
      </g>
      </svg>
    </div>
  )
}
