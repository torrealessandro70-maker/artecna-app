import type {
  ContextField,
  ContextResolverInput,
  ContextResolverResult,
} from './types'

function unknownField<T>(): ContextField<T> {
  return {
    value: null,
    reliability: 'UNKNOWN',
    sources: [],
  }
}

export function resolveCurrentContext(
  input: ContextResolverInput
): ContextResolverResult {
  void input

  return {
    context: {
      cantiere: unknownField<string>(),
      cliente: unknownField<string>(),
      fascicolo: unknownField<string>(),
      zona: unknownField<string>(),
      faseLavoro: unknownField<string>(),
      attivitaAperte: unknownField<string[]>(),
      materiali: unknownField<string[]>(),
      operai: unknownField<string[]>(),
      documenti: unknownField<string[]>(),
      foto: unknownField<string[]>(),
      problemi: unknownField<string[]>(),
      confidence: 0,
      needsConfirmation: true,
    },
    reasons: [{ message: 'Context Engine V1 inizializzato' }],
  }
}
