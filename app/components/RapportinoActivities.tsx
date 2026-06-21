'use client'

import type { CSSProperties, KeyboardEvent } from 'react'

export type ActivityOrigin = 'manuale' | 'ai' | 'fascicolo'

export type Activity = {
  id: string
  testo: string
  completata: boolean
  origine: ActivityOrigin
  dataCreazione: string
}

export type RapportinoActivity = Activity

type Props = {
  attivita: RapportinoActivity[]
  onChangeAttivita: (attivita: RapportinoActivity[]) => void
  onActivitiesChange?: (attivita: RapportinoActivity[]) => void
  buttonSecondary: CSSProperties
}

const nuovaAttivita = (): RapportinoActivity => ({
  id: crypto.randomUUID(),
  testo: '',
  completata: false,
  origine: 'manuale',
  dataCreazione: new Date().toISOString(),
})

const iconaOrigine: Record<ActivityOrigin, string> = {
  manuale: '✍',
  ai: '🤖',
  fascicolo: '📂',
}

export default function RapportinoActivities({
  attivita,
  onChangeAttivita,
  onActivitiesChange,
  buttonSecondary,
}: Props) {
  const comunicaAttivita = (prossimeAttivita: RapportinoActivity[]) => {
    onChangeAttivita(prossimeAttivita)
    onActivitiesChange?.(prossimeAttivita)
  }

  const aggiungiAttivita = (dopoIndice?: number) => {
    const nuova = nuovaAttivita()

    if (dopoIndice === undefined) {
      comunicaAttivita([...attivita, nuova])
      return
    }

    comunicaAttivita([
      ...attivita.slice(0, dopoIndice + 1),
      nuova,
      ...attivita.slice(dopoIndice + 1),
    ])
  }

  const aggiornaAttivita = (
    id: string,
    modifiche: Partial<Omit<RapportinoActivity, 'id'>>
  ) => {
    comunicaAttivita(
      attivita.map((voce) =>
        voce.id === id ? { ...voce, ...modifiche } : voce
      )
    )
  }

  const eliminaAttivita = (id: string) => {
    comunicaAttivita(attivita.filter((voce) => voce.id !== id))
  }

  const gestisciInvio = (
    event: KeyboardEvent<HTMLInputElement>,
    indice: number
  ) => {
    if (event.key !== 'Enter') return

    event.preventDefault()
    aggiungiAttivita(indice)
  }

  return (
    <section
      style={{
        display: 'grid',
        gap: 10,
        padding: 14,
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        background: '#fff',
      }}
    >
      <h3 style={{ margin: 0, fontSize: 16 }}>☑ Cosa si deve fare</h3>

      {attivita.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          {attivita.map((voce, indice) => (
            <div
              key={voce.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '28px 24px 1fr 36px',
                alignItems: 'center',
                minHeight: 40,
                padding: '0 6px',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                background: '#f8fafc',
              }}
            >
              <input
                type="checkbox"
                checked={voce.completata}
                onChange={(event) =>
                  aggiornaAttivita(voce.id, {
                    completata: event.target.checked,
                  })
                }
                aria-label={`Completa attività ${indice + 1}`}
              />

              <span
                title={`Origine: ${voce.origine}`}
                aria-label={`Origine ${voce.origine}`}
                style={{ fontSize: 15, textAlign: 'center' }}
              >
                {iconaOrigine[voce.origine]}
              </span>

              <input
                value={voce.testo}
                onChange={(event) =>
                  aggiornaAttivita(voce.id, { testo: event.target.value })
                }
                onKeyDown={(event) => gestisciInvio(event, indice)}
                placeholder="Scrivi un'attività..."
                style={{
                  width: '100%',
                  padding: '8px 4px',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: '#0f172a',
                  fontSize: 15,
                  textDecoration: voce.completata ? 'line-through' : 'none',
                }}
              />

              <button
                type="button"
                onClick={() => eliminaAttivita(voce.id)}
                aria-label={`Elimina attività ${indice + 1}`}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 16,
                }}
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => aggiungiAttivita()}
        style={{ ...buttonSecondary, justifySelf: 'start' }}
      >
        ➕ Aggiungi attività
      </button>
    </section>
  )
}
