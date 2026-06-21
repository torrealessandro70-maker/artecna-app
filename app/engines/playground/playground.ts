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
  const pipelineSummary = {
    scenarioId: scenario.id,
    title: scenario.title,
    input: scenario.userInput,
    recognizedEntities: semanticAnalysis.entities.map((entity) => ({
      text: entity.text,
      type: entity.type,
      confidence: entity.confidence,
    })),
    kernelEvents: (output.kernelState.events ?? []).map((event) => ({
      type: event.type,
      source: event.source,
      createdAt: event.createdAt,
    })),
    summary: output.summary,
  }

  return {
    scenario,
    summary: output.summary,
    semanticAnalysis,
    pipelineSummary,
    output,
  }
}

export function runAllEnginePlaygroundScenarios(): EnginePlaygroundResult[] {
  return playgroundScenarios.map(runEnginePlaygroundScenario)
}
