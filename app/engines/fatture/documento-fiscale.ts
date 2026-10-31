import type { AnteprimaFattura } from './import-documenti'

export type RiferimentoFiscale = { numero: string; data: string; linee: string[] }
export type MetadatiFiscali = {
  tipoDocumento: string
  riferimenti: RiferimentoFiscale[]
}
const elementi = (nodo: Document | Element, nome: string) =>
  Array.from(nodo.getElementsByTagNameNS('*', nome))
const testo = (nodo: Document | Element, nome: string) => elementi(nodo, nome)[0]?.textContent?.trim() || ''

export function xmlFattura(testoOriginale: string): Document {
  const xml = new DOMParser().parseFromString(testoOriginale, 'text/xml')
  if (elementi(xml, 'parsererror').length || /<!DOCTYPE|<!ENTITY/i.test(testoOriginale)) {
    throw Error('XML fattura non valido o con dichiarazioni esterne non ammesse.')
  }
  if (elementi(xml, 'FatturaElettronicaBody').length !== 1) {
    throw Error('È richiesto un solo documento fiscale per XML.')
  }
  return xml
}

export function leggiMetadatiFiscali(testoOriginale: string): MetadatiFiscali {
  const xml = xmlFattura(testoOriginale)
  const generali = elementi(xml, 'DatiGeneraliDocumento')[0]
  const tipoDocumento = generali ? testo(generali, 'TipoDocumento') : ''
  if (!/^TD\d{2}$/.test(tipoDocumento)) throw Error('TipoDocumento XML mancante o non valido.')
  return {
    tipoDocumento,
    riferimenti: elementi(xml, 'DatiFattureCollegate').map(r => ({
      numero: testo(r, 'IdDocumento'), data: testo(r, 'Data'),
      linee: elementi(r, 'RiferimentoNumeroLinea').map(l => l.textContent?.trim() || ''),
    })),
  }
}

// Il codice fiscale proviene dall'XML, mai dal segno o dal nome del file.
// Per i record storici con tipo legacy l'XML rimane la fonte autorevole.
export function tipoFiscaleDocumento(documento: { tipo_documento?: unknown; xml_testo?: unknown }): string | null {
  if (typeof documento.xml_testo === 'string' && documento.xml_testo.trim()) {
    return leggiMetadatiFiscali(documento.xml_testo).tipoDocumento || null
  }
  return typeof documento.tipo_documento === 'string' && /^TD\d{2}$/.test(documento.tipo_documento)
    ? documento.tipo_documento : null
}

export function leggiAnteprimaXml(testoOriginale: string, nomeFile: string,
  numero: (v: string) => number, totaliIvaInclusa = false): AnteprimaFattura {
  const xml = xmlFattura(testoOriginale)
  const fiscale = leggiMetadatiFiscali(testoOriginale)
  const cedente = elementi(xml, 'CedentePrestatore')[0]
  const generali = elementi(xml, 'DatiGeneraliDocumento')[0]
  if (!cedente || !generali) throw Error('Testata fiscale XML incompleta.')
  return {
    fornitore: testo(cedente, 'Denominazione') || testo(cedente, 'Nome'),
    partitaIva: testo(cedente, 'IdCodice'), numero: testo(generali, 'Numero'),
    data: testo(generali, 'Data'), totale: testo(generali, 'ImportoTotaleDocumento'),
    nomeFile, tipoFile: 'xml', testoOriginale, ...fiscale,
    righe: elementi(xml, 'DettaglioLinee').map((riga, i) => {
      const totaleXml = numero(testo(riga, 'PrezzoTotale'))
      const aliquota = numero(testo(riga, 'AliquotaIVA'))
      return {
        numero_riga: Number(testo(riga, 'NumeroLinea') || i + 1),
        descrizione: testo(riga, 'Descrizione'), quantita: numero(testo(riga, 'Quantita') || '1'),
        prezzo_unitario: numero(testo(riga, 'PrezzoUnitario')), aliquota_iva: aliquota,
        unita_misura: testo(riga, 'UnitaMisura'), cantiere: '',
        // Compatibilità ZIP ordinari; nessuna trasformazione dei valori della nota.
        totale_riga: totaliIvaInclusa && fiscale.tipoDocumento !== 'TD04'
          ? totaleXml + totaleXml * aliquota / 100 : totaleXml,
      }
    }),
  }
}
