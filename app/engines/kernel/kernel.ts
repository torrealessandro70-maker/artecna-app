import type { WorkspaceContext } from '../context-engine'
import type {
  ArtecnaEngineName,
  ArtecnaKernelEvent,
  ArtecnaKernelState,
} from './types'

function createEvent(
  state: ArtecnaKernelState,
  event: Omit<ArtecnaKernelEvent, 'id' | 'createdAt'>
): ArtecnaKernelEvent {
  const createdAt = new Date().toISOString()

  return {
    ...event,
    id: `${event.type}-${createdAt}-${state.events.length}`,
    createdAt,
  }
}

export function createInitialKernelState(): ArtecnaKernelState {
  return {
    workspaceContext: undefined,
    events: [],
    registeredEngines: [],
  }
}

export function registerEngine(
  state: ArtecnaKernelState,
  engineName: ArtecnaEngineName
): ArtecnaKernelState {
  if (state.registeredEngines.includes(engineName)) {
    return state
  }

  return {
    ...state,
    registeredEngines: [...state.registeredEngines, engineName],
  }
}

export function updateWorkspaceContext(
  state: ArtecnaKernelState,
  workspaceContext: WorkspaceContext
): ArtecnaKernelState {
  const event = createEvent(state, {
    type: 'workspace.updated',
    source: 'kernel',
    payload: workspaceContext,
  })

  return {
    ...state,
    workspaceContext,
    events: [...state.events, event],
  }
}

export function publishKernelEvent(
  state: ArtecnaKernelState,
  event: Omit<ArtecnaKernelEvent, 'id' | 'createdAt'>
): ArtecnaKernelState {
  return {
    ...state,
    events: [...state.events, createEvent(state, event)],
  }
}
