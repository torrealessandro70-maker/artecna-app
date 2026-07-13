import type { WorkflowInput, WorkflowResult } from '../workflow'
import { buildPhotoWorkflow } from '../workflow'

export type WorkflowHandler = (
  input: WorkflowInput
) => WorkflowResult

const registry: Record<string, WorkflowHandler> = {
  photo: buildPhotoWorkflow,
}

export function getWorkflowHandler(
  type: WorkflowInput['type']
): WorkflowHandler | undefined {
  return registry[type]
}