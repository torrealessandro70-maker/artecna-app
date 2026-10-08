'use client'
import FotoPrivataDesktopV1 from './FotoPrivataDesktopV1'

type Props = {
  fotoFullscreen: any
  setFotoFullscreen: (foto: any) => void
}

export default function FotoFullscreenModal({
  fotoFullscreen,
  setFotoFullscreen,
}: Props) {
  if (!fotoFullscreen) return null

  return (
    <div
      onClick={() => setFotoFullscreen(null)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.92)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        cursor: 'zoom-out',
      }}
    >
      {fotoFullscreen.allegato_v1_id != null ? (
        <FotoPrivataDesktopV1 allegato={fotoFullscreen.allegato_v1_id} rapportino={fotoFullscreen.rapportino_id} foto={fotoFullscreen.id}
          style={{ maxWidth: '95vw', maxHeight: '95vh', borderRadius: 12 }} />
      ) : <img
        src={
  (fotoFullscreen as any).file_url ||
  (fotoFullscreen as any).url ||
  fotoFullscreen.immagine_base64
}
        alt="Fullscreen"
        style={{
          maxWidth: '95%',
          maxHeight: '95%',
          borderRadius: 12,
        }}
      />}
    </div>
  )
}
