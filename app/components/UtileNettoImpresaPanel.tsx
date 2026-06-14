'use client'

type Props = {
  totaleIncassato: number
  totaleCostiCantieri: number
  totaleCostiGenerali: number
  utileNettoImpresa: number
  formatMoney: (value: number) => string
}

export default function UtileNettoImpresaPanel({
  totaleIncassato,
  totaleCostiCantieri,
  totaleCostiGenerali,
  utileNettoImpresa,
  formatMoney,
}: Props) {
  return (
    <div
      style={{
        marginTop: 20,
        padding: 16,
        borderRadius: 12,
        border:
          utileNettoImpresa >= 0
            ? '2px solid #16a34a'
            : '2px solid #dc2626',
        background:
          utileNettoImpresa >= 0
            ? '#f0fdf4'
            : '#fef2f2',
      }}
    >
      <h3>💶 Utile netto impresa</h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginTop: 12,
        }}
      >
        <div>
          <strong>💰 Totale incassato</strong>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {formatMoney(totaleIncassato)}
          </div>
        </div>

        <div>
          <strong>🏗️ Costi cantieri</strong>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#dc2626',
            }}
          >
            {formatMoney(totaleCostiCantieri)}
          </div>
        </div>

        <div>
          <strong>🏢 Costi generali impresa</strong>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#dc2626',
            }}
          >
            {formatMoney(totaleCostiGenerali)}
          </div>
        </div>

        <div>
          <strong>📈 Utile netto</strong>

          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color:
                utileNettoImpresa >= 0
                  ? '#16a34a'
                  : '#dc2626',
            }}
          >
            {formatMoney(utileNettoImpresa)}
          </div>
        </div>
      </div>
    </div>
  )
}