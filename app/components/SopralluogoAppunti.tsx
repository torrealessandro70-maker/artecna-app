"use client";
import { eraseFreehand } from "@/app/engines/cad/operations/erase-freehand"

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from "react";
import { flushSync } from "react-dom";
import { ArrowUpRight, CornerDownRight, Eraser } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import NotaDisegno from "./note/NotaDisegno";
import CadEntityRenderer from "../engines/cad/render/CadEntityRenderer";
import { intersectsCadMarquee } from "../engines/cad/selection/marquee";
import { DEFAULT_TEXT_BOX_WIDTH, getCadTextLayout } from "../engines/cad/geometry/text-layout";
import { STRUMENTI_DISEGNO } from "./note/drawing-tools";
import { jsPDF } from "jspdf";
import { Canvg } from "canvg";
import {
  DecisionBuilder,
  type DecisionPlan,
  type DecisionProposal,
} from "../engines/decision";
import WorkflowPreview from "./WorkflowPreview";
import {
  mergePhotoMemory,
  fotoGalleriaToArtecnaPhoto,
} from "@/app/engines/photo-memory";

import {
  allegatoToArtecnaPhoto,
  isAllegatoImmagine,
} from "@/app/engines/photo-memory/adapter";

import type {
  CadAreaEntity,
} from "@/app/engines/cad/entities"
import { createCadDimension } from "@/app/engines/cad/entities"

import {
  registerDefaultBehaviors,
} from "../engines/cad/behaviors"

import type {
  AllegatoNota,
  AnalisiNota,
  PaginaQuadernoNota,
  OggettoGraficoQuaderno,
  SegnoNota,
  StrumentoDisegno,
  VoceChecklistNota,
} from "./note/types";

import {
  applyCadEntitiesToPage,
  getCadEntitiesFromPage,
} from '../engines/cad/integration'

import {
  deleteEntities,
  duplicateEntities,
} from '../engines/cad/commands'

import {
  transformEntity,
} from "../engines/cad/commands";

import {
  moveEntities,
} from '../engines/cad/commands'

import { executeWorkflowProposal } from "@/app/engines/workflow-actions";

import { createDefaultBackgroundTransform } from "../engines/quaderno-layout";

import { esportaSvgQuaderno } from "@/app/engines/quaderno-export";

import { createQuadernoPageLayout } from "@/app/engines/quaderno-page";
import { DEFAULT_QUADERNO_LAYERS } from "@/app/engines/quaderno-layers/defaults";
import type { CadScaleCalibration } from '@/app/engines/cad/scale-manager'
import type { CadDimensionEntity } from '@/app/engines/cad/entities'
import { ToolButton } from "@/app/components/ui";
import { applyOrtho } from "@/app/engines/cad/ortho"
import { applyPolar } from "@/app/engines/cad/polar"
import {
  segmentIntersection,
  perpendicularDirection,
  projectPointOnPerpendicular,
} from "@/app/engines/cad/geometry"

import {
  createInitialAreaState,
  handleAreaPointerDown,
  type CadAreaState,
} from "@/app/engines/cad/area"

import {
  resolveSnapPoint,
} from "@/app/engines/cad/snap"

import {
  calculateVisibleImageRect,
} from "@/app/engines/cad/image-geometry"

import {
  getSnapTolerance,
} from "@/app/engines/cad/snap/tolerance"

import type {
  CadEntity,
  CadPoint,
} from "../engines/cad/entities";

import {
  getSegmentIntersection,
} from "../engines/cad/snap/geometry";

import {
  lineBehavior,
} from "../engines/cad/behaviors/line.behavior";

import type {
  CadLineEntity,
} from "../engines/cad/entities";

import {
  createCadText,
  createCadFreehand,
  createCadLine,
  createCadRectangle,
} from "../engines/cad/entities";

import type {
  QuadernoLayer,
  QuadernoLayerId,
} from "@/app/engines/quaderno-layers/types";
import WorkspacePanel from "./quaderno/WorkspacePanel";
import CadStatusBar from "./quaderno/CadStatusBar";
import TextPropertiesToolbar from "@/app/components/cad/TextPropertiesToolbar";
import {
  getPrimarySelectedEntity,
} from "../engines/cad/queries"

import type {
  CadSelectionState,
} from "../engines/cad/selection"

import {
  calculateZoomAtPoint,
  clampViewportScale,
} from "@/app/engines/cad/viewport";
import {
  explodeCadAreaEntity,
} from "@/app/engines/cad/operations"

import {
  mergeCadAreaEntities,
} from "@/app/engines/cad/area"

import {
  pagePointToWorkspacePoint,
  workspacePointToPagePoint,
} from "@/app/engines/cad/workspace-coordinates"

type SopralluogoNota = {
  id?: string;
  cliente?: string;
  indirizzo?: string;
  data_sopralluogo?: string;
  ora_appuntamento?: string;
  tipo_lavoro?: string;
};

type FotoGalleriaNota = {
  id?: string;
  sopralluogo_id?: string;
  immagine_base64: string;
  nota?: string;
  tag?: string;
};

type QuadernoHistorySnapshot = {
  workspaceCadEntities?: CadEntity[];
  cadSelection?: { primaryId: string | null; ids: string[] };
  // Preserve the existing eraser-only restore path.
  workspaceEraserEntities?: CadEntity[];
  disegni: SegnoNota[];
  cadDimensions: CadDimensionEntity[];
  cadEntities: CadEntity[];
  sfondoDisegno: string | null;
  backgroundTransform: ReturnType<typeof createDefaultBackgroundTransform>;
  oggettiGrafici: OggettoGraficoQuaderno[];
  layers: QuadernoLayer[];
  zoomSfondo: number;
  sfondoX: number;
  sfondoY: number;
};

type Props = {
  mostraAppuntiSopralluogo: boolean;
  setMostraAppuntiSopralluogo: (v: boolean) => void;
  sopralluogoAperto: SopralluogoNota;
  supabase: SupabaseClient;
  buttonPrimary: CSSProperties;
  buttonSecondary: CSSProperties;
  integrato?: boolean;
  fotoGalleria?: FotoGalleriaNota[];
  onApriGalleria?: () => void;
  generaPreventivoAiDaSopralluogo?: (
    sopralluogo: SopralluogoNota,
  ) => boolean | void | Promise<boolean | void>;
orthoAttivo?: boolean
onChiudiFascicolo?: () => void;
};

export default function SopralluogoAppunti({
  mostraAppuntiSopralluogo,
  setMostraAppuntiSopralluogo,
  sopralluogoAperto,
  supabase,
  buttonPrimary,
  buttonSecondary,
  integrato = false,
  fotoGalleria = [],
  onApriGalleria,
  generaPreventivoAiDaSopralluogo,
onChiudiFascicolo,

}: Props) {

const quadernoContainerRef = useRef<HTMLDivElement | null>(null);

const [
  workspacePosterImages,
  setWorkspacePosterImages,
] = useState<OggettoGraficoQuaderno[]>([])

const [
  workspacePosterSelezionatoId,
  setWorkspacePosterSelezionatoId,
] = useState<string | null>(null)

const workspacePosterDragRef = useRef<{
  attivo: boolean
  id: string | null
  start: CadPoint | null
  transformIniziale:
    OggettoGraficoQuaderno["transform"] | null
}>({
  attivo: false,
  id: null,
  start: null,
  transformIniziale: null,
})

const workspacePosterResizeRef = useRef<{
  attivo: boolean
  id: string | null

  handle:
    | "nw"
    | "n"
    | "ne"
    | "e"
    | "se"
    | "s"
    | "sw"
    | "w"
    | null

  start: CadPoint | null

  transformIniziale:
    OggettoGraficoQuaderno["transform"] | null
}>({
  attivo: false,
  id: null,
  handle: null,
  start: null,
  transformIniziale: null,
})
const [quadernoEspansoTop, setQuadernoEspansoTop] =
  useState(2);

 const quadernoSvgRef =
  useRef<SVGSVGElement | null>(null);

const workspaceSvgRef =
  useRef<SVGSVGElement | null>(null);

const viewportRef =
  useRef<HTMLDivElement | null>(null);

const viewportContentRef =
  useRef<HTMLDivElement | null>(null);
const viewportTransformRef =
  useRef<HTMLDivElement | null>(null);

const touchPointersRef = useRef(
  new Map<
    number,
    {
      x: number;
      y: number;
    }
  >(),
);

const pinchRef = useRef<{
  attivo: boolean;
  distanzaIniziale: number;
  scalaIniziale: number;
  centroIniziale: {
    x: number;
    y: number;
  };
  offsetIniziale: {
    x: number;
    y: number;
  };
}>({
  attivo: false,
  distanzaIniziale: 0,
  scalaIniziale: 1,
  centroIniziale: {
    x: 0,
    y: 0,
  },
  offsetIniziale: {
    x: 0,
    y: 0,
  },
});

const [workspacePerpendicolareRiferimento, setWorkspacePerpendicolareRiferimento] =
  useState<CadLineEntity | null>(null)

const workspaceFrecciaMarkerId = useId()

const workspaceLineaStartRef =
  useRef<CadPoint | null>(null)

const [workspaceLineaPreview, setWorkspaceLineaPreview] =
  useState<CadPoint | null>(null)

const workspacePennaPointsRef =
  useRef<CadPoint[]>([])

const workspacePennaPreviewRef =
  useRef<SVGPolylineElement | null>(null)

const [workspaceAreaPoints, setWorkspaceAreaPoints] =
  useState<CadPoint[]>([])

const [workspaceAreaPreview, setWorkspaceAreaPreview] =
  useState<CadPoint | null>(null)

const workspaceAreaStateRef =
  useRef<CadAreaState>(
    createInitialAreaState(),
  )

const [workspaceSnapPoint, setWorkspaceSnapPoint] =
  useState<{
    x: number
    y: number
    type: string
  } | null>(null)

const [workspaceMetroPreview, setWorkspaceMetroPreview] =
  useState<{
    start: CadPoint
    end: CadPoint
    metri: number
  } | null>(null)

const [
  quotaWorkspaceInPosizionamentoId,
  setQuotaWorkspaceInPosizionamentoId,
] = useState<string | null>(null)

  const [anteprimaQuaderno, setAnteprimaQuaderno] = useState<string | null>(
    null,
  );

const [toolbarEspansa, setToolbarEspansa] = useState(false);
const [foglioPanelAperto, setFoglioPanelAperto] = useState(false);
const [layerPanelAperto, setLayerPanelAperto] = useState(false);
const [foglioPanelPosizione, setFoglioPanelPosizione] = useState({
  x: 220,
  y: 90,
});


const [layerPanelPosizione, setLayerPanelPosizione] = useState({
  x: 560,
  y: 90,
});

const [layerPanelDimensioni, setLayerPanelDimensioni] = useState({
  width: 320,
  height: 320,
});

const [foglioPanelDimensioni, setFoglioPanelDimensioni] = useState({
  width: 320,
  height: 170,
});

  const [notaId, setNotaId] = useState<string | null>(null);
  const [titolo, setTitolo] = useState("");
  const [testo, setTesto] = useState("");
  const [checklist, setChecklist] = useState<VoceChecklistNota[]>([]);
  const [disegni, setDisegni] = useState<SegnoNota[]>([]);
  const [quadernoEspanso, setQuadernoEspanso] = useState(false);
const [ultimaLineaId, setUltimaLineaId] = useState<string | null>(null)
const [nuovaLunghezzaLinea, setNuovaLunghezzaLinea] = useState("")

const [
  nuovaDimensioneTesto,
  setNuovaDimensioneTesto,
] = useState("")

const [
  nuovoFontTesto,
  setNuovoFontTesto,
] = useState("Arial")

const [
  testoGrassetto,
  setTestoGrassetto,
] = useState(false)

const [
  testoCorsivo,
  setTestoCorsivo,
] = useState(false)

const [cadEntitySelezionataId, setCadEntitySelezionataId] =
  useState<string | null>(null);
const [cadEntitySelezionateIds, setCadEntitySelezionateIds] =
  useState<string[]>([]);
const rettangoloSelezioneIniziale = {
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
};
const [rettangoloSelezione, setRettangoloSelezione] =
  useState<typeof rettangoloSelezioneIniziale | null>(null);



const selezioneWorkspaceRef = useRef<{
  attiva: boolean
  start: CadPoint | null
  ctrlKey: boolean
}>({
  attiva: false,
  start: null,
  ctrlKey: false,
})

const puntoInizioMetroWorkspaceRef =
  useRef<CadPoint | null>(null)

const lineaCadSelezionata =
  cadEntitySelezionataId == null
    ? null
    : disegni.find(
        (segno) =>
          segno.id === cadEntitySelezionataId &&
          segno.strumento === "linea",
      ) ?? null;

const testoCadSelezionato =
  cadEntitySelezionataId == null
    ? null
    : disegni.find(
        (segno) =>
          segno.id === cadEntitySelezionataId &&
          segno.strumento === "testo",
      ) ?? null

const [toolbarPosizione, setToolbarPosizione] = useState({
  x: 24,
  y: 90,
});

const [toolbarDimensioni, setToolbarDimensioni] = useState({
  width: 240,
  height: 700,
});
const [proprietaPanelAperto, setProprietaPanelAperto] =
  useState(false);

const [proprietaPosizione, setProprietaPosizione] =
  useState({
    x: 24,
    y: 300,
  });

const [proprietaDimensioni, setProprietaDimensioni] =
  useState({
    width: 420,
    height: 220,
  });
const scalaToolbar = Math.max(
  0.50,
  Math.min(1, toolbarDimensioni.width / 620),
);

const gapToolbar = Math.max(4, Math.round(8 * scalaToolbar));

const fontSizeToolbar = Math.max(
  10,
  Math.round(13 * scalaToolbar),
);

const toolbarCompatta =
  toolbarDimensioni.width < 120;

const colonneToolbar =
  toolbarDimensioni.width > 220 ? 2 : 1;

const paddingVerticaleToolbar = Math.max(
  3,
  Math.round(6 * scalaToolbar),
);

const paddingOrizzontaleToolbar = Math.max(
  5,
  Math.round(10 * scalaToolbar),
);

const stilePulsanteToolbar: CSSProperties = {
  ...buttonSecondary,
  width: "100%",
  minWidth: 0,
  minHeight: 34,
  height: 34,
  padding: "4px 6px",
  fontSize: 11,
  lineHeight: 1,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const ridimensionamentoToolbarRef = useRef<{
  attivo: boolean;
  puntoX: number;
  puntoY: number;
  widthIniziale: number;
  heightIniziale: number;
}>({
  attivo: false,
  puntoX: 0,
  puntoY: 0,
  widthIniziale: 620,
  heightIniziale: 180,
});

const iniziaTrascinamentoToolbar = (
  event: React.PointerEvent<HTMLDivElement>,
) => {
  event.preventDefault();

  trascinamentoToolbarRef.current = {
    attivo: true,
    offsetX: event.clientX - toolbarPosizione.x,
    offsetY: event.clientY - toolbarPosizione.y,
  };

  event.currentTarget.setPointerCapture(event.pointerId);
};

const trascinaToolbar = (
  event: React.PointerEvent<HTMLDivElement>,
) => {
  if (!trascinamentoToolbarRef.current.attivo) return;

  const larghezzaStimata = 620;
  const altezzaStimata = 180;

  const nuovoX = Math.max(
    8,
    Math.min(
      window.innerWidth - larghezzaStimata - 8,
      event.clientX - trascinamentoToolbarRef.current.offsetX,
    ),
  );

  const nuovoY = Math.max(
    8,
    Math.min(
      window.innerHeight - altezzaStimata - 8,
      event.clientY - trascinamentoToolbarRef.current.offsetY,
    ),
  );

  setToolbarPosizione({
    x: nuovoX,
    y: nuovoY,
  });
};


const terminaTrascinamentoToolbar = (
  event: React.PointerEvent<HTMLDivElement>,
) => {
  trascinamentoToolbarRef.current.attivo = false;

  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
};

const iniziaRidimensionamentoToolbar = (
  event: React.PointerEvent<HTMLDivElement>,
) => {
  event.preventDefault();
  event.stopPropagation();

  ridimensionamentoToolbarRef.current = {
    attivo: true,
    puntoX: event.clientX,
    puntoY: event.clientY,
    widthIniziale: toolbarDimensioni.width,
    heightIniziale: toolbarDimensioni.height,
  };

  event.currentTarget.setPointerCapture(event.pointerId);
};

const ridimensionaToolbar = (
  event: React.PointerEvent<HTMLDivElement>,
) => {
  if (!ridimensionamentoToolbarRef.current.attivo) return;

  const deltaX =
    event.clientX -
    ridimensionamentoToolbarRef.current.puntoX;

  const deltaY =
    event.clientY -
    ridimensionamentoToolbarRef.current.puntoY;

  const widthMassima = Math.max(
   220,
    window.innerWidth - toolbarPosizione.x - 8,
  );

  const heightMassima = Math.max(
    140,
    window.innerHeight - toolbarPosizione.y - 8,
  );

  setToolbarDimensioni({
    width: Math.max(
      220,
      Math.min(
        widthMassima,
        ridimensionamentoToolbarRef.current.widthIniziale +
          deltaX,
      ),
    ),
    height: Math.max(
      140,
      Math.min(
        heightMassima,
        ridimensionamentoToolbarRef.current.heightIniziale +
          deltaY,
      ),
    ),
  });
};

const terminaRidimensionamentoToolbar = (
  event: React.PointerEvent<HTMLDivElement>,
) => {
  ridimensionamentoToolbarRef.current.attivo = false;

  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
};



const trascinamentoToolbarRef = useRef<{
  attivo: boolean;
  offsetX: number;
  offsetY: number;
}>({
  attivo: false,
  offsetX: 0,
  offsetY: 0,
});


  const [pinSelezionatoId, setPinSelezionatoId] = useState<string | null>(null);
  const [sfondoDisegno, setSfondoDisegno] = useState<string | null>(null);


  const [backgroundTransform, setBackgroundTransform] = useState(
    createDefaultBackgroundTransform(),
  );

  const [oggettiGrafici, setOggettiGrafici] = useState<
    OggettoGraficoQuaderno[]
  >([]);

  const [oggettoGraficoSelezionatoId, setOggettoGraficoSelezionatoId] =
    useState<string | null>(null);

  const [pageLayout, setPageLayout] = useState(createQuadernoPageLayout());
const aggiornaPageLayout = (
  format: "A4" | "A3",
  orientation: "portrait" | "landscape",
) => {
  const nuovoPageLayout =
    createQuadernoPageLayout(
      format,
      orientation,
    )

  setPageLayout(nuovoPageLayout)

  setPagineQuaderno((pagineCorrenti) =>
    pagineCorrenti.map((pagina, index) =>
      index === paginaCorrenteIndex
        ? {
            ...pagina,
            pageLayout: nuovoPageLayout,
          }
        : pagina,
    ),
  )

  setQuadernoDirty(true)
}

const [layers, setLayers] = useState<QuadernoLayer[]>(
  DEFAULT_QUADERNO_LAYERS,
);

const [layerAttivoId, setLayerAttivoId] =
  useState<QuadernoLayerId>("drawing");
const aggiungiLayer = () => {
  const numero =
    layers.filter((layer) =>
      layer.id.startsWith("layer-"),
    ).length + 1;

  const ordineMassimo = layers.reduce(
    (massimo, layer) =>
      Math.max(massimo, layer.order),
    0,
  );

  const nuovoLayer: QuadernoLayer = {
    id: `layer-${crypto.randomUUID()}`,
    name: `Layer ${numero}`,
    visible: true,
    locked: false,
    selectable: true,
    order: ordineMassimo + 1,
  };

 const nuoviLayers = [
  ...layers,
  nuovoLayer,
]

aggiornaQuaderno({
  layers: nuoviLayers,
})

setLayerAttivoId(nuovoLayer.id)

}; 

 const [sfondoSelezionato, setSfondoSelezionato] = useState(false);
  const [undoStack, setUndoStack] = useState<SegnoNota[][]>([]);
  const [redoStack, setRedoStack] = useState<SegnoNota[][]>([]);

const [quadernoDirty, setQuadernoDirty] = useState(false);

const oggettiGraficiLiveRef =
  useRef<OggettoGraficoQuaderno[]>([]);


const [
  trasformazioneOggettoAttiva,
  setTrasformazioneOggettoAttiva,
] = useState(false);

const [quadernoUndoStack, setQuadernoUndoStack] = useState<
  QuadernoHistorySnapshot[]
>([]);

const [quadernoRedoStack, setQuadernoRedoStack] = useState<
  QuadernoHistorySnapshot[]
>([]);

const creaSnapshotQuaderno = (): QuadernoHistorySnapshot => ({
  workspaceCadEntities: structuredClone(workspaceCadEntities),
  cadSelection: { primaryId: cadEntitySelezionataId, ids: [...cadEntitySelezionateIds] },
  disegni: JSON.parse(JSON.stringify(disegni)),

  cadDimensions: JSON.parse(
    JSON.stringify(
      pagineQuaderno[paginaCorrenteIndex]?.cadDimensions ?? [],
    ),
  ),

  cadEntities: JSON.parse(
    JSON.stringify(
      pagineQuaderno[paginaCorrenteIndex]?.cadEntities ?? [],
    ),
  ),

  sfondoDisegno,

  backgroundTransform: JSON.parse(JSON.stringify(backgroundTransform)),
  oggettiGrafici: JSON.parse(JSON.stringify(oggettiGrafici)),
  layers: JSON.parse(JSON.stringify(layers)),
  zoomSfondo,
  sfondoX,
  sfondoY,
});

type QuadernoUpdate = {
  disegni?: SegnoNota[];
  sfondoDisegno?: string | null;
  backgroundTransform?: ReturnType<typeof createDefaultBackgroundTransform>;
  oggettiGrafici?: OggettoGraficoQuaderno[];
  layers?: QuadernoLayer[];
  zoomSfondo?: number;
  sfondoX?: number;
  sfondoY?: number;
};

const registraSnapshotQuaderno = (snapshot = creaSnapshotQuaderno()) => {

  setQuadernoUndoStack((precedenti) => {
    const aggiornati = [...precedenti, snapshot];

    if (aggiornati.length > 100) {
      return aggiornati.slice(aggiornati.length - 100);
    }

    return aggiornati;
  });

  setQuadernoRedoStack([]);
};

const aggiornaQuaderno = (
  update: QuadernoUpdate,
  registraCronologia = true,
) => {
  if (registraCronologia) {
    registraSnapshotQuaderno();
  }



  const nuoviDisegni =
    update.disegni !== undefined
      ? JSON.parse(JSON.stringify(update.disegni))
      : disegni;

  const nuovoSfondoDisegno =
    update.sfondoDisegno !== undefined
      ? update.sfondoDisegno
      : sfondoDisegno;

  const nuovoBackgroundTransform =
    update.backgroundTransform !== undefined
      ? JSON.parse(JSON.stringify(update.backgroundTransform))
      : backgroundTransform;

  const nuoviOggettiGrafici =
    update.oggettiGrafici !== undefined
      ? JSON.parse(JSON.stringify(update.oggettiGrafici))
      : oggettiGrafici;

  const nuoviLayers =
    update.layers !== undefined
      ? JSON.parse(JSON.stringify(update.layers))
      : layers;

  const nuovoZoomSfondo =
    update.zoomSfondo !== undefined
      ? update.zoomSfondo
      : zoomSfondo;

  const nuovoSfondoX =
    update.sfondoX !== undefined
      ? update.sfondoX
      : sfondoX;

  const nuovoSfondoY =
    update.sfondoY !== undefined
      ? update.sfondoY
      : sfondoY;

  setDisegni(nuoviDisegni);
  setSfondoDisegno(nuovoSfondoDisegno);
  setBackgroundTransform(nuovoBackgroundTransform);
  setOggettiGrafici(nuoviOggettiGrafici);
  setLayers(nuoviLayers);
  setZoomSfondo(nuovoZoomSfondo);
  setSfondoX(nuovoSfondoX);
  setSfondoY(nuovoSfondoY);
setQuadernoDirty(true);

  setPagineQuaderno((pagineCorrenti) =>
    pagineCorrenti.map((pagina, index) =>
      index === paginaCorrenteIndex
        ? {
            ...pagina,
            disegni: nuoviDisegni,
            sfondoDisegno: nuovoSfondoDisegno,
            zoomSfondo: nuovoZoomSfondo,
            oggettiGrafici: nuoviOggettiGrafici,
            layers: nuoviLayers,
            backgroundTransform: nuovoBackgroundTransform,
          }
        : pagina,
    ),
  );
};


const aggiornaQuadernoLive = (
  update: QuadernoUpdate,
) => {
  if (update.disegni !== undefined) {
    setDisegni(JSON.parse(JSON.stringify(update.disegni)));
  }

  if (update.sfondoDisegno !== undefined) {
    setSfondoDisegno(update.sfondoDisegno);
  }

  if (update.backgroundTransform !== undefined) {
    setBackgroundTransform(
      JSON.parse(JSON.stringify(update.backgroundTransform)),
    );
  }

  if (update.oggettiGrafici !== undefined) {
  const nuoviOggettiGrafici =
    JSON.parse(
      JSON.stringify(update.oggettiGrafici),
    ) as OggettoGraficoQuaderno[];

  oggettiGraficiLiveRef.current =
    nuoviOggettiGrafici;

  setOggettiGrafici(nuoviOggettiGrafici);
}

  if (update.layers !== undefined) {
    setLayers(
      JSON.parse(JSON.stringify(update.layers)),
    );
  }

  if (update.zoomSfondo !== undefined) {
    setZoomSfondo(update.zoomSfondo);
  }

  if (update.sfondoX !== undefined) {
    setSfondoX(update.sfondoX);
  }

  if (update.sfondoY !== undefined) {
    setSfondoY(update.sfondoY);
  }
};

const applicaSnapshotQuaderno = (
  snapshot: QuadernoHistorySnapshot,
) => {
  if (snapshot.workspaceEraserEntities) {
    setWorkspaceCadEntities(structuredClone(snapshot.workspaceEraserEntities));
    setQuadernoDirty(true);
    return;
  }

  if (snapshot.workspaceCadEntities) {
    setWorkspaceCadEntities(structuredClone(snapshot.workspaceCadEntities));
    setQuadernoDirty(true);
  }
  if (snapshot.cadSelection) {
    setCadEntitySelezionataId(snapshot.cadSelection.primaryId);
    setCadEntitySelezionateIds([...snapshot.cadSelection.ids]);
  }

  setDisegni(
    JSON.parse(JSON.stringify(snapshot.disegni)),
  );

  setPagineQuaderno((pagineCorrenti) =>
    pagineCorrenti.map((pagina, index) =>
      index === paginaCorrenteIndex
       ? {
    ...pagina,

    cadDimensions: JSON.parse(
      JSON.stringify(snapshot.cadDimensions),
    ),

    cadEntities: JSON.parse(
      JSON.stringify(snapshot.cadEntities),
    ),
  }
        : pagina,
    ),
  );

  setSfondoDisegno(snapshot.sfondoDisegno);

  setBackgroundTransform(
    JSON.parse(
      JSON.stringify(snapshot.backgroundTransform),
    ),
  );

  setOggettiGrafici(
    JSON.parse(
      JSON.stringify(snapshot.oggettiGrafici),
    ),
  );

  setLayers(
    JSON.parse(JSON.stringify(snapshot.layers)),
  );

  setZoomSfondo(snapshot.zoomSfondo);
  setSfondoX(snapshot.sfondoX);
  setSfondoY(snapshot.sfondoY);

  aggiornaPaginaCorrente(
    JSON.parse(JSON.stringify(snapshot.disegni)),
    snapshot.sfondoDisegno,
    snapshot.zoomSfondo,
    JSON.parse(
      JSON.stringify(snapshot.oggettiGrafici),
    ),
    JSON.parse(JSON.stringify(snapshot.layers)),
  );
};
const annullaModificaQuaderno = () => {
  if (workspaceGommaRef.current || workspaceTestoMoveRef.current || workspaceTestoResizeRef.current) return;
  setQuadernoUndoStack((precedenti) => {
    const snapshotPrecedente = precedenti[precedenti.length - 1];

    if (!snapshotPrecedente) {
      return precedenti;
    }

    const snapshotCorrente = creaSnapshotQuaderno();
    if (snapshotPrecedente.workspaceEraserEntities) {
      snapshotCorrente.workspaceEraserEntities = structuredClone(workspaceCadEntities);
    }

    setQuadernoRedoStack((successivi) => [
      snapshotCorrente,
      ...successivi,
    ]);

    applicaSnapshotQuaderno(snapshotPrecedente);

    return precedenti.slice(0, -1);
  });
};

const ripristinaModificaQuaderno = () => {
  if (workspaceGommaRef.current || workspaceTestoMoveRef.current || workspaceTestoResizeRef.current) return;
  setQuadernoRedoStack((successivi) => {
    const snapshotSuccessivo = successivi[0];

    if (!snapshotSuccessivo) {
      return successivi;
    }

    const snapshotCorrente = creaSnapshotQuaderno();
    if (snapshotSuccessivo.workspaceEraserEntities) {
      snapshotCorrente.workspaceEraserEntities = structuredClone(workspaceCadEntities);
    }

    setQuadernoUndoStack((precedenti) => {
      const aggiornati = [...precedenti, snapshotCorrente];

      return aggiornati.length > 100
        ? aggiornati.slice(aggiornati.length - 100)
        : aggiornati;
    });

    applicaSnapshotQuaderno(snapshotSuccessivo);

    return successivi.slice(1);
  });
};

useEffect(() => {
  registerDefaultBehaviors()
}, [])

useEffect(() => {
  const aggiornaPosizioni = () => {
    setLayerPanelPosizione((pos) => ({
      ...pos,
      x: Math.min(
        pos.x,
        window.innerWidth -
          layerPanelDimensioni.width -
          16,
      ),
    }));

    setProprietaPosizione((pos) => ({
      x: Math.min(
        pos.x,
        window.innerWidth -
          proprietaDimensioni.width -
          16,
      ),
      y: Math.min(
        pos.y,
        window.innerHeight -
          proprietaDimensioni.height -
          16,
      ),
    }));

    setToolbarPosizione((pos) => ({
      ...pos,
      y: Math.min(
        pos.y,
        window.innerHeight -
          toolbarDimensioni.height -
          16,
      ),
    }));
  };

  aggiornaPosizioni();

  window.addEventListener("resize", aggiornaPosizioni);

  return () =>
    window.removeEventListener(
      "resize",
      aggiornaPosizioni,
    );
}, [
  toolbarDimensioni,
  layerPanelDimensioni,
  proprietaDimensioni,
]);


useEffect(() => {
  oggettiGraficiLiveRef.current = oggettiGrafici;
}, [oggettiGrafici]);

useEffect(() => {
  if (!notaVisibile) return;

  const gestisciScorciatoieQuaderno = (
    event: KeyboardEvent,
  ) => {



    const elementoAttivo =
      event.target as HTMLElement | null;

    const tagName =
      elementoAttivo?.tagName.toLowerCase();

    const tipoInput =
      elementoAttivo instanceof HTMLInputElement
        ? elementoAttivo.type.toLowerCase()
        : null;

    const inputDiTesto =
      tagName === "input" &&
      tipoInput !== "file" &&
      tipoInput !== "button" &&
      tipoInput !== "submit" &&
      tipoInput !== "reset" &&
      tipoInput !== "checkbox" &&
      tipoInput !== "radio" &&
      tipoInput !== "range" &&
      tipoInput !== "color";

    const staScrivendo =
      inputDiTesto ||
      tagName === "textarea" ||
      tagName === "select" ||
      elementoAttivo?.isContentEditable;
    if (staScrivendo) return;

    const tasto = event.key.toLowerCase();

 if (
  tasto === "delete" ||
  tasto === "backspace"
) {
 if (
  spostaTavolaAttivo &&
  pagineWorkspaceSelezionateIds.length > 0
) {
  event.preventDefault();

  console.log(
    "DELETE PAGINE:",
    pagineWorkspaceSelezionateIds,
  );

  eliminaPagineWorkspaceSelezionate();

  return;
}

  const ciSonoEntitaSelezionate =
    cadEntitySelezionateIds.length > 0 ||
    cadEntitySelezionataId !== null ||
    oggettoGraficoSelezionatoId !== null ||
    pinSelezionatoId !== null;

  if (ciSonoEntitaSelezionate) {
    event.preventDefault();
    eliminaEntitaCadSelezionate();

    return;
  }
}


if (tasto === "escape") {
  event.preventDefault()

  setStrumentoDisegno(null)
  setTrimAttivo(false)
  setAreaAttiva(false)
  setMetroAttivo(false)
  setCalibrazioneScalaAttiva(false)
  setManoAttiva(false)
  setPanInCorso(false)

  setModalitaSelezione(true)

setCadEntitySelezionataId(null)
setCadEntitySelezionateIds([])

setPagineWorkspaceSelezionateIds([])

return
}
if (
  !event.ctrlKey &&
  !event.metaKey &&
  !event.altKey
) {
  if (tasto === "v") {
    event.preventDefault()

    setManoAttiva(false)
    setPanInCorso(false)
    setSpostaEntitaAttivo(false)
    setSpostaTavolaAttivo(false)

    setStrumentoDisegno(null)
    setAreaAttiva(false)
    setMetroAttivo(false)
    setCalibrazioneScalaAttiva(false)

    setModalitaSelezione(true)

    setSfondoSelezionato(false)
    setPinSelezionatoId(null)
    setOggettoGraficoSelezionatoId(null)

    return
  }

  if (tasto === "m") {
    event.preventDefault()

    const prossimoValore =
      !spostaTavolaAttivo

    setSpostaTavolaAttivo(
      prossimoValore,
    )

    if (prossimoValore) {
      setManoAttiva(false)
      setPanInCorso(false)
      setModalitaSelezione(true)
    }

    return
  }

  if (tasto === "h") {
    event.preventDefault()

    setManoAttiva(true)
    setPanInCorso(false)

    setModalitaSelezione(false)
    setSpostaEntitaAttivo(false)
    setSpostaTavolaAttivo(false)

    setStrumentoDisegno(null)
    setAreaAttiva(false)
    setMetroAttivo(false)
    setCalibrazioneScalaAttiva(false)

    setSfondoSelezionato(false)
    setPinSelezionatoId(null)
    setOggettoGraficoSelezionatoId(null)

    setCadEntitySelezionataId(null)
    setCadEntitySelezionateIds([])

    return
  }

  if (
    tasto === "+" ||
    tasto === "="
  ) {
    event.preventDefault()

    setViewportScale((scalaCorrente) =>
      Math.min(
        4,
        Number((scalaCorrente + 0.1).toFixed(2)),
      ),
    )

    return
  }

  if (tasto === "-") {
    event.preventDefault()

    setViewportScale((scalaCorrente) =>
      Math.max(
        0.25,
        Number((scalaCorrente - 0.1).toFixed(2)),
      ),
    )

    return
  }

  if (tasto === "0") {
    event.preventDefault()
    adattaWorkspaceAllaFinestra()

    return
  }

  if (
    spostaTavolaAttivo &&
    pagineWorkspaceSelezionateIds.length > 0
  ) {
    const delta =
      event.shiftKey ? 10 : 1

    if (tasto === "arrowleft") {
      event.preventDefault()
      spostaPagineWorkspaceSelezionate(
        -delta,
        0,
      )

      return
    }

    if (tasto === "arrowright") {
      event.preventDefault()
      spostaPagineWorkspaceSelezionate(
        delta,
        0,
      )

      return
    }

    if (tasto === "arrowup") {
      event.preventDefault()
      spostaPagineWorkspaceSelezionate(
        0,
        -delta,
      )

      return
    }

    if (tasto === "arrowdown") {
      event.preventDefault()
      spostaPagineWorkspaceSelezionate(
        0,
        delta,
      )

      return
    }
  }
}


const usaComando =
  event.ctrlKey || event.metaKey;

if (!usaComando) return;

if (
  tasto === "a" &&
  quadernoEspanso
) {
  event.preventDefault();
    setPagineWorkspaceSelezionateIds(
    pagineQuaderno.map(
      (pagina) => pagina.id,
    ),
  );

  return;
}

if (tasto === "z" && !event.shiftKey) {
      event.preventDefault();
      annullaModificaQuaderno();

      return;
    }

if (tasto === "d") {
  event.preventDefault();
  duplicaImmagineSelezionata();

  return;
}

if (tasto === "s") {
  event.preventDefault();
  void salvaNota();

  return;
}
    if (
      tasto === "y" ||
      (tasto === "z" && event.shiftKey)
    ) {
      event.preventDefault();
      ripristinaModificaQuaderno();


    }
  };

  window.addEventListener(
    "keydown",
    gestisciScorciatoieQuaderno,
  );

  return () => {
    window.removeEventListener(
      "keydown",
      gestisciScorciatoieQuaderno,
    );
  };
});
 
const esplodiAreaSelezionata = () => {
  if (!cadEntitySelezionataId) {
    return;
  }

  const paginaCorrente =
    pagineQuaderno[paginaCorrenteIndex];

  if (!paginaCorrente) {
    return;
  }

  const areaSelezionata =
  (paginaCorrente.cadEntities ?? []).find(
    (entity): entity is CadAreaEntity =>
      entity.id === cadEntitySelezionataId &&
      entity.type === "area",
  );

  if (!areaSelezionata) {
    return;
  }

  const risultato =
    explodeCadAreaEntity(areaSelezionata);
console.log("ESPLODI AREA RESULT", {
  areaId: areaSelezionata.id,
  areaPoints: areaSelezionata.points,
  changed: risultato.changed,
  entities: risultato.entities.map((entity) => ({
  id: entity.id,
  type: entity.type,
  layerId: entity.layerId,
  visible: entity.visible,
  locked: entity.locked,
  selectable: entity.selectable,
})),
areaLayerId: areaSelezionata.layerId,
});

  if (!risultato.changed) {
    return;
  }

const nuoveEntitaCad: CadEntity[] = [
  ...(paginaCorrente.cadEntities ?? []).filter(
    (entity) =>
      entity.id !== areaSelezionata.id,
  ),
  ...risultato.entities,
];

const paginaCadCorrente: PaginaQuadernoNota = {
  ...paginaCorrente,
  disegni,
  sfondoDisegno,
  zoomSfondo,
  oggettiGrafici,
  layers,
  backgroundTransform,
  cadEntities: nuoveEntitaCad,
};

const paginaAggiornata =
  applyCadEntitiesToPage(
    paginaCadCorrente,
    nuoveEntitaCad,
  );

console.log("ESPLODI AREA PAGE", {
  nuoveEntitaCad,
  disegniGenerati: paginaAggiornata.disegni,
  cadEntitiesGenerati: paginaAggiornata.cadEntities,
});

  registraSnapshotQuaderno();

  aggiornaQuaderno(
  {
    disegni: paginaAggiornata.disegni,
    oggettiGrafici:
      paginaAggiornata.oggettiGrafici ?? [],
  },
  false,
);

setPagineQuaderno((pagineCorrenti) =>
  pagineCorrenti.map((pagina, index) =>
    index === paginaCorrenteIndex
      ? {
          ...pagina,
          disegni: paginaAggiornata.disegni,
          oggettiGrafici:
            paginaAggiornata.oggettiGrafici ?? [],
          cadEntities:
            paginaAggiornata.cadEntities ??
            nuoveEntitaCad,
        }
      : pagina,
  ),
);

  setCadEntitySelezionataId(null);

  setCadEntitySelezionateIds(
    risultato.entities.map(
      (entity) => entity.id,
    ),
  );
};

  const [zoomSfondo, setZoomSfondo] = useState(1);
  const [sfondoX, setSfondoX] = useState(0);
  const [sfondoY, setSfondoY] = useState(0);
const [viewportScale, setViewportScale] = useState(1);

const [viewportOffset, setViewportOffset] = useState({
  x: 0,
  y: 0,
});
const adattaWorkspaceAllaFinestra = () => {
  const viewport =
    viewportRef.current

  if (
    !viewport ||
    pagineQuaderno.length === 0
  ) {
    return
  }

  const bounds =
    pagineQuaderno.reduce(
      (correnti, pagina) => {
        const layout =
          pagina.pageLayout ??
          createQuadernoPageLayout()

        const x =
          pagina.workspaceX ?? 0

        const y =
          pagina.workspaceY ?? 0

        return {
          minX: Math.min(
            correnti.minX,
            x,
          ),
          minY: Math.min(
            correnti.minY,
            y,
          ),
          maxX: Math.max(
            correnti.maxX,
            x + layout.width,
          ),
          maxY: Math.max(
            correnti.maxY,
            y + layout.height,
          ),
        }
      },
      {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
      },
    )

  const boundsWidth =
    bounds.maxX - bounds.minX

  const boundsHeight =
    bounds.maxY - bounds.minY

  if (
    boundsWidth <= 0 ||
    boundsHeight <= 0
  ) {
    return
  }

  const rect =
    viewport.getBoundingClientRect()

  const margine = 48

  const scalaX =
    Math.max(
      1,
      rect.width - margine * 2,
    ) / boundsWidth

  const scalaY =
    Math.max(
      1,
      rect.height - margine * 2,
    ) / boundsHeight

  const nuovaScala =
    clampViewportScale(
      Math.min(scalaX, scalaY),
    )

  setViewportScale(nuovaScala)

  const centroBoundsX =
    bounds.minX + boundsWidth / 2

  const centroBoundsY =
    bounds.minY + boundsHeight / 2

  setViewportOffset({
    x:
      rect.width / 2 -
      centroBoundsX * nuovaScala,
    y:
      rect.height / 2 -
      centroBoundsY * nuovaScala,
  })
}

useEffect(() => {
  if (!testoCadSelezionato) {
    setNuovaDimensioneTesto("")
    return
  }

  setNuovaDimensioneTesto(
    String(
      testoCadSelezionato.metadati?.fontSize ??
        testoCadSelezionato.spessore,
    ),
  )
}, [testoCadSelezionato])

useEffect(() => {
  if (!testoCadSelezionato) {
    setNuovoFontTesto("Arial")
    return
  }

  setNuovoFontTesto(
    testoCadSelezionato.metadati?.fontFamily ??
      "Arial",
  )
}, [testoCadSelezionato])


useEffect(() => {
  if (!testoCadSelezionato) {
    setTestoGrassetto(false)
    return
  }

  setTestoGrassetto(
    testoCadSelezionato.metadati?.fontWeight ===
      "bold",
  )
}, [testoCadSelezionato])


useEffect(() => {
  if (!testoCadSelezionato) {
    setTestoCorsivo(false)
    return
  }

  setTestoCorsivo(
    testoCadSelezionato.metadati?.fontStyle ===
      "italic",
  )
}, [testoCadSelezionato])


useEffect(() => {
  const viewport = viewportRef.current;

  if (!viewport) {
    return;
  }

  const handleWheel = (event: WheelEvent) => {
  if (!event.ctrlKey) {
    return;
  }

  event.preventDefault();

  const viewport = viewportRef.current;

  if (!viewport) {
    return;
  }

  const contenutoViewport =
  viewportContentRef.current;

if (!contenutoViewport) {
  return;
}

const rectContenuto =
  contenutoViewport.getBoundingClientRect();

const cursoreX =
  event.clientX - rectContenuto.left;

const cursoreY =
  event.clientY - rectContenuto.top;

setViewportScale((scalaCorrente) => {
  const incremento =
    event.deltaY < 0 ? 0.1 : -0.1;

  const nuovaScala =
    clampViewportScale(
      Number(
        (
          scalaCorrente +
          incremento
        ).toFixed(2),
      ),
    );

  if (nuovaScala === scalaCorrente) {
    return scalaCorrente;
  }

  setViewportOffset((offsetCorrente) => {
    const risultatoZoom =
      calculateZoomAtPoint({
        currentScale: scalaCorrente,
        nextScale: nuovaScala,
        currentOffset: offsetCorrente,
        anchorPoint: {
          x: cursoreX,
          y: cursoreY,
        },
      });

    return risultatoZoom.offset;
  });

  return nuovaScala;
});
};


 viewport.addEventListener(
  "wheel",
  handleWheel,
  {
    passive: false,
  },
);

return () => {
  viewport.removeEventListener(
    "wheel",
    handleWheel,
  );
};
}, []);



const gestisciZoomMouse = (
  event: React.WheelEvent<HTMLDivElement>,
) => {
  if (!event.ctrlKey) {
    return;
  }

  event.preventDefault();

  const rettangolo =
    event.currentTarget.getBoundingClientRect();

  const cursoreX =
    event.clientX - rettangolo.left;

  const cursoreY =
    event.clientY - rettangolo.top;

  const incremento =
    event.deltaY < 0 ? 0.1 : -0.1;

  const nuovaScala = Math.min(
    4,
    Math.max(
      0.25,
      Number(
        (viewportScale + incremento).toFixed(2),
      ),
    ),
  );

  if (nuovaScala === viewportScale) {
    return;
  }

  const rapporto =
    nuovaScala / viewportScale;

  setViewportOffset((offsetCorrente) => ({
    x:
      offsetCorrente.x +
      cursoreX * (1 - rapporto),
    y:
      offsetCorrente.y +
      cursoreY * (1 - rapporto),
  }));

  setViewportScale(nuovaScala);
};

const [manoAttiva, setManoAttiva] = useState(false);
const [panInCorso, setPanInCorso] = useState(false);
const [spostaTavolaAttivo, setSpostaTavolaAttivo] =
  useState(false);

const [spostaEntitaAttivo, setSpostaEntitaAttivo] =
  useState(false)

const spostaEntitaRef = useRef<{
  attivo: boolean
  start: CadPoint | null
}>({
  attivo: false,
  start: null,
})

const trascinamentoPaginaRef = useRef<{
  attivo: boolean
  paginaId: string | null

  startClientX: number
  startClientY: number

  startWorkspaceX: number
  startWorkspaceY: number

  currentWorkspaceX: number
  currentWorkspaceY: number

  pagineSelezionateIniziali: {
    id: string
    x: number
    y: number
  }[]

  elemento: HTMLDivElement | null
}>({
  attivo: false,
  paginaId: null,

  startClientX: 0,
  startClientY: 0,

  startWorkspaceX: 0,
  startWorkspaceY: 0,

  currentWorkspaceX: 0,
  currentWorkspaceY: 0,

  pagineSelezionateIniziali: [],

  elemento: null,
})

const iniziaTrascinamentoPagina = (
  event: React.PointerEvent<HTMLDivElement>,
  pagina: PaginaQuadernoNota,
) => {
 if (
  !spostaTavolaAttivo ||
  manoAttiva ||
  strumentoDisegno !== null ||
  areaAttiva ||
  areaSplitAttivo ||
  metroAttivo ||
  calibrazioneScalaAttiva ||
  trimAttivo
) {
  return
}

 event.preventDefault()
event.stopPropagation()

if (
  !event.ctrlKey &&
  !event.metaKey &&
  !event.shiftKey &&
  !pagineWorkspaceSelezionateIds.includes(
    pagina.id,
  )
) {
    setPagineWorkspaceSelezionateIds([
    pagina.id,
  ])
}

const startWorkspaceX =
  pagina.workspaceX ?? 0

const startWorkspaceY =
  pagina.workspaceY ?? 0

const pagineSelezionateIniziali =
  pagineWorkspaceSelezionateIds.includes(
    pagina.id,
  )
    ? pagineQuaderno
        .filter((paginaCorrente) =>
          pagineWorkspaceSelezionateIds.includes(
            paginaCorrente.id,
          ),
        )
        .map((paginaCorrente) => ({
          id: paginaCorrente.id,
          x: paginaCorrente.workspaceX ?? 0,
          y: paginaCorrente.workspaceY ?? 0,
        }))
    : []

trascinamentoPaginaRef.current = {

  attivo: true,
  paginaId: pagina.id,

  startClientX: event.clientX,
  startClientY: event.clientY,

  startWorkspaceX,
  startWorkspaceY,

  currentWorkspaceX: startWorkspaceX,
  currentWorkspaceY: startWorkspaceY,

  pagineSelezionateIniziali,

  elemento: event.currentTarget,
}
  event.currentTarget.setPointerCapture(
    event.pointerId,
  )
}

const trascinaPagina = (
  event: React.PointerEvent<HTMLDivElement>,
) => {
  const stato =
    trascinamentoPaginaRef.current

  if (
    !stato.attivo ||
    !stato.paginaId
  ) {
    return
  }

  const deltaX =
    (event.clientX - stato.startClientX) /
    viewportScale

  const deltaY =
    (event.clientY - stato.startClientY) /
    viewportScale

  let nuovoX =
  stato.startWorkspaceX + deltaX

let nuovoY =
  stato.startWorkspaceY + deltaY

const paginaTrascinata =
  pagineQuaderno.find(
    (pagina) =>
      pagina.id === stato.paginaId,
  )

if (paginaTrascinata) {
  const layoutTrascinata =
    paginaTrascinata.pageLayout ??
    createQuadernoPageLayout()

  const tolleranzaSnap = 20

  for (const altraPagina of pagineQuaderno) {
  if (
    altraPagina.id ===
      paginaTrascinata.id ||
    stato.pagineSelezionateIniziali.some(
      (paginaSelezionata) =>
        paginaSelezionata.id ===
        altraPagina.id,
    )
  ) {
    continue
  }

    const altroLayout =
      altraPagina.pageLayout ??
      createQuadernoPageLayout()

    const altroX =
      altraPagina.workspaceX ?? 0

    const altroY =
      altraPagina.workspaceY ?? 0

    const bordoDestroTrascinata =
      nuovoX +
      layoutTrascinata.width

    const bordoSinistroTrascinata =
      nuovoX

    const bordoBassoTrascinata =
      nuovoY +
      layoutTrascinata.height

    const bordoAltoTrascinata =
      nuovoY

    const bordoDestroAltra =
      altroX +
      altroLayout.width

    const bordoSinistroAltra =
      altroX

    const bordoBassoAltra =
      altroY +
      altroLayout.height

    const bordoAltoAltra =
      altroY

    if (
      Math.abs(
        bordoDestroTrascinata -
          bordoSinistroAltra,
      ) <= tolleranzaSnap
    ) {
      nuovoX =
        bordoSinistroAltra -
        layoutTrascinata.width
    }

    if (
      Math.abs(
        bordoSinistroTrascinata -
          bordoDestroAltra,
      ) <= tolleranzaSnap
    ) {
      nuovoX =
        bordoDestroAltra
    }

    if (
      Math.abs(
        bordoBassoTrascinata -
          bordoAltoAltra,
      ) <= tolleranzaSnap
    ) {
      nuovoY =
        bordoAltoAltra -
        layoutTrascinata.height
    }

    if (
      Math.abs(
        bordoAltoTrascinata -
          bordoBassoAltra,
      ) <= tolleranzaSnap
    ) {
      nuovoY =
        bordoBassoAltra
    }
  }
}

stato.currentWorkspaceX = nuovoX
stato.currentWorkspaceY = nuovoY

const deltaFinaleX =
  nuovoX - stato.startWorkspaceX

const deltaFinaleY =
  nuovoY - stato.startWorkspaceY

for (
  const paginaSelezionata of
  stato.pagineSelezionateIniziali
) {
  if (
    paginaSelezionata.id ===
    stato.paginaId
  ) {
    continue
  }

  const elementoPagina =
    document.querySelector<HTMLElement>(
      `[data-quaderno-page-id="${paginaSelezionata.id}"]`,
    )

  if (!elementoPagina) {
    continue
  }

  elementoPagina.style.left =
    `${
      paginaSelezionata.x +
      deltaFinaleX
    }px`

  elementoPagina.style.top =
    `${
      paginaSelezionata.y +
      deltaFinaleY
    }px`
}

if (stato.elemento) {
  stato.elemento.style.left =
    `${nuovoX}px`

  stato.elemento.style.top =
    `${nuovoY}px`
}
}

const spostaPagineWorkspaceSelezionate = (
  deltaX: number,
  deltaY: number,
) => {
  if (
    !spostaTavolaAttivo ||
    pagineWorkspaceSelezionateIds.length === 0
  ) {
    return
  }

  const pagineSpostateIds =
    pagineWorkspaceSelezionateIds

  setWorkspaceCadEntities(
    (entitiesCorrenti) =>
      moveEntities(
        entitiesCorrenti,
        entitiesCorrenti
          .filter((entity) => {
            const workspacePageId =
              entity.metadata?.workspacePageId

            return (
              typeof workspacePageId === "string" &&
              pagineSpostateIds.includes(
                workspacePageId,
              )
            )
          })
          .map((entity) => entity.id),
        deltaX,
        deltaY,
      ).entities,
  )

  setPagineQuaderno((pagineCorrenti) =>
    pagineCorrenti.map((pagina) =>
      pagineSpostateIds.includes(pagina.id)
        ? {
            ...pagina,
            workspaceX:
              (pagina.workspaceX ?? 0) +
              deltaX,
            workspaceY:
              (pagina.workspaceY ?? 0) +
              deltaY,
          }
        : pagina,
    ),
  )

  setQuadernoDirty(true)
}
const terminaTrascinamentoPagina = (

  event: React.PointerEvent<HTMLDivElement>,
) => {
  if (
  !trascinamentoPaginaRef.current.attivo
) {
  return
}

const stato =
  trascinamentoPaginaRef.current

if (stato.paginaId) {
  const deltaFinaleX =
    stato.currentWorkspaceX -
    stato.startWorkspaceX

  const deltaFinaleY =
    stato.currentWorkspaceY -
    stato.startWorkspaceY

  const pagineSpostateIds =
    stato.pagineSelezionateIniziali.length > 0
      ? stato.pagineSelezionateIniziali.map(
          (pagina) => pagina.id,
        )
      : [stato.paginaId]

 setWorkspaceCadEntities(
  (entitiesCorrenti) =>
    moveEntities(
      entitiesCorrenti,
      entitiesCorrenti
        .filter((entity) => {
          const workspacePageId =
            entity.metadata?.workspacePageId

          return (
            typeof workspacePageId === "string" &&
            pagineSpostateIds.includes(
              workspacePageId,
            )
          )
        })
        .map((entity) => entity.id),
      deltaFinaleX,
      deltaFinaleY,
    ).entities,
)


  setPagineQuaderno(
    (pagineCorrenti) =>
      pagineCorrenti.map((pagina) => {

        const posizioneIniziale =
          stato.pagineSelezionateIniziali.find(
            (paginaSelezionata) =>
              paginaSelezionata.id ===
              pagina.id,
          )

        if (posizioneIniziale) {
          return {
            ...pagina,
            workspaceX:
              posizioneIniziale.x +
              deltaFinaleX,
            workspaceY:
              posizioneIniziale.y +
              deltaFinaleY,
          }
        }

        if (
          pagina.id ===
          stato.paginaId
        ) {
          return {
            ...pagina,
            workspaceX:
              stato.currentWorkspaceX,
            workspaceY:
              stato.currentWorkspaceY,
          }
        }

        return pagina
      }),
  )

  setQuadernoDirty(true)
}
trascinamentoPaginaRef.current = {
  attivo: false,
  paginaId: null,

  startClientX: 0,
  startClientY: 0,

  startWorkspaceX: 0,
  startWorkspaceY: 0,

  currentWorkspaceX: 0,
  currentWorkspaceY: 0,

  pagineSelezionateIniziali: [],

  elemento: null,
}
  if (
    event.currentTarget.hasPointerCapture(
      event.pointerId,
    )
  ) {



    event.currentTarget.releasePointerCapture(
      event.pointerId,
    )
  }
}

const [workspaceCadEntities, setWorkspaceCadEntities] =
  useState<CadEntity[]>([])

const [workspaceTestoDraft, setWorkspaceTestoDraft] = useState<{
  position: CadPoint
  content: string
  entityId?: string // Absent for creation; existing Workspace ID for editing.
} | null>(null)
const workspaceTestoMoveRef = useRef<{
  entityId: string
  pointerId: number
  previous: CadPoint
  target: SVGGElement
  snapshot: QuadernoHistorySnapshot
  changed: boolean
} | null>(null)
const terminaMoveTestoWorkspace = (event: React.PointerEvent<SVGGElement>) => {
  const gesture = workspaceTestoMoveRef.current
  if (!gesture || gesture.pointerId !== event.pointerId) return
  event.stopPropagation()
  workspaceTestoMoveRef.current = null
  if (gesture.changed) {
    registraSnapshotQuaderno(gesture.snapshot)
    setQuadernoDirty(true)
  }
  if (gesture.target.hasPointerCapture(event.pointerId)) {
    gesture.target.releasePointerCapture(event.pointerId)
  }
}
const workspaceTestoResizeRef = useRef<{
  entityId: string
  pointerId: number
  side: "left" | "right"
  start: CadPoint
  position: CadPoint
  width: number
  rotation: number
  alignment: "left" | "center" | "right"
  snapshot: QuadernoHistorySnapshot
  changed: boolean
} | null>(null)
const terminaResizeTestoWorkspace = (event: React.PointerEvent<SVGRectElement>) => {
  const gesture = workspaceTestoResizeRef.current
  if (!gesture || gesture.pointerId !== event.pointerId) return
  event.stopPropagation()
  workspaceTestoResizeRef.current = null
  if (gesture.changed) {
    registraSnapshotQuaderno(gesture.snapshot)
    setQuadernoDirty(true)
  }
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
}
const workspaceTestoInputRef = useRef<HTMLTextAreaElement>(null)
const workspaceTestoEditorRef = useRef<SVGForeignObjectElement>(null)
const workspaceTestoCompositionRef = useRef(false)

const workspaceGommaRef = useRef<{
  pointerId: number
  previous: CadPoint
  radius: number
  entities: CadEntity[]
  snapshot: QuadernoHistorySnapshot
  changed: boolean
} | null>(null)

// Same client-to-viewBox conversion as the existing Workspace pointer handlers.
const puntoGommaWorkspace = (
  event: React.PointerEvent<SVGSVGElement>,
  sample: { clientX: number; clientY: number } = event,
): CadPoint => {
  const rect = event.currentTarget.getBoundingClientRect()
  return {
    x: ((sample.clientX - rect.left) / rect.width) * dimensioniWorkspace.width,
    y: ((sample.clientY - rect.top) / rect.height) * dimensioniWorkspace.height,
  }
}

const applicaGommaWorkspace = (point: CadPoint) => {
  const gesture = workspaceGommaRef.current
  if (!gesture) return
  let changed = false
  const entities = gesture.entities.flatMap((entity): CadEntity[] => {
    if (entity.type !== "freehand") return [entity]
    const layer = layers.find((item) => item.id === entity.layerId)
    if (
      entity.locked === true ||
      entity.visible === false ||
      entity.selectable === false ||
      !layer ||
      layer.locked === true ||
      layer.visible === false ||
      layer.selectable === false
    ) return [entity]
    const result = eraseFreehand(entity, gesture.previous, point, gesture.radius)
    changed ||= result.changed
    return result.entities
  })
  gesture.previous = point
  if (!changed) return
  gesture.entities = entities
  gesture.changed = true
  setWorkspaceCadEntities(entities)
  setQuadernoDirty(true)
}

const terminaGommaWorkspace = (event: React.PointerEvent<SVGSVGElement>, finalPoint = false) => {
  const gesture = workspaceGommaRef.current
  if (!gesture || gesture.pointerId !== event.pointerId) return
  if (finalPoint) applicaGommaWorkspace(puntoGommaWorkspace(event))
  workspaceGommaRef.current = null
  if (gesture.changed) registraSnapshotQuaderno(gesture.snapshot)
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
}


  const [pagineQuaderno, setPagineQuaderno] = useState<PaginaQuadernoNota[]>([
    {
      id: crypto.randomUUID(),
      titolo: "Pagina 1",
      disegni: [],
      sfondoDisegno: null,
      zoomSfondo: 1,
      oggettiGrafici: [],
    },
  ]);
  const [paginaCorrenteIndex, setPaginaCorrenteIndex] = useState(0);


const paginaQuadernoCorrente =
  pagineQuaderno[paginaCorrenteIndex] ?? null

const puntoPaginaAttivaToWorkspace = (
  point: CadPoint,
): CadPoint => {
  if (!paginaQuadernoCorrente) {
    return point
  }

  return pagePointToWorkspacePoint(
    point,
    paginaQuadernoCorrente,
  )
}

const trovaPaginaDaPuntoWorkspace = (
  point: CadPoint,
): PaginaQuadernoNota | null => {
  for (const pagina of pagineQuaderno) {
    const layout =
      pagina.pageLayout ??
      createQuadernoPageLayout()

    const x =
      pagina.workspaceX ?? 0

    const y =
      pagina.workspaceY ?? 0

    if (
      point.x >= x &&
      point.x <= x + layout.width &&
      point.y >= y &&
      point.y <= y + layout.height
    ) {
      return pagina
    }
  }

  return null
}

const puntoWorkspaceToPaginaAttiva = (
  point: CadPoint,
): CadPoint => {
  if (!paginaQuadernoCorrente) {
    return point
  }

  return workspacePointToPagePoint(
    point,
    paginaQuadernoCorrente,
  )
}

const workspaceSnapEntities: CadEntity[] = [
  ...pagineQuaderno.flatMap(
    (pagina, index) => {
      const paginaPerCad: PaginaQuadernoNota =
        index === paginaCorrenteIndex
          ? {
              ...pagina,
              disegni,
              sfondoDisegno,
              zoomSfondo,
              oggettiGrafici,
              layers,
              backgroundTransform,
            }
          : pagina

      const entities =
        getCadEntitiesFromPage(
          paginaPerCad,
        )

      return entities.flatMap(
  (entity): CadEntity[] => {
    if (entity.type === "line") {
      return [
        {
          ...entity,
          start:
            pagePointToWorkspacePoint(
              entity.start,
              pagina,
            ),
          end:
            pagePointToWorkspacePoint(
              entity.end,
              pagina,
            ),
        },
      ]
    }

    if (entity.type === "area") {
      return [
        {
          ...entity,
          points: entity.points.map(
            (point) =>
              pagePointToWorkspacePoint(
                point,
                pagina,
              ),
          ),
        },
      ]
    }

    return []
  },
)
    },
  ),

  ...workspaceCadEntities,
]

const lineeRiferimentoPerpendicolare = workspaceSnapEntities.filter(
  (entity): entity is CadLineEntity => {
    if (entity.type !== "line" || !entity.visible || entity.locked || !entity.selectable) return false
    const layer = layers.find((item) => item.id === entity.layerId)
    return layer?.visible !== false && !layer?.locked && layer?.selectable !== false &&
      perpendicularDirection(entity.start, entity.end) !== null
  },
)

const workspaceRenderEntities: CadEntity[] = [
  ...workspaceSnapEntities,
]

const workspaceRenderEntitiesOrdinati =
  [...workspaceRenderEntities].sort(
    (a, b) =>
      (a.zOrder ?? 0) -
      (b.zOrder ?? 0),
  )

const [
  colonneWorkspace,
  setColonneWorkspace,
] = useState(2)

const [
  pagineWorkspaceSelezionateIds,
  setPagineWorkspaceSelezionateIds,
] = useState<string[]>([])


useEffect(() => {
  }, [
  paginaCorrenteIndex,
  paginaQuadernoCorrente?.id,
  pagineWorkspaceSelezionateIds,
])

const selectionStateCad: CadSelectionState = {

  selectedIds: cadEntitySelezionateIds,
  primarySelectionId:
    cadEntitySelezionataId,
  hoveredEntityId: null,
  source: "programmatic",
}

const entitaCadPaginaCorrente =
  paginaQuadernoCorrente
    ? getCadEntitiesFromPage({
        ...paginaQuadernoCorrente,
        disegni,
        sfondoDisegno,
        zoomSfondo,
        oggettiGrafici,
        layers,
        backgroundTransform,
      })
    : []

const entitaCadSelezionata =
  getPrimarySelectedEntity(
    [
      ...entitaCadPaginaCorrente,
      ...workspaceCadEntities,
    ],
    selectionStateCad,
  )
const entitaCadSelezionate =
  [
    ...entitaCadPaginaCorrente,
    ...workspaceCadEntities,
  ].filter(
    (entity) =>
      cadEntitySelezionateIds.includes(
        entity.id,
      ),
  )

const testoWorkspaceSelezionato = workspaceCadEntities.find(
  entity => entity.id === cadEntitySelezionataId && entity.type === "text",
)
const testoWorkspaceProprieta = testoWorkspaceSelezionato?.type === "text" ? testoWorkspaceSelezionato : null
const layerTestoWorkspace = layers.find(layer => layer.id === testoWorkspaceProprieta?.layerId)
const testoWorkspaceModificabile = !!(testoWorkspaceProprieta?.visible &&
  testoWorkspaceProprieta.selectable && !testoWorkspaceProprieta.locked &&
  layerTestoWorkspace?.visible && layerTestoWorkspace.selectable !== false && !layerTestoWorkspace.locked)
const fontTestoWorkspace = ["Arial", "Helvetica", "Times New Roman", "Georgia", "Verdana", "Courier New"]
const aggiornaProprietaTestoWorkspace = (patch: { fontFamily: string } | { fontSize: number }) => {
  if (!testoWorkspaceProprieta || !testoWorkspaceModificabile) return
  if ("fontSize" in patch && (!Number.isFinite(patch.fontSize) || patch.fontSize <= 0 ||
      patch.fontSize === testoWorkspaceProprieta.fontSize)) return
  if ("fontFamily" in patch && (!patch.fontFamily || patch.fontFamily === testoWorkspaceProprieta.fontFamily)) return
  registraSnapshotQuaderno()
  const id = testoWorkspaceProprieta.id
  const updatedAt = new Date().toISOString()
  setWorkspaceCadEntities(entities => entities.map(entity => entity.id === id && entity.type === "text"
    ? { ...entity, ...patch, updatedAt } : entity))
  setQuadernoDirty(true)
}

const quotaWorkspaceSelezionata =
  entitaCadSelezionata?.type === "dimension" &&
  workspaceCadEntities.some(
    (entity) =>
      entity.id === entitaCadSelezionata.id,
  )
    ? entitaCadSelezionata
    : null

const layerIdsSelezione =
  Array.from(
    new Set(
      entitaCadSelezionate.map(
        (entity) => entity.layerId,
      ),
    ),
  )

const layerSelezioneId =
  layerIdsSelezione.length === 1
    ? layerIdsSelezione[0]
    : null

const layerSelezione =
  layerSelezioneId
    ? layers.find(
        (layer) =>
          layer.id === layerSelezioneId,
      ) ?? null
    : null

const areeCadSelezionate = [
  ...entitaCadPaginaCorrente,
  ...workspaceCadEntities,
].filter(
  (entity): entity is CadAreaEntity =>
    entity.type === "area" &&
    cadEntitySelezionateIds.includes(
      entity.id,
    ),
)
const areaCadSelezionata =
  entitaCadSelezionata?.type === "area"
    ? entitaCadSelezionata
    : null

const oggettoGraficoSelezionato = oggettiGrafici.find(
  (oggetto) => oggetto.id === oggettoGraficoSelezionatoId,
);

const percentualeScalaImmagine =
  oggettoGraficoSelezionato?.larghezzaIniziale
    ? Math.round(
        (oggettoGraficoSelezionato.transform.width /
          oggettoGraficoSelezionato.larghezzaIniziale) *
          100,
      )
    : 100;

const aggiornaScalaImmagineSelezionata = (
  percentuale: number,
) => {
  if (!oggettoGraficoSelezionato) return;

  const larghezzaBase =
    oggettoGraficoSelezionato.larghezzaIniziale ??
    oggettoGraficoSelezionato.transform.width;

  const altezzaBase =
    oggettoGraficoSelezionato.altezzaIniziale ??
    oggettoGraficoSelezionato.transform.height;

  const scala = Math.max(0.25, Math.min(4, percentuale / 100));

  const centroX =
    oggettoGraficoSelezionato.transform.x +
    oggettoGraficoSelezionato.transform.width / 2;

  const centroY =
    oggettoGraficoSelezionato.transform.y +
    oggettoGraficoSelezionato.transform.height / 2;

  const nuovaWidth = larghezzaBase * scala;
  const nuovaHeight = altezzaBase * scala;



  const oggettiAggiornati = oggettiGrafici.map((oggetto) =>
    oggetto.id === oggettoGraficoSelezionato.id
      ? {
          ...oggetto,
          larghezzaIniziale:
            oggetto.larghezzaIniziale ?? larghezzaBase,
          altezzaIniziale:
            oggetto.altezzaIniziale ?? altezzaBase,
          transform: {
            ...oggetto.transform,
            x: centroX - nuovaWidth / 2,
            y: centroY - nuovaHeight / 2,
            width: nuovaWidth,
            height: nuovaHeight,
          },
        }
      : oggetto,
  );

  aggiornaQuaderno({
    oggettiGrafici: oggettiAggiornati,
  });
};

  const pinSelezionato = disegni.find((segno) => segno.id === pinSelezionatoId);

  const aggiornaMetadatiPin = (
    campo: "titolo" | "descrizione" | "stato",
    valore: string,
  ) => {
    if (!pinSelezionatoId) return;

    aggiornaDisegni(
      disegni.map((segno) =>
        segno.id === pinSelezionatoId
          ? {
              ...segno,
              metadati: {
                ...segno.metadati,
                [campo]: valore,
              },
            }
          : segno,
      ),
    );
  };

  const [strumentoDisegno, setStrumentoDisegno] = useState<
    StrumentoDisegno | null | false
  >(null);

  const [modalitaSelezione, setModalitaSelezione] = useState(true);

  const [coloreDisegno, setColoreDisegno] = useState("#111827");
const [dimensioneTesto, setDimensioneTesto] =
  useState(16)

  const [spessoreDisegno, setSpessoreDisegno] = useState(2);
type ProfiloStrumento = {
  colore: string;
  spessore: number;
};
const PROFILI_PREDEFINITI: Record<
  StrumentoDisegno,
  ProfiloStrumento
> = {
  penna: {
    colore: "#111827",
    spessore: 2,
  },
  evidenziatore: {
    colore: "#facc15",
    spessore: 12,
  },
  freccia: {
    colore: "#dc2626",
    spessore: 2,
  },
  linea: {
    colore: "#111827",
    spessore: 1,
  },

perpendicolare: {
  colore: "#111827",
  spessore: 1,
},
  rettangolo: {
    colore: "#2563eb",
    spessore: 2,
  },
  cerchio: {
    colore: "#16a34a",
    spessore: 2,
  },

testo: {
  colore: "#111827",
  spessore: 18,
},
  gomma: {
    colore: "#111827",
    spessore: 18,
  },
  pin: {
    colore: "#dc2626",
    spessore: 2,
  },
};
const [profiliStrumenti, setProfiliStrumenti] = useState<
  Partial<Record<StrumentoDisegno, ProfiloStrumento>>
>({});
// The existing eraser profile stores its diameter in Workspace units.
const diametroGomma = spessoreDisegno
const [workspaceGommaCursor, setWorkspaceGommaCursor] = useState<CadPoint | null>(null)
useEffect(() => {
  setWorkspaceGommaCursor(null)
}, [strumentoDisegno])

useEffect(() => {
  if (strumentoDisegno !== "testo") {
    setWorkspaceTestoDraft((draft) => draft?.entityId ? draft : null)
    workspaceTestoCompositionRef.current = false
  }
}, [strumentoDisegno])

const workspaceTestoOriginale = workspaceTestoDraft?.entityId
  ? workspaceCadEntities.find((entity) => entity.id === workspaceTestoDraft.entityId && entity.type === "text")
  : null
const workspaceTestoStile = workspaceTestoOriginale?.type === "text" ? workspaceTestoOriginale : null
const workspaceTestoLayout = workspaceTestoDraft ? getCadTextLayout({
  position: workspaceTestoDraft.position,
  content: workspaceTestoDraft.content,
  fontSize: workspaceTestoStile?.fontSize ?? dimensioneTesto,
  alignment: workspaceTestoStile?.alignment ?? "left",
  metadata: workspaceTestoStile?.metadata,
}) : null

// DOM sizing is confined to the editor; CAD layout remains deterministic.
useLayoutEffect(() => {
  const input = workspaceTestoInputRef.current
  const editor = workspaceTestoEditorRef.current
  if (!input || !editor) return
  input.style.height = "auto"
  const height = Math.max(36, (workspaceTestoLayout?.lines.length ?? 1) *
    (workspaceTestoLayout?.lineHeight ?? 20), input.scrollHeight)
  input.style.height = height + "px"
  editor.setAttribute("height", String(height))
}, [workspaceTestoDraft, workspaceTestoStile, dimensioneTesto,
  workspaceTestoLayout?.lineHeight, workspaceTestoLayout?.lines.length])

const confermaTestoWorkspace = () => {
  if (!workspaceTestoDraft || workspaceTestoCompositionRef.current) return
  if (workspaceTestoDraft.entityId) {
    const entity = workspaceCadEntities.find((item) => item.id === workspaceTestoDraft.entityId)
    const layer = layers.find((item) => item.id === entity?.layerId)
    if (entity?.type === "text" && entity.visible && !entity.locked && entity.selectable &&
        layer && layer.visible && !layer.locked && layer.selectable !== false &&
        workspaceTestoDraft.content.trim() && workspaceTestoDraft.content !== entity.content) {
      registraSnapshotQuaderno()
      const content = workspaceTestoDraft.content
      const updatedAt = new Date().toISOString()
      setWorkspaceCadEntities((entities) => entities.map((item) =>
        item.id === entity.id && item.type === "text" ? { ...item, content, updatedAt } : item,
      ))
      setQuadernoDirty(true)
    }
    setWorkspaceTestoDraft(null)
    return
  }
  const layer = layers.find((item) => item.id === layerAttivoId)
  if (workspaceTestoDraft.content.trim() && layer &&
      !layer.locked && layer.visible !== false && layer.selectable !== false) {
    const entity = createCadText({
      position: workspaceTestoDraft.position,
      content: workspaceTestoDraft.content,
      metadata: { textBoxWidth: DEFAULT_TEXT_BOX_WIDTH },
      fontSize: dimensioneTesto,
      color: coloreDisegno,
      layerId: layer.id,
      visible: true,
      selectable: true,
      locked: false,
    })
    registraSnapshotQuaderno()
    setWorkspaceCadEntities((entities) => [...entities, entity])
    setCadEntitySelezionataId(entity.id)
    setCadEntitySelezionateIds([entity.id])
    setQuadernoDirty(true)
  }
  setWorkspaceTestoDraft(null)
}

const [orthoAttivo, setOrthoAttivo] = useState(false)
const [gridSnapAttivo, setGridSnapAttivo] = useState(false)
const [metroAttivo, setMetroAttivo] =
  useState(false)
const [trimAttivo, setTrimAttivo] = useState(false)


const [areaAttiva, setAreaAttiva] =
  useState(false)
const [areaSplitAttivo, setAreaSplitAttivo] =
  useState(false)

const [gridSize] = useState(24)

const [polarTrackingAttivo, setPolarTrackingAttivo] = useState(false)
const [snapAttivo, setSnapAttivo] = useState(true);

const [
  perpTrackingAttivo,
  setPerpTrackingAttivo,
] = useState(true)

const [polarIncrement] = useState(45)
const [polarTolerance] = useState(8)
const [scaleCalibration, setScaleCalibration] =
  useState<CadScaleCalibration | null>(null)

// Freccia usa gli stessi vincoli CAD sia in preview sia alla conferma.
const vincolaPuntoFrecciaWorkspace = (
  start: CadPoint,
  point: CadPoint,
  snapped: boolean,
): CadPoint => {
  if (snapped) return point
  if (orthoAttivo) return applyOrtho(start, point)
  return polarTrackingAttivo
    ? applyPolar(start, point, polarIncrement, polarTolerance)
    : point
}

useEffect(() => {
  if (strumentoDisegno !== "perpendicolare") return
  return () => {
    setWorkspacePerpendicolareRiferimento(null)
    workspaceLineaStartRef.current = null
    setWorkspaceLineaPreview(null)
    setWorkspaceSnapPoint(null)
  }
}, [strumentoDisegno])

useEffect(() => {
  if (strumentoDisegno !== "freccia") return

  return () => {
    workspaceLineaStartRef.current = null
    setWorkspaceLineaPreview(null)
    setWorkspaceSnapPoint(null)
  }
}, [strumentoDisegno])


useEffect(() => {
  const svg = workspaceSvgRef.current

  if (
    !svg ||
    (
      strumentoDisegno !== "penna" &&
      strumentoDisegno !== "evidenziatore" &&
      strumentoDisegno !== "gomma"
    )
  ) {
    return
  }

  const handleTouchStart = (event: TouchEvent) => {
    const touch = event.changedTouches[0]

    if (!touch) {
      return
    }

    const touchType =
      "touchType" in touch
        ? touch.touchType
        : undefined

    if (touchType !== "stylus") {
      return
    }

    if (event.cancelable) {
      event.preventDefault()
    }
  }

  svg.addEventListener(
    "touchstart",
    handleTouchStart,
    { passive: false },
  )

  return () => {
    svg.removeEventListener(
      "touchstart",
      handleTouchStart,
    )
  }
}, [strumentoDisegno])

const lunghezzaLineaSelezionata = (() => {
  if (!lineaCadSelezionata) return null;
  if (!scaleCalibration) return null;

  const primo = lineaCadSelezionata.punti[0];
  const ultimo =
    lineaCadSelezionata.punti[
      lineaCadSelezionata.punti.length - 1
    ];

  if (!primo || !ultimo) return null;

  const pixel = Math.hypot(
    ultimo.x - primo.x,
    ultimo.y - primo.y,
  );

  return (
    (pixel / scaleCalibration.pixelDistance) *
    scaleCalibration.realDistance
  );
})();

const [calibrazioneScalaAttiva, setCalibrazioneScalaAttiva] =
  useState(false)

  useEffect(() => {
    const preferenze = window.localStorage.getItem(
      "artecna-quaderno-preferenze",
    );
    if (!preferenze) return;

    try {
      const dati = JSON.parse(preferenze);
      if (dati.coloreDisegno) setColoreDisegno(dati.coloreDisegno);
      if (dati.spessoreDisegno) setSpessoreDisegno(dati.spessoreDisegno);
if (dati.profiliStrumenti) {
  setProfiliStrumenti(dati.profiliStrumenti);
}
    } catch {
      window.localStorage.removeItem("artecna-quaderno-preferenze");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "artecna-quaderno-preferenze",
      JSON.stringify({
  coloreDisegno,
  spessoreDisegno,
  profiliStrumenti,
})
    );
  }, [
  strumentoDisegno,
  coloreDisegno,
  spessoreDisegno,
  profiliStrumenti,
]);

  const aggiornaDisegni = (
  nuoviDisegni: SegnoNota[],
  registraCronologia = true,
) => {
  if (registraCronologia) {
    registraSnapshotQuaderno();
  }

  setDisegni(nuoviDisegni);
  aggiornaPaginaCorrente(nuoviDisegni);
};

const applicaNuovaDimensioneTesto = () => {
  if (!testoCadSelezionato) {
    return
  }

const applicaNuovoFontTesto = () => {
  if (!testoCadSelezionato) {
    return
  }

  const disegniAggiornati = disegni.map((segno) => {
    if (segno.id !== testoCadSelezionato.id) {
      return segno
    }

    return {
      ...segno,
      metadati: {
        ...segno.metadati,
        fontFamily: nuovoFontTesto,
      },
    }
  })

  aggiornaQuaderno({
    disegni: disegniAggiornati,
  })
}

  const nuovaDimensione =
    Number(nuovaDimensioneTesto)

  if (
    !Number.isFinite(nuovaDimensione) ||
    nuovaDimensione < 6 ||
    nuovaDimensione > 200
  ) {
    return
  }

  const disegniAggiornati = disegni.map((segno) => {
    if (segno.id !== testoCadSelezionato.id) {
      return segno
    }

    return {
      ...segno,
      metadati: {
        ...segno.metadati,
        fontSize: nuovaDimensione,
      },
    }
  })

  aggiornaQuaderno({
    disegni: disegniAggiornati,
  })
}

const applicaNuovaLunghezzaLinea = () => {
  if (!lineaCadSelezionata) return;
  if (!scaleCalibration) return;

  const nuovaLunghezzaMetri = Number(
    nuovaLunghezzaLinea.replace(",", "."),
  );

  if (
    !Number.isFinite(nuovaLunghezzaMetri) ||
    nuovaLunghezzaMetri <= 0
  ) {
    return;
  }

  const primo = lineaCadSelezionata.punti[0];
  const ultimo =
    lineaCadSelezionata.punti[
      lineaCadSelezionata.punti.length - 1
    ];

  if (!primo || !ultimo) return;

  const deltaX = ultimo.x - primo.x;
  const deltaY = ultimo.y - primo.y;

  const lunghezzaPixelAttuale = Math.hypot(
    deltaX,
    deltaY,
  );

  if (lunghezzaPixelAttuale <= 0) return;

  const nuovaLunghezzaPixel =
    (nuovaLunghezzaMetri /
      scaleCalibration.realDistance) *
    scaleCalibration.pixelDistance;

  const direzioneX =
    deltaX / lunghezzaPixelAttuale;

  const direzioneY =
    deltaY / lunghezzaPixelAttuale;

  const nuovoUltimo = {
    x:
      primo.x +
      direzioneX * nuovaLunghezzaPixel,
    y:
      primo.y +
      direzioneY * nuovaLunghezzaPixel,
  };

  const nuoviDisegni = disegni.map((segno) =>
    segno.id === lineaCadSelezionata.id
      ? {
          ...segno,
          punti: [
            primo,
            ...segno.punti.slice(1, -1),
            nuovoUltimo,
          ],
        }
      : segno,
  );

  aggiornaDisegni(nuoviDisegni);

  setNuovaLunghezzaLinea("");
};
  const annullaDisegno = () => {
    setUndoStack((precedenti) => {
      const statoPrecedente = precedenti[precedenti.length - 1];
      if (!statoPrecedente) return precedenti;

      setRedoStack((redoPrecedenti) => [disegni, ...redoPrecedenti]);
      setDisegni(statoPrecedente);

      return precedenti.slice(0, -1);
    });
  };

  const ripristinaDisegno = () => {
    setRedoStack((precedenti) => {
      const statoSuccessivo = precedenti[0];
      if (!statoSuccessivo) return precedenti;

      setUndoStack((undoPrecedenti) => [...undoPrecedenti, disegni]);
      setDisegni(statoSuccessivo);

      return precedenti.slice(1);
    });
  };

  const aggiornaPaginaCorrente = (
  nuoviDisegni: SegnoNota[],
  nuovoSfondoDisegno = sfondoDisegno,
  nuovoZoomSfondo = zoomSfondo,
  nuoviOggettiGrafici = oggettiGrafici,
  nuoviLayers = layers,
) => {
    setPagineQuaderno((pagineCorrenti) =>
      pagineCorrenti.map((pagina, index) =>
        index === paginaCorrenteIndex
          ? {
             ...pagina,
  disegni: nuoviDisegni,
  sfondoDisegno: nuovoSfondoDisegno,
  zoomSfondo: nuovoZoomSfondo,
  oggettiGrafici: nuoviOggettiGrafici,
  layers: nuoviLayers,
  backgroundTransform,
}
          : pagina,
      ),
    );
  };

const duplicaImmagineSelezionata = () => {
  if (!oggettoGraficoSelezionatoId) return;

  const paginaCorrente =
    pagineQuaderno[paginaCorrenteIndex];

  if (!paginaCorrente) return;

  const paginaCadCorrente: PaginaQuadernoNota = {
    ...paginaCorrente,
    disegni,
    sfondoDisegno,
    zoomSfondo,
    oggettiGrafici,
    layers,
    backgroundTransform,
  };

  const entitaCad =
    getCadEntitiesFromPage(paginaCadCorrente);

  const risultato = duplicateEntities(
    entitaCad,
    [oggettoGraficoSelezionatoId],
  );

  if (!risultato.changed) return;

  const paginaAggiornata =
    applyCadEntitiesToPage(
      paginaCadCorrente,
      risultato.entities,
    );

  registraSnapshotQuaderno();

  aggiornaQuaderno(
    {
      disegni: paginaAggiornata.disegni,
      oggettiGrafici:
        paginaAggiornata.oggettiGrafici ?? [],
    },
    false,
  );

  setOggettoGraficoSelezionatoId(
    risultato.createdEntityIds?.[0] ?? null,
  );
};

const eliminaImmagineSelezionata = () => {
  if (!oggettoGraficoSelezionatoId) return;

  if (
    !window.confirm(
      "Vuoi eliminare l'immagine selezionata dalla pagina?",
    )
  ) {
    return;
  }

  const paginaCorrente =
    pagineQuaderno[paginaCorrenteIndex];

  if (!paginaCorrente) return;

  const paginaCadCorrente: PaginaQuadernoNota = {
    ...paginaCorrente,
    disegni,
    sfondoDisegno,
    zoomSfondo,
    oggettiGrafici,
    layers,
    backgroundTransform,
  };

  const entitaCad =
    getCadEntitiesFromPage(paginaCadCorrente);

  const risultato =
    deleteEntities(
      entitaCad,
      [oggettoGraficoSelezionatoId],
    );

  if (!risultato.changed) return;

  const paginaAggiornata =
    applyCadEntitiesToPage(
      paginaCadCorrente,
      risultato.entities,
    );

  registraSnapshotQuaderno();

  aggiornaQuaderno(
    {
      disegni: paginaAggiornata.disegni,
      oggettiGrafici:
        paginaAggiornata.oggettiGrafici ?? [],
      sfondoDisegno:
        (paginaAggiornata.oggettiGrafici?.length ??
          0) === 0
          ? null
          : sfondoDisegno,
    },
    false,
  );

   setOggettoGraficoSelezionatoId(null);
};

const portaSegniSelezionatiAvanti = () => {
  if (cadEntitySelezionateIds.length === 0) {
    return
  }

  const idsSelezionati =
    new Set(cadEntitySelezionateIds)

  const nuoviDisegni = [...disegni]

  const layerIds = Array.from(
    new Set(
      disegni
        .filter((segno) =>
          idsSelezionati.has(segno.id),
        )
        .map(
          (segno) =>
            segno.layerId ??
            (segno.strumento === "pin"
              ? "pins"
              : "drawing"),
        ),
    ),
  )

  for (const layerId of layerIds) {
    const segniLayer = disegni
      .map((segno, index) => ({
        segno,
        indexOriginale: index,
      }))
      .filter(({ segno }) => {
        const layerIdSegno =
          segno.layerId ??
          (segno.strumento === "pin"
            ? "pins"
            : "drawing")

        return layerIdSegno === layerId
      })
      .sort((a, b) => {
        const zA =
          typeof a.segno.metadati?.zOrder ===
          "number"
            ? a.segno.metadati.zOrder
            : a.indexOriginale

        const zB =
          typeof b.segno.metadati?.zOrder ===
          "number"
            ? b.segno.metadati.zOrder
            : b.indexOriginale

        return zA - zB
      })

    for (
      let index = segniLayer.length - 2;
      index >= 0;
      index--
    ) {
      const corrente = segniLayer[index]
      const successivo = segniLayer[index + 1]

      if (
        idsSelezionati.has(
          corrente.segno.id,
        ) &&
        !idsSelezionati.has(
          successivo.segno.id,
        )
      ) {
        segniLayer[index] = successivo
        segniLayer[index + 1] = corrente
      }
    }

    segniLayer.forEach(
      ({ segno }, zOrder) => {
        const indice =
          nuoviDisegni.findIndex(
            (item) =>
              item.id === segno.id,
          )

        if (indice === -1) {
          return
        }

        nuoviDisegni[indice] = {
          ...nuoviDisegni[indice],
          metadati: {
            ...nuoviDisegni[indice]
              .metadati,
            zOrder,
          },
        }
      },
    )
  }

  aggiornaQuaderno({
    disegni: nuoviDisegni,
  })
}


const portaWorkspaceCadSelezionatiAvanti = () => {
  if (cadEntitySelezionateIds.length === 0) {
    return false
  }

const portaWorkspaceCadSelezionatiIndietro = () => {
  if (cadEntitySelezionateIds.length === 0) {
    return false
  }

  const idsSelezionati =
    new Set(cadEntitySelezionateIds)

  const minZOrder =
    workspaceRenderEntities.reduce(
      (minCorrente, entity) =>
        Math.min(
          minCorrente,
          entity.zOrder ?? 0,
        ),
      0,
    )

  let prossimoZOrder =
    minZOrder - 1

  let modificato = false

  setWorkspaceCadEntities(
    (entitiesCorrenti) =>
      entitiesCorrenti.map((entity) => {
        if (
          !idsSelezionati.has(entity.id)
        ) {
          return entity
        }

        modificato = true

        const entityAggiornata = {
          ...entity,
          zOrder: prossimoZOrder,
          updatedAt:
            new Date().toISOString(),
        }

        prossimoZOrder -= 1

        return entityAggiornata
      }),
  )

  if (modificato) {
    setQuadernoDirty(true)
  }

  return modificato
}

  const idsSelezionati =
    new Set(cadEntitySelezionateIds)

  const maxZOrder =
    workspaceRenderEntities.reduce(
      (maxCorrente, entity) =>
        Math.max(
          maxCorrente,
          entity.zOrder ?? 0,
        ),
      0,
    )

  let prossimoZOrder =
    maxZOrder + 1

  let modificato = false

  setWorkspaceCadEntities(
    (entitiesCorrenti) =>
      entitiesCorrenti.map((entity) => {
        if (
          !idsSelezionati.has(entity.id)
        ) {
          return entity
        }

        modificato = true

        const entityAggiornata = {
          ...entity,
          zOrder: prossimoZOrder,
          updatedAt:
            new Date().toISOString(),
        }

        prossimoZOrder += 1

        return entityAggiornata
      }),
  )

  if (modificato) {
    setQuadernoDirty(true)
  }

  return modificato
}

const portaWorkspaceCadSelezionatiIndietro = () => {
  if (cadEntitySelezionateIds.length === 0) {
    return false
  }

  const idsSelezionati =
    new Set(cadEntitySelezionateIds)

  const minZOrder =
    workspaceRenderEntities.reduce(
      (minCorrente, entity) =>
        Math.min(
          minCorrente,
          entity.zOrder ?? 0,
        ),
      0,
    )

  let prossimoZOrder =
    minZOrder - 1

  let modificato = false

  setWorkspaceCadEntities(
    (entitiesCorrenti) =>
      entitiesCorrenti.map((entity) => {
        if (
          !idsSelezionati.has(entity.id)
        ) {
          return entity
        }

        modificato = true

        const entityAggiornata = {
          ...entity,
          zOrder: prossimoZOrder,
          updatedAt:
            new Date().toISOString(),
        }

        prossimoZOrder -= 1

        return entityAggiornata
      }),
  )

  if (modificato) {
    setQuadernoDirty(true)
  }

  return modificato
}


const portaWorkspaceCadSelezionatiInPrimoPiano = () => {
  if (cadEntitySelezionateIds.length === 0) {
    return false
  }

  const idsSelezionati =
    new Set(cadEntitySelezionateIds)

  const maxZOrder =
    workspaceRenderEntities.reduce(
      (maxCorrente, entity) =>
        Math.max(
          maxCorrente,
          entity.zOrder ?? 0,
        ),
      0,
    )

  let prossimoZOrder =
    maxZOrder + 100

  let modificato = false

  setWorkspaceCadEntities(
    (entitiesCorrenti) =>
      entitiesCorrenti.map((entity) => {
        if (
          !idsSelezionati.has(entity.id)
        ) {
          return entity
        }

        modificato = true

        const entityAggiornata = {
          ...entity,
          zOrder: prossimoZOrder,
          updatedAt:
            new Date().toISOString(),
        }

        prossimoZOrder += 1

        return entityAggiornata
      }),
  )

  if (modificato) {
    setQuadernoDirty(true)
  }

  return modificato
}

const portaWorkspaceCadSelezionatiInFondo = () => {
  if (cadEntitySelezionateIds.length === 0) {
    return false
  }

  const idsSelezionati =
    new Set(cadEntitySelezionateIds)

  const minZOrder =
    workspaceRenderEntities.reduce(
      (minCorrente, entity) =>
        Math.min(
          minCorrente,
          entity.zOrder ?? 0,
        ),
      0,
    )

  let prossimoZOrder =
    minZOrder - 100

  let modificato = false

  setWorkspaceCadEntities(
    (entitiesCorrenti) =>
      entitiesCorrenti.map((entity) => {
        if (
          !idsSelezionati.has(entity.id)
        ) {
          return entity
        }

        modificato = true

        const entityAggiornata = {
          ...entity,
          zOrder: prossimoZOrder,
          updatedAt:
            new Date().toISOString(),
        }

        prossimoZOrder -= 1

        return entityAggiornata
      }),
  )

  if (modificato) {
    setQuadernoDirty(true)
  }

  return modificato
}

const portaImmagineAvanti = () => {
  if (!oggettoGraficoSelezionatoId) {
    return
  }

  const index =
    oggettiGrafici.findIndex(
      (oggetto) =>
        oggetto.id ===
        oggettoGraficoSelezionatoId,
    )

  if (
    index < 0 ||
    index >= oggettiGrafici.length - 1
  ) {
    return
  }

  const nuoviOggetti =
    [...oggettiGrafici]

  const temporaneo =
    nuoviOggetti[index]

  nuoviOggetti[index] =
    nuoviOggetti[index + 1]

  nuoviOggetti[index + 1] =
    temporaneo

  aggiornaQuaderno({
    oggettiGrafici: nuoviOggetti,
  })

  setQuadernoDirty(true)
}

const portaImmagineIndietro = () => {
  if (!oggettoGraficoSelezionatoId) {
    return
  }

  const index =
    oggettiGrafici.findIndex(
      (oggetto) =>
        oggetto.id ===
        oggettoGraficoSelezionatoId,
    )

  if (index <= 0) {
    return
  }

  const nuoviOggetti =
    [...oggettiGrafici]

  const temporaneo =
    nuoviOggetti[index]

  nuoviOggetti[index] =
    nuoviOggetti[index - 1]

  nuoviOggetti[index - 1] =
    temporaneo

  aggiornaQuaderno({
    oggettiGrafici: nuoviOggetti,
  })

  setQuadernoDirty(true)
}

const portaSegniSelezionatiIndietro = () => {
  if (cadEntitySelezionateIds.length === 0) {
    return
  }

  const idsSelezionati =
    new Set(cadEntitySelezionateIds)

  const nuoviDisegni = [...disegni]

  const layerIds = Array.from(
    new Set(
      disegni
        .filter((segno) =>
          idsSelezionati.has(segno.id),
        )
        .map(
          (segno) =>
            segno.layerId ??
            (segno.strumento === "pin"
              ? "pins"
              : "drawing"),
        ),
    ),
  )

  for (const layerId of layerIds) {
    const segniLayer = disegni
      .map((segno, index) => ({
        segno,
        indexOriginale: index,
      }))
      .filter(({ segno }) => {
        const layerIdSegno =
          segno.layerId ??
          (segno.strumento === "pin"
            ? "pins"
            : "drawing")

        return layerIdSegno === layerId
      })
      .sort((a, b) => {
        const zA =
          typeof a.segno.metadati?.zOrder ===
          "number"
            ? a.segno.metadati.zOrder
            : a.indexOriginale

        const zB =
          typeof b.segno.metadati?.zOrder ===
          "number"
            ? b.segno.metadati.zOrder
            : b.indexOriginale

        return zA - zB
      })

    for (
      let index = 1;
      index < segniLayer.length;
      index++
    ) {
      const corrente = segniLayer[index]
      const precedente = segniLayer[index - 1]

      if (
        idsSelezionati.has(
          corrente.segno.id,
        ) &&
        !idsSelezionati.has(
          precedente.segno.id,
        )
      ) {
        segniLayer[index] = precedente
        segniLayer[index - 1] = corrente
      }
    }

    segniLayer.forEach(
      ({ segno }, zOrder) => {
        const indice =
          nuoviDisegni.findIndex(
            (item) =>
              item.id === segno.id,
          )

        if (indice === -1) {
          return
        }

        nuoviDisegni[indice] = {
          ...nuoviDisegni[indice],
          metadati: {
            ...nuoviDisegni[indice]
              .metadati,
            zOrder,
          },
        }
      },
    )
  }

  aggiornaQuaderno({
    disegni: nuoviDisegni,
  })
}

const portaSegniSelezionatiInPrimoPiano = () => {
  if (cadEntitySelezionateIds.length === 0) {
    return
  }

  const idsSelezionati =
    new Set(cadEntitySelezionateIds)

  const nuoviDisegni = [...disegni]

  const layerIds = Array.from(
    new Set(
      disegni
        .filter((segno) =>
          idsSelezionati.has(segno.id),
        )
        .map(
          (segno) =>
            segno.layerId ??
            (segno.strumento === "pin"
              ? "pins"
              : "drawing"),
        ),
    ),
  )

  for (const layerId of layerIds) {
    const segniLayer = disegni
      .map((segno, index) => ({
        segno,
        indexOriginale: index,
      }))
      .filter(({ segno }) => {
        const layerIdSegno =
          segno.layerId ??
          (segno.strumento === "pin"
            ? "pins"
            : "drawing")

        return layerIdSegno === layerId
      })
      .sort((a, b) => {
        const zA =
          typeof a.segno.metadati?.zOrder ===
          "number"
            ? a.segno.metadati.zOrder
            : a.indexOriginale

        const zB =
          typeof b.segno.metadati?.zOrder ===
          "number"
            ? b.segno.metadati.zOrder
            : b.indexOriginale

        return zA - zB
      })

    const nonSelezionati =
      segniLayer.filter(
        ({ segno }) =>
          !idsSelezionati.has(segno.id),
      )

    const selezionati =
      segniLayer.filter(
        ({ segno }) =>
          idsSelezionati.has(segno.id),
      )

    const nuovoOrdine = [
      ...nonSelezionati,
      ...selezionati,
    ]

    nuovoOrdine.forEach(
      ({ segno }, zOrder) => {
        const indice =
          nuoviDisegni.findIndex(
            (item) =>
              item.id === segno.id,
          )

        if (indice === -1) {
          return
        }

        nuoviDisegni[indice] = {
          ...nuoviDisegni[indice],
          metadati: {
            ...nuoviDisegni[indice]
              .metadati,
            zOrder,
          },
        }
      },
    )
  }

  aggiornaQuaderno({
    disegni: nuoviDisegni,
  })
}

const portaSegniSelezionatiInFondo = () => {
  if (cadEntitySelezionateIds.length === 0) {
    return
  }

  const idsSelezionati =
    new Set(cadEntitySelezionateIds)

  const nuoviDisegni = [...disegni]

  const layerIds = Array.from(
    new Set(
      disegni
        .filter((segno) =>
          idsSelezionati.has(segno.id),
        )
        .map(
          (segno) =>
            segno.layerId ??
            (segno.strumento === "pin"
              ? "pins"
              : "drawing"),
        ),
    ),
  )

  for (const layerId of layerIds) {
    const segniLayer = disegni
      .map((segno, index) => ({
        segno,
        indexOriginale: index,
      }))
      .filter(({ segno }) => {
        const layerIdSegno =
          segno.layerId ??
          (segno.strumento === "pin"
            ? "pins"
            : "drawing")

        return layerIdSegno === layerId
      })
      .sort((a, b) => {
        const zA =
          typeof a.segno.metadati?.zOrder ===
          "number"
            ? a.segno.metadati.zOrder
            : a.indexOriginale

        const zB =
          typeof b.segno.metadati?.zOrder ===
          "number"
            ? b.segno.metadati.zOrder
            : b.indexOriginale

        return zA - zB
      })

    const selezionati =
      segniLayer.filter(
        ({ segno }) =>
          idsSelezionati.has(segno.id),
      )

    const nonSelezionati =
      segniLayer.filter(
        ({ segno }) =>
          !idsSelezionati.has(segno.id),
      )

    const nuovoOrdine = [
      ...selezionati,
      ...nonSelezionati,
    ]

    nuovoOrdine.forEach(
      ({ segno }, zOrder) => {
        const indice =
          nuoviDisegni.findIndex(
            (item) => item.id === segno.id,
          )

        if (indice === -1) {
          return
        }

        nuoviDisegni[indice] = {
          ...nuoviDisegni[indice],
          metadati: {
            ...nuoviDisegni[indice]
              .metadati,
            zOrder,
          },
        }
      },
    )
  }

  aggiornaQuaderno({
    disegni: nuoviDisegni,
  })
}


const marqueeCadAttivo = modalitaSelezione && !spostaTavolaAttivo &&
  !manoAttiva && strumentoDisegno === null && !trimAttivo && !metroAttivo &&
  !calibrazioneScalaAttiva && !areaAttiva && !areaSplitAttivo &&
  !spostaEntitaAttivo && !trasformazioneOggettoAttiva && !workspaceTestoDraft

const eliminaEntitaCadSelezionate = () => {
  const idsCadSelezionati = Array.from(
  new Set([
    ...cadEntitySelezionateIds,
    ...(cadEntitySelezionataId
      ? [cadEntitySelezionataId]
      : []),
  ]),
);

const idsSelezionati =
  idsCadSelezionati.length > 0
    ? idsCadSelezionati
    : Array.from(
        new Set([
          ...(oggettoGraficoSelezionatoId
            ? [oggettoGraficoSelezionatoId]
            : []),

          ...(pinSelezionatoId
            ? [pinSelezionatoId]
            : []),
        ]),
      );

  if (idsSelezionati.length === 0) {
    return;
  }

  const paginaCorrente =
    pagineQuaderno[paginaCorrenteIndex];

  if (!paginaCorrente) {
    return;
  }

  const paginaCadCorrente: PaginaQuadernoNota = {
    ...paginaCorrente,
    disegni,
    sfondoDisegno,
    zoomSfondo,
    oggettiGrafici,
    layers,
    backgroundTransform,
    cadDimensions:
      paginaCorrente.cadDimensions ?? [],
  };

  const entitaCad =
    getCadEntitiesFromPage(paginaCadCorrente);
const lineeSplitSelezionate =
  entitaCad.filter((entity) => {
    if (entity.type !== "line") {
      return false;
    }

    if (!idsSelezionati.includes(entity.id)) {
      return false;
    }

    return entitaCad.some((altraEntity) => {
      if (altraEntity.type !== "area") {
        return false;
      }

      return (
        altraEntity.metadata?.splitSourceLineId ===
        entity.id
      );
    });
  });

console.log(
  "DELETE SPLIT LINES",
  lineeSplitSelezionate.map((entity) => entity.id),
);

const areeDaRipristinare =
  lineeSplitSelezionate
    .map((lineaSplit) => {
      const areeFiglie =
        entitaCad.filter((entity) => {
          if (entity.type !== "area") {
            return false;
          }

          return (
            entity.metadata?.splitSourceLineId ===
            lineaSplit.id
          );
        });

      if (areeFiglie.length < 2) {
        return null;
      }

      const primaArea = areeFiglie[0];

      const originalPoints =
        primaArea.metadata
          ?.splitOriginalPoints;

      if (!Array.isArray(originalPoints)) {
        return null;
      }

      return {
        lineaId: lineaSplit.id,
        areeFiglie,
        primaArea,
        originalPoints,
      };
    })
    .filter(
      (item): item is NonNullable<typeof item> =>
        item !== null,
    );

console.log(
  "AREE DA RIPRISTINARE",
  areeDaRipristinare,
);

let entitaCadDaElaborare =
  [...entitaCad];

for (const ripristino of areeDaRipristinare) {
  const idsAreeFiglie =
    ripristino.areeFiglie.map(
      (area) => area.id,
    );

  entitaCadDaElaborare =
    entitaCadDaElaborare.filter(
      (entity) =>
        !idsAreeFiglie.includes(
          entity.id,
        ),
    );

  const now =
    new Date().toISOString();

  const areaOriginale = {
    ...ripristino.primaArea,

  id:
  typeof ripristino.primaArea.metadata?.splitSourceAreaId === "string"
    ? ripristino.primaArea.metadata.splitSourceAreaId
    : crypto.randomUUID(),

    points:
      ripristino.originalPoints.map(
        (point: any) => ({
          x: point.x,
          y: point.y,
        }),
      ),

    createdAt: now,
    updatedAt: now,

    metadata: {
      ...ripristino.primaArea.metadata,
      splitSourceAreaId: undefined,
      splitSourceLineId: undefined,
      splitOriginalPoints: undefined,
    },
  };

  entitaCadDaElaborare.push(
    areaOriginale,
  );
}

  const risultato = deleteEntities(
  entitaCadDaElaborare,
  idsSelezionati,
);

const risultatoWorkspace =
  deleteEntities(
    workspaceCadEntities,
    idsSelezionati,
  );

if (
  !risultato.changed &&
  !risultatoWorkspace.changed
) {
  return;
}

registraSnapshotQuaderno();

if (risultatoWorkspace.changed) {
  setWorkspaceCadEntities(
    risultatoWorkspace.entities,
  );
}

  const paginaAggiornata =
    applyCadEntitiesToPage(
      paginaCadCorrente,
      risultato.entities,
    );


  aggiornaQuaderno(
    {
      disegni: paginaAggiornata.disegni,
      oggettiGrafici:
        paginaAggiornata.oggettiGrafici ?? [],
      sfondoDisegno:
        (paginaAggiornata.oggettiGrafici?.length ??
          0) === 0
          ? null
          : sfondoDisegno,
    },
    false,
  );

 setPagineQuaderno((pagineCorrenti) =>
  pagineCorrenti.map((pagina, index) =>
    index === paginaCorrenteIndex
      ? {
          ...pagina,
          cadDimensions:
            paginaAggiornata.cadDimensions ?? [],
          cadEntities:
            paginaAggiornata.cadEntities ?? [],
        }
      : pagina,
  ),
);

  setCadEntitySelezionataId(null);
  setCadEntitySelezionateIds([]);
  setOggettoGraficoSelezionatoId(null);
  setPinSelezionatoId(null);
};

const resettaFoglio = () => {
  if (
    !window.confirm(
      "Vuoi resettare completamente questa pagina? Verranno eliminati immagini, disegni, pin e impostazioni dei layer.",
    )
  ) {
    return;
  }

  const layersIniziali =
    DEFAULT_QUADERNO_LAYERS.map((layer) => ({
      ...layer,
    }));

  const transformIniziale =
    createDefaultBackgroundTransform();

  setDisegni([]);
  setOggettiGrafici([]);
  setSfondoDisegno(null);
  setZoomSfondo(1);

  setBackgroundTransform(
    transformIniziale,
  );

  setSfondoX(0);
  setSfondoY(0);

  setLayers(layersIniziali);

  setOggettoGraficoSelezionatoId(null);
  setPinSelezionatoId(null);
  setSfondoSelezionato(false);

  setUndoStack([]);
  setRedoStack([]);

  setPagineQuaderno((pagineCorrenti) =>
    pagineCorrenti.map((pagina, index) =>
      index === paginaCorrenteIndex
        ? {
    ...pagina,
    disegni: [],
cadDimensions: [],
cadEntities: [],
sfondoDisegno: null,
            zoomSfondo: 1,
            oggettiGrafici: [],
            layers: layersIniziali,
            backgroundTransform:
              transformIniziale,
          }
        : pagina,
    ),
  );
};

const calcolaPosizioniWorkspace = (
  pagine: PaginaQuadernoNota[],
  numeroColonne = 2,
): PaginaQuadernoNota[] => {
  const colonne =
    Math.max(
      1,
      Math.floor(numeroColonne),
    )

  const risultato:
    PaginaQuadernoNota[] = []

  let yCorrente = 0

  for (
    let inizioRiga = 0;
    inizioRiga < pagine.length;
    inizioRiga += colonne
  ) {
    const pagineRiga =
      pagine.slice(
        inizioRiga,
        inizioRiga + colonne,
      )

    let xCorrente = 0
    let altezzaRiga = 0

    for (const pagina of pagineRiga) {
      const layout =
        pagina.pageLayout ??
        createQuadernoPageLayout()

      risultato.push({
        ...pagina,
        workspaceX: xCorrente,
        workspaceY: yCorrente,
      })

      xCorrente += layout.width

      altezzaRiga =
        Math.max(
          altezzaRiga,
          layout.height,
        )
    }

    yCorrente += altezzaRiga
  }

  return risultato
}
const aggiungiPagina = () => {
  const nuovoIndex = pagineQuaderno.length;

  const nuovaPagina: PaginaQuadernoNota = {
    id: crypto.randomUUID(),
    titolo: `Pagina ${nuovoIndex + 1}`,
  disegni: [],
  cadDimensions: [],
  cadEntities: [],
  sfondoDisegno: null,
  zoomSfondo: 1,
  oggettiGrafici: [],
  pageLayout: {
    ...pageLayout,
  },
  layers: DEFAULT_QUADERNO_LAYERS.map((layer) => ({
    ...layer,
  })),
}
    setPagineQuaderno((pagineCorrenti) => {
  const pagineAggiornate = [
    ...pagineCorrenti.map((pagina, index) =>
      index === paginaCorrenteIndex
        ? {
            ...pagina,
            disegni,
            sfondoDisegno,
            zoomSfondo,
            oggettiGrafici,
            layers,
            pageLayout,
          }
        : pagina,
    ),
    nuovaPagina,
  ]

  return calcolaPosizioniWorkspace(
  pagineAggiornate,
  colonneWorkspace,
)
})

    setPaginaCorrenteIndex(nuovoIndex);
    setDisegni([]);
    setSfondoDisegno(null);
    setZoomSfondo(1);
    setOggettiGrafici([]);
    setOggettoGraficoSelezionatoId(null);
    setPinSelezionatoId(null);
    setSfondoSelezionato(false);
    setUndoStack([]);
    setRedoStack([]);
  };

const eliminaPaginaCorrente = () => {
  if (pagineQuaderno.length <= 1) {
    window.alert(
      "Deve rimanere almeno una pagina nel Quaderno.",
    )
    return
  }

  const paginaAttiva =
    pagineQuaderno[paginaCorrenteIndex]

  if (!paginaAttiva) {
    return
  }

 if (
  !window.confirm(
    `Vuoi eliminare Pagina ${paginaCorrenteIndex + 1}?`,
  )
) {
    return
  }

 const idPaginaDaEliminare =
  paginaAttiva.id

setWorkspaceCadEntities(
  (entitiesCorrenti) =>
    entitiesCorrenti.filter((entity) => {
      const workspacePageId =
        entity.metadata?.workspacePageId

      return (
        typeof workspacePageId !== "string" ||
        workspacePageId !== idPaginaDaEliminare
      )
    }),
)

const nuovePagine =

  calcolaPosizioniWorkspace(
    pagineQuaderno
      .filter(
        (pagina) =>
          pagina.id !== idPaginaDaEliminare,
      )
      .map((pagina, index) => ({
        ...pagina,
        titolo: `Pagina ${index + 1}`,
      })),
    colonneWorkspace,
  )

  const nuovoIndex = Math.min(
    paginaCorrenteIndex,
    nuovePagine.length - 1,
  )

  const nuovaPaginaCorrente =
    nuovePagine[nuovoIndex]

  if (!nuovaPaginaCorrente) {
    return
  }

  setPagineQuaderno(nuovePagine)
  setPaginaCorrenteIndex(nuovoIndex)

  setPageLayout(
    nuovaPaginaCorrente.pageLayout ??
      createQuadernoPageLayout(),
  )

  setDisegni(
    nuovaPaginaCorrente.disegni ?? [],
  )

  setSfondoDisegno(
    nuovaPaginaCorrente.sfondoDisegno ??
      null,
  )

  setZoomSfondo(
    nuovaPaginaCorrente.zoomSfondo ?? 1,
  )

  setOggettiGrafici(
    nuovaPaginaCorrente.oggettiGrafici ??
      [],
  )

  setScaleCalibration(
    nuovaPaginaCorrente.scaleCalibration ??
      null,
  )

  setLayers(
    nuovaPaginaCorrente.layers?.map(
      (layer) => ({
        ...layer,
      }),
    ) ??
      DEFAULT_QUADERNO_LAYERS.map(
        (layer) => ({
          ...layer,
        }),
      ),
  )

  setOggettoGraficoSelezionatoId(null)
  setPinSelezionatoId(null)
  setSfondoSelezionato(false)
  setCadEntitySelezionataId(null)
  setCadEntitySelezionateIds([])

  setUndoStack([])
  setRedoStack([])

  setQuadernoDirty(true)
}

const eliminaPagineWorkspaceSelezionate = () => {
  if (
    pagineWorkspaceSelezionateIds.length === 0
  ) {
    return
  }

  const numeroDaEliminare =
    pagineWorkspaceSelezionateIds.length

  if (
    pagineQuaderno.length -
      numeroDaEliminare <
    1
  ) {
    window.alert(
      "Deve rimanere almeno una pagina nel Quaderno.",
    )
    return
  }

  if (
    !window.confirm(
      `Vuoi eliminare ${numeroDaEliminare} pagine selezionate?`,
    )
  ) {
    return
  }

 setWorkspaceCadEntities(
  (entitiesCorrenti) =>
    entitiesCorrenti.filter((entity) => {
      const workspacePageId =
        entity.metadata?.workspacePageId

      return (
        typeof workspacePageId !== "string" ||
        !pagineWorkspaceSelezionateIds.includes(
          workspacePageId,
        )
      )
    }),
)

const nuovePagine =
  calcolaPosizioniWorkspace(

      pagineQuaderno
        .filter(
          (pagina) =>
            !pagineWorkspaceSelezionateIds.includes(
              pagina.id,
            ),
        )
        .map((pagina, index) => ({
          ...pagina,
          titolo: `Pagina ${index + 1}`,
        })),
      colonneWorkspace,
    )

  const nuovoIndex = Math.min(
    paginaCorrenteIndex,
    nuovePagine.length - 1,
  )

  const nuovaPaginaCorrente =
    nuovePagine[nuovoIndex]

  if (!nuovaPaginaCorrente) {
    return
  }

  setPagineQuaderno(nuovePagine)
  setPaginaCorrenteIndex(nuovoIndex)

  setPageLayout(
    nuovaPaginaCorrente.pageLayout ??
      createQuadernoPageLayout(),
  )

  setDisegni(
    nuovaPaginaCorrente.disegni ?? [],
  )

  setSfondoDisegno(
    nuovaPaginaCorrente.sfondoDisegno ??
      null,
  )

  setZoomSfondo(
    nuovaPaginaCorrente.zoomSfondo ?? 1,
  )

  setOggettiGrafici(
    nuovaPaginaCorrente.oggettiGrafici ??
      [],
  )

  setScaleCalibration(
    nuovaPaginaCorrente.scaleCalibration ??
      null,
  )

  setLayers(
    nuovaPaginaCorrente.layers?.map(
      (layer) => ({
        ...layer,
      }),
    ) ??
      DEFAULT_QUADERNO_LAYERS.map(
        (layer) => ({
          ...layer,
        }),
      ),
  )

  setOggettoGraficoSelezionatoId(null)
  setPinSelezionatoId(null)
  setSfondoSelezionato(false)
  setCadEntitySelezionataId(null)
  setCadEntitySelezionateIds([])

  setPagineWorkspaceSelezionateIds([])

  setUndoStack([])
  setRedoStack([])

  setQuadernoDirty(true)
}

  const vaiAllaPagina = (nuovoIndex: number) => {
    if (
      nuovoIndex < 0 ||
      nuovoIndex >= pagineQuaderno.length ||
      nuovoIndex === paginaCorrenteIndex
    ) {
      return;
    }

    const paginaDestinazione = pagineQuaderno[nuovoIndex];
    if (!paginaDestinazione) return;

    setPagineQuaderno((pagineCorrenti) =>
      pagineCorrenti.map((pagina, index) =>
        index === paginaCorrenteIndex
         ? {
    ...pagina,
    disegni,
    sfondoDisegno,
    zoomSfondo,
    oggettiGrafici,
    layers,
    pageLayout,
  }
          : pagina,
      ),
    );

    setPaginaCorrenteIndex(nuovoIndex);
setStrumentoDisegno(null)
setModalitaSelezione(true)
setPageLayout(
  paginaDestinazione.pageLayout ??
    createQuadernoPageLayout(),
);
    setDisegni(paginaDestinazione.disegni || []);
    setSfondoDisegno(paginaDestinazione.sfondoDisegno || null);
    setZoomSfondo(paginaDestinazione.zoomSfondo ?? 1);
    setOggettiGrafici(paginaDestinazione.oggettiGrafici || []);


setScaleCalibration(
  paginaDestinazione.scaleCalibration ?? null,
);
setLayers(
  paginaDestinazione.layers?.map((layer) => ({
    ...layer,
  })) ||
    DEFAULT_QUADERNO_LAYERS.map((layer) => ({
      ...layer,
    })),
)
    setOggettoGraficoSelezionatoId(null);
    setPinSelezionatoId(null);
    setSfondoSelezionato(false);
    setUndoStack([]);
    setRedoStack([]);
  };

const creaSvgPaginaStampa = (
  pagina: PaginaQuadernoNota,
): string | null => {
  const contenitorePagina =
    document.querySelector<HTMLElement>(
      `[data-quaderno-page-id="${pagina.id}"]`,
    )

  if (!contenitorePagina) {
    return null
  }

  const svgPagina =
    contenitorePagina.querySelector<SVGSVGElement>(
      "svg",
    )

  if (!svgPagina) {
    return null
  }

  const layout =
    pagina.pageLayout ??
    createQuadernoPageLayout()

  const clonePagina =
    svgPagina.cloneNode(true) as SVGSVGElement

clonePagina
  .querySelectorAll(
    '[data-print-ui="true"]',
  )
  .forEach((elemento) =>
    elemento.remove(),
  )

  clonePagina.setAttribute(
    "width",
    String(layout.width),
  )

  clonePagina.setAttribute(
    "height",
    String(layout.height),
  )

  clonePagina.setAttribute(
    "viewBox",
    `0 0 ${layout.width} ${layout.height}`,
  )

  clonePagina.setAttribute(
    "xmlns",
    "http://www.w3.org/2000/svg",
  )

 clonePagina.style.background =
  "#ffffff"

const workspaceSvg =
  workspaceSvgRef.current

if (workspaceSvg) {
  const cloneWorkspace =
    workspaceSvg.cloneNode(true) as SVGSVGElement

  cloneWorkspace
    .querySelectorAll(
      '[data-print-ui="true"]',
    )
    .forEach((elemento) =>
      elemento.remove(),
    )

  const workspaceX =
    pagina.workspaceX ?? 0

  const workspaceY =
    pagina.workspaceY ?? 0

  cloneWorkspace.setAttribute(
    "x",
    String(-workspaceX),
  )

  cloneWorkspace.setAttribute(
    "y",
    String(-workspaceY),
  )

  cloneWorkspace.setAttribute(
    "width",
    String(dimensioniWorkspace.width),
  )

  cloneWorkspace.setAttribute(
    "height",
    String(dimensioniWorkspace.height),
  )

  cloneWorkspace.setAttribute(
    "viewBox",
    `0 0 ${dimensioniWorkspace.width} ${dimensioniWorkspace.height}`,
  )

  cloneWorkspace.style.overflow =
    "visible"

  const gruppoWorkspace =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    )

  gruppoWorkspace.setAttribute(
    "transform",
    `translate(${-workspaceX} ${-workspaceY})`,
  )

  Array.from(
    cloneWorkspace.childNodes,
  ).forEach((nodo) => {
    gruppoWorkspace.appendChild(
      nodo.cloneNode(true),
    )
  })

  clonePagina.appendChild(
    gruppoWorkspace,
  )
}

return new XMLSerializer().serializeToString(
  clonePagina,
)
}

  const apriAnteprimaQuaderno = () => {
  const pagineSvg =
    pagineQuaderno
      .map((pagina) => {
        const svgPagina =
          creaSvgPaginaStampa(pagina)

        if (!svgPagina) {
          return null
        }

        const layout =
          pagina.pageLayout ??
          createQuadernoPageLayout()

        return `
          <div
            class="pagina-quaderno"
            style="
              width:${layout.width}px;
              height:${layout.height}px;
            "
          >
            ${svgPagina}
          </div>
        `
      })
      .filter(Boolean)
      .join("")

  if (!pagineSvg) {
    alert(
      "Anteprima del Quaderno non disponibile.",
    )
    return
  }

  const htmlAnteprima = `
    <!doctype html>
    <html lang="it">
      <head>
        <meta charset="utf-8" />

        <style>
          html,
          body {
            margin: 0;
            padding: 0;
            background: #e2e8f0;
          }

          body {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 24px;
            padding: 24px;
            box-sizing: border-box;
          }

          .pagina-quaderno {
            flex: 0 0 auto;
            background: #ffffff;
            overflow: hidden;
          }

          .pagina-quaderno > svg {
            display: block;
            width: 100%;
            height: 100%;
          }
        </style>
      </head>

      <body>
        ${pagineSvg}
      </body>
    </html>
  `

  const blob = new Blob(
    [htmlAnteprima],
    {
      type: "text/html;charset=utf-8",
    },
  )

  const url =
    URL.createObjectURL(blob)

  setAnteprimaQuaderno(
    (precedente) => {
      if (precedente) {
        URL.revokeObjectURL(
          precedente,
        )
      }

      return url
    },
  )
}

  const chiudiAnteprimaQuaderno = () => {
    setAnteprimaQuaderno((precedente) => {
      if (precedente) {
        URL.revokeObjectURL(precedente);
      }

      return null;
    });
  };

  const stampaFoglioQuaderno = () => {
  const finestraStampa =
    window.open("", "_blank")

  if (!finestraStampa) {
    alert(
      "Il browser ha bloccato la finestra di stampa. Consenti i popup per localhost.",
    )
    return
  }

  const pagineStampa =
    pagineQuaderno
      .map((pagina, index) => {
        const svgPagina =
          creaSvgPaginaStampa(pagina)

        if (!svgPagina) {
          return null
        }

        const layout =
          pagina.pageLayout ??
          createQuadernoPageLayout()

        const orientamento =
          layout.orientation === "portrait"
            ? "portrait"
            : "landscape"

        return `
          <section
            class="pagina-stampa"
            data-formato="${layout.format}"
            data-orientamento="${orientamento}"
            style="
              width:${layout.width}px;
              height:${layout.height}px;
            "
          >
            ${svgPagina}
          </section>
        `
      })
      .filter(Boolean)
      .join("")

  if (!pagineStampa) {
    finestraStampa.close()

    alert(
      "Nessuna pagina disponibile per la stampa.",
    )
    return
  }

  finestraStampa.document.open()

  finestraStampa.document.write(`
    <!doctype html>
    <html lang="it">
      <head>
        <meta charset="utf-8" />
        <title>Stampa Quaderno Tecnico</title>

        <style>
          @page {
            margin: 0;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
          }

          body {
            width: 100%;
          }

          .pagina-stampa {
            position: relative;
            display: block;
            margin: 0;
            padding: 0;
            background: #ffffff;
            overflow: hidden;

            break-after: page;
            page-break-after: always;
          }

          .pagina-stampa:last-child {
            break-after: auto;
            page-break-after: auto;
          }

          .pagina-stampa > svg {
            display: block;
            width: 100%;
            height: 100%;
          }

          @media print {
            html,
            body {
              margin: 0 !important;
              padding: 0 !important;
            }

            .pagina-stampa {
              margin: 0 !important;
              box-shadow: none !important;
              border: 0 !important;
            }
          }
        </style>
      </head>

      <body>
        ${pagineStampa}

        <script>
          let stampaAvviata = false;

          const avviaStampa = () => {
            if (stampaAvviata) return;

            stampaAvviata = true;

            window.focus();

            setTimeout(() => {
              window.print();
            }, 500);
          };

          window.addEventListener(
            "load",
            avviaStampa,
            { once: true }
          );

          setTimeout(
            avviaStampa,
            1500
          );
        </script>
      </body>
    </html>
  `)

  finestraStampa.document.close()
}

const incorporaImmaginiSvg = async (
  svgTesto: string,
): Promise<string> => {
  const parser =
    new DOMParser()

  const documento =
    parser.parseFromString(
      svgTesto,
      "image/svg+xml",
    )

  const immagini =
    Array.from(
      documento.querySelectorAll("image"),
    )

  for (const immagine of immagini) {
    const href =
      immagine.getAttribute("href") ||
      immagine.getAttribute(
        "xlink:href",
      )

    if (
      !href ||
      href.startsWith("data:")
    ) {
      continue
    }

    try {
      const risposta =
        await fetch(href)

      if (!risposta.ok) {
        continue
      }

      const blob =
        await risposta.blob()

      const dataUrl =
        await new Promise<string>(
          (resolve, reject) => {
            const reader =
              new FileReader()

            reader.onload = () =>
              resolve(
                String(reader.result),
              )

            reader.onerror = () =>
              reject(reader.error)

            reader.readAsDataURL(blob)
          },
        )

      immagine.setAttribute(
        "href",
        dataUrl,
      )

      immagine.removeAttribute(
        "xlink:href",
      )
    } catch (errore) {
      console.warn(
        "Immagine non incorporata nel PDF:",
        href,
        errore,
      )
    }
  }

  return new XMLSerializer()
    .serializeToString(
      documento.documentElement,
    )
}

const generaPdfQuadernoBlob = async (): Promise<Blob> => {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: "a4",
  })

  let primaPaginaPdf = true

  for (const pagina of pagineQuaderno) {
    const svgTesto =
      creaSvgPaginaStampa(pagina)

    if (!svgTesto) {
      continue
    }

const svgConImmagini =
  await incorporaImmaginiSvg(
    svgTesto,
  )

    const layout =
      pagina.pageLayout ??
      createQuadernoPageLayout()

    const orientamento =
      layout.orientation === "portrait"
        ? "portrait"
        : "landscape"

    if (!primaPaginaPdf) {
      pdf.addPage(
        [layout.width, layout.height],
        orientamento,
      )
    } else {
      pdf.deletePage(1)

      pdf.addPage(
        [layout.width, layout.height],
        orientamento,
      )

      primaPaginaPdf = false
    }

    const canvas =
  document.createElement("canvas")

canvas.width =
  Math.max(
    1,
    Math.round(layout.width),
  )

canvas.height =
  Math.max(
    1,
    Math.round(layout.height),
  )

const contesto =
  canvas.getContext("2d")

if (!contesto) {
  throw new Error(
    "Canvas non disponibile.",
  )
}

contesto.fillStyle =
  "#ffffff"

contesto.fillRect(
  0,
  0,
  canvas.width,
  canvas.height,
)

const renderer =
  await Canvg.fromString(
    contesto,
    svgConImmagini,
  )
await renderer.render()

const immaginePng =
  canvas.toDataURL(
    "image/png",
  )

pdf.addImage(
  immaginePng,
  "PNG",
  0,
  0,
  layout.width,
  layout.height,
)
  }

  if (primaPaginaPdf) {
    alert(
      "Nessuna pagina disponibile per l'esportazione.",
    )

    throw new Error(
      "Nessuna pagina disponibile per l'esportazione.",
    )
  }

  return pdf.output("blob")
}

const esportaPdfQuaderno = async () => {
  const nomePulito =
    titolo.trim() || "sopralluogo"

  const blob =
    await generaPdfQuadernoBlob()

  const url =
    URL.createObjectURL(blob)

  const link =
    document.createElement("a")

  link.href = url
  link.download = `quaderno-${nomePulito}.pdf`

  document.body.appendChild(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(
    url,
  )
}


  const condividiFoglioQuaderno = async () => {
    try {
      const blob = await generaPdfQuadernoBlob();

      const nomePulito = titolo.trim() || "sopralluogo";

      const file = new File([blob], `quaderno-${nomePulito}.pdf`, {
        type: "application/pdf",
      });

      if (
        navigator.share &&
        navigator.canShare?.({
          files: [file],
        })
      ) {
        await navigator.share({
          title: "Quaderno Tecnico ARTECNA",
          text: "Quaderno Tecnico ARTECNA OS",
          files: [file],
        });

        return;
      }

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;
      link.download = file.name;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      alert(
        "La condivisione diretta non è disponibile. Il PDF è stato scaricato.",
      );
    } catch (error) {
      console.error("Errore condivisione Quaderno:", error);

      alert("Non è stato possibile condividere il Quaderno.");
    }
  };

  const [allegati, setAllegati] = useState<AllegatoNota[]>([]);
  const fotoMemoria = allegati
    .map(allegatoToArtecnaPhoto)
    .filter((foto): foto is NonNullable<typeof foto> => foto !== null);
  const [trascinamentoAllegatiAttivo, setTrascinamentoAllegatiAttivo] =
    useState(false);
  const [analisiAi, setAnalisiAi] = useState<AnalisiNota | null>(null);
  const [decisionPlan, setDecisionPlan] = useState<DecisionPlan | null>(null);
  const [stato, setStato] = useState("");
  const [pronto, setPronto] = useState(false);
  const [registrazioneAttiva, setRegistrazioneAttiva] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const testoNotaRef = useRef<HTMLTextAreaElement>(null);
  const inputChecklistRefs = useRef(new Map<string, HTMLInputElement>());
const panStartRef = useRef({
  pointerX: 0,
  pointerY: 0,
  offsetX: 0,
  offsetY: 0,
});
  const checklistDaFocalizzareRef = useRef<string | null>(null);
  const notaVisibile = integrato || mostraAppuntiSopralluogo;

useEffect(() => {
  if (!notaVisibile) return;

  setToolbarEspansa(false);
}, [notaVisibile]);

  const fotoCollegate = fotoGalleria.filter(
    (foto) =>
      foto.sopralluogo_id === sopralluogoAperto.id &&
      (foto.tag || "")
        .split(",")
        .map((tag) => tag.trim())
        .includes("smart-note"),
  );

  const fotoGalleriaMemoria = fotoCollegate.map(fotoGalleriaToArtecnaPhoto);

  const fotoSopralluogo = mergePhotoMemory(fotoMemoria, fotoGalleriaMemoria);

  useLayoutEffect(() => {
    const textarea = testoNotaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(180, textarea.scrollHeight)}px`;
  }, [testo]);

  useEffect(() => {
    if (!notaVisibile || !sopralluogoAperto.id) return;

    let attivo = true;

    const caricaNota = async () => {
      setPronto(false);
      setNotaId(null);
      setStato("Caricamento nota…");

      // Reset immediato del Quaderno quando cambia sopralluogo
      setDisegni([]);
      setSfondoDisegno(null);
      setOggettiGrafici([]);
      setOggettoGraficoSelezionatoId(null);

      setPagineQuaderno([
        {
          id: crypto.randomUUID(),
          titolo: "Pagina 1",
          disegni: [],
          sfondoDisegno: null,
          zoomSfondo: 1,
          oggettiGrafici: [],
        },
      ]);

      setPaginaCorrenteIndex(0);
            setBackgroundTransform(createDefaultBackgroundTransform());

      setZoomSfondo(1);
      setSfondoX(0);
      setSfondoY(0);

      setSfondoSelezionato(false);
      setPinSelezionatoId(null);

      setUndoStack([]);
      setRedoStack([]);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setStato("Accedi per utilizzare le note");
        return;
      }

      const { data, error } = await supabase
        .from("note_sopralluogo")
        .select("*")
        .eq("sopralluogo_id", sopralluogoAperto.id)
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (!attivo) return;
      if (error) {
        setStato(
          "Sistema Note non configurato: applicare la migrazione Supabase",
        );
        return;
      }

      if (data) {
        setNotaId(data.id);
        setTitolo(data.titolo || "");
        setTesto(data.testo || "");
        setChecklist(data.checklist || []);

        const disegniSalvati = data.disegni || [];
        const sonoPagineQuaderno =
          Array.isArray(disegniSalvati) &&
          disegniSalvati.length > 0 &&
          "disegni" in disegniSalvati[0];

        if (sonoPagineQuaderno) {
          const pagineSalvate = disegniSalvati as PaginaQuadernoNota[];

          const pagineNormalizzate = pagineSalvate.map((pagina, index) => ({
            ...pagina,
            id: pagina.id || crypto.randomUUID(),
            titolo: pagina.titolo || `Pagina ${index + 1}`,
            disegni: Array.isArray(pagina.disegni) ? pagina.disegni : [],
            sfondoDisegno: pagina.sfondoDisegno || null,
            zoomSfondo: pagina.zoomSfondo ?? 1,
            oggettiGrafici: Array.isArray(pagina.oggettiGrafici)
              ? pagina.oggettiGrafici
              : [],

workspaceCadEntities:
  Array.isArray(
    pagina.workspaceCadEntities,
  )
    ? pagina.workspaceCadEntities
    : [],

workspaceColumns:
  typeof pagina.workspaceColumns === "number"
    ? pagina.workspaceColumns
    : undefined,

layers: Array.isArray(pagina.layers)
  ? pagina.layers.map((layer) => ({
      ...layer,
    }))
  : DEFAULT_QUADERNO_LAYERS.map((layer) => ({
      ...layer,
    })),
}))

const primaPagina = pagineNormalizzate[0];

const trovaPaginaNormalizzataDaPunto = (
  point: CadPoint,
) => {
  for (const pagina of pagineNormalizzate) {
    const layout =
      pagina.pageLayout ??
      createQuadernoPageLayout()

    const x =
      pagina.workspaceX ?? 0

    const y =
      pagina.workspaceY ?? 0

    if (
      point.x >= x &&
      point.x <= x + layout.width &&
      point.y >= y &&
      point.y <= y + layout.height
    ) {
      return pagina
    }
  }

  return null
}

const workspaceCadEntitiesNormalizzate =
  Array.isArray(
    primaPagina?.workspaceCadEntities,
  )
    ? primaPagina.workspaceCadEntities.map(
        (entity) => {
          const layerEsiste =
            primaPagina?.layers?.some(
              (layer) =>
                layer.id === entity.layerId,
            ) ?? false

          const paginaProprietaria =
            typeof entity.metadata?.workspacePageId === "string"
              ? null
              : entity.type === "line"
                ? trovaPaginaNormalizzataDaPunto(entity.start) ??
                  trovaPaginaNormalizzataDaPunto(entity.end)
                : null

          if (
            layerEsiste &&
            !paginaProprietaria
          ) {
            return entity
          }

          return {
            ...entity,
            layerId: layerEsiste
              ? entity.layerId
              : "drawing",
            metadata: paginaProprietaria
              ? {
                  ...entity.metadata,
                  workspacePageId:
                    paginaProprietaria.id,
                }
              : entity.metadata,
          }
        },
      )
    : []

setWorkspaceCadEntities(
  workspaceCadEntitiesNormalizzate,
)
          setPagineQuaderno(pagineNormalizzate)

setWorkspacePosterImages(
  primaPagina?.workspacePosterImages ?? [],
)

setColonneWorkspace(
  Math.max(
    1,
    primaPagina?.workspaceColumns ?? 2,
  ),
)

setPaginaCorrenteIndex(0)
setPageLayout(
  primaPagina?.pageLayout ??
    createQuadernoPageLayout(),
);
          setDisegni(primaPagina?.disegni || []);
          setSfondoDisegno(primaPagina?.sfondoDisegno || null);
          setZoomSfondo(primaPagina?.zoomSfondo ?? 1);
          setOggettiGrafici(primaPagina?.oggettiGrafici || []);
setScaleCalibration(
  primaPagina?.scaleCalibration ?? null,
);

setLayers(
  primaPagina?.layers?.map((layer) => ({
    ...layer,
  })) ||
    DEFAULT_QUADERNO_LAYERS.map((layer) => ({
      ...layer,
    })),
)
          setOggettoGraficoSelezionatoId(null);
        } 
else {
          const paginaIniziale: PaginaQuadernoNota = {
  id: crypto.randomUUID(),
  titolo: "Pagina 1",
  disegni: Array.isArray(disegniSalvati)
  ? disegniSalvati
  : [],
cadDimensions: [],
cadEntities: [],
sfondoDisegno: null,
  zoomSfondo: 1,
  oggettiGrafici: [],
}

          setPagineQuaderno([paginaIniziale]);
setWorkspaceCadEntities([])
          setPaginaCorrenteIndex(0);
                    setDisegni(paginaIniziale.disegni);
          setSfondoDisegno(null);

          setZoomSfondo(1);
          setOggettiGrafici([]);
          setOggettoGraficoSelezionatoId(null);
setScaleCalibration(null);
        }

        setAnalisiAi(data.analisi_ai || null);

        const { data: file } = await supabase
          .from("note_allegati")
          .select("*")
          .eq("nota_id", data.id)
          .order("created_at", { ascending: true });

        setAllegati(file || []);
      } else {
        setTitolo(
          sopralluogoAperto.tipo_lavoro ||
            `Nota ${sopralluogoAperto.cliente || "sopralluogo"}`,
        );
        setTesto("");
        setChecklist([]);
        setDisegni([]);
        setSfondoDisegno(null);
setWorkspaceCadEntities([])
        setZoomSfondo(1);
        setOggettiGrafici([]);
        setOggettoGraficoSelezionatoId(null);
        setAllegati([]);
        setAnalisiAi(null);
      }

      setPronto(true);
      setStato("Nota pronta");
    };

    void caricaNota();
    return () => {
      attivo = false;
    };
  }, [
    notaVisibile,
    sopralluogoAperto.id,
    sopralluogoAperto.cliente,
    sopralluogoAperto.tipo_lavoro,
    supabase,


  ]);

   const salvaNota = async (mostraConferma = true) => {
    if (!sopralluogoAperto.id) return null;

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setStato("Accedi per salvare la nota");
      return null;
    }

    const pagineAggiornate =
  pagineQuaderno.map((pagina, index) => {
    const paginaAggiornata =
      index === paginaCorrenteIndex
        ? {
            ...pagina,
            disegni,
            sfondoDisegno,
            zoomSfondo,
            oggettiGrafici,
            layers,
            backgroundTransform,
            scaleCalibration,
          }
        : {
            ...pagina,
          }

   if (index === 0) {
  return {
    ...paginaAggiornata,
    workspaceCadEntities,
    workspacePosterImages,
    workspaceColumns: colonneWorkspace,
  }
}

    return paginaAggiornata
  })

    setStato("Salvataggio…");

const payloadDebug = {
  sopralluogo_id: sopralluogoAperto.id,
  user_id: userData.user.id,
  titolo: titolo.trim(),
  testo,
  checklist,
  disegni: pagineAggiornate,
  analisi_ai: analisiAi,
  updated_at: new Date().toISOString(),
};

const dimensionePayloadMb =
  new Blob([JSON.stringify(payloadDebug)]).size /
  1024 /
  1024;

console.warn(
  "DIMENSIONE SALVATAGGIO NOTA:",
  dimensionePayloadMb.toFixed(2),
  "MB",
);

    const { data, error } = await supabase
      .from("note_sopralluogo")
      .upsert(
        {
          sopralluogo_id: sopralluogoAperto.id,
          user_id: userData.user.id,
          titolo: titolo.trim(),
          testo,
          checklist,
          disegni: pagineAggiornate,
          analisi_ai: analisiAi,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,sopralluogo_id" },
      )
      .select("id")
      .single();

    if (error) {
      setStato(`Errore salvataggio: ${error.message}`);
      return null;
    }

    setNotaId(data.id);
setQuadernoDirty(false);

    setStato(
      mostraConferma
        ? "Nota salvata"
        : "Salvata automaticamente",
    );

    return data.id as string;
  };

  useEffect(() => {
  if (
  !pronto ||
  !quadernoDirty ||
  trasformazioneOggettoAttiva
) {
  return;
}

    const timer = window.setTimeout(() => {
  setQuadernoDirty(false);
  void salvaNota(false);
}, 900);

    return () => window.clearTimeout(timer);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    titolo,
  testo,
  checklist,
  disegni,
  sfondoDisegno,
  zoomSfondo,
  oggettiGrafici,
  layers,
  analisiAi,
  pronto,
  quadernoDirty,
  trasformazioneOggettoAttiva,
]);

  const salvaFile = async (files: File[], tipo: AllegatoNota["tipo"]) => {
    if (files.length === 0) return [];

    const id = notaId || (await salvaNota(false));
    if (!id || !sopralluogoAperto.id) return [];

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return [];

    setStato("Caricamento allegati…");

    const fileSalvati: File[] = [];

    for (const file of files) {
      const nomePulito = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `utenti/${userData.user.id}/sopralluoghi/${sopralluogoAperto.id}/note/${Date.now()}_${crypto.randomUUID()}_${nomePulito}`;

      const { error: uploadError } = await supabase.storage
        .from("preventivi")
        .upload(path, file);

      if (uploadError) {
        setStato(`Errore caricamento: ${uploadError.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("preventivi")
        .getPublicUrl(path);

      const { data: allegato, error } = await supabase
        .from("note_allegati")
        .insert({
          nota_id: id,
          user_id: userData.user.id,
          nome_file: file.name,
          tipo,
          mime_type: file.type || null,
          storage_path: path,
          url: urlData.publicUrl,
        })
        .select("*")
        .single();

      if (!error && allegato) {
        setAllegati((correnti) => [...correnti, allegato]);
        fileSalvati.push(file);
      } else {
        await supabase.storage.from("preventivi").remove([path]);
        setStato(
          `Errore salvataggio allegato: ${error?.message || "operazione non riuscita"}`,
        );
      }
    }

    if (fileSalvati.length === files.length) {
      setStato(files.length === 1 ? "Allegato caricato" : "Allegati caricati");
    }
    return fileSalvati;
  };

  const caricaFile = (
    event: ChangeEvent<HTMLInputElement>,
    tipo: AllegatoNota["tipo"],
  ) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    void salvaFile(files, tipo);
  };
  const gestisciTrascinamentoAllegati = (
    event: DragEvent<HTMLLabelElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setTrascinamentoAllegatiAttivo(true);
  };

  const terminaTrascinamentoAllegati = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setTrascinamentoAllegatiAttivo(false);
  };

  const rilasciaAllegati = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setTrascinamentoAllegatiAttivo(false);

    const files = Array.from(event.dataTransfer.files || []);
    void salvaFile(files, "allegato");
  };

  const incollaAllegati = (event: ClipboardEvent<HTMLLabelElement>) => {
    const files = Array.from(event.clipboardData.files || []);

    if (files.length === 0) return;

    event.preventDefault();
    void salvaFile(files, "allegato");
  };
  const eliminaAllegato = async (allegato: AllegatoNota) => {
    await supabase.storage.from("preventivi").remove([allegato.storage_path]);
    const { error } = await supabase
      .from("note_allegati")
      .delete()
      .eq("id", allegato.id);

    if (!error) {
      setAllegati((correnti) =>
        correnti.filter((item) => item.id !== allegato.id),
      );
    }
  };

  const avviaRegistrazione = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setStato("Registrazione audio non supportata su questo dispositivo");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) =>
        audioChunksRef.current.push(event.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const tipoAudio = recorder.mimeType || "audio/webm";
        const estensione = tipoAudio.includes("mp4") ? "m4a" : "webm";
        const blob = new Blob(audioChunksRef.current, { type: tipoAudio });
        const file = new File(
          [blob],
          `Nota_vocale_${Date.now()}.${estensione}`,
          { type: tipoAudio },
        );
        void salvaFile([file], "audio");
      };
      recorder.start();
      recorderRef.current = recorder;
      setRegistrazioneAttiva(true);
      setStato("Registrazione in corso…");
    } catch {
      setStato("Permesso microfono non concesso");
    }
  };

  const fermaRegistrazione = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRegistrazioneAttiva(false);
  };

  const osservaNotaConDecisionEngine = () => {
    const testoCompleto = [
      titolo,
      testo,
      ...checklist.map((voce) => voce.testo),
    ]
      .filter(Boolean)
      .join("\n");

    const builder = new DecisionBuilder();

    const piano = builder.build({
      text: testoCompleto,
      source: "note",
      metadata: {
        sopralluogoId: sopralluogoAperto.id,
        cliente: sopralluogoAperto.cliente,
        tipoLavoro: sopralluogoAperto.tipo_lavoro,
      },
    });

    setDecisionPlan(piano);
  };
  const annullaPropostaDecisione = (proposalId: string) => {
    setDecisionPlan((pianoCorrente) => {
      if (!pianoCorrente) return null;

      const proposals = pianoCorrente.proposals.filter(
        (proposal) => proposal.id !== proposalId,
      );

      if (proposals.length === 0) {
        return null;
      }

      return {
        ...pianoCorrente,
        proposals,
      };
    });

    setStato("Proposta annullata");
  };

  const eseguiPropostaDecisione = async (proposal: DecisionProposal) => {
    setStato(`Esecuzione: ${proposal.title}`);

    if (
      proposal.type === "create_estimate" &&
      generaPreventivoAiDaSopralluogo
    ) {
      const completato =
        await generaPreventivoAiDaSopralluogo(sopralluogoAperto);

      if (completato !== false) {
        setStato("Preventivo AI generato");
        return;
      }
    }

    const risultato = await executeWorkflowProposal(proposal);

    setStato(risultato.message);
  };
  const analizzaNota = async () => {
    setStato("L’AI osserva la nota…");
    osservaNotaConDecisionEngine();

    const immagini = fotoMemoria
      .map((foto) => foto.url)
      .concat(fotoCollegate.map((foto) => foto.immagine_base64));

    const audio = allegati
      .filter((allegato) => allegato.tipo === "audio")
      .map((allegato) => ({
        url: allegato.url,
        nome: allegato.nome_file,
      }));

    const response = await fetch("/api/analizza-nota-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titolo,
        testo,
        checklist,
        immagini,
        audio,
        disegni,
        contesto: sopralluogoAperto,
      }),
    });

    const risultato = await response.json();

    if (!response.ok) {
      setStato(`Errore AI: ${risultato.error || "analisi non disponibile"}`);
      return;
    }

    setAnalisiAi(risultato);
    setStato("Analisi AI aggiornata");
  };

  const aggiungiChecklist = () => {
    const id = crypto.randomUUID();
    checklistDaFocalizzareRef.current = id;

    flushSync(() => {
      setChecklist((corrente) => [
        ...corrente,
        { id, testo: "", completata: false },
      ]);
    });

    const input = inputChecklistRefs.current.get(id);
    input?.focus();
    checklistDaFocalizzareRef.current = null;
  };

  const stampaNota = () => window.print();

  const dataSopralluogo = sopralluogoAperto.data_sopralluogo
    ? new Intl.DateTimeFormat("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(`${sopralluogoAperto.data_sopralluogo}T00:00:00`))
    : "";
  const dataOraSopralluogo = [
    dataSopralluogo,
    sopralluogoAperto.ora_appuntamento
      ? `ore ${sopralluogoAperto.ora_appuntamento.slice(0, 5)}`
      : "",
  ]
    .filter(Boolean)
    .join(", ");
const paginaAttivaId =
  pagineQuaderno[paginaCorrenteIndex]?.id

const paginaAttiva =
  pagineQuaderno[paginaCorrenteIndex]

const dimensioniWorkspace =
  pagineQuaderno.reduce(
    (dimensioni, pagina) => {
      const layout =
        pagina.pageLayout ??
        createQuadernoPageLayout()

      const x =
        pagina.workspaceX ?? 0

      const y =
        pagina.workspaceY ?? 0

      return {
        width: Math.max(
          dimensioni.width,
          x + layout.width,
        ),
        height: Math.max(
          dimensioni.height,
          y + layout.height,
        ),
      }
    },
    {
      width: 0,
      height: 0,
    },
  )

 const iniziaResizePoster = (
  event: React.PointerEvent<SVGCircleElement>,
  oggetto: OggettoGraficoQuaderno,
  handle:
    | "nw"
    | "n"
    | "ne"
    | "e"
    | "se"
    | "s"
    | "sw"
    | "w",
) => {
  event.preventDefault()
  event.stopPropagation()

  const svg =
    event.currentTarget.ownerSVGElement

  if (!svg) {
    return
  }

  const rect =
    svg.getBoundingClientRect()

  const puntoWorkspace: CadPoint = {
    x:
      ((event.clientX - rect.left) /
        rect.width) *
      dimensioniWorkspace.width,

    y:
      ((event.clientY - rect.top) /
        rect.height) *
      dimensioniWorkspace.height,
  }

  workspacePosterResizeRef.current = {
    attivo: true,
    id: oggetto.id,
    handle,
    start: puntoWorkspace,
    transformIniziale: {
      ...oggetto.transform,
    },
  }

  svg.setPointerCapture(
    event.pointerId,
  )
}

return (
  <section style={{ marginTop: 16 }}>
      <style>{`
        .smart-note-print {
          display: none;
        }

        @media print {
          @page {
            margin: 16mm;
          }

          body * {
            visibility: hidden !important;
          }

          .smart-note-print,
          .smart-note-print * {
            visibility: visible !important;
          }

          .smart-note-print {
            display: block !important;
            position: absolute;
            inset: 0 auto auto 0;
            width: 100%;
            color: #111 !important;
            background: #fff !important;
            font-family: Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.45;
          }

          .smart-note-print [role='toolbar'] {
            display: none !important;
          }

          .smart-note-print section,
          .smart-note-print article,
          .smart-note-print figure,
          .smart-note-print li {
            break-inside: avoid;
          }

          .smart-note-print svg,
          .smart-note-print img {
            max-width: 100% !important;
          }
        }
      `}</style>
      {!integrato && (
        <button
          type="button"
          onClick={() => setMostraAppuntiSopralluogo(!mostraAppuntiSopralluogo)}
          style={{ ...buttonPrimary, marginTop: 0 }}
        >
          📝 {mostraAppuntiSopralluogo ? "Chiudi Note" : "Apri Note"}
        </button>
      )}

      {notaVisibile && (
  <div
    ref={quadernoContainerRef}
    style={{
      position: quadernoEspanso
        ? "fixed"
        : "relative",

      top: quadernoEspanso
        ? quadernoEspansoTop
        : "auto",

      left: quadernoEspanso ? 2 : "auto",
      right: quadernoEspanso ? 2 : "auto",
      bottom: quadernoEspanso ? 2 : "auto",

      zIndex: quadernoEspanso ? 10000 : "auto",

      width: quadernoEspanso ? "auto" : "100%",
      maxWidth: quadernoEspanso ? "none" : "100%",
      height: quadernoEspanso
        ? "calc(100vh - 4px)"
        : "auto",

            marginTop: quadernoEspanso ? 0 : 14,
            padding: 16,

            border: "1px solid #cbd5e1",
            borderRadius: 16,
            background: "#f8fafc",

            overflow: quadernoEspanso ? "auto" : "visible",
            boxShadow: quadernoEspanso
              ? "0 24px 80px rgba(15, 23, 42, 0.45)"
              : "none",
          }}
        >

{quadernoEspanso && (
  <button
    type="button"
   onClick={() => {
  if (onChiudiFascicolo) {
    onChiudiFascicolo()
    return
  }

  setMostraAppuntiSopralluogo(false)
}}
    aria-label="Chiudi Quaderno"
    title="Chiudi Quaderno"
    style={{
      position: "fixed",
      top: quadernoEspansoTop + 12,
      right: 16,
      zIndex: 10100,
      width: 42,
      height: 42,
      padding: 0,
      borderRadius: "50%",
      border: "1px solid #cbd5e1",
      background: "#ffffff",
      color: "#0f172a",
      fontSize: 22,
      fontWeight: 800,
      lineHeight: 1,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow:
        "0 4px 14px rgba(15,23,42,0.18)",
    }}
  >
    ×
  </button>
)}
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              value={titolo}
              onChange={(event) => setTitolo(event.target.value)}
              placeholder="Titolo della nota"
              style={{
                flex: "1 1 280px",
                padding: 12,
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                fontSize: 18,
                fontWeight: 700,
              }}
            />
           
            <button
              type="button"
              onClick={() => void salvaNota()}
              style={buttonPrimary}
            >
              Salva ora
            </button>
            <button type="button" onClick={stampaNota} style={buttonSecondary}>
              🖨️ Stampa nota
            </button>
            <span style={{ fontSize: 13, color: "#64748b" }}>
{stato}
</span>
  </div>
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 8,
    marginBottom: 8,
  }}
>
<div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 0,
              }}
            >
              <button
                type="button"
                onClick={() => vaiAllaPagina(paginaCorrenteIndex - 1)}
                disabled={paginaCorrenteIndex === 0}
                style={buttonSecondary}
              >
                ◀
              </button>

              <strong>
                Pagina {paginaCorrenteIndex + 1} di {pagineQuaderno.length}
              </strong>

              <button
                type="button"
                onClick={() => vaiAllaPagina(paginaCorrenteIndex + 1)}
                disabled={paginaCorrenteIndex === pagineQuaderno.length - 1}
                style={buttonSecondary}
              >
                ▶
              </button>

              <button
                type="button"
                onClick={aggiungiPagina}
                style={buttonPrimary}
              >
                ➕ Pagina
              </button>

<button
  type="button"
  onClick={() => {
    const prossimoValore =
      !spostaTavolaAttivo

    setSpostaTavolaAttivo(
      prossimoValore,
    )

    if (prossimoValore) {
      setManoAttiva(false)
      setPanInCorso(false)
      setModalitaSelezione(true)
    }
  }}
  style={{
    ...buttonSecondary,
    background:
      spostaTavolaAttivo
        ? "#dbeafe"
        : buttonSecondary.background,
    borderColor:
      spostaTavolaAttivo
        ? "#2563eb"
        : undefined,
    color:
      spostaTavolaAttivo
        ? "#1d4ed8"
        : undefined,
  }}
>
  ↔ Sposta tavola
</button>

<button
  type="button"
  onClick={eliminaPaginaCorrente}
  disabled={pagineQuaderno.length <= 1}
  style={{
    ...buttonSecondary,
    opacity:
      pagineQuaderno.length <= 1
        ? 0.45
        : 1,
    cursor:
      pagineQuaderno.length <= 1
        ? "not-allowed"
        : "pointer",
    borderColor: "#fecaca",
    color: "#991b1b",
  }}
>
  🗑 Elimina pagina
</button>
            </div>
         

         <div
  style={{
    marginTop: 8,
  }}
>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
                marginTop: 0,
                marginBottom: 0,
              }}
            >
              <label
                style={{
                  ...buttonSecondary,
                  cursor: "pointer",
                }}
              >
                🗂 Base di lavoro
                <input
                  type="file"
                  accept="image/*"
                  hidden
              onChange={async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";

  if (!file || !sopralluogoAperto.id) return;

  setStato("Caricamento immagine…");

  const { data: userData } =
    await supabase.auth.getUser();

  if (!userData.user) {
    setStato("Accedi per caricare l'immagine");
    return;
  }

const dimensioniNaturali =
  await new Promise<{
    width: number
    height: number
  } | null>((resolve) => {
    const urlLocale =
      URL.createObjectURL(file)

    const immagine =
      new Image()

    immagine.onload = () => {
      resolve({
        width: immagine.naturalWidth,
        height: immagine.naturalHeight,
      })

      URL.revokeObjectURL(urlLocale)
    }

    immagine.onerror = () => {
      URL.revokeObjectURL(urlLocale)
      resolve(null)
    }

    immagine.src = urlLocale
  })

  const nomePulito = file.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  const storagePath =
    `utenti/${userData.user.id}` +
    `/sopralluoghi/${sopralluogoAperto.id}` +
    `/quaderno/${Date.now()}_` +
    `${crypto.randomUUID()}_${nomePulito}`;

  const { error: uploadError } =
    await supabase.storage
      .from("preventivi")
      .upload(storagePath, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

  if (uploadError) {
    setStato(
      `Errore caricamento immagine: ${uploadError.message}`,
    );
    return;
  }

  const { data: urlData } =
    supabase.storage
      .from("preventivi")
      .getPublicUrl(storagePath);

 const nuovoOggetto: OggettoGraficoQuaderno = {
  id: crypto.randomUUID(),
  layerId: layerAttivoId,
  tipo: "immagine",
  sorgente: urlData.publicUrl,

  larghezzaNaturale:
    dimensioniNaturali?.width,

  altezzaNaturale:
    dimensioniNaturali?.height,

  transform: {
      x: 40,
      y: 40,
      width: Math.min(
        pageLayout.width * 0.6,
        600,
      ),
      height: Math.min(
        pageLayout.height * 0.6,
        400,
      ),
      rotation: 0,
      locked: false,
    },
  };

  const nuoviOggetti = [
    ...oggettiGrafici,
    nuovoOggetto,
  ];

  aggiornaQuaderno({
    oggettiGrafici: nuoviOggetti,
  });

  setOggettoGraficoSelezionatoId(
    nuovoOggetto.id,
  );

  setStato("Immagine caricata");
}}                 


                />
              </label>
              <button
                type="button"
                onClick={() => void salvaNota()}
                style={buttonPrimary}
              >
                💾 Salva
              </button>

<button
  type="button"
  onClick={() => {
  // POSTER -> IMMAGINE NORMALE
  if (workspacePosterSelezionatoId) {
    const immaginePoster =
      workspacePosterImages.find(
        (oggetto) =>
          oggetto.id ===
          workspacePosterSelezionatoId,
      )

       if (!immaginePoster) {
      return
    }

    const centroPosterWorkspace: CadPoint = {
      x:
        immaginePoster.transform.x +
        immaginePoster.transform.width / 2,

      y:
        immaginePoster.transform.y +
        immaginePoster.transform.height / 2,
    }

    const paginaDestinazione =
      trovaPaginaDaPuntoWorkspace(
        centroPosterWorkspace,
      )

    if (!paginaDestinazione) {
      return
    }

    const posizioneLocale =
      workspacePointToPagePoint(
        {
          x: immaginePoster.transform.x,
          y: immaginePoster.transform.y,
        },
        paginaDestinazione,
      )

    const immaginePagina = {
      ...immaginePoster,

      transform: {
        ...immaginePoster.transform,

        x: posizioneLocale.x,
        y: posizioneLocale.y,
      },
    }

    setWorkspacePosterImages(
      (correnti) =>
        correnti.filter(
          (oggetto) =>
            oggetto.id !==
            workspacePosterSelezionatoId,
        ),
    )

   if (
  paginaDestinazione.id ===
  paginaQuadernoCorrente?.id
) {
  aggiornaQuaderno({
    oggettiGrafici: [
      ...oggettiGrafici,
      immaginePagina,
    ],
  })
} else {
  const nuovoIndex =
    pagineQuaderno.findIndex(
      (pagina) =>
        pagina.id ===
        paginaDestinazione.id,
    )

  if (nuovoIndex < 0) {
    return
  }

  const oggettiDestinazione = [
    ...(
      paginaDestinazione.oggettiGrafici ??
      []
    ),
    immaginePagina,
  ]

  setPagineQuaderno(
    (pagineCorrenti) =>
      pagineCorrenti.map(
        (pagina, index) => {
          if (
            index === paginaCorrenteIndex
          ) {
            return {
              ...pagina,
              disegni,
              sfondoDisegno,
              zoomSfondo,
              oggettiGrafici,
              layers,
              pageLayout,
            }
          }

          if (
            pagina.id ===
            paginaDestinazione.id
          ) {
            return {
              ...pagina,
              oggettiGrafici:
                oggettiDestinazione,
            }
          }

          return pagina
        },
      ),
  )

  setPaginaCorrenteIndex(nuovoIndex)

  setPageLayout(
    paginaDestinazione.pageLayout ??
      createQuadernoPageLayout(),
  )

  setDisegni(
    paginaDestinazione.disegni || [],
  )

  setSfondoDisegno(
    paginaDestinazione.sfondoDisegno ||
      null,
  )

  setZoomSfondo(
    paginaDestinazione.zoomSfondo ?? 1,
  )

  setOggettiGrafici(
    oggettiDestinazione,
  )

  setScaleCalibration(
    paginaDestinazione
      .scaleCalibration ?? null,
  )

  setLayers(
    paginaDestinazione.layers?.map(
      (layer) => ({
        ...layer,
      }),
    ) ||
      DEFAULT_QUADERNO_LAYERS.map(
        (layer) => ({
          ...layer,
        }),
      ),
  )

  setPinSelezionatoId(null)
  setSfondoSelezionato(false)
}

    setWorkspacePosterSelezionatoId(null)

    setOggettoGraficoSelezionatoId(
      immaginePagina.id,
    )

    setQuadernoDirty(true)

    return
  }

  // IMMAGINE NORMALE -> POSTER
  if (!oggettoGraficoSelezionato) {
    return
  }

  const rettangoloVisibile =
  calculateVisibleImageRect(
    oggettoGraficoSelezionato.transform,
    oggettoGraficoSelezionato
      .larghezzaNaturale &&
    oggettoGraficoSelezionato
      .altezzaNaturale
      ? {
          width:
            oggettoGraficoSelezionato
              .larghezzaNaturale,

          height:
            oggettoGraficoSelezionato
              .altezzaNaturale,
        }
      : null,
  )

const posizioneWorkspace =
  paginaQuadernoCorrente
    ? pagePointToWorkspacePoint(
        {
          x: rettangoloVisibile.x,
          y: rettangoloVisibile.y,
        },
        paginaQuadernoCorrente,
      )
    : {
        x: rettangoloVisibile.x,
        y: rettangoloVisibile.y,
      }

const immaginePoster = {
  ...oggettoGraficoSelezionato,

  transform: {
    ...rettangoloVisibile,

    x: posizioneWorkspace.x,
    y: posizioneWorkspace.y,
  },
}

  setWorkspacePosterImages(
    (correnti) => [
      ...correnti,
      immaginePoster,
    ],
  )

  const nuoviOggetti =
    oggettiGrafici.filter(
      (oggetto) =>
        oggetto.id !==
        oggettoGraficoSelezionato.id,
    )

  aggiornaQuaderno({
    oggettiGrafici:
      nuoviOggetti,
  })

  setOggettoGraficoSelezionatoId(null)

  setWorkspacePosterSelezionatoId(
    immaginePoster.id,
  )

  setQuadernoDirty(true)
}}

  disabled={
  !oggettoGraficoSelezionatoId &&
  !workspacePosterSelezionatoId
}
style={{
  ...buttonSecondary,

  opacity:
    oggettoGraficoSelezionatoId ||
    workspacePosterSelezionatoId
      ? 1
      : 0.45,

  cursor:
    oggettoGraficoSelezionatoId ||
    workspacePosterSelezionatoId
      ? "pointer"
      : "not-allowed",

  background:
    workspacePosterSelezionatoId
      ? "#dbeafe"
      : buttonSecondary.background,

  borderColor:
    workspacePosterSelezionatoId
      ? "#2563eb"
      : buttonSecondary.borderColor,
}}
>
  Poster
</button>

<button
  type="button"
  onClick={duplicaImmagineSelezionata}
  disabled={!oggettoGraficoSelezionatoId}
  style={{
    ...buttonSecondary,
    opacity:
      oggettoGraficoSelezionatoId
        ? 1
        : 0.45,
    cursor:
      oggettoGraficoSelezionatoId
        ? "pointer"
        : "not-allowed",
  }}
>
  Duplica immagine
</button>

             <button
  type="button"
  onClick={eliminaImmagineSelezionata}
  disabled={!oggettoGraficoSelezionatoId}
  style={{
    ...buttonSecondary,
    opacity:
      oggettoGraficoSelezionatoId
        ? 1
        : 0.45,
    cursor:
      oggettoGraficoSelezionatoId
        ? "pointer"
        : "not-allowed",
    borderColor: "#fecaca",
    color: "#991b1b",
  }}
>
  Elimina immagine
</button>

<button
  type="button"
  onClick={resettaFoglio}
  style={{
    ...buttonSecondary,
    borderColor: "#fca5a5",
    color: "#991b1b",
  }}
>
  Reset pagina
</button>

              {oggettoGraficoSelezionato && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                <span style={{ fontSize: 13, color: "#16a34a" }}>
  Scala immagine selezionata
</span>

<button
  type="button"
  onClick={() =>
    aggiornaScalaImmagineSelezionata(
      percentualeScalaImmagine - 10,
    )
  }
  style={buttonSecondary}
>
  −
</button>

<strong>{percentualeScalaImmagine}%</strong>

<button
  type="button"
  onClick={() =>
    aggiornaScalaImmagineSelezionata(
      percentualeScalaImmagine + 10,
    )
  }
  style={buttonSecondary}
>
  +
</button>

<input
  type="range"
  min="25"
  max="400"
  step="5"
  value={percentualeScalaImmagine}
  onChange={(event) =>
    aggiornaScalaImmagineSelezionata(
      Number(event.target.value),
    )
  }
  style={{ width: 180 }}
  aria-label="Scala dell'immagine selezionata"
/>

<button
  type="button"
  onClick={() =>
    aggiornaScalaImmagineSelezionata(100)
  }
  style={buttonSecondary}
>
  100%
</button>
                </div>
              )}
            </div>
</div>




<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 10,
    padding: 6,
    width: "fit-content",
    maxWidth: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    background: "#f8fafc",
    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
  }}
>
  <button
    type="button"
    onClick={() =>
      setToolbarEspansa((valore) => !valore)
    }
    aria-pressed={toolbarEspansa}
    title="Apri o chiudi gli strumenti del Quaderno"
    style={{
      ...buttonSecondary,
      padding: "6px 10px",
      minHeight: 32,
      fontSize: 13,
      whiteSpace: "nowrap",
      background: toolbarEspansa
        ? "#dbeafe"
        : buttonSecondary.background,
      boxShadow: toolbarEspansa
        ? "0 0 0 2px #2563eb"
        : "none",
    }}
  >
    Strumenti
  </button>
<button
  type="button"
  onClick={() =>
    setFoglioPanelAperto((valore) => !valore)
  }
  aria-pressed={foglioPanelAperto}
  title="Apri o chiudi il pannello Foglio"
  style={{
    ...buttonSecondary,
    padding: "6px 10px",
    minHeight: 32,
    fontSize: 13,
    whiteSpace: "nowrap",
    background: foglioPanelAperto
      ? "#dbeafe"
      : buttonSecondary.background,
    boxShadow: foglioPanelAperto
      ? "0 0 0 2px #2563eb"
      : "none",
  }}
>
  Foglio
</button>

<button
  type="button"
  onClick={() =>
    setLayerPanelAperto((valore) => !valore)
  }
  aria-pressed={layerPanelAperto}
  title="Apri o chiudi il pannello Layer"
  style={{
    ...buttonSecondary,
    padding: "6px 10px",
    minHeight: 32,
    fontSize: 13,
    whiteSpace: "nowrap",
    background: layerPanelAperto
      ? "#dbeafe"
      : buttonSecondary.background,
    boxShadow: layerPanelAperto
      ? "0 0 0 2px #2563eb"
      : "none",
  }}
>
  Layer
</button>
<button
  type="button"
  onClick={() =>
    setProprietaPanelAperto((valore) => !valore)
  }
  aria-pressed={proprietaPanelAperto}
  title="Apri o chiudi il pannello Proprietà"
  style={{
    ...buttonSecondary,
    padding: "6px 10px",
    minHeight: 32,
    fontSize: 13,
    whiteSpace: "nowrap",
    background: proprietaPanelAperto
      ? "#dbeafe"
      : buttonSecondary.background,
    boxShadow: proprietaPanelAperto
      ? "0 0 0 2px #2563eb"
      : "none",
  }}
>
  Proprietà
</button>

</div>



<WorkspacePanel
  titolo="Strumenti Quaderno"
  aperto={toolbarEspansa}
  posizione={toolbarPosizione}
  dimensioni={toolbarDimensioni}
  onChiudi={() => setToolbarEspansa(false)}
  onCambiaPosizione={setToolbarPosizione}
  onCambiaDimensioni={setToolbarDimensioni}
  larghezzaMinima={220}
  altezzaMinima={140}
  zIndex={10050}
usaPortal
  contentStyle={{
    overflow: "auto",
  }}
>
  <div
    style={{
      display: "flex",
      flexWrap:
        toolbarDimensioni.height <= 150 &&
        toolbarDimensioni.width >= 600
          ? "nowrap"
          : "wrap",
      alignItems: "center",
      alignContent: "flex-start",
      justifyContent: "flex-start",
      gap: gapToolbar,
      overflowX:
        toolbarDimensioni.height <= 150 &&
        toolbarDimensioni.width >= 600
          ? "auto"
          : "visible",
      overflowY: "visible",
    }}
  >

    <ToolButton
  icon="↖"
  label="Selezione"
  active={
  modalitaSelezione &&
  !manoAttiva &&
  !spostaEntitaAttivo
}
  compact={toolbarCompatta}
 onClick={() => {
  setManoAttiva(false)
  setPanInCorso(false)
  setSpostaEntitaAttivo(false)
  setSpostaTavolaAttivo(false)

  setStrumentoDisegno(null)
  setAreaAttiva(false)
  setMetroAttivo(false)
  setCalibrazioneScalaAttiva(false)

  setModalitaSelezione(true)

  setSfondoSelezionato(false)
  setPinSelezionatoId(null)
  setOggettoGraficoSelezionatoId(null)
}}
/>


<ToolButton
  icon="✥"
  label="Sposta"
  active={spostaEntitaAttivo}
  compact={toolbarCompatta}
 onClick={() => {
  setSpostaEntitaAttivo(true)

  setManoAttiva(false)
  setPanInCorso(false)
  setSpostaTavolaAttivo(false)

  setModalitaSelezione(true)

  setStrumentoDisegno(null)
  setAreaAttiva(false)
  setMetroAttivo(false)
  setCalibrazioneScalaAttiva(false)

  setSfondoSelezionato(false)
  setPinSelezionatoId(null)
  setOggettoGraficoSelezionatoId(null)
}}
/>

<ToolButton
  icon="✋"
  label="Mano"
  active={manoAttiva}
  compact={toolbarCompatta}
 onClick={() => {
  setManoAttiva(true)
  setPanInCorso(false)

  setModalitaSelezione(false)
  setSpostaEntitaAttivo(false)
  setSpostaTavolaAttivo(false)

  setStrumentoDisegno(null)
  setAreaAttiva(false)
  setMetroAttivo(false)
  setCalibrazioneScalaAttiva(false)

  setSfondoSelezionato(false)
  setPinSelezionatoId(null)
  setOggettoGraficoSelezionatoId(null)

  setCadEntitySelezionataId(null)
  setCadEntitySelezionateIds([])
}}
/>

<button
  type="button"
  onClick={() =>
    setViewportScale((scalaCorrente) =>
      Math.min(4, Number((scalaCorrente + 0.1).toFixed(2))),
    )
  }
  style={{
    ...stilePulsanteToolbar,
  }}
  title="Aumenta zoom del foglio"
>
  Zoom +
</button>

<button
  type="button"
  onClick={() =>
    setViewportScale((scalaCorrente) =>
      Math.max(0.25, Number((scalaCorrente - 0.1).toFixed(2))),
    )
  }
  style={{
    ...stilePulsanteToolbar,
  }}
  title="Riduci zoom del foglio"
>
  Zoom -
</button>

<button
  type="button"
  onClick={() => {
    setViewportScale(1);
    setViewportOffset({
      x: 0,
      y: 0,
    });
  }}
  style={{
    ...stilePulsanteToolbar,
  }}
  title="Ripristina zoom e posizione"
>
  {Math.round(viewportScale * 100)}%
</button>

              {STRUMENTI_DISEGNO.map((strumento) => (
                <button
                  key={strumento.id}
                  type="button"
                  title={strumento.id === "gomma" ? "Gomma" : strumento.id === "perpendicolare" ? "Perpendicolare: seleziona una linea, poi origine e destinazione" : strumento.id === "freccia" ? "Freccia: origine e destinazione" : undefined}
                  aria-label={strumento.id === "gomma" ? "Gomma" : strumento.id === "perpendicolare" ? "Perpendicolare" : strumento.id === "freccia" ? "Freccia" : undefined}
                  aria-pressed={strumento.id === "gomma" ? strumentoDisegno === "gomma" : strumento.id === "perpendicolare" ? strumentoDisegno === "perpendicolare" : strumento.id === "freccia" ? strumentoDisegno === "freccia" : undefined}
                 onClick={() => {
 if (strumentoDisegno) {
    setProfiliStrumenti((profiliCorrenti) => ({
      ...profiliCorrenti,
      [strumentoDisegno]: {
        colore: coloreDisegno,
        spessore: spessoreDisegno,
      },
    }));
  }

  const profiloNuovo =
  profiliStrumenti[strumento.id] ??
  PROFILI_PREDEFINITI[strumento.id];

setColoreDisegno(profiloNuovo.colore);
setSpessoreDisegno(profiloNuovo.spessore);

 const disattivaFreccia =
  strumento.id === "freccia" && strumentoDisegno === "freccia"

const disattivaPerpendicolare =
  strumento.id === "perpendicolare" && strumentoDisegno === "perpendicolare"

if (strumento.id === "perpendicolare") {
  setWorkspacePerpendicolareRiferimento(
    disattivaPerpendicolare ? null : lineeRiferimentoPerpendicolare.find(
      (entity) => entity.id === cadEntitySelezionataId || cadEntitySelezionateIds.includes(entity.id),
    ) ?? null,
  )
}

if (strumento.id === "freccia" || strumento.id === "perpendicolare" || strumento.id === "gomma" || strumento.id === "testo") {
  setMetroAttivo(false)
  setAreaAttiva(false)
  setAreaSplitAttivo(false)
  setCalibrazioneScalaAttiva(false)
  setSpostaTavolaAttivo(false)
  setTrasformazioneOggettoAttiva(false)
  spostaEntitaRef.current = { attivo: false, start: null }
  trascinamentoPaginaRef.current.attivo = false
  workspaceLineaStartRef.current = null
  setWorkspaceLineaPreview(null)
  workspacePennaPointsRef.current = []
  workspacePennaPreviewRef.current?.setAttribute("points", "")
  workspaceAreaStateRef.current = createInitialAreaState()
  setWorkspaceAreaPoints([])
  setWorkspaceAreaPreview(null)
  puntoInizioMetroWorkspaceRef.current = null
  setWorkspaceMetroPreview(null)
  setQuotaWorkspaceInPosizionamentoId(null)
  setWorkspaceSnapPoint(null)
}

setStrumentoDisegno(disattivaFreccia || disattivaPerpendicolare ? null : strumento.id);
setModalitaSelezione(disattivaFreccia || disattivaPerpendicolare);
selezioneWorkspaceRef.current = {
  attiva: false,
  start: null,
  ctrlKey: false,
}

setRettangoloSelezione(null)
setTrimAttivo(false);

setSfondoSelezionato(false);
setPinSelezionatoId(null);
setOggettoGraficoSelezionatoId(null);
setCadEntitySelezionataId(null);
setCadEntitySelezionateIds([]);

setManoAttiva(false);
setSpostaEntitaAttivo(false)
setPanInCorso(false);
}}
                 style={{
  ...buttonSecondary,
  ...(strumento.id === "freccia" || strumento.id === "perpendicolare"
    ? { width: 32, minWidth: 32, height: 32, padding: 0, fontSize: 18 }
    : {}),
  background:
    strumentoDisegno === strumento.id && !manoAttiva
      ? "#dbeafe"
      : buttonSecondary.background,
  transform:
    strumentoDisegno === strumento.id && !manoAttiva
      ? "scale(1.05)"
      : "scale(1)",
  boxShadow:
    strumentoDisegno === strumento.id && !manoAttiva
      ? "0 0 0 2px #2563eb"
      : "none",
  transition: "all .15s ease",
}}
                >
                  {strumento.id === "gomma" ? <Eraser size={18} aria-hidden="true" /> : strumento.id === "perpendicolare" ? <CornerDownRight size={18} aria-hidden="true" /> : strumento.id === "freccia" ? <ArrowUpRight size={18} aria-hidden="true" /> : strumento.label}
                </button>
              ))}

<button
  type="button"
  onClick={() => {
    setTrimAttivo((valoreCorrente) => {
      const prossimoValore =
        !valoreCorrente

      if (prossimoValore) {
        setStrumentoDisegno(null)
        setModalitaSelezione(false)

        setSfondoSelezionato(false)
        setPinSelezionatoId(null)
        setOggettoGraficoSelezionatoId(null)

        setCadEntitySelezionataId(null)
        setCadEntitySelezionateIds([])

        setManoAttiva(false)
        setPanInCorso(false)

        setAreaAttiva(false)
        setMetroAttivo(false)
        setCalibrazioneScalaAttiva(false)
      }

      return prossimoValore
    })
  }}
  style={{
    ...buttonSecondary,
    background: trimAttivo
      ? "#dbeafe"
      : buttonSecondary.background,
    transform: trimAttivo
      ? "scale(1.05)"
      : "scale(1)",
    boxShadow: trimAttivo
      ? "0 0 0 2px #2563eb"
      : "none",
    transition: "all .15s ease",
  }}
  title="Taglia un segmento tra due intersezioni"
>
  Trim
</button>

<button
  type="button"
  onClick={() => setOrthoAttivo((v) => !v)}
  style={{
    ...buttonSecondary,
    background: orthoAttivo
      ? "#dbeafe"
      : buttonSecondary.background,
    transform: orthoAttivo
      ? "scale(1.05)"
      : "scale(1)",
    boxShadow: orthoAttivo
      ? "0 0 0 2px #2563eb"
      : "none",
    transition: "all .15s ease",
  }}
  title="Modalità ORTHO (linee orizzontali e verticali)"
>
  ⊥ ORTHO
</button>

<button
  type="button"
  onClick={() =>
    setGridSnapAttivo((v) => !v)
  }
  style={{
    ...buttonSecondary,
    background: gridSnapAttivo
      ? "#dbeafe"
      : buttonSecondary.background,
    transform: gridSnapAttivo
      ? "scale(1.05)"
      : "scale(1)",
    boxShadow: gridSnapAttivo
      ? "0 0 0 2px #2563eb"
      : "none",
    transition: "all .15s ease",
  }}
  title="Aggancio alla griglia"
>
  GRID SNAP
</button>

<button
  type="button"
  onClick={() => setSnapAttivo((v) => !v)}
  style={{
    ...buttonSecondary,
    background: snapAttivo ? "#2563eb" : undefined,
    color: snapAttivo ? "#fff" : undefined,
  }}
>
  SNAP
</button>
<button
  type="button"
  onClick={() =>
    setPolarTrackingAttivo((v) => !v)
  }
  style={{
    ...buttonSecondary,
    background: polarTrackingAttivo
      ? "#dbeafe"
      : buttonSecondary.background,
    transform: polarTrackingAttivo
      ? "scale(1.05)"
      : "scale(1)",
    boxShadow: polarTrackingAttivo
      ? "0 0 0 2px #2563eb"
      : "none",
    transition: "all .15s ease",
  }}
  title="Tracciamento polare a 45°"
>
  POLAR 45°
</button>

<button
  type="button"
  onClick={() =>
    setPerpTrackingAttivo((v) => !v)
  }
  style={{
    ...buttonSecondary,
    background: perpTrackingAttivo
      ? "#dbeafe"
      : buttonSecondary.background,
    transform: perpTrackingAttivo
      ? "scale(1.05)"
      : "scale(1)",
    boxShadow: perpTrackingAttivo
      ? "0 0 0 2px #2563eb"
      : "none",
    transition: "all .15s ease",
  }}
  title="Tracciamento perpendicolare dinamico"
>
  ⟂ PERP TRACK
</button>

<button
  type="button"
  onClick={() => {
  const prossimoValore = !calibrazioneScalaAttiva
  setCalibrazioneScalaAttiva(prossimoValore)

  if (!prossimoValore) {
    return
  }

  setStrumentoDisegno(null)
  setModalitaSelezione(false)
  setManoAttiva(false)
  setPanInCorso(false)
  setSpostaEntitaAttivo(false)
  setSpostaTavolaAttivo(false)
  setTrimAttivo(false)
  setMetroAttivo(false)
  setAreaAttiva(false)
  setAreaSplitAttivo(false)
  setTrasformazioneOggettoAttiva(false)

  setSfondoSelezionato(false)
  setPinSelezionatoId(null)
  setOggettoGraficoSelezionatoId(null)
  setCadEntitySelezionataId(null)
  setCadEntitySelezionateIds([])
  setPagineWorkspaceSelezionateIds([])

  // Annulla le interazioni pendenti senza cambiare SNAP.
  selezioneWorkspaceRef.current = {
    attiva: false,
    start: null,
    ctrlKey: false,
  }
  setRettangoloSelezione(null)
  spostaEntitaRef.current = {
    attivo: false,
    start: null,
  }
  trascinamentoPaginaRef.current.attivo = false

  workspaceLineaStartRef.current = null
  setWorkspaceLineaPreview(null)
  workspacePennaPointsRef.current = []
  workspacePennaPreviewRef.current?.setAttribute("points", "")
  workspaceAreaStateRef.current = createInitialAreaState()
  setWorkspaceAreaPoints([])
  setWorkspaceAreaPreview(null)
  puntoInizioMetroWorkspaceRef.current = null
  setWorkspaceMetroPreview(null)
  setQuotaWorkspaceInPosizionamentoId(null)
  setWorkspaceSnapPoint(null)
}}
  style={{
    ...buttonSecondary,
    background: calibrazioneScalaAttiva
      ? "#dbeafe"
      : buttonSecondary.background,
    transform: calibrazioneScalaAttiva
      ? "scale(1.05)"
      : "scale(1)",
    boxShadow: calibrazioneScalaAttiva
      ? "0 0 0 2px #2563eb"
      : "none",
    transition: "all .15s ease",
  }}
  title="Calibra la scala della planimetria"
>
 
  SCALA
</button>

<button
  type="button"
onClick={() => {
  setMetroAttivo((valoreCorrente) => {
    const prossimoValore = !valoreCorrente

    if (prossimoValore) {
      setStrumentoDisegno(null)
      setModalitaSelezione(false)

      setSfondoSelezionato(false)
      setPinSelezionatoId(null)
      setOggettoGraficoSelezionatoId(null)

      setCadEntitySelezionataId(null)
      setCadEntitySelezionateIds([])

      setManoAttiva(false)
      setPanInCorso(false)

      setTrimAttivo(false)
      setAreaAttiva(false)
      setAreaSplitAttivo(false)
      setCalibrazioneScalaAttiva(false)
    }

    return prossimoValore
  })
}}
  style={{
    ...buttonSecondary,
    background: metroAttivo
      ? "#dbeafe"
      : buttonSecondary.background,
    transform: metroAttivo
      ? "scale(1.05)"
      : "scale(1)",
    boxShadow: metroAttivo
      ? "0 0 0 2px #2563eb"
      : "none",
    transition: "all .15s ease",
  }}
  title="Misura distanze reali"
>
  METRO
</button>

<button
  type="button"
  onClick={() => {
    setAreaAttiva((valoreCorrente) => {
      const prossimoValore =
        !valoreCorrente

     if (prossimoValore) {
  setAreaSplitAttivo(false)
  setMetroAttivo(false)
  setCalibrazioneScalaAttiva(false)

  setStrumentoDisegno(null)
  setManoAttiva(false)
  setModalitaSelezione(false)

  setCadEntitySelezionataId(null)
  setCadEntitySelezionateIds([])
}

      return prossimoValore
    })
  }}
  style={{
  ...buttonSecondary,
  width: 32,
  minWidth: 32,
  height: 32,
  padding: 0,
  fontSize: 18,
  background: areaAttiva
    ? "#dbeafe"
    : buttonSecondary.background,
  transform: areaAttiva
    ? "scale(1.05)"
    : "scale(1)",
  boxShadow: areaAttiva
    ? "0 0 0 2px #2563eb"
    : "none",
  transition: "all .15s ease",
}}
 title="Crea area"
>
  ▱
</button>

<button
  type="button"
  onClick={() => {
    setAreaSplitAttivo((valoreCorrente) => {
      const prossimoValore =
        !valoreCorrente

      if (prossimoValore) {
        setAreaAttiva(false)
        setMetroAttivo(false)
        setCalibrazioneScalaAttiva(false)

        setStrumentoDisegno(null)
        setManoAttiva(false)
        setModalitaSelezione(false)

        setCadEntitySelezionataId(null)
        setCadEntitySelezionateIds([])
      }

      return prossimoValore
    })
  }}
  style={{
    ...buttonSecondary,
width: 32,
minWidth: 32,
height: 32,
padding: 0,
fontSize: 17,
    background: areaSplitAttivo
      ? "#dbeafe"
      : buttonSecondary.background,
    transform: areaSplitAttivo
      ? "scale(1.05)"
      : "scale(1)",
    boxShadow: areaSplitAttivo
      ? "0 0 0 2px #2563eb"
      : "none",
    transition: "all .15s ease",
  }}
 title="Dividi area"
>
  ✂
</button>

{areeCadSelezionate.length === 2 && (
  <button
    type="button"
    onClick={() => {
      const merged =
        mergeCadAreaEntities(
          areeCadSelezionate[0],
          areeCadSelezionate[1],
          scaleCalibration,
        )

      if (!merged) {
        return
      }

      setPagineQuaderno((pagineCorrenti) =>
        pagineCorrenti.map(
          (pagina, index) =>
            index === paginaCorrenteIndex
              ? {
                  ...pagina,
                  cadEntities: [
                    ...(pagina.cadEntities ?? []).filter(
                      (entity) =>
                        entity.id !==
                          areeCadSelezionate[0].id &&
                        entity.id !==
                          areeCadSelezionate[1].id,
                    ),
                    merged,
                  ],
                }
              : pagina,
        ),
      )

      setCadEntitySelezionateIds([
        merged.id,
      ])

      setCadEntitySelezionataId(
        merged.id,
      )
    }}
    style={{
      ...buttonSecondary,
      width: 32,
      minWidth: 32,
      height: 32,
      padding: 0,
      fontSize: 17,
    }}
    title="Unisci aree"
  >
    ⇄
  </button>
)}

{scaleCalibration && (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      minHeight: 42,
      padding: "0 10px",
      border: "1px solid #86efac",
      borderRadius: 6,
      background: "#dcfce7",
      color: "#166534",
      fontSize: 13,
      fontWeight: 700,
      whiteSpace: "nowrap",
    }}
    title={`Distanza in pixel: ${scaleCalibration.pixelDistance.toFixed(
      2,
    )}`}
  >
    Scala calibrata:{" "}
    {scaleCalibration.realDistance}{" "}
    {scaleCalibration.unit}
  </div>
)}

              {[


                "#111827",
                "#dc2626",
                "#ea580c",
                "#ca8a04",
                "#16a34a",
                "#0891b2",
                "#2563eb",
                "#7c3aed",
                "#db2777",
                "#ffffff",
              ].map((colore) => (
                <button
                  key={colore}
                  type="button"
                  onClick={() => setColoreDisegno(colore)}
                  style={{
                    ...buttonSecondary,
                    width: 42,
                    height: 42,
                    padding: 0,
                    background: colore,
                    border:
                      coloreDisegno === colore
                        ? "3px solid #0f172a"
                        : "1px solid #cbd5e1",
                    boxShadow:
                      colore === "#ffffff" ? "inset 0 0 0 1px #94a3b8" : "none",
                  }}
                  aria-label={`Colore ${colore}`}
                />
              ))}

{strumentoDisegno === "testo" ? (
  <label
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 13,
      color: "#334155",
    }}
  >
    Font
    <input
      type="number"
      min={8}
      max={96}
      step={1}
      value={dimensioneTesto}
      onChange={(event) =>
        setDimensioneTesto(
          Math.max(
            8,
            Math.min(
              96,
              Number(event.target.value),
            ),
          ),
        )
      }
      style={{
        width: 64,
      }}
    />
    <span>px</span>
  </label>
) : (
  <label
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 13,
      color: "#334155",
    }}
  >
    {strumentoDisegno === "gomma" ? "Diametro" : "Spessore"}
    <input
      type="range"
      aria-label={strumentoDisegno === "gomma" ? "Diametro gomma" : undefined}
      title={strumentoDisegno === "gomma" ? "Diametro gomma (unità Workspace)" : undefined}
      min={1}
      max={strumentoDisegno === "gomma" ? 120 : 24}
      value={spessoreDisegno}
      onChange={(event) =>
        setSpessoreDisegno(
          Number(event.target.value),
        )
      }
    />
    <span>{spessoreDisegno}{strumentoDisegno === "gomma" ? " u" : "px"}</span>
  </label>
)}

              <button
                type="button"
                onClick={annullaModificaQuaderno}
                disabled={quadernoUndoStack.length === 0}
                style={{
                  ...buttonSecondary,
                  opacity: quadernoUndoStack.length === 0 ? 0.45 : 1,
                }}
              >
                ↶ Annulla
              </button>

                           <button
                type="button"
                onClick={ripristinaModificaQuaderno}
                disabled={quadernoRedoStack.length === 0}
                style={{
                  ...buttonSecondary,
                  opacity: quadernoRedoStack.length === 0 ? 0.45 : 1,
                }}
              >
                ↷ Ripristina
              </button>
            </div>
</WorkspacePanel>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 10,
              }}
            >
              <button
                type="button"
                onClick={apriAnteprimaQuaderno}
                style={buttonSecondary}
              >
                👁 Anteprima foglio
              </button>
 <button
              type="button"
              onClick={() => {
 if (!quadernoEspanso) {
  setQuadernoEspansoTop(2);
}

if (!quadernoEspanso) {
  const margine = 16;
  const top = 70;

  setToolbarPosizione({
    x: margine,
    y: top,
  });

  setLayerPanelPosizione({
    x:
      window.innerWidth -
      layerPanelDimensioni.width -
      margine,
    y: top,
  });

  if (!quadernoEspanso) {
  const margine = 16;
  const top = 70;

  setToolbarPosizione({
    x: margine,
    y: top,
  });

  setLayerPanelPosizione({
    x:
      window.innerWidth -
      layerPanelDimensioni.width -
      margine,
    y: top,
  });
}
}

  setQuadernoEspanso((valore) => !valore);
}}
              style={buttonSecondary}
            >
              {quadernoEspanso ? "🗗 Riduci quaderno" : "⛶ Espandi quaderno"}
            </button>
            </div>

            {anteprimaQuaderno && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Anteprima del foglio del Quaderno"
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 20000,
                  background: "rgba(15, 23, 42, 0.85)",
                  display: "flex",
                  flexDirection: "column",
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      color: "#ffffff",
                      fontSize: 18,
                      fontWeight: 800,
                    }}
                  >
                    Anteprima foglio Quaderno
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      onClick={stampaFoglioQuaderno}
                      style={buttonSecondary}
                    >
                      Stampa
                    </button>

<button
  type="button"
  onClick={() => {
    void esportaPdfQuaderno()
  }}
  style={buttonSecondary}
>
  Esporta PDF
</button>

                    <button
                      type="button"
                      onClick={() => {
                        void condividiFoglioQuaderno();
                      }}
                      style={buttonSecondary}
                    >
                      Condividi
                    </button>

                    <button
                      type="button"
                      onClick={chiudiAnteprimaQuaderno}
                      style={buttonSecondary}
                    >
                      Chiudi
                    </button>
                  </div>{" "}
                </div>

                <div
                  style={{
                    flex: 1,
                    overflow: "auto",
                    background: "#e2e8f0",
                    borderRadius: 12,
                    padding: 24,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "flex-start",
                  }}
                >
                 <object
  data={anteprimaQuaderno}
  type="text/html"

  aria-label="Anteprima del foglio del Quaderno"
  style={{
    display: "block",
    width: "100%",
    maxWidth: 1100,
    height: "80vh",
    background: "#ffffff",
    boxShadow: "0 12px 40px rgba(15, 23, 42, 0.35)",
  }}
/>
                </div>
              </div>
            )}


             

<WorkspacePanel
  titolo="Foglio"
  aperto={foglioPanelAperto}
  posizione={foglioPanelPosizione}
  dimensioni={foglioPanelDimensioni}
  onChiudi={() => setFoglioPanelAperto(false)}
  onCambiaPosizione={setFoglioPanelPosizione}
  onCambiaDimensioni={setFoglioPanelDimensioni}
  larghezzaMinima={220}
  altezzaMinima={140}
  zIndex={10040}
>
 <div
  style={{
    display: "grid",
    gridTemplateColumns: `repeat(${colonneToolbar}, minmax(0, 1fr))`,
    alignItems: "stretch",
    gap: gapToolbar,
    overflowX: "hidden",
    overflowY: "auto",
  }}
>
    <label
      style={{
        flex: "1 1 150px",
        display: "flex",
        alignItems: "center",
        gap: 6,
        minWidth: 0,
      }}
    >
      Formato{" "}
      <select
        value={pageLayout.format}
       onChange={(event) =>
  aggiornaPageLayout(
    event.target.value as "A4" | "A3",
    pageLayout.orientation,
  )
}
      >
        <option value="A4">A4</option>
        <option value="A3">A3</option>
      </select>
    </label>

    <label
      style={{
        flex: "1 1 150px",
        display: "flex",
        alignItems: "center",
        gap: 6,
        minWidth: 0,
      }}
    >
      Orientamento{" "}
      <select
        value={pageLayout.orientation}
        onChange={(event) =>
  aggiornaPageLayout(
    pageLayout.format,
    event.target.value as
      | "portrait"
      | "landscape",
  )
}
      >
        <option value="landscape">Orizzontale</option>
        <option value="portrait">Verticale</option>
      </select>
    </label>

<label
  style={{
    flex: "1 1 150px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  }}
>
  Colonne{" "}
 <input
  type="number"
  min={1}
  
  step={1}
  value={colonneWorkspace}
  onChange={(event) => {
    const nuoveColonne =
      Math.max(
        1,
        Number(event.target.value) || 1,
      )

    setColonneWorkspace(
      nuoveColonne,
    )

    setPagineQuaderno(
      (pagineCorrenti) =>
        calcolaPosizioniWorkspace(
          pagineCorrenti,
          nuoveColonne,
        ),
    )

    setQuadernoDirty(true)
  }}
  style={{
    width: 64,
  }}
/>
</label>

  </div>
</WorkspacePanel>

<WorkspacePanel
  titolo="Layer"
  aperto={layerPanelAperto}
  posizione={layerPanelPosizione}
  dimensioni={layerPanelDimensioni}
  onChiudi={() => setLayerPanelAperto(false)}
  onCambiaPosizione={setLayerPanelPosizione}
  onCambiaDimensioni={setLayerPanelDimensioni}
  larghezzaMinima={220}
  altezzaMinima={140}
    zIndex={10030}
  usaPortal
  contentStyle={{
    overflow: "auto",
  }}
>



  
 <div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
    width: "100%",
    height: "100%",
    minHeight: 0,
  }}
>

<button
  type="button"
  onClick={aggiungiLayer}
  style={{
    width: "100%",
    padding: "7px 10px",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    background: "#f8fafc",
    color: "#0f172a",
    fontWeight: 600,
    cursor: "pointer",
  }}
>
  + Nuovo layer
</button>
<div
  style={{
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    paddingRight: 2,
  }}
>

  {layers.map((layer) => (
<div
  key={layer.id}
  onClick={() => setLayerAttivoId(layer.id)}
  style={{
    display: "flex",
    alignItems: "center",
    gap: 4,
    width: "100%",
    minWidth: 0,
    padding: "5px 6px",
    border:
      layerAttivoId === layer.id
        ? "2px solid #2563eb"
        : "1px solid #e5e7eb",
    background:
      layerAttivoId === layer.id
        ? "#dbeafe"
        : "#ffffff",
    cursor: "pointer",
  }}
>

 <span
  title={layer.name}
  style={{
    flex: "1 1 auto",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 12,
  }}
>
  {layer.name}
</span>

  <button
  type="button"
  title={layer.visible ? "Nascondi layer" : "Mostra layer"}
  aria-label={layer.visible ? "Nascondi layer" : "Mostra layer"}
  style={{
    ...buttonSecondary,
    width: 28,
    height: 28,
    minHeight: 28,
    padding: 0,
    fontSize: 15,
    lineHeight: "28px",
    flexShrink: 0,
    background: layer.visible ? "#dbeafe" : "#f1f5f9",
    opacity: layer.visible ? 1 : 0.55,
  }}
  onClick={(event) => {
  event.stopPropagation();

  const nuoviLayers = layers.map((l) =>
    l.id === layer.id
      ? {
          ...l,
          visible: !l.visible,
        }
      : l,
  );

  aggiornaQuaderno({
    layers: nuoviLayers,
  });
}}
>
  👁
</button>

 <button
  type="button"
  title={layer.locked ? "Sblocca layer" : "Blocca layer"}
  aria-label={layer.locked ? "Sblocca layer" : "Blocca layer"}
  style={{
    ...buttonSecondary,
    width: 28,
    height: 28,
    minHeight: 28,
    padding: 0,
    fontSize: 15,
    lineHeight: "28px",
    flexShrink: 0,
    background: layer.locked ? "#fee2e2" : "#f1f5f9",
    opacity: layer.locked ? 1 : 0.65,
  }}
onClick={(event) => {
  event.stopPropagation()

  const nuoviLayers = layers.map((l) =>
    l.id === layer.id
      ? {
          ...l,
          locked: !l.locked,
        }
      : l,
  )

  aggiornaQuaderno({
    layers: nuoviLayers,
  })
}}
>
   🔒
      </button>
<button
  type="button"
  title="Rinomina layer"
  aria-label="Rinomina layer"
  disabled={[
    "background",
    "images",
    "drawing",
    "pins",
  ].includes(layer.id)}
  style={{
    ...buttonSecondary,
    width: 28,
    height: 28,
    minHeight: 28,
    padding: 0,
    fontSize: 11,
    lineHeight: "28px",
    flexShrink: 0,
    background: "#f1f5f9",
    opacity: [
      "background",
      "images",
      "drawing",
      "pins",
    ].includes(layer.id)
      ? 0.35
      : 1,
    cursor: [
      "background",
      "images",
      "drawing",
      "pins",
    ].includes(layer.id)
      ? "not-allowed"
      : "pointer",
  }}
  onClick={(event) => {
    event.stopPropagation()

    const layerDiSistema = [
      "background",
      "images",
      "drawing",
      "pins",
    ].includes(layer.id)

    if (layerDiSistema) {
      return
    }

    const nuovoNome = window.prompt(
      "Inserisci il nuovo nome del layer:",
      layer.name,
    )

    if (nuovoNome === null) {
      return
    }

    const nomePulito = nuovoNome.trim()

    if (
      !nomePulito ||
      nomePulito === layer.name
    ) {
      return
    }

    const nuoviLayers = layers.map((l) =>
      l.id === layer.id
        ? {
            ...l,
            name: nomePulito,
          }
        : l,
    )

    aggiornaQuaderno({
      layers: nuoviLayers,
    })
  }}
>
  Aa
</button>

<button
  type="button"
  title="Elimina layer"
  aria-label="Elimina layer"
  disabled={[
    "background",
    "images",
    "drawing",
    "pins",
  ].includes(layer.id)}
  style={{
    ...buttonSecondary,
    width: 28,
    height: 28,
    minHeight: 28,
    padding: 0,
    fontSize: 15,
    lineHeight: "28px",
    flexShrink: 0,
    background: "#fee2e2",
    opacity: [
      "background",
      "images",
      "drawing",
      "pins",
    ].includes(layer.id)
      ? 0.35
      : 1,
    cursor: [
      "background",
      "images",
      "drawing",
      "pins",
    ].includes(layer.id)
      ? "not-allowed"
      : "pointer",
  }}
  onClick={(event) => {
    event.stopPropagation()

    const layerDiSistema = [
      "background",
      "images",
      "drawing",
      "pins",
    ].includes(layer.id)

    if (layerDiSistema) {
      return
    }

    const disegniNelLayer = disegni.filter(
      (segno) => segno.layerId === layer.id,
    )

    const oggettiNelLayer = oggettiGrafici.filter(
      (oggetto) => oggetto.layerId === layer.id,
    )

    const contieneElementi =
      disegniNelLayer.length > 0 ||
      oggettiNelLayer.length > 0

    if (contieneElementi) {
      const confermato = window.confirm(
        `Il layer "${layer.name}" contiene ${
          disegniNelLayer.length +
          oggettiNelLayer.length
        } elementi.\n\nEliminare il layer e tutti i suoi contenuti?`,
      )

      if (!confermato) {
        return
      }
    }

    const nuoviLayers = layers.filter(
      (l) => l.id !== layer.id,
    )

    const nuoviDisegni = disegni.filter(
      (segno) => segno.layerId !== layer.id,
    )

    const nuoviOggettiGrafici =
      oggettiGrafici.filter(
        (oggetto) =>
          oggetto.layerId !== layer.id,
      )

    aggiornaQuaderno({
      layers: nuoviLayers,
      disegni: nuoviDisegni,
      oggettiGrafici: nuoviOggettiGrafici,
    })

    if (layerAttivoId === layer.id) {
      setLayerAttivoId("drawing")
    }

    setOggettoGraficoSelezionatoId(null)
    setPinSelezionatoId(null)
  }}
>
  ×
</button>

    </div>
  ))}
</div>
</div>
</WorkspacePanel>
<WorkspacePanel
  titolo="Proprietà"  
aperto={proprietaPanelAperto}
  posizione={proprietaPosizione}
  dimensioni={proprietaDimensioni}
  onChiudi={() => setProprietaPanelAperto(false)}
  onCambiaPosizione={setProprietaPosizione}
  onCambiaDimensioni={setProprietaDimensioni}
  larghezzaMinima={280}
  altezzaMinima={100}
  zIndex={10040}
usaPortal
>

{oggettoGraficoSelezionatoId && (
  <div
    style={{
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      marginBottom: 10,
    }}
  >
    <button
      type="button"
      onClick={portaImmagineAvanti}
      style={buttonSecondary}
    >
      Porta avanti
    </button>

    <button
      type="button"
      onClick={portaImmagineIndietro}
      style={buttonSecondary}
    >
      Porta indietro
    </button>
  </div>
)}
  <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 6,
    rowGap: 6,
    columnGap: 6,
    flexWrap: "wrap",
    minHeight: 36,
    padding: "6px 10px",
    fontSize: 13,
    color: "#111827",
  }}
>
               <strong>PROPRIETÀ</strong>

<div
  style={{
    flexBasis: "100%",
    height: 1,
  }}
/>

{entitaCadSelezionate.length > 0 && (
  <>
    <span>
      Selezionati: {entitaCadSelezionate.length}
    </span>

    <span>|</span>

    <span>
      Layer:{" "}
      {layerIdsSelezione.length > 1
        ? "Multipli"
        : layerSelezione?.name ??
          layerSelezioneId ??
          "---"}
    </span>
  </>
)}

{quotaWorkspaceSelezionata && (
  <>
    <span>|</span>

    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      Lunghezza:

      <input
        type="number"
        min="0"
        step="0.01"
        value={
          typeof quotaWorkspaceSelezionata.measuredValue ===
          "number"
            ? quotaWorkspaceSelezionata.measuredValue
            : ""
        }
        onChange={(event) => {
          const nuovaLunghezza =
            Number(event.target.value)

          if (
            !Number.isFinite(nuovaLunghezza) ||
            nuovaLunghezza <= 0 ||
            !scaleCalibration
          ) {
            return
          }

          const dx =
            quotaWorkspaceSelezionata.end.x -
            quotaWorkspaceSelezionata.start.x

          const dy =
            quotaWorkspaceSelezionata.end.y -
            quotaWorkspaceSelezionata.start.y

          const lunghezzaPixelCorrente =
            Math.hypot(dx, dy)

          if (lunghezzaPixelCorrente === 0) {
            return
          }

          const nuovaLunghezzaPixel =
            nuovaLunghezza *
            (scaleCalibration.pixelDistance /
              scaleCalibration.realDistance)

          const direzioneX =
            dx / lunghezzaPixelCorrente

          const direzioneY =
            dy / lunghezzaPixelCorrente

          const nuovoEnd = {
            x:
              quotaWorkspaceSelezionata.start.x +
              direzioneX * nuovaLunghezzaPixel,

            y:
              quotaWorkspaceSelezionata.start.y +
              direzioneY * nuovaLunghezzaPixel,
          }

          setWorkspaceCadEntities(
            (entitiesCorrenti) =>
              entitiesCorrenti.map((entity) =>
                entity.id ===
                quotaWorkspaceSelezionata.id
                  ? {
                      ...entity,
                      end: nuovoEnd,
                      measuredValue:
                        nuovaLunghezza,
                      metadata: {
                        ...entity.metadata,
                        title: `${nuovaLunghezza.toFixed(
                          2,
                        )} ${
                          quotaWorkspaceSelezionata.unit ??
                          "m"
                        }`,
                      },
                      updatedAt:
                        new Date().toISOString(),
                    }
                  : entity,
              ),
          )

          setQuadernoDirty(true)
        }}
        style={{
          width: 80,
        }}
      />

      <span>
        {quotaWorkspaceSelezionata.unit ?? "m"}
      </span>
    </label>
  </>
)}

{entitaCadSelezionate.length > 0 && (
  <>
    <span>|</span>

    <select
      value=""
      onChange={(event) => {
        const nuovoLayerId =
          event.target.value as QuadernoLayerId

        if (!nuovoLayerId) {
          return
        }

        registraSnapshotQuaderno()

        const idsSelezionati =
          new Set(cadEntitySelezionateIds)

        const nuoveEntitaCad =
          entitaCadPaginaCorrente.map((entity) =>
            idsSelezionati.has(entity.id)
              ? {
                  ...entity,
                  layerId: nuovoLayerId,
                  updatedAt: new Date().toISOString(),
                }
              : entity,
          )

setWorkspaceCadEntities(
  (entitiesCorrenti) =>
    entitiesCorrenti.map((entity) =>
      idsSelezionati.has(entity.id)
        ? {
            ...entity,
            layerId: nuovoLayerId,
          }
        : entity,
    ),
)

        const paginaAggiornata =
          applyCadEntitiesToPage(
            {
              ...paginaQuadernoCorrente!,
              layers,
            },
            nuoveEntitaCad,
          )

        setPagineQuaderno((pagineCorrenti) =>
          pagineCorrenti.map((pagina, index) =>
            index === paginaCorrenteIndex
              ? paginaAggiornata
              : pagina,
          ),
        )

        setDisegni(
          paginaAggiornata.disegni ?? [],
        )

        setOggettiGrafici(
          paginaAggiornata.oggettiGrafici ?? [],
        )

        setQuadernoDirty(true)
      }}
      style={{
        minHeight: 28,
        padding: "4px 6px",
        fontSize: 12,
      }}
    >
      <option value="" disabled>
        Sposta nel layer...
      </option>

      {layers.map((layer) => (
        <option
          key={layer.id}
          value={layer.id}
        >
          {layer.name}
        </option>
      ))}
    </select>
  </>
)}

{entitaCadSelezionate.length > 0 && (
  <>
    <span>|</span>

    <button
      type="button"
   onClick={() => {
  if (oggettoGraficoSelezionatoId) {
    portaImmagineAvanti()
    return
  }

  const gestitoWorkspace =
    portaWorkspaceCadSelezionatiAvanti()

  if (gestitoWorkspace) {
    return
  }

  portaSegniSelezionatiAvanti()
}}

      style={{
        ...buttonSecondary,
        padding: "4px 8px",
        minHeight: 28,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      Porta avanti
    </button>

    <button
      type="button"
     onClick={() => {
  if (oggettoGraficoSelezionatoId) {
    portaImmagineIndietro()
    return
  }

  const gestitoWorkspace =
    portaWorkspaceCadSelezionatiIndietro()

  if (gestitoWorkspace) {
    return
  }

  portaSegniSelezionatiIndietro()
}}

      style={{
        ...buttonSecondary,
        padding: "4px 8px",
        minHeight: 28,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      Porta indietro
    </button>

    <button
      type="button"
      onClick={() => {
  const gestitoWorkspace =
    portaWorkspaceCadSelezionatiInPrimoPiano()

  if (gestitoWorkspace) {
    return
  }

  portaSegniSelezionatiInPrimoPiano()
}}
      style={{
        ...buttonSecondary,
        padding: "4px 8px",
        minHeight: 28,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      Primo piano
    </button>

    <button
      type="button"
      onClick={() => {
  const gestitoWorkspace =
    portaWorkspaceCadSelezionatiInFondo()

  if (gestitoWorkspace) {
    return
  }

  portaSegniSelezionatiInFondo()
}}
      style={{
        ...buttonSecondary,
        padding: "4px 8px",
        minHeight: 28,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      In fondo
    </button>
  </>
)}

{areaCadSelezionata && (
  <>
    <span>|</span>
    <span>Area</span>
    <span>|</span>

    <span>
      A=
      {areaCadSelezionata.areaSquareMeters.toFixed(2)} m²
    </span>

    <span>|</span>

    <span>
      P=
      {areaCadSelezionata.perimeterMeters.toFixed(2)} m
    </span>
<span>|</span>

<button
  type="button"
  onClick={esplodiAreaSelezionata}
  style={{
    ...buttonSecondary,
    padding: "4px 8px",
    minHeight: 28,
    fontSize: 12,
    whiteSpace: "nowrap",
  }}
  title="Esplodi l'area in segmenti modificabili singolarmente"
>
  Esplodi
</button>
  </>
)}


                {lineaCadSelezionata && (
                  <>
                    <span>|</span>
                    <span>Linea</span>
                    <span>|</span>
                    <span>
  L=
  {lunghezzaLineaSelezionata
    ? `${lunghezzaLineaSelezionata.toFixed(2)} m`
    : "---"}
</span>
                    <span>→</span>

                    <input
                      type="number"
                      step="0.01"
                      placeholder="m"
                      value={nuovaLunghezzaLinea}
                      onChange={(event) =>
                        setNuovaLunghezzaLinea(event.target.value)
                      }
onKeyDown={(event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applicaNuovaLunghezzaLinea();
  }
}}
                      style={{
                        width: 72,
                        height: 24,
                        padding: "2px 6px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 5,
                        textAlign: "center",
                        fontSize: 13,
                      }}
                    />

                    <span>m</span>
                  </>
                )}

{testoWorkspaceProprieta && (
  <>
    <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      Tipo di carattere
      <select
        value={testoWorkspaceProprieta.fontFamily ?? ""}
        disabled={!testoWorkspaceModificabile}
        onChange={event => aggiornaProprietaTestoWorkspace({ fontFamily: event.target.value })}
        style={{ height: 26, maxWidth: 180, border: "1px solid #cbd5e1", borderRadius: 5 }}
      >
        <option value="" disabled>Predefinito</option>
        {testoWorkspaceProprieta.fontFamily && !fontTestoWorkspace.includes(testoWorkspaceProprieta.fontFamily) && (
          <option value={testoWorkspaceProprieta.fontFamily}>{testoWorkspaceProprieta.fontFamily}</option>
        )}
        {fontTestoWorkspace.map(font => <option key={font} value={font}>{font}</option>)}
      </select>
    </label>
    <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      Grandezza
      <input
        type="number"
        min={0.1}
        step="any"
        value={testoWorkspaceProprieta.fontSize}
        disabled={!testoWorkspaceModificabile}
        onChange={event => aggiornaProprietaTestoWorkspace({ fontSize: event.target.valueAsNumber })}
        style={{ width: 72, height: 26, border: "1px solid #cbd5e1", borderRadius: 5 }}
      />
    </label>
  </>
)}

{testoCadSelezionato && (

<TextPropertiesToolbar
  testo={
    testoCadSelezionato.metadati?.testo ??
    ""
  }

  dimensione={nuovaDimensioneTesto}
  onCambiaDimensione={setNuovaDimensioneTesto}
  onApplicaDimensione={applicaNuovaDimensioneTesto}

  font={nuovoFontTesto}
  onCambiaFont={(nuovoFont) => {
    setNuovoFontTesto(nuovoFont)

    const disegniAggiornati =
      disegni.map((segno) => {
        if (
          segno.id !==
          testoCadSelezionato.id
        ) {
          return segno
        }

        return {
          ...segno,
          metadati: {
            ...segno.metadati,
            fontFamily: nuovoFont,
          },
        }
      })

    aggiornaQuaderno({
      disegni: disegniAggiornati,
    })
  }}

  grassetto={testoGrassetto}
  onToggleGrassetto={() => {
    const prossimoGrassetto =
      !testoGrassetto

    const nuovoFontWeight:
      "bold" | "normal" =
      prossimoGrassetto
        ? "bold"
        : "normal"

    setTestoGrassetto(
      prossimoGrassetto,
    )

    const disegniAggiornati =
      disegni.map((segno) => {
        if (
          segno.id !==
          testoCadSelezionato.id
        ) {
          return segno
        }

        return {
          ...segno,
          metadati: {
            ...segno.metadati,
            fontWeight:
              nuovoFontWeight,
          },
        }
      })

    aggiornaQuaderno({
      disegni: disegniAggiornati,
    })
  }}

  corsivo={testoCorsivo}
  onToggleCorsivo={() => {
    const prossimoCorsivo =
      !testoCorsivo

    const nuovoFontStyle:
      "normal" | "italic" =
      prossimoCorsivo
        ? "italic"
        : "normal"

    setTestoCorsivo(
      prossimoCorsivo,
    )

    const disegniAggiornati =
      disegni.map((segno) => {
        if (
          segno.id !==
          testoCadSelezionato.id
        ) {
          return segno
        }

        return {
          ...segno,
          metadati: {
            ...segno.metadati,
            fontStyle:
              nuovoFontStyle,
          },
        }
      })

    aggiornaQuaderno({
      disegni: disegniAggiornati,
    })
  }}

buttonStyle={buttonSecondary}
/>
)}
   </div>
</WorkspacePanel>

<div
ref={viewportRef}
 onPointerDown={(event) => {
  // -----------------------------
  // GESTIONE DUE DITA (iPad)
  // -----------------------------
  if (event.pointerType === "touch") {
    event.preventDefault();

    touchPointersRef.current.set(
      event.pointerId,
      {
        x: event.clientX,
        y: event.clientY,
      },
    );

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );

    const punti = Array.from(
      touchPointersRef.current.values(),
    );

    if (punti.length === 2) {
      const [p1, p2] = punti;

      const distanza = Math.hypot(
        p2.x - p1.x,
        p2.y - p1.y,
      );

      const rect =
        event.currentTarget.getBoundingClientRect();

      pinchRef.current = {
        attivo: true,
        distanzaIniziale: distanza,
        scalaIniziale: viewportScale,
        centroIniziale: {
          x:
            (p1.x + p2.x) / 2 -
            rect.left,
          y:
            (p1.y + p2.y) / 2 -
            rect.top,
        },
        offsetIniziale: {
          ...viewportOffset,
        },
      };
    }

    return;
  }

  // -----------------------------
  // PAN CON MANO
  // -----------------------------
  if (!manoAttiva) {
    return;
  }

  event.preventDefault();

  panStartRef.current = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    offsetX: viewportOffset.x,
    offsetY: viewportOffset.y,
  };

  setPanInCorso(true);

  event.currentTarget.setPointerCapture(
    event.pointerId,
  );
}}

  onPointerMove={(event) => {
  if (event.pointerType === "touch") {
    if (
      !touchPointersRef.current.has(
        event.pointerId,
      )
    ) {
      return;
    }

    event.preventDefault();

    touchPointersRef.current.set(
      event.pointerId,
      {
        x: event.clientX,
        y: event.clientY,
      },
    );

    const punti = Array.from(
      touchPointersRef.current.values(),
    );

    if (
      punti.length !== 2 ||
      !pinchRef.current.attivo
    ) {
      return;
    }

    const [p1, p2] = punti;

    const distanzaCorrente = Math.hypot(
      p2.x - p1.x,
      p2.y - p1.y,
    );

    if (
      pinchRef.current.distanzaIniziale <= 0
    ) {
      return;
    }

    const nuovaScala =
      clampViewportScale(
        pinchRef.current.scalaIniziale *
          (
            distanzaCorrente /
            pinchRef.current
              .distanzaIniziale
          ),
      );

    const rect =
      event.currentTarget.getBoundingClientRect();

    const centroCorrente = {
      x:
        (p1.x + p2.x) / 2 -
        rect.left,
      y:
        (p1.y + p2.y) / 2 -
        rect.top,
    };

    const rapporto =
      nuovaScala /
      pinchRef.current.scalaIniziale;

    setViewportScale(nuovaScala);

    setViewportOffset({
      x:
        centroCorrente.x -
        (
          pinchRef.current
            .centroIniziale.x -
          pinchRef.current
            .offsetIniziale.x
        ) *
          rapporto,

      y:
        centroCorrente.y -
        (
          pinchRef.current
            .centroIniziale.y -
          pinchRef.current
            .offsetIniziale.y
        ) *
          rapporto,
    });

    return;
  }

  if (!manoAttiva || !panInCorso) {
    return;
  }

  const deltaX =
    event.clientX -
    panStartRef.current.pointerX;

  const deltaY =
    event.clientY -
    panStartRef.current.pointerY;

  setViewportOffset({
    x:
      panStartRef.current.offsetX +
      deltaX,
    y:
      panStartRef.current.offsetY +
      deltaY,
  });
}}

  onPointerUp={(event) => {
  if (event.pointerType === "touch") {
    touchPointersRef.current.delete(
      event.pointerId,
    );

    if (
      touchPointersRef.current.size < 2
    ) {
      pinchRef.current.attivo = false;
    }

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }

    return;
  }

  if (!panInCorso) {
    return;
  }

  setPanInCorso(false);

  if (
    event.currentTarget.hasPointerCapture(
      event.pointerId,
    )
  ) {
    event.currentTarget.releasePointerCapture(
      event.pointerId,
    );
  }
}}
  onPointerCancel={(event) => {
  if (event.pointerType === "touch") {
    touchPointersRef.current.delete(
      event.pointerId,
    );

    if (
      touchPointersRef.current.size < 2
    ) {
      pinchRef.current.attivo = false;
    }

    return;
  }

  setPanInCorso(false);
}}
 style={{
  marginTop: 10,
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  background: "#cbd5e1",
  border: "1px solid #94a3b8",
  borderRadius: 12,
  padding: 32,
  overflow: "auto",
  display: "flex",
justifyContent: "flex-start",
alignItems: "flex-start",

  height: quadernoEspanso
    ? `calc(100vh - ${quadernoEspansoTop + 115}px)`
    : "calc(100vh - 250px)",

  minHeight: 700,
  position: "relative",

  cursor: manoAttiva
    ? panInCorso
      ? "grabbing"
      : "grab"
    : "default",

  touchAction:
  manoAttiva ||
  strumentoDisegno !== null ||
  areaAttiva ||
  metroAttivo ||
  calibrazioneScalaAttiva
    ? "none"
    : "auto",

}}
>
<div
  ref={viewportContentRef}
  onPointerDown={(event) => {
 if (
  (!spostaTavolaAttivo && !marqueeCadAttivo) ||
  !modalitaSelezione ||
  (
    strumentoDisegno === "penna" ||
    strumentoDisegno === "evidenziatore"
  ) ||
  manoAttiva ||
  event.target !== event.currentTarget
) {
  return
}

    const svg = workspaceSvgRef.current

    if (!svg) {
      return
    }

    const rect =
      svg.getBoundingClientRect()

    const puntoWorkspace: CadPoint = {
      x:
        ((event.clientX - rect.left) /
          rect.width) *
        dimensioniWorkspace.width,

      y:
        ((event.clientY - rect.top) /
          rect.height) *
        dimensioniWorkspace.height,
    }

    spostaEntitaRef.current = {
      attivo: false,
      start: null,
    }

    selezioneWorkspaceRef.current = {
      attiva: true,
      start: puntoWorkspace,
      ctrlKey:
        event.ctrlKey || event.metaKey,
    }

    setRettangoloSelezione({
      startX: puntoWorkspace.x,
      startY: puntoWorkspace.y,
      endX: puntoWorkspace.x,
      endY: puntoWorkspace.y,
    })

    if (
      !event.ctrlKey &&
      !event.metaKey
    ) {
      setCadEntitySelezionataId(null)
      setCadEntitySelezionateIds([])
    }

    setOggettoGraficoSelezionatoId(null)
    setPinSelezionatoId(null)
    setSfondoSelezionato(false)

    svg.setPointerCapture(
      event.pointerId,
    )
  }}
  style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    flexShrink: 0,
    position: "relative",
  }}
>
 <div
  ref={viewportTransformRef}
  style={{
    transform: `translate(${viewportOffset.x}px, ${viewportOffset.y}px) scale(${viewportScale})`,
    transformOrigin: "top left",
    willChange: "transform",
    pointerEvents: manoAttiva ? "none" : "auto",
  }}
>

<div
  style={{
    position: "relative",
    width: dimensioniWorkspace.width,
    height: dimensioniWorkspace.height,
    flexShrink: 0,
  }}
>

<svg
ref={workspaceSvgRef}
onPointerEnter={(event) => {
  if (strumentoDisegno === "gomma" && !manoAttiva && !spostaTavolaAttivo) {
    setWorkspaceGommaCursor(puntoGommaWorkspace(event))
  }
}}
onPointerLeave={() => setWorkspaceGommaCursor(null)}
onClick={(event) => {
  if (strumentoDisegno === "testo") event.stopPropagation()
}}
onPointerDownCapture={(event) => {
  if (strumentoDisegno === "testo" && !manoAttiva && !spostaTavolaAttivo) {
    if (workspaceTestoEditorRef.current?.contains(event.target as Node)) return
    event.preventDefault()
    event.stopPropagation()
    if (event.button !== 0 || !event.isPrimary) return
    if (workspaceTestoDraft) {
      workspaceTestoInputRef.current?.focus()
      return
    }
    const layer = layers.find((item) => item.id === layerAttivoId)
    if (!layer || layer.locked || layer.visible === false || layer.selectable === false) return
    const rect = event.currentTarget.getBoundingClientRect()
    setWorkspaceTestoDraft({
      position: {
        x: ((event.clientX - rect.left) / rect.width) * dimensioniWorkspace.width,
        y: ((event.clientY - rect.top) / rect.height) * dimensioniWorkspace.height,
      },
      content: "",
    })
    return
  }
  if (strumentoDisegno !== "gomma" || manoAttiva || spostaTavolaAttivo) return
  if (event.button !== 0 || workspaceGommaRef.current) return
  event.preventDefault()
  event.stopPropagation()
  const point = puntoGommaWorkspace(event)
  setWorkspaceGommaCursor(point)
  const snapshot = creaSnapshotQuaderno()
  snapshot.workspaceEraserEntities = structuredClone(workspaceCadEntities)
  workspaceGommaRef.current = {
    pointerId: event.pointerId,
    previous: point,
    radius: diametroGomma / 2,
    entities: workspaceCadEntities,
    snapshot,
    changed: false,
  }
  event.currentTarget.setPointerCapture(event.pointerId)
  applicaGommaWorkspace(point)
}}
onLostPointerCapture={(event) => terminaGommaWorkspace(event)}
  width={dimensioniWorkspace.width}
  height={dimensioniWorkspace.height}
  viewBox={`0 0 ${dimensioniWorkspace.width}
 ${dimensioniWorkspace.height}`}

onPointerDown={(event) => {
if (
  modalitaSelezione &&
  strumentoDisegno !== "penna" &&
  strumentoDisegno !== "evidenziatore" &&
  event.target === event.currentTarget &&
  !manoAttiva
) {
  const svg = event.currentTarget
  const rect =
    svg.getBoundingClientRect()

  const puntoWorkspace: CadPoint = {
    x:
      ((event.clientX - rect.left) /
        rect.width) *
      dimensioniWorkspace.width,

    y:
      ((event.clientY - rect.top) /
        rect.height) *
      dimensioniWorkspace.height,
  }

  spostaEntitaRef.current = {
    attivo: false,
    start: null,
  }

  selezioneWorkspaceRef.current = {
    attiva: true,
    start: puntoWorkspace,
    ctrlKey:
      event.ctrlKey || event.metaKey,
  }

  setRettangoloSelezione({
    startX: puntoWorkspace.x,
    startY: puntoWorkspace.y,
    endX: puntoWorkspace.x,
    endY: puntoWorkspace.y,
  })

  if (
    !event.ctrlKey &&
    !event.metaKey
  ) {
    setCadEntitySelezionataId(null)
    setCadEntitySelezionateIds([])
  }

  setOggettoGraficoSelezionatoId(null)
  setPinSelezionatoId(null)
  setSfondoSelezionato(false)

  event.currentTarget.setPointerCapture(
    event.pointerId,
  )
  return
}
if (trimAttivo) {
  const svg = event.currentTarget
  const rect =
    svg.getBoundingClientRect()

  const puntoWorkspace: CadPoint = {
    x:
      ((event.clientX - rect.left) /
        rect.width) *
      dimensioniWorkspace.width,
 y:
      ((event.clientY - rect.top) /
        rect.height) *
      dimensioniWorkspace.height,
  }

  const tolerance =
    getSnapTolerance(
      dimensioniWorkspace.width,
      rect.width,
    )

  const lineeCad =
    workspaceCadEntities.filter(
      (
        entity,
      ): entity is CadLineEntity =>
        entity.type === "line",
    )

 const lineaTarget =
    lineeCad.find(
      (entity) =>
        lineBehavior.hitTest?.(
          entity,
          puntoWorkspace,
          tolerance,
        ) === true,
    )

  if (!lineaTarget) {
    return
  }

  const dx =
    lineaTarget.end.x -
    lineaTarget.start.x

  const dy =
    lineaTarget.end.y -
    lineaTarget.start.y

  const lengthSquared =
    dx * dx + dy * dy

  if (lengthSquared <= 0) {
    return
  }

  const epsilon = 0.000001

  const calcolaParametroLinea = (
    point: CadPoint,
  ) =>
    (
      (point.x - lineaTarget.start.x) *
        dx +
      (point.y - lineaTarget.start.y) *
        dy
    ) / lengthSquared

  const intersectionTs =
    lineeCad
      .filter(
        (entity) =>
          entity.id !== lineaTarget.id,
      )
      .map((entity) =>
        getSegmentIntersection(
          lineaTarget.start,
          lineaTarget.end,
          entity.start,
          entity.end,
        ),
      )
      .filter(
        (point): point is CadPoint =>
          point !== null,
      )
      .map(calcolaParametroLinea)
      .filter(
        (t) =>
          t >= -epsilon &&
          t <= 1 + epsilon,
      )
      .map((t) =>
        Math.max(
          0,
          Math.min(1, t),
        ),
      )
      .sort((a, b) => a - b)

  const uniqueIntersectionTs =
    intersectionTs.filter(
      (t, index, values) =>
        index === 0 ||
        Math.abs(
          t - values[index - 1],
        ) > epsilon,
    )

  if (
    uniqueIntersectionTs.length === 0
  ) {
    return
  }

  const limiti = [
    0,
    ...uniqueIntersectionTs,
    1,
  ]

  const clickT =
    Math.max(
      0,
      Math.min(
        1,
        calcolaParametroLinea(
          puntoWorkspace,
        ),
      ),
    )


  const indexTrattoDaEliminare =
    limiti.findIndex(
      (limite, index) =>
        index <
          limiti.length - 1 &&
        clickT >=
          limite - epsilon &&
        clickT <=
          limiti[index + 1] +
            epsilon,
    )

  if (
    indexTrattoDaEliminare < 0
  ) {
    return
  }

  const replacements =
    limiti
      .slice(0, -1)
      .map(
        (inizio, index) => ({
          inizio,
          fine:
            limiti[index + 1],
        }),
      )
      .filter(
        (_, index) =>
          index !==
          indexTrattoDaEliminare,
      )
      .filter(
        ({ inizio, fine }) =>
          fine - inizio >
          epsilon,
      )
      .map(
        (
          { inizio, fine },
          index,
        ) =>
          createCadLine({
            id:
              index === 0
                ? lineaTarget.id
                : crypto.randomUUID(),

            start: {
              x:
                lineaTarget.start.x +
                dx * inizio,
              y:
                lineaTarget.start.y +
                dy * inizio,
            },

            end: {
              x:
                lineaTarget.start.x +
                dx * fine,
              y:
                lineaTarget.start.y +
                dy * fine,
            },

            stroke:
              lineaTarget.stroke,

            layerId:
              lineaTarget.layerId,

            metadata:
              lineaTarget.metadata,

            visible:
              lineaTarget.visible,

            locked:
              lineaTarget.locked,

            selectable:
              lineaTarget.selectable,
          }),
      )

  setWorkspaceCadEntities(
    (entitiesCorrenti) => [
      ...entitiesCorrenti.filter(
        (entity) =>
          entity.id !==
          lineaTarget.id,
      ),
      ...replacements,
    ],
  )

  setCadEntitySelezionataId(null)

  setCadEntitySelezionateIds(
    (idsCorrenti) =>
      idsCorrenti.filter(
        (id) =>
          id !==
          lineaTarget.id,
      ),
  )

  setQuadernoDirty(true)

  return
}
if (metroAttivo) {
  if (quotaWorkspaceInPosizionamentoId) {
    event.preventDefault()
    event.stopPropagation()

    setQuotaWorkspaceInPosizionamentoId(null)
    setQuadernoDirty(true)

    return
  }

  const svg = event.currentTarget

const rect =
  svg.getBoundingClientRect()

  const puntoWorkspace: CadPoint = {
    x:
      ((event.clientX - rect.left) /
        rect.width) *
      dimensioniWorkspace.width,

    y:
      ((event.clientY - rect.top) /
        rect.height) *
      dimensioniWorkspace.height,
  }

  const tolerance =
    getSnapTolerance(
      dimensioniWorkspace.width,
      rect.width,
    )

  const snapGlobale =
    snapAttivo
      ? resolveSnapPoint({
          entities: workspaceSnapEntities,
          cursor: puntoWorkspace,
          tolerance,
        })
      : null

  setWorkspaceSnapPoint(
    snapGlobale
      ? {
          x: snapGlobale.x,
          y: snapGlobale.y,
          type: snapGlobale.type,
        }
      : null,
  )

  const puntoMetro =
    snapGlobale
      ? {
          x: snapGlobale.x,
          y: snapGlobale.y,
        }
      : puntoWorkspace

if (!puntoInizioMetroWorkspaceRef.current) {

  setQuotaWorkspaceInPosizionamentoId(null)

  puntoInizioMetroWorkspaceRef.current =
    puntoMetro

  return
}

  if (!scaleCalibration) {
    window.alert(
      "Prima calibra la scala della planimetria.",
    )

    puntoInizioMetroWorkspaceRef.current = null

    return
  }

  const dx =
    puntoMetro.x -
    puntoInizioMetroWorkspaceRef.current.x

  const dy =
    puntoMetro.y -
    puntoInizioMetroWorkspaceRef.current.y

  const distanzaPixel =
    Math.sqrt(dx * dx + dy * dy)

  const metri =
    distanzaPixel *
    (scaleCalibration.realDistance /
      scaleCalibration.pixelDistance)

 const nuovaQuotaWorkspace =
  createCadDimension({
    start:
      puntoInizioMetroWorkspaceRef.current,
    end: puntoMetro,
    offset: 0,
    layerId: layerAttivoId,
    stroke: {
      color: "#2563eb",
      width: 2,
      dashArray: [6, 4],
    },
    metadata: {
      title: `${metri.toFixed(2)} ${scaleCalibration.unit}`,
    },
  })

nuovaQuotaWorkspace.measuredValue = metri
nuovaQuotaWorkspace.unit =
  scaleCalibration.unit

setWorkspaceCadEntities((entitaCorrenti) => [
  ...entitaCorrenti,
  nuovaQuotaWorkspace,
])

setCadEntitySelezionataId(
  nuovaQuotaWorkspace.id,
)

setCadEntitySelezionateIds([
  nuovaQuotaWorkspace.id,
])

setWorkspaceMetroPreview(null)

puntoInizioMetroWorkspaceRef.current = null

setQuadernoDirty(true)

return
}
if (
  (
    strumentoDisegno !== "linea" &&
    strumentoDisegno !== "freccia" &&
    strumentoDisegno !== "perpendicolare" &&
    strumentoDisegno !== "rettangolo" &&
    strumentoDisegno !== "penna" &&
strumentoDisegno !== "evidenziatore" &&
    !areaAttiva &&
    !metroAttivo
  ) ||
  manoAttiva ||
  spostaTavolaAttivo
) {
  return
}

  const svg = event.currentTarget
  const rect =
    svg.getBoundingClientRect()

  const puntoWorkspace: CadPoint = {
    x:
      ((event.clientX - rect.left) /
        rect.width) *
      dimensioniWorkspace.width,

    y:
      ((event.clientY - rect.top) /
        rect.height) *
      dimensioniWorkspace.height,
  }

const tolerance =
  getSnapTolerance(
    dimensioniWorkspace.width,
    rect.width,
  )

const snapGlobale =
  snapAttivo
    ? resolveSnapPoint({
        entities: workspaceSnapEntities,
        cursor: puntoWorkspace,
        tolerance,
      })
    : null

setWorkspaceSnapPoint(
  snapGlobale
    ? {
        x: snapGlobale.x,
        y: snapGlobale.y,
        type: snapGlobale.type,
      }
    : null,
)


const puntoConSnap =
  snapGlobale
    ? {
        x: snapGlobale.x,
        y: snapGlobale.y,
      }
    : puntoWorkspace

if (
  strumentoDisegno === "penna" ||
  strumentoDisegno === "evidenziatore"
) {
  event.preventDefault()
  event.stopPropagation()
  event.currentTarget.setPointerCapture(
    event.pointerId,
  )

  workspacePennaPointsRef.current = [
    puntoConSnap,
  ]

  return
}
if (
  metroAttivo &&
  puntoInizioMetroWorkspaceRef.current &&
  scaleCalibration
) {
  const dx =
    puntoConSnap.x -
    puntoInizioMetroWorkspaceRef.current.x

  const dy =
    puntoConSnap.y -
    puntoInizioMetroWorkspaceRef.current.y

  const distanzaPixel =
    Math.sqrt(dx * dx + dy * dy)

  const metri =
    distanzaPixel *
    (scaleCalibration.realDistance /
      scaleCalibration.pixelDistance)

  setWorkspaceMetroPreview({
    start:
      puntoInizioMetroWorkspaceRef.current,
    end: puntoConSnap,
    metri,
  })

  return
}

if (areaAttiva) {
  const risultatoArea =
    handleAreaPointerDown(
      workspaceAreaStateRef.current,
      puntoConSnap,
      {
        layerId: layerAttivoId,

        stroke: {
          color: coloreDisegno,
          width: spessoreDisegno,
        },

        fill: {
          color: coloreDisegno,
          opacity: 0.12,
        },

        scaleCalibration,
      },
    )

  workspaceAreaStateRef.current =
    risultatoArea.state

  setWorkspaceAreaPoints(
    risultatoArea.state.points,
  )

  setWorkspaceAreaPreview(
    puntoConSnap,
  )

  if (risultatoArea.entity) {
    setWorkspaceCadEntities(
      (entitiesCorrenti) => [
        ...entitiesCorrenti,
        risultatoArea.entity!,
      ],
    )

    workspaceAreaStateRef.current =
      createInitialAreaState()

    setWorkspaceAreaPoints([])
    setWorkspaceAreaPreview(null)
    setWorkspaceSnapPoint(null)

    setAreaAttiva(false)
    setModalitaSelezione(true)

    setQuadernoDirty(true)
  }

  return
}

if (strumentoDisegno === "perpendicolare" && !workspacePerpendicolareRiferimento) {
  const idsRiferimento = [snapGlobale?.entityId, ...(snapGlobale?.relatedEntityIds ?? [])]
  const riferimento = lineeRiferimentoPerpendicolare.find(
    (entity) => idsRiferimento.includes(entity.id),
  ) ?? [...lineeRiferimentoPerpendicolare].reverse().find(
    (entity) => lineBehavior.hitTest?.(entity, puntoWorkspace, tolerance),
  )
  if (riferimento) setWorkspacePerpendicolareRiferimento(riferimento)
  return
}

const puntoPreview =
  snapGlobale
    ? puntoConSnap
    : orthoAttivo &&
        workspaceLineaStartRef.current &&
        strumentoDisegno === "linea"
      ? applyOrtho(
          workspaceLineaStartRef.current,
          puntoWorkspace,
        )
      : puntoWorkspace
  const start =
    workspaceLineaStartRef.current

if (!start) {
  workspaceLineaStartRef.current =
    puntoConSnap

  setWorkspaceLineaPreview(
    puntoConSnap,
  )

 
  return
}
const puntoFinale =
  strumentoDisegno === "perpendicolare" && workspacePerpendicolareRiferimento
    ? projectPointOnPerpendicular(
        start, puntoConSnap,
        workspacePerpendicolareRiferimento.start,
        workspacePerpendicolareRiferimento.end,
      ) ?? start
    : strumentoDisegno === "freccia"
    ? vincolaPuntoFrecciaWorkspace(start, puntoConSnap, Boolean(snapGlobale))
    : snapGlobale
    ? puntoConSnap
    : orthoAttivo &&
        strumentoDisegno === "linea"
      ? applyOrtho(
          start,
          puntoWorkspace,
        )
      : puntoWorkspace



if (strumentoDisegno === "rettangolo") {
  const nuovoRettangolo =
    createCadRectangle({
      transform: {
        x: Math.min(start.x, puntoFinale.x),
        y: Math.min(start.y, puntoFinale.y),
        width: Math.abs(puntoFinale.x - start.x),
        height: Math.abs(puntoFinale.y - start.y),
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      },
      stroke: {
        color: coloreDisegno,
        width: spessoreDisegno,
      },
      layerId: layerAttivoId,
    })

  const paginaProprietaria =
    trovaPaginaDaPuntoWorkspace(start)

  nuovoRettangolo.metadata = {
    ...nuovoRettangolo.metadata,
    workspacePageId:
      paginaProprietaria?.id,
  }

  setWorkspaceCadEntities(
    (entitiesCorrenti) => [
      ...entitiesCorrenti,
      nuovoRettangolo,
    ],
  )

  workspaceLineaStartRef.current = null
  setWorkspaceLineaPreview(null)

  setQuadernoDirty(true)

  return
}

if (
  (strumentoDisegno === "freccia" || strumentoDisegno === "perpendicolare") &&
  start.x === puntoFinale.x && start.y === puntoFinale.y
) {
  return
}

const nuovaLinea =
  createCadLine({
    metadata: strumentoDisegno === "freccia"
      ? { legacyStrumento: "freccia" }
      : undefined,
    start,
    end: puntoFinale,
    stroke: {
      color: coloreDisegno,
      width: spessoreDisegno,
    },
    layerId: layerAttivoId,
  })

const paginaProprietaria =
  trovaPaginaDaPuntoWorkspace(start)

nuovaLinea.metadata = {
  ...nuovaLinea.metadata,
  workspacePageId:
    paginaProprietaria?.id,
}

setWorkspaceCadEntities(
    (entitiesCorrenti) => [
      ...entitiesCorrenti,
      nuovaLinea,
    ],
  )

  workspaceLineaStartRef.current = null
setWorkspaceLineaPreview(null)
if (strumentoDisegno === "perpendicolare") {
  setWorkspacePerpendicolareRiferimento(null)
  setWorkspaceSnapPoint(null)
}

  setQuadernoDirty(true)
}}

onPointerMove={(event) => {
if (strumentoDisegno === "gomma" && !manoAttiva && !spostaTavolaAttivo) {
  const point = puntoGommaWorkspace(event)
  setWorkspaceGommaCursor(
    point.x >= 0 && point.y >= 0 &&
    point.x <= dimensioniWorkspace.width && point.y <= dimensioniWorkspace.height
      ? point : null,
  )
}
if (workspaceGommaRef.current) {
  if (workspaceGommaRef.current.pointerId === event.pointerId) {
    event.preventDefault()
    event.stopPropagation()
    const eventiGomma = event.nativeEvent.getCoalescedEvents?.() ?? []
    const campioniGomma = eventiGomma.length > 0 ? eventiGomma : [event]
    for (const sample of campioniGomma) {
      applicaGommaWorkspace(puntoGommaWorkspace(event, sample))
    }
  }
  return
}


if (
  workspacePosterResizeRef.current.attivo &&
  workspacePosterResizeRef.current.id &&
  workspacePosterResizeRef.current.handle &&
  workspacePosterResizeRef.current.start &&
  workspacePosterResizeRef.current.transformIniziale
) {
  const svg = event.currentTarget

  const rect =
    svg.getBoundingClientRect()

  const puntoWorkspace: CadPoint = {
    x:
      ((event.clientX - rect.left) /
        rect.width) *
      dimensioniWorkspace.width,

    y:
      ((event.clientY - rect.top) /
        rect.height) *
      dimensioniWorkspace.height,
  }

  const start =
    workspacePosterResizeRef.current.start

  const transformIniziale =
    workspacePosterResizeRef.current
      .transformIniziale

  const idPoster =
    workspacePosterResizeRef.current.id

  const handle =
    workspacePosterResizeRef.current.handle

  const deltaX =
    puntoWorkspace.x - start.x

  const deltaY =
    puntoWorkspace.y - start.y

  const rapporto =
    transformIniziale.width /
    transformIniziale.height

  const minWidth = 40

  const minHeight =
    minWidth / rapporto

  const left =
    transformIniziale.x

  const top =
    transformIniziale.y

  const right =
    transformIniziale.x +
    transformIniziale.width

  const bottom =
    transformIniziale.y +
    transformIniziale.height

  const centerX =
    transformIniziale.x +
    transformIniziale.width / 2

  const centerY =
    transformIniziale.y +
    transformIniziale.height / 2

  let nuovaX =
    transformIniziale.x

  let nuovaY =
    transformIniziale.y

  let nuovaWidth =
    transformIniziale.width

  let nuovaHeight =
    transformIniziale.height

  if (handle === "e") {
    nuovaWidth =
      Math.max(
        minWidth,
        transformIniziale.width +
          deltaX,
      )

    nuovaHeight =
      nuovaWidth / rapporto

    nuovaY =
      centerY -
      nuovaHeight / 2
  }

  if (handle === "w") {
    nuovaWidth =
      Math.max(
        minWidth,
        transformIniziale.width -
          deltaX,
      )

    nuovaHeight =
      nuovaWidth / rapporto

    nuovaX =
      right - nuovaWidth

    nuovaY =
      centerY -
      nuovaHeight / 2
  }

  if (handle === "s") {
    nuovaHeight =
      Math.max(
        minHeight,
        transformIniziale.height +
          deltaY,
      )

    nuovaWidth =
      nuovaHeight * rapporto

    nuovaX =
      centerX -
      nuovaWidth / 2
  }

  if (handle === "n") {
    nuovaHeight =
      Math.max(
        minHeight,
        transformIniziale.height -
          deltaY,
      )

    nuovaWidth =
      nuovaHeight * rapporto

    nuovaX =
      centerX -
      nuovaWidth / 2

    nuovaY =
      bottom - nuovaHeight
  }

  if (
    handle === "se" ||
    handle === "ne" ||
    handle === "sw" ||
    handle === "nw"
  ) {
    const daSinistra =
      handle === "nw" ||
      handle === "sw"

    const daAlto =
      handle === "nw" ||
      handle === "ne"

    const widthDaMouse =
      daSinistra
        ? transformIniziale.width -
          deltaX
        : transformIniziale.width +
          deltaX

    const heightDaMouse =
      daAlto
        ? transformIniziale.height -
          deltaY
        : transformIniziale.height +
          deltaY

    if (
      Math.abs(
        widthDaMouse -
          transformIniziale.width,
      ) >=
      Math.abs(
        (
          heightDaMouse -
          transformIniziale.height
        ) * rapporto,
      )
    ) {
      nuovaWidth =
        Math.max(
          minWidth,
          widthDaMouse,
        )

      nuovaHeight =
        nuovaWidth / rapporto
    } else {
      nuovaHeight =
        Math.max(
          minHeight,
          heightDaMouse,
        )

      nuovaWidth =
        nuovaHeight * rapporto
    }

    if (daSinistra) {
      nuovaX =
        right - nuovaWidth
    } else {
      nuovaX = left
    }

    if (daAlto) {
      nuovaY =
        bottom - nuovaHeight
    } else {
      nuovaY = top
    }
  }

  setWorkspacePosterImages(
    (correnti) =>
      correnti.map(
        (oggetto) =>
          oggetto.id === idPoster
            ? {
                ...oggetto,

                transform: {
                  ...oggetto.transform,

                  x: nuovaX,
                  y: nuovaY,
                  width: nuovaWidth,
                  height: nuovaHeight,
                },
              }
            : oggetto,
      ),
  )

  return
}
  if (
    workspacePosterDragRef.current.attivo &&
    workspacePosterDragRef.current.id &&
    workspacePosterDragRef.current.start &&
    workspacePosterDragRef.current.transformIniziale
  ) {

    const svg = event.currentTarget

    const rect =
      svg.getBoundingClientRect()

    const puntoWorkspace: CadPoint = {
      x:
        ((event.clientX - rect.left) /
          rect.width) *
        dimensioniWorkspace.width,

      y:
        ((event.clientY - rect.top) /
          rect.height) *
        dimensioniWorkspace.height,
    }

    const deltaX =
      puntoWorkspace.x -
      workspacePosterDragRef.current.start.x

    const deltaY =
      puntoWorkspace.y -
      workspacePosterDragRef.current.start.y

    const transformIniziale =
      workspacePosterDragRef.current
        .transformIniziale

    const idPoster =
      workspacePosterDragRef.current.id

    setWorkspacePosterImages(
      (correnti) =>
        correnti.map(
          (oggetto) =>
            oggetto.id === idPoster
              ? {
                  ...oggetto,

                  transform: {
                    ...oggetto.transform,

                    x:
                      transformIniziale.x +
                      deltaX,

                    y:
                      transformIniziale.y +
                      deltaY,
                  },
                }
              : oggetto,
        ),
    )

    return
  }

if (
  metroAttivo &&
  quotaWorkspaceInPosizionamentoId
) {
  const svg = event.currentTarget

  const rect =
    svg.getBoundingClientRect()

  const puntoWorkspace: CadPoint = {
    x:
      ((event.clientX - rect.left) /
        rect.width) *
      dimensioniWorkspace.width,

    y:
      ((event.clientY - rect.top) /
        rect.height) *
      dimensioniWorkspace.height,
  }

  const quotaInPosizionamento =
    workspaceCadEntities.find(
      (entity) =>
        entity.id ===
          quotaWorkspaceInPosizionamentoId &&
        entity.type === "dimension",
    )

  if (
    quotaInPosizionamento &&
    quotaInPosizionamento.type === "dimension"
  ) {
    const dxQuota =
      quotaInPosizionamento.end.x -
      quotaInPosizionamento.start.x

    const dyQuota =
      quotaInPosizionamento.end.y -
      quotaInPosizionamento.start.y

    const lunghezzaQuota =
      Math.hypot(dxQuota, dyQuota)

    if (lunghezzaQuota > 0) {
      const normaleX =
        -dyQuota / lunghezzaQuota

      const normaleY =
        dxQuota / lunghezzaQuota

      const dxMouse =
        puntoWorkspace.x -
        quotaInPosizionamento.start.x

      const dyMouse =
        puntoWorkspace.y -
        quotaInPosizionamento.start.y

      const nuovoOffset =
        dxMouse * normaleX +
        dyMouse * normaleY

      setWorkspaceCadEntities(
        (entitiesCorrenti) =>
          entitiesCorrenti.map((entity) =>
            entity.id ===
            quotaWorkspaceInPosizionamentoId
              ? {
                  ...entity,
                  offset: nuovoOffset,
                  updatedAt:
                    new Date().toISOString(),
                }
              : entity,
          ),
      )

      return
    }
  }
}

  if (
    selezioneWorkspaceRef.current.attiva &&
    selezioneWorkspaceRef.current.start
  ) {

    const svg = event.currentTarget
    const rect =
      svg.getBoundingClientRect()

    const puntoWorkspace: CadPoint = {
      x:
        ((event.clientX - rect.left) /
          rect.width) *
        dimensioniWorkspace.width,

      y:
        ((event.clientY - rect.top) /
          rect.height) *
        dimensioniWorkspace.height,
    }

    const start =
      selezioneWorkspaceRef.current.start

    setRettangoloSelezione({
      startX: start.x,
      startY: start.y,
      endX: puntoWorkspace.x,
      endY: puntoWorkspace.y,
    })

    return
  }

 if (
  (
    strumentoDisegno !== "linea" &&
    strumentoDisegno !== "freccia" &&
    strumentoDisegno !== "perpendicolare" &&
    strumentoDisegno !== "rettangolo" &&
    strumentoDisegno !== "penna" &&
    strumentoDisegno !== "evidenziatore" &&
    !areaAttiva
  ) ||

    manoAttiva ||
    spostaTavolaAttivo
  ) {
    return
  }
 
  const svg = event.currentTarget

  const rect =
    svg.getBoundingClientRect()

  const puntoWorkspace: CadPoint = {
  x:
    ((event.clientX - rect.left) /
      rect.width) *
    dimensioniWorkspace.width,

  y:
    ((event.clientY - rect.top) /
      rect.height) *
    dimensioniWorkspace.height,
}

const tolerance =
  getSnapTolerance(
    dimensioniWorkspace.width,
    rect.width,
  )

const snapGlobale =
  snapAttivo
    ? resolveSnapPoint({
        entities: workspaceSnapEntities,
        cursor: puntoWorkspace,
        tolerance,
      })
    : null

setWorkspaceSnapPoint(
  snapGlobale
    ? {
        x: snapGlobale.x,
        y: snapGlobale.y,
        type: snapGlobale.type,
      }
    : null,
)

const puntoConSnap =
  snapGlobale
    ? {
        x: snapGlobale.x,
        y: snapGlobale.y,
      }
    : puntoWorkspace

if (
  (
    strumentoDisegno === "penna" ||
    strumentoDisegno === "evidenziatore"
  ) &&
  event.buttons !== 0 &&
  workspacePennaPointsRef.current.length > 0
) {
const eventiPenna =
  event.nativeEvent.getCoalescedEvents?.() ?? []

const nuoviCampioniPenna =
  eventiPenna.length > 0
    ? eventiPenna.map((eventoPointer) => ({
        x:
          ((eventoPointer.clientX - rect.left) /
            rect.width) *
          dimensioniWorkspace.width,

        y:
          ((eventoPointer.clientY - rect.top) /
            rect.height) *
          dimensioniWorkspace.height,
      }))
    : [puntoConSnap]

const nuoviPuntiPenna = [
  ...workspacePennaPointsRef.current,
  ...nuoviCampioniPenna,
]
workspacePennaPointsRef.current =
  nuoviPuntiPenna

if (workspacePennaPreviewRef.current) {
  workspacePennaPreviewRef.current.setAttribute(
    "points",
    nuoviPuntiPenna
      .map(
        (point) =>
          `${point.x},${point.y}`,
      )
      .join(" "),
  )
}


  return
}

if (areaAttiva) {
  setWorkspaceAreaPreview(
    puntoConSnap,
  )

  return
}

if (workspaceLineaStartRef.current) {
  const puntoPreview =
    strumentoDisegno === "perpendicolare" && workspacePerpendicolareRiferimento
      ? projectPointOnPerpendicular(
          workspaceLineaStartRef.current, puntoConSnap,
          workspacePerpendicolareRiferimento.start,
          workspacePerpendicolareRiferimento.end,
        ) ?? workspaceLineaStartRef.current
      : strumentoDisegno === "freccia"
      ? vincolaPuntoFrecciaWorkspace(
          workspaceLineaStartRef.current,
          puntoConSnap,
          Boolean(snapGlobale),
        )
      : orthoAttivo &&
    strumentoDisegno === "linea"
      ? applyOrtho(
          workspaceLineaStartRef.current,
          puntoConSnap,
        )
      : puntoConSnap

    setWorkspaceLineaPreview(
    puntoPreview,
  )
}}}

onPointerUp={(event) => {
if (workspaceGommaRef.current) {
  event.stopPropagation()
  terminaGommaWorkspace(event, true)
  return
}


if (workspacePosterResizeRef.current.attivo) {
  workspacePosterResizeRef.current = {
    attivo: false,
  id: null,
  handle: null,
  start: null,
  transformIniziale: null,
  }

  if (
    event.currentTarget.hasPointerCapture(
      event.pointerId,
    )
  ) {
    event.currentTarget.releasePointerCapture(
      event.pointerId,
    )
  }

  setQuadernoDirty(true)

  return
}

if (workspacePosterDragRef.current.attivo) {
  workspacePosterDragRef.current = {
    attivo: false,
    id: null,
    start: null,
    transformIniziale: null,
  }

  if (
    event.currentTarget.hasPointerCapture(
      event.pointerId,
    )
  ) {
    event.currentTarget.releasePointerCapture(
      event.pointerId,
    )
  }

  setQuadernoDirty(true)

  return
}

if (
  strumentoDisegno === "penna" ||
  strumentoDisegno === "evidenziatore"
) {
const puntiPenna =
  workspacePennaPointsRef.current

workspacePennaPointsRef.current = []

if (workspacePennaPreviewRef.current) {
  workspacePennaPreviewRef.current.setAttribute(
    "points",
    "",
  )
}

if (puntiPenna.length < 2) {
  return
}
  const nuovoTratto =
  createCadFreehand({
    points: puntiPenna,
    stroke: {
      color: coloreDisegno,
      width: spessoreDisegno,
      opacity:
        strumentoDisegno === "evidenziatore"
          ? 0.32
          : 1,
    },
    layerId: layerAttivoId,
  })

  setWorkspaceCadEntities(
    (entitiesCorrenti) => [
      ...entitiesCorrenti,
      nuovoTratto,
    ],
  )

  setQuadernoDirty(true)

  return
}

  if (
    !selezioneWorkspaceRef.current.attiva ||
    !selezioneWorkspaceRef.current.start
  ) {
    return
  }

  const svg = event.currentTarget
  const rect =
    svg.getBoundingClientRect()

  const puntoFinale: CadPoint = {
    x:
      ((event.clientX - rect.left) /
        rect.width) *
      dimensioniWorkspace.width,

    y:
      ((event.clientY - rect.top) /
        rect.height) *
      dimensioniWorkspace.height,
  }

  const start =
    selezioneWorkspaceRef.current.start

const modalitaCrossing =
  puntoFinale.x < start.x

  const minX =
    Math.min(start.x, puntoFinale.x)
  const maxX =
    Math.max(start.x, puntoFinale.x)
  const minY =
  Math.min(start.y, puntoFinale.y)
const maxY =
  Math.max(start.y, puntoFinale.y)

if (spostaTavolaAttivo) {
  // Convert Workspace deltas back to screen pixels using the SVG's displayed size.
  const deltaX = (puntoFinale.x - start.x) * rect.width / dimensioniWorkspace.width
  const deltaY = (puntoFinale.y - start.y) * rect.height / dimensioniWorkspace.height
  const distanza = Math.hypot(deltaX, deltaY)
  const soglia = 4
  const isDrag = distanza > soglia

  if (isDrag) {
  const pagineTrovateIds =
    pagineQuaderno
      .filter((pagina) => {
        const layout =
          pagina.pageLayout ??
          createQuadernoPageLayout()

        const paginaX =
          pagina.workspaceX ?? 0
        const paginaY =
          pagina.workspaceY ?? 0

        const paginaDestra =
          paginaX + layout.width
        const paginaBasso =
          paginaY + layout.height

        if (!modalitaCrossing) {
          return (
            paginaX >= minX &&
            paginaDestra <= maxX &&
            paginaY >= minY &&
            paginaBasso <= maxY
          )
        }

        return (
          paginaDestra >= minX &&
          paginaX <= maxX &&
          paginaBasso >= minY &&
          paginaY <= maxY
        )
      })
      .map((pagina) => pagina.id)
  setPagineWorkspaceSelezionateIds((correnti) => {
        return pagineTrovateIds
  })
  }


selezioneWorkspaceRef.current = {
  attiva: false,
  start: null,
  ctrlKey: false,
}

  setRettangoloSelezione(null)

  if (
    event.currentTarget.hasPointerCapture(
      event.pointerId,
    )
  ) {
    event.currentTarget.releasePointerCapture(
      event.pointerId,
    )
  }

  return
}

const deltaX = (puntoFinale.x - start.x) * rect.width / dimensioniWorkspace.width
const deltaY = (puntoFinale.y - start.y) * rect.height / dimensioniWorkspace.height
const distanza = Math.hypot(deltaX, deltaY)
const soglia = 4
const isDrag = distanza > soglia

const idsTrovati = isDrag ? workspaceCadEntities.filter(entity => {
  if (entity.visible === false || entity.locked === true || entity.selectable === false) return false
  const layer = layers.find(item => item.id === entity.layerId)
  if (!layer || layer.visible !== true || layer.locked !== false || layer.selectable !== true) return false
  return intersectsCadMarquee(entity, { minX, minY, maxX, maxY },
    modalitaCrossing ? "crossing" : "containment")
}).map(entity => entity.id) : []


if (isDrag) {
const selezioneFinale = selezioneWorkspaceRef.current.ctrlKey
  ? Array.from(new Set([...cadEntitySelezionateIds, ...idsTrovati]))
  : idsTrovati
setCadEntitySelezionateIds(selezioneFinale)
setCadEntitySelezionataId(
  selezioneWorkspaceRef.current.ctrlKey && cadEntitySelezionataId && selezioneFinale.includes(cadEntitySelezionataId)
    ? cadEntitySelezionataId
    : selezioneFinale[0] ?? null,
)
}

  selezioneWorkspaceRef.current = {
    attiva: false,
    start: null,
    ctrlKey: false,
  }

  setRettangoloSelezione(null)

   if (
    event.currentTarget.hasPointerCapture(
      event.pointerId,
    )
  ) {
    event.currentTarget.releasePointerCapture(
      event.pointerId,
    )
  }
}}

onPointerCancel={(event) => {
if (workspaceGommaRef.current) {
  event.stopPropagation()
  terminaGommaWorkspace(event)
  return
}


if (strumentoDisegno === "perpendicolare") {
  workspaceLineaStartRef.current = null
  setWorkspaceLineaPreview(null)
  setWorkspacePerpendicolareRiferimento(null)
  setWorkspaceSnapPoint(null)
}

if (workspacePosterResizeRef.current.attivo) {
  workspacePosterResizeRef.current = {
   attivo: false,
  id: null,
  handle: null,
  start: null,
  transformIniziale: null,
  }

  if (
    event.currentTarget.hasPointerCapture(
      event.pointerId,
    )
  ) {
    event.currentTarget.releasePointerCapture(
      event.pointerId,
    )
  }

  return
}

  if (workspacePosterDragRef.current.attivo) {
    workspacePosterDragRef.current = {
      attivo: false,
      id: null,
      start: null,
      transformIniziale: null,
    }

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      )
    }

    return
  }
}}
style={{
  position: "absolute",
  left: 0,
  top: 0,
  width: dimensioniWorkspace.width,
  height: dimensioniWorkspace.height,

pointerEvents:
  marqueeCadAttivo ||
  (strumentoDisegno === "testo" && !manoAttiva && !spostaTavolaAttivo) ||
  (strumentoDisegno === "gomma" && !manoAttiva && !spostaTavolaAttivo) ||
  trimAttivo ||
  metroAttivo ||
  strumentoDisegno === "linea" ||
  strumentoDisegno === "freccia" ||
  strumentoDisegno === "perpendicolare" ||
  strumentoDisegno === "rettangolo" ||
  strumentoDisegno === "penna" ||
  strumentoDisegno === "evidenziatore" ||
  areaAttiva ||
  selezioneWorkspaceRef.current.attiva
    ? "auto"
    : "none",

  overflow: "visible",
  zIndex: 50,
}}
>
<defs>
  <marker
    id={workspaceFrecciaMarkerId}
    viewBox="0 0 10 10"
    refX={10}
    refY={5}
    markerWidth={6}
    markerHeight={6}
    orient="auto"
    markerUnits="strokeWidth"
  >
    <path d="M 0 0 L 10 5 L 0 10 Z" fill="context-stroke" />
  </marker>
</defs>
{workspacePosterImages.map(
  (oggetto) => {
    const selezionato =
      workspacePosterSelezionatoId ===
      oggetto.id

    return (
      <g key={oggetto.id}>
        <image

          href={oggetto.sorgente}
          x={oggetto.transform.x}
          y={oggetto.transform.y}
          width={oggetto.transform.width}
          height={oggetto.transform.height}
          preserveAspectRatio="none"
         pointerEvents={
  !manoAttiva &&
  !spostaTavolaAttivo
    ? "all"
    : "none"
}
        onPointerDown={(event) => {
  if (
    manoAttiva ||
    spostaTavolaAttivo
  ) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  setWorkspacePosterSelezionatoId(
    oggetto.id,
  )

  setOggettoGraficoSelezionatoId(null)

  setCadEntitySelezionataId(null)
  setCadEntitySelezionateIds([])
  setPinSelezionatoId(null)
  setSfondoSelezionato(false)

  const svg =
    event.currentTarget.ownerSVGElement

  if (!svg) {
    return
  }

  const rect =
    svg.getBoundingClientRect()

  const puntoWorkspace: CadPoint = {
    x:
      ((event.clientX - rect.left) /
        rect.width) *
      dimensioniWorkspace.width,

    y:
      ((event.clientY - rect.top) /
        rect.height) *
      dimensioniWorkspace.height,
  }

  workspacePosterDragRef.current = {
    attivo: true,
    id: oggetto.id,
    start: puntoWorkspace,
    transformIniziale: {
      ...oggetto.transform,
    },
  }

  svg.setPointerCapture(
    event.pointerId,
  )
}}

          style={{
          cursor:
  !manoAttiva &&
  !spostaTavolaAttivo
    ? "pointer"
    : "default",
          }}
        />

       {selezionato && (
  <>
   <rect
  data-print-ui="true"
  x={oggetto.transform.x}

      y={oggetto.transform.y}
      width={oggetto.transform.width}
      height={oggetto.transform.height}
      fill="none"
      stroke="#2563eb"
      strokeWidth={3}
      strokeDasharray="10 6"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />

{/* NW */}
<circle
data-print-ui="true"

  cx={oggetto.transform.x}
  cy={oggetto.transform.y}
  r={8}
  fill="#ffffff"
  stroke="#2563eb"
  strokeWidth={3}
  vectorEffect="non-scaling-stroke"
  pointerEvents="all"
  style={{ cursor: "nwse-resize" }}
  onPointerDown={(event) =>
    iniziaResizePoster(
      event,
      oggetto,
      "nw",
    )
  }
/>

{/* N */}
<circle
data-print-ui="true"
  cx={
    oggetto.transform.x +
    oggetto.transform.width / 2
  }
  cy={oggetto.transform.y}
  r={8}
  fill="#ffffff"
  stroke="#2563eb"
  strokeWidth={3}
  vectorEffect="non-scaling-stroke"
  pointerEvents="all"
  style={{ cursor: "ns-resize" }}
  onPointerDown={(event) =>
    iniziaResizePoster(
      event,
      oggetto,
      "n",
    )
  }
/>

{/* NE */}
<circle
data-print-ui="true"
  cx={
    oggetto.transform.x +
    oggetto.transform.width
  }
  cy={oggetto.transform.y}
  r={8}
  fill="#ffffff"
  stroke="#2563eb"
  strokeWidth={3}
  vectorEffect="non-scaling-stroke"
  pointerEvents="all"
  style={{ cursor: "nesw-resize" }}
  onPointerDown={(event) =>
    iniziaResizePoster(
      event,
      oggetto,
      "ne",
    )
  }
/>

{/* E */}
<circle
data-print-ui="true"
  cx={
    oggetto.transform.x +
    oggetto.transform.width
  }
  cy={
    oggetto.transform.y +
    oggetto.transform.height / 2
  }
  r={8}
  fill="#ffffff"
  stroke="#2563eb"
  strokeWidth={3}
  vectorEffect="non-scaling-stroke"
  pointerEvents="all"
  style={{ cursor: "ew-resize" }}
  onPointerDown={(event) =>
    iniziaResizePoster(
      event,
      oggetto,
      "e",
    )
  }
/>

{/* S */}
<circle
data-print-ui="true"
  cx={
    oggetto.transform.x +
    oggetto.transform.width / 2
  }
  cy={
    oggetto.transform.y +
    oggetto.transform.height
  }
  r={8}
  fill="#ffffff"
  stroke="#2563eb"
  strokeWidth={3}
  vectorEffect="non-scaling-stroke"
  pointerEvents="all"
  style={{ cursor: "ns-resize" }}
  onPointerDown={(event) =>
    iniziaResizePoster(
      event,
      oggetto,
      "s",
    )
  }
/>

{/* SW */}
<circle
data-print-ui="true"
  cx={oggetto.transform.x}
  cy={
    oggetto.transform.y +
    oggetto.transform.height
  }
  r={8}
  fill="#ffffff"
  stroke="#2563eb"
  strokeWidth={3}
  vectorEffect="non-scaling-stroke"
  pointerEvents="all"
  style={{ cursor: "nesw-resize" }}
  onPointerDown={(event) =>
    iniziaResizePoster(
      event,
      oggetto,
      "sw",
    )
  }
/>

{/* W */}
<circle
data-print-ui="true"
  cx={oggetto.transform.x}
  cy={
    oggetto.transform.y +
    oggetto.transform.height / 2
  }
  r={8}
  fill="#ffffff"
  stroke="#2563eb"
  strokeWidth={3}
  vectorEffect="non-scaling-stroke"
  pointerEvents="all"
  style={{ cursor: "ew-resize" }}
  onPointerDown={(event) =>
    iniziaResizePoster(
      event,
      oggetto,
      "w",
    )
  }
/>

    <circle
  data-print-ui="true"
      cx={
        oggetto.transform.x +
        oggetto.transform.width
      }
      cy={
        oggetto.transform.y +
        oggetto.transform.height
      }
      r={8}
      fill="#ffffff"
      stroke="#2563eb"
      strokeWidth={3}
      vectorEffect="non-scaling-stroke"
      pointerEvents="all"
      style={{
        cursor: "nwse-resize",
      }}

 onPointerDown={(event) =>
  iniziaResizePoster(
    event,
    oggetto,
    "se",
  )
}

    />
  </>
)}

      </g>
    )
  },
)}
{(
  strumentoDisegno === "linea" ||
  strumentoDisegno === "freccia" ||
  strumentoDisegno === "perpendicolare" ||
  strumentoDisegno === "rettangolo" ||
  areaAttiva
) &&  !manoAttiva &&
  !spostaTavolaAttivo && (
    <rect
      x={0}
      y={0}
      width={dimensioniWorkspace.width}
      height={dimensioniWorkspace.height}
      fill="transparent"
      pointerEvents="all"
    />
)}

{rettangoloSelezione &&
  selezioneWorkspaceRef.current.attiva && (
    <rect
      data-print-ui="true"
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
      fill={
  rettangoloSelezione.endX <
  rettangoloSelezione.startX
    ? "rgba(22, 163, 74, 0.12)"
    : "rgba(37, 99, 235, 0.12)"
}
     stroke={
  rettangoloSelezione.endX <
  rettangoloSelezione.startX
    ? "#16a34a"
    : "#2563eb"
}
      strokeWidth={1.5}
      strokeDasharray="8 6"
      pointerEvents="none"
    />
)}

{workspaceMetroPreview && (
  <g
    data-print-ui="true"
    pointerEvents="none"
  >
    <line
      x1={workspaceMetroPreview.start.x}
      y1={workspaceMetroPreview.start.y}
      x2={workspaceMetroPreview.end.x}
      y2={workspaceMetroPreview.end.y}
      stroke="#2563eb"
      strokeWidth={2}
      strokeDasharray="6 4"
    />

    <circle
      cx={workspaceMetroPreview.start.x}
      cy={workspaceMetroPreview.start.y}
      r={5}
      fill="#ffffff"
      stroke="#2563eb"
      strokeWidth={2}
    />

    <circle
      cx={workspaceMetroPreview.end.x}
      cy={workspaceMetroPreview.end.y}
      r={5}
      fill="#ffffff"
      stroke="#2563eb"
      strokeWidth={2}
    />

    <text
      x={
        (workspaceMetroPreview.start.x +
          workspaceMetroPreview.end.x) /
        2
      }
      y={
        (workspaceMetroPreview.start.y +
          workspaceMetroPreview.end.y) /
          2 -
        10
      }
      textAnchor="middle"
      fontSize={16}
      fontWeight={700}
      fill="#2563eb"
    >
      {workspaceMetroPreview.metri.toFixed(2)}{" "}
      {scaleCalibration?.unit ?? "m"}
    </text>
  </g>
)}

{strumentoDisegno === "gomma" && !manoAttiva && !spostaTavolaAttivo && workspaceGommaCursor && (
  <circle
    data-print-ui="true"
    cx={workspaceGommaCursor.x}
    cy={workspaceGommaCursor.y}
    r={workspaceGommaRef.current?.radius ?? diametroGomma / 2}
    fill="rgba(148, 163, 184, 0.12)"
    stroke="#475569"
    strokeWidth={1}
    vectorEffect="non-scaling-stroke"
    pointerEvents="none"
  />
)}

<polyline
  ref={workspacePennaPreviewRef}
  opacity={strumentoDisegno === "evidenziatore" ? 0.32 : 1}
  points=""
  fill="none"
  stroke={coloreDisegno}
  strokeWidth={spessoreDisegno}
  strokeLinecap="round"
  strokeLinejoin="round"
  pointerEvents="none"
/>

{workspaceSnapPoint && (
  <circle
    data-print-ui="true"
    cx={workspaceSnapPoint.x}
    cy={workspaceSnapPoint.y}
    r={6}
    fill="none"
    stroke="#dc2626"
    strokeWidth={2}
  />
)}

{workspaceAreaPoints.length > 0 && (
  <>
    <polyline
      points={[
        ...workspaceAreaPoints,
        ...(workspaceAreaPreview
          ? [workspaceAreaPreview]
          : []),
      ]
        .map(
          (point) =>
            `${point.x},${point.y}`,
        )
        .join(" ")}
      fill="none"
      stroke="#2563eb"
      strokeWidth={2}
      strokeDasharray="8 6"
      pointerEvents="none"
    />

    {workspaceAreaPoints.map(
      (point, index) => (
        <circle
          key={`workspace-area-point-${index}`}
          cx={point.x}
          cy={point.y}
          r={4}
          fill="#2563eb"
          pointerEvents="none"
        />
      ),
    )}
  </>
)}

{strumentoDisegno === "perpendicolare" && workspacePerpendicolareRiferimento && (
  <line
    x1={workspacePerpendicolareRiferimento.start.x}
    y1={workspacePerpendicolareRiferimento.start.y}
    x2={workspacePerpendicolareRiferimento.end.x}
    y2={workspacePerpendicolareRiferimento.end.y}
    stroke="#2563eb"
    strokeWidth={3}
    strokeDasharray="6 4"
    pointerEvents="none"
  />
)}
{workspaceLineaStartRef.current &&
  workspaceLineaPreview &&
  strumentoDisegno === "rettangolo" && (
    <rect
      x={Math.min(
        workspaceLineaStartRef.current.x,
        workspaceLineaPreview.x,
      )}
      y={Math.min(
        workspaceLineaStartRef.current.y,
        workspaceLineaPreview.y,
      )}
      width={Math.abs(
        workspaceLineaPreview.x -
          workspaceLineaStartRef.current.x,
      )}
      height={Math.abs(
        workspaceLineaPreview.y -
          workspaceLineaStartRef.current.y,
      )}
      stroke="#2563eb"
      strokeWidth={2}
      strokeDasharray="8 6"
      fill="none"
    />
  )}
{workspaceLineaStartRef.current &&
  workspaceLineaPreview &&
  strumentoDisegno !== "rettangolo" && (
    <line
      x1={
        workspaceLineaStartRef.current.x
      }
      y1={
        workspaceLineaStartRef.current.y
      }
      x2={workspaceLineaPreview.x}
      y2={workspaceLineaPreview.y}
      stroke={strumentoDisegno === "freccia" || strumentoDisegno === "perpendicolare" ? coloreDisegno : "#2563eb"}
      strokeWidth={strumentoDisegno === "freccia" || strumentoDisegno === "perpendicolare" ? spessoreDisegno : 2}
      markerEnd={strumentoDisegno === "freccia" ? `url(#${workspaceFrecciaMarkerId})` : undefined}
      strokeDasharray="8 6"
      fill="none"
      pointerEvents="none"
    />
  )}

 {workspaceRenderEntitiesOrdinati.map((entity) => {

const layerEntity =
  layers.find(
    (layer) =>
      layer.id === entity.layerId,
  ) ??
  layers.find(
    (layer) =>
      layer.id === layerAttivoId,
  ) ??
  layers.find(
    (layer) =>
      layer.id === "drawing",
  )

if (
  layerEntity &&
  !layerEntity.visible
) {
  return null
}
  if (entity.type === "text") {
    return (
      <g
        key={entity.id}
        onPointerMove={(event) => {
          const gesture = workspaceTestoMoveRef.current
          if (!gesture || gesture.entityId !== entity.id || gesture.pointerId !== event.pointerId) return
          event.preventDefault()
          event.stopPropagation()
          const layer = layers.find(item => item.id === entity.layerId)
          if (!modalitaSelezione || workspaceTestoDraft || !entity.visible || entity.locked ||
              !entity.selectable || !layer || !layer.visible || layer.locked || layer.selectable === false) {
            terminaMoveTestoWorkspace(event)
            return
          }
          const svg = event.currentTarget.ownerSVGElement
          if (!svg) return
          const rect = svg.getBoundingClientRect()
          const point = {
            x: (event.clientX - rect.left) / rect.width * dimensioniWorkspace.width,
            y: (event.clientY - rect.top) / rect.height * dimensioniWorkspace.height,
          }
          const dx = point.x - gesture.previous.x
          const dy = point.y - gesture.previous.y
          if (dx === 0 && dy === 0) return
          setWorkspaceCadEntities(entities => moveEntities(entities, [gesture.entityId], dx, dy).entities)
          gesture.previous = point
          gesture.changed = true
        }}
        onPointerUp={terminaMoveTestoWorkspace}
        onPointerCancel={terminaMoveTestoWorkspace}
        onLostPointerCapture={terminaMoveTestoWorkspace}
      >
      <CadEntityRenderer
        entity={{
          ...entity,
          locked: entity.locked || !!layerEntity?.locked,
          selectable: entity.selectable && modalitaSelezione && layerEntity?.selectable !== false,
        }}
        selected={cadEntitySelezionateIds.includes(entity.id)}
        textResizeHandlers={modalitaSelezione && !workspaceTestoDraft && entity.visible &&
          !entity.locked && entity.selectable && layers.some(layer => layer.id === entity.layerId &&
            layer.visible && !layer.locked && layer.selectable !== false) ? {
          onPointerDown: (event, side) => {
            event.preventDefault()
            event.stopPropagation()
            if (event.button !== 0 || workspaceTestoResizeRef.current) return
            const svg = event.currentTarget.ownerSVGElement
            if (!svg) return
            const rect = svg.getBoundingClientRect()
            workspaceTestoResizeRef.current = {
              entityId: entity.id, pointerId: event.pointerId, side,
              start: {
                x: (event.clientX - rect.left) / rect.width * dimensioniWorkspace.width,
                y: (event.clientY - rect.top) / rect.height * dimensioniWorkspace.height,
              },
              position: { ...entity.position }, width: getCadTextLayout(entity).boxWidth,
              rotation: entity.rotation, alignment: entity.alignment, changed: false,
              snapshot: creaSnapshotQuaderno(),
            }
            event.currentTarget.setPointerCapture(event.pointerId)
          },
          onPointerMove: (event) => {
            const gesture = workspaceTestoResizeRef.current
            if (!gesture || gesture.pointerId !== event.pointerId) return
            event.preventDefault()
            event.stopPropagation()
            const layer = layers.find(item => item.id === entity.layerId)
            if (!entity.visible || entity.locked || !entity.selectable || !layer ||
                !layer.visible || layer.locked || layer.selectable === false) return
            const svg = event.currentTarget.ownerSVGElement
            if (!svg) return
            const rect = svg.getBoundingClientRect()
            const dx = (event.clientX - rect.left) / rect.width * dimensioniWorkspace.width - gesture.start.x
            const dy = (event.clientY - rect.top) / rect.height * dimensioniWorkspace.height - gesture.start.y
            const angle = gesture.rotation * Math.PI / 180
            const delta = dx * Math.cos(angle) + dy * Math.sin(angle)
            // Fixed baseline anchor: center expands symmetrically; either side controls width.
            const width = Math.max(24, gesture.width + delta *
              (gesture.side === "left" ? -1 : 1) * (gesture.alignment === "center" ? 2 : 1))
            if (width === getCadTextLayout(entity).boxWidth) return
            setWorkspaceCadEntities(entities => entities.map(item => item.id === gesture.entityId && item.type === "text"
              ? { ...item, metadata: { ...item.metadata, textBoxWidth: width }, updatedAt: new Date().toISOString() }
              : item))
            gesture.changed = true
          },
          onPointerUp: terminaResizeTestoWorkspace,
          onPointerCancel: terminaResizeTestoWorkspace,
          onLostPointerCapture: terminaResizeTestoWorkspace,
        } : undefined}
        onDoubleClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          const layer = layers.find((item) => item.id === entity.layerId)
          if (!modalitaSelezione || !entity.visible || entity.locked || !entity.selectable ||
              !layer || !layer.visible || layer.locked || layer.selectable === false) return
          workspaceTestoCompositionRef.current = false
          setWorkspaceTestoDraft({ entityId: entity.id, position: entity.position, content: entity.content })
          workspaceTestoInputRef.current?.focus()
        }}
        onPointerDown={(event) => {
          if (!modalitaSelezione || entity.locked || !entity.selectable ||
              layerEntity?.locked || layerEntity?.selectable === false) return
          event.preventDefault()
          event.stopPropagation()
          setCadEntitySelezionataId(entity.id)
          setCadEntitySelezionateIds([entity.id])
          const layer = layers.find(item => item.id === entity.layerId)
          if (event.button !== 0 || !cadEntitySelezionateIds.includes(entity.id) ||
              workspaceTestoDraft || workspaceTestoResizeRef.current || workspaceTestoMoveRef.current ||
              !entity.visible || !layer || !layer.visible || layer.locked || layer.selectable === false) return
          const svg = event.currentTarget.ownerSVGElement
          if (!svg) return
          const rect = svg.getBoundingClientRect()
          workspaceTestoMoveRef.current = {
            entityId: entity.id, pointerId: event.pointerId, target: event.currentTarget,
            previous: {
              x: (event.clientX - rect.left) / rect.width * dimensioniWorkspace.width,
              y: (event.clientY - rect.top) / rect.height * dimensioniWorkspace.height,
            },
            snapshot: creaSnapshotQuaderno(),
            changed: false,
          }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
      />
      </g>
    )
  }
  if (entity.type === "line") {
  const lineaSelezionata =
    cadEntitySelezionateIds.includes(
      entity.id,
    )

  return (
    <g key={entity.id}>
      <line
        x1={entity.start.x}
        y1={entity.start.y}
        x2={entity.end.x}
        y2={entity.end.y}
        stroke="transparent"
        strokeWidth={12}
       pointerEvents={
  modalitaSelezione
    ? "stroke"
    : "none"
}
onPointerDown={(event) => {
  if (!modalitaSelezione) {
    return
  }

  if (
    layerEntity?.locked ||
    layerEntity?.selectable === false
  ) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  if (spostaEntitaAttivo) {
    const svg =
      event.currentTarget.ownerSVGElement

    if (!svg) {
      return
    }

    const rect =
      svg.getBoundingClientRect()

    const puntoWorkspace: CadPoint = {
      x:
        ((event.clientX - rect.left) /
          rect.width) *
        dimensioniWorkspace.width,

      y:
        ((event.clientY - rect.top) /
          rect.height) *
        dimensioniWorkspace.height,
    }

    spostaEntitaRef.current = {
      attivo: true,
      start: puntoWorkspace,
    }

    if (
      !cadEntitySelezionateIds.includes(
        entity.id,
      )
    ) {
      setCadEntitySelezionataId(
        entity.id,
      )

      setCadEntitySelezionateIds([
        entity.id,
      ])
    }

    event.currentTarget.setPointerCapture(
      event.pointerId,
    )

    return
  }

 const selezioneMultipla =
  event.ctrlKey || event.metaKey

if (selezioneMultipla) {
  setCadEntitySelezionateIds(
    (idsCorrenti) => {
      if (
        idsCorrenti.includes(entity.id)
      ) {
        const nuoviIds =
          idsCorrenti.filter(
            (id) => id !== entity.id,
          )

        setCadEntitySelezionataId(
          nuoviIds.length > 0
            ? nuoviIds[
                nuoviIds.length - 1
              ]
            : null,
        )

        return nuoviIds
      }

      setCadEntitySelezionataId(
        entity.id,
      )

      return [
        ...idsCorrenti,
        entity.id,
      ]
    },
  )
} else {
  setCadEntitySelezionataId(
    entity.id,
  )

  setCadEntitySelezionateIds([
    entity.id,
  ])
}

setOggettoGraficoSelezionatoId(null)
setSfondoSelezionato(false)
setPinSelezionatoId(null)
}}


onPointerMove={(event) => {
  if (
    !spostaEntitaAttivo ||
    !spostaEntitaRef.current.attivo ||
    !spostaEntitaRef.current.start
  ) {
    return
  }

  const svg =
    event.currentTarget.ownerSVGElement

  if (!svg) {
    return
  }

  const rect =
    svg.getBoundingClientRect()

  const puntoWorkspace: CadPoint = {
    x:
      ((event.clientX - rect.left) /
        rect.width) *
      dimensioniWorkspace.width,

    y:
      ((event.clientY - rect.top) /
        rect.height) *
      dimensioniWorkspace.height,
  }

  const start =
    spostaEntitaRef.current.start

  const dx =
    puntoWorkspace.x - start.x

  const dy =
    puntoWorkspace.y - start.y

  const idsDaSpostare =
    cadEntitySelezionateIds.includes(
      entity.id,
    )
      ? cadEntitySelezionateIds
      : [entity.id]

  const risultato =
    moveEntities(
      workspaceCadEntities,
      idsDaSpostare,
      dx,
      dy,
    )

  if (!risultato.changed) {
    return
  }

  setWorkspaceCadEntities(
    risultato.entities,
  )

  spostaEntitaRef.current = {
    attivo: true,
    start: puntoWorkspace,
  }

  setQuadernoDirty(true)
}}

onPointerUp={(event) => {
  if (!spostaEntitaRef.current.attivo) {
    return
  }

  spostaEntitaRef.current = {
    attivo: false,
    start: null,
  }

  if (
    event.currentTarget.hasPointerCapture(
      event.pointerId,
    )
  ) {
    event.currentTarget.releasePointerCapture(
      event.pointerId,
    )
  }
}}

onPointerCancel={(event) => {
  spostaEntitaRef.current = {
    attivo: false,
    start: null,
  }

  if (
    event.currentTarget.hasPointerCapture(
      event.pointerId,
    )
  ) {
    event.currentTarget.releasePointerCapture(
      event.pointerId,
    )
  }
}}
/>

      <line
        x1={entity.start.x}
        y1={entity.start.y}
        x2={entity.end.x}
        y2={entity.end.y}
        stroke={entity.stroke.color}
        strokeWidth={entity.stroke.width}
        markerEnd={entity.metadata?.legacyStrumento === "freccia" ? `url(#${workspaceFrecciaMarkerId})` : undefined}
        fill="none"
        pointerEvents="none"
      />

      {lineaSelezionata && (
        <>
          <line
            x1={entity.start.x}
            y1={entity.start.y}
            x2={entity.end.x}
            y2={entity.end.y}
            stroke="#2563eb"
            strokeWidth={2}
            strokeDasharray="6 4"
            pointerEvents="none"
          />

          <circle
            cx={entity.start.x}
            cy={entity.start.y}
            r={5}
            fill="#ffffff"
            stroke="#2563eb"
            strokeWidth={2}
            pointerEvents="none"
          />

          <circle
            cx={entity.end.x}
            cy={entity.end.y}
            r={5}
            fill="#ffffff"
            stroke="#2563eb"
            strokeWidth={2}
            pointerEvents="none"
          />
        </>
      )}
    </g>
  )
}

if (entity.type === "freehand") {
  const puntiPolyline =
    entity.points
      .map(
        (point) =>
          `${point.x},${point.y}`,
      )
      .join(" ")

  return (
    <polyline
  key={entity.id}
  points={puntiPolyline}
  fill="none"
  stroke={entity.stroke.color}
  strokeWidth={entity.stroke.width}
  strokeLinecap="round"
  strokeLinejoin="round"
  opacity={entity.stroke.opacity ?? 1}
  pointerEvents="none"
/>
  )
}

if (entity.type === "dimension") {
  const quotaSelezionata =
    cadEntitySelezionateIds.includes(
      entity.id,
    )

  const dxQuota =
    entity.end.x - entity.start.x

  const dyQuota =
    entity.end.y - entity.start.y

  const lunghezzaQuota =
    Math.hypot(dxQuota, dyQuota)

  const normaleX =
    lunghezzaQuota > 0
      ? -dyQuota / lunghezzaQuota
      : 0

  const normaleY =
    lunghezzaQuota > 0
      ? dxQuota / lunghezzaQuota
      : 0

  const startQuota = {
    x:
      entity.start.x +
      normaleX * entity.offset,
    y:
      entity.start.y +
      normaleY * entity.offset,
  }

  const endQuota = {
    x:
      entity.end.x +
      normaleX * entity.offset,
    y:
      entity.end.y +
      normaleY * entity.offset,
  }

  const testoQuota =
    typeof entity.measuredValue === "number"
      ? `${entity.measuredValue.toFixed(2)} ${
          entity.unit ?? "m"
        }`
      : entity.metadata?.title ?? ""

  return (
    <g key={entity.id}>
      <line
        x1={startQuota.x}
        y1={startQuota.y}
        x2={endQuota.x}
        y2={endQuota.y}
        stroke="transparent"
        strokeWidth={12}
        pointerEvents={
          metroAttivo || modalitaSelezione
            ? "stroke"
            : "none"
        }
   onPointerDown={(event) => {
  if (metroAttivo) {
    event.preventDefault()
    event.stopPropagation()

    setCadEntitySelezionataId(
      entity.id,
    )

    setCadEntitySelezionateIds([
      entity.id,
    ])

    setOggettoGraficoSelezionatoId(null)
    setSfondoSelezionato(false)
    setPinSelezionatoId(null)

    if (
      quotaWorkspaceInPosizionamentoId ===
      entity.id
    ) {
      setQuotaWorkspaceInPosizionamentoId(null)
      setQuadernoDirty(true)

      return
    }

    setQuotaWorkspaceInPosizionamentoId(
      entity.id,
    )

    return
  }
          if (!modalitaSelezione) {
            return
          }

          if (
            layerEntity?.locked ||
            layerEntity?.selectable === false
          ) {
            return
          }

          event.preventDefault()
          event.stopPropagation()

          setCadEntitySelezionataId(
            entity.id,
          )

          setCadEntitySelezionateIds([
            entity.id,
          ])

          setOggettoGraficoSelezionatoId(null)
          setSfondoSelezionato(false)
          setPinSelezionatoId(null)
        }}
      />

      <line
        x1={entity.start.x}
        y1={entity.start.y}
        x2={startQuota.x}
        y2={startQuota.y}
        stroke={entity.stroke.color}
        strokeWidth={entity.stroke.width}
        pointerEvents="none"
      />

      <line
        x1={entity.end.x}
        y1={entity.end.y}
        x2={endQuota.x}
        y2={endQuota.y}
        stroke={entity.stroke.color}
        strokeWidth={entity.stroke.width}
        pointerEvents="none"
      />

      <line
        x1={startQuota.x}
        y1={startQuota.y}
        x2={endQuota.x}
        y2={endQuota.y}
        stroke={entity.stroke.color}
        strokeWidth={entity.stroke.width}
        strokeDasharray={
          entity.stroke.dashArray?.join(" ")
        }
        pointerEvents="none"
      />

      <circle
        cx={entity.start.x}
        cy={entity.start.y}
        r={5}
        fill="#ffffff"
        stroke={entity.stroke.color}
        strokeWidth={2}
        pointerEvents="none"
      />

      <circle
        cx={entity.end.x}
        cy={entity.end.y}
        r={7}
        fill="#ffffff"
        stroke={entity.stroke.color}
        strokeWidth={2}
        pointerEvents={
          metroAttivo
            ? "all"
            : "none"
        }
        onPointerDown={(event) => {
          if (!metroAttivo) {
            return
          }

          event.preventDefault()
          event.stopPropagation()

          puntoInizioMetroWorkspaceRef.current = {
            x: entity.end.x,
            y: entity.end.y,
          }

          setWorkspaceMetroPreview(null)

          setCadEntitySelezionataId(null)
          setCadEntitySelezionateIds([])
        }}
      />

      <text
        x={
          (startQuota.x + endQuota.x) / 2
        }
        y={
          (startQuota.y + endQuota.y) /
            2 -
          10
        }
        textAnchor="middle"
        fontSize={16}
        fontWeight={700}
        fill={entity.stroke.color}
        pointerEvents="none"
      >
        {testoQuota}
      </text>

      {quotaSelezionata && (
        <line
          x1={startQuota.x}
          y1={startQuota.y}
          x2={endQuota.x}
          y2={endQuota.y}
          stroke="#2563eb"
          strokeWidth={2}
          strokeDasharray="6 4"
          pointerEvents="none"
        />
      )}
    </g>
  )
}
  if (entity.type === "rectangle") {
  const rettangoloSelezionato =
    cadEntitySelezionateIds.includes(
      entity.id,
    )

  return (
    <g key={entity.id}>
      <rect
        x={entity.transform.x}
        y={entity.transform.y}
        width={entity.transform.width}
        height={entity.transform.height}
        stroke="transparent"
        strokeWidth={12}
        fill="transparent"
        pointerEvents={
          modalitaSelezione
            ? "all"
            : "none"
        }
      />

      <rect
        x={entity.transform.x}
        y={entity.transform.y}
        width={entity.transform.width}
        height={entity.transform.height}
        stroke={entity.stroke.color}
        strokeWidth={entity.stroke.width}
        fill="none"
        pointerEvents="none"
      />

      {rettangoloSelezionato && (
        <rect
          x={entity.transform.x}
          y={entity.transform.y}
          width={entity.transform.width}
          height={entity.transform.height}
          fill="none"
          stroke="#2563eb"
          strokeWidth={2}
          strokeDasharray="6 4"
          pointerEvents="none"
        />
      )}
    </g>
  )
}

  if (entity.type === "area") {
  return (
    <g key={entity.id}>

      <polygon
  points={entity.points
    .map(
      (point) =>
        `${point.x},${point.y}`,
    )
    .join(" ")}
  stroke="transparent"
  strokeWidth={12}
  fill="transparent"
  pointerEvents={
    modalitaSelezione
      ? "all"
      : "none"
  }

  onPointerDown={(event) => {
    if (!modalitaSelezione) {
      return
    }

    if (
      layerEntity?.locked ||
      layerEntity?.selectable === false
    ) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    if (spostaEntitaAttivo) {
      const svg =
        event.currentTarget.ownerSVGElement

      if (!svg) {
        return
      }

      const rect =
        svg.getBoundingClientRect()

      const puntoWorkspace: CadPoint = {
        x:
          ((event.clientX - rect.left) /
            rect.width) *
          dimensioniWorkspace.width,

        y:
          ((event.clientY - rect.top) /
            rect.height) *
          dimensioniWorkspace.height,
      }

      spostaEntitaRef.current = {
        attivo: true,
        start: puntoWorkspace,
      }

      if (
        !cadEntitySelezionateIds.includes(
          entity.id,
        )
      ) {
        setCadEntitySelezionataId(
          entity.id,
        )

        setCadEntitySelezionateIds([
          entity.id,
        ])
      }

      event.currentTarget.setPointerCapture(
        event.pointerId,
      )

      return
    }

    setCadEntitySelezionataId(
      entity.id,
    )

    setCadEntitySelezionateIds([
      entity.id,
    ])

    setOggettoGraficoSelezionatoId(null)
    setSfondoSelezionato(false)
    setPinSelezionatoId(null)
  }}

  onPointerMove={(event) => {
    if (
      !spostaEntitaAttivo ||
      !spostaEntitaRef.current.attivo ||
      !spostaEntitaRef.current.start
    ) {
      return
    }

    const svg =
      event.currentTarget.ownerSVGElement

    if (!svg) {
      return
    }

    const rect =
      svg.getBoundingClientRect()

    const puntoWorkspace: CadPoint = {
      x:
        ((event.clientX - rect.left) /
          rect.width) *
        dimensioniWorkspace.width,

      y:
        ((event.clientY - rect.top) /
          rect.height) *
        dimensioniWorkspace.height,
    }

    const start =
      spostaEntitaRef.current.start

    const dx =
      puntoWorkspace.x - start.x

    const dy =
      puntoWorkspace.y - start.y

    const idsDaSpostare =
      cadEntitySelezionateIds.includes(
        entity.id,
      )
        ? cadEntitySelezionateIds
        : [entity.id]

    const risultato =
      moveEntities(
        workspaceCadEntities,
        idsDaSpostare,
        dx,
        dy,
      )

    if (!risultato.changed) {
      return
    }

    setWorkspaceCadEntities(
      risultato.entities,
    )

    spostaEntitaRef.current = {
      attivo: true,
      start: puntoWorkspace,
    }

    setQuadernoDirty(true)
  }}

  onPointerUp={(event) => {
    if (!spostaEntitaRef.current.attivo) {
      return
    }

    spostaEntitaRef.current = {
      attivo: false,
      start: null,
    }

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      )
    }
  }}

  onPointerCancel={(event) => {
    spostaEntitaRef.current = {
      attivo: false,
      start: null,
    }

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      )
    }
  }}
/>

      <polygon
        points={entity.points
          .map(
            (point) =>
              `${point.x},${point.y}`,
          )
          .join(" ")}
        stroke={entity.stroke.color}
        strokeWidth={entity.stroke.width}
        fill={
          entity.fill?.color ??
          "transparent"
        }
        fillOpacity={
          entity.fill?.opacity ?? 0
        }
        pointerEvents="none"
      />

{cadEntitySelezionateIds.includes(
  entity.id,
) && (
  <>
    <polygon
      points={entity.points
        .map(
          (point) =>
            `${point.x},${point.y}`,
        )
        .join(" ")}
      fill="none"
      stroke="#2563eb"
      strokeWidth={2}
      strokeDasharray="6 4"
      pointerEvents="none"
    />

    {entity.points.map(
      (point, index) => (
        <circle
          key={`${entity.id}-grip-${index}`}
          cx={point.x}
          cy={point.y}
          r={5}
          fill="#ffffff"
          stroke="#2563eb"
          strokeWidth={2}
          pointerEvents="none"
        />
      ),
    )}
  </>
)}
    </g>
  )
}

return null
})}
{workspaceTestoDraft && workspaceTestoLayout && (workspaceTestoDraft.entityId || strumentoDisegno === "testo") && (
  <foreignObject
    ref={workspaceTestoEditorRef}
    x={workspaceTestoLayout.boxX}
    y={workspaceTestoLayout.bounds.minY}
    width={workspaceTestoLayout.boxWidth}
    height={Math.max(36, workspaceTestoLayout.lines.length * workspaceTestoLayout.lineHeight)}
    transform={`rotate(${workspaceTestoStile?.rotation ?? 0} ${workspaceTestoDraft.position.x} ${workspaceTestoDraft.position.y})`}
    style={{ overflow: "visible", pointerEvents: "auto" }}
    onPointerDown={(event) => event.stopPropagation()}
    onPointerMove={(event) => event.stopPropagation()}
    onPointerUp={(event) => event.stopPropagation()}
    onPointerCancel={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
    onDoubleClick={(event) => event.stopPropagation()}
  >
    <textarea
      ref={workspaceTestoInputRef}
      autoFocus
      rows={workspaceTestoLayout.lines.length}
      aria-label="Testo Workspace"
      placeholder="Ctrl+Enter conferma, Esc annulla"
      value={workspaceTestoDraft.content}
      onChange={(event) => {
        const content = event.target.value
        setWorkspaceTestoDraft((draft) => draft ? { ...draft, content } : null)
      }}
      onCompositionStart={() => { workspaceTestoCompositionRef.current = true }}
      onCompositionEnd={() => { workspaceTestoCompositionRef.current = false }}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.nativeEvent.isComposing || workspaceTestoCompositionRef.current ||
            event.nativeEvent.keyCode === 229) return
        if (event.key === "Enter" && event.ctrlKey) {
          event.preventDefault()
          if (!event.repeat) confermaTestoWorkspace()
        } else if (event.key === "Escape") {
          event.preventDefault()
          setWorkspaceTestoDraft(null)
        }
      }}
      style={{
        boxSizing: "border-box", width: "100%", height: "100%", padding: 0,
        resize: "none", whiteSpace: "pre-wrap", overflowWrap: "anywhere",
        fontSize: workspaceTestoStile?.fontSize ?? dimensioneTesto,
        fontFamily: workspaceTestoStile?.fontFamily ?? "serif",
        fontWeight: workspaceTestoStile?.fontWeight,
        textAlign: workspaceTestoStile?.alignment ?? "left",
        lineHeight: `${workspaceTestoLayout.lineHeight}px`,
        color: workspaceTestoStile?.color ?? coloreDisegno,
        background: "#ffffff", border: 0, outline: "1px solid #2563eb", borderRadius: 4,
      }}
    />
  </foreignObject>
)}
</svg>

{pagineQuaderno
  .slice(0, paginaCorrenteIndex)
  .map((pagina, index) => {
    const layout =
      pagina.pageLayout ??
      createQuadernoPageLayout()

    return (
     <div
  key={pagina.id}
  data-quaderno-page-id={pagina.id}

 onClick={(event) => {
  if (
    spostaTavolaAttivo &&

    pagineWorkspaceSelezionateIds.includes(
      pagina.id,
    ) &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  ) {
    return
  }
    if (
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    setPagineWorkspaceSelezionateIds(
      (correnti) => {
                return correnti.includes(pagina.id)
          ? correnti.filter(
              (id) => id !== pagina.id,
            )
          : [...correnti, pagina.id]
      },
    )

    return
  }

  setPagineWorkspaceSelezionateIds((correnti) => {
    return spostaTavolaAttivo &&
  correnti.includes(pagina.id)
    ? correnti
    : [pagina.id]
})

    vaiAllaPagina(index)
}}

onPointerDown={(event) => {
  if (!spostaTavolaAttivo) {
    return
  }

  iniziaTrascinamentoPagina(
    event,
    pagina,
  )
}}

  onPointerMove={(event) => {
  if (
    selezioneWorkspaceRef.current.attiva &&
    selezioneWorkspaceRef.current.start &&
    modalitaSelezione &&
    !manoAttiva &&
    !spostaTavolaAttivo
  ) {
    const rect =
      event.currentTarget.getBoundingClientRect()

    const puntoWorkspace: CadPoint = {
      x:
        (pagina.workspaceX ?? 0) +
        ((event.clientX - rect.left) /
          rect.width) *
          layout.width,

      y:
        (pagina.workspaceY ?? 0) +
        ((event.clientY - rect.top) /
          rect.height) *
          layout.height,
    }

    const start =
      selezioneWorkspaceRef.current.start

    setRettangoloSelezione({
      startX: start.x,
      startY: start.y,
      endX: puntoWorkspace.x,
      endY: puntoWorkspace.y,
    })

    return
  }

  trascinaPagina(event)
}}
  onPointerUp={terminaTrascinamentoPagina}
  onPointerCancel={terminaTrascinamentoPagina}
  title={`Apri ${pagina.titolo}`}
  style={{
    position: "absolute",
    left: pagina.workspaceX ?? 0,
    top: pagina.workspaceY ?? 0,
    width: layout.width,
    height: layout.height,
    background: "#ffffff",
    border:
  pagineWorkspaceSelezionateIds.includes(
    pagina.id,
  )
    ? "3px solid #2563eb"
    : "1px solid #94a3b8",

    boxShadow:
      "0 10px 30px rgba(15,23,42,0.16)",
    flexShrink: 0,
    cursor: "move",
  }}
>
  <NotaDisegno
    solaLettura
          larghezza={layout.width}
          altezza={layout.height}

          segni={pagina.disegni ?? []}
          onChange={() => {}}

          strumento={false}
          colore="#111827"
          spessore={1}

          sfondo={
            pagina.sfondoDisegno ?? null
          }

          zoomSfondo={
            pagina.zoomSfondo ?? 1
          }

          backgroundTransform={
            pagina.backgroundTransform
          }

          oggettiGrafici={
            pagina.oggettiGrafici ?? []
          }

          layers={
            pagina.layers ??
            DEFAULT_QUADERNO_LAYERS
          }

          scaleCalibration={
            pagina.scaleCalibration ?? null
          }

          cadDimensions={
            pagina.cadDimensions ?? []
          }

          cadEntities={
            pagina.cadEntities ?? []
          }

          modalitaSelezione={false}
          snapAttivo={false}
          gridSnapAttivo={false}
          orthoAttivo={false}
          polarTrackingAttivo={false}
          perpTrackingAttivo={false}
          metroAttivo={false}
          areaAttiva={false}
          areaSplitAttivo={false}
          calibrazioneScalaAttiva={false}
        />

        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            padding: "3px 7px",
            background: "rgba(255,255,255,0.9)",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {pagina.titolo}
        </div>
      </div>
    )
  })}

             <div
onPointerDown={(event) => {
 if (
  modalitaSelezione &&
  strumentoDisegno !== "penna" &&
  strumentoDisegno !== "evidenziatore" &&
  !manoAttiva &&
  !spostaTavolaAttivo &&
  paginaAttiva
) {

    const rect =
      event.currentTarget.getBoundingClientRect()

    const puntoWorkspace: CadPoint = {
      x:
        (paginaAttiva.workspaceX ?? 0) +
        ((event.clientX - rect.left) /
          rect.width) *
          pageLayout.width,

      y:
        (paginaAttiva.workspaceY ?? 0) +
        ((event.clientY - rect.top) /
          rect.height) *
          pageLayout.height,
    }

    spostaEntitaRef.current = {
      attivo: false,
      start: null,
    }

event.preventDefault()

    selezioneWorkspaceRef.current = {
      attiva: true,
      start: puntoWorkspace,
      ctrlKey:
        event.ctrlKey || event.metaKey,
    }

    setRettangoloSelezione({
      startX: puntoWorkspace.x,
      startY: puntoWorkspace.y,
      endX: puntoWorkspace.x,
      endY: puntoWorkspace.y,
    })

    if (
      !event.ctrlKey &&
      !event.metaKey
    ) {
      setCadEntitySelezionataId(null)
      setCadEntitySelezionateIds([])
    }

    setOggettoGraficoSelezionatoId(null)
    setPinSelezionatoId(null)
    setSfondoSelezionato(false)

    return
  }

  if (
    spostaTavolaAttivo &&
    paginaAttiva
  ) {
    iniziaTrascinamentoPagina(
      event,
      paginaAttiva,
    )
  }
}}
  onPointerMove={(event) => {
  if (
    selezioneWorkspaceRef.current.attiva &&
    selezioneWorkspaceRef.current.start &&
    modalitaSelezione &&
    !manoAttiva &&
    !spostaTavolaAttivo
  ) {
    const rect =
      event.currentTarget.getBoundingClientRect()

  if (!paginaAttiva) {
  return
}

const puntoWorkspace: CadPoint = {
  x:
    (paginaAttiva.workspaceX ?? 0) +
    ((event.clientX - rect.left) /
      rect.width) *
      pageLayout.width,

  y:
    (paginaAttiva.workspaceY ?? 0) +
    ((event.clientY - rect.top) /
      rect.height) *
      pageLayout.height,
}

    const start =
      selezioneWorkspaceRef.current.start

    setRettangoloSelezione({
      startX: start.x,
      startY: start.y,
      endX: puntoWorkspace.x,
      endY: puntoWorkspace.y,
    })

    return
  }

trascinaPagina(event)
}}
onPointerUp={terminaTrascinamentoPagina}
onPointerCancel={terminaTrascinamentoPagina}
data-quaderno-page-id={paginaAttiva?.id}
style={{
    position: "absolute",
    left: paginaAttiva?.workspaceX ?? 0,
    top: paginaAttiva?.workspaceY ?? 0,
    width: pageLayout.width,
    height: pageLayout.height,
    background: "#ffffff",
    border: "1px solid #d1d5db",
    boxShadow: "0 10px 30px rgba(15,23,42,0.25)",
    overflow: "hidden",
    flexShrink: 0,
    cursor:
      spostaTavolaAttivo
        ? "move"
        : "default",
  }}
>


             <NotaDisegno
  svgRefEsterno={quadernoSvgRef}
selezioneRettangolareEsterna
solaLettura={
  spostaTavolaAttivo ||
  manoAttiva ||
  strumentoDisegno === "penna" ||
  strumentoDisegno === "evidenziatore" ||
  strumentoDisegno === "testo"
}
  larghezza={pageLayout.width}
  altezza={pageLayout.height}
  orthoAttivo={orthoAttivo}
  snapAttivo={snapAttivo}
modalitaSelezione={modalitaSelezione}
trimAttivo={trimAttivo}
  gridSnapAttivo={gridSnapAttivo}
  gridSize={gridSize}
  polarTrackingAttivo={polarTrackingAttivo}
perpTrackingAttivo={perpTrackingAttivo}
polarIncrement={polarIncrement}
polarTolerance={polarTolerance}
scaleCalibration={scaleCalibration}
calibrazioneScalaAttiva={calibrazioneScalaAttiva}
resolveSnapCalibrazione={(puntoPagina) => {
  if (!snapAttivo) return null

  const screenWidth =
    workspaceSvgRef.current?.getBoundingClientRect().width ?? 0
  const snap = resolveSnapPoint({
    entities: workspaceSnapEntities,
    cursor: puntoPaginaAttivaToWorkspace(puntoPagina),
    tolerance: getSnapTolerance(dimensioniWorkspace.width, screenWidth),
  })

  return snap
    ? { ...snap, ...puntoWorkspaceToPaginaAttiva(snap) }
    : null
}}
onScaleCalibrationChange={setScaleCalibration}
metroAttivo={metroAttivo}
areaAttiva={areaAttiva}
areaSplitAttivo={areaSplitAttivo}
onFineArea={() => {
  setAreaAttiva(false)
  setModalitaSelezione(true)
}}
cadDimensions={
  pagineQuaderno[paginaCorrenteIndex]?.cadDimensions ?? []
}

cadEntities={
  pagineQuaderno[paginaCorrenteIndex]?.cadEntities ?? []
}

onCreateWorkspaceLine={(
  start,
  end,
  color,
  width,
  layerId,
) => {
 
  const startWorkspace =
    puntoPaginaAttivaToWorkspace(start)

  const endWorkspace =
    puntoPaginaAttivaToWorkspace(end)

  const nuovaLineaWorkspace =
    createCadLine({
      start: startWorkspace,
      end: endWorkspace,
      stroke: {
        color,
        width,
      },
      layerId,
    })

nuovaLineaWorkspace.metadata = {
  ...nuovaLineaWorkspace.metadata,
  workspacePageId:
    pagineQuaderno[paginaCorrenteIndex]?.id,
}

  setWorkspaceCadEntities(
    (entitiesCorrenti) => [
      ...entitiesCorrenti,
      nuovaLineaWorkspace,
    ],
  )

 
}}
onCreateCadEntity={(entity) => {
  setPagineQuaderno((pagineCorrenti) =>
    pagineCorrenti.map((pagina, index) =>
      index === paginaCorrenteIndex
        ? {
            ...pagina,
            disegni,
            sfondoDisegno,
            zoomSfondo,
            oggettiGrafici,
            layers,
            scaleCalibration,
            cadEntities: [
              ...(pagina.cadEntities ?? []),
              entity,
            ],
          }
        : pagina,
    ),
  )
}}

onUpdateCadEntity={(entityAggiornata) => {
  

  setPagineQuaderno((pagineCorrenti) =>
    pagineCorrenti.map((pagina, index) =>
      index === paginaCorrenteIndex
        ? {
            ...pagina,
            cadEntities: (
              pagina.cadEntities ?? []
            ).map((entity) => {
              console.log(
                "AREA CONFRONTO ID",
                entity.id,
                entityAggiornata.id,
              )

              return entity.id === entityAggiornata.id
                ? entityAggiornata
                : entity
            }),
          }
        : pagina,
    ),
  )
}}

onReplaceCadEntity={(entityId, replacements) => {
  setPagineQuaderno((pagineCorrenti) =>
    pagineCorrenti.map((pagina, index) =>
      index === paginaCorrenteIndex
        ? {
            ...pagina,
            cadEntities: [
              ...(pagina.cadEntities ?? []).filter(
                (entity) =>
                  entity.id !== entityId,
              ),
              ...replacements,
            ],
          }
        : pagina,
    ),
  )
}}

onDeleteCadEntity={(entityId) => {
  setPagineQuaderno((pagineCorrenti) =>
    pagineCorrenti.map((pagina, index) =>
      index === paginaCorrenteIndex
        ? {
            ...pagina,
            cadEntities: (
              pagina.cadEntities ?? []
            ).filter(
              (entity) =>
                entity.id !== entityId,
            ),
          }
        : pagina,
    ),
  )
}}

onCreateDimension={(dimension) => {
  setPagineQuaderno((pagineCorrenti) =>
    pagineCorrenti.map((pagina, index) =>
      index === paginaCorrenteIndex
        ? {
            ...pagina,
            disegni,
            sfondoDisegno,
            zoomSfondo,
            oggettiGrafici,
            layers,
            scaleCalibration,
           cadDimensions: [
  ...(pagina.cadDimensions ?? []),
  dimension,
],

cadEntities: [
  ...(pagina.cadEntities ?? []),
  dimension,
],

          }
        : pagina,
    ),
  );
}}
onUpdateDimension={(dimensionAggiornata) => {
  setPagineQuaderno((pagineCorrenti) =>
    pagineCorrenti.map((pagina, index) =>
      index === paginaCorrenteIndex
        ? {
            ...pagina,

            cadDimensions: (
              pagina.cadDimensions ?? []
            ).map((dimension) =>
              dimension.id ===
              dimensionAggiornata.id
                ? dimensionAggiornata
                : dimension,
            ),

            cadEntities: (
              pagina.cadEntities ?? []
            ).map((entity) =>
              entity.id ===
              dimensionAggiornata.id
                ? dimensionAggiornata
                : entity,
            ),
          }
        : pagina,
    ),
  )
}}
onDeleteDimension={(dimensionId) => {
  setPagineQuaderno((pagineCorrenti) =>
    pagineCorrenti.map((pagina, index) =>
      index === paginaCorrenteIndex
        ? {
            ...pagina,

            cadDimensions: (
              pagina.cadDimensions ?? []
            ).filter(
              (dimension) =>
                dimension.id !== dimensionId,
            ),

            cadEntities: (
              pagina.cadEntities ?? []
            ).filter(
              (entity) =>
                entity.id !== dimensionId,
            ),
          }
        : pagina,
    ),
  )
}}
onFineCalibrazioneScala={() =>
  setCalibrazioneScalaAttiva(false)
}

                  oggettiGrafici={oggettiGrafici}
                  oggettoGraficoSelezionatoId={oggettoGraficoSelezionatoId}
                onSelezionaOggettoGrafico={(id) => {
  setManoAttiva(false);
  setPanInCorso(false);

  setOggettoGraficoSelezionatoId(id);

  setCadEntitySelezionataId(null);
  setCadEntitySelezionateIds([]);

  setSfondoSelezionato(false);
  setPinSelezionatoId(null);
}}
                  onDeselezionaOggettoGrafico={() => {
                    setOggettoGraficoSelezionatoId(null);
                  }}
onInizioTrasformazioneOggetto={() => {
  registraSnapshotQuaderno();
  setTrasformazioneOggettoAttiva(true);
}}
onFineTrasformazioneOggetto={() => {
  setTrasformazioneOggettoAttiva(false)

  const oggettiLive =
    oggettiGraficiLiveRef.current

  const immagineSelezionata =
    oggettiLive.find(
      (oggetto) =>
        oggetto.id ===
        oggettoGraficoSelezionatoId,
    )

  if (
    immagineSelezionata &&
    paginaQuadernoCorrente
  ) {
    const centroPagina: CadPoint = {
      x:
        immagineSelezionata.transform.x +
        immagineSelezionata.transform.width / 2,

      y:
        immagineSelezionata.transform.y +
        immagineSelezionata.transform.height / 2,
    }

    const centroWorkspace =
      pagePointToWorkspacePoint(
        centroPagina,
        paginaQuadernoCorrente,
      )

    const paginaDestinazione =
      trovaPaginaDaPuntoWorkspace(
        centroWorkspace,
      )

    if (
      paginaDestinazione &&
      paginaDestinazione.id !==
        paginaQuadernoCorrente.id
    ) {
      const altoSinistraWorkspace =
        pagePointToWorkspacePoint(
          {
            x:
              immagineSelezionata
                .transform.x,

            y:
              immagineSelezionata
                .transform.y,
          },
          paginaQuadernoCorrente,
        )

      const altoSinistraDestinazione =
        workspacePointToPagePoint(
          altoSinistraWorkspace,
          paginaDestinazione,
        )

      const immagineTrasferita = {
        ...immagineSelezionata,

        transform: {
          ...immagineSelezionata.transform,

          x:
            altoSinistraDestinazione.x,

          y:
            altoSinistraDestinazione.y,
        },
      }

      setPagineQuaderno(
        (pagineCorrenti) =>
          pagineCorrenti.map(
            (pagina) => {
              if (
                pagina.id ===
                paginaQuadernoCorrente.id
              ) {
                return {
                  ...pagina,

                  oggettiGrafici:
                    oggettiLive.filter(
                      (oggetto) =>
                        oggetto.id !==
                        immagineSelezionata.id,
                    ),
                }
              }

              if (
                pagina.id ===
                paginaDestinazione.id
              ) {
                return {
                  ...pagina,

                  oggettiGrafici: [
                    ...(
                      pagina
                        .oggettiGrafici ??
                      []
                    ),

                    immagineTrasferita,
                  ],
                }
              }

              return pagina
            },
          ),
      )

      const nuovoIndex =
  pagineQuaderno.findIndex(
    (pagina) =>
      pagina.id ===
      paginaDestinazione.id,
  )

const oggettiDestinazione = [
  ...(
    paginaDestinazione
      .oggettiGrafici ?? []
  ),
  immagineTrasferita,
]

if (nuovoIndex >= 0) {
  setPaginaCorrenteIndex(
    nuovoIndex,
  )

  setPageLayout(
    paginaDestinazione.pageLayout ??
      createQuadernoPageLayout(),
  )

  setDisegni(
    paginaDestinazione.disegni ?? [],
  )

  setSfondoDisegno(
    paginaDestinazione.sfondoDisegno ??
      null,
  )

  setZoomSfondo(
    paginaDestinazione.zoomSfondo ?? 1,
  )

  setLayers(
    paginaDestinazione.layers?.map(
      (layer) => ({
        ...layer,
      }),
    ) ??
      DEFAULT_QUADERNO_LAYERS.map(
        (layer) => ({
          ...layer,
        }),
      ),
  )

  setScaleCalibration(
    paginaDestinazione
      .scaleCalibration ?? null,
  )
}

setOggettiGrafici(
  oggettiDestinazione,
)

oggettiGraficiLiveRef.current =
  oggettiDestinazione

setOggettoGraficoSelezionatoId(
  immagineTrasferita.id,
)

setQuadernoDirty(true)

return
    }
  }

  aggiornaQuaderno(
    {
      disegni,
      sfondoDisegno,
      backgroundTransform,
      oggettiGrafici: oggettiLive,
      layers,
      zoomSfondo,
      sfondoX,
      sfondoY,
    },
    false,
  )
}}


                  onCambiaOggettoGraficoTransform={(id, nuovoTransform) => {
  const paginaCorrente =
    pagineQuaderno[paginaCorrenteIndex];

  if (!paginaCorrente) {
    return;
  }

  const paginaCadCorrente: PaginaQuadernoNota = {
    ...paginaCorrente,
    disegni,
    sfondoDisegno,
    zoomSfondo,
    oggettiGrafici:
  oggettiGraficiLiveRef.current,
    layers,
    backgroundTransform,
cadEntities: undefined,
  };

  const entities =
    getCadEntitiesFromPage(paginaCadCorrente);

  const result = transformEntity(
  entities,
  id,
  {
    x: nuovoTransform.x,
    y: nuovoTransform.y,
    width: nuovoTransform.width,
    height: nuovoTransform.height,
    rotation: nuovoTransform.rotation,
    scaleX: 1,
    scaleY: 1,
  },
);

  if (!result.changed) {
    return;
  }

  const paginaAggiornata =
    applyCadEntitiesToPage(
      paginaCadCorrente,
      result.entities,
    );

 aggiornaQuadernoLive({
  disegni: paginaAggiornata.disegni,
  oggettiGrafici:
    paginaAggiornata.oggettiGrafici ?? [],
});
}}
                  segni={disegni}
                  onChange={aggiornaDisegni}
                  strumento={
  manoAttiva ||
  strumentoDisegno === "testo" ||
  spostaTavolaAttivo
    ? false
    : strumentoDisegno
}
                  colore={coloreDisegno}
spessore={spessoreDisegno}
                  dimensioneTesto={dimensioneTesto}
                  sfondo={sfondoDisegno}
                  backgroundTransform={backgroundTransform}
                  zoomSfondo={zoomSfondo}
                  sfondoX={sfondoX}
                  sfondoY={sfondoY}
                  sfondoSelezionato={sfondoSelezionato}
                  onSelezionaSfondo={() => {
                    setSfondoSelezionato(true);
                    setPinSelezionatoId(null);
                  }}
                  onDeselezionaSfondo={() => {
                    setSfondoSelezionato(false);
                  }}
                  onSpostaSfondo={(x, y) => {
                    setSfondoX(x);
                    setSfondoY(y);

                    setBackgroundTransform((corrente) => ({
                      ...corrente,
                      x,
                      y,
                    }));
                  }}
                 onCambiaBackgroundTransform={setBackgroundTransform}
pinSelezionatoId={pinSelezionatoId}
layers={layers}
layerAttivoId={layerAttivoId}
onLayersChange={setLayers}
onSelezionaPin={setPinSelezionatoId}

onSelezionaCadEntity={(id) => {
  setCadEntitySelezionataId(id)

  if (id) {
    setCadEntitySelezionateIds([id])
    setOggettoGraficoSelezionatoId(null)
    setPinSelezionatoId(null)
    setSfondoSelezionato(false)
  }
}}
cadEntitySelezionateIds={cadEntitySelezionateIds}

onCambiaSelezioneCad={(ids) => {
  setCadEntitySelezionateIds(ids)

  setCadEntitySelezionataId(
    ids.length === 1 ? ids[0] : null,
  )

  if (ids.length > 0) {
    setOggettoGraficoSelezionatoId(null)
    setPinSelezionatoId(null)
    setSfondoSelezionato(false)
  }
}}

rettangoloSelezione={rettangoloSelezione}
onCambiaRettangoloSelezione={setRettangoloSelezione}
/>

</div>

{pagineQuaderno
  .slice(paginaCorrenteIndex + 1)
  .map((pagina, offset) => {
    const index =
      paginaCorrenteIndex + 1 + offset

    const layout =
      pagina.pageLayout ??
      createQuadernoPageLayout()

    return (
     <div
  key={pagina.id}
  data-quaderno-page-id={pagina.id}
onClick={(event) => {
  if (
    spostaTavolaAttivo &&
    pagineWorkspaceSelezionateIds.includes(
      pagina.id,
    ) &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  ) {
    return
  }
    if (
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    setPagineWorkspaceSelezionateIds(
      (correnti) => {
                return correnti.includes(pagina.id)
          ? correnti.filter(
              (id) => id !== pagina.id,
            )
          : [...correnti, pagina.id]
      },
    )

    return
  }

  setPagineWorkspaceSelezionateIds((correnti) => {
    return spostaTavolaAttivo &&
  correnti.includes(pagina.id)
    ? correnti
    : [pagina.id]
})

    vaiAllaPagina(index)
}}

title={`Apri ${pagina.titolo}`}
       style={{
  position: "absolute",
  left: pagina.workspaceX ?? 0,
  top: pagina.workspaceY ?? 0,
  width: layout.width,
  height: layout.height,
  background: "#ffffff",
  border:
  pagineWorkspaceSelezionateIds.includes(
    pagina.id,
  )
    ? "3px solid #2563eb"
    : "1px solid #94a3b8",

  boxShadow:
    "0 10px 30px rgba(15,23,42,0.16)",
  flexShrink: 0,
  cursor: "pointer",
}}
           >
        <NotaDisegno
          solaLettura
          larghezza={layout.width}
          altezza={layout.height}

          segni={pagina.disegni ?? []}
          onChange={() => {}}

          strumento={false}
          colore="#111827"
          spessore={1}

          sfondo={
            pagina.sfondoDisegno ?? null
          }

          zoomSfondo={
            pagina.zoomSfondo ?? 1
          }

          backgroundTransform={
            pagina.backgroundTransform
          }

          oggettiGrafici={
            pagina.oggettiGrafici ?? []
          }

          layers={
            pagina.layers ??
            DEFAULT_QUADERNO_LAYERS
          }

          scaleCalibration={
            pagina.scaleCalibration ?? null
          }

          cadDimensions={
            pagina.cadDimensions ?? []
          }

          cadEntities={
            pagina.cadEntities ?? []
          }

          modalitaSelezione={false}
          snapAttivo={false}
          gridSnapAttivo={false}
          orthoAttivo={false}
          polarTrackingAttivo={false}
          perpTrackingAttivo={false}
          metroAttivo={false}
          areaAttiva={false}
          areaSplitAttivo={false}
          calibrazioneScalaAttiva={false}
        />

        <div
          style={{
            position: "absolute",
            top: 8,
            padding: "3px 7px",
            background:
              "rgba(255,255,255,0.9)",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {pagina.titolo}
        </div>
      </div>
    )
  })}

</div>

</div>
</div>
<div
  style={{
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    zIndex: 10020,
    display: "flex",
    justifyContent: "flex-start",
    pointerEvents: "none",
  }}
>
  <CadStatusBar
    zoom={viewportScale}
    snapAttivo={snapAttivo}
    gridAttivo={gridSnapAttivo}
    orthoAttivo={orthoAttivo}
    polarAttivo={polarTrackingAttivo}
    layerAttivo={layerAttivoId}
    scala={
      scaleCalibration
        ? `${scaleCalibration.realDistance} ${scaleCalibration.unit}`
        : "non calibrata"
    }
  />
</div>


      </div>
    </div>
</div>

      )}
{notaVisibile && (
  <>
<textarea
            ref={testoNotaRef}
            value={testo}
            onChange={(event) => setTesto(event.target.value)}
            placeholder="Scrivi ciò che osservi: muro umido, distacco intonaco, misure…"
            style={{
              width: "100%",
              minHeight: 180,
              marginTop: 14,
              padding: 14,
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              resize: "none",
              overflow: "hidden",
              fontSize: 16,
              lineHeight: 1.6,
            }}
          />



        <div
  style={{
    width: "100%",
    flexBasis: "100%",
    flexShrink: 0,
    boxSizing: "border-box",
    marginTop: 16,
    padding: 14,
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    background: "#fff",
  }}
>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <strong style={{ fontSize: 17, color: "#0f172a" }}>
                Checklist
              </strong>
              <button
                type="button"
                onClick={aggiungiChecklist}
                style={{
                  ...buttonSecondary,
                  minHeight: 48,
                  padding: "10px 16px",
                  fontWeight: 800,
                }}
              >
                + Aggiungi controllo
              </button>
            </div>

            {checklist.length === 0 && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 10,
                  background: "#f8fafc",
                  color: "#64748b",
                  fontSize: 14,
                }}
              >
                Aggiungi un controllo e scrivi ciò che deve essere verificato.
              </div>
            )}

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {checklist.map((voce) => (
                <div
                  key={voce.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    minHeight: 62,
                    padding: 8,
                    border: voce.completata
                      ? "1px solid #86efac"
                      : "1px solid #cbd5e1",
                    borderRadius: 12,
                    background: voce.completata ? "#f0fdf4" : "#fff",
                    transition:
                      "background 160ms ease, border-color 160ms ease",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={voce.completata}
                    aria-label={
                      voce.completata
                        ? `Segna come da completare: ${voce.testo || "controllo"}`
                        : `Segna come completato: ${voce.testo || "controllo"}`
                    }
                    onChange={(event) =>
                      setChecklist((corrente) =>
                        corrente.map((item) =>
                          item.id === voce.id
                            ? { ...item, completata: event.target.checked }
                            : item,
                        ),
                      )
                    }
                    style={{
                      width: 28,
                      height: 28,
                      flex: "0 0 28px",
                      margin: 0,
                      accentColor: "#16a34a",
                      cursor: "pointer",
                    }}
                  />
                  <input
                    ref={(element) => {
                      if (element) {
                        inputChecklistRefs.current.set(voce.id, element);
                        if (checklistDaFocalizzareRef.current === voce.id) {
                          element.focus();
                        }
                      } else {
                        inputChecklistRefs.current.delete(voce.id);
                      }
                    }}
                    value={voce.testo}
                    onChange={(event) =>
                      setChecklist((corrente) =>
                        corrente.map((item) =>
                          item.id === voce.id
                            ? { ...item, testo: event.target.value }
                            : item,
                        ),
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        aggiungiChecklist();
                      }
                    }}
                    placeholder="Nuovo controllo..."
                    aria-label="Testo del controllo"
                    style={{
                      flex: "1 1 auto",
                      width: "100%",
                      minWidth: 0,
                      minHeight: 46,
                      padding: "10px 12px",
                      border: "1px solid #94a3b8",
                      borderRadius: 9,
                      background: "#fff",
                      color: voce.completata ? "#64748b" : "#0f172a",
                      fontSize: 16,
                      lineHeight: 1.35,
                      textDecoration: voce.completata ? "line-through" : "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setChecklist((corrente) =>
                        corrente.filter((item) => item.id !== voce.id),
                      )
                    }
                    style={{
                      ...buttonSecondary,
                      width: 48,
                      height: 48,
                      flex: "0 0 48px",
                      padding: 0,
                      borderColor: "#fecaca",
                      color: "#991b1b",
                      fontSize: 24,
                      fontWeight: 700,
                    }}
                    aria-label={`Elimina controllo: ${voce.testo || "senza testo"}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            
          </div>



         <div
  style={{
    display: "grid",
    gridTemplateColumns: "2fr auto 1fr",
    gap: 12,
    alignItems: "stretch",
    width: "100%",
    marginTop: 16,
  }}
>
              <label
                tabIndex={0}
                onDragEnter={gestisciTrascinamentoAllegati}
                onDragOver={gestisciTrascinamentoAllegati}
                onDragLeave={terminaTrascinamentoAllegati}
                onDrop={rilasciaAllegati}
                onPaste={incollaAllegati}
                style={{
 width: "100%",
  height: "100%",
                  minWidth: 280,
                  padding: "14px 18px",
                  border: trascinamentoAllegatiAttivo
                    ? "2px dashed #2563eb"
                    : "2px dashed #94a3b8",
                  borderRadius: 12,
                  background: trascinamentoAllegatiAttivo
                    ? "#eff6ff"
                    : "#f8fafc",
                  color: "#0f172a",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 150ms ease",

                }}
              >
                <div style={{ fontWeight: 800 }}>📎 Allegati</div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    color: "#64748b",
                  }}
                >
                  Clicca, incolla con Ctrl+V oppure trascina qui
                </div>

                <input
                  type="file"
                  multiple
                  onChange={(event) => void caricaFile(event, "allegato")}
                  style={{ display: "none" }}
                />
              </label>
              <button
                type="button"
                onClick={
                  registrazioneAttiva
                    ? fermaRegistrazione
                    : () => void avviaRegistrazione()
                }
                style={{
                  ...buttonSecondary,
height: "100%",
  minHeight: 92,
                  background: registrazioneAttiva
                    ? "#fee2e2"
                    : buttonSecondary.background,
                }}
              >
                {registrazioneAttiva
                  ? "■ Ferma registrazione"
                  : "🎤 Registra audio"}
              </button>
           
<div
              style={{
width: "100%",
height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                flex: "1 1 420px",
minWidth: 280,
                padding: 12,
                border: "1px solid #dbeafe",
                borderRadius: 10,
                background: "#eff6ff",
                color: "#1e3a8a",
              }}
            >
              <span>
                {fotoCollegate.length === 0
                  ? "Nessuna foto collegata al Quaderno"
                  : `${fotoCollegate.length} foto collegate dalla Galleria`}
              </span>
              {onApriGalleria && (
                <button
                  type="button"
                  onClick={onApriGalleria}
                  style={buttonSecondary}
                >
                  Apri Galleria
                </button>
              )}
            </div>
 </div>

{allegati.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: 10,
                  marginTop: 14,
                }}
              >
                {allegati.map((allegato) => (
                  <article
                    key={allegato.id}
                    style={{
                      padding: 10,
                      border: "1px solid #cbd5e1",
                      borderRadius: 10,
                      background: "#fff",
                    }}
                  >
                    {isAllegatoImmagine(allegato) && (
                      <a
                        href={allegato.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: "block" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={allegato.url}
                          alt={allegato.nome_file}
                          style={{
                            width: "100%",
                            height: 140,
                            objectFit: "cover",
                            borderRadius: 8,
                            display: "block",
                          }}
                        />
                      </a>
                    )}

                    {allegato.tipo === "audio" && (
                      <audio
                        controls
                        src={allegato.url}
                        style={{ width: "100%" }}
                      />
                    )}
                    <a
                      href={allegato.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "block", marginTop: 8 }}
                    >
                      {allegato.nome_file}
                    </a>
                    <button
                      type="button"
                      onClick={() => void eliminaAllegato(allegato)}
                      style={{ ...buttonSecondary, marginTop: 8 }}
                    >
                      Elimina
                    </button>
                  </article>
                ))}
              </div>
            )}

<aside
  style={{
    width: "100%",
    flexBasis: "100%",
    boxSizing: "border-box",
    marginTop: 14,
    padding: 16,
    border: "1px solid #c4b5fd",
    borderRadius: 14,
    background: "#faf5ff",
    color: "#111827",
    WebkitTextFillColor: "#111827",
  }}
>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong>AI osservatore</strong>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
                    Non modifica ciò che scrivi. Propone ipotesi e controlli.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void analizzaNota()}
                  style={buttonPrimary}
                >
                  ✨ Analizza nota
                </button>
              </div>

              {decisionPlan && decisionPlan.proposals.length > 0 && (
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      background: "#ffffff",
                      color: "#111827",
                    }}
                  >
                    <strong style={{ color: "#111827" }}>
                      Proposte ARTECNA
                    </strong>

                    <ul style={{ marginTop: 8, color: "#111827" }}>
                      {decisionPlan.proposals.map((proposal) => (
                        <li key={proposal.id} style={{ marginBottom: 8 }}>
                          <strong>{proposal.title}</strong>
                          {proposal.description && (
                            <div style={{ fontSize: 13, color: "#475569" }}>
                              {proposal.description}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>

                    <small style={{ color: "#64748b" }}>
                      Queste sono proposte. Nessun dato viene salvato senza
                      conferma.
                    </small>
                  </div>
                </div>
              )}

              {analisiAi && (
                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      background: "#ffffff",
                      color: "#111827",
                    }}
                  >
                    <strong style={{ color: "#111827" }}>Sintesi</strong>
                    <div style={{ color: "#111827" }}>{analisiAi.sintesi}</div>
                  </div>

                  <div
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      background: "#ffffff",
                      color: "#111827",
                    }}
                  >
                    <strong style={{ color: "#111827" }}>
                      Possibili cause
                    </strong>
                    <ul style={{ color: "#111827" }}>
                      {analisiAi.ipotesi.map((item) => (
                        <li key={item} style={{ color: "#111827" }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      background: "#ffffff",
                      color: "#111827",
                    }}
                  >
                    <strong style={{ color: "#111827" }}>Da verificare</strong>
                    <ul style={{ color: "#111827" }}>
                      {analisiAi.verifiche.map((item) => (
                        <li key={item} style={{ color: "#111827" }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {analisiAi.domande.length > 0 && (
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        background: "#ffffff",
                        color: "#111827",
                      }}
                    >
                      <strong style={{ color: "#111827" }}>
                        Informazioni mancanti
                      </strong>
                      <ul style={{ color: "#111827" }}>
                        {analisiAi.domande.map((item) => (
                          <li key={item} style={{ color: "#111827" }}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <small style={{ color: "#334155" }}>
                    {analisiAi.avvertenza}
                  </small>
                </div>
              )}
                            </aside>

  </>
)}

            

      {notaVisibile && (
        <article className="smart-note-print" aria-hidden="true">
          <header
            style={{ borderBottom: "1px solid #94a3b8", paddingBottom: 12 }}
          >
            <h1 style={{ margin: 0, fontSize: 24 }}>
              {titolo || "Nota sopralluogo"}
            </h1>
            {(sopralluogoAperto.cliente || sopralluogoAperto.indirizzo) && (
              <p style={{ margin: "8px 0 0" }}>
                {sopralluogoAperto.cliente && (
                  <strong>{sopralluogoAperto.cliente}</strong>
                )}
                {sopralluogoAperto.cliente &&
                  sopralluogoAperto.indirizzo &&
                  " - "}
                {sopralluogoAperto.indirizzo}
              </p>
            )}
            {dataOraSopralluogo && (
              <p style={{ margin: "4px 0 0" }}>
                Sopralluogo: {dataOraSopralluogo}
              </p>
            )}
          </header>

          {testo && (
            <section style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 17, margin: "0 0 8px" }}>Nota</h2>
              <div style={{ whiteSpace: "pre-wrap" }}>{testo}</div>
            </section>
          )}

          {checklist.length > 0 && (
            <section style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 17, margin: "0 0 8px" }}>Checklist</h2>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                {checklist.map((voce) => (
                  <li key={voce.id} style={{ marginBottom: 5 }}>
                    <span aria-hidden="true">
                      {voce.completata ? "☑" : "☐"}
                    </span>{" "}
                    {voce.testo || "Controllo senza descrizione"}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {disegni.length > 0 && (
            <section style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 17, margin: "0 0 8px" }}>Disegno</h2>

              <NotaDisegno
                segni={disegni}
                onChange={() => undefined}
                strumento={false}
                colore="#111827"
                spessore={4}
                sfondo={sfondoDisegno}
layers={layers}
onLayersChange={setLayers}
                backgroundTransform={backgroundTransform}
                zoomSfondo={zoomSfondo}
                sfondoX={sfondoX}
                sfondoY={sfondoY}
                oggettiGrafici={oggettiGrafici}
                oggettoGraficoSelezionatoId={null}
                onCambiaBackgroundTransform={() => undefined}
                pinSelezionatoId={null}
orthoAttivo={false}
snapAttivo={false}
modalitaSelezione={false}
gridSnapAttivo={false}
gridSize={24}
polarTrackingAttivo={false}
perpTrackingAttivo={false}
polarIncrement={45}
polarTolerance={8}
              />

              {pinSelezionato && (
                <section
                  style={{
                    marginTop: 16,
                    padding: 16,
                    border: "1px solid #cbd5e1",
                    borderRadius: 12,
                    background: "#f8fafc",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <h3 style={{ margin: 0 }}>
                    📍 Pin {pinSelezionato.metadati?.numero}
                  </h3>

                  <input
                    value={pinSelezionato.metadati?.titolo || ""}
                    onChange={(event) =>
                      aggiornaMetadatiPin("titolo", event.target.value)
                    }
                    placeholder="Titolo del punto rilevato"
                    style={{
                      padding: 10,
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      fontSize: 15,
                    }}
                  />

                  <textarea
                    value={pinSelezionato.metadati?.descrizione || ""}
                    onChange={(event) =>
                      aggiornaMetadatiPin("descrizione", event.target.value)
                    }
                    placeholder="Descrizione tecnica del punto"
                    rows={3}
                    style={{
                      padding: 10,
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      fontSize: 15,
                      resize: "vertical",
                    }}
                  />


                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                      ["nuovo", "🔴 Nuovo"],
                      ["in_lavorazione", "🟡 In lavorazione"],
                      ["risolto", "🟢 Risolto"],
                    ].map(([stato, label]) => (
                      <button
                        key={stato}
                        type="button"
                        onClick={() =>
                          aggiornaMetadatiPin(
                            "stato",
                            stato as "nuovo" | "in_lavorazione" | "risolto",
                          )
                        }
                        style={{
                          ...buttonSecondary,
                          background:
                            pinSelezionato.metadati?.stato === stato
                              ? "#dbeafe"
                              : buttonSecondary.background,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <small style={{ color: "#64748b" }}>
                    Le informazioni vengono salvate automaticamente nel
                    Quaderno.
                  </small>
                </section>
              )}
            </section>
          )}

 

          {fotoSopralluogo.length > 0 && (
            <section style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 17, margin: "0 0 8px" }}>
                Foto collegate
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                {fotoSopralluogo.map((foto, indice) => (
                  <figure key={foto.id || indice} style={{ margin: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={foto.url}
                      alt={foto.nome || `Foto ${indice + 1}`}
                      style={{
                        display: "block",
                        width: "100%",
                        maxHeight: 320,
                        objectFit: "contain",
                      }}
                    />
                    {foto.nome && (
                      <figcaption style={{ marginTop: 4 }}>
                        {foto.nome}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </section>
          )}

          {allegati.some((allegato) => allegato.tipo !== "foto") && (
            <section style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 17, margin: "0 0 8px" }}>Allegati</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                {allegati
                  .filter((allegato) => allegato.tipo !== "foto")
                  .map((allegato) => (
                    <figure key={allegato.id} style={{ margin: 0 }}>
                      <figcaption style={{ marginTop: 4 }}>
                        {allegato.nome_file}
                      </figcaption>
                    </figure>
                  ))}
              </div>
            </section>
          )}

          {analisiAi && (
            <section style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 17, margin: "0 0 8px" }}>Analisi AI</h2>
              <strong>Sintesi</strong>
              <div>{analisiAi.sintesi}</div>
              {analisiAi.ipotesi.length > 0 && (
                <>
                  <strong>Possibili cause</strong>
                  <ul>
                    {analisiAi.ipotesi.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              )}
              {analisiAi.verifiche.length > 0 && (
                <>
                  <strong>Da verificare</strong>
                  <ul>
                    {analisiAi.verifiche.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              )}
              {analisiAi.domande.length > 0 && (
                <>
                  <strong>Informazioni mancanti</strong>
                  <ul>
                    {analisiAi.domande.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              )}
              <small>{analisiAi.avvertenza}</small>
            </section>
          )}
          {decisionPlan && (
            <WorkflowPreview
              plan={decisionPlan}
              buttonPrimary={buttonPrimary}
              buttonSecondary={buttonSecondary}
              onCancelProposal={annullaPropostaDecisione}
              onExecuteProposal={eseguiPropostaDecisione}
            />
          )}
        </article>
      )}
    </section>
  );
}
