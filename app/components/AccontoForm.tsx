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

export default function AccontoForm({
  descrizione,
  setDescrizione,
  importo,
  setImporto,
  data,
  setData,
  metodo,
  setMetodo,
  nota,
  setNota,
  onSalva,
}: AccontoFormProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 10,
        marginTop: 12,
        marginBottom: 12,
      }}
    >
      <input
        value={descrizione}
        onChange={(e) => setDescrizione(e.target.value)}
        placeholder="Descrizione"
      />

      <input
        value={importo}
        onChange={(e) => setImporto(e.target.value)}
        placeholder="Importo"
        type="number"
        step="0.01"
      />

      <input
        value={data}
        onChange={(e) => setData(e.target.value)}
        type="date"
      />

      <input
        value={metodo}
        onChange={(e) => setMetodo(e.target.value)}
        placeholder="Metodo"
      />

      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Nota"
      />

      <button onClick={onSalva}>
        Salva acconto
      </button>
    </div>
  )
}