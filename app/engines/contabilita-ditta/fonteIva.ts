import { centesimi } from './riepilogo'

export type SemanticaIva = 'importo' | 'aliquota'
export type GruppoIva = { indice: number; imponibile: number; iva: number; aliquota: number | null; natura: string | null }
export type VerificaIva = { semantica: SemanticaIva; riferimento: string; documento_verificato: boolean; gruppi?: Omit<GruppoIva, 'indice'>[] }
export type FonteIvaCanonica = { versione: 1; valida: boolean; codice: string; motivo: string; fonte: string; livello: string;
  imponibile: number | null; iva_importo: number | null; totale: number | null; semantica: SemanticaIva | null; gruppi: GruppoIva[] }
const amount = (x: number | null) => x === null ? null : x / 100
const text = (x: unknown) => typeof x === 'string' ? x : ''
const obj = (x: unknown): Record<string, unknown> => x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {}
export function fotografiaFonteIva(r: Record<string, unknown>): unknown[] {
  return [text(r.id),text(r.numero_fattura),text(r.data_fattura),text(r.cliente),centesimi(r.imponibile),centesimi(r.iva),centesimi(r.totale),
    ...['bluenext_identita','bluenext_impronta','bluenext_tipo','xml_url','pdf_url','note','tipo_documento','tipo_file'].map(k => r[k] ?? null)]
}
/** No inference from VAT magnitude or arithmetic alone. SQL implements this same versioned contract; parity tests cover both. */
export function risolviFonteIvaPersistita(r: Record<string, unknown>, verifica?: VerificaIva | null): FonteIvaCanonica {
  const base = centesimi(r.imponibile), field = centesimi(r.iva), total = centesimi(r.totale)
  const fail = (codice: string, motivo: string, semantica: SemanticaIva | null = null): FonteIvaCanonica => ({ versione:1,valida:false,codice,motivo,fonte:'Da verificare',livello:'NON_VERIFICABILE',imponibile:amount(base),iva_importo:null,totale:amount(total),semantica,gruppi:[] })
  if (!text(r.id) || !text(r.numero_fattura).trim() || !/^\d{4}-\d{2}-\d{2}$/.test(text(r.data_fattura)) || !text(r.cliente).trim()
    || base === null || base <= 0 || field === null || field < 0 || total === null || total <= 0) return fail('DATI_INCOMPLETI','Identità e importi del documento da verificare.')
  if (r.bluenext_tipo === 'TD04' || r.tipo_documento === 'TD04' || r.tipo_documento && !['fattura','TD01','TD02'].includes(text(r.tipo_documento))) return fail('TIPO_NON_SUPPORTATO','Nota di credito o tipo speciale: usare il percorso fiscale dedicato.')
  const saved = obj(r.fonte_iva_verificata)
  const proof = verifica ? verifica as unknown as Record<string, unknown> : saved
  const bluenext = /^[a-f0-9]{64}$/.test(text(r.bluenext_identita)) && /^[a-f0-9]{64}$/.test(text(r.bluenext_impronta)) && ['TD01','TD02'].includes(text(r.bluenext_tipo))
  if (!verifica && Object.keys(saved).length && JSON.stringify(saved.fotografia) !== JSON.stringify(fotografiaFonteIva(r))) return fail('FONTE_CAMBIATA','Dati modificati dopo la verifica documentale: ripetere il confronto con la fonte originale.')
  if (Object.keys(proof).some(k=>!['semantica','riferimento','documento_verificato','gruppi','fotografia','autore','verificata_at'].includes(k))
    || text(proof.riferimento).length > 500 || JSON.stringify(proof).length > 50000
    || proof.documento_verificato !== true || text(proof.riferimento).trim().length < 8 || !['importo','aliquota'].includes(text(proof.semantica))) {
    return fail('VERIFICA_DOCUMENTALE_RICHIESTA',bluenext ? 'Bluenext conserva un importo IVA aggregato. Verificare il documento originale; nessuna aliquota unica è deducibile.' : 'Convenzione IVA storica non documentata. Verificare se il campo indica imposta o aliquota e confrontare il documento originale.',bluenext ? 'importo' : null)
  }
  const semantic = proof.semantica as SemanticaIva
  if (bluenext && semantic !== 'importo') return fail('PROVENIENZA_DISCORDANTE','La provenienza Bluenext documenta un importo IVA, non una percentuale.')
  if (semantic === 'aliquota' && (r.xml_url || r.tipo_file === 'xml' || /import\s+xml/i.test(text(r.note)))) return fail('PROVENIENZA_DISCORDANTE','Import XML storico: il campo IVA non può essere trattato come aliquota manuale.')
  if (semantic === 'aliquota' && field > 10000) return fail('ALIQUOTA_NON_VALIDA','Aliquota documentata fuori intervallo.')
  const tax = semantic === 'importo' ? field : Number((BigInt(base) * BigInt(field) + BigInt(5000)) / BigInt(10000))
  if (base + tax !== total) return fail('QUADRATURA_DISCORDANTE','Imponibile, imposta e lordo non quadrano al centesimo; verificare altre componenti o arrotondamenti documentali.')
  const supplied = proof.gruppi
  const input: unknown[] = supplied === undefined || supplied === null ? [{ imponibile:amount(base),iva:amount(tax),aliquota:semantic === 'aliquota' ? amount(field) : null,natura:null }] : Array.isArray(supplied) ? supplied : []
  if (!input.length || input.length > 100) return fail('RIEPILOGHI_NON_VALIDI','Riepiloghi fiscali mancanti o non validi.')
  const groups: GruppoIva[] = []
  let b = 0, v = 0
  for (const [indice, raw] of input.entries()) {
    const g = obj(raw), n = centesimi(g.imponibile), i = centesimi(g.iva), rate = g.aliquota === null ? null : centesimi(g.aliquota), natura = text(g.natura) || null
    if (n === null || n <= 0 || i === null || i < 0 || g.aliquota !== null && rate === null || rate !== null && (rate < 0 || rate > 10000)
      || rate === null && (input.length !== 1 || natura !== null) || rate !== null && Number((BigInt(n) * BigInt(rate) + BigInt(5000)) / BigInt(10000)) !== i
      || rate === 0 && !/^N[1-7](\.[0-9]+)?$/.test(natura ?? '') || rate !== null && rate > 0 && natura !== null) return fail('RIEPILOGHI_NON_VALIDI','Riepiloghi, aliquote, natura e imposte non coerenti. Nessuna aliquota stimata.')
    b += n;v += i;groups.push({indice,imponibile:amount(n)!,iva:amount(i)!,aliquota:amount(rate),natura})
  }
  if (b !== base || v !== tax) return fail('RIEPILOGHI_DISCORDANTI','I riepiloghi documentali non coincidono con gli importi persistiti.')
  return { versione:1,valida:true,codice:'DOCUMENTALE_ATTESTATA',motivo:groups.some(g=>g.aliquota===null) ? 'Imposta aggregata verificata: aliquote non disponibili, consentita solo l’intera quota residua.' : 'Riepiloghi verificati sul documento originale; trasmissione SdI e incasso restano indipendenti.',
    fonte:bluenext ? 'Bluenext e verifica documentale' : 'Verifica documentale esplicita',livello:'DOCUMENTALE_ATTESTATA',imponibile:amount(base),iva_importo:amount(tax),totale:amount(total),semantica:semantic,gruppi:groups }
}
