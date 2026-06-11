'use client'

import type { CSSProperties } from 'react'

type Props = {
  rapportini: any[]
  registroCerca: string

  ordinaRegistro: (...args: any[]) => void

  ordinaRapportiniCampo: string
  ordinaRapportiniDirezione: 'asc' | 'desc'

  setOrdinaRapportiniCampo: (v: any) => void
  setOrdinaRapportiniDirezione: (v: any) => void

  rapportinoRegistroEdit: string | null

  rapportinoRegistroData: string
  setRapportinoRegistroData: (v: string) => void

  rapportinoRegistroCantiere: string
  setRapportinoRegistroCantiere: (v: string) => void

  rapportinoRegistroOperaio: string
  setRapportinoRegistroOperaio: (v: string) => void

  rapportinoRegistroOre: string
  setRapportinoRegistroOre: (v: string) => void

  rapportinoRegistroDescrizione: string
  setRapportinoRegistroDescrizione: (v: string) => void

  salvaModificaRegistroRapportino: (id: any) => void | Promise<void>
  annullaModificaRegistroRapportino: () => void

  preparaModificaRegistroRapportino: (r: any) => void
  eliminaRapportino: (id: any) => void | Promise<void>

  excelBox: CSSProperties
  excelToolbar: CSSProperties
  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
  excelInput: CSSProperties

  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function RegistroRapportiniPanel({
  rapportini,
  registroCerca,
  ordinaRegistro,
  ordinaRapportiniCampo,
  ordinaRapportiniDirezione,
  setOrdinaRapportiniCampo,
  setOrdinaRapportiniDirezione,
  rapportinoRegistroEdit,
  rapportinoRegistroData,
  setRapportinoRegistroData,
  rapportinoRegistroCantiere,
  setRapportinoRegistroCantiere,
  rapportinoRegistroOperaio,
  setRapportinoRegistroOperaio,
  rapportinoRegistroOre,
  setRapportinoRegistroOre,
  rapportinoRegistroDescrizione,
  setRapportinoRegistroDescrizione,
  salvaModificaRegistroRapportino,
  annullaModificaRegistroRapportino,
  preparaModificaRegistroRapportino,
  eliminaRapportino,
  excelBox,
  excelToolbar,
  excelTable,
  excelTh,
  excelTd,
  excelInput,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const rapportiniFiltrati = [...rapportini]
    .filter(
      (r) =>
        String(r.cantiere || '')
          .toLowerCase()
          .includes(registroCerca.toLowerCase()) ||
        String(r.note || '-')
          .toLowerCase()
          .includes(registroCerca.toLowerCase())
    )
    .sort((a, b) => {
      const valoreA = (a as any)[ordinaRapportiniCampo] || ''
      const valoreB = (b as any)[ordinaRapportiniCampo] || ''

      if (typeof valoreA === 'number') {
        return ordinaRapportiniDirezione === 'asc'
          ? valoreA - valoreB
          : valoreB - valoreA
      }

      return ordinaRapportiniDirezione === 'asc'
        ? String(valoreA).localeCompare(String(valoreB))
        : String(valoreB).localeCompare(String(valoreA))
    })

  return (
    <div style={excelBox}>
      <div style={excelToolbar}>
        <strong>📝 Registro rapportini</strong>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={excelTable}>
          <thead>
            <tr>
              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'data',
                    setOrdinaRapportiniCampo,
                    setOrdinaRapportiniDirezione,
                    ordinaRapportiniCampo
                  )
                }
              >
                Data ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'cantiere',
                    setOrdinaRapportiniCampo,
                    setOrdinaRapportiniDirezione,
                    ordinaRapportiniCampo
                  )
                }
              >
                Cantiere ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'operai',
                    setOrdinaRapportiniCampo,
                    setOrdinaRapportiniDirezione,
                    ordinaRapportiniCampo
                  )
                }
              >
                Operaio ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'ore',
                    setOrdinaRapportiniCampo,
                    setOrdinaRapportiniDirezione,
                    ordinaRapportiniCampo
                  )
                }
              >
                Ore ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'note',
                    setOrdinaRapportiniCampo,
                    setOrdinaRapportiniDirezione,
                    ordinaRapportiniCampo
                  )
                }
              >
                Descrizione ↕
              </th>

              <th style={excelTh}>Azioni</th>
            </tr>
          </thead>

          <tbody>
            {rapportiniFiltrati.map((r, i) => (
              <tr
                key={r.id || i}
                style={{
                  backgroundColor:
                    rapportinoRegistroEdit === String(r.id)
                      ? '#eff6ff'
                      : '#fff',
                }}
              >
                <td style={excelTd}>
                  {rapportinoRegistroEdit === String(r.id) ? (
                    <input
                      type="date"
                      value={rapportinoRegistroData}
                      onChange={(e) =>
                        setRapportinoRegistroData(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    r.data || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {rapportinoRegistroEdit === String(r.id) ? (
                    <input
                      value={rapportinoRegistroCantiere}
                      onChange={(e) =>
                        setRapportinoRegistroCantiere(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    r.cantiere || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {rapportinoRegistroEdit === String(r.id) ? (
                    <input
                      value={rapportinoRegistroOperaio}
                      onChange={(e) =>
                        setRapportinoRegistroOperaio(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    r.operai || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {rapportinoRegistroEdit === String(r.id) ? (
                    <input
                      value={rapportinoRegistroOre}
                      onChange={(e) =>
                        setRapportinoRegistroOre(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    r.ore || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {rapportinoRegistroEdit === String(r.id) ? (
                    <input
                      value={rapportinoRegistroDescrizione}
                      onChange={(e) =>
                        setRapportinoRegistroDescrizione(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    r.note || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {rapportinoRegistroEdit === String(r.id) ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => salvaModificaRegistroRapportino(r.id)}
                        style={buttonPrimary}
                      >
                        💾
                      </button>

                      <button
                        onClick={annullaModificaRegistroRapportino}
                        style={buttonSecondary}
                      >
                        ❌
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => preparaModificaRegistroRapportino(r)}
                        style={buttonSecondary}
                      >
                        ✏️
                      </button>

                      <button
                        onClick={() => eliminaRapportino(r.id)}
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
    </div>
  )
}