'use client'

import OperaiAnagraficaPanel from './OperaiAnagraficaPanel'
import OperaiTimbraturePanel from './OperaiTimbraturePanel'
import OperaiPresenzeContainer from './OperaiPresenzeContainer'

type Props = any

export default function OperaiContainer(props: Props) {
  const p = props

  return (
    <>
      {/* ================= OPERAI - ANAGRAFICA ================= */}
      {(
  p.pagineAperte.includes('operai-timbrature') ||
  (!p.modalitaMulti &&
    p.sezioneAttiva === 'operai' &&
    p.sottoSezioneOperai === 'timbrature')
) && (
  <OperaiTimbraturePanel
    cardStyle={p.cardStyle}
    timbraturaInModifica={p.timbraturaInModifica}
    dataTimbraturaModifica={p.dataTimbraturaModifica}
    setDataTimbraturaModifica={p.setDataTimbraturaModifica}
    oraEntrataModifica={p.oraEntrataModifica}
    setOraEntrataModifica={p.setOraEntrataModifica}
    oraUscitaModifica={p.oraUscitaModifica}
    setOraUscitaModifica={p.setOraUscitaModifica}
    setTimbraturaInModifica={p.setTimbraturaInModifica}
    setStatoTimbraturaModifica={p.setStatoTimbraturaModifica}
    parseOra={p.parseOra}
    salvaModificaTimbratura={p.salvaModificaTimbratura}
    operaioTimbratura={p.operaioTimbratura}
    setOperaioTimbratura={p.setOperaioTimbratura}
    cantiereTimbratura={p.cantiereTimbratura}
    setCantiereTimbratura={p.setCantiereTimbratura}
    pinTimbratura={p.pinTimbratura}
    setPinTimbratura={p.setPinTimbratura}
    operaiAttivi={p.operaiAttivi}
    cantieri={p.cantieri}
    timbratureOggi={p.timbratureOggi}
    timbraEntrataConPin={p.timbraEntrataConPin}
    timbraUscitaConPin={p.timbraUscitaConPin}
    eliminaTimbratura={p.eliminaTimbratura}
    calcolaCostoTimbratura={p.calcolaCostoTimbratura}
    formatMoney={p.formatMoney}
    buttonPrimary={p.buttonPrimary}
    buttonSecondary={p.buttonSecondary}
  />
)}
    </>
  )
}