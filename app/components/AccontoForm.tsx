'use client'

type AccontoFormProps = {
  descrizione: string
  setDescrizione: (value: string) => void
  importo: string
  setImporto: (value: string) => void
  data: string
  setData: (value: string) => void
  metodo: string
  setMetodo: (value: string) => void
  nota: string
  setNota: (value: string) => void
  onSalva: () => void
}

export default function AccontoForm({ onSalva }: AccontoFormProps) {
  return <div style={{ marginTop: 12, marginBottom: 12 }}>
    <button type="button" onClick={onSalva}>Registra acconto</button>
    <p>Compila una sola volta i dati, poi conferma separatamente stato fiscale e incasso.</p>
  </div>
}
