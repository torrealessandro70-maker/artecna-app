import JSZip from 'jszip'
import type { AnteprimaFattura, EsitoDocumento } from './import-documenti'

// Parsing estratto dall'handler ZIP precedente. Il controllo duplicati resta nel callback originale.
export async function importaXmlDaZip(file: File, numeroXml: (v: string) => number,
  importaFatturaSilenziosa: (dati: any, righe: any[]) => Promise<any>): Promise<EsitoDocumento> {
  const nomeFile = file.name
  const testo = await file.text()
  const parser = new DOMParser()
  const xml = parser.parseFromString(testo, 'text/xml')
  if (xml.getElementsByTagName('parsererror')[0]) throw Error('Il file XML non sembra valido.')

  const datiGeneraliDocumento = xml.getElementsByTagName('DatiGeneraliDocumento')[0]
  const cedente = xml.getElementsByTagName('CedentePrestatore')[0]
  const datiAnagrafici = cedente?.getElementsByTagName('DatiAnagrafici')[0]
  const idFiscaleIva = datiAnagrafici?.getElementsByTagName('IdFiscaleIVA')[0]

  const fornitore =
    datiAnagrafici?.getElementsByTagName('Denominazione')[0]?.textContent?.trim() ||
    datiAnagrafici?.getElementsByTagName('Nome')[0]?.textContent?.trim() ||
    'Fornitore XML'

  const partitaIva =
    idFiscaleIva?.getElementsByTagName('IdCodice')[0]?.textContent?.trim() || ''

  const numero =
    datiGeneraliDocumento?.getElementsByTagName('Numero')[0]?.textContent?.trim() ||
    nomeFile

  const data =
    datiGeneraliDocumento?.getElementsByTagName('Data')[0]?.textContent?.trim() ||
    new Date().toISOString().slice(0, 10)

  const totale =
    numeroXml(
      datiGeneraliDocumento?.getElementsByTagName('ImportoTotaleDocumento')[0]?.textContent?.trim() ||
        '0'
    )

  const dettaglioLinee = Array.from(xml.getElementsByTagName('DettaglioLinee'))

  const righe = dettaglioLinee.map((riga, index) => {
    const numeroLinea = Number(
      riga.getElementsByTagName('NumeroLinea')[0]?.textContent?.trim() || index + 1
    )

    const descrizione =
      riga.getElementsByTagName('Descrizione')[0]?.textContent?.trim() || ''

    const quantita = numeroXml(
      riga.getElementsByTagName('Quantita')[0]?.textContent?.trim() || '1'
    )

    const prezzoUnitario = numeroXml(
      riga.getElementsByTagName('PrezzoUnitario')[0]?.textContent?.trim() || '0'
    )

    const prezzoTotale = numeroXml(
      riga.getElementsByTagName('PrezzoTotale')[0]?.textContent?.trim() || '0'
    )

   const aliquotaIva = numeroXml(
  riga.getElementsByTagName('AliquotaIVA')[0]
    ?.textContent?.trim() || '0'
)

const totaleIvaInclusa =
  prezzoTotale + prezzoTotale * aliquotaIva / 100

return {
  numero_riga: numeroLinea,
  descrizione,
  quantita,
  prezzo_unitario: prezzoUnitario,
  aliquota_iva: aliquotaIva,
  totale_riga: totaleIvaInclusa,
  cantiere: '',
}
  })

  const risultato = await importaFatturaSilenziosa(
    {
      fornitore,
      partitaIva,
      numero,
      data,
      totale,
      nomeFile,
      tipoFile: 'xml',
      testoOriginale: testo,
    },
    righe
  )

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
