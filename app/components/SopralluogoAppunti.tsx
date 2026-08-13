"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from "react";
import { flushSync } from "react-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import NotaDisegno from "./note/NotaDisegno";
import { STRUMENTI_DISEGNO } from "./note/drawing-tools";
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

import { executeWorkflowProposal } from "@/app/engines/workflow-actions";

import { createDefaultBackgroundTransform } from "../engines/quaderno-layout";

import { esportaSvgQuaderno } from "@/app/engines/quaderno-export";

import { createQuadernoPageLayout } from "@/app/engines/quaderno-page";
import { DEFAULT_QUADERNO_LAYERS } from "@/app/engines/quaderno-layers/defaults";
import type { CadScaleCalibration } from '@/app/engines/cad/scale-manager'
import type { CadDimensionEntity } from '@/app/engines/cad/entities'
import { ToolButton } from "@/app/components/ui";
import type {
  CadEntity,
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

}: Props) {

const quadernoContainerRef = useRef<HTMLDivElement | null>(null);

const [quadernoEspansoTop, setQuadernoEspansoTop] =
  useState(2);
  const quadernoSvgRef = useRef<SVGSVGElement | null>(null);
const viewportRef = useRef<HTMLDivElement | null>(null);
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

const registraSnapshotQuaderno = () => {
  const snapshot = creaSnapshotQuaderno();

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
  setQuadernoUndoStack((precedenti) => {
    const snapshotPrecedente = precedenti[precedenti.length - 1];

    if (!snapshotPrecedente) {
      return precedenti;
    }

    const snapshotCorrente = creaSnapshotQuaderno();

    setQuadernoRedoStack((successivi) => [
      snapshotCorrente,
      ...successivi,
    ]);

    applicaSnapshotQuaderno(snapshotPrecedente);

    return precedenti.slice(0, -1);
  });
};

const ripristinaModificaQuaderno = () => {
  setQuadernoRedoStack((successivi) => {
    const snapshotSuccessivo = successivi[0];

    if (!snapshotSuccessivo) {
      return successivi;
    }

    const snapshotCorrente = creaSnapshotQuaderno();

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
      elementoAttivo?.isContentEditable;

    if (staScrivendo) return;

    const tasto = event.key.toLowerCase();

   if (
  tasto === "delete" ||
  tasto === "backspace"
) {
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

  return
}

    const usaComando =
      event.ctrlKey || event.metaKey;

    if (!usaComando) return;

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
    entitaCadPaginaCorrente,
    selectionStateCad,
  )

const areeCadSelezionate =
  (
    pagineQuaderno[
      paginaCorrenteIndex
    ]?.cadEntities ?? []
  ).filter(
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
const [orthoAttivo, setOrthoAttivo] = useState(false)
const [gridSnapAttivo, setGridSnapAttivo] = useState(false)
const [metroAttivo, setMetroAttivo] =
  useState(false)
const [trimAttivo, setTrimAttivo] = useState(false)


const [areaAttiva, setAreaAttiva] =
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

  if (!risultato.changed) {
    return;
  }

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
  layers: DEFAULT_QUADERNO_LAYERS.map((layer) => ({
    ...layer,
  })),
}

    setPagineQuaderno((pagineCorrenti) => [
      ...pagineCorrenti.map((pagina, index) =>
        index === paginaCorrenteIndex
          ? {
              ...pagina,
  disegni,
  sfondoDisegno,
  zoomSfondo,
  oggettiGrafici,
  layers,
}
          : pagina,
      ),
      nuovaPagina,
    ]);

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
            }
          : pagina,
      ),
    );

    setPaginaCorrenteIndex(nuovoIndex);
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

  const apriAnteprimaQuaderno = () => {
    const svg = quadernoSvgRef.current;

    if (!svg) {
      alert("Foglio del Quaderno non disponibile.");
      return;
    }

    const esportazione = esportaSvgQuaderno(svg, {
      filename: `quaderno-${titolo || "sopralluogo"}`,
      backgroundColor: "#ffffff",
    });

    const blob = new Blob([esportazione.svgText], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    setAnteprimaQuaderno((precedente) => {
      if (precedente) {
        URL.revokeObjectURL(precedente);
      }

      return url;
    });
  };

  const chiudiAnteprimaQuaderno = () => {
    setAnteprimaQuaderno((precedente) => {
      if (precedente) {
        URL.revokeObjectURL(precedente);
      }

      return null;
    });
  };

  const stampaFoglioQuaderno = () => {
    const finestraStampa = window.open("", "_blank");

    if (!finestraStampa) {
      alert(
        "Il browser ha bloccato la finestra di stampa. Consenti i popup per localhost.",
      );
      return;
    }

    if (!anteprimaQuaderno) {
      finestraStampa.close();
      alert("Anteprima del foglio non disponibile.");
      return;
    }

    const orientamento =
      pageLayout.orientation === "portrait" ? "portrait" : "landscape";

    finestraStampa.document.open();

    finestraStampa.document.write(`
    <!doctype html>
    <html lang="it">
      <head>
        <meta charset="utf-8" />
        <title>Stampa Quaderno Tecnico</title>

        <style>
          @page {
            size: ${pageLayout.format} ${orientamento};
            margin: 0;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background: #ffffff;
          }

          body {
            display: flex;
            align-items: center;
            justify-content: center;
          }

         object {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
        </style>
      </head>

      <body>
       <object
  id="foglio-quaderno"
  data="${anteprimaQuaderno}"
  type="image/svg+xml"
  aria-label="Foglio del Quaderno Tecnico"
></object>

       <script>
  const foglio = document.querySelector('#foglio-quaderno');
  let stampaAvviata = false;

  const avviaStampa = () => {
    if (stampaAvviata) return;

    stampaAvviata = true;
    window.focus();

    setTimeout(() => {
      window.print();
    }, 500);
  };

  if (foglio) {
    foglio.addEventListener(
      'load',
      avviaStampa,
      { once: true }
    );
  }

  window.addEventListener(
    'load',
    avviaStampa,
    { once: true }
  );

  setTimeout(avviaStampa, 2000);
</script>
      </body>
    </html>
  `);

    finestraStampa.document.close();
  };
  const condividiFoglioQuaderno = async () => {
    if (!anteprimaQuaderno) {
      alert("Anteprima del foglio non disponibile.");
      return;
    }

    try {
      const risposta = await fetch(anteprimaQuaderno);

      const blob = await risposta.blob();

      const nomePulito = titolo.trim() || "sopralluogo";

      const file = new File([blob], `quaderno-${nomePulito}.svg`, {
        type: "image/svg+xml",
      });

      if (
        navigator.share &&
        navigator.canShare?.({
          files: [file],
        })
      ) {
        await navigator.share({
          title: "Quaderno Tecnico ARTECNA",
          text: "Foglio del Quaderno Tecnico ARTECNA OS",
          files: [file],
        });

        return;
      }

      const link = document.createElement("a");

      link.href = anteprimaQuaderno;
      link.download = file.name;

      document.body.appendChild(link);
      link.click();
      link.remove();

      alert(
        "La condivisione diretta non è disponibile. Il foglio è stato scaricato.",
      );
    } catch (error) {
      console.error("Errore condivisione Quaderno:", error);

      alert("Non è stato possibile condividere il foglio.");
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

layers: Array.isArray(pagina.layers)
  ? pagina.layers.map((layer) => ({
      ...layer,
    }))
  : DEFAULT_QUADERNO_LAYERS.map((layer) => ({
      ...layer,
    })),
}))

const primaPagina = pagineNormalizzate[0];

          setPagineQuaderno(pagineNormalizzate);
          setPaginaCorrenteIndex(0);
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

    const pagineAggiornate = pagineQuaderno.map((pagina, index) =>
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
    : pagina,
);

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
  active={modalitaSelezione && !manoAttiva}
  compact={toolbarCompatta}
  onClick={() => {
    setManoAttiva(false)
    setPanInCorso(false)

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
  icon="✋"
  label="Mano"
  active={manoAttiva}
  compact={toolbarCompatta}
  onClick={() => {
    const prossimaManoAttiva = !manoAttiva;

    setManoAttiva(prossimaManoAttiva);
    setModalitaSelezione(!prossimaManoAttiva);
    setPanInCorso(false);

    setSfondoSelezionato(false);
    setPinSelezionatoId(null);
    setOggettoGraficoSelezionatoId(null);
    setCadEntitySelezionataId(null);
    setCadEntitySelezionateIds([]);
  }}
/><button
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

 setStrumentoDisegno(strumento.id);
setModalitaSelezione(false);
setTrimAttivo(false);

setSfondoSelezionato(false);
setPinSelezionatoId(null);
setOggettoGraficoSelezionatoId(null);
setCadEntitySelezionataId(null);
setCadEntitySelezionateIds([]);

setManoAttiva(false);
setPanInCorso(false);
}}
                 style={{
  ...buttonSecondary,
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
                  {strumento.label}
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
  setCalibrazioneScalaAttiva((v) => {
    const prossimoValore = !v

  if (prossimoValore) {
  setMetroAttivo(false)
  setAreaAttiva(false)
}

    return prossimoValore
  })
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
  setMetroAttivo((v) => {
    const prossimoValore = !v

   if (prossimoValore) {
  setCalibrazioneScalaAttiva(false)
  setAreaAttiva(false)
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
  title="Misura area reale"
>
  AREA
</button>

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
    Spessore
    <input
      type="range"
      min={1}
      max={24}
      value={spessoreDisegno}
      onChange={(event) =>
        setSpessoreDisegno(
          Number(event.target.value),
        )
      }
    />
    <span>{spessoreDisegno}px</span>
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
                  zIndex: 10000,
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
  type="image/svg+xml"
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
          setPageLayout(
            createQuadernoPageLayout(
              event.target.value as "A4" | "A3",
              pageLayout.orientation,
            ),
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
          setPageLayout(
            createQuadernoPageLayout(
              pageLayout.format,
              event.target.value as "portrait" | "landscape",
            ),
          )
        }
      >
        <option value="landscape">Orizzontale</option>
        <option value="portrait">Verticale</option>
      </select>
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
>


  
  <div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
    width: "100%",
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
</WorkspacePanel>

<WorkspacePanel
  titolo="Proprietà"  aperto={proprietaPanelAperto}
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

{areeCadSelezionate.length === 2 && (
  <>
    <span>|</span>

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
        padding: "4px 8px",
        minHeight: 28,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      Unisci aree
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
  justifyContent: "center",
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
                  width: pageLayout.width,
                  height: pageLayout.height,
                  background: "#ffffff",
                  border: "1px solid #d1d5db",
                  boxShadow: "0 10px 30px rgba(15,23,42,0.25)",
                  overflow: "hidden",
                  flexShrink: 0,
                  position: "relative",
                }}
              >


               <NotaDisegno
  svgRefEsterno={quadernoSvgRef}
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
onScaleCalibrationChange={setScaleCalibration}
metroAttivo={metroAttivo}
areaAttiva={areaAttiva}
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
  console.log(
    "AREA UPDATE PADRE",
    entityAggiornata.id,
  )

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
  setTrasformazioneOggettoAttiva(false);

  aggiornaQuaderno(
    {
      disegni,
      sfondoDisegno,
      backgroundTransform,
    oggettiGrafici:
  oggettiGraficiLiveRef.current,
      layers,
      zoomSfondo,
      sfondoX,
      sfondoY,
    },
    false,
  );
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
    oggettiGrafici,
    layers,
    backgroundTransform,
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
                  strumento={strumentoDisegno}
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