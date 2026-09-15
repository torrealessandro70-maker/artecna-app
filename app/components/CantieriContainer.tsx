'use client'

import type { FascicoloPanelProps } from './FascicoloCantierePanel'
import CantieriSchedaPanel from './CantieriSchedaPanel'
import type { DocumentiPanelProps } from './DocumentiCantierePanel'
import type { EconomiaPanelProps } from './EconomiaCantierePanel'
import CantieriEconomiaPanel from './CantieriEconomiaPanel'

interface CantieriContainerProps {
  fascicoloPanelProps: FascicoloPanelProps
  economiaPanelProps: EconomiaPanelProps
  documentiPanelProps: DocumentiPanelProps
  [key: string]: any
}

export default function CantieriContainer(props: CantieriContainerProps) {
const {
  fascicoloPanelProps,
  economiaPanelProps,
  documentiPanelProps,
  cardStyle,
  cantieri,
  cantiereScheda,
  setCantiereScheda,
  setCantiereIdScheda,
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
  fascicoloPanelProps={fascicoloPanelProps}
  economiaPanelProps={economiaPanelProps}
  documentiPanelProps={documentiPanelProps}
  cardStyle={cardStyle}
  cantieri={cantieri}
  cantiereScheda={cantiereScheda}
  setCantiereScheda={setCantiereScheda}
  setCantiereIdScheda={setCantiereIdScheda}
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
      <details style={{ marginTop: 16, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', padding: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#475569', minHeight: 44 }}>
          Altri strumenti del cantiere
        </summary>
      <CantieriEconomiaPanel {...props} />
      </details>
    </>
  )
}