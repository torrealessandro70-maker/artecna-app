export type SopralluogoMemoryNotebook = {
  titolo: string
  testo: string
}

export type SopralluogoMemory = {
  sopralluogoId: string

  descrizioneIniziale: string

  quaderno: SopralluogoMemoryNotebook | null

  testoUnificato: string

  lastUpdated: Date
}

export type BuildSopralluogoMemoryInput = {
  sopralluogoId: string

  descrizioneIniziale?: string

  quaderno?: SopralluogoMemoryNotebook | null
}

export type MemorySourceIdentity = {
  source_id: string
  source_version?: string
  updated_at?: string
}

export type MemorySource = MemorySourceIdentity & (
  | { source_type: 'descrizione'; origine: 'sopralluogo' | 'cantiere' | 'variante'; testo: string }
  | { source_type: 'nota'; origine: 'sopralluogo' | 'quaderno' | 'variante'; titolo?: string; testo: string }
)

export type ComposedMemory = {
  fonti: MemorySource[]
  testoUnificato: string
}
