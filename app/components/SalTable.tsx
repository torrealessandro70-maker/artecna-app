'use client'

type SalTableProps = {
  lavorazioni: any[]
  excelTable: any
  excelTh: any
  excelTd: any
  formatMoney: (value: number) => string
  onToggleCompletata: (lavorazione: any, completata: boolean) => void
  onUpdateDescrizione: (lavorazione: any, descrizione: string) => void
  onUpdateImporto: (lavorazione: any, valore: string) => void
  onUpdatePercentuale: (lavorazione: any, valore: string) => void
  onElimina: (id: number) => void
}

export default function SalTable({
  lavorazioni,
  excelTable,
  excelTh,
  excelTd,
  formatMoney,
  onToggleCompletata,
  onUpdateDescrizione,
  onUpdateImporto,
  onUpdatePercentuale,
  onElimina,
}: SalTableProps) {
  if (lavorazioni.length === 0) {
    return <p>Nessuna lavorazione SAL inserita per questo cantiere.</p>
  }

  return (
    <div
      style={{
        marginTop: 12,
        background: '#fff',
        border: '1px solid #cbd5e1',
        borderRadius: 10,
        padding: 12,
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        width: '100%',
        minWidth: 360,
        maxWidth: '100%',
        height: 520,
        minHeight: 260,
        maxHeight: '80vh',
        overflow: 'auto',
        resize: 'both',
      }}
    >
      <table style={excelTable}>
        <thead>
          <tr>
            <th style={excelTh}>Completata</th>
            <th style={excelTh}>Lavorazione</th>
            <th style={excelTh}>Importo previsto</th>
            <th style={excelTh}>% eseguita</th>
            <th style={excelTh}>SAL maturato</th>
            <th style={excelTh}>Data</th>
            <th style={excelTh}>Note</th>
            <th style={excelTh}>Azioni</th>
          </tr>
        </thead>

        <tbody>
          {lavorazioni.map((s, i) => {
            const testoSospetto = String(s.descrizione || '').toLowerCase()

            const rigaSospetta =
              testoSospetto.includes('totale offerta') ||
              testoSospetto.includes('cronoprogramma') ||
              testoSospetto.includes('schema pagamenti') ||
              testoSospetto.includes('garanzia') ||
              testoSospetto.includes('firma') ||
              testoSospetto.includes('iva esclusa')

            return (
              <tr key={s.id || i}>
                <td style={excelTd}>
                  <input
                    type="checkbox"
                    checked={!!s.completata}
                    onChange={(e) =>
                      onToggleCompletata(s, e.target.checked)
                    }
                  />
                </td>

                <td style={excelTd}>
                  <textarea
                    value={s.descrizione || ''}
                    onChange={(e) =>
                      onUpdateDescrizione(s, e.target.value)
                    }
                    style={{
                      width: '100%',
                      minWidth: 260,
                      minHeight: 80,
                      border: '1px solid #ccc',
                      borderRadius: 6,
                      padding: 6,
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      lineHeight: 1.4,
                    }}
                  />
                </td>

                <td style={excelTd}>
                  <input
                    value={s.importo_previsto || ''}
                    onChange={(e) =>
                      onUpdateImporto(s, e.target.value)
                    }
                    style={{
                      width: 110,
                      padding: 6,
                      borderRadius: 6,
                      border: '1px solid #ccc',
                    }}
                  />
                </td>

                <td style={excelTd}>
                  <input
                    value={s.percentuale || 0}
                    onChange={(e) =>
                      onUpdatePercentuale(s, e.target.value)
                    }
                    style={{
                      width: 70,
                      padding: 6,
                      borderRadius: 6,
                      border: '1px solid #ccc',
                    }}
                  />
                </td>

                <td
                  style={{
                    ...excelTd,
                    fontWeight: 700,
                    color: '#16a34a',
                  }}
                >
                  {formatMoney(Number(s.importo_maturato || 0))}
                </td>

                <td style={excelTd}>
                  {s.data_aggiornamento || '-'}
                </td>

                <td style={excelTd}>
                  {rigaSospetta
                    ? '⚠️ Probabile errore OCR/importazione'
                    : s.note || '-'}
                </td>

                <td style={excelTd}>
                  <button
                    onClick={() => onElimina(s.id)}
                    style={{
                      background: '#dc2626',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    Elimina
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}