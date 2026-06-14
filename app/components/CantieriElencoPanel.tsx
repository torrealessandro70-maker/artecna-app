'use client'

type Props = {
  cantieri: any[]
  ricercaCantiere: string
  setRicercaCantiere: (v: string) => void
  setNomeCantiere: (v: string) => void
  preventivoCantiereInput: string
  setPreventivoCantiereInput: (v: string) => void
  aggiungiCantiere: () => void
  mostraCantieriConclusi: boolean
  setMostraCantieriConclusi: (v: boolean) => void
  ordinaCantieriCampo: string
  ordinaCantieriDirezione: string
  cambiaOrdinamentoCantieri: (
  campo: 'nome' | 'preventivo' | 'inizio' | 'fine' | 'concluso'
) => void
  setCantiereScheda: (v: string) => void
  setSottoSezioneCantieri: (v: string) => void
  eliminaCantiere: (nome: string) => void
  formatMoney: (n: number) => string
  cardStyle: any
  excelTable: any
  excelTh: any
  excelTd: any
  buttonPrimary: any
  buttonSecondary: any
}

export default function CantieriElencoPanel({
  cantieri,
  ricercaCantiere,
  setRicercaCantiere,
  setNomeCantiere,
  preventivoCantiereInput,
  setPreventivoCantiereInput,
  aggiungiCantiere,
  mostraCantieriConclusi,
  setMostraCantieriConclusi,
  ordinaCantieriCampo,
  ordinaCantieriDirezione,
  cambiaOrdinamentoCantieri,
  setCantiereScheda,
  setSottoSezioneCantieri,
  eliminaCantiere,
  formatMoney,
  cardStyle,
  excelTable,
  excelTh,
  excelTd,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  return (
    <div style={cardStyle}>
      <h2>Elenco cantieri</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 15 }}>
        <input
          placeholder="Nome cantiere"
          value={ricercaCantiere || ''}
          onChange={(e) => {
            setRicercaCantiere(e.target.value)
            setNomeCantiere(e.target.value)
          }}
          style={{ padding: 8, width: 220 }}
        />

        <input
          placeholder="Preventivo €"
          value={preventivoCantiereInput || ''}
          onChange={(e) => setPreventivoCantiereInput(e.target.value)}
          style={{ padding: 8, width: 140 }}
        />

        <button onClick={aggiungiCantiere} style={buttonPrimary}>
          Aggiungi
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() =>
            setMostraCantieriConclusi(!mostraCantieriConclusi)
          }
          style={buttonSecondary}
        >
          {mostraCantieriConclusi
            ? 'Nascondi cantieri conclusi'
            : `Mostra cantieri conclusi (${
                cantieri.filter((c) => c.lavori_conclusi).length
              })`}
        </button>
      </div>

      {cantieri.length === 0 ? (
        <p>Nessun cantiere presente</p>
      ) : (
        <div
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            overflow: 'auto',
            background: '#fff',
          }}
        >
          <h3 style={{ padding: 12, margin: 0 }}>
            🏗️ Registro cantieri
          </h3>

          <table
            style={{
              ...excelTable,
              width: '100%',
              tableLayout: 'auto',
            }}
          >
            <thead>
              <tr>
                <th
                  style={excelTh}
                  onClick={() => cambiaOrdinamentoCantieri('nome')}
                >
                  Nome ↕
                </th>
                <th
                  style={excelTh}
                  onClick={() => cambiaOrdinamentoCantieri('preventivo')}
                >
                  Preventivo ↕
                </th>
                <th
                  style={excelTh}
                  onClick={() => cambiaOrdinamentoCantieri('inizio')}
                >
                  Inizio ↕
                </th>
                <th
                  style={excelTh}
                  onClick={() => cambiaOrdinamentoCantieri('fine')}
                >
                  Fine ↕
                </th>
                <th
                  style={excelTh}
                  onClick={() => cambiaOrdinamentoCantieri('concluso')}
                >
                  Concluso ↕
                </th>
                <th style={excelTh}>Azioni</th>
              </tr>
            </thead>

            <tbody>
              {[
                ...cantieri.filter(
                  (c) =>
                    !c.lavori_conclusi &&
                    String(c.nome || '')
                      .toLowerCase()
                      .includes(ricercaCantiere.toLowerCase())
                ),
                ...(mostraCantieriConclusi
                  ? cantieri.filter(
                      (c) =>
                        c.lavori_conclusi &&
                        String(c.nome || '')
                          .toLowerCase()
                          .includes(ricercaCantiere.toLowerCase())
                    )
                  : []),
              ]
                .sort((a, b) => {
                  let valoreA: any = ''
                  let valoreB: any = ''

                  if (ordinaCantieriCampo === 'nome') {
                    valoreA = a.nome || ''
                    valoreB = b.nome || ''
                  }

                  if (ordinaCantieriCampo === 'preventivo') {
                    valoreA = Number(a.preventivo || 0)
                    valoreB = Number(b.preventivo || 0)
                  }

                  if (ordinaCantieriCampo === 'inizio') {
                    valoreA = a.data_inizio_lavori || ''
                    valoreB = b.data_inizio_lavori || ''
                  }

                  if (ordinaCantieriCampo === 'fine') {
                    valoreA = a.data_fine_lavori || ''
                    valoreB = b.data_fine_lavori || ''
                  }

                  if (ordinaCantieriCampo === 'concluso') {
                    valoreA = a.lavori_conclusi ? 1 : 0
                    valoreB = b.lavori_conclusi ? 1 : 0
                  }

                  if (typeof valoreA === 'number') {
                    return ordinaCantieriDirezione === 'asc'
                      ? valoreA - valoreB
                      : valoreB - valoreA
                  }

                  return ordinaCantieriDirezione === 'asc'
                    ? String(valoreA).localeCompare(String(valoreB))
                    : String(valoreB).localeCompare(String(valoreA))
                })
                .map((c, i) => (
                  <tr key={c.id || i}>
                    <td style={excelTd}>
                      {ricercaCantiere &&
                      c.nome
                        ?.toLowerCase()
                        .includes(ricercaCantiere.toLowerCase()) ? (
                        <>
                          {c.nome
                            .split(new RegExp(`(${ricercaCantiere})`, 'gi'))
                            .map((parte: string, idx: number) =>
                              parte.toLowerCase() ===
                              ricercaCantiere.toLowerCase() ? (
                                <mark
                                  key={idx}
                                  style={{
                                    background: '#fde047',
                                    padding: '0 2px',
                                    borderRadius: 3,
                                  }}
                                >
                                  {parte}
                                </mark>
                              ) : (
                                parte
                              )
                            )}
                        </>
                      ) : (
                        c.nome
                      )}
                    </td>

                    <td style={excelTd}>
                      {formatMoney(Number(c.preventivo || 0))}
                    </td>

                    <td style={excelTd}>{c.data_inizio_lavori || '-'}</td>

                    <td style={excelTd}>{c.data_fine_lavori || '-'}</td>

                    <td style={excelTd}>
                      {c.lavori_conclusi ? 'Sì' : 'No'}
                    </td>

                    <td style={excelTd}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => {
                            setCantiereScheda(String(c.nome || ''))
                            setSottoSezioneCantieri('scheda')
                          }}
                          style={buttonSecondary}
                        >
                          ✔️
                        </button>

                        <button
                          onClick={() => eliminaCantiere(String(c.nome || ''))}
                          style={{
                            background: '#dc2626',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '8px 10px',
                            cursor: 'pointer',
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}