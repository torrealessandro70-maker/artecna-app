import type {
  ContextField,
  ContextResolverInput,
  ContextResolverResult,
  WorkspaceEntity,
} from './types'

function unknownField<T>(): ContextField<T> {
  return {
    value: null,
    reliability: 'UNKNOWN',
    sources: [],
  }
}

function fieldFromWorkspaceEntity(
  entity: WorkspaceEntity
): ContextField<string> {
  return {
    value: entity.label ?? entity.id ?? null,
    reliability: entity.reliability,
    sources: entity.source ? [entity.source] : [],
  }
}

export function resolveCurrentContext(
  input: ContextResolverInput
): ContextResolverResult {
  const workspaceContext = input.workspaceContext
  const activeCantiere = workspaceContext?.activeCantiere

  return {
    context: {
      cantiere: activeCantiere
        ? fieldFromWorkspaceEntity(activeCantiere)
        : unknownField<string>(),
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
      lastUserInput: workspaceContext?.lastUserInput,
      confidence: activeCantiere ? 0.1 : 0,
      needsConfirmation: true,
    },
    reasons: [
      { message: 'Context Engine V1 inizializzato' },
      ...(workspaceContext
        ? [{ message: 'WorkspaceContext ricevuto dal resolver' }]
        : []),
    ],
  }
}
