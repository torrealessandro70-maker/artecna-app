import { analyzeConstructionSemantics } from '../construction-knowledge'
import { processUserInput } from '../kernel'
import { playgroundScenarios } from './scenarios'
import type {
  EnginePlaygroundResult,
  EnginePlaygroundScenario,
} from './types'

export function runEnginePlaygroundScenario(
  scenario: EnginePlaygroundScenario
): EnginePlaygroundResult {
  const semanticAnalysis = analyzeConstructionSemantics({
    text: scenario.userInput,
  })
  const output = processUserInput({ userInput: scenario.userInput })

  return {
    scenario,
    summary: output.summary,
    semanticAnalysis,
    output,
  }
}

export function runAllEnginePlaygroundScenarios(): EnginePlaygroundResult[] {
  return playgroundScenarios.map(runEnginePlaygroundScenario)
}
