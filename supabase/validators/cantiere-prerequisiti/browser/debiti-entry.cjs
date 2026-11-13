const React = require('react')
const {createRoot} = require('react-dom/client')
const Panel = require('../../../../app/components/PagamentiFornitoriPanel.tsx').default
const params = new URLSearchParams(location.search)
const mode = params.get('mode')
const phase = (name,detail='') => fetch('/phase?name='+name+'&detail='+encodeURIComponent(detail))
window.addEventListener('error',e=>phase('js-error',e.message))
const root = document.querySelector('#fixture')
createRoot(root).render(React.createElement(Panel,{cardStyle:{},fatturaId:['fattura','recupero'].includes(mode)?params.get('draft'):undefined}))
const button = text => [...root.querySelectorAll('button')].find(b=>b.textContent===text)
async function wait(label,read) {
  for(let i=0;i<150;i++){const result=read();if(result)return result;await new Promise(resolve=>setTimeout(resolve,30))}
  throw Error(label)
}
function enter(input,value) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value)
  input.dispatchEvent(new Event('input',{bubbles:true}))
  input.dispatchEvent(new Event('change',{bubbles:true}))
}
const findDetail = () => root.querySelector('[aria-label="Dettaglio debito"]')
async function verify(dovuto,pagato) {
  const form=await wait('Form verifica assente',()=>findDetail()?.querySelector('form'))
  enter(form.elements.scadenza,'2026-11-20')
  enter(form.elements.dovuto,dovuto)
  enter(form.elements.pagato,pagato)
  button('Verifica scadenza e saldo').click()
}
async function run() {
  await wait('Vista debiti assente',()=>button('Rileggi debiti'))
  if(mode==='manuale'){
    enter(root.querySelector('input'),'Fixture browser')
    await wait('Input non recepito',()=>root.querySelector('input').value==='Fixture browser')
    button('Registra debito manuale').click()
    const detail=await wait('Debito manuale non registrato',findDetail)
    if(!detail.textContent.includes('Da verificare') || detail.querySelector('[name=scadenza]').value)throw Error('Debito incompleto incoerente')
    if(!sessionStorage.getItem('manuale-riletto')){
      sessionStorage.setItem('manuale-riletto',detail.querySelector('p').textContent.split(' · ')[0])
      location.replace(location.href.replace('mode=manuale','mode=verifica'))
      return
    }
  }
  if(mode==='verifica'||mode==='cumulativo'){
    ;(await wait('Riga manuale assente',()=>button('Fixture browser'))).click()
    const d=await wait('Dettaglio assente',findDetail)
    if(mode==='verifica'){
      if(!d.textContent.includes(sessionStorage.getItem('manuale-riletto'))) throw Error('UUID diverso dopo reload')
      await verify('100','20')
      await wait('Conferma non persistita',()=>findDetail()?.textContent.includes('Verificato · aperto'))
    } else {
      if(!d.textContent.includes('Verificato · aperto') || d.querySelector('[name=pagato]').value!=='20')throw Error('Nuovo profilo non ha riletto la conferma')
      await verify('100','101')
      await wait('Importi incoerenti accettati',()=>root.querySelector('[role=alert]')?.textContent.includes('non validi'))
      await verify('100','50')
      await wait('Residuo dopo sostituzione cumulativo inatteso',()=>findDetail()?.querySelector('[name=pagato]')?.defaultValue==='50' && root.textContent.includes('50,00'))
      await verify('100','100')
      await wait('Saldo assente',()=>findDetail()?.textContent.includes('Verificato · saldato'))
    }
  }
  if(mode==='elenco'){
    ;(await wait('Debito da elenco assente',()=>button('Test'))).click()
    const detail=await wait('Dettaglio da elenco assente',findDetail)
    if(!detail.textContent.includes(params.get('day')))throw Error('UUID del debito da elenco divergente')
  }
  if(mode==='conflitto'){
    ;(await wait('Debito manuale assente',()=>button('Fixture browser'))).click()
    await verify('100','77')
    await wait('Conflitto non mostrato',()=>root.querySelector('[role=alert]')?.textContent.includes('Revisione obsoleta'))
    if(findDetail().querySelector('[name=pagato]').value!=='77')throw Error('Importo locale perso')
  }
  if(mode==='recupero'){
    window.confirm=()=>true
    ;(await wait('Registrazione da fattura assente',()=>button('Registra debito della fattura'))).click()
    await wait('Debito recuperato assente',findDetail)
    await verify('100','25')
    await wait('Verifica del debito collegato assente',()=>findDetail()?.textContent.includes('Verificato · aperto'))
    button('Annulla debito').click()
    await wait('Annullamento assente',()=>findDetail()?.textContent.includes('Annullato'))
  }
  if(mode==='fattura'){
    const detail=await wait('Debito collegato assente',findDetail)
    if(!detail.textContent.includes(params.get('day')))throw Error('UUID del debito collegato divergente')
  }
  await phase('pass',mode)
}
run().catch(e=>phase('fail',e.message+' | '+root.textContent.slice(-600)))
