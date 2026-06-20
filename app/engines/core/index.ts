import type { EngineRequest, EngineResponse } from './types'

export function runEnginePipeline(
  request: EngineRequest
): EngineResponse {
  return {
    requestId: request.id,
    engine: request.engine,
    success: true,
    data: null,
    events: [],
    errors: [],
  }
}
