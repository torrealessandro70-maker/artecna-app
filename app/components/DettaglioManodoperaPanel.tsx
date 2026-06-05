'use client'

import type { CSSProperties } from 'react'

type Props = {
  mostraDettaglioManodopera: boolean
  setMostraDettaglioManodopera: (v: boolean) => void
  timbrature: any[]
  cantiereScheda: string
  totaleManodoperaCantiere: number
  economiaDataDa: string
  economiaDataA: string
  ordineOperai: 'data' | 'operaio' | 'entrata' | 'uscita' | 'ore' | 'costo'
  setOrdineOperai: (v: 'data' | 'operaio' | 'entrata' | 'uscita' | 'ore' | 'costo') => void
  direzioneOperai: 'asc' | 'desc'
  setDirezioneOperai: (v: 'asc' | 'desc') => void
  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
  buttonSecondary: CSSProperties
  formatMoney: (v: number) => string
  calcolaOre: (t: any) => number
  calcolaOreNumero: (entrata?: string, uscita?: string) => number
  calcolaCostoTimbratura: (t: any) => number
}

export default function DettaglioManodoperaPanel({
  mostraDettaglioManodopera,
  setMostraDettaglioManodopera,
  timbrature,
  cantiereScheda,
  totaleManodoperaCantiere,
  economiaDataDa,
  economiaDataA,
  ordineOperai,
  setOrdineOperai,
  direzioneOperai,
  setDirezioneOperai,
  excelTable,
  excelTh,
  excelTd,
  buttonSecondary,
  formatMoney,
  calcolaOre,
  calcolaOreNumero,
  calcolaCostoTimbratura,
}: Props) {
  return (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <strong>Manodopera:</strong> {formatMoney(totaleManodoperaCantiere)}

      <button
        onClick={() => setMostraDettaglioManodopera(!mostraDettaglioManodopera)}
        style={{ ...buttonSecondary, marginLeft: 10 }}
      >
        {mostraDettaglioManodopera ? 'Nascondi operai' : 'Vedi operai'}
      </button>

      {mostraDettaglioManodopera && (
        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          {timbrature.filter((t) => t.cantiere === cantiereScheda).length === 0 ? (
            <p>Nessuna presenza registrata per questo cantiere.</p>
          ) : (
            <table style={excelTable}>
              <thead>
                <tr>
                  <th
                    style={{ ...excelTh, cursor: 'pointer' }}
                    onClick={() => {
                      setOrdineOperai('data')
                      setDirezioneOperai(
                        ordineOperai === 'data' && direzioneOperai === 'asc'
                          ? 'desc'
                          : 'asc'
                      )
                    }}
                  >
                    Data {ordineOperai === 'data' ? (direzioneOperai === 'asc' ? '▲' : '▼') : ''}
                  </th>

                  <th
                    style={{ ...excelTh, cursor: 'pointer' }}
                    onClick={() => {
                      setOrdineOperai('operaio')
                      setDirezioneOperai(
                        ordineOperai === 'operaio' && direzioneOperai === 'asc'
                          ? 'desc'
                          : 'asc'
                      )
                    }}
                  >
                    Operaio {ordineOperai === 'operaio' ? (direzioneOperai === 'asc' ? '▲' : '▼') : ''}
                  </th>

                  <th
                    style={{ ...excelTh, cursor: 'pointer' }}
                    onClick={() => {
                      setOrdineOperai('entrata')
                      setDirezioneOperai(
                        ordineOperai === 'entrata' && direzioneOperai === 'asc'
                          ? 'desc'
                          : 'asc'
                      )
                    }}
                  >
                    Entrata {ordineOperai === 'entrata' ? (direzioneOperai === 'asc' ? '▲' : '▼') : ''}
                  </th>

                  <th
                    style={{ ...excelTh, cursor: 'pointer' }}
                    onClick={() => {
                      setOrdineOperai('uscita')
                      setDirezioneOperai(
                        ordineOperai === 'uscita' && direzioneOperai === 'asc'
                          ? 'desc'
                          : 'asc'
                      )
                    }}
                  >
                    Uscita {ordineOperai === 'uscita' ? (direzioneOperai === 'asc' ? '▲' : '▼') : ''}
                  </th>

                  <th
                    style={{ ...excelTh, cursor: 'pointer' }}
                    onClick={() => {
                      setOrdineOperai('ore')
                      setDirezioneOperai(
                        ordineOperai === 'ore' && direzioneOperai === 'asc'
                          ? 'desc'
                          : 'asc'
                      )
                    }}
                  >
                    Ore {ordineOperai === 'ore' ? (direzioneOperai === 'asc' ? '▲' : '▼') : ''}
                  </th>

                  <th
                    style={{ ...excelTh, cursor: 'pointer' }}
                    onClick={() => {
                      setOrdineOperai('costo')
                      setDirezioneOperai(
                        ordineOperai === 'costo' && direzioneOperai === 'asc'
                          ? 'desc'
                          : 'asc'
                      )
                    }}
                  >
                    Costo {ordineOperai === 'costo' ? (direzioneOperai === 'asc' ? '▲' : '▼') : ''}
                  </th>
                </tr>
              </thead>

              <tbody>
                {timbrature
                  .filter((t) => {
                    if (t.cantiere !== cantiereScheda) return false
                    if (economiaDataDa && String(t.data || '') < economiaDataDa) return false
                    if (economiaDataA && String(t.data || '') > economiaDataA) return false
                    return true
                  })
                  .sort((a, b) => {
                    let valoreA: any
                    let valoreB: any

                    switch (ordineOperai) {
                      case 'data':
                        valoreA = a.data || ''
                        valoreB = b.data || ''
                        break
                      case 'operaio':
                        valoreA = a.operaio_nome || ''
                        valoreB = b.operaio_nome || ''
                        break
                      case 'entrata':
                        valoreA = a.ora_entrata || ''
                        valoreB = b.ora_entrata || ''
                        break
                      case 'uscita':
                        valoreA = a.ora_uscita || ''
                        valoreB = b.ora_uscita || ''
                        break
                      case 'ore':
                        valoreA = calcolaOreNumero(a.ora_entrata, a.ora_uscita)
                        valoreB = calcolaOreNumero(b.ora_entrata, b.ora_uscita)
                        break
                      case 'costo':
                        valoreA = calcolaCostoTimbratura(a)
                        valoreB = calcolaCostoTimbratura(b)
                        break
                      default:
                        valoreA = a.operaio_nome || ''
                        valoreB = b.operaio_nome || ''
                    }

                    if (valoreA < valoreB) return direzioneOperai === 'asc' ? -1 : 1
                    if (valoreA > valoreB) return direzioneOperai === 'asc' ? 1 : -1
                    return 0
                  })
                  .map((t, i) => (
                    <tr key={t.id || i}>
                      <td style={excelTd}>{t.data || '-'}</td>
                      <td style={excelTd}>{t.operaio_nome || '-'}</td>
                      <td style={excelTd}>{t.ora_entrata || '-'}</td>
                      <td style={excelTd}>{t.ora_uscita || '-'}</td>
                      <td style={excelTd}>{calcolaOre(t).toFixed(2)}</td>
                      <td style={excelTd}>
                        <strong>{formatMoney(calcolaCostoTimbratura(t))}</strong>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}