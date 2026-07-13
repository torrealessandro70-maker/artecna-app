export type PhotoDestination =
  | 'quaderno'
  | 'galleria'
  | 'fascicolo'
  | 'preventivo'
  | 'ai'

export type ArtecnaPhoto = {
  id: string
  url: string
  nome?: string
  mimeType?: string
  createdAt?: string
  sopralluogoId?: string
  cantiereId?: string
  notaId?: string
  destinations: PhotoDestination[]
}