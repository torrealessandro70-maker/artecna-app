export type PhotoStorageProvider = 'cloud' | 'hybrid' | 'local_sync' | 'nas'

export type PhotoUploadInput = {
  dataUrl: string
  bucket: string
  folder: string
  fileName?: string
  contentType?: string
}

export type PhotoUploadResult = {
  success: boolean
  provider: PhotoStorageProvider
  filePath?: string
  fileUrl?: string
  error?: string
}

export type PhotoStorageAdapter = {
  provider: PhotoStorageProvider
  uploadPhoto(input: PhotoUploadInput): Promise<PhotoUploadResult>
}

export type PhotoRecordMetadata = {
  cantiere?: string
  rapportinoId?: string
  sopralluogoId?: string
  categoria?: string
  nota?: string
  dataFoto?: string
  geolocalizzazione?: string | null
  storageProvider?: PhotoStorageProvider
  filePath?: string
  fileUrl?: string
  thumbnailUrl?: string | null
  syncStatus?: 'not_required' | 'pending' | 'synced' | 'failed'
}
