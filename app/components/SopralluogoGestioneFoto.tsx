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
  mostraGestioneFotoSopralluogo: boolean
  sopralluogoAperto: any
  fotoSopralluoghi: FotoSopralluogo[]
  fotoSopralluogoSelezionate: string[]
  setFotoSopralluogoSelezionate: Dispatch<SetStateAction<string[]>>
  setFotoFullscreen: (foto: FotoCantiere | null) => void
  caricaFotoSopralluoghi: () => void | Promise<void>
  supabase: any
}

export default function SopralluogoGestioneFoto({
  mostraGestioneFotoSopralluogo,
  sopralluogoAperto,
  fotoSopralluoghi,
  fotoSopralluogoSelezionate,
  setFotoSopralluogoSelezionate,
  setFotoFullscreen,
  caricaFotoSopralluoghi,
  supabase,
}: Props) {
  if (!mostraGestioneFotoSopralluogo) return null

  const fotoDelSopralluogo = fotoSopralluoghi.filter(
    (f) => f.sopralluogo_id === sopralluogoAperto?.id
  )

  return (
    <div style={{ marginTop: 20 }}>
      <h4>Gestione foto sopralluogo</h4>

      {fotoSopralluogoSelezionate.length > 0 && (
        <button
          type="button"
          onClick={async () => {
            if (
              !confirm(
                `Eliminare ${fotoSopralluogoSelezionate.length} foto?`
              )
            ) {
              return
            }

            const { error } = await supabase
              .from('foto_sopralluogo')
              .delete()
              .in('id', fotoSopralluogoSelezionate)

            if (error) {
              alert('Errore eliminazione foto: ' + error.message)
              return
            }

            setFotoSopralluogoSelezionate([])
            await caricaFotoSopralluoghi()
          }}
          style={{
            marginBottom: 12,
            background: '#dc2626',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 12px',
            cursor: 'pointer',
          }}
        >
          🗑 Elimina foto selezionate
        </button>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        {fotoDelSopralluogo.map((foto, i) => (
          <div
            key={foto.id || i}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: 8,
              background: '#fff',
            }}
          >
            <input
              type="checkbox"
              checked={
                !!foto.id &&
                fotoSopralluogoSelezionate.includes(foto.id)
              }
              onChange={(e) => {
                if (!foto.id) return

                setFotoSopralluogoSelezionate((prev) =>
                  e.target.checked
                    ? [...prev, foto.id!]
                    : prev.filter((id) => id !== foto.id)
                )
              }}
              style={{
                marginBottom: 6,
                transform: 'scale(1.2)',
              }}
            />

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
                height: 130,
                objectFit: 'cover',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            />

            <button
              type="button"
              onClick={async () => {
                const conferma = confirm('Eliminare questa foto?')
                if (!conferma) return

                const { error } = await supabase
                  .from('foto_sopralluogo')
                  .delete()
                  .eq('id', foto.id)

                if (error) {
                  alert('Errore eliminazione foto: ' + error.message)
                  return
                }

                setFotoSopralluogoSelezionate((prev) =>
                  prev.filter((id) => id !== foto.id)
                )

                await caricaFotoSopralluoghi()

                alert('Foto eliminata')
              }}
              style={{
                marginTop: 8,
                width: '100%',
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '6px 8px',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              🗑 Elimina
            </button>

            {foto.nota && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: '#374151',
                }}
              >
                {foto.nota}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}