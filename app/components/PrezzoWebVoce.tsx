'use client'
import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { leggiStoricoPrezzi, risolviPrezzoPrioritario } from '../engines/price-resolution/storico-prezzi'
import { applicaPrezzoWeb, type AmbitoPrezzo, type EsitoWeb } from '../engines/price-resolution/web-fallback'
import type { PriceKnowledgeItem } from '../engines/price-resolution/types'
import { classificaLavorazioneWeb } from '../engines/price-resolution/tecnica-web'

export default function PrezzoWebVoce({descrizione,um,prezzi,memoria,onUsa,onInterno,onVerificato}:{
  descrizione:string;um:string;prezzi:readonly PriceKnowledgeItem[];memoria:readonly PriceKnowledgeItem[];
  onUsa:(esito:EsitoWeb)=>void;onInterno:(r:ReturnType<typeof risolviPrezzoPrioritario>)=>void;
  onVerificato?:(esito:EsitoWeb|null)=>void;
}){
  const [ambito,setAmbito]=useState<AmbitoPrezzo|''>('')
  const tecnica=classificaLavorazioneWeb({descrizione,unita_misura:um,ambito,qualificatori:''})
  const qualificatori=tecnica.qualificatori_documentati.join(', ')
  const [esito,setEsito]=useState<EsitoWeb|null>(null),[errore,setErrore]=useState(''),[busy,setBusy]=useState(false)
  const signature=JSON.stringify([descrizione,um,ambito,qualificatori]);const current=useRef(signature);current.current=signature
  const risultatoPer=useRef('');const valido=risultatoPer.current===signature
  async function cerca(){
    if(busy||!ambito||errore)return
    const expected=signature;setBusy(true);setEsito(null);onVerificato?.(null)
    try{
      const storico=await leggiStoricoPrezzi(supabase)
      if(current.current!==expected)return
      const interno=risolviPrezzoPrioritario({descrizione,unitaMisura:um},prezzi,memoria,storico)
      if(interno.priceResolution.matched){onInterno(interno);return}
      const session=await supabase.auth.getSession()
      if(session.error||!session.data.session)throw Error('Sessione non disponibile: ricerca non avviata.')
      const response=await fetch('/api/prezzi/web',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.data.session.access_token}`},
        body:JSON.stringify({descrizione,unita_misura:um,ambito,area:'Catania',qualificatori})})
      const result:EsitoWeb=await response.json()
      if(current.current!==expected)return
      if(!response.ok)throw Error(result.stato||'RICERCA_WEB_FALLITA')
      if(!['OK','NESSUN_RIFERIMENTO_VALIDO','NESSUN_RIFERIMENTO_VALIDO_CON_FONTI_INACCESSIBILI','RIFERIMENTI_INSUFFICIENTI','RIFERIMENTI_AMBIGUI'].includes(result.stato))throw Error('RICERCA_WEB_FALLITA')
      risultatoPer.current=expected;setEsito(result);onVerificato?.(result)
    }catch(e){if(current.current===expected)setErrore(e instanceof Error?e.message:'RICERCA_WEB_FALLITA')}
    finally{setBusy(false)}
  }
  return <div style={{marginTop:10,padding:10,border:'1px solid #cbd5e1',borderRadius:8}}>
    <strong>Riferimenti prezzo — Web fallback</strong>
    <p>Ricerca: Catania → Sicilia → Sud Italia → Italia. Nessun prezzo sostituito automaticamente.</p>
    <label>Ambito <select disabled={busy} value={ambito} onChange={e=>{setAmbito(e.target.value as AmbitoPrezzo|'');setEsito(null);onVerificato?.(null)}}>
      <option value="">Seleziona ambito</option><option>materiale</option><option>posa</option><option>fornitura e posa</option>
    </select></label>{' '}
    <details><summary>Descrizione completa e criteri tecnici</summary><p>{descrizione}</p>
      <p>Categoria: {tecnica.categoria}<br/>Materiale: {tecnica.materiale}<br/>Intervento: {tecnica.intervento}<br/>
      U.M.: {tecnica.unita_misura}<br/>Qualificatori documentati: {qualificatori||'non specificato'}</p></details>
    <button type="button" onClick={cerca} disabled={busy||!!errore||!ambito||!um}>{busy?'Ricerca in corso…':'Cerca riferimento Web'}</button>
    {errore&&<p role="alert">{errore} — STOP, nessun retry automatico.</p>}
    {esito&&valido&&<div>
      <p>Origine: Web<br/>Area utilizzata: {esito.area||'Non disponibile'}<br/>
        Fascia: {esito.minimo!==null&&esito.massimo!==null?`${esito.minimo.toLocaleString('it-IT')}–${esito.massimo.toLocaleString('it-IT')} €/${esito.unita_misura}`:'Non disponibile'}<br/>
        Prezzo proposto: {esito.prezzo_proposto===null?'Non disponibile':`${esito.prezzo_proposto.toLocaleString('it-IT')} €/${esito.unita_misura}`}<br/>
        Riferimenti: {esito.numero_riferimenti}<br/>Confidence: {esito.confidence}<br/>Prezzo da verificare<br/>{esito.stato}</p>
      <ul>{esito.percorso.map(p=><li key={p.area}>{p.area}: {p.riferimenti_validi} riferimenti validi — {p.stato}</li>)}</ul>
      <details><summary>Vedi fonti</summary>{esito.fonti.map(f=><p key={f.url}><a href={f.url} target="_blank" rel="noopener noreferrer">{f.titolo}</a><br/>
        {f.prezzo.toLocaleString('it-IT')} €/{f.unita_misura} — {f.ambito} — {f.area} — IVA {f.iva}<br/>
        Data prezzo: {f.data_prezzo||'Non dichiarata'} — Ricerca: {esito.data_ricerca.slice(0,10)}<br/>{f.evidenza}<br/>
        Geografia documentata: {f.geografia_documentata?.valore} — {f.geografia_documentata?.origine}: {f.geografia_documentata?.evidenza}</p>)}</details>
      <button type="button" disabled={busy||esito.stato!=='OK'} onClick={()=>{applicaPrezzoWeb({},esito);onUsa(esito)}}>Usa prezzo proposto</button>
    </div>}
  </div>
}
