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
        <RegistroCantieriPanel {...p} />
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