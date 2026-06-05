'use client'

import type { CSSProperties } from 'react'

type Props = {
  mostraDettaglioMateriali: boolean
  setMostraDettaglioMateriali: (v: boolean) => void
  totaleMaterialiEconomia: number
  materialiCantiere: any[]
  cantiereScheda: string
  economiaDataDa: string
  economiaDataA: string
  cercaMaterialeManuale: string
  setCercaMaterialeManuale: (v: string) => void
  materialeManualeDescrizione: string
  setMaterialeManualeDescrizione: (v: string) => void
  materialeManualeQuantita: string
  setMaterialeManualeQuantita: (v: string) => void
  materialeManualePrezzo: string
  setMaterialeManualePrezzo: (v: string) => void
  materialeManualeFornitore: string
  setMaterialeManualeFornitore: (v: string) => void
  materialeManualeNota: string
  setMaterialeManualeNota: (v: string) => void
  salvaMaterialeManuale: () => void | Promise<void>
  eliminaMaterialeCantiere: (id?: string) => void | Promise<void>
  ordinaMateriali: (campo: string) => void
  ordineMaterialiCampo: string
  ordineMaterialiDirezione: 'asc' | 'desc'
  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
  inputStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
  formatMoney: (v: number) => string
}

export default function MaterialiEconomiaPanel({
  mostraDettaglioMateriali,
  setMostraDettaglioMateriali,
  totaleMaterialiEconomia,
  materialiCantiere,
  cantiereScheda,
  economiaDataDa,
  economiaDataA,
  cercaMaterialeManuale,
  setCercaMaterialeManuale,
  materialeManualeDescrizione,
  setMaterialeManualeDescrizione,
  materialeManualeQuantita,
  setMaterialeManualeQuantita,
  materialeManualePrezzo,
  setMaterialeManualePrezzo,
  materialeManualeFornitore,
  setMaterialeManualeFornitore,
  materialeManualeNota,
  setMaterialeManualeNota,
  salvaMaterialeManuale,
  eliminaMaterialeCantiere,
  ordinaMateriali,
  ordineMaterialiCampo,
  ordineMaterialiDirezione,
  excelTable,
  excelTh,
  excelTd,
  inputStyle,
  buttonPrimary,
  buttonSecondary,
  formatMoney,
}: Props) {
  const materialiVisibili = materialiCantiere
    .filter((m) => {
      if (m.cantiere !== cantiereScheda) return false

      if (economiaDataDa && String(m.data_documento || '') < economiaDataDa) {
        return false
      }

      if (economiaDataA && String(m.data_documento || '') > economiaDataA) {
        return false
      }

      if (
        cercaMaterialeManuale &&
        !String(m.descrizione || '')
          .toLowerCase()
          .includes(cercaMaterialeManuale.toLowerCase())
      ) {
        return false
      }

      return true
    })
    .sort((a: any, b: any) => {
      const campo = ordineMaterialiCampo

      let valoreA: any = a[campo] || ''
      let valoreB: any = b[campo] || ''

      if (
        campo === 'quantita' ||
        campo === 'prezzo_unitario' ||
        campo === 'totale'
      ) {
        valoreA = Number(valoreA || 0)
        valoreB = Number(valoreB || 0)

        return ordineMaterialiDirezione === 'asc'
          ? valoreA - valoreB
          : valoreB - valoreA
      }

      valoreA = String(valoreA).toLowerCase()
      valoreB = String(valoreB).toLowerCase()

      return ordineMaterialiDirezione === 'asc'
        ? valoreA.localeCompare(valoreB)
        : valoreB.localeCompare(valoreA)
    })

  return (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <strong>Materiali:</strong> {formatMoney(totaleMaterialiEconomia)}

      <button
        onClick={() => setMostraDettaglioMateriali(!mostraDettaglioMateriali)}
        style={{ ...buttonSecondary, marginLeft: 10 }}
      >
        {mostraDettaglioMateriali ? 'Nascondi materiali' : 'Vedi materiali'}
      </button>

      {mostraDettaglioMateriali && (
        <div
          style={{
            marginTop: 12,
            overflow: 'auto',
            border: '1px solid #cbd5e1',
            borderRadius: 10,
            background: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            maxHeight: '65vh',
          }}
        >
          <div
            style={{
              padding: 15,
              border: '1px solid #cbd5e1',
              borderRadius: 12,
              marginBottom: 20,
              background: '#f8fafc',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <h3>➕ Inserimento materiale manuale</h3>

              <input
                placeholder="Cerca materiale..."
                value={cercaMaterialeManuale}
                onChange={(e) => setCercaMaterialeManuale(e.target.value)}
                style={{
                  ...inputStyle,
                  maxWidth: 280,
                }}
              />
            </div>

            <input
              placeholder="Descrizione materiale"
              value={materialeManualeDescrizione}
              onChange={(e) =>
                setMaterialeManualeDescrizione(e.target.value)
              }
              style={{
                ...inputStyle,
                width: '100%',
                marginBottom: 8,
              }}
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 10,
              }}
            >
              <input
                placeholder="Quantità"
                value={materialeManualeQuantita}
                onChange={(e) =>
                  setMaterialeManualeQuantita(e.target.value)
                }
                style={inputStyle}
              />

              <input
                placeholder="Prezzo unitario €"
                value={materialeManualePrezzo}
                onChange={(e) =>
                  setMaterialeManualePrezzo(e.target.value)
                }
                style={inputStyle}
              />

              <input
                placeholder="Fornitore / provenienza"
                value={materialeManualeFornitore}
                onChange={(e) =>
                  setMaterialeManualeFornitore(e.target.value)
                }
                style={inputStyle}
              />
            </div>

            <textarea
              placeholder="Nota"
              value={materialeManualeNota}
              onChange={(e) => setMaterialeManualeNota(e.target.value)}
              style={{
                ...inputStyle,
                width: '100%',
                minHeight: 70,
                marginTop: 10,
              }}
            />

            <button
              onClick={salvaMaterialeManuale}
              style={{
                ...buttonPrimary,
                marginTop: 12,
              }}
            >
              💾 Salva materiale
            </button>
          </div>

          {materialiCantiere.filter((m) => m.cantiere === cantiereScheda)
            .length === 0 ? (
            <p style={{ padding: 12 }}>
              Nessun materiale registrato per questo cantiere.
            </p>
          ) : (
            <table
              style={{
                ...excelTable,
                tableLayout: 'auto',
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr>
                  <th
                    onClick={() => ordinaMateriali('data_documento')}
                    style={{
                      ...excelTh,
                      cursor: 'pointer',
                      whiteSpace: 'normal',
                    }}
                  >
                    Data ↕
                  </th>

                  <th
                    onClick={() => ordinaMateriali('descrizione')}
                    style={{
                      ...excelTh,
                      cursor: 'pointer',
                      whiteSpace: 'normal',
                    }}
                  >
                    Descrizione ↕
                  </th>

                  <th
                    onClick={() => ordinaMateriali('fornitore')}
                    style={{
                      ...excelTh,
                      cursor: 'pointer',
                      whiteSpace: 'normal',
                    }}
                  >
                    Fornitore ↕
                  </th>

                  <th
                    onClick={() => ordinaMateriali('quantita')}
                    style={{
                      ...excelTh,
                      cursor: 'pointer',
                      whiteSpace: 'normal',
                    }}
                  >
                    Q.tà ↕
                  </th>

                  <th
                    onClick={() => ordinaMateriali('prezzo_unitario')}
                    style={{
                      ...excelTh,
                      cursor: 'pointer',
                      whiteSpace: 'normal',
                    }}
                  >
                    Prezzo unit. ↕
                  </th>

                  <th
                    onClick={() => ordinaMateriali('totale')}
                    style={{
                      ...excelTh,
                      cursor: 'pointer',
                      whiteSpace: 'normal',
                    }}
                  >
                    Totale ↕
                  </th>

                  <th
                    onClick={() => ordinaMateriali('nome_file')}
                    style={{
                      ...excelTh,
                      cursor: 'pointer',
                      whiteSpace: 'normal',
                    }}
                  >
                    File ↕
                  </th>

                  <th style={{ ...excelTh, whiteSpace: 'normal' }}>
                    Azioni
                  </th>
                </tr>
              </thead>

              <tbody>
                {materialiVisibili.map((m, i) => (
                  <tr key={m.id || i}>
                    <td
                      style={{
                        ...excelTd,
                        padding: '5px 8px',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        verticalAlign: 'top',
                      }}
                    >
                      {m.data_documento || '-'}
                    </td>

                    <td
                      style={{
                        ...excelTd,
                        padding: '5px 8px',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                        verticalAlign: 'top',
                      }}
                    >
                      {cercaMaterialeManuale &&
                      String(m.descrizione || '')
                        .toLowerCase()
                        .includes(cercaMaterialeManuale.toLowerCase()) ? (
                        <>
                          {String(m.descrizione || '')
                            .split(
                              new RegExp(
                                `(${cercaMaterialeManuale})`,
                                'gi'
                              )
                            )
                            .map((parte: string, idx: number) =>
                              parte.toLowerCase() ===
                              cercaMaterialeManuale.toLowerCase() ? (
                                <mark
                                  key={idx}
                                  style={{
                                    background: '#fde047',
                                    padding: '0 2px',
                                    borderRadius: 3,
                                  }}
                                >
                                  {parte}
                                </mark>
                              ) : (
                                parte
                              )
                            )}
                        </>
                      ) : (
                        m.descrizione || '-'
                      )}
                    </td>

                    <td
                      style={{
                        ...excelTd,
                        padding: '5px 8px',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        verticalAlign: 'top',
                      }}
                    >
                      {m.fornitore || '-'}
                    </td>

                    <td
                      style={{
                        ...excelTd,
                        padding: '5px 8px',
                        whiteSpace: 'normal',
                        verticalAlign: 'top',
                      }}
                    >
                      {m.quantita ?? '-'}
                    </td>

                    <td
                      style={{
                        ...excelTd,
                        padding: '5px 8px',
                        whiteSpace: 'normal',
                        verticalAlign: 'top',
                      }}
                    >
                      {formatMoney(Number(m.prezzo_unitario || 0))}
                    </td>

                    <td
                      style={{
                        ...excelTd,
                        padding: '5px 8px',
                        whiteSpace: 'normal',
                        verticalAlign: 'top',
                      }}
                    >
                      <strong>{formatMoney(Number(m.totale || 0))}</strong>
                    </td>

                    <td
                      style={{
                        ...excelTd,
                        padding: '5px 8px',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                        verticalAlign: 'top',
                      }}
                    >
                      {m.nome_file || '-'}
                    </td>

                    <td
                      style={{
                        ...excelTd,
                        padding: '5px 8px',
                        whiteSpace: 'normal',
                        verticalAlign: 'top',
                      }}
                    >
                      <button
                        onClick={() => eliminaMaterialeCantiere(String(m.id))}
                        style={{
                          ...buttonSecondary,
                          backgroundColor: '#dc2626',
                          color: '#fff',
                        }}
                      >
                        🗑 Elimina
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}