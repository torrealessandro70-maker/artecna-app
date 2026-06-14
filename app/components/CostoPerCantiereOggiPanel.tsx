'use client'

type Props = {
  costoPerCantiereOggi: () => Record<string, number>
  formatMoney: (v: number) => string
}

export default function CostoPerCantiereOggiPanel({
  costoPerCantiereOggi,
  formatMoney,
}: Props) {
  const costi = costoPerCantiereOggi()

  return (
    <>
      <h3>Costo per cantiere oggi</h3>

      {Object.keys(costi).length === 0 ? (
        <p>Nessun costo disponibile oggi.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginBottom: 25 }}>
          {Object.entries(costi).map(([cantiere, totale]) => (
            <div
              key={cantiere}
              style={{
                padding: 12,
                border: '1px solid #ddd',
                borderRadius: 8,
                background: '#fff',
              }}
            >
              <strong>{cantiere}</strong>
              <br />
              Manodopera oggi: {formatMoney(Number(totale || 0))}
            </div>
          ))}
        </div>
      )}
    </>
  )
}