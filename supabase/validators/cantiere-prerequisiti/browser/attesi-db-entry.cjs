const phase=(name,detail='')=>fetch('/phase?name='+encodeURIComponent(name)+'&detail='+encodeURIComponent(detail)).catch(()=>{})
window.addEventListener('error',e=>phase('js-error',e.message))
phase('javascript')
const React=require('react'), {createRoot}=require('react-dom/client')
const Center=require('../../../../app/components/CentroNotifiche.tsx').default
const Control=require('../../../../app/components/ControlloRapportini.tsx').default
const id='00000000-0000-4000-8000-000000000001'

const params=new URLSearchParams(location.search)
const record=params.get('cantiere')
const client={async rpc(name,args){
  return (await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})})).json()
}}
function App(){
 const [login,setLogin]=React.useState(false),[target,setTarget]=React.useState(null),[counts,setCounts]=React.useState({})
 return React.createElement(React.Fragment,null,
 React.createElement('button',{onClick:()=>setLogin(true)},'Accedi fixture'),
 login&&React.createElement(Control,{client,cantiere:record,chiuso:false}),
 login&&React.createElement(Center,{client,stile:{},menuImpostazioni:true,onApriScadenza:()=>{},onApriRapportino:setTarget,onContatori:setCounts}),
 React.createElement('output',{id:'badge'},counts.rapportini),
 target&&React.createElement('output',{id:'target'},JSON.stringify(target)))
}
createRoot(document.querySelector('#fixture')).render(React.createElement(App))
const wait=async fn=>{for(let i=0;i<140;i++){const value=fn();if(value)return value;await new Promise(r=>setTimeout(r,20))}throw Error('Timeout '+fn)}
const btn=t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t)
const set=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
async function run(){
  await wait(()=>btn('Accedi fixture')).then(b=>b.click())
  await phase('render')
  await wait(()=>document.body.textContent.includes('Avvisi attivi'))
  await phase('fixture')
  const [plan,settings]=document.querySelectorAll('details')
  plan.open=true;settings.open=true
  const [start,end]=plan.querySelectorAll('input[type=date]')
  set(start,'2026-12-01');set(end,'2026-12-04')
  if(params.get('mode')==='write'){
    await wait(()=>btn('Genera anteprima')).then(b=>b.click())
    await wait(()=>btn('Escludi 2026-12-02')).then(b=>b.click())
    await wait(()=>btn('Escludi 2026-12-04')).then(b=>b.click())
    await wait(()=>btn('Escludi 2026-12-03')).then(b=>b.click())
    set(await wait(()=>plan.querySelector('table input[type=date]')),'2026-12-04')
    await wait(()=>btn('Escludi 2026-12-04'))
    btn('Salva giornate confermate').click()
    await wait(()=>!plan.querySelector('table'))
    const select=settings.querySelector('select')
    const choose=async value=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,40))}
    await choose('manuale')
    btn('Salva avvisi').click()
    await wait(()=>document.body.textContent.includes('sospesi manualmente'))
    await choose('attivi')
    btn('Salva avvisi').click()
    await wait(()=>document.body.textContent.includes('Avvisi attivi'))
    await choose('manuale')
    location.replace('/?cantiere='+record+'&mode=reload')
    return
  }
  btn('Rileggi').click()
  await wait(()=>[...plan.querySelectorAll('strong')].some(el=>el.textContent.startsWith('2026-12-04')))
  if(!document.body.textContent.includes('Avvisi attivi'))throw Error('Configurazione riletta divergente')
  await phase('pass',params.get('mode'))
}
run().catch(e=>phase('fail',e.message))