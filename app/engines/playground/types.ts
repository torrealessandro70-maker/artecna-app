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
  output: unknown
}
