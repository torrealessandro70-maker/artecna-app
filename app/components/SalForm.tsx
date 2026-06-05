'use client'

type SalFormProps = {
  salDescrizione: string
  setSalDescrizione: (value: string) => void
  salImportoPrevisto: string
  setSalImportoPrevisto: (value: string) => void
  salPercentuale: string
  setSalPercentuale: (value: string) => void
  salNote: string
  setSalNote: (value: string) => void
  onSalva: () => void
  buttonPrimary: any
}

export default function SalForm({
  salDescrizione,
  setSalDescrizione,
  salImportoPrevisto,
  setSalImportoPrevisto,
  salPercentuale,
  setSalPercentuale,
  salNote,
  setSalNote,
  onSalva,
  buttonPrimary,
}: SalFormProps) {
  return (
    <>
      <input
        placeholder="Descrizione lavorazione"
        value={salDescrizione}
        onChange={(e) => setSalDescrizione(e.target.value)}
        style={{ padding: 8, width: 260 }}
      />

      <input
        placeholder="Importo previsto €"
        value={salImportoPrevisto}
        onChange={(e) => setSalImportoPrevisto(e.target.value)}
        style={{ padding: 8, width: 160 }}
      />

      <input
        placeholder="% eseguita"
        value={salPercentuale}
        onChange={(e) => setSalPercentuale(e.target.value)}
        style={{ padding: 8, width: 130 }}
      />

      <input
        placeholder="Note"
        value={salNote}
        onChange={(e) => setSalNote(e.target.value)}
        style={{ padding: 8, width: 220 }}
      />

      <button onClick={onSalva} style={buttonPrimary}>
        Salva lavorazione SAL
      </button>
    </>
  )
}