'use client'

import type { CSSProperties } from 'react'

type SituazioneCantiere = {
  nome: string
}

type Props = {
  mostraValutazioneFondi: boolean
  setMostraValutazioneFondi: (value: boolean) => void
  situazioneCantieri: SituazioneCantiere[]
  buttonSecondary: CSSProperties
}

export default function ValutazioneFondiTogglePanel({
  mostraValutazioneFondi,
  setMostraValutazioneFondi,
  situazioneCantieri,
  buttonSecondary,
}: Props) {
  return (
    <>
      <div style={{ marginTop: 30, marginBottom: 12 }}>
        <button
          onClick={() =>
            setMostraValutazioneFondi(!mostraValutazioneFondi)
          }
          style={buttonSecondary}
        >
          {mostraValutazioneFondi
            ? 'Nascondi valutazione fondi cantiere'
            : 'Mostra valutazione fondi cantiere'}
        </button>
      </div>

      {mostraValutazioneFondi && (
        <>
          {situazioneCantieri.length === 0 ? (
            <p>Nessun cantiere presente.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {situazioneCantieri.map((c) => (
                <div key={c.nome}>
                  <strong>{c.nome}</strong>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}