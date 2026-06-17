'use client'

import CantieriSchedaPanel from './CantieriSchedaPanel'
import CantieriAnalisiDocumentoPanel from './CantieriAnalisiDocumentoPanel'
import CantieriEconomiaPanel from './CantieriEconomiaPanel'

interface CantieriContainerProps {
  [key: string]: any
}

export default function CantieriContainer(props: CantieriContainerProps) {
const {
  cardStyle,
  cantieri,
  cantiereScheda,
  setCantiereScheda,
  ricercaCantiereEconomia,
  setRicercaCantiereEconomia,
  mostraConclusiEconomia,
  setMostraConclusiEconomia,
  calcoloEconomiaCantiere,
  formatMoney,
  inputStyle,
  buttonPrimary,
  buttonSecondary,
  ...rest
} = props
  return (
    <>
      <CantieriSchedaPanel
  cardStyle={cardStyle}
  cantieri={cantieri}
  cantiereScheda={cantiereScheda}
  setCantiereScheda={setCantiereScheda}
  ricercaCantiereEconomia={ricercaCantiereEconomia}
  setRicercaCantiereEconomia={setRicercaCantiereEconomia}
  mostraConclusiEconomia={mostraConclusiEconomia}
  setMostraConclusiEconomia={setMostraConclusiEconomia}
  calcoloEconomiaCantiere={calcoloEconomiaCantiere}
  formatMoney={formatMoney}
  inputStyle={inputStyle}
  buttonPrimary={buttonPrimary}
  buttonSecondary={buttonSecondary}

  {...rest}
/>
      <CantieriAnalisiDocumentoPanel {...props} />
      <CantieriEconomiaPanel {...props} />
    </>
  )
}