import type { WorkflowInput, WorkflowResult } from '../workflow'
import { buildPhotoWorkflow } from '../workflow'

export function runPhotoWorkflowRuntime(
  input: WorkflowInput
): WorkflowResult {
  return buildPhotoWorkflow(input)
}