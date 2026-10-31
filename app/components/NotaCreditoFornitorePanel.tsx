'use client'

import { useEffect, useRef, useState } from 'react'
import { applicaNotaCredito, leggiNotaCredito, type ClientNoteCredito, type RiconciliazioneCredito } from '../engines/fatture/note-credito'

type Scelta = { riga: string; quota: string; quantita: string }
const euro = (v: unknown) => Number(v).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
export default function NotaCreditoFornitorePanel({ client, notaId, onAggiornamento, cantieri = [] }: {
  client: ClientNoteCredito; notaId: string; onAggiornamento?: () => void | Promise<void>
  cantieri?: { id?: string; nome?: string }[]
}) {
  const [dati, setDati] = useState<RiconciliazioneCredito | null>(null)
  const [errore, setErrore] = useState(''), [busy, setBusy] = useState(false)
  const [scelte, setScelte] = useState<Scelta[]>([]), [conferma, setConferma] = useState(false)
  const [corrispondenza, setCorrispondenza] = useState(false)
  const richiesta = useRef<{ firma: string; id: string } | null>(null), lock = useRef(false)
  useEffect(() => {
    let attivo = true
    void leggiNotaCredito(client, notaId).then(d => { if (attivo) setDati(d) },
      e => { if (attivo) setErrore(e instanceof Error ? e.message : 'Lettura nota non disponibile') })
    return () => { attivo = false }
  }, [client, notaId])
  const cambia = (i: number, values: Partial<Scelta>) => {
    setScelte(old => old.map((s, j) => i === j ? { ...s, ...values } : s)); setConferma(false); setCorrispondenza(false)
  }
  const applica = async () => {
    if (!dati?.origine || !scelte.length || !corrispondenza || lock.current) return
    const righe = scelte.map(s => {
      const quota = dati.quote.find(q => `${q.tipo}:${q.id}` === s.quota)
      if (!quota || !s.riga || !Number.isFinite(Number(s.quantita)) || Number(s.quantita) <= 0) throw Error('Completa riga, quota e quantità.')
      return { nota_riga_id: s.riga, tipo: quota.tipo, quota_id: quota.id, quantita: s.quantita, conferma_corrispondenza: true }
    })
    const firma = JSON.stringify(righe)
    if (!richiesta.current || richiesta.current.firma !== firma) richiesta.current = { firma, id: crypto.randomUUID() }
    lock.current = true; setBusy(true); setErrore('')
    try {
      const risultato = await applicaNotaCredito(client, notaId, dati.origine.id, righe, richiesta.current.id)
      setDati(risultato); setScelte([]); setConferma(false); setCorrispondenza(false)
      try { await onAggiornamento?.() } catch { setErrore('Rettifica registrata. Rilettura del Registro non disponibile: non ripetere l’operazione.') }
      window.dispatchEvent(new Event('artecna:rettifiche-fornitori'))
    } catch (e) { setErrore(e instanceof Error ? e.message : 'Esito non disponibile. Nessun retry automatico.') }
    finally { lock.current = false; setBusy(false) }
  }
  const applicate = new Set(dati?.rettifiche.map(r => r.nota_riga_id))
  return <section aria-label="Riconciliazione nota di credito" style={{ minWidth: 0, padding: 12, border: '1px solid #cbd5e1', borderRadius: 8 }}>
    <h3>Nota di credito TD04</h3>
    <p>Rettifica separata: non assegnare queste righe come acquisti ordinari. I valori XML originali e lo storico restano invariati.</p>
    {!dati && !errore && <p role="status">Caricamento riconciliazione…</p>}
    {errore && <p role="alert" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{errore}</p>}
    {dati && <>
      <p role="status"><strong>{dati.stato === 'rettifica applicata' ? 'Rettifica applicata' : 'Da riconciliare'}</strong>
        {dati.rettifiche.length > 0 && dati.stato !== 'rettifica applicata' && ' — rettifica parziale, altre righe ancora pendenti'}</p>
      {dati.documento && <p>XML originale: imponibile {euro(dati.documento.imponibile_originale)}, IVA {euro(dati.documento.iva_originale)}, totale {euro(dati.documento.totale_originale)}.</p>}
      {dati.motivo && <p role="note">{dati.motivo} Nessun effetto economico sulle righe pendenti.</p>}
      {dati.origine && <p style={{ overflowWrap: 'anywhere' }}>Origine verificata: {dati.origine.numero} del {dati.origine.data} — {dati.origine.id}</p>}
      {dati.documento?.riferimenti.map((r, i) => <p key={i}>Riferimento XML: {r.numero} del {r.data}. Le indicazioni di linea XML non sono associazioni automatiche a righe originarie.</p>)}
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 520 }}>
        <thead><tr><th>Riga nota</th><th>Quantità registrata</th><th>Prezzo registrato</th><th>Riconciliazione</th></tr></thead>
        <tbody>{dati.righe.map(r => <tr key={r.id}><td>{r.numero_riga} — {r.descrizione}</td><td>{r.quantita}</td><td>{euro(r.prezzo_unitario)}</td>
          <td>{applicate.has(r.id) ? 'Rettifica applicata' : 'Da riconciliare'}</td></tr>)}</tbody>
      </table></div>
      {!dati.motivo && dati.stato !== 'rettifica applicata' && <>
        <p>Scegli esplicitamente la riga originaria e la sua quota reale. Ogni riga della nota va ripartita per intero; può rettificare soltanto una parte della quantità originaria. Nessuna corrispondenza per posizione.</p>
        {scelte.map((s, i) => {
          const quota = dati.quote.find(q => `${q.tipo}:${q.id}` === s.quota)
          const destinazione = quota?.cantiere_id ? cantieri.find(c => c.id === quota.cantiere_id)?.nome || 'Cantiere' : 'Impresa'
          return <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBlock: 8 }}>
          <label style={{ flex: '1 1 220px', minWidth: 0 }}>Riga nota<select aria-label={`Riga nota ${i + 1}`} disabled={busy} value={s.riga} onChange={e => cambia(i, { riga: e.target.value })} style={{ width: '100%' }}>
            <option value="">Seleziona una riga</option>{dati.righe.filter(r => !applicate.has(r.id)).map(r => <option key={r.id} value={r.id}>{r.numero_riga} — {r.descrizione}</option>)}
          </select></label>
          <label style={{ flex: '2 1 260px', minWidth: 0 }}>Quota originaria verificata<select aria-label={`Quota origine ${i + 1}`} disabled={busy} value={s.quota} onChange={e => cambia(i, { quota: e.target.value })} style={{ width: '100%' }}>
            <option value="">Seleziona origine e destinazione</option>{dati.quote.map(q => <option disabled={q.quantita_disponibile !== undefined && Number(q.quantita_disponibile) <= 0} key={`${q.tipo}:${q.id}`} value={`${q.tipo}:${q.id}`}>Riga {q.numero_riga ?? '—'} — {q.descrizione || q.origine_riga_id} — {q.tipo} / {q.categoria}</option>)}
          </select></label>
          <label style={{ flex: '1 1 180px', minWidth: 0 }}>Quantità da rettificare<input style={{ width: '100%', boxSizing: 'border-box' }} aria-label={`Quantità rettifica ${i + 1}`} type="number" min="0.000001" step="0.000001" value={s.quantita} disabled={busy} onChange={e => cambia(i, { quantita: e.target.value })} /></label>
          <button type="button" disabled={busy} onClick={() => { setScelte(old => old.filter((_, j) => j !== i)); setConferma(false); setCorrispondenza(false) }}>Rimuovi ripartizione</button>
          {quota && <p style={{ flexBasis: '100%', margin: '4px 0', overflowWrap: 'anywhere' }}>Origine: {quota.descrizione || quota.origine_riga_id}. Destinazione: {destinazione} {quota.cantiere_id || ''} / {quota.categoria}. Quota {quota.id}. Quantità ancora rettificabile: {quota.quantita_disponibile === undefined ? 'non caricata' : quota.quantita_disponibile}; costo massimo residuo: {quota.costo_disponibile === undefined ? 'non disponibile' : euro(quota.costo_disponibile)}. Il server rivalida i limiti al salvataggio.</p>}
        </div>})}
        <button type="button" disabled={busy} onClick={() => { setScelte(old => [...old, { riga: '', quota: '', quantita: '' }]); setConferma(false); setCorrispondenza(false) }}>Aggiungi ripartizione</button>{' '}
        <button type="button" disabled={busy || !scelte.length} onClick={() => { setConferma(true); setCorrispondenza(false) }}>Rivedi rettifica</button>
        {conferma && <div role="group" aria-label="Conferma rettifica" style={{ marginTop: 12, padding: 12, background: '#fff7ed' }}>
          <p>Registrare una rettifica negativa sulle quote scelte? L’origine non verrà riscritta. L’operazione è immutabile e il server verifica segno, quantità e limiti disponibili.</p>
          <label style={{ display: 'block', marginBottom: 12 }}><input type="checkbox" checked={corrispondenza} disabled={busy} onChange={e => setCorrispondenza(e.target.checked)} /> Confermo la corrispondenza delle righe alle quote originarie selezionate</label>
          <button type="button" disabled={busy || !corrispondenza} onClick={() => { void applica().catch(e => setErrore(e.message)) }}>{busy ? 'Registrazione…' : 'Conferma rettifica negativa'}</button>{' '}
          <button type="button" disabled={busy} onClick={() => { setConferma(false); setCorrispondenza(false) }}>Annulla</button>
        </div>}
      </>}
      {dati.rettifiche.length > 0 && <details><summary>Storico rettifiche applicate</summary>{dati.rettifiche.map(r => <p key={r.id} style={{ overflowWrap: 'anywhere' }}>
        {r.id} — origine {r.origine_riga_id} — {r.cantiere_id || 'Impresa'} / {r.categoria}: quantità {r.quantita}, rettifica netta {euro(r.importo_netto)}, effetto sui costi {euro(r.importo_costo)}.
      </p>)}</details>}
    </>}
  </section>
}
