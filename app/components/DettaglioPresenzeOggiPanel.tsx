'use client'

import type { CSSProperties } from 'react'

type Props = {
  timbratureOggi: any[]
  formatMoney: (v: number) => string
  calcolaCostoTimbratura: (t: any) => number
  erroreTimbratura: (t: any) => string | null | undefined
  setTimbraturaInModifica: (v: any) => void
  setDataTimbraturaModifica: (v: string) => void
  setOraEntrataModifica: (v: string) => void
  setOraUscitaModifica: (v: string) => void
  setStatoTimbraturaModifica: (v: string) => void
  eliminaTimbratura: (id: any) => void | Promise<void>
  buttonSecondary: CSSProperties
}

export default function DettaglioPresenzeOggiPanel({
  timbratureOggi,
  formatMoney,
  calcolaCostoTimbratura,
  erroreTimbratura,
  setTimbraturaInModifica,
  setDataTimbraturaModifica,
  setOraEntrataModifica,
  setOraUscitaModifica,
  setStatoTimbraturaModifica,
  eliminaTimbratura,
  buttonSecondary,
}: Props) {
  return (
    <>
      <h3>Dettaglio presenze oggi</h3>

      {timbratureOggi.length === 0 ? (
        <p>Nessuna presenza registrata oggi.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {timbratureOggi.map((t, i) => (
            <div
              key={t.id || i}
              style={{
                padding: 12,
                border: '1px solid #ddd',
                borderRadius: 8,
                background: '#fff',
              }}
            >
              <strong>{t.operaio_nome}</strong>
              <br />
              Cantiere: {t.cantiere || '-'}
              <br />
              Entrata: {t.ora_entrata || '-'} | Uscita:{' '}
              {t.ora_uscita || '-'}
              <br />
              Stato: {t.stato || '-'}
              <br />
              <strong>Costo:</strong> {formatMoney(calcolaCostoTimbratura(t))}

              {erroreTimbratura(t) && (
                <div
                  style={{
                    marginTop: 8,
                    padding: 8,
                    borderRadius: 8,
                    background: '#fee2e2',
                    color: '#991b1b',
                    fontWeight: 700,
                  }}
                >
                  {erroreTimbratura(t)}
                </div>
              )}

              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => {
                    setTimbraturaInModifica(t.id || null)
                    setDataTimbraturaModifica(t.data || '')
                    setOraEntrataModifica(t.ora_entrata || '')
                    setOraUscitaModifica(t.ora_uscita || '')
                    setStatoTimbraturaModifica(t.stato || 'aperto')
                  }}
                  style={buttonSecondary}
                >
                  ✏️ Modifica
                </button>

                <button
                  onClick={() => eliminaTimbratura(t.id)}
                  style={{
                    ...buttonSecondary,
                    marginLeft: 8,
                    backgroundColor: '#d9534f',
                    color: 'white',
                  }}
                >
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}