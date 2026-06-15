import type { CSSProperties } from 'react'

type Props = {
  cardStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties

  assistenteAttivo: boolean
  avviaAssistenteVocale: () => void
  fermaAssistenteVocale: () => void

  classificaCantieri: any[]
  formatMoney: (n: number) => string

  mostraCantieriConclusi: boolean
  setMostraCantieriConclusi: (v: boolean) => void

  cantieri: any[]
  calcoloEconomiaCantiere: (nomeCantiere: string) => any
}

export default function HomeDashboardPanel({
  cardStyle,
  buttonPrimary,
  buttonSecondary,
  assistenteAttivo,
  avviaAssistenteVocale,
  fermaAssistenteVocale,
  classificaCantieri,
  formatMoney,
  mostraCantieriConclusi,
  setMostraCantieriConclusi,
  cantieri,
  calcoloEconomiaCantiere,
}: Props) {
  return (
    <div style={cardStyle}>
      <h2 style={{ margin: 0 }}>Dashboard impresa</h2>

      <div style={{ marginTop: 15, marginBottom: 20 }}>
        {!assistenteAttivo ? (
          <button
            onClick={avviaAssistenteVocale}
            style={{
              ...buttonPrimary,
              backgroundColor: '#2563eb',
            }}
          >
            🎧 Avvia assistente vocale Artecna
          </button>
        ) : (
          <button
            onClick={fermaAssistenteVocale}
            style={{
              ...buttonPrimary,
              backgroundColor: '#dc2626',
            }}
          >
            ⛔ Ferma assistente vocale
          </button>
        )}

        {assistenteAttivo && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 10,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
            }}
          >
            🎧 Assistente Artecna attivo
            <br />
            Comandi disponibili:
            <ul style={{ marginTop: 8 }}>
              <li>“Hey Artecna apri rapportino”</li>
              <li>“Hey Artecna apri economia”</li>
              <li>“Hey Artecna apri presenze”</li>
              <li>“Hey Artecna apri timbrature”</li>
            </ul>
          </div>
        )}
      </div>

      <h3 style={{ marginTop: 25 }}>Classifica cantieri</h3>

      {classificaCantieri.length === 0 ? (
        <p>Nessun cantiere presente</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {classificaCantieri.map((c, i) => (
            <div
              key={c.nome || i}
              style={{
                padding: 12,
                border: '1px solid #ddd',
                borderRadius: 8,
                background: '#fff',
              }}
            >
              <strong>
                #{i + 1} — {c.nome}
              </strong>
              <br />
              Utile:{' '}
              <strong style={{ color: c.utile >= 0 ? 'green' : 'red' }}>
                {formatMoney(c.utile)}
              </strong>
              <br />
              Margine: {c.margine.toFixed(1)}%
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 25 }}>
        <button
          onClick={() => setMostraCantieriConclusi(!mostraCantieriConclusi)}
          style={buttonSecondary}
        >
          {mostraCantieriConclusi
            ? 'Nascondi cantieri conclusi'
            : 'Mostra cantieri conclusi'}
        </button>
      </div>

      {mostraCantieriConclusi && (
        <>
          {cantieri.filter((c) => c.lavori_conclusi).length === 0 ? (
            <p>Nessun cantiere concluso</p>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {cantieri
                .filter((c) => c.lavori_conclusi)
                .map((c, i) => {
                  const nomeCantiere = String(c.nome || '')
                  const utile = calcoloEconomiaCantiere(nomeCantiere).utileReale

                  return (
                    <div
                      key={c.nome || i}
                      style={{
                        padding: 12,
                        border: '1px solid #ddd',
                        borderRadius: 8,
                        background: '#f1f5f9',
                        opacity: 0.9,
                      }}
                    >
                      <strong>{c.nome}</strong>
                      <br />
                      Fine lavori: {c.data_fine_lavori || '-'}
                      <br />
                      Utile:{' '}
                      <strong style={{ color: utile >= 0 ? 'green' : 'red' }}>
                        {formatMoney(utile)}
                      </strong>
                    </div>
                  )
                })}
            </div>
          )}
        </>
      )}
    </div>
  )
}