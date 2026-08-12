import type {
  CadAreaEntity,
  CadFillStyle,
  CadLayerId,
  CadStrokeStyle,

} from "../entities/types";

import type {
  CadAreaPoint,
  CadAreaState,
} from "./types";

import {
  addAreaPoint,
  isNearAreaPoint,
calculateAreaMetrics
} from "./geometry";

import type {
  CadScaleCalibration,
} from "../scale-manager";

export type CreateCadAreaEntityOptions = {
  points: CadAreaPoint[];
  layerId: CadLayerId;

  areaSquareMeters: number;
  perimeterMeters: number;

  stroke: CadStrokeStyle;
  fill?: CadFillStyle;
};

export function createCadAreaEntity(
  options: CreateCadAreaEntityOptions,
): CadAreaEntity {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    type: "area",
    layerId: options.layerId,

    visible: true,
    locked: false,
    selectable: true,

    createdAt: now,
    updatedAt: now,

    points: options.points.map((point) => ({
      x: point.x,
      y: point.y,
    })),

    areaSquareMeters:
      options.areaSquareMeters,

    perimeterMeters:
      options.perimeterMeters,

    stroke: {
      ...options.stroke,
      dashArray:
        options.stroke.dashArray
          ? [...options.stroke.dashArray]
          : undefined,
    },

    fill: options.fill
      ? {
          ...options.fill,
        }
      : undefined,
  };
}

export function createInitialAreaState(): CadAreaState {
  return {
    points: [],
    cursorPoint: null,
    closed: false,
    nearFirstPoint: false,
  };
}

export function addPointToAreaState(
  state: CadAreaState,
  point: CadAreaPoint,
): CadAreaState {
  return {
    ...state,
    points: addAreaPoint(
      state.points,
      point,
    ),
  };
}

export function updateAreaCursor(
  state: CadAreaState,
  point: CadAreaPoint | null,
): CadAreaState {
  return {
    ...state,
    cursorPoint: point,
  };
}

export type HandleAreaPointerDownOptions = {
  layerId: CadLayerId;
  stroke: CadStrokeStyle;
  fill?: CadFillStyle;
  scaleCalibration: CadScaleCalibration | null;
};

export type HandleAreaPointerDownResult = {
  state: CadAreaState;
  entity: CadAreaEntity | null;
};

export function handleAreaPointerDown(
  state: CadAreaState,
  point: CadAreaPoint,
  options: HandleAreaPointerDownOptions,
): HandleAreaPointerDownResult {
  if (state.closed) {
    return {
      state,
      entity: null,
    };
  }

  const firstPoint =
    state.points[0] ?? null;

  const canClose =
    firstPoint !== null &&
    state.points.length >= 3 &&
    isNearAreaPoint(
      point,
      firstPoint,
    );

  if (canClose) {
    const closedState: CadAreaState = {
      ...state,
      cursorPoint: null,
      closed: true,
      nearFirstPoint: false,
    };

    const metrics =
      calculateAreaMetrics(
        closedState.points,
        options.scaleCalibration,
      );

    const entity =
      createCadAreaEntity({
        points: closedState.points,
        layerId: options.layerId,
        areaSquareMeters:
          metrics.areaSquareMeters,
        perimeterMeters:
          metrics.perimeterMeters,
        stroke: options.stroke,
        fill: options.fill,
      });

    return {
      state: closedState,
      entity,
    };
  }

  return {
    state: {
      ...state,
      points: addAreaPoint(
        state.points,
        point,
      ),
    },
    entity: null,
  };
}
export function handleAreaPointerMove(
  state: CadAreaState,
  point: CadAreaPoint | null,
): CadAreaState {
  if (state.closed) {
    return {
      ...state,
      cursorPoint: null,
      nearFirstPoint: false,
    };
  }

  const firstPoint =
    state.points[0] ?? null;

  const nearFirstPoint =
    point !== null &&
    firstPoint !== null &&
    state.points.length >= 3 &&
    isNearAreaPoint(
      point,
      firstPoint,
    );

  return {
    ...state,
    cursorPoint: point,
    nearFirstPoint,
  };
}

export function updateCadAreaVertex(
  entity: CadAreaEntity,
  vertexIndex: number,
  point: CadAreaPoint,
  scaleCalibration: CadScaleCalibration,
): CadAreaEntity {
  if (
    vertexIndex < 0 ||
    vertexIndex >= entity.points.length
  ) {
    return entity
  }

  const points = entity.points.map(
    (currentPoint, index) =>
      index === vertexIndex
        ? {
            x: point.x,
            y: point.y,
          }
        : {
            x: currentPoint.x,
            y: currentPoint.y,
          },
  )

  const metrics =
    calculateAreaMetrics(
      points,
      scaleCalibration,
    )

  return {
    ...entity,
    points,
    areaSquareMeters:
      metrics.areaSquareMeters,
    perimeterMeters:
      metrics.perimeterMeters,
    updatedAt: new Date().toISOString(),
  }
}