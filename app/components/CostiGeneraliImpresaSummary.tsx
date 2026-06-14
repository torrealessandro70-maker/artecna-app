'use client'

type SpesaImpresa = {
  categoria?: string | null
  importo?: number | string | null
}

type Props = {
  speseImpresa: SpesaImpresa[]
  formatMoney: (value: number) => string
}

export default function CostiGeneraliImpresaSummary({
  speseImpresa,
  formatMoney,
}: Props) {
  const totaleAttrezzi = speseImpresa
    .filter((s) => s.categoria === 'attrezzo_ditta')
    .reduce((tot, s) => tot + Number(s.importo || 0), 0)

  const totaleMagazzino = speseImpresa
    .filter((s) => s.categoria === 'magazzino')
    .reduce((tot, s) => tot + Number(s.importo || 0), 0)

  const totaleSpeseGenerali = speseImpresa
    .filter((s) => s.categoria === 'spesa_generale')
    .reduce((tot, s) => tot + Number(s.importo || 0), 0)

  const totaleCostiGenerali = speseImpresa.reduce(
    (tot, s) => tot + Number(s.importo || 0),
    0
  )

  return (
    <>
      <h3 style={{ marginTop: 30 }}>🏢 Costi generali impresa</h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <strong>🛠️ Attrezzi / beni ditta</strong>
          <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}>
            {formatMoney(totaleAttrezzi)}
          </div>
        </div>

        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <strong>📦 Magazzino</strong>
          <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}>
            {formatMoney(totaleMagazzino)}
          </div>
        </div>

        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <strong>📑 Spese generali</strong>
          <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}>
            {formatMoney(totaleSpeseGenerali)}
          </div>
        </div>

        <div
          style={{
            padding: 12,
            border: '2px solid #dc2626',
            borderRadius: 8,
            background: '#fef2f2',
          }}
        >
          <strong>📉 Totale costi generali</strong>
          <div
            style={{
              marginTop: 6,
              fontSize: 20,
              fontWeight: 700,
              color: '#dc2626',
            }}
          >
            {formatMoney(totaleCostiGenerali)}
          </div>
        </div>
      </div>
    </>
  )
}