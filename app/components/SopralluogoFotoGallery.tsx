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
  modalitaGestione: boolean
  fotoSelezionate: string[]
  setFotoSelezionate: Dispatch<SetStateAction<string[]>>
  caricaFotoSopralluoghi: () => void | Promise<void>
  supabase: any
}

const TAG_QUADERNO = 'smart-note'

function aggiornaTagQuaderno(tag: string | undefined, collegata: boolean) {
  const tagCorrenti = (tag || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item !== TAG_QUADERNO)

  if (collegata) tagCorrenti.push(TAG_QUADERNO)
  return tagCorrenti.join(',')
}

export default function SopralluogoFotoGallery({
  sopralluogoAperto,
  fotoSopralluoghi,
  setFotoSopralluoghi,
  setFotoFullscreen,
  modalitaGestione,
  fotoSelezionate,
  setFotoSelezionate,
  caricaFotoSopralluoghi,
  supabase,
}: Props) {
  const fotoDelSopralluogo = fotoSopralluoghi.filter(
    (foto) => foto.sopralluogo_id === sopralluogoAperto?.id
  )

  const aggiornaFoto = async (
    foto: FotoSopralluogo,
    modifica: Partial<FotoSopralluogo>
  ) => {
    if (!foto.id) return

    setFotoSopralluoghi((correnti) =>
      correnti.map((item) => (item.id === foto.id ? { ...item, ...modifica } : item))
    )

    const { error } = await supabase
      .from('foto_sopralluogo')
      .update(modifica)
      .eq('id', foto.id)

    if (error) {
      await caricaFotoSopralluoghi()
      alert('Errore aggiornamento foto: ' + error.message)
    }
  }

  const eliminaSelezionate = async () => {
    if (fotoSelezionate.length === 0) return
    if (!confirm(`Eliminare ${fotoSelezionate.length} foto?`)) return

    const { error } = await supabase
      .from('foto_sopralluogo')
      .delete()
      .in('id', fotoSelezionate)

    if (error) {
      alert('Errore eliminazione foto: ' + error.message)
      return
    }

    setFotoSelezionate([])
    await caricaFotoSopralluoghi()
  }

  if (fotoDelSopralluogo.length === 0) {
    return (
      <div style={{ padding: '24px 0', color: '#64748b', textAlign: 'center' }}>
        Nessuna foto nel fascicolo.
      </div>
    )
  }

  return (
    <div>
      {modalitaGestione && fotoSelezionate.length > 0 && (
        <button
          type="button"
          onClick={() => void eliminaSelezionate()}
          style={{
            marginBottom: 12,
            padding: '10px 14px',
            border: 0,
            borderRadius: 9,
            background: '#dc2626',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Elimina selezionate ({fotoSelezionate.length})
        </button>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {fotoDelSopralluogo.map((foto, indice) => {
          const collegataAlQuaderno = (foto.tag || '')
            .split(',')
            .map((item) => item.trim())
            .includes(TAG_QUADERNO)
          const selezionata = Boolean(foto.id && fotoSelezionate.includes(foto.id))

          return (
            <article
              key={foto.id || indice}
              style={{
                position: 'relative',
                overflow: 'hidden',
                border: selezionata ? '2px solid #2563eb' : '1px solid #e2e8f0',
                borderRadius: 12,
                background: '#fff',
              }}
            >
              {modalitaGestione && foto.id && (
                <label
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    zIndex: 2,
                    display: 'grid',
                    placeItems: 'center',
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.92)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selezionata}
                    aria-label={`Seleziona foto ${indice + 1}`}
                    onChange={(event) =>
                      setFotoSelezionate((correnti) =>
                        event.target.checked
                          ? [...correnti, foto.id!]
                          : correnti.filter((id) => id !== foto.id)
                      )
                    }
                    style={{ width: 22, height: 22 }}
                  />
                </label>
              )}

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={foto.immagine_base64}
                alt={foto.nota || `Foto sopralluogo ${indice + 1}`}
                onClick={() =>
                  setFotoFullscreen({
                    id: foto.id,
                    cantiere: '',
                    nota: foto.nota || '',
                    immagine_base64: foto.immagine_base64,
                    created_at: foto.created_at,
                  })
                }
                style={{ width: '100%', height: 180, objectFit: 'cover', cursor: 'pointer' }}
              />

              <div style={{ display: 'grid', gap: 8, padding: 10 }}>
                {foto.nota && (
                  <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{foto.nota}</div>
                )}

                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={collegataAlQuaderno}
                    onChange={(event) =>
                      void aggiornaFoto(foto, {
                        tag: aggiornaTagQuaderno(foto.tag, event.target.checked),
                      })
                    }
                  />
                  Collega al Quaderno
                </label>

                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(foto.includi_preventivo)}
                    onChange={(event) =>
                      void aggiornaFoto(foto, { includi_preventivo: event.target.checked })
                    }
                  />
                  Usa nel preventivo
                </label>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
