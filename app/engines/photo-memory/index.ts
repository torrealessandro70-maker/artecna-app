export type {
  ArtecnaPhoto,
  PhotoDestination,
} from './types'

export {
  buildArtecnaPhoto,
} from './builder'

export {
  allegatoToArtecnaPhoto,
  fotoGalleriaToArtecnaPhoto,
  isAllegatoImmagine,
} from './adapter'

export {
  mergePhotoMemory,
} from './memory'