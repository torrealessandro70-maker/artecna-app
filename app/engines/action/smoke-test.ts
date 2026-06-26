import { executeAction } from './executor'

export type ActionEngineSmokeTestResult = {
  success: boolean
  checks: Array<{
    name: string
    passed: boolean
    reason?: string
  }>
}

function checkResult(
  name: string,
  condition: boolean,
  reason?: string
): ActionEngineSmokeTestResult['checks'][number] {
  return {
    name,
    passed: condition,
    reason: condition ? undefined : reason,
  }
}

export async function runActionEngineSmokeTest(): Promise<ActionEngineSmokeTestResult> {
  const dailyReportResult = await executeAction({
    type: 'open_daily_report',
  })
  const unknownActionResult = await executeAction({
    type: 'unknown_action',
  })

  const checks: ActionEngineSmokeTestResult['checks'] = [
    checkResult(
      'open_daily_report trova handler stub',
      dailyReportResult.success === false && dailyReportResult.executed === false,
      'open_daily_report deve restituire success false ed executed false'
    ),
    checkResult(
      'unknown_action non trova handler',
      unknownActionResult.success === false &&
        unknownActionResult.executed === false &&
        unknownActionResult.reason === 'Nessun handler registrato per questa azione',
      'unknown_action deve restituire nessun handler e non eseguire nulla'
    ),
  ]

  return {
    success: checks.every((check) => check.passed),
    checks,
  }
}
