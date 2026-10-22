'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { leggiStoricoPrezzi } from '../engines/price-resolution/storico-prezzi'
import { daVerificare, eseguiAnalisiPrezzo, preparaAnalisiPrezzo, riferimentiAnalisi, validaOutputAnalisi,
  type AiPriceAnalysisInput, type AiPriceAnalysisOutput } from '../engines/price-resolution/ai-price-analyst'
import type { PriceKnowledgeItem } from '../engines/price-resolution/types'
import type { EsitoWeb } from '../engines/price-resolution/web-fallback'

type IdentitaVoce = {id?:string|number;codice?:string;descrizione?:string;unita_misura?:string}
export function chiaveAnalisiVoce(voce:IdentitaVoce,index:number,voci:readonly IdentitaVoce[]):string {
  if(voce.id!==undefined&&voce.id!==null&&voce.id!=='')return `id:${typeof voce.id}:${voce.id}`
  const base=(v:IdentitaVoce)=>JSON.stringify([v.codice||'',v.descrizione||'',v.unita_misura||''])
  const identita=base(voce)
  const occorrenza=voci.slice(0,index).filter(v=>(v.id===undefined||v.id===null||v.id==='')&&base(v)===identita).length
  return JSON.stringify(['voce',identita,occorrenza])
}
function stesseFonti(prima:readonly PriceKnowledgeItem[],dopo:readonly PriceKnowledgeItem[]) {
  // Confronto dei dati letti dal preparatore: un nuovo array equivalente non invalida l'esito.
  const campi=['id','codice','descrizione','unita_misura','prezzo_unitario','fonte','regione','anno','versione','tipo_prezzo','zona','updated_at'] as const
  return prima.length===dopo.length&&prima.every((r,i)=>{
    const a=r as PriceKnowledgeItem&{zona?:string;updated_at?:string}
    const b=dopo[i] as typeof a
    return campi.every(k=>Object.is(a[k],b[k]))
  })
}

export default function AnalisiPrezzoVoce({descrizione,um,quantita,prezzo,prezzi,memoria,webVerificato,onUsa}:{
  descrizione:string;um:string;quantita:number;prezzo:number;prezzi:readonly PriceKnowledgeItem[];memoria:readonly PriceKnowledgeItem[];
  webVerificato?:EsitoWeb|null;onUsa:(input:AiPriceAnalysisInput,result:AiPriceAnalysisOutput)=>void;
}) {
  const [busy,setBusy]=useState(false)
  const [analisi,setAnalisi]=useState<{input:AiPriceAnalysisInput;result:AiPriceAnalysisOutput;firma:string;prezzi:readonly PriceKnowledgeItem[];memoria:readonly PriceKnowledgeItem[]}|null>(null)
  const [avviso,setAvviso]=useState<{testo:string;firma:string}|null>(null)
  const running=useRef(false),mounted=useRef(true)
  const firma=JSON.stringify([descrizione,um,quantita,prezzo,webVerificato])
  const current=useRef(firma);current.current=firma
  const sources=useRef({prezzi,memoria});sources.current={prezzi,memoria}
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  const valida=analisi?.firma===firma&&stesseFonti(analisi.prezzi,prezzi)&&stesseFonti(analisi.memoria,memoria)
  async function analizza() {
    if(running.current)return
    const expected=firma
    const snapshot={prezzi:prezzi.map(p=>({...p})),memoria:memoria.map(p=>({...p}))}
    const ancoraValida=()=>mounted.current&&current.current===expected&&stesseFonti(snapshot.prezzi,sources.current.prezzi)&&stesseFonti(snapshot.memoria,sources.current.memoria)
    running.current=true;setBusy(true);setAnalisi(null);setAvviso(null)
    try {
      const storico=await leggiStoricoPrezzi(supabase)
      if(!ancoraValida())return
      const prepared=preparaAnalisiPrezzo({descrizione,unitaMisura:um,quantita},prezzi,memoria,storico,webVerificato)
      if(prepared.risoltoDaFonteForte){setAvviso({testo:'Fonte interna già risolutiva: analisi AI non necessaria. Prezzo attuale invariato.',firma:expected});return}
      const result=await eseguiAnalisiPrezzo(prepared.input,async input=>{
        const session=await supabase.auth.getSession()
        if(!ancoraValida())throw Error('Analisi scaduta')
        if(session.error||!session.data.session)throw Error('Sessione non disponibile')
        const response=await fetch('/api/prezzi/analisi-ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.data.session.access_token}`},body:JSON.stringify(input)})
        if(!response.ok)throw Error('Analisi non disponibile')
        return JSON.stringify(await response.json())
      })
      if(ancoraValida())setAnalisi({input:prepared.input,result:validaOutputAnalisi(result,prepared.input),firma:expected,...snapshot})
    } catch {
      if(ancoraValida())setAvviso({testo:daVerificare('Analisi non disponibile: Prezzo da verificare.').motivazione,firma:expected})
    } finally {running.current=false;if(mounted.current)setBusy(false)}
  }
  return <section aria-label="Analisi AI prezzo" style={{marginTop:10,padding:10,border:'1px solid #cbd5e1',borderRadius:8}}>
    <strong>Analisi AI prezzo</strong>
    <p>Confronto delle sole fonti disponibili. Nessuna ricerca Web, applicazione o salvataggio automatico.</p>
    <button type="button" disabled={busy||!descrizione||!um||quantita<=0} onClick={analizza}>{busy?'Analisi in corso…':'Analizza riferimenti prezzo'}</button>
    {avviso&&avviso.firma===firma&&<p role="status">{avviso.testo}</p>}
    {analisi&&valida&&<div role="status">
      <p>{analisi.result.esito==='proposta'?`Prezzo proposto: ${analisi.result.prezzo_proposto?.toLocaleString('it-IT')} €/${analisi.result.unita_misura}`:'Prezzo da verificare'}<br/>
        Confidence: {analisi.result.confidence}<br/>Fonte principale: {riferimentiAnalisi(analisi.input).find(c=>c.id===analisi.result.fonte_principale)?.etichetta||'Nessuna'}</p>
      <p>{analisi.result.motivazione}</p>
      <ul>{analisi.result.fonti_considerate.map(f=><li key={f.id}>{f.fonte} · {f.codice||f.id} · {f.prezzo.toLocaleString('it-IT')} €/{analisi.result.unita_misura}</li>)}</ul>
      <ul>{analisi.result.avvertenze.map((a,i)=><li key={i}>{a}</li>)}</ul>
      {analisi.result.esito==='proposta'&&<button type="button" disabled={busy} onClick={()=>{onUsa(analisi.input,analisi.result);setAnalisi(null)}}>Usa prezzo proposto</button>}
    </div>}
  </section>
}
