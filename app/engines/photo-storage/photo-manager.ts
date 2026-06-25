import { createCloudPhotoStorageAdapter } from './providers/cloud'

export type SavePhotoRecordInput = {
  cantiere: string
  categoria: string
  nota?: string
  dataFoto?: string
  geolocalizzazione?: string | null
  rapportinoId?: string | null
  sopralluogoId?: string | null
  dataUrls: string[]
  bucket: string
  folder: string
}

export type SavePhotoRecordResult = {
  success: boolean
  photos: Array<{
    cantiere: string
    nota: string
    categoria: string
    data_foto: string
    geolocalizzazione: string | null
    rapportino_id?: string | null
    sopralluogo_id?: string | null
    file_url: string
    file_path: string
    immagine_base64: string
    storage_provider: 'cloud'
    sync_status: 'not_required'
  }>
  uploadedPaths: string[]
  error?: string
}

export async function buildPhotoRecordsWithStorage(
  supabase: any,
  input: SavePhotoRecordInput
): Promise<SavePhotoRecordResult> {
  if (!input.cantiere.trim()) {
    return {
      success: false,
      photos: [],
      uploadedPaths: [],
      error: 'Cantiere mancante',
    }
  }

  if (input.dataUrls.length === 0) {
    return {
      success: false,
      photos: [],
      uploadedPaths: [],
      error: 'Nessuna foto da salvare',
    }
  }

  const adapter = createCloudPhotoStorageAdapter(supabase)
  const photos: SavePhotoRecordResult['photos'] = []
  const uploadedPaths: string[] = []
  const dataFoto = input.dataFoto || new Date().toISOString().slice(0, 10)

  for (const dataUrl of input.dataUrls) {
    const upload = await adapter.uploadPhoto({
      dataUrl,
      bucket: input.bucket,
      folder: input.folder,
    })

    if (!upload.success || !upload.filePath || !upload.fileUrl) {
      await rollbackUploadedPhotos(supabase, input.bucket, uploadedPaths)

      return {
        success: false,
        photos: [],
        uploadedPaths,
        error: upload.error || 'Upload foto non completato',
      }
    }

    uploadedPaths.push(upload.filePath)
    photos.push({
      cantiere: input.cantiere,
      nota: input.nota || '',
      categoria: input.categoria,
      data_foto: dataFoto,
      geolocalizzazione: input.geolocalizzazione || null,
      rapportino_id: input.rapportinoId || null,
      sopralluogo_id: input.sopralluogoId || null,
      file_url: upload.fileUrl,
      file_path: upload.filePath,
      immagine_base64: upload.fileUrl,
      storage_provider: 'cloud',
      sync_status: 'not_required',
    })
  }

  return {
    success: true,
    photos,
    uploadedPaths,
  }
}

async function rollbackUploadedPhotos(
  supabase: any,
  bucket: string,
  paths: string[]
) {
  if (paths.length === 0) return

  try {
    const { error } = await supabase.storage.from(bucket).remove(paths)

    if (error) {
      console.error('Errore rollback foto Storage:', error.message)
    }
  } catch (error) {
    console.error('Errore di rete durante il rollback foto Storage:', error)
  }
}
