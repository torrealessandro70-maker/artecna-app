'use client'

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
import type Webcam from 'react-webcam'
import SopralluogoForm from './SopralluogoForm'
import VistaOperativa from './VistaOperativa'
import SopralluoghiList from './SopralluoghiList'
import SopralluogoDettaglio from './SopralluogoDettaglio'
import PopupFotoSopralluogo from './PopupFotoSopralluogo'

type Props = {
  onApriPdf?: (sopralluogoId: string) => void
  onApriPreventivo?: (sopralluogoId: string) => void
  contestoCantiere?: { id: string; nome: string } | null
  tornaAlCantiere?: () => void
  cardStyle: CSSProperties
  clienteSopralluogo: string
  setClienteSopralluogo: any
  telefonoSopralluogo: string
  setTelefonoSopralluogo: any
  indirizzoSopralluogo: string
  setIndirizzoSopralluogo: any
  geolocalizzazioneSopralluogo: string
  setGeolocalizzazioneSopralluogo: any
  rilevaGeolocalizzazioneSopralluogo: any
  dataSopralluogo: string
  setDataSopralluogo: any
  oraSopralluogo: string
  setOraSopralluogo: any
  promemoriaSopralluogo: string
  setPromemoriaSopralluogo: any
  tipoLavoroSopralluogo: string
  setTipoLavoroSopralluogo: any
  noteSopralluogo: string
  setNoteSopralluogo: any
  salvaSopralluogo: any
  inputStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
  sopralluoghi: any[]
  mostraElencoSopralluoghi: boolean
  setMostraElencoSopralluoghi: any
  setUltimoSopralluogo: any
  setSopralluogoAperto: any
  setFirmaCliente: any
  setMostraGestioneFotoSopralluogo: any
  setMostraFotoPreventivoSopralluogo: any
  setFotoSopralluoghi: any
  eliminaSopralluogo: any
  supabase: any
  sopralluogoAperto: any
sopralluogoModificaId: string | null
  setSopralluogoModificaId: any
  coloreStatoSopralluogo: any
  firmaRef: any
  mostraFirmaCliente: boolean
  setMostraFirmaCliente: any
  altezzaFirma: number
  setAltezzaFirma: any
  coloreFirma: string
  spessoreFirma: number
  mostraAppuntiSopralluogo: boolean
  setMostraAppuntiSopralluogo: any
  pagineAppunti: string[]
  setPagineAppunti: any
  paginaFullscreen: number | null
  setPaginaFullscreen: any
  appuntiRefs: any
  mostraTavolozzaFirma: boolean
  setMostraTavolozzaFirma: any
  setColoreFirma: any
  setSpessoreFirma: any
  mostraGestioneFotoSopralluogo: boolean
  mostraFotoPreventivoSopralluogo: boolean
  setPopupFotoSopralluogo: any
  fotoSopralluoghi: any[]
  fotoSopralluogoSelezionate: string[]
  setFotoSopralluogoSelezionate: any
  setFotoFullscreen: any
  caricaFotoSopralluoghi: any
  preventivoAiGenerato: any
  generaPreventivoAiDaSopralluogo: any
  generaPreventivoDaSopralluogo: any
  apriPreventivoAiGeneratoInModifica: any
  convertiSopralluogoInCantiere: any
  generaPdfSopralluogo: any
  popupFotoSopralluogo: boolean
  cameraSopralluogoAttiva: boolean
  setCameraSopralluogoAttiva: any
  cameraSopralluogoFullscreen: boolean
  setCameraSopralluogoFullscreen: any
  webcamSopralluogoRef: RefObject<Webcam | null>
  scattaFotoSopralluogo: any
  fotoSopralluogoTemp: string[]
  setFotoSopralluogoTemp: any
  notaFotoSopralluogo: string
  setNotaFotoSopralluogo: any
  salvaFotoSopralluogo: any
documentIntelligence: any
generaPreventivoDaDocumentoAnalizzato: any
}

export default function SopralluoghiPanel(props: Props) {
  const [mostraNuovoSopralluogo, setMostraNuovoSopralluogo] =
    useState(false)
  const [aperturaInFocus, setAperturaInFocus] = useState(false)
  const nuovoSopralluogoRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (props.sopralluogoModificaId) {
      setAperturaInFocus(true)
      setMostraNuovoSopralluogo(true)
    }
  }, [props.sopralluogoModificaId])

  return (
    <div style={{ ...props.cardStyle, minWidth: 0, overflowWrap: 'anywhere' }}>
      <h2>📍 Sopralluoghi</h2>
      {props.contestoCantiere && <div data-cantiere-id={props.contestoCantiere.id} style={{ marginBottom: 16 }}>
        <button type="button" onClick={props.tornaAlCantiere} style={props.buttonSecondary}>← Torna al cantiere</button>
        <p>Sopralluoghi del cantiere: <strong>{props.contestoCantiere.nome}</strong></p>
      </div>}
 <SopralluoghiList
        onApriPdf={props.onApriPdf}
        onApriPreventivo={props.onApriPreventivo}
        azioneNuovo={<>
  <button
    type="button"
    ref={nuovoSopralluogoRef}
    onClick={() => { setAperturaInFocus(true); setMostraNuovoSopralluogo((v) => !v) }}
    style={props.buttonPrimary}
  >
    {mostraNuovoSopralluogo
      ? '✖ Chiudi nuovo sopralluogo'
      : '➕ Nuovo sopralluogo'}
  </button>
        </>}
        sopralluoghi={props.sopralluoghi}
        mostraElencoSopralluoghi={props.mostraElencoSopralluoghi}
        setMostraElencoSopralluoghi={props.setMostraElencoSopralluoghi}
        setUltimoSopralluogo={props.setUltimoSopralluogo}
        setSopralluogoAperto={props.setSopralluogoAperto}
        setFirmaCliente={props.setFirmaCliente}
        setMostraGestioneFotoSopralluogo={props.setMostraGestioneFotoSopralluogo}
        setMostraFotoPreventivoSopralluogo={props.setMostraFotoPreventivoSopralluogo}
        setFotoSopralluoghi={props.setFotoSopralluoghi}
        eliminaSopralluogo={props.eliminaSopralluogo}
        supabase={props.supabase}
        buttonPrimary={props.buttonPrimary}
        buttonSecondary={props.buttonSecondary}
      />

      {mostraNuovoSopralluogo && <VistaOperativa attiva={aperturaInFocus} titolo={props.sopralluogoModificaId ? 'Modifica sopralluogo' : 'Nuovo sopralluogo'}
        etichettaRitorno="← Torna ai sopralluoghi" contesto={props.contestoCantiere?.nome}
        onChiudi={() => setMostraNuovoSopralluogo(false)} ritornoFocusRef={nuovoSopralluogoRef}>
     <div className={aperturaInFocus ? 'nuovo-sopralluogo-focus' : undefined}
  style={{
    margin: '20px 0',
    padding: 16,
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    background: '#f8fafc',
  }}
>
  {!aperturaInFocus && <div
    style={{
      fontWeight: 800,
      fontSize: 16,
      marginBottom: 12,
      color: '#0f172a',
    }}
  >
    ➕ Nuovo sopralluogo
  </div>}


  {mostraNuovoSopralluogo && (
    <div style={{ marginTop: 16 }}>
      <SopralluogoForm
        clienteSopralluogo={props.clienteSopralluogo}
        setClienteSopralluogo={props.setClienteSopralluogo}
        telefonoSopralluogo={props.telefonoSopralluogo}
        setTelefonoSopralluogo={props.setTelefonoSopralluogo}
        indirizzoSopralluogo={props.indirizzoSopralluogo}
        setIndirizzoSopralluogo={props.setIndirizzoSopralluogo}
        geolocalizzazioneSopralluogo={props.geolocalizzazioneSopralluogo}
        setGeolocalizzazioneSopralluogo={props.setGeolocalizzazioneSopralluogo}
        rilevaGeolocalizzazioneSopralluogo={props.rilevaGeolocalizzazioneSopralluogo}
        dataSopralluogo={props.dataSopralluogo}
        setDataSopralluogo={props.setDataSopralluogo}
        oraSopralluogo={props.oraSopralluogo}
        setOraSopralluogo={props.setOraSopralluogo}
        promemoriaSopralluogo={props.promemoriaSopralluogo}
        setPromemoriaSopralluogo={props.setPromemoriaSopralluogo}
        tipoLavoroSopralluogo={props.tipoLavoroSopralluogo}
        setTipoLavoroSopralluogo={props.setTipoLavoroSopralluogo}
        noteSopralluogo={props.noteSopralluogo}
        setNoteSopralluogo={props.setNoteSopralluogo}
        salvaSopralluogo={props.salvaSopralluogo}
        inputStyle={props.inputStyle}
        buttonPrimary={props.buttonPrimary}
        buttonSecondary={props.buttonSecondary}
      />
    </div>
  )}
</div>
  <style>{` .nuovo-sopralluogo-focus input, .nuovo-sopralluogo-focus textarea {
    min-width: 0; max-width: 100%; box-sizing: border-box;
  } `}</style>
  </VistaOperativa>}

      <SopralluogoDettaglio
        apriQuadernoDirettamente={!!props.contestoCantiere}
        tornaAlCantiere={props.contestoCantiere ? props.tornaAlCantiere : undefined}
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
        firmaRef={props.firmaRef}
        mostraFirmaCliente={props.mostraFirmaCliente}
        setMostraFirmaCliente={props.setMostraFirmaCliente}
        altezzaFirma={props.altezzaFirma}
        setAltezzaFirma={props.setAltezzaFirma}
        coloreFirma={props.coloreFirma}
        spessoreFirma={props.spessoreFirma}
        setFirmaCliente={props.setFirmaCliente}
        mostraAppuntiSopralluogo={props.mostraAppuntiSopralluogo}
        setMostraAppuntiSopralluogo={props.setMostraAppuntiSopralluogo}
        pagineAppunti={props.pagineAppunti}
        setPagineAppunti={props.setPagineAppunti}
        paginaFullscreen={props.paginaFullscreen}
        setPaginaFullscreen={props.setPaginaFullscreen}
        appuntiRefs={props.appuntiRefs}
        mostraTavolozzaFirma={props.mostraTavolozzaFirma}
        setMostraTavolozzaFirma={props.setMostraTavolozzaFirma}
        setColoreFirma={props.setColoreFirma}
        setSpessoreFirma={props.setSpessoreFirma}
        mostraGestioneFotoSopralluogo={props.mostraGestioneFotoSopralluogo}
        setMostraGestioneFotoSopralluogo={props.setMostraGestioneFotoSopralluogo}
        mostraFotoPreventivoSopralluogo={props.mostraFotoPreventivoSopralluogo}
        setMostraFotoPreventivoSopralluogo={props.setMostraFotoPreventivoSopralluogo}
        setPopupFotoSopralluogo={props.setPopupFotoSopralluogo}
        fotoSopralluoghi={props.fotoSopralluoghi}
        setFotoSopralluoghi={props.setFotoSopralluoghi}
        fotoSopralluogoSelezionate={props.fotoSopralluogoSelezionate}
        setFotoSopralluogoSelezionate={props.setFotoSopralluogoSelezionate}
        setFotoFullscreen={props.setFotoFullscreen}
        caricaFotoSopralluoghi={props.caricaFotoSopralluoghi}
        preventivoAiGenerato={props.preventivoAiGenerato}
        generaPreventivoAiDaSopralluogo={props.generaPreventivoAiDaSopralluogo}
        generaPreventivoDaSopralluogo={props.generaPreventivoDaSopralluogo}
generaPreventivoDaDocumentoAnalizzato={
  props.generaPreventivoDaDocumentoAnalizzato
}
        apriPreventivoAiGeneratoInModifica={props.apriPreventivoAiGeneratoInModifica}
        convertiSopralluogoInCantiere={props.convertiSopralluogoInCantiere}
        generaPdfSopralluogo={props.generaPdfSopralluogo}
documentIntelligence={props.documentIntelligence}
        supabase={props.supabase}
        buttonPrimary={props.buttonPrimary}
        buttonSecondary={props.buttonSecondary}

      />

      <PopupFotoSopralluogo
        popupFotoSopralluogo={props.popupFotoSopralluogo}
        setPopupFotoSopralluogo={props.setPopupFotoSopralluogo}
        cameraSopralluogoAttiva={props.cameraSopralluogoAttiva}
        setCameraSopralluogoAttiva={props.setCameraSopralluogoAttiva}
        cameraSopralluogoFullscreen={props.cameraSopralluogoFullscreen}
        setCameraSopralluogoFullscreen={props.setCameraSopralluogoFullscreen}
        webcamSopralluogoRef={props.webcamSopralluogoRef}
        scattaFotoSopralluogo={props.scattaFotoSopralluogo}
        fotoSopralluogoTemp={props.fotoSopralluogoTemp}
        setFotoSopralluogoTemp={props.setFotoSopralluogoTemp}
        notaFotoSopralluogo={props.notaFotoSopralluogo}
        setNotaFotoSopralluogo={props.setNotaFotoSopralluogo}
        salvaFotoSopralluogo={props.salvaFotoSopralluogo}
        buttonPrimary={props.buttonPrimary}
        buttonSecondary={props.buttonSecondary}
      />
    </div>
  )
}
