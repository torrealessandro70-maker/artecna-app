'use client'

import type { CSSProperties } from 'react'

type Props = {
  messaggioAi: string
  descrizionePreventivoAi: string
  setDescrizionePreventivoAi: (v: string) => void

  vociPreventivoAi: any[]
  setVociPreventivoAi: (v: any[]) => void
  vociPreventivoAiOriginali: any[]

  calcolaMediaPrezziSimili: (descrizione: string) => number | null
  verificaPrezzoAnomalo: (descrizione: string, prezzo: number) => string

  formatMoney: (v: any) => string
  miglioraVocePreventivoAi: (index: number) => void | Promise<void>
  salvaInMemoriaPrezzi: (voce: any) => void | Promise<void>
  generaExcelDefinitivoPreventivoAi: () => void | Promise<void>

  preventivoRegistroCantiere: string
  setMostraRevisionePreventivoAi: (v: boolean) => void

  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function RevisionePreventivoAiPanel({
  messaggioAi,
  descrizionePreventivoAi,
  setDescrizionePreventivoAi,
  vociPreventivoAi,
  setVociPreventivoAi,
  vociPreventivoAiOriginali,
  calcolaMediaPrezziSimili,
  verificaPrezzoAnomalo,
  formatMoney,
  miglioraVocePreventivoAi,
  salvaInMemoriaPrezzi,
  generaExcelDefinitivoPreventivoAi,
  preventivoRegistroCantiere,
  setMostraRevisionePreventivoAi,
  excelTable,
  excelTh,
  excelTd,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const subTotale = vociPreventivoAi.reduce(
    (tot, voce) =>
      tot +
      Number(voce.quantita || 0) *
        Number(voce.prezzo_unitario || 0),
    0
  )

  return (
    <div
      style={{
        marginTop: 20,
        padding: 16,
        border: '1px solid #cbd5e1',
        borderRadius: 12,
        background: '#fff',
      }}
    >
      <h3
        style={{
          fontSize: 28,
          marginBottom: 20,
        }}
      >
        🤖 Revisione preventivo AI
      </h3>

      {messaggioAi && (
        <div
          style={{
            marginBottom: 15,
            padding: 12,
            borderRadius: 8,
            background: '#dcfce7',
            color: '#166534',
            fontWeight: 600,
            fontSize: 18,
          }}
        >
          {messaggioAi}
        </div>
      )}

      <textarea
        value={descrizionePreventivoAi}
        onChange={(e) => setDescrizionePreventivoAi(e.target.value)}
        style={{
          width: '100%',
          minHeight: 140,
          padding: 14,
          marginBottom: 15,
          fontSize: 18,
        }}
      />

      <div
        style={{
          marginBottom: 16,
          padding: 14,
          border: '1px solid #cbd5e1',
          borderRadius: 10,
          background: '#f8fafc',
        }}
      >
        <strong style={{ fontSize: 20 }}>
          🧠 Memoria prezzi ARTECNA
        </strong>

        <div style={{ marginTop: 10, fontSize: 15, color: '#475569' }}>
          La memoria prezzi confronta le lavorazioni del preventivo con i prezzi
          reali già usati da ARTECNA a Catania.
        </div>

        {vociPreventivoAi.length === 0 ? (
          <div style={{ marginTop: 10 }}>
            Nessuna voce disponibile da confrontare.
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {vociPreventivoAi.map((voce, index) => {
              const media = calcolaMediaPrezziSimili(
                voce.descrizione || ''
              )

              const avviso = verificaPrezzoAnomalo(
                voce.descrizione || '',
                Number(voce.prezzo_unitario || 0)
              )

              return (
                <div
                  key={index}
                  style={{
                    marginBottom: 10,
                    padding: 10,
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    background: '#fff',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {voce.descrizione || 'Voce senza descrizione'}
                  </div>

                  <div style={{ marginTop: 6 }}>
                    Prezzo voce:{' '}
                    <strong>
                      {formatMoney(Number(voce.prezzo_unitario || 0))}
                    </strong>
                  </div>

                  <div>
                    Media ARTECNA/Catania:{' '}
                    <strong>
                      {media ? formatMoney(media) : 'Nessun dato sufficiente'}
                    </strong>
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      fontWeight: 700,
                      color: avviso.includes('⚠️')
                        ? '#b45309'
                        : '#166534',
                    }}
                  >
                    {avviso || 'Nessun confronto disponibile'}
                  </div>

                  {media && (
                    <button
                      onClick={() => {
                        const nuove = [...vociPreventivoAi]
                        nuove[index].prezzo_unitario = Number(
                          media.toFixed(2)
                        )
                        setVociPreventivoAi(nuove)
                      }}
                      style={{
                        ...buttonSecondary,
                        marginTop: 8,
                        backgroundColor: '#0f766e',
                        color: '#fff',
                      }}
                    >
                      Usa media memoria prezzi
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <table
        style={{
          ...excelTable,
          width: '100%',
          fontSize: 18,
        }}
      >
        <thead>
          <tr>
            <th style={excelTh}>Descrizione</th>
            <th style={excelTh}>UM</th>
            <th style={excelTh}>Q.tà</th>
            <th style={excelTh}>Prezzo</th>
            <th style={excelTh}>Totale</th>
            <th style={excelTh}>Azioni</th>
          </tr>
        </thead>

        <tbody>
          {vociPreventivoAi.map((voce, index) => {
            const totale =
              Number(voce.quantita || 0) *
              Number(voce.prezzo_unitario || 0)

            return (
              <tr key={index}>
                <td style={excelTd}>
                  <textarea
                    value={voce.descrizione || ''}
                    onChange={(e) => {
                      const nuove = [...vociPreventivoAi]
                      nuove[index].descrizione = e.target.value
                      setVociPreventivoAi(nuove)
                    }}
                    style={{
                      width: '100%',
                      minHeight: 90,
                      fontSize: 17,
                      padding: 10,
                    }}
                  />
                </td>

                <td style={excelTd}>
                  <input
                    value={voce.unita_misura || ''}
                    onChange={(e) => {
                      const nuove = [...vociPreventivoAi]
                      nuove[index].unita_misura = e.target.value
                      setVociPreventivoAi(nuove)
                    }}
                    style={{ width: 80 }}
                  />
                </td>

                <td style={excelTd}>
                  <input
                    type="number"
                    value={voce.quantita || 0}
                    onChange={(e) => {
                      const nuove = [...vociPreventivoAi]
                      nuove[index].quantita = Number(e.target.value)
                      setVociPreventivoAi(nuove)
                    }}
                    style={{ width: 80 }}
                  />
                </td>

                <td style={excelTd}>
                  <input
                    type="number"
                    value={voce.prezzo_unitario || 0}
                    onChange={(e) => {
                      const nuove = [...vociPreventivoAi]
                      nuove[index].prezzo_unitario = Number(e.target.value)
                      setVociPreventivoAi(nuove)
                    }}
                    style={{ width: 100 }}
                  />
                </td>

                <td style={excelTd}>{formatMoney(totale)}</td>

                <td style={excelTd}>
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                    }}
                  >
                    <button
                      onClick={() => miglioraVocePreventivoAi(index)}
                      style={{
                        background: '#f59e0b',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      ✨
                    </button>

                    <button
                      onClick={() =>
                        setVociPreventivoAi(
                          vociPreventivoAi.filter((_, i) => i !== index)
                        )
                      }
                      style={{
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          background: '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        <span>Sub totale preventivo</span>
        <span>{formatMoney(subTotale)}</span>
      </div>

      <div style={{ marginTop: 15, display: 'flex', gap: 10 }}>
        <button
          onClick={() =>
            setVociPreventivoAi([
              ...vociPreventivoAi,
              {
                descrizione: '',
                unita_misura: 'a corpo',
                quantita: 1,
                prezzo_unitario: 0,
              },
            ])
          }
          style={buttonSecondary}
        >
          ➕ Aggiungi voce
        </button>

        <button
          onClick={() => {
            setVociPreventivoAi(
              JSON.parse(JSON.stringify(vociPreventivoAiOriginali))
            )

            alert('Versione originale ripristinata')
          }}
          style={{
            ...buttonSecondary,
            backgroundColor: '#64748b',
            color: '#fff',
          }}
        >
          ↩ Ripristina originale
        </button>

        <button
          onClick={async () => {
            for (const voce of vociPreventivoAi) {
              await salvaInMemoriaPrezzi({
                descrizione: voce.descrizione || '',
                categoria: 'preventivo AI',
                unita_misura: voce.unita_misura || '',
                quantita: Number(voce.quantita || 0),
                prezzo_unitario: Number(voce.prezzo_unitario || 0),
                prezzo_totale:
                  Number(voce.quantita || 0) *
                  Number(voce.prezzo_unitario || 0),
                cantiere: preventivoRegistroCantiere || '',
                fonte: 'preventivo AI approvato',
                provincia: 'Catania',
              })
            }

            await generaExcelDefinitivoPreventivoAi()
          }}
          style={{
            ...buttonPrimary,
            backgroundColor: '#2563eb',
          }}
        >
          📄 Genera Excel definitivo
        </button>

        <button
          onClick={() => setMostraRevisionePreventivoAi(false)}
          style={buttonSecondary}
        >
          Chiudi revisione
        </button>
      </div>
    </div>
  )
}