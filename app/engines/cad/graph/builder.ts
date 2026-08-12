import type { SegnoNota } from "@/app/components/note/types";

import {
  getGeometrySegments,
  segmentIntersection,
} from "@/app/engines/cad/geometry";

import type {
  CadGraph,
  CadNode,
  CadSegment,
} from "./types";

const NODE_TOLERANCE = 0.001;

type PuntoGraph = {
  x: number;
  y: number;
};

function trovaNodoEsistente(
  nodes: CadNode[],
  x: number,
  y: number,
): CadNode | null {
  for (const node of nodes) {
    const distanza = Math.hypot(
      node.x - x,
      node.y - y,
    );

    if (distanza <= NODE_TOLERANCE) {
      return node;
    }
  }

  return null;
}

function getOrCreateNode(
  nodes: CadNode[],
  x: number,
  y: number,
): CadNode {
  const esistente =
    trovaNodoEsistente(
      nodes,
      x,
      y,
    );

  if (esistente) {
    return esistente;
  }

  const nuovoNodo: CadNode = {
    id: crypto.randomUUID(),
    x,
    y,
  };

  nodes.push(nuovoNodo);

  return nuovoNodo;
}

function parametroSuLinea(
  punto: PuntoGraph,
  start: PuntoGraph,
  end: PuntoGraph,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  const lunghezzaQuadrata =
    dx * dx + dy * dy;

  if (lunghezzaQuadrata === 0) {
    return 0;
  }

  return (
    (punto.x - start.x) * dx +
    (punto.y - start.y) * dy
  ) / lunghezzaQuadrata;
}

function aggiungiPuntoUnico(
  punti: PuntoGraph[],
  punto: PuntoGraph,
) {
  const esiste = punti.some(
    (corrente) =>
      Math.hypot(
        corrente.x - punto.x,
        corrente.y - punto.y,
      ) <= NODE_TOLERANCE,
  );

  if (!esiste) {
    punti.push(punto);
  }
}

export function buildCadGraph(
  segni: SegnoNota[],
): CadGraph {
  const nodes: CadNode[] = [];
  const segments: CadSegment[] = [];

  const segmentiBase = segni.flatMap(
  (segno) =>
    getGeometrySegments(segno).map(
      (segmento) => ({
        entityId: segno.id,
        sourceEdgeIndex:
          segmento.edgeIndex,
        start: segmento.start,
        end: segmento.end,
      }),
    ),
);

const prossimoEdgeIndexPerEntity =
  new Map<string, number>();

for (
  let indiceSegmento = 0;
  indiceSegmento <
  segmentiBase.length;
  indiceSegmento++
) {
  const segmentoBase =
    segmentiBase[indiceSegmento];

  const start = segmentoBase.start;
  const end = segmentoBase.end;

  const puntiSegmento: PuntoGraph[] = [
    start,
    end,
  ];

  for (
    let indiceAltro = 0;
    indiceAltro <
    segmentiBase.length;
    indiceAltro++
  ) {
    if (
      indiceAltro === indiceSegmento
    ) {
      continue;
    }

    const altroSegmento =
      segmentiBase[indiceAltro];

    const intersezione =
      segmentIntersection(
        start,
        end,
        altroSegmento.start,
        altroSegmento.end,
      );

    if (!intersezione) {
      continue;
    }

    aggiungiPuntoUnico(
      puntiSegmento,
      intersezione,
    );
  }

  puntiSegmento.sort(
    (a, b) =>
      parametroSuLinea(
        a,
        start,
        end,
      ) -
      parametroSuLinea(
        b,
        start,
        end,
      ),
  );

  for (
    let index = 0;
    index <
    puntiSegmento.length - 1;
    index++
  ) {
    const puntoStart =
      puntiSegmento[index];

    const puntoEnd =
      puntiSegmento[index + 1];

    const lunghezzaSegmento =
      Math.hypot(
        puntoEnd.x -
          puntoStart.x,
        puntoEnd.y -
          puntoStart.y,
      );

    if (
      lunghezzaSegmento <=
      NODE_TOLERANCE
    ) {
      continue;
    }

    const startNode =
      getOrCreateNode(
        nodes,
        puntoStart.x,
        puntoStart.y,
      );

    const endNode =
      getOrCreateNode(
        nodes,
        puntoEnd.x,
        puntoEnd.y,
      );

    const edgeIndex =
      prossimoEdgeIndexPerEntity.get(
        segmentoBase.entityId,
      ) ?? 0;

    segments.push({
      id:
        `${segmentoBase.entityId}` +
        `-edge-${segmentoBase.sourceEdgeIndex}` +
        `-segment-${index}`,
      entityId:
        segmentoBase.entityId,
      edgeIndex,
      startNodeId: startNode.id,
      endNodeId: endNode.id,
    });

    prossimoEdgeIndexPerEntity.set(
      segmentoBase.entityId,
      edgeIndex + 1,
    );
  }
}

  return {
    nodes,
    segments,
  };
}

 