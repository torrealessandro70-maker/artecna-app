import { buildMemoryFromSources, buildSopralluogoMemory } from '../sopralluogo-memory/builder'
import { buildVarianteMemorySources } from '../sopralluogo-memory/variante'
import type { BuildSopralluogoMemoryInput, ComposedMemory, SopralluogoMemory, MemorySource } from '../sopralluogo-memory/types'
import type { FotoFonte, LetturaOsservatore } from '../variante-fonti/contratto'
import { risolviPrezzoPrioritario } from '../price-resolution/storico-prezzi'
import type { PriceKnowledgeItem } from '../price-resolution/types'

export type OperazioneIntegrativa = 'nuova' | 'aumento' | 'riduzione' | 'eliminazione'
export type VoceContrattuale = { id: string; descrizione: string; unita_misura: string; quantita: number; prezzo_unitario: number; quantita_riducibile: number | null }
export type ContrattoContext = { id: string; voci: VoceContrattuale[] }
export type Genealogia = { cantiere_id: string; variante_id: string; preventivo_contrattuale_id: string; sopralluogo_origine_id: string | null }
export type SnapshotIntegrativo = { lettura: LetturaOsservatore; contratto: ContrattoContext; genealogia: Genealogia; firma: string; documento_confermato?: string | null; lavorazioni_presenti?: number }
export type PreventivoGenerationContext = {
  tipo: 'contrattuale' | 'integrativo'; narrativa: ComposedMemory
  foto: readonly FotoFonte[]; analisiOsservatore?: LetturaOsservatore['analisi']
  contestoContrattuale?: ContrattoContext; genealogia?: Partial<Genealogia>
}
export const messaggioAnalisiObsoleta = 'L’analisi AI Osservatore non è allineata alle fonti. Rianalizzare prima di generare il preventivo?'
export function contestoSopralluogo(input: BuildSopralluogoMemoryInput): PreventivoGenerationContext & { memoria: SopralluogoMemory } {
  const memoria = buildSopralluogoMemory(input)
  const fonti: MemorySource[] = [
    { source_type: 'descrizione', source_id: input.sopralluogoId, origine: 'sopralluogo', testo: memoria.descrizioneIniziale },
    ...(memoria.quaderno ? [{ source_type: 'nota' as const, source_id: input.sopralluogoId + ':quaderno', origine: 'sopralluogo' as const, ...memoria.quaderno }] : []),
  ]
  return { tipo: 'contrattuale', memoria, narrativa: { ...buildMemoryFromSources(fonti), testoUnificato: memoria.testoUnificato }, foto: [],
    genealogia: { sopralluogo_origine_id: input.sopralluogoId } }
}
export function contestoVariante(s: SnapshotIntegrativo): PreventivoGenerationContext {
  if (s.documento_confermato) throw Error('Preventivo Integrativo già confermato: consulta il Registro e le lavorazioni della Variante')
  if (s.lavorazioni_presenti) throw Error('La bozza contiene già lavorazioni: generazione automatica bloccata per evitare duplicazioni. Usa una bozza senza lavorazioni.')
  const p = s.lettura.fonti, analisi = s.lettura.analisi
  if (analisi && !analisi.allineata) throw Error(messaggioAnalisiObsoleta)
  if (p.foto.some(f => !f.disponibile)) throw Error('Foto collegata non disponibile: aggiorna le fonti')
  const fonti = buildVarianteMemorySources({ variante: { ...p.variante, stato: 'bozza' }, cantiere_id: p.cantiere_id,
    quaderni: p.quaderni.filter(q => q.disponibile).map(q => ({ id: q.id, titolo: q.titolo, testo: q.testo, updated_at: q.updated_at })) })
  if (analisi) fonti.push({ source_type: 'nota', source_id: analisi.id, source_version: analisi.data,
    origine: 'variante', titolo: 'AI Osservatore — osservazioni da verificare', testo: JSON.stringify(analisi.risultato) })
  return { tipo: 'integrativo', narrativa: buildMemoryFromSources(fonti), foto: p.foto,
    analisiOsservatore: analisi, contestoContrattuale: s.contratto, genealogia: s.genealogia }
}
export type VoceIntegrativa = {
  descrizione: string; unita_misura: string; quantita: number; prezzo_unitario: number; note: string
  operazione: OperazioneIntegrativa; riferimento_preventivo_lavorazione_id: string | null
  da_verificare: boolean; revisione_confermata: boolean; fonte_prezzo: string
  priceResolution?: ReturnType<typeof risolviPrezzoPrioritario>['priceResolution']
}
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const testo = (x: unknown) => typeof x === 'string' ? x : ''
export function leggiRispostaIntegrativa(data: unknown, contratto: ContrattoContext,
  prezzi: readonly PriceKnowledgeItem[] = [], memoria: readonly PriceKnowledgeItem[] = [], storico: readonly PriceKnowledgeItem[] = []): VoceIntegrativa[] {
  if (!record(data) || !Array.isArray(data.voci) || data.voci.length < 1 || data.voci.length > 1000) throw Error('JSON preventivo non valido')
  return data.voci.map((value): VoceIntegrativa => {
    if (!record(value) || typeof value.quantita !== 'number' || !Number.isFinite(value.quantita) || value.quantita < 0) throw Error('Quantità AI non valida')
    const op = value.operazione
    if (!['nuova','aumento','riduzione','eliminazione'].includes(String(op)) || !testo(value.descrizione).trim()) throw Error('Operazione/descrizione non valida')
    const id = value.riferimento_preventivo_lavorazione_id == null ? null : String(value.riferimento_preventivo_lavorazione_id)
    const ref = op === 'nuova' ? undefined : contratto.voci.find(v => v.id === id)
    const riferimento = op === 'nuova' ? null : ref?.id ?? null
    const prezzo = risolviPrezzoPrioritario({ descrizione: testo(value.descrizione), unitaMisura: testo(value.unita_misura) }, prezzi, memoria, storico)
    const negativa = op === 'riduzione' || op === 'eliminazione'
    return { ...prezzo, descrizione: testo(value.descrizione), unita_misura: ref?.unita_misura ?? testo(value.unita_misura),
      quantita: negativa ? -value.quantita : value.quantita,
      prezzo_unitario: riferimento ? Number(ref!.prezzo_unitario) : prezzo.prezzo_unitario,
      fonte_prezzo: riferimento ? 'Prezzo contratto — nessuna nuova risoluzione' : prezzo.fonte_prezzo,
      note: testo(value.note), operazione: op as OperazioneIntegrativa, riferimento_preventivo_lavorazione_id: riferimento,
      da_verificare: value.da_verificare !== false || (op !== 'nuova' && !ref) || (op === 'nuova' && id !== null) || value.quantita === 0 || (!riferimento && !prezzo.priceResolution.matched),
      revisione_confermata: false }
  })
}
export function validaRevisione(voci: readonly VoceIntegrativa[], contratto: ContrattoContext) {
  if (!voci.length || voci.length > 1000) throw Error('Revisione vuota o troppo grande')
  for (const v of voci) {
    if (!['nuova','aumento','riduzione','eliminazione'].includes(v.operazione)) throw Error('Operazione non valida')
    if (!v.revisione_confermata || v.da_verificare || !v.descrizione.trim() || !v.unita_misura.trim() ||
      !Number.isFinite(v.quantita) || !Number.isFinite(v.prezzo_unitario) || v.prezzo_unitario <= 0 || v.quantita === 0) throw Error('Completa la revisione umana di ogni voce')
    if (Math.abs(v.quantita) >= 1e12 || v.prezzo_unitario >= 1e12 || Math.abs(v.quantita * v.prezzo_unitario) >= 1e16 ||
      Number(v.quantita.toFixed(6)) !== v.quantita || Number(v.prezzo_unitario.toFixed(6)) !== v.prezzo_unitario) throw Error('Quantità/prezzo fuori precisione economica supportata')
    const ref = contratto.voci.find(c => c.id === v.riferimento_preventivo_lavorazione_id)
    if (v.operazione === 'nuova') { if (v.quantita < 0 || v.riferimento_preventivo_lavorazione_id) throw Error('Nuova lavorazione non coerente') }
    else {
      if (!ref || v.unita_misura !== ref.unita_misura || v.prezzo_unitario !== Number(ref.prezzo_unitario)) throw Error('Riferimento/prezzo contrattuale non coerente')
      if (v.operazione === 'aumento' ? v.quantita <= 0 : v.quantita >= 0) throw Error('Segno del delta non coerente')
      if (v.operazione === 'riduzione' || v.operazione === 'eliminazione') {
        if (ref.quantita_riducibile === null || -v.quantita > ref.quantita_riducibile ||
          (v.operazione === 'eliminazione' && -v.quantita !== ref.quantita_riducibile)) throw Error('Riduzione/eliminazione non coerente con il residuo verificato')
      }
    }
  }
  return voci.reduce((tot, v) => tot + Math.round(v.quantita * v.prezzo_unitario * 100) / 100, 0)
}
