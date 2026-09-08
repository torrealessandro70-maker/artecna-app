import type { CadTextEntity } from '../entities/types'
import type { GeometryBounds } from './types'

export const DEFAULT_TEXT_BOX_WIDTH = 240
const textAnchors = { left: 'start', center: 'middle', right: 'end' } as const

/** position anchors the first alphabetic baseline. Width is estimated at 0.62 em
 * per UTF-16 code unit (surrogate pairs are never split). Wrapping is character
 * based and preserves whitespace, empty lines and trailing newlines.
 * Bounds/hit testing intentionally ignore rotation; rendering supports it.
 */
export const getCadTextLayout = (entity: Pick<CadTextEntity,
  'position' | 'content' | 'fontSize' | 'alignment' | 'metadata'>) => {
  const candidate = entity.metadata?.textBoxWidth
  const boxWidth = typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0
    ? candidate : DEFAULT_TEXT_BOX_WIDTH
  const fontSize = Number.isFinite(entity.fontSize) && entity.fontSize > 0 ? entity.fontSize : 16
  const advance = fontSize * 0.62
  const capacity = Math.max(1, Math.floor(boxWidth / advance))
  const lines: string[] = []
  for (const paragraph of entity.content.replace(/\r\n?/g, '\n').split('\n')) {
    let line = ''
    for (const character of paragraph) {
      if (line && line.length + character.length > capacity) {
        lines.push(line)
        line = ''
      }
      line += character
    }
    lines.push(line)
  }
  const width = lines.reduce((max, line) => Math.max(max, line.length * advance), 0)
  const lineHeight = fontSize * 1.25
  const height = fontSize + (lines.length - 1) * lineHeight
  const factor = entity.alignment === 'center' ? 0.5 : entity.alignment === 'right' ? 1 : 0
  const minX = entity.position.x - width * factor
  const minY = entity.position.y - fontSize * 0.8
  const bounds: GeometryBounds = { minX, minY, maxX: minX + width, maxY: minY + height }
  return {
    bounds,
    boxWidth,
    boxX: entity.position.x - boxWidth * factor,
    height,
    lineHeight,
    lines,
    textAnchor: textAnchors[entity.alignment],
  }
}
