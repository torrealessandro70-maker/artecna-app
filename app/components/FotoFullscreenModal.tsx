'use client'

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
      <img
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
      />
    </div>
  )
}