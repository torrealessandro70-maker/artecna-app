"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";

import { createPortal } from "react-dom";

import { UI_THEME } from "@/app/components/ui";

type WorkspacePanelPosizione = {
  x: number;
  y: number;
};

type WorkspacePanelDimensioni = {
  width: number;
  height: number;
};

type WorkspacePanelProps = {
  titolo: string;
  aperto: boolean;
  posizione: WorkspacePanelPosizione;
  dimensioni: WorkspacePanelDimensioni;
  onChiudi: () => void;
  onCambiaPosizione: (posizione: WorkspacePanelPosizione) => void;
  onCambiaDimensioni: (dimensioni: WorkspacePanelDimensioni) => void;
  children: ReactNode;
  zIndex?: number;
  larghezzaMinima?: number;
  altezzaMinima?: number;
  ariaLabel?: string;
  contentStyle?: CSSProperties;
usaPortal?: boolean;
};

export default function WorkspacePanel({
  titolo,
  aperto,
  posizione,
  dimensioni,
  onChiudi,
  onCambiaPosizione,
  onCambiaDimensioni,
  children,
  zIndex = 10030,
  larghezzaMinima = 220,
  altezzaMinima = 140,
  ariaLabel,
  contentStyle,
 usaPortal = false,
}: WorkspacePanelProps) {
  const trascinamentoRef = useRef({
    attivo: false,
    offsetX: 0,
    offsetY: 0,
  });

  const ridimensionamentoRef = useRef({
    attivo: false,
    puntoX: 0,
    puntoY: 0,
    widthIniziale: dimensioni.width,
    heightIniziale: dimensioni.height,
  });

useEffect(() => {
  const mantieniPannelloNellaFinestra = () => {
    const margine = 8;

    const larghezzaMassima = Math.max(
      larghezzaMinima,
      window.innerWidth - margine * 2,
    );

    const altezzaMassima = Math.max(
      altezzaMinima,
      window.innerHeight - margine * 2,
    );

    const nuovaLarghezza = Math.min(
      dimensioni.width,
      larghezzaMassima,
    );

    const nuovaAltezza = Math.min(
      dimensioni.height,
      altezzaMassima,
    );

    const nuovoX = Math.max(
      margine,
      Math.min(
        posizione.x,
        window.innerWidth -
          nuovaLarghezza -
          margine,
      ),
    );

    const nuovoY = Math.max(
      margine,
      Math.min(
        posizione.y,
        window.innerHeight -
          nuovaAltezza -
          margine,
      ),
    );

    if (
      nuovaLarghezza !== dimensioni.width ||
      nuovaAltezza !== dimensioni.height
    ) {
      onCambiaDimensioni({
        width: nuovaLarghezza,
        height: nuovaAltezza,
      });
    }

    if (
      nuovoX !== posizione.x ||
      nuovoY !== posizione.y
    ) {
      onCambiaPosizione({
        x: nuovoX,
        y: nuovoY,
      });
    }
  };

  mantieniPannelloNellaFinestra();

  window.addEventListener(
    "resize",
    mantieniPannelloNellaFinestra,
  );

  return () => {
    window.removeEventListener(
      "resize",
      mantieniPannelloNellaFinestra,
    );
  };
}, [
  posizione.x,
  posizione.y,
  dimensioni.width,
  dimensioni.height,
  larghezzaMinima,
  altezzaMinima,
  onCambiaPosizione,
  onCambiaDimensioni,
]);

  if (!aperto) return null;

  const iniziaTrascinamento = (
    event: PointerEvent<HTMLDivElement>,
  ) => {

    event.preventDefault();

    trascinamentoRef.current = {
      attivo: true,
      offsetX: event.clientX - posizione.x,
      offsetY: event.clientY - posizione.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const trascina = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (!trascinamentoRef.current.attivo) return;

    const nuovoX = Math.max(
      8,
      Math.min(
        window.innerWidth - dimensioni.width - 8,
        event.clientX - trascinamentoRef.current.offsetX,
      ),
    );

    const nuovoY = Math.max(
      8,
      Math.min(
        window.innerHeight - dimensioni.height - 8,
        event.clientY - trascinamentoRef.current.offsetY,
      ),
    );

    onCambiaPosizione({
      x: nuovoX,
      y: nuovoY,
    });
  };

  const terminaTrascinamento = (
  event: PointerEvent<HTMLDivElement>,
) => {
  if (!trascinamentoRef.current.attivo) {
    return;
  }

  trascinamentoRef.current.attivo = false;

  const margine = 8;
  const sogliaAggancio = 24;

  const xMassimo = Math.max(
    margine,
    window.innerWidth - dimensioni.width - margine,
  );

  const yMassimo = Math.max(
    margine,
    window.innerHeight - dimensioni.height - margine,
  );

  let nuovoX = Math.max(
    margine,
    Math.min(
      xMassimo,
      event.clientX -
        trascinamentoRef.current.offsetX,
    ),
  );

  let nuovoY = Math.max(
    margine,
    Math.min(
      yMassimo,
      event.clientY -
        trascinamentoRef.current.offsetY,
    ),
  );

  if (nuovoX <= margine + sogliaAggancio) {
    nuovoX = margine;
  } else if (
    nuovoX >= xMassimo - sogliaAggancio
  ) {
    nuovoX = xMassimo;
  }

  if (nuovoY <= margine + sogliaAggancio) {
    nuovoY = margine;
  } else if (
    nuovoY >= yMassimo - sogliaAggancio
  ) {
    nuovoY = yMassimo;
  }

  onCambiaPosizione({
    x: nuovoX,
    y: nuovoY,
  });

  if (
    event.currentTarget.hasPointerCapture(
      event.pointerId,
    )
  ) {
    event.currentTarget.releasePointerCapture(
      event.pointerId,
    );
  }
};

  const iniziaRidimensionamento = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    ridimensionamentoRef.current = {
      attivo: true,
      puntoX: event.clientX,
      puntoY: event.clientY,
      widthIniziale: dimensioni.width,
      heightIniziale: dimensioni.height,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const ridimensiona = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (!ridimensionamentoRef.current.attivo) return;

    const deltaX =
      event.clientX - ridimensionamentoRef.current.puntoX;

    const deltaY =
      event.clientY - ridimensionamentoRef.current.puntoY;

    const widthMassima = Math.max(
      larghezzaMinima,
      window.innerWidth - posizione.x - 8,
    );

    const heightMassima = Math.max(
      altezzaMinima,
      window.innerHeight - posizione.y - 8,
    );

    const nuovaWidth = Math.max(
  larghezzaMinima,
  Math.min(
    widthMassima,
    ridimensionamentoRef.current.widthIniziale + deltaX,
  ),
)

const nuovaHeight = Math.max(
  altezzaMinima,
  Math.min(
    heightMassima,
    ridimensionamentoRef.current.heightIniziale + deltaY,
  ),
)

if (
  nuovaWidth === dimensioni.width &&
  nuovaHeight === dimensioni.height
) {
  return
}

onCambiaDimensioni({
  width: nuovaWidth,
  height: nuovaHeight,
});
};

const terminaRidimensionamento = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    ridimensionamentoRef.current.attivo = false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const contenutoPannello = (
  <div
    role="dialog"
  aria-label={ariaLabel ?? titolo}
  style={{
    position: "fixed",
    left: posizione.x,
    top: posizione.y,
    width: dimensioni.width,
    height: dimensioni.height,
    zIndex,
    padding: UI_THEME.spacing.md,
    overflow: "auto",
    border: `1px solid ${UI_THEME.colors.border}`,
    borderRadius: UI_THEME.radius.xl,
    background: UI_THEME.colors.panel,
    backdropFilter: "blur(8px)",
    boxShadow: UI_THEME.shadow.panel,
    display: "flex",
    flexDirection: "column",
    gap: UI_THEME.spacing.md,
    boxSizing: "border-box",
  }}
>
      <div
        onPointerDown={(event) => {
  console.log("HEADER POINTER DOWN", titolo)
  iniziaTrascinamento(event)
}}
        onPointerMove={trascina}
        onPointerUp={terminaTrascinamento}
        onPointerCancel={terminaTrascinamento}
       style={{
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: UI_THEME.spacing.sm,
  padding: `${UI_THEME.spacing.xs}px ${UI_THEME.spacing.sm}px`,
  borderRadius: UI_THEME.radius.md,
  background: UI_THEME.colors.primarySoft,
  color: UI_THEME.colors.text,
  fontWeight: 800,
  cursor: "move",
  userSelect: "none",
  touchAction: "none",
  flexShrink: 0,

}}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <span aria-hidden="true">⋮⋮</span>

          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
         {titolo}
          </span>
        </div>

        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onChiudi}
          aria-label={`Chiudi pannello ${titolo}`}
          style={{
            width: 28,
            height: 28,
            border: "none",
            borderRadius: 6,
            background: "#ef4444",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
            padding: 0,
            lineHeight: "28px",
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      <div
        style={{
          minWidth: 0,
          flex: "1 1 auto",
          ...contentStyle,
        }}
      >
        {children}
      </div>

      <div
        onPointerDown={iniziaRidimensionamento}
        onPointerMove={ridimensiona}
        onPointerUp={terminaRidimensionamento}
        onPointerCancel={terminaRidimensionamento}
        aria-label={`Ridimensiona pannello ${titolo}`}
        style={{
          position: "absolute",
          right: 4,
          bottom: 4,
          width: 18,
          height: 18,
          cursor: "nwse-resize",
          touchAction: "none",
          userSelect: "none",
          borderRight: "3px solid #64748b",
          borderBottom: "3px solid #64748b",
          borderRadius: 2,
        }}
      />
    </div>
 );

return usaPortal && typeof document !== "undefined"
  ? createPortal(contenutoPannello, document.body)
  : contenutoPannello;
}