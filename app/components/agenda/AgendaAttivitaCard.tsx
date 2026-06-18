'use client'

import type { CSSProperties } from 'react'
import { esportaAttivitaIcs, formattaData, type AttivitaAgenda } from './utils'

type Props = {
  attivita: AttivitaAgenda
  onModifica: (attivita: AttivitaAgenda) => void
  onCambiaStato: (id: string) => void
  onElimina: (id: string) => void
  buttonSecondary: CSSProperties
}

export default function AgendaAttivitaCard({
  attivita,
  onModifica,
  onCambiaStato,
  onElimina,
  buttonSecondary,
}: Props) {
  const completata = attivita.stato === 'completata'
  const totaleChecklist = attivita.checklist?.length || 0
  const checklistCompletate =
    attivita.checklist?.filter((voce) => voce.completata).length || 0

  return (
    <article
      style={{
        padding: 16,
        border: completata ? '1px solid #bbf7d0' : '1px solid #dbeafe',
        borderRadius: 14,
        background: completata ? '#f0fdf4' : '#fff',
        boxShadow: '0 5px 16px rgba(15,23,42,0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              textDecoration: completata ? 'line-through' : 'none',
            }}
          >
            {attivita.titolo}
          </h3>
          <div style={{ marginTop: 5, color: '#475569', fontWeight: 700 }}>
            {formattaData(attivita.data)} · {attivita.ora || 'Ora da definire'}
          </div>
        </div>
        <span
          style={{
            padding: '6px 9px',
            borderRadius: 999,
            background: completata ? '#dcfce7' : '#dbeafe',
            color: completata ? '#166534' : '#1e40af',
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
        >
          {completata ? 'Completata' : 'Da fare'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
        <span
          style={{
            padding: '5px 9px',
            borderRadius: 999,
            background: '#f1f5f9',
            color: '#334155',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {attivita.tipo}
        </span>
        {attivita.collegamento && (
          <span
            style={{
              padding: '5px 9px',
              borderRadius: 999,
              background: '#fef3c7',
              color: '#92400e',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Fascicolo: {attivita.collegamento.etichetta}
          </span>
        )}
      </div>

      {totaleChecklist > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: '9px 11px',
            borderRadius: 9,
            background: '#f8fafc',
            color: '#475569',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Checklist: {checklistCompletate}/{totaleChecklist} completate
        </div>
      )}

      {attivita.descrizione && (
        <p style={{ margin: '12px 0 0', color: '#475569', whiteSpace: 'pre-wrap' }}>
          {attivita.descrizione}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <button
          type="button"
          onClick={() => onModifica(attivita)}
          style={{ ...buttonSecondary, minHeight: 44, padding: '9px 14px', fontWeight: 800 }}
        >
          Modifica
        </button>
        <button
          type="button"
          onClick={() => esportaAttivitaIcs(attivita)}
          style={{ ...buttonSecondary, minHeight: 44, padding: '9px 12px' }}
        >
          Aggiungi al calendario
        </button>
        <button
          type="button"
          onClick={() => onCambiaStato(attivita.id)}
          style={{ ...buttonSecondary, minHeight: 44, padding: '9px 12px' }}
        >
          {completata ? 'Riapri' : 'Completa'}
        </button>
        <button
          type="button"
          onClick={() => onElimina(attivita.id)}
          style={{
            ...buttonSecondary,
            minHeight: 44,
            padding: '9px 12px',
            color: '#991b1b',
            borderColor: '#fecaca',
          }}
        >
          Elimina
        </button>
      </div>
    </article>
  )
}
