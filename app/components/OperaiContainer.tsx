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
  p.pagineAperte.includes('operai-anagrafica') ||
  (!p.modalitaMulti &&
    p.sezioneAttiva === 'operai' &&
    p.sottoSezioneOperai === 'anagrafica')
) && (
  <OperaiAnagraficaPanel
    cardStyle={p.cardStyle}
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
    operaiFiltrati={p.operaiFiltrati}
    badgeStyle={p.badgeStyle}
    formatMoney={p.formatMoney}
    preparaModificaOperaio={p.preparaModificaOperaio}
    cambiaStatoOperaio={p.cambiaStatoOperaio}
    eliminaOperaio={p.eliminaOperaio}
    buttonPrimary={p.buttonPrimary}
    buttonSecondary={p.buttonSecondary}
  />
)}
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
{(
  p.pagineAperte.includes('operai-presenze') ||
  (!p.modalitaMulti &&
    p.sezioneAttiva === 'operai' &&
    p.sottoSezioneOperai === 'presenze')
) && (
  <OperaiPresenzeContainer
    cardStyle={p.cardStyle}
    timbraturaInModifica={p.timbraturaInModifica}
    dataTimbraturaModifica={p.dataTimbraturaModifica}
    setDataTimbraturaModifica={p.setDataTimbraturaModifica}
    oraEntrataModifica={p.oraEntrataModifica}
    setOraEntrataModifica={p.setOraEntrataModifica}
    oraUscitaModifica={p.oraUscitaModifica}
    setOraUscitaModifica={p.setOraUscitaModifica}
    parseOra={p.parseOra}
    setTimbraturaInModifica={p.setTimbraturaInModifica}
    salvaModificaTimbratura={p.salvaModificaTimbratura}
    buttonSecondary={p.buttonSecondary}
    buttonPrimary={p.buttonPrimary}
    dataPresenzaManuale={p.dataPresenzaManuale}
    setDataPresenzaManuale={p.setDataPresenzaManuale}
    operaioPresenzaManuale={p.operaioPresenzaManuale}
    setOperaioPresenzaManuale={p.setOperaioPresenzaManuale}
    cantierePresenzaManuale={p.cantierePresenzaManuale}
    setCantierePresenzaManuale={p.setCantierePresenzaManuale}
    oraEntrataManuale={p.oraEntrataManuale}
    setOraEntrataManuale={p.setOraEntrataManuale}
    oraUscitaManuale={p.oraUscitaManuale}
    setOraUscitaManuale={p.setOraUscitaManuale}
    operaiAnagrafica={p.operaiAnagrafica}
    cantieri={p.cantieri}
    aggiungiPresenzaManuale={p.aggiungiPresenzaManuale}
    dataDa={p.dataDa}
    setDataDa={p.setDataDa}
    dataA={p.dataA}
    setDataA={p.setDataA}
    cantiereGrafico={p.cantiereGrafico}
    setCantiereGrafico={p.setCantiereGrafico}
    inputStyle={p.inputStyle}
    timbrature={p.timbrature}
    totaleCostoPeriodo={p.totaleCostoPeriodo}
    totaleOrePeriodo={p.totaleOrePeriodo}
    calcolaOre={p.calcolaOre}
    calcolaCostoTimbratura={p.calcolaCostoTimbratura}
    formatMoney={p.formatMoney}
    badgeStyle={p.badgeStyle}
    preparaModificaOperaio={p.preparaModificaOperaio}
    cambiaStatoOperaio={p.cambiaStatoOperaio}
    eliminaOperaio={p.eliminaOperaio}
    costoPerCantiereOggi={p.costoPerCantiereOggi}
    timbratureOggi={p.timbratureOggi}
    erroreTimbratura={p.erroreTimbratura}
    setStatoTimbraturaModifica={p.setStatoTimbraturaModifica}
    eliminaTimbratura={p.eliminaTimbratura}
  />
)}
    </>
  )
}