'use client'

import {
  useRef,
  type ChangeEvent,
  type CSSProperties,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react'
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

  caricaFotoRapportinoDaInput: (e: ChangeEvent<HTMLInputElement>) => void
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
  const fotocameraNativaRef = useRef<HTMLInputElement>(null)
  const galleriaRef = useRef<HTMLInputElement>(null)

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

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          <input
            ref={fotocameraNativaRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={caricaFotoRapportinoDaInput}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            onClick={() => fotocameraNativaRef.current?.click()}
            style={buttonPrimary}
          >
            📷 Fotocamera dispositivo
          </button>

          <label style={{ ...buttonSecondary, cursor: 'pointer' }}>
            🖼️ Scegli dalla galleria
            <input
              ref={galleriaRef}
              type="file"
              accept="image/*"
              multiple
              onChange={caricaFotoRapportinoDaInput}
              style={{ display: 'none' }}
            />
          </label>

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
              marginTop: 10,
              marginBottom: 12,
              border: '1px solid #cbd5e1',
              borderRadius: 12,
              overflow: 'hidden',
              background: '#fff',
            }}
          >
            <div
              style={{
                position: 'relative',
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
                aria-label="Scatta foto"
                style={{
                  position: 'absolute',
                  right: 16,
                  bottom: 16,
                  width: 64,
                  height: 64,
                  padding: 4,
                  borderRadius: '50%',
                  border: '3px solid #fff',
                  background: '#2563eb',
                  color: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: 1.1,
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(0,0,0,0.3)',
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 20 }}>
                  📷
                </span>
                Scatta
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 8,
                padding: 10,
                background: '#f8fafc',
              }}
            >
              <button
                type="button"
                onClick={() => setCameraRapportinoAttiva(false)}
                style={{ ...buttonSecondary, minWidth: 0, minHeight: 44 }}
              >
                ✕ Chiudi
              </button>
              <button
                type="button"
                onClick={() => galleriaRef.current?.click()}
                style={{ ...buttonSecondary, minWidth: 0, minHeight: 44 }}
              >
                🖼 Galleria
              </button>
              <button
                type="button"
                onClick={() =>
                  setFotoRapportinoFullscreen(!fotoRapportinoFullscreen)
                }
                style={{ ...buttonSecondary, minWidth: 0, minHeight: 44 }}
              >
                ⛶ Full Screen
              </button>
            </div>
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
