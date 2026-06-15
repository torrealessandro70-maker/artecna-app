'use client'

import UtileNettoImpresaPanel from './UtileNettoImpresaPanel'

type Props = {
  accontiCantiere: any[]
  cantieri: any[]
  speseImpresa: any[]
  calcoloEconomiaCantiere: (nomeCantiere: string) => any
  formatMoney: (value: number) => string
}

export default function UtileNettoImpresaContainer({
  accontiCantiere,
  cantieri,
  speseImpresa,
  calcoloEconomiaCantiere,
  formatMoney,
}: Props) {
  const totaleIncassato = accontiCantiere.reduce(
    (tot, a) => tot + Number(a.importo || 0),
    0
  )

  const totaleCostiCantieri = cantieri.reduce(
    (tot, c) =>
      tot +
      Number(calcoloEconomiaCantiere(String(c.nome || '')).costoTotale || 0),
    0
  )

  const totaleCostiGenerali = speseImpresa.reduce(
    (tot, s) => tot + Number(s.importo || 0),
    0
  )

  const utileNettoImpresa =
    totaleIncassato - totaleCostiCantieri - totaleCostiGenerali

  return (
    <UtileNettoImpresaPanel
      totaleIncassato={totaleIncassato}
      totaleCostiCantieri={totaleCostiCantieri}
      totaleCostiGenerali={totaleCostiGenerali}
      utileNettoImpresa={utileNettoImpresa}
      formatMoney={formatMoney}
    />
  )
}