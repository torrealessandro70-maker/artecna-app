'use client'
import { useMemo, useState } from 'react'
import type { PriceKnowledgeItem } from '../engines/price-resolution/types'
import { cercaRiferimenti, voceDaRiferimento } from '../engines/preventivo-generation/manuale'

type Props = { prezzi: readonly PriceKnowledgeItem[]; memoria: readonly PriceKnowledgeItem[]; storico: readonly PriceKnowledgeItem[]
  aggiungi: (voce: ReturnType<typeof voceDaRiferimento>) => void }
export default function RicercaPrezziPreventivo({ prezzi, memoria, storico, aggiungi }: Props) {
  const [query, setQuery] = useState('')
  const risultati = useMemo(() => cercaRiferimenti(query, [...prezzi, ...memoria, ...storico]), [query, prezzi, memoria, storico])
  return <section aria-label="Ricerca prezzi manuale">
    <label>Cerca nel prezzario o nella memoria prezzi… <input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>
    {query && <p>{risultati.length} risultati; mostrati i primi 50. Il prezzo inserito segue le priorità del Price Engine esistente.</p>}
    <ul>{risultati.slice(0, 50).map((r, i) => <li key={`${r.id || r.codice || ''}:${i}`}>
      {r.codice} — {r.descrizione} — {r.unita_misura} — {Number(r.prezzo_unitario).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} — {r.fonte || r.tipo_prezzo || 'Prezzario'}
      <button type="button" onClick={() => aggiungi(voceDaRiferimento(r, prezzi, memoria, storico))}>+ Aggiungi</button>
    </li>)}</ul>
  </section>
}
