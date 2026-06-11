// app/components/RegistroPagamentiOperaiPanel.tsx

'use client'

import type { CSSProperties } from 'react'

type Props = {
  pagamentiOperai: any[]
  registroCerca: string
  formatMoney: (v: any) => string

  ordinaRegistro: (...args: any[]) => void
  ordinaPagamentiCampo: string
  ordinaPagamentiDirezione: 'asc' | 'desc'
  setOrdinaPagamentiCampo: (v: any) => void
  setOrdinaPagamentiDirezione: (v: any) => void

  pagamentoOperaioRegistroEdit: string | null

  pagamentoOperaioRegistroNome: string
  setPagamentoOperaioRegistroNome: (v: string) => void

  pagamentoOperaioRegistroImporto: string
  setPagamentoOperaioRegistroImporto: (v: string) => void

  pagamentoOperaioRegistroData: string
  setPagamentoOperaioRegistroData: (v: string) => void

  pagamentoOperaioRegistroMetodo: string
  setPagamentoOperaioRegistroMetodo: (v: string) => void

  pagamentoOperaioRegistroNota: string
  setPagamentoOperaioRegistroNota: (v: string) => void

  salvaModificaRegistroPagamentoOperaio: (id: any) => void | Promise<void>
  annullaModificaRegistroPagamentoOperaio: () => void
  preparaModificaRegistroPagamentoOperaio: (p: any) => void
  eliminaPagamentoOperaio: (id: any) => void | Promise<void>

  excelBox: CSSProperties
  excelToolbar: CSSProperties
  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
  excelInput: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function RegistroPagamentiOperaiPanel({
  pagamentiOperai,
  registroCerca,
  formatMoney,
  ordinaRegistro,
  ordinaPagamentiCampo,
  ordinaPagamentiDirezione,
  setOrdinaPagamentiCampo,
  setOrdinaPagamentiDirezione,
  pagamentoOperaioRegistroEdit,
  pagamentoOperaioRegistroNome,
  setPagamentoOperaioRegistroNome,
  pagamentoOperaioRegistroImporto,
  setPagamentoOperaioRegistroImporto,
  pagamentoOperaioRegistroData,
  setPagamentoOperaioRegistroData,
  pagamentoOperaioRegistroMetodo,
  setPagamentoOperaioRegistroMetodo,
  pagamentoOperaioRegistroNota,
  setPagamentoOperaioRegistroNota,
  salvaModificaRegistroPagamentoOperaio,
  annullaModificaRegistroPagamentoOperaio,
  preparaModificaRegistroPagamentoOperaio,
  eliminaPagamentoOperaio,
  excelBox,
  excelToolbar,
  excelTable,
  excelTh,
  excelTd,
  excelInput,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const pagamentiFiltrati = [...pagamentiOperai]
    .filter((p) =>
      String(p.operaio_nome || '')
        .toLowerCase()
        .includes(registroCerca.toLowerCase())
    )
    .sort((a, b) => {
      const valoreA = (a as any)[ordinaPagamentiCampo] || ''
      const valoreB = (b as any)[ordinaPagamentiCampo] || ''

      if (typeof valoreA === 'number') {
        return ordinaPagamentiDirezione === 'asc'
          ? valoreA - valoreB
          : valoreB - valoreA
      }

      return ordinaPagamentiDirezione === 'asc'
        ? String(valoreA).localeCompare(String(valoreB))
        : String(valoreB).localeCompare(String(valoreA))
    })

  return (
    <div style={excelBox}>
      <div
        style={{
          ...excelToolbar,
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 4,
        }}
      >
        <strong>💳 Registro pagamenti operai</strong>

        <span
          style={{
            fontSize: 12,
            color: '#64748b',
            fontWeight: 500,
          }}
        >
          Gestione pagamenti e movimenti operai
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={excelTable}>
          <thead>
            <tr>
              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'operaio_nome',
                    setOrdinaPagamentiCampo,
                    setOrdinaPagamentiDirezione,
                    ordinaPagamentiCampo
                  )
                }
              >
                Operaio ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'importo',
                    setOrdinaPagamentiCampo,
                    setOrdinaPagamentiDirezione,
                    ordinaPagamentiCampo
                  )
                }
              >
                Importo ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'data_pagamento',
                    setOrdinaPagamentiCampo,
                    setOrdinaPagamentiDirezione,
                    ordinaPagamentiCampo
                  )
                }
              >
                Data ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'metodo',
                    setOrdinaPagamentiCampo,
                    setOrdinaPagamentiDirezione,
                    ordinaPagamentiCampo
                  )
                }
              >
                Metodo ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'nota',
                    setOrdinaPagamentiCampo,
                    setOrdinaPagamentiDirezione,
                    ordinaPagamentiCampo
                  )
                }
              >
                Nota ↕
              </th>

              <th style={excelTh}>Azioni</th>
            </tr>
          </thead>

          <tbody>
            {pagamentiFiltrati.map((p, i) => (
              <tr
                key={p.id || i}
                style={{
                  backgroundColor:
                    pagamentoOperaioRegistroEdit === String(p.id)
                      ? '#eff6ff'
                      : '#fff',
                }}
              >
                <td style={excelTd}>
                  {pagamentoOperaioRegistroEdit === String(p.id) ? (
                    <input
                      value={pagamentoOperaioRegistroNome}
                      onChange={(e) =>
                        setPagamentoOperaioRegistroNome(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    p.operaio_nome || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {pagamentoOperaioRegistroEdit === String(p.id) ? (
                    <input
                      value={pagamentoOperaioRegistroImporto}
                      onChange={(e) =>
                        setPagamentoOperaioRegistroImporto(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    formatMoney(Number(p.importo || 0))
                  )}
                </td>

                <td style={excelTd}>
                  {pagamentoOperaioRegistroEdit === String(p.id) ? (
                    <input
                      type="date"
                      value={pagamentoOperaioRegistroData}
                      onChange={(e) =>
                        setPagamentoOperaioRegistroData(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    p.data_pagamento || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {pagamentoOperaioRegistroEdit === String(p.id) ? (
                    <input
                      value={pagamentoOperaioRegistroMetodo}
                      onChange={(e) =>
                        setPagamentoOperaioRegistroMetodo(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    p.metodo || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {pagamentoOperaioRegistroEdit === String(p.id) ? (
                    <input
                      value={pagamentoOperaioRegistroNota}
                      onChange={(e) =>
                        setPagamentoOperaioRegistroNota(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    p.nota || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {pagamentoOperaioRegistroEdit === String(p.id) ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() =>
                          salvaModificaRegistroPagamentoOperaio(p.id)
                        }
                        style={buttonPrimary}
                      >
                        💾
                      </button>

                      <button
                        onClick={annullaModificaRegistroPagamentoOperaio}
                        style={buttonSecondary}
                      >
                        ❌
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() =>
                          preparaModificaRegistroPagamentoOperaio(p)
                        }
                        style={buttonSecondary}
                      >
                        ✏️
                      </button>

                      <button
                        onClick={() => eliminaPagamentoOperaio(p.id)}
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