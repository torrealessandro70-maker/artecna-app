'use client'

import type { CSSProperties, Dispatch, SetStateAction } from 'react'

type Props = {
  notaFotoCantiere: string
 setNotaFotoCantiere: Dispatch<SetStateAction<string>>

  categoriaFoto: string
  setCategoriaFoto: (v: string) => void

  note: string
  setNote: (v: string) => void

  avviaDettatura: (
    callback: (testo: string) => void
  ) => void

  buttonSecondary: CSSProperties
}

export default function FotoCantiereForm({
  notaFotoCantiere,
  setNotaFotoCantiere,
  categoriaFoto,
  setCategoriaFoto,
  note,
  setNote,
  avviaDettatura,
  buttonSecondary,
}: Props) {
  return (
    <>
      <textarea
        value={notaFotoCantiere}
        onChange={(e) =>
          setNotaFotoCantiere(e.target.value)
        }
        placeholder="Descrivi il lavoro eseguito..."
        style={{
          width: '100%',
          minHeight: 70,
          padding: 10,
          borderRadius: 8,
          border: '1px solid #cbd5e1',
          marginBottom: 12,
        }}
      />

      <select
        value={categoriaFoto}
        onChange={(e) =>
          setCategoriaFoto(e.target.value)
        }
        style={{
          padding: 10,
          borderRadius: 8,
          border: '1px solid #cbd5e1',
          marginBottom: 12,
          marginTop: 10,
        }}
      >
        <option value="prima">📷 Prima</option>
        <option value="durante">🔨 Durante</option>
        <option value="dopo">✅ Dopo</option>
        <option value="problema">⚠ Problema</option>
      </select>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Descrivi il lavoro eseguito..."
        style={{
          width: '100%',
          minHeight: 120,
        }}
      />

      <button
        type="button"
        onClick={() =>
          avviaDettatura((testo) =>
            setNotaFotoCantiere((prev) =>
              prev ? prev + ' ' + testo : testo
            )
          )
        }
        style={{
          ...buttonSecondary,
          marginTop: 8,
        }}
      >
        🎤 Avvia dettatura
      </button>
    </>
  )
}