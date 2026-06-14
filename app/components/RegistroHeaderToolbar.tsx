'use client'

import type { CSSProperties } from 'react'

type Props = {
  registroTab: string
  setRegistroTab: (value: string) => void
  registroCerca: string
  setRegistroCerca: (value: string) => void
  registroFiltroDataDa: string
  setRegistroFiltroDataDa: (value: string) => void
  registroFiltroDataA: string
  setRegistroFiltroDataA: (value: string) => void
  setRegistroFiltroNome: (value: string) => void
  buttonSecondary: CSSProperties
}

export default function RegistroHeaderToolbar({
  registroTab,
  setRegistroTab,
  registroCerca,
  setRegistroCerca,
  registroFiltroDataDa,
  setRegistroFiltroDataDa,
  registroFiltroDataA,
  setRegistroFiltroDataA,
  setRegistroFiltroNome,
  buttonSecondary,
}: Props) {
  return (
    <>
      <h2>Registro dati</h2>

      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 20,
          overflowX: 'auto',
          paddingBottom: 6,
        }}
      >
        {[
          ['preventivi', '📄 Preventivi'],
          ['cantieri', '🏗️ Cantieri'],
          ['rapportini', '📋 Rapportini'],
          ['operai', '👷 Operai'],
          ['timbrature', '⏱️ Timbrature'],
          ['pagamenti-operai', '💳 Pagamenti operai'],
          ['fatture-fornitori', '📄 Fatture fornitori'],
          ['fatture-emesse', '🧾 Fatture emesse'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setRegistroTab(key)}
            style={{
              ...buttonSecondary,
              backgroundColor: registroTab === key ? '#2563eb' : '#f8fafc',
              color: registroTab === key ? '#fff' : '#111827',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 20,
          alignItems: 'center',
        }}
      >
        <input
          placeholder="Ricerca libera..."
          value={registroCerca}
          onChange={(e) => setRegistroCerca(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            minWidth: 220,
          }}
        />

        <input
          placeholder={
            registroTab === 'preventivi'
              ? 'Cantiere / File'
              : registroTab === 'cantieri'
              ? 'Nome cantiere'
              : registroTab === 'rapportini'
              ? 'Operai / Cantiere'
              : registroTab === 'operai'
              ? 'Nome operaio'
              : registroTab === 'timbrature'
              ? 'Operaio / Cantiere'
              : registroTab === 'pagamenti-operai'
              ? 'Operaio / Metodo'
              : 'Filtro specifico'
          }
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Da</span>

          <input
            type="date"
            value={registroFiltroDataDa}
            onChange={(e) => setRegistroFiltroDataDa(e.target.value)}
            style={{
              padding: 10,
              borderRadius: 8,
              border: '1px solid #cbd5e1',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>A</span>

          <input
            type="date"
            value={registroFiltroDataA}
            onChange={(e) => setRegistroFiltroDataA(e.target.value)}
            style={{
              padding: 10,
              borderRadius: 8,
              border: '1px solid #cbd5e1',
            }}
          />
        </div>

        <button
          onClick={() => {
            setRegistroCerca('')
            setRegistroFiltroNome('')
            setRegistroFiltroDataDa('')
            setRegistroFiltroDataA('')
          }}
          style={buttonSecondary}
        >
          Reset filtri
        </button>
      </div>
    </>
  )
}