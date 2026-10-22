export type RigaAnteprimaFattura = {
  numero_riga: number; descrizione: string; quantita: number; prezzo_unitario: number
  totale_riga: number; cantiere: string; unita_misura?: string; aliquota_iva?: number
}
export type AnteprimaFattura = {
  fornitore: string; partitaIva: string; numero: string; data: string; totale: string
  nomeFile: string; tipoFile: string; testoOriginale: string; righe: RigaAnteprimaFattura[]
}
export type EsitoDocumento = {
  nome: string; stato: 'importata' | 'duplicato' | 'anteprima' | 'errore' | 'non_supportato'
  motivo?: string; anteprima?: AnteprimaFattura
}
export type RiepilogoDocumenti = {
  totaleFile: number; elaborati: number; importati: number; duplicati: number
  falliti: number; nonSupportati: number; anteprime: number; esiti: EsitoDocumento[]
}
export const formatiFatture = '.pdf,.xml,.xls,.xlsx,.csv,.zip'
export function formatoFattura(nome: string) {
  const ext = nome.toLowerCase().split('.').pop() || ''
  return ['pdf', 'xml', 'xls', 'xlsx', 'csv', 'zip'].includes(ext) ? ext : null
}
export class ErroreBatchDocumenti extends Error {}
type Lettore = (file: File) => Promise<AnteprimaFattura | AnteprimaFattura[]>
export type FlussiDocumenti = {
  pdf: Lettore; xml: Lettore; tabellare: Lettore
  zip: (file: File) => Promise<EsitoDocumento[]>
}
export function riepilogaDocumenti(totaleFile: number, elaborati: number, esiti: EsitoDocumento[]): RiepilogoDocumenti {
  const conta = (stato: EsitoDocumento['stato']) => esiti.filter(e => e.stato === stato).length
  return { totaleFile, elaborati, importati: conta('importata'), duplicati: conta('duplicato'),
    falliti: conta('errore'), nonSupportati: conta('non_supportato'), anteprime: conta('anteprima'), esiti: [...esiti] }
}
// I parser e le scritture restano nei rispettivi flussi. Un errore di file non ferma i fratelli.
export async function importaBatchDocumenti(files: readonly File[], flussi: FlussiDocumenti,
  progresso: (riepilogo: RiepilogoDocumenti) => void = () => {}) {
  const esiti: EsitoDocumento[] = []
  progresso(riepilogaDocumenti(files.length, 0, esiti))
  for (let i = 0; i < files.length; i++) {
    const file = files[i], formato = formatoFattura(file.name)
    try {
      if (!formato) esiti.push({ nome: file.name, stato: 'non_supportato', motivo: 'Formato non supportato. Usare PDF, XML, XLS, XLSX, CSV o ZIP.' })
      else if (formato === 'zip') esiti.push(...await flussi.zip(file))
      else {
        const leggi = formato === 'pdf' ? flussi.pdf : formato === 'xml' ? flussi.xml : flussi.tabellare
        const result = await leggi(file)
        const anteprime = Array.isArray(result) ? result : [result]
        if (!anteprime.length) throw Error('Nessun documento riconosciuto nel file.')
        esiti.push(...anteprime.map(anteprima => ({ nome: file.name, stato: 'anteprima' as const, anteprima })))
      }
    } catch (e) {
      if (e instanceof ErroreBatchDocumenti) throw e
      esiti.push({ nome: file.name, stato: 'errore', motivo: e instanceof Error ? e.message : 'Lettura del file non riuscita.' })
    }
    progresso(riepilogaDocumenti(files.length, i + 1, esiti))
  }
  return riepilogaDocumenti(files.length, files.length, esiti)
}
