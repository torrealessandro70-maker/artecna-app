'use client'

type PreventiviCaricatiListProps = {
  preventivi: any[]
  salCantiere: string
  formatMoney: (value: number) => string
  onElimina: (preventivo: any) => void
}

export default function PreventiviCaricatiList({
  preventivi,
  salCantiere,
  formatMoney,
  onElimina,
}: PreventiviCaricatiListProps) {
  const righe = preventivi.filter((p) => p.cantiere === salCantiere)

  return (
    <div style={{ marginTop: 14 }}>
      <strong>📄 Preventivi caricati per questo cantiere</strong>

      {righe.length === 0 ? (
        <div style={{ marginTop: 8, color: '#64748b' }}>
          Nessun preventivo caricato.
        </div>
      ) : (
        righe.map((p, i) => (
          <div
            key={p.id || i}
            style={{
              marginTop: 8,
              padding: 10,
              border: '1px solid #ddd',
              borderRadius: 8,
              background: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <div>
              <strong>{p.nome_file || 'Preventivo'}</strong>
              <br />
              Importo: € {formatMoney(Number(p.importo_totale || 0))}
            </div>

            <button
              onClick={() => onElimina(p)}
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
          </div>
        ))
      )}
    </div>
  )
}
