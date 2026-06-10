'use client'

import type { CSSProperties } from 'react'
import RegistroTimbratureRiepilogo from './RegistroTimbratureRiepilogo'

type Props = {
  timbratureFiltrateRegistro: any[]
  calcolaOre: (t: any) => number
  calcolaCostoTimbratura: (t: any) => number
  formatMoney: (v: any) => string
  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
  excelInput: CSSProperties
  ordinaRegistro: (...args: any[]) => void
  setOrdinaTimbratureCampo: (v: any) => void
  setOrdinaTimbratureDirezione: (v: any) => void
  ordinaTimbratureCampo: string
  ordinaTimbratureDirezione: 'asc' | 'desc'
  timbraturaRegistroEdit: string | null
  timbraturaRegistroData: string
  setTimbraturaRegistroData: (v: string) => void
  timbraturaRegistroOperaio: string
  setTimbraturaRegistroOperaio: (v: string) => void
  timbraturaRegistroCantiere: string
  setTimbraturaRegistroCantiere: (v: string) => void
  timbraturaRegistroEntrata: string
  setTimbraturaRegistroEntrata: (v: string) => void
  timbraturaRegistroUscita: string
  setTimbraturaRegistroUscita: (v: string) => void
  operaiAnagrafica: any[]
  cantieri: any[]
  calcolaOreTimbratura: (entrata?: string, uscita?: string) => any
  salvaModificaRegistroTimbratura: (id: any) => void | Promise<void>
  annullaModificaRegistroTimbratura: () => void
  preparaModificaRegistroTimbratura: (t: any) => void
  eliminaTimbratura: (id: any) => void | Promise<void>
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function RegistroTimbraturePanel({
  timbratureFiltrateRegistro,
  calcolaOre,
  calcolaCostoTimbratura,
  formatMoney,
  excelTable,
  excelTh,
  excelTd,
  excelInput,
  ordinaRegistro,
  setOrdinaTimbratureCampo,
  setOrdinaTimbratureDirezione,
  ordinaTimbratureCampo,
  ordinaTimbratureDirezione,
  timbraturaRegistroEdit,
  timbraturaRegistroData,
  setTimbraturaRegistroData,
  timbraturaRegistroOperaio,
  setTimbraturaRegistroOperaio,
  timbraturaRegistroCantiere,
  setTimbraturaRegistroCantiere,
  timbraturaRegistroEntrata,
  setTimbraturaRegistroEntrata,
  timbraturaRegistroUscita,
  setTimbraturaRegistroUscita,
  operaiAnagrafica,
  cantieri,
  calcolaOreTimbratura,
  salvaModificaRegistroTimbratura,
  annullaModificaRegistroTimbratura,
  preparaModificaRegistroTimbratura,
  eliminaTimbratura,
  buttonPrimary,
  buttonSecondary,
}: Props) {

  const timbratureOrdinate = [...timbratureFiltrateRegistro].sort((a, b) => {
    const valoreA = (a as any)[ordinaTimbratureCampo] || ''
    const valoreB = (b as any)[ordinaTimbratureCampo] || ''

    return ordinaTimbratureDirezione === 'asc'
      ? String(valoreA).localeCompare(String(valoreB))
      : String(valoreB).localeCompare(String(valoreA))
  })

  return (
    <>
     <RegistroTimbratureRiepilogo
  timbratureFiltrateRegistro={timbratureFiltrateRegistro}
  calcolaOre={calcolaOre}
  calcolaCostoTimbratura={calcolaCostoTimbratura}
  formatMoney={formatMoney}
/>

      <div style={{ overflowX: 'auto' }}>
        <table style={excelTable}>
          <thead>
            <tr>
              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'data',
                    setOrdinaTimbratureCampo,
                    setOrdinaTimbratureDirezione,
                    ordinaTimbratureCampo
                  )
                }
              >
                Data ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'operaio_nome',
                    setOrdinaTimbratureCampo,
                    setOrdinaTimbratureDirezione,
                    ordinaTimbratureCampo
                  )
                }
              >
                Operaio ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'cantiere',
                    setOrdinaTimbratureCampo,
                    setOrdinaTimbratureDirezione,
                    ordinaTimbratureCampo
                  )
                }
              >
                Cantiere ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'ora_entrata',
                    setOrdinaTimbratureCampo,
                    setOrdinaTimbratureDirezione,
                    ordinaTimbratureCampo
                  )
                }
              >
                Entrata ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'ora_uscita',
                    setOrdinaTimbratureCampo,
                    setOrdinaTimbratureDirezione,
                    ordinaTimbratureCampo
                  )
                }
              >
                Uscita ↕
              </th>

              <th style={excelTh}>Fascia oraria</th>
              <th style={excelTh}>Azioni</th>
            </tr>
          </thead>

          <tbody>
            {timbratureOrdinate.map((t, i) => (
              <tr
                key={t.id || i}
                style={{
                  backgroundColor:
                    timbraturaRegistroEdit === String(t.id)
                      ? '#eff6ff'
                      : '#fff',
                }}
              >
                <td style={excelTd}>
                  {timbraturaRegistroEdit === String(t.id) ? (
                    <input
                      type="date"
                      value={timbraturaRegistroData}
                      onChange={(e) =>
                        setTimbraturaRegistroData(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    t.data || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {timbraturaRegistroEdit === String(t.id) ? (
                    <select
                      value={timbraturaRegistroOperaio}
                      onChange={(e) =>
                        setTimbraturaRegistroOperaio(e.target.value)
                      }
                      style={excelInput}
                    >
                      <option value="">Seleziona operaio</option>
                      {operaiAnagrafica
                        .filter((o) => o.stato !== 'inattivo')
                        .map((o) => (
                          <option key={o.id || o.nome} value={o.nome}>
                            {o.nome}
                          </option>
                        ))}
                    </select>
                  ) : (
                    t.operaio_nome || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {timbraturaRegistroEdit === String(t.id) ? (
                    <select
                      value={timbraturaRegistroCantiere}
                      onChange={(e) =>
                        setTimbraturaRegistroCantiere(e.target.value)
                      }
                      style={excelInput}
                    >
                      <option value="">Seleziona cantiere</option>
                      {cantieri
                        .filter((c) => !c.lavori_conclusi)
                        .map((c) => (
                          <option key={c.id || c.nome} value={c.nome}>
                            {c.nome}
                          </option>
                        ))}
                    </select>
                  ) : (
                    t.cantiere || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {timbraturaRegistroEdit === String(t.id) ? (
                    <input
                      type="time"
                      value={timbraturaRegistroEntrata}
                      onChange={(e) =>
                        setTimbraturaRegistroEntrata(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    t.ora_entrata || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {timbraturaRegistroEdit === String(t.id) ? (
                    <input
                      type="time"
                      value={timbraturaRegistroUscita}
                      onChange={(e) =>
                        setTimbraturaRegistroUscita(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    t.ora_uscita || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {timbraturaRegistroEdit === String(t.id)
                    ? calcolaOreTimbratura(
                        timbraturaRegistroEntrata,
                        timbraturaRegistroUscita
                      )
                    : calcolaOreTimbratura(t.ora_entrata, t.ora_uscita)}
                </td>

                <td style={excelTd}>
                  {timbraturaRegistroEdit === String(t.id) ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => salvaModificaRegistroTimbratura(t.id)}
                        style={buttonPrimary}
                      >
                        💾
                      </button>

                      <button
                        onClick={annullaModificaRegistroTimbratura}
                        style={buttonSecondary}
                      >
                        ❌
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => preparaModificaRegistroTimbratura(t)}
                        style={buttonSecondary}
                      >
                        ✏️
                      </button>

                      <button
                        onClick={() => eliminaTimbratura(t.id)}
                        style={{
                          ...buttonSecondary,
                          backgroundColor: '#dc2626',
                          color: '#fff',
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}