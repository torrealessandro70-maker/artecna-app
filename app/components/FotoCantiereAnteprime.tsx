'use client'

import type { Dispatch, SetStateAction } from 'react'

type Props = {
  fotoDaCaricare: string[]
  setFotoDaCaricare: Dispatch<SetStateAction<string[]>>
  setFotoFullscreen: (foto: any) => void
}
export default function FotoCantiereAnteprime({
  fotoDaCaricare,
  setFotoDaCaricare,
  setFotoFullscreen,
}: Props) {
  if (fotoDaCaricare.length === 0) return null

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: 10,
        marginBottom: 15,
      }}
    >
      {fotoDaCaricare.map((foto, i) => (
        <div key={i} style={{ position: 'relative' }}>
          <img
  src={foto}
  alt={`Anteprima ${i + 1}`}
  onClick={() =>
    setFotoFullscreen({
      immagine_base64: foto,
    })
  }
  style={{
    width: '100%',
    height: 120,
    objectFit: 'contain',
    background: '#f8fafc',
    borderRadius: 10,
    border: '1px solid #cbd5e1',
    cursor: 'zoom-in',
  }}
/>

         <button
  type="button"
  onClick={(e) => {
    e.stopPropagation()

    setFotoDaCaricare((lista) =>
      lista.filter((_, index) => index !== i)
    )
  }}
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
  )
}
