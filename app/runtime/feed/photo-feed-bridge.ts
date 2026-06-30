import { runtimeEventFactory } from '../events'
import { createPhotoSource } from '../sources'
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
  const sources = createPhotoSource(photos)

  return runtimeEventFactory.createFeed({ sources })
}
