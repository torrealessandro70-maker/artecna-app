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
  caricaFileAnalisiDocumento,
  fileAnalisiDocumento,
  nomeFileAnalisiDocumento,
  testoEstrattoDocumento,
  importoRilevatoDocumento,
  vociAnalizzate,
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
      <CantieriAnalisiDocumentoPanel
  cardStyle={cardStyle}
  cantieri={cantieri}
  cantiereAnalisiDocumento={cantiereScheda || ''}
  setCantiereAnalisiDocumento={setCantiereScheda}
  inputStyle={inputStyle}
  buttonSecondary={buttonSecondary}
  buttonPrimary={buttonPrimary}
  caricaFileAnalisiDocumento={caricaFileAnalisiDocumento}
  fileAnalisiDocumento={fileAnalisiDocumento}
  nomeFileAnalisiDocumento={nomeFileAnalisiDocumento}
  testoEstrattoDocumento={testoEstrattoDocumento}
  importoRilevatoDocumento={importoRilevatoDocumento}
  vociAnalizzate={vociAnalizzate}

  {...rest}
/>
      <CantieriEconomiaPanel {...props} />
    </>
  )
}