'use client'

import type { CSSProperties } from 'react'

type Props = {
  sopralluoghi: any[]
  mostraElencoSopralluoghi: boolean
  setMostraElencoSopralluoghi: (v: boolean) => void

  setUltimoSopralluogo: (v: any) => void
  setSopralluogoAperto: (v: any) => void
  setFirmaCliente: (v: string) => void
  setMostraGestioneFotoSopralluogo: (v: boolean) => void
  setMostraFotoPreventivoSopralluogo: (v: boolean) => void
  setFotoSopralluoghi: (v: any[]) => void

  eliminaSopralluogo: (id?: string) => void | Promise<void>

  supabase: any
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function SopralluoghiList({
  sopralluoghi,
  mostraElencoSopralluoghi,
  setMostraElencoSopralluoghi,

  setUltimoSopralluogo,
  setSopralluogoAperto,
  setFirmaCliente,
  setMostraGestioneFotoSopralluogo,
  setMostraFotoPreventivoSopralluogo,
  setFotoSopralluoghi,

  eliminaSopralluogo,

  supabase,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <h3>Sopralluoghi</h3>

        <button
          onClick={() =>
            setMostraElencoSopralluoghi(!mostraElencoSopralluoghi)
          }
          style={buttonSecondary}
        >
          {mostraElencoSopralluoghi ? 'Nascondi elenco' : 'Mostra elenco'}
        </button>
      </div>

      {sopralluoghi.length === 0 ? (
        <p>Nessun sopralluogo salvato</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {[...sopralluoghi]
            .slice(0, mostraElencoSopralluoghi ? undefined : 1)
            .map((s, i) => (
              <div
                key={s.id || i}
                style={{
                  padding: 12,
                  border: '1px solid #ddd',
                  borderRadius: 10,
                  background: '#fff',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    width: 'auto',
                    marginBottom: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={async () => {
                      setUltimoSopralluogo(s)
                      setSopralluogoAperto(s)

                      setMostraElencoSopralluoghi(false)
                      setFirmaCliente(s.firma_cliente || '')
                      setMostraGestioneFotoSopralluogo(false)
                      setMostraFotoPreventivoSopralluogo(false)

                      const { data } = await supabase
                        .from('foto_sopralluogo')
                        .select('id,sopralluogo_id,nota,immagine_base64,tag,includi_preventivo,created_at')
                        .eq('sopralluogo_id', s.id)

                      setFotoSopralluoghi(
                        [...(data || [])].sort((prima, seconda) =>
                          String(seconda.created_at || '').localeCompare(
                            String(prima.created_at || '')
                          )
                        )
                      )
                    }}
                    style={{
                      ...buttonPrimary,
                      width: 'auto',
                      minWidth: 0,
                      padding: '8px 12px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    🔍 Apri sopralluogo
                  </button>

                  <button
                    type="button"
                    onClick={() => eliminaSopralluogo(s.id)}
                    style={{
                      ...buttonPrimary,
                      width: 'auto',
                      minWidth: 0,
                      padding: '8px 12px',
                      whiteSpace: 'nowrap',
                      backgroundColor: '#dc2626',
                    }}
                  >
                    🗑 Elimina
                  </button>
                </div>

                <strong>{s.cliente}</strong>
                <br />
                {s.indirizzo || '-'}
                <br />
                Data: {s.data_sopralluogo || '-'}
                <br />
                Tipo lavoro: {s.tipo_lavoro || '-'}
                <br />
                Stato: {s.stato || '-'}
              </div>
            ))}
        </div>
      )}
    </>
  )
}
