'use client'

import type { CSSProperties } from 'react'
import { useCostiFornitori } from './CostiFornitoriRettificati'
import { deltaRettifiche, rettificheCompatibiliConBase, type ClientNoteCredito } from '../engines/fatture/note-credito'
import { calcolaGestione } from '../engines/economia/contrattiAggiornati'

type Props = {
  materialiBaseIds: string[]
  cantieriCommerciali?: readonly string[]
  parziale?: number | null
  nonDeterminabili?: number | null
  daClassificare?: number | null
  client: ClientNoteCredito
  cardStyle: CSSProperties
  totalePreventiviImpresa: number | null
  totaleCostiImpresa: number | null
  statoContratti: string
  formatMoney: (value: number) => string
}

export default function HomeEconomiaGeneraleCard({
  client,
  materialiBaseIds,
  cantieriCommerciali,
  parziale,
  nonDeterminabili,
  daClassificare,
  cardStyle,
  totalePreventiviImpresa,
  totaleCostiImpresa,
  statoContratti,
  formatMoney,
}: Props) {
  const rettifiche = useCostiFornitori(client)
  // Questa scheda legacy comprende i materiali Cantiere, non le quote Economia
  // né i costi Impresa: rettificare solo la medesima base, senza doppie sottrazioni.
  const commerciali = cantieriCommerciali && new Set(cantieriCommerciali)
  const dati = rettifiche.dati && commerciali ? {
    ...rettifiche.dati,
    rettifiche: rettifiche.dati.rettifiche.filter(r => r.cantiere_id == null || commerciali.has(r.cantiere_id)),
  } : rettifiche.dati
  const baseCoerente = dati ? rettificheCompatibiliConBase(dati, materialiBaseIds) : false
  const delta = dati && baseCoerente ? deltaRettifiche(dati, 'materiali_cantiere') : null
  const costi = delta === null || totaleCostiImpresa === null ? null : totaleCostiImpresa + delta
  const { utile, margine } = calcolaGestione(totalePreventiviImpresa, costi)
  return (
    <div style={{ ...cardStyle, minWidth: 420, maxWidth: 480 }}>
      <h3>💶 Economia generale</h3>
      <p>Totale contratti aggiornati: {totalePreventiviImpresa === null ? statoContratti : formatMoney(totalePreventiviImpresa)}</p>
      {parziale !== undefined && <p>Totale parziale dei contratti verificati: {parziale === null ? 'Non disponibile' : formatMoney(parziale)}</p>}
      {nonDeterminabili != null && <p>Cantieri lavori con contratto non determinabile: {nonDeterminabili}</p>}
      {daClassificare != null && <p>Perimetro da classificare: {daClassificare}</p>}
      <p>Totale costi cantieri: {costi === null ? 'Non disponibile' : formatMoney(costi)}</p>
      <p>
        <strong style={{ color: utile !== null && utile >= 0 ? 'green' : 'red' }}>
          Utile gestionale: {utile === null ? 'Non disponibile' : formatMoney(utile)}
        </strong>
      </p>
      <p>Margine gestionale: {margine === null ? 'Non disponibile' : `${margine.toFixed(1)}%`}</p>
      <small>Perimetro legacy dei cantieri: quote Economia e spese Impresa sono nel riepilogo fornitori di Economia generale.</small>
      {rettifiche.dati && !baseCoerente && <p role="alert">Fonte originaria non inclusa univocamente nella base legacy: usare il riepilogo documentale dei fornitori.</p>}
      {rettifiche.errore && <p role="alert">Costi rettificati non disponibili: {rettifiche.errore}</p>}
    </div>
  )
}