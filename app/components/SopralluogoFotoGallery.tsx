'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { FotoCantiere } from '../types'

type FotoSopralluogo = {
  id?: string
  sopralluogo_id?: string
  nota?: string
  immagine_base64: string
  tag?: string
  includi_preventivo?: boolean
  created_at?: string
}

type Props = {
  sopralluogoAperto: any
  fotoSopralluoghi: FotoSopralluogo[]
  setFotoSopralluoghi: Dispatch<SetStateAction<FotoSopralluogo[]>>
  setFotoFullscreen: (foto: FotoCantiere | null) => void
  supabase: any
}

export default function SopralluogoFotoGallery({
  sopralluogoAperto,
  fotoSopralluoghi,
  setFotoSopralluoghi,
  setFotoFullscreen,
  supabase,
}: Props) {
  const fotoDelSopralluogo = fotoSopralluoghi.filter(
    (f) => f.sopralluogo_id === sopralluogoAperto?.id
  )

  if (fotoDelSopralluogo.length === 0) {
    return <p>Nessuna foto caricata</p>
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
      }}
    >
      {fotoDelSopralluogo.map((foto, i) => (
        <div
          key={foto.id || i}
          style={{
            border: '1px solid #ddd',
            borderRadius: 12,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          <img
            src={foto.immagine_base64}
            alt="Foto sopralluogo"
            onClick={() =>
              setFotoFullscreen({
                id: foto.id,
                cantiere: '',
                nota: foto.nota || '',
                immagine_base64: foto.immagine_base64,
                created_at: foto.created_at,
              })
            }
            style={{
              width: '100%',
              height: 180,
              objectFit: 'cover',
              cursor: 'pointer',
            }}
          />

          <div style={{ padding: 10 }}>
            <div
              style={{
                fontSize: 13,
                whiteSpace: 'pre-wrap',
              }}
            >
              {foto.nota || 'Nessuna nota'}
            </div>

            <label
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                marginTop: 10,
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(foto.includi_preventivo)}
                onChange={async (e) => {
                  const nuovoValore = e.target.checked

                  setFotoSopralluoghi((prev) =>
                    prev.map((f) =>
                      f.id === foto.id
                        ? {
                            ...f,
                            includi_preventivo: nuovoValore,
                          }
                        : f
                    )
                  )

                  const { error } = await supabase
                    .from('foto_sopralluogo')
                    .update({
                      includi_preventivo: nuovoValore,
                    })
                    .eq('id', foto.id)

                  if (error) {
                    alert('Errore aggiornamento foto: ' + error.message)
                  }
                }}
              />

              Usa nel preventivo
            </label>
          </div>
        </div>
      ))}
    </div>
  )
}