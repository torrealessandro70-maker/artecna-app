import type { CadEntity } from '../entities'
import type { CadSelectionState } from '../selection'

export const getSelectedEntities = (
  entities: CadEntity[],
  selection: CadSelectionState,
): CadEntity[] => {
  const selectedIds = new Set(
    selection.selectedIds,
  )

  return entities.filter(entity =>
    selectedIds.has(entity.id),
  )
}

export const getPrimarySelectedEntity = (
  entities: CadEntity[],
  selection: CadSelectionState,
): CadEntity | undefined => {
  if (!selection.primarySelectionId) {
    return undefined
  }

  return entities.find(
    entity =>
      entity.id === selection.primarySelectionId,
  )
}
