import type { WorkflowInput, WorkflowResult } from '../workflow'
import { getWorkflowHandler } from './workflow-registry'

export function runWorkflowRuntime(
  input: WorkflowInput
): WorkflowResult {
  const handler = getWorkflowHandler(input.type)

  if (!handler) {
    throw new Error(`Workflow non supportato: ${input.type}`)
  }

  return handler(input)
}