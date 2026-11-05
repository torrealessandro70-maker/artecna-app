'use client'
import { useState, type ReactNode } from 'react'
import type { PreventivoCantiere } from '../types'
import PreventivoManualeFocus from './PreventivoManualeFocus'

export function preventiviDelSopralluogo(preventivi: readonly PreventivoCantiere[], id: string) {
  return preventivi.filter(p => p.id && p.sopralluogo_id === id)
}

export default function PreventivoSopralluogoFocus({ sopralluogo, preventivi, iniziale, onChiudi, children, formatMoney }: {
  sopralluogo?: { id?: string; cliente?: string }; preventivi: readonly PreventivoCantiere[]; iniziale: ReactNode
  formatMoney?: (value: number) => string; onChiudi: () => void; children: (documento?: PreventivoCantiere) => ReactNode
}) {
  const associati = sopralluogo?.id ? preventiviDelSopralluogo(preventivi, sopralluogo.id) : []
  const [scelta, setScelta] = useState<string | null>(null)
  if (!sopralluogo) return children()
  const documento = associati.length === 1 ? associati[0] : associati.find(p => p.id === scelta)
  return <PreventivoManualeFocus titolo="Preventivo" contesto={sopralluogo.cliente || 'Sopralluogo'} etichettaRitorno="← Torna a Sopralluoghi" onChiudi={onChiudi}>
    <div data-sopralluogo-id={sopralluogo.id} data-preventivo-id={documento?.id}>
      {associati.length === 0 ? iniziale : documento ? <div className="preventivo-sopralluogo-registro">{children(documento)}</div> : <section aria-label="Preventivi del sopralluogo">
        <p>Sono disponibili più preventivi per questo sopralluogo. Scegli quale aprire.</p>
        {associati.map(p => <article key={p.id} style={{ padding: 16, border: '1px solid #cbd5e1', borderRadius: 8, marginBottom: 12 }}>
          <strong>{p.nome_file || p.cantiere}</strong><p>{p.data_preventivo || p.created_at || ''} · {formatMoney?.(p.importo_totale ?? 0)}</p><small style={{ display: 'block', marginBottom: 8 }}>Documento: {p.id}</small>
          <button type="button" style={{ minHeight: 44 }} onClick={() => setScelta(p.id!)}>Apri preventivo</button>
        </article>)}
      </section>}
    </div>
    <style>{`@container preventivo-manuale (max-width: 1100px) {
      .preventivo-sopralluogo-registro > div > div > table td:not([colspan]):nth-child(1)::before { content: 'Cantiere'; }
      .preventivo-sopralluogo-registro > div > div > table td:not([colspan]):nth-child(2)::before { content: 'Nome file'; }
      .preventivo-sopralluogo-registro > div > div > table td:not([colspan]):nth-child(3)::before { content: 'Importo'; }
      .preventivo-sopralluogo-registro > div > div > table td:not([colspan]):nth-child(4)::before { content: 'Note'; }
      .preventivo-sopralluogo-registro > div > div > table td:not([colspan]):nth-child(5)::before { content: 'Azioni'; }
    }`}</style>
  </PreventivoManualeFocus>
}
