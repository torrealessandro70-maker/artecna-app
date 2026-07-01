'use client'

import type { CSSProperties } from 'react'
import SopralluogoQuickActionBar from './SopralluogoQuickActionBar'

type Props = {
  sopralluogoAperto: any

  setSopralluogoAperto: (v: any) => void
  setSopralluogoModificaId: (v: string | null) => void

  setClienteSopralluogo: (v: string) => void
  setTelefonoSopralluogo: (v: string) => void
  setIndirizzoSopralluogo: (v: string) => void
  setDataSopralluogo: (v: string) => void
  setOraSopralluogo: (v: string) => void
  setTipoLavoroSopralluogo: (v: string) => void
  setNoteSopralluogo: (v: string) => void
  setPromemoriaSopralluogo: (v: string) => void
  setGeolocalizzazioneSopralluogo: (v: string) => void

  coloreStatoSopralluogo: (stato?: string) => string

  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
  integrato?: boolean
}

export default function SopralluogoDettaglioHeader({
  sopralluogoAperto,

  setSopralluogoAperto,
  setSopralluogoModificaId,

  setClienteSopralluogo,
  setTelefonoSopralluogo,
  setIndirizzoSopralluogo,
  setDataSopralluogo,
  setOraSopralluogo,
  setTipoLavoroSopralluogo,
  setNoteSopralluogo,
  setPromemoriaSopralluogo,
  setGeolocalizzazioneSopralluogo,

  coloreStatoSopralluogo,

  buttonPrimary,
  buttonSecondary,
  integrato = false,
}: Props) {
  if (!sopralluogoAperto) return null

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        {!integrato && <h2>📍 {sopralluogoAperto.cliente}</h2>}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!integrato && (
            <button
              type="button"
              onClick={() => setSopralluogoAperto(null)}
              style={buttonSecondary}
            >
              Chiudi
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setSopralluogoModificaId(sopralluogoAperto.id || null)
              setClienteSopralluogo(sopralluogoAperto.cliente || '')
              setTelefonoSopralluogo(sopralluogoAperto.telefono || '')
              setIndirizzoSopralluogo(sopralluogoAperto.indirizzo || '')
              setDataSopralluogo(
                sopralluogoAperto.data_sopralluogo ||
                  new Date().toISOString().slice(0, 10)
              )
              setOraSopralluogo(sopralluogoAperto.ora_appuntamento || '')
              setTipoLavoroSopralluogo(sopralluogoAperto.tipo_lavoro || '')
              setNoteSopralluogo(sopralluogoAperto.note || '')
              setPromemoriaSopralluogo(sopralluogoAperto.promemoria || '')
              setGeolocalizzazioneSopralluogo(
                sopralluogoAperto.geolocalizzazione || ''
              )
              setSopralluogoAperto(null)
            }}
            style={{
              ...buttonPrimary,
              backgroundColor: '#f59e0b',
            }}
          >
            ✏️ Modifica sopralluogo
          </button>
        </div>
      </div>

<SopralluogoQuickActionBar
  cliente={sopralluogoAperto.cliente}
  telefono={sopralluogoAperto.telefono}
  indirizzo={sopralluogoAperto.indirizzo}
  dataSopralluogo={sopralluogoAperto.data_sopralluogo}
  oraAppuntamento={sopralluogoAperto.ora_appuntamento}
  tipoLavoro={sopralluogoAperto.tipo_lavoro}
  note={sopralluogoAperto.note}
/>

      <div style={{ display: 'grid', gap: 8 }}>
  <div>
    <strong>Telefono:</strong> {sopralluogoAperto.telefono || '-'}
  </div>

  <div>
    <strong>Indirizzo:</strong> {sopralluogoAperto.indirizzo || '-'}
  </div>

  <div>
    <strong>Data sopralluogo:</strong>{' '}
    {sopralluogoAperto.data_sopralluogo || '-'}
    {sopralluogoAperto.ora_appuntamento
      ? ` · ore ${String(sopralluogoAperto.ora_appuntamento).slice(0, 5)}`
      : ''}
  </div>

        <div>
          <strong>Tipo lavoro:</strong>{' '}
          {sopralluogoAperto.tipo_lavoro || '-'}
        </div>

        <div>
          <strong>Stato:</strong>
          <span
            style={{
              background: coloreStatoSopralluogo(sopralluogoAperto.stato),
              color: '#fff',
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 12,
              marginLeft: 8,
            }}
          >
            {sopralluogoAperto.stato || '-'}
          </span>
        </div>

        <div>
          <strong>Note:</strong>
          <div
            style={{
              marginTop: 6,
              padding: 10,
              background: '#f8fafc',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              whiteSpace: 'pre-wrap',
            }}
          >
            {sopralluogoAperto.note || 'Nessuna nota inserita'}
          </div>
        </div>
      </div>
    </>
  )
}
