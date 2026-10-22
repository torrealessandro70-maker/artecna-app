import type { PointerEventHandler } from "react"

import type { CadEntity } from "../entities"

import TextRenderer, { type TextResizeHandlers } from "./TextRenderer"
import DimensionRenderer from "./DimensionRenderer"
import LineRenderer from "./LineRenderer"
import AreaRenderer from "./AreaRenderer"

type Props = {
  entity: CadEntity
  selected?: boolean
  textResizeHandlers?: TextResizeHandlers
  onPointerDown?: PointerEventHandler<SVGGElement>
  onDoubleClick?: React.MouseEventHandler<SVGGElement>
  onCenterGripPointerDown?: PointerEventHandler<SVGRectElement>
  onStartGripPointerDown?: PointerEventHandler<SVGRectElement>
  onEndGripPointerDown?: PointerEventHandler<SVGRectElement>
onVertexGripPointerDown?: (
  event: React.PointerEvent<SVGCircleElement>,
  vertexIndex: number,
) => void
}
export default function CadEntityRenderer({
  entity,
  selected,
  textResizeHandlers,
  onPointerDown,
  onDoubleClick,
  onCenterGripPointerDown,
  onStartGripPointerDown,
  onEndGripPointerDown,
  onVertexGripPointerDown,
}: Props) {

switch (entity.type) {
  case "circle":
    if (!entity.visible) return null
    return <g onPointerDown={onPointerDown} onDoubleClick={onDoubleClick}>
      <circle cx={entity.center.x} cy={entity.center.y} r={entity.radius}
        fill={entity.fill?.color || 'none'} fillOpacity={entity.fill?.opacity}
        stroke={selected ? '#2563eb' : entity.stroke.color} strokeWidth={entity.stroke.width}
        strokeOpacity={entity.stroke.opacity} vectorEffect="non-scaling-stroke" />
    </g>
  case "polyline": {
    if (!entity.visible) return null
    const points = entity.points.map(p => p.x + ',' + p.y).join(' ')
    const props = { points, fill: entity.closed ? entity.fill?.color || 'none' : 'none', stroke: selected ? '#2563eb' : entity.stroke.color, strokeWidth: entity.stroke.width, strokeOpacity: entity.stroke.opacity }
    return <g onPointerDown={onPointerDown} onDoubleClick={onDoubleClick}>
      {entity.closed ? <polygon {...props} vectorEffect="non-scaling-stroke" /> : <polyline {...props} vectorEffect="non-scaling-stroke" />}
    </g>
  }
  case "text":
    return <TextRenderer entity={entity} selected={selected} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} resizeHandlers={textResizeHandlers} />

  case "line":
    return <LineRenderer entity={entity} />

 case "area":
  return (
    <AreaRenderer
      entity={entity}
      selected={selected}
      onPointerDown={onPointerDown}
      onVertexGripPointerDown={
        onVertexGripPointerDown
      }
    />
  )

  case "dimension":
    return (
      <DimensionRenderer
        entity={entity}
        selected={selected}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        onCenterGripPointerDown={
          onCenterGripPointerDown
        }
        onStartGripPointerDown={
          onStartGripPointerDown
        }
        onEndGripPointerDown={
          onEndGripPointerDown
        }
      />
    )

   default:
    return null
  }
}