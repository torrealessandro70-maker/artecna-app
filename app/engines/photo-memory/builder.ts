import type {
  ArtecnaPhoto,
  PhotoDestination,
} from './types'

type BuildArtecnaPhotoInput = {
  id: string
  url: string

  nome?: string
  mimeType?: string
  createdAt?: string

  sopralluogoId?: string
  cantiereId?: string
  notaId?: string

  destinations?: PhotoDestination[]
}

const normalizzaDestinazioni = (
  destinations: PhotoDestination[] = [],
): PhotoDestination[] => {
  return [...new Set(destinations)]
}

export const buildArtecnaPhoto = (
  input: BuildArtecnaPhotoInput,
): ArtecnaPhoto => {
  return {
    id: input.id,
    url: input.url,

    nome: input.nome,
    mimeType: input.mimeType,
    createdAt: input.createdAt,

    sopralluogoId: input.sopralluogoId,
    cantiereId: input.cantiereId,
    notaId: input.notaId,

    destinations: normalizzaDestinazioni(
      input.destinations,
    ),
  }
}