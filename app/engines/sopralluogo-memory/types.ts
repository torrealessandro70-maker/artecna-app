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