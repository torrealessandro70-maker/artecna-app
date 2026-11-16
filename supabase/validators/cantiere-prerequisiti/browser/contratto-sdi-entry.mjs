import React from 'react'
import {createRoot} from 'react-dom/client'
import CenterModule from '../../../../app/components/CentroNotifiche.tsx'
import {supabase} from '../../../../lib/supabaseClient'
import FattureModule from '../../../../app/components/FattureEmessePanel.tsx'
import JSZip from 'jszip'
import IncassiLordiPanel from '../../../../app/components/IncassiLordiPanel.tsx'
import DettaglioModule from '../../../../app/components/PopupDettaglioFatturaEmessa.tsx'
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
root.render(modo==='incassi-lordi' ? React.createElement(DettaglioModule.default ?? DettaglioModule,{
  fatturaEmessaAperta:{id:params.get('draft'),cantiere_id:params.get('cantiere'),numero_fattura:'14',totale:10000,importo_incassato:10,stato:'parziale'},
  cantieri:[],statoCantieri:'pronto',formatMoney:String,
  aggiornaFatturaEmessa:()=>{throw Error('Scrittura inattesa nel dettaglio')},
  inputStyle:{},buttonPrimary:{},buttonSecondary:{},
}) : modo?.startsWith('incassi-') ? React.createElement(IncassiLordiPanel.default ?? IncassiLordiPanel,{id:params.get('draft'),contesto:['incassi-conferma','incassi-rettifica','incassi-elimina'].includes(modo)?'acconto':'fattura'}) : centro ? React.createElement(Center,{
  client:supabase,stile:{},menuImpostazioni:true,onApriScadenza:()=>{},onContatori:()=>{},
}) : ['importa','associa-storico'].includes(modo) ? React.createElement(Fatture,{
  fattureEmesseOrdinate:modo==='associa-storico'?[{
    id:params.get('draft'),numero_fattura:'BL-STORICO-BROWSER',data_fattura:'2024-06-01',
    cliente:'Fixture',imponibile:100,iva:10,totale:110,cantiere_id:params.get('cantiere'),
  }]:[], filtroFattureEmesse:'', formatMoney:String,
  setFiltroFattureEmesse:()=>{}, setNuovaFatturaEmessa:()=>{}, setPopupNuovaFatturaEmessa:()=>{},
  setFatturaEmessaAperta:()=>{}, caricaFatturaEmessaPdf:()=>{}, caricaFattureEmesse:()=>{}, ordinaFattureEmesse:()=>{},
}) : React.createElement(Panel,{
  id:params.get('draft'),acconto:params.get('mode')==='acconto',
}))
const pulsante=etichetta=>[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===etichetta)
const testo=frase=>document.body.textContent.includes(frase)
async function run(){
  if(modo==='incassi-elimina'){
    ;(await wait(()=>document.querySelector('details > summary'))).click()
    const totale=importo=>[...document.querySelectorAll('p')].some(p=>p.textContent.startsWith('Incasso lordo confermato: '+importo))
    const evita=()=>[...document.querySelectorAll('button')].find(b=>!b.disabled&&b.textContent==='Elimina'&&b.previousElementSibling?.textContent.endsWith(': cro'))
    await wait(()=>totale('20.000,00'))
    ;(await wait(evita)).click()
    ;(await wait(()=>pulsante('Annulla'))).click()
    await wait(()=>!pulsante('Conferma eliminazione'))
    if(!totale('20.000,00'))throw Error('Incasso rimosso senza conferma')
    ;(await wait(evita)).click()
    const form=await wait(()=>document.querySelector('input[name=conferma]')?.form)
    form.elements.namedItem('motivo').value='Duplicato verificato in Chrome'
    form.elements.namedItem('conferma').value='NO'
    pulsante('Conferma eliminazione').click()
    if(!form.isConnected||!totale('20.000,00'))throw Error('Conferma errata accettata')
    form.elements.namedItem('conferma').value='ELIMINA'
    pulsante('Conferma eliminazione').click()
    await wait(()=>totale('10.000,00')&&!evita()&&document.body.textContent.includes('82182298105'))
    await report('pass',modo)
    return
  }
  if(modo==='incassi-rettifica'){
    ;(await wait(()=>document.querySelector('details > summary'))).click()
    ;(await wait(()=>[...document.querySelectorAll('details > summary')].find(e=>e.textContent==='Rettifica riferimento'&&e.closest('details').parentElement.textContent.includes('synthetic-cro-01')), 'Comando rettifica non disponibile')).click()
    const form=await wait(()=>[...document.querySelectorAll('form')].find(f=>f.offsetWidth&&f.elements.namedItem('riferimento_nuovo')), 'Modulo rettifica non disponibile')
    form.elements.namedItem('riferimento_nuovo').value='SYNTHETIC-CRO-CHROME'
    form.elements.namedItem('fonte_rettifica').value='Estratto sintetico'
    form.elements.namedItem('motivo_rettifica').value='Controllo Chrome'
    form.querySelector('input[type=checkbox]').checked=true
    form.requestSubmit()
    await wait(()=>document.body.textContent.includes('Riferimento bancario aggiornato. Pagamento e importo invariati.'), 'Esito rettifica non disponibile')
    const aperti=new WeakSet()
    await wait(()=>{
      const storico=[...document.querySelectorAll('details')].find(e=>
        e.firstElementChild?.textContent==='Storico rettifiche'&&e.textContent.includes('synthetic-cro-chrome'))
      if(!storico) return false
      if(!storico.open&&!aperti.has(storico)){
        aperti.add(storico)
        storico.firstElementChild.click()
      }
      return storico.open&&storico.textContent.includes('synthetic-cro-01')
    }, 'Riferimento precedente assente nello storico della rettifica')
    await report('pass',modo)
    return
  }
  if(modo==='incassi-negato'){
    ;(await wait(()=>document.querySelector('details > summary'))).click()
    await wait(()=>document.body.textContent.includes('Lettura non disponibile'))
    if(document.querySelector('form'))throw Error('Writer esposto a sessione revocata')
    await report('pass',modo)
    return
  }
  if(modo==='incassi-conferma'||modo==='incassi-attribuzione'){
    ;(await wait(()=>document.querySelector('details > summary'))).click()
    const modale=()=>{
      const input=document.querySelector('form input[name=importo]')
      return input && !input.matches(':disabled') ? input.form : null
    }
    const form=await wait(modale)
    const invia=(form,valori)=>{
      for(const [nome,valore] of Object.entries(valori))form.elements.namedItem(nome).value=valore
      form.querySelector('input[type=checkbox]').checked=true
      form.requestSubmit()
    }
    if(modo==='incassi-conferma'){
      invia(form,{importo:'100',data:'2026-01-18',riferimento:'Chrome-TRN-sintetico',fonte:'Estratto sintetico'})
      await wait(()=>document.body.textContent.includes('Incasso lordo confermato: 100,00'))
    }else{
      const opzione=[...form.elements.namedItem('incasso').options].find(opt=>opt.textContent.includes('chrome-trn-sintetico'))
      if(!opzione)throw Error('Pagamento Chrome non disponibile')
      const valori={importo:'100',incasso:opzione.value}
      const zero=()=>[...document.querySelectorAll('dt')].some(e=>e.textContent.includes('Residuo finanziario')&&e.nextElementSibling.textContent.startsWith('0,00'))
      invia(form,valori)
      await wait(zero)
      window.confirm=()=>true
      ;(await wait(()=>pulsante('Revoca quota'))).click()
      await wait(()=>document.body.textContent.includes('Revocata'))
      invia(await wait(modale),valori)
      await wait(zero)
    }
    await report('pass',modo)
    return
  }
  if(modo==='incassi-lordi'){
    ;(await wait(()=>[...document.querySelectorAll('summary')].find(e=>e.textContent==='Incassi lordi verificati'))).click()
    await wait(()=>[...document.querySelectorAll('dt')].some(e=>e.textContent.includes('Residuo finanziario')&&e.nextElementSibling.textContent.match(/^0,00/)),'Residuo lordo non azzerato')
    await wait(()=>{
      const valore=nome=>[...document.querySelectorAll('dt')].find(e=>e.textContent===nome)?.nextElementSibling.textContent
      return valore('Incasso lordo verificato')?.startsWith('10.000,00') && valore('Stato finanziario')==='Interamente incassata'
    },'Lettura finanziaria 10.000 / 0 incompleta')
    if(document.querySelector('input[aria-label="Incassato storico dichiarato"]')?.value!=='10'||!testo('Stato storico: parziale'))throw Error('Storico dichiarato assente')
    if(pulsante('Attribuisci quota lorda')||pulsante('Revoca quota'))throw Error('Azioni finanziarie esposte nella vista di sola lettura')
    await report('pass',modo)
    return
  }
  if(modo==='importa'||modo==='associa-storico'){
    const xml='<FatturaElettronica><FatturaElettronicaHeader><CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>00000000000</IdCodice></IdFiscaleIVA></DatiAnagrafici></CedentePrestatore><CessionarioCommittente><DatiAnagrafici><CodiceFiscale>FIXTURE</CodiceFiscale><Anagrafica><Denominazione>Fixture</Denominazione></Anagrafica></DatiAnagrafici></CessionarioCommittente></FatturaElettronicaHeader><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD02</TipoDocumento><Numero>BL-BROWSER</Numero><Data>2024-06-01</Data><ImportoTotaleDocumento>110.00</ImportoTotaleDocumento></DatiGeneraliDocumento></DatiGenerali><DatiBeniServizi><DatiRiepilogo><ImponibileImporto>100.00</ImponibileImporto><Imposta>10.00</Imposta></DatiRiepilogo></DatiBeniServizi></FatturaElettronicaBody></FatturaElettronica>'
    const zip=new JSZip()
    zip.file('bl-browser.xml',modo==='associa-storico'?xml.replace('BL-BROWSER','BL-STORICO-BROWSER'):xml)
    const encoded=await zip.generateAsync({type:'uint8array'})
    const input=await wait(()=>document.querySelector('input[accept=".zip,.xml"]'),'Input importazione assente')
    const dt=new DataTransfer()
    dt.items.add(new File([encoded],'fixture-q2.zip'))
    dt.items.add(new File([encoded],'fixture-q2-sovrapposto.zip'))
    input.files=dt.files
    input.dispatchEvent(new Event('change',{bubbles:true}))
    await wait(()=>testo('2 occorrenze')&&testo('Esito SdI da verificare'),'Anteprima ZIP incompleta')
    if(modo==='associa-storico'){
      if(pulsante('Conferma associazione e tipo fiscale da XML'))throw Error('Conferma visibile prima del confronto')
      ;(await wait(()=>pulsante('Verifica corrispondenze storiche'),'Riepilogo storico assente')).click()
      await wait(()=>testo('Corrispondenze univoche proposte: 1'),'Proposta assente dal riepilogo')
      ;(await wait(()=>pulsante('Associa a fattura esistente'),'Azione storica assente')).click()
      const confronto=await wait(()=>document.querySelector('[aria-label="Confronto fattura storica"]'),'Confronto storico assente')
      await wait(()=>confronto.textContent.includes('TD02')&&confronto.textContent.includes('Fattura storica')
        &&confronto.textContent.includes('Tipo fiscale storico non documentato'),'Dati storici affiancati incompleti')
      ;(await wait(()=>pulsante('Conferma associazione e tipo fiscale da XML'),'Conferma assistita assente')).click()
      await wait(()=>testo('XML associato alla fattura esistente. Stato SdI invariato.'),'Associazione non confermata')
      await wait(()=>testo('Associazioni già verificate: 1'),'Esito assente dal riepilogo')
      await report('pass',modo)
      return
    }
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
