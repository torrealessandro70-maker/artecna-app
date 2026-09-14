'use client'

import { useRef, type CSSProperties, type ChangeEvent } from 'react'

type Props = {
  contestuale?: boolean
  caricaFotoDaInput: (e: ChangeEvent<HTMLInputElement>) => void
  cameraFotoCantiereAttiva: boolean
  setCameraFotoCantiereAttiva: (v: boolean) => void
  rilevaPosizioneFoto: () => void | Promise<void>
  fotoDaCaricare: string[]
  categoriaFoto: string
  setCategoriaFotoDaSalvare: (v: string) => void
  setPopupCategoriaFotoCantiere: (v: boolean) => void
  esportaPdfFotoCantiere: () => void | Promise<void>
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function FotoCantiereToolbar({
  contestuale = false,
  caricaFotoDaInput,
  cameraFotoCantiereAttiva,
  setCameraFotoCantiereAttiva,
  rilevaPosizioneFoto,
  fotoDaCaricare,
  categoriaFoto,
  setCategoriaFotoDaSalvare,
  setPopupCategoriaFotoCantiere,
  esportaPdfFotoCantiere,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const selezioneFileRef = useRef<HTMLInputElement>(null)
  const fotocameraNativaRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <h3 style={{ marginTop: 0 }}>{contestuale ? 'Foto del cantiere' : '📸 Foto cantiere'}</h3>

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 12,
          alignItems: 'center',
        }}
      >
        <input
          ref={fotocameraNativaRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={caricaFotoDaInput}
          style={{ display: 'none' }}
        />

        <button
          type="button"
          onClick={() => fotocameraNativaRef.current?.click()}
          style={buttonPrimary}
        >
          📷 Scatta con fotocamera
        </button>

        {contestuale ? (
          <>
            <input ref={selezioneFileRef} type="file" accept="image/*" multiple
              onChange={caricaFotoDaInput} style={{ display: 'none' }} />
            <button type="button" onClick={() => selezioneFileRef.current?.click()}
              style={{ ...buttonPrimary, minHeight: 44 }}>
              + Aggiungi foto
            </button>
          </>
        ) : (
        <label style={{ ...buttonSecondary, cursor: 'pointer' }}>
          🖼️ Scegli dalla galleria
          <input
          type="file"
          accept="image/*"
          multiple
          onChange={caricaFotoDaInput}
            style={{ display: 'none' }}
          />
        </label>
        )}

        <button
          type="button"
          onClick={() =>
            setCameraFotoCantiereAttiva(!cameraFotoCantiereAttiva)
          }
          style={buttonSecondary}
        >
          {cameraFotoCantiereAttiva
            ? 'Chiudi fotocamera web'
            : 'Fotocamera web'}
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
          onClick={() => {
            if (fotoDaCaricare.length === 0) {
              alert('Carica o scatta almeno una foto')
              return
            }

            setCategoriaFotoDaSalvare(categoriaFoto || 'durante')
            setPopupCategoriaFotoCantiere(true)
          }}
          style={buttonPrimary}
        >
          💾 Salva foto
        </button>

        <button
          type="button"
          onClick={esportaPdfFotoCantiere}
          style={buttonSecondary}
        >
          📄 Esporta PDF foto
        </button>
      </div>
    </>
  )
}
