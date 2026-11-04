'use client'

import type { ProgressoStimeDocumento } from '../engines/price-resolution/stima-documento-ai'

export type StatoProgressoOperazione = {
  stato: 'in_corso' | 'completata' | 'errore'
  testo: string
  completati?: number
  totale?: number
}

export type ProgressoGenerazioneDocumento = ProgressoStimeDocumento | { fase: 'errore'; messaggio: string }

export function progressoPrezziDocumento(p: ProgressoGenerazioneDocumento): StatoProgressoOperazione {
  if (p.fase === 'errore') return { stato: 'errore', testo: p.messaggio }
  return {
    stato: 'in_corso',
    testo: p.fase === 'analisi'
      ? 'Analisi prezzi — ' + (p.in_corso ?? p.completati) + ' di ' + p.totale
      : p.fase === 'aggregazione' ? 'Validazione tecnica e preparazione bozza' : 'Preparazione bozza',
    ...(p.fase === 'analisi' && p.totale > 0 ? { completati: p.completati, totale: p.totale } : {}),
  }
}

export default function ProgressoOperazione({ progresso }: { progresso: StatoProgressoOperazione | null | undefined }) {
  if (!progresso) return null
  const inCorso = progresso.stato === 'in_corso'
  const determinato = typeof progresso.completati === 'number' && typeof progresso.totale === 'number' && progresso.totale > 0
  const percentuale = progresso.stato === 'completata' ? 100 : determinato
    ? Math.max(0, Math.min(100, 100 * progresso.completati! / progresso.totale!)) : undefined
  const colore = progresso.stato === 'errore' ? '#b91c1c' : progresso.stato === 'completata' ? '#15803d' : '#2563eb'
  return <div style={{ width: '100%', minWidth: 0, margin: '12px 0', overflowWrap: 'anywhere' }}>
    <p role={progresso.stato === 'errore' ? 'alert' : 'status'} aria-live="polite" style={{ margin: '0 0 8px', color: colore, fontWeight: 700 }}>{progresso.testo}</p>
    <div className={inCorso ? 'artecna-progresso-attivo' : undefined} role="progressbar" aria-label={progresso.testo} aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={percentuale} aria-busy={inCorso}
      style={{ width: '100%', height: 8, overflow: 'hidden', borderRadius: 8, background: '#e2e8f0' }}>
      <div className={inCorso && percentuale === undefined ? 'artecna-progresso-indeterminato' : undefined}
        style={{ height: '100%', background: colore, borderRadius: 8, width: percentuale === undefined ? inCorso ? '35%' : '100%' : percentuale + '%', transition: 'width 180ms ease' }} />
    </div>
    {inCorso && <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 13 }}>Elaborazione in corso — potrebbe richiedere qualche minuto</p>}
    <style>{`@keyframes artecna-progresso { from { transform: translateX(-100%); } to { transform: translateX(300%); } }
      @keyframes artecna-progresso-attivo { from { background-color: #e2e8f0; } to { background-color: #bfdbfe; } }
      .artecna-progresso-attivo { animation: artecna-progresso-attivo 1.6s ease-in-out infinite alternate; }
      .artecna-progresso-indeterminato { animation: artecna-progresso 1.6s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) { .artecna-progresso-attivo, .artecna-progresso-indeterminato { animation: none; } }`}</style>
  </div>
}
