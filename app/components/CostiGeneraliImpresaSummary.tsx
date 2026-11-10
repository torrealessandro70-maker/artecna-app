'use client'

import type { MouseEventHandler } from 'react'

export type SpesaImpresa = {
  categoria?: string | null
  importo?: number | string | null
}

type Props = {
  comeRiga?: boolean
  soloDettaglio?: boolean
  onMostraDettaglio?: MouseEventHandler<HTMLButtonElement>
  speseImpresa: SpesaImpresa[]
  formatMoney: (value: number) => string
}

export default function CostiGeneraliImpresaSummary({
  speseImpresa,
  formatMoney,
  comeRiga = false,
  soloDettaglio = false,
  onMostraDettaglio,
}: Props) {
  const totaleAttrezzi = speseImpresa
    .filter((s) => s.categoria === 'attrezzo_ditta')
    .reduce((tot, s) => tot + Number(s.importo || 0), 0)

  const totaleMagazzino = speseImpresa
    .filter((s) => s.categoria === 'magazzino')
    .reduce((tot, s) => tot + Number(s.importo || 0), 0)

  const totaleSpeseGenerali = speseImpresa
    .filter((s) => s.categoria === 'spesa_generale')
    .reduce((tot, s) => tot + Number(s.importo || 0), 0)

  const totaleCostiGenerali = speseImpresa.reduce(
    (tot, s) => tot + Number(s.importo || 0),
    0
  )

  if (comeRiga) return <tr aria-label="Costi generali impresa — totale">
    <th scope="row">Costi generali impresa — totale</th>
    <td><strong>{Number.isFinite(totaleCostiGenerali) ? formatMoney(totaleCostiGenerali) : 'Non determinabile'}</strong><small>Complessivo caricato — non filtrato per periodo</small></td>
    <td style={{ color: Number.isFinite(totaleCostiGenerali) ? '#92400e' : '#9f1239' }}>{Number.isFinite(totaleCostiGenerali) ? 'Limitato' : 'Non calcolabile'}</td>
    <td><button type="button" onClick={onMostraDettaglio}>Mostra dettaglio</button><small>Classificazioni gestionali, non consolidate con i documenti; completezza non certificata.</small></td>
  </tr>

  return (
    <>
      {!soloDettaglio && <h3 style={{ marginTop: 30 }}>🏢 Costi generali impresa</h3>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <strong>🛠️ Attrezzi / beni ditta</strong>
          <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}>
            {formatMoney(totaleAttrezzi)}
          </div>
        </div>

        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <strong>📦 Magazzino</strong>
          <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}>
            {formatMoney(totaleMagazzino)}
          </div>
        </div>

        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <strong>📑 Spese generali</strong>
          <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}>
            {formatMoney(totaleSpeseGenerali)}
          </div>
        </div>

        {!soloDettaglio && <div
          style={{
            padding: 12,
            border: '2px solid #dc2626',
            borderRadius: 8,
            background: '#fef2f2',
          }}
        >
          <strong>📉 Totale costi generali</strong>
          <div
            style={{
              marginTop: 6,
              fontSize: 20,
              fontWeight: 700,
              color: '#dc2626',
            }}
          >
            {formatMoney(totaleCostiGenerali)}
          </div>
        </div>}
      </div>
    </>
  )
}