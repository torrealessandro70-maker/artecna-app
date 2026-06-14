import type { CSSProperties } from 'react'

type Props = {
  titolo: string
  dataTimbraturaModifica: string
  setDataTimbraturaModifica: (v: string) => void
  oraEntrataModifica: string
  setOraEntrataModifica: (v: string) => void
  oraUscitaModifica: string
  setOraUscitaModifica: (v: string) => void
  parseOra: (ora: string) => number | null
  onChiudi: () => void
  onSalva: () => void | Promise<void>
  buttonSecondary: CSSProperties
  buttonPrimary: CSSProperties
}

export default function PopupModificaTimbratura({
  titolo,
  dataTimbraturaModifica,
  setDataTimbraturaModifica,
  oraEntrataModifica,
  setOraEntrataModifica,
  oraUscitaModifica,
  setOraUscitaModifica,
  parseOra,
  onChiudi,
  onSalva,
  buttonSecondary,
  buttonPrimary,
}: Props) {
  const entrata = parseOra(oraEntrataModifica)
  const uscita = parseOra(oraUscitaModifica)

  const oreLavorate =
    entrata === null || uscita === null || uscita < entrata
      ? '0.00'
      : ((uscita - entrata) / 60).toFixed(2)

  return (
    <div
      onClick={onChiudi}
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
          maxWidth: 700,
          background: '#fff',
          borderRadius: 14,
          padding: 20,
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
        }}
      >
        <h3 style={{ marginTop: 0 }}>{titolo}</h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          <input
            type="date"
            value={dataTimbraturaModifica}
            onChange={(e) => setDataTimbraturaModifica(e.target.value)}
          />

          <input
            type="time"
            value={oraEntrataModifica}
            onChange={(e) => setOraEntrataModifica(e.target.value)}
          />

          <input
            type="time"
            value={oraUscitaModifica}
            onChange={(e) => setOraUscitaModifica(e.target.value)}
          />
        </div>

        <div
          style={{
            marginTop: 15,
            padding: 12,
            borderRadius: 10,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
          }}
        >
          <strong>Ore lavorate:</strong> {oreLavorate}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 15,
          }}
        >
          <button onClick={onChiudi} style={buttonSecondary}>
            Annulla
          </button>

          <button onClick={onSalva} style={buttonPrimary}>
            Salva modifica
          </button>
        </div>
      </div>
    </div>
  )
}