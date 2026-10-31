import { leggiAnteprimaXml } from './documento-fiscale'
import JSZip from 'jszip'
import type { AnteprimaFattura, EsitoDocumento } from './import-documenti'

// Parsing estratto dall'handler ZIP precedente. Il controllo duplicati resta nel callback originale.
export async function importaXmlDaZip(file: File, numeroXml: (v: string) => number,
  importaFatturaSilenziosa: (dati: any, righe: any[]) => Promise<any>): Promise<EsitoDocumento> {
  const dati = leggiAnteprimaXml(await file.text(), file.name, numeroXml, true)
  const risultato = await importaFatturaSilenziosa({ ...dati, totale: Number(dati.totale) }, dati.righe)

    return { nome: file.name, stato: risultato.stato === 'importata' ? 'importata' : risultato.stato === 'duplicato' ? 'duplicato' : 'errore',
    ...(risultato.stato === 'errore' ? { motivo: 'Importazione XML ZIP non riuscita.' } : {}) }
}

export async function importaArchivioBluenext(file: File, numeroXml: (v: string) => number,
  importaFatturaSilenziosa: (dati: any, righe: any[]) => Promise<any>,
  leggiPdf: (file: File) => Promise<AnteprimaFattura>): Promise<EsitoDocumento[]> {
  const zip = await JSZip.loadAsync(file)
  const voci = Object.values(zip.files).filter(f => !f.dir && !f.name.toLowerCase().includes('metadato') &&
    (f.name.toLowerCase().endsWith('.xml') || f.name.toLowerCase().endsWith('.pdf')))
  if (!voci.length) throw Error(`Nessun XML o PDF trovato dentro ${file.name}.`)
  const esiti: EsitoDocumento[] = []
  for (const voce of voci) {
    try {
      const nome = voce.name.split('/').pop() || voce.name
      const estratto = new File([await voce.async('blob')], nome, { type: nome.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/xml' })
      const esito: EsitoDocumento = nome.toLowerCase().endsWith('.xml')
        ? await importaXmlDaZip(estratto, numeroXml, importaFatturaSilenziosa)
        : { nome, stato: 'anteprima', anteprima: await leggiPdf(estratto) }
      esiti.push({ ...esito, nome: `${file.name} / ${voce.name}` })
    } catch (e) { esiti.push({ nome: `${file.name} / ${voce.name}`, stato: 'errore', motivo: e instanceof Error ? e.message : 'Lettura documento ZIP non riuscita.' }) }
  }
  return esiti
}
