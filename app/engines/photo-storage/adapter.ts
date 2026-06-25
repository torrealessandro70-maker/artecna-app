const DEFAULT_EXTENSION = 'bin'

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/svg+xml': 'svg',
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/)

  if (!match) {
    throw new Error('Data URL foto non valido')
  }

  const mimeType = match[1] || 'application/octet-stream'
  const isBase64 = Boolean(match[2])
  const payload = match[3]
  const binary = isBase64 ? decodeBase64(payload) : decodeURIComponent(payload)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type: mimeType })
}

export function getPhotoExtension(mimeType: string): string {
  const normalizedMimeType = mimeType.split(';')[0]?.trim().toLowerCase()

  if (!normalizedMimeType) {
    return DEFAULT_EXTENSION
  }

  return MIME_EXTENSION_MAP[normalizedMimeType] || DEFAULT_EXTENSION
}

export function buildPhotoPath(input: {
  folder: string
  fileName?: string
  extension: string
}): string {
  const folder = normalizeFolder(input.folder)
  const extension = normalizeExtension(input.extension)
  const fileName = normalizeFileName(input.fileName || createPhotoFileName())
  const fileNameWithExtension = fileName.endsWith(`.${extension}`)
    ? fileName
    : `${fileName}.${extension}`

  return folder ? `${folder}/${fileNameWithExtension}` : fileNameWithExtension
}

function decodeBase64(payload: string): string {
  if (typeof atob === 'function') {
    return atob(payload)
  }

  return Buffer.from(payload, 'base64').toString('binary')
}

function createPhotoFileName(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 10)

  return `photo-${timestamp}-${random}`
}

function normalizeFolder(folder: string): string {
  return folder
    .split(/[\\/]+/)
    .map((segment) => sanitizePathSegment(segment))
    .filter(Boolean)
    .join('/')
}

function normalizeFileName(fileName: string): string {
  const normalized = sanitizePathSegment(fileName)

  return normalized || createPhotoFileName()
}

function normalizeExtension(extension: string): string {
  const normalized = extension.replace(/^\.+/, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()

  return normalized || DEFAULT_EXTENSION
}

function sanitizePathSegment(segment: string): string {
  return segment
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
}
