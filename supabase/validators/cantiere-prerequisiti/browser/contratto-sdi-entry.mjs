import React from 'react'
import {createRoot} from 'react-dom/client'
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
createRoot(document.querySelector('#fixture')).render(React.createElement(Panel,{
  id:params.get('draft'),acconto:params.get('mode')==='acconto',
}))
async function run(){
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
