import type { ParsedDocument } from './types'

export const parsePdfDocument = async (
  file: File,
): Promise<ParsedDocument> => {
  return {
    source: 'pdf',
    fileName: file.name,
    rows: [],
    warnings: [],
  }
}