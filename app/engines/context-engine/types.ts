export type ContextReliability =
  | 'CONFIRMED'
  | 'PROPOSED'
  | 'INFERRED'
  | 'UNKNOWN'

export type ContextSource = {
  type: string
  reference?: string
}

export type ContextReason = {
  message: string
  source?: ContextSource
}

export type ContextField<T> = {
  value: T | null
  reliability: ContextReliability
  sources: ContextSource[]
}

export type CurrentContext = {
  cantiere: ContextField<string>
  cliente: ContextField<string>
  fascicolo: ContextField<string>
  zona: ContextField<string>
  faseLavoro: ContextField<string>
  attivitaAperte: ContextField<string[]>
  materiali: ContextField<string[]>
  operai: ContextField<string[]>
  documenti: ContextField<string[]>
  foto: ContextField<string[]>
  problemi: ContextField<string[]>
  confidence: number
  needsConfirmation: boolean
}

export type ContextResolverInput = {
  text: string
}

export type ContextResolverResult = {
  context: CurrentContext
  reasons: ContextReason[]
}
