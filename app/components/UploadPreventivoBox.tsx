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
        📎 Trascina qui il file del preventivo
      </div>

      <div
        style={{
          fontSize: 13,
          color: '#64748b',
          marginBottom: 10,
        }}
      >
        PDF, Excel o immagini — oppure clicca per selezionare
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