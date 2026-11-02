import { normalizePriceDescription, normalizeUnitOfMeasure, tokenizePriceDescription } from './normalizer'
import type { PriceKnowledgeItem } from './types'

// Retrieval for human comparison only. These rules never participate in resolvePrice.
const famiglie = {
  muratura: /tramezz|muratur/,
  infissi: /infiss|serrament|controtelai|telaio a scomparsa/,
  pavimenti: /paviment|piastrell|maiolic|rivestiment/,
  impermeabilizzazione: /impermeabil/,
  ponteggio: /ponteggi/,
  facciata: /facciat|rasatur|intonac|risanament/,
  ferro: /ringhier|cancellat|opere in ferro/,
} as const
type Famiglia = keyof typeof famiglie
type Operazione = 'rimozione' | 'posa' | 'altro'
// Ancillary works and exclusions must not redefine the object of the reference.
const oggettoPrestazione = (testo: string) => testo.split(/\b(?:compres[oaie]|esclus[oaie]|sono compres[ie]|sono esclus[ie]|l applicazione)\b/)[0].slice(0, 600)
const operazione = (testo: string): Operazione => {
  const oggetto = oggettoPrestazione(testo)
  const rimozione = oggetto.search(/demolizion|rimozion|eliminazion|svelliment|dismission/)
  const posa = oggetto.search(/posa|collocazion|realizzazion|montaggio|approntamento|fornitura|consolidamento|rinforzo|revisione|ripristino|intervento|ciclo|rasatura|intonaco/)
  return rimozione >= 0 && (posa < 0 || rimozione < posa) ? 'rimozione' : posa >= 0 ? 'posa' : 'altro'
}
const paroleGeneriche = new Set('di del della delle degli dei da dal dalla dalle con per in su sul sulla e o il lo la le gli un una compreso compresi compresa compreso onere oneri opera opere posa fornitura realizzazione tutto tutti quanto altro occorre occorrente necessario necessaria regola arte lavoro lavori finito finita esistente esistenti'.split(' '))
const terminiTecnici = (testo: string) => tokenizePriceDescription(testo).filter(t => !paroleGeneriche.has(t))
const trovaFamiglie = (testo: string): Famiglia[] =>
  (Object.keys(famiglie) as Famiglia[]).filter(k => famiglie[k].test(oggettoPrestazione(testo)))

export type RiferimentoLocale = {
  codice: string | null
  descrizione: string
  unitaMisura: string | null
  prezzo: number
  fonte: string
  somiglianza: number
  compatibilitaUm: 'compatibile' | 'incompatibile' | 'non verificabile'
  avvisi: string[]
}
type Voce = {
  descrizione?: string
  unita_misura?: string
  priceResolutionInvalidated?: boolean
  priceResolution?: { strategy?: string; matched?: boolean }
}
export type IndiceRiferimenti = ReturnType<typeof creaIndiceRiferimentiLocali>

export function creaIndiceRiferimentiLocali(prezzi: readonly PriceKnowledgeItem[]) {
  return prezzi.filter(p => p.descrizione && Number.isFinite(Number(p.prezzo_unitario)) && Number(p.prezzo_unitario) > 0)
    .map(p => {
      const testo = normalizePriceDescription(p.descrizione)
      return {
        codice: p.codice ?? null, descrizione: p.descrizione,
        unitaMisura: p.unita_misura ?? null, prezzo: Number(p.prezzo_unitario),
        fonte: p.fonte?.trim() || 'Fonte non indicata',
        testo, um: normalizeUnitOfMeasure(p.unita_misura),
        tokens: new Set(tokenizePriceDescription(p.descrizione)),
        tecnici: new Set(terminiTecnici(testo)), famiglie: trovaFamiglie(testo),
        operazione: operazione(testo),
      }
    })
}

export function riferimentiLocaliDaVerificare(voce: Voce, indice: IndiceRiferimenti): RiferimentoLocale[] {
  if (voce.priceResolutionInvalidated || voce.priceResolution?.strategy !== 'no_match' ||
      voce.priceResolution.matched !== false) return []
  const testo = normalizePriceDescription(voce.descrizione)
  if (!testo) return []
  const famiglieInput = trovaFamiglie(testo)
  const op = operazione(testo)
  const tokens = tokenizePriceDescription(testo)
  const tecnici = terminiTecnici(testo)
  const um = normalizeUnitOfMeasure(voce.unita_misura)
  const composita = /facciat|impianto|fossa.*imhoff|apertura.*muratura portante|revisione.*copertura|ripristino scala|muro di confine/.test(testo)
  const solaPosa = /posa/.test(testo) && !/fornitur/.test(testo)
  const dettagli = [
    /malta/, /cementizi|cemento/, /rete/, /bicomponente/, /due (?:mani|strati)/,
    /lateriz/, /forat/, /taglio termico/, /alluminio/, /telaio/,
  ].filter(re => re.test(testo))
  const candidati = indice.flatMap(p => {
    const comune = p.famiglie.some(f => famiglieInput.includes(f))
    const condivisi = tecnici.filter(t => p.tecnici.has(t)).length
    // Boilerplate alone is not enough; unknown families require two technical terms.
    if (famiglieInput.length ? !comune : condivisi < 2) return []
    if (op === 'rimozione' && p.operazione !== 'rimozione') return []
    if (op === 'posa' && p.operazione === 'rimozione') return []
    const compatibilitaUm = !um || !p.um ? 'non verificabile' as const :
      um === p.um ? 'compatibile' as const : 'incompatibile' as const
    const somiglianza = tokens.filter(t => p.tokens.has(t)).length / Math.max(tokens.length, p.tokens.size)
    // Rank technical facets separately from the displayed lexical similarity.
    const pertinenza = dettagli.filter(re => re.test(p.testo)).length * 4 +
      (op !== 'altro' && op === p.operazione ? 3 : 0) +
      (compatibilitaUm === 'compatibile' ? 3 : 0) +
      condivisi / Math.max(1, tecnici.length)
    const avvisi = ['Verificare inclusioni/esclusioni']
    if (compatibilitaUm === 'incompatibile') avvisi.unshift('U.M. incompatibile')
    if (compatibilitaUm === 'non verificabile') avvisi.unshift('U.M. non verificabile')
    if (composita) avvisi.push('Prestazione composita: il riferimento può coprire solo una parte')
    if (solaPosa && /fornitur|fornito/.test(p.testo)) avvisi.push('Il riferimento comprende fornitura: non equivale alla sola posa')
    const riferimento: RiferimentoLocale = {
      codice: p.codice, descrizione: p.descrizione, unitaMisura: p.unitaMisura,
      prezzo: p.prezzo, fonte: p.fonte, somiglianza, compatibilitaUm, avvisi,
    }
    return [{ riferimento, pertinenza }]
  }).sort((a, b) => b.pertinenza - a.pertinenza || b.riferimento.somiglianza - a.riferimento.somiglianza ||
    String(a.riferimento.codice).localeCompare(String(b.riferimento.codice)))

  // Preserve both local sources when plausible, without declaring either authoritative.
  const scelti: typeof candidati = []
  for (const fonte of ['ARTECNA', 'Regione Sicilia']) {
    const candidato = candidati.find(c => c.riferimento.fonte === fonte)
    if (candidato) scelti.push(candidato)
  }
  for (const candidato of candidati) {
    if (scelti.length >= 5) break
    if (!scelti.some(c => c.riferimento.codice === candidato.riferimento.codice &&
      c.riferimento.descrizione === candidato.riferimento.descrizione &&
      c.riferimento.fonte === candidato.riferimento.fonte && c.riferimento.prezzo === candidato.riferimento.prezzo &&
      c.riferimento.unitaMisura === candidato.riferimento.unitaMisura)) scelti.push(candidato)
  }
  return scelti.sort((a, b) => b.pertinenza - a.pertinenza || b.riferimento.somiglianza - a.riferimento.somiglianza ||
    String(a.riferimento.codice).localeCompare(String(b.riferimento.codice)))
    .map(c => c.riferimento)
}
