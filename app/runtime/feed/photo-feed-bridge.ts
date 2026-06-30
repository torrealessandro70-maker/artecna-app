import { createRuntimeFeedItem, createRuntimeFeedSnapshot } from './feed-builder'
import type { RuntimeFeedItem } from './types'

type RuntimePhotoInput = {
  id?: string
  cantiere?: string
  nota?: string
  data_foto?: string
  created_at?: string
}

export function createPhotoRuntimeFeed(
  photos: RuntimePhotoInput[] = [],
): RuntimeFeedItem[] {
  const items = photos.map((photo, index) => {
    const timestampValue = photo.data_foto || photo.created_at
    const timestamp = timestampValue ? new Date(timestampValue) : new Date()

    return createRuntimeFeedItem({
      id: `photo-${photo.id || index}`,
      timestamp,
      title: 'Foto cantiere acquisita',
      description: photo.nota || 'Nuova foto collegata al Fascicolo Cantiere.',
      category: 'photo',
      severity: 'success',
      source: 'user',
      priority: 2,
      metadata: {
        photoId: photo.id,
        cantiere: photo.cantiere,
      },
    })
  })

  return createRuntimeFeedSnapshot(items)
}
