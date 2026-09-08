import type { MouseEventHandler, PointerEventHandler } from 'react'
import type { CadTextEntity } from '../entities/types'
import { getCadTextLayout } from '../geometry/text-layout'

export type TextResizeHandlers = {
  onPointerDown: (event: React.PointerEvent<SVGRectElement>, side: 'left' | 'right') => void
  onPointerMove: PointerEventHandler<SVGRectElement>
  onPointerUp: PointerEventHandler<SVGRectElement>
  onPointerCancel: PointerEventHandler<SVGRectElement>
  onLostPointerCapture: PointerEventHandler<SVGRectElement>
}

type Props = {
  entity: CadTextEntity
  selected?: boolean
  resizeHandlers?: TextResizeHandlers
  onPointerDown?: PointerEventHandler<SVGGElement>
  onDoubleClick?: MouseEventHandler<SVGGElement>
}

export default function TextRenderer({ entity, selected, onPointerDown, onDoubleClick, resizeHandlers }: Props) {
  if (!entity.visible) return null
  const { bounds, textAnchor, lines, lineHeight, boxX, boxWidth, height } = getCadTextLayout(entity)
  return (
    <g
      transform={'rotate(' + entity.rotation + ' ' + entity.position.x + ' ' + entity.position.y + ')'}
      pointerEvents={entity.selectable && !entity.locked ? 'auto' : 'none'}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      data-cad-entity-id={entity.id}
      data-cad-entity-type={entity.type}
    >
      {selected && (
        <rect
          x={boxX}
          y={bounds.minY}
          width={boxWidth}
          height={height}
          fill="none"
          stroke="#2563eb"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}
      <text
        x={entity.position.x}
        y={entity.position.y}
        dominantBaseline="alphabetic"
        textAnchor={textAnchor}
        fontSize={entity.fontSize}
        fontFamily={entity.fontFamily}
        fontWeight={entity.fontWeight}
        fill={entity.color}
      >
        {lines.map((line, index) => (
          <tspan key={index} x={entity.position.x} y={entity.position.y + index * lineHeight} xmlSpace="preserve">
            {line}
          </tspan>
        ))}
      </text>
      {selected && entity.selectable && !entity.locked && resizeHandlers &&
        (['left', 'right'] as const).map(side => (
          <rect
            key={side}
            x={(side === 'left' ? boxX : boxX + boxWidth) - 4}
            y={bounds.minY + height / 2 - 4}
            width={8}
            height={8}
            fill="#ffffff"
            stroke="#2563eb"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            style={{ cursor: 'ew-resize', touchAction: 'none' }}
            onPointerDown={event => resizeHandlers.onPointerDown(event, side)}
            onPointerMove={resizeHandlers.onPointerMove}
            onPointerUp={resizeHandlers.onPointerUp}
            onPointerCancel={resizeHandlers.onPointerCancel}
            onLostPointerCapture={resizeHandlers.onLostPointerCapture}
            onClick={event => event.stopPropagation()}
            onDoubleClick={event => { event.preventDefault(); event.stopPropagation() }}
          />
        ))}
    </g>
  )
}
