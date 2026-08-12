import type {
  OggettoGraficoQuaderno,
  SegnoNota,
  StrumentoDisegno,
} from '@/app/components/note/types'

import type {
  QuadernoLayerId,
} from '@/app/engines/quaderno-layers/types'

import {
  createCadFreehand,
  createCadImage,
  createCadLine,
  createCadPin,
} from './entity-factory'

import type {
  CadEntity,
  CadStrokeStyle,
} from './types'

const createStroke = (
  segno: SegnoNota,
): CadStrokeStyle => ({
  color: segno.colore,
  width: segno.spessore,
})

const createLegacyMetadata = (
  segno: SegnoNota,
) => ({
  ...segno.metadati,
  legacyStrumento: segno.strumento,
})

export const imageToCadEntity = (
  image: OggettoGraficoQuaderno,
): CadEntity =>
  createCadImage({
    id: image.id,
    source: image.sorgente,
    transform: {
      ...image.transform,
      scaleX: 1,
      scaleY: 1,
    },
    originalWidth: image.larghezzaIniziale,
    originalHeight: image.altezzaIniziale,
    metadata: {
      layerId: image.layerId,
    },
  })

export const segnoToCadEntity = (
  segno: SegnoNota,
): CadEntity => {
  switch (segno.strumento) {
    case 'linea': {
      const start = segno.punti[0]
      const end = segno.punti.at(-1)

      if (!start || !end) {
        throw new Error('Linea non valida')
      }

      return createCadLine({
        id: segno.id,
        start,
        end,
        stroke: createStroke(segno),
        metadata: createLegacyMetadata(segno),
      })
    }

    case 'pin': {
      const point = segno.punti[0]

      if (!point) {
        throw new Error('Pin non valido')
      }

      return createCadPin({
        id: segno.id,
        position: point,
        number: segno.metadati?.numero ?? 0,
        title: segno.metadati?.titolo,
        description: segno.metadati?.descrizione,
        metadata: createLegacyMetadata(segno),
      })
    }

    default:
      return createCadFreehand({
        id: segno.id,
        points: segno.punti,
        stroke: createStroke(segno),
        metadata: createLegacyMetadata(segno),
      })
  }
}

const getLegacyStrumento = (
  entity: CadEntity,
): StrumentoDisegno => {
  const legacyStrumento =
    entity.metadata?.legacyStrumento

  if (
    legacyStrumento === 'penna' ||
    legacyStrumento === 'evidenziatore' ||
    legacyStrumento === 'freccia' ||
    legacyStrumento === 'linea' ||
    legacyStrumento === 'rettangolo' ||
    legacyStrumento === 'cerchio' ||
 legacyStrumento === 'testo' ||
    legacyStrumento === 'gomma' ||
    legacyStrumento === 'pin'
  ) {
    return legacyStrumento
  }

  if (entity.type === 'line') {
    return 'linea'
  }

  if (entity.type === 'pin') {
    return 'pin'
  }

  return 'penna'
}

const cadMetadataToSegnoMetadata = (
  entity: CadEntity,
): SegnoNota['metadati'] => {
  const metadata = entity.metadata

  if (!metadata) {
    return undefined
  }

  return {
    numero:
      typeof metadata.numero === 'number'
        ? metadata.numero
        : undefined,

    titolo:
      typeof metadata.titolo === 'string'
        ? metadata.titolo
        : undefined,

    testo:
      typeof metadata.testo === 'string'
        ? metadata.testo
        : undefined,

fontSize:
  typeof metadata.fontSize === 'number'
    ? metadata.fontSize
    : undefined,

fontFamily:
  typeof metadata.fontFamily === 'string'
    ? metadata.fontFamily
    : undefined,

fontWeight:
  metadata.fontWeight === 'normal' ||
  metadata.fontWeight === 'bold'
    ? metadata.fontWeight
    : undefined,

fontStyle:
  metadata.fontStyle === 'normal' ||
  metadata.fontStyle === 'italic'
    ? metadata.fontStyle
    : undefined,

textDecoration:
  metadata.textDecoration === 'none' ||
  metadata.textDecoration === 'underline'
    ? metadata.textDecoration
    : undefined,

rotation:
  typeof metadata.rotation === 'number'
    ? metadata.rotation
    : undefined,

    descrizione:
      typeof metadata.descrizione === 'string'
        ? metadata.descrizione
        : undefined,

    stato:
      metadata.stato === 'nuovo' ||
      metadata.stato === 'in_lavorazione' ||
      metadata.stato === 'risolto'
        ? metadata.stato
        : undefined,

    categoria:
      metadata.categoria === 'rilievo' ||
      metadata.categoria === 'difetto' ||
      metadata.categoria === 'impianto' ||
      metadata.categoria === 'misura' ||
      metadata.categoria === 'promemoria'
        ? metadata.categoria
        : undefined,
  }
}

export const cadEntityToSegno = (
  entity: CadEntity,
): SegnoNota | null => {
  if (entity.type === 'line') {
  return {
    id: entity.id,
    layerId: entity.layerId as QuadernoLayerId,
    strumento: getLegacyStrumento(entity),
    colore: entity.stroke.color,
    spessore: entity.stroke.width,
    punti: [
      entity.start,
      entity.end,
    ],
    metadati:
      cadMetadataToSegnoMetadata(entity),
  }
}

  if (entity.type === 'freehand') {
    return {
      id: entity.id,
      strumento: getLegacyStrumento(entity),
      colore: entity.stroke.color,
      spessore: entity.stroke.width,
      punti: entity.points,
      metadati:
        cadMetadataToSegnoMetadata(entity),
    }
  }

  if (entity.type === 'pin') {
    return {
      id: entity.id,
      strumento: 'pin',
      colore: '#dc2626',
      spessore: 2,
      punti: [entity.position],
      metadati: {
        numero: entity.number,
        titolo: entity.title,
        descrizione: entity.description,
        stato:
          entity.status === 'in_progress'
            ? 'in_lavorazione'
            : entity.status === 'resolved'
              ? 'risolto'
              : 'nuovo',
      },
    }
  }

  return null
}

export const cadEntityToImage = (
  entity: CadEntity,
): OggettoGraficoQuaderno | null => {
  if (entity.type !== 'image') {
    return null
  }

  return {
    id: entity.id,
    tipo: 'immagine',
    sorgente: entity.source,
    transform: {
      x: entity.transform.x,
      y: entity.transform.y,
      width: entity.transform.width,
      height: entity.transform.height,
      rotation: entity.transform.rotation,
      locked: entity.locked,
    },
    larghezzaIniziale:
      entity.originalWidth,
    altezzaIniziale:
  entity.originalHeight,
layerId:
  entity.metadata?.layerId as
    | QuadernoLayerId
    | undefined,
  }
}
