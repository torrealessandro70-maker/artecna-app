'use client'

import type { CSSProperties } from 'react'
import OperaioCard from './OperaioCard'

type Props = {
  operaiFiltrati: any[]
  badgeStyle: (stato?: string) => CSSProperties
  formatMoney: (v: number) => string
  preparaModificaOperaio: (o: any) => void
  cambiaStatoOperaio: (o: any, stato: 'attivo' | 'sospeso') => void | Promise<void>
  eliminaOperaio: (id?: string) => void | Promise<void>
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function OperaiList({
  operaiFiltrati,
  badgeStyle,
  formatMoney,
  preparaModificaOperaio,
  cambiaStatoOperaio,
  eliminaOperaio,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  if (operaiFiltrati.length === 0) {
    return <p>Nessun operaio presente</p>
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {operaiFiltrati.map((o, i) => (
        <OperaioCard
          key={o.id || i}
          operaio={o}
          index={i}
          badgeStyle={badgeStyle}
          formatMoney={formatMoney}
          preparaModificaOperaio={preparaModificaOperaio}
          cambiaStatoOperaio={cambiaStatoOperaio}
          eliminaOperaio={eliminaOperaio}
          buttonPrimary={buttonPrimary}
          buttonSecondary={buttonSecondary}
        />
      ))}
    </div>
  )
}