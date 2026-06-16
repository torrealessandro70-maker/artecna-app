'use client'

import RegistroHeaderToolbar from './RegistroHeaderToolbar'
import RegistroCantieriPanel from './RegistroCantieriPanel'
import RegistroPreventiviPanel from './RegistroPreventiviPanel'
import RevisionePreventivoAiPanel from './RevisionePreventivoAiPanel'
import RegistroRapportiniPanel from './RegistroRapportiniPanel'
import RegistroTimbraturePanel from './RegistroTimbraturePanel'
import RegistroPagamentiOperaiPanel from './RegistroPagamentiOperaiPanel'
import RegistroFattureFornitoriPanel from './RegistroFattureFornitoriPanel'
import FattureEmessePanel from './FattureEmessePanel'
import FattureEmessePopupLayer from './FattureEmessePopupLayer'

export default function RegistroPanel(props: any) {
  const p = props

 return (
  <>
    <div
      style={{
        padding: 12,
        background: '#fff3cd',
        border: '1px solid #facc15',
        borderRadius: 8,
        marginBottom: 12,
      }}
    >
      TEST REGISTRO VISIBILE - tab: {p.registroTab}
    </div>

    <RegistroHeaderToolbar
        registroTab={p.registroTab}
        setRegistroTab={p.setRegistroTab}
        registroCerca={p.registroCerca}
        setRegistroCerca={p.setRegistroCerca}
        registroFiltroDataDa={p.registroFiltroDataDa}
        setRegistroFiltroDataDa={p.setRegistroFiltroDataDa}
        registroFiltroDataA={p.registroFiltroDataA}
        setRegistroFiltroDataA={p.setRegistroFiltroDataA}
        setRegistroFiltroNome={p.setRegistroFiltroNome}
        buttonSecondary={p.buttonSecondary}
      />

   {p.registroTab === 'cantieri' && (
  <RegistroCantieriPanel
    cantieri={p.cantieri}
    registroCerca={p.registroCerca}
    formatMoney={p.formatMoney}
    ordinaRegistro={p.ordinaRegistro}
    ordinaCantieriCampo={p.ordinaCantieriCampo}
    ordinaCantieriDirezione={p.ordinaCantieriDirezione}
    setOrdinaCantieriCampo={p.setOrdinaCantieriCampo}
    setOrdinaCantieriDirezione={p.setOrdinaCantieriDirezione}
    cantiereRegistroEdit={p.cantiereRegistroEdit}
    cantiereRegistroNome={p.cantiereRegistroNome}
    setCantiereRegistroNome={p.setCantiereRegistroNome}
    cantiereRegistroPreventivo={p.cantiereRegistroPreventivo}
    setCantiereRegistroPreventivo={p.setCantiereRegistroPreventivo}
    cantiereRegistroInizio={p.cantiereRegistroInizio}
    setCantiereRegistroInizio={p.setCantiereRegistroInizio}
    cantiereRegistroFine={p.cantiereRegistroFine}
    setCantiereRegistroFine={p.setCantiereRegistroFine}
    cantiereRegistroConcluso={p.cantiereRegistroConcluso}
    setCantiereRegistroConcluso={p.setCantiereRegistroConcluso}
    salvaModificaRegistroCantiere={p.salvaModificaRegistroCantiere}
    annullaModificaRegistroCantiere={p.annullaModificaRegistroCantiere}
    preparaModificaRegistroCantiere={p.preparaModificaRegistroCantiere}
    eliminaCantiere={p.eliminaCantiere}
    excelBox={p.excelBox}
    excelToolbar={p.excelToolbar}
    excelTable={p.excelTable}
    excelTh={p.excelTh}
    excelTd={p.excelTd}
    excelInput={p.excelInput}
    buttonPrimary={p.buttonPrimary}
    buttonSecondary={p.buttonSecondary}
  />
)}
     {p.registroTab === 'preventivi' && (
  <RegistroPreventiviPanel
    preventivi={p.preventivi}
    registroCerca={p.registroCerca}
    mostraRegistroPreventiviCaricati={p.mostraRegistroPreventiviCaricati}
    setMostraRegistroPreventiviCaricati={p.setMostraRegistroPreventiviCaricati}
    preventivoRegistroEdit={p.preventivoRegistroEdit}
    setPreventivoRegistroEdit={p.setPreventivoRegistroEdit}
    preventivoRegistroCantiere={p.preventivoRegistroCantiere}
    setPreventivoRegistroCantiere={p.setPreventivoRegistroCantiere}
    preventivoRegistroNomeFile={p.preventivoRegistroNomeFile}
    setPreventivoRegistroNomeFile={p.setPreventivoRegistroNomeFile}
    preventivoRegistroImporto={p.preventivoRegistroImporto}
    setPreventivoRegistroImporto={p.setPreventivoRegistroImporto}
    preventivoRegistroNote={p.preventivoRegistroNote}
    setPreventivoRegistroNote={p.setPreventivoRegistroNote}
    ordinaPreventiviCampo={p.ordinaPreventiviCampo}
    ordinaPreventiviDirezione={p.ordinaPreventiviDirezione}
    setOrdinaPreventiviCampo={p.setOrdinaPreventiviCampo}
    setOrdinaPreventiviDirezione={p.setOrdinaPreventiviDirezione}
    ordinaRegistro={p.ordinaRegistro}
    parseImporto={p.parseImporto}
    formatMoney={p.formatMoney}
    generaExcelDaPreventivoAi={p.generaExcelDaPreventivoAi}
    approvaPreventivoAiECreaCantiere={p.approvaPreventivoAiECreaCantiere}
    salvaModificaRegistroPreventivo={p.salvaModificaRegistroPreventivo}
    eliminaPreventivoCantiere={p.eliminaPreventivoCantiere}
    setVociPreventivoAi={p.setVociPreventivoAi}
    setVociPreventivoAiOriginali={p.setVociPreventivoAiOriginali}
    setDescrizionePreventivoAi={p.setDescrizionePreventivoAi}
    setMostraRevisionePreventivoAi={p.setMostraRevisionePreventivoAi}
    excelBox={p.excelBox}
    excelToolbar={p.excelToolbar}
    excelTable={p.excelTable}
    excelTh={p.excelTh}
    excelTd={p.excelTd}
    excelInput={p.excelInput}
    buttonPrimary={p.buttonPrimary}
    buttonSecondary={p.buttonSecondary}
  />
)}

      {p.mostraRevisionePreventivoAi && (
        <RevisionePreventivoAiPanel {...p} />
      )}
{p.registroTab === 'rapportini' && (
  <RegistroRapportiniPanel
    rapportini={p.rapportini}
    registroCerca={p.registroCerca}
    ordinaRegistro={p.ordinaRegistro}
    ordinaRapportiniCampo={p.ordinaRapportiniCampo}
    ordinaRapportiniDirezione={p.ordinaRapportiniDirezione}
    setOrdinaRapportiniCampo={p.setOrdinaRapportiniCampo}
    setOrdinaRapportiniDirezione={p.setOrdinaRapportiniDirezione}
    rapportinoRegistroEdit={p.rapportinoRegistroEdit}
    rapportinoRegistroData={p.rapportinoRegistroData}
    setRapportinoRegistroData={p.setRapportinoRegistroData}
    rapportinoRegistroCantiere={p.rapportinoRegistroCantiere}
    setRapportinoRegistroCantiere={p.setRapportinoRegistroCantiere}
    rapportinoRegistroOperaio={p.rapportinoRegistroOperaio}
    setRapportinoRegistroOperaio={p.setRapportinoRegistroOperaio}
    rapportinoRegistroOre={p.rapportinoRegistroOre}
    setRapportinoRegistroOre={p.setRapportinoRegistroOre}
    rapportinoRegistroDescrizione={p.rapportinoRegistroDescrizione}
    setRapportinoRegistroDescrizione={p.setRapportinoRegistroDescrizione}
    salvaModificaRegistroRapportino={p.salvaModificaRegistroRapportino}
    annullaModificaRegistroRapportino={p.annullaModificaRegistroRapportino}
    preparaModificaRegistroRapportino={p.preparaModificaRegistroRapportino}
    eliminaRapportino={p.eliminaRapportino}
    excelBox={p.excelBox}
    excelToolbar={p.excelToolbar}
    excelTable={p.excelTable}
    excelTh={p.excelTh}
    excelTd={p.excelTd}
    excelInput={p.excelInput}
    buttonPrimary={p.buttonPrimary}
    buttonSecondary={p.buttonSecondary}
  />
)}
     {p.registroTab === 'timbrature' && (
  <RegistroTimbraturePanel
    timbratureFiltrateRegistro={p.timbratureFiltrateRegistro}
    calcolaOre={p.calcolaOre}
    calcolaCostoTimbratura={p.calcolaCostoTimbratura}
    formatMoney={p.formatMoney}
    excelTable={p.excelTable}
    excelTh={p.excelTh}
    excelTd={p.excelTd}
    excelInput={p.excelInput}
    ordinaRegistro={p.ordinaRegistro}
    setOrdinaTimbratureCampo={p.setOrdinaTimbratureCampo}
    setOrdinaTimbratureDirezione={p.setOrdinaTimbratureDirezione}
    ordinaTimbratureCampo={p.ordinaTimbratureCampo}
    ordinaTimbratureDirezione={p.ordinaTimbratureDirezione}
    timbraturaRegistroEdit={p.timbraturaRegistroEdit}
    timbraturaRegistroData={p.timbraturaRegistroData}
    setTimbraturaRegistroData={p.setTimbraturaRegistroData}
    timbraturaRegistroOperaio={p.timbraturaRegistroOperaio}
    setTimbraturaRegistroOperaio={p.setTimbraturaRegistroOperaio}
    timbraturaRegistroCantiere={p.timbraturaRegistroCantiere}
    setTimbraturaRegistroCantiere={p.setTimbraturaRegistroCantiere}
    timbraturaRegistroEntrata={p.timbraturaRegistroEntrata}
    setTimbraturaRegistroEntrata={p.setTimbraturaRegistroEntrata}
    timbraturaRegistroUscita={p.timbraturaRegistroUscita}
    setTimbraturaRegistroUscita={p.setTimbraturaRegistroUscita}
    operaiAnagrafica={p.operaiAnagrafica}
    cantieri={p.cantieri}
    calcolaOreTimbratura={p.calcolaOreTimbratura}
    salvaModificaRegistroTimbratura={p.salvaModificaRegistroTimbratura}
    annullaModificaRegistroTimbratura={p.annullaModificaRegistroTimbratura}
    preparaModificaRegistroTimbratura={p.preparaModificaRegistroTimbratura}
    eliminaTimbratura={p.eliminaTimbratura}
    buttonPrimary={p.buttonPrimary}
    buttonSecondary={p.buttonSecondary}
  />
)}

      {p.registroTab === 'pagamenti-operai' && (
  <RegistroPagamentiOperaiPanel
    pagamentiOperai={p.pagamentiOperai}
    registroCerca={p.registroCerca}
    formatMoney={p.formatMoney}
    ordinaRegistro={p.ordinaRegistro}
    ordinaPagamentiCampo={p.ordinaPagamentiCampo}
    ordinaPagamentiDirezione={p.ordinaPagamentiDirezione}
    setOrdinaPagamentiCampo={p.setOrdinaPagamentiCampo}
    setOrdinaPagamentiDirezione={p.setOrdinaPagamentiDirezione}
    pagamentoOperaioRegistroEdit={p.pagamentoOperaioRegistroEdit}
    pagamentoOperaioRegistroNome={p.pagamentoOperaioRegistroNome}
    setPagamentoOperaioRegistroNome={p.setPagamentoOperaioRegistroNome}
    pagamentoOperaioRegistroImporto={p.pagamentoOperaioRegistroImporto}
    setPagamentoOperaioRegistroImporto={p.setPagamentoOperaioRegistroImporto}
    pagamentoOperaioRegistroData={p.pagamentoOperaioRegistroData}
    setPagamentoOperaioRegistroData={p.setPagamentoOperaioRegistroData}
    pagamentoOperaioRegistroMetodo={p.pagamentoOperaioRegistroMetodo}
    setPagamentoOperaioRegistroMetodo={p.setPagamentoOperaioRegistroMetodo}
    pagamentoOperaioRegistroNota={p.pagamentoOperaioRegistroNota}
    setPagamentoOperaioRegistroNota={p.setPagamentoOperaioRegistroNota}
    salvaModificaRegistroPagamentoOperaio={p.salvaModificaRegistroPagamentoOperaio}
    annullaModificaRegistroPagamentoOperaio={p.annullaModificaRegistroPagamentoOperaio}
    preparaModificaRegistroPagamentoOperaio={p.preparaModificaRegistroPagamentoOperaio}
    eliminaPagamentoOperaio={p.eliminaPagamentoOperaio}
    excelBox={p.excelBox}
    excelToolbar={p.excelToolbar}
    excelTable={p.excelTable}
    excelTh={p.excelTh}
    excelTd={p.excelTd}
    excelInput={p.excelInput}
    buttonPrimary={p.buttonPrimary}
    buttonSecondary={p.buttonSecondary}
  />
)}

      {p.registroTab === 'fatture-fornitori' && (
        <RegistroFattureFornitoriPanel {...p} />
      )}

      {p.registroTab === 'fatture-emesse' && (
        <FattureEmessePanel {...p} />
      )}

      <FattureEmessePopupLayer {...p} />
    </>
  )
}