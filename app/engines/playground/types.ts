import type { ConstructionSemanticAnalysisResult } from '../construction-knowledge'

export type EnginePlaygroundScenario = {
  id: string
  title: string
  description?: string
  userInput: string
  expectedSignals?: string[]
}

export type EnginePlaygroundResult = {
  scenario: EnginePlaygroundScenario
  summary: string
  semanticAnalysis: ConstructionSemanticAnalysisResult
  pipelineSummary: {
    scenarioId: string
    title: string
    input: string
    recognizedEntities: {
      text: string
      type: string
      confidence: number
    }[]
    kernelEvents: {
      type: string
      source: string
      createdAt: string
    }[]
    summary: string
  }
  output: unknown
}
