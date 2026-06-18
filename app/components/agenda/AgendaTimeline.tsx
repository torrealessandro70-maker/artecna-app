'use client'

import type { CSSProperties } from 'react'
import AgendaAttivitaCard from './AgendaAttivitaCard'
import { aggiungiGiorni, dataLocale, type AttivitaAgenda } from './utils'

type Props = {
  attivita: AttivitaAgenda[]
  onCambiaStato: (id: string) => void
  onElimina: (id: string) => void
  buttonSecondary: CSSProperties
}

export default function AgendaTimeline({
  attivita,
  onCambiaStato,
  onElimina,
  buttonSecondary,
}: Props) {
  const oggi = dataLocale()
  const domani = aggiungiGiorni(oggi, 1)
  const ordinate = [...attivita].sort((prima, seconda) =>
    `${prima.data}T${prima.ora || '23:59'}`.localeCompare(
      `${seconda.data}T${seconda.ora || '23:59'}`
    )
  )
  const gruppi = [
    {
      titolo: 'Oggi',
      elementi: ordinate.filter((item) => item.data <= oggi),
    },
    {
      titolo: 'Domani',
      elementi: ordinate.filter((item) => item.data === domani),
    },
    {
      titolo: 'Prossimi giorni',
      elementi: ordinate.filter((item) => item.data > domani),
    },
  ]

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {gruppi.map((gruppo) => (
        <section key={gruppo.titolo} aria-labelledby={`agenda-${gruppo.titolo}`}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
            }}
          >
            <span
              aria-hidden="true"
              style={{ width: 11, height: 11, borderRadius: '50%', background: '#2563eb' }}
            />
            <h2 id={`agenda-${gruppo.titolo}`} style={{ margin: 0, fontSize: 20 }}>
              {gruppo.titolo}
            </h2>
            <span style={{ color: '#64748b', fontSize: 13 }}>{gruppo.elementi.length}</span>
          </div>

          {gruppo.elementi.length === 0 ? (
            <div
              style={{
                marginLeft: 5,
                padding: '12px 16px 12px 22px',
                borderLeft: '2px solid #e2e8f0',
                color: '#94a3b8',
              }}
            >
              Nessuna attività
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 10,
                marginLeft: 5,
                paddingLeft: 22,
                borderLeft: '2px solid #bfdbfe',
              }}
            >
              {gruppo.elementi.map((item) => (
                <AgendaAttivitaCard
                  key={item.id}
                  attivita={item}
                  onCambiaStato={onCambiaStato}
                  onElimina={onElimina}
                  buttonSecondary={buttonSecondary}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
