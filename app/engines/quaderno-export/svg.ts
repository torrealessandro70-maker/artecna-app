import type {
  QuadernoExportOptions,
  QuadernoSvgExport,
} from './types'

const DEFAULT_FILENAME = 'quaderno-tecnico'

const leggiDimensioneSvg = (
  svg: SVGSVGElement,
): {
  width: number
  height: number
} => {
  const viewBox = svg.viewBox.baseVal

  if (viewBox.width > 0 && viewBox.height > 0) {
    return {
      width: viewBox.width,
      height: viewBox.height,
    }
  }

  const rect = svg.getBoundingClientRect()

  return {
    width: Math.max(rect.width, 1),
    height: Math.max(rect.height, 1),
  }
}

export const esportaSvgQuaderno = (
  svg: SVGSVGElement,
  options: QuadernoExportOptions = {},
): QuadernoSvgExport => {
  const clone = svg.cloneNode(true) as SVGSVGElement
const immaginiClone = clone.querySelectorAll('image')

immaginiClone.forEach((immagine) => {
  const sorgente =
    immagine.getAttribute('href') ||
    immagine.getAttributeNS(
      'http://www.w3.org/1999/xlink',
      'href',
    )

  if (!sorgente) return

  immagine.setAttribute(
    'href',
    sorgente,
  )

  immagine.setAttributeNS(
    'http://www.w3.org/1999/xlink',
    'xlink:href',
    sorgente,
  )
})

  const {
    width,
    height,
  } = leggiDimensioneSvg(svg)

  clone.setAttribute(
    'xmlns',
    'http://www.w3.org/2000/svg',
  )

  clone.setAttribute(
    'xmlns:xlink',
    'http://www.w3.org/1999/xlink',
  )

  clone.setAttribute(
    'width',
    String(width),
  )

  clone.setAttribute(
    'height',
    String(height),
  )

  clone.setAttribute(
    'viewBox',
    `0 0 ${width} ${height}`,
  )

  if (options.backgroundColor) {
    const background = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'rect',
    )

    background.setAttribute('x', '0')
    background.setAttribute('y', '0')
    background.setAttribute(
      'width',
      String(width),
    )
    background.setAttribute(
      'height',
      String(height),
    )
    background.setAttribute(
      'fill',
      options.backgroundColor,
    )

    clone.insertBefore(
      background,
      clone.firstChild,
    )
  }

  const serializer = new XMLSerializer()

  const svgText =
    serializer.serializeToString(clone)

  return {
    svgText,
    width,
    height,
    filename:
      options.filename?.trim() ||
      DEFAULT_FILENAME,
  }
}
