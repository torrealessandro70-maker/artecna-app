import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import PanelModule from '../../../../app/components/AccordoContrattualePanel.tsx'
import TableModule from '../../../../app/components/SalTable.tsx'
import { supabase } from '../../../../lib/supabaseClient'
import { importoContrattoPreventivo } from '../../../../app/engines/economia/accordiContrattuali.ts'
const Panel=PanelModule.default ?? PanelModule
const Table=TableModule.default ?? TableModule
const h=React.createElement
const cid=new URLSearchParams(location.search).get('cantiere')
const report=(name,detail='')=>fetch('/phase?name='+name+'&detail='+encodeURIComponent(detail))
window.addEventListener('error',e=>void report('js-error',e.message))
function Fixture() {
 const [sal,setSal]=useState([])
 const [base,setBase]=useState(null)
 async function carica() {
  const rows=await supabase.rpc('fixture_sal_accordo',{p_cantiere:cid})
  const document=await supabase.rpc('fixture_documento_accordo',{p_cantiere:cid})
  if(rows.error || document.error) throw Error('Rilettura fixture fallita')
  setSal(rows.data ?? [])
  setBase(importoContrattoPreventivo(document.data))
 }
 return h(React.Fragment,null,
  h(Panel,{cantiereId:cid,onSalvato:carica}),
  h('output',{id:'base'},base==null?'Contratto da verificare':base.toFixed(2)),
  h('output',{id:'maturato'},sal.reduce((sum,r)=>sum+Number(r.importo_maturato),0).toFixed(2)),
  h(Table,{cantiereId:cid,nomeCantiere:'Pernicone sintetico',lavorazioni:sal,
   excelTable:{},excelTh:{},excelTd:{},formatMoney:n=>Number(n).toFixed(2),
   onUpdatePercentuale:async(row,value)=>{
    const res=await supabase.rpc('aggiorna_avanzamento_sal',{p_sal_id:row.id,p_percentuale:Number(value),p_completata:null})
    if(res.error)throw Error(res.error.message)
    await carica()
   },
   onToggleCompletata:()=>{throw Error('Azione non prevista')},
   onUpdateImporto:()=>{throw Error('Prezzo congelato')},
   onUpdateDescrizione:()=>{throw Error('Azione non prevista')},
   onElimina:()=>{throw Error('Azione non prevista')},
  }))
}
async function wait(fn,message='Interfaccia accordo non disponibile') {
 for(let i=0;i<200;i++) {
  const result=fn()
  if(result)return result
  await new Promise(resolve=>setTimeout(resolve,30))
 }
 throw Error(message)
}
function button(text){return [...document.querySelectorAll('button')].find(b=>b.textContent===text)}
async function input(label,value,index=0) {
 const element=[...document.querySelectorAll('label')].filter(l=>l.textContent.startsWith(label))[index]?.querySelector('input,textarea')
 if(!element)throw Error('Campo assente '+label)
 const prototype=element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype
 Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,value)
 element.dispatchEvent(new Event('input',{bubbles:true}))
 await new Promise(requestAnimationFrame)
}
async function run() {
 createRoot(document.getElementById('fixture')).render(h(Fixture))
 const summary=await wait(()=>[...document.querySelectorAll('summary')].find(e=>e.textContent.includes('Recupera documento storico')))
 summary.click()
 const select=await wait(()=>[...document.querySelectorAll('select')].find(e=>e.options.length>1&&e.options[0].text.includes('Seleziona')))
 select.value=select.options[1].value
 select.dispatchEvent(new Event('change',{bubbles:true}))
 await wait(()=>button('Aggiungi lavorazione originale'))
 await input('Descrizione originale','Lavori principali, sette gruppi')
 await input('Prezzo unitario originale','850')
 button('Aggiungi lavorazione originale').click()
 await wait(()=>[...document.querySelectorAll('label')].filter(l=>l.textContent.startsWith('Descrizione originale')).length===2)
 await input('Descrizione originale','Impermeabilizzazione doccia, opzione concordata',1)
 await input('Prezzo unitario originale','750',1)
 await input('Importo concordato IVA esclusa','1200')
 await input('Motivo dell’accordo','Accordo a corpo verificato')
 await input('Riferimento dell’accordo','Conferma sintetica')
 await input('Note documentali','Refuso subtotale 800 anziche 850. Opzione inclusa.')
 button('Verifica lavorazioni e calcola ribasso').click()
 await wait(()=>document.querySelector('table[aria-label="Anteprima prezzi contrattuali"]'))
 if(!document.body.textContent.includes('637,50')||!document.body.textContent.includes('562,50'))throw Error('Ripartizione Chrome errata')
 if(document.getElementById('base').textContent!=='Contratto da verificare')throw Error('Salvataggio implicito')
 await input('Ho verificato il PDF','CONFERMA CONTRATTO')
 await wait(()=>button('Conferma contratto')&&!button('Conferma contratto').disabled)
 button('Conferma contratto').click()
 await wait(()=>document.getElementById('base').textContent==='1200.00')
 const importa=await wait(()=>button('Importa lavorazioni concordate nel SAL'))
 importa.click()
 await wait(()=>document.querySelectorAll('input[aria-label^="Percentuale SAL "]').length===2)
 for(const percentage of ['50','100']) {
  const ids=[...document.querySelectorAll('input[aria-label^="Percentuale SAL "]')].map(e=>e.getAttribute('aria-label'))
  for(const id of ids) {
   const field=document.querySelector('input[aria-label="'+id+'"]')
   Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,percentage)
   field.dispatchEvent(new Event('input',{bubbles:true}))
   await new Promise(requestAnimationFrame)
   field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))
   await wait(()=>document.querySelector('input[aria-label="'+id+'"]').value===percentage&&!document.body.textContent.includes('Salvataggio…'))
   await new Promise(requestAnimationFrame)
  }
  await wait(()=>document.getElementById('maturato').textContent===(percentage==='50'?'600.00':'1200.00'),'SAL Chrome incoerente')
 }
 if(!document.querySelector('input[aria-label^="Importo SAL "]')?.readOnly)throw Error('Prezzo contrattuale editabile')
}
run().then(()=>report('pass','Documento originale, accordo 25%, SAL 600 e 1200 verificati'),
 error=>report('fail',error.message))
