import { analyzeConstructionSemantics } from '../construction-knowledge'
import { processUserInput } from '../kernel'
import { buildReviewFromSemanticEntities } from '../review'
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
  const review = buildReviewFromSemanticEntities({
    title: scenario.title,
    summary: 'Review generata dal Playground V1',
    entities: semanticAnalysis.entities.map((entity) => ({
      text: entity.text,
      type: entity.type,
      confidence: entity.confidence,
    })),
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
    review,
    pipelineSummary,
    output,
  }
}

export function runAllEnginePlaygroundScenarios(): EnginePlaygroundResult[] {
  return playgroundScenarios.map(runEnginePlaygroundScenario)
}
