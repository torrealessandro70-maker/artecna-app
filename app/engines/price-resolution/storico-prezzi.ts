import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriceKnowledgeItem, PriceResolutionInput } from './types'
import { risolviPrezzoRevisioneAi } from './revisione-ai'

export async function leggiStoricoPrezzi(db: SupabaseClient): Promise<PriceKnowledgeItem[]> {
  // Origine manuale esplicita; la bozza richiede prova di utilizzo della singola riga.
  const preventivi = new Map<string, { approvato: boolean; cantiereId: string | null }>()
  for(let from=0;;from+=200){
    const r=await db.from('preventivi_cantiere').select('id,cantiere_id,approvato,origine_ai').eq('origine_ai',false).order('id').range(from,from+199)
    if(r.error)throw Error('STORICO_PREVENTIVI_NON_VERIFICABILE')
    for(const p of r.data||[])if(typeof p.id==='string' && p.origine_ai === false) {
      preventivi.set(p.id, { approvato: p.approvato === true, cantiereId: typeof p.cantiere_id === 'string' ? p.cantiere_id : null })
    }
    if((r.data||[]).length<200)break
  }
  const contratti = new Map<string, string>()
  const maturate = new Set<string>()
  const cantieri = [...new Set([...preventivi.values()].filter(p => !p.approvato && p.cantiereId).map(p => p.cantiereId!))]
  for(let batch=0;batch<cantieri.length;batch+=100){
    const gruppo = cantieri.slice(batch,batch+100)
    for(let from=0;;from+=200){
      const r=await db.from('cantieri').select('id,preventivo_contrattuale_id').in('id',gruppo).order('id').range(from,from+199)
      if(r.error)throw Error('STORICO_CONTRATTI_NON_VERIFICABILI')
      for(const c of r.data||[])if(gruppo.includes(c.id) && typeof c.preventivo_contrattuale_id === 'string')contratti.set(c.id,c.preventivo_contrattuale_id)
      if((r.data||[]).length<200)break
    }
    const contrattuali = gruppo.filter(id => contratti.has(id))
    if(!contrattuali.length)continue
    for(let from=0;;from+=200){
      const r=await db.from('sal_lavorazioni').select('id,cantiere_id,source_lavorazione_id,source_variante_lavorazione_id,percentuale')
        .in('cantiere_id',contrattuali).gt('percentuale',0).order('id').range(from,from+199)
      if(r.error)throw Error('STORICO_SAL_NON_VERIFICABILE')
      for(const s of r.data||[]){
        const percentuale = Number(s.percentuale)
        if(contrattuali.includes(s.cantiere_id) && s.source_lavorazione_id != null && s.source_variante_lavorazione_id == null &&
          Number.isFinite(percentuale) && percentuale > 0 && percentuale <= 100) {
          maturate.add(`${s.cantiere_id}:${s.source_lavorazione_id}`)
        }
      }
      if((r.data||[]).length<200)break
    }
  }
  const ids = [...preventivi.keys()].filter(id => {
    const p = preventivi.get(id)!
    return p.approvato || (p.cantiereId !== null && contratti.get(p.cantiereId) === id)
  })
  const result:PriceKnowledgeItem[]=[]
  for(let batch=0;batch<ids.length;batch+=100)for(let from=0;;from+=200){
    const r=await db.from('preventivo_lavorazioni').select('id,preventivo_id,cantiere_id,descrizione,unita_misura,prezzo_unitario,quantita,importo_previsto')
      .in('preventivo_id',ids.slice(batch,batch+100)).order('id').range(from,from+199)
    if(r.error)throw Error('STORICO_PREVENTIVI_NON_VERIFICABILE')
    for(const p of r.data||[]){
      const testata = preventivi.get(p.preventivo_id)
      if(!testata || (!testata.approvato && (testata.cantiereId !== p.cantiere_id ||
        contratti.get(p.cantiere_id) !== p.preventivo_id || !maturate.has(`${p.cantiere_id}:${p.id}`))))continue
      if(p.prezzo_unitario===null||p.prezzo_unitario===undefined||p.quantita===null||p.importo_previsto===null)continue
      const price=Number(p.prezzo_unitario),q=Number(p.quantita),total=Number(p.importo_previsto)
      if(!Number.isFinite(price)||price<=0||!Number.isFinite(q)||q<=0||!Number.isFinite(total)||total<0||
        Math.abs(Math.round(q*price*100)-Math.round(total*100))>1||typeof p.descrizione!=='string'||!p.unita_misura)continue
      result.push({id:String(p.id),descrizione:p.descrizione,unita_misura:p.unita_misura,prezzo_unitario:price,
        fonte:testata.approvato ? 'Storico ARTECNA — preventivo approvato' : 'Storico ARTECNA — contratto maturato nel SAL'})
    }
    if((r.data||[]).length<200)break
  }
  return result
}
export function risolviPrezzoPrioritario(input:PriceResolutionInput&{prezzoAi?:number},prezzi:readonly PriceKnowledgeItem[],memoria:readonly PriceKnowledgeItem[],storico:readonly PriceKnowledgeItem[]){
  const storicoRisolto = risolviPrezzoRevisioneAi(input,storico,[])
  if(storicoRisolto.priceResolution.matched){
    return { ...storicoRisolto, prezzo_unitario: storicoRisolto.priceResolution.prezzoUnitarioRisolto!,
      priceResolution: { ...storicoRisolto.priceResolution,
        reasons: ['Storico ARTECNA affidabile: U.M. compatibile e descrizione pertinente; prezzo aziendale senza maggiorazione.'] } }
  }
  const mem=memoria.filter(p=>!(/fallback|da verificare/i.test(p.fonte||''))&&(!/web/i.test(p.fonte||'')||/web confermato/i.test(p.fonte||'')))
  const groups:[readonly PriceKnowledgeItem[],readonly PriceKnowledgeItem[]][]=[
    [prezzi.filter(p=>p.tipo_prezzo==='artecna'),[]],
    [prezzi.filter(p=>p.tipo_prezzo!=='artecna'&&/^SIC24[_.]/i.test(p.codice||'')),[]],
    [[],mem],
  ]
  for(const [list,memory] of groups){const r=risolviPrezzoRevisioneAi(input,list,memory);if(r.priceResolution.matched)return r}
  return risolviPrezzoRevisioneAi(input,[],[])
}
