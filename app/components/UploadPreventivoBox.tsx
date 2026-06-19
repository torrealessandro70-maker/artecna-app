'use client'

type Props = {
  cantiereScheda: string
  handleUploadPreventivo: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void | Promise<void>
}

export default function UploadPreventivoBox({
  cantiereScheda,
  handleUploadPreventivo,
}: Props) {
  return (
    <>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        Carica preventivo ufficiale
      </div>

      <div
        style={{
          fontSize: 13,
          color: '#64748b',
          marginBottom: 10,
        }}
      >
        Archivia il preventivo nel fascicolo e aggiorna il totale quando
        l’importo viene rilevato con sicurezza. PDF, Excel o immagini.
      </div>

      <input
        type="file"
        disabled={!cantiereScheda}
        accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png,.webp"
        onChange={handleUploadPreventivo}
        style={{
          maxWidth: 320,
          margin: '0 auto',
        }}
      />
    </>
  )
}
