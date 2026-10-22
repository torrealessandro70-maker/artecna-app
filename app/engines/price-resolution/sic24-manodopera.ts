import { datiManodoperaSic24, fontePdfSic24Sha256 } from './sic24-manodopera-data'
import { normalizeUnitOfMeasure } from './normalizer'
import type { PriceKnowledgeItem } from './types'

export type QuotaManodoperaSic24 = {
  fonte: 'SIC24'; prezzoCompleto: number; percentualeManodopera: number; prezzoManodopera: number
  unitaMisura: string; paginaPdf: number; sha256Pdf: string; metodo: 'Incidenza manodopera ufficiale SIC24'
  tipoRichiesta: 'sola_posa'
}

// Identifica lo snapshot della descrizione importata, non estrae dati dal testo.
// Non è una firma di autenticazione: la provenienza è il PDF con SHA-256 certificato.
export function improntaDescrizioneSic24(testo: string): string {
  // FNV a 64 bit su due parole unsigned: primo = 2^40 + 435.
  // I prodotti intermedi restano sotto 2^53, quindi Number è esatto.
  let alto = 0xcbf29ce4, basso = 0x84222325, length = 0
  for (const char of testo) {
    basso = (basso ^ char.codePointAt(0)!) >>> 0
    const prodotto = basso * 435
    alto = (alto * 435 + basso * 256 + Math.floor(prodotto / 0x100000000)) >>> 0
    basso = prodotto >>> 0
    length++
  }
  return `${length}:${alto.toString(16).padStart(8, '0')}${basso.toString(16).padStart(8, '0')}`
}

export function quaternaManodoperaValida(prezzo: number, percentuale: number, importo: number): boolean {
  return [prezzo, percentuale, importo].every(Number.isFinite) && prezzo > 0 &&
    percentuale > 0 && percentuale <= 100 && importo > 0 && importo <= prezzo &&
    Math.abs(prezzo * percentuale / 100 - importo) <= 0.02 + 1e-10
}

export function quotaUfficialeManodoperaSic24(item: PriceKnowledgeItem): QuotaManodoperaSic24 | null {
  if (item.tipo_prezzo === 'artecna' || !item.codice || !/^SIC24_\d+(?:\.\d+){2,}$/.test(item.codice)) return null
  const dato = datiManodoperaSic24[item.codice]
  if (!dato || Number(item.prezzo_unitario) !== dato[1] || normalizeUnitOfMeasure(item.unita_misura) !== dato[0] ||
      improntaDescrizioneSic24(item.descrizione) !== dato[5] || !quaternaManodoperaValida(dato[1], dato[2], dato[3])) return null
  return { fonte: 'SIC24', prezzoCompleto: dato[1], percentualeManodopera: dato[2], prezzoManodopera: dato[3],
    unitaMisura: dato[0], paginaPdf: dato[4], sha256Pdf: fontePdfSic24Sha256, metodo: 'Incidenza manodopera ufficiale SIC24', tipoRichiesta: 'sola_posa' }
}
