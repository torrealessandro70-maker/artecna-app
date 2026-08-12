import type {
  CadGraph,
  CadNode,
  CadSegment,
} from "./types";

export type NearestSegmentResult = {
  segment: CadSegment;
  distance: number;
  nearestPoint: {
    x: number;
    y: number;
  };
};

export function findNodeById(
  graph: CadGraph,
  nodeId: string,
): CadNode | undefined {
  return graph.nodes.find(
    (node) => node.id === nodeId,
  );
}

export function findEntitySegments(
  graph: CadGraph,
  entityId: string,
): CadSegment[] {
  return graph.segments.filter(
    (segment) =>
      segment.entityId === entityId,
  );
}


function distanzaDaSegmento(
  punto: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  const lunghezzaQuadrata =
    dx * dx + dy * dy;

  if (lunghezzaQuadrata === 0) {
    return {
      distance: Math.hypot(
        punto.x - start.x,
        punto.y - start.y,
      ),
      nearestPoint: {
        x: start.x,
        y: start.y,
      },
    };
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      (
        (punto.x - start.x) * dx +
        (punto.y - start.y) * dy
      ) / lunghezzaQuadrata,
    ),
  );

  const nearestPoint = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };

  return {
    distance: Math.hypot(
      punto.x - nearestPoint.x,
      punto.y - nearestPoint.y,
    ),
    nearestPoint,
  };
}

export function findNearestSegment(
  graph: CadGraph,
  punto: {
    x: number;
    y: number;
  },
  tolerance = 4,
): NearestSegmentResult | null {
  let risultato:
    | NearestSegmentResult
    | null = null;

  for (const segment of graph.segments) {
    const start = findNodeById(
      graph,
      segment.startNodeId,
    );

    const end = findNodeById(
      graph,
      segment.endNodeId,
    );

    if (!start || !end) {
      continue;
    }

    const {
      distance,
      nearestPoint,
    } = distanzaDaSegmento(
      punto,
      start,
      end,
    );

    if (distance > tolerance) {
      continue;
    }

    if (
      !risultato ||
      distance < risultato.distance
    ) {
      risultato = {
        segment,
        distance,
        nearestPoint,
      };
    }
  }

  return risultato;
}

export function findNearestNode(
  graph: CadGraph,
  punto: {
    x: number;
    y: number;
  },
  tolerance = 4,
): CadNode | null {
  let risultato: CadNode | null = null;
  let distanzaMinima = tolerance;

  for (const node of graph.nodes) {
    const distanza = Math.hypot(
      node.x - punto.x,
      node.y - punto.y,
    );

    if (distanza < distanzaMinima) {
      distanzaMinima = distanza;
      risultato = node;
    }
  }

  return risultato;
}

export function findSegmentsByNode(
  graph: CadGraph,
  nodeId: string,
): CadSegment[] {
  return graph.segments.filter(
    (segment) =>
      segment.startNodeId === nodeId ||
      segment.endNodeId === nodeId,
  );
}