import type {
  PointerEventHandler,
} from "react"

import type {
  CadAreaEntity,
} from "../entities"

import {
  createAreaPolylinePoints,
} from "../area"

type Props = {
  entity: CadAreaEntity
  selected?: boolean
  onPointerDown?: PointerEventHandler<SVGGElement>

  onVertexGripPointerDown?: (
    event: React.PointerEvent<SVGCircleElement>,
    vertexIndex: number,
  ) => void
}

export default function AreaRenderer({
  entity,
  selected = false,
  onPointerDown,
  onVertexGripPointerDown,
}: Props) {

  if (!entity.visible) {
    return null
  }

  const points =
    createAreaPolylinePoints(
      entity.points,
    )

  return (
    <g
      onPointerDown={onPointerDown}
      style={{
        cursor:
          entity.selectable &&
          !entity.locked
            ? "pointer"
            : "default",
      }}
    >
      <polygon
        points={points}
        fill={
          entity.fill?.color ??
          "transparent"
        }
        fillOpacity={
          entity.fill?.opacity ?? 0
        }
        stroke={
          selected
            ? "#2563eb"
            : entity.stroke.color
        }
        strokeWidth={
          selected
            ? entity.stroke.width + 2
            : entity.stroke.width
        }
        strokeOpacity={
          entity.stroke.opacity ?? 1
        }
        strokeDasharray={
          entity.stroke.dashArray?.join(" ")
        }
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pointerEvents={
          entity.selectable &&
          !entity.locked
            ? "all"
            : "none"
        }
      />

      {selected &&
        entity.points.map(
          (point, index) => (
            <circle
              key={`${entity.id}-grip-${index}`}
              cx={point.x}
              cy={point.y}
              r={5}
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
pointerEvents="all"
onPointerDown={(event) => {
  event.preventDefault()
  event.stopPropagation()

  event.currentTarget.setPointerCapture(
    event.pointerId,
  )

  onVertexGripPointerDown?.(
    event,
    index,
  )
}}
style={{
  cursor: entity.locked
    ? "not-allowed"
    : "move",
}}
/>
          ),
        )}
    </g>
  )
}