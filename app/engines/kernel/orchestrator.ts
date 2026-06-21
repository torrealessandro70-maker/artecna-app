import {
  resolveCurrentContext,
  type ContextResolverResult,
  type WorkspaceContext,
} from '../context-engine'
import {
  createInitialKernelState,
  publishKernelEvent,
  registerEngine,
  updateWorkspaceContext,
} from './kernel'
import type { ArtecnaKernelState } from './types'

export type KernelOrchestratorInput = {
  userInput: string
  workspaceContext?: WorkspaceContext
}

export type KernelOrchestratorResult = {
  kernelState: ArtecnaKernelState
  contextResult: ContextResolverResult
  summary: string
}

export function processUserInput(
  input: KernelOrchestratorInput
): KernelOrchestratorResult {
  let kernelState = registerEngine(createInitialKernelState(), 'context')

  if (input.workspaceContext) {
    kernelState = updateWorkspaceContext(kernelState, input.workspaceContext)
  }

  const contextResult = resolveCurrentContext({
    text: input.userInput,
    workspaceContext: input.workspaceContext,
  })

  kernelState = publishKernelEvent(kernelState, {
    type: 'context.resolved',
    source: 'context',
    payload: contextResult,
  })

  return {
    kernelState,
    contextResult,
    summary: 'Input elaborato dal Kernel Orchestrator V1',
  }
}
