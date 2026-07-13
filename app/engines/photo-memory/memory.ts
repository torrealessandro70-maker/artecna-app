import type { ArtecnaPhoto } from './types'

export const mergePhotoMemory = (
  ...collections: ArtecnaPhoto[][]
): ArtecnaPhoto[] => {
  const map = new Map<string, ArtecnaPhoto>()

  for (const collection of collections) {
    for (const photo of collection) {
      map.set(photo.id, photo)
    }
  }

  return [...map.values()]
}