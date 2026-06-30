import type { RuntimeSourceRecord } from './types'

type SalCountInput = {
  count?: number
  cantiere?: string
  updatedAt?: string
}

export function createSalSource(
  input: SalCountInput = {},
): RuntimeSourceRecord[] {
  const count = input.count ?? 0

  if (count <= 0) {
    return []
  }

  return [
    {
      id: `sal-${input.cantiere || 'cantiere'}`,
      kind: 'activity',
      title: 'Stati Avanzamento Lavori',
      description: `${count} SAL presenti nel Fascicolo.`,
      timestamp: input.updatedAt ? new Date(input.updatedAt) : new Date(),
      sourceId: input.cantiere,
      metadata: {
        salCount: count,
      },
    },
  ]
}
