'use client'

import type { CSSProperties } from 'react'

type Props = {
  operaio: any
  index: number
  badgeStyle: (stato?: string) => CSSProperties
  formatMoney: (v: number) => string
  preparaModificaOperaio: (o: any) => void
 cambiaStatoOperaio: (o: any, stato: 'attivo' | 'sospeso') => void | Promise<void>
  eliminaOperaio: (id?: string) => void | Promise<void>
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function OperaioCard({
  operaio: o,
  index,
  badgeStyle,
  formatMoney,
  preparaModificaOperaio,
  cambiaStatoOperaio,
  eliminaOperaio,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  return (
    <div
      key={o.id || index}
      style={{
        padding: 12,
        border: '1px solid #ddd',
        borderRadius: 8,
        background: '#fff',
      }}
    >
      <strong>{o.nome}</strong>
      <span style={badgeStyle(o.stato)}>{o.stato || 'attivo'}</span>
      <br />
      Qualifica: {o.qualifica || '-'}
      <br />
      Telefono: {o.telefono || '-'}
      <br />
      PIN: {o.pin || '-'}
      <br />
      Costo orario: {formatMoney(Number(o.costo_orario || 0))}
      <br />
      Nota: {o.nota || '-'}

      <div
        style={{
          marginTop: 10,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <button onClick={() => preparaModificaOperaio(o)} style={buttonSecondary}>
          Modifica
        </button>

        {o.stato === 'sospeso' ? (
          <button
            onClick={() => cambiaStatoOperaio(o, 'attivo')}
            style={buttonPrimary}
          >
            Riattiva
          </button>
        ) : (
          <button
            onClick={() => cambiaStatoOperaio(o, 'sospeso')}
            style={buttonSecondary}
          >
            Sospendi
          </button>
        )}

        <button
          onClick={() => eliminaOperaio(o.id)}
          style={{
            padding: '10px 14px',
            backgroundColor: '#d9534f',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Elimina
        </button>
      </div>
    </div>
  )
}