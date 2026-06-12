'use client'

import type { CSSProperties, Dispatch, RefObject, SetStateAction } from 'react'
import Webcam from 'react-webcam'
import jsPDF from 'jspdf'

type Props = {
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties

  fotoRapportinoTemp: string[]
  setFotoRapportinoTemp: Dispatch<SetStateAction<string[]>>

  notaFotoRapportino: string
  setNotaFotoRapportino: Dispatch<SetStateAction<string>>

  cameraRapportinoAttiva: boolean
  setCameraRapportinoAttiva: Dispatch<SetStateAction<boolean>>

  fotoRapportinoFullscreen: boolean
  setFotoRapportinoFullscreen: Dispatch<SetStateAction<boolean>>

  geolocalizzazioneFoto: string

  ascoltoNoteFoto: boolean

  webcamRapportinoRef: RefObject<Webcam | null>

  caricaFotoRapportinoDaInput: (e: any) => void
  rilevaPosizioneFoto: () => void
  salvaFotoRapportino: () => void | Promise<void>
  scattaFotoRapportino: () => void
  avviaDettaturaNoteFoto: () => void
  fermaDettaturaNoteFoto: () => void

  setPopupFotoRapportino: Dispatch<SetStateAction<boolean>>
}

export default function PopupFotoRapportino({
  buttonPrimary,
  buttonSecondary,
  fotoRapportinoTemp,
  setFotoRapportinoTemp,
  notaFotoRapportino,
  setNotaFotoRapportino,
  cameraRapportinoAttiva,
  setCameraRapportinoAttiva,
  fotoRapportinoFullscreen,
  setFotoRapportinoFullscreen,
  geolocalizzazioneFoto,
  ascoltoNoteFoto,
  webcamRapportinoRef,
  caricaFotoRapportinoDaInput,
  rilevaPosizioneFoto,
  salvaFotoRapportino,
  scattaFotoRapportino,
  avviaDettaturaNoteFoto,
  fermaDettaturaNoteFoto,
  setPopupFotoRapportino,
}: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
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
          maxWidth: 900,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <h3 style={{ marginTop: 0 }}>📸 Foto lavoro rapportino</h3>

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={caricaFotoRapportinoDaInput}
          style={{
            width: '100%',
            padding: 10,
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            marginBottom: 15,
          }}
        />

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            onClick={() =>
              setCameraRapportinoAttiva(!cameraRapportinoAttiva)
            }
            style={buttonSecondary}
          >
            {cameraRapportinoAttiva ? 'Chiudi fotocamera' : 'Apri fotocamera'}
          </button>

          <button
            type="button"
            onClick={rilevaPosizioneFoto}
            style={buttonSecondary}
          >
            📍 Geolocalizza
          </button>

          <button
            type="button"
            onClick={salvaFotoRapportino}
            style={buttonPrimary}
          >
            💾 Salva foto
          </button>

          <button
            type="button"
            onClick={() => {
              if (fotoRapportinoTemp.length === 0) {
                alert('Nessuna foto da esportare')
                return
              }

              const pdf = new jsPDF('p', 'mm', 'a4')

              fotoRapportinoTemp.forEach((foto, index) => {
                if (index > 0) pdf.addPage()

                pdf.setFontSize(14)
                pdf.text('Foto lavoro rapportino', 10, 12)

                if (notaFotoRapportino) {
                  pdf.setFontSize(10)
                  pdf.text(notaFotoRapportino, 10, 20, {
                    maxWidth: 190,
                  })
                }

                pdf.addImage(foto, 'JPEG', 10, 30, 190, 140)
              })

              pdf.save('Foto_lavoro_rapportino.pdf')
            }}
            style={buttonSecondary}
          >
            📄 Esporta PDF foto
          </button>
        </div>

        {cameraRapportinoAttiva && (
          <div
            style={{
              position: 'relative',
              marginTop: 10,
              marginBottom: 12,
              border: '1px solid #cbd5e1',
              borderRadius: 12,
              overflow: 'hidden',
              background: '#000',
            }}
          >
            <Webcam
              ref={webcamRapportinoRef}
              audio={false}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.9}
              videoConstraints={{
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              }}
              style={{
                width: '100%',
                height: fotoRapportinoFullscreen ? '90vh' : 540,
                maxHeight: fotoRapportinoFullscreen ? '90vh' : '65vh',
                objectFit: 'cover',
                display: 'block',
              }}
            />

            <button
              type="button"
              onClick={scattaFotoRapportino}
              style={{
                position: 'absolute',
                bottom: 18,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 70,
                height: 70,
                borderRadius: '50%',
                border: '4px solid #fff',
                background: '#2563eb',
                color: '#fff',
                fontSize: 28,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
              }}
            >
              📸
            </button>

            <button
              type="button"
              onClick={() =>
                setFotoRapportinoFullscreen(!fotoRapportinoFullscreen)
              }
              style={{
                position: 'absolute',
                bottom: 18,
                right: 18,
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '2px solid #fff',
                background: 'rgba(37,99,235,0.9)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 18,
              }}
            >
              ↗
            </button>
          </div>
        )}

        <textarea
          value={notaFotoRapportino}
          onChange={(e) => setNotaFotoRapportino(e.target.value)}
          placeholder="Descrivi il lavoro eseguito..."
          style={{
            width: '100%',
            minHeight: 70,
            padding: 10,
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            marginBottom: 10,
          }}
        />

        <div style={{ marginBottom: 10 }}>
          {!ascoltoNoteFoto ? (
            <button
              type="button"
              onClick={avviaDettaturaNoteFoto}
              style={buttonSecondary}
            >
              🎤 Avvia dettatura foto
            </button>
          ) : (
            <button
              type="button"
              onClick={fermaDettaturaNoteFoto}
              style={{
                ...buttonSecondary,
                backgroundColor: '#dc2626',
                color: '#fff',
              }}
            >
              ⏹ Stop dettatura
            </button>
          )}
        </div>

        {geolocalizzazioneFoto && (
          <div
            style={{
              marginBottom: 10,
              fontSize: 13,
              color: '#475569',
            }}
          >
            📍 {geolocalizzazioneFoto}
          </div>
        )}

        {fotoRapportinoTemp.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 10,
              marginTop: 12,
            }}
          >
            {fotoRapportinoTemp.map((foto, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img
                  src={foto}
                  alt={`Foto rapportino ${i + 1}`}
                  style={{
                    width: '100%',
                    height: 120,
                    objectFit: 'cover',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                  }}
                />

                <button
                  type="button"
                  onClick={() =>
                    setFotoRapportinoTemp((lista) =>
                      lista.filter((_, index) => index !== i)
                    )
                  }
                  style={{
                    position: 'absolute',
                    top: 5,
                    right: 5,
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '3px 6px',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            marginTop: 18,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setCameraRapportinoAttiva(false)
              setPopupFotoRapportino(false)
            }}
            style={buttonSecondary}
          >
            Chiudi
          </button>

          <button
            type="button"
            onClick={() => {
              salvaFotoRapportino()
              setPopupFotoRapportino(false)
            }}
            style={buttonPrimary}
          >
            Usa nel rapportino
          </button>
        </div>
      </div>
    </div>
  )
}