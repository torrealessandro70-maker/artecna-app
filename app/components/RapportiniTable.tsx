'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { FotoCantiere, Rapportino } from '../types'
import { apriFotoRapportino, fotoCollegataAlRapportino } from './RapportinoCard'

type Props = {
  rapportini: Rapportino[]
  mostraCantiere?: boolean
  queryRicerca?: string
  fotoCantiere: FotoCantiere[]
  onModifica: (rapportino: Rapportino) => void
  setFotoRapportinoAperte: (foto: FotoCantiere[]) => void
  eliminaRapportino: (id?: string) => void | Promise<void>
  generaPdfRapportinoFotografico: (rapportino: Rapportino) => void | Promise<void>
}

const cella: CSSProperties = {
  padding: '10px 12px', borderBottom: '1px solid #e2e8f0',
  textAlign: 'left', verticalAlign: 'top', fontSize: 13,
}
const azione: CSSProperties = {
  padding: '8px 10px', minHeight: 36, border: '1px solid #cbd5e1',
  borderRadius: 6, background: '#fff', color: '#334155',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
}

export default function RapportiniTable({
  rapportini, mostraCantiere = false, queryRicerca = '', fotoCantiere, onModifica,
  setFotoRapportinoAperte, eliminaRapportino, generaPdfRapportinoFotografico,
}: Props) {
  const evidenziaTesto = (testo: string) => {
    const query = queryRicerca.trim().toLowerCase()
    if (!query) return testo
    const segmenti: ReactNode[] = []
    const testoMinuscolo = testo.toLowerCase()
    let posizione = 0
    let indice = testoMinuscolo.indexOf(query)
    while (indice !== -1) {
      segmenti.push(testo.slice(posizione, indice))
      segmenti.push(<mark key={indice}>{testo.slice(indice, indice + query.length)}</mark>)
      posizione = indice + query.length
      indice = testoMinuscolo.indexOf(query, posizione)
    }
    segmenti.push(testo.slice(posizione))
    return segmenti
  }

  return (
    <div role="region" aria-label="Tabella rapportini" tabIndex={0} style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 950 }}>
        <thead style={{ background: '#f8fafc', color: '#475569' }}>
          <tr>
            {[
  'Data',
  ...(mostraCantiere ? ['Cantiere'] : []),
  'Descrizione / Note',
  'Operai',
  'Compilato da',
  'Ore',
  'Foto',
  'Azioni',
].map((titolo) => (
              <th key={titolo} scope="col" style={{ ...cella, fontWeight: 600 }}>{titolo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rapportini.map((r, indice) => {
            const fotoCollegate = fotoCantiere.filter((foto) => fotoCollegataAlRapportino(foto, r))
            const data = /^\d{4}-\d{2}-\d{2}/.test(r.data || '')
              ? r.data.slice(0, 10).split('-').reverse().join('/') : r.data
            return (
              <tr key={r.id || indice}>
                <td style={{ ...cella, whiteSpace: 'nowrap' }}>{data || '—'}</td>
                {mostraCantiere && <td style={cella}>{evidenziaTesto(r.cantiere || '')}</td>}
                <td style={{ ...cella, minWidth: 250, maxWidth: 450, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{evidenziaTesto(r.note || '—')}</td>
                <td style={{ ...cella, minWidth: 140, whiteSpace: 'pre-wrap' }}>{evidenziaTesto(r.operai || '—')}</td>
<td style={{ ...cella, minWidth: 140 }}>
  {evidenziaTesto(r.compilato_da_nome || '—')}
</td>
                <td style={cella}>{r.ore ?? '—'}</td>
                <td style={cella}>{fotoCollegate.length}</td>
                <td style={cella}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" style={azione} onClick={() => onModifica(r)}>Modifica</button>
                    <button type="button" style={azione} onClick={() => apriFotoRapportino(fotoCollegate, setFotoRapportinoAperte)}>Apri foto</button>
                    <button type="button" style={{ ...azione, color: '#b91c1c', borderColor: '#fecaca', background: '#fef2f2' }} onClick={() => eliminaRapportino(r.id)}>Elimina</button>
                    <button type="button" style={{ ...azione, color: '#1d4ed8' }} onClick={() => generaPdfRapportinoFotografico(r)}>PDF foto</button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
