'use client'

import { useState } from 'react'
import type { ScomposizioneVarianti, MaterialiOperativi } from '../engines/economia/riepilogoEconomico'
import { dettaglioMaterialiVerificato, documentoMaterialiEconomia, numeroMateriali, prezzoMateriali, dataMateriali } from '../engines/economia/stampaMaterialiEconomia'

export default function ScomposizioneContrattuale({ valori, operativi, formatMoney }: {
  valori: ScomposizioneVarianti | null; operativi?: MaterialiOperativi | null; formatMoney: (value: number) => string
}) {
  const [erroreStampa, setErroreStampa] = useState('')
  if (!valori) return <p role="status">Scomposizione contrattuale non disponibile.</p>
  let materiali: ReturnType<typeof dettaglioMaterialiVerificato> | null = null
  try { materiali = dettaglioMaterialiVerificato(valori) } catch { /* Nessuna lista parziale o stampa incoerente. */ }
  const stampa = () => {
    setErroreStampa('')
    let finestra: Window | null = null
    try {
      if (operativi === null) throw Error('Elenco operativo non disponibile')
      const documento = documentoMaterialiEconomia(valori.cantiereNome ?? '', valori, new Date(), operativi)
      finestra = window.open('', '_blank')
      if (!finestra) { setErroreStampa('Consenti la finestra di stampa e riprova.'); return }
      finestra.opener = null
      finestra.document.open(); finestra.document.write(documento); finestra.document.close(); finestra.focus(); finestra.print()
    } catch { finestra?.close(); setErroreStampa('Stampa non disponibile: verifica il dettaglio materiali approvato.') }
  }
  const righe: [string, number][] = [['Varianti ordinarie', valori.ordinarie], ['Manodopera Economia', valori.manodopera],
    ['Materiali Economia', valori.materiali], ['Totale aggiornamenti contrattuali', valori.totale]]
  return <dl aria-label="Scomposizione aggiornamenti contrattuali" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '8px 16px', padding: 16, background: '#f8fafc' }}>
    {righe.map(([nome, valore]) => <div key={nome} style={{ display: 'contents' }}><dt>{nome}</dt><dd style={{ margin: 0 }}>{formatMoney(valore)}</dd>
      {nome === 'Materiali Economia' && <dd style={{ gridColumn: '1 / -1', margin: 0 }}>
        {materiali === null ? <p role="status">Dettaglio materiali approvati non disponibile.</p> : <>
          <details key={`${valori.cantiereNome}:${materiali.map(r => r.id).join('|')}`}>
            <summary style={{ cursor: 'pointer', padding: '8px 0' }}>Vedi dettaglio materiali ({materiali.length})</summary>
            <div style={{ overflowX: 'auto', marginTop: 8 }}><table aria-label="Materiali Economia approvati" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>{['Data', 'Fornitore', 'Fattura', 'Descrizione', 'Quantità', 'U.M.', 'Prezzo unitario €', 'Totale', 'Raccolta / riferimento Economia', 'Stato'].map(t => <th scope="col" key={t} style={{ textAlign: 'left', padding: 8 }}>{t}</th>)}</tr></thead>
              <tbody>{materiali.map(r => <tr key={r.id}>{[dataMateriali(r.data), r.fornitore || '—', r.fattura || '—', r.descrizione,
                numeroMateriali(r.quantita), r.um, prezzoMateriali(r.prezzo), formatMoney(r.totale), r.riferimento, 'Approvato'].map((v, i) => <td key={i} style={{ padding: 8, borderTop: '1px solid #dbe3ee', verticalAlign: 'top', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{i === 9 ? <span style={{ borderRadius: 4, padding: '2px 6px', background: '#dcfce7' }}>{v}</span> : v}</td>)}</tr>)}</tbody>
              <tfoot><tr><th scope="row" colSpan={7} style={{ textAlign: 'left', padding: 8 }}>Totale Materiali Economia</th><td colSpan={3} style={{ padding: 8, fontWeight: 600 }}>{formatMoney(valori.materiali)}</td></tr></tfoot>
            </table></div>
            {!materiali.length && <p>Nessun materiale Economia approvato.</p>}
          </details>
          {operativi === null ? <p role="status">Materiali da contabilizzare non disponibili: deduplicazione non verificata.</p> : operativi && <>
            <details><summary style={{ cursor: 'pointer', padding: '8px 0' }}>Materiali da contabilizzare ({operativi.righe.length}) — {formatMoney(operativi.daContabilizzare)}</summary>
              <div style={{ overflowX: 'auto' }}><table aria-label="Materiali da contabilizzare" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>{['Data', 'Fornitore', 'Fattura', 'Descrizione', 'Quantità', 'U.M.', 'Prezzo Economia €', 'Totale', 'Raccolta Economia', 'Stato'].map(t => <th key={t} scope="col" style={{ textAlign: 'left', padding: 8 }}>{t}</th>)}</tr></thead>
                <tbody>{operativi.righe.map(r => <tr key={r.id}>{[dataMateriali(r.data), r.fornitore || '—', r.fattura || '—', r.descrizione, numeroMateriali(r.quantita), r.um, prezzoMateriali(r.prezzo), formatMoney(r.totale), r.riferimento, 'Da contabilizzare'].map((v, i) => <td key={i} style={{ padding: 8, borderTop: '1px solid #dbe3ee', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{i === 9 ? <span style={{ borderRadius: 4, padding: '2px 6px', background: '#fef3c7' }}>{v}</span> : v}</td>)}</tr>)}</tbody>
              </table></div>
            </details>
            <p>Materiali approvati: <strong>{formatMoney(valori.materiali)}</strong><br />Materiali da contabilizzare: <strong>{formatMoney(operativi.daContabilizzare)}</strong><br />Totale materiali presenti in Economia: <strong>{formatMoney(operativi.totaleOperativo)}</strong> (operativo)</p>
            <p>Le righe da contabilizzare non sono ancora comprese nel valore contrattuale approvato.</p>
          </>}
          <button type="button" onClick={stampa} disabled={!valori.cantiereNome?.trim() || operativi === null} style={{ padding: '8px 12px', marginTop: 6 }}>Stampa materiali Economia</button>
        </>}
        {erroreStampa && <p role="alert">{erroreStampa}</p>}
      </dd>}
    </div>)}
  </dl>
}
