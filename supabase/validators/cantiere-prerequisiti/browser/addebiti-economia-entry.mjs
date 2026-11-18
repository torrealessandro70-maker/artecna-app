import React,{useEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import PanelModule from '../../../../app/components/UsaRaccoltaEconomiaInVariante.tsx'
import {supabase} from '../../../../lib/supabaseClient'
const Panel=PanelModule.default??PanelModule
const rid=new URLSearchParams(location.search).get('cantiere')
const report=(name,detail='')=>fetch('/phase?name='+name+'&detail='+encodeURIComponent(detail))
window.confirm=()=>true // Solo documento sintetico su loopback.
window.addEventListener('error',e=>void report('js-error',e.message))
function Fixture(){
 const [d,setD]=useState(null),[opened,setOpened]=useState('')
 useEffect(()=>{void supabase.rpc('leggi_raccolta_economia_cliente',{p_raccolta_id:rid}).then(r=>{if(r.error)throw Error(r.error.message);setD(r.data)})},[])
 return d?React.createElement(React.Fragment,null,React.createElement(Panel,{raccolta:d.raccolta,
  righe:d.righe.map(r=>({id:r.id,ordine:r.ordine,descrizione:r.descrizione,quantita:Number(r.quantita),prezzo:Number(r.prezzo_unitario),totale:Number(r.totale),tipo:r.tipo_riga})),
  varianti:[],elencoPronto:true,operativo:true,totale:Number(d.totale),onApri:setOpened,onRileggi:async()=>{}}),React.createElement('output',{id:'opened'},opened)):React.createElement('p',null,'Caricamento raccolta')
}
createRoot(document.getElementById('fixture')).render(React.createElement(Fixture))
async function wait(fn){for(let i=0;i<250;i++){const r=fn();if(r)return r;await new Promise(r=>setTimeout(r,30))}throw Error('UI Economia non pronta')}
try{
 const button=await wait(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Crea proposta')&&!b.disabled))
 if(!button.textContent.includes('62,00'))throw Error('Prezzo cliente inatteso')
 button.click()
 await wait(()=>document.getElementById('opened')?.textContent)
 if(!document.body.textContent.includes('Bozza creata dai lavori in economia')||!document.body.textContent.includes('bozza'))throw Error('Stato non verificato')
 await report('pass','Origine Economia gia assegnata, prezzo cliente62, sola Variante in bozza')
}catch(e){await report('fail',e.message)}
