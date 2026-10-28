import type { CSSProperties, Dispatch, SetStateAction } from 'react'

import RiepilogoDittaPanel from './RiepilogoDittaPanel'
import type { ClientAttribuzioni } from '../engines/contabilita-ditta/attribuzioni'
import type { ClientLettura } from '../engines/contabilita-ditta/lettura'
import EconomiaSpeseImpresaPanel from './EconomiaSpeseImpresaPanel'

type Props = {
  client: ClientLettura & ClientAttribuzioni
  cardStyle: CSSProperties
  fattureEmesse: unknown[]
  fattureFornitori: unknown[]
  totalePreventiviImpresa: number
  accontiCantiere: unknown[]
  cantieri: unknown[]
  speseImpresa: unknown[]
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
  return (
    <div style={cardStyle}>
      <h2>Economia generale</h2>

      <RiepilogoDittaPanel client={client} />
      <h3>Classificazioni gestionali preesistenti</h3>
      <p>Spese, magazzino e attrezzature: consultazione separata, non utile contabile o fiscale e non sommate ai documenti del riepilogo.</p>

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
    </div>
  )
}
