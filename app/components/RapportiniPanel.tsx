'use client'

import type { CSSProperties } from 'react'
import RapportiniList from './RapportiniList'

type Props = {
  cardStyle: CSSProperties
  rapportiniFiltrati: any[]
  fotoCantiere: any[]
  setFotoRapportinoAperte: (foto: any[]) => void
  preparaModificaRapportino: (rapportino: any) => void
  eliminaRapportino: (id?: string) => void | Promise<void>
  generaPdfRapportinoFotografico: (
    rapportino: any
  ) => void | Promise<void>
  buttonSecondary: CSSProperties
}

export default function RapportiniPanel({
  cardStyle,
  rapportiniFiltrati,
  fotoCantiere,
  setFotoRapportinoAperte,
  preparaModificaRapportino,
  eliminaRapportino,
  generaPdfRapportinoFotografico,
  buttonSecondary,
}: Props) {
  return (
    <section style={cardStyle}>
      <h2>Rapportini</h2>
      <p>Numero rapportini: {rapportiniFiltrati.length}</p>

      <RapportiniList
        rapportiniFiltrati={rapportiniFiltrati}
        fotoCantiere={fotoCantiere}
        setFotoRapportinoAperte={setFotoRapportinoAperte}
        preparaModificaRapportino={preparaModificaRapportino}
        eliminaRapportino={eliminaRapportino}
        generaPdfRapportinoFotografico={generaPdfRapportinoFotografico}
        buttonSecondary={buttonSecondary}
      />
    </section>
  )
}
