import type {
  QuadernoPageFormat,
  QuadernoPageLayout,
  QuadernoPageOrientation,
} from './types'

type PageSize = {
  width: number
  height: number
}

const PAGE_SIZES: Record<
  QuadernoPageFormat,
  PageSize
> = {
  A4: {
    width: 794,
    height: 1123,
  },
  A3: {
    width: 1123,
    height: 1587,
  },
}

export const createQuadernoPageLayout = (
  format: QuadernoPageFormat = 'A4',
  orientation: QuadernoPageOrientation =
    'landscape',
): QuadernoPageLayout => {
  const size = PAGE_SIZES[format]

  const portrait = {
    width: size.width,
    height: size.height,
  }

  const dimensions =
    orientation === 'portrait'
      ? portrait
      : {
          width: portrait.height,
          height: portrait.width,
        }

  return {
    format,
    orientation,
    width: dimensions.width,
    height: dimensions.height,
    margin: 24,
  }
}
