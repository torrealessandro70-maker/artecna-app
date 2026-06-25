'use client'

import { useState, type ReactNode } from 'react'

export type FascicoloCantiereTab =
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
  numeroFoto?: number
  numeroDocumenti?: number
  numeroRapportini?: number
  numeroSal?: number
  riepilogoEconomia?: string
  numeroOperai?: number
  numeroAttivita?: number
  panoramica?: ReactNode
  foto?: ReactNode
  documenti?: ReactNode
  rapportini?: ReactNode
  economia?: ReactNode
  sal?: ReactNode
  operai?: ReactNode
  ai?: ReactNode
  tabAttiva?: FascicoloCantiereTab
  onTabChange?: (tab: FascicoloCantiereTab) => void
  children?: ReactNode
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
  numeroFoto,
  numeroDocumenti,
  numeroRapportini,
  numeroSal,
  riepilogoEconomia,
  numeroOperai,
  numeroAttivita,
  panoramica,
  foto,
  documenti,
  rapportini,
  economia,
  sal,
  operai,
  ai,
  tabAttiva,
  onTabChange,
  children,
}: FascicoloCantiereContainerProps) {
  const [tabInterna, setTabInterna] =
    useState<FascicoloCantiereTab>('panoramica')
  const tabCorrente = tabAttiva || tabInterna

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
  const cambiaTab = (tab: FascicoloCantiereTab) => {
    setTabInterna(tab)
    onTabChange?.(tab)
  }
  const cards: Array<{
    icon: string
    titolo: string
    numero: string
    descrizione: string
    tab: FascicoloCantiereTab
  }> = [
    {
      icon: '📸',
      titolo: 'Foto',
      numero: formatDashboardValue(numeroFoto),
      descrizione: 'Memoria fotografica del cantiere.',
      tab: 'foto',
    },
    {
      icon: '📄',
      titolo: 'Documenti',
      numero: formatDashboardValue(numeroDocumenti),
      descrizione: 'File, preventivi e allegati collegati.',
      tab: 'documenti',
    },
    {
      icon: '📝',
      titolo: 'Rapportini',
      numero: formatDashboardValue(numeroRapportini),
      descrizione: 'Giornate e lavorazioni registrate.',
      tab: 'rapportini',
    },
    {
      icon: '📊',
      titolo: 'SAL',
      numero: formatDashboardValue(numeroSal),
      descrizione: 'Stato avanzamento lavori.',
      tab: 'sal',
    },
    {
      icon: '💰',
      titolo: 'Economia',
      numero: riepilogoEconomia || '-',
      descrizione: 'Sintesi economica del cantiere.',
      tab: 'economia',
    },
    {
      icon: '👷',
      titolo: 'Operai',
      numero: formatDashboardValue(numeroOperai),
      descrizione: 'Presenze e persone associate.',
      tab: 'operai',
    },
    {
      icon: '📋',
      titolo: 'Attività',
      numero: formatDashboardValue(numeroAttivita),
      descrizione: 'Azioni e promemoria operativi.',
      tab: 'panoramica',
    },
  ]

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

      <section
        aria-label="Panoramica del Cantiere"
        style={{
          display: 'grid',
          gap: 14,
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>Panoramica del Cantiere</h3>
          <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>
            Stato sintetico del Fascicolo e dei suoi contenuti principali.
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          {cards.map((card) => (
            <button
              key={card.titolo}
              type="button"
              onClick={() => cambiaTab(card.tab)}
              style={{
                textAlign: 'left',
                padding: 14,
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                background: '#ffffff',
                cursor: 'pointer',
                minHeight: 132,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 24 }}>{card.icon}</span>
                <strong style={{ fontSize: 22 }}>{card.numero}</strong>
              </div>

              <div style={{ marginTop: 12, fontWeight: 800, color: '#0f172a' }}>
                {card.titolo}
              </div>
              <div style={{ marginTop: 5, color: '#64748b', fontSize: 13 }}>
                {card.descrizione}
              </div>
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          <section
            aria-label="Assistente ARTECNA"
            style={{
              padding: 14,
              border: '1px solid #ddd6fe',
              borderRadius: 8,
              background: '#faf5ff',
            }}
          >
            <h4 style={{ margin: 0 }}>🤖 Assistente ARTECNA</h4>
            <p style={{ margin: '8px 0 0', color: '#64748b' }}>
              Nessuna osservazione disponibile.
            </p>
          </section>

          <section
            aria-label="Ultime attività"
            style={{
              padding: 14,
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              background: '#ffffff',
            }}
          >
            <h4 style={{ margin: 0 }}>Ultime attività</h4>
            <p style={{ margin: '8px 0 0', color: '#64748b' }}>
              Nessuna attività recente.
            </p>
          </section>
        </div>
      </section>

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
          const attiva = tab.id === tabCorrente

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => cambiaTab(tab.id)}
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

      <div>{children || contenuti[tabCorrente] || <p>Nessun contenuto collegato.</p>}</div>
    </section>
  )
}

function formatDashboardValue(value?: number) {
  return typeof value === 'number' ? String(value) : '-'
}
