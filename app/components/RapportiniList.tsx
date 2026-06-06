'use client'

import type { CSSProperties } from 'react'
import RapportinoCard from './RapportinoCard'

type Props = {
  rapportiniFiltrati: any[]
  fotoCantiere: any[]
  setFotoRapportinoAperte: (foto: any[]) => void
  preparaModificaRapportino: (r: any) => void
  eliminaRapportino: (id?: string) => void | Promise<void>
  generaPdfRapportinoFotografico: (r: any) => void | Promise<void>
  buttonSecondary: CSSProperties
}

export default function RapportiniList({
  rapportiniFiltrati,
  fotoCantiere,
  setFotoRapportinoAperte,
  preparaModificaRapportino,
  eliminaRapportino,
  generaPdfRapportinoFotografico,
  buttonSecondary,
}: Props) {
  if (rapportiniFiltrati.length === 0) {
    return <p>Nessun rapportino presente</p>
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {rapportiniFiltrati.map((r, i) => (
        <RapportinoCard
          key={r.id || i}
          rapportino={r}
          index={i}
          fotoCantiere={fotoCantiere}
          setFotoRapportinoAperte={setFotoRapportinoAperte}
          preparaModificaRapportino={preparaModificaRapportino}
          eliminaRapportino={eliminaRapportino}
          generaPdfRapportinoFotografico={generaPdfRapportinoFotografico}
          buttonSecondary={buttonSecondary}
        />
      ))}
    </div>
  )
}