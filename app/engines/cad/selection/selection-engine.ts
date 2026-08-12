import type { CadEntityId } from '../entities'

import type {
  CadSelectionMode,
  CadSelectionSource,
  CadSelectionState,
} from './types'

export const createSelectionState = (): CadSelectionState => ({
  selectedIds: [],
  primarySelectionId: null,
  hoveredEntityId: null,
  source: null,
})

export const clearSelection = (
  state: CadSelectionState,
): CadSelectionState => ({
  ...state,
  selectedIds: [],
  primarySelectionId: null,
})

export const isSelected = (
  state: CadSelectionState,
  entityId: CadEntityId,
): boolean => state.selectedIds.includes(entityId)

export const getSelectedIds = (
  state: CadSelectionState,
): CadEntityId[] => [...state.selectedIds]

export const setPrimarySelection = (
  state: CadSelectionState,
  entityId: CadEntityId | null,
): CadSelectionState => {
  if (entityId && !state.selectedIds.includes(entityId)) {
    return state
  }

  return {
    ...state,
    primarySelectionId: entityId,
  }
}

export const selectEntity = (
  state: CadSelectionState,
  entityId: CadEntityId,
  source: CadSelectionSource = 'pointer',
): CadSelectionState => ({
  ...state,
  selectedIds: [entityId],
  primarySelectionId: entityId,
  source,
})

export const selectEntities = (
  state: CadSelectionState,
  entityIds: CadEntityId[],
  source: CadSelectionSource = 'programmatic',
): CadSelectionState => {
  const selectedIds = [...new Set(entityIds)]

  return {
    ...state,
    selectedIds,
    primarySelectionId: selectedIds[0] ?? null,
    source,
  }
}

export const addToSelection = (
  state: CadSelectionState,
  entityId: CadEntityId,
): CadSelectionState => {
  if (state.selectedIds.includes(entityId)) {
    return state
  }

  return {
    ...state,
    selectedIds: [...state.selectedIds, entityId],
    primarySelectionId:
      state.primarySelectionId ?? entityId,
  }
}

export const removeFromSelection = (
  state: CadSelectionState,
  entityId: CadEntityId,
): CadSelectionState => {
  const selectedIds = state.selectedIds.filter(
    id => id !== entityId,
  )

  return {
    ...state,
    selectedIds,
    primarySelectionId:
      state.primarySelectionId === entityId
        ? (selectedIds[0] ?? null)
        : state.primarySelectionId,
  }
}

export const toggleSelection = (
  state: CadSelectionState,
  entityId: CadEntityId,
): CadSelectionState =>
  isSelected(state, entityId)
    ? removeFromSelection(state, entityId)
    : addToSelection(state, entityId)

export const applySelectionMode = (
  state: CadSelectionState,
  entityId: CadEntityId,
  mode: CadSelectionMode,
  source: CadSelectionSource = 'pointer',
): CadSelectionState => {
  switch (mode) {
    case 'replace':
      return selectEntity(state, entityId, source)

    case 'add':
      return addToSelection(state, entityId)

    case 'remove':
      return removeFromSelection(state, entityId)

    case 'toggle':
      return toggleSelection(state, entityId)

    default:
      return state
  }
}
