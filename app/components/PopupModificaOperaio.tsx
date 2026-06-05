'use client'

import type { CSSProperties } from 'react'

type Props = {
  operaioInModifica: any
  annullaModificaOperaio: () => void
  salvaModificaOperaio: () => void | Promise<void>

  nomeOperaioModifica: string
  setNomeOperaioModifica: (v: string) => void
  telefonoOperaioModifica: string
  setTelefonoOperaioModifica: (v: string) => void
  qualificaOperaioModifica: string
  setQualificaOperaioModifica: (v: string) => void
  pinOperaioModifica: string
  setPinOperaioModifica: (v: string) => void
  costoOrarioOperaioModifica: string
  setCostoOrarioOperaioModifica: (v: string) => void
  statoOperaioModifica: string
  setStatoOperaioModifica: (v: string) => void
  notaOperaioModifica: string
  setNotaOperaioModifica: (v: string) => void

  buttonSecondary: CSSProperties
  buttonPrimary: CSSProperties
}

export default function PopupModificaOperaio({
  operaioInModifica,
  annullaModificaOperaio,
  salvaModificaOperaio,

  nomeOperaioModifica,
  setNomeOperaioModifica,
  telefonoOperaioModifica,
  setTelefonoOperaioModifica,
  qualificaOperaioModifica,
  setQualificaOperaioModifica,
  pinOperaioModifica,
  setPinOperaioModifica,
  costoOrarioOperaioModifica,
  setCostoOrarioOperaioModifica,
  statoOperaioModifica,
  setStatoOperaioModifica,
  notaOperaioModifica,
  setNotaOperaioModifica,

  buttonSecondary,
  buttonPrimary,
}: Props) {
  if (!operaioInModifica) return null

  return (
    <div
      onClick={annullaModificaOperaio}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          background: '#ffffff',
          borderRadius: 14,
          padding: 20,
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
          border: '1px solid #e5e7eb',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Modifica operaio</h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          <input
            placeholder="Nome operaio"
            value={nomeOperaioModifica}
            onChange={(e) => setNomeOperaioModifica(e.target.value)}
          />

          <input
            placeholder="Telefono"
            value={telefonoOperaioModifica}
            onChange={(e) => setTelefonoOperaioModifica(e.target.value)}
          />

          <input
            placeholder="Qualifica"
            value={qualificaOperaioModifica}
            onChange={(e) => setQualificaOperaioModifica(e.target.value)}
          />

          <input
            placeholder="PIN"
            value={pinOperaioModifica}
            onChange={(e) => setPinOperaioModifica(e.target.value)}
          />

          <input
            placeholder="Costo orario €"
            value={costoOrarioOperaioModifica}
            onChange={(e) => setCostoOrarioOperaioModifica(e.target.value)}
          />

          <select
            value={statoOperaioModifica}
            onChange={(e) => setStatoOperaioModifica(e.target.value)}
          >
            <option value="attivo">Attivo</option>
            <option value="sospeso">Sospeso</option>
          </select>
        </div>

        <textarea
          placeholder="Nota operaio"
          value={notaOperaioModifica}
          onChange={(e) => setNotaOperaioModifica(e.target.value)}
          style={{
            marginTop: 10,
            minHeight: 110,
            width: '100%',
            padding: 10,
            borderRadius: 10,
            border: '1px solid #cbd5e1',
          }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 15,
          }}
        >
          <button onClick={annullaModificaOperaio} style={buttonSecondary}>
            Annulla
          </button>

          <button onClick={salvaModificaOperaio} style={buttonPrimary}>
            Salva modifica
          </button>
        </div>
      </div>
    </div>
  )
}