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
      <CostiGeneraliImpresaSummary
        speseImpresa={p.speseImpresa}
        formatMoney={p.formatMoney}
      />

      <button
        onClick={() =>
          p.setTabellaSpeseImpresaAperta(!p.tabellaSpeseImpresaAperta)
        }
        style={{ ...p.buttonSecondary, marginBottom: 10 }}
      >
        {p.tabellaSpeseImpresaAperta
          ? '🔽 Nascondi dettaglio spese'
          : '📋 Mostra dettaglio spese'}
      </button>

      <TabellaSpeseImpresaPanel
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