'use client'

type Props = {
  titolo: string
  nomeFileAnalisiDocumento: string
  caricaFileAnalisiDocumento: (file: File) => void | Promise<void>
  inputStyle: any
}

export default function DocumentUploadBox({
  titolo,
  nomeFileAnalisiDocumento,
  caricaFileAnalisiDocumento,
  inputStyle,
}: Props) {
  return (
    <div
      style={{
        border: '2px dashed #cbd5e1',
        borderRadius: 12,
        padding: 20,
        background: '#f8fafc',
        marginBottom: 20,
      }}
    >
      <h3 style={{ marginTop: 0 }}>{titolo}</h3>

      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        style={inputStyle}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return

          await caricaFileAnalisiDocumento(file)

          e.target.value = ''
        }}
      />

      <p style={{ marginTop: 10, color: '#64748b' }}>
        Estrae testo, importi e voci da PDF o immagini. L&apos;analisi non
        modifica automaticamente preventivi, SAL o costi.
      </p>

      {nomeFileAnalisiDocumento && (
        <p style={{ marginTop: 10 }}>
          <strong>File caricato:</strong> {nomeFileAnalisiDocumento}
        </p>
      )}
    </div>
  )
}
