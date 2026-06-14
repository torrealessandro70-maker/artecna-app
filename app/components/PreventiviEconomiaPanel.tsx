'use client'

type Props = {
  preventivoCantiere: number
  mostraPreventiviCantiere: boolean
  setMostraPreventiviCantiere: (v: boolean) => void
  preventivi: any[]
  setPreventivi: any
  cantiereScheda: string
  formatMoney: (v: number) => string
  parseImporto: (v: any) => number
  supabase: any
  caricaEconomia: () => Promise<void>
  buttonSecondary: React.CSSProperties
}

export default function PreventiviEconomiaPanel({
  preventivoCantiere,
  mostraPreventiviCantiere,
  setMostraPreventiviCantiere,
  preventivi,
  setPreventivi,
  cantiereScheda,
  formatMoney,
  parseImporto,
  supabase,
  caricaEconomia,
  buttonSecondary,
}: Props) {
  return (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <strong>Preventivo totale:</strong> {formatMoney(preventivoCantiere)}

      <button
        onClick={() => setMostraPreventiviCantiere(!mostraPreventiviCantiere)}
        style={{ ...buttonSecondary, marginLeft: 10 }}
      >
        {mostraPreventiviCantiere ? 'Nascondi anteprima' : 'Vedi anteprima preventivi'}
      </button>

      {mostraPreventiviCantiere && (
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          {preventivi.filter((p) => p.cantiere === cantiereScheda).length === 0 ? (
            <p>Nessun preventivo caricato.</p>
          ) : (
            preventivi
              .filter((p) => p.cantiere === cantiereScheda)
              .slice(-1)
              .map((p, i) => (
                <div
                  key={p.id || i}
                  style={{
                    padding: 12,
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    background: '#fff',
                  }}
                >
                  <strong>{p.nome_file || `Preventivo ${i + 1}`}</strong>
                  <br />

                  <div style={{ marginTop: 8 }}>
                    <strong>Importo usato nel totale:</strong>{' '}
                    {formatMoney(
                      parseImporto(
                        (p as any).importo_corretto &&
                          String((p as any).importo_corretto).trim() !== ''
                          ? (p as any).importo_corretto
                          : p.importo_totale
                      )
                    )}
                  </div>

                  <label style={{ display: 'block', marginTop: 8 }}>
                    <strong>Correggi importo:</strong>

                    <input
                      value={String((p as any).importo_corretto ?? '')}
                      onChange={(e) => {
                        const valore = e.target.value

                        setPreventivi((prev: any[]) =>
                          prev.map((item) =>
                            item.id === p.id
                              ? { ...item, importo_corretto: valore }
                              : item
                          ) as any
                        )
                      }}
                      placeholder="Es. 53845.20"
                      style={{
                        marginTop: 6,
                        maxWidth: 180,
                        padding: 8,
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                      }}
                    />
                  </label>

                  <button
                    onClick={async () => {
                      if (!p.id) return alert('ID preventivo mancante')

                      const valoreCorretto = (p as any).importo_corretto

                      if (!valoreCorretto || String(valoreCorretto).trim() === '') {
                        alert('Inserisci prima un importo corretto')
                        return
                      }

                      const importo = parseImporto(valoreCorretto)

                      if (!importo || importo <= 0) {
                        alert('Importo non valido')
                        return
                      }

                      const { error } = await supabase
                        .from('preventivi_cantiere')
                        .update({ importo_totale: importo })
                        .eq('id', p.id)

                      if (error) {
                        alert('Errore salvataggio importo: ' + error.message)
                        return
                      }

                      await caricaEconomia()
                      alert('Importo corretto salvato')
                    }}
                    style={{ ...buttonSecondary, marginTop: 8 }}
                  >
                    Salva correzione
                  </button>

                  <br />
                  Note: {p.note || '-'}

                  {p.file_tipo === 'pdf' && p.file_url && (
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
                        src={p.file_url}
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                        }}
                      />
                    </div>
                  )}

                  {p.file_tipo === 'excel' && p.anteprima_testo && (
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
                                const righe = JSON.parse(p.anteprima_testo)

                                return righe.map((row: any[], i: number) => (
                                  <tr key={i}>
                                    {(Array.isArray(row) ? row : []).map((cell, j) => (
                                      <td
                                        key={j}
                                        style={{
                                          border: '1px solid #e2e8f0',
                                          padding: '8px 10px',
                                          whiteSpace: 'normal',
                                          wordBreak: 'break-word',
                                          lineHeight: 1.4,
                                          verticalAlign: 'top',
                                          fontWeight: i === 0 ? 700 : 400,
                                          background: i === 0 ? '#f8fafc' : '#ffffff',
                                          maxWidth: 220,
                                        }}
                                      >
                                        {String(cell ?? '')}
                                      </td>
                                    ))}
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

                  <div style={{ marginTop: 10 }}>
                    <button
                      onClick={async () => {
                        if (!p.id) return

                        if (!confirm('Vuoi eliminare questo preventivo?')) return

                        if (p.file_path) {
                          const { error: storageError } = await supabase.storage
                            .from('preventivi')
                            .remove([p.file_path])

                          if (storageError) {
                            alert(
                              'Errore cancellazione file da Storage: ' +
                                storageError.message
                            )
                            return
                          }
                        }

                        const { error } = await supabase
                          .from('preventivi_cantiere')
                          .delete()
                          .eq('id', p.id)

                        if (error) {
                          alert('Errore eliminazione preventivo: ' + error.message)
                          return
                        }

                        await caricaEconomia()
                        alert('Preventivo eliminato completamente')
                      }}
                      style={{
                        ...buttonSecondary,
                        backgroundColor: '#d9534f',
                        color: 'white',
                      }}
                    >
                      Elimina preventivo
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  )
}