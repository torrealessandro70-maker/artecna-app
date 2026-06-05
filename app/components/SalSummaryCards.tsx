'use client'

import StatCard from './StatCard'

type Props = {
  totalePrevistoSal: number
  totaleMaturatoSal: number
  totaleAccontiSal: number
  daRichiedereSal: number
  statoSal: string
  percentualeGlobaleSal: number
  formatMoney: (value: number) => string
}

export default function SalSummaryCards({
  totalePrevistoSal,
  totaleMaturatoSal,
  totaleAccontiSal,
  daRichiedereSal,
  statoSal,
  percentualeGlobaleSal,
  formatMoney,
}: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
        marginBottom: 18,
      }}
    >
      <StatCard
        title="Totale lavori inseriti"
        value={formatMoney(totalePrevistoSal)}
      />

      <StatCard
        title="SAL maturato"
        value={formatMoney(totaleMaturatoSal)}
        style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
        }}
      />

      <StatCard
        title="Acconti ricevuti"
        value={formatMoney(totaleAccontiSal)}
      />

      <StatCard
        title="Da richiedere"
        value={formatMoney(daRichiedereSal)}
        style={{
          background: daRichiedereSal > 0 ? '#fef2f2' : '#f0fdf4',
        }}
      />

      <StatCard
        title="Stato SAL"
        value={
          <>
            {statoSal === 'urgente' && '🚨 SAL urgente'}
            {statoSal === 'da_richiedere' && '⚠️ SAL da richiedere'}
            {statoSal === 'coperto' && '✅ SAL coperto'}
          </>
        }
        style={{
          background:
            statoSal === 'urgente'
              ? '#fee2e2'
              : statoSal === 'da_richiedere'
              ? '#fef3c7'
              : '#f0fdf4',
        }}
      />

      <div
        style={{
          padding: 14,
          borderRadius: 10,
          background: '#fff',
          border: '1px solid #ddd',
        }}
      >
        <div style={{ color: '#666', marginBottom: 6 }}>
          📈 Avanzamento globale
        </div>

        <strong style={{ fontSize: 22 }}>
          {percentualeGlobaleSal.toFixed(1)}%
        </strong>

        <div
          style={{
            marginTop: 10,
            height: 12,
            background: '#e5e7eb',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(percentualeGlobaleSal, 100)}%`,
              height: '100%',
              background:
                percentualeGlobaleSal < 30
                  ? '#dc2626'
                  : percentualeGlobaleSal < 70
                  ? '#f59e0b'
                  : '#16a34a',
            }}
          />
        </div>
      </div>
    </div>
  )
}