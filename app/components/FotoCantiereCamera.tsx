'use client'

import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import Webcam from 'react-webcam'

type Props = {
  cameraFotoCantiereAttiva: boolean
  cameraFotoCantiereFullscreen: boolean
  setCameraFotoCantiereFullscreen: Dispatch<SetStateAction<boolean>>
  webcamFotoCantiereRef: MutableRefObject<Webcam | null>
  scattaFotoCantiere: () => void
}

export default function FotoCantiereCamera({
  cameraFotoCantiereAttiva,
  cameraFotoCantiereFullscreen,
  setCameraFotoCantiereFullscreen,
  webcamFotoCantiereRef,
  scattaFotoCantiere,
}: Props) {
  if (!cameraFotoCantiereAttiva) return null

  return (
    <div
      style={{
        marginTop: cameraFotoCantiereFullscreen ? 0 : 15,
        position: cameraFotoCantiereFullscreen ? 'fixed' : 'relative',
        inset: cameraFotoCantiereFullscreen ? 0 : 'auto',
        zIndex: cameraFotoCantiereFullscreen ? 20000 : 'auto',
        background: cameraFotoCantiereFullscreen ? '#000' : 'transparent',
        padding: cameraFotoCantiereFullscreen ? 10 : 0,
      }}
    >
      <button
        type="button"
        onClick={() => setCameraFotoCantiereFullscreen((v) => !v)}
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
        }}
      >
        {cameraFotoCantiereFullscreen ? '↙️' : '↗️'}
      </button>

      <Webcam
        ref={webcamFotoCantiereRef}
        audio={false}
        screenshotFormat="image/jpeg"
        screenshotQuality={0.9}
        videoConstraints={{
          facingMode: 'environment',
        }}
        style={{
          width: '100%',
          height: cameraFotoCantiereFullscreen ? '100vh' : 'auto',
          objectFit: cameraFotoCantiereFullscreen ? 'contain' : 'cover',
          borderRadius: cameraFotoCantiereFullscreen ? 0 : 12,
        }}
      />

      <button
        type="button"
        onClick={scattaFotoCantiere}
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
          zIndex: 30,
        }}
      >
        📸
      </button>
    </div>
  )
}