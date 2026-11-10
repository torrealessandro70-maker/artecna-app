'use client'

import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import CostiGeneraliImpresaSummary from './CostiGeneraliImpresaSummary'
import TabellaSpeseImpresaPanel from './TabellaSpeseImpresaPanel'

type Props = {
  speseImpresa: any[]
  filtroSpeseImpresa: string
  setFiltroSpeseImpresa: Dispatch<SetStateAction<string>>
  tabellaSpeseImpresaAperta: boolean
  setTabellaSpeseImpresaAperta: Dispatch<SetStateAction<boolean>>
  ordineSpeseCampo: string
  ordineSpeseDirezione: 'asc' | 'desc'
  ordinaSpeseImpresa: (campo: string) => void
  formatMoney: (value: number) => string
  inputStyle: CSSProperties
  buttonSecondary: CSSProperties
  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
}

export default function EconomiaSpeseImpresaPanel(p: Props) {
  return (
    <>
      <details><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Classificazioni gestionali preesistenti</summary>
        <CostiGeneraliImpresaSummary speseImpresa={p.speseImpresa} formatMoney={p.formatMoney} soloDettaglio />
      </details>

      <TabellaSpeseImpresaPanel
        mostraRiepilogo={false}
        speseImpresa={p.speseImpresa}
        filtroSpeseImpresa={p.filtroSpeseImpresa}
        setFiltroSpeseImpresa={p.setFiltroSpeseImpresa}
        tabellaSpeseImpresaAperta={p.tabellaSpeseImpresaAperta}
        setTabellaSpeseImpresaAperta={p.setTabellaSpeseImpresaAperta}
        ordineSpeseCampo={p.ordineSpeseCampo}
        ordineSpeseDirezione={p.ordineSpeseDirezione}
        ordinaSpeseImpresa={p.ordinaSpeseImpresa}
        formatMoney={p.formatMoney}
        inputStyle={p.inputStyle}
        buttonSecondary={p.buttonSecondary}
        excelTable={p.excelTable}
        excelTh={p.excelTh}
        excelTd={p.excelTd}
      />
    </>
  )
}