'use client'
import { useState } from 'react'
import { centesimi } from '../engines/contabilita-ditta/riepilogo'
import type { SemanticaIva, VerificaIva } from '../engines/contabilita-ditta/fonteIva'

export default function VerificaFonteIva({ onVerifica }: { onVerifica: (v: VerificaIva) => Promise<void> }) {
  const [semantica,setSemantica]=useState<SemanticaIva | ''>(''),[riferimento,setRiferimento]=useState(''),[confermata,setConfermata]=useState(false)
  const [dettaglio,setDettaglio]=useState(false),[righe,setRighe]=useState([{imponibile:'',iva:'',aliquota:'',natura:''}]),[errore,setErrore]=useState('')
  function verifica() {
    setErrore('')
    if (!semantica || !confermata || riferimento.trim().length<8) return
    try {
      const money=(v:string)=>{const n=centesimi(v.replace(',','.'));if(n===null)throw Error('Importi documentali non validi.');return n/100}
      const gruppi=dettaglio ? righe.map(r=>({imponibile:money(r.imponibile),iva:money(r.iva),aliquota:r.aliquota.trim()===''?null:money(r.aliquota),natura:r.natura.trim()||null})) : undefined
      void onVerifica({semantica,riferimento:riferimento.trim(),documento_verificato:true,...(gruppi ? {gruppi} : {})})
    } catch(e){setErrore((e as Error).message)}
  }
  return <section aria-label="Verifica documentale IVA">
    <h3>Verifica la fonte fiscale originale</h3>
    <p>Confronta numero, data, cliente, imponibile, imposta e totale con il documento. La quadratura non prova validità fiscale, incasso o trasmissione SdI.</p>
    <label>Significato documentato del campo IVA <select value={semantica} onChange={e=>setSemantica(e.target.value as SemanticaIva | '')}><option value="">Da verificare</option><option value="importo">Importo dell’imposta in euro</option><option value="aliquota">Aliquota percentuale documentata</option></select></label>
    <label>Riferimento del documento originale verificato <input value={riferimento} maxLength={500} onChange={e=>setRiferimento(e.target.value)} /></label>
    <label><input type="checkbox" checked={dettaglio} onChange={e=>setDettaglio(e.target.checked)} />Dispongo dei riepiloghi distinti per aliquota</label>
    {dettaglio && <>{righe.map((r,i)=><fieldset key={i}><legend>Riepilogo {i+1}</legend>{(['imponibile','iva','aliquota','natura'] as const).map(k=><label key={k}>{({imponibile:'Imponibile documentato',iva:'Imposta documentata',aliquota:'Aliquota documentata (vuoto = non disponibile)',natura:'Natura documentata (se presente)'})[k]}<input value={r[k]} onChange={e=>setRighe(old=>old.map((x,j)=>j===i?{...x,[k]:e.target.value}:x))}/></label>)}</fieldset>)}<button type="button" disabled={righe.length>=100} onClick={()=>setRighe(v=>[...v,{imponibile:'',iva:'',aliquota:'',natura:''}])}>Aggiungi riepilogo documentale</button></>}
    {!dettaglio && <p>Con IVA memorizzata come importo non verrà ricavata alcuna aliquota. Senza dettaglio è riconciliabile soltanto l’intera quota residua.</p>}
    <label><input type="checkbox" checked={confermata} onChange={e=>setConfermata(e.target.checked)}/>Ho verificato il documento originale e il significato dei valori; non sto deducendo l’aliquota dal totale.</label>
    {errore&&<p role="alert">{errore}</p>}
    <button type="button" disabled={!semantica||!confermata||riferimento.trim().length<8} onClick={verifica}>Verifica anteprima fiscale — nessun salvataggio</button>
    <p>La verifica viene registrata solo insieme alla successiva conferma atomica. Gli importi originali restano invariati.</p>
  </section>
}
