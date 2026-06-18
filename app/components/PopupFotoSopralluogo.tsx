'use client'

import { useRef, type ChangeEvent, type CSSProperties, type RefObject } from 'react'
import Webcam from 'react-webcam'

type Props = {
  popupFotoSopralluogo: boolean
  setPopupFotoSopralluogo: (v: boolean) => void
  cameraSopralluogoAttiva: boolean
  setCameraSopralluogoAttiva: (v: boolean) => void
  cameraSopralluogoFullscreen: boolean
  setCameraSopralluogoFullscreen: (v: (old: boolean) => boolean) => void
 webcamSopralluogoRef: RefObject<Webcam | null>
  scattaFotoSopralluogo: () => void
  fotoSopralluogoTemp: string[]
  setFotoSopralluogoTemp: React.Dispatch<React.SetStateAction<string[]>>
  notaFotoSopralluogo: string
  setNotaFotoSopralluogo: (v: string) => void
  salvaFotoSopralluogo: () => void | Promise<void>
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function PopupFotoSopralluogo({
  popupFotoSopralluogo,
  setPopupFotoSopralluogo,
  cameraSopralluogoAttiva,
  setCameraSopralluogoAttiva,
  cameraSopralluogoFullscreen,
  setCameraSopralluogoFullscreen,
  webcamSopralluogoRef,
  scattaFotoSopralluogo,
  fotoSopralluogoTemp,
  setFotoSopralluogoTemp,
  notaFotoSopralluogo,
  setNotaFotoSopralluogo,
  salvaFotoSopralluogo,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const fotocameraNativaRef = useRef<HTMLInputElement>(null)

  if (!popupFotoSopralluogo) return null

  const aggiungiFoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const fotoConvertite = await Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result || ''))
            reader.readAsDataURL(file)
          })
      )
    )

    setFotoSopralluogoTemp((prev) => [...prev, ...fotoConvertite])
    e.target.value = ''
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        zIndex: 10000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          width: '100%',
          maxWidth: 900,
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 20,
          paddingBottom: 80,
        }}
      >
        <h2>📸 Foto sopralluogo</h2>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            ref={fotocameraNativaRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={aggiungiFoto}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            onClick={() => fotocameraNativaRef.current?.click()}
            style={buttonPrimary}
          >
            📷 Scatta con fotocamera
          </button>

          <button
            type="button"
            onClick={() =>
              setCameraSopralluogoAttiva(!cameraSopralluogoAttiva)
            }
            style={buttonPrimary}
          >
            {cameraSopralluogoAttiva ? 'Chiudi fotocamera web' : 'Fotocamera web'}
          </button>
        </div>

        <label
          style={{
            ...buttonSecondary,
            display: 'inline-block',
            marginTop: 10,
            cursor: 'pointer',
          }}
        >
          🖼️ Scegli dalla galleria
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={aggiungiFoto}
            style={{ display: 'none' }}
          />
        </label>

        {cameraSopralluogoAttiva && (
          <div
            style={{
              marginTop: cameraSopralluogoFullscreen ? 0 : 15,
              position: cameraSopralluogoFullscreen ? 'fixed' : 'relative',
              inset: cameraSopralluogoFullscreen ? 0 : 'auto',
              zIndex: cameraSopralluogoFullscreen ? 20000 : 'auto',
              background: cameraSopralluogoFullscreen ? '#000' : 'transparent',
              padding: cameraSopralluogoFullscreen ? 10 : 0,
            }}
          >
            <button
              type="button"
              onClick={() => setCameraSopralluogoFullscreen((v) => !v)}
              style={{
                position: 'absolute',
                bottom: 16,
                right: 16,
                zIndex: 40,
                width: 52,
                height: 52,
                borderRadius: '50%',
                border: '2px solid white',
                background: 'rgba(0,0,0,0.55)',
                color: '#fff',
                fontSize: 24,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
              }}
            >
              {cameraSopralluogoFullscreen ? '↙️' : '↗️'}
            </button>

            <Webcam
              ref={webcamSopralluogoRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: 'environment' }}
              style={{
                width: '100%',
                height: cameraSopralluogoFullscreen ? '100vh' : 'auto',
                objectFit: cameraSopralluogoFullscreen ? 'contain' : 'cover',
                borderRadius: cameraSopralluogoFullscreen ? 0 : 12,
              }}
            />

            <button
              type="button"
              onClick={scattaFotoSopralluogo}
              style={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 80,
                height: 80,
                borderRadius: '50%',
                border: '4px solid white',
                background: '#2563eb',
                color: '#fff',
                fontSize: 28,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
                zIndex: 30,
              }}
            >
              📸
            </button>
          </div>
        )}

        <textarea
          placeholder="Note foto sopralluogo"
          value={notaFotoSopralluogo}
          onChange={(e) => setNotaFotoSopralluogo(e.target.value)}
          style={{
            width: '100%',
            minHeight: 80,
            marginTop: 15,
            padding: 10,
          }}
        />

        {fotoSopralluogoTemp.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 10,
              marginTop: 15,
            }}
          >
            {fotoSopralluogoTemp.map((foto, i) => (
              <img
                key={i}
                src={foto}
                alt="Anteprima foto sopralluogo"
                style={{
                  width: '100%',
                  borderRadius: 10,
                }}
              />
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 20,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setPopupFotoSopralluogo(false)
              setCameraSopralluogoAttiva(false)
            }}
            style={buttonSecondary}
          >
            Chiudi
          </button>

          <button type="button" onClick={salvaFotoSopralluogo} style={buttonPrimary}>
            💾 Salva foto
          </button>
        </div>
      </div>
    </div>
  )
}
