'use client'

type Props = {
  fattureEmesse: any[]
  fattureFornitori: any[]
  totalePreventiviImpresa: number
  formatMoney: (value: number) => string
}

export default function EconomiaGeneraleKpiPanel({
  fattureEmesse,
  fattureFornitori,
  totalePreventiviImpresa,
  formatMoney,
}: Props) {
  const totaleFattureEmesse = fattureEmesse.reduce(
    (tot, f) => tot + Number(f.totale || 0),
    0
  )

  const totaleIncassato = fattureEmesse.reduce(
    (tot, f) => tot + Number(f.importo_incassato || 0),
    0
  )

  const totaleFattureFornitori = fattureFornitori.reduce(
    (tot, f) => tot + Number(f.importo_totale || 0),
    0
  )

  const cashFlowReale = totaleIncassato - totaleFattureFornitori

  return (
    <div
      style={{
        padding: 12,
        border: '1px solid #ddd',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            padding: 12,
            border: '1px solid #ddd',
            borderRadius: 8,
            background: '#eff6ff',
          }}
        >
          <strong>🧾 Totale fatture emesse</strong>
          <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}>
            {formatMoney(totaleFattureEmesse)}
          </div>
        </div>

        <div
          style={{
            padding: 12,
            border: '1px solid #ddd',
            borderRadius: 8,
            background: '#f0fdf4',
          }}
        >
          <strong>💰 Totale incassato</strong>
          <div
            style={{
              marginTop: 6,
              fontSize: 20,
              fontWeight: 700,
              color: 'green',
            }}
          >
            {formatMoney(totaleIncassato)}
          </div>
        </div>

        <div
          style={{
            padding: 12,
            border: '1px solid #ddd',
            borderRadius: 8,
            background: '#fef2f2',
          }}
        >
          <strong>📄 Totale fatture fornitori</strong>
          <div
            style={{
              marginTop: 6,
              fontSize: 20,
              fontWeight: 700,
              color: '#dc2626',
            }}
          >
            {formatMoney(totaleFattureFornitori)}
          </div>
        </div>

        <div
          style={{
            padding: 12,
            border: '1px solid #ddd',
            borderRadius: 8,
            background: '#faf5ff',
          }}
        >
          <strong>📈 Cash flow reale</strong>
          <div
            style={{
              marginTop: 6,
              fontSize: 20,
              fontWeight: 700,
              color: cashFlowReale >= 0 ? 'green' : 'red',
            }}
          >
            {formatMoney(cashFlowReale)}
          </div>
        </div>
      </div>

      <strong>Totale preventivi:</strong> {formatMoney(totalePreventiviImpresa)}
    </div>
  )
}