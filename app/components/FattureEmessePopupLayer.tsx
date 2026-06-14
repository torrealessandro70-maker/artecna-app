'use client'

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
  aggiornaFatturaEmessa: any
  eliminaFatturaEmessa: any
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