import React from 'react'
import {createRoot} from 'react-dom/client'
import CenterModule from '../../../../app/components/CentroNotifiche.tsx'
import {supabase} from '../../../../lib/supabaseClient'
import PanelModule from '../../../../app/components/ContrattoFiscalePanel.tsx'

const Panel=PanelModule.default ?? PanelModule
const params=new URLSearchParams(location.search)
const report=(name,detail='')=>fetch('/phase?name='+name+'&detail='+encodeURIComponent(detail))
window.addEventListener('error',e=>void report('js-error',e.message))
const wait=async fn=>{
  for(let i=0;i<150;i++){
    const value=fn()
    if(value)return value
    await new Promise(resolve=>setTimeout(resolve,30))
  }
  throw Error('Interfaccia fiscale non disponibile')
}
const centro=params.get('mode')==='notifica'
const Center=CenterModule.default ?? CenterModule
const root=createRoot(document.querySelector('#fixture'))
if(centro && sessionStorage.getItem('fiscale-reload')){
  const url=new URL(location.href)
  url.searchParams.set('notifica',params.get('cantiere'))
  history.replaceState(null,'',url)
}
root.render(centro ? React.createElement(Center,{
  client:supabase,stile:{},menuImpostazioni:true,onApriScadenza:()=>{},onContatori:()=>{},
}) : React.createElement(Panel,{
  id:params.get('draft'),acconto:params.get('mode')==='acconto',
}))
async function run(){
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
run().catch(e=>void report('fail',e.message))
