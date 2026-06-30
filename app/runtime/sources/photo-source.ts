import type { RuntimeSourceRecord } from './types'

type PhotoInput = {
  id?: string
  cantiere?: string
  nota?: string
  data_foto?: string
  created_at?: string
}

export function createPhotoSource(
  photos: PhotoInput[] = [],
): RuntimeSourceRecord[] {
  return photos.map((photo, index) => {
    const timestampValue = photo.data_foto || photo.created_at

    return {
      id: photo.id || `photo-${index}`,
      kind: 'photo',
      title: 'Foto cantiere',
      description: photo.nota,
      timestamp: timestampValue ? new Date(timestampValue) : new Date(),
      sourceId: photo.cantiere,
      metadata: {
        photoId: photo.id,
      },
    }
  })
}
