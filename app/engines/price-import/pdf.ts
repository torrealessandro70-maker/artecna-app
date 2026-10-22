import { parseSic24Geometry, type PdfGeometry, type PdfWord } from './sic24-pdf-structure'
import { normalizeUnitOfMeasure } from '../price-resolution/normalizer'
import { validatePriceImportRows } from './validator'
import { rilevaPrezzarioRegionale, erroriRigaRegionale } from './regional-metadata'
import type { PriceImportExcelInput, PriceImportPreview, PriceImportRow } from './types'

type TextItem = { str: string; width: number; height: number; transform: number[] }
type PdfLibrary = { getDocument: (options: {data: Uint8Array}) => {promise: Promise<{
  numPages: number; getPage: (n: number) => Promise<{getViewport: (o: {scale: number}) => {height: number};getTextContent: () => Promise<{items: unknown[]}>;cleanup: () => void}>;destroy: () => Promise<void>
}>} }

// Adattatore geometrico PDF.js: non interpreta codici, importi o incidenze.
export function pdfJsWords(items: readonly unknown[], height: number): PdfWord[] {
  return items.flatMap(item => {
    const t = item as TextItem
    if (!t || typeof t.str !== 'string' || !t.str.trim() || !Array.isArray(t.transform)) return []
    const top=height-t.transform[5]-t.height*0.8
    return [...t.str.matchAll(/\S+/g)].map(m=>({text:m[0],x0:t.transform[4]+t.width*m.index!/t.str.length,
      x1:t.transform[4]+t.width*(m.index!+m[0].length)/t.str.length,top,bottom:top+t.height}))
  })
}
export function previewPdfGeometry(fileName: string, pages: readonly PdfGeometry[]): PriceImportPreview {
  const records=parseSic24Geometry(pages, null)
  if(!records.some(r=>r.price!==null && r.description && r.unit))
    throw Error('PDF senza struttura SIC24 riconoscibile o regionale compatibile. Nessun dato inventato: usare un file compatibile o Excel/CSV.')
  const prezzario=rilevaPrezzarioRegionale(pages.filter(p=>p.page<=4).map(p=>p.words.map(w=>w.text).join(' ')),records.map(r=>r.code))
  const rows: PriceImportRow[]=records.map((r,i)=>({rowNumber:i+1,codice:r.code,descrizione:r.description,
    unitaMisura:normalizeUnitOfMeasure(r.unit),prezzo:r.price,fonte:prezzario.fonte,regione:prezzario.regione,anno:prezzario.anno,versione:prezzario.versione,tipoPrezzo:'regional_price_list',
    status:'valid',warnings:r.validation==='VALIDO'?[]:[`Manodopera non disponibile: ${r.reason}`],
    errors:r.validation==='AMBIGUO'?['Associazione PDF ambigua: riga bloccata']:[],
    percentualeManodopera:r.validation==='VALIDO'||prezzario.anno!==2024?r.percent:null,prezzoManodopera:r.validation==='VALIDO'||prezzario.anno!==2024?r.labour:null,paginaPdf:r.page,
  }))
  for(const row of rows) row.errors.push(...erroriRigaRegionale(row,prezzario))
  return {...validatePriceImportRows(fileName,rows),prezzario}
}
export async function buildPdfPriceImportPreview(input: PriceImportExcelInput, library?: PdfLibrary): Promise<PriceImportPreview> {
  if(input.buffer.byteLength>30*1024*1024) throw Error('PDF troppo grande: massimo 30 MB.')
  const bytes=new Uint8Array(input.buffer)
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-') throw Error('Il file selezionato non è un PDF valido.')
  if(!library) {
    const pdfjs=await import('pdfjs-dist/build/pdf.min.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs'
    library=pdfjs as unknown as PdfLibrary
  }
  const document=await library.getDocument({data:bytes}).promise
  try {
    if(document.numPages>1000) throw Error('PDF troppo lungo: massimo 1000 pagine.')
    const pages: PdfGeometry[]=[]
    for(let n=1;n<=document.numPages;n++) {
      const page=await document.getPage(n)
      try {pages.push({page:n,words:pdfJsWords((await page.getTextContent()).items,page.getViewport({scale:1}).height)})}
      finally {page.cleanup()}
    }
    return previewPdfGeometry(input.fileName,pages)
  } finally {await document.destroy()}
}
