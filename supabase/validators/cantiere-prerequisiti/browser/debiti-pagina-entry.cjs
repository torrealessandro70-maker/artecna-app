const React=require('react')
const {createRoot}=require('react-dom/client')
const Page=require('../../../../app/page.tsx').default
const params=new URLSearchParams(location.search), mode=params.get('mode')
const phase=(name,detail='')=>fetch('/phase?name='+name+'&detail='+encodeURIComponent(detail))
const alerts=[]
window.alert=message=>alerts.push(String(message))
window.addEventListener('error',e=>phase('js-error',e.message))
window.addEventListener('unhandledrejection',e=>phase('js-error',String(e.reason)))
createRoot(document.querySelector('#fixture')).render(React.createElement(Page))
const button=re=>[...document.querySelectorAll('button')].find(b=>re.test(b.textContent.trim())&&b.getClientRects().length)
async function wait(label,find){
  for(let i=0;i<220;i++){const found=find();if(found)return found;await new Promise(r=>setTimeout(r,35))}
  throw Error(label)
}
const click=async re=>(await wait('Bottone assente: '+re,()=>button(re))).click()
const detail=()=>document.querySelector('[aria-label="Dettaglio debito"]')
const panel=()=>document.querySelector('[aria-label="Debiti fornitori"]')
async function registro(){
  await click(/^📚 Registro$/)
  await click(/📄 Fatture fornitori/)
}
async function run(){
  if(mode==='pagina-pagamenti'){
    await click(/💳 Pagamenti/)
    ;(await wait('Sottomenu Fornitori',()=>[...document.querySelectorAll('div')].find(el=>el.textContent.trim()==='🧾 Pagamenti fornitori'&&el.getClientRects().length))).click()
    await click(/^Fixture e2e$/)
  } else {
    await registro()
    if(mode==='parziale'){
      const xml='<FatturaElettronica><FatturaElettronicaHeader><CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdCodice>12345678901</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>Fixture e2e</Denominazione></Anagrafica></DatiAnagrafici></CedentePrestatore></FatturaElettronicaHeader><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Data>2026-11-13</Data><Numero>E2E-UNICA</Numero><ImportoTotaleDocumento>100</ImportoTotaleDocumento></DatiGeneraliDocumento></DatiGenerali><DatiBeniServizi><DettaglioLinee><NumeroLinea>1</NumeroLinea><Descrizione>Fixture</Descrizione><Quantita>1</Quantita><PrezzoUnitario>100</PrezzoUnitario><PrezzoTotale>100</PrezzoTotale><AliquotaIVA>0</AliquotaIVA></DettaglioLinee></DatiBeniServizi></FatturaElettronicaBody></FatturaElettronica>'
      const upload=await wait('Import fatture assente',()=>document.querySelector('input[aria-label="Seleziona fatture o documenti"]'))
      const files=new DataTransfer()
      files.items.add(new File([xml],'fixture.xml',{type:'text/xml'}))
      upload.files=files.files
      upload.dispatchEvent(new Event('change',{bubbles:true}))
      await click(/^Apri anteprima$/)
      await wait('Anteprima XML assente',()=>button(/Salva fattura/))
      const select=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.textContent==='Assegna tutte le righe a...'))
      select.value='Generale impresa'
      select.dispatchEvent(new Event('change',{bubbles:true}))
      await click(/^Applica a tutte$/)
      await click(/Salva fattura/)
      await wait('Messaggio di risultato parziale assente',()=>alerts.some(x=>x.includes('Fattura registrata. Debito non registrato')))
      if(alerts.some(x=>x.includes('Fattura salvata correttamente')))throw Error('Successo completo improprio')
    }
    const row=await wait('Testata non disponibile dal Registro',()=>[...document.querySelectorAll('tr')].find(r=>r.textContent.includes('E2E-UNICA')))
    row.querySelector('button').click()
    const disclosure=await wait('Debito della fattura assente',()=>[...document.querySelectorAll('summary')].find(s=>s.textContent==='Debito fornitore'))
    disclosure.click()
    if(mode==='parziale')await click(/^Registra debito della fattura$/)
  }
  await wait('UUID del debito assente',()=>detail()?.querySelector('p').textContent.match(/^[\da-f-]{36}/))
  await phase('pass',detail().querySelector('p').textContent.split(' · ')[0])
}
run().catch(e=>phase('fail',e.message+' | '+alerts.join(' | ')+' | '+(panel()?.textContent??document.body.innerText).slice(-780)))
