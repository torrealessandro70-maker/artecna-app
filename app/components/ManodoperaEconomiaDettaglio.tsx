'use client'

import { useEffect, useState } from 'react'
import { leggiDettaglioManodopera, statoVisibileManodopera, type ClientManodopera, type DettaglioManodoperaEconomia, type VoceManodoperaEconomia } from '../engines/economia/manodoperaEconomiaDettaglio'
import { documentoManodoperaEconomia } from '../engines/economia/stampaManodoperaEconomia'
import { numeroMateriali, prezzoMateriali, dataMateriali } from '../engines/economia/stampaMaterialiEconomia'

export function TabellaManodopera({ righe, onVisualizza, onRaccolta }: {
  righe: VoceManodoperaEconomia[]; onVisualizza?: (riga: VoceManodoperaEconomia) => void; onRaccolta?: (id: string) => void
}) {
  const money = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
  return <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
    <thead><tr>{['Data','Descrizione / lavorazione','Operai / riferimento rapportino','Ore / quantità','U.M.','Prezzo unitario','Totale','Raccolta Economia','Stato', ...(onVisualizza ? ['Operazioni'] : [])].map(t => <th scope="col" key={t} style={{ padding: 8, textAlign: 'left' }}>{t}</th>)}</tr></thead>
    <tbody>{righe.map(r => <tr key={r.id}>{[dataMateriali(r.data), r.descrizione, r.operaioRiferimento || '—', numeroMateriali(r.quantita), r.um, r.prezzo === null ? 'Da valorizzare' : prezzoMateriali(r.prezzo), r.totale === null ? 'Da valorizzare' : money(r.totale), r.riferimento, statoVisibileManodopera(r)].map((v, i) => <td key={i} style={{ padding: 8, borderTop: '1px solid #dbe3ee', verticalAlign: 'top', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{i === 8 ? <span style={{ padding: '2px 6px', borderRadius: 4, background: r.stato === 'Approvato' ? '#dcfce7' : '#fef3c7' }}>{v}</span> : v}</td>)}
      {onVisualizza && <td style={{ padding: 8, verticalAlign: 'top', width: 120 }}><button type="button" onClick={() => onVisualizza(r)}>{r.stato === 'Approvato' ? 'Visualizza' : 'Visualizza origine'}</button>{r.stato === 'Da contabilizzare' && onRaccolta && <button type="button" style={{ marginTop: 4 }} onClick={() => onRaccolta(r.raccoltaId)}>Apri raccolta Economia</button>}</td>}
    </tr>)}</tbody>
  </table>{!righe.length && <p>Nessuna riga.</p>}</div>
}

export default function ManodoperaEconomiaDettaglio({ client, cantiereId, contrattoId, cantiereNome }: {
  client: ClientManodopera; cantiereId: string; contrattoId: string; cantiereNome: string
}) {
  const [risposta, setRisposta] = useState<{ client: ClientManodopera; cantiereId: string; contrattoId: string; dati: DettaglioManodoperaEconomia | null } | null>(null)
  const [origine, setOrigine] = useState<VoceManodoperaEconomia | null>(null)
  const [raccoltaId, setRaccoltaId] = useState<string | null>(null)
  const [erroreStampa, setErroreStampa] = useState('')
  useEffect(() => {
    let obsoleta = false
    setRisposta(null); setOrigine(null); setRaccoltaId(null); setErroreStampa('')
    void leggiDettaglioManodopera(client, cantiereId, contrattoId).then(
      dati => { if (!obsoleta) setRisposta({ client, cantiereId, contrattoId, dati }) },
      () => { if (!obsoleta) setRisposta({ client, cantiereId, contrattoId, dati: null }) },
    )
    return () => { obsoleta = true }
  }, [client, cantiereId, contrattoId])
  const corrente = risposta?.client === client && risposta.cantiereId === cantiereId && risposta.contrattoId === contrattoId ? risposta : null
  const dati = corrente?.dati
  const raccolta = dati?.raccolte.find(c => c.id === raccoltaId)
  const visualizza = (r: VoceManodoperaEconomia) => { setOrigine(r); setRaccoltaId(null) }
  const apriRaccolta = (id: string) => { setRaccoltaId(id); setOrigine(null) }
  const money = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
  const stampa = () => {
    if (!dati) return
    setErroreStampa(''); let finestra: Window | null = null
    try {
      const documento = documentoManodoperaEconomia(cantiereNome, dati)
      finestra = window.open('', '_blank')
      if (!finestra) { setErroreStampa('Consenti la finestra di stampa e riprova.'); return }
      finestra.opener = null; finestra.document.open(); finestra.document.write(documento); finestra.document.close(); finestra.focus(); finestra.print()
    } catch { finestra?.close(); setErroreStampa('Stampa manodopera non disponibile.') }
  }
  return <section aria-label="Manodopera Economia" style={{ padding: 16, background: '#f8fafc', marginTop: 12 }}>
    <h4>Manodopera Economia</h4>
    {!corrente ? <p role="status">Caricamento dettaglio manodopera…</p> : !dati ? <p role="status">Dettaglio manodopera non disponibile: deduplicazione o valorizzazione non verificata.</p> : <>
      <p>Approvata: <strong>{money(dati.totaleApprovato)}</strong><br />Da contabilizzare: <strong>{dati.totalePendenti === null ? 'Non completo: righe da valorizzare' : money(dati.totalePendenti)}</strong><br />Totale operativo manodopera: <strong>{dati.totaleOperativo === null ? 'Non completo: righe da valorizzare' : money(dati.totaleOperativo)}</strong></p>
      {dati.totalePendenti === null && <p>{dati.pendenti.filter(r => r.totale === null).length} righe da valorizzare. Subtotale pendenti già valorizzati: {money(dati.totalePendentiValorizzati)}.</p>}
      <p>Valori cliente separati dai costi aziendali. I pendenti non aumentano il Contratto aggiornato.</p>
      <details><summary style={{ cursor: 'pointer', padding: '8px 0' }}>Vedi dettaglio manodopera</summary>
        <h5>Manodopera approvata ({dati.approvate.length})</h5><TabellaManodopera righe={dati.approvate} onVisualizza={visualizza} />
        <h5>Manodopera da contabilizzare ({dati.pendenti.length})</h5><TabellaManodopera righe={dati.pendenti} onVisualizza={visualizza} onRaccolta={apriRaccolta} />
      </details>
      {origine && <section aria-label="Origine manodopera" style={{ padding: 12, border: '1px solid #cbd5e1' }}>
        <h5>{origine.stato === 'Approvato' ? 'Snapshot approvato — sola lettura' : 'Origine Economia — sola lettura'}</h5>
        <p>{origine.descrizione}<br />{origine.riferimento}<br />Origine: {origine.origine}<br />ID riga Economia: {origine.rigaId}<br />Sorgente: {origine.sorgenteId || '—'}<br />Rapportino: {origine.rapportinoId || '—'}<br />Prestazione: {origine.prestazioneId || '—'}<br />{origine.operaioRiferimento || '—'}</p>
        <button type="button" onClick={() => setOrigine(null)}>Chiudi origine</button>
      </section>}
      {raccolta && <section aria-label="Raccolta Economia consultazione" style={{ padding: 12, border: '1px solid #cbd5e1' }}>
        <h5>{raccolta.titolo} — manodopera, sola lettura</h5><p>ID raccolta: {raccolta.id}</p><TabellaManodopera righe={raccolta.righe} />
        <button type="button" onClick={() => setRaccoltaId(null)}>Chiudi vista</button>
      </section>}
      <button type="button" onClick={stampa} style={{ padding: '8px 12px', marginTop: 6 }}>Stampa manodopera Economia</button>
      {erroreStampa && <p role="alert">{erroreStampa}</p>}
    </>}
  </section>
}
