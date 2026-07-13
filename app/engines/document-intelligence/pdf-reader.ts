let pdfjsLib: any = null

export const readPdfText = async (file: File): Promise<string> => {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ''

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()

    const pageText = textContent.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')

    fullText += ' ' + pageText
  }

  return fullText.trim()
}