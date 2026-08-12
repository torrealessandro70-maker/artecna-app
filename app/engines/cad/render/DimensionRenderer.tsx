import type { PointerEventHandler } from "react"

import type { CadDimensionEntity } from "../entities"

type Props = {
  entity: CadDimensionEntity
  selected?: boolean
  onPointerDown?: PointerEventHandler<SVGGElement>
onDoubleClick?: React.MouseEventHandler<SVGGElement>
onCenterGripPointerDown?: PointerEventHandler<SVGRectElement>
onStartGripPointerDown?: PointerEventHandler<SVGRectElement>
onEndGripPointerDown?: PointerEventHandler<SVGRectElement>
}

export default function DimensionRenderer({
  entity,
  selected = false,
  onPointerDown,
  onDoubleClick,
  onCenterGripPointerDown,
  onStartGripPointerDown,
  onEndGripPointerDown,
}: Props) {
  if (!entity.visible) {
    return null
  }

  const dx = entity.end.x - entity.start.x
  const dy = entity.end.y - entity.start.y
  const lunghezza = Math.hypot(dx, dy)

  if (lunghezza === 0) {
    return null
  }

  const normaleX = -dy / lunghezza
  const normaleY = dx / lunghezza

  const startQuota = {
    x: entity.start.x + normaleX * entity.offset,
    y: entity.start.y + normaleY * entity.offset,
  }

  const endQuota = {
    x: entity.end.x + normaleX * entity.offset,
    y: entity.end.y + normaleY * entity.offset,
  }

  const centro = {
    x: (startQuota.x + endQuota.x) / 2,
    y: (startQuota.y + endQuota.y) / 2,
  }

  const etichetta =
    entity.metadata?.title ??
    entity.measuredValue?.toFixed(2) ??
    lunghezza.toFixed(2)

  const colore = selected
    ? "#ef4444"
    : entity.stroke.color

  const spessore = selected
    ? entity.stroke.width + 1
    : entity.stroke.width

  return (
  <g
  pointerEvents={
  entity.selectable ? "all" : "none"
}
  data-cad-entity-id={entity.id}
  data-cad-entity-type={entity.type}
  onDoubleClick={
    entity.selectable ? onDoubleClick : undefined
  }
  onPointerDown={
    entity.selectable && onPointerDown
      ? (event) => {
          onPointerDown(event)
        }
      : undefined
  }
  style={{
    cursor: entity.selectable
      ? "pointer"
      : "default",
  }}
>

    {/* Area di selezione invisibile - linea iniziale */}
    <line
      x1={entity.start.x}
      y1={entity.start.y}
      x2={startQuota.x}
      y2={startQuota.y}
      stroke="transparent"
      strokeWidth={16}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      pointerEvents={
  entity.selectable ? "stroke" : "none"
}
    />

    {/* Area di selezione invisibile - linea finale */}
    <line
      x1={entity.end.x}
      y1={entity.end.y}
      x2={endQuota.x}
      y2={endQuota.y}
      stroke="transparent"
      strokeWidth={16}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      pointerEvents={
  entity.selectable ? "stroke" : "none"
}
    />

    {/* Area di selezione invisibile - linea quota */}
    <line
      x1={startQuota.x}
      y1={startQuota.y}
      x2={endQuota.x}
      y2={endQuota.y}
      stroke="transparent"
      strokeWidth={16}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      pointerEvents={
  entity.selectable ? "stroke" : "none"
}
    />

    <line
      x1={entity.start.x}
      y1={entity.start.y}
      x2={startQuota.x}
      y2={startQuota.y}
      stroke={colore}
      strokeWidth={spessore}
      strokeDasharray={entity.stroke.dashArray?.join(" ")}
      vectorEffect="non-scaling-stroke"
    />
{/* Linea di estensione finale visibile */}
<line
  x1={entity.end.x}
  y1={entity.end.y}
  x2={endQuota.x}
  y2={endQuota.y}
  stroke={colore}
  strokeWidth={spessore}
  strokeDasharray={entity.stroke.dashArray?.join(" ")}
  vectorEffect="non-scaling-stroke"
/>

{/* Linea principale della quota visibile */}
<line
  x1={startQuota.x}
  y1={startQuota.y}
  x2={endQuota.x}
  y2={endQuota.y}
  stroke={colore}
  strokeWidth={spessore}
  strokeDasharray={entity.stroke.dashArray?.join(" ")}
  vectorEffect="non-scaling-stroke"
/>

          <text
        x={centro.x}
        y={centro.y - 6}
        fill={colore}
        fontSize={12}
        textAnchor="middle"
        dominantBaseline="middle"
        pointerEvents="none"
      >
        {etichetta}
      </text>

      {selected && (
  <>
    {/* Area di cattura invisibile - grip iniziale */}
    <rect
      x={entity.start.x - 12}
      y={entity.start.y - 12}
      width={24}
      height={24}
      fill="transparent"
      pointerEvents="all"
      onPointerDown={onStartGripPointerDown}
      style={{ cursor: "crosshair" }}
    />

    {/* Grip visibile iniziale */}
    <rect
      x={entity.start.x - 4}
      y={entity.start.y - 4}
      width={8}
      height={8}
      fill="#ffffff"
      stroke="#2563eb"
      strokeWidth={1.5}
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />

    {/* Area di cattura invisibile - grip finale */}
    <rect
      x={entity.end.x - 12}
      y={entity.end.y - 12}
      width={24}
      height={24}
      fill="transparent"
      pointerEvents="all"
      onPointerDown={onEndGripPointerDown}
      style={{ cursor: "crosshair" }}
    />

    {/* Grip visibile finale */}
    <rect
      x={entity.end.x - 4}
      y={entity.end.y - 4}
      width={8}
      height={8}
      fill="#ffffff"
      stroke="#2563eb"
      strokeWidth={1.5}
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />

    {/* Area di cattura invisibile - grip centrale */}
    <rect
      x={centro.x - 12}
      y={centro.y - 12}
      width={24}
      height={24}
      fill="transparent"
      pointerEvents="all"
      onPointerDown={onCenterGripPointerDown}
      style={{ cursor: "move" }}
    />

    {/* Grip visibile centrale */}
    <rect
      x={centro.x - 4}
      y={centro.y - 4}
      width={8}
      height={8}
      fill="#ffffff"
      stroke="#2563eb"
      strokeWidth={1.5}
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  </>
)}
    </g>
  )
}