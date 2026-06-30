import { createPhotoSource } from '../sources'
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
  const photoSources = createPhotoSource(photos)

  const items = photoSources.map((photoSource) =>
    createRuntimeFeedItem({
      id: `photo-${photoSource.id}`,
      timestamp: photoSource.timestamp,
      title: 'Foto cantiere acquisita',
      description:
        photoSource.description || 'Nuova foto collegata al Fascicolo Cantiere.',
      category: 'photo',
      severity: 'success',
      source: 'user',
      priority: 2,
      metadata: {
        ...photoSource.metadata,
        sourceId: photoSource.sourceId,
        sourceKind: photoSource.kind,
      },
    }),
  )

  return createRuntimeFeedSnapshot(items)
}
