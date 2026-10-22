import type { PriceKnowledgeItem, PriceResolutionInput } from './types'
import { normalizeUnitOfMeasure } from './normalizer'
import { risolviPrezzoRevisioneAi } from './revisione-ai'
import { risolviPrezzoPrioritario } from './storico-prezzi'
import type { EsitoWeb } from './web-fallback'
import type { QuotaManodoperaSic24 } from './sic24-manodopera'

export const FONTI_ANALISI = ['storicoArtecna', 'listinoArtecna', 'sic24', 'memoria', 'webVerificato'] as const
type FonteAnalisi = typeof FONTI_ANALISI[number]
export type CandidatoAnalisi = {
  id: string; fonte: FonteAnalisi; codice: string | null; descrizione: string; unita_misura: string
  prezzo_base: number; prezzo: number; score: number; motivo: string
  etichetta: string; zona: string | null; regione: string | null; data: string | null
  manodopera_sic24?: QuotaManodoperaSic24
}
export type AiPriceAnalysisInput = {
  lavorazione: { descrizione: string; unita_misura: string; quantita: number }
} & Record<FonteAnalisi, CandidatoAnalisi[]>
export type AiPriceAnalysisOutput = {
  esito: 'proposta' | 'da_verificare'; prezzo_proposto: number | null; unita_misura: string
  fonte_principale: string | null
  fonti_considerate: { id: string; fonte: string; codice: string | null; prezzo: number }[]
  motivazione: string; confidence: 'alta' | 'media' | 'bassa'; avvertenze: string[]
}
export function daVerificare(motivo: string, um = ''): AiPriceAnalysisOutput {
  return { esito: 'da_verificare', prezzo_proposto: null, unita_misura: um, fonte_principale: null,
    fonti_considerate: [], motivazione: motivo, confidence: 'bassa', avvertenze: [] }
}
export const riferimentiAnalisi = (input: AiPriceAnalysisInput) => FONTI_ANALISI.flatMap(f => input[f])

export function preparaAnalisiPrezzo(
  query: PriceResolutionInput, prezzi: readonly PriceKnowledgeItem[], memoria: readonly PriceKnowledgeItem[],
  storico: readonly PriceKnowledgeItem[], web?: EsitoWeb | null,
) {
  const input: AiPriceAnalysisInput = { lavorazione: { descrizione: query.descrizione,
    unita_misura: normalizeUnitOfMeasure(query.unitaMisura), quantita: Number(query.quantita ?? 1) },
    storicoArtecna: [], listinoArtecna: [], sic24: [], memoria: [], webVerificato: [] }
  const gruppi: [FonteAnalisi, readonly PriceKnowledgeItem[]][] = [
    ['storicoArtecna', storico], ['listinoArtecna', prezzi.filter(p => p.tipo_prezzo === 'artecna')],
    ['sic24', prezzi.filter(p => p.tipo_prezzo !== 'artecna' && /^SIC24[_.]/i.test(p.codice || ''))],
    ['memoria', memoria.filter(p => !/fallback|da verificare/i.test(p.fonte || '') &&
      (!/web/i.test(p.fonte || '') || /web confermato/i.test(p.fonte || '')))],
  ]
  let risoltoDaFonteForte = false
  for (const [fonte, items] of gruppi) {
    if (fonte !== 'memoria' && risolviPrezzoRevisioneAi(query, items, []).priceResolution.matched) risoltoDaFonteForte = true
    const visti = new Set<string>()
    input[fonte] = items.flatMap((item, index): CandidatoAnalisi[] => {
      // Stessi controlli U.M., V3.3 e specializzazione del runtime; nessun secondo matching.
      const r = risolviPrezzoRevisioneAi(query, fonte === 'memoria' ? [] : [item], fonte === 'memoria' ? [item] : [])
      if (!r.priceResolution.matched || item.descrizione.length > 4000) return []
      const id = `${fonte}:${item.id || item.codice || index}`
      if (visti.has(id)) return []
      visti.add(id)
      const metadata = item as PriceKnowledgeItem & {zona?:string;updated_at?:string}
      return [{ id, fonte, codice: item.codice || null, descrizione: item.descrizione,
        unita_misura: normalizeUnitOfMeasure(item.unita_misura), prezzo_base: Number(item.prezzo_unitario),
        prezzo: fonte === 'storicoArtecna' ? Number(item.prezzo_unitario) : r.prezzo_unitario,
        score: r.priceResolution.confidence, motivo: r.priceResolution.manodoperaSic24
          ? r.priceResolution.reasons[0] : 'U.M. compatibile e matching V3.3 accettato.',
        ...(r.priceResolution.manodoperaSic24 ? { manodopera_sic24: r.priceResolution.manodoperaSic24 } : {}),
        etichetta: item.fonte || fonte, zona: metadata.zona || null, regione: item.regione || null,
        data: metadata.updated_at || (item.anno ? String(item.anno) : null) }]
    }).sort((a, b) => b.score - a.score || a.prezzo - b.prezzo).slice(0, 3)
  }
  // La memoria resta una media calcolata dal resolver, senza duplicarne la maggiorazione.
  const mem = gruppi.find(([f]) => f === 'memoria')![1]
  const media = risolviPrezzoRevisioneAi(query, [], mem)
  if (media.priceResolution.matched && input.memoria.length) {
    input.memoria = [{ ...input.memoria[0], id: 'memoria:media', codice: null,
      descrizione: query.descrizione, prezzo_base: media.priceResolution.prezzoUnitarioRisolto!,
      prezzo: media.prezzo_unitario, etichetta: 'Media memoria compatibile', motivo: media.priceResolution.reasons[0] }]
  }
  if (web?.stato === 'OK' && normalizeUnitOfMeasure(web.unita_misura) === input.lavorazione.unita_misura) {
    input.webVerificato = web.fonti.filter(f => f.evidenza_verificata?.fonte === f.url &&
      f.evidenza_verificata.testo === f.evidenza && normalizeUnitOfMeasure(f.unita_misura) === input.lavorazione.unita_misura &&
      risolviPrezzoRevisioneAi(query, [{descrizione: f.descrizione, unita_misura: f.unita_misura, prezzo_unitario: f.prezzo}], []).priceResolution.matched)
      .slice(0, 3).map(f => ({ id: `webVerificato:${f.url}`, fonte: 'webVerificato', codice: null,
        descrizione: f.descrizione, unita_misura: normalizeUnitOfMeasure(f.unita_misura),
        prezzo_base: f.prezzo, prezzo: f.prezzo, score: 0.8, motivo: 'Riferimento Web già verificato dal fallback.',
        etichetta: f.url, zona: f.provincia || f.citta || null, regione: f.regione, data: f.data_prezzo }))
  }
  return { input, risoltoDaFonteForte, risoluzione: risolviPrezzoPrioritario(query, prezzi, memoria, storico) }
}

function record(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v) }
const text = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= max
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
// Valida anche sul server: nessun dump, U.M. incoerente o candidato fuori matching.
export function validaInputAnalisi(raw: unknown): AiPriceAnalysisInput {
  if (!record(raw) || Object.keys(raw).some(k => !['lavorazione', ...FONTI_ANALISI].includes(k))) throw Error('Input analisi non valido.')
  const q = raw.lavorazione
  if (!record(q) || Object.keys(q).some(k => !['descrizione','unita_misura','quantita'].includes(k)) ||
    !text(q.descrizione, 4000) || !text(q.unita_misura, 30) || !positive(q.quantita) ||
    normalizeUnitOfMeasure(q.unita_misura) !== q.unita_misura) throw Error('Lavorazione non valida.')
  const ids = new Set<string>()
  for (const fonte of FONTI_ANALISI) {
    const list = raw[fonte]
    if (!Array.isArray(list) || list.length > 3) throw Error('Troppi candidati o fonte mancante.')
    for (const c of list) {
      if (!record(c) || Object.keys(c).filter(k => k !== 'manodopera_sic24').sort().join() !== 'codice,data,descrizione,etichetta,fonte,id,motivo,prezzo,prezzo_base,regione,score,unita_misura,zona' ||
        !text(c.id, 1000) || !c.id.startsWith(`${fonte}:`) || ids.has(c.id) || c.fonte !== fonte ||
        !text(c.descrizione, 4000) || !text(c.etichetta, 1000) || !text(c.motivo, 500) ||
        c.unita_misura !== q.unita_misura || !positive(c.prezzo) || !positive(c.prezzo_base) ||
        typeof c.score !== 'number' || !Number.isFinite(c.score) || c.score <= 0 || c.score > 1 ||
        ![c.codice, c.zona, c.regione, c.data].every(v => v === null || text(v, 300))) throw Error('Candidato non valido.')
      const r = risolviPrezzoRevisioneAi({descrizione:q.descrizione,unitaMisura:q.unita_misura}, [{
        descrizione:c.descrizione,unita_misura:c.unita_misura,prezzo_unitario:c.prezzo_base,
        codice:c.codice as string | null,tipo_prezzo:fonte === 'listinoArtecna' ? 'artecna' : undefined,
      }], [])
      if (!r.priceResolution.matched || (fonte === 'storicoArtecna' || fonte === 'webVerificato' ? c.prezzo !== c.prezzo_base : c.prezzo !== r.prezzo_unitario)) throw Error('Riferimento incoerente.')
      const quota = fonte === 'sic24' ? r.priceResolution.manodoperaSic24 : undefined
      const datiQuota = (value: unknown) => record(value) ? JSON.stringify(Object.entries(value).sort(([a],[b]) => a.localeCompare(b))) : undefined
      if (datiQuota(c.manodopera_sic24) !== datiQuota(quota) ||
          (c.manodopera_sic24 !== undefined && !quota)) throw Error('Manodopera SIC24 non certificata.')
      if (fonte === 'sic24' && (typeof c.codice !== 'string' || !/^SIC24[_.]/i.test(c.codice))) throw Error('Codice SIC24 non valido.')
      if (fonte === 'webVerificato') {
        const url = new URL(c.etichetta)
        if (url.protocol !== 'https:' || c.id !== `webVerificato:${url.href}`) throw Error('Fonte Web non valida.')
      }
      ids.add(c.id)
    }
  }
  return raw as AiPriceAnalysisInput
}

export function evidenzaSufficiente(input: AiPriceAnalysisInput) {
  const refs = riferimentiAnalisi(input)
  const unique = new Set(refs.map(r => `${r.fonte}:${r.codice || r.descrizione}:${r.prezzo}`))
  return unique.size >= 2 && Math.max(...refs.map(r => r.prezzo)) / Math.min(...refs.map(r => r.prezzo)) <= 1.25
}
export function validaOutputAnalisi(raw: unknown, input: AiPriceAnalysisInput): AiPriceAnalysisOutput {
  const fail = () => daVerificare('Risposta AI non supportata da evidenze sufficienti e coerenti.', input.lavorazione.unita_misura)
  try {
    const o: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!record(o) || Object.keys(o).sort().join() !== 'avvertenze,confidence,esito,fonte_principale,fonti_considerate,motivazione,prezzo_proposto,unita_misura' ||
      !['proposta','da_verificare'].includes(String(o.esito)) || !['alta','media','bassa'].includes(String(o.confidence)) ||
      !text(o.motivazione,2000) || o.unita_misura !== input.lavorazione.unita_misura ||
      !Array.isArray(o.avvertenze) || o.avvertenze.length > 10 || !o.avvertenze.every(a => text(a,500)) ||
      !Array.isArray(o.fonti_considerate) || o.fonti_considerate.length > 15) return fail()
    const refs = riferimentiAnalisi(input), cited = new Set<string>()
    const spiegazione = [o.motivazione, ...o.avvertenze].join(' ')
    const urls = spiegazione.match(/https?:\/\/[^\s<>"')]+/gi) || []
    if (urls.some(url => !refs.some(c => c.etichetta === url))) return fail()
    const codici = spiegazione.match(/\bSIC24[_.][\w.]+/gi) || []
    if (codici.some(code => !refs.some(c => c.codice?.toLowerCase() === code.toLowerCase()))) return fail()
    for (const f of o.fonti_considerate) {
      if (!record(f) || Object.keys(f).sort().join() !== 'codice,fonte,id,prezzo') return fail()
      const actual = refs.find(c => c.id === f.id)
      if (!actual || cited.has(actual.id) || f.fonte !== actual.fonte || f.codice !== actual.codice || f.prezzo !== actual.prezzo) return fail()
      cited.add(actual.id)
    }
    if (o.esito === 'da_verificare') {
      if (o.prezzo_proposto !== null || o.fonte_principale !== null) return fail()
      return o as AiPriceAnalysisOutput
    }
    const main = refs.find(c => c.id === o.fonte_principale)
    if (!evidenzaSufficiente(input) || !positive(o.prezzo_proposto) || o.confidence === 'bassa' ||
      !main || !cited.has(main.id) || cited.size < 2 || o.prezzo_proposto !== main.prezzo) return fail()
    return o as AiPriceAnalysisOutput
  } catch { return fail() }
}

export async function eseguiAnalisiPrezzo(input: AiPriceAnalysisInput, genera: (input: AiPriceAnalysisInput) => Promise<string>): Promise<AiPriceAnalysisOutput> {
  try {
    validaInputAnalisi(input)
    // Anche una richiesta diretta non scavalca un riferimento interno già univoco.
    for (const fonte of ['storicoArtecna','listinoArtecna','sic24'] as const) {
      const r = risolviPrezzoRevisioneAi({descrizione:input.lavorazione.descrizione,unitaMisura:input.lavorazione.unita_misura},
        input[fonte].map(c => ({descrizione:c.descrizione,unita_misura:c.unita_misura,prezzo_unitario:c.prezzo_base,codice:c.codice,tipo_prezzo:fonte === 'listinoArtecna' ? 'artecna' : undefined})), [])
      if (r.priceResolution.matched) return daVerificare('Fonte interna già risolutiva: analisi AI non eseguita.', input.lavorazione.unita_misura)
    }
    if (!evidenzaSufficiente(input)) return daVerificare('Fonti insufficienti o prezzi discordanti: nessuna chiamata AI.', input.lavorazione.unita_misura)
    return validaOutputAnalisi(await genera(input), input)
  } catch { return daVerificare('Analisi non disponibile: nessuna proposta applicabile.', input.lavorazione.unita_misura) }
}

export function applicaAnalisiPrezzo<T extends {descrizione?: string;unita_misura?: string;quantita?: number;prezzo_unitario?: number}>(voce:T, input:AiPriceAnalysisInput, output:unknown):T {
  const result=validaOutputAnalisi(output,input)
  if (result.esito !== 'proposta' || voce.descrizione !== input.lavorazione.descrizione || normalizeUnitOfMeasure(voce.unita_misura) !== input.lavorazione.unita_misura || Number(voce.quantita) !== input.lavorazione.quantita) throw Error('Analisi scaduta o proposta non applicabile.')
  return {...voce,prezzo_unitario:result.prezzo_proposto!}
}

export const schemaAnalisiPrezzo = {
  type:'object',additionalProperties:false,
  required:['esito','prezzo_proposto','unita_misura','fonte_principale','fonti_considerate','motivazione','confidence','avvertenze'],
  properties:{esito:{type:'string',enum:['proposta','da_verificare']},prezzo_proposto:{type:['number','null']},unita_misura:{type:'string'},fonte_principale:{type:['string','null']},
    fonti_considerate:{type:'array',items:{type:'object',additionalProperties:false,required:['id','fonte','codice','prezzo'],properties:{id:{type:'string'},fonte:{type:'string'},codice:{type:['string','null']},prezzo:{type:'number'}}}},
    motivazione:{type:'string'},confidence:{type:'string',enum:['alta','media','bassa']},avvertenze:{type:'array',items:{type:'string'}}},
} as const
