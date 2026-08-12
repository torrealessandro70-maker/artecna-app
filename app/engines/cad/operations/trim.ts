import type {
  CadGraph,
  CadSegment,
} from "@/app/engines/cad/graph";

import type { SegnoNota } from "@/app/components/note/types";

export type TrimResult = {
  changed: boolean;
  removedSegmentId: string | null;
  remainingSegments: CadSegment[];
};

export function trimSegment(
  graph: CadGraph,
  segmentId: string,
): TrimResult {
  const segmentoEsiste =
    graph.segments.some(
      (segmento) =>
        segmento.id === segmentId,
    );

  if (!segmentoEsiste) {
    return {
      changed: false,
      removedSegmentId: null,
      remainingSegments:
        graph.segments,
    };
  }

  return {
    changed: true,
    removedSegmentId: segmentId,
    remainingSegments:
      graph.segments.filter(
        (segmento) =>
          segmento.id !== segmentId,
      ),
  };
}
export type TrimGeometrySegment = {
  id: string;
  entityId: string;
  edgeIndex: number;
  start: {
    x: number;
    y: number;
  };
  end: {
    x: number;
    y: number;
  };
};

export function getTrimmedGeometry(
  graph: CadGraph,
  result: TrimResult,
): TrimGeometrySegment[] {
  return result.remainingSegments.flatMap(
    (segmento) => {
      const startNode =
        graph.nodes.find(
          (node) =>
            node.id ===
            segmento.startNodeId,
        );

      const endNode =
        graph.nodes.find(
          (node) =>
            node.id ===
            segmento.endNodeId,
        );

      if (!startNode || !endNode) {
        return [];
      }

      return [
        {
          id: segmento.id,
          entityId: segmento.entityId,
          edgeIndex: segmento.edgeIndex,
          start: {
            x: startNode.x,
            y: startNode.y,
          },
          end: {
            x: endNode.x,
            y: endNode.y,
          },
        },
      ];
    },
  );
}

export function trimmedGeometryToSegni(
  originalSegni: SegnoNota[],
  geometry: TrimGeometrySegment[],
): SegnoNota[] {
  const segniOriginaliPerId =
    new Map(
      originalSegni.map(
        (segno) => [
          segno.id,
          segno,
        ],
      ),
    );

  return geometry.flatMap(
    (segmento, index) => {
      const originale =
        segniOriginaliPerId.get(
          segmento.entityId,
        );

      if (!originale) {
        return [];
      }

      return [
        {
          ...originale,
          id:
            index === 0
              ? originale.id
              : crypto.randomUUID(),
          strumento: "linea",
          punti: [
            segmento.start,
            segmento.end,
          ],
        },
      ];
    },
  );
}

export type ApplyTrimResult = {
  changed: boolean;
  removedSegmentId: string | null;
  segni: SegnoNota[];
};

function replaceEntitySegments(
  originalSegni: SegnoNota[],
  entityId: string,
  nuoviSegmenti: SegnoNota[],
): SegnoNota[] {
  const risultato: SegnoNota[] = [];

  for (const segno of originalSegni) {
    if (segno.id === entityId) {
      risultato.push(...nuoviSegmenti);
    } else {
      risultato.push(segno);
    }
  }

  return risultato;
}

export function applyTrimToSegni(
  graph: CadGraph,
  originalSegni: SegnoNota[],
  segmentId: string,
): ApplyTrimResult {
  const segmentoTarget =
    graph.segments.find(
      (segmento) =>
        segmento.id === segmentId,
    );

  if (!segmentoTarget) {
    return {
      changed: false,
      removedSegmentId: null,
      segni: originalSegni,
    };
  }

  const trimResult =
    trimSegment(
      graph,
      segmentId,
    );

  if (!trimResult.changed) {
    return {
      changed: false,
      removedSegmentId: null,
      segni: originalSegni,
    };
  }

  const geometryCompleta =
    getTrimmedGeometry(
      graph,
      trimResult,
    );

  const geometryEntita =
    geometryCompleta.filter(
      (segmento) =>
        segmento.entityId ===
        segmentoTarget.entityId,
    );

  const nuoviSegmenti =
    trimmedGeometryToSegni(
      originalSegni,
      geometryEntita,
    );

  const segni =
    replaceEntitySegments(
      originalSegni,
      segmentoTarget.entityId,
      nuoviSegmenti,
    );

  return {
    changed: true,
    removedSegmentId:
      trimResult.removedSegmentId,
    segni,
  };
}