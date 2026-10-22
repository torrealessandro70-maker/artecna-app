import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriceKnowledgeItem } from '../price-resolution/types'
import { leggiStoricoPrezzi } from '../price-resolution/storico-prezzi'
import { risolviPrezzoRevisioneAi } from '../price-resolution/revisione-ai'
import { normalizeUnitOfMeasure } from '../price-resolution/normalizer'
import { leggiListinoManuale, salvaVoceListino, type VoceListino } from './listino-manuale'

export type RilevazioneStorica = PriceKnowledgeItem & {
  id: string; preventivoId: string; cantiere: string | null; data: string | null
}
export type PropostaStorico = {
  id: string; stato: 'NUOVA' | 'AGGIORNAMENTO' | 'INVARIATA'
  descrizione: string; unita: string; attuale?: VoceListino
  rilevazioni: RilevazioneStorica[]; minimo: number; massimo: number; media: number; mediana: number
  blocco?: string
}

// La selezione affidabile appartiene esclusivamente a Storico V2.
export async function leggiRilevazioniStoriche(db: SupabaseClient): Promise<RilevazioneStorica[]> {
  const ammesse = await leggiStoricoPrezzi(db)
  const riferimenti = new Map<string, { preventivo_id: string }>()
  const testate = new Map<string, { cantiere: string | null; data_preventivo: string | null }>()
  const ids = ammesse.map(r => r.id!).filter(Boolean)
  for (let start = 0; start < ids.length; start += 100) {
    const { data, error } = await db.from('preventivo_lavorazioni').select('id,preventivo_id').in('id', ids.slice(start, start + 100))
    if (error) throw Error(error.message)
    for (const row of data || []) riferimenti.set(String(row.id), row)
  }
  const preventivi = [...new Set([...riferimenti.values()].map(r => r.preventivo_id))]
  for (let start = 0; start < preventivi.length; start += 100) {
    const { data, error } = await db.from('preventivi_cantiere').select('id,cantiere,data_preventivo').in('id', preventivi.slice(start, start + 100))
    if (error) throw Error(error.message)
    for (const row of data || []) testate.set(row.id, row)
  }
  return ammesse.filter(r => r.id && r.descrizione.trim() && normalizeUnitOfMeasure(r.unita_misura)).map(r => {
    const riferimento = riferimenti.get(r.id!)
    if (!riferimento || !testate.has(riferimento.preventivo_id)) throw Error('Origine storico non verificabile. Ripetere l’analisi.')
    const testata = testate.get(riferimento.preventivo_id)!
    return { ...r, id: r.id!, preventivoId: riferimento.preventivo_id, cantiere: testata.cantiere, data: testata.data_preventivo }
  })
}

const score = (a: PriceKnowledgeItem, b: PriceKnowledgeItem) => {
  const risultato = risolviPrezzoRevisioneAi({ descrizione: a.descrizione, unitaMisura: a.unita_misura }, [b], [])
  return risultato.priceResolution.matched ? risultato.priceResolution.confidence : 0
}
const equivalenti = (a: PriceKnowledgeItem, b: PriceKnowledgeItem) => score(a, b) > 0 && score(b, a) > 0

export function creaProposteStorico(storico: readonly RilevazioneStorica[], listino: readonly VoceListino[]): PropostaStorico[] {
  const gruppi: RilevazioneStorica[][] = []
  for (const riga of [...storico].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!riga.descrizione.trim() || !normalizeUnitOfMeasure(riga.unita_misura) || !Number.isFinite(riga.prezzo_unitario) || riga.prezzo_unitario <= 0) continue
    // Nessuna catena transitiva: ogni componente deve essere compatibile con tutti gli altri.
    const gruppo = gruppi.find(g => g.every(r => equivalenti(riga, r)))
    if (gruppo) gruppo.push(riga)
    else gruppi.push([riga])
  }
  const proposte = gruppi.map<PropostaStorico>(rilevazioni => {
    const prezzi = rilevazioni.map(r => r.prezzo_unitario).sort((a, b) => a - b)
    const middle = Math.floor(prezzi.length / 2)
    const mediana = prezzi.length % 2 ? prezzi[middle] : (prezzi[middle - 1] + prezzi[middle]) / 2
    const candidati = listino.filter(r => r.tipo_prezzo === 'artecna').map(r => ({ r, score: Math.min(...rilevazioni.map(h => equivalenti(h, r) ? score(h, r) : 0)) }))
      .filter(c => c.score > 0).sort((a, b) => b.score - a.score)
    const primi = candidati.filter(c => c.score === candidati[0]?.score)
    const attuale = primi.length === 1 ? primi[0].r : undefined
    return { id: rilevazioni.map(r => r.id).join(':'), descrizione: rilevazioni[0].descrizione,
      unita: normalizeUnitOfMeasure(rilevazioni[0].unita_misura), rilevazioni,
      minimo: prezzi[0], massimo: prezzi[prezzi.length - 1], media: prezzi.reduce((a, b) => a + b, 0) / prezzi.length, mediana,
      attuale, stato: attuale ? (Math.abs(Number(attuale.prezzo_unitario) - mediana) < 0.005 ? 'INVARIATA' : 'AGGIORNAMENTO') : 'NUOVA',
      blocco: primi.length > 1 ? 'Più voci Listino equivalenti: scelta manuale necessaria.' : attuale && /^SIC24/i.test(attuale.codice || '') ? 'Codice SIC24 riservato: aggiornamento non consentito.' : undefined }
  })
  for (const p of proposte) {
    if (p.attuale && proposte.filter(q => q.attuale?.id === p.attuale!.id).length > 1) p.blocco = 'Più gruppi storici per la stessa voce Listino: scelta manuale necessaria.'
    if (!p.attuale && proposte.some(q => q !== p && !q.attuale && p.rilevazioni.some(a => q.rilevazioni.some(b => equivalenti(a, b))))) p.blocco = 'Gruppi storici sovrapposti: scelta manuale necessaria.'
  }
  return proposte
}

export async function analizzaStoricoListino(db: SupabaseClient) {
  const storico = await leggiRilevazioniStoriche(db)
  const listino = await leggiListinoManuale(db)
  return creaProposteStorico(storico, listino)
}

export async function applicaProposteStorico(db: SupabaseClient, proposte: readonly PropostaStorico[], selezionate: readonly string[], confermata: boolean): Promise<number> {
  if (!confermata) return 0
  const scelte = proposte.filter(p => selezionate.includes(p.id))
  if (!scelte.length) return 0
  if (scelte.some(p => p.blocco || p.stato === 'INVARIATA')) throw Error('Selezione non applicabile.')
  const aggiornate = await analizzaStoricoListino(db)
  for (const p of scelte) {
    const fresh = aggiornate.find(q => q.id === p.id)
    if (!fresh || fresh.blocco || fresh.stato !== p.stato || fresh.mediana !== p.mediana || fresh.attuale?.id !== p.attuale?.id ||
      fresh.attuale?.prezzo_unitario !== p.attuale?.prezzo_unitario || fresh.descrizione !== p.descrizione || fresh.unita !== p.unita ||
      JSON.stringify(fresh.rilevazioni) !== JSON.stringify(p.rilevazioni)) {
      throw Error('Storico o Listino cambiati dopo l’analisi. Ripetere l’analisi e confermare di nuovo.')
    }
  }
  let salvate = 0
  try {
    for (const p of scelte) {
      if (p.attuale) {
        // Solo prezzo e timestamp: note, codice, id e ogni altro campo restano intatti.
        const update = db.from('prezzi_lavorazioni').update({ prezzo_unitario: p.mediana, updated_at: new Date().toISOString() })
          .eq('id', p.attuale.id).eq('tipo_prezzo', 'artecna').eq('prezzo_unitario', p.attuale.prezzo_unitario)
        const guarded = p.attuale.codice == null ? update.is('codice', null) : update.eq('codice', p.attuale.codice)
        const { error } = await guarded.select('id').single()
        if (error) throw Error(error.message)
      } else {
        await salvaVoceListino(db, { codice: '', descrizione: p.descrizione, unita_misura: p.unita,
          prezzo_unitario: String(p.mediana), categoria: '', zona: 'Catania', regione: '', note: '' })
      }
      salvate += 1
    }
  } catch (e) {
    throw Error(`${salvate} voci applicate prima dell’interruzione. ${e instanceof Error ? e.message : 'Errore salvataggio.'} Rileggere l’elenco prima di riprovare.`)
  }
  return salvate
}
