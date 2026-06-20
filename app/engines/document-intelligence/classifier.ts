export type DocumentType =
  | 'preventivo'
  | 'fattura'
  | 'computo'
  | 'sal'
  | 'planimetria'
  | 'documento_tecnico'
  | 'immagine'
  | 'altro'

export type DocumentClassificationResult = {
  type: DocumentType
  confidence: number
  reasons: string[]
}

type NameRule = {
  type: Exclude<DocumentType, 'immagine' | 'altro'>
  pattern: RegExp
  description: string
}

const nameRules: NameRule[] = [
  {
    type: 'preventivo',
    pattern: /\b(preventivo|offerta|quotazione)\b/,
    description: 'preventivo, offerta o quotazione',
  },
  {
    type: 'fattura',
    pattern: /\b(fattura|invoice)\b/,
    description: 'fattura o invoice',
  },
  {
    type: 'computo',
    pattern: /\b(computo|cme|metrico)\b/,
    description: 'computo o metrico',
  },
  {
    type: 'sal',
    pattern: /\b(sal|stato avanzamento|avanzamento lavori)\b/,
    description: 'SAL o stato avanzamento lavori',
  },
  {
    type: 'planimetria',
    pattern: /\b(planimetria|planimetrico|pianta|layout)\b/,
    description: 'planimetria o pianta',
  },
  {
    type: 'documento_tecnico',
    pattern:
      /\b(documento tecnico|relazione tecnica|scheda tecnica|capitolato|specifica tecnica|manuale tecnico)\b/,
    description: 'documento, relazione o scheda tecnica',
  },
]

const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp'])

const normalizeFileName = (fileName: string) =>
  fileName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')

const getExtension = (fileName: string) => {
  const extensionStart = fileName.lastIndexOf('.')

  return extensionStart > 0 ? fileName.slice(extensionStart + 1).toLowerCase() : ''
}

export function classifyDocument(file: File): DocumentClassificationResult {
  const normalizedName = normalizeFileName(file.name)
  const mimeType = file.type.toLowerCase()

  for (const rule of nameRules) {
    if (rule.pattern.test(normalizedName)) {
      return {
        type: rule.type,
        confidence: 0.85,
        reasons: [`Il nome del file contiene un riferimento a ${rule.description}.`],
      }
    }
  }

  if (mimeType.startsWith('image/')) {
    return {
      type: 'immagine',
      confidence: 0.8,
      reasons: [`Il MIME type ${mimeType} identifica un'immagine.`],
    }
  }

  const extension = getExtension(file.name)

  if (imageExtensions.has(extension)) {
    return {
      type: 'immagine',
      confidence: 0.65,
      reasons: [`L'estensione .${extension} identifica un formato immagine.`],
    }
  }

  return {
    type: 'altro',
    confidence: 0.2,
    reasons: [
      `Nome file e MIME type${mimeType ? ` (${mimeType})` : ''} non contengono segnali sufficienti.`,
    ],
  }
}
