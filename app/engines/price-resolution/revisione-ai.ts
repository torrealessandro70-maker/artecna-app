import { normalizePriceDescription, normalizeUnitOfMeasure, tokenizePriceDescription } from './normalizer'
import type { PriceKnowledgeItem, PriceResolutionInput } from './types'
import { analizzaAmbitoPrezzoSic24, confrontaDescrizioniEdilizie, specializzazioniTecnicheNonRichieste } from './descrizione-semantica'
import { quotaUfficialeManodoperaSic24 } from './sic24-manodopera'

// Termini di capitolato troppo generici per identificare da soli una tariffa.
const generici = new Set('fornitura posa opera pavimento pavimenti rimozione nuovo nuova nuovi nuove supporto supporti preparazione lavoro lavori lavorazione lavorazioni esecuzione compreso compresa compresi comprese ogni onere oneri finita finito arte regola da di del della delle dei degli dell in con per su sul sulla al alla allo alle il lo la le gli un una uno ed e a o non'.split(' '))
const significativi = (value: string) => tokenizePriceDescription(value).filter(t => !generici.has(t))

export const unitaPrezzoCompatibile = (left?: string | null, right?: string | null): boolean => {
  const unit = normalizeUnitOfMeasure(left)
  return unit !== '' && unit === normalizeUnitOfMeasure(right)
}

const pertinenza = (input: PriceResolutionInput, item: PriceKnowledgeItem): number => {
  const ambito = analizzaAmbitoPrezzoSic24(input.descrizione)
  if (ambito.tipo === 'ambiguo') return 0
  const descrizione = ambito.descrizioneMatching
  const sic24 = item.tipo_prezzo !== 'artecna' && /^SIC24[_.]/i.test(item.codice || '')
  // Un prezzo aziendale completo non è una tariffa di sola posa.
  if (ambito.tipo === 'sola_posa' && !sic24 && analizzaAmbitoPrezzoSic24(item.descrizione).tipo === 'completa') return 0
  if (!unitaPrezzoCompatibile(input.unitaMisura, item.unita_misura) ||
      !Number.isFinite(Number(item.prezzo_unitario)) || Number(item.prezzo_unitario) <= 0) return 0
  if (/^SIC24[_.]/i.test(item.codice || '') &&
    specializzazioniTecnicheNonRichieste(descrizione,item.descrizione).length > 0) return 0
  const query = significativi(descrizione)
  const candidate = significativi(item.descrizione)
  const semantica = confrontaDescrizioniEdilizie(descrizione,item.descrizione,query)
  if (!semantica.compatibile) return 0
  if (!query.length || !candidate.length) return semantica.score
  if (normalizePriceDescription(descrizione) === normalizePriceDescription(item.descrizione)) return 1
  const common = query.filter(t => candidate.includes(t)).length
  // Almeno due termini distintivi; copertura >=80% richiesta e >=60% candidato.
  const originale = common >= 2 && common/query.length >= 0.8 && common/candidate.length >= 0.6
    ? Math.min(common/query.length,common/candidate.length) : 0
  return Math.max(originale,semantica.score)
}

export const mediaMemoriaCompatibile = (input: PriceResolutionInput, memoria: readonly PriceKnowledgeItem[]): number | null => {
  const validi = memoria.filter(item => pertinenza(input, item) > 0)
  if (!validi.length) return null
  const media = validi.reduce((sum, item) => sum + Number(item.prezzo_unitario) / validi.length, 0)
  return Number.isFinite(media) && media > 0 ? media : null
}

export const risolviPrezzoRevisioneAi = (
  input: PriceResolutionInput & { prezzoAi?: number },
  prezzi: readonly PriceKnowledgeItem[],
  memoria: readonly PriceKnowledgeItem[],
) => {
  const solaPosa = analizzaAmbitoPrezzoSic24(input.descrizione).tipo === 'sola_posa'
  const candidati = prezzi.map(item => {
    const score = pertinenza(input, item)
    const richiedeQuota = solaPosa && item.tipo_prezzo !== 'artecna' && /^SIC24[_.]/i.test(item.codice || '')
    const quota = score > 0 && richiedeQuota ? quotaUfficialeManodoperaSic24(item) : null
    return { item, score: richiedeQuota && !quota ? 0 : score, quota }
  })
    .filter(c => c.score > 0).sort((a, b) => b.score - a.score)
  const primi = candidati.filter(c => c.score === candidati[0]?.score)
  // Non scegliere arbitrariamente fra tariffe diverse a parità di pertinenza.
  const candidato = new Set(primi.map(c => `${Number(c.item.prezzo_unitario)}:${c.quota?.prezzoManodopera ?? ''}`)).size === 1 ? primi[0] : undefined
  const media = candidato ? null : mediaMemoriaCompatibile(input, memoria)
  const quota = candidato?.quota
  const prezzoBase = candidato ? quota?.prezzoManodopera ?? Number(candidato.item.prezzo_unitario) : media
  const validato = prezzoBase !== null && prezzoBase !== undefined
  const ai = Number(input.prezzoAi)
  const prezzoAziendale = candidato?.item.tipo_prezzo === 'artecna'
  const finale = validato ? (prezzoAziendale || quota ? prezzoBase : Number((prezzoBase * 1.25).toFixed(2))) : Number.isFinite(ai) && ai >= 0 ? ai : 0
  const prezzoValido = validato && Number.isFinite(finale)
  return {
    prezzo_unitario: Number.isFinite(finale) ? finale : 0,
    fonte_prezzo: prezzoValido ? (quota ? 'SIC24 — quota manodopera ufficiale' : candidato?.item.fonte || (candidato ? 'Prezzario validato' : 'Memoria prezzi ARTECNA / Catania')) : 'Prezzo da verificare',
    priceResolution: {
      matched: prezzoValido,
      strategy: prezzoValido ? (candidato ? 'description_unit' : 'similarity') : 'ai_fallback',
      confidence: prezzoValido ? candidato?.score ?? 0.8 : 0,
      codiceRisolto: candidato?.item.codice,
      prezzoUnitarioRisolto: prezzoValido ? prezzoBase : undefined,
      manodoperaSic24: quota || undefined,
      reasons: [quota ? `${quota.metodo}. Prezzo completo ${quota.prezzoCompleto} €/${quota.unitaMisura}; incidenza ${quota.percentualeManodopera}%; quota ufficiale ${quota.prezzoManodopera} €/${quota.unitaMisura}. Nessuna maggiorazione.`
        : prezzoValido ? (prezzoAziendale ? 'Listino ARTECNA: prezzo aziendale senza maggiorazione.' : 'U.M. compatibile e descrizione pertinente; maggiorazione 25% applicata.') : 'Prezzo da verificare: nessun riferimento univoco e affidabile con U.M. compatibile.'],
    },
  }
}
