'use client'

import type { CSSProperties } from 'react'
import OperaiList from './OperaiList'
type Props = {
  timbrature: any[]
  operaiAnagrafica: any[]
  dataDa: string
  dataA: string
  cantiereGrafico: string
  totaleCostoPeriodo: number
  totaleOrePeriodo: number
  calcolaOre: (t: any) => number
  calcolaCostoTimbratura: (t: any) => number
  formatMoney: (v: number) => string
  badgeStyle: (stato?: string) => CSSProperties
  preparaModificaOperaio: (o: any) => void
  cambiaStatoOperaio: (id: any, stato: any) => void | Promise<void>
  eliminaOperaio: (id: any) => void | Promise<void>
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function PresenzePeriodoSummaryPanel({
  timbrature,
  operaiAnagrafica,
  dataDa,
  dataA,
  cantiereGrafico,
  totaleCostoPeriodo,
  totaleOrePeriodo,
  calcolaOre,
  calcolaCostoTimbratura,
  formatMoney,
  badgeStyle,
  preparaModificaOperaio,
  cambiaStatoOperaio,
  eliminaOperaio,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const presenzeFiltrate = timbrature.filter((t) => {
    if (dataDa && String(t.data || '') < dataDa) return false
    if (dataA && String(t.data || '') > dataA) return false
    if (cantiereGrafico && t.cantiere !== cantiereGrafico) return false
    return true
  })

  const operaiFiltrati = operaiAnagrafica
    .map((o) => {
      const presenzeOperaio = presenzeFiltrate.filter(
        (t) => t.operaio_nome === o.nome
      )

      const ore = presenzeOperaio.reduce(
        (tot, t) => tot + calcolaOre(t),
        0
      )

      const costo = presenzeOperaio.reduce(
        (tot, t) => tot + calcolaCostoTimbratura(t),
        0
      )

      return {
        nome: o.nome,
        ore,
        costo,
        presenze: presenzeOperaio.length,
      }
    })
    .filter((o) => o.presenze > 0)

  return (
    <div
      style={{
        display: 'grid',
        gap: 12,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          padding: 12,
          border: '1px solid #ddd',
          borderRadius: 8,
          background: '#fff',
        }}
      >
        <strong>Periodo selezionato</strong>
        <br />
        Dal: {dataDa || 'inizio'} — Al: {dataA || 'oggi'}
        <br />
        Cantiere: {cantiereGrafico || 'Tutti'}
        <br />
        <strong>Totale periodo:</strong> {formatMoney(totaleCostoPeriodo)}
        <br />
        <strong>Ore totali:</strong> {totaleOrePeriodo.toFixed(2)}
        <br />
        <strong>Presenze filtrate:</strong> {presenzeFiltrate.length}
      </div>

      <div
        style={{
          padding: 12,
          border: '1px solid #cbd5e1',
          borderRadius: 10,
          background: '#ffffff',
        }}
      >
        <strong>👷 Operai inclusi nel filtro</strong>

        <OperaiList
          operaiFiltrati={operaiFiltrati}
          badgeStyle={badgeStyle}
          formatMoney={formatMoney}
          preparaModificaOperaio={preparaModificaOperaio}
          cambiaStatoOperaio={cambiaStatoOperaio}
          eliminaOperaio={eliminaOperaio}
          buttonPrimary={buttonPrimary}
          buttonSecondary={buttonSecondary}
        />
      </div>
    </div>
  )
}