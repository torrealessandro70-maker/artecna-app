'use client'

import { useState, type CSSProperties } from 'react'
import type { Operaio } from '../types'

type Props = {
  operai: Operaio[]
  badgeStyle: (stato?: string) => CSSProperties
  formatMoney: (value: number) => string
  preparaModificaOperaio: (operaio: Operaio) => void
  cambiaStatoOperaio: (operaio: Operaio, stato: 'attivo' | 'sospeso') => void | Promise<void>
  cambiaAccessoPortale: (operaio: Operaio, abilitato: boolean) => void | Promise<void>
  eliminaOperaio: (id?: string) => void | Promise<void>
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

const excelTable: CSSProperties = {
  width: '100%', borderCollapse: 'collapse', tableLayout: 'auto',
  fontSize: 14, minWidth: 1200,
}
const excelTh: CSSProperties = {
  background: '#e5e7eb', border: '1px solid #cbd5e1', padding: '8px 10px',
  fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap',
}
const excelTd: CSSProperties = {
  border: '1px solid #cbd5e1', padding: '7px 10px',
  verticalAlign: 'middle', lineHeight: 1.35,
}
const cellaCompatta: CSSProperties = { ...excelTd, whiteSpace: 'nowrap' }
const cellaTesto: CSSProperties = { ...excelTd, whiteSpace: 'normal', overflowWrap: 'anywhere' }

export default function OperaiTable({
  operai, badgeStyle, formatMoney, preparaModificaOperaio,
  cambiaStatoOperaio, cambiaAccessoPortale, eliminaOperaio,
  buttonPrimary, buttonSecondary,
}: Props) {
  const [direzioneNome, setDirezioneNome] = useState<'asc' | 'desc'>('asc')
  const operaiOrdinati = [...operai].sort((a, b) => {
    const confronto = (a.nome || '').localeCompare(b.nome || '', 'it', { sensitivity: 'base' })
    return direzioneNome === 'asc' ? confronto : -confronto
  })

  if (operai.length === 0) return <p>Nessun operaio presente</p>

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={excelTable}>
        <thead>
          <tr>
            <th scope="col" style={excelTh} aria-sort={direzioneNome === 'asc' ? 'ascending' : 'descending'}>
              <button
                type="button"
                onClick={() => setDirezioneNome((valore) => valore === 'asc' ? 'desc' : 'asc')}
                style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
              >
                Nome {direzioneNome === 'asc' ? '↑' : '↓'}
              </button>
            </th>
            {['Qualifica', 'Telefono', 'PIN', 'Accesso portale', 'Costo orario', 'Nota', 'Stato', 'Azioni'].map((titolo) => (
              <th key={titolo} scope="col" style={excelTh}>{titolo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {operaiOrdinati.map((o, i) => (
            <tr key={o.id || i} style={{ background: '#fff' }}>
              <td style={excelTd}>{o.nome}</td>
              <td style={cellaTesto}>{o.qualifica || '-'}</td>
              <td style={cellaCompatta}>{o.telefono || '-'}</td>
              <td style={cellaCompatta}>{o.pin || '-'}</td>
              <td style={cellaCompatta}>{o.accesso_portale ? 'ABILITATO' : 'DISABILITATO'}</td>
              <td style={cellaCompatta}>{formatMoney(Number(o.costo_orario || 0))}</td>
              <td style={cellaTesto}>{o.nota || '-'}</td>
              <td style={cellaCompatta}><span style={badgeStyle(o.stato)}>{o.stato || 'attivo'}</span></td>
              <td style={excelTd}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => preparaModificaOperaio(o)} style={buttonSecondary}>Modifica</button>
                  <button
                    type="button"
                    onClick={() => cambiaAccessoPortale(o, !Boolean(o.accesso_portale))}
                    style={o.accesso_portale ? buttonSecondary : buttonPrimary}
                  >
                    {o.accesso_portale ? 'Disabilita portale' : 'Abilita portale'}
                  </button>
                  {o.stato === 'sospeso' ? (
                    <button type="button" onClick={() => cambiaStatoOperaio(o, 'attivo')} style={buttonPrimary}>Riattiva</button>
                  ) : (
                    <button type="button" onClick={() => cambiaStatoOperaio(o, 'sospeso')} style={buttonSecondary}>Sospendi</button>
                  )}
                  <button
                    type="button"
                    onClick={() => eliminaOperaio(o.id)}
                    style={{ padding: '10px 14px', backgroundColor: '#d9534f', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Elimina
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
