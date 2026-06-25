'use client'

import { useState, type ReactNode } from 'react'

type FascicoloCantiereTab =
  | 'panoramica'
  | 'foto'
  | 'documenti'
  | 'rapportini'
  | 'economia'
  | 'sal'
  | 'operai'
  | 'ai'

type FascicoloCantiereContainerProps = {
  nomeCantiere: string
  cliente?: string
  statoLavori?: string
  ultimoAggiornamento?: string
  panoramica?: ReactNode
  foto?: ReactNode
  documenti?: ReactNode
  rapportini?: ReactNode
  economia?: ReactNode
  sal?: ReactNode
  operai?: ReactNode
  ai?: ReactNode
}

const tabs: Array<{ id: FascicoloCantiereTab; label: string }> = [
  { id: 'panoramica', label: '📋 Panoramica' },
  { id: 'foto', label: '📸 Foto' },
  { id: 'documenti', label: '📄 Documenti' },
  { id: 'rapportini', label: '📝 Rapportini' },
  { id: 'economia', label: '💰 Economia' },
  { id: 'sal', label: '📊 SAL' },
  { id: 'operai', label: '👷 Operai' },
  { id: 'ai', label: '🤖 AI' },
]

export default function FascicoloCantiereContainer({
  nomeCantiere,
  cliente,
  statoLavori,
  ultimoAggiornamento,
  panoramica,
  foto,
  documenti,
  rapportini,
  economia,
  sal,
  operai,
  ai,
}: FascicoloCantiereContainerProps) {
  const [tabAttiva, setTabAttiva] =
    useState<FascicoloCantiereTab>('panoramica')

  const contenuti: Record<FascicoloCantiereTab, ReactNode> = {
    panoramica,
    foto,
    documenti,
    rapportini,
    economia,
    sal,
    operai,
    ai,
  }

  return (
    <section
      aria-label={`Fascicolo cantiere ${nomeCantiere || ''}`}
      style={{
        display: 'grid',
        gap: 16,
      }}
    >
      <header
        style={{
          padding: 16,
          border: '1px solid #d1d5db',
          borderRadius: 10,
          background: '#ffffff',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                color: '#64748b',
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Fascicolo Cantiere
            </div>

            <h2 style={{ margin: 0 }}>{nomeCantiere || 'Cantiere'}</h2>

            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                marginTop: 10,
                color: '#475569',
                fontSize: 14,
              }}
            >
              <span>Cliente: {cliente || '-'}</span>
              <span>Stato lavori: {statoLavori || '-'}</span>
              <span>Ultimo aggiornamento: {ultimoAggiornamento || '-'}</span>
            </div>
          </div>

          <div
            style={{
              minWidth: 220,
              padding: 12,
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              background: '#f8fafc',
              color: '#475569',
            }}
          >
            <strong>🤖 Area AI</strong>
            <div style={{ marginTop: 6, fontSize: 13 }}>
              Suggerimenti contestuali in preparazione.
            </div>
          </div>
        </div>
      </header>

      <nav
        aria-label="Sezioni Fascicolo Cantiere"
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: 8,
        }}
      >
        {tabs.map((tab) => {
          const attiva = tab.id === tabAttiva

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTabAttiva(tab.id)}
              style={{
                padding: '9px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                background: attiva ? '#0f172a' : '#ffffff',
                color: attiva ? '#ffffff' : '#0f172a',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>

      <div>{contenuti[tabAttiva] || <p>Nessun contenuto collegato.</p>}</div>
    </section>
  )
}
