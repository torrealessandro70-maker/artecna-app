import type {
  CadEntity,
  CadFreehandEntity,
  CadImageEntity,
  CadLineEntity,
  CadPinEntity,
} from '../entities'

import {
  getBehavior,
  registerDefaultBehaviors,
} from '../behaviors'

import {
  getMidpoint,
  getSegmentIntersection,
} from './geometry'

import type {
  SnapPoint,
  SnapProviderContext,
} from './types'

import { SNAP_PRIORITY } from './priorities'

const getLineSnapPoints = (
  entity: CadLineEntity,
): SnapPoint[] => [
  {
    ...entity.start,
    type: 'endpoint',
    priority: SNAP_PRIORITY.ENDPOINT,
    entityId: entity.id,
  },
  {
    ...entity.end,
    type: 'endpoint',
    priority: SNAP_PRIORITY.ENDPOINT,
    entityId: entity.id,
  },
]
const getArrowSnapPoints = (
  entity: CadFreehandEntity,
): SnapPoint[] => {
  const start = entity.points[0]
  const end = entity.points.at(-1)

  if (!start || !end) {
    return []
  }

  return [
    {
      ...start,
      type: 'endpoint',
      priority: SNAP_PRIORITY.ENDPOINT,
      entityId: entity.id,
    },
    {
      ...end,
      type: 'endpoint',
      priority: SNAP_PRIORITY.ENDPOINT,
      entityId: entity.id,
    },
    {
      ...getMidpoint(start, end),
      type: 'midpoint',
      priority: SNAP_PRIORITY.MIDPOINT,
      entityId: entity.id,
    },
  ]
}

const getRectangleSnapPoints = (
  entity: CadFreehandEntity,
): SnapPoint[] => {
  const firstPoint = entity.points[0]
  const lastPoint = entity.points.at(-1)

  if (!firstPoint || !lastPoint) {
    return []
  }

  const left = Math.min(
    firstPoint.x,
    lastPoint.x,
  )
  const right = Math.max(
    firstPoint.x,
    lastPoint.x,
  )
  const top = Math.min(
    firstPoint.y,
    lastPoint.y,
  )
  const bottom = Math.max(
    firstPoint.y,
    lastPoint.y,
  )

  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2

  return [
    {
      x: left,
      y: top,
      type: 'endpoint',
      priority: SNAP_PRIORITY.ENDPOINT,
      entityId: entity.id,
    },
    {
      x: right,
      y: top,
      type: 'endpoint',
      priority: SNAP_PRIORITY.ENDPOINT,
      entityId: entity.id,
    },
    {
      x: right,
      y: bottom,
      type: 'endpoint',
      priority: SNAP_PRIORITY.ENDPOINT,
      entityId: entity.id,
    },
    {
      x: left,
      y: bottom,
      type: 'endpoint',
      priority: SNAP_PRIORITY.ENDPOINT,
      entityId: entity.id,
    },

    {
      x: centerX,
      y: top,
      type: 'midpoint',
      priority: SNAP_PRIORITY.MIDPOINT,
      entityId: entity.id,
    },
    {
      x: right,
      y: centerY,
      type: 'midpoint',
      priority: SNAP_PRIORITY.MIDPOINT,
      entityId: entity.id,
    },
    {
      x: centerX,
      y: bottom,
      type: 'midpoint',
      priority: SNAP_PRIORITY.MIDPOINT,
      entityId: entity.id,
    },
    {
      x: left,
      y: centerY,
      type: 'midpoint',
      priority: SNAP_PRIORITY.MIDPOINT,
      entityId: entity.id,
    },

    {
      x: centerX,
      y: centerY,
      type: 'center',
      priority: SNAP_PRIORITY.CENTER,
      entityId: entity.id,
    },
  ]
}

const getCircleSnapPoints = (
  entity: CadFreehandEntity,
): SnapPoint[] => {
  const firstPoint = entity.points[0]
  const lastPoint = entity.points.at(-1)

  if (!firstPoint || !lastPoint) {
    return []
  }

  const centerX =
    (firstPoint.x + lastPoint.x) / 2
  const centerY =
    (firstPoint.y + lastPoint.y) / 2

  const radiusX =
    Math.abs(lastPoint.x - firstPoint.x) / 2
  const radiusY =
    Math.abs(lastPoint.y - firstPoint.y) / 2

  return [
    {
      x: centerX,
      y: centerY,
      type: 'center',
      priority: SNAP_PRIORITY.ENDPOINT,
      entityId: entity.id,
    },
    {
      x: centerX,
      y: centerY - radiusY,
     type: 'endpoint',
priority: SNAP_PRIORITY.ENDPOINT,
      entityId: entity.id,
    },
    {
      x: centerX + radiusX,
      y: centerY,
     type: 'endpoint',
priority: SNAP_PRIORITY.ENDPOINT,
      entityId: entity.id,
    },
    {
      x: centerX,
      y: centerY + radiusY,
     type: 'endpoint',
priority: SNAP_PRIORITY.ENDPOINT,
      entityId: entity.id,
    },
    {
      x: centerX - radiusX,
      y: centerY,
      type: 'endpoint',
priority: SNAP_PRIORITY.ENDPOINT,
      entityId: entity.id,
    },
  ]
}

const getFreehandSnapPoints = (
  entity: CadFreehandEntity,
): SnapPoint[] => {
  const legacyStrumento =
    entity.metadata?.legacyStrumento

  if (legacyStrumento === 'freccia') {
    return getArrowSnapPoints(entity)
  }

  if (legacyStrumento === 'rettangolo') {
    return getRectangleSnapPoints(entity)
  }

  if (legacyStrumento === 'cerchio') {
    return getCircleSnapPoints(entity)
  }

  return []
}

const getImageSnapPoints = (
  entity: CadImageEntity,
): SnapPoint[] => {
  const {
    x,
    y,
    width,
    height,
  } = entity.transform

  return [
    {
      x,
      y,
      type: 'endpoint',
      priority: SNAP_PRIORITY.ENDPOINT,
      entityId: entity.id,
    },
    {
      x: x + width,
      y,
      type: 'endpoint',
      priority: SNAP_PRIORITY.ENDPOINT,
      entityId: entity.id,
    },
    {
      x: x + width,
      y: y + height,
      type: 'endpoint',
      priority: SNAP_PRIORITY.ENDPOINT,
      entityId: entity.id,
    },
    {
      x,
      y: y + height,
      type: 'endpoint',
      priority: SNAP_PRIORITY.ENDPOINT,
      entityId: entity.id,
    },
    {
      x: x + width / 2,
      y: y + height / 2,
      type: 'center',
      priority: SNAP_PRIORITY.CENTER,
      entityId: entity.id,
    },
  ]
}

const getPinSnapPoints = (
  entity: CadPinEntity,
): SnapPoint[] => [
  {
    ...entity.position,
    type: 'center',
    priority: SNAP_PRIORITY.PIN,
    entityId: entity.id,
  },
]


const getLineSectionMidpointSnapPoints = (
  entity: CadLineEntity,
  context: SnapProviderContext,
): SnapPoint[] => {
  const dx =
    entity.end.x - entity.start.x

  const dy =
    entity.end.y - entity.start.y

  const lunghezzaQuadrata =
    dx * dx + dy * dy

  if (lunghezzaQuadrata === 0) {
    return []
  }

  const intersezioni =
    context.entities.flatMap(
      (otherEntity) => {
        if (
          otherEntity.type !== 'line' ||
          otherEntity.id === entity.id
        ) {
          return []
        }

        const intersection =
          getSegmentIntersection(
            entity.start,
            entity.end,
            otherEntity.start,
            otherEntity.end,
          )

        if (!intersection) {
          return []
        }

        const t =
          (
            (intersection.x - entity.start.x) *
              dx +
            (intersection.y - entity.start.y) *
              dy
          ) / lunghezzaQuadrata

        // Escludiamo gli estremi:
        // non devono creare sezioni di lunghezza zero.
        if (
          t <= 0.000001 ||
          t >= 0.999999
        ) {
          return []
        }

        return [
          {
            point: intersection,
            t,
          },
        ]
      },
    )

  const intersezioniOrdinate =
    intersezioni
      .sort((a, b) => a.t - b.t)
      .filter(
        (corrente, index, array) => {
          if (index === 0) {
            return true
          }

          const precedente =
            array[index - 1]

          return (
            Math.hypot(
              corrente.point.x -
                precedente.point.x,
              corrente.point.y -
                precedente.point.y,
            ) > 0.000001
          )
        },
      )

  const puntiSezione = [
    entity.start,
    ...intersezioniOrdinate.map(
      (item) => item.point,
    ),
    entity.end,
  ]

  const risultati: SnapPoint[] = []

  for (
    let index = 0;
    index < puntiSezione.length - 1;
    index++
  ) {
    risultati.push({
      ...getMidpoint(
        puntiSezione[index],
        puntiSezione[index + 1],
      ),
      type: 'midpoint',
      priority: SNAP_PRIORITY.MIDPOINT,
      entityId: entity.id,
    })
  }

  return risultati
}

const getLineIntersectionSnapPoints = (
  entity: CadLineEntity,
  context: SnapProviderContext,
): SnapPoint[] => {
  return context.entities.flatMap(otherEntity => {
    if (
      otherEntity.type !== 'line' ||
      otherEntity.id === entity.id ||
      otherEntity.id <= entity.id
    ) {
      return []
    }

    const intersection =
      getSegmentIntersection(
        entity.start,
        entity.end,
        otherEntity.start,
        otherEntity.end,
      )

    if (!intersection) {
      return []
    }

    return [
      {
        ...intersection,
        type: 'intersection' as const,
        priority: SNAP_PRIORITY.INTERSECTION,
        entityId: entity.id,
        relatedEntityIds: [
          entity.id,
          otherEntity.id,
        ],
      },
    ]
  })
}

export const getEntitySnapPoints = (
  entity: CadEntity,
  _context: SnapProviderContext,
): SnapPoint[] => {
  switch (entity.type) {
       case 'line':
     return [
  ...getLineSnapPoints(entity),

  ...getLineSectionMidpointSnapPoints(
    entity,
    _context,
  ),

  ...getLineIntersectionSnapPoints(
    entity,
    _context,
  ),
]

    case 'freehand':
      return getFreehandSnapPoints(entity)

    case 'image':
      return getImageSnapPoints(entity)

    case 'pin':
      return getPinSnapPoints(entity)

       default: {
      registerDefaultBehaviors()

      const behavior = getBehavior(entity.type)
      const gripPoints =
        behavior?.getGripPoints?.(entity as never) ?? []

      return gripPoints.map(point => ({
        x: point.x,
        y: point.y,
        type: 'endpoint' as const,
        priority: SNAP_PRIORITY.ENDPOINT,
        entityId: entity.id,
      }))
    }
  }
}