'use client'
import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { salvaEsclusione } from '../engines/economia/esclusioneProposta'
import type { RigaPrezzoMateriale } from '../engines/economia/prezzoMaterialeCliente'
export default function EsclusioneRigaEconomia({raccolta,riga,bloccato,onInvio,onRileggi}:{raccolta:{id:string;revisione:number;stato:string};riga:RigaPrezzoMateriale & {esclusa_proposta?:boolean;motivo_esclusione?:string|null;storicoEsclusione?:readonly {esclusa:boolean;motivo:string;at:string;utente:string}[]};bloccato:boolean;onInvio:(busy:boolean)=>void;onRileggi:()=>Promise<void>}){
 const [aperto,setAperto]=useState(false),[motivo,setMotivo]=useState(''),[conferma,setConferma]=useState(false),[invio,setInvio]=useState(false),[rileggi,setRileggi]=useState(false),[errore,setErrore]=useState('');const lock=useRef(false);const esclusa=riga.esclusa_proposta===true
 async function salva(){if(lock.current||bloccato||rileggi||raccolta.stato!=='bozza'||!conferma||motivo.trim().length<10)return;lock.current=true;setInvio(true);onInvio(true);try{await salvaEsclusione(supabase,raccolta,riga,!esclusa,motivo);await onRileggi()}catch(e){setErrore(e instanceof Error?e.message:'Esito non disponibile: rileggi.')}finally{setInvio(false);setRileggi(true);onInvio(false)}}
 return <section aria-label={'Classificazione proposta riga '+riga.ordine} style={{minWidth:180,overflowWrap:'anywhere'}}>
 {esclusa&&<p><strong>Esclusa dalla proposta — non economica.</strong> {riga.motivo_esclusione}</p>}
 {(riga.prezzo===0||esclusa)&&<button type="button" disabled={bloccato||invio||rileggi||raccolta.stato!=='bozza'} onClick={()=>setAperto(!aperto)}>{esclusa?'Ripristina inclusione':'Escludi dalla proposta — riga non economica'}</button>}
 {aperto&&<div><p>Riga {riga.ordine} — {riga.descrizione}. Quantità {riga.quantita}. Costo e provenienza non cambiano; la registrazione resta nello storico.</p><label>Motivo della decisione (10–1000 caratteri)<textarea value={motivo} maxLength={1000} disabled={invio||rileggi} onChange={e=>setMotivo(e.target.value)}/></label><label><input type="checkbox" checked={conferma} disabled={invio||rileggi} onChange={e=>setConferma(e.target.checked)}/>{esclusa?'Confermo che la riga deve tornare inclusa; il prezzo zero tornerà bloccante.':'Confermo che la riga è tecnica/informativa e non rappresenta un materiale da fatturare.'}</label><button type="button" disabled={bloccato||invio||rileggi||!conferma||motivo.trim().length<10} onClick={()=>void salva()}>Salva classificazione</button><button type="button" disabled={invio} onClick={()=>setAperto(false)}>Annulla</button></div>}
 {riga.storicoEsclusione&&riga.storicoEsclusione.length>0&&<details><summary>Storico classificazione ({riga.storicoEsclusione.length})</summary><ul>{riga.storicoEsclusione.map((e,i)=><li key={i}>{e.esclusa?'Esclusa':'Inclusa'} · {e.motivo} · {e.at} · {e.utente}</li>)}</ul></details>}
 {errore&&<p role="alert">{errore}</p>}{rileggi&&<button type="button" onClick={()=>void onRileggi()}>Rileggi Raccolta prima di continuare</button>}
 </section>
}
