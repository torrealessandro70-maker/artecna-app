'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
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
const TAG_TECNICI = [
  { valore: 'tecnico:bagno', etichetta: '🏠 Bagno' },
  { valore: 'tecnico:cucina', etichetta: '🍳 Cucina' },
  { valore: 'tecnico:impianto-elettrico', etichetta: '⚡ Impianto elettrico' },
  { valore: 'tecnico:impianto-idrico', etichetta: '🚰 Impianto idrico' },
  { valore: 'tecnico:umidita', etichetta: '💧 Umidità' },
  { valore: 'tecnico:muratura', etichetta: '🧱 Muratura' },
  { valore: 'tecnico:finiture', etichetta: '🎨 Finiture' },
  { valore: 'tecnico:struttura', etichetta: '🏗️ Struttura' },
] as const

function leggiTag(tag: string | undefined) {
  return (tag || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function aggiornaTag(tag: string | undefined, valore: string, attivo: boolean) {
  const tagAggiornati = new Set(leggiTag(tag))
  if (attivo) tagAggiornati.add(valore)
  else tagAggiornati.delete(valore)
  return Array.from(tagAggiornati).join(',')
}

function aggiornaTagQuaderno(tag: string | undefined, collegata: boolean) {
  return aggiornaTag(tag, TAG_QUADERNO, collegata)
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
  const [filtriTag, setFiltriTag] = useState<string[]>([])
  const fotoDelSopralluogo = fotoSopralluoghi.filter(
    (foto) => foto.sopralluogo_id === sopralluogoAperto?.id
  )
  const fotoFiltrate =
    filtriTag.length === 0
      ? fotoDelSopralluogo
      : fotoDelSopralluogo.filter((foto) => {
          const tagFoto = leggiTag(foto.tag)
          return filtriTag.some((filtro) => tagFoto.includes(filtro))
        })

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
      <div
        aria-label="Filtra foto per tag"
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 14,
          paddingBottom: 4,
          overflowX: 'auto',
        }}
      >
        {TAG_TECNICI.map((tag) => {
          const attivo = filtriTag.includes(tag.valore)
          return (
            <button
              key={tag.valore}
              type="button"
              aria-pressed={attivo}
              onClick={() =>
                setFiltriTag((correnti) =>
                  attivo
                    ? correnti.filter((valore) => valore !== tag.valore)
                    : [...correnti, tag.valore]
                )
              }
              style={{
                minHeight: 44,
                padding: '9px 13px',
                flex: '0 0 auto',
                border: attivo ? '2px solid #2563eb' : '1px solid #cbd5e1',
                borderRadius: 999,
                background: attivo ? '#dbeafe' : '#fff',
                color: attivo ? '#1e3a8a' : '#334155',
                fontWeight: attivo ? 800 : 600,
                cursor: 'pointer',
              }}
            >
              {tag.etichetta}
            </button>
          )
        })}
      </div>

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

      {fotoFiltrate.length === 0 ? (
        <div style={{ padding: '24px 0', color: '#64748b', textAlign: 'center' }}>
          Nessuna foto corrisponde ai tag selezionati.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
        {fotoFiltrate.map((foto, indice) => {
          const tagFoto = leggiTag(foto.tag)
          const tagTecniciAttivi = TAG_TECNICI.filter((tag) =>
            tagFoto.includes(tag.valore)
          )
          const collegataAlQuaderno = tagFoto.includes(TAG_QUADERNO)
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

              <div style={{ position: 'relative' }}>
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
                  style={{ width: '100%', height: 180, display: 'block', objectFit: 'cover', cursor: 'pointer' }}
                />

                {tagTecniciAttivi.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 8,
                      bottom: 8,
                      left: 8,
                      display: 'flex',
                      gap: 5,
                      flexWrap: 'wrap',
                    }}
                  >
                    {tagTecniciAttivi.map((tag) => (
                      <span
                        key={tag.valore}
                        style={{
                          padding: '5px 8px',
                          borderRadius: 999,
                          background: 'rgba(15,23,42,0.84)',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {tag.etichetta}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gap: 8, padding: 10 }}>
                {foto.nota && (
                  <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{foto.nota}</div>
                )}

                <details>
                  <summary
                    style={{
                      minHeight: 44,
                      display: 'flex',
                      alignItems: 'center',
                      color: '#334155',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Tag tecnici ({tagTecniciAttivi.length})
                  </summary>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', paddingTop: 8 }}>
                    {TAG_TECNICI.map((tag) => {
                      const attivo = tagFoto.includes(tag.valore)
                      return (
                        <button
                          key={tag.valore}
                          type="button"
                          aria-pressed={attivo}
                          onClick={() =>
                            void aggiornaFoto(foto, {
                              tag: aggiornaTag(foto.tag, tag.valore, !attivo),
                            })
                          }
                          style={{
                            minHeight: 44,
                            padding: '9px 11px',
                            border: attivo ? '2px solid #2563eb' : '1px solid #cbd5e1',
                            borderRadius: 999,
                            background: attivo ? '#dbeafe' : '#fff',
                            color: attivo ? '#1e3a8a' : '#334155',
                            fontWeight: attivo ? 800 : 600,
                            cursor: 'pointer',
                          }}
                        >
                          {tag.etichetta}
                        </button>
                      )
                    })}
                  </div>
                </details>

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
      )}
    </div>
  )
}
