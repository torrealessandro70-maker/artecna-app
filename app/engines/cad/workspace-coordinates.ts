import type { CadPoint } from "./entities/types"


export type CadWorkspacePagePosition = {
  workspaceX?: number
  workspaceY?: number
}

export const pagePointToWorkspacePoint = (
  point: CadPoint,
  page: CadWorkspacePagePosition,
): CadPoint => {
  return {
    x: point.x + (page.workspaceX ?? 0),
    y: point.y + (page.workspaceY ?? 0),
  }
}

export const workspacePointToPagePoint = (
  point: CadPoint,
  page: CadWorkspacePagePosition,
): CadPoint => {
  return {
    x: point.x - (page.workspaceX ?? 0),
    y: point.y - (page.workspaceY ?? 0),
  }
}
