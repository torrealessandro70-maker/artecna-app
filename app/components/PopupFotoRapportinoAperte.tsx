'use client'

import type { CSSProperties, Dispatch, SetStateAction } from 'react'

type Props = {
  fotoRapportinoAperte: any[]
  setFotoRapportinoAperte: Dispatch<SetStateAction<any[]>>
  onEliminaFotoRapportino: (foto: any) => void | Promise<void>
  buttonSecondary: CSSProperties
}

export default function PopupFotoRapportinoAperte({
  fotoRapportinoAperte,
  setFotoRapportinoAperte,
  onEliminaFotoRapportino,
  buttonSecondary,
}: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15,23,42,0.65)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 20,
          width: '95%',
          maxWidth: 1200,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <h3>📸 Foto rapportino</h3>

          <button
            onClick={() => setFotoRapportinoAperte([])}
            style={buttonSecondary}
          >
            Chiudi
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 15,
          }}
        >
          {fotoRapportinoAperte.map((foto, i) => (
            <div
              key={foto.id || i}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              <img
                src={foto.immagine_base64}
                alt="Foto rapportino"
                style={{
                  width: '100%',
                  height: 220,
                  objectFit: 'cover',
                }}
              />

              <div style={{ padding: 10 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: '#64748b',
                  }}
                >
                  {foto.data_foto}
                </div>

                <div style={{ marginTop: 6 }}>{foto.nota}</div>

                <button
                  onClick={() => onEliminaFotoRapportino(foto)}
                  style={{
                    ...buttonSecondary,
                    marginTop: 10,
                    backgroundColor: '#dc2626',
                    color: '#fff',
                    width: '100%',
                  }}
                >
                  🗑 Elimina foto
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
