'use client'

import type { CSSProperties } from 'react'
import PopupModificaOperaio from './PopupModificaOperaio'
import OperaioForm from './OperaioForm'
import OperaiList from './OperaiList'

type Props = {
  cardStyle: CSSProperties

  operaioInModifica: any
  annullaModificaOperaio: () => void
  salvaModificaOperaio: () => void | Promise<void>

  nomeOperaioModifica: string
  setNomeOperaioModifica: (v: string) => void
  telefonoOperaioModifica: string
  setTelefonoOperaioModifica: (v: string) => void
  qualificaOperaioModifica: string
  setQualificaOperaioModifica: (v: string) => void
  pinOperaioModifica: string
  setPinOperaioModifica: (v: string) => void
  costoOrarioOperaioModifica: string
  setCostoOrarioOperaioModifica: (v: string) => void
  statoOperaioModifica: string
  setStatoOperaioModifica: (v: string) => void
  notaOperaioModifica: string
  setNotaOperaioModifica: (v: string) => void

  nomeOperaio: string
  setNomeOperaio: (v: string) => void
  telefonoOperaio: string
  setTelefonoOperaio: (v: string) => void
  qualificaOperaio: string
  setQualificaOperaio: (v: string) => void
  pinOperaio: string
  setPinOperaio: (v: string) => void
  costoOrarioOperaio: string
  setCostoOrarioOperaio: (v: string) => void
  aggiungiOperaio: () => void | Promise<void>

  operaiFiltrati: any[]
  badgeStyle: (stato?: string) => CSSProperties
  formatMoney: (value: number) => string
  preparaModificaOperaio: (operaio: any) => void
  cambiaStatoOperaio: (
  operaio: any,
  stato: 'attivo' | 'sospeso'
) => void | Promise<void>
  eliminaOperaio: (id?: string) => void | Promise<void>

  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function OperaiAnagraficaPanel(p: Props) {
  return (
    <div style={p.cardStyle}>
      <h2>Anagrafica operai</h2>

      {p.operaioInModifica && (
        <PopupModificaOperaio
          operaioInModifica={p.operaioInModifica}
          annullaModificaOperaio={p.annullaModificaOperaio}
          salvaModificaOperaio={p.salvaModificaOperaio}
          nomeOperaioModifica={p.nomeOperaioModifica}
          setNomeOperaioModifica={p.setNomeOperaioModifica}
          telefonoOperaioModifica={p.telefonoOperaioModifica}
          setTelefonoOperaioModifica={p.setTelefonoOperaioModifica}
          qualificaOperaioModifica={p.qualificaOperaioModifica}
          setQualificaOperaioModifica={p.setQualificaOperaioModifica}
          pinOperaioModifica={p.pinOperaioModifica}
          setPinOperaioModifica={p.setPinOperaioModifica}
          costoOrarioOperaioModifica={p.costoOrarioOperaioModifica}
          setCostoOrarioOperaioModifica={p.setCostoOrarioOperaioModifica}
          statoOperaioModifica={p.statoOperaioModifica}
          setStatoOperaioModifica={p.setStatoOperaioModifica}
          notaOperaioModifica={p.notaOperaioModifica}
          setNotaOperaioModifica={p.setNotaOperaioModifica}
          buttonSecondary={p.buttonSecondary}
          buttonPrimary={p.buttonPrimary}
        />
      )}

      <OperaioForm
        nomeOperaio={p.nomeOperaio}
        setNomeOperaio={p.setNomeOperaio}
        telefonoOperaio={p.telefonoOperaio}
        setTelefonoOperaio={p.setTelefonoOperaio}
        qualificaOperaio={p.qualificaOperaio}
        setQualificaOperaio={p.setQualificaOperaio}
        pinOperaio={p.pinOperaio}
        setPinOperaio={p.setPinOperaio}
        costoOrarioOperaio={p.costoOrarioOperaio}
        setCostoOrarioOperaio={p.setCostoOrarioOperaio}
        aggiungiOperaio={p.aggiungiOperaio}
        buttonPrimary={p.buttonPrimary}
      />

      <OperaiList
        operaiFiltrati={p.operaiFiltrati}
        badgeStyle={p.badgeStyle}
        formatMoney={p.formatMoney}
        preparaModificaOperaio={p.preparaModificaOperaio}
        cambiaStatoOperaio={p.cambiaStatoOperaio}
        eliminaOperaio={p.eliminaOperaio}
        buttonPrimary={p.buttonPrimary}
        buttonSecondary={p.buttonSecondary}
      />
    </div>
  )
}