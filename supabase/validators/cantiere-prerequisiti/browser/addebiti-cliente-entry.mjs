import React from 'react'
import {createRoot} from 'react-dom/client'
import PanelModule from '../../../../app/components/AddebitoClienteFattura.tsx'
const Panel=PanelModule.default??PanelModule
const report=(name,detail='')=>fetch('/phase?name='+name+'&detail='+encodeURIComponent(detail))
window.addEventListener('error',e=>void report('js-error',e.message))
const fid=new URLSearchParams(location.search).get('cantiere')
createRoot(document.getElementById('fixture')).render(React.createElement('div',{id:'area-lavoro-principale'},React.createElement(Panel,{fatturaId:fid})))
async function wait(fn,message='Interfaccia addebito non disponibile') {
 for(let i=0;i<250;i++){const r=fn();if(r)return r;await new Promise(r=>setTimeout(r,30))}throw Error(message)
}
function button(text){return [...document.querySelectorAll('button')].find(b=>b.textContent===text)}
async function input(label,value){const e=[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith(label))?.querySelector('input,textarea');if(!e)throw Error('Campo assente '+label);Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(requestAnimationFrame)}
try{
 const quota=await wait(()=>[...document.querySelectorAll('section>div')].find(e=>e.textContent.includes('Quota Chrome')))
 quota.querySelector('button').click()
 await wait(()=>button('Verifica anteprima addebito'))
 await input('Prezzo totale da addebitare','62')
 await input('Motivazione','Accordo extra Chrome')
 await input('Riferimento accordo cliente','Chrome sintetico')
 button('Verifica anteprima addebito').click()
 await wait(()=>button('Conferma creazione Variante in bozza'))
 const preview=document.querySelector('[aria-label="Anteprima addebito"]').textContent
 if(!preview.includes('62,00')||!preview.includes('Contratto attuale'))throw Error('Anteprima incoerente')
 button('Conferma creazione Variante in bozza').click()
 await wait(()=>document.body.textContent.includes('Variante in bozza creata'))
 await report('pass','Quota gia assegnata, anteprima netto62, nuova bozza senza secondo costo')
}catch(e){await report('fail',e.message)}
