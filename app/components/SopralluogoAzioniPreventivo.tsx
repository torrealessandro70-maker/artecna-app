'use client'

import { useState, type CSSProperties } from 'react'

type Props = {
  sopralluogoAperto: any
  preventivoAiGenerato: any
  generaPreventivoDaSopralluogo: (s: any) => void | Promise<void>
  generaPreventivoAiDaSopralluogo: (
    s: any
  ) => boolean | void | Promise<boolean | void>
  apriPreventivoAiGeneratoInModifica: () => void
  convertiSopralluogoInCantiere: (s: any) => void | Promise<void>
  generaPdfSopralluogo: (s: any) => void | Promise<void>
  buttonPrimary: CSSProperties
}

export default function SopralluogoAzioniPreventivo({
  sopralluogoAperto,
  preventivoAiGenerato,
  generaPreventivoDaSopralluogo,
  generaPreventivoAiDaSopralluogo,
  apriPreventivoAiGeneratoInModifica,
  convertiSopralluogoInCantiere,
  generaPdfSopralluogo,
  buttonPrimary,
}: Props) {
  const [faseAi, setFaseAi] = useState(-1)
  const [erroreAi, setErroreAi] = useState(false)
  const fasiAi = [
    { percentuale: 40, testo: 'Analizzo fotografie' },
    { percentuale: 60, testo: 'Riconosco ambienti' },
    { percentuale: 75, testo: 'Individuo lavorazioni' },
    { percentuale: 90, testo: 'Calcolo quantità' },
    { percentuale: 95, testo: 'Genero computo' },
    { percentuale: 100, testo: 'Preventivo completato' },
  ]

  const generaPreventivoAi = async () => {
    setErroreAi(false)
    setFaseAi(0)

    let fase = 0
    const timer = window.setInterval(() => {
      fase = Math.min(fase + 1, fasiAi.length - 2)
      setFaseAi(fase)
    }, 1400)

    try {
      const completato = await generaPreventivoAiDaSopralluogo(
        sopralluogoAperto
      )

      if (completato === false) {
        setErroreAi(true)
        return
      }

      setFaseAi(fasiAi.length - 1)
    } catch {
      setErroreAi(true)
    } finally {
      window.clearInterval(timer)
    }
  }

  const elaborazioneAi =
    faseAi >= 0 && faseAi < fasiAi.length - 1 && !erroreAi
  const percentualeAi =
    erroreAi ? 0 : faseAi >= 0 ? fasiAi[faseAi].percentuale : 0

  return (
    <>
      <button
        type="button"
        onClick={() => generaPreventivoDaSopralluogo(sopralluogoAperto)}
        style={{
          ...buttonPrimary,
          backgroundColor: '#7c3aed',
        }}
      >
        🧾 Genera preventivo
      </button>

      <button
        type="button"
        onClick={generaPreventivoAi}
        disabled={elaborazioneAi}
        style={{
          ...buttonPrimary,
          backgroundColor: '#9333ea',
        }}
      >
        {elaborazioneAi ? 'Elaborazione in corso…' : '🤖 Genera preventivo AI'}
      </button>

      {faseAi >= 0 && (
        <div
          role="status"
          aria-live="polite"
          style={{
            margin: '14px 0',
            padding: 16,
            border: '1px solid #ddd6fe',
            borderRadius: 12,
            background: '#faf5ff',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <strong>
              {erroreAi
                ? 'Elaborazione non completata'
                : fasiAi[faseAi].testo}
            </strong>
            <strong>{percentualeAi}%</strong>
          </div>

          <div
            style={{
              height: 10,
              marginTop: 10,
              overflow: 'hidden',
              borderRadius: 999,
              background: '#e9d5ff',
            }}
          >
            <div
              style={{
                width: `${percentualeAi}%`,
                height: '100%',
                borderRadius: 999,
                background: erroreAi ? '#dc2626' : '#7c3aed',
                transition: 'width 350ms ease',
              }}
            />
          </div>

          {!erroreAi && (
            <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
              {fasiAi.slice(0, faseAi + 1).map((fase, index) => (
                <span
                  key={fase.testo}
                  style={{ color: index < faseAi ? '#166534' : '#581c87' }}
                >
                  {index < faseAi || faseAi === fasiAi.length - 1 ? '✓' : '•'}{' '}
                  {fase.testo}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {preventivoAiGenerato && (
        <button
          type="button"
          onClick={apriPreventivoAiGeneratoInModifica}
          style={{
            ...buttonPrimary,
            backgroundColor: '#059669',
          }}
        >
          📂 Apri preventivo AI generato
        </button>
      )}

      <button
        type="button"
        onClick={() => convertiSopralluogoInCantiere(sopralluogoAperto)}
        style={{
          ...buttonPrimary,
          backgroundColor: '#15803d',
        }}
      >
        🏗 Converti in cantiere
      </button>

      <button
        type="button"
        onClick={() => generaPdfSopralluogo(sopralluogoAperto)}
        style={{
          ...buttonPrimary,
          backgroundColor: '#2563eb',
        }}
      >
        📄 Genera PDF
      </button>
    </>
  )
}
