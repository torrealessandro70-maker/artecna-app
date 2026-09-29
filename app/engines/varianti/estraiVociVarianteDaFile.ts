import { parsePreventivoItems } from '../document-intelligence/preventivo-items'
import type { VoceFileEstratta } from './adattaFileAVariante'
import type { FormatoSorgenteFileVariante } from './types'

export type RisultatoEstrazioneVociVariante =
  | {
      stato: 'ok'
      formato: FormatoSorgenteFileVariante
      nomeFile: string
      voci: VoceFileEstratta[]
      warnings: string[]
    }
  | {
      stato: 'errore'
      codice: 'formato_non_supportato' | 'pdf_senza_testo' | 'errore_lettura'
      messaggio: string
      warnings: string[]
    }

// NaN resta distinto da zero nel parser; non viene esposto nelle voci del servizio.
const convertiNumeroTestuale = (valore: string): number => {
  const testo = valore.trim().replace(/^€\s*/, '').replace(/\s*€$/, '').trim()
  if (/^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/.test(testo)) {
    const numero = Number(testo.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(numero) ? numero : Number.NaN
  }
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(testo)) {
    return Number.NaN
  }
  const numero = Number(testo.replace(',', '.'))
  return Number.isFinite(numero) ? numero : Number.NaN
}

const numeroFinito = (valore: number | undefined): number | undefined =>
  typeof valore === 'number' && Number.isFinite(valore) ? valore : undefined

export async function estraiVociVarianteDaFile(file: File): Promise<RisultatoEstrazioneVociVariante> {
  const warnings: string[] = []
  const estensione = file.name.toLowerCase().match(/\.([^.]+)$/)?.[1]
  const formato: FormatoSorgenteFileVariante | undefined = estensione === 'pdf'
    ? 'pdf'
    : estensione === 'xlsx' || estensione === 'xls'
      ? 'excel'
      : ['jpg', 'jpeg', 'png', 'webp'].includes(estensione ?? '') ? 'immagine' : undefined
  if (!formato) {
    return { stato: 'errore', codice: 'formato_non_supportato', messaggio: 'Formato non supportato. Usa PDF, XLSX, XLS, JPG, JPEG, PNG o WEBP.', warnings }
  }

  try {
    let voci: VoceFileEstratta[]
    if (formato === 'excel') {
      const { parseExcelDocument } = await import('../document-parser/excel')
      const documento = await parseExcelDocument(file)
      warnings.push(...documento.warnings)
      voci = documento.rows.filter(riga => riga.rowType === 'voce').map(riga => ({
        descrizione: riga.descrizione,
        unitaMisura: riga.unitaMisura,
        quantita: riga.quantita,
        prezzo: riga.prezzoUnitario,
        totale: riga.totale,
        codice: riga.codice,
        categoria: riga.categoria,
        note: riga.note,
        rigaFile: riga.rowIndex,
      }))
    } else {
      const testo = formato === 'pdf'
        ? await (await import('../document-intelligence/pdf-reader')).readPdfText(file)
        : await (await import('../document-intelligence/image-reader')).readImageText(file)
      if (formato === 'pdf' && !/[\p{L}\p{N}]/u.test(testo)) {
        return {
          stato: 'errore', codice: 'pdf_senza_testo',
          messaggio: "Il PDF non contiene testo leggibile. L'OCR dei PDF scansionati non è ancora disponibile in questo percorso.",
          warnings,
        }
      }
      if (formato === 'immagine' && !testo.trim()) warnings.push('OCR completato senza testo riconosciuto.')
      voci = parsePreventivoItems(testo, convertiNumeroTestuale).map((voce, indice) => {
        if ([voce.quantita, voce.prezzo, voce.totale].some(v => v !== undefined && !Number.isFinite(v))) {
          warnings.push(`Voce ${indice + 1}: valore numerico non valido o ambiguo, lasciato non disponibile.`)
        }
        return {
          descrizione: voce.descrizione,
          codice: voce.codice,
          unitaMisura: voce.unita,
          quantita: numeroFinito(voce.quantita),
          prezzo: numeroFinito(voce.prezzo),
          totale: numeroFinito(voce.totale),
        }
      })
    }
    if (voci.length === 0) warnings.push('File letto correttamente, ma nessuna voce riconosciuta.')
    return { stato: 'ok', formato, nomeFile: file.name, voci, warnings }
  } catch {
    return { stato: 'errore', codice: 'errore_lettura', messaggio: 'Impossibile leggere o analizzare il file.', warnings }
  }
}
