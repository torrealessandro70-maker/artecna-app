import type { PointerEventHandler } from "react"

import type { CadEntity } from "../entities"

import DimensionRenderer from "./DimensionRenderer"
import LineRenderer from "./LineRenderer"
import AreaRenderer from "./AreaRenderer"

type Props = {
  entity: CadEntity
  selected?: boolean
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
  onPointerDown,
  onDoubleClick,
  onCenterGripPointerDown,
  onStartGripPointerDown,
  onEndGripPointerDown,
  onVertexGripPointerDown,
}: Props) {

switch (entity.type) {
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