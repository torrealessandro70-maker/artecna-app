const phase=(name,detail='')=>fetch('/phase?name='+name+'&detail='+encodeURIComponent(detail))
window.addEventListener('error',e=>phase('js-error',e.error?.stack??e.message))
window.addEventListener('unhandledrejection',e=>phase('js-error',String(e.reason)))
const React=require('react')
const {createRoot}=require('react-dom/client')
const Page=require('../../../../app/page.tsx').default
createRoot(document.querySelector('#fixture')).render(React.createElement(Page))
const wait=async (label,fn)=>{for(let i=0;i<150;i++){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,30))}throw Error(label)}
const button=(re)=>[...document.querySelectorAll('button')].find(b=>re.test(b.textContent.trim())&&b.getClientRects().length)
async function run(){
 const params=new URLSearchParams(location.search)
 const mode=params.get('mode')
 await wait('menu completo assente',()=>button(/Centro notifiche/))
 await phase('render')
 if(mode==='badge'){
   await wait('badge iniziale atteso',()=>button(/^📄 Rapportini\s+1$/)&&button(/Centro notifiche\s+2$/))
   button(/🏗️ Cantieri/).click()
   await wait('Scheda cantiere assente',()=>button(/^✔$/)).then(b=>b.click())
   const control=await wait('Controllo rapportini assente',()=>document.querySelector('[aria-label="Controllo rapportini"]'))
   await wait('avvisi attivi assenti',()=>control.textContent.includes('Avvisi attivi'))
   const details=[...control.querySelectorAll('details')].find(d=>d.textContent.includes('Gestisci avvisi'))
   details.open=true
   const select=details.querySelector('select')
   const choose=async value=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,60));button(/^Salva avvisi$/).click()}
   await choose('manuale')
   await wait('badge sospeso ancora presente',()=>button(/^📄 Rapportini$/)&&button(/Centro notifiche\s+1$/))
   await choose('attivi')
   await wait('badge riattivato assente',()=>button(/^📄 Rapportini\s+1$/)&&button(/Centro notifiche\s+2$/))
 }
 if(mode==='center'||mode==='center-multiple'){
   button(/Centro notifiche/).click()
   await wait('Apri assente',()=>[...document.querySelectorAll('li')].find(el=>el.querySelector('time')?.dateTime?.startsWith(params.get('day')) && el.textContent.includes('Rapportini'))?.querySelector('button')).then(b=>b.click())
 }
 if(mode==='draft' && !sessionStorage.getItem('fixture-reloaded')){sessionStorage.setItem('fixture-reloaded','yes');location.reload();return}
 if(mode==='center'||mode==='draft'){
   await wait('Editor Desktop assente',()=>document.querySelector('[aria-label="Editor Rapportino Desktop"]'))
   await wait('Lettura editor non avviata',()=>window.fixtureEditorRead?.p_rapportino_id===params.get('draft') && window.fixtureEditorRead?.p_cantiere_id===params.get('cantiere') && window.fixtureEditorRead?.p_data===params.get('day'))
 }
 if(mode==='multiple'||mode==='center-multiple'){
   await wait('Elenco non filtrato',()=>document.body.textContent.includes('Rapportini visualizzati: 2'))
   if(document.querySelector('[aria-label="Editor Rapportino Desktop"]'))throw Error('Aperto editor con più rapportini')
 }
 await phase('pass',mode)
}
run().catch(e=>phase('fail',e.message+' | '+document.body.innerText.slice(-2400)))
