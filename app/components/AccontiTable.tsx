'use client'
import ContrattoFiscalePanel from './ContrattoFiscalePanel'
import type { CSSProperties } from 'react'
import { selezionaAcconti, type RigaAcconto } from '../engines/economia/accontiCantiere'

type AccontiTableProps = {
  acconti: RigaAcconto[]
  cantiereScheda: string
  cantiereId?: string
  economiaDataDa: string
  economiaDataA: string
  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
  buttonSecondary: CSSProperties
  formatMoney: (value: number) => string
  onModifica: (acconto: RigaAcconto) => void
  onElimina: (acconto: RigaAcconto) => void
}

export default function AccontiTable({
  acconti,
  cantiereScheda,
  cantiereId,
  economiaDataDa,
  economiaDataA,
  excelTable,
  excelTh,
  excelTd,
  buttonSecondary,
  formatMoney,
  onModifica,
  onElimina,
}: AccontiTableProps) {
  const righe = selezionaAcconti(acconti, cantiereScheda, cantiereId, economiaDataDa, economiaDataA)

  if (righe.length === 0) {
    return <p>{economiaDataDa || economiaDataA ? 'Nessun acconto nel periodo selezionato.' : 'Nessun acconto registrato.'}</p>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={excelTable}>
        <thead>
          <tr>
            <th style={excelTh}>Data</th>
            <th style={excelTh}>Descrizione</th>
            <th style={excelTh}>Importo</th>
            <th style={excelTh}>Metodo</th>
            <th style={excelTh}>Nota</th>
            <th style={excelTh}>Azioni</th>
          </tr>
        </thead>

        <tbody>
          {righe.map((a, i) => (
            <tr key={a.id || i}>
              <td style={excelTd}>{a.data_incasso || '-'}</td>

              <td style={excelTd}>
                {a.descrizione || 'Acconto'}
              </td>

              <td style={excelTd}>
                <strong>
                  {formatMoney(Number(a.importo || 0))}
                </strong>
              </td>

              <td style={excelTd}>
                {a.metodo || '-'}
              </td>

              <td style={excelTd}>
                {a.nota || '-'}
              </td>

              <td style={excelTd}>
                {a.id && <ContrattoFiscalePanel id={a.id} acconto dataIncasso={a.data_incasso} />}
                <button
                  onClick={() => onModifica(a)}
                  style={buttonSecondary}
                >
                  ✏️
                </button>

                <button
                  onClick={() => onElimina(a)}
                  style={{
                    ...buttonSecondary,
                    backgroundColor: '#dc2626',
                    color: '#fff',
                    marginLeft: 6,
                  }}
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
