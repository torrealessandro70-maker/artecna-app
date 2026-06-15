'use client'

import type { CSSProperties } from 'react'
import PopupModificaTimbratura from './PopupModificaTimbratura'

type Props = {
  cardStyle: CSSProperties

  timbraturaInModifica: string | null
  dataTimbraturaModifica: string
  setDataTimbraturaModifica: (v: string) => void
  oraEntrataModifica: string
  setOraEntrataModifica: (v: string) => void
  oraUscitaModifica: string
  setOraUscitaModifica: (v: string) => void
  setTimbraturaInModifica: (v: string | null) => void
  setStatoTimbraturaModifica: (v: string) => void
  parseOra: (ora?: string) => number | null
  salvaModificaTimbratura: () => void | Promise<void>

  operaioTimbratura: string
  setOperaioTimbratura: (v: string) => void
  cantiereTimbratura: string
  setCantiereTimbratura: (v: string) => void
  pinTimbratura: string
  setPinTimbratura: (v: string) => void

  operaiAttivi: any[]
  cantieri: any[]
  timbratureOggi: any[]

  timbraEntrataConPin: () => void | Promise<void>
  timbraUscitaConPin: () => void | Promise<void>
  eliminaTimbratura: (id?: string) => void | Promise<void>

  calcolaCostoTimbratura: (t: any) => number
  formatMoney: (value: number) => string

  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function OperaiTimbraturePanel(p: Props) {
  return (
    <div style={p.cardStyle}>
      <h2>Timbrature operai</h2>

      {p.timbraturaInModifica && (
        <PopupModificaTimbratura
          titolo="Modifica timbratura"
          dataTimbraturaModifica={p.dataTimbraturaModifica}
          setDataTimbraturaModifica={p.setDataTimbraturaModifica}
          oraEntrataModifica={p.oraEntrataModifica}
          setOraEntrataModifica={p.setOraEntrataModifica}
          oraUscitaModifica={p.oraUscitaModifica}
          setOraUscitaModifica={p.setOraUscitaModifica}
          parseOra={p.parseOra}
          onChiudi={() => p.setTimbraturaInModifica(null)}
          onSalva={p.salvaModificaTimbratura}
          buttonSecondary={p.buttonSecondary}
          buttonPrimary={p.buttonPrimary}
        />
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 15 }}>
        <select
          value={p.operaioTimbratura || ''}
          onChange={(e) => p.setOperaioTimbratura(e.target.value)}
          style={{ padding: 8, width: 220 }}
        >
          <option value="">Seleziona operaio</option>
          {p.operaiAttivi.map((o, i) => (
            <option key={o.id || i} value={o.nome}>
              {o.nome}
            </option>
          ))}
        </select>

        <select
          value={p.cantiereTimbratura || ''}
          onChange={(e) => p.setCantiereTimbratura(e.target.value)}
          style={{ padding: 8, width: 240 }}
        >
          <option value="">Seleziona cantiere</option>
          {p.cantieri.map((c, i) => (
            <option key={c.id || i} value={c.nome}>
              {c.nome}
            </option>
          ))}
        </select>

        <input
          placeholder="PIN"
          value={p.pinTimbratura || ''}
          onChange={(e) => p.setPinTimbratura(e.target.value)}
          style={{ padding: 8, width: 140 }}
        />

        <button onClick={p.timbraEntrataConPin} style={p.buttonPrimary}>
          Entrata
        </button>

        <button onClick={p.timbraUscitaConPin} style={p.buttonSecondary}>
          Uscita
        </button>
      </div>

      <h3>Timbrature di oggi</h3>

      {p.timbratureOggi.length === 0 ? (
        <p>Nessuna timbratura presente oggi</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {p.timbratureOggi.map((t, i) => (
            <div
              key={t.id || i}
              style={{
                padding: 12,
                border: '1px solid #ddd',
                borderRadius: 8,
                background: '#fff',
              }}
            >
              <strong>{t.operaio_nome}</strong> — {t.cantiere}
              <br />
              Entrata: {t.ora_entrata || '-'} | Uscita: {t.ora_uscita || '-'}
              <br />
              Stato: {t.stato || '-'}
              <br />
              Costo: {p.formatMoney(p.calcolaCostoTimbratura(t))}

              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    p.setTimbraturaInModifica(t.id || null)
                    p.setDataTimbraturaModifica(t.data || '')
                    p.setOraEntrataModifica(t.ora_entrata || '')
                    p.setOraUscitaModifica(t.ora_uscita || '')
                    p.setStatoTimbraturaModifica(t.stato || 'aperto')
                  }}
                  style={p.buttonSecondary}
                >
                  Modifica
                </button>

                <button
                  onClick={() => p.eliminaTimbratura(t.id)}
                  style={{
                    ...p.buttonSecondary,
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
    </div>
  )
}