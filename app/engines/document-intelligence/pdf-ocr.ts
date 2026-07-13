import Tesseract from 'tesseract.js'

let pdfjsLib: any = null

export const readPdfTextWithOcr = async (
  file: File,
): Promise<string> => {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ''

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)

    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (!context) continue

    canvas.width = viewport.width
    canvas.height = viewport.height

    await page.render({
      canvasContext: context,
      viewport,
    }).promise

    const image = canvas.toDataURL('image/png')
    const result = await Tesseract.recognize(image, 'ita')

    fullText += result.data.text + '\n'
  }

  return fullText.trim()
}