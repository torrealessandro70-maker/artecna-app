'use client'

type Props = {
  dataPresenzaManuale: string
  setDataPresenzaManuale: (v: string) => void
  operaioPresenzaManuale: string
  setOperaioPresenzaManuale: (v: string) => void
  cantierePresenzaManuale: string
  setCantierePresenzaManuale: (v: string) => void
  oraEntrataManuale: string
  setOraEntrataManuale: (v: string) => void
  oraUscitaManuale: string
  setOraUscitaManuale: (v: string) => void
  operaiAnagrafica: any[]
  cantieri: any[]
  aggiungiPresenzaManuale: () => void | Promise<void>
  buttonPrimary: React.CSSProperties
}

export default function PresenzaManualePanel({
  dataPresenzaManuale,
  setDataPresenzaManuale,
  operaioPresenzaManuale,
  setOperaioPresenzaManuale,
  cantierePresenzaManuale,
  setCantierePresenzaManuale,
  oraEntrataManuale,
  setOraEntrataManuale,
  oraUscitaManuale,
  setOraUscitaManuale,
  operaiAnagrafica,
  cantieri,
  aggiungiPresenzaManuale,
  buttonPrimary,
}: Props) {
  return (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8, background: '#fff', marginBottom: 20 }}>
      <h3>Inserisci presenza manuale</h3>

      <input
        type="date"
        value={dataPresenzaManuale}
        onChange={(e) => setDataPresenzaManuale(e.target.value)}
      />

      <select
        value={operaioPresenzaManuale}
        onChange={(e) => setOperaioPresenzaManuale(e.target.value)}
      >
        <option value="">Seleziona operaio</option>
        {operaiAnagrafica.map((o, i) => (
          <option key={o.id || i} value={o.nome}>
            {o.nome}
          </option>
        ))}
      </select>

      <select
        value={cantierePresenzaManuale}
        onChange={(e) => setCantierePresenzaManuale(e.target.value)}
      >
        <option value="">Seleziona cantiere</option>
        {cantieri.map((c, i) => (
          <option key={c.id || i} value={c.nome}>
            {c.nome}
          </option>
        ))}
      </select>

      <input
        type="time"
        value={oraEntrataManuale}
        onChange={(e) => setOraEntrataManuale(e.target.value)}
      />

      <input
        type="time"
        value={oraUscitaManuale}
        onChange={(e) => setOraUscitaManuale(e.target.value)}
      />

      <button onClick={aggiungiPresenzaManuale} style={buttonPrimary}>
        Aggiungi presenza
      </button>
    </div>
  )
}