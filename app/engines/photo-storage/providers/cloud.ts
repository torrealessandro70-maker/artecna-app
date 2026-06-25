import { buildPhotoPath, dataUrlToBlob, getPhotoExtension } from '../adapter'
import type { PhotoStorageAdapter, PhotoUploadInput, PhotoUploadResult } from '../types'

export function createCloudPhotoStorageAdapter(supabase: any): PhotoStorageAdapter {
  return {
    provider: 'cloud',
    async uploadPhoto(input: PhotoUploadInput): Promise<PhotoUploadResult> {
      try {
        const blob = dataUrlToBlob(input.dataUrl)
        const contentType = input.contentType || blob.type || 'application/octet-stream'
        const extension = getPhotoExtension(contentType)
        const filePath = buildPhotoPath({
          folder: input.folder,
          fileName: input.fileName,
          extension,
        })

        const storageBucket = supabase.storage.from(input.bucket)
        const uploadResult = await storageBucket.upload(filePath, blob, { contentType })

        if (uploadResult.error) {
          return {
            success: false,
            provider: 'cloud',
            filePath,
            error: getReadableError(uploadResult.error),
          }
        }

        const publicUrlResult = storageBucket.getPublicUrl(filePath)

        return {
          success: true,
          provider: 'cloud',
          filePath,
          fileUrl: publicUrlResult.data?.publicUrl,
        }
      } catch (error) {
        return {
          success: false,
          provider: 'cloud',
          error: getReadableError(error),
        }
      }
    },
  }
}

function getReadableError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Errore sconosciuto durante upload foto'
}
