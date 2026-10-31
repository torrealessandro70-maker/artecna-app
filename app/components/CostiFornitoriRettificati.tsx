'use client'

import { useEffect, useState } from 'react'
import { leggiCostiFornitori, riepilogaCostiFornitori, type ClientNoteCredito, type CostoFornitori } from '../engines/fatture/note-credito'

export function useCostiFornitori(client: ClientNoteCredito, cantiereId?: string, da?: string, a?: string) {
  const [versione, setVersione] = useState(0)
  const [stato, setStato] = useState<{ client: ClientNoteCredito; chiave: string; dati: CostoFornitori | null; errore: string } | null>(null)
  const chiave = JSON.stringify([cantiereId, da, a, versione])
  useEffect(() => {
    const aggiorna = () => setVersione(n => n + 1)
    window.addEventListener('artecna:rettifiche-fornitori', aggiorna)
    return () => window.removeEventListener('artecna:rettifiche-fornitori', aggiorna)
  }, [])
  useEffect(() => {
    let attivo = true
    void leggiCostiFornitori(client, cantiereId, da, a).then(dati => {
      riepilogaCostiFornitori(dati)
      if (attivo) setStato({ client, chiave, dati, errore: '' })
    }).catch(e => { if (attivo) setStato({ client, chiave, dati: null, errore: e instanceof Error ? e.message : 'Lettura non disponibile' }) })
    return () => { attivo = false }
  }, [client, cantiereId, da, a, chiave])
  return stato?.client === client && stato.chiave === chiave ? stato : { dati: null, errore: '' }
}

export default function CostiFornitoriRettificati({ client, cantiereId, da, a }: {
  client: ClientNoteCredito; cantiereId?: string; da?: string; a?: string
}) {
  const { dati, errore } = useCostiFornitori(client, cantiereId, da, a)
  return <CostiFornitoriVista dati={dati} errore={errore} />
}

export function CostiFornitoriVista({ dati, errore }: { dati: CostoFornitori | null; errore: string }) {
  const euro = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
  const totali = dati ? riepilogaCostiFornitori(dati) : null
  return <section aria-label="Costi fornitori con rettifiche" style={{ minWidth: 0, padding: 12, marginBlock: 12, border: '1px solid #cbd5e1', borderRadius: 8 }}>
    <h3>Costi fornitori assegnati e rettifiche</h3>
    <p>Quote documentali originali + rettifiche negative. Nessuna somma aggiuntiva del totale della nota, nessuna modifica a IVA o pagamenti. Non è l’utile contabile della ditta.</p>
    {!totali && <p role={errore ? 'alert' : 'status'}>{errore ? `Dato non disponibile: ${errore}` : 'Caricamento costi e rettifiche…'}</p>}
    {totali && dati && <>
      <p>Quote originali: {euro(totali.originali)} · Rettifiche applicate: {euro(totali.rettifiche)} · <strong>Costi fornitori rettificati: {euro(totali.netto)}</strong></p>
      <p>{dati.perimetro}. Le note non riconciliate non riducono i costi. Il costo conserva la base già usata da ciascuna quota: imponibile per Economia, totale registrato per materiali/spese.</p>
      <details><summary>Fonti originali e rettifiche</summary>
        {dati.quote.map(q => <p key={`${q.tipo}:${q.id}`} style={{ overflowWrap: 'anywhere' }}>{q.data} · Documento {q.documento_id} · Quota {q.tipo}/{q.id} · {q.cantiere_id || 'Impresa'} / {q.categoria}: {euro(Number(q.costo))}</p>)}
        {dati.rettifiche.map(r => <p key={r.id} style={{ overflowWrap: 'anywhere' }}>{r.data_nota} · Nota {r.nota_id} · Origine {r.origine_id}, riga {r.origine_riga_id} · Rettifica {r.id} · {r.cantiere_id || 'Impresa'} / {r.categoria}: {euro(Number(r.importo_costo))}</p>)}
      </details>
    </>}
  </section>
}
