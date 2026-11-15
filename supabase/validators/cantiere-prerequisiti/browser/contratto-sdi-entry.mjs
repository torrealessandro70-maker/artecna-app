import React from 'react'
import {createRoot} from 'react-dom/client'
import CenterModule from '../../../../app/components/CentroNotifiche.tsx'
import {supabase} from '../../../../lib/supabaseClient'
import FattureModule from '../../../../app/components/FattureEmessePanel.tsx'
import JSZip from 'jszip'
import PanelModule from '../../../../app/components/ContrattoFiscalePanel.tsx'

const Panel=PanelModule.default ?? PanelModule
const params=new URLSearchParams(location.search)
const report=(name,detail='')=>fetch('/phase?name='+name+'&detail='+encodeURIComponent(detail))
window.addEventListener('error',e=>void report('js-error',e.message))
const wait=async (fn, fase="Interfaccia fiscale non disponibile")=>{
  for(let i=0;i<150;i++){
    const value=fn()
    if(value)return value
    await new Promise(resolve=>setTimeout(resolve,30))
  }
  throw Error(fase + (modo==='importa' ? ': '+document.body.textContent.slice(0,400) : document.querySelector('[role=alert]')?.textContent ? ': '+document.querySelector('[role=alert]').textContent : ''))
}
const modo=params.get('mode')
const centro=['notifica','gestione','gestione-incasso-prima'].includes(modo)
const Fatture=FattureModule.default ?? FattureModule
const Center=CenterModule.default ?? CenterModule
const root=createRoot(document.querySelector('#fixture'))
if(centro && sessionStorage.getItem('fiscale-reload')){
  const url=new URL(location.href)
  url.searchParams.set('notifica',params.get('cantiere'))
  history.replaceState(null,'',url)
}
root.render(centro ? React.createElement(Center,{
  client:supabase,stile:{},menuImpostazioni:true,onApriScadenza:()=>{},onContatori:()=>{},
}) : modo==='importa' ? React.createElement(Fatture,{
  fattureEmesseOrdinate:[], filtroFattureEmesse:'', formatMoney:String,
  setFiltroFattureEmesse:()=>{}, setNuovaFatturaEmessa:()=>{}, setPopupNuovaFatturaEmessa:()=>{},
  setFatturaEmessaAperta:()=>{}, caricaFatturaEmessaPdf:()=>{}, caricaFattureEmesse:()=>{}, ordinaFattureEmesse:()=>{},
}) : React.createElement(Panel,{
  id:params.get('draft'),acconto:params.get('mode')==='acconto',
}))
const pulsante=etichetta=>[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===etichetta)
const testo=frase=>document.body.textContent.includes(frase)
async function run(){
  if(modo==='importa'){
    const xml='<FatturaElettronica><FatturaElettronicaHeader><CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>00000000000</IdCodice></IdFiscaleIVA></DatiAnagrafici></CedentePrestatore><CessionarioCommittente><DatiAnagrafici><CodiceFiscale>FIXTURE</CodiceFiscale><Anagrafica><Denominazione>Fixture</Denominazione></Anagrafica></DatiAnagrafici></CessionarioCommittente></FatturaElettronicaHeader><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD02</TipoDocumento><Numero>BL-BROWSER</Numero><Data>2024-06-01</Data><ImportoTotaleDocumento>110.00</ImportoTotaleDocumento></DatiGeneraliDocumento></DatiGenerali><DatiBeniServizi><DatiRiepilogo><ImponibileImporto>100.00</ImponibileImporto><Imposta>10.00</Imposta></DatiRiepilogo></DatiBeniServizi></FatturaElettronicaBody></FatturaElettronica>'
    const zip=new JSZip()
    zip.file('bl-browser.xml',xml)
    const encoded=await zip.generateAsync({type:'uint8array'})
    const input=await wait(()=>document.querySelector('input[accept=".zip,.xml"]'),'Input importazione assente')
    const dt=new DataTransfer()
    dt.items.add(new File([encoded],'fixture-q2.zip'))
    dt.items.add(new File([encoded],'fixture-q2-sovrapposto.zip'))
    input.files=dt.files
    input.dispatchEvent(new Event('change',{bubbles:true}))
    await wait(()=>testo('2 occorrenze')&&testo('Esito SdI da verificare'),'Anteprima ZIP incompleta')
    const cantiere=await wait(()=>document.querySelector('select option[value="'+params.get('cantiere')+'"]')?.parentElement,'Elenco cantieri assente')
    cantiere.value=params.get('cantiere')
    cantiere.dispatchEvent(new Event('change',{bubbles:true}))
    const conferma=await wait(()=>pulsante('Conferma importazione delle fatture nuove'))
    conferma.click()
    await wait(()=>testo('Nuove 1 · Già presenti 0 · Da verificare 0 · Errori 0'),'Primo salvataggio non confermato')
    conferma.click()
    await wait(()=>testo('Nuove 0 · Già presenti 1 · Da verificare 0 · Errori 0'),'Retry non riconosciuto')
    await report('pass','importa')
    return
  }
  if(modo==='gestione'||modo==='gestione-incasso-prima'){
    const badge=await wait(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Fatture da emettere')&&b.querySelector('[aria-label]')))
    badge.click()
    const scelta=await wait(()=>[...document.querySelectorAll('li')].find(li=>li.textContent.includes('Non letta')&&li.textContent.includes('Ricordamelo')))
    const giaFatturata=await wait(()=>Array.from(scelta.querySelectorAll('button')).find(b=>b.textContent.trim()==='Già fatturata'),'Comando Già fatturata assente')
    giaFatturata.click()
    await wait(()=>testo('Fattura presente — SdI da verificare'),'Proposta fiscale non disponibile')
    const candidato=await wait(()=>[...document.querySelectorAll('li')].find(li=>li.textContent.includes('BL-BROWSER')&&li.querySelector('button')))
    candidato.querySelector('button').click()
    await wait(()=>document.querySelector('[aria-label="Collega incasso"]')?.textContent.includes('Totale documento'),'Dettaglio attribuzione assente')
    const dialog=document.querySelector('[aria-label="Collega incasso"]')
    if(!dialog.querySelector('input[name="acconto"]:checked'))throw Error('Acconto non preselezionato')
    const quota=dialog.querySelector('input[inputmode="decimal"]')
    if(!quota)throw Error('Campo quota assente')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(quota,'15')
    quota.dispatchEvent(new Event('input',{bubbles:true}))
    dialog.querySelector('input[type="checkbox"]').click()
    window.confirm=()=>true
    const conferma=await wait(()=>{
      const b=pulsante('Conferma collegamento')
      return b&&!b.disabled&&b
    },'Conferma attribuzione disabilitata')
    conferma.click()
    await wait(()=>dialog.textContent.includes('€')&&dialog.textContent.includes('Autore'),'Attribuzione non riletta')
    ;(await wait(()=>pulsante('Chiudi collegamenti'),'Chiusura collegamento assente')).click()
    ;(await wait(()=>pulsante('← Chiudi'),'Chiusura proposta assente')).click()
    if(modo==='gestione-incasso-prima'){
      await report('pass',modo)
      return
    }
    const rinvio=await wait(()=>pulsante('Ricordamelo'))
    rinvio.click()
    ;(await wait(()=>pulsante('Domani'),'Scelta Domani assente')).click()
    await wait(()=>testo('Promemoria rinviato.'),'Rinvio non confermato')
    await report('pass','gestione')
    return
  }
  if(centro){
    if(!sessionStorage.getItem('fiscale-reload')){
      const cerca=test=>[...document.querySelectorAll('button')].find(test)
      const badge=await wait(()=>cerca(b=>b.textContent.includes('Fatture da emettere') && b.querySelector('[aria-label]')))
      badge.click()
      const apri=await wait(()=>cerca(b=>b.textContent==='Apri' && b.closest('li')?.textContent.includes('Non letta')))
      apri.click()
      await wait(()=>document.body.textContent.includes('Fatture collegate'))
      if(new URLSearchParams(location.search).get('notifica')!==params.get('cantiere'))throw Error('Deep link errato')
      sessionStorage.setItem('fiscale-reload','true')
      location.reload()
      return
    }
    await wait(()=>document.body.textContent.includes('Fatture collegate'))
    if(!document.body.textContent.includes('Da correggere e ritrasmettere'))throw Error('Stato dello scarto non visibile')
    sessionStorage.removeItem('fiscale-reload')
    await report('pass','notifica')
    return
  }
  ;(await wait(()=>document.querySelector('summary'))).click()
  const form=await wait(()=>document.querySelector('form'))
  if(params.get('mode')==='acconto'){
    if(!form.parentElement.textContent.includes('Regolarizzato'))throw Error('Copertura fiscale non visibile')
  }else{
    if(form.querySelector('select').value!=='TD04'||form.querySelector('[name=rettifica]').value!==params.get('cantiere'))throw Error('Collegamento TD04 assente')
    if(form.querySelectorAll('input[type=number]').length!==2)throw Error('Ripartizione TD04 assente')
  }
  await report('pass',params.get('mode'))
}
run().catch(e=>void report('fail',e.stack ?? e.message))
