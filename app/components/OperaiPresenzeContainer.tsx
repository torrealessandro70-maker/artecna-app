import type { CSSProperties } from 'react'

import PresenzeCostiOperaiPanel from './PresenzeCostiOperaiPanel'
import PopupModificaTimbratura from './PopupModificaTimbratura'
import PresenzaManualePanel from './PresenzaManualePanel'
import FiltroPresenzeCostiPanel from './FiltroPresenzeCostiPanel'
import PresenzePeriodoSummaryPanel from './PresenzePeriodoSummaryPanel'
import DettaglioPresenzeOggiPanel from './DettaglioPresenzeOggiPanel'
import CostoPerCantiereOggiPanel from './CostoPerCantiereOggiPanel'
type Props = any

export default function OperaiPresenzeContainer(props: Props) {
  const {
    cardStyle,
    timbraturaInModifica,
    dataTimbraturaModifica,
    setDataTimbraturaModifica,
    oraEntrataModifica,
    setOraEntrataModifica,
    oraUscitaModifica,
    setOraUscitaModifica,
    parseOra,
    setTimbraturaInModifica,
    salvaModificaTimbratura,
    buttonSecondary,
    buttonPrimary,
    dataPresenzaManuale,
    setDataPresenzaManuale,
    operaioPresenzaManuale,
    setOperaioPresenzaManuale,
    cantierePresenzaManuale,
    setCantierePresenzaManuale,
    oraEntrataManuale,
    setOraEntrataManuale,
    oraUscitaManuale,
    setOraUscitaManuale,
    operaiAnagrafica,
    cantieri,
    aggiungiPresenzaManuale,
    dataDa,
    setDataDa,
    dataA,
    setDataA,
    cantiereGrafico,
    setCantiereGrafico,
    inputStyle,
    timbrature,
    calcolaCostoTimbratura,
    formatMoney,
    timbratureOggi,
    preparaModificaTimbratura,
    setStatoTimbraturaModifica,
    eliminaTimbratura,
totaleCostoPeriodo,
totaleOrePeriodo,
calcolaOre,
badgeStyle,
preparaModificaOperaio,
cambiaStatoOperaio,
eliminaOperaio,
costoPerCantiereOggi,
erroreTimbratura,

  } = props

  return (
    <PresenzeCostiOperaiPanel cardStyle={cardStyle}>
      {timbraturaInModifica && (
        <PopupModificaTimbratura
          titolo="Modifica presenza"
          dataTimbraturaModifica={dataTimbraturaModifica}
          setDataTimbraturaModifica={setDataTimbraturaModifica}
          oraEntrataModifica={oraEntrataModifica}
          setOraEntrataModifica={setOraEntrataModifica}
          oraUscitaModifica={oraUscitaModifica}
          setOraUscitaModifica={setOraUscitaModifica}
          parseOra={parseOra}
          onChiudi={() => setTimbraturaInModifica(null)}
          onSalva={salvaModificaTimbratura}
          buttonSecondary={buttonSecondary}
          buttonPrimary={buttonPrimary}
        />
      )}

      <PresenzaManualePanel
        dataPresenzaManuale={dataPresenzaManuale}
        setDataPresenzaManuale={setDataPresenzaManuale}
        operaioPresenzaManuale={operaioPresenzaManuale}
        setOperaioPresenzaManuale={setOperaioPresenzaManuale}
        cantierePresenzaManuale={cantierePresenzaManuale}
        setCantierePresenzaManuale={setCantierePresenzaManuale}
        oraEntrataManuale={oraEntrataManuale}
        setOraEntrataManuale={setOraEntrataManuale}
        oraUscitaManuale={oraUscitaManuale}
        setOraUscitaManuale={setOraUscitaManuale}
        operaiAnagrafica={operaiAnagrafica}
        cantieri={cantieri}
        aggiungiPresenzaManuale={aggiungiPresenzaManuale}
        buttonPrimary={buttonPrimary}
      />

      <FiltroPresenzeCostiPanel
        dataDa={dataDa}
        setDataDa={setDataDa}
        dataA={dataA}
        setDataA={setDataA}
        cantiereGrafico={cantiereGrafico}
        setCantiereGrafico={setCantiereGrafico}
        cantieri={cantieri}
        inputStyle={inputStyle}
      />

     <PresenzePeriodoSummaryPanel
  timbrature={timbrature}
  operaiAnagrafica={operaiAnagrafica}
  dataDa={dataDa}
  dataA={dataA}
  cantiereGrafico={cantiereGrafico}
  totaleCostoPeriodo={totaleCostoPeriodo}
  totaleOrePeriodo={totaleOrePeriodo}
  calcolaOre={calcolaOre}
  calcolaCostoTimbratura={calcolaCostoTimbratura}
  formatMoney={formatMoney}
  badgeStyle={badgeStyle}
  preparaModificaOperaio={preparaModificaOperaio}
  cambiaStatoOperaio={cambiaStatoOperaio}
  eliminaOperaio={eliminaOperaio}
  buttonPrimary={buttonPrimary}
  buttonSecondary={buttonSecondary}
/>

<CostoPerCantiereOggiPanel
  costoPerCantiereOggi={costoPerCantiereOggi}
  formatMoney={formatMoney}
/>

     <DettaglioPresenzeOggiPanel
  timbratureOggi={timbratureOggi}
  formatMoney={formatMoney}
  calcolaCostoTimbratura={calcolaCostoTimbratura}
  erroreTimbratura={erroreTimbratura}
  setTimbraturaInModifica={setTimbraturaInModifica}
  setDataTimbraturaModifica={setDataTimbraturaModifica}
  setOraEntrataModifica={setOraEntrataModifica}
  setOraUscitaModifica={setOraUscitaModifica}
  setStatoTimbraturaModifica={setStatoTimbraturaModifica}
  eliminaTimbratura={eliminaTimbratura}
  buttonSecondary={buttonSecondary}
/>
    </PresenzeCostiOperaiPanel>
  )
}