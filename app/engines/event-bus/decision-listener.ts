import type { RuntimeEvent } from './types'
import { updateRuntimeState } from '../runtime'
import { DecisionBuilder } from '../decision'

export function handleDecisionEvent(event: RuntimeEvent): void {
  if (event.type !== 'photo_added') {
    return
  }

  const decisionBuilder = new DecisionBuilder()

  decisionBuilder.build({
    text: 'Foto acquisita dal Runtime',
    source: 'context',
  })

  updateRuntimeState('decision_ready')
}