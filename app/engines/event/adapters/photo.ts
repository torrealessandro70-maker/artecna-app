import type { ConstructionEvent } from '../types'

export type PhotoEventInput = {
  id?: string | number
  cantiere_id?: string
  cantiere?: string
  data_foto?: string
  created_at?: string
  file_url?: string
  file_path?: string
  categoria?: string
  nota?: string
  [key: string]: unknown
}

function resolvePhotoDate(photo: PhotoEventInput): string {
  return photo.data_foto || photo.created_at || new Date().toISOString()
}

export function buildPhotoEvents(fotoCantiere: PhotoEventInput[]): ConstructionEvent[] {
  return fotoCantiere.map((foto, index) => ({
    id: `photo-${foto.id ?? index}`,
    source: 'photo',
    type: 'photo_added',
    title: 'Nuova foto',
    description: 'Foto aggiunta al cantiere',
    occurredAt: resolvePhotoDate(foto),
    createdAt: foto.created_at,
    entityId: foto.id != null ? String(foto.id) : undefined,
    entityType: 'photo',
    cantiereId: foto.cantiere_id || foto.cantiere,
    metadata: {
      fileUrl: foto.file_url,
      filePath: foto.file_path,
      categoria: foto.categoria,
      nota: foto.nota,
      raw: foto,
    },
  }))
}
