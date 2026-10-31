'use client'

import type { CSSProperties } from 'react'
import { useCostiFornitori } from './CostiFornitoriRettificati'
import { deltaRettifiche, rettificheCompatibiliConBase, type ClientNoteCredito } from '../engines/fatture/note-credito'

type Props = {
  materialiBaseIds: string[]
  client: ClientNoteCredito
  cardStyle: CSSProperties
  totalePreventiviImpresa: number
  totaleCostiImpresa: number
  utileTotaleImpresa: number
  margineMedioImpresa: number
  formatMoney: (value: number) => string
}

export default function HomeEconomiaGeneraleCard({
  client,
  materialiBaseIds,
  cardStyle,
  totalePreventiviImpresa,
  totaleCostiImpresa,
  utileTotaleImpresa,
  margineMedioImpresa,
  formatMoney,
}: Props) {
  const rettifiche = useCostiFornitori(client)
  // Questa scheda legacy comprende i materiali Cantiere, non le quote Economia
  // né i costi Impresa: rettificare solo la medesima base, senza doppie sottrazioni.
  const baseCoerente = rettifiche.dati ? rettificheCompatibiliConBase(rettifiche.dati, materialiBaseIds) : false
  const delta = rettifiche.dati && baseCoerente ? deltaRettifiche(rettifiche.dati, 'materiali_cantiere') : null
  const costi = delta === null ? null : totaleCostiImpresa + delta
  const utile = delta === null ? null : utileTotaleImpresa - delta
  const margine = utile === null ? null : totalePreventiviImpresa > 0 ? utile / totalePreventiviImpresa * 100 : margineMedioImpresa
  return (
    <div style={{ ...cardStyle, minWidth: 420, maxWidth: 480 }}>
      <h3>💶 Economia generale</h3>
      <p>Totale preventivi: {formatMoney(totalePreventiviImpresa)}</p>
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