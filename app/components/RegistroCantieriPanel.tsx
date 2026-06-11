'use client'

import type { CSSProperties } from 'react'

type Props = {
  cantieri: any[]
  registroCerca: string
  formatMoney: (v: any) => string

  ordinaRegistro: (...args: any[]) => void
  ordinaCantieriCampo: string
  ordinaCantieriDirezione: 'asc' | 'desc'
  setOrdinaCantieriCampo: (v: any) => void
  setOrdinaCantieriDirezione: (v: any) => void

  cantiereRegistroEdit: string | null

  cantiereRegistroNome: string
  setCantiereRegistroNome: (v: string) => void

  cantiereRegistroPreventivo: string
  setCantiereRegistroPreventivo: (v: string) => void

  cantiereRegistroInizio: string
  setCantiereRegistroInizio: (v: string) => void

  cantiereRegistroFine: string
  setCantiereRegistroFine: (v: string) => void

  cantiereRegistroConcluso: boolean
  setCantiereRegistroConcluso: (v: boolean) => void

  salvaModificaRegistroCantiere: (id: any) => void | Promise<void>
  annullaModificaRegistroCantiere: () => void
  preparaModificaRegistroCantiere: (c: any) => void
  eliminaCantiere: (nome: string) => void | Promise<void>

  excelBox: CSSProperties
  excelToolbar: CSSProperties
  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
  excelInput: CSSProperties

  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function RegistroCantieriPanel({
  cantieri,
  registroCerca,
  formatMoney,
  ordinaRegistro,
  ordinaCantieriCampo,
  ordinaCantieriDirezione,
  setOrdinaCantieriCampo,
  setOrdinaCantieriDirezione,
  cantiereRegistroEdit,
  cantiereRegistroNome,
  setCantiereRegistroNome,
  cantiereRegistroPreventivo,
  setCantiereRegistroPreventivo,
  cantiereRegistroInizio,
  setCantiereRegistroInizio,
  cantiereRegistroFine,
  setCantiereRegistroFine,
  cantiereRegistroConcluso,
  setCantiereRegistroConcluso,
  salvaModificaRegistroCantiere,
  annullaModificaRegistroCantiere,
  preparaModificaRegistroCantiere,
  eliminaCantiere,
  excelBox,
  excelToolbar,
  excelTable,
  excelTh,
  excelTd,
  excelInput,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const cantieriFiltrati = [...cantieri]
    .filter((c) =>
      String(c.nome || '')
        .toLowerCase()
        .includes(registroCerca.toLowerCase())
    )
    .sort((a, b) => {
      const valoreA = (a as any)[ordinaCantieriCampo] || ''
      const valoreB = (b as any)[ordinaCantieriCampo] || ''

      if (typeof valoreA === 'number') {
        return ordinaCantieriDirezione === 'asc'
          ? valoreA - valoreB
          : valoreB - valoreA
      }

      return ordinaCantieriDirezione === 'asc'
        ? String(valoreA).localeCompare(String(valoreB))
        : String(valoreB).localeCompare(String(valoreA))
    })

  return (
    <div style={excelBox}>
      <div style={excelToolbar}>
        <strong>🏗️ Registro cantieri</strong>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={excelTable}>
          <thead>
            <tr>
              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'nome',
                    setOrdinaCantieriCampo,
                    setOrdinaCantieriDirezione,
                    ordinaCantieriCampo
                  )
                }
              >
                Nome ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'preventivo',
                    setOrdinaCantieriCampo,
                    setOrdinaCantieriDirezione,
                    ordinaCantieriCampo
                  )
                }
              >
                Preventivo ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'data_inizio_lavori',
                    setOrdinaCantieriCampo,
                    setOrdinaCantieriDirezione,
                    ordinaCantieriCampo
                  )
                }
              >
                Inizio ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'data_fine_lavori',
                    setOrdinaCantieriCampo,
                    setOrdinaCantieriDirezione,
                    ordinaCantieriCampo
                  )
                }
              >
                Fine ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'lavori_conclusi',
                    setOrdinaCantieriCampo,
                    setOrdinaCantieriDirezione,
                    ordinaCantieriCampo
                  )
                }
              >
                Concluso ↕
              </th>

              <th style={excelTh}>Azioni</th>
            </tr>
          </thead>

          <tbody>
            {cantieriFiltrati.map((c, i) => (
              <tr
                key={c.id || i}
                style={{
                  backgroundColor:
                    cantiereRegistroEdit === c.id ? '#eff6ff' : '#fff',
                }}
              >
                <td style={excelTd}>
                  {cantiereRegistroEdit === c.id ? (
                    <input
                      value={cantiereRegistroNome}
                      onChange={(e) =>
                        setCantiereRegistroNome(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    c.nome || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {cantiereRegistroEdit === c.id ? (
                    <input
                      value={cantiereRegistroPreventivo}
                      onChange={(e) =>
                        setCantiereRegistroPreventivo(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    formatMoney(Number(c.preventivo || 0))
                  )}
                </td>

                <td style={excelTd}>
                  {cantiereRegistroEdit === c.id ? (
                    <input
                      type="date"
                      value={cantiereRegistroInizio}
                      onChange={(e) =>
                        setCantiereRegistroInizio(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    c.data_inizio_lavori || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {cantiereRegistroEdit === c.id ? (
                    <input
                      type="date"
                      value={cantiereRegistroFine}
                      onChange={(e) =>
                        setCantiereRegistroFine(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    c.data_fine_lavori || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {cantiereRegistroEdit === c.id ? (
                    <input
                      type="checkbox"
                      checked={cantiereRegistroConcluso}
                      onChange={(e) =>
                        setCantiereRegistroConcluso(e.target.checked)
                      }
                    />
                  ) : c.lavori_conclusi ? (
                    'Sì'
                  ) : (
                    'No'
                  )}
                </td>

                <td style={excelTd}>
                  {cantiereRegistroEdit === c.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => salvaModificaRegistroCantiere(c.id)}
                        style={buttonPrimary}
                      >
                        💾
                      </button>

                      <button
                        onClick={annullaModificaRegistroCantiere}
                        style={buttonSecondary}
                      >
                        ❌
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => preparaModificaRegistroCantiere(c)}
                        style={buttonSecondary}
                      >
                        ✏️
                      </button>

                      <button
                        onClick={() => eliminaCantiere(String(c.nome || ''))}
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