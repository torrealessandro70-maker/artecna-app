'use client'

import type { CSSProperties, Dispatch, SetStateAction } from 'react'

type Props = {
  speseImpresa: any[]
  filtroSpeseImpresa: string
  setFiltroSpeseImpresa: Dispatch<SetStateAction<string>>
  tabellaSpeseImpresaAperta: boolean
  setTabellaSpeseImpresaAperta: Dispatch<SetStateAction<boolean>>
  ordineSpeseCampo: string
  ordineSpeseDirezione: 'asc' | 'desc'
  ordinaSpeseImpresa: (campo: string) => void

  formatMoney: (valore: any) => string

  inputStyle: CSSProperties
  buttonSecondary: CSSProperties
  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
}

export default function TabellaSpeseImpresaPanel({
  speseImpresa,
  filtroSpeseImpresa,
  setFiltroSpeseImpresa,
  tabellaSpeseImpresaAperta,
  setTabellaSpeseImpresaAperta,
  ordineSpeseCampo,
  ordineSpeseDirezione,
  ordinaSpeseImpresa,
  formatMoney,
  inputStyle,
  buttonSecondary,
  excelTable,
  excelTh,
  excelTd,
}: Props) {
  return (
    <>
      <h3 style={{ marginTop: 30 }}>🏢 Costi generali impresa</h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <strong>🛠 Attrezzi / beni ditta</strong>
          <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}>
            {formatMoney(
              speseImpresa
                .filter((s) => s.categoria === 'attrezzo_ditta')
                .reduce((tot, s) => tot + Number(s.importo || 0), 0)
            )}
          </div>
        </div>

        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <strong>🏬 Magazzino</strong>
          <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}>
            {formatMoney(
              speseImpresa
                .filter((s) => s.categoria === 'magazzino')
                .reduce((tot, s) => tot + Number(s.importo || 0), 0)
            )}
          </div>
        </div>

        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <strong>📑 Spese generali</strong>
          <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}>
            {formatMoney(
              speseImpresa
                .filter((s) => s.categoria === 'spesa_generale')
                .reduce((tot, s) => tot + Number(s.importo || 0), 0)
            )}
          </div>
        </div>

        <div
          style={{
            padding: 12,
            border: '2px solid #dc2626',
            borderRadius: 8,
            background: '#fef2f2',
          }}
        >
          <strong>📉 Totale costi generali</strong>
          <div
            style={{
              marginTop: 6,
              fontSize: 20,
              fontWeight: 700,
              color: '#dc2626',
            }}
          >
            {formatMoney(
              speseImpresa.reduce((tot, s) => tot + Number(s.importo || 0), 0)
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() =>
          setTabellaSpeseImpresaAperta(!tabellaSpeseImpresaAperta)
        }
        style={{ ...buttonSecondary, marginBottom: 10 }}
      >
        {tabellaSpeseImpresaAperta
          ? '🔽 Nascondi dettaglio spese'
          : '📋 Mostra dettaglio spese'}
      </button>

      {tabellaSpeseImpresaAperta && (
        <>
          <div
            style={{
              display: 'flex',
              gap: 10,
              marginBottom: 10,
              flexWrap: 'wrap',
            }}
          >
            <select
              value={filtroSpeseImpresa}
              onChange={(e) => setFiltroSpeseImpresa(e.target.value)}
              style={inputStyle}
            >
              <option value="">Tutte le categorie</option>
              <option value="attrezzo_ditta">Attrezzi / beni ditta</option>
              <option value="magazzino">Magazzino</option>
              <option value="spesa_generale">Spese generali</option>
              <option value="storno_escluso">🚫 Storni esclusi</option>
            </select>

            <button
              onClick={() => setFiltroSpeseImpresa('')}
              style={buttonSecondary}
            >
              Azzera filtro
            </button>
          </div>

          <div
            style={{
              maxHeight: 360,
              overflow: 'auto',
              border: '1px solid #cbd5e1',
              borderRadius: 10,
              background: '#fff',
              marginBottom: 20,
            }}
          >
            <table
              style={{
                ...excelTable,
                tableLayout: 'auto',
                width: 'max-content',
                minWidth: '100%',
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{ ...excelTh, cursor: 'pointer' }}
                    onClick={() => ordinaSpeseImpresa('categoria')}
                  >
                    Categoria
                  </th>

                  <th
                    style={{ ...excelTh, cursor: 'pointer' }}
                    onClick={() => ordinaSpeseImpresa('descrizione')}
                  >
                    Descrizione
                  </th>

                  <th
                    style={{ ...excelTh, cursor: 'pointer' }}
                    onClick={() => ordinaSpeseImpresa('fornitore')}
                  >
                    Fornitore
                  </th>

                  <th
                    style={{ ...excelTh, cursor: 'pointer' }}
                    onClick={() => ordinaSpeseImpresa('data_documento')}
                  >
                    Data
                  </th>

                  <th
                    style={{ ...excelTh, cursor: 'pointer' }}
                    onClick={() => ordinaSpeseImpresa('importo')}
                  >
                    Importo
                  </th>

                  <th style={excelTh}>File</th>
                </tr>
              </thead>

              <tbody>
                {[...speseImpresa]
                  .filter(
                    (s) =>
                      !filtroSpeseImpresa ||
                      s.categoria === filtroSpeseImpresa
                  )
                  .sort((a, b) => {
                    const valoreA = a[ordineSpeseCampo] ?? ''
                    const valoreB = b[ordineSpeseCampo] ?? ''

                    if (
                      typeof valoreA === 'number' &&
                      typeof valoreB === 'number'
                    ) {
                      return ordineSpeseDirezione === 'asc'
                        ? valoreA - valoreB
                        : valoreB - valoreA
                    }

                    return ordineSpeseDirezione === 'asc'
                      ? String(valoreA).localeCompare(String(valoreB))
                      : String(valoreB).localeCompare(String(valoreA))
                  })
                  .map((s, i) => (
                    <tr key={s.id || i}>
                      <td style={excelTd}>{s.categoria}</td>
                      <td style={excelTd}>{s.descrizione}</td>
                      <td style={excelTd}>{s.fornitore}</td>
                      <td style={excelTd}>{s.data_documento || '-'}</td>
                      <td style={excelTd}>
                        {formatMoney(Number(s.importo || 0))}
                      </td>
                      <td style={excelTd}>{s.nome_file || '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}