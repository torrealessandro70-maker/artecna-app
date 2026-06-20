export type FascicleType =
  | 'cliente'
  | 'sopralluogo'
  | 'preventivo'
  | 'cantiere'
  | 'sal'
  | 'fattura'
  | 'archivio'

export type FascicleStatus = 'bozza' | 'attivo' | 'chiuso' | 'archiviato'

export type FascicleLinkType =
  | 'genitore'
  | 'figlio'
  | 'correlato'
  | 'origine'
  | 'destinazione'

export type FascicleAssetType =
  | 'documento'
  | 'foto'
  | 'nota'
  | 'audio'
  | 'disegno'

export type FascicleTimelineEvent = {
  id: string
  type: string
  title: string
  description?: string
  occurredAt: string
  actorId?: string
  metadata?: Record<string, string | number | boolean | null>
}

export type FascicleAsset = {
  id: string
  type: FascicleAssetType
  name: string
  createdAt: string
  mimeType?: string
  reference?: string
  metadata?: Record<string, string | number | boolean | null>
}

export type FascicleLink = {
  id: string
  type: FascicleLinkType
  targetFascicleId: string
  createdAt: string
  label?: string
}

export type Fascicle = {
  id: string
  type: FascicleType
  status: FascicleStatus
  title: string
  createdAt: string
  updatedAt: string
  information: Record<string, string | number | boolean | null>
  documents: FascicleAsset[]
  photos: FascicleAsset[]
  notes: FascicleAsset[]
  audio: FascicleAsset[]
  drawings: FascicleAsset[]
  timeline: FascicleTimelineEvent[]
  activities: string[]
  aiInsights: string[]
  links: FascicleLink[]
}
