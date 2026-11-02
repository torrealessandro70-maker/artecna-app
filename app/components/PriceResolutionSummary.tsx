'use client'
import type { riepilogoPrezziDocumento } from '../engines/price-resolution/proposte-documento'

type Props = {
  statistics: { resolved: number; review: number; unresolved: number; modified: number }
  bozza?: ReturnType<typeof riepilogoPrezziDocumento>
}

export default function PriceResolutionSummary({ statistics, bozza }: Props) {
  const voci = bozza ? [
    ['Prezzi affidabili', bozza.prezzo_affidabile],
    ['Prezzi proposti', bozza.prezzo_proposto],
    ['Prezzi non determinati', bozza.prezzo_non_determinabile],
    ['Modificati dall’utente', bozza.modificato_utente],
  ] as const : [
    ['Risolte automaticamente', statistics.resolved],
    ['Da verificare', statistics.review],
    ['Non risolte', statistics.unresolved],
    ['Modificate dopo la risoluzione', statistics.modified],
  ] as const
  return <section aria-label="Esiti risoluzione prezzi" style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, background: '#fff' }}>
    <h3 style={{ marginTop: 0 }}>{bozza ? 'Stato prezzi della bozza' : 'Esiti risoluzione prezzi'}</h3>
    <p>{bozza ? 'Le proposte concorrono al subtotale della bozza, ma non sono prezzi affidabili. Controlla prima di salvare o generare il definitivo.' : 'Esiti associati alle voci, non una traccia delle fonti consultate.'}</p>
    <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
      {voci.map(([etichetta, numero]) => <div key={etichetta} style={{ display: 'contents' }}>
        <dt>{etichetta}</dt><dd style={{ margin: 0, fontWeight: 700 }}>{numero}</dd>
      </div>)}
    </dl>
    <strong>Totale lavorazioni: {voci.reduce((totale, [, numero]) => totale + numero, 0)}</strong>
  </section>
}
