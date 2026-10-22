import type { PriceImportDocument, PriceImportRow } from './types'

// Identità documentale: nessuna deduzione dal solo nome del file.
export function rilevaPrezzarioRegionale(testi: readonly string[], codici: readonly string[]): PriceImportDocument {
  const codes = codici.map(c => c.trim()).filter(Boolean)
  if (!codes.length) throw Error('Prezzario senza codici strutturali riconoscibili.')
  const years = new Set<number>()
  for (const text of testi) {
    for (const match of text.matchAll(/\b(?:prezzario|prezziario)[^\n]{0,110}?\b(?:anno|edizione)\s*[:\-]?\s*(20\d{2})\b/gi)) years.add(Number(match[1]))
    for (const match of text.matchAll(/\b(?:prezzario|prezziario)\s+(20\d{2})\b/gi)) years.add(Number(match[1]))
    for (const match of text.matchAll(/\b(?:prezzario|prezziario)(?:\s+(?:unico|regionale|regione|della|di|dei|sicilia|siciliana|per|i|lavori|pubblici|in)){1,15}\s+(20\d{2})\b/gi)) years.add(Number(match[1]))
    for (const match of text.matchAll(/(?:^|\n)\s*(?:anno|edizione)\s*[:;,]?\s*(20\d{2})\s*(?:\n|$)/gi)) years.add(Number(match[1]))
    for (const match of text.matchAll(/\b(?:versione|fonte|prezzario)\s*[:;]?\s*SIC(\d{2})\b/gi)) years.add(2000 + Number(match[1]))
  }
  const prefixes = new Set<string>()
  let bare = 0
  for (const code of codes) {
    const match = /^SIC(\d{2})_\d+(?:\.\d+)+$/.exec(code)
    if (match) { prefixes.add(`SIC${match[1]}_`); years.add(2000 + Number(match[1])) }
    else if (/^\d+(?:\.\d+)+$/.test(code)) bare++
    else throw Error(`Codice incompatibile con il prezzario regionale: ${code}`)
  }
  if (years.size !== 1 || prefixes.size > 1 || (prefixes.size && bare))
    throw Error('Anno/versione del prezzario non identificabile o documento ambiguo: importazione bloccata.')
  const text = testi.join('\n')
  if (/\bfonte\s*[:;]\s*ARTECNA\b/i.test(text)) throw Error('Fonte dichiarata non regionale: documento ambiguo.')
  if (/\bregione\s+(?:lazio|lombardia|toscana|piemonte|veneto|campania|puglia|calabria|sardegna|liguria|umbria|marche|abruzzo|molise|basilicata|emilia|friuli|trentino|valle)\b/i.test(text))
    throw Error('Regione dichiarata incompatibile con i codici SIC: documento ambiguo.')
  if (!prefixes.size && !/\bsicilia(?:na|no)?\b/i.test(text))
    throw Error('Regione non identificabile nel documento: importazione bloccata.')
  const anno = [...years][0]
  return { fonte: 'Regione Sicilia', regione: 'Sicilia', anno, versione: `SIC${String(anno).slice(-2)}`,
    tipoPrezzo: 'regional_price_list', prefissoCodice: [...prefixes][0] || null,
    evidenza: prefixes.size ? 'Prefisso dei codici interni e intestazioni coerenti' : 'Intestazione interna Sicilia/anno; codici originali senza prefisso preservati' }
}

export function erroriRigaRegionale(row: PriceImportRow, documento?: PriceImportDocument): string[] {
  if (row.tipoPrezzo !== 'regional_price_list') return []
  const errors: string[] = []
  const prefix = /^SIC(\d{2})_/.exec(row.codice)
  const future = (row.anno ?? 0) > 2024 || (!!prefix && Number(prefix[1]) > 24)
  if (documento || future) {
    const year = row.anno
    if (!year || !Number.isInteger(year) || year < 2000 || year > 2099 ||
        row.versione !== `SIC${String(year).slice(-2)}` || row.fonte !== 'Regione Sicilia' || row.regione !== 'Sicilia')
      errors.push('Identità anno/versione/fonte regionale incoerente.')
    if (prefix && 2000 + Number(prefix[1]) !== year) errors.push('Prefisso codice incompatibile con anno/versione.')
    if (documento && (row.anno !== documento.anno || row.versione !== documento.versione || row.fonte !== documento.fonte ||
        (documento.prefissoCodice ? !row.codice.startsWith(documento.prefissoCodice) : !/^\d+(?:\.\d+)+$/.test(row.codice))))
      errors.push('Codice o versione non coerenti con il documento rilevato.')
  }
  // Compatibilità SIC24: il risultato certificato 2024 non viene riclassificato.
  if (future && row.percentualeManodopera != null && row.prezzoManodopera != null) {
    const pct = row.percentualeManodopera, quota = row.prezzoManodopera, price = row.prezzo
    if (price == null || ![price, pct, quota].every(Number.isFinite) || price <= 0 || pct < 0 || pct > 100 || quota < 0 || quota > price ||
        Math.abs(price * pct / 100 - quota) > 0.02 + 1e-10)
      errors.push('Manodopera ufficiale incoerente: tolleranza massima 0,02 €.')
  }
  return errors
}
