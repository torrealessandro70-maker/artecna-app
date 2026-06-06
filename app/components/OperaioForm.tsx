'use client'

import type { CSSProperties } from 'react'

type Props = {
  nomeOperaio: string
  setNomeOperaio: (v: string) => void
  telefonoOperaio: string
  setTelefonoOperaio: (v: string) => void
  qualificaOperaio: string
  setQualificaOperaio: (v: string) => void
  pinOperaio: string
  setPinOperaio: (v: string) => void
  costoOrarioOperaio: string
  setCostoOrarioOperaio: (v: string) => void
  aggiungiOperaio: () => void | Promise<void>
  buttonPrimary: CSSProperties
}

export default function OperaioForm({
  nomeOperaio,
  setNomeOperaio,
  telefonoOperaio,
  setTelefonoOperaio,
  qualificaOperaio,
  setQualificaOperaio,
  pinOperaio,
  setPinOperaio,
  costoOrarioOperaio,
  setCostoOrarioOperaio,
  aggiungiOperaio,
  buttonPrimary,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 15,
      }}
    >
      <input
        placeholder="Nome operaio"
        value={nomeOperaio || ''}
        onChange={(e) => setNomeOperaio(e.target.value)}
        style={{ padding: 8, width: 220 }}
      />

      <input
        placeholder="Telefono"
        value={telefonoOperaio || ''}
        onChange={(e) => setTelefonoOperaio(e.target.value)}
        style={{ padding: 8, width: 160 }}
      />

      <input
        placeholder="Qualifica"
        value={qualificaOperaio || ''}
        onChange={(e) => setQualificaOperaio(e.target.value)}
        style={{ padding: 8, width: 160 }}
      />

      <input
        placeholder="PIN"
        value={pinOperaio || ''}
        onChange={(e) => setPinOperaio(e.target.value)}
        style={{ padding: 8, width: 120 }}
      />

      <input
        placeholder="Costo orario €"
        value={costoOrarioOperaio || ''}
        onChange={(e) => setCostoOrarioOperaio(e.target.value)}
        style={{ padding: 8, width: 140 }}
      />

      <button onClick={aggiungiOperaio} style={buttonPrimary}>
        Aggiungi operaio
      </button>
    </div>
  )
}