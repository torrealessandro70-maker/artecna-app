'use client'

type AccontiTableProps = {
  acconti: any[]
  cantiereScheda: string
  economiaDataDa: string
  economiaDataA: string
  excelTable: any
  excelTh: any
  excelTd: any
  buttonSecondary: any
  formatMoney: (value: number) => string
  onModifica: (acconto: any) => void
  onElimina: (acconto: any) => void
}

export default function AccontiTable({
  acconti,
  cantiereScheda,
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
  const righe = acconti.filter((a) => {
    if (a.cantiere !== cantiereScheda) return false

    if (
      economiaDataDa &&
      String(a.data_incasso || '') < economiaDataDa
    ) {
      return false
    }

    if (
      economiaDataA &&
      String(a.data_incasso || '') > economiaDataA
    ) {
      return false
    }

    return true
  })

  if (righe.length === 0) {
    return <p>Nessun acconto registrato.</p>
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