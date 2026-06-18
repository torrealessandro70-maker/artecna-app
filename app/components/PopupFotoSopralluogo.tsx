'use client'

import {
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type RefObject,
} from 'react'
import Webcam from 'react-webcam'

type EsitoSalvataggio = {
  salvate: number
  fallite: number
}

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
  salvaFotoSopralluogo: () => EsitoSalvataggio | Promise<EsitoSalvataggio>
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
  const [salvataggioAttivo, setSalvataggioAttivo] = useState(false)
  const [messaggio, setMessaggio] = useState('')

  if (!popupFotoSopralluogo) return null

  const aggiungiFoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) =>
      file.type.startsWith('image/')
    )
    event.target.value = ''
    if (files.length === 0) return

    const fotoConvertite = await Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result || ''))
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
          })
      )
    )

    setFotoSopralluogoTemp((correnti) => [...correnti, ...fotoConvertite])
    setMessaggio('')
  }

  const rimuoviFoto = (indiceDaRimuovere: number) => {
    setFotoSopralluogoTemp((correnti) =>
      correnti.filter((_, indice) => indice !== indiceDaRimuovere)
    )
    setMessaggio('')
  }

  const salvaTutte = async () => {
    if (fotoSopralluogoTemp.length === 0 || salvataggioAttivo) return

    setSalvataggioAttivo(true)
    setMessaggio('Salvataggio foto in corso...')
    try {
      const esito = await salvaFotoSopralluogo()
      if (esito.fallite === 0) {
        setMessaggio(
          esito.salvate === 1 ? 'Foto salvata' : `${esito.salvate} foto salvate`
        )
      } else {
        setMessaggio(
          `${esito.salvate} salvate, ${esito.fallite} ancora in coda`
        )
      }
    } catch {
      setMessaggio('Salvataggio non riuscito: le foto sono ancora in coda')
    } finally {
      setSalvataggioAttivo(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fotocamera sopralluogo"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        background: 'rgba(15,23,42,0.55)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 900,
          maxHeight: '92vh',
          overflow: 'auto',
          padding: 20,
          borderRadius: 16,
          background: '#fff',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Foto sopralluogo</h2>
            <div style={{ marginTop: 4, color: '#64748b', fontSize: 14 }}>
              Scatta tutte le foto, poi salvale insieme.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPopupFotoSopralluogo(false)
              setCameraSopralluogoAttiva(false)
            }}
            aria-label="Chiudi fotocamera"
            style={{
              ...buttonSecondary,
              width: 44,
              height: 44,
              padding: 0,
              flex: '0 0 44px',
              borderRadius: '50%',
              fontSize: 22,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
          <button
            type="button"
            onClick={() => setCameraSopralluogoAttiva(!cameraSopralluogoAttiva)}
            disabled={salvataggioAttivo}
            style={{
              ...buttonPrimary,
              minHeight: 52,
              padding: '12px 18px',
              fontSize: 16,
            }}
          >
            {cameraSopralluogoAttiva ? 'Chiudi fotocamera' : 'Apri fotocamera'}
          </button>

          <input
            ref={fotocameraNativaRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(event) => void aggiungiFoto(event)}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fotocameraNativaRef.current?.click()}
            disabled={salvataggioAttivo}
            style={buttonSecondary}
          >
            Fotocamera dispositivo
          </button>

          <label
            style={{
              ...buttonSecondary,
              display: 'inline-flex',
              alignItems: 'center',
              cursor: salvataggioAttivo ? 'default' : 'pointer',
              opacity: salvataggioAttivo ? 0.6 : 1,
            }}
          >
            Scegli dalla galleria
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={salvataggioAttivo}
              onChange={(event) => void aggiungiFoto(event)}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        {cameraSopralluogoAttiva && (
          <div
            style={{
              marginTop: cameraSopralluogoFullscreen ? 0 : 15,
              position: cameraSopralluogoFullscreen ? 'fixed' : 'relative',
              inset: cameraSopralluogoFullscreen ? 0 : 'auto',
              zIndex: cameraSopralluogoFullscreen ? 20000 : 'auto',
              overflow: 'hidden',
              borderRadius: cameraSopralluogoFullscreen ? 0 : 14,
              background: '#000',
              padding: cameraSopralluogoFullscreen ? 10 : 0,
            }}
          >
            <Webcam
              ref={webcamSopralluogoRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: 'environment' }}
              style={{
                width: '100%',
                height: cameraSopralluogoFullscreen ? '100vh' : 'auto',
                minHeight: cameraSopralluogoFullscreen ? 0 : 320,
                display: 'block',
                objectFit: cameraSopralluogoFullscreen ? 'contain' : 'cover',
              }}
            />

            <div
              aria-live="polite"
              style={{
                position: 'absolute',
                top: 14,
                left: 14,
                zIndex: 30,
                padding: '8px 12px',
                borderRadius: 999,
                background: 'rgba(15,23,42,0.78)',
                color: '#fff',
                fontWeight: 800,
              }}
            >
              {fotoSopralluogoTemp.length} foto pronte
            </div>

            <button
              type="button"
              onClick={() => setCameraSopralluogoFullscreen((valore) => !valore)}
              aria-label={cameraSopralluogoFullscreen ? 'Riduci fotocamera' : 'Ingrandisci fotocamera'}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                zIndex: 40,
                width: 48,
                height: 48,
                border: '2px solid #fff',
                borderRadius: '50%',
                background: 'rgba(15,23,42,0.72)',
                color: '#fff',
                fontSize: 22,
                cursor: 'pointer',
              }}
            >
              {cameraSopralluogoFullscreen ? '↙' : '↗'}
            </button>

            <button
              type="button"
              onClick={scattaFotoSopralluogo}
              disabled={salvataggioAttivo}
              aria-label="Scatta foto"
              style={{
                position: 'absolute',
                bottom: 18,
                left: '50%',
                zIndex: 30,
                width: 82,
                height: 82,
                transform: 'translateX(-50%)',
                border: '5px solid #fff',
                borderRadius: '50%',
                background: '#2563eb',
                color: '#fff',
                fontSize: 30,
                cursor: salvataggioAttivo ? 'default' : 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
              }}
            >
              +
            </button>
          </div>
        )}

        <textarea
          placeholder="Nota comune per queste foto"
          value={notaFotoSopralluogo}
          onChange={(event) => setNotaFotoSopralluogo(event.target.value)}
          disabled={salvataggioAttivo}
          style={{
            width: '100%',
            minHeight: 76,
            marginTop: 15,
            padding: 10,
            border: '1px solid #cbd5e1',
            borderRadius: 10,
          }}
        />

        {fotoSopralluogoTemp.length > 0 && (
          <section
            aria-label="Foto pronte da salvare"
            style={{
              marginTop: 15,
              padding: 14,
              border: '2px solid #bfdbfe',
              borderRadius: 14,
              background: '#eff6ff',
            }}
          >
            <strong style={{ color: '#1e3a8a', fontSize: 16 }}>
              {fotoSopralluogoTemp.length}{' '}
              {fotoSopralluogoTemp.length === 1 ? 'foto pronta' : 'foto pronte'}
            </strong>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: 10,
                marginTop: 12,
              }}
            >
              {fotoSopralluogoTemp.map((foto, indice) => (
                <figure
                  key={`${foto.slice(-32)}-${indice}`}
                  style={{
                    position: 'relative',
                    aspectRatio: '1 / 1',
                    margin: 0,
                    overflow: 'hidden',
                    borderRadius: 10,
                    background: '#fff',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={foto}
                    alt={`Foto pronta ${indice + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <button
                    type="button"
                    onClick={() => rimuoviFoto(indice)}
                    disabled={salvataggioAttivo}
                    aria-label={`Rimuovi foto ${indice + 1}`}
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 44,
                      height: 44,
                      border: '2px solid #fff',
                      borderRadius: '50%',
                      background: 'rgba(15,23,42,0.82)',
                      color: '#fff',
                      fontSize: 23,
                      cursor: salvataggioAttivo ? 'default' : 'pointer',
                    }}
                  >
                    ×
                  </button>
                </figure>
              ))}
            </div>
          </section>
        )}

        {messaggio && (
          <div role="status" aria-live="polite" style={{ marginTop: 12, color: '#334155' }}>
            {messaggio}
          </div>
        )}

        {fotoSopralluogoTemp.length > 0 && (
          <button
            type="button"
            onClick={() => void salvaTutte()}
            disabled={salvataggioAttivo}
            style={{
              ...buttonPrimary,
              width: '100%',
              minHeight: 58,
              marginTop: 16,
              padding: '14px 20px',
              fontSize: 18,
              fontWeight: 800,
              opacity: salvataggioAttivo ? 0.65 : 1,
            }}
          >
            {salvataggioAttivo
              ? 'Salvataggio in corso...'
              : `Salva tutte (${fotoSopralluogoTemp.length})`}
          </button>
        )}
      </div>
    </div>
  )
}
