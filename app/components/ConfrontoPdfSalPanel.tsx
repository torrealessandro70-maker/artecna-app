'use client'

import type { CSSProperties } from 'react'

type Props = {
  mostraConfrontoPdfSal: boolean
  setMostraConfrontoPdfSal: (v: boolean) => void
  salCantiere: string
  preventivi: any[]
  preventivoLavorazioni: any[]
  supabase: any
  formatMoney: (v: number) => string
  parseImporto: (v: any) => number
  analizzaRigheDocumento: (testo: string) => any[]
  caricaPreventivoLavorazioni: () => Promise<void>
  lavorazioneEditId: number | null
  setLavorazioneEditId: (v: number | null) => void
  lavorazioneEditDescrizione: string
  setLavorazioneEditDescrizione: (v: string) => void
  lavorazioneEditImporto: string
  setLavorazioneEditImporto: (v: string) => void
  buttonSecondary: CSSProperties
}

export default function ConfrontoPdfSalPanel({
  mostraConfrontoPdfSal,
  setMostraConfrontoPdfSal,
  salCantiere,
  preventivi,
  preventivoLavorazioni,
  supabase,
  formatMoney,
  parseImporto,
  analizzaRigheDocumento,
  caricaPreventivoLavorazioni,
  lavorazioneEditId,
  setLavorazioneEditId,
  lavorazioneEditDescrizione,
  setLavorazioneEditDescrizione,
  lavorazioneEditImporto,
  setLavorazioneEditImporto,
  buttonSecondary,
}: Props) {
  return (
    <>
      <button
        onClick={() => setMostraConfrontoPdfSal(!mostraConfrontoPdfSal)}
        style={{ ...buttonSecondary, marginTop: 14 }}
      >
        {mostraConfrontoPdfSal
          ? 'Nascondi confronto PDF ↔ lavorazioni'
          : 'Mostra confronto PDF ↔ lavorazioni'}
      </button>

      {mostraConfrontoPdfSal && (
        <div style={{ marginTop: 16 }}>
          <strong>🔍 Confronto PDF ↔ Lavorazioni SAL</strong>

          {(() => {
            const preventivoPdf = preventivi.find(
              (p) => p.cantiere === salCantiere
            )

            const righePdf = analizzaRigheDocumento(
              preventivoPdf?.anteprima_testo || ''
            )

            const righeSal = preventivoLavorazioni.filter(
              (p) => p.cantiere === salCantiere
            )

            if (!preventivoPdf) {
              return (
                <div style={{ marginTop: 8, color: '#64748b' }}>
                  Nessun PDF/preventivo caricato da confrontare.
                </div>
              )
            }

            return (
              <div
                style={{
                  marginTop: 10,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  alignItems: 'start',
                }}
              >
                <div
                  style={{
                    position: 'sticky',
                    top: 10,
                    alignSelf: 'start',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    paddingRight: 6,
                  }}
                >
                  <strong>Righe riconosciute dal PDF</strong>

                  {righePdf.map((r, i) => {
                    const abbinata = righeSal.some(
                      (s) =>
                        Math.abs(
                          Number(s.importo_previsto || 0) - r.totale
                        ) < 1
                    )

                    const giaImportata = righeSal.some(
                      (s) =>
                        String(s.descrizione || '').trim().toLowerCase() ===
                        String(r.descrizione || '').trim().toLowerCase()
                    )

                    return (
                      <div
                        key={i}
                        style={{
                          marginTop: 8,
                          padding: 8,
                          border: '1px solid #ddd',
                          borderRadius: 8,
                          background: abbinata ? '#f0fdf4' : '#fef2f2',
                        }}
                      >
                        <strong>
                          {abbinata ? '✅' : '❌'} {r.descrizione}
                        </strong>

                        <br />

                        Qtà: {r.quantita} | UM: {r.unita_misura} | Totale: €
                        {formatMoney(r.totale)}

                        <div style={{ marginTop: 8 }}>
                          <button
                            disabled={giaImportata}
                            onClick={async () => {
                              if (!salCantiere) {
                                alert('Seleziona un cantiere')
                                return
                              }

                              const { error } = await supabase
                                .from('preventivo_lavorazioni')
                                .insert([
                                  {
                                    cantiere: salCantiere,
                                    descrizione: r.descrizione,
                                    quantita: r.quantita,
                                    prezzo_unitario: r.prezzo_unitario,
                                    importo_previsto: r.totale,
                                    unita_misura: r.unita_misura,
                                  },
                                ])

                              if (error) {
                                alert(
                                  'Errore importazione riga PDF: ' +
                                    error.message
                                )
                                return
                              }

                              await caricaPreventivoLavorazioni()

                              alert('Riga PDF importata nelle lavorazioni')
                            }}
                            style={{
                              marginTop: 4,
                              background: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '5px 8px',
                              cursor: giaImportata ? 'not-allowed' : 'pointer',
                              opacity: giaImportata ? 0.5 : 1,
                            }}
                          >
                            {giaImportata
                              ? '✅ Riga già importata'
                              : '📥 Usa questa riga PDF'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div
                  style={{
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    paddingRight: 6,
                  }}
                >
                  <strong>Lavorazioni presenti nel SAL/preventivo</strong>

                  {righeSal.map((s, i) => {
                    const descrizioneSal = String(
                      s.descrizione || ''
                    ).toLowerCase()

                    const descrizioneTroppoLunga =
                      String(s.descrizione || '').length > 220

                    const pdfSimile = righePdf.find((r) =>
                      descrizioneSal.includes(
                        String(r.descrizione || '')
                          .toLowerCase()
                          .slice(0, 25)
                      )
                    )

                    const abbinata = righePdf.some(
                      (r) =>
                        Math.abs(
                          Number(s.importo_previsto || 0) - r.totale
                        ) < 1
                    )

                    return (
                      <div
                        key={s.id || i}
                        style={{
                          marginTop: 8,
                          padding: 8,
                          border: '1px solid #ddd',
                          borderRadius: 8,
                          background:
                            !abbinata || descrizioneTroppoLunga
                              ? '#fef2f2'
                              : pdfSimile
                                ? '#eff6ff'
                                : '#f0fdf4',
                        }}
                      >
                        {lavorazioneEditId === s.id ? (
                          <div style={{ display: 'grid', gap: 6 }}>
                            <textarea
                              value={lavorazioneEditDescrizione}
                              onChange={(e) =>
                                setLavorazioneEditDescrizione(e.target.value)
                              }
                              style={{
                                padding: 8,
                                border: '1px solid #ccc',
                                borderRadius: 6,
                                minHeight: 120,
                                width: '100%',
                                resize: 'vertical',
                                lineHeight: 1.5,
                                fontFamily: 'inherit',
                              }}
                            />

                            <input
                              value={lavorazioneEditImporto}
                              onChange={(e) =>
                                setLavorazioneEditImporto(e.target.value)
                              }
                              style={{
                                padding: 6,
                                border: '1px solid #ccc',
                                borderRadius: 6,
                              }}
                            />
                          </div>
                        ) : (
                          <>
                            <strong>
                              {abbinata && !descrizioneTroppoLunga
                                ? '✅'
                                : '⚠️'}{' '}
                              {s.descrizione}
                            </strong>
                            <br />
                            Totale: €{' '}
                            {formatMoney(Number(s.importo_previsto || 0))}
                          </>
                        )}

                        {pdfSimile && (
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 12,
                              color: '#1d4ed8',
                            }}
                          >
                            📄 Riga PDF simile: {pdfSimile.descrizione}
                          </div>
                        )}

                        <div
                          style={{
                            display: 'flex',
                            gap: 6,
                            marginTop: 8,
                            flexWrap: 'wrap',
                          }}
                        >
                          {lavorazioneEditId === s.id ? (
                            <>
                              <button
                                onClick={async () => {
                                  const nuovoImporto =
                                    parseImporto(lavorazioneEditImporto)

                                  if (!lavorazioneEditDescrizione.trim()) {
                                    alert('Descrizione non valida')
                                    return
                                  }

                                  if (!nuovoImporto || nuovoImporto <= 0) {
                                    alert('Importo non valido')
                                    return
                                  }

                                  const { error } = await supabase
                                    .from('preventivo_lavorazioni')
                                    .update({
                                      descrizione:
                                        lavorazioneEditDescrizione.trim(),
                                      importo_previsto: nuovoImporto,
                                      prezzo_unitario: nuovoImporto,
                                    })
                                    .eq('id', s.id)

                                  if (error) {
                                    alert(
                                      'Errore salvataggio modifica: ' +
                                        error.message
                                    )
                                    return
                                  }

                                  setLavorazioneEditId(null)
                                  setLavorazioneEditDescrizione('')
                                  setLavorazioneEditImporto('')

                                  await caricaPreventivoLavorazioni()

                                  alert('Lavorazione aggiornata')
                                }}
                                style={{
                                  background: '#16a34a',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '5px 8px',
                                  cursor: 'pointer',
                                }}
                              >
                                💾 Salva
                              </button>

                              <button
                                onClick={() => {
                                  setLavorazioneEditId(null)
                                  setLavorazioneEditDescrizione('')
                                  setLavorazioneEditImporto('')
                                }}
                                style={{
                                  background: '#64748b',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '5px 8px',
                                  cursor: 'pointer',
                                }}
                              >
                                Annulla
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                setLavorazioneEditId(s.id)
                                setLavorazioneEditDescrizione(
                                  s.descrizione || ''
                                )
                                setLavorazioneEditImporto(
                                  String(s.importo_previsto || '')
                                )
                              }}
                              style={{
                                background: '#2563eb',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                padding: '5px 8px',
                                cursor: 'pointer',
                              }}
                            >
                              ✏️ Modifica
                            </button>
                          )}

                          <button
                            onClick={async () => {
                              const conferma = confirm(
                                'Eliminare questa lavorazione preventivo?'
                              )

                              if (!conferma) return

                              const { error } = await supabase
                                .from('preventivo_lavorazioni')
                                .delete()
                                .eq('id', s.id)

                              if (error) {
                                alert('Errore eliminazione: ' + error.message)
                                return
                              }

                              await caricaPreventivoLavorazioni()

                              alert('Lavorazione eliminata')
                            }}
                            style={{
                              background: '#dc2626',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '5px 8px',
                              cursor: 'pointer',
                            }}
                          >
                            🗑 Elimina
                          </button>

                          <button
                            onClick={async () => {
                              const { error } = await supabase
                                .from('preventivo_lavorazioni')
                                .insert([
                                  {
                                    cantiere: s.cantiere,
                                    descrizione: s.descrizione,
                                    quantita: s.quantita,
                                    prezzo_unitario: s.prezzo_unitario,
                                    importo_previsto: s.importo_previsto,
                                    unita_misura: s.unita_misura,
                                  },
                                ])

                              if (error) {
                                alert('Errore duplicazione: ' + error.message)
                                return
                              }

                              await caricaPreventivoLavorazioni()

                              alert('Lavorazione duplicata')
                            }}
                            style={{
                              background: '#16a34a',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '5px 8px',
                              cursor: 'pointer',
                            }}
                          >
                            ➕ Duplica
                          </button>
                        </div>

                        {descrizioneTroppoLunga && (
                          <div style={{ color: '#b91c1c', marginTop: 4 }}>
                            Descrizione troppo lunga: possibile riga accorpata.
                          </div>
                        )}

                        {!abbinata && (
                          <div style={{ color: '#b91c1c', marginTop: 4 }}>
                            Non trovata corrispondenza nel PDF.
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </>
  )
}