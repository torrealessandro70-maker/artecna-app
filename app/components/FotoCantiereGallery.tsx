'use client'

import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import type { FotoCantiere } from '../types'

type Props = {
  fotoCantiere: FotoCantiere[]
  setFotoCantiere: Dispatch<SetStateAction<FotoCantiere[]>>

  cantiereScheda: string
  filtroFotoCantiere: string

  fotoCantiereSelezionate: string[]
  setFotoCantiereSelezionate: Dispatch<SetStateAction<string[]>>

  setFotoFullscreen: (foto: FotoCantiere | null) => void

  supabase: any
  caricaFotoCantiere: () => void | Promise<void>
  eliminaFotoCantiere: (id?: string) => void | Promise<void>

  buttonSecondary: CSSProperties
}

export default function FotoCantiereGallery({
  fotoCantiere,
  setFotoCantiere,
  cantiereScheda,
  filtroFotoCantiere,
  fotoCantiereSelezionate,
  setFotoCantiereSelezionate,
  setFotoFullscreen,
  supabase,
  caricaFotoCantiere,
  eliminaFotoCantiere,
  buttonSecondary,
}: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
        marginTop: 15,
      }}
    >
      {fotoCantiere
        .filter((f) => {
          if (f.cantiere !== cantiereScheda) return false

          const categoriaSalvata = String(f.categoria || 'prima')
            .trim()
            .toLowerCase()

          const filtroAttivo = String(filtroFotoCantiere || 'tutte')
            .trim()
            .toLowerCase()

          if (filtroAttivo === 'tutte') return true

          return categoriaSalvata === filtroAttivo
        })
        .map((foto, i) => (
          <div
            key={foto.id || i}
            style={{
              border: '1px solid #d1d5db',
              borderRadius: 10,
              overflow: 'hidden',
              background: '#fff',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: 8,
                background:
                  foto.id && fotoCantiereSelezionate.includes(foto.id)
                    ? '#dbeafe'
                    : '#f8fafc',
                fontSize: 13,
                fontWeight: 600,
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <input
                type="checkbox"
                checked={
                  !!foto.id && fotoCantiereSelezionate.includes(foto.id)
                }
                onChange={(e) => {
                  if (!foto.id) return

                  setFotoCantiereSelezionate((prev) =>
                    e.target.checked
                      ? [...prev, foto.id!]
                      : prev.filter((id) => id !== foto.id)
                  )
                }}
              />
              Seleziona
            </label>

            <img
              src={foto.immagine_base64}
              alt="Foto cantiere"
              onClick={() => setFotoFullscreen(foto)}
              style={{
                width: '100%',
                height: 180,
                objectFit: 'contain',
                background: '#f8fafc',
                cursor: 'pointer',
              }}
            />

            <div style={{ padding: 10 }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {foto.data_foto || '-'}
              </div>

              <div style={{ marginTop: 6 }}>
                {foto.nota || 'Nessuna nota'}
              </div>

              <div style={{ marginTop: 8 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  Categoria foto
                </label>

                <select
                  value={foto.categoria || 'prima'}
                  onChange={async (e) => {
                    const nuovaCategoria = e.target.value

                    if (!foto.id) {
                      alert('ID foto mancante')
                      return
                    }

                    setFotoCantiere((prev) =>
                      prev.map((f) =>
                        f.id === foto.id
                          ? {
                              ...f,
                              categoria: nuovaCategoria,
                            }
                          : f
                      )
                    )

                    const { error } = await supabase
                      .from('foto_cantiere')
                      .update({
                        categoria: nuovaCategoria,
                      })
                      .eq('id', foto.id)

                    if (error) {
                      alert(
                        'Errore aggiornamento categoria foto: ' +
                          error.message
                      )

                      await caricaFotoCantiere()
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: 8,
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    marginTop: 4,
                  }}
                >
                  <option value="prima">📷 Prima</option>
                  <option value="durante">🔨 Durante</option>
                  <option value="dopo">✅ Dopo</option>
                  <option value="problema">⚠️ Problema</option>
                  <option value="rapportino">📝 Rapportino</option>
                  <option value="sal">📊 SAL</option>
                  <option value="extra">📁 Extra</option>
                </select>
              </div>

              <button
                onClick={() => eliminaFotoCantiere(foto.id)}
                style={{
                  ...buttonSecondary,
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  marginTop: 10,
                  width: '100%',
                }}
              >
                🗑 Elimina
              </button>
            </div>
          </div>
        ))}
    </div>
  )
}