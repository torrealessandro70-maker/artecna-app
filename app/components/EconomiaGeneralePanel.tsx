'use client'

import { useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'

import CostiFornitoriRettificati from './CostiFornitoriRettificati'
import RiepilogoDittaPanel, { type DestinazioneEconomia } from './RiepilogoDittaPanel'
import CostiGeneraliImpresaSummary, { type SpesaImpresa } from './CostiGeneraliImpresaSummary'
import VistaOperativa from './VistaOperativa'
import type { ClientAttribuzioni } from '../engines/contabilita-ditta/attribuzioni'
import type { ClientLettura } from '../engines/contabilita-ditta/lettura'
import EconomiaSpeseImpresaPanel from './EconomiaSpeseImpresaPanel'
import ScadenziarioPersistentePanel from './ScadenziarioPersistentePanel'
import type { ClientDocumentiFiscali } from '../engines/contabilita-ditta/documentiFiscali'

type Props = {
  scadenzaDaNotifica?: string
  onChiudiScadenzaDaNotifica?: () => void
  onDestinazioneNotificaAssente?: () => void
  badgeScadenziario?: number
  onApri?: (destinazione: DestinazioneEconomia) => void
  client: ClientLettura & ClientAttribuzioni & Partial<Pick<ClientDocumentiFiscali, 'storage'>>
  cardStyle: CSSProperties
  fattureEmesse: unknown[]
  fattureFornitori: unknown[]
  totalePreventiviImpresa: number
  accontiCantiere: unknown[]
  cantieri: unknown[]
  speseImpresa: SpesaImpresa[]
  calcoloEconomiaCantiere: (nomeCantiere: string) => unknown
  formatMoney: (n: number) => string
  filtroSpeseImpresa: string
  setFiltroSpeseImpresa: Dispatch<SetStateAction<string>>
  tabellaSpeseImpresaAperta: boolean
  setTabellaSpeseImpresaAperta: Dispatch<SetStateAction<boolean>>
  ordineSpeseCampo: string
  ordineSpeseDirezione: 'asc' | 'desc'
  ordinaSpeseImpresa: (campo: string) => void
  inputStyle: CSSProperties
  buttonSecondary: CSSProperties
  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
}

export default function EconomiaGeneralePanel({
  client,
  scadenzaDaNotifica,
  onChiudiScadenzaDaNotifica,
  onDestinazioneNotificaAssente,
  badgeScadenziario,
  onApri,
  cardStyle,
  speseImpresa,
  formatMoney,
  filtroSpeseImpresa,
  setFiltroSpeseImpresa,
  tabellaSpeseImpresaAperta,
  setTabellaSpeseImpresaAperta,
  ordineSpeseCampo,
  ordineSpeseDirezione,
  ordinaSpeseImpresa,
  inputStyle,
  buttonSecondary,
  excelTable,
  excelTh,
  excelTd,
}: Props) {
  const [costiAperti, setCostiAperti] = useState(false)
  const [scadenziarioAperto, setScadenziarioAperto] = useState(false)
  const ritornoCostiRef = useRef<HTMLButtonElement | null>(null)
  return (
    <div style={cardStyle}>
      <h2>Economia generale</h2>

      <RiepilogoDittaPanel client={client} onApri={onApri} onApriScadenziario={() => setScadenziarioAperto(true)} rigaCostiGenerali={
        <CostiGeneraliImpresaSummary speseImpresa={speseImpresa} formatMoney={formatMoney} comeRiga
          onMostraDettaglio={event => { ritornoCostiRef.current = event.currentTarget; setCostiAperti(true) }} />
      } />
      <ScadenziarioPersistentePanel client={client} aperto={scadenziarioAperto || Boolean(scadenzaDaNotifica)}
        scadenzaDaNotifica={scadenzaDaNotifica} onDestinazioneNotificaAssente={onDestinazioneNotificaAssente} badgeScadenziario={badgeScadenziario}
        onChiudi={() => { setScadenziarioAperto(false); onChiudiScadenzaDaNotifica?.() }} />
      <details style={{ marginTop: 16 }}><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Costi fornitori assegnati e rettifiche</summary>
        <CostiFornitoriRettificati client={client} />
      </details>
      {costiAperti && <VistaOperativa titolo="Costi generali impresa" etichettaRitorno="← Torna a Economia generale"
        onChiudi={() => setCostiAperti(false)} ritornoFocusRef={ritornoCostiRef}>
      <EconomiaSpeseImpresaPanel
        speseImpresa={speseImpresa}
        filtroSpeseImpresa={filtroSpeseImpresa}
        setFiltroSpeseImpresa={setFiltroSpeseImpresa}
        tabellaSpeseImpresaAperta={tabellaSpeseImpresaAperta}
        setTabellaSpeseImpresaAperta={setTabellaSpeseImpresaAperta}
        ordineSpeseCampo={ordineSpeseCampo}
        ordineSpeseDirezione={ordineSpeseDirezione}
        ordinaSpeseImpresa={ordinaSpeseImpresa}
        formatMoney={formatMoney}
        inputStyle={inputStyle}
        buttonSecondary={buttonSecondary}
        excelTable={excelTable}
        excelTh={excelTh}
        excelTd={excelTd}
      />
      </VistaOperativa>}
    </div>
  )
}
