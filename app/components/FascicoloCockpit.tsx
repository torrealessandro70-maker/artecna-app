'use client'

import React from 'react'
import { artecnaTheme } from '../design/artecna-theme'
import { createCockpitFromRuntime } from '../adapters/runtime-cockpit-adapter'
import { RuntimeFeedPanel, RuntimeSummaryCard, StatusCard } from './ui'

const theme = artecnaTheme.dark

type FascicoloCockpitProps = {
  cantiereName?: string
  subtitle?: string
  focus?: string
}

export default function FascicoloCockpit({
  cantiereName,
  subtitle,
  focus,
}: FascicoloCockpitProps) {

const cockpitSnapshot = createCockpitFromRuntime({
  cantiereName,
  subtitle,
  focus,
})

  return (
    <section
      aria-label="ARTECNA Cockpit"
      style={{
        marginTop: 18,
        padding: 18,
        borderRadius: 24,
        background:
          'radial-gradient(circle at top left, #0f766e 0, #020617 34%, #020617 100%)',
        color: theme.text,
        border: '1px solid rgba(148, 163, 184, 0.28)',
        boxShadow: theme.shadow.cockpit,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'flex-start',
          marginBottom: 18,
        }}
      >
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>
            {cockpitSnapshot.cantiereName}
          </div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
            {cockpitSnapshot.subtitle}
          </div>
        </div>

        <div
          style={{
            padding: '8px 12px',
            borderRadius: 999,
            background: 'rgba(15, 23, 42, 0.72)',
            border: '1px solid rgba(148, 163, 184, 0.24)',
            color: '#bbf7d0',
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
        >
          ● Online
        </div>
      </div>
<RuntimeSummaryCard
  observed={cockpitSnapshot.observed}
  understood={cockpitSnapshot.understood}
  attention={cockpitSnapshot.attention}
  proposed={cockpitSnapshot.proposed}
/>   
<div
  style={{
    marginTop: 16,
    marginBottom: 16,
    padding: 18,
    borderRadius: 20,
    background: 'rgba(15, 23, 42, 0.76)',
    border: '1px solid rgba(34, 197, 94, 0.28)',
  }}
>
  <div style={{ color: '#86efac', fontSize: 12, fontWeight: 900 }}>
    🟢 SITUAZIONE DEL CANTIERE
  </div>

  <div style={{ fontSize: 22, fontWeight: 900, marginTop: 8 }}>
    {cockpitSnapshot.cockpitSummary.title}
  </div>

  <p style={{ color: '#cbd5e1', marginTop: 8 }}>
    {cockpitSnapshot.cockpitSummary.situation}
  </p>

  <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 10 }}>
    Prossima azione: {cockpitSnapshot.cockpitSummary.nextAction}
  </div>
</div>
   {/* MAIN GRID */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.25fr) minmax(220px, 0.75fr)',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            minHeight: 250,
            padding: 22,
            borderRadius: 22,
            background:
              'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(8, 47, 73, 0.62))',
            border: '1px solid rgba(125, 211, 252, 0.18)',
            boxShadow: 'inset 0 0 40px rgba(14, 165, 233, 0.08)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: -40,
              top: -30,
              width: 210,
              height: 210,
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.13)',
              filter: 'blur(2px)',
            }}
          />

          <div style={{ color: '#86efac', fontSize: 12, fontWeight: 900 }}>
            ● STATO CANTIERE
          </div>

          <div
            style={{
              fontSize: 46,
              lineHeight: 1,
              fontWeight: 950,
              marginTop: 18,
              letterSpacing: -1.5,
            }}
          >
            {cockpitSnapshot.status}
          </div>

          <div
            style={{
              width: 150,
              height: 4,
              borderRadius: 999,
              background: '#22c55e',
              marginTop: 20,
              boxShadow: '0 0 24px rgba(34, 197, 94, 0.85)',
            }}
          />

          <p
            style={{
              maxWidth: 480,
              color: '#cbd5e1',
              fontSize: 18,
              lineHeight: 1.45,
              marginTop: 22,
              marginBottom: 0,
            }}
          >
            Manca solo la documentazione iniziale della cucina prima di
            procedere con il cartongesso.
          </p>

          <button
            type="button"
            style={{
              marginTop: 26,
              padding: '14px 20px',
              borderRadius: 14,
              border: '1px solid rgba(187, 247, 208, 0.42)',
              background: 'linear-gradient(135deg, #16a34a, #22c55e)',
              color: 'white',
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 14px 35px rgba(34, 197, 94, 0.32)',
            }}
          >
            📷 APRI FOTOCAMERA →
          </button>
        </div>

        {/* SIDE CARDS */}
        <div style={{ display: 'grid', gap: 12 }}>
         <StatusCard
  icon="🎯"
  title="Focus"
  value={cockpitSnapshot.focus}
  detail="Priorità operativa"
  accent="#60a5fa"
/>

          <StatusCard
            icon="⚠"
            title="Attenzione"
            value="3"
            detail="Elementi aperti"
            accent="#f59e0b"
          />
        </div>
      </div>

      {/* BOTTOM CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <StatusCard
          icon="🤖"
          title="ARTECNA"
          value="3"
          detail="Suggerimenti pronti"
          accent="#a855f7"
        />

        <StatusCard
          icon="📖"
          title="Oggi"
          value="4"
          detail="Eventi rilevati"
          accent="#06b6d4"
        />

        <StatusCard
          icon="▶"
          title="Prossima azione"
          value="Foto cucina"
          detail="Tempo stimato 2 min"
          accent="#22c55e"
        />
      </div>

         <div
        style={{
          padding: 16,
          borderRadius: 20,
          background: 'rgba(15, 23, 42, 0.72)',
          border: '1px solid rgba(148, 163, 184, 0.18)',
        }}
      >
        <RuntimeFeedPanel items={cockpitSnapshot.feed} />
       </div>
    </section>
  )
}
