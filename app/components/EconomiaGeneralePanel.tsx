import type { CSSProperties, Dispatch, SetStateAction } from 'react'

import EconomiaGeneraleKpiPanel from './EconomiaGeneraleKpiPanel'
import UtileNettoImpresaContainer from './UtileNettoImpresaContainer'
import EconomiaSpeseImpresaPanel from './EconomiaSpeseImpresaPanel'

type Props = {
  cardStyle: CSSProperties
  fattureEmesse: any[]
  fattureFornitori: any[]
  totalePreventiviImpresa: number
  accontiCantiere: any[]
  cantieri: any[]
  speseImpresa: any[]
  calcoloEconomiaCantiere: (nomeCantiere: string) => any
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
  cardStyle,
  fattureEmesse,
  fattureFornitori,
  totalePreventiviImpresa,
  accontiCantiere,
  cantieri,
  speseImpresa,
  calcoloEconomiaCantiere,
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

      <div style={{ display: 'grid', gap: 10 }}>
        <EconomiaGeneraleKpiPanel
          fattureEmesse={fattureEmesse}
          fattureFornitori={fattureFornitori}
          totalePreventiviImpresa={totalePreventiviImpresa}
          formatMoney={formatMoney}
        />
      </div>

      <UtileNettoImpresaContainer
        accontiCantiere={accontiCantiere}
        cantieri={cantieri}
        speseImpresa={speseImpresa}
        calcoloEconomiaCantiere={calcoloEconomiaCantiere}
        formatMoney={formatMoney}
      />

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