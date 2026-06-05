'use client'

type PreventivoLavorazioniFormProps = {
  prevDescrizione: string
  setPrevDescrizione: (value: string) => void
  prevQuantita: string
  setPrevQuantita: (value: string) => void
  prevPrezzoUnitario: string
  setPrevPrezzoUnitario: (value: string) => void
  prevUnita: string
  setPrevUnita: (value: string) => void
  prevImporto: string
  setPrevImporto: (value: string) => void
  onSalva: () => void
  buttonPrimary: any
}

export default function PreventivoLavorazioniForm({
  prevDescrizione,
  setPrevDescrizione,
  prevQuantita,
  setPrevQuantita,
  prevPrezzoUnitario,
  setPrevPrezzoUnitario,
  prevUnita,
  setPrevUnita,
  prevImporto,
  setPrevImporto,
  onSalva,
  buttonPrimary,
}: PreventivoLavorazioniFormProps) {
  return (
    <>
      <input
        placeholder="Descrizione"
        value={prevDescrizione}
        onChange={(e) => setPrevDescrizione(e.target.value)}
        style={{ padding: 8, width: 240 }}
      />

      <input
        placeholder="Quantità"
        value={prevQuantita}
        onChange={(e) => setPrevQuantita(e.target.value)}
        style={{ padding: 8, width: 100 }}
      />

      <input
        placeholder="Prezzo unit."
        value={prevPrezzoUnitario}
        onChange={(e) => setPrevPrezzoUnitario(e.target.value)}
        style={{ padding: 8, width: 120 }}
      />

      <input
        placeholder="UM"
        value={prevUnita}
        onChange={(e) => setPrevUnita(e.target.value)}
        style={{ padding: 8, width: 80 }}
      />

      <input
        placeholder="Importo totale"
        value={prevImporto}
        onChange={(e) => setPrevImporto(e.target.value)}
        style={{ padding: 8, width: 140 }}
      />

      <button
        onClick={onSalva}
        style={buttonPrimary}
      >
        Salva lavorazione preventivo
      </button>
    </>
  )
}