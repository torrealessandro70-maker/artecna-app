'use client'
import {
  resizeBackground,
  type BackgroundTransform,
  type ResizeHandle,
} from '@/app/engines/quaderno-layout'


import {
  useEffect,
  useId,
  useRef,
useState,
  type PointerEvent,
  type RefObject,
} from 'react'

import type { PuntoNota, OggettoGraficoQuaderno, SegnoNota, StrumentoDisegno } from './types'
import type {
  QuadernoLayer,
  QuadernoLayerId,
} from "@/app/engines/quaderno-layers/types";
import {
  isStrumentoGomma,
  isStrumentoManoLibera,
  isStrumentoTecnico,
} from './drawing-tools'

import {
  segnoToCadEntity,
  imageToCadEntity,
  createCadDimension,
} from '@/app/engines/cad/entities'

import {
  segmentIntersection,
  findLineIntersections,
} from '@/app/engines/cad/geometry'

import {
  buildCadGraph,
  findNearestSegment,
  findNodeById,
  findEntitySegments,
} from '@/app/engines/cad/graph'

import {
  resolveSnapPoint,
  type SnapPoint,
} from '@/app/engines/cad/snap'

import { getSnapTolerance } from '../../engines/cad/snap/tolerance'
import { buildSpatialIndex } from '../../engines/cad/spatial/index'
import { querySpatialIndex } from '../../engines/cad/spatial/query'
import { applyOrtho } from '@/app/engines/cad/ortho'
import { applyGridSnap } from '@/app/engines/cad/grid'
import { applyPolar } from '@/app/engines/cad/polar'
import type { CadScaleCalibration } from '@/app/engines/cad/scale-manager'
import type {
  CadDimensionEntity,
  CadEntity,
  CadSelectionItem,
} from '@/app/engines/cad/entities'
import CadEntityRenderer from "@/app/engines/cad/render/CadEntityRenderer"
import {
  applyTrimToSegni,
} from '@/app/engines/cad/operations'

import {
  perpendicularDirection,
} from "@/app/engines/cad/geometry"

import {
  createAreaPolylinePoints,
  createInitialAreaState,
  handleAreaPointerDown,
  handleAreaPointerMove,
  updateCadAreaVertex,
  type CadAreaPoint,
} from "@/app/engines/cad/area";

import {
  splitCadAreaEntityByLine,
} from "@/app/engines/cad/area"

import {
  calculatePixelDistance,
} from '@/app/engines/cad/scale'

import {
  createScaleCalibration,
} from '@/app/engines/cad/scale-manager'

type InteractionMode =
  | { type: 'idle' }
  | { type: 'drawing' }
  | {
      type: 'dragging-background'
      offsetX: number
      offsetY: number
    }
 | {
    type: 'dragging-text'
    textId: string
    offsetX: number
    offsetY: number
  }

| {
    type: 'dragging-object'
    objectId: string
    offsetX: number
    offsetY: number
  }

| {
    type: 'resizing-text'
    textId: string

    startPoint: {
      x: number
      y: number
    }

    startWidth: number
    startHeight: number
  }

| {
    type: 'resizing-object'
    objectId: string
    handle: ResizeHandle
    puntoIniziale: PuntoNota
    transformIniziale: BackgroundTransform
  }

  | {
      type: 'resizing-background'
      handle: ResizeHandle
      puntoIniziale: PuntoNota
      transformIniziale: BackgroundTransform
    }

type Props = {
  segni: SegnoNota[]
  onChange: (
    segni: SegnoNota[],
    registraCronologia?: boolean,
  ) => void
  strumento:
    | StrumentoDisegno
    | null
    | false
 colore: string
spessore: number
dimensioneTesto?: number
sfondo?: string | null

  oggettiGrafici?: OggettoGraficoQuaderno[]
  oggettoGraficoSelezionatoId?: string | null
  onSelezionaOggettoGrafico?: (id: string) => void
  onDeselezionaOggettoGrafico?: () => void

onCambiaOggettoGraficoTransform?: (
  id: string,
  transform: BackgroundTransform,
) => void

onInizioTrasformazioneOggetto?: () => void
onFineTrasformazioneOggetto?: () => void

  pinSelezionatoId?: string | null
  onSelezionaPin?: (id: string) => void
  larghezza?: number
  altezza?: number
zoomSfondo?: number
sfondoX?: number
sfondoY?: number
  backgroundTransform?: BackgroundTransform
sfondoSelezionato?: boolean
onSelezionaSfondo?: () => void
onDeselezionaSfondo?: () => void
onSpostaSfondo?: (x: number, y: number) => void
onCambiaBackgroundTransform?: (
  transform: BackgroundTransform,
) => void
layers?: QuadernoLayer[];
layerAttivoId?: QuadernoLayerId;

onLayersChange?: (
  layers: QuadernoLayer[],
) => void;
svgRefEsterno?: React.RefObject<SVGSVGElement | null>
trimAttivo?: boolean
orthoAttivo?: boolean
snapAttivo?: boolean
gridSnapAttivo?: boolean
modalitaSelezione?: boolean
gridSize?: number
polarTrackingAttivo?: boolean
polarIncrement?: number
polarTolerance?: number
perpTrackingAttivo?: boolean
scaleCalibration?: CadScaleCalibration | null
calibrazioneScalaAttiva?: boolean
onScaleCalibrationChange?: (
  calibration: CadScaleCalibration,
) => void
onFineCalibrazioneScala?: () => void
metroAttivo?: boolean
areaAttiva?: boolean
onFineArea?: () => void

cadEntities?: CadEntity[]
onCreateCadEntity?: (
  entity: CadEntity,
) => void

onUpdateCadEntity?: (
  entity: CadEntity,
) => void

onDeleteCadEntity?: (
  entityId: string,
) => void

onReplaceCadEntity?: (
  entityId: string,
  replacements: CadEntity[],
) => void

onCreateDimension?: (
  dimension: CadDimensionEntity,
) => void

onUpdateDimension?: (
  dimension: CadDimensionEntity,
) => void

onDeleteDimension?: (
  dimensionId: string,
) => void

onSelezionaCadEntity?: (
  id: string | null,
) => void


cadEntitySelezionateIds?: string[]
onCambiaSelezioneCad?: (ids: string[]) => void
rettangoloSelezione?: {
  startX: number
  startY: number
  endX: number
  endY: number
} | null
onCambiaRettangoloSelezione?: (
  rettangolo: {
    startX: number
    startY: number
    endX: number
    endY: number
  } | null,
) => void

cadDimensions?: CadDimensionEntity[]
}

const LARGHEZZA_DEFAULT = 900
const ALTEZZA_DEFAULT = 520


type OggettoImmagineProps = {
  oggetto: OggettoGraficoQuaderno
  selezionato: boolean
  strumento: StrumentoDisegno | null | false
modalitaSelezione: boolean
  onPointerDownImmagine: (
    event: PointerEvent<SVGImageElement>,
  ) => void
  onResize: (
    event: PointerEvent<SVGCircleElement>,
    handle: ResizeHandle,
  ) => void
}

const OggettoImmagine = ({
  oggetto,
  selezionato,
  strumento,
modalitaSelezione,
  onPointerDownImmagine,
  onResize,
}: OggettoImmagineProps) => {
  const [
    dimensioniNaturali,
    setDimensioniNaturali,
  ] = useState<{
    width: number
    height: number
  } | null>(null)



  useEffect(() => {
    const immagine = new Image()

    immagine.onload = () => {
      setDimensioniNaturali({
        width: immagine.naturalWidth,
        height: immagine.naturalHeight,
      })
    }

    immagine.src = oggetto.sorgente

    return () => {
      immagine.onload = null
    }
  }, [oggetto.sorgente])

  const rettangolo = (() => {
    const transform = oggetto.transform

    if (
      !dimensioniNaturali ||
      dimensioniNaturali.width <= 0 ||
      dimensioniNaturali.height <= 0
    ) {
      return transform
    }

    const rapportoImmagine =
      dimensioniNaturali.width /
      dimensioniNaturali.height

    const rapportoContenitore =
      transform.width / transform.height

    if (rapportoImmagine > rapportoContenitore) {
      const width = transform.width
      const height = width / rapportoImmagine

      return {
        ...transform,
        x: transform.x,
        y:
          transform.y +
          (transform.height - height) / 2,
        width,
        height,
      }
    }

    const height = transform.height
    const width = height * rapportoImmagine

    return {
      ...transform,
      x:
        transform.x +
        (transform.width - width) / 2,
      y: transform.y,
      width,
      height,
    }
  })()

  return (
    <g data-oggetto-grafico-id={oggetto.id}>
      <image
        href={oggetto.sorgente}
        x={rettangolo.x}
        y={rettangolo.y}
        width={rettangolo.width}
        height={rettangolo.height}
        preserveAspectRatio="none"
        pointerEvents={
  modalitaSelezione && strumento === null
    ? 'auto'
    : 'none'
}
       onPointerDown={
  modalitaSelezione && strumento === null
    ? onPointerDownImmagine
    : undefined
}
        style={{
          cursor:
  modalitaSelezione && strumento === null
    ? selezionato
      ? 'move'
      : 'pointer'
    : 'inherit',
        }}
      />

      {selezionato && (
        <g>
          <rect
            x={rettangolo.x}
            y={rettangolo.y}
            width={rettangolo.width}
            height={rettangolo.height}
            fill="none"
            stroke="#2563eb"
            strokeWidth={3}
            strokeDasharray="10 6"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />

          {[
            {
              handle: 'top-left' as ResizeHandle,
              x: rettangolo.x,
              y: rettangolo.y,
              cursor: 'nwse-resize',
            },
            {
              handle: 'top' as ResizeHandle,
              x: rettangolo.x + rettangolo.width / 2,
              y: rettangolo.y,
              cursor: 'ns-resize',
            },
            {
              handle: 'top-right' as ResizeHandle,
              x: rettangolo.x + rettangolo.width,
              y: rettangolo.y,
              cursor: 'nesw-resize',
            },
            {
              handle: 'left' as ResizeHandle,
              x: rettangolo.x,
              y: rettangolo.y + rettangolo.height / 2,
              cursor: 'ew-resize',
            },
            {
              handle: 'right' as ResizeHandle,
              x: rettangolo.x + rettangolo.width,
              y: rettangolo.y + rettangolo.height / 2,
              cursor: 'ew-resize',
            },
            {
              handle: 'bottom-left' as ResizeHandle,
              x: rettangolo.x,
              y: rettangolo.y + rettangolo.height,
              cursor: 'nesw-resize',
            },
            {
              handle: 'bottom' as ResizeHandle,
              x: rettangolo.x + rettangolo.width / 2,
              y: rettangolo.y + rettangolo.height,
              cursor: 'ns-resize',
            },
            {
              handle: 'bottom-right' as ResizeHandle,
              x: rettangolo.x + rettangolo.width,
              y: rettangolo.y + rettangolo.height,
              cursor: 'nwse-resize',
            },
          ].map((maniglia) => (
            <circle
              key={maniglia.handle}
              cx={maniglia.x}
              cy={maniglia.y}
              r={10}
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth={3}
              vectorEffect="non-scaling-stroke"
              onPointerDown={(event) =>
                onResize(
                  event,
                  maniglia.handle,
                )
              }
              style={{
                cursor: oggetto.transform.locked
                  ? 'not-allowed'
                  : maniglia.cursor,
              }}
            />
          ))}
        </g>
      )}
    </g>
  )
}

export default function NotaDisegno({
  segni,
  onChange,
  strumento,
  colore,
  spessore,
dimensioneTesto = 12,
  sfondo,
 oggettiGrafici = [],
  oggettoGraficoSelezionatoId = null,
 onSelezionaOggettoGrafico,
onDeselezionaOggettoGrafico,
onCambiaOggettoGraficoTransform,
onInizioTrasformazioneOggetto,
onFineTrasformazioneOggetto,

  pinSelezionatoId,
  onSelezionaPin,
  larghezza = LARGHEZZA_DEFAULT,
  altezza = ALTEZZA_DEFAULT,
  zoomSfondo = 1,
  sfondoX = 0,
  sfondoY = 0,
  backgroundTransform,
  sfondoSelezionato = false,
  onSelezionaSfondo,
onDeselezionaSfondo,
  onSpostaSfondo,
onCambiaBackgroundTransform,

layers,
layerAttivoId = "drawing",

onLayersChange,

svgRefEsterno,
orthoAttivo = false,
snapAttivo = true,
gridSnapAttivo = false,
modalitaSelezione = true,
gridSize = 24,
polarTrackingAttivo = false,
polarIncrement = 45,
polarTolerance = 8,
perpTrackingAttivo = true,
scaleCalibration = null,
calibrazioneScalaAttiva = false,
metroAttivo = false,
areaAttiva = false,
onFineArea,
onScaleCalibrationChange,
onFineCalibrazioneScala,
cadDimensions = [],
cadEntities = [],
onCreateCadEntity,
onUpdateCadEntity,
onCreateDimension,
onDeleteCadEntity,
onReplaceCadEntity,
onUpdateDimension,
onDeleteDimension,
onSelezionaCadEntity,
cadEntitySelezionateIds = [],
onCambiaSelezioneCad,
rettangoloSelezione = null,
onCambiaRettangoloSelezione,
trimAttivo = false,
}: Props) {
const layerSfondo = layers?.find(
  (layer) => layer.id === "background",
);

const layerImmagini = layers?.find(
  (layer) => layer.id === "images",
);

const layerDisegni = layers?.find(
  (layer) => layer.id === "drawing",
);

const layerPin = layers?.find(
  (layer) => layer.id === "pins",
);

const sfondoVisibile =
  layerSfondo?.visible ?? true;

const sfondoBloccato =
  layerSfondo?.locked ?? false;

const immaginiVisibili =
  layerImmagini?.visible ?? true;

const immaginiBloccate =
  layerImmagini?.locked ?? false;

const disegniVisibili =
  layerDisegni?.visible ?? true;

const disegniBloccati =
  layerDisegni?.locked ?? false;

const pinVisibili =
  layerPin?.visible ?? true;

const pinBloccati =
  layerPin?.locked ?? false;
const getLayerState = (
  layerId?: QuadernoLayerId,
  fallback: QuadernoLayerId = "drawing",
) => {
  const id = layerId ?? fallback;

  const layer = layers?.find(
    (l) => l.id === id,
  );

  return {
    visible: layer?.visible ?? true,
    locked: layer?.locked ?? false,
    selectable: layer?.selectable ?? true,
  };
};

const transform = backgroundTransform ?? {
  x: 0,
  y: 0,
  width: larghezza,
  height: altezza,
  rotation: 0,
  locked: false,
}

const areaStateRef = useRef(
  createInitialAreaState(),
)

const areaSplitStartRef =
  useRef<CadAreaPoint | null>(null)

const [areaSplitEnd, setAreaSplitEnd] =
  useState<CadAreaPoint | null>(null)

const [areaSplitEntityId, setAreaSplitEntityId] =
  useState<string | null>(null)

const puntiAreaRef = {
  get current() {
    return areaStateRef.current.points
  },

  set current(value) {
    areaStateRef.current = {
      ...areaStateRef.current,
      points: value,
    }
  },
}


const trascinamentoSelezioneMultiplaRef = useRef<{
  puntoIniziale: {
    x: number
    y: number
  }
  segniIniziali: SegnoNota[]
} | null>(null)
const selezioneMultiplaAttivaRef = useRef(false)
const puntoInizioSelezioneRef = useRef<{
  x: number
  y: number
} | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
const segnoAttivo = useRef<SegnoNota | null>(null)

const puntoInizioCalibrazioneRef =
  useRef<{ x: number; y: number } | null>(null)
const puntoInizioMisuraRef =
  useRef<{ x: number; y: number } | null>(null)
const puntoFineMisuraRef =
  useRef<{ x: number; y: number } | null>(null)
const [testoInModificaId, setTestoInModificaId] =
  useState<string | null>(null)
const [lineaRiferimentoPerpendicolareId, setLineaRiferimentoPerpendicolareId] =
  useState<string | null>(null)

const [
  trackingPerpendicolare,
  setTrackingPerpendicolare,
] = useState<{
  start: { x: number; y: number }
  end: { x: number; y: number }
  entityId: string
} | null>(null)



const [areaVersione, setAreaVersione] =
  useState(0)

void areaVersione

const puntiAreaTemporanei =
  areaStateRef.current.points

const cursoreArea =
  areaStateRef.current.cursorPoint

const areaVicinoAlPrimoPunto =
  areaStateRef.current.nearFirstPoint

const areaChiusa =
  areaStateRef.current.closed

const sincronizzaAreaTemporanea = () => {
  setAreaVersione(
    (versioneCorrente) =>
      versioneCorrente + 1,
  )
}



const setCursoreArea = (
  punto: CadAreaPoint | null,
) => {
  areaStateRef.current =
  handleAreaPointerMove(
    areaStateRef.current,
    punto,
  )

  sincronizzaAreaTemporanea()
}

const [
  valoreTestoInModifica,
  setValoreTestoInModifica,
] = useState("")

const [quotaSelezionataId, setQuotaSelezionataId] =
  useState<string | null>(null)

const [gripQuotaAttivo, setGripQuotaAttivo] = useState<
  "start" | "center" | "end" | null
>(null)

const [
  areaGripAttivo,
  setAreaGripAttivo,
] = useState<{
  entityId: string
  vertexIndex: number
} | null>(null)

const [quotaInTrascinamento, setQuotaInTrascinamento] =
  useState<string | null>(null)
const [misuraTemporanea, setMisuraTemporanea] =
  useState<{
    start: { x: number; y: number }
    end: { x: number; y: number }
    metri: number
    offset: number
    confermata: boolean
  } | null>(null)

useEffect(() => {
  if (!testoInModificaId) {
    return
  }

  const gestisciPointerDownEsterno = (
    event: globalThis.PointerEvent,
  ) => {
    const target = event.target

    if (!(target instanceof Node)) {
      return
    }

if (
  target instanceof Element &&
  target.closest(
    '[data-text-resize-handle="true"]',
  )
) {
  return
}

    if (
      inputModificaTestoRef.current?.contains(target)
    ) {
      return
    }

    confermaModificaTesto()
  }

  document.addEventListener(
    "pointerdown",
    gestisciPointerDownEsterno,
  )

  return () => {
    document.removeEventListener(
      "pointerdown",
      gestisciPointerDownEsterno,
    )
  }
}, [
  testoInModificaId,
  valoreTestoInModifica,
])

useEffect(() => {
  if (cadDimensions.length === 0) {
    puntoInizioMisuraRef.current = null
    puntoFineMisuraRef.current = null
    setMisuraTemporanea(null)
  }
}, [cadDimensions])

const interactionMode = useRef<InteractionMode>({
  type: 'idle',
})

const [dimensioniImmagine, setDimensioniImmagine] =
  useState<{
    width: number
    height: number
  } | null>(null)


const rettangoloImmagine = (() => {
  if (
    !dimensioniImmagine ||
    dimensioniImmagine.width <= 0 ||
    dimensioniImmagine.height <= 0
  ) {
    return {
      x: transform.x,
      y: transform.y,
      width: transform.width,
      height: transform.height,
    }
  }

  const rapportoImmagine =
    dimensioniImmagine.width /
    dimensioniImmagine.height

  const rapportoContenitore =
    transform.width / transform.height

  if (rapportoImmagine > rapportoContenitore) {
    const width = transform.width
    const height = width / rapportoImmagine

    return {
      x: transform.x,
      y:
        transform.y +
        (transform.height - height) / 2,
      width,
      height,
    }
  }

  const height = transform.height
  const width = height * rapportoImmagine

  return {
    x:
      transform.x +
      (transform.width - width) / 2,
    y: transform.y,
    width,
    height,
  }
})()

const trascinamentoSfondo = useRef<{
  offsetX: number
  offsetY: number
} | null>(null)

const ultimoClickTestoRef = useRef<{
  id: string
  timestamp: number
} | null>(null)

const inputModificaTestoRef =
  useRef<HTMLTextAreaElement>(null)

useEffect(() => {
  if (!sfondo) {
    setDimensioniImmagine(null)
    return
  }

  const immagine = new Image()

  immagine.onload = () => {
    setDimensioniImmagine({
      width: immagine.naturalWidth,
      height: immagine.naturalHeight,
    })
  }

  immagine.src = sfondo

  return () => {
    immagine.onload = null
  }
}, [sfondo])

  const markerId = useId().replace(/:/g, '')
const [snapPoint, setSnapPoint] =
  useState<SnapPoint | null>(null)


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

const puntoDaClient = (
  clientX: number,
  clientY: number,
): PuntoNota => {
  const rect = svgRef.current?.getBoundingClientRect()

  if (!rect) {
    return { x: 0, y: 0 }
  }

  return {
    x: ((clientX - rect.left) / rect.width) * larghezza,
    y: ((clientY - rect.top) / rect.height) * altezza,
  }
}

 const puntoDaEvento = (
  event: PointerEvent<SVGSVGElement>,
): PuntoNota => {
  return puntoDaClient(
    event.clientX,
    event.clientY,
  )
}

   const cancellaSegniVicini = (
  punto: PuntoNota,
  registraCronologia = false,
) => {
  const raggioGomma = Math.max(spessore * 3, 18)
const tolleranzaGommaCad = 4

const graph = buildCadGraph(segni)

const hitGraph = findNearestSegment(
  graph,
  punto,
  tolleranzaGommaCad,
)




  const distanzaDaSegmento = (
    puntoTest: PuntoNota,
    inizio: PuntoNota,
    fine: PuntoNota,
  ) => {
    const dx = fine.x - inizio.x
    const dy = fine.y - inizio.y

    const lunghezzaQuadrata =
      dx * dx + dy * dy

    if (lunghezzaQuadrata === 0) {
      return Math.hypot(
        puntoTest.x - inizio.x,
        puntoTest.y - inizio.y,
      )
    }

    const t = Math.max(
      0,
      Math.min(
        1,
        (
          (puntoTest.x - inizio.x) * dx +
          (puntoTest.y - inizio.y) * dy
        ) / lunghezzaQuadrata,
      ),
    )

    const puntoVicino = {
      x: inizio.x + t * dx,
      y: inizio.y + t * dy,
    }

    return Math.hypot(
      puntoTest.x - puntoVicino.x,
      puntoTest.y - puntoVicino.y,
    )
  }

  const segniFiltrati = segni.flatMap((segno) => {


if (
  segno.strumento === "linea" &&
  segno.punti.length >= 2
) {
  if (
    !hitGraph ||
    hitGraph.segment.entityId !== segno.id
  ) {
    return [segno]
  }

  const segmentiLinea =
  findEntitySegments(
    graph,
    segno.id,
  ).sort(
    (a, b) =>
      a.edgeIndex - b.edgeIndex,
  )

  const segmentiRimanenti =
    segmentiLinea.filter(
      (segmento) =>
        segmento.id !==
        hitGraph.segment.id,
    )

  if (segmentiRimanenti.length === 0) {
    return []
  }

  const nuoviSegmenti: SegnoNota[] = []

  for (
    let index = 0;
    index < segmentiRimanenti.length;
    index++
  ) {
    const segmento =
      segmentiRimanenti[index]

    const nodoInizio =
  findNodeById(
    graph,
    segmento.startNodeId,
  )

const nodoFine =
  findNodeById(
    graph,
    segmento.endNodeId,
  )

    if (!nodoInizio || !nodoFine) {
      continue
    }

    nuoviSegmenti.push({
      ...segno,

      id:
        index === 0
          ? segno.id
          : crypto.randomUUID(),

      punti: [
        {
          x: nodoInizio.x,
          y: nodoInizio.y,
        },
        {
          x: nodoFine.x,
          y: nodoFine.y,
        },
      ],
    })
  }

  return nuoviSegmenti
}

if (
  segno.strumento === "rettangolo"
) {
  if (
    !hitGraph ||
    hitGraph.segment.entityId !== segno.id
  ) {
    return [segno]
  }

  const segmentiRettangolo =
  findEntitySegments(
    graph,
    segno.id,
  ).sort(
    (a, b) =>
      a.edgeIndex - b.edgeIndex,
  )

  const segmentiRimanenti =
    segmentiRettangolo.filter(
      (segmento) =>
        segmento.id !==
        hitGraph.segment.id,
    )

  if (
    segmentiRimanenti.length === 0
  ) {
    return []
  }

  const nuoviSegmenti: SegnoNota[] = []

  for (
    let index = 0;
    index < segmentiRimanenti.length;
    index++
  ) {
    const segmento =
      segmentiRimanenti[index]

    const nodoInizio =
      graph.nodes.find(
        (node) =>
          node.id ===
          segmento.startNodeId,
      )

    const nodoFine =
      graph.nodes.find(
        (node) =>
          node.id ===
          segmento.endNodeId,
      )

    if (!nodoInizio || !nodoFine) {
      continue
    }

    nuoviSegmenti.push({
      ...segno,
      id: crypto.randomUUID(),
      strumento: "linea",
      punti: [
        {
          x: nodoInizio.x,
          y: nodoInizio.y,
        },
        {
          x: nodoFine.x,
          y: nodoFine.y,
        },
      ],
    })
  }

  return nuoviSegmenti
}

// Penna, evidenziatore ecc.
const vicino = segno.punti.some((p) => {
  const distanza = Math.hypot(
    p.x - punto.x,
    p.y - punto.y,
  )

  return distanza <= raggioGomma
})

return vicino ? [] : [segno]
})

onChange(
  segniFiltrati,
  registraCronologia,
)
}

const iniziaTrascinamentoSfondo = (
  event: PointerEvent<SVGImageElement>,
) => {
  event.preventDefault()
  event.stopPropagation()

  onSelezionaSfondo?.()

  const punto = puntoDaClient(
    event.clientX,
    event.clientY,
  )

  trascinamentoSfondo.current = {
  offsetX: punto.x - transform.x,
  offsetY: punto.y - transform.y,
}

  event.currentTarget.setPointerCapture(
    event.pointerId,
  )
}

const trascinaSfondo = (
  event: PointerEvent<SVGImageElement>,
) => {
  if (!trascinamentoSfondo.current) return

  event.preventDefault()
  event.stopPropagation()

  const punto = puntoDaClient(
    event.clientX,
    event.clientY,
  )

  onSpostaSfondo?.(
    punto.x -
      trascinamentoSfondo.current.offsetX,
    punto.y -
      trascinamentoSfondo.current.offsetY,
  )
}

const annullaLineaInCorso = () => {
  const attivo = segnoAttivo.current

  if (
    !attivo ||
    attivo.strumento !== 'linea'
  ) {
    return
  }

 onChange(
  segni.filter(
    (segno) => segno.id !== attivo.id,
  ),
)

segnoAttivo.current = null

interactionMode.current = {
  type: 'idle',
}

setTrackingPerpendicolare(null)
}

useEffect(() => {
  const onKeyDown = (event: KeyboardEvent) => {
  if (
    (event.key === "Delete" ||
      event.key === "Backspace") &&
    quotaSelezionataId
  ) {
    event.preventDefault()

    onDeleteDimension?.(
      quotaSelezionataId,
    )

    setQuotaSelezionataId(null)
    setQuotaInTrascinamento(null)
    setGripQuotaAttivo(null)

    return
  }

  if (event.key !== "Escape") {
  return
}

annullaLineaInCorso()

if (areaAttiva) {
  areaStateRef.current =
    createInitialAreaState()

  sincronizzaAreaTemporanea()

  onFineArea?.()

  return
}

puntoInizioMisuraRef.current = null
puntoFineMisuraRef.current = null
setMisuraTemporanea(null)
}

window.addEventListener(
  'keydown',
  onKeyDown,
)
  return () => {
    window.removeEventListener(
      'keydown',
      onKeyDown,
    )
  }
}, [
  segni,
  quotaSelezionataId,
  onDeleteDimension,
  areaAttiva,
  onFineArea,
])
const terminaTrascinamentoSfondo = (
  event: PointerEvent<SVGImageElement>,
) => {
  event.preventDefault()
  event.stopPropagation()

  trascinamentoSfondo.current = null
}

const iniziaRidimensionamentoSfondo = (
  event: PointerEvent<SVGCircleElement>,
  handle: ResizeHandle,
) => {

  event.preventDefault()
  event.stopPropagation()

  if (transform.locked) return

  onSelezionaSfondo?.()

  interactionMode.current = {
    type: 'resizing-background',
 handle,
    puntoIniziale: puntoDaClient(
      event.clientX,
      event.clientY,
    ),
    transformIniziale: { ...transform },
  }

  svgRef.current?.setPointerCapture(
    event.pointerId,
  )
}

const iniziaRidimensionamentoOggetto = (
  event: PointerEvent<SVGCircleElement>,
  oggetto: OggettoGraficoQuaderno,
  handle: ResizeHandle,
) => {
  event.preventDefault()
  event.stopPropagation()

 const statoLayerOggetto = getLayerState(
  oggetto.layerId,
  "images",
)

if (
  statoLayerOggetto.locked ||
  oggetto.transform.locked
) {
  return
}

onInizioTrasformazioneOggetto?.()
  onSelezionaOggettoGrafico?.(
    oggetto.id,
  )

  interactionMode.current = {
    type: 'resizing-object',
    objectId: oggetto.id,
    handle,
    puntoIniziale: puntoDaClient(
      event.clientX,
      event.clientY,
    ),
    transformIniziale: {
      ...oggetto.transform,
    },
  }

  svgRef.current?.setPointerCapture(
    event.pointerId,
  )
}

 const inizia = (
  event: PointerEvent<SVGSVGElement>,
) => {
  event.preventDefault()

if (areaAttiva) {
  disegna(event)
  return
}

if (
  !strumento &&
  !trimAttivo &&
  !metroAttivo &&
  !calibrazioneScalaAttiva &&
  !areaAttiva
) {

  if (event.button !== 0) {
    return
  }

  const puntoInizio = puntoDaClient(
    event.clientX,
    event.clientY,
  )

  selezioneMultiplaAttivaRef.current = true
  puntoInizioSelezioneRef.current = puntoInizio

  onDeselezionaSfondo?.()
  onDeselezionaOggettoGrafico?.()
  onSelezionaCadEntity?.(null)
  onCambiaSelezioneCad?.([])

  onCambiaRettangoloSelezione?.({
    startX: puntoInizio.x,
    startY: puntoInizio.y,
    endX: puntoInizio.x,
    endY: puntoInizio.y,
  })

  event.currentTarget.setPointerCapture(
    event.pointerId,
  )

  return
}
if (
  disegniBloccati &&
  strumento &&
  !isStrumentoTecnico(strumento)
) {
  return;
}
if (
  pinBloccati &&
  strumento &&
  isStrumentoTecnico(strumento)
) {
  return;
}

  const elementoTarget =
    event.target as SVGElement

  const interazioneSfondo =
    elementoTarget.closest(
      '[data-background-interaction="true"]',
    )

  if (!interazioneSfondo) {
    onDeselezionaSfondo?.()
  }

  event.currentTarget.setPointerCapture(
    event.pointerId,
  )

  const puntoCursore = puntoDaEvento(event)





if (calibrazioneScalaAttiva) {
  if (!puntoInizioCalibrazioneRef.current) {
    puntoInizioCalibrazioneRef.current =
      puntoCursore
    return
  }

  const puntoFineCalibrazione =
    puntoCursore

  const distanzaPixel =
    calculatePixelDistance(
      puntoInizioCalibrazioneRef.current,
      puntoFineCalibrazione,
    )

  const distanzaReale = window.prompt(
    `Distanza rilevata: ${Math.round(
      distanzaPixel,
    )} px\n\nInserisci la distanza reale (metri):`,
  )

  const distanzaRealeNumero = Number(
    distanzaReale?.replace(',', '.'),
  )

  if (
    distanzaReale &&
    Number.isFinite(distanzaRealeNumero) &&
    distanzaRealeNumero > 0
  ) {
    const nuovaCalibrazione =
      createScaleCalibration(
        puntoInizioCalibrazioneRef.current,
        puntoFineCalibrazione,
        distanzaRealeNumero,
        'm',
      )

    onScaleCalibrationChange?.(
      nuovaCalibrazione,
    )

    onFineCalibrazioneScala?.()
  }

  puntoInizioCalibrazioneRef.current = null
  return
}

if (metroAttivo) {
  const puntoMisura =
    calcolaSnapPoint(puntoCursore) ??
    puntoCursore

  // PRIMO CLIC:
  // memorizza il punto iniziale
  if (!puntoInizioMisuraRef.current) {
    puntoInizioMisuraRef.current =
      puntoMisura

    puntoFineMisuraRef.current = null
    setMisuraTemporanea(null)
    return
  }

  if (!scaleCalibration) {
    window.alert(
      'Prima calibra la scala della planimetria.',
    )

    puntoInizioMisuraRef.current = null
    puntoFineMisuraRef.current = null
    setMisuraTemporanea(null)
    return
  }

  // SECONDO CLIC:
  // memorizza il punto finale,
  // ma non crea ancora la quota definitiva
  if (!puntoFineMisuraRef.current) {
    const distanzaPixel =
      calculatePixelDistance(
        puntoInizioMisuraRef.current,
        puntoMisura,
      )

    const metri =
      distanzaPixel *
      (scaleCalibration.realDistance /
        scaleCalibration.pixelDistance)

    puntoFineMisuraRef.current =
      puntoMisura

    setMisuraTemporanea({
      start: puntoInizioMisuraRef.current,
      end: puntoMisura,
      metri,
      offset: 20,
      confermata: false,
    })

    return
  }

  // TERZO CLIC:
  // conferma la posizione e crea la quota definitiva
  if (!misuraTemporanea) {
    return
  }

  const nuovaQuota = createCadDimension({
    start: misuraTemporanea.start,
    end: misuraTemporanea.end,
    offset: misuraTemporanea.offset,
    layerId: layerAttivoId,
    stroke: {
      color: '#2563eb',
      width: 2,
      dashArray: [6, 4],
    },
    metadata: {
      title: `${misuraTemporanea.metri.toFixed(2)} m`,
    },
  })

  onCreateDimension?.(nuovaQuota)

  puntoInizioMisuraRef.current = null
  puntoFineMisuraRef.current = null
  setMisuraTemporanea(null)
  return
}
const puntoSnap =
  calcolaSnapPoint(puntoCursore)


let punto =
(
  strumento === 'linea' ||
  strumento === 'perpendicolare' ||
  (
    strumento &&
    isStrumentoTecnico(strumento)
  )
) &&
puntoSnap


    ? {
        x: puntoSnap.x,
        y: puntoSnap.y,
      }
    : puntoCursore
if (gridSnapAttivo) {
  punto = applyGridSnap(
    punto,
    gridSize,
  )
}

if (strumento === 'perpendicolare') {
  const lineaAttiva = segnoAttivo.current

  // SECONDO CLICK:
  // conferma la linea vincolata a 90°
  if (
    lineaAttiva &&
    lineaAttiva.strumento === 'linea' &&
    lineaRiferimentoPerpendicolareId
  ) {
    const lineaRiferimento = segni.find(
      (segno) =>
        segno.id ===
          lineaRiferimentoPerpendicolareId &&
        segno.strumento === 'linea' &&
        segno.punti.length >= 2,
    )

    if (!lineaRiferimento) {
      return
    }

    const direzione =
      perpendicularDirection(
        lineaRiferimento.punti[0],
        lineaRiferimento.punti[
          lineaRiferimento.punti.length - 1
        ],
      )

    if (!direzione) {
      return
    }

    const puntoInizio =
      lineaAttiva.punti[0]

    const deltaX =
      punto.x - puntoInizio.x

    const deltaY =
      punto.y - puntoInizio.y

    const distanza =
      deltaX * direzione.x +
      deltaY * direzione.y

    const puntoFine = {
      x:
        puntoInizio.x +
        direzione.x * distanza,
      y:
        puntoInizio.y +
        direzione.y * distanza,
    }

    const lineaConfermata: SegnoNota = {
      ...lineaAttiva,
      punti: [
        puntoInizio,
        puntoFine,
      ],
    }

    onChange(
      segni.map((segno) =>
        segno.id === lineaAttiva.id
          ? lineaConfermata
          : segno,
      ),
    )

for (const entity of cadEntities) {
  if (entity.type !== 'area') {
    continue
  }

  const splitResult =
    splitCadAreaEntityByLine(
      entity,
      lineaConfermata.punti[0],
      lineaConfermata.punti[
        lineaConfermata.punti.length - 1
      ],
      scaleCalibration,
    )



console.log("AREA SPLIT RESULT", {
  entityId: entity.id,
  result: splitResult,
})

   if (!splitResult) {
    continue
  }

  onDeleteCadEntity?.(
    entity.id,
  )

  onCreateCadEntity?.(
    splitResult.first,
  )

  onCreateCadEntity?.(
    splitResult.second,
  )
}

segnoAttivo.current = null

    interactionMode.current = {
      type: 'idle',
    }

    setLineaRiferimentoPerpendicolareId(
      null,
    )
setTrackingPerpendicolare(null)

    return
  }

  // PRIMO CLICK:
  // deve partire da uno SNAP appartenente a una linea
  if (!puntoSnap) {
    return
  }

  const idsRiferimento = [
    puntoSnap.entityId,
    ...(puntoSnap.relatedEntityIds ?? []),
  ].filter(
    (id): id is string => Boolean(id),
  )

  const lineaRiferimento = segni.find(
    (segno) =>
      idsRiferimento.includes(segno.id) &&
      segno.strumento === 'linea' &&
      segno.punti.length >= 2,
  )

  if (!lineaRiferimento) {
    return
  }

  const puntoInizio = {
    x: puntoSnap.x,
    y: puntoSnap.y,
  }

  const nuovaLinea: SegnoNota = {
    id: crypto.randomUUID(),
    layerId: layerAttivoId,
    strumento: 'linea',
    colore,
    spessore,
    punti: [
      puntoInizio,
      puntoInizio,
    ],
  }

  setLineaRiferimentoPerpendicolareId(
    lineaRiferimento.id,
  )

  segnoAttivo.current = nuovaLinea

  interactionMode.current = {
    type: 'drawing',
  }

  onChange([
    ...segni,
    nuovaLinea,
  ])

  return
}
  
if (strumento === 'linea') {
  console.log("LINEA INIZIA CLICK", {
    haLineaAttiva: Boolean(segnoAttivo.current),
    interactionMode: interactionMode.current,
  })

  const lineaAttiva = segnoAttivo.current

  if (
    lineaAttiva &&
    lineaAttiva.strumento === 'linea'
  ) {

if (
  polarTrackingAttivo &&
  lineaAttiva.punti[0]
) {
  punto = applyPolar(
    lineaAttiva.punti[0],
    punto,
    polarIncrement,
    polarTolerance,
  )
}

if (
  orthoAttivo &&
  lineaAttiva.punti[0]
) {
  punto = applyOrtho(
    lineaAttiva.punti[0],
    punto,
  )
}
    const lineaConfermata: SegnoNota = {
      ...lineaAttiva,
      punti: [
        lineaAttiva.punti[0],
        punto,
      ],
    }

    onChange(
      segni.map((segno) =>
        segno.id === lineaAttiva.id
          ? lineaConfermata
          : segno,
      ),
    )

console.log("AREA SPLIT LINE", {
  start: lineaConfermata.punti[0],
  end:
    lineaConfermata.punti[
      lineaConfermata.punti.length - 1
    ],
  cadEntitiesCount: cadEntities.length,
})

for (const entity of cadEntities) {
  console.log("AREA SPLIT CHECK", {
    entityId: entity.id,
    entityType: entity.type,
  })

  if (entity.type !== 'area') {
    continue
  }

  const splitResult =
  splitCadAreaEntityByLine(
    entity,
    lineaConfermata.punti[0],
    lineaConfermata.punti[
      lineaConfermata.punti.length - 1
    ],
    scaleCalibration,
    lineaConfermata.id,
  )

  if (splitResult) {
  console.log("AREA SPLIT RIUSCITO", {
    sourceAreaId: entity.id,
    sourceLineId: lineaConfermata.id,
    firstId: splitResult.first.id,
    firstMetadata: splitResult.first.metadata,
    secondId: splitResult.second.id,
    secondMetadata: splitResult.second.metadata,
  })
}

  if (!splitResult) {
    continue
  }

  onReplaceCadEntity?.(
  entity.id,
  [
    splitResult.first,
    splitResult.second,
  ],
)
}

    segnoAttivo.current = null

    interactionMode.current = {
      type: 'idle',
    }
setTrackingPerpendicolare(null)

    return
  }

  const nuovaLinea: SegnoNota = {
    id: crypto.randomUUID(),
    layerId: layerAttivoId,
    strumento: 'linea',
    colore,
    spessore,
    punti: [punto, punto],
  }

  segnoAttivo.current = nuovaLinea

  interactionMode.current = {
    type: 'drawing',
  }

  onChange([...segni, nuovaLinea])
onSelezionaCadEntity?.(nuovaLinea.id)

  return
}

if (strumento === 'testo') {
  const contenuto = window.prompt(
    'Inserisci il testo:',
  )

  if (!contenuto?.trim()) {
    return
  }

  const nuovoTesto: SegnoNota = {
    id: crypto.randomUUID(),
    layerId: layerAttivoId,
    strumento: 'testo',
    colore,
    spessore,
    punti: [punto],
    metadati: {
      testo: contenuto.trim(),
      fontSize: dimensioneTesto,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      rotation: 0,
    },
  }

  onChange([...segni, nuovoTesto])
  onSelezionaCadEntity?.(nuovoTesto.id)

  return
}

if (
  strumento &&
  isStrumentoTecnico(strumento)
) {
const numeroPin =      segni.filter(
        (segno) => segno.strumento === 'pin',
      ).length + 1

    const nuovoPin: SegnoNota = {
  id: crypto.randomUUID(),
  layerId: layerAttivoId,
  strumento,
  colore,
  spessore,
  punti: [punto],
  metadati: {
    numero: numeroPin,
    categoria: 'rilievo',
  },
}

    onChange([...segni, nuovoPin])
    return
  }

 if (
  strumento &&
  isStrumentoGomma(strumento)
) {
  cancellaSegniVicini(punto, true)
  return
}



if (trimAttivo) {
  const graph = buildCadGraph(segni)

  const hit = findNearestSegment(
    graph,
    punto,
    4,
  )

  if (!hit) {
    return
  }

  const result =
    applyTrimToSegni(
      graph,
      segni,
      hit.segment.id,
    )

  if (!result.changed) {
    return
  }

  onChange(
    result.segni,
    true,
  )

  return
}

if (!strumento) {
  return
}
  const nuovoSegno: SegnoNota = {
  id: crypto.randomUUID(),
  layerId: layerAttivoId,
  strumento,
  colore,
  spessore:
    strumento === 'evidenziatore'
      ? Math.max(spessore, 14)
      : spessore,
  punti: [punto, punto],
}

  segnoAttivo.current = nuovoSegno

  interactionMode.current = {
    type: 'drawing',
  }

  onChange([...segni, nuovoSegno])
}

const calcolaSnapPoint = (
  puntoCursore: {
    x: number;
    y: number;
  },
): SnapPoint | null => {

  if (!snapAttivo) {
    return null;
  }

 const segnoAttivoId =
  segnoAttivo.current?.id ?? null

const cadEntitiesById = new Map<
  string,
  CadEntity
>()

const legacyCadEntities: CadEntity[] = [
  ...segni.map(segnoToCadEntity),
  ...oggettiGrafici.map(imageToCadEntity),
  ...cadDimensions,
]

for (const entity of legacyCadEntities) {
  cadEntitiesById.set(
    entity.id,
    entity,
  )
}

for (const entity of cadEntities) {
  cadEntitiesById.set(
    entity.id,
    entity,
  )
}

const tutteLeCadEntities =
  Array.from(
    cadEntitiesById.values(),
  ).filter(
    (entity) =>
      entity.id !== segnoAttivoId,
  )

const spatialIndex =
  buildSpatialIndex(
    tutteLeCadEntities,
  )


const nearbyEntities =
  querySpatialIndex(
    spatialIndex,
    puntoCursore.x,
    puntoCursore.y,
  )

  const screenWidth =
    svgRef.current?.getBoundingClientRect().width ?? 0

  const tolerance = getSnapTolerance(
  larghezza,
  screenWidth,
)

  const entitiesPerSnap =
  tutteLeCadEntities

  const risultatoSnap = resolveSnapPoint({
    entities: entitiesPerSnap,
    cursor: puntoCursore,
    tolerance,
  })
console.log("SNAP", {
  cadEntities:
  tutteLeCadEntities.length,
  nearbyEntities: nearbyEntities.length,

  entitiesPerSnap: entitiesPerSnap.length,
  risultatoSnap,
  tolerance,
})
 
  return risultatoSnap
}

const confermaModificaTesto = () => {
  if (!testoInModificaId) {
    return
  }

  const valorePulito =
    valoreTestoInModifica.trim()

  if (!valorePulito) {
    setTestoInModificaId(null)
    setValoreTestoInModifica("")
    return
  }

  const nuoviSegni = segni.map((segno) => {
    if (segno.id !== testoInModificaId) {
      return segno
    }

    return {
      ...segno,
      metadati: {
        ...segno.metadati,
        testo: valorePulito,
      },
    }
  })

  onChange(nuoviSegni, true)

  setTestoInModificaId(null)
  setValoreTestoInModifica("")
}

const annullaModificaTesto = () => {
  setTestoInModificaId(null)
  setValoreTestoInModifica("")
}

const disegna = (
  event: PointerEvent<SVGSVGElement>,
) => {
  if (!strumento && !areaAttiva) {
    return
  }

  const puntoCursore = puntoDaEvento(event)

const areaSottoCursore =
  cadEntities.find((entity) => {
    if (entity.type !== "area") {
      return false
    }

    return entity.points.some((point) =>
      Math.hypot(
        point.x - puntoCursore.x,
        point.y - puntoCursore.y,
      ) <= 12,
    )
  })

if (
  areaSottoCursore &&
  !areaSplitStartRef.current
) {
  areaSplitStartRef.current = {
    x: puntoCursore.x,
    y: puntoCursore.y,
  }

  setAreaSplitEnd({
    x: puntoCursore.x,
    y: puntoCursore.y,
  })

  setAreaSplitEntityId(
    areaSottoCursore.id,
  )

  event.preventDefault()

  return
}

if (areaAttiva) {
  const snapArea =
    calcolaSnapPoint(puntoCursore)

  const puntoArea =
    snapArea
      ? {
          x: snapArea.x,
          y: snapArea.y,
        }
      : puntoCursore

  event.preventDefault()

  const areaPrecedenteChiusa =
    areaStateRef.current.closed

  const areaResult =
    handleAreaPointerDown(
      areaStateRef.current,
      puntoArea,
      {


      layerId: layerAttivoId,

      stroke: {
        color: colore,
        width: spessore,
      },

      fill: {
        color: colore,
        opacity: 0.12,
      },

      scaleCalibration,
    },
  )

areaStateRef.current =
  areaResult.state

sincronizzaAreaTemporanea()

if (
  !areaPrecedenteChiusa &&
  areaStateRef.current.closed
) {
 if (areaResult.entity) {
  onCreateCadEntity?.(
    areaResult.entity,
  )

  areaStateRef.current =
    createInitialAreaState()

  sincronizzaAreaTemporanea()
}

onFineArea?.()
}

  return
}

if (!strumento) {
  return
}

  const nuovoSnapPoint =
    calcolaSnapPoint(puntoCursore)

  setSnapPoint(nuovoSnapPoint)

  let punto =
    (strumento === "linea" ||
      isStrumentoTecnico(strumento)) &&
    nuovoSnapPoint
      ? {
          x: nuovoSnapPoint.x,
          y: nuovoSnapPoint.y,
        }
      : puntoCursore
  if (isStrumentoGomma(strumento)) {
  return
}

if (
  metroAttivo &&
  puntoInizioMisuraRef.current
) {

  const puntoMouse =
    nuovoSnapPoint
      ? {
          x: nuovoSnapPoint.x,
          y: nuovoSnapPoint.y,
        }
      : puntoCursore

  if (!scaleCalibration) {
    return
  }

  // Prima del secondo clic:
  // anteprima della distanza tra inizio e cursore
  if (!puntoFineMisuraRef.current) {
    const distanzaPixel =
      calculatePixelDistance(
        puntoInizioMisuraRef.current,
        puntoMouse,
      )

    const metri =
      distanzaPixel *
      (scaleCalibration.realDistance /
        scaleCalibration.pixelDistance)

    setMisuraTemporanea({
      start: puntoInizioMisuraRef.current,
      end: puntoMouse,
      metri,
      offset: 20,
      confermata: false,
    })

    return
  }

  // Dopo il secondo clic:
  // il mouse controlla il lato e la distanza della quota
  const start = puntoInizioMisuraRef.current
  const end = puntoFineMisuraRef.current

  const dx = end.x - start.x
  const dy = end.y - start.y
  const lunghezza = Math.hypot(dx, dy)

  if (lunghezza === 0) {
    return
  }

  const centroX = (start.x + end.x) / 2
  const centroY = (start.y + end.y) / 2

  const normaleX = -dy / lunghezza
  const normaleY = dx / lunghezza

  const offset =
    (puntoMouse.x - centroX) * normaleX +
    (puntoMouse.y - centroY) * normaleY

  const distanzaPixel =
    calculatePixelDistance(
      start,
      end,
    )

  const metri =
    distanzaPixel *
    (scaleCalibration.realDistance /
      scaleCalibration.pixelDistance)

  setMisuraTemporanea({
    start,
    end,
    metri,
    offset,
    confermata: false,
  })

   return
}

const segnoCorrente = segnoAttivo.current

if (!segnoCorrente) {
  return
}

event.preventDefault()

if (
  segnoCorrente.strumento === 'penna' ||
  segnoCorrente.strumento === 'evidenziatore'
) {
  const segnoAggiornato: SegnoNota = {
    ...segnoCorrente,
    punti: [
      ...segnoCorrente.punti,
      puntoCursore,
    ],
  }

  segnoAttivo.current = segnoAggiornato

  onChange(
    segni.map((segno) =>
      segno.id === segnoAggiornato.id
        ? segnoAggiornato
        : segno,
    ),
    false,
  )

  return
}

if (segnoCorrente.strumento === 'freccia') {
  const puntoIniziale =
    segnoCorrente.punti[0]

  if (!puntoIniziale) {
    return
  }

  const segnoAggiornato: SegnoNota = {
    ...segnoCorrente,
    punti: [
      puntoIniziale,
      puntoCursore,
    ],
  }

  segnoAttivo.current = segnoAggiornato

  onChange(
    segni.map((segno) =>
      segno.id === segnoAggiornato.id
        ? segnoAggiornato
        : segno,
    ),
    false,
  )
}

}

const gestisciPointerMove = (
  event: PointerEvent<SVGSVGElement>,
) => {
  const puntoCursoreHover =
    puntoDaEvento(event)

 if (
  areaGripAttivo &&
  scaleCalibration
) {
 const areaEntity =
  cadEntities.find(
    (entity) =>
      entity.id ===
      areaGripAttivo.entityId,
  )

if (
  areaEntity?.type === "area"
) {


    event.preventDefault()

    const areaAggiornata =
      updateCadAreaVertex(
        areaEntity,
        areaGripAttivo.vertexIndex,
        puntoCursoreHover,
        scaleCalibration,
      )
console.log("AREA UPDATE", areaAggiornata)

    onUpdateCadEntity?.(
      areaAggiornata,
    )
  }

  return
}

if (areaAttiva) {
  const snapArea =
    calcolaSnapPoint(
      puntoCursoreHover,
    )

  setSnapPoint(snapArea)

  const puntoAreaHover =
    snapArea
      ? {
          x: snapArea.x,
          y: snapArea.y,
        }
      : puntoCursoreHover

  setCursoreArea(
    puntoAreaHover,
  )

  return
}

  if (
    selezioneMultiplaAttivaRef.current &&  puntoInizioSelezioneRef.current
) {
  event.preventDefault()

  const puntoCorrente = puntoDaEvento(event)
  const puntoInizio =
    puntoInizioSelezioneRef.current

  onCambiaRettangoloSelezione?.({
    startX: puntoInizio.x,
    startY: puntoInizio.y,
    endX: puntoCorrente.x,
    endY: puntoCorrente.y,
  })

  return
}

if (trascinamentoSelezioneMultiplaRef.current) {
  event.preventDefault()

  const puntoCorrente = puntoDaEvento(event)

  const {
    puntoIniziale,
    segniIniziali,
  } = trascinamentoSelezioneMultiplaRef.current

  const deltaX =
    puntoCorrente.x - puntoIniziale.x

  const deltaY =
    puntoCorrente.y - puntoIniziale.y

  const idsInTrascinamento = new Set(
    segniIniziali.map((segno) => segno.id),
  )

  const nuoviSegni = segni.map((segno) => {
    if (!idsInTrascinamento.has(segno.id)) {
      return segno
    }

    const segnoIniziale = segniIniziali.find(
      (item) => item.id === segno.id,
    )

    if (!segnoIniziale) {
      return segno
    }

    return {
      ...segno,
      punti: segnoIniziale.punti.map((punto) => ({
        ...punto,
        x: punto.x + deltaX,
        y: punto.y + deltaY,
      })),
    }
  })

  onChange(nuoviSegni, false)

  return
}
  const snapHoverAttivo =
  metroAttivo ||
  strumento === 'linea' ||
  strumento === 'perpendicolare' ||
  (
    strumento &&
    isStrumentoTecnico(strumento)
  )

  if (
    snapHoverAttivo &&
    !quotaInTrascinamento
  ) {
    setSnapPoint(
      calcolaSnapPoint(puntoCursoreHover),
    )
  } else if (
    !snapHoverAttivo &&
    !quotaInTrascinamento
  ) {
    setSnapPoint(null)
  }

  if (
    quotaInTrascinamento &&    gripQuotaAttivo === "center"
  ) {
    event.preventDefault()

    const dimension = cadDimensions.find(
      (item) => item.id === quotaInTrascinamento,
    )

    if (!dimension) {
      return
    }

    const puntoMouse = puntoDaEvento(event)

    const dx = dimension.end.x - dimension.start.x
    const dy = dimension.end.y - dimension.start.y

    const lunghezza = Math.hypot(dx, dy)

    if (lunghezza === 0) {
      return
    }

    const centroX =
      (dimension.start.x + dimension.end.x) / 2

    const centroY =
      (dimension.start.y + dimension.end.y) / 2

    const normaleX = -dy / lunghezza
    const normaleY = dx / lunghezza

    const nuovoOffset =
      (puntoMouse.x - centroX) * normaleX +
      (puntoMouse.y - centroY) * normaleY

    onUpdateDimension?.({
      ...dimension,
      offset: nuovoOffset,
    })

    return
  }

  if (
    quotaInTrascinamento &&
    gripQuotaAttivo === "start"
  ) {
    event.preventDefault()

    const dimension = cadDimensions.find(
      (item) => item.id === quotaInTrascinamento,
    )

    if (!dimension) {
      return
    }

   const puntoMouse = puntoDaEvento(event)

const snap =
  calcolaSnapPoint(puntoMouse)

setSnapPoint(snap)

const punto =
  snap
    ? {
        x: snap.x,
        y: snap.y,
      }
    : puntoMouse

onUpdateDimension?.({
  ...dimension,
  start: punto,
})

    return
  }

  if (
    quotaInTrascinamento &&
    gripQuotaAttivo === "end"
  ) {
    event.preventDefault()

    const dimension = cadDimensions.find(
      (item) => item.id === quotaInTrascinamento,
    )

    if (!dimension) {
      return
    }

    const puntoMouse = puntoDaEvento(event)

const snap =
  calcolaSnapPoint(puntoMouse)

setSnapPoint(snap)

const punto =
  snap
    ? {
        x: snap.x,
        y: snap.y,
      }
    : puntoMouse

onUpdateDimension?.({
  ...dimension,
  end: punto,
})

    return
  }

  const modalita = interactionMode.current


if (modalita.type === 'dragging-text') {
  event.preventDefault()

  const puntoCorrente =
    puntoDaEvento(event)

  const nuoviSegni = segni.map((segno) => {
    if (segno.id !== modalita.textId) {
      return segno
    }

    return {
      ...segno,
      punti: [
        {
          x:
            puntoCorrente.x -
            modalita.offsetX,
          y:
            puntoCorrente.y -
            modalita.offsetY,
        },
      ],
    }
  })

  onChange(nuoviSegni, false)

  return
}

if (modalita.type === 'resizing-text') {
  event.preventDefault()

  const puntoCorrente =
    puntoDaEvento(event)

  const nuovaLarghezza =
    Math.max(
      140,
      modalita.startWidth +
        (
          puntoCorrente.x -
          modalita.startPoint.x
        ),
    )

  const nuovaAltezza =
    Math.max(
      42,
      modalita.startHeight +
        (
          puntoCorrente.y -
          modalita.startPoint.y
        ),
    )

  const nuoviSegni =
    segni.map((segno) => {
      if (
        segno.id !==
        modalita.textId
      ) {
        return segno
      }

      return {
        ...segno,
        metadati: {
          ...segno.metadati,
          textBoxWidth:
            nuovaLarghezza,
          textBoxHeight:
            nuovaAltezza,
        },
      }
    })

  onChange(
    nuoviSegni,
    false,
  )

  return
}


if (modalita.type === 'dragging-object') {
  event.preventDefault()

  const puntoCorrente =
    puntoDaEvento(event)

  const oggetto = oggettiGrafici.find(
    (item) => item.id === modalita.objectId,
  )

  if (!oggetto) {
    return
  }

  onCambiaOggettoGraficoTransform?.(
    modalita.objectId,
    {
      ...oggetto.transform,
      x:
        puntoCorrente.x -
        modalita.offsetX,
      y:
        puntoCorrente.y -
        modalita.offsetY,
    },
  )

  return
}
if (modalita.type === 'resizing-object') {
  event.preventDefault()

  const puntoCorrente =
    puntoDaEvento(event)

  const deltaX =
    puntoCorrente.x -
    modalita.puntoIniziale.x

  const deltaY =
    puntoCorrente.y -
    modalita.puntoIniziale.y

  const nuovoTransform =
    resizeBackground(
      modalita.transformIniziale,
      modalita.handle,
      deltaX,
      deltaY,
    )

  onCambiaOggettoGraficoTransform?.(
    modalita.objectId,
    nuovoTransform,
  )

  return
}

  if (modalita.type === 'resizing-background') {
    event.preventDefault()

    const puntoCorrente = puntoDaEvento(event)

    const deltaX =
      puntoCorrente.x -
      modalita.puntoIniziale.x

    const deltaY =
      puntoCorrente.y -
      modalita.puntoIniziale.y

    const nuovoTransform = resizeBackground(
  modalita.transformIniziale,
  modalita.handle,
  deltaX,
  deltaY,
)

    onCambiaBackgroundTransform?.(
      nuovoTransform,
    )

    return
  }


if (
  modalita.type === 'drawing' &&
  (
    strumento === 'linea' ||
    strumento === 'perpendicolare' ||
    strumento === 'rettangolo' ||
    strumento === 'cerchio'
  )
)

{  const lineaAttiva =
    segnoAttivo.current

  const puntoIniziale =
    lineaAttiva?.punti[0]

  if (
  (
    lineaAttiva?.strumento === 'linea' ||
    lineaAttiva?.strumento === 'rettangolo' ||
    lineaAttiva?.strumento === 'cerchio'
  ) &&
  puntoIniziale
) {
    event.preventDefault()

    const puntoCursore =
      puntoDaEvento(event)

    const snap =
      calcolaSnapPoint(puntoCursore)

    setSnapPoint(snap)

if (
  perpTrackingAttivo &&
  strumento === 'linea' &&
  snap
) {
  const idsRiferimento = [
    snap.entityId,
    ...(snap.relatedEntityIds ?? []),
  ].filter(
    (id): id is string => Boolean(id),
  )

  const lineaRiferimentoTracking =
    segni.find(
      (segno) =>
        idsRiferimento.includes(
          segno.id,
        ) &&
        segno.strumento === 'linea' &&
        segno.punti.length >= 2 &&
        segno.id !== lineaAttiva.id,
    )

  if (lineaRiferimentoTracking) {
    const direzione =
      perpendicularDirection(
        lineaRiferimentoTracking.punti[0],
        lineaRiferimentoTracking.punti[
          lineaRiferimentoTracking.punti.length - 1
        ],
      )

    if (direzione) {
      const deltaX =
        snap.x - puntoIniziale.x

      const deltaY =
        snap.y - puntoIniziale.y

      const distanza =
        deltaX * direzione.x +
        deltaY * direzione.y
const deltaTrackingX =
  puntoIniziale.x - snap.x

const deltaTrackingY =
  puntoIniziale.y - snap.y

const distanzaTracking =
  deltaTrackingX * direzione.x +
  deltaTrackingY * direzione.y

setTrackingPerpendicolare({
  start: {
    x: snap.x,
    y: snap.y,
  },

  end: {
    x:
      snap.x +
      direzione.x *
        distanzaTracking,

    y:
      snap.y +
      direzione.y *
        distanzaTracking,
  },

  entityId:
    lineaRiferimentoTracking.id,
})

    } else {
      setTrackingPerpendicolare(null)
    }


} else {
  setTrackingPerpendicolare(null)
}
}
    let puntoFinale = snap
  ? {
      x: snap.x,
      y: snap.y,
    }
  : puntoCursore

if (
  perpTrackingAttivo &&
  strumento === 'linea' &&
  trackingPerpendicolare
) {

if (!perpTrackingAttivo) {
  setTrackingPerpendicolare(null)
}

  const dx =
    puntoCursore.x -
    trackingPerpendicolare.start.x

  const dy =
    puntoCursore.y -
    trackingPerpendicolare.start.y

  const guidaDx =
    trackingPerpendicolare.end.x -
    trackingPerpendicolare.start.x

  const guidaDy =
    trackingPerpendicolare.end.y -
    trackingPerpendicolare.start.y

  const lunghezzaGuida =
    Math.hypot(
      guidaDx,
      guidaDy,
    )

  if (lunghezzaGuida > 0) {
    const ux =
      guidaDx / lunghezzaGuida

    const uy =
      guidaDy / lunghezzaGuida

    const proiezione =
      dx * ux +
      dy * uy

    const puntoProiettato = {
      x:
        trackingPerpendicolare.start.x +
        ux * proiezione,

      y:
        trackingPerpendicolare.start.y +
        uy * proiezione,
    }

    const distanzaDallaGuida =
      Math.hypot(
        puntoCursore.x -
          puntoProiettato.x,
        puntoCursore.y -
          puntoProiettato.y,
      )

    const screenWidth =
  svgRef.current?.getBoundingClientRect().width ?? 0

const tolleranzaTracking =
  getSnapTolerance(
    larghezza,
    screenWidth,
  )

     if (
  distanzaDallaGuida <=
  tolleranzaTracking
) {
  puntoFinale =
    puntoProiettato

  setSnapPoint({
    x: puntoProiettato.x,
    y: puntoProiettato.y,
    type: 'perpendicular',
    priority: 100,
    entityId:
      trackingPerpendicolare.entityId,
  })
}
  }
}

if (
  strumento === 'perpendicolare' &&
  lineaRiferimentoPerpendicolareId
) {
  const lineaRiferimento = segni.find(
    (segno) =>
      segno.id ===
        lineaRiferimentoPerpendicolareId &&
      segno.strumento === 'linea' &&
      segno.punti.length >= 2,
  )

  if (lineaRiferimento) {
    const direzione =
      perpendicularDirection(
        lineaRiferimento.punti[0],
        lineaRiferimento.punti[
          lineaRiferimento.punti.length - 1
        ],
      )

    if (direzione) {
      const deltaX =
        puntoFinale.x - puntoIniziale.x

      const deltaY =
        puntoFinale.y - puntoIniziale.y

      const distanza =
        deltaX * direzione.x +
        deltaY * direzione.y

      puntoFinale = {
        x:
          puntoIniziale.x +
          direzione.x * distanza,
        y:
          puntoIniziale.y +
          direzione.y * distanza,
      }
    }
  }
}

    const lineaAggiornata: SegnoNota = {
      ...lineaAttiva,
      punti: [
        puntoIniziale,
        puntoFinale,
      ],
    }

    segnoAttivo.current =
      lineaAggiornata

    onChange(
      segni.map((segno) =>
        segno.id === lineaAggiornata.id
          ? lineaAggiornata
          : segno,
      ),
    )

    return
  }


   disegna(event)
}

}

const termina = (
  event?: PointerEvent<SVGSVGElement>,
) => {

if (areaGripAttivo) {
  setAreaGripAttivo(null)
  setSnapPoint(null)
  return
}
if (
  selezioneMultiplaAttivaRef.current &&
  puntoInizioSelezioneRef.current
) {
  const puntoInizio =
    puntoInizioSelezioneRef.current

  const puntoFine = event
    ? puntoDaEvento(event)
    : puntoInizio

  const minX = Math.min(
    puntoInizio.x,
    puntoFine.x,
  )
  const maxX = Math.max(
    puntoInizio.x,
    puntoFine.x,
  )
  const minY = Math.min(
    puntoInizio.y,
    puntoFine.y,
  )
  const maxY = Math.max(
    puntoInizio.y,
    puntoFine.y,
  )

  const idsSelezionati = segni
    .filter((segno) => {
      if (
        segno.strumento !== 'linea' ||
        segno.punti.length < 2
      ) {
        return false
      }

      const primo = segno.punti[0]
      const ultimo =
        segno.punti[segno.punti.length - 1]

      const lineaMinX = Math.min(
        primo.x,
        ultimo.x,
      )
      const lineaMaxX = Math.max(
        primo.x,
        ultimo.x,
      )
      const lineaMinY = Math.min(
        primo.y,
        ultimo.y,
      )
      const lineaMaxY = Math.max(
        primo.y,
        ultimo.y,
      )

      return (
        lineaMaxX >= minX &&
        lineaMinX <= maxX &&
        lineaMaxY >= minY &&
        lineaMinY <= maxY
      )
    })
    .map((segno) => segno.id)

  const idsQuoteSelezionate = cadDimensions
  .filter((dimension) => {
    const quotaMinX = Math.min(
      dimension.start.x,
      dimension.end.x,
    )

    const quotaMaxX = Math.max(
      dimension.start.x,
      dimension.end.x,
    )

    const quotaMinY = Math.min(
      dimension.start.y,
      dimension.end.y,
    )

    const quotaMaxY = Math.max(
      dimension.start.y,
      dimension.end.y,
    )

    return (
      quotaMaxX >= minX &&
      quotaMinX <= maxX &&
      quotaMaxY >= minY &&
      quotaMinY <= maxY
    )
  })
  .map((dimension) => dimension.id)

const tuttiGliIdsSelezionati = [
  ...idsSelezionati,
  ...idsQuoteSelezionate,
]

onCambiaSelezioneCad?.(
  tuttiGliIdsSelezionati,
)

onSelezionaCadEntity?.(
  tuttiGliIdsSelezionati.length === 1 &&
  idsSelezionati.length === 1
    ? idsSelezionati[0]
    : null,
)

  selezioneMultiplaAttivaRef.current = false
  puntoInizioSelezioneRef.current = null
  onCambiaRettangoloSelezione?.(null)

  if (
    event &&
    svgRef.current?.hasPointerCapture(
      event.pointerId,
    )
  ) {
    svgRef.current.releasePointerCapture(
      event.pointerId,
    )
  }

  return
}

if (trascinamentoSelezioneMultiplaRef.current) {
  trascinamentoSelezioneMultiplaRef.current = null

  if (
    event &&
    svgRef.current?.hasPointerCapture(
      event.pointerId,
    )
  ) {
    svgRef.current.releasePointerCapture(
      event.pointerId,
    )
  }


  return
}

  const lineaInCorso =
    strumento === 'linea' &&
    segnoAttivo.current?.strumento === 'linea'

  if (lineaInCorso) {
    if (
      event &&
      svgRef.current?.hasPointerCapture(
        event.pointerId,
      )
    ) {
      svgRef.current.releasePointerCapture(
        event.pointerId,
      )
    }

    return
  }

  segnoAttivo.current = null

 const modalita =
  interactionMode.current.type

if (modalita === 'resizing-text') {
  interactionMode.current = {
    type: 'idle',
  }

  if (
    event &&
    svgRef.current?.hasPointerCapture(
      event.pointerId,
    )
  ) {
    svgRef.current.releasePointerCapture(
      event.pointerId,
    )
  }

  onChange(segni, true)

  return
}

if (modalita === 'dragging-text') {
    interactionMode.current = {
      type: 'idle',
    }

    if (
      event &&
      svgRef.current?.hasPointerCapture(
        event.pointerId,
      )
    ) {
      svgRef.current.releasePointerCapture(
        event.pointerId,
      )
    }
onFineTrasformazioneOggetto?.()
    return
  }

  if (modalita === 'resizing-object') {
    interactionMode.current = {
      type: 'idle',
    }

    if (
      event &&
      svgRef.current?.hasPointerCapture(
        event.pointerId,
      )
    ) {
      svgRef.current.releasePointerCapture(
        event.pointerId,
      )
    }
onFineTrasformazioneOggetto?.()
    return
  }

  if (modalita === 'resizing-background') {
    interactionMode.current = {
      type: 'idle',
    }

    if (
      event &&
      svgRef.current?.hasPointerCapture(
        event.pointerId,
      )
    ) {
      svgRef.current.releasePointerCapture(
        event.pointerId,
      )
    }
   }

if (
  event &&
  svgRef.current?.hasPointerCapture(
    event.pointerId,
  )
) {
  svgRef.current.releasePointerCapture(
    event.pointerId,
  )
}
  setQuotaInTrascinamento(null)
setGripQuotaAttivo(null)
setSnapPoint(null)
}

const layersOrdinati = [...(layers ?? [])].sort(
  (a, b) => (a.order ?? 0) - (b.order ?? 0),
)

const posizioneLayer = new Map(
  layersOrdinati.map((layer, index) => [
    layer.id,
    index,
  ]),
)

const oggettiGraficiOrdinati = [
  ...oggettiGrafici,
].sort((a, b) => {
  const posizioneA =
    posizioneLayer.get(a.layerId ?? "images") ??
    Number.MAX_SAFE_INTEGER

  const posizioneB =
    posizioneLayer.get(b.layerId ?? "images") ??
    Number.MAX_SAFE_INTEGER

  return posizioneA - posizioneB
})

const segniOrdinati = [...segni].sort((a, b) => {
  const layerIdA =
    a.layerId ??
    (a.strumento === "pin" ? "pins" : "drawing")

  const layerIdB =
    b.layerId ??
    (b.strumento === "pin" ? "pins" : "drawing")

  const posizioneA =
    posizioneLayer.get(layerIdA) ??
    Number.MAX_SAFE_INTEGER

  const posizioneB =
    posizioneLayer.get(layerIdB) ??
    Number.MAX_SAFE_INTEGER

  return posizioneA - posizioneB
})

return (
  <svg
  ref={(elemento) => {
    svgRef.current = elemento

    if (svgRefEsterno) {
      svgRefEsterno.current = elemento
    }
  }}
      viewBox={`0 0 ${larghezza} ${altezza}`}
      onPointerDown={inizia}
      onPointerMove={gestisciPointerMove}
      onPointerUp={termina}
      onPointerCancel={termina}
onPointerLeave={() => setSnapPoint(null)}

      style={{
        width: '100%',
height: '100%',
display: 'block',
        border: '1px solid #cbd5e1',
        borderRadius: 12,
        backgroundColor: '#fff',
        backgroundImage:
          'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        touchAction: 'none',
       cursor:
  strumento || areaAttiva
    ? 'crosshair'
    : 'default',
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

<rect
 
  x={24}
  y={24}
  width={larghezza - 48}
  height={altezza - 48}
  fill="none"
  stroke="#334155"
  strokeWidth={2}
  pointerEvents="none"
/>
{sfondoVisibile &&
  sfondo &&
  oggettiGrafici.length === 0 && (
  <g>
  <image
  data-background-interaction="true"
  href={sfondo}
  x={rettangoloImmagine.x}
  y={rettangoloImmagine.y}
  width={rettangoloImmagine.width}
  height={rettangoloImmagine.height}
  preserveAspectRatio="none"
  onPointerDown={
  strumento === null &&
  !sfondoBloccato
    ? iniziaTrascinamentoSfondo
    : undefined
}
  onPointerMove={
    strumento === null
      ? trascinaSfondo
      : undefined
  }
  onPointerUp={
    strumento === null
      ? terminaTrascinamentoSfondo
      : undefined
  }
  onPointerCancel={
    strumento === null
      ? terminaTrascinamentoSfondo
      : undefined
  }
  pointerEvents={
  strumento === null &&
  !sfondoBloccato
    ? "auto"
    : "none"
}
  style={{
    cursor:
      strumento === null
        ? sfondoSelezionato
          ? 'move'
          : 'grab'
        : strumento === false
          ? 'default'
          : 'crosshair',
  }}
/>

    

{sfondoSelezionato &&
  !sfondoBloccato && (
  <g>
    <rect
      data-background-interaction="true"
      x={rettangoloImmagine.x}
      y={rettangoloImmagine.y}
      width={rettangoloImmagine.width}
      height={rettangoloImmagine.height}
      fill="none"
      stroke="#2563eb"
      strokeWidth={3}
      strokeDasharray="10 6"
      vectorEffect="non-scaling-stroke"
    />

    <circle
  data-background-interaction="true"
  cx={rettangoloImmagine.x}
  cy={rettangoloImmagine.y}
  r={10}
  fill="#ffffff"
  stroke="#2563eb"
  strokeWidth={3}
  vectorEffect="non-scaling-stroke"
  onPointerDown={(event) =>
    iniziaRidimensionamentoSfondo(
      event,
      'top-left',
    )
  }
  style={{
    cursor: transform.locked
      ? 'not-allowed'
      : 'nwse-resize',
  }}
/>

<circle
  data-background-interaction="true"
  cx={
    rettangoloImmagine.x +
    rettangoloImmagine.width
  }
  cy={rettangoloImmagine.y}
  r={10}
  fill="#ffffff"
  stroke="#2563eb"
  strokeWidth={3}
  vectorEffect="non-scaling-stroke"
  onPointerDown={(event) =>
    iniziaRidimensionamentoSfondo(
      event,
      'top-right',
    )
  }
  style={{
    cursor: transform.locked
      ? 'not-allowed'
      : 'nesw-resize',
  }}
/>

<circle
  data-background-interaction="true"
  cx={
    rettangoloImmagine.x +
    rettangoloImmagine.width / 2
  }
  cy={rettangoloImmagine.y}
  r={10}
  fill="#ffffff"
  stroke="#2563eb"
  strokeWidth={3}
  vectorEffect="non-scaling-stroke"
  onPointerDown={(event) =>
    iniziaRidimensionamentoSfondo(
      event,
      'top',
    )
  }
  style={{
    cursor: transform.locked
      ? 'not-allowed'
      : 'ns-resize',
  }}
/>

<circle
  data-background-interaction="true"
  cx={rettangoloImmagine.x}
  cy={
    rettangoloImmagine.y +
    rettangoloImmagine.height / 2
  }
  r={10}
  fill="#ffffff"
  stroke="#2563eb"
  strokeWidth={3}
  vectorEffect="non-scaling-stroke"
  onPointerDown={(event) =>
    iniziaRidimensionamentoSfondo(
      event,
      'left',
    )
  }
  style={{
    cursor: transform.locked
      ? 'not-allowed'
      : 'ew-resize',
  }}
/>

<circle
  data-background-interaction="true"
  cx={
    rettangoloImmagine.x +
    rettangoloImmagine.width
  }
  cy={
    rettangoloImmagine.y +
    rettangoloImmagine.height / 2
  }
  r={10}
  fill="#ffffff"
  stroke="#2563eb"
  strokeWidth={3}
  vectorEffect="non-scaling-stroke"
  onPointerDown={(event) =>
    iniziaRidimensionamentoSfondo(
      event,
      'right',
    )
  }
  style={{
    cursor: transform.locked
      ? 'not-allowed'
      : 'ew-resize',
  }}
/>

<circle
  data-background-interaction="true"
  cx={
    rettangoloImmagine.x +
    rettangoloImmagine.width / 2
  }
  cy={
    rettangoloImmagine.y +
    rettangoloImmagine.height
  }
  r={10}
  fill="#ffffff"
  stroke="#2563eb"
  strokeWidth={3}
  vectorEffect="non-scaling-stroke"
  onPointerDown={(event) =>
    iniziaRidimensionamentoSfondo(
      event,
      'bottom',
    )
  }
  style={{
    cursor: transform.locked
      ? 'not-allowed'
      : 'ns-resize',
  }}
/>

<circle
  data-background-interaction="true"
  cx={rettangoloImmagine.x}
  cy={
    rettangoloImmagine.y +
    rettangoloImmagine.height
  }
  r={10}
  fill="#ffffff"
  stroke="#2563eb"
  strokeWidth={3}
  vectorEffect="non-scaling-stroke"
  onPointerDown={(event) =>
    iniziaRidimensionamentoSfondo(
      event,
      'bottom-left',
    )
  }
  style={{
    cursor: transform.locked
      ? 'not-allowed'
      : 'nesw-resize',
  }}
/>

<circle
  data-background-interaction="true"
  cx={
    rettangoloImmagine.x +
    rettangoloImmagine.width
  }
  cy={
    rettangoloImmagine.y +
    rettangoloImmagine.height
  }
  r={10}
  fill="#ffffff"
  stroke="#2563eb"
  strokeWidth={3}
  vectorEffect="non-scaling-stroke"
  onPointerDown={(event) =>
    iniziaRidimensionamentoSfondo(
      event,
      'bottom-right',
    )
  }
  style={{
    cursor: transform.locked
      ? 'not-allowed'
      : 'nwse-resize',
  }}
/>
  </g>
)}
       </g>
)}



{layersOrdinati.map((layer) => (
  <g
    key={layer.id}
    data-layer-id={layer.id}
  >

{oggettiGraficiOrdinati
  .filter(
    (oggetto) =>
      (oggetto.layerId ?? "images") === layer.id,
  )
  .map((oggetto) => {
  if (oggetto.tipo !== 'immagine') {
    return null
  }
const statoLayerImmagine = getLayerState(
  oggetto.layerId,
  "images",
)

if (!statoLayerImmagine.visible) {
  return null
}

  const selezionato =
    oggettoGraficoSelezionatoId === oggetto.id

  return (
    <OggettoImmagine
      key={oggetto.id}
      oggetto={oggetto}
modalitaSelezione={modalitaSelezione}
      selezionato={
  selezionato &&
  !statoLayerImmagine.locked
}
      strumento={
  statoLayerImmagine.locked
    ? false
    : strumento
}

      onPointerDownImmagine={(event) => {
  if (!modalitaSelezione) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  if (statoLayerImmagine.locked) return

  onInizioTrasformazioneOggetto?.()

        onSelezionaOggettoGrafico?.(
          oggetto.id,
        )

        onDeselezionaSfondo?.()

        const punto = puntoDaClient(
          event.clientX,
          event.clientY,
        )

        interactionMode.current = {
          type: 'dragging-object',
          objectId: oggetto.id,
          offsetX:
            punto.x - oggetto.transform.x,
          offsetY:
            punto.y - oggetto.transform.y,
        }

        svgRef.current?.setPointerCapture(
          event.pointerId,
        )
      }}
      onResize={(event, handle) =>
        iniziaRidimensionamentoOggetto(
          event,
          oggetto,
          handle,
        )
      }
    />
  )
})}

      {segniOrdinati
  .filter((segno) => {
    const layerIdEffettivo =
      segno.layerId ??
      (segno.strumento === "pin"
        ? "pins"
        : "drawing")

    return layerIdEffettivo === layer.id
  })
  .map((segno) => {
        const primo = segno.punti[0]
        const ultimo = segno.punti[segno.punti.length - 1]
        if (!primo || !ultimo) return null

const layerIdEffettivo =
  segno.layerId ??
  (segno.strumento === 'pin' ? 'pins' : 'drawing')

const layerSegno = layers?.find(
  (layer) => layer.id === layerIdEffettivo,
)

const segnoVisibile = layerSegno?.visible ?? true

if (!segnoVisibile) {
  return null
}

if (segno.strumento === 'testo') {
  const punto = segno.punti[0]

  if (!punto) {
    return null
  }

  const contenuto =
    segno.metadati?.testo ?? ''

  const fontSize =
    segno.metadati?.fontSize ??
    segno.spessore

  const testoSelezionato =
    cadEntitySelezionateIds.includes(
      segno.id,
    )

  const testoBloccato =
    layerSegno?.locked ?? false

  const larghezzaStimata = Math.max(
    fontSize,
    contenuto.length * fontSize * 0.62,
  )

  const altezzaStimata =
    fontSize * 1.25

  return (
    <g
      key={segno.id}
     pointerEvents={
  modalitaSelezione &&
  strumento === null &&
  !testoBloccato
    ? 'auto'
    : 'none'
}
      onPointerDown={(event) => {
       if (
  !modalitaSelezione ||
  strumento !== null ||
  testoBloccato
) {
  return
}

        event.preventDefault()
        event.stopPropagation()

const adesso = Date.now()

const doppioClick =
  ultimoClickTestoRef.current?.id === segno.id &&
  adesso - ultimoClickTestoRef.current.timestamp < 400

ultimoClickTestoRef.current = {
  id: segno.id,
  timestamp: adesso,
}

if (doppioClick) {
  interactionMode.current = {
    type: "idle",
  }

  ultimoClickTestoRef.current = null

  setTestoInModificaId(segno.id)

  setValoreTestoInModifica(
    segno.metadati?.testo ?? "",
  )

  return
}        if (event.shiftKey) {
  const nuovaSelezione =
    cadEntitySelezionateIds.includes(segno.id)
      ? cadEntitySelezionateIds.filter(
          (id) => id !== segno.id,
        )
      : [
          ...cadEntitySelezionateIds,
          segno.id,
        ]

  onCambiaSelezioneCad?.(nuovaSelezione)

  onSelezionaCadEntity?.(
    nuovaSelezione.length === 1
      ? nuovaSelezione[0]
      : null,
  )

  return
}

onCambiaSelezioneCad?.([segno.id])
onSelezionaCadEntity?.(segno.id)

const puntoCorrente = puntoDaClient(
  event.clientX,
  event.clientY,
)

interactionMode.current = {
  type: "dragging-text",
  textId: segno.id,
  offsetX: puntoCorrente.x - punto.x,
  offsetY: puntoCorrente.y - punto.y,
}

svgRef.current?.setPointerCapture(
  event.pointerId,
)
      }}
onDoubleClick={(event) => {
  if (
    !modalitaSelezione ||
    testoBloccato
  ) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  setTestoInModificaId(segno.id)

  setValoreTestoInModifica(
    segno.metadati?.testo ?? "",
  )
}}
      style={{
        cursor:
          strumento === null &&
          !testoBloccato
            ? 'pointer'
            : 'default',
      }}
    >
<rect
  x={punto.x - 4}
  y={punto.y - altezzaStimata}
  width={larghezzaStimata + 8}
  height={altezzaStimata + 8}
  fill="transparent"
  pointerEvents="all"
  transform={`rotate(${
    segno.metadati?.rotation ?? 0
  } ${punto.x} ${punto.y})`}
/>
      {testoSelezionato && (
        <rect
          x={punto.x - 4}
          y={punto.y - 4}
          width={larghezzaStimata + 8}
          height={altezzaStimata + 8}
          fill="rgba(37, 99, 235, 0.08)"
          stroke="#2563eb"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          pointerEvents="none"
          transform={`rotate(${
            segno.metadati?.rotation ?? 0
          } ${punto.x} ${punto.y})`}
        />
      )}

     {testoInModificaId === segno.id ? (
<>
  <foreignObject

    x={punto.x}
    y={punto.y}
    pointerEvents="all"
    width={
  segno.metadati?.textBoxWidth ??
  Math.max(
    320,
    larghezzaStimata + 80,
  )
}
height={
  segno.metadati?.textBoxHeight ??
  Math.max(
    140,
    altezzaStimata + 60,
  )
}
    transform={`rotate(${
      segno.metadati?.rotation ?? 0
    } ${punto.x} ${punto.y})`}
  >
    <textarea
     ref={inputModificaTestoRef}
      autoFocus
      value={valoreTestoInModifica}
      onChange={(event) =>
        setValoreTestoInModifica(
          event.target.value,
        )
      }
      onKeyDown={(event) => {
        if (
          event.key === "Enter" &&
          event.ctrlKey
        ) {
          event.preventDefault()
          confermaModificaTesto()
        }

        if (event.key === "Escape") {
          event.preventDefault()
          annullaModificaTesto()
        }
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
      }}
      onDoubleClick={(event) => {
        event.stopPropagation()
      }}
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        border: "1px solid #2563eb",
        borderRadius: 4,
        padding: "4px 6px",
        fontSize,
        fontFamily:
          segno.metadati?.fontFamily ??
          "Arial",
        fontWeight:
          segno.metadati?.fontWeight ??
          "normal",
        fontStyle:
          segno.metadati?.fontStyle ??
          "normal",
        color: segno.colore,
        background: "#ffffff",
        outline: "none",
        resize: "none",
        whiteSpace: "pre-wrap",
overflow: "auto",
      }}
    />
  </foreignObject>
<rect
  x={
    punto.x +
    (
      segno.metadati?.textBoxWidth ??
      Math.max(
        320,
        larghezzaStimata + 80,
      )
    ) -
    10
  }
  y={
    punto.y +
    (
      segno.metadati?.textBoxHeight ??
      Math.max(
        140,
        altezzaStimata + 60,
      )
    ) -
    10
  }
  width={10}
  height={10}
  fill="#2563eb"
  stroke="#ffffff"
  strokeWidth={1}
data-text-resize-handle="true"
  cursor="nwse-resize"
  pointerEvents="all"
  onPointerDown={(event) => {
    event.preventDefault()
    event.stopPropagation()

    const puntoIniziale =
  puntoDaClient(
    event.clientX,
    event.clientY,
  )

    const startWidth =
      segno.metadati?.textBoxWidth ??
      Math.max(
        320,
        larghezzaStimata + 80,
      )

    const startHeight =
      segno.metadati?.textBoxHeight ??
      Math.max(
        140,
        altezzaStimata + 60,
      )

    interactionMode.current = {
      type: 'resizing-text',
      textId: segno.id,
      startPoint: puntoIniziale,
      startWidth,
      startHeight,
    }

    svgRef.current?.setPointerCapture(
      event.pointerId,
    )
  }}
/>
</>
) : (
  <text
    x={punto.x}
    y={punto.y}
    fill={segno.colore}
    fontSize={fontSize}
    fontFamily={
      segno.metadati?.fontFamily ??
      "Arial"
    }
    fontWeight={
      segno.metadati?.fontWeight ??
      "normal"
    }
    fontStyle={
      segno.metadati?.fontStyle ??
      "normal"
    }
    textDecoration={
      segno.metadati?.textDecoration ??
      "none"
    }
    transform={`rotate(${
      segno.metadati?.rotation ?? 0
    } ${punto.x} ${punto.y})`}
    dominantBaseline="hanging"
    style={{
      userSelect: "none",
    }}
  >
   {contenuto.split("\n").map(
  (riga, index) => (
    <tspan
      key={index}
      x={punto.x}
      dy={
        index === 0
          ? 0
          : fontSize * 1.25
      }
    >
      {riga || " "}
    </tspan>
  ),
)}
  </text>
)}
    </g>
  )
}
if (segno.strumento === 'pin') {
  const numero = segno.metadati?.numero || 0

  const colorePin =
    segno.metadati?.stato === 'risolto'
      ? '#16a34a'
      : segno.metadati?.stato === 'in_lavorazione'
        ? '#eab308'
        : '#ef4444'

  return (
   <g
  key={segno.id}
  pointerEvents={
    strumento === null && !pinBloccati
      ? 'auto'
      : 'none'
  }
  onPointerDown={
    strumento === null && !pinBloccati
      ? (event) => {
          event.stopPropagation()
          onSelezionaPin?.(
            segno.id,
          )
        }
      : undefined
  }
  style={{
    cursor:
      strumento === null && !pinBloccati
        ? 'pointer'
        : 'crosshair',
  }}
>
      <circle
        cx={primo.x}
        cy={primo.y}
        r={pinSelezionatoId === segno.id ? 20 : 16}
        fill={colorePin}
        stroke={pinSelezionatoId === segno.id ? '#2563eb' : '#ffffff'}
        strokeWidth={pinSelezionatoId === segno.id ? 5 : 3}
      />

      <text
        x={primo.x}
        y={primo.y + 5}
        textAnchor="middle"
        fontSize={15}
        fontWeight={800}
        fill="#ffffff"
        pointerEvents="none"
      >
        {numero}
      </text>
    </g>
  )
}

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
    <g key={segno.id}>
      <line
        x1={primo.x}
        y1={primo.y}
        x2={ultimo.x}
        y2={ultimo.y}
        stroke="transparent"
        strokeWidth={Math.max(segno.spessore, 14)}
        strokeLinecap="round"
       
 
pointerEvents={
  strumento === "linea" ||
  strumento === "perpendicolare" ||
  trimAttivo ||
  (strumento && isStrumentoGomma(strumento))
    ? "none"
    : "stroke"
}

       onPointerDown={(event) => {
  event.preventDefault()
  event.stopPropagation()

if (strumento === 'perpendicolare') {
  setLineaRiferimentoPerpendicolareId(
    segno.id,
  )
  return
}

  if (trimAttivo) {
    return
  }

  onChange(segni, true)

          const puntoIniziale =
            puntoDaClient(
              event.clientX,
              event.clientY,
            )
  const idsDaTrascinare =
    cadEntitySelezionateIds.includes(segno.id)
      ? cadEntitySelezionateIds
      : [segno.id]

  const segniIniziali = segni.filter(
    (item) =>
      idsDaTrascinare.includes(item.id) &&
      item.strumento === 'linea',
  )

  trascinamentoSelezioneMultiplaRef.current = {
    puntoIniziale,
    segniIniziali,
  }

  if (
    !cadEntitySelezionateIds.includes(segno.id)
  ) {
    onCambiaSelezioneCad?.([segno.id])
    onSelezionaCadEntity?.(segno.id)
  }

  event.currentTarget.setPointerCapture(
    event.pointerId,
  )
}}
  />

  <line
    x1={primo.x}
    y1={primo.y}
    x2={ultimo.x}
    y2={ultimo.y}
    stroke={
  lineaRiferimentoPerpendicolareId === segno.id
    ? "#f59e0b"
    : cadEntitySelezionateIds.includes(segno.id)
      ? "#2563eb"
      : segno.colore
}
strokeWidth={
  lineaRiferimentoPerpendicolareId === segno.id
    ? segno.spessore + 3
    : cadEntitySelezionateIds.includes(segno.id)
      ? segno.spessore + 2
      : segno.spessore
}    strokeLinecap="round"
    pointerEvents="none"
  />
</g>

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
            points={segno.punti
              .map(
                (punto) =>
                  `${punto.x},${punto.y}`,
              )
              .join(" ")}
            fill="none"
            stroke={segno.colore}
            strokeWidth={segno.spessore}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={
              segno.strumento ===
              "evidenziatore"
                ? 0.32
                : 1
            }
          />
               )
      })}

      {cadEntities
        .filter(
          (entity) =>
            entity.type === "area" &&
            entity.layerId === layer.id,
        )
        .map((entity) => (
          <CadEntityRenderer
            key={entity.id}
            entity={{
              ...entity,
              visible:
                entity.visible &&
                layer.visible,
              locked:
                entity.locked ||
                layer.locked,
              selectable:
                entity.selectable &&
                layer.selectable &&
                !layer.locked,
            }}
            selected={
              cadEntitySelezionateIds.includes(
                entity.id,
              )
            }
            onPointerDown={(event) => {
             if (
  !modalitaSelezione ||
  trimAttivo ||
  areaAttiva ||
  strumento !== null ||
  !entity.selectable ||
  entity.locked ||
  layer.locked ||
  !layer.selectable
) {
  return
}

              event.preventDefault()
              event.stopPropagation()

              const nuovaSelezione =
                event.shiftKey
                  ? cadEntitySelezionateIds.includes(
                      entity.id,
                    )
                    ? cadEntitySelezionateIds.filter(
                        (id) =>
                          id !== entity.id,
                      )
                    : [
                        ...cadEntitySelezionateIds,
                        entity.id,
                      ]
                  : [entity.id]

              onCambiaSelezioneCad?.(
                nuovaSelezione,
              )

              onSelezionaCadEntity?.(
                nuovaSelezione.length === 1
                  ? nuovaSelezione[0]
                  : null,
              )
            }}
            onVertexGripPointerDown={(
  event,
  vertexIndex,
) => {
 if (
  areaAttiva ||
  (strumento && isStrumentoGomma(strumento)) ||
  entity.locked ||
  layer.locked ||
  !layer.selectable
) {
  return
}

              event.preventDefault()
              event.stopPropagation()

              setAreaGripAttivo({
                entityId: entity.id,
                vertexIndex,
              })

              onCambiaSelezioneCad?.([
                entity.id,
              ])

              onSelezionaCadEntity?.(
                entity.id,
              )
            }}
          />
        ))}

  </g>
))}

{areaAttiva &&
  puntiAreaTemporanei.length > 0 && (
    <g pointerEvents="none">
      {puntiAreaTemporanei.length > 1 && (
        <polyline
  points={createAreaPolylinePoints(
    areaChiusa &&
    puntiAreaTemporanei.length >= 3
      ? [
          ...puntiAreaTemporanei,
          puntiAreaTemporanei[0],
        ]
      : puntiAreaTemporanei,
  )}
  fill={
    areaChiusa
      ? "rgba(37, 99, 235, 0.12)"
      : "none"
  }
  stroke="#2563eb"
  strokeWidth={2}
  strokeDasharray={
    areaChiusa
      ? undefined
      : "6 4"
  }
  vectorEffect="non-scaling-stroke"
/>
      )}

      {puntiAreaTemporanei.map(
        (punto, index) => (
          <circle
            key={`${punto.x}-${punto.y}-${index}`}
            cx={punto.x}
            cy={punto.y}
           r={
  index === 0 &&
  areaVicinoAlPrimoPunto
    ? 8
    : 5
}
fill={
  index === 0 &&
  areaVicinoAlPrimoPunto
    ? "#dbeafe"
    : "#ffffff"
}
stroke={
  index === 0 &&
  areaVicinoAlPrimoPunto
    ? "#16a34a"
    : "#2563eb"
}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ),
      )}
    </g>
  )}

{snapPoint && (
  <g
    transform={`translate(${snapPoint.x} ${snapPoint.y})`}
    pointerEvents="none"
  >
    <circle
      cx={0}
      cy={0}
      r={10}
      fill="rgba(22, 163, 74, 0.18)"
      stroke="#16a34a"
      strokeWidth={2}
    />

    {snapPoint.type === 'endpoint' && (
      <rect
        x={-5}
        y={-5}
        width={10}
        height={10}
        fill="none"
        stroke="#16a34a"
        strokeWidth={2}
      />
    )}

    {snapPoint.type === 'midpoint' && (
      <path
        d="M 0 -5 L 5 0 L 0 5 L -5 0 Z"
        fill="none"
        stroke="#2563eb"
        strokeWidth={2}
      />
    )}

    {snapPoint.type === 'center' && (
      <>
        <circle
          cx={0}
          cy={0}
          r={5}
          fill="none"
          stroke="#ea580c"
          strokeWidth={2}
        />
        <circle
          cx={0}
          cy={0}
          r={2}
          fill="#ea580c"
        />
      </>
    )}

    {snapPoint.type === 'intersection' && (
      <>
        <line
          x1={-7}
          y1={-7}
          x2={7}
          y2={7}
          stroke="#9333ea"
          strokeWidth={2}
        />
        <line
          x1={7}
          y1={-7}
          x2={-7}
          y2={7}
          stroke="#9333ea"
          strokeWidth={2}
        />
      </>
    )}
{snapPoint.type === 'perpendicular' && (
  <>
    <line
      x1={-6}
      y1={5}
      x2={6}
      y2={5}
      stroke="#f59e0b"
      strokeWidth={2}
    />
    <line
      x1={0}
      y1={-7}
      x2={0}
      y2={5}
      stroke="#f59e0b"
      strokeWidth={2}
    />
  </>
)}

  </g>
)}

{cadEntities
  .filter(
    (entity) =>
      entity.type !== "dimension" &&
      entity.type !== "area",
  )
  .map((entity) => (
    <CadEntityRenderer
      key={entity.id}
      entity={entity}
      selected={cadEntitySelezionateIds.includes(
        entity.id,
      )}
     onPointerDown={(event) => {
  if (
    !modalitaSelezione ||
    trimAttivo ||
    strumento !== null ||
    !entity.selectable ||
    entity.locked
  ) {
    return
  }

        event.preventDefault()
        event.stopPropagation()

        const nuovaSelezione =
          event.shiftKey
            ? cadEntitySelezionateIds.includes(
                entity.id,
              )
              ? cadEntitySelezionateIds.filter(
                  (id) => id !== entity.id,
                )
              : [
                  ...cadEntitySelezionateIds,
                  entity.id,
                ]
            : [entity.id]

        onCambiaSelezioneCad?.(
          nuovaSelezione,
        )

               onSelezionaCadEntity?.(
          nuovaSelezione.length === 1
            ? nuovaSelezione[0]
            : null,
        )
      }}

          />
  ))}

{cadDimensions.map((dimension) => {
  if (metroAttivo) {
    return (
      <CadEntityRenderer
        key={dimension.id}
        entity={{
          ...dimension,
          selectable: false,
        }}
        selected={false}
      />
    )
  }

  return (
    <CadEntityRenderer
      key={dimension.id}
      entity={{
  ...dimension,
  selectable: true,
}}
     selected={
  quotaSelezionataId === dimension.id ||
  cadEntitySelezionateIds.includes(
    dimension.id,
  )
}
      onPointerDown={(event) => {
  if (areaAttiva) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  onCambiaSelezioneCad?.([
    dimension.id,
  ])

  onSelezionaCadEntity?.(null)

  setQuotaSelezionataId(
    dimension.id,
  )

  setQuotaInTrascinamento(null)
  setGripQuotaAttivo(null)
}}

      onDoubleClick={() => {
 if (areaAttiva) {
    return
  }

        setQuotaSelezionataId(dimension.id)
      }}
      onCenterGripPointerDown={(event) => {
 if (areaAttiva) {
    return
  }
        event.stopPropagation()

        setQuotaSelezionataId(dimension.id)
        setQuotaInTrascinamento(dimension.id)
        setGripQuotaAttivo("center")
      }}

      onStartGripPointerDown={(event) => {
 if (areaAttiva) {
    return
  }
        event.stopPropagation()

        setQuotaSelezionataId(dimension.id)
        setQuotaInTrascinamento(dimension.id)
        setGripQuotaAttivo("start")
      }}
      onEndGripPointerDown={(event) => {
 if (areaAttiva) {
    return
  }
        event.stopPropagation()

        setQuotaSelezionataId(dimension.id)
        setQuotaInTrascinamento(dimension.id)
        setGripQuotaAttivo("end")
      }}
    />
  )
})}


{trackingPerpendicolare && (
  <line
    x1={trackingPerpendicolare.start.x}
    y1={trackingPerpendicolare.start.y}
    x2={trackingPerpendicolare.end.x}
    y2={trackingPerpendicolare.end.y}
    stroke="#f59e0b"
    strokeWidth={1.5}
    strokeDasharray="6 4"
    pointerEvents="none"
  />
)}


{misuraTemporanea && (
  <g pointerEvents="none">
    <line
      x1={misuraTemporanea.start.x}
      y1={misuraTemporanea.start.y}
      x2={misuraTemporanea.end.x}
      y2={misuraTemporanea.end.y}
      stroke="#2563eb"
      strokeWidth={2}
      strokeDasharray="6 4"
    />

    <circle
      cx={misuraTemporanea.start.x}
      cy={misuraTemporanea.start.y}
      r={4}
      fill="#2563eb"
    />

    <circle
      cx={misuraTemporanea.end.x}
      cy={misuraTemporanea.end.y}
      r={4}
      fill="#2563eb"
    />

    <text
      x={
        (misuraTemporanea.start.x +
          misuraTemporanea.end.x) /
        2
      }
      y={
        (misuraTemporanea.start.y +
          misuraTemporanea.end.y) /
          2 -
        10
      }
      textAnchor="middle"
      fontSize={15}
      fontWeight={700}
      fill="#1d4ed8"
      stroke="#ffffff"
      strokeWidth={4}
      paintOrder="stroke"
    >
      {misuraTemporanea.metri.toFixed(2)} m
    </text>
  </g>
)}
{rettangoloSelezione && (
  <rect
    x={Math.min(
      rettangoloSelezione.startX,
      rettangoloSelezione.endX,
    )}
    y={Math.min(
      rettangoloSelezione.startY,
      rettangoloSelezione.endY,
    )}
    width={Math.abs(
      rettangoloSelezione.endX -
        rettangoloSelezione.startX,
    )}
    height={Math.abs(
      rettangoloSelezione.endY -
        rettangoloSelezione.startY,
    )}
    fill="rgba(37, 99, 235, 0.12)"
    stroke="#2563eb"
    strokeWidth={1.5}
    strokeDasharray="8 6"
    vectorEffect="non-scaling-stroke"
    pointerEvents="none"
  />
)}
    </svg>
  )
}




