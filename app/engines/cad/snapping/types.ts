export type SnapType =
  | "endpoint"
  | "midpoint"
  | "intersection"
  | "vertex";

export interface SnapPoint {
  x: number;
  y: number;
}

export interface SnapCandidate {
  type: SnapType;
  point: SnapPoint;

  /**
   * Distanza dal puntatore.
   * Più è bassa, maggiore è la priorità.
   */
  distance: number;

  /**
   * Id dell'entità CAD da cui proviene lo snap.
   */
  entityId?: string;

  /**
   * Layer di appartenenza.
   * Sarà utilizzato per ignorare layer nascosti,
   * bloccati o non selezionabili.
   */
  layerId?: string;
}

export interface SnapResult {
  snapped: boolean;
  candidate?: SnapCandidate;
}

export interface SnapSettings {
  enabled: boolean;

  tolerance: number;

  endpoint: boolean;
  midpoint: boolean;
  intersection: boolean;
  vertex: boolean;
}

export const DEFAULT_SNAP_SETTINGS: SnapSettings = {
  enabled: true,

  tolerance: 12,

  endpoint: true,
  midpoint: true,
  intersection: true,
  vertex: true,
};
