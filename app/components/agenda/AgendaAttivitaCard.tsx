'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  aggiungiUnOra,
  esportaAttivitaIcs,
  formattaData,
  type AttivitaAgenda,
  urlGoogleCalendar,
  urlOutlookCalendar,
} from './utils'

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
  const [menuCalendarioAperto, setMenuCalendarioAperto] = useState(false)
  const [dispositivoApple, setDispositivoApple] = useState<boolean | null>(null)
  const menuCalendarioRef = useRef<HTMLDivElement>(null)
  const completata = attivita.stato === 'completata'
  const totaleChecklist = attivita.checklist?.length || 0
  const checklistCompletate =
    attivita.checklist?.filter((voce) => voce.completata).length || 0
  const anteprimaChecklist = attivita.checklist?.slice(0, 3) || []
  const altreVociChecklist = Math.max(totaleChecklist - anteprimaChecklist.length, 0)
  const checklistCompletata =
    totaleChecklist > 0 && checklistCompletate === totaleChecklist
  const intervalloOrario = attivita.ora
    ? `${attivita.ora}\u2013${attivita.oraFine || aggiungiUnOra(attivita.ora)}`
    : 'Ora da definire'

  useEffect(() => {
    if (!menuCalendarioAperto) return

    const chiudiMenu = (evento: PointerEvent) => {
      if (!menuCalendarioRef.current?.contains(evento.target as Node)) {
        setMenuCalendarioAperto(false)
      }
    }

    document.addEventListener('pointerdown', chiudiMenu)
    return () => document.removeEventListener('pointerdown', chiudiMenu)
  }, [menuCalendarioAperto])

  const stileVoceCalendario: CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    border: 0,
    borderRadius: 8,
    background: 'transparent',
    color: '#0f172a',
    cursor: 'pointer',
    font: 'inherit',
    fontWeight: 700,
    textAlign: 'left',
    textDecoration: 'none',
  }

  const voceGoogle = (
    <a
      key="google"
      href={urlGoogleCalendar(attivita)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => setMenuCalendarioAperto(false)}
      style={stileVoceCalendario}
    >
      Google Calendar
    </a>
  )

  const voceApple = (
    <button
      key="apple"
      type="button"
      onClick={() => {
        esportaAttivitaIcs(attivita)
        setMenuCalendarioAperto(false)
      }}
      style={stileVoceCalendario}
    >
      Apple Calendar / file .ics
    </button>
  )

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
            {formattaData(attivita.data)} · {intervalloOrario}
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
            padding: '11px 12px',
            borderRadius: 9,
            background: '#f8fafc',
            color: '#475569',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            <span>{checklistCompletate}/{totaleChecklist} completate</span>
            {checklistCompletata && (
              <span
                style={{
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: '#dcfce7',
                  color: '#166534',
                  fontSize: 12,
                }}
              >
                Checklist completata
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gap: 7, marginTop: 9 }}>
            {anteprimaChecklist.map((voce) => (
              <div
                key={voce.id}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={voce.completata}
                  readOnly
                  tabIndex={-1}
                  aria-label={`${voce.testo}: ${
                    voce.completata ? 'completata' : 'da completare'
                  }`}
                  style={{ width: 18, height: 18, margin: 0, flex: '0 0 18px' }}
                />
                <span
                  style={{
                    fontSize: 14,
                    lineHeight: 1.3,
                    textDecoration: voce.completata ? 'line-through' : 'none',
                    color: voce.completata ? '#64748b' : '#334155',
                  }}
                >
                  {voce.testo}
                </span>
              </div>
            ))}
          </div>

          {altreVociChecklist > 0 && (
            <div style={{ marginTop: 8, color: '#64748b', fontSize: 13, fontWeight: 700 }}>
              + {altreVociChecklist} altre voci
            </div>
          )}
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
        <div ref={menuCalendarioRef} style={{ position: 'relative' }}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuCalendarioAperto}
            onClick={() => {
              if (dispositivoApple === null) {
                const piattaforma = navigator.userAgent || navigator.platform || ''
                setDispositivoApple(
                  /iPad|iPhone|iPod|Macintosh|Mac OS X/i.test(piattaforma)
                )
              }
              setMenuCalendarioAperto((aperto) => !aperto)
            }}
            style={{ ...buttonSecondary, minHeight: 44, padding: '9px 12px' }}
          >
            Aggiungi al calendario
          </button>

          {menuCalendarioAperto && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                zIndex: 20,
                left: 0,
                bottom: 'calc(100% + 7px)',
                width: 245,
                padding: 6,
                border: '1px solid #cbd5e1',
                borderRadius: 11,
                background: '#fff',
                boxShadow: '0 12px 28px rgba(15,23,42,0.18)',
              }}
            >
              {dispositivoApple ? [voceApple, voceGoogle] : [voceGoogle, voceApple]}
              <a
                href={urlOutlookCalendar(attivita)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuCalendarioAperto(false)}
                style={stileVoceCalendario}
              >
                Outlook Calendar
              </a>
              <button
                type="button"
                onClick={() => {
                  esportaAttivitaIcs(attivita)
                  setMenuCalendarioAperto(false)
                }}
                style={stileVoceCalendario}
              >
                Scarica file .ics
              </button>
            </div>
          )}
        </div>
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
