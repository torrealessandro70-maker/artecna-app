const phase=(name,detail='')=>fetch('/phase?name='+name+'&detail='+encodeURIComponent(detail))
window.addEventListener('error',e=>phase('js-error',e.error?.stack??e.message))
window.addEventListener('unhandledrejection',e=>phase('js-error',String(e.reason)))
import React from 'react'
import {createRoot} from 'react-dom/client'
import PageModule from '../../../../app/page.tsx'
const Page = PageModule.default ?? PageModule
createRoot(document.querySelector('#fixture')).render(React.createElement(Page))
const wait=async (label,fn)=>{for(let i=0;i<150;i++){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,30))}throw Error(label)}
const button=(re)=>[...document.querySelectorAll('button')].find(b=>re.test(b.textContent.trim())&&b.getClientRects().length)
async function run(){
  const params=new URLSearchParams(location.search)
  const id=params.get('draft')
  await wait('menu non disponibile',()=>button(/Centro notifiche/))
  if(params.get('mode')==='center'){
    await wait('badge aggregato assente',()=>button(/Centro notifiche\s+5$/)&&button(/Pagamenti\s+1/))
    button(/Impostazioni/).click()
    await wait('preferenze non disponibili',()=>button(/^🔔 Notifiche$|^Notifiche$/)).then(b=>b.click())
    await wait('preferenza Pagamenti assente',()=>[...document.querySelectorAll('legend')].find(l=>l.textContent==='Avvisi Pagamenti fornitori'))
    const close=button(/^← Chiudi$|^Chiudi$/)
    if(close) close.click()
    button(/Centro notifiche/).click()
    await wait('apertura notifica assente',()=>[...document.querySelectorAll('li')].find(li=>li.textContent.includes('Pagamento fornitore'))?.querySelector('button')).then(b=>b.click())
  }
  const detail=await wait('debito corretto non focalizzato',()=>document.activeElement?.textContent.includes(id)&&document.activeElement.closest('[aria-label="Dettaglio debito"]'))
  if(!detail.textContent.includes('Totale già pagato')) throw Error('Dettaglio incompleto')
  await phase('pass',params.get('mode'))
}
run().catch(e=>phase('fail',String(e)))
