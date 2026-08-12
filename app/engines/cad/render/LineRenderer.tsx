import type { CadLineEntity } from "../entities"

type Props = {
  entity: CadLineEntity
}

export default function LineRenderer({
  entity,
}: Props) {
  if (!entity.visible) {
    return null
  }

  return (
    <line
      x1={entity.start.x}
      y1={entity.start.y}
      x2={entity.end.x}
      y2={entity.end.y}
      stroke={entity.stroke.color}
      strokeWidth={entity.stroke.width}
      strokeDasharray={entity.stroke.dashArray?.join(" ")}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      pointerEvents={entity.selectable ? "stroke" : "none"}
      data-cad-entity-id={entity.id}
      data-cad-entity-type={entity.type}
    />
  )
}