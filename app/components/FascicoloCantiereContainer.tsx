'use client'
import RuntimeInspector from './RuntimeInspector'
import { useState, type ReactNode } from 'react'
import FascicoloCockpit from './FascicoloCockpit'


import {
  createDocumentRuntimeFeed,
  createPhotoRuntimeFeed,
  createReportRuntimeFeed,
  createRuntimeFeedSnapshot,
  createSalRuntimeFeed,
} from '../runtime/feed'


import {
  buildTimelineEvents,
  type TimelineEvent as EventEngineTimelineEvent,
} from '../engines/event'
import { buildConstructionContext } from '../engines/context'
import { buildDecisionsFromContextSuggestions } from '../engines/decision'
import { runActionEngineSmokeTest } from '../engines/action'
import {
  buildPhotoWorkflow,
  runWorkflowEngineSmokeTest,
} from '../engines/workflow'

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
  cantiere?: {
    id?: string | number | null
    nome?: string | null
  }
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
  eventiTimeline?: TimelineEvent[]
  fotoCantiere?: TimelineFoto[]
  rapportiniCantiere?: TimelineRapportino[]
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

type TimelineEvent = EventEngineTimelineEvent

type TimelineFoto = {
  id?: string
  cantiere?: string
  nota?: string
  data_foto?: string
  created_at?: string
}

type TimelineRapportino = {
  id?: string
  cantiere?: string
  data?: string
  note?: string
  created_at?: string
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
  cantiere,
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
  eventiTimeline: _eventiTimeline = [],
  fotoCantiere = [],
  rapportiniCantiere = [],
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
  const [actionSmokeTestResult, setActionSmokeTestResult] = useState<Awaited<
    ReturnType<typeof runActionEngineSmokeTest>
  > | null>(null)
  const [workflowSmokeTestResult, setWorkflowSmokeTestResult] = useState<
    ReturnType<typeof runWorkflowEngineSmokeTest> | null
  >(null)
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
  const timelineEvents = buildTimelineEvents({
    photos: fotoCantiere,
    dailyReports: rapportiniCantiere,
  })
  const context = buildConstructionContext({
    cantiereId: String(cantiere?.id ?? ''),
    timeline: timelineEvents,
  })
  const decisionPlan = buildDecisionsFromContextSuggestions(context.suggestions)
  const eventiOggi = context.timeline.filter(
    (evento) => gruppoDaData(evento.date) === 'oggi'
  )
  const eventiRecenti = context.timeline.filter(
    (evento) => gruppoDaData(evento.date) !== 'oggi'
  )
  const contextCards = [
    {
      label: 'Ultima attivita',
      value: context.lastActivity?.title || 'Nessuna attivita recente',
    },
    { label: 'Foto', value: String(context.statistics.photos) },
    { label: 'Rapportini', value: String(context.statistics.reports) },
    { label: 'Documenti', value: String(context.statistics.documents) },
    { label: 'SAL', value: String(context.statistics.sal) },
    { label: 'Operai', value: String(context.statistics.workers) },
  ]
  const contextLastUpdated = formatContextDate(context.lastUpdated)
  const mostraDevSmokeTest = process.env.NODE_ENV === 'development'
  const photoWorkflowInput = {
    type: 'photo' as const,
    cantiereId: cantiere?.id == null ? undefined : String(cantiere.id),
    cantiereName: cantiere?.nome,
    photoCount: context.statistics.photos,
    lastActivityTitle: context.lastActivity?.title,
  }
  const photoWorkflowPreview = mostraDevSmokeTest
    ? buildPhotoWorkflow(photoWorkflowInput)
    : null

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

<FascicoloCockpit
  cantiereName={cantiere?.nome || nomeCantiere}
  subtitle={cliente ? `Cliente: ${cliente}` : 'Fascicolo di Cantiere · ARTECNA OS'}
  focus={statoLavori || 'Stato lavori da aggiornare'}
 feed={createRuntimeFeedSnapshot([
  ...createPhotoRuntimeFeed(fotoCantiere),
  ...createReportRuntimeFeed(rapportiniCantiere),
  ...createDocumentRuntimeFeed({
    count: numeroDocumenti,
    cantiere: cantiere?.nome || nomeCantiere,
    updatedAt: ultimoAggiornamento,
  }),
  ...createSalRuntimeFeed({
    count: numeroSal,
    cantiere: cantiere?.nome || nomeCantiere,
    updatedAt: ultimoAggiornamento,
  }),
])}
/>
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

      <section
        aria-label="Timeline del Cantiere"
        style={{
          padding: 14,
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          background: '#ffffff',
        }}
      >
        <h3 style={{ margin: 0 }}>Timeline del Cantiere</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 12,
            marginTop: 12,
          }}
        >
          <TimelineGroup titolo="Oggi" eventi={eventiOggi} />
          <TimelineGroup titolo="Recenti" eventi={eventiRecenti} />
        </div>
      </section>

      <section
        aria-label="Situazione del cantiere"
        style={{
          padding: 14,
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          background: '#ffffff',
        }}
      >
        <h3 style={{ margin: 0 }}>🧠 Situazione del cantiere</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 10,
            marginTop: 12,
          }}
        >
          {contextCards.map((card) => (
            <article
              key={card.label}
              style={{
                padding: 12,
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                background: '#f8fafc',
                minHeight: 74,
              }}
            >
              <div
                style={{
                  color: '#64748b',
                  fontSize: 12,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                }}
              >
                {card.label}
              </div>
              <div style={{ marginTop: 6, color: '#0f172a', fontWeight: 800 }}>
                {card.value}
              </div>
            </article>
          ))}

          <article
            style={{
              padding: 12,
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              background: '#f8fafc',
              minHeight: 74,
            }}
          >
            <div
              style={{
                color: '#64748b',
                fontSize: 12,
                fontWeight: 800,
                textTransform: 'uppercase',
              }}
            >
              Ultimo aggiornamento
            </div>
            <div
              suppressHydrationWarning
              style={{ marginTop: 6, color: '#0f172a', fontWeight: 800 }}
            >
              {contextLastUpdated}
            </div>
          </article>
        </div>

        <section
          aria-label="Avvisi"
          style={{
            marginTop: 12,
            padding: 12,
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            background: '#f8fafc',
          }}
        >
          <h4 style={{ margin: 0 }}>Avvisi</h4>
          {context.alerts.length > 0 ? (
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {context.alerts.map((alert) => (
                <article
                  key={alert.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr',
                    gap: 8,
                    padding: 10,
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    background: '#ffffff',
                  }}
                >
                  <div style={{ fontSize: 18, lineHeight: '22px' }}>
                    {alertSeverityIcon(alert.severity)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>
                      {alert.title}
                    </div>
                    {alert.description && (
                      <div
                        style={{ color: '#64748b', fontSize: 13, marginTop: 3 }}
                      >
                        {alert.description}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p style={{ margin: '8px 0 0', color: '#64748b' }}>
              Nessun avviso.
            </p>
          )}
        </section>

        <section
          aria-label="Suggerimenti"
          style={{
            marginTop: 12,
            padding: 12,
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            background: '#f8fafc',
          }}
        >
          <h4 style={{ margin: 0 }}>Suggerimenti</h4>
          {context.suggestions.length > 0 ? (
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {context.suggestions.map((suggestion) => (
                <article
                  key={suggestion.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr',
                    gap: 8,
                    padding: 10,
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    background: '#ffffff',
                  }}
                >
                  <div style={{ fontSize: 18, lineHeight: '22px' }}>💡</div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>
                      {suggestion.title}
                    </div>
                    {suggestion.description && (
                      <div
                        style={{ color: '#64748b', fontSize: 13, marginTop: 3 }}
                      >
                        {suggestion.description}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p style={{ margin: '8px 0 0', color: '#64748b' }}>
              Nessun suggerimento.
            </p>
          )}
        </section>

        <section
          aria-label="Azioni suggerite"
          style={{
            marginTop: 12,
            padding: 12,
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            background: '#f8fafc',
          }}
        >
          <h4 style={{ margin: 0 }}>Azioni suggerite</h4>
          {decisionPlan.proposals.length > 0 ? (
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {decisionPlan.proposals.map((proposal) => (
                <article
                  key={proposal.id}
                  style={{
                    padding: 10,
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    background: '#ffffff',
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>
                    {proposal.title}
                  </div>
                  {proposal.description && (
                    <div
                      style={{ color: '#64748b', fontSize: 13, marginTop: 3 }}
                    >
                      {proposal.description}
                    </div>
                  )}
                  <div
                    style={{
                      color: '#64748b',
                      fontSize: 12,
                      fontWeight: 800,
                      marginTop: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    {decisionStatusLabel(proposal.status)}
                  </div>
                  {proposal.action?.label && (
                    <div
                      style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}
                    >
                      Azione futura: {proposal.action.label}
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p style={{ margin: '8px 0 0', color: '#64748b' }}>
              Nessuna azione suggerita.
            </p>
          )}
        </section>

        {mostraDevSmokeTest && (
          <section
            aria-label="Dev Engine smoke tests"
            style={{
              marginTop: 12,
              padding: 12,
              border: '1px dashed #cbd5e1',
              borderRadius: 8,
              background: '#ffffff',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={async () => {
                  const result = await runActionEngineSmokeTest()
                  setActionSmokeTestResult(result)
                }}
                style={{
                  padding: '8px 10px',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  background: '#f8fafc',
                  color: '#0f172a',
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                Dev: test Action Engine
              </button>

              <button
                type="button"
                onClick={() => {
                  const result = runWorkflowEngineSmokeTest()
                  setWorkflowSmokeTestResult(result)
                }}
                style={{
                  padding: '8px 10px',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  background: '#f8fafc',
                  color: '#0f172a',
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                Dev: test Workflow Engine
              </button>
            </div>

            {photoWorkflowPreview && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  background: '#f8fafc',
                  color: '#334155',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 800 }}>
                  Dev: Photo Workflow Preview
                </div>
<div
  style={{
    marginTop: 6,
    color: '#64748b',
    fontSize: 13,
    fontWeight: 700,
  }}
>
  Stato workflow: {photoWorkflowPreview.state}
</div>
                <dl
                  style={{
                    display: 'grid',
                    gap: 6,
                    margin: '8px 0 0',
                  }}
                >
                  <div>
                    <dt style={{ color: '#64748b' }}>Cantiere</dt>
                    <dd style={{ margin: 0, fontWeight: 700 }}>
                      {cantiere?.nome || nomeCantiere || '-'}
                    </dd>
                  </div>
                  <div>
                    <dt style={{ color: '#64748b' }}>Foto nel contesto</dt>
                    <dd style={{ margin: 0, fontWeight: 700 }}>
                      {context.statistics.photos}
                    </dd>
                  </div>
                  <div>
                    <dt style={{ color: '#64748b' }}>Ultima attività</dt>
                    <dd style={{ margin: 0, fontWeight: 700 }}>
                      {context.lastActivity?.title || '-'}
                    </dd>
                  </div>
                </dl>
              <ol
  style={{
    display: 'grid',
    gap: 8,
    margin: '10px 0 0',
    paddingLeft: 20,
  }}
>
  {photoWorkflowPreview.steps.map((step) => (
    <li key={step.id}>
      <div style={{ fontWeight: 700 }}>{step.title}</div>
      {step.description && (
        <div style={{ color: '#64748b', marginTop: 2 }}>
          {step.description}
        </div>
      )}
    </li>
  ))}
</ol>

<div
  style={{
    marginTop: 14,
    padding: 10,
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    background: '#ffffff',
  }}
>
  <div style={{ fontWeight: 800, marginBottom: 8 }}>Pipeline</div>

  {photoWorkflowPreview.pipeline ? (
    <div style={{ display: 'grid', gap: 6 }}>
      <div>
        🟡 Event Engine:{' '}
        {photoWorkflowPreview.pipeline.event?.status ?? 'non disponibile'}
      </div>
      <div>
        🟡 Context Engine:{' '}
        {photoWorkflowPreview.pipeline.context?.status ?? 'non disponibile'}
      </div>
      <div>
        🟡 Decision Engine:{' '}
        {photoWorkflowPreview.pipeline.decision?.status ?? 'non disponibile'}
      </div>
      <div>
        🟡 Action Engine:{' '}
        {photoWorkflowPreview.pipeline.action?.status ?? 'non disponibile'}
      </div>
    </div>
  ) : (
    <div style={{ color: '#64748b' }}>Pipeline non disponibile</div>
  )}
</div>

<div
  style={{
    marginTop: 14,
    padding: 10,
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    background: '#ffffff',
  }}
>
  <div
    style={{
      fontWeight: 800,
      marginBottom: 8,
    }}
  >
    Pipeline
  </div>

  {photoWorkflowPreview.pipeline ? (
    <div
      style={{
        display: 'grid',
        gap: 6,
      }}
    >
      <div>
        🟡 Event Engine:{' '}
        {photoWorkflowPreview.pipeline.event?.status ?? 'non disponibile'}
      </div>

      <div>
        🟡 Context Engine:{' '}
        {photoWorkflowPreview.pipeline.context?.status ?? 'non disponibile'}
      </div>

      <div>
        🟡 Decision Engine:{' '}
        {photoWorkflowPreview.pipeline.decision?.status ?? 'non disponibile'}
      </div>

      <div>
        🟡 Action Engine:{' '}
        {photoWorkflowPreview.pipeline.action?.status ?? 'non disponibile'}
      </div>
    </div>
  ) : (
    <div style={{ color: '#64748b' }}>
      Pipeline non disponibile
    </div>
  )}
</div>
              </div>
            )}

            {actionSmokeTestResult && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  background: '#f8fafc',
                  color: '#334155',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 800 }}>
                  success generale:{' '}
                  {actionSmokeTestResult.success ? 'true' : 'false'}
                </div>
                <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                  {actionSmokeTestResult.checks.map((check) => (
                    <div key={check.name}>
                      <div>
                        {check.name}: {check.passed ? 'passed' : 'failed'}
                      </div>
                      {check.reason && (
                        <div style={{ color: '#64748b', marginTop: 2 }}>
                          reason: {check.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

                    {workflowSmokeTestResult && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  background: '#f8fafc',
                  color: '#334155',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 800 }}>
                  Workflow Engine success generale:{' '}
                  {workflowSmokeTestResult.success ? 'true' : 'false'}
                </div>
                <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                  {workflowSmokeTestResult.checks.map((check) => (
                    <div key={check.name}>
                      <div>
                        {check.name}: {check.passed ? 'passed' : 'failed'}
                      </div>
                      {check.reason && (
                        <div style={{ color: '#64748b', marginTop: 2 }}>
                          reason: {check.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <RuntimeInspector />
          </section>
        )}
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

function TimelineGroup({
  titolo,
  eventi,
}: {
  titolo: string
  eventi: TimelineEvent[]
}) {
  return (
    <section>
      <div
        style={{
          color: '#475569',
          fontSize: 12,
          fontWeight: 800,
          marginBottom: 8,
          textTransform: 'uppercase',
        }}
      >
        {titolo}
      </div>

      {eventi.length > 0 ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {eventi.map((evento, indice) => (
            <TimelineEvent key={`${evento.title}-${indice}`} evento={evento} />
          ))}
        </div>
      ) : (
        <TimelinePlaceholder />
      )}
    </section>
  )
}

function TimelineEvent({ evento }: { evento: TimelineEvent }) {
  return (
    <article
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr',
        gap: 10,
        padding: 10,
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        background: '#f8fafc',
      }}
    >
      <div style={{ fontSize: 20, lineHeight: '24px' }}>
        {evento.icon}
      </div>
      <div>
        <div style={{ fontWeight: 800, color: '#0f172a' }}>
          {evento.title}
        </div>
        <div style={{ color: '#64748b', fontSize: 13, marginTop: 3 }}>
          {evento.description}
        </div>
        {evento.date && (
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
            {evento.date}
          </div>
        )}
      </div>
    </article>
  )
}

function TimelinePlaceholder() {
  return (
    <article
      style={{
        padding: 10,
        border: '1px dashed #cbd5e1',
        borderRadius: 8,
        background: '#f8fafc',
        color: '#64748b',
      }}
    >
      <strong style={{ display: 'block', color: '#475569' }}>
        Nessun evento recente disponibile.
      </strong>
      <span style={{ display: 'block', marginTop: 4 }}>
        Qui compariranno foto, rapportini, documenti, SAL e decisioni AI del
        cantiere.
      </span>
    </article>
  )
}

function gruppoDaData(dataOra?: string): 'oggi' | 'recenti' {
  const dataEvento = String(dataOra || '').slice(0, 10)
  const oggi = new Date().toISOString().slice(0, 10)

  return dataEvento === oggi ? 'oggi' : 'recenti'
}

function formatContextDate(date: Date) {
  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function alertSeverityIcon(severity: string) {
  if (severity === 'warning') return '⚠️'
  if (severity === 'error' || severity === 'critical') return '🔴'

  return 'ℹ️'
}

function decisionStatusLabel(status: string) {
  if (status === 'accepted') return 'Accettata'
  if (status === 'rejected') return 'Rifiutata'
  if (status === 'executed') return 'Eseguita'

  return 'Proposta'
}

