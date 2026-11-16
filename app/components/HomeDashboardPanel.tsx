import type { CSSProperties, ReactNode } from 'react'
import type { ContrattoAggiornato } from '../engines/economia/contrattiAggiornati'

type CantiereDashboard = { id: string; nome: string; data_fine_lavori?: string | null; contratto: ContrattoAggiornato;
  utile: number | null; margine: number | null }

type Props = {
  cardStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties

  assistenteAttivo: boolean
  avviaAssistenteVocale: () => void
  fermaAssistenteVocale: () => void

  classificaCantieri: CantiereDashboard[]
  formatMoney: (n: number) => string

  mostraCantieriConclusi: boolean
  setMostraCantieriConclusi: (v: boolean) => void

  cantieriConclusi: CantiereDashboard[]
  riepilogo?: ReactNode
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
  cantieriConclusi,
  riepilogo,
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

      {riepilogo}
      <h3 style={{ marginTop: 25 }}>Classifica cantieri</h3>

      {classificaCantieri.length === 0 ? (
        <p>Nessun cantiere presente</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {classificaCantieri.map((c, i) => (
            <div
              key={c.id || i}
              style={{
                padding: 12,
                border: '1px solid #ddd',
                borderRadius: 8,
                background: '#fff',
              }}
            >
              <strong>
                {c.utile === null ? c.nome : `#${i + 1} — ${c.nome}`}
              </strong>
              <br />
              Contratto aggiornato: {c.contratto.aggiornato === null ? c.contratto.messaggio : formatMoney(c.contratto.aggiornato)}
              <br />
              Utile gestionale:{' '}
              <strong style={{ color: c.utile === null ? undefined : c.utile >= 0 ? 'green' : 'red' }}>
                {c.utile === null ? 'Non disponibile' : formatMoney(c.utile)}
              </strong>
              <br />
              Margine gestionale: {c.margine === null ? 'Non disponibile' : `${c.margine.toFixed(1)}%`}
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
          {cantieriConclusi.length === 0 ? (
            <p>Nessun cantiere concluso</p>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {cantieriConclusi
                .map((c, i) => {
                  return (
                    <div
                      key={c.id || i}
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
                      Contratto aggiornato: {c.contratto.aggiornato === null ? c.contratto.messaggio : formatMoney(c.contratto.aggiornato)}
                      <br />
                      Utile gestionale:{' '}
                      <strong style={{ color: c.utile === null ? undefined : c.utile >= 0 ? 'green' : 'red' }}>
                        {c.utile === null ? 'Non disponibile' : formatMoney(c.utile)}
                      </strong>
                      <br />
                      Margine gestionale: {c.margine === null ? 'Non disponibile' : `${c.margine.toFixed(1)}%`}
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