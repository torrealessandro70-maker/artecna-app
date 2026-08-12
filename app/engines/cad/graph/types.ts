export type CadNode = {
  id: string;

  x: number;
  y: number;
};

export type CadSegment = {
  id: string;

  entityId: string;

  edgeIndex: number;

  startNodeId: string;
  endNodeId: string;
};

export type CadGraph = {
  nodes: CadNode[];
  segments: CadSegment[];
};