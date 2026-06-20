import type { Fascicle, FascicleStatus, FascicleType } from './types'

export type CreateEmptyFascicleInput = {
  type: FascicleType
  title: string
  status?: FascicleStatus
  information?: Fascicle['information']
}

export function createEmptyFascicle(
  input: CreateEmptyFascicleInput
): Fascicle {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    type: input.type,
    status: input.status ?? 'bozza',
    title: input.title,
    createdAt: now,
    updatedAt: now,
    information: input.information ?? {},
    documents: [],
    photos: [],
    notes: [],
    audio: [],
    drawings: [],
    timeline: [],
    activities: [],
    aiInsights: [],
    links: [],
  }
}
