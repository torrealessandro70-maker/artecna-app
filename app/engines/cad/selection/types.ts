import type {
  CadEntityId,
  CadPoint,
} from '../entities'

export type CadSelectionMode =
  | 'replace'
  | 'add'
  | 'toggle'
  | 'remove'

export type CadSelectionSource =
  | 'pointer'
  | 'selection-box'
  | 'keyboard'
  | 'command'
  | 'programmatic'

export type CadSelectionHandleType =
  | 'move'
  | 'start'
  | 'end'
  | 'vertex'
  | 'center'
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right'
  | 'rotation'

export type CadSelectionBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
  center: CadPoint
}

export type CadSelectionHandle = {
  id: string
  entityId: CadEntityId
  type: CadSelectionHandleType
  position: CadPoint
  cursor?: string
  vertexIndex?: number
}

export type CadSelectionState = {
  selectedIds: CadEntityId[]
  primarySelectionId: CadEntityId | null
  hoveredEntityId: CadEntityId | null
  source: CadSelectionSource | null
}

export type CadSelectionChange = {
  previous: CadSelectionState
  current: CadSelectionState
}

export type CadSelectionRectangle = {
  start: CadPoint
  end: CadPoint
  bounds: CadSelectionBounds
  direction: 'left-to-right' | 'right-to-left'
}

export const createEmptyCadSelectionState =
  (): CadSelectionState => ({
    selectedIds: [],
    primarySelectionId: null,
    hoveredEntityId: null,
    source: null,
  })
