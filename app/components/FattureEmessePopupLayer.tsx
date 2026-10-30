'use client'

import type { StatoCantieri, AggiornaFattura } from '../engines/contabilita-ditta/modificaFattura'
import type { CSSProperties } from 'react'
import PopupNuovaFatturaEmessa from './PopupNuovaFatturaEmessa'
import PopupDettaglioFatturaEmessa from './PopupDettaglioFatturaEmessa'

type Props = {
  popupNuovaFatturaEmessa: boolean
  nuovaFatturaEmessa: any
  setNuovaFatturaEmessa: any
  setPopupNuovaFatturaEmessa: any
  salvaNuovaFatturaEmessa: any
  fatturaEmessaAperta: any
  setFatturaEmessaAperta: any
  aggiornaFatturaEmessa: AggiornaFattura
  eliminaFatturaEmessa: any
  statoCantieri: StatoCantieri
  cantieri: any[]
  formatMoney: (value: number) => string
  inputStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function FattureEmessePopupLayer({
  popupNuovaFatturaEmessa,
  nuovaFatturaEmessa,
  setNuovaFatturaEmessa,
  setPopupNuovaFatturaEmessa,
  salvaNuovaFatturaEmessa,
  fatturaEmessaAperta,
  setFatturaEmessaAperta,
  aggiornaFatturaEmessa,
  eliminaFatturaEmessa,
  cantieri,
  statoCantieri,
  formatMoney,
  inputStyle,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  return (
    <>
      {popupNuovaFatturaEmessa && (
        <PopupNuovaFatturaEmessa
          nuovaFatturaEmessa={nuovaFatturaEmessa}
          setNuovaFatturaEmessa={setNuovaFatturaEmessa}
          setPopupNuovaFatturaEmessa={setPopupNuovaFatturaEmessa}
          salvaNuovaFatturaEmessa={salvaNuovaFatturaEmessa}
          cantieri={cantieri}
          inputStyle={inputStyle}
          buttonPrimary={buttonPrimary}
          buttonSecondary={buttonSecondary}
        />
      )}

      {fatturaEmessaAperta && (
        <PopupDettaglioFatturaEmessa
          key={fatturaEmessaAperta.id}
          statoCantieri={statoCantieri}
          fatturaEmessaAperta={fatturaEmessaAperta}
          setFatturaEmessaAperta={setFatturaEmessaAperta}
          cantieri={cantieri}
          formatMoney={formatMoney}
          aggiornaFatturaEmessa={aggiornaFatturaEmessa}
          eliminaFatturaEmessa={eliminaFatturaEmessa}
          inputStyle={inputStyle}
          buttonPrimary={buttonPrimary}
          buttonSecondary={buttonSecondary}
        />
      )}
    </>
  )
}