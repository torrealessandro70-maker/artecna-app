'use client'

import type { CSSProperties } from 'react'

type Props = {
  mostraAttrezziCantiere: boolean
  setMostraAttrezziCantiere: (v: boolean) => void
  attrezziCantiere: any[]
  cantiereScheda: string
  buttonSecondary: CSSProperties
  formatMoney: (v: number) => string
  eliminaFileDaStorage: (path?: string | null) => Promise<void>
  caricaEconomia: () => Promise<void>
  supabase: any
}

export default function AttrezzatureCaricatePanel({
  mostraAttrezziCantiere,
  setMostraAttrezziCantiere,
  attrezziCantiere,
  cantiereScheda,
  buttonSecondary,
  formatMoney,
  eliminaFileDaStorage,
  caricaEconomia,
  supabase,
}: Props) {
  return (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <strong>Attrezzature / noli caricati:</strong>

      <button
        onClick={() => setMostraAttrezziCantiere(!mostraAttrezziCantiere)}
        style={{ ...buttonSecondary, marginLeft: 10 }}
      >
        {mostraAttrezziCantiere ? 'Nascondi anteprima' : 'Vedi anteprima attrezzature'}
      </button>

      {attrezziCantiere.filter((a) => a.cantiere === cantiereScheda).length === 0 ? (
        <p>Nessuna attrezzatura caricata.</p>
      ) : (
        mostraAttrezziCantiere && (
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            {attrezziCantiere
              .filter((a) => a.cantiere === cantiereScheda)
              .sort((a, b) =>
                String(b.data_documento || '').localeCompare(
                  String(a.data_documento || '')
                )
              )
              .map((a, i) => (
                <div
                  key={a.id || i}
                  style={{
                    padding: 12,
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    background: '#fff',
                  }}
                >
                  <strong>
                    {a.nome_file || a.descrizione || `Attrezzatura ${i + 1}`}
                  </strong>

                  <br />

                  <div style={{ marginTop: 8 }}>
                    <strong>Importo:</strong>{' '}
                    {formatMoney(Number(a.totale || 0))}
                  </div>

                  <br />
                  Fornitore: {a.fornitore || '-'}
                  <br />
                  Data: {a.data_documento || '-'}
                  <br />
                  Nota: {a.nota || '-'}

                  {a.file_tipo === 'pdf' && a.file_url && (
                    <div
                      style={{
                        width: 700,
                        height: 500,
                        minWidth: 300,
                        minHeight: 250,
                        resize: 'both',
                        overflow: 'auto',
                        border: '1px solid #ddd',
                        borderRadius: 8,
                        marginTop: 10,
                      }}
                    >
                      <iframe
                        src={a.file_url}
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                        }}
                      />
                    </div>
                  )}

                  {a.file_tipo === 'img' && a.file_url && (
                    <div
                      style={{
                        width: 700,
                        height: 500,
                        minWidth: 300,
                        minHeight: 250,
                        resize: 'both',
                        overflow: 'auto',
                        border: '1px solid #ddd',
                        borderRadius: 8,
                        marginTop: 10,
                      }}
                    >
                      <img
                        src={a.file_url}
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
                        if (!a.id) return

                        if (!confirm('Sei sicuro di eliminare questa attrezzatura?')) return

                        try {
                          await eliminaFileDaStorage(a.file_path)
                        } catch {
                          alert('Errore cancellazione file da Storage')
                          return
                        }

                        const { error } = await supabase
                          .from('attrezzi_cantiere')
                          .delete()
                          .eq('id', a.id)

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
                      Elimina attrezzatura
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