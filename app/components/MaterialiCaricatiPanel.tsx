'use client'

import type { CSSProperties } from 'react'

type Props = {
  mostraMaterialiCantiere: boolean
  setMostraMaterialiCantiere: (v: boolean) => void
  materialiCantiere: any[]
  cantiereScheda: string
  economiaDataDa: string
  economiaDataA: string
  buttonSecondary: CSSProperties
  formatMoney: (v: number) => string
  eliminaFileDaStorage: (path?: string | null) => Promise<void>
  caricaEconomia: () => Promise<void>
  supabase: any
}

export default function MaterialiCaricatiPanel({
  mostraMaterialiCantiere,
  setMostraMaterialiCantiere,
  materialiCantiere,
  cantiereScheda,
  economiaDataDa,
  economiaDataA,
  buttonSecondary,
  formatMoney,
  eliminaFileDaStorage,
  caricaEconomia,
  supabase,
}: Props) {
  const materialiFiltrati = materialiCantiere.filter((m) => {
    if (m.cantiere !== cantiereScheda) return false

    if (economiaDataDa && String(m.data_documento || '') < economiaDataDa) {
      return false
    }

    if (economiaDataA && String(m.data_documento || '') > economiaDataA) {
      return false
    }

    return true
  })

  return (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <strong>Materiali caricati:</strong>

      <button
        onClick={() => setMostraMaterialiCantiere(!mostraMaterialiCantiere)}
        style={{ ...buttonSecondary, marginLeft: 10 }}
      >
        {mostraMaterialiCantiere ? 'Nascondi anteprima' : 'Vedi anteprima materiali'}
      </button>

      {materialiCantiere.filter((m) => m.cantiere === cantiereScheda).length === 0 ? (
        <p>Nessun materiale caricato.</p>
      ) : (
        mostraMaterialiCantiere && (
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            {materialiFiltrati.map((m, i) => (
              <div
                key={m.id || i}
                style={{
                  padding: 12,
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  background: '#fff',
                }}
              >
                <strong>{m.nome_file || m.descrizione || `Materiale ${i + 1}`}</strong>
                <br />

                <div style={{ marginTop: 8 }}>
                  <strong>Importo:</strong> {formatMoney(Number(m.totale || 0))}
                </div>

                <br />
                Fornitore: {m.fornitore || '-'}
                <br />
                Data: {m.data_documento || '-'}

                {m.file_tipo === 'pdf' && m.file_url && (
                  <div
                    style={{
                      width: 700,
                      height: 500,
                      minWidth: 300,
                      minHeight: 250,
                      maxWidth: '100%',
                      resize: 'both',
                      overflow: 'auto',
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      marginTop: 10,
                    }}
                  >
                    <iframe
                      src={m.file_url}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                      }}
                    />
                  </div>
                )}

                {m.file_tipo === 'excel' && m.anteprima_testo && (
                  <div
                    style={{
                      marginTop: 12,
                      border: '1px solid #cbd5e1',
                      borderRadius: 10,
                      background: '#ffffff',
                      overflow: 'visible',
                    }}
                  >
                    <div
                      style={{
                        padding: '10px 12px',
                        background: '#f1f5f9',
                        borderBottom: '1px solid #cbd5e1',
                        fontWeight: 700,
                      }}
                    >
                      Anteprima Excel
                    </div>

                    <div
                      style={{
                        width: 700,
                        height: 400,
                        minWidth: 300,
                        minHeight: 250,
                        maxWidth: '100%',
                        resize: 'both',
                        overflow: 'auto',
                      }}
                    >
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: 13,
                          minWidth: 900,
                        }}
                      >
                        <tbody>
                          {(() => {
                            try {
                              const righe = JSON.parse(m.anteprima_testo)

                              return righe.map((row: any[], rigaIndex: number) => (
                                <tr key={rigaIndex}>
                                  {(Array.isArray(row) ? row : []).map(
                                    (cell, cellIndex) => (
                                      <td
                                        key={cellIndex}
                                        style={{
                                          border: '1px solid #e2e8f0',
                                          padding: '8px 10px',
                                          whiteSpace: 'normal',
                                          wordBreak: 'break-word',
                                          lineHeight: 1.4,
                                          verticalAlign: 'top',
                                          fontWeight: rigaIndex === 0 ? 700 : 400,
                                          background:
                                            rigaIndex === 0 ? '#f8fafc' : '#ffffff',
                                          maxWidth: 220,
                                        }}
                                      >
                                        {String(cell ?? '')}
                                      </td>
                                    )
                                  )}
                                </tr>
                              ))
                            } catch {
                              return (
                                <tr>
                                  <td style={{ padding: 12 }}>
                                    Anteprima Excel non leggibile
                                  </td>
                                </tr>
                              )
                            }
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {m.file_tipo === 'img' && m.file_url && (
                  <div
                    style={{
                      width: 700,
                      height: 500,
                      minWidth: 300,
                      minHeight: 250,
                      maxWidth: '100%',
                      resize: 'both',
                      overflow: 'auto',
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      marginTop: 10,
                    }}
                  >
                    <img
                      src={m.file_url}
                      style={{
                        width: '100%',
                        display: 'block',
                      }}
                    />
                  </div>
                )}

                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={async () => {
                      try {
                        await eliminaFileDaStorage(m.file_path)
                      } catch {
                        alert('Errore cancellazione file da Storage')
                        return
                      }

                      const { error } = await supabase
                        .from('materiali_cantiere')
                        .delete()
                        .eq('id', m.id)

                      if (error) {
                        alert('Errore eliminazione: ' + error.message)
                        return
                      }

                      await caricaEconomia()
                    }}
                    style={{
                      backgroundColor: '#d9534f',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Elimina materiale
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}