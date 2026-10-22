'use client'

type Props = {
  statistics: { resolved: number; review: number; unresolved: number; modified: number }
}

export default function PriceResolutionSummary({ statistics }: Props) {
  const voci = [
    ['Risolte automaticamente', statistics.resolved],
    ['Da verificare', statistics.review],
    ['Non risolte', statistics.unresolved],
    ['Modificate dopo la risoluzione', statistics.modified],
  ] as const
  return <section aria-label="Esiti risoluzione prezzi" style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, background: '#fff' }}>
    <h3 style={{ marginTop: 0 }}>Esiti risoluzione prezzi</h3>
    <p>Esiti associati alle voci, non una traccia delle fonti consultate.</p>
    <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
      {voci.map(([etichetta, numero]) => <div key={etichetta} style={{ display: 'contents' }}>
        <dt>{etichetta}</dt><dd style={{ margin: 0, fontWeight: 700 }}>{numero}</dd>
      </div>)}
    </dl>
    <strong>Totale lavorazioni: {voci.reduce((totale, [, numero]) => totale + numero, 0)}</strong>
  </section>
}
