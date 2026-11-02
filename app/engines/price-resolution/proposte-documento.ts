import { esitoDiagnosticaVoce } from './diagnostica-voce'
import { normalizePriceDescription, tokenizePriceDescription } from './normalizer'
import { analizzaAmbitoPrezzoSic24, confrontaDescrizioniEdilizie } from './descrizione-semantica'
import { mediaMemoriaCompatibile, risolviPrezzoRevisioneAi, unitaPrezzoCompatibile } from './revisione-ai'
import { creaIndiceRiferimentiLocali, riferimentiLocaliDaVerificare } from './riferimenti-locali'
import type { PriceKnowledgeItem, PriceResolutionInput } from './types'
import type { StimaApplicata } from './stima-documento-ai'

export type StatoPrezzoDocumento = 'prezzo_affidabile' | 'proposta_locale' | 'stima_ai_supportata' | 'stima_ai_da_controllare' | 'astensione_ai' | 'batch_identity_invalid' | 'stima_ai_sospesa' | 'stima_ai_scartata' | 'prezzo_non_determinabile' | 'modificato_utente'
export type PropostaPrezzoDocumento = {
  prezzo_proposto: number
  fonte_proposta: string
  codice_riferimento: string | null
  confidence: 'media'
  metodo_proposta: string
  motivazione: string
  avvisi: string[]
  descrizione: string
  unita_misura: string
}
type VoceDocumento = {
  descrizione?: string; unita_misura?: string; quantita?: number; prezzo_unitario?: number
  bozzaDocumento?: boolean; propostaPrezzoDocumento?: PropostaPrezzoDocumento
  diagnosticaStimaDocumento?: { motivo: string }
  stimaPrezzoArtecna?: StimaApplicata
  priceResolutionInvalidated?: boolean; fonte_prezzo?: string
  priceResolution?: { matched?: boolean; strategy?: string; confidence?: number; prezzoUnitarioRisolto?: number }
}
export const prestazioneComposita = (descrizione: string) =>
  /facciat|impianto|fotovoltaic|fossa.*imhoff|apertura.*muratura portante|copertura|tetto|ripristino scala|muro di confine|vespaio/.test(normalizePriceDescription(descrizione))

// Selection for an explicitly provisional draft, never a replacement for resolvePrice.
function riferimentoProponibile(query: PriceResolutionInput, item: PriceKnowledgeItem): string | null {
  if (!unitaPrezzoCompatibile(query.unitaMisura, item.unita_misura)) return null
  const q = normalizePriceDescription(query.descrizione), c = normalizePriceDescription(item.descrizione)
  const ambitoQ = analizzaAmbitoPrezzoSic24(query.descrizione), ambitoC = analizzaAmbitoPrezzoSic24(item.descrizione)
  if (ambitoQ.tipo === 'ambiguo' || ambitoC.tipo === 'ambiguo') return null
  const solaPosa = ambitoQ.tipo === 'sola_posa' || (/^posa\b/.test(q) && !/fornitur/.test(q))
  if (solaPosa && (ambitoC.tipo === 'completa' || /fornitur|fornit[oaie]/.test(c))) return null
  if (/trasporto/.test(q) && !/esclus[oaie] (?:il )?trasporto/.test(q) && /esclus[oaie] (?:il )?trasporto/.test(c)) return null
  if (/cementizi|cemento/.test(q) && /\bgesso\b/.test(c)) return null
  const oggetto = c.split(/\b(?:compres[oaie]|esclus[oaie])\b/)[0]
  if (/ponteggi/.test(q)) {
    if (!/^(?:montaggio(?: e smontaggio)?|approntamento)\b.*ponteggi/.test(oggetto)) return null
    if (/tutto il tempo|durata/.test(q) && /primi 30 giorni|successivi mesi/.test(c)) return null
    return 'riferimento_tecnico_ponteggio'
  }
  if (/impermeabil/.test(q) && /malta/.test(q) && /rete/.test(q)) {
    const cicloPrincipale = /^(?:fornitura(?: trasporto)? e (?:posa|collocazione)(?: in opera)? (?:di )?)?(?:malta|impermeabilizzazione)\b/.test(oggetto)
    if (!cicloPrincipale || !/impermeabil/.test(c) || !/malta cementizia bicomponente/.test(c) || !/rete/.test(c) ||
        !/due mani|due strati/.test(c) || /bitum|asfalt|rinforzo strutturale/.test(c)) return null
    return 'riferimento_tecnico_impermeabilizzazione'
  }
  // The two explicit cycles above are checked as complete technical profiles:
  // e.g. "armatura di rinforzo" of the waterproofing mesh is not structural consolidation.
  // All other references retain the existing generic semantic guard unchanged.
  if (!confrontaDescrizioniEdilizie(query.descrizione, item.descrizione, tokenizePriceDescription(query.descrizione)).compatibile) return null
  // Reuse the existing unit/scope/semantic guards, but never its 25% commercial uplift.
  return risolviPrezzoRevisioneAi(query, [item], []).priceResolution.matched ? 'riferimento_locale_validato' : null
}

export function preparaBozzaDocumento<T extends VoceDocumento>(voci: readonly T[], prezzi: readonly PriceKnowledgeItem[], memoria: readonly PriceKnowledgeItem[] = []) {
  const indice = creaIndiceRiferimentiLocali(prezzi)
  return voci.map(voce => {
    const base = { ...voce, bozzaDocumento: true }
    // Idempotent: do not overwrite document prices, matches, manual corrections or a prior proposal.
    if (voce.priceResolutionInvalidated || voce.propostaPrezzoDocumento || voce.stimaPrezzoArtecna) return base
    if (Number(voce.prezzo_unitario) > 0) {
      if (esitoDiagnosticaVoce(voce) === 'resolved') return base
      return { ...base, propostaPrezzoDocumento: {
        prezzo_proposto: Number(voce.prezzo_unitario), fonte_proposta: voce.fonte_prezzo || (voce.priceResolution?.matched ? 'Riferimento originale' : 'Documento analizzato'),
        codice_riferimento: null, confidence: 'media' as const, metodo_proposta: 'prezzo_originale_da_verificare',
        motivazione: 'Prezzo già presente, conservato senza sostituzione; il matching non lo certifica come affidabile.',
        avvisi: ['Verificare prezzo e inclusioni/esclusioni'], descrizione: voce.descrizione || '', unita_misura: voce.unita_misura || '',
      } }
    }
    if (!Number.isFinite(voce.quantita) || Number(voce.quantita) <= 0 ||
        voce.priceResolution?.strategy !== 'no_match' || voce.priceResolution.matched !== false ||
        !voce.descrizione || prestazioneComposita(voce.descrizione)) return base
    const query = { descrizione: voce.descrizione, unitaMisura: voce.unita_misura, quantita: voce.quantita }
    const riferimenti = riferimentiLocaliDaVerificare(voce, indice)
    const validi = riferimenti.flatMap(r => {
      const item = prezzi.find(p => p.codice === r.codice && p.fonte === r.fonte &&
        p.descrizione === r.descrizione && Number(p.prezzo_unitario) === r.prezzo && p.unita_misura === r.unitaMisura)
      const metodo = item && riferimentoProponibile(query, item)
      return item && metodo ? [{ r, metodo }] : []
    })
    let proposta: PropostaPrezzoDocumento | undefined
    for (const gruppo of [validi.filter(c => c.r.fonte === 'ARTECNA'), validi.filter(c => c.r.fonte !== 'ARTECNA')]) {
      if (!gruppo.length) continue
      // Same source tier with differing eligible prices is not an authoritative choice.
      if (new Set(gruppo.map(c => c.r.prezzo)).size > 1) return base
      const { r, metodo } = gruppo[0]
      proposta = { prezzo_proposto: r.prezzo, fonte_proposta: r.fonte, codice_riferimento: r.codice,
        confidence: 'media', metodo_proposta: metodo,
        motivazione: 'Riferimento locale con U.M. e prestazione compatibili, proposto per la bozza e da controllare; non è un match affidabile.',
        avvisi: [...r.avvisi, ...(metodo === 'riferimento_tecnico_ponteggio' ? ['Verificare durata del nolo e condizioni del ponteggio'] : [])],
        descrizione: voce.descrizione, unita_misura: voce.unita_misura || '' }
      break
    }
    if (!proposta) {
      const compatibili = memoria.filter(p => !/fallback|da verificare/i.test(p.fonte || '') &&
        (!/web/i.test(p.fonte || '') || /web confermato/i.test(p.fonte || '')) && riferimentoProponibile(query, p))
      const media = mediaMemoriaCompatibile(query, compatibili)
      if (media !== null) proposta = { prezzo_proposto: media, fonte_proposta: 'Memoria prezzi ARTECNA', codice_riferimento: null,
        confidence: 'media', metodo_proposta: 'media_memoria_compatibile', motivazione: 'Media dei soli prezzi in memoria con U.M. e prestazione compatibili. Nessuna maggiorazione.',
        avvisi: ['Verificare inclusioni/esclusioni', 'Media memoria, non prezzo contrattuale'], descrizione: voce.descrizione, unita_misura: voce.unita_misura || '' }
    }
    return proposta ? { ...base, prezzo_unitario: proposta.prezzo_proposto, propostaPrezzoDocumento: proposta } : base
  })
}

export function statoPrezzoDocumento(voce: VoceDocumento): StatoPrezzoDocumento {
  if (voce.priceResolutionInvalidated) return 'modificato_utente'
  const s = voce.stimaPrezzoArtecna
  if (s) {
    const stato = s.validazione_tecnica?.stato || 'sospesa_da_verificare'
    const prezzoAtteso = stato === 'accettata' ? s.prezzo_unitario_proposto : 0
    if (voce.descrizione !== s.descrizione || voce.unita_misura !== s.unita_originale || voce.quantita !== s.quantita ||
        voce.prezzo_unitario !== prezzoAtteso) return 'modificato_utente'
    return stato === 'accettata' ? (s.validazione_tecnica.supporto_economico === 'supportato' ? 'stima_ai_supportata' : 'stima_ai_da_controllare') : stato === 'scartata' ? 'stima_ai_scartata' : 'stima_ai_sospesa'
  }
  const motivo = voce.diagnosticaStimaDocumento?.motivo
  if (['astensione_ai', 'batch_identity_invalid', 'stima_ai_scartata'].includes(motivo || '') && !Number(voce.prezzo_unitario)) return motivo as StatoPrezzoDocumento
  const p = voce.propostaPrezzoDocumento
  if (p) return voce.descrizione === p.descrizione && voce.unita_misura === p.unita_misura &&
    voce.prezzo_unitario === p.prezzo_proposto ? 'proposta_locale' : 'modificato_utente'
  if (Number(voce.prezzo_unitario) > 0) return esitoDiagnosticaVoce(voce) === 'resolved' ? 'prezzo_affidabile' : 'proposta_locale'
  return 'prezzo_non_determinabile'
}
export function riepilogoPrezziDocumento(voci: readonly VoceDocumento[]) {
  const stats = { prezzo_affidabile: 0, proposta_locale: 0, stima_ai_supportata: 0, stima_ai_da_controllare: 0, astensione_ai: 0, batch_identity_invalid: 0, stima_ai_sospesa: 0, stima_ai_scartata: 0, prezzo_non_determinabile: 0, modificato_utente: 0 }
  for (const voce of voci) stats[statoPrezzoDocumento(voce)]++
  return stats
}
