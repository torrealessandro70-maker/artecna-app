'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'

type EsitoCalcolo =
  | { valore: number; errore?: never }
  | { valore?: never; errore: string }

function calcolaEspressione(input: string): EsitoCalcolo {
  const formula = input.replace(/,/g, '.').replace(/\s+/g, '')
  if (!formula) return { errore: 'Inserisci un calcolo' }
  if (!/^[0-9.+\-*/()]+$/.test(formula)) {
    return { errore: 'Sono ammessi solo numeri e operatori + − × ÷' }
  }

  let posizione = 0

  const leggiNumero = (): number => {
    const inizio = posizione
    while (/[0-9.]/.test(formula[posizione] || '')) posizione += 1
    const testo = formula.slice(inizio, posizione)
    if (!testo || (testo.match(/\./g) || []).length > 1) {
      throw new Error('Numero non valido')
    }
    const numero = Number(testo)
    if (!Number.isFinite(numero)) throw new Error('Numero non valido')
    return numero
  }

  const leggiFattore = (): number => {
    if (formula[posizione] === '+') {
      posizione += 1
      return leggiFattore()
    }
    if (formula[posizione] === '-') {
      posizione += 1
      return -leggiFattore()
    }
    if (formula[posizione] === '(') {
      posizione += 1
      const valore = leggiEspressione()
      if (formula[posizione] !== ')') throw new Error('Parentesi non chiusa')
      posizione += 1
      return valore
    }
    return leggiNumero()
  }

  const leggiTermine = (): number => {
    let valore = leggiFattore()
    while (formula[posizione] === '*' || formula[posizione] === '/') {
      const operatore = formula[posizione]
      posizione += 1
      const operando = leggiFattore()
      if (operatore === '/' && operando === 0) throw new Error('Divisione per zero')
      valore = operatore === '*' ? valore * operando : valore / operando
    }
    return valore
  }

  function leggiEspressione(): number {
    let valore = leggiTermine()
    while (formula[posizione] === '+' || formula[posizione] === '-') {
      const operatore = formula[posizione]
      posizione += 1
      const operando = leggiTermine()
      valore = operatore === '+' ? valore + operando : valore - operando
    }
    return valore
  }

  try {
    const valore = leggiEspressione()
    if (posizione !== formula.length || !Number.isFinite(valore)) {
      return { errore: 'Formula non valida' }
    }
    return { valore: Number(valore.toFixed(6)) }
  } catch (errore) {
    return {
      errore: errore instanceof Error ? errore.message : 'Formula non valida',
    }
  }
}

type Props = {
  messaggioAi: string
  descrizionePreventivoAi: string
  setDescrizionePreventivoAi: (v: string) => void

  vociPreventivoAi: any[]
  setVociPreventivoAi: (v: any[]) => void
  vociPreventivoAiOriginali: any[]

  calcolaMediaPrezziSimili: (descrizione: string) => number | null
  verificaPrezzoAnomalo: (descrizione: string, prezzo: number) => string

  formatMoney: (v: any) => string
  miglioraVocePreventivoAi: (index: number) => void | Promise<void>
  salvaInMemoriaPrezzi: (voce: any) => void | Promise<void>
  generaExcelDefinitivoPreventivoAi: () => void | Promise<void>

  preventivoRegistroCantiere: string
  setMostraRevisionePreventivoAi: (v: boolean) => void

  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function RevisionePreventivoAiPanel({
  messaggioAi,
  descrizionePreventivoAi,
  setDescrizionePreventivoAi,
  vociPreventivoAi,
  setVociPreventivoAi,
  vociPreventivoAiOriginali,
  calcolaMediaPrezziSimili,
  verificaPrezzoAnomalo,
  formatMoney,
  miglioraVocePreventivoAi,
  salvaInMemoriaPrezzi,
  generaExcelDefinitivoPreventivoAi,
  preventivoRegistroCantiere,
  setMostraRevisionePreventivoAi,
  excelTable,
  excelTh,
  excelTd,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const [calcolatrice, setCalcolatrice] = useState<{
    indice: number
    formula: string
  } | null>(null)
  const formulaRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!calcolatrice) return
    formulaRef.current?.focus()
    formulaRef.current?.select()
  }, [calcolatrice])

  const subTotale = vociPreventivoAi.reduce(
    (tot, voce) =>
      tot +
      Number(voce.quantita || 0) *
        Number(voce.prezzo_unitario || 0),
    0
  )
  const esitoCalcolo = calcolatrice
    ? calcolaEspressione(calcolatrice.formula)
    : null

  const apriCalcolatrice = (indice: number) => {
    setCalcolatrice({
      indice,
      formula: String(vociPreventivoAi[indice]?.quantita ?? 0),
    })
  }

  const applicaCalcolo = () => {
    if (!calcolatrice || esitoCalcolo?.valore === undefined) return
    const nuove = vociPreventivoAi.map((voce, indice) =>
      indice === calcolatrice.indice
        ? { ...voce, quantita: esitoCalcolo.valore }
        : voce
    )
    setVociPreventivoAi(nuove)
    setCalcolatrice(null)
  }

  const spostaVoce = (indice: number, direzione: -1 | 1) => {
    const destinazione = indice + direzione
    if (destinazione < 0 || destinazione >= vociPreventivoAi.length) return
    const nuove = [...vociPreventivoAi]
    ;[nuove[indice], nuove[destinazione]] = [
      nuove[destinazione],
      nuove[indice],
    ]
    setVociPreventivoAi(nuove)
  }

  return (
    <div
      style={{
        marginTop: 20,
        padding: 16,
        border: '1px solid #cbd5e1',
        borderRadius: 12,
        background: '#fff',
      }}
    >
      <h3
        style={{
          fontSize: 28,
          marginBottom: 20,
        }}
      >
        🤖 Revisione preventivo AI
      </h3>

      {messaggioAi && (
        <div
          style={{
            marginBottom: 15,
            padding: 12,
            borderRadius: 8,
            background: '#dcfce7',
            color: '#166534',
            fontWeight: 600,
            fontSize: 18,
          }}
        >
          {messaggioAi}
        </div>
      )}

      <textarea
        value={descrizionePreventivoAi}
        onChange={(e) => setDescrizionePreventivoAi(e.target.value)}
        style={{
          width: '100%',
          minHeight: 140,
          padding: 14,
          marginBottom: 15,
          fontSize: 18,
        }}
      />

      <div
        style={{
          marginBottom: 16,
          padding: 14,
          border: '1px solid #cbd5e1',
          borderRadius: 10,
          background: '#f8fafc',
        }}
      >
        <strong style={{ fontSize: 20 }}>
          🧠 Memoria prezzi ARTECNA
        </strong>

        <div style={{ marginTop: 10, fontSize: 15, color: '#475569' }}>
          La memoria prezzi confronta le lavorazioni del preventivo con i prezzi
          reali già usati da ARTECNA a Catania.
        </div>

        {vociPreventivoAi.length === 0 ? (
          <div style={{ marginTop: 10 }}>
            Nessuna voce disponibile da confrontare.
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {vociPreventivoAi.map((voce, index) => {
              const media = calcolaMediaPrezziSimili(
                voce.descrizione || ''
              )

              const avviso = verificaPrezzoAnomalo(
                voce.descrizione || '',
                Number(voce.prezzo_unitario || 0)
              )

              return (
                <div
                  key={index}
                  style={{
                    marginBottom: 10,
                    padding: 10,
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    background: '#fff',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {voce.descrizione || 'Voce senza descrizione'}
                  </div>

                  <div style={{ marginTop: 6 }}>
                    Prezzo voce:{' '}
                    <strong>
                      {formatMoney(Number(voce.prezzo_unitario || 0))}
                    </strong>
                  </div>

                  <div>
                    Media ARTECNA/Catania:{' '}
                    <strong>
                      {media ? formatMoney(media) : 'Nessun dato sufficiente'}
                    </strong>
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      fontWeight: 700,
                      color: avviso.includes('⚠️')
                        ? '#b45309'
                        : '#166534',
                    }}
                  >
                    {avviso || 'Nessun confronto disponibile'}
                  </div>

                  {media && (
                    <button
                      onClick={() => {
                        const nuove = [...vociPreventivoAi]
                        nuove[index].prezzo_unitario = Number(
                          media.toFixed(2)
                        )
                        setVociPreventivoAi(nuove)
                      }}
                      style={{
                        ...buttonSecondary,
                        marginTop: 8,
                        backgroundColor: '#0f766e',
                        color: '#fff',
                      }}
                    >
                      Usa media memoria prezzi
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <table
        style={{
          ...excelTable,
          width: '100%',
          fontSize: 18,
        }}
      >
        <thead>
          <tr>
            <th style={excelTh}>Descrizione</th>
            <th style={excelTh}>UM</th>
            <th style={excelTh}>Q.tà</th>
            <th style={excelTh}>Prezzo</th>
            <th style={excelTh}>Totale</th>
            <th style={excelTh}>Azioni</th>
          </tr>
        </thead>

        <tbody>
          {vociPreventivoAi.map((voce, index) => {
            const totale =
              Number(voce.quantita || 0) *
              Number(voce.prezzo_unitario || 0)

            return (
              <tr key={index}>
                <td style={excelTd}>
                  <textarea
                    value={voce.descrizione || ''}
                    onChange={(e) => {
                      const nuove = [...vociPreventivoAi]
                      nuove[index].descrizione = e.target.value
                      setVociPreventivoAi(nuove)
                    }}
                    style={{
                      width: '100%',
                      minHeight: 90,
                      fontSize: 17,
                      padding: 10,
                    }}
                  />
                </td>

                <td style={excelTd}>
                  <input
                    value={voce.unita_misura || ''}
                    onChange={(e) => {
                      const nuove = [...vociPreventivoAi]
                      nuove[index].unita_misura = e.target.value
                      setVociPreventivoAi(nuove)
                    }}
                    style={{ width: 80 }}
                  />
                </td>

                <td
                  style={{ ...excelTd, cursor: 'pointer' }}
                  onClick={() => apriCalcolatrice(index)}
                  title="Tocca per aprire la calcolatrice"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      value={voce.quantita || 0}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(e) => {
                        const nuove = [...vociPreventivoAi]
                        nuove[index] = {
                          ...nuove[index],
                          quantita: Number(e.target.value),
                        }
                        setVociPreventivoAi(nuove)
                      }}
                      aria-label={`Quantità voce ${index + 1}`}
                      style={{ width: 80, minHeight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        apriCalcolatrice(index)
                      }}
                      aria-label={`Calcola quantità voce ${index + 1}`}
                      style={{
                        width: 44,
                        height: 44,
                        border: '1px solid #94a3b8',
                        borderRadius: 8,
                        background: '#f8fafc',
                        fontSize: 20,
                        cursor: 'pointer',
                      }}
                    >
                      ÷
                    </button>
                  </div>
                </td>

                <td style={excelTd}>
                  <input
                    type="number"
                    value={voce.prezzo_unitario || 0}
                    onChange={(e) => {
                      const nuove = [...vociPreventivoAi]
                      nuove[index].prezzo_unitario = Number(e.target.value)
                      setVociPreventivoAi(nuove)
                    }}
                    style={{ width: 100 }}
                  />
                </td>

                <td style={excelTd}>{formatMoney(totale)}</td>

                <td style={excelTd}>
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => spostaVoce(index, -1)}
                      disabled={index === 0}
                      aria-label={`Sposta in alto la voce ${index + 1}`}
                      style={{
                        width: 44,
                        height: 44,
                        border: '1px solid #94a3b8',
                        borderRadius: 6,
                        background: '#fff',
                        fontSize: 20,
                        cursor: index === 0 ? 'default' : 'pointer',
                        opacity: index === 0 ? 0.4 : 1,
                      }}
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      onClick={() => spostaVoce(index, 1)}
                      disabled={index === vociPreventivoAi.length - 1}
                      aria-label={`Sposta in basso la voce ${index + 1}`}
                      style={{
                        width: 44,
                        height: 44,
                        border: '1px solid #94a3b8',
                        borderRadius: 6,
                        background: '#fff',
                        fontSize: 20,
                        cursor:
                          index === vociPreventivoAi.length - 1
                            ? 'default'
                            : 'pointer',
                        opacity: index === vociPreventivoAi.length - 1 ? 0.4 : 1,
                      }}
                    >
                      ↓
                    </button>

                    <button
                      type="button"
                      onClick={() => miglioraVocePreventivoAi(index)}
                      style={{
                        background: '#f59e0b',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      ✨
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setVociPreventivoAi(
                          vociPreventivoAi.filter((_, i) => i !== index)
                        )
                      }
                      style={{
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          background: '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        <span>Sub totale preventivo</span>
        <span>{formatMoney(subTotale)}</span>
      </div>

      <div style={{ marginTop: 15, display: 'flex', gap: 10 }}>
        <button
          onClick={() =>
            setVociPreventivoAi([
              ...vociPreventivoAi,
              {
                descrizione: '',
                unita_misura: 'a corpo',
                quantita: 1,
                prezzo_unitario: 0,
              },
            ])
          }
          style={buttonSecondary}
        >
          ➕ Aggiungi voce
        </button>

        <button
          onClick={() => {
            setVociPreventivoAi(
              JSON.parse(JSON.stringify(vociPreventivoAiOriginali))
            )

            alert('Versione originale ripristinata')
          }}
          style={{
            ...buttonSecondary,
            backgroundColor: '#64748b',
            color: '#fff',
          }}
        >
          ↩ Ripristina originale
        </button>

        <button
          onClick={async () => {
            for (const voce of vociPreventivoAi) {
              await salvaInMemoriaPrezzi({
                descrizione: voce.descrizione || '',
                categoria: 'preventivo AI',
                unita_misura: voce.unita_misura || '',
                quantita: Number(voce.quantita || 0),
                prezzo_unitario: Number(voce.prezzo_unitario || 0),
                prezzo_totale:
                  Number(voce.quantita || 0) *
                  Number(voce.prezzo_unitario || 0),
                cantiere: preventivoRegistroCantiere || '',
                fonte: 'preventivo AI approvato',
                provincia: 'Catania',
              })
            }

            await generaExcelDefinitivoPreventivoAi()
          }}
          style={{
            ...buttonPrimary,
            backgroundColor: '#2563eb',
          }}
        >
          📄 Genera Excel definitivo
        </button>

        <button
          onClick={() => setMostraRevisionePreventivoAi(false)}
          style={buttonSecondary}
        >
          Chiudi revisione
        </button>
      </div>

      {calcolatrice && (
        <div
          role="presentation"
          onClick={() => setCalcolatrice(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 12000,
            display: 'grid',
            placeItems: 'center',
            padding: 20,
            background: 'rgba(15,23,42,0.45)',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titolo-calcolatrice-quantita"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(100%, 420px)',
              padding: 20,
              borderRadius: 16,
              background: '#fff',
              boxShadow: '0 20px 60px rgba(15,23,42,0.3)',
            }}
          >
            <h4 id="titolo-calcolatrice-quantita" style={{ margin: 0, fontSize: 22 }}>
              Calcola quantità
            </h4>
            <div style={{ marginTop: 8, color: '#64748b' }}>
              Valore attuale:{' '}
              <strong>{vociPreventivoAi[calcolatrice.indice]?.quantita ?? 0}</strong>
            </div>

            <label style={{ display: 'block', marginTop: 16, fontWeight: 700 }}>
              Formula
              <input
                ref={formulaRef}
                value={calcolatrice.formula}
                inputMode="decimal"
                placeholder="Esempio: 2.4*3"
                onChange={(event) =>
                  setCalcolatrice((corrente) =>
                    corrente ? { ...corrente, formula: event.target.value } : null
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && esitoCalcolo?.valore !== undefined) {
                    event.preventDefault()
                    applicaCalcolo()
                  }
                  if (event.key === 'Escape') setCalcolatrice(null)
                }}
                style={{
                  width: '100%',
                  minHeight: 54,
                  marginTop: 7,
                  padding: '12px 14px',
                  border: '2px solid #94a3b8',
                  borderRadius: 10,
                  fontSize: 21,
                }}
              />
            </label>

            <div
              aria-live="polite"
              style={{
                minHeight: 58,
                marginTop: 14,
                padding: 12,
                borderRadius: 10,
                background: esitoCalcolo?.errore ? '#fef2f2' : '#f0fdf4',
                color: esitoCalcolo?.errore ? '#991b1b' : '#166534',
              }}
            >
              {esitoCalcolo?.errore ? (
                esitoCalcolo.errore
              ) : (
                <>
                  Risultato:{' '}
                  <strong style={{ fontSize: 22 }}>{esitoCalcolo?.valore}</strong>
                </>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 18,
              }}
            >
              <button
                type="button"
                onClick={() => setCalcolatrice(null)}
                style={{ ...buttonSecondary, minHeight: 50, padding: '11px 18px' }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={applicaCalcolo}
                disabled={esitoCalcolo?.valore === undefined}
                style={{
                  ...buttonPrimary,
                  minHeight: 50,
                  padding: '11px 20px',
                  opacity: esitoCalcolo?.valore === undefined ? 0.5 : 1,
                }}
              >
                Applica
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
