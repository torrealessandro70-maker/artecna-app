'use client'

import SopralluogoDettaglioHeader from './SopralluogoDettaglioHeader'
import SopralluogoFirmaCliente from './SopralluogoFirmaCliente'
import SopralluogoAppunti from './SopralluogoAppunti'
import SopralluogoToolbar from './SopralluogoToolbar'
import SopralluogoFotoGallery from './SopralluogoFotoGallery'
import SopralluogoGestioneFoto from './SopralluogoGestioneFoto'
import SopralluogoFotoPreventivo from './SopralluogoFotoPreventivo'
import SopralluogoAzioniPreventivo from './SopralluogoAzioniPreventivo'

type Props = {
  [key: string]: any
}

export default function SopralluogoDettaglio(props: Props) {
  const {
    sopralluogoAperto,
    buttonPrimary,
    buttonSecondary,
    supabase,
  } = props

  if (!sopralluogoAperto) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          width: '100%',
          maxWidth: 1000,
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 20,
        }}
      >
        <SopralluogoDettaglioHeader
  sopralluogoAperto={props.sopralluogoAperto}
  setSopralluogoAperto={props.setSopralluogoAperto}
  setSopralluogoModificaId={props.setSopralluogoModificaId}
  setClienteSopralluogo={props.setClienteSopralluogo}
  setTelefonoSopralluogo={props.setTelefonoSopralluogo}
  setIndirizzoSopralluogo={props.setIndirizzoSopralluogo}
  setDataSopralluogo={props.setDataSopralluogo}
  setOraSopralluogo={props.setOraSopralluogo}
  setTipoLavoroSopralluogo={props.setTipoLavoroSopralluogo}
  setNoteSopralluogo={props.setNoteSopralluogo}
  setPromemoriaSopralluogo={props.setPromemoriaSopralluogo}
  setGeolocalizzazioneSopralluogo={props.setGeolocalizzazioneSopralluogo}
  coloreStatoSopralluogo={props.coloreStatoSopralluogo}
  buttonPrimary={props.buttonPrimary}
  buttonSecondary={props.buttonSecondary}
/>

        <SopralluogoFirmaCliente
          sopralluogoAperto={sopralluogoAperto}
          firmaRef={props.firmaRef}
          mostraFirmaCliente={props.mostraFirmaCliente}
          setMostraFirmaCliente={props.setMostraFirmaCliente}
          altezzaFirma={props.altezzaFirma}
          setAltezzaFirma={props.setAltezzaFirma}
          coloreFirma={props.coloreFirma}
          spessoreFirma={props.spessoreFirma}
          setFirmaCliente={props.setFirmaCliente}
          supabase={supabase}
          buttonPrimary={buttonPrimary}
          buttonSecondary={buttonSecondary}
        />

        <SopralluogoAppunti
  mostraAppuntiSopralluogo={props.mostraAppuntiSopralluogo}
  setMostraAppuntiSopralluogo={props.setMostraAppuntiSopralluogo}
  pagineAppunti={props.pagineAppunti}
  setPagineAppunti={props.setPagineAppunti}
  paginaFullscreen={props.paginaFullscreen}
  setPaginaFullscreen={props.setPaginaFullscreen}
  appuntiRefs={props.appuntiRefs}
  mostraTavolozzaFirma={props.mostraTavolozzaFirma}
  setMostraTavolozzaFirma={props.setMostraTavolozzaFirma}
  coloreFirma={props.coloreFirma}
  setColoreFirma={props.setColoreFirma}
  spessoreFirma={props.spessoreFirma}
  setSpessoreFirma={props.setSpessoreFirma}
  sopralluogoAperto={props.sopralluogoAperto}
  buttonPrimary={props.buttonPrimary}
  buttonSecondary={props.buttonSecondary}
/>

        <div style={{ marginTop: 25 }}>
          <h3>📸 Galleria sopralluogo</h3>

          <SopralluogoToolbar
            mostraGestioneFotoSopralluogo={props.mostraGestioneFotoSopralluogo}
            setMostraGestioneFotoSopralluogo={props.setMostraGestioneFotoSopralluogo}
            mostraFotoPreventivoSopralluogo={props.mostraFotoPreventivoSopralluogo}
            setMostraFotoPreventivoSopralluogo={props.setMostraFotoPreventivoSopralluogo}
            setPopupFotoSopralluogo={props.setPopupFotoSopralluogo}
            buttonPrimary={buttonPrimary}
          />

          <SopralluogoFotoGallery
            sopralluogoAperto={sopralluogoAperto}
            fotoSopralluoghi={props.fotoSopralluoghi}
            setFotoSopralluoghi={props.setFotoSopralluoghi}
            setFotoFullscreen={props.setFotoFullscreen}
            supabase={supabase}
          />

          <SopralluogoGestioneFoto
            mostraGestioneFotoSopralluogo={props.mostraGestioneFotoSopralluogo}
            sopralluogoAperto={sopralluogoAperto}
            fotoSopralluoghi={props.fotoSopralluoghi}
            fotoSopralluogoSelezionate={props.fotoSopralluogoSelezionate}
            setFotoSopralluogoSelezionate={props.setFotoSopralluogoSelezionate}
            setFotoFullscreen={props.setFotoFullscreen}
            caricaFotoSopralluoghi={props.caricaFotoSopralluoghi}
            supabase={supabase}
          />

          <SopralluogoFotoPreventivo
            mostraFotoPreventivoSopralluogo={props.mostraFotoPreventivoSopralluogo}
            sopralluogoAperto={sopralluogoAperto}
            fotoSopralluoghi={props.fotoSopralluoghi}
          />

          <SopralluogoAzioniPreventivo
            sopralluogoAperto={sopralluogoAperto}
            preventivoAiGenerato={props.preventivoAiGenerato}
            generaPreventivoAiDaSopralluogo={props.generaPreventivoAiDaSopralluogo}
            generaPreventivoDaSopralluogo={props.generaPreventivoDaSopralluogo}
            apriPreventivoAiGeneratoInModifica={props.apriPreventivoAiGeneratoInModifica}
            convertiSopralluogoInCantiere={props.convertiSopralluogoInCantiere}
            generaPdfSopralluogo={props.generaPdfSopralluogo}
            buttonPrimary={buttonPrimary}
          />
        </div>
      </div>
    </div>
  )
}