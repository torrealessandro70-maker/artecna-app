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
  const [menuAperto, setMenuAperto] = useState(false)
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

  const condividiSopralluogo = async () => {
    const testo = [
      `Sopralluogo: ${sopralluogoAperto.cliente || 'senza cliente'}`,
      sopralluogoAperto.indirizzo,
      sopralluogoAperto.data_sopralluogo,
    ]
      .filter(Boolean)
      .join('\n')

    if (navigator.share) {
      await navigator.share({ title: 'Sopralluogo ARTECNA', text: testo })
      return
    }

    await navigator.clipboard.writeText(testo)
    alert('Riepilogo copiato negli appunti')
  }

  const eseguiAzione = async (azione: () => void | Promise<void>) => {
    setMenuAperto(false)
    await azione()
  }

  const stileAzione: CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    border: 0,
    borderRadius: 9,
    background: 'transparent',
    color: '#0f172a',
    textAlign: 'left',
    fontSize: 15,
    cursor: 'pointer',
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setMenuAperto((aperto) => !aperto)}
        aria-expanded={menuAperto}
        aria-haspopup="menu"
        style={{
          ...buttonPrimary,
          minWidth: 180,
          minHeight: 52,
          backgroundColor: '#0f172a',
          fontSize: 16,
        }}
      >
        ⚙ Azioni
      </button>

      {menuAperto && (
        <div
          role="menu"
          style={{
            width: 'min(100%, 360px)',
            marginTop: 10,
            padding: 8,
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            background: '#fff',
            boxShadow: '0 16px 35px rgba(15, 23, 42, 0.14)',
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void eseguiAzione(() => generaPreventivoDaSopralluogo(sopralluogoAperto))}
            style={stileAzione}
          >
            Genera Preventivo
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void eseguiAzione(generaPreventivoAi)}
            disabled={elaborazioneAi}
            style={{ ...stileAzione, opacity: elaborazioneAi ? 0.55 : 1 }}
          >
            {elaborazioneAi ? 'Generazione AI in corso...' : 'Genera Preventivo AI'}
          </button>
          {preventivoAiGenerato && (
            <button
              type="button"
              role="menuitem"
              onClick={() => void eseguiAzione(apriPreventivoAiGeneratoInModifica)}
              style={stileAzione}
            >
              Apri Preventivo AI
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => void eseguiAzione(() => convertiSopralluogoInCantiere(sopralluogoAperto))}
            style={stileAzione}
          >
            Converti in Cantiere
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void eseguiAzione(() => generaPdfSopralluogo(sopralluogoAperto))}
            style={stileAzione}
          >
            Esporta PDF
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void eseguiAzione(condividiSopralluogo)}
            style={stileAzione}
          >
            Condividi
          </button>
          <button
            type="button"
            role="menuitem"
            disabled
            title="Funzione predisposta per un prossimo sprint"
            style={{ ...stileAzione, color: '#64748b', cursor: 'not-allowed' }}
          >
            Esporta Fascicolo (prossimamente)
          </button>
        </div>
      )}

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

    </div>
  )
}
