import type { WorkspaceContext } from '../context-engine'

export type ArtecnaEngineName =
  | 'document-intelligence'
  | 'report'
  | 'context'
  | 'fascicle'
  | 'timeline'
  | 'decision'
  | 'memory'

export type ArtecnaKernelEventType =
  | 'workspace.updated'
  | 'document.analyzed'
  | 'report.parsed'
  | 'context.resolved'
  | 'decision.created'
  | 'fascicle.updated'
  | 'timeline.updated'
  | 'memory.updated'

export type ArtecnaKernelEvent = {
  id: string
  type: ArtecnaKernelEventType
  source: ArtecnaEngineName | 'kernel' | 'ui'
  createdAt: string
  payload?: unknown
}

export type ArtecnaKernelState = {
  workspaceContext?: WorkspaceContext
  events: ArtecnaKernelEvent[]
  registeredEngines: ArtecnaEngineName[]
}
