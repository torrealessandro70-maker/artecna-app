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


export function leggiFatturaEmessaXml(contenuto: string) {
  const xml = xmlFattura(contenuto)
  const generali = elementi(xml, 'DatiGeneraliDocumento')[0]
  const cedente = elementi(xml, 'CedentePrestatore')[0]
  const cliente = elementi(xml, 'CessionarioCommittente')[0]
  const riepiloghi = elementi(xml, 'DatiRiepilogo')
  if (!generali || !cedente || !cliente || !riepiloghi.length) throw Error('Dati fiscali XML incompleti.')
  function centesimi(valore: string) {
    if (!/^-?\d+\.\d{2}$|^-?\d+$/.test(valore)) throw Error('Importo fiscale XML non valido.')
    const importo = Math.round(Number(valore) * 100)
    if (!Number.isSafeInteger(importo)) throw Error('Importo fiscale XML fuori intervallo.')
    return importo
  }
  const totali = (campo: string) => riepiloghi.reduce((somma, riga) => somma + centesimi(testo(riga, campo)), 0) / 100
  const documento = {
    numero: testo(generali, 'Numero'), data: testo(generali, 'Data'), tipo: testo(generali, 'TipoDocumento'),
    cedente: testo(cedente, 'IdPaese') + testo(cedente, 'IdCodice'),
    partitaIva: testo(cliente, 'IdCodice') ? testo(cliente, 'IdPaese') + testo(cliente, 'IdCodice') : '',
    cliente: testo(cliente, 'Denominazione') || [testo(cliente, 'Nome'), testo(cliente, 'Cognome')].filter(Boolean).join(' '),
    imponibile: totali('ImponibileImporto'), iva: totali('Imposta'),
    totale: centesimi(testo(generali, 'ImportoTotaleDocumento')) / 100,
  }
  if (!documento.numero || !/^\d{4}-\d{2}-\d{2}$/.test(documento.data) || !/^TD\d{2}$/.test(documento.tipo) || !testo(cedente, 'IdCodice') || !documento.cliente) {
    throw Error('Identità della fattura XML incompleta.')
  }
  return documento
}

export type FatturaEmessaXml = ReturnType<typeof leggiFatturaEmessaXml>

type ArchivioEmesse = {
  numero_fattura?: unknown; data_fattura?: unknown; cliente?: unknown
  imponibile?: unknown; iva?: unknown; totale?: unknown; xml_testo?: unknown; bluenext_impronta?: unknown
}

export function classificaFatturaEmessa(documento: FatturaEmessaXml, archivio: readonly ArchivioEmesse[], impronta?: string) {
  const normalizza = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('it-IT')
  const possibili = archivio.filter(f => normalizza(f.numero_fattura) === normalizza(documento.numero)
    && String(f.data_fattura ?? '').slice(0, 4) === documento.data.slice(0, 4))
  if (possibili.length === 0) return 'Nuova'
  if (possibili.length > 1) return 'Ambigua'
  const [fattura] = possibili
  if (fattura.data_fattura !== documento.data || normalizza(fattura.cliente) !== normalizza(documento.cliente)
    || (['imponibile', 'iva', 'totale'] as const).some(campo => fattura[campo] == null
      || Math.round(Number(fattura[campo]) * 100) !== Math.round(documento[campo] * 100))) return 'Modificata'
  if (fattura.bluenext_impronta && impronta) return fattura.bluenext_impronta === impronta ? 'Già presente' : 'Modificata'
  if (typeof fattura.xml_testo !== 'string' || !fattura.xml_testo) return 'Ambigua'
  try {
    const origine = leggiFatturaEmessaXml(fattura.xml_testo)
    return origine.tipo === documento.tipo && origine.cedente === documento.cedente && origine.partitaIva === documento.partitaIva
      ? 'Già presente' : 'Modificata'
  } catch {
    return 'Ambigua'
  }
}


export type VoceBluenext = {
  nome: string
  documento?: FatturaEmessaXml
  xml?: string
  impronta?: string
  stato: string
}

export function riepilogaBluenext(voci: readonly VoceBluenext[], archivio: readonly ArchivioEmesse[]) {
  const gruppi = new Map<string, { voce: VoceBluenext; documento: FatturaEmessaXml }[]>()
  const scarti: VoceBluenext[] = []
  for (const voce of voci) {
    const { documento } = voce
    if (!documento) {
      scarti.push(voce)
      continue
    }
    const identita = JSON.stringify([documento.cedente.toUpperCase(), documento.data.slice(0, 4), documento.numero.toUpperCase()])
    const gruppo = gruppi.get(identita) ?? []
    gruppo.push({ voce, documento })
    gruppi.set(identita, gruppo)
  }

  const periodi = new Map<string, { documenti: number; nuove: number; presenti: number; modificate: number; ambigue: number }>()
  const esiti = []
  for (const gruppo of gruppi.values()) {
    const [{ voce, documento }] = gruppo
    const versioni = new Set(gruppo.map(({ voce: v, documento: d }) => v.impronta ?? JSON.stringify(Object.values(d))))
    const chiave = versioni.size > 1 && !gruppo.every(riga => riga.documento.data === documento.data)
      ? documento.data.slice(0, 4) : documento.data.slice(0, 4) + ' Q' + Math.ceil(Number(documento.data.slice(5, 7)) / 3)
    const stato = versioni.size > 1 ? 'Ambigua' : classificaFatturaEmessa(documento, archivio, voce.impronta)
    esiti.push({ ...voce, documento, stato, copie: gruppo.length, fonti: [...new Set(gruppo.map(riga => riga.voce.nome))] })
    const contatori = periodi.get(chiave) ?? { documenti: 0, nuove: 0, presenti: 0, modificate: 0, ambigue: 0 }
    contatori.documenti++
    if (stato === 'Nuova') contatori.nuove++
    else if (stato === 'Già presente') contatori.presenti++
    else if (stato === 'Modificata') contatori.modificate++
    else contatori.ambigue++
    periodi.set(chiave, contatori)
  }

  const anni = new Map<string, number>()
  for (const [periodo, { documenti }] of periodi) {
    const anno = periodo.slice(0, 4)
    anni.set(anno, (anni.get(anno) ?? 0) + documenti)
  }
  return {
    esiti, scarti,
    periodi: [...periodi].sort(([a], [b]) => a.localeCompare(b)),
    anni: [...anni].sort(([a], [b]) => a.localeCompare(b)),
  }
}
