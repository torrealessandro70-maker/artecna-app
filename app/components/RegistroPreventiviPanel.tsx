'use client'

import type { CSSProperties } from 'react'

type Props = {
  preventivi: any[]
  registroCerca: string
  mostraRegistroPreventiviCaricati: boolean
  setMostraRegistroPreventiviCaricati: (v: boolean) => void

  preventivoRegistroEdit: string | null
  setPreventivoRegistroEdit: (v: string | null) => void

  preventivoRegistroCantiere: string
  setPreventivoRegistroCantiere: (v: string) => void

  preventivoRegistroNomeFile: string
  setPreventivoRegistroNomeFile: (v: string) => void

  preventivoRegistroImporto: string
  setPreventivoRegistroImporto: (v: string) => void

  preventivoRegistroNote: string
  setPreventivoRegistroNote: (v: string) => void

  ordinaPreventiviCampo: string
  ordinaPreventiviDirezione: 'asc' | 'desc'
  setOrdinaPreventiviCampo: (v: any) => void
  setOrdinaPreventiviDirezione: (v: any) => void
  ordinaRegistro: (...args: any[]) => void

  parseImporto: (v: any) => number
  formatMoney: (v: any) => string

  generaExcelDaPreventivoAi: (p: any) => void | Promise<void>
  approvaPreventivoAiECreaCantiere: (p: any) => void | Promise<void>
  salvaModificaRegistroPreventivo: (id: any) => void | Promise<void>
  eliminaPreventivoCantiere: (id: any) => void | Promise<void>

  setVociPreventivoAi: (v: any[]) => void
  setVociPreventivoAiOriginali: (v: any[]) => void
  setDescrizionePreventivoAi: (v: string) => void
  setPreventivoAiGenerato: (v: any) => void
  setMostraRevisionePreventivoAi: (v: boolean) => void

  excelBox: CSSProperties
  excelToolbar: CSSProperties
  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
  excelInput: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function RegistroPreventiviPanel({
  preventivi,
  registroCerca,
  mostraRegistroPreventiviCaricati,
  setMostraRegistroPreventiviCaricati,
  preventivoRegistroEdit,
  setPreventivoRegistroEdit,
  preventivoRegistroCantiere,
  setPreventivoRegistroCantiere,
  preventivoRegistroNomeFile,
  setPreventivoRegistroNomeFile,
  preventivoRegistroImporto,
  setPreventivoRegistroImporto,
  preventivoRegistroNote,
  setPreventivoRegistroNote,
  ordinaPreventiviCampo,
  ordinaPreventiviDirezione,
  setOrdinaPreventiviCampo,
  setOrdinaPreventiviDirezione,
  ordinaRegistro,
  parseImporto,
  formatMoney,
  generaExcelDaPreventivoAi,
  approvaPreventivoAiECreaCantiere,
  salvaModificaRegistroPreventivo,
  eliminaPreventivoCantiere,
  setVociPreventivoAi,
  setVociPreventivoAiOriginali,
  setDescrizionePreventivoAi,
  setPreventivoAiGenerato,
  setMostraRevisionePreventivoAi,
  excelBox,
  excelToolbar,
  excelTable,
  excelTh,
  excelTd,
  excelInput,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const preventiviFiltrati = [...preventivi]
    .filter(
      (p) =>
        String(p.cantiere || '')
          .toLowerCase()
          .includes(registroCerca.toLowerCase()) ||
        String(p.nome_file || '')
          .toLowerCase()
          .includes(registroCerca.toLowerCase())
    )
    .sort((a, b) => {
      const valoreA = (a as any)[ordinaPreventiviCampo] || ''
      const valoreB = (b as any)[ordinaPreventiviCampo] || ''

      if (typeof valoreA === 'number') {
        return ordinaPreventiviDirezione === 'asc'
          ? valoreA - valoreB
          : valoreB - valoreA
      }

      return ordinaPreventiviDirezione === 'asc'
        ? String(valoreA).localeCompare(String(valoreB))
        : String(valoreB).localeCompare(String(valoreA))
    })
    .slice(0, mostraRegistroPreventiviCaricati ? undefined : 1)

  return (
    <div style={excelBox}>
      <div style={excelToolbar}>
        <strong>📄 Registro preventivi caricati</strong>
      </div>

      <button
        type="button"
        onClick={() =>
          setMostraRegistroPreventiviCaricati(
            !mostraRegistroPreventiviCaricati
          )
        }
        style={{
          ...buttonSecondary,
          marginTop: 15,
        }}
      >
        {mostraRegistroPreventiviCaricati
          ? 'Nascondi registro preventivi caricati'
          : '📂 Mostra registro preventivi caricati'}
      </button>

      <div style={{ overflowX: 'auto' }}>
        <table style={excelTable}>
          <thead>
            <tr>
              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'cantiere',
                    setOrdinaPreventiviCampo,
                    setOrdinaPreventiviDirezione,
                    ordinaPreventiviCampo
                  )
                }
              >
                Cantiere ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'nome_file',
                    setOrdinaPreventiviCampo,
                    setOrdinaPreventiviDirezione,
                    ordinaPreventiviCampo
                  )
                }
              >
                Nome file ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'importo_totale',
                    setOrdinaPreventiviCampo,
                    setOrdinaPreventiviDirezione,
                    ordinaPreventiviCampo
                  )
                }
              >
                Importo ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'note',
                    setOrdinaPreventiviCampo,
                    setOrdinaPreventiviDirezione,
                    ordinaPreventiviCampo
                  )
                }
              >
                Note ↕
              </th>

              <th style={excelTh}>Azioni</th>
            </tr>
          </thead>

          <tbody>
            {preventiviFiltrati.map((p, i) => (
              <tr
                key={p.id || i}
                style={{
                  backgroundColor:
                    preventivoRegistroEdit === String(p.id)
                      ? '#eff6ff'
                      : '#fff',
                }}
              >
                <td style={excelTd}>
                  {preventivoRegistroEdit === String(p.id) ? (
                    <input
                      value={preventivoRegistroCantiere}
                      onChange={(e) =>
                        setPreventivoRegistroCantiere(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    p.cantiere || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {preventivoRegistroEdit === String(p.id) ? (
                    <input
                      value={preventivoRegistroNomeFile}
                      onChange={(e) =>
                        setPreventivoRegistroNomeFile(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    p.nome_file || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {preventivoRegistroEdit === String(p.id) ? (
                    <input
                      value={preventivoRegistroImporto}
                      onChange={(e) =>
                        setPreventivoRegistroImporto(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    formatMoney(parseImporto(p.importo_totale))
                  )}
                </td>

                <td style={excelTd}>
                  {preventivoRegistroEdit === String(p.id) ? (
                    <input
                      value={preventivoRegistroNote}
                      onChange={(e) =>
                        setPreventivoRegistroNote(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    p.note || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {preventivoRegistroEdit === String(p.id) ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {p.origine_ai && (
                        <>
                          <button
                            onClick={() => generaExcelDaPreventivoAi(p)}
                            style={{
                              ...buttonPrimary,
                              backgroundColor: '#9333ea',
                            }}
                          >
                            📄 Genera Excel AI
                          </button>

                          <button
                            onClick={() => {
                              const originali = JSON.parse(
                                JSON.stringify(p.json_voci_ai || [])
                              )

                              setVociPreventivoAi(originali)
                              setVociPreventivoAiOriginali(originali)
                              setDescrizionePreventivoAi(
                                p.descrizione_ai || ''
                              )
                              setPreventivoAiGenerato(p)
                              setMostraRevisionePreventivoAi(true)
                            }}
                            style={{
                              ...buttonSecondary,
                              backgroundColor: '#f59e0b',
                              color: '#fff',
                            }}
                          >
                            🤖 Revisione AI
                          </button>
                        </>
                      )}

                      {p.origine_ai && !p.approvato && (
                        <button
                          onClick={() => approvaPreventivoAiECreaCantiere(p)}
                          style={{
                            ...buttonPrimary,
                            backgroundColor: '#16a34a',
                          }}
                        >
                          ✅ Approva e crea cantiere
                        </button>
                      )}

                      <button
                        onClick={() => salvaModificaRegistroPreventivo(p.id)}
                        style={buttonPrimary}
                      >
                        💾
                      </button>

                      <button
                        onClick={() => {
                          setPreventivoRegistroEdit(null)
                          setPreventivoRegistroCantiere('')
                          setPreventivoRegistroNomeFile('')
                          setPreventivoRegistroImporto('')
                          setPreventivoRegistroNote('')
                        }}
                        style={buttonSecondary}
                      >
                        ❌
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => {
                          setPreventivoRegistroEdit(String(p.id))
                          setPreventivoRegistroCantiere(p.cantiere || '')
                          setPreventivoRegistroNomeFile(p.nome_file || '')
                          setPreventivoRegistroImporto(
                            String(p.importo_totale || '')
                          )
                          setPreventivoRegistroNote(p.note || '')
                        }}
                        style={buttonSecondary}
                      >
                        ✏️
                      </button>

                      <button
                        onClick={() => eliminaPreventivoCantiere(p.id)}
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
