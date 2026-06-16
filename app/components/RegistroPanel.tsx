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
        <RegistroPreventiviPanel {...p} />
      )}

      {p.mostraRevisionePreventivoAi && (
        <RevisionePreventivoAiPanel {...p} />
      )}

      {p.registroTab === 'rapportini' && (
        <RegistroRapportiniPanel {...p} />
      )}

      {p.registroTab === 'timbrature' && (
        <RegistroTimbraturePanel {...p} />
      )}

      {p.registroTab === 'pagamenti-operai' && (
        <RegistroPagamentiOperaiPanel {...p} />
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