'use client'

import type { CSSProperties, Dispatch, SetStateAction } from 'react'

type OperaioRapportinoTemp = {
  nome: string
  ora_inizio?: string
  ora_fine?: string
  ore: number
  costo_orario: number
}

type Props = {
  operaiAnagrafica: any[]
  operaiRapportinoTemp: OperaioRapportinoTemp[]
  setOperaiRapportinoTemp: Dispatch<SetStateAction<OperaioRapportinoTemp[]>>

  inputStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties

  formatMoney: (valore: any) => string
  setOperai: Dispatch<SetStateAction<string>>
  setPopupOperaiRapportino: Dispatch<SetStateAction<boolean>>
}

export default function PopupOperaiRapportino({
  operaiAnagrafica,
  operaiRapportinoTemp,
  setOperaiRapportinoTemp,
  inputStyle,
  buttonPrimary,
  buttonSecondary,
  formatMoney,
  setOperai,
  setPopupOperaiRapportino,
}: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15,23,42,0.55)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 20,
          width: '95%',
          maxWidth: 980,
          maxHeight: '85vh',
          overflow: 'auto',
        }}
      >
        <h3>👷 Operai presenti</h3>

        <div style={{ display: 'grid', gap: 10 }}>
          {operaiAnagrafica.map((o, i) => {
            const giaInserito = operaiRapportinoTemp.find(
              (x) => x.nome === o.nome
            )

            return (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 260px 130px auto',
                  gap: 10,
                  alignItems: 'center',
                  padding: 10,
                  border: '1px solid #cbd5e1',
                  borderRadius: 10,
                }}
              >
                <div>
                  <strong>{o.nome}</strong>
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="time"
                    value={giaInserito?.ora_inizio || ''}
                    onChange={(e) => {
                      const oraInizio = e.target.value

                      setOperaiRapportinoTemp((prev) => {
                        const altri = prev.filter((x) => x.nome !== o.nome)
                        const esistente = prev.find((x) => x.nome === o.nome)

                        return [
                          ...altri,
                          {
                            nome: o.nome,
                            ora_inizio: oraInizio,
                            ora_fine: esistente?.ora_fine || '',
                            ore: esistente?.ore || 0,
                            costo_orario: Number(o.costo_orario || 0),
                          },
                        ]
                      })
                    }}
                    style={inputStyle}
                  />

                  <span>a</span>

                  <input
                    type="time"
                    value={giaInserito?.ora_fine || ''}
                    onChange={(e) => {
                      const oraFine = e.target.value

                      setOperaiRapportinoTemp((prev) => {
                        const altri = prev.filter((x) => x.nome !== o.nome)
                        const esistente = prev.find((x) => x.nome === o.nome)

                        let oreCalcolate = 0

                        if (esistente?.ora_inizio && oraFine) {
                          const [h1, m1] = esistente.ora_inizio
                            .split(':')
                            .map(Number)

                          const [h2, m2] = oraFine.split(':').map(Number)

                          const minutiInizio = h1 * 60 + m1
                          const minutiFine = h2 * 60 + m2

                          oreCalcolate = Math.max(
                            0,
                            Number(
                              ((minutiFine - minutiInizio) / 60).toFixed(2)
                            )
                          )
                        }

                        return [
                          ...altri,
                          {
                            nome: o.nome,
                            ora_inizio: esistente?.ora_inizio || '',
                            ora_fine: oraFine,
                            ore: oreCalcolate,
                            costo_orario: Number(o.costo_orario || 0),
                          },
                        ]
                      })
                    }}
                    style={inputStyle}
                  />
                </div>

                <div>
                  {giaInserito?.ore || 0}h ·{' '}
                  {formatMoney(
                    (giaInserito?.ore || 0) *
                      (giaInserito?.costo_orario || 0)
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setOperaiRapportinoTemp((prev) =>
                      prev.filter((x) => x.nome !== o.nome)
                    )
                  }
                  style={{
                    ...buttonSecondary,
                    backgroundColor: '#dc2626',
                    color: '#fff',
                  }}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 20,
            alignItems: 'center',
          }}
        >
          <strong>
            Totale costo giornata:{' '}
            {formatMoney(
              operaiRapportinoTemp.reduce(
                (tot, o) => tot + o.ore * o.costo_orario,
                0
              )
            )}
          </strong>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setPopupOperaiRapportino(false)}
              style={buttonSecondary}
            >
              Chiudi
            </button>

            <button
              type="button"
              onClick={() => {
                const riepilogo = operaiRapportinoTemp
                  .filter((o) => o.ore > 0)
                  .map(
                    (o) =>
                      `${o.nome} (${o.ora_inizio || '-'} / ${
                        o.ora_fine || '-'
                      } - ${o.ore}h)`
                  )
                  .join(', ')

                const costoTotale = operaiRapportinoTemp.reduce(
                  (tot, o) => tot + o.ore * o.costo_orario,
                  0
                )

                setOperai(
                  `👷 Operai presenti:\n${riepilogo}\n\n💶 Costo giornata: ${formatMoney(
                    costoTotale
                  )}`
                )

                setPopupOperaiRapportino(false)
              }}
              style={buttonPrimary}
            >
              Usa nel rapportino
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}