import { centesimi, dataValida, testo, type Fonti, type Periodo, type Riga, type Stato } from './riepilogo'
import { xmlFattura } from '../fatture/documento-fiscale'

export type FonteIva = 'fatture_emesse' | 'fatture_fornitori'
export type DocumentoIva = { fonte: FonteIva; id: string; numero: string; data: string; iva: number | null; motivo: string; limitato: boolean; identita: string }
export type ArchivioIva = { documenti: DocumentoIva[]; fonti: Pick<Fonti, FonteIva> }
export type QuotaIva = { valore: number | null; inclusi: number; esclusi: number; nonDatati: number; stato: Stato }
export type RigaIva = { periodo: Periodo; etichetta: string; tipo: 'mese' | 'trimestre' | 'totale'; emesse: QuotaIva; ricevute: QuotaIva; differenza: number | null; accumulata: number | null; stato: Stato }
const fonti: FonteIva[] = ['fatture_emesse', 'fatture_fornitori']
const somma = (valori: number[]): number | null => {
  let totale = 0
  for (const n of valori) { totale += n; if (!Number.isSafeInteger(totale)) return null }
  return totale
}
const elementi = (n: Document | Element, nome: string) => Array.from(n.getElementsByTagNameNS('*', nome))
function campo(n: Document | Element, nome: string): string {
  const e = elementi(n, nome)
  if (e.length !== 1 || e[0].children.length) throw Error(`Campo XML ${nome} mancante, ripetuto o non valido`)
  return e[0].textContent?.trim() || ''
}
function importo(v: unknown): number {
  const n = centesimi(v)
  if (n === null) throw Error('Importo fiscale mancante o non verificabile')
  return n
}
function aliquota(v: unknown): number {
  const n = importo(v)
  if (n < 0 || n > 10000) throw Error('Aliquota non verificabile')
  return n
}
function impostaDaBase(base: number, rate: number): number {
  const valore = (BigInt(Math.abs(base)) * BigInt(rate) + BigInt(5000)) / BigInt(10000)
  const n = Number(valore)
  if (!Number.isSafeInteger(n)) throw Error('Importo oltre la precisione verificabile')
  return base < 0 ? -n : n
}

function documento(r: Riga, fonte: FonteIva): DocumentoIva {
  const d: DocumentoIva = { fonte, id: testo(r.id), numero: testo(r.numero_fattura), data: testo(r.data_fattura), iva: null, motivo: '', limitato: false, identita: '' }
  try {
    if (!d.id || !d.numero || !dataValida(d.data)) throw Error('ID, numero o data documento mancante/non valida')
    const raw = testo(r.xml_testo)
    if (raw.trim()) {
      const xml = xmlFattura(raw)
      const generali = elementi(xml, 'DatiGeneraliDocumento')
      const beni = elementi(xml, 'DatiBeniServizi')
      if (generali.length !== 1 || beni.length !== 1) throw Error('Testata o riepilogo XML ambiguo')
      const tipo = campo(generali[0], 'TipoDocumento')
      if (!['TD01', 'TD02', 'TD03', 'TD04', 'TD05', 'TD06', 'TD24', 'TD25'].includes(tipo)) throw Error('Tipo fiscale speciale/non supportato: nessuna IVA stimata')
      if (campo(generali[0], 'Divisa') !== 'EUR') throw Error('Valuta diversa da EUR o mancante')
      if (campo(generali[0], 'Numero') !== d.numero || campo(generali[0], 'Data') !== d.data) throw Error('Identità XML diversa dal documento registrato')
      if (/^TD\d{2}$/.test(testo(r.tipo_documento)) && r.tipo_documento !== tipo) throw Error('Tipo fiscale registrato diverso da XML')
      const cedenti = elementi(xml, 'CedentePrestatore')
      if (cedenti.length !== 1) throw Error('Identità emittente XML mancante')
      const partita = elementi(cedenti[0], 'IdFiscaleIVA')
      const emittente = partita.length === 1 ? campo(partita[0], 'IdPaese') + ':' + campo(partita[0], 'IdCodice') : campo(cedenti[0], 'CodiceFiscale')
      if (!emittente) throw Error('Identità emittente XML mancante')
      d.identita = JSON.stringify([emittente, tipo, d.numero, d.data])
      const gruppi = elementi(beni[0], 'DatiRiepilogo')
      if (!gruppi.length) throw Error('DatiRiepilogo XML assenti: nessuna imposta ricostruita dalle righe')
      const segni = new Set<number>()
      const imposte = gruppi.map(g => {
        const base = importo(campo(g, 'ImponibileImporto')), iva = importo(campo(g, 'Imposta')), rate = aliquota(campo(g, 'AliquotaIVA'))
        const natura = elementi(g, 'Natura')
        if ((rate === 0 && (iva !== 0 || natura.length !== 1 || !/^N[1-7](?:\.\d)?$/.test(campo(g, 'Natura')))) || (rate > 0 && natura.length)) throw Error('Natura, aliquota e imposta XML incoerenti')
        if (impostaDaBase(base, rate) !== iva) throw Error('Base e imposta XML non riconciliabili al centesimo')
        for (const n of [base, iva]) if (n) segni.add(Math.sign(n))
        const esigibilita = elementi(g, 'EsigibilitaIVA')
        if (esigibilita.length > 1) throw Error('Esigibilità XML ambigua')
        if (esigibilita.length && campo(g, 'EsigibilitaIVA') !== 'I') d.limitato = true
        return tipo === 'TD04' ? -Math.abs(iva) : iva
      })
      if (segni.size > 1 || (tipo !== 'TD04' && segni.has(-1))) throw Error('Segni fiscali misti o non supportati')
      d.iva = somma(imposte)
      if (d.iva === null) throw Error('Somma IVA oltre la precisione verificabile')
      d.motivo = tipo === 'TD04' ? 'XML: nota di credito sottratta una sola volta' : 'XML: somma delle imposte esposte in tutti i DatiRiepilogo'
      if (d.limitato) d.motivo += '; esigibilità speciale: solo imposta esposta, nessuna liquidazione'
    } else {
      if (fonte !== 'fatture_emesse') throw Error('XML fiscale non disponibile: nessuna IVA dedotta da PDF, OCR o totale')
      if (r.xml_url || testo(r.tipo_file).toLowerCase() === 'xml' || /import\s+xml/i.test(testo(r.note))) throw Error('Import XML senza riepiloghi fiscali registrati: campo iva ambiguo')
      if (r.tipo_documento && r.tipo_documento !== 'TD01' && r.tipo_documento !== 'fattura') throw Error('Tipo fiscale manuale non supportato')
      const base = importo(r.imponibile), rate = aliquota(r.iva), totale = importo(r.totale)
      if (base < 0 || totale < 0) throw Error('Segno manuale non verificabile')
      const iva = impostaDaBase(base, rate)
      if (somma([base, iva]) !== totale) throw Error('Base, aliquota e totale manuali non coerenti')
      if (!testo(r.cliente)) throw Error('Identità cliente manuale mancante')
      d.identita = JSON.stringify([testo(r.cliente), 'manuale', d.numero, d.data])
      d.iva = iva; d.limitato = true
      d.motivo = 'Base × aliquota manuale, riconciliata con il totale; natura fiscale ed esigibilità non certificate'
    }
  } catch (error) {
    d.iva = null; d.motivo = error instanceof Error ? error.message : 'Documento fiscale non verificabile'
  }
  return d
}

/** Nessun IO: usa soltanto la fotografia delle letture già esistente. */
export function preparaArchivioIva(letture: Pick<Fonti, FonteIva>): ArchivioIva {
  const documenti = fonti.flatMap(f => letture[f].righe.map(r => documento(r, f)))
  for (const fonte of fonti) {
    const ids = new Map<string, DocumentoIva[]>(), identita = new Map<string, DocumentoIva[]>()
    for (const d of documenti.filter(d => d.fonte === fonte)) {
      for (const [mappa, key] of [[ids, d.id], [identita, d.identita]] as const) {
        if (!key) continue
        const lista = mappa.get(key) || []; lista.push(d); mappa.set(key, lista)
      }
    }
    for (const mappa of [ids, identita]) for (const gruppo of mappa.values()) if (gruppo.length > 1) {
      for (const d of gruppo) { d.iva = null; d.motivo = 'Identità duplicata nella fonte: nessuna versione scelta automaticamente' }
    }
  }
  return { documenti, fonti: letture }
}

function quota(archivio: ArchivioIva, fonte: FonteIva, periodo: Periodo): QuotaIva {
  const lettura = archivio.fonti[fonte]
  const righe = archivio.documenti.filter(d => d.fonte === fonte && (!dataValida(d.data) || (d.data >= periodo.da && d.data <= periodo.a)))
  const inclusi = righe.filter(d => d.iva !== null), nonDatati = righe.filter(d => !dataValida(d.data)).length
  const esclusi = righe.length - inclusi.length
  const nonDisponibile = ['caricamento', 'errore'].includes(lettura.stato) || (!inclusi.length && (esclusi > 0 || lettura.stato === 'parziale'))
  const valore = nonDisponibile ? null : somma(inclusi.map(d => d.iva!))
  const stato: Stato = valore === null ? 'Non calcolabile' : esclusi || lettura.stato !== 'pronta' || lettura.limite || inclusi.some(d => d.limitato) ? 'Limitato' : 'Disponibile'
  return { valore, inclusi: inclusi.length, esclusi, nonDatati, stato }
}
function riga(archivio: ArchivioIva, periodo: Periodo, etichetta: string, tipo: RigaIva['tipo']): RigaIva {
  const emesse = quota(archivio, 'fatture_emesse', periodo), ricevute = quota(archivio, 'fatture_fornitori', periodo)
  const differenza = emesse.valore === null || ricevute.valore === null ? null : somma([emesse.valore, -ricevute.valore])
  const stato = differenza === null ? 'Non calcolabile' : emesse.stato === 'Limitato' || ricevute.stato === 'Limitato' ? 'Limitato' : 'Disponibile'
  return { periodo, etichetta, tipo, emesse, ricevute, differenza, accumulata: differenza, stato }
}
export function costruisciProspettoIva(archivio: ArchivioIva, periodo: Periodo): { righe: RigaIva[]; totale: RigaIva | null; errore: string | null } {
  if (!dataValida(periodo.da) || !dataValida(periodo.a) || periodo.da > periodo.a) return { righe: [], totale: null, errore: 'Intervallo non valido' }
  const inizio = Number(periodo.da.slice(0, 4)) * 12 + Number(periodo.da.slice(5, 7)) - 1
  const fine = Number(periodo.a.slice(0, 4)) * 12 + Number(periodo.a.slice(5, 7)) - 1
  if (fine - inizio > 119) return { righe: [], totale: null, errore: 'Seleziona un intervallo massimo di 10 anni' }
  const righe: RigaIva[] = []; let progressivo: number | null = 0, trimestreDa = periodo.da
  for (let n = inizio; n <= fine; n++) {
    const anno = Math.floor(n / 12), mese = n % 12
    const da = `${String(anno).padStart(4, '0')}-${String(mese + 1).padStart(2, '0')}-01`
    const a = new Date(Date.UTC(anno, mese + 1, 0, 12)).toISOString().slice(0, 10)
    const limiti = { da: da < periodo.da ? periodo.da : da, a: a > periodo.a ? periodo.a : a }
    const corrente = riga(archivio, limiti, da.slice(0, 7), 'mese')
    progressivo = progressivo === null || corrente.differenza === null ? null : somma([progressivo, corrente.differenza])
    corrente.accumulata = progressivo; righe.push(corrente)
    if (mese % 3 === 2 || n === fine) {
      const trimestre = riga(archivio, { da: trimestreDa, a: limiti.a }, `Subtotale T${Math.floor(mese / 3) + 1} ${anno} (${trimestreDa} → ${limiti.a})`, 'trimestre')
      trimestre.accumulata = progressivo; righe.push(trimestre)
      trimestreDa = new Date(Date.UTC(anno, mese + 1, 1, 12)).toISOString().slice(0, 10)
    }
  }
  const totale = riga(archivio, periodo, 'Periodo selezionato', 'totale'); totale.accumulata = progressivo
  return { righe, totale, errore: null }
}
