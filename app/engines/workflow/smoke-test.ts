import { buildPhotoWorkflow } from './photo-workflow'

type WorkflowSmokeTestCheck = {
  name: string
  passed: boolean
  reason?: string
}

export type WorkflowSmokeTestResult = {
  success: boolean
  checks: WorkflowSmokeTestCheck[]
}

export function runWorkflowEngineSmokeTest(): WorkflowSmokeTestResult {
  const checks: WorkflowSmokeTestCheck[] = []

  try {
    const workflow = buildPhotoWorkflow({
      type: 'photo',
    })

    checks.push({
      name: 'result present',
      passed: Boolean(workflow),
      reason: workflow ? undefined : 'Workflow result is missing.',
    })

    checks.push({
      name: 'workflow contains steps',
      passed: Array.isArray(workflow.steps) && workflow.steps.length > 0,
      reason:
        Array.isArray(workflow.steps) && workflow.steps.length > 0
          ? undefined
          : 'Workflow steps are missing.',
    })

    const stepTitles = workflow.steps.map((step) => step.title)

    checks.push({
      name: 'includes Photo Added step',
      passed: stepTitles.includes('Photo Added'),
      reason: stepTitles.includes('Photo Added')
        ? undefined
        : 'Photo Added step is missing.',
    })

    checks.push({
      name: 'includes Waiting User Confirmation step',
      passed: stepTitles.includes('Waiting User Confirmation'),
      reason: stepTitles.includes('Waiting User Confirmation')
        ? undefined
        : 'Waiting User Confirmation step is missing.',
    })
  } catch (error) {
    checks.push({
      name: 'smoke test completed without throw',
      passed: false,
      reason: error instanceof Error ? error.message : 'Unknown smoke test error.',
    })
  }

  return {
    success: checks.every((check) => check.passed),
    checks,
  }
}
