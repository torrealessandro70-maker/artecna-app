'use client'

import type { CSSProperties } from 'react'

type Props = {
  cardStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties

  formatMoney: (v: number) => string
  calcolaOreNumero: (entrata: string, uscita: string) => number
  totaleOreOperaio: (nome: string) => number
  calcolaCostoTimbratura: (t: any) => number
  parseOra: (ora: string) => number | null

  totaleMaturatoOperai: number
  totalePagatoOperai: number
  residuoPagamentiOperai: number
  scadenzaPagamentiOperai: string
  statoScadenzaPagamenti: string
 giorniAllaScadenzaPagamenti: number | null

  costoOperaiPerCantiere: Record<string, number>
  situazioneCantieri: any[]
  cantieri: any[]
  timbrature: any[]
  operaiAnagrafica: any[]
  pagamentiOperai: any[]

  mostraValutazioneFondi: boolean
  setMostraValutazioneFondi: (v: boolean) => void
  mostraCostiPresenze: boolean
  setMostraCostiPresenze: (v: boolean) => void
  mostraRiepilogoOperai: boolean
  setMostraRiepilogoOperai: (v: boolean) => void

  pagamentiDataDa: string
  setPagamentiDataDa: (v: string) => void
  pagamentiDataA: string
  setPagamentiDataA: (v: string) => void

  operaioPagamento: string
  setOperaioPagamento: (v: string) => void
  importoPagamento: string
  setImportoPagamento: (v: string) => void
  dataPagamento: string
  setDataPagamento: (v: string) => void
  metodoPagamento: string
  setMetodoPagamento: (v: string) => void
  notaPagamento: string
  setNotaPagamento: (v: string) => void

  salvaPagamentoOperaio: () => void | Promise<void>
  preparaPagamentoRapidoOperaio: (
    nome: string,
    importo: number,
    tipo: 'saldo' | 'acconto'
  ) => void
}

export default function PagamentiOperaiPanel({
  cardStyle,
  buttonPrimary,
  buttonSecondary,
  excelTable,
  excelTh,
  excelTd,

  formatMoney,
  calcolaOreNumero,
  totaleOreOperaio,
  calcolaCostoTimbratura,
  parseOra,

  totaleMaturatoOperai,
  totalePagatoOperai,
  residuoPagamentiOperai,
  scadenzaPagamentiOperai,
  statoScadenzaPagamenti,
  giorniAllaScadenzaPagamenti,

  costoOperaiPerCantiere,
  situazioneCantieri,
  cantieri,
  timbrature,
  operaiAnagrafica,
  pagamentiOperai,

  mostraValutazioneFondi,
  setMostraValutazioneFondi,
  mostraCostiPresenze,
  setMostraCostiPresenze,
  mostraRiepilogoOperai,
  setMostraRiepilogoOperai,

  pagamentiDataDa,
  setPagamentiDataDa,
  pagamentiDataA,
  setPagamentiDataA,

  operaioPagamento,
  setOperaioPagamento,
  importoPagamento,
  setImportoPagamento,
  dataPagamento,
  setDataPagamento,
  metodoPagamento,
  setMetodoPagamento,
  notaPagamento,
  setNotaPagamento,

  salvaPagamentoOperaio,
  preparaPagamentoRapidoOperaio,
}: Props) {
  return (
    <div style={cardStyle}>
      <h2>Pagamenti operai</h2>

      {/* qui incolliamo dentro TUTTO il JSX interno che mi hai mandato,
          togliendo solo il wrapper condizionale iniziale */}
    </div>
  )
}