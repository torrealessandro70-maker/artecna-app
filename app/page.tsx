'use client'

import { useEffect, useRef, useState, type CSSProperties, type ChangeEvent } from 'react'
import Webcam from 'react-webcam'
import SignatureCanvas from 'react-signature-canvas'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { supabase } from '../lib/supabaseClient'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import Tesseract from 'tesseract.js'
import JSZip from 'jszip'
import { cleanDictationText } from './utils/cleanDictationText'
import PopupModificaTimbratura from './components/PopupModificaTimbratura'
import LoginForm from './components/LoginForm'
import StatCard from './components/StatCard'
import EconomiaGeneralePanel from './components/EconomiaGeneralePanel'







import PopupModificaOperaio from './components/PopupModificaOperaio'
import FiltroPeriodoEconomia from './components/FiltroPeriodoEconomia'
import CostoPerCantiereOggiPanel from './components/CostoPerCantiereOggiPanel'
import FotoFullscreenModal from './components/FotoFullscreenModal'

import OperaioForm from './components/OperaioForm'
import OperaioCard from './components/OperaioCard'
import OperaiList from './components/OperaiList'
import RapportiniPanel from './components/RapportiniPanel'
import SopralluoghiContainer from './components/SopralluoghiContainer'
import FotoCantiereAnteprime from './components/FotoCantiereAnteprime'
import FotoCantiereCategoriaModal from './components/FotoCantiereCategoriaModal'
import FotoCantiereGallery from './components/FotoCantiereGallery'
import FotoCantiereToolbar from './components/FotoCantiereToolbar'
import FotoCantiereCamera from './components/FotoCantiereCamera'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import FotoCantiereFiltri from './components/FotoCantiereFiltri'
import FotoCantiereForm from './components/FotoCantiereForm'
import SopralluogoForm from './components/SopralluogoForm'
import SopralluoghiList from './components/SopralluoghiList'
import SopralluogoDettaglioHeader from './components/SopralluogoDettaglioHeader'
import SopralluogoFirmaCliente from './components/SopralluogoFirmaCliente'
import SopralluogoAppunti from './components/SopralluogoAppunti'
import SopralluogoFotoGallery from './components/SopralluogoFotoGallery'
import PopupFotoSopralluogo from './components/PopupFotoSopralluogo'
import SopralluogoAzioniPreventivo from './components/SopralluogoAzioniPreventivo'
import SopralluogoFotoPreventivo from './components/SopralluogoFotoPreventivo'
import SopralluogoToolbar from './components/SopralluogoToolbar'
import SopralluogoGestioneFoto from './components/SopralluogoGestioneFoto'
import SopralluogoDettaglio from './components/SopralluogoDettaglio'
import RegistroTimbraturePanel from './components/RegistroTimbraturePanel'
import RegistroPagamentiOperaiPanel from './components/RegistroPagamentiOperaiPanel'
import RegistroRapportiniPanel from './components/RegistroRapportiniPanel'
import RegistroCantieriPanel from './components/RegistroCantieriPanel'
import RegistroPreventiviPanel from './components/RegistroPreventiviPanel'
import RevisionePreventivoAiPanel from './components/RevisionePreventivoAiPanel'
import FattureEmessePanel from './components/FattureEmessePanel'
import PopupNuovaFatturaEmessa from './components/PopupNuovaFatturaEmessa'
import PopupDettaglioFatturaEmessa from './components/PopupDettaglioFatturaEmessa'
import RegistroFattureFornitoriPanel from './components/RegistroFattureFornitoriPanel'
import PopupFotoRapportino from './components/PopupFotoRapportino'
import PopupOperaiRapportino from './components/PopupOperaiRapportino'
import PopupFotoRapportinoAperte from './components/PopupFotoRapportinoAperte'
import RegistroHeaderToolbar from './components/RegistroHeaderToolbar'
import AttivitaPanel from './components/AttivitaPanel'
import AgendaContainer from './components/agenda/AgendaContainer'
import SopralluoghiPanel from './components/SopralluoghiPanel'
import FattureEmessePopupLayer from './components/FattureEmessePopupLayer'
import RegistroPanel from './components/RegistroPanel'
import CantieriElencoPanel from './components/CantieriElencoPanel'
import CantieriSchedaPanel from './components/CantieriSchedaPanel'
import CantieriAnalisiDocumentoPanel from './components/CantieriAnalisiDocumentoPanel'


import CantieriContainer from './components/CantieriContainer'
import PagamentiContainer from './components/PagamentiContainer'
import PresenzeCostiOperaiPanel from './components/PresenzeCostiOperaiPanel'
import { buildPhotoRecordsWithStorage } from './engines/photo-storage'
import PresenzaManualePanel from './components/PresenzaManualePanel'
import FiltroPresenzeCostiPanel from './components/FiltroPresenzeCostiPanel'
import PresenzePeriodoSummaryPanel from './components/PresenzePeriodoSummaryPanel'
import DettaglioPresenzeOggiPanel from './components/DettaglioPresenzeOggiPanel'
import HomePresenzeCostiCard from './components/HomePresenzeCostiCard'
import HomeTimbratureCard from './components/HomeTimbratureCard'
import HomeAnagraficaOperaiCard from './components/HomeAnagraficaOperaiCard'
import HomeRapportiniCard from './components/HomeRapportiniCard'
import HomePagamentiOperaiCard from './components/HomePagamentiOperaiCard'
import HomePagamentiFornitoriCard from './components/HomePagamentiFornitoriCard'
import HomeEconomiaGeneraleCard from './components/HomeEconomiaGeneraleCard'
import OperaiContainer from './components/OperaiContainer'


import EconomiaGeneraleKpiPanel from './components/EconomiaGeneraleKpiPanel'
import UtileNettoImpresaContainer from './components/UtileNettoImpresaContainer'
import EconomiaSpeseImpresaPanel from './components/EconomiaSpeseImpresaPanel'
import SalDettagliatoPanel from './components/SalDettagliatoPanel'
import AccontiEconomiaPanel from './components/AccontiEconomiaPanel'
import RiepilogoCostiEconomiaPanel from './components/RiepilogoCostiEconomiaPanel'
import CantieriEconomiaPanel from './components/CantieriEconomiaPanel'
import HomeDashboardPanel from './components/HomeDashboardPanel'


import type {
  Cantiere,
  Rapportino,
  FotoCantiere,
  Operaio,
  Timbratura,
  PreventivoCantiere,
  PagamentoOperaio,
  PagamentoFornitore,
} from './types'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
PieChart,
Pie,
 Legend,
} from 'recharts'
let pdfjsLib: any = null






type Sopralluogo = {
  id?: string
  cliente: string
  telefono?: string
  indirizzo?: string
  geolocalizzazione?: string
  data_sopralluogo?: string
  tipo_lavoro?: string
  note?: string
  stato?: string
  firma_cliente?: string
  preventivo_accettato?: boolean
  data_inizio_lavori?: string
  created_at?: string
ora_appuntamento?: string
promemoria?: string
}


type FotoSopralluogo = {
  id?: string
  sopralluogo_id?: string
  nota?: string
  immagine_base64: string
  tag?: string
  includi_preventivo?: boolean
  created_at?: string
}

type VoceAnalizzata = {
  descrizione: string
  quantita?: number
  unita?: string
  prezzo?: number
}






type PrezzoarioSicilia = {
  id?: string
  codice?: string
  descrizione: string
  unita_misura?: string
  prezzo_unitario?: number
  categoria?: string
  fonte?: string
  anno?: number
  provincia?: string
}

type MaterialeCantiere = {
  id?: string
  cantiere: string
  descrizione?: string
  quantita?: number
  prezzo_unitario?: number
  totale?: number
  fornitore?: string
  data_documento?: string
  nome_file?: string
  created_at?: string

file_url?: string | null
  file_path?: string | null
  file_tipo?: string | null
  anteprima_testo?: string | null
}

type MemoriaPrezzo = {
  id?: string
  descrizione: string
  categoria?: string
  unita_misura?: string
  prezzo_unitario?: number
  prezzo_totale?: number
  quantita?: number
  cantiere?: string
  fonte?: string
  provincia?: string
  note?: string
  creato_il?: string
}

type FatturaFornitore = {
  id?: string
  fornitore?: string
  partita_iva?: string
  numero_fattura?: string
  data_fattura?: string
  data_ricezione?: string
  tipo_documento?: string
  importo_totale?: number
  nome_file?: string
  tipo_file?: string
  xml_testo?: string
  pdf_testo?: string
  stato?: string
  note?: string
  created_at?: string
}

type RigaFatturaFornitore = {
  id?: string
  fattura_id?: string
  numero_riga?: number
  descrizione: string
  quantita?: number
  prezzo_unitario?: number
  aliquota_iva?: number
  totale_riga?: number
  cantiere?: string
  stato?: string
  created_at?: string
  categoria_economica?: string
}


type RigaFatturaDaAssegnare = {
  numero_riga: number
  descrizione: string
  quantita: number
  prezzo_unitario: number
  unita_misura?: string
  aliquota_iva?: number
  totale_riga: number
  cantiere: string
categoria_economica?: string
}


type AttrezzoCantiere = {
  id?: string
  cantiere: string
  descrizione?: string
  categoria?: string
  quantita?: number
  prezzo_unitario?: number
  totale?: number
  fornitore?: string
  data_documento?: string
  nome_file?: string
  nota?: string
  created_at?: string

file_url?: string | null
  file_path?: string | null
  file_tipo?: string | null
  anteprima_testo?: string | null
}

export default function Home() {
const coloreUtile = (utile: number, preventivo: number) => {
  if (preventivo === 0) return '#111827'

  const margine = (utile / preventivo) * 100

  if (utile < 0) return 'red'            // perdita
  if (margine < 10) return '#f59e0b'     // basso margine
  return 'green'                         // buono
}



 
const caricaMemoriaPrezzi = async () => {
  const { data, error } = await supabase
    .from('memoria_prezzi')
    .select('*')
    .order('creato_il', { ascending: false })

  if (error) {
    alert('Errore caricamento memoria prezzi: ' + error.message)
    return
  }

  setMemoriaPrezzi(data || [])
}


const formatEuro = (valore: string) => {
  if (!valore) return ''

  const pulito = valore
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '')

  const numero = parseFloat(pulito)

  if (isNaN(numero)) return ''

  return numero.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €'
}
const calcoloEconomiaCantiere = (nomeCantiere: string) => {
  const cantiere = cantieri.find((c) => c.nome === nomeCantiere)

  const totalePreventiviCaricati = preventivi
    .filter((p) => p.cantiere === nomeCantiere)
    .reduce((tot, p) => {
      const valoreDaUsare =
        (p as any).importo_corretto &&
        String((p as any).importo_corretto).trim() !== ''
          ? (p as any).importo_corretto
          : p.importo_totale

      return tot + parseImporto(valoreDaUsare)
    }, 0)

  const preventivo =
    totalePreventiviCaricati > 0
      ? totalePreventiviCaricati
      : parseImporto(cantiere?.preventivo)

  const costoTimbrature = timbrature
  .filter((t) => t.cantiere === nomeCantiere)
  .reduce((tot, t) => tot + calcolaCostoTimbratura(t), 0)

const costoRapportini = rapportini
  .filter((r) => r.cantiere === nomeCantiere)
  .reduce(
    (tot, r) => tot + Number(r.costo_manodopera || 0),
    0
  )

const costoManodopera = costoTimbrature + costoRapportini

  const costoMateriali = materialiCantiere
    .filter((m) => m.cantiere === nomeCantiere)
    .reduce((tot, m) => tot + Number(m.totale || 0), 0)



  const costoAttrezzi = attrezziCantiere
    .filter((a) => a.cantiere === nomeCantiere)
    .reduce((tot, a) => tot + Number(a.totale || 0), 0)

  const costoTotale =
    costoManodopera + costoMateriali + costoAttrezzi

  const utileReale = preventivo - costoTotale

  return {
    preventivo,
    costoManodopera,
    costoFornitori: costoMateriali + costoAttrezzi,
    costoMateriali,
    costoAttrezzi,
    costoTotale,
    utileReale,
  }
}





const ordinaBilancioCantiere = (campo: string) => {
  if (ordineBilancioCampo === campo) {
    setOrdineBilancioDirezione(
      ordineBilancioDirezione === 'asc' ? 'desc' : 'asc'
    )
  } else {
    setOrdineBilancioCampo(campo)
    setOrdineBilancioDirezione('asc')
  }
}


 
const ordinaSpeseImpresa = (campo: string) => {
  if (ordineSpeseCampo === campo) {
    setOrdineSpeseDirezione(
      ordineSpeseDirezione === 'asc'
        ? 'desc'
        : 'asc'
    )
  } else {
    setOrdineSpeseCampo(campo)
    setOrdineSpeseDirezione('asc')
  }
}

const ordinaFatture = (campo: string) => {
  if (ordineFattureCampo === campo) {
    setOrdineFattureDirezione(
      ordineFattureDirezione === 'asc'
        ? 'desc'
        : 'asc'
    )
  } else {
    setOrdineFattureCampo(campo)
    setOrdineFattureDirezione('asc')
  }
}

const ordinaMateriali = (campo: string) => {
  if (ordineMaterialiCampo === campo) {
    setOrdineMaterialiDirezione(
      ordineMaterialiDirezione === 'asc' ? 'desc' : 'asc'
    )
  } else {
    setOrdineMaterialiCampo(campo)
    setOrdineMaterialiDirezione('asc')
  }
}


const ordinaFattureEmesse = (campo: string) => {
  if (ordineFattureEmesseCampo === campo) {
    setOrdineFattureEmesseDirezione(
      ordineFattureEmesseDirezione === 'asc' ? 'desc' : 'asc'
    )
  } else {
    setOrdineFattureEmesseCampo(campo)
    setOrdineFattureEmesseDirezione('asc')
  }
}


const statoFornitore = (p: PagamentoFornitore) => {
  const totale = Number(p.importo_totale || 0)
  const pagato = Number(p.importo_pagato || 0)
  const residuo = totale - pagato

  if (residuo <= 0) return 'pagato'
  if (p.data_scadenza && p.data_scadenza < oggi) return 'scaduto'
  if (pagato > 0 && residuo > 0) return 'parziale'

  return 'da pagare'
}


const coloreStatoFornitore = (stato: string) => {
  if (stato === 'pagato') return 'green'
  if (stato === 'parziale') return '#f59e0b'
  if (stato === 'scaduto') return 'red'
  return '#111827'
}


const dettaNoteLavoro = () => {
  avviaDettatura((testo) => {
    setNote((prev) => prev ? prev + ' ' + testo : testo)
  })
}

const dettaNoteFoto = () => {
  avviaDettatura((testo) => {
    setNotaFotoRapportino((prev) => prev ? prev + ' ' + testo : testo)
  })
}

const dettaMateriali = () => {
  avviaDettatura((testo) => {
    setMateriali((prev) => prev ? prev + ' ' + testo : testo)
  })
}

const firmaRef = useRef<any>(null)

const [oraSopralluogo, setOraSopralluogo] =
  useState('')


const [ordineOperai, setOrdineOperai] =
  useState<'data' | 'operaio' | 'entrata' | 'uscita' | 'ore' | 'costo'>('data')

const [direzioneOperai, setDirezioneOperai] =
  useState<'asc' | 'desc'>('desc')

const [ordinaCantieriCampo, setOrdinaCantieriCampo] =
  useState<'nome' | 'preventivo' | 'inizio' | 'fine' | 'concluso'>('inizio')
const [ordinaCantieriDirezione, setOrdinaCantieriDirezione] =
  useState<'asc' | 'desc'>('asc')

const [promemoriaSopralluogo, setPromemoriaSopralluogo] =
  useState('')
const [paginaFullscreen, setPaginaFullscreen] =
  useState<number | null>(null)

const [altezzaFirma, setAltezzaFirma] = useState(260)


const [firmaCliente, setFirmaCliente] =
  useState<string>('')
const [
  mostraCantieriConclusiFatture,
  setMostraCantieriConclusiFatture,
] = useState(false)
const [mostraRegistroPreventiviCaricati, setMostraRegistroPreventiviCaricati] =
  useState(false)
const [mostraTavolozzaFirma, setMostraTavolozzaFirma] = useState(false)
const [mostraFirmaCliente, setMostraFirmaCliente] =
  useState(false)
const [mostraFotoSopralluogo, setMostraFotoSopralluogo] =
  useState(false)
const [mostraGestioneFotoSopralluogo, setMostraGestioneFotoSopralluogo] =
  useState(false)

const [mostraFotoPreventivoSopralluogo, setMostraFotoPreventivoSopralluogo] =
  useState(false)
const [mostraStoricoAi, setMostraStoricoAi] = useState(false)
const [modelloAiPredefinito, setModelloAiPredefinito] =
  useState('gpt-4.1-mini')
const [coloreFirma, setColoreFirma] = useState('black')
const [spessoreFirma, setSpessoreFirma] = useState(2)
const [cercaMaterialeManuale, setCercaMaterialeManuale] =
  useState('')
const [mostraAppuntiSopralluogo, setMostraAppuntiSopralluogo] = useState(false)
const [pagineAppunti, setPagineAppunti] = useState<string[]>([''])
const appuntiRefs = useRef<any[]>([])
const [memoriaPrezzi, setMemoriaPrezzi] = useState<MemoriaPrezzo[]>([])
const [ricercaMemoriaPrezzi, setRicercaMemoriaPrezzi] = useState('')
const [suggerimentoPrezzoAI, setSuggerimentoPrezzoAI] = useState('')
const [utilizzoAi, setUtilizzoAi] = useState<any[]>([])
const [larghezzaDescrizioneFattura, setLarghezzaDescrizioneFattura] =
  useState(() => {
    if (typeof window !== 'undefined') {
      return Number(
        localStorage.getItem('larghezza_descrizione_fattura') || 320
      )
    }

    return 320
  })


const [sopralluogoModificaId, setSopralluogoModificaId] =
  useState<string | null>(null)

const [sopralluogoAperto, setSopralluogoAperto] =
  useState<Sopralluogo | null>(null)
const [mostraElencoSopralluoghi, setMostraElencoSopralluoghi] =
  useState(false)
const [preventivoGeneratoId, setPreventivoGeneratoId] =
  useState<string | null>(null)

const [popupCategoriaFotoCantiere, setPopupCategoriaFotoCantiere] =
  useState(false)
const [categoriaFotoDaSalvare, setCategoriaFotoDaSalvare] =
  useState('durante')

const [popupMappaSopralluogo, setPopupMappaSopralluogo] = useState(false)
const [puntoMappaSopralluogo, setPuntoMappaSopralluogo] =
  useState<{ lat: number; lng: number } | null>(null)
const [popupFotoCantiere, setPopupFotoCantiere] = useState(false)
const [fotoRapportinoFullscreen, setFotoRapportinoFullscreen] =
  useState(false)
const [fotoCantiereTemp, setFotoCantiereTemp] = useState<string[]>([])
const [notaFotoCantiere, setNotaFotoCantiere] = useState('')
const [cameraCantiereAttiva, setCameraCantiereAttiva] = useState(false)
const [cameraCantiereFullscreen, setCameraCantiereFullscreen] = useState(false)
const [cameraFotoCantiereAttiva, setCameraFotoCantiereAttiva] = useState(false)
const [cameraFotoCantiereFullscreen, setCameraFotoCantiereFullscreen] = useState(false)

const webcamFotoCantiereRef = useRef<Webcam>(null)
const webcamCantiereRef = useRef<Webcam>(null)

const [sopralluoghi, setSopralluoghi] = useState<Sopralluogo[]>([])
const [fotoSopralluoghi, setFotoSopralluoghi] = useState<FotoSopralluogo[]>([])

const [geolocalizzazioneSopralluogo, setGeolocalizzazioneSopralluogo] =
  useState('')
const [clienteSopralluogo, setClienteSopralluogo] = useState('')
const [telefonoSopralluogo, setTelefonoSopralluogo] = useState('')
const [indirizzoSopralluogo, setIndirizzoSopralluogo] = useState('')
const [dataSopralluogo, setDataSopralluogo] = useState(
  new Date().toISOString().slice(0, 10)
)
const [tipoLavoroSopralluogo, setTipoLavoroSopralluogo] = useState('')
const [noteSopralluogo, setNoteSopralluogo] = useState('')
const [nascondiCantieriConclusiFatture, setNascondiCantieriConclusiFatture] =
  useState(false)
const [menuMobileAperto, setMenuMobileAperto] = useState(false)
const [messaggioAi, setMessaggioAi] =
  useState('')
const [isMobile, setIsMobile] = useState(false)



const [sidebarAperta, setSidebarAperta] = useState(true)

const [cameraRapportinoAttiva, setCameraRapportinoAttiva] = useState(false)
const webcamRapportinoRef = useRef<Webcam>(null)
const [categoriaFoto, setCategoriaFoto] =
  useState('durante')
const [cameraSopralluogoFullscreen, setCameraSopralluogoFullscreen] =
  useState(false)

const [mostraDettaglioManodopera, setMostraDettaglioManodopera] = useState(false)
const [mostraCantieriConclusi, setMostraCantieriConclusi] = useState(false)
const [mostraDettaglioMateriali, setMostraDettaglioMateriali] = useState(false)
const [mostraDettaglioAttrezzi, setMostraDettaglioAttrezzi] = useState(false)
const [mostraCostiPresenze, setMostraCostiPresenze] = useState(false)
const [mostraRiepilogoOperai, setMostraRiepilogoOperai] = useState(true)
   const [cantieri, setCantieri] = useState<Cantiere[]>([])
  const [rapportini, setRapportini] = useState<Rapportino[]>([])
const [ordinaPreventiviCampo, setOrdinaPreventiviCampo] =
  useState('data')

const [ordinaPreventiviDirezione, setOrdinaPreventiviDirezione] =
  useState<'asc' | 'desc'>('desc')
const [ordinaRapportiniCampo, setOrdinaRapportiniCampo] =
  useState('data')

const [ordinaRapportiniDirezione, setOrdinaRapportiniDirezione] =
  useState<'asc' | 'desc'>('desc')
const [ordinaTimbratureCampo, setOrdinaTimbratureCampo] =
  useState('data')

const [ordinaTimbratureDirezione, setOrdinaTimbratureDirezione] =
  useState<'asc' | 'desc'>('desc')
const [ordinaPagamentiCampo, setOrdinaPagamentiCampo] =
  useState('data')

const [ordinaPagamentiDirezione, setOrdinaPagamentiDirezione] =
  useState<'asc' | 'desc'>('desc')
const [ordinaOperaiCampo, setOrdinaOperaiCampo] =
  useState('nome')

const [ordinaOperaiDirezione, setOrdinaOperaiDirezione] =
  useState<'asc' | 'desc'>('asc')





const [ricercaCantiereEconomia, setRicercaCantiereEconomia] =
  useState('')

const [mostraConclusiEconomia, setMostraConclusiEconomia] =
  useState(false)

const [ricercaCantiere, setRicercaCantiere] =
  useState('')
const [preventivoLavorazioni, setPreventivoLavorazioni] = useState<any[]>([])

const [ascoltoRapportino, setAscoltoRapportino] = useState(false)
const [testoVoceRapportino, setTestoVoceRapportino] = useState('')
const [recognitionRapportino, setRecognitionRapportino] = useState<any>(null)

const [ascoltoNoteFoto, setAscoltoNoteFoto] = useState(false)
const [recognitionNoteFoto, setRecognitionNoteFoto] =
  useState<any>(null)

const [ascoltoMateriali, setAscoltoMateriali] = useState(false)
const [recognitionMateriali, setRecognitionMateriali] = useState<any>(null)


  const [fotoCantiere, setFotoCantiere] = useState<FotoCantiere[]>([])
const [fotoDaCaricare, setFotoDaCaricare] = useState<string[]>([])
const [fotoSopralluogoSelezionate, setFotoSopralluogoSelezionate] =
  useState<string[]>([])



const [fotoFullscreen, setFotoFullscreen] = useState<FotoCantiere | null>(null)
const [geolocalizzazioneFoto, setGeolocalizzazioneFoto] = useState('')


  const [operaiAnagrafica, setOperaiAnagrafica] = useState<Operaio[]>([])
  const [timbrature, setTimbrature] = useState<Timbratura[]>([])
const [accontiCantiere, setAccontiCantiere] = useState<any[]>([])
const [fornitoreScadenza, setFornitoreScadenza] = useState('')
const [fornitoreImportoTotale, setFornitoreImportoTotale] = useState('')
const [fornitoreImportoPagato, setFornitoreImportoPagato] = useState('')
const [altezzaTabellaFatture, setAltezzaTabellaFatture] = useState(450)
const [pagineAperte, setPagineAperte] = useState<string[]>(() => {
  if (typeof window !== 'undefined') {
    const salvato = localStorage.getItem('artecna_pagine_aperte')
    return salvato ? JSON.parse(salvato) : []
  }
  return ['home']
})
useEffect(() => {
  localStorage.setItem('artecna_pagine_aperte', JSON.stringify(pagineAperte))
}, [pagineAperte])

useEffect(() => {
  const controllaMobile = () => {
    setIsMobile(window.innerWidth < 768)
  }

  controllaMobile()
  window.addEventListener('resize', controllaMobile)

  return () => window.removeEventListener('resize', controllaMobile)
}, [])


const [mostraPassword, setMostraPassword] = useState(false)
const [filePathAnalisi, setFilePathAnalisi] = useState<string | null>(null)
const [filtroFotoCantiere, setFiltroFotoCantiere] =
  useState('tutte')
const [filtroTimbratureDal, setFiltroTimbratureDal] = useState('')
const [filtroTimbratureAl, setFiltroTimbratureAl] = useState('')
const [filtroTimbratureCantiere, setFiltroTimbratureCantiere] = useState('')
const [filtroTimbratureOperaio, setFiltroTimbratureOperaio] = useState('')
const [fotoCantiereSelezionate, setFotoCantiereSelezionate] = useState<string[]>([])
const [categoriaFotoMultipla, setCategoriaFotoMultipla] = useState('durante')
const [temaApp, setTemaApp] = useState('scuro')

const [dataPresenzaManuale, setDataPresenzaManuale] = useState(
  new Date().toISOString().slice(0, 10)
)
const [operaioPresenzaManuale, setOperaioPresenzaManuale] = useState('')
const [cantierePresenzaManuale, setCantierePresenzaManuale] = useState('')
const [oraEntrataManuale, setOraEntrataManuale] = useState('')
const [oraUscitaManuale, setOraUscitaManuale] = useState('')
const [economiaDataDa, setEconomiaDataDa] = useState('')
const [economiaDataA, setEconomiaDataA] = useState('')

const [operaioRegistroEdit, setOperaioRegistroEdit] = useState<string | null>(null)
const [operaioRegistroNome, setOperaioRegistroNome] = useState('')
const [operaioRegistroTelefono, setOperaioRegistroTelefono] = useState('')
const [operaioRegistroQualifica, setOperaioRegistroQualifica] = useState('')
const [operaioRegistroCosto, setOperaioRegistroCosto] = useState('')

const [pagamentoOperaioRegistroEdit, setPagamentoOperaioRegistroEdit] = useState<string | null>
(null)

const [rapportinoRegistroEdit, setRapportinoRegistroEdit] = useState<string | null>(null)
const [rapportinoRegistroData, setRapportinoRegistroData] = useState('')
const [rapportinoRegistroCantiere, setRapportinoRegistroCantiere] = useState('')
const [rapportinoRegistroOperaio, setRapportinoRegistroOperaio] = useState('')
const [rapportinoRegistroOre, setRapportinoRegistroOre] = useState('')
const [rapportinoRegistroDescrizione, setRapportinoRegistroDescrizione] = useState('')

const [timbraturaRegistroEdit, setTimbraturaRegistroEdit] = useState<string | null>(null)
const [timbraturaRegistroData, setTimbraturaRegistroData] = useState('')
const [timbraturaRegistroOperaio, setTimbraturaRegistroOperaio] = useState('')
const [timbraturaRegistroCantiere, setTimbraturaRegistroCantiere] = useState('')
const [timbraturaRegistroEntrata, setTimbraturaRegistroEntrata] = useState('')
const [timbraturaRegistroUscita, setTimbraturaRegistroUscita] = useState('')
const [timbraturaRegistroOre, setTimbraturaRegistroOre] = useState('')


const [pagamentoOperaioRegistroNome, setPagamentoOperaioRegistroNome] = useState('')
const [pagamentoOperaioRegistroImporto, setPagamentoOperaioRegistroImporto] = useState('')
const [pagamentoOperaioRegistroData, setPagamentoOperaioRegistroData] = useState('')
const [pagamentoOperaioRegistroMetodo, setPagamentoOperaioRegistroMetodo] = useState('')
const [pagamentoOperaioRegistroNota, setPagamentoOperaioRegistroNota] = useState('')

const [salLavorazioni, setSalLavorazioni] = useState<any[]>([])
const [salCantiere, setSalCantiere] = useState('')
const [salDescrizione, setSalDescrizione] = useState('')
const [salImportoPrevisto, setSalImportoPrevisto] = useState('')
const [salPercentuale, setSalPercentuale] = useState('')
const [salNote, setSalNote] = useState('')
const [mostraConfrontoPdfSal, setMostraConfrontoPdfSal] = useState(false)
const [lavorazioneEditId, setLavorazioneEditId] = useState<number | null>(null)
const [lavorazioneEditDescrizione, setLavorazioneEditDescrizione] = useState('')
const [lavorazioneEditImporto, setLavorazioneEditImporto] = useState('')
  

const [pagamentiDataDa, setPagamentiDataDa] = useState('')
const [pagamentiDataA, setPagamentiDataA] = useState('')

const [pagamentiFornitori, setPagamentiFornitori] = useState<PagamentoFornitore[]>([])

const [fattureFornitori, setFattureFornitori] = useState<FatturaFornitore[]>([])
const [righeFatturaDaAssegnare, setRigheFatturaDaAssegnare] = useState<RigaFatturaDaAssegnare[]>([])

const [fatturaFornitore, setFatturaFornitore] = useState('')
const [fatturaPartitaIva, setFatturaPartitaIva] = useState('')
const [fatturaNumero, setFatturaNumero] = useState('')
const [fatturaData, setFatturaData] = useState('')
const [fatturaTotale, setFatturaTotale] = useState('')
const [fatturaNomeFile, setFatturaNomeFile] = useState('')
const [cantiereMassivoFattura, setCantiereMassivoFattura] = useState('')
const [categoriaMassivaFattura, setCategoriaMassivaFattura] = useState('')
const [fatturaTipoFile, setFatturaTipoFile] = useState('')
const [fatturaTestoOriginale, setFatturaTestoOriginale] = useState('')
const [filtroFattureFornitore, setFiltroFattureFornitore] = useState('')
const [filtroFattureStato, setFiltroFattureStato] = useState('')
const [fatturaApertaId, setFatturaApertaId] = useState<string | null>(null)
const [righeFatturaAperta, setRigheFatturaAperta] = useState<RigaFatturaFornitore[]>([])
const [filtroFattureCantiere, setFiltroFattureCantiere] = useState('')
const [filtroSpeseImpresa, setFiltroSpeseImpresa] = useState('')

const [fotoRapportinoAperte, setFotoRapportinoAperte] = useState<
  FotoCantiere[]
>([])

const [salFotoCantiere, setSalFotoCantiere] = useState('')
const [salFotoMese, setSalFotoMese] = useState(
  new Date().toISOString().slice(0, 7)
)





const [fornitoreNome, setFornitoreNome] = useState('')
const [fornitoreImporto, setFornitoreImporto] = useState('')
const [fornitoreData, setFornitoreData] = useState('')
const [fornitoreMetodo, setFornitoreMetodo] = useState('')
const [fornitoreNota, setFornitoreNota] = useState('')
const [apriChecklist, setApriChecklist] = useState(false)
const [mostraAcconti, setMostraAcconti] = useState(false)

const [registroTab, setRegistroTab] = useState('cantieri')
const [registroCerca, setRegistroCerca] = useState('')
const [registroFiltroNome, setRegistroFiltroNome] = useState('')
const [registroFiltroDataDa, setRegistroFiltroDataDa] = useState('')
const [registroFiltroDataA, setRegistroFiltroDataA] = useState('')

const [descrizioneAcconto, setDescrizioneAcconto] = useState('')
const [importoAcconto, setImportoAcconto] = useState('')
const [dataAcconto, setDataAcconto] = useState('')
const [metodoAcconto, setMetodoAcconto] = useState('')
const [notaAcconto, setNotaAcconto] = useState('')

const [prevDescrizione, setPrevDescrizione] = useState('')
const [prevImporto, setPrevImporto] = useState('')
const [prevQuantita, setPrevQuantita] = useState('')
const [prevPrezzoUnitario, setPrevPrezzoUnitario] = useState('')
const [prevUnita, setPrevUnita] = useState('')

const [filtroFattureEmesse, setFiltroFattureEmesse] = useState('')

const [fattureEmesse, setFattureEmesse] = useState<any[]>([])
const [ordineFattureEmesseCampo, setOrdineFattureEmesseCampo] =
  useState('data_fattura')

const [ordineFattureEmesseDirezione, setOrdineFattureEmesseDirezione] =
  useState<'asc' | 'desc'>('desc')
const [fatturaEmessaAperta, setFatturaEmessaAperta] =
  useState<any | null>(null)
const [speseImpresa, setSpeseImpresa] = useState<any[]>([])

const [popupFotoRapportino, setPopupFotoRapportino] = useState(false)
const [fotoRapportinoTemp, setFotoRapportinoTemp] = useState<string[]>([])
const [notaFotoRapportino, setNotaFotoRapportino] = useState('')

const [popupNuovaFatturaEmessa, setPopupNuovaFatturaEmessa] =
  useState(false)
const [tabellaSpeseImpresaAperta, setTabellaSpeseImpresaAperta] =
  useState(false)
const [ordineSpeseCampo, setOrdineSpeseCampo] =
  useState('categoria')


const [popupOperaiRapportino, setPopupOperaiRapportino] = useState(false)

const [operaiRapportinoTemp, setOperaiRapportinoTemp] = useState<
 {
  nome: string
  ora_inizio?: string
  ora_fine?: string
  ore: number
  costo_orario: number
}[]
>([])

const [popupFotoSopralluogo, setPopupFotoSopralluogo] =
  useState(false)

const [fotoSopralluogoTemp, setFotoSopralluogoTemp] =
  useState<string[]>([])

const [notaFotoSopralluogo, setNotaFotoSopralluogo] =
  useState('')

const [cameraSopralluogoAttiva, setCameraSopralluogoAttiva] =
  useState(false)

const webcamSopralluogoRef = useRef<Webcam>(null)

const [generazionePreventivoAiId, setGenerazionePreventivoAiId] =
  useState<string | null>(null)

const [ordineSpeseDirezione, setOrdineSpeseDirezione] =
  useState<'asc' | 'desc'>('asc')


const [ordineMaterialiCampo, setOrdineMaterialiCampo] =
  useState('data_documento')

const [ordineMaterialiDirezione, setOrdineMaterialiDirezione] =
  useState<'asc' | 'desc'>('desc')


const [ordineBilancioCampo, setOrdineBilancioCampo] =
  useState('nome')

const [ordineBilancioDirezione, setOrdineBilancioDirezione] =
  useState<'asc' | 'desc'>('asc')

const [ordineFattureCampo, setOrdineFattureCampo] =
  useState('fornitore')

const [ordineFattureDirezione, setOrdineFattureDirezione] =
  useState<'asc' | 'desc'>('asc')


const [nuovaFatturaEmessa, setNuovaFatturaEmessa] = useState<any>({
  numero_fattura: '',
  data_fattura: '',
  cliente: '',
  cantiere: '',
  imponibile: 0,
  iva: 22,
  totale: 0,
  importo_incassato: 0,
  stato: 'emessa',
  note: '',
})

const [mostraValutazioneFondi, setMostraValutazioneFondi] = useState(false)

const salvaAcconto = async () => {
  if (!cantiereScheda) return alert('Seleziona un cantiere')

  const importo = parseFloat(String(importoAcconto).replace(',', '.'))

  if (!importo || importo <= 0) {
    return alert('Importo non valido')
  }

  const { error } = await supabase.from('acconti_cantiere').insert([
    {
      cantiere: cantiereScheda,
      descrizione: descrizioneAcconto || 'Acconto',
      importo,
      data_incasso: dataAcconto || null,
      metodo: metodoAcconto,
      nota: notaAcconto,
    },
  ])

  if (error) {
    alert('Errore salvataggio acconto: ' + error.message)
    return
  }

  // reset campi
  setDescrizioneAcconto('')
  setImportoAcconto('')
  setDataAcconto('')
  setMetodoAcconto('')
  setNotaAcconto('')

  await caricaEconomia()

  alert('Acconto salvato')
}



const rilevaGeolocalizzazioneSopralluogo = async () => {
  if (!navigator.geolocation) {
    alert('Geolocalizzazione non supportata')
    return
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude
      const lng = position.coords.longitude

      try {
      
       const response = await fetch(
  `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=19&addressdetails=1`
)
        

        const data = await response.json()

       const a = data.address || {}

const via =
  a.road ||
  a.pedestrian ||
  a.footway ||
  a.path ||
  a.residential ||
  a.neighbourhood ||
  ''

const numero = a.house_number || ''
const citta =
  a.city ||
  a.town ||
  a.village ||
  a.municipality ||
  ''

const provincia =
  a.county &&
  a.county !== citta
    ? a.county
    : ''
const cap = a.postcode || ''

const indirizzoPulito = [
  [via, numero].filter(Boolean).join(', '),
  cap,
  citta,
  provincia,
]
  .filter(Boolean)
  .join(' - ')

const indirizzo =
  via
    ? indirizzoPulito
    : data.display_name ||
      `${cap} - ${citta} - posizione: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
        setIndirizzoSopralluogo(indirizzo)

        setGeolocalizzazioneSopralluogo(
          `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        )
      } catch {
        alert('Errore recupero indirizzo')
      }
    },
    () => {
      alert('Impossibile ottenere la posizione')
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    }
  )
}

const caricaUtilizzoAi = async () => {
  const { data, error } = await supabase
    .from('utilizzo_ai')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Errore caricamento utilizzo AI:', error.message)
    return
  }

  setUtilizzoAi(data || [])
}

const caricaPrezziarioSicilia = async () => {
  const { data, error } = await supabase
    .from('prezziario_sicilia')
    .select('*')
    .order('descrizione', { ascending: true })

  if (error) {
    alert('Errore caricamento prezzario Sicilia: ' + error.message)
    return
  }

  setPrezziarioSicilia(data || [])
}

const caricaSopralluoghi = async () => {
  const { data, error } = await supabase
    .from('sopralluoghi')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    alert('Errore caricamento sopralluoghi: ' + error.message)
    return
  }

  setSopralluoghi(data || [])
}


const caricaFotoSopralluoghi = async (sopralluogoId?: string) => {
  const id = sopralluogoId || sopralluogoAperto?.id
  if (!id) {
    setFotoSopralluoghi([])
    return
  }

  const { data, error } = await supabase
    .from('foto_sopralluogo')
    .select('id,sopralluogo_id,nota,immagine_base64,tag,includi_preventivo,created_at')
    .eq('sopralluogo_id', id)

  if (error) {
    alert(
      'Errore caricamento foto sopralluoghi: ' +
        error.message
    )
    return
  }

  const fotoOrdinate = [...(data || [])].sort((prima, seconda) =>
    String(seconda.created_at || '').localeCompare(String(prima.created_at || ''))
  )
  setFotoSopralluoghi(fotoOrdinate)
}



const eliminaSopralluogo = async (id?: string) => {
  if (!id) return

  const conferma = confirm(
    'Eliminare questo sopralluogo? Verranno eliminate anche le foto collegate.'
  )

  if (!conferma) return

  const { error } = await supabase
    .from('sopralluoghi')
    .delete()
    .eq('id', id)

  if (error) {
    alert('Errore eliminazione sopralluogo: ' + error.message)
    return
  }

  if (sopralluogoAperto?.id === id) {
    setSopralluogoAperto(null)
  }

  await caricaSopralluoghi()

  alert('Sopralluogo eliminato')
}




const generaVociAutomatiche = (
  s: Sopralluogo
) => {
  const testo =
    `${s.tipo_lavoro || ''} ${s.note || ''}`
      .toLowerCase()

  const voci: any[] = []

  if (
    testo.includes('bagno') ||
    testo.includes('doccia') ||
    testo.includes('infiltrazione')
  ) {
    voci.push({
      descrizione:
        'Demolizione pavimento e rivestimento bagno',
      quantita: 1,
      prezzo_unitario: 850,
    })

    voci.push({
      descrizione:
        'Impermeabilizzazione con guaina cementizia',
      quantita: 1,
      prezzo_unitario: 650,
    })

    voci.push({
      descrizione:
        'Posa pavimento e rivestimento',
      quantita: 1,
      prezzo_unitario: 1200,
    })
  }

  if (
    testo.includes('pittura') ||
    testo.includes('muffa')
  ) {
    voci.push({
      descrizione:
        'Raschiatura e trattamento antimuffa',
      quantita: 1,
      prezzo_unitario: 450,
    })

    voci.push({
      descrizione:
        'Tinteggiatura pareti',
      quantita: 1,
      prezzo_unitario: 700,
    })
  }

  if (
    testo.includes('terrazzo') ||
    testo.includes('guaina')
  ) {
    voci.push({
      descrizione:
        'Rimozione pavimentazione terrazzo',
      quantita: 1,
      prezzo_unitario: 1200,
    })

    voci.push({
      descrizione:
        'Nuova impermeabilizzazione terrazzo',
      quantita: 1,
      prezzo_unitario: 1800,
    })
  }

  return voci
}


const generaPreventivoAiDaSopralluogo = async (s: Sopralluogo) => {
  if (!s.id) {
    alert('Sopralluogo non valido')
    return false
  }

  const fotoDelSopralluogo = fotoSopralluoghi.filter(
    (f) => f.sopralluogo_id === s.id
  )
const { data: prezziRiferimento, error: errorePrezzi } =
  await supabase
    .from('prezzi_lavorazioni')
    .select('*')
    .limit(80)

if (errorePrezzi) {
  alert('Errore caricamento prezzi riferimento: ' + errorePrezzi.message)
  return false
}
  const response = await fetch('/api/genera-preventivo-ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sopralluogo: s,
      foto: fotoDelSopralluogo
  .slice(0, 4)
  .map((f) => ({
        nota: f.nota || '',
        immagine_base64: f.immagine_base64,
      })),
prezzi_riferimento: prezziRiferimento || [],
    }),
  })

  const risultato = await response.json()

  if (!response.ok) {
    alert('Errore AI: ' + risultato.error)
    return false
  }

const vociAi = (risultato.voci || []).map((voce: any) => {
  const prezzoTrovato = cercaPrezzoMigliore(
    voce.descrizione || ''
  )

  const prezzoBaseGrezzo = Number(
  prezzoTrovato?.prezzo_unitario || 0
)

const prezzoBase =
  prezzoBaseGrezzo >= 5
    ? prezzoBaseGrezzo
    : Number(voce.prezzo_unitario || 0)

const coefficienteImpresa = 1.25

const prezzoFinale =
  prezzoBase > 0
    ? prezzoBase * coefficienteImpresa
    : 0

  return {
    ...voce,

    prezzo_unitario: Number(
      prezzoFinale.toFixed(2)
    ),

    quantita: Number(voce.quantita || 1),

    unita_misura:
      voce.unita_misura ||
      prezzoTrovato?.unita_misura ||
      'a corpo',

    fonte_prezzo:
      prezzoTrovato?.fonte_prezzo ||
      prezzoTrovato?.fonte ||
      prezzoTrovato?.origine_prezzo ||
      'Da verificare',
  }
})

const totalePreventivoAi = vociAi.reduce(
  (tot: number, voce: any) =>
    tot +
    Number(voce.quantita || 0) *
      Number(voce.prezzo_unitario || 0),
  0
)

const { data: preventivoAiCreato, error: erroreSalvataggioAi } =
  await supabase
    .from('preventivi_cantiere')
    .insert([
      {
        cantiere: `${s.cliente} - ${s.tipo_lavoro || 'Preventivo AI'}`,

        cliente_ai: s.cliente || '',
        telefono_ai: s.telefono || '',
        indirizzo_ai: s.indirizzo || '',

        data_preventivo: new Date()
          .toISOString()
          .slice(0, 10),

        importo_totale: totalePreventivoAi,

        note:
          risultato.descrizione_intervento ||
          'Preventivo generato con AI da sopralluogo.',

        sopralluogo_id: s.id,

        nome_file:
          `Preventivo_AI_${s.cliente || 'sopralluogo'}`,

        origine_ai: true,

        stato_preventivo: 'bozza_ai',

        descrizione_ai:
          risultato.descrizione_intervento || '',

        json_voci_ai: vociAi,
      },
    ])
    .select()
    .single()


if (erroreSalvataggioAi) {
  alert(
    'Errore salvataggio preventivo AI: ' +
      erroreSalvataggioAi.message
  )
  return false
}

if (vociAi.length === 0) {
  alert('AI non ha generato voci')
  return false
}

setPreventivoAiGenerato(preventivoAiCreato)

setVociPreventivoAi(vociAi)
setDescrizionePreventivoAi(
  risultato.descrizione_intervento || ''
)

await caricaEconomia()

alert(
  `Preventivo AI salvato nel Registro preventivi con ${vociAi.length} voci`
)
return true
}

const miglioraVocePreventivoAi = async (
  index: number
) => {
console.log('CLICK AI', index)
  const voce = vociPreventivoAi[index]

  if (!voce) return

  try {
    const response = await fetch('/api/migliora-voce-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        descrizione: voce.descrizione,
      }),
    })

    const risultato = await response.json()

    if (!response.ok) {
      alert(risultato.error || 'Errore AI')
      return
    }

    const nuove = [...vociPreventivoAi]

    nuove[index].descrizione =
      risultato.descrizione || voce.descrizione

    if (risultato.prezzo_unitario) {
      nuove[index].prezzo_unitario =
        risultato.prezzo_unitario
    }

    setVociPreventivoAi(nuove)

    setMessaggioAi('✨ Voce aggiornata')

    setTimeout(() => {
      setMessaggioAi('')
    }, 2500)
 } catch (e: any) {
  console.error('Errore migliora voce:', e)
  setMessaggioAi('Errore aggiornamento voce')
}
}
const generaExcelDefinitivoPreventivoAi = async () => {
  if (vociPreventivoAi.length === 0) {
    alert('Nessuna voce da esportare')
    return
  }

  if (!preventivoAiGenerato) {
    alert('Preventivo AI non disponibile')
    return
  }

  const esportato = await generaExcelDaPreventivoAi(
    preventivoAiGenerato,
    vociPreventivoAi,
    descrizionePreventivoAi
  )

  if (esportato && preventivoAiGenerato.id) {
    await supabase
      .from('preventivi_cantiere')
      .update({
        stato_preventivo: 'definitivo_excel_generato',
        approvato: false,
      })
      .eq('id', preventivoAiGenerato.id)

    await caricaEconomia()
  }
  return

  /* Vecchio generatore definitivo disattivato: l'export usa il generatore comune. */
  /*
  const workbook = new ExcelJS.Workbook()
workbook.calcProperties.fullCalcOnLoad = true

  const templateResponse = await fetch('/templates/preventivo-template.xlsx')

  if (!templateResponse.ok) {
    alert('Template Excel non trovato')
    return
  }

  const arrayBuffer = await templateResponse.arrayBuffer()
  await workbook.xlsx.load(arrayBuffer)

 const worksheet = workbook.getWorksheet(1)

if (!worksheet) {
  alert('Foglio Excel non trovato')
  return
}

const ws = worksheet

ws.getCell('B10').value =
  preventivoAiGenerato?.cliente_ai ||
  preventivoAiGenerato?.cantiere ||
  ''

ws.getCell('E10').value =
  preventivoAiGenerato?.telefono_ai || ''

ws.getCell('B11').value =
  preventivoAiGenerato?.indirizzo_ai || ''

ws.getCell('E11').value =
  preventivoAiGenerato?.data_preventivo ||
  new Date().toLocaleDateString('it-IT')

ws.getCell('A15').value =
  `DESCRIZIONE INTERVENTO\n\n${descrizionePreventivoAi || ''}`
  let rigaExcel = 22
  let totalePreventivo = 0

const rigaFinePrimaPagina = 45
const righePerPaginaSuccessiva = 24
const distanzaTraPagine = 4

const creaIntestazioneComputo = (riga: number) => {
  ws.getCell(`A${riga}`).value = 'N'
  ws.getCell(`B${riga}`).value = 'Voce di capitolato'
  ws.getCell(`C${riga}`).value = 'UM'
  ws.getCell(`D${riga}`).value = 'Quantità'
  ws.getCell(`E${riga}`).value = 'Prezzo unitario'
  ws.getCell(`F${riga}`).value = 'Importo'

  for (const col of ['A', 'B', 'C', 'D', 'E', 'F']) {
    const cell = ws.getCell(`${col}${riga}`)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E79' },
    }
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }
  }

  ws.getRow(riga).height = 22
}

  vociPreventivoAi.forEach((voce: any, index: number) => {
    const quantita = Number(voce.quantita || 0)
    const prezzo = Number(voce.prezzo_unitario || 0)
    const totale = quantita * prezzo

   const umOriginale = String(voce.unita_misura || '').toLowerCase()

let um = 'a.c.'

if (
  umOriginale.includes('metro quadrato') ||
  umOriginale.includes('mq')
) {
  um = 'mq'
} else if (
  umOriginale.includes('metro lineare') ||
  umOriginale.includes('ml')
) {
  um = 'ml'
} else if (
  umOriginale.includes('metro cubo') ||
  umOriginale.includes('mc')
) {
  um = 'mc'
} else if (
  umOriginale.includes('pezzo') ||
  umOriginale.includes('pz')
) {
  um = 'pz'
} else if (
  umOriginale.includes('corpo') ||
  umOriginale.includes('intervento')
) {
  um = 'a.c.'
}

    totalePreventivo += totale

if (
  rigaExcel > rigaFinePrimaPagina &&
  (rigaExcel - rigaFinePrimaPagina - 1) %
    (righePerPaginaSuccessiva + distanzaTraPagine) ===
    0
) {
  rigaExcel += distanzaTraPagine
  creaIntestazioneComputo(rigaExcel)
  rigaExcel++
}

    ws.getCell(`A${rigaExcel}`).value = index + 1
    ws.getCell(`B${rigaExcel}`).value = voce.descrizione || ''
    ws.getCell(`C${rigaExcel}`).value = um
    ws.getCell(`D${rigaExcel}`).value = quantita
    ws.getCell(`E${rigaExcel}`).value = prezzo
   ws.getCell(`F${rigaExcel}`).value = {
  formula: `D${rigaExcel}*E${rigaExcel}`,
  result: totale,
}
ws.getCell(`F${rigaExcel}`).numFmt = '#,##0.00 €'
    ws.getRow(rigaExcel).height = Math.max(
      25,
      String(voce.descrizione || '').length * 0.35
    )

    rigaExcel++
  })

const rigaTotale = rigaExcel + 2

ws.getCell(`E${rigaTotale}`).value = 'TOTALE'
ws.getCell(`F${rigaTotale}`).value = {
  formula: `SUM(F22:F${rigaExcel - 1})`,
  result: totalePreventivo,
}

ws.getCell(`E${rigaTotale}`).font = { bold: true }
ws.getCell(`F${rigaTotale}`).font = { bold: true }

ws.getCell(`F${rigaTotale}`).numFmt = '#,##0.00 €'




  const buffer = await workbook.xlsx.writeBuffer()

  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

const nomeFile = String(
  preventivoAiGenerato?.cliente_ai ||
  preventivoAiGenerato?.nome_file ||
  preventivoAiGenerato?.cantiere ||
  'Cliente'
)
  .replace('Preventivo_AI_', '')
  .replace('Preventivo_', '')
  .split(' - ')[0]
  .replace(/[\\/:*?"<>|]/g, '')
  .trim()

saveAs(blob, `${nomeFile}.xlsx`)

if (preventivoAiGenerato?.id) {
  await supabase
    .from('preventivi_cantiere')
    .update({
      stato_preventivo: 'definitivo_excel_generato',
      approvato: false,
    })
    .eq('id', preventivoAiGenerato.id)

  await caricaEconomia()
}
}
  */
}

const generaExcelDaPreventivoAi = async (
  p: any,
  vociRevisionate?: any[],
  descrizioneRevisionata?: string
) => {
  try {
    const vociAi = vociRevisionate || p.json_voci_ai || []

    if (!vociAi.length) {
      alert('Nessuna voce AI trovata in questo preventivo')
      return false
    }

    const workbook = new ExcelJS.Workbook()
    workbook.calcProperties.fullCalcOnLoad = true

    const templateResponse = await fetch('/templates/preventivo-template.xlsx')

    if (!templateResponse.ok) {
      alert(
        'Template Excel non trovato. Controlla che il file sia in: public/templates/preventivo-template.xlsx'
      )
      return false
    }

    const arrayBuffer = await templateResponse.arrayBuffer()
    await workbook.xlsx.load(arrayBuffer)

    const worksheet = workbook.getWorksheet(1)

    if (!worksheet) {
      alert('Foglio Excel non trovato nel template')
      return false
    }

    const ws = worksheet

    ws.getCell('B10').value = ''
    ws.getCell('E10').value = ''
    ws.getCell('B11').value = ''
    ws.getCell('E11').value = ''

    ws.getCell('A15').value =
      `DESCRIZIONE INTERVENTO\n\n${
        descrizioneRevisionata ?? p.descrizione_ai ?? p.note ?? ''
      }`

    let rigaExcel = 22
    let totalePreventivo = 0

    vociAi.forEach((voce: any, index: number) => {
      const quantita = Number(voce.quantita || 0)
      const prezzo = Number(voce.prezzo_unitario || 0)
      const totale = quantita * prezzo

      const um =
        !voce.unita_misura ||
        String(voce.unita_misura).toLowerCase().includes('intervento')
          ? 'a corpo'
          : voce.unita_misura

      totalePreventivo += totale

      ws.getCell(`A${rigaExcel}`).value = index + 1
      ws.getCell(`B${rigaExcel}`).value = voce.descrizione || ''
      ws.getCell(`C${rigaExcel}`).value = um
      ws.getCell(`D${rigaExcel}`).value = quantita
      ws.getCell(`E${rigaExcel}`).value = prezzo

      ws.getCell(`F${rigaExcel}`).value = {
        formula: `D${rigaExcel}*E${rigaExcel}`,
        result: totale,
      }
      ws.getCell(`F${rigaExcel}`).numFmt = '#,##0.00 €'

      ws.getRow(rigaExcel).height = Math.max(
        25,
        String(voce.descrizione || '').length * 0.35
      )

      rigaExcel++
    })

    for (let r = rigaExcel; r <= 45; r++) {
      ws.getRow(r).hidden = true
    }

    ws.getCell('F48').value = {
      formula: `SUM(F22:F${rigaExcel - 1})`,
      result: totalePreventivo,
    }
    ws.getCell('F48').numFmt = '#,##0.00 €'

    const giorniStimati = Math.max(2, Math.ceil(vociAi.length * 1.5))

    const testoCronoprogramma =
      `Durata stimata lavori: circa ${giorniStimati} giorni lavorativi.

Le lavorazioni verranno eseguite secondo la seguente sequenza operativa:
- preparazione e protezione delle aree interessate
- eventuali demolizioni, rimozioni o saggi
- preparazione dei supporti
- posa dei materiali e realizzazione delle lavorazioni previste
- finiture, controllo finale e pulizia dell’area di lavoro.`

    const testoGaranzia =
      `ARTECNA garantisce le lavorazioni eseguite a regola d’arte e secondo le normative vigenti.

La garanzia copre esclusivamente eventuali difetti derivanti dall’esecuzione delle opere indicate nel presente preventivo.

Restano escluse problematiche dovute a supporti preesistenti, infiltrazioni pregresse, movimenti strutturali, materiali forniti dal committente o cause non rilevabili in fase di sopralluogo.`

    ws.getCell('A53').value = testoCronoprogramma

    // SCHEMA PAGAMENTI DINAMICO
    // Sblocca le celle unite del template, così gli importi possono diventare formule vere
    try {
      ws.unMergeCells('A59:F59')
      ws.unMergeCells('A60:F60')
      ws.unMergeCells('A61:F61')
      ws.unMergeCells('A62:F62')
      ws.unMergeCells('A63:F63')
    } catch (e) {
      console.warn('Alcune celle pagamenti non erano unite')
    }

    ws.getCell('A59').value = 'Acconto iniziale 30%'
    ws.getCell('F59').value = {
      formula: 'F48*0.30',
      result: totalePreventivo * 0.30,
    }
    ws.getCell('F59').numFmt = '#,##0.00 €'

    ws.getCell('A60').value = 'Stato avanzamento lavori 65%'
    ws.getCell('F60').value = {
      formula: 'F48*0.65',
      result: totalePreventivo * 0.65,
    }
    ws.getCell('F60').numFmt = '#,##0.00 €'

    ws.getCell('A61').value = 'Saldo finale 5% a fine lavori'
    ws.getCell('F61').value = {
      formula: 'F48*0.05',
      result: totalePreventivo * 0.05,
    }
    ws.getCell('F61').numFmt = '#,##0.00 €'

    ws.getCell('A63').value =
      'Pagamenti tramite bonifico bancario o modalità concordata.'

    ws.getCell('A65').value = testoGaranzia

    ws.getRow(53).height = Math.max(45, testoCronoprogramma.length * 0.35)
    ws.getRow(59).height = 24
    ws.getRow(60).height = 24
    ws.getRow(61).height = 24
    ws.getRow(63).height = 30
    ws.getRow(65).height = Math.max(45, testoGaranzia.length * 0.35)

    const buffer = await workbook.xlsx.writeBuffer()

    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const nomeFile = String(
      p.cliente_ai ||
        p.nome_file ||
        p.cantiere ||
        'Cliente'
    )
      .replace('Preventivo_AI_', '')
      .replace('Preventivo_', '')
      .split(' - ')[0]
      .replace(/[\\/:*?"<>|]/g, '')
      .trim()

    saveAs(blob, `${nomeFile}.xlsx`)
    return true
  } catch (errore: any) {
    console.error('Errore generazione Excel AI:', errore)
    alert(
      'Errore generazione Excel AI. Controlla che il file preventivo-template.xlsx sia dentro public/templates.'
    )
    return false
  }
}

const generaPreventivoDaSopralluogo = async (s: Sopralluogo) => {
  if (!s.id) {
    alert('Sopralluogo non valido')
    return
  }

  const nomeCantiere = `${s.cliente} - ${s.tipo_lavoro || 'Lavoro'}`
  const vociGenerate = generaVociAutomatiche(s)

  const descrizione = [s.tipo_lavoro, s.note, s.indirizzo]
    .filter(Boolean)
    .join('\n\n')

  const totalePreventivo = vociGenerate.reduce(
    (tot, voce) =>
      tot + Number(voce.quantita || 0) * Number(voce.prezzo_unitario || 0),
    0
  )

  const { data, error } = await supabase
    .from('preventivi_cantiere')
    .insert([
      {
        cantiere: nomeCantiere,
        importo_totale: totalePreventivo,
        note: descrizione,
        sopralluogo_id: s.id,
        nome_file: `Preventivo_${s.cliente}`,
      },
    ])
    .select()
    .single()

  if (error) {
    alert('Errore creazione preventivo: ' + error.message)
    return
  }

  setPreventivoGeneratoId(data?.id || null)

  for (const voce of vociGenerate) {
    await supabase.from('preventivo_lavorazioni').insert({
      cantiere: nomeCantiere,
      descrizione: voce.descrizione,
      quantita: voce.quantita,
      prezzo_unitario: voce.prezzo_unitario,
      importo_previsto:
        Number(voce.quantita || 0) *
        Number(voce.prezzo_unitario || 0),
    })
  }

  const workbook = new ExcelJS.Workbook()
workbook.calcProperties.fullCalcOnLoad = true


  const response = await fetch('/templates/preventivo-template.xlsx')

  if (!response.ok) {
    alert('Template Excel non trovato in /public/templates/preventivo-template.xlsx')
    return
  }

  const arrayBuffer = await response.arrayBuffer()

  await workbook.xlsx.load(arrayBuffer)

  const worksheet = workbook.getWorksheet(1)

if (!worksheet) {
  alert('Foglio Excel non trovato')
  return
}

const ws = worksheet

 // DATI CLIENTE

ws.getCell('B10').value = s.cliente || ''

ws.getCell('E10').value = s.telefono || ''

ws.getCell('B11').value = s.indirizzo || ''

ws.getCell('E11').value =
  s.data_sopralluogo || ''

ws.getCell('B12').value =
  s.tipo_lavoro || ''


// NOTE SOPRALLUOGO

ws.getCell('A15').value =
  `DESCRIZIONE INTERVENTO / NOTE SOPRALLUOGO\n\n${s.note || ''}`


// RIGHE COMPUTO

let rigaExcel = 22

  vociGenerate.forEach((voce, index) => {
    const quantita = Number(voce.quantita || 0)
    const prezzo = Number(voce.prezzo_unitario || 0)
    const totale = quantita * prezzo

    ws.getCell(`A${rigaExcel}`).value = index + 1
    ws.getCell(`B${rigaExcel}`).value = voce.descrizione
    ws.getCell(`C${rigaExcel}`).value = 'cad'
    ws.getCell(`D${rigaExcel}`).value = quantita
    ws.getCell(`E${rigaExcel}`).value = prezzo
   ws.getCell(`F${rigaExcel}`).value = {
  formula: `D${rigaExcel}*E${rigaExcel}`,
  result: totale,
}
ws.getCell(`F${rigaExcel}`).numFmt = '#,##0.00 €'
    rigaExcel++
  })

  ws.getCell('F48').value = {
  formula: `SUM(F22:F${rigaExcel - 1})`,
  result: totalePreventivo,
}

  const buffer = await workbook.xlsx.writeBuffer()

  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  saveAs(
    blob,
    `Preventivo_${s.cliente || 'sopralluogo'}_${s.tipo_lavoro || 'lavoro'}.xlsx`
  )

  await caricaEconomia()
  await caricaPreventivoLavorazioni()

  await supabase
    .from('sopralluoghi')
    .update({
      stato: 'preventivo_creato',
    })
    .eq('id', s.id)

  await caricaSopralluoghi()

  alert('Preventivo creato')
}


const convertiSopralluogoInCantiere = async (s: Sopralluogo) => {
  if (!s.cliente?.trim()) {
    alert('Cliente non valido')
    return
  }

  const nomeCantiere = `${s.cliente} - ${s.tipo_lavoro || 'Lavoro'}`

  const { error } = await supabase.from('cantieri').insert([
    {
      nome: nomeCantiere,
      preventivo: 0,
      data_inizio_lavori: null,
      data_fine_lavori: null,
      lavori_conclusi: false,
    },
  ])

  if (error) {
    alert('Errore conversione in cantiere: ' + error.message)
    return
  }

  await supabase
    .from('sopralluoghi')
    .update({ stato: 'convertito_in_cantiere' })
    .eq('id', s.id)

  await caricaCantieri()
  await caricaSopralluoghi()

  setSopralluogoAperto(null)

  alert('Sopralluogo convertito in cantiere')
}



const salvaFotoSopralluogo = async () => {
  if (!sopralluogoAperto?.id) {
    alert('Apri un sopralluogo')
    return { salvate: 0, fallite: fotoSopralluogoTemp.length }
  }

  if (fotoSopralluogoTemp.length === 0) {
    return { salvate: 0, fallite: 0 }
  }

  const codaDaSalvare = fotoSopralluogoTemp
  const righe = codaDaSalvare.map((img) => ({
    sopralluogo_id: sopralluogoAperto.id,
    immagine_base64: img,
    nota: notaFotoSopralluogo,
    includi_preventivo: true,
  }))

  const { data, error } = await supabase
    .from('foto_sopralluogo')
    .insert(righe)
    .select('id,sopralluogo_id,nota,tag,includi_preventivo,created_at')

  if (error) {
    return { salvate: 0, fallite: codaDaSalvare.length }
  }

  const nuoveFoto: FotoSopralluogo[] = (data || []).map((foto, indice) => ({
    ...foto,
    immagine_base64: codaDaSalvare[indice],
  }))

  setFotoSopralluoghi((correnti) => [...nuoveFoto.reverse(), ...correnti])
  setFotoSopralluogoTemp([])
  setNotaFotoSopralluogo('')

  return { salvate: codaDaSalvare.length, fallite: 0 }
}



const salvaSopralluogo = async () => {
  if (!clienteSopralluogo.trim()) {
    alert('Inserisci almeno il nome cliente')
    return
  }

if (sopralluogoModificaId) {
  const { error } = await supabase
    .from('sopralluoghi')
    .update({
      cliente: clienteSopralluogo,
      telefono: telefonoSopralluogo,
      indirizzo: indirizzoSopralluogo,
      geolocalizzazione: geolocalizzazioneSopralluogo,
      data_sopralluogo: dataSopralluogo,
      ora_appuntamento: oraSopralluogo,
      tipo_lavoro: tipoLavoroSopralluogo,
      note: noteSopralluogo,
      promemoria: promemoriaSopralluogo,
    })
    .eq('id', sopralluogoModificaId)

  if (error) {
    alert('Errore modifica sopralluogo: ' + error.message)
    return
  }

  setSopralluogoModificaId(null)

  setClienteSopralluogo('')
  setTelefonoSopralluogo('')
  setIndirizzoSopralluogo('')
  setGeolocalizzazioneSopralluogo('')
  setTipoLavoroSopralluogo('')
  setNoteSopralluogo('')
  setPromemoriaSopralluogo('')

  await caricaSopralluoghi()

  alert('Sopralluogo modificato')
  return
}

  const { error } = await supabase.from('sopralluoghi').insert([
    {
      cliente: clienteSopralluogo,
  telefono: telefonoSopralluogo,
  indirizzo: indirizzoSopralluogo,
  geolocalizzazione: geolocalizzazioneSopralluogo,
  data_sopralluogo: dataSopralluogo,
  ora_appuntamento: oraSopralluogo,
  promemoria: promemoriaSopralluogo,
  tipo_lavoro: tipoLavoroSopralluogo,
  note: noteSopralluogo,
  stato: 'da_preventivare',
    },
  ])

  if (error) {
    alert('Errore salvataggio sopralluogo: ' + error.message)
    return
  }

  setClienteSopralluogo('')
setTelefonoSopralluogo('')
setIndirizzoSopralluogo('')
setTipoLavoroSopralluogo('')
setNoteSopralluogo('')
setDataSopralluogo(new Date().toISOString().slice(0, 10))

setOraSopralluogo('')
setPromemoriaSopralluogo('')


  await caricaSopralluoghi()

  alert('Sopralluogo salvato')
}


const caricaSalLavorazioni = async () => {
  const { data, error } = await supabase
    .from('sal_lavorazioni')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Errore caricamento SAL:', error.message)
    return
  }

  setSalLavorazioni(data || [])
}

const caricaPreventivoLavorazioni = async () => {
  const { data, error } = await supabase
    .from('preventivo_lavorazioni')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Errore caricamento lavorazioni preventivo:', error.message)
    return
  }

  setPreventivoLavorazioni(data || [])
}

const salvaSalLavorazione = async () => {
  if (!salCantiere) {
    alert('Seleziona un cantiere')
    return
  }

  if (!salDescrizione.trim()) {
    alert('Inserisci la descrizione della lavorazione')
    return
  }

  const importoPrevisto = parseImporto(salImportoPrevisto)
  const percentuale = parseImporto(salPercentuale)
  const importoMaturato = (importoPrevisto * percentuale) / 100

  const { error } = await supabase.from('sal_lavorazioni').insert({
    cantiere: salCantiere,
    descrizione: salDescrizione.trim(),
    importo_previsto: importoPrevisto,
    percentuale,
    importo_maturato: importoMaturato,
    completata: percentuale >= 100,
    note: salNote.trim() || null,
    data_aggiornamento: new Date().toISOString().slice(0, 10),
  })

  if (error) {
    alert('Errore salvataggio SAL: ' + error.message)
    return
  }

  setSalDescrizione('')
  setSalImportoPrevisto('')
  setSalPercentuale('')
  setSalNote('')

  await caricaSalLavorazioni()
}


const eliminaMaterialeCantiere = async (id?: string) => {
  if (!id) return

  const conferma = confirm('Eliminare questa riga materiale?')
  if (!conferma) return

  const { error } = await supabase
    .from('materiali_cantiere')
    .delete()
    .eq('id', id)

  if (error) {
    alert('Errore eliminazione materiale: ' + error.message)
    return
  }

  await caricaEconomia()

  alert('Riga materiale eliminata')
}

const eliminaSalLavorazione = async (id: number) => {
  const conferma = confirm('Eliminare questa lavorazione SAL?')

  if (!conferma) return

  const { error } = await supabase
    .from('sal_lavorazioni')
    .delete()
    .eq('id', id)

  if (error) {
    alert('Errore eliminazione SAL: ' + error.message)
    return
  }

  await caricaSalLavorazioni()
}

const salvaLavorazionePreventivo = async () => {
  if (!salCantiere) {
    alert('Seleziona un cantiere')
    return
  }

  if (!prevDescrizione.trim()) {
    alert('Inserisci descrizione')
    return
  }

  const importo =
    parseImporto(prevImporto) ||
    parseImporto(prevQuantita) * parseImporto(prevPrezzoUnitario)

  const { error } = await supabase.from('preventivo_lavorazioni').insert({
    cantiere: salCantiere,
    descrizione: prevDescrizione,
    importo_previsto: importo,
    quantita: parseImporto(prevQuantita),
    prezzo_unitario: parseImporto(prevPrezzoUnitario),
    unita_misura: prevUnita || null,
  })

  if (error) {
  alert('Errore salvataggio: ' + error.message)
  return
}

setPrevDescrizione('')
setPrevImporto('')
setPrevQuantita('')
setPrevPrezzoUnitario('')
setPrevUnita('')

await caricaPreventivoLavorazioni()

alert('Lavorazione preventivo salvata')

}


const caricaPagamentiFornitori = async () => {
  const { data, error } = await supabase
    .from('pagamenti_fornitori')
    .select('*')
    .order('data_scadenza', { ascending: true })

  if (error) {
    alert('Errore caricamento fornitori: ' + error.message)
    return
  }

  setPagamentiFornitori((data || []) as PagamentoFornitore[])
}

const testoXml = (doc: Document, tag: string) => {
  return doc.getElementsByTagName(tag)[0]?.textContent?.trim() || ''
}

const numeroXml = (valore: string) => {
  const pulito = valore.replace(',', '.').replace(/[^\d.-]/g, '')
  const numero = Number(pulito)
  return Number.isFinite(numero) ? numero : 0
}

const caricaFatturaXml = async (file: File) => {
  try {
    const testo = await file.text()
    const parser = new DOMParser()
    const xml = parser.parseFromString(testo, 'text/xml')

    const erroreParser = xml.getElementsByTagName('parsererror')[0]
    if (erroreParser) {
      alert('Il file XML non sembra valido.')
      return
    }
    const cedente = xml.getElementsByTagName('CedentePrestatore')[0]
    const datiAnagrafici = cedente?.getElementsByTagName('DatiAnagrafici')[0]
    const idFiscaleIva = datiAnagrafici?.getElementsByTagName('IdFiscaleIVA')[0]

    const partitaIva =
      idFiscaleIva?.getElementsByTagName('IdCodice')[0]?.textContent?.trim() || ''

    const denominazione =
      datiAnagrafici?.getElementsByTagName('Denominazione')[0]?.textContent?.trim() ||
      datiAnagrafici?.getElementsByTagName('Nome')[0]?.textContent?.trim() ||
      ''

    const datiGeneraliDocumento = xml.getElementsByTagName('DatiGeneraliDocumento')[0]

    const numeroFattura =
      datiGeneraliDocumento?.getElementsByTagName('Numero')[0]?.textContent?.trim() || ''

    const dataFattura =
      datiGeneraliDocumento?.getElementsByTagName('Data')[0]?.textContent?.trim() || ''

    const importoTotale =
      datiGeneraliDocumento?.getElementsByTagName('ImportoTotaleDocumento')[0]?.textContent?.trim() ||
      ''

    const dettaglioLinee = Array.from(xml.getElementsByTagName('DettaglioLinee'))

    const righe = dettaglioLinee.map((riga, index) => {
      const numeroLinea = Number(
        riga.getElementsByTagName('NumeroLinea')[0]?.textContent?.trim() || index + 1
      )

      const descrizione =
        riga.getElementsByTagName('Descrizione')[0]?.textContent?.trim() || ''

      const quantita = numeroXml(
        riga.getElementsByTagName('Quantita')[0]?.textContent?.trim() || '1'
      )

      const prezzoUnitario = numeroXml(
        riga.getElementsByTagName('PrezzoUnitario')[0]?.textContent?.trim() || '0'
      )

      const prezzoTotale = numeroXml(
        riga.getElementsByTagName('PrezzoTotale')[0]?.textContent?.trim() || '0'
      )

const aliquotaIva = numeroXml(
  riga.getElementsByTagName('AliquotaIVA')[0]?.textContent?.trim() || '0'
)

const ivaRiga =
  Math.round((prezzoTotale * aliquotaIva / 100) * 100) / 100

const totaleIvato =
  Math.round((prezzoTotale + ivaRiga) * 100) / 100



      return {
        numero_riga: numeroLinea,
        descrizione,
        quantita,
        prezzo_unitario: prezzoUnitario,
        totale_riga: prezzoTotale,
        cantiere: '',
      }
    })

    setFatturaFornitore(denominazione)
    setFatturaPartitaIva(partitaIva)
    setFatturaNumero(numeroFattura)
    setFatturaData(dataFattura)
    setFatturaTotale(importoTotale)
    setFatturaNomeFile(file.name)
    setFatturaTipoFile('xml')
    setFatturaTestoOriginale(testo)
    setRigheFatturaDaAssegnare(righe)

    alert(`Fattura XML caricata. Righe trovate: ${righe.length}`)
  } catch (errore) {
    console.error(errore)
    alert('Errore durante la lettura della fattura XML.')
  }
}


const estraiRigheDaTestoPdf = (testo: string) => {
  const righe = testo
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean)

  const risultati: RigaFatturaDaAssegnare[] = []

  righe.forEach((riga) => {
    const rigaBassa = riga.toLowerCase()

    if (
      rigaBassa.includes('partita iva') ||
      rigaBassa.includes('codice fiscale') ||
      rigaBassa.includes('telefono') ||
      rigaBassa.includes('email') ||
      rigaBassa.includes('documento') ||
      rigaBassa.includes('totale documento') ||
      rigaBassa.includes('imponibile') ||
      rigaBassa.includes('iva') ||
      rigaBassa.includes('pagamento') ||
      rigaBassa.includes('indirizzo') ||
      rigaBassa.includes('esigibilità') ||
      rigaBassa.includes('esigibilita') ||
      rigaBassa.includes('immediata') ||
      rigaBassa.includes('bonifico') ||
      rigaBassa.includes('iban') ||
      rigaBassa.includes('scadenza') ||
      rigaBassa.includes('totale') ||
      rigaBassa.includes('imposta') ||
      rigaBassa.includes('ritenuta') ||
      rigaBassa.includes('arrotondamento')
    ) {
      return
    }

    const numeri = riga.match(/\d+,\d{2}/g)
    if (!numeri || numeri.length === 0) return

    const totaleStringa = numeri[numeri.length - 1]
    const totaleImponibile =
      Number(totaleStringa.replace(/\./g, '').replace(',', '.')) || 0

    if (totaleImponibile <= 0) return

    let descrizione = riga

    descrizione = descrizione.replace(/^\d+\s+/, '')
    descrizione = descrizione.replace(/\d+,\d{2}.*$/g, '')
    descrizione = descrizione.replace(/\s+/g, ' ').trim()

    if (descrizione.length < 4) return

    const matchCompleto = riga.match(
  /(\d+,\d+)\s+(\d+,\d+)\s+(nr|pz|mt|kg|lt|cf|mq|mc)\s+(\d+,\d+)\s+(\d+,\d+)$/i
)

let quantita = 1
let prezzoNetto = totaleImponibile
let um = '-'
let aliquotaIva = 22
let totaleConIva =
  Math.round((totaleImponibile * (1 + aliquotaIva / 100)) * 100) / 100

if (matchCompleto) {
  quantita = Number(matchCompleto[1].replace(',', '.')) || 1

  prezzoNetto =
    Number(matchCompleto[2].replace(',', '.')) || totaleImponibile

  um = matchCompleto[3]

  aliquotaIva =
    Number(matchCompleto[4].replace(',', '.')) || 22

  const totaleNetto =
    Number(matchCompleto[5].replace(',', '.')) || totaleImponibile

  totaleConIva =
    Math.round((totaleNetto * (1 + aliquotaIva / 100)) * 100) / 100
}

   risultati.push({
  numero_riga: risultati.length + 1,
  descrizione,
  quantita,
  prezzo_unitario: prezzoNetto,
  unita_misura: um,
  aliquota_iva: aliquotaIva,
  totale_riga: totaleConIva,
  cantiere: '',
})
  })

  return risultati
}


const estraiTotaleDocumentoPdf = (testo: string) => {
  const righe = testo
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean)

  const rigaTotale = righe.find((r) => {
    const b = r.toLowerCase()
    return (
      b.includes('totale documento') ||
      b.includes('totale fattura') ||
      b.includes('totale da pagare')
    )
  })

  if (!rigaTotale) return 0

  const numeri = rigaTotale.match(/\d+,\d{2}/g) || []
  const ultimo = numeri[numeri.length - 1]

  return ultimo ? Number(ultimo.replace(/\./g, '').replace(',', '.')) || 0 : 0
}


const caricaFatturaPdf = async (file: File) => {
  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

    const buffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

    let testoCompleto = ''

    for (let pagina = 1; pagina <= pdf.numPages; pagina++) {
      const page = await pdf.getPage(pagina)

      const viewport = page.getViewport({ scale: 2 })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) continue

      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({
  canvas,
  canvasContext: context,
  viewport,
}).promise

      const image = canvas.toDataURL('image/png')

      const risultato = await Tesseract.recognize(
        image,
        'ita'
      )

      testoCompleto += risultato.data.text + '\n'
    }

    console.log('TESTO OCR PDF:', testoCompleto)

    setFatturaNomeFile(file.name)
    setFatturaTipoFile('pdf')
    setFatturaTestoOriginale(testoCompleto)

const righePdf = estraiRigheDaTestoPdf(testoCompleto)

setRigheFatturaDaAssegnare(righePdf)
const matchFornitore = testoCompleto.match(
  /Denominazione:\s*(.+)/i
)

const fornitoreEstratto = matchFornitore
  ? matchFornitore[1].trim()
  : 'Fornitore da PDF'
setFatturaFornitore(fornitoreEstratto)
setFatturaNumero(file.name)
setFatturaData(new Date().toISOString().slice(0, 10))
const totaleDocumentoPdf = estraiTotaleDocumentoPdf(testoCompleto)

setFatturaTotale(
  String(
    totaleDocumentoPdf > 0
      ? totaleDocumentoPdf
      : righePdf.reduce((tot, r) => tot + r.totale_riga, 0)
  )
)
    alert('PDF elaborato con OCR.')
  } catch (errore) {
    console.error(errore)
    alert('Errore OCR PDF.')
  }
}



const caricaSpeseImpresa = async () => {
  const { data, error } = await supabase
    .from('spese_impresa')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Errore caricamento spese impresa:', error.message)
    return
  }

  setSpeseImpresa(data || [])
}





const caricaFattureFornitori = async () => {
  const { data, error } = await supabase
    .from('fatture_fornitori')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error(error)
    return
  }

  setFattureFornitori(data || [])
}

const caricaFattureEmesse = async () => {
  const { data, error } = await supabase
    .from('fatture_emesse')
    .select('*')
    .order('data_fattura', { ascending: false })

  if (error) {
    console.error(error)
    return
  }

  setFattureEmesse(data || [])
}


const caricaIncassiNonFatturati = async () => {
  const { data, error } = await supabase
    .from('incassi_non_fatturati')
    .select('*')
    .order('data_incasso', { ascending: false })

  if (error) {
    console.error(error)
    return
  }

  setIncassiNonFatturati(data || [])
}

const salvaIncassoNonFatturato = async () => {
  const { error } = await supabase
    .from('incassi_non_fatturati')
    .insert([
      {
        data_incasso: nuovoIncassoNonFatturato.data_incasso || null,
        cliente: nuovoIncassoNonFatturato.cliente || '',
        cantiere: nuovoIncassoNonFatturato.cantiere || '',
        descrizione: nuovoIncassoNonFatturato.descrizione || '',
        importo: Number(nuovoIncassoNonFatturato.importo || 0),
        metodo: nuovoIncassoNonFatturato.metodo || '',
        note: nuovoIncassoNonFatturato.note || '',
        stato: 'non_fatturato',
      },
    ])

  if (error) {
    alert('Errore salvataggio incasso: ' + error.message)
    return
  }

  await caricaIncassiNonFatturati()

  setNuovoIncassoNonFatturato({
    data_incasso: '',
    cliente: '',
    cantiere: '',
    descrizione: '',
    importo: 0,
    metodo: '',
    note: '',
  })

  setPopupIncassoNonFatturato(false)

  alert('Incasso non fatturato salvato')
}


const salvaNuovaFatturaEmessa = async () => {
  const totale =
    Number(nuovaFatturaEmessa.imponibile || 0) +
    (Number(nuovaFatturaEmessa.imponibile || 0) *
      Number(nuovaFatturaEmessa.iva || 0)) /
      100

  const { error } = await supabase
    .from('fatture_emesse')
    .insert([
      {
        numero_fattura:
          nuovaFatturaEmessa.numero_fattura,

        data_fattura:
          nuovaFatturaEmessa.data_fattura,

        cliente:
          nuovaFatturaEmessa.cliente,

        cantiere:
          nuovaFatturaEmessa.cantiere,

        imponibile: Number(
          nuovaFatturaEmessa.imponibile || 0
        ),

        iva: Number(
          nuovaFatturaEmessa.iva || 0
        ),

        totale,

        importo_incassato: Number(
          nuovaFatturaEmessa.importo_incassato || 0
        ),

        stato:
  Number(nuovaFatturaEmessa.importo_incassato || 0) <= 0
    ? 'emessa'
    : Number(nuovaFatturaEmessa.importo_incassato || 0) >= totale
    ? 'incassata'
    : 'parziale',

        note:
          nuovaFatturaEmessa.note || '',
      },
    ])

  if (error) {
    alert(
      'Errore salvataggio fattura: ' +
        error.message
    )
    return
  }

  await caricaFattureEmesse()

  setPopupNuovaFatturaEmessa(false)

  alert('Fattura emessa salvata')
}

const caricaFatturaEmessaXml = async (
  file: File
) => {
  try {
    const testo = await file.text()
 const nomePulito = file.name
  .replace(/\.[^/.]+$/, '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9_-]/g, '_')
  .replace(/_+/g, '_')
  .replace(/^_+|_+$/g, '')

const filePath = `fatture-emesse/xml/${Date.now()}_${nomePulito}.xml`

const { error: uploadError } = await supabase.storage
  .from('preventivi')
  .upload(filePath, file)

if (uploadError) {
  alert('Errore upload XML: ' + uploadError.message)
  return
}

const { data: publicData } = supabase.storage
  .from('preventivi')
  .getPublicUrl(filePath)

const xmlUrl = publicData.publicUrl


    const parser = new DOMParser()

    const xml = parser.parseFromString(
      testo,
      'text/xml'
    )

    const leggi = (tag: string) =>
      xml.getElementsByTagName(tag)?.[0]
        ?.textContent || ''

    const numero = leggi('Numero')

    const data = leggi('Data')

    const totale = Number(
      leggi('ImportoTotaleDocumento') || 0
    )

    const imponibile = Number(
      leggi('ImponibileImporto') || 0
    )

    const iva = Number(
      leggi('Imposta') || 0
    )

    const nome =
      leggi('Nome') || ''

    const cognome =
      leggi('Cognome') || ''

    const cliente = `${nome} ${cognome}`.trim()

    const scadenza = leggi(
      'DataScadenzaPagamento'
    )

    const pagamento = leggi(
      'ModalitaPagamento'
    )

  const annoFattura = String(data || '').slice(0, 4)

const { data: esistente } = await supabase
  .from('fatture_emesse')
  .select('id, numero_fattura, data_fattura')
  .eq('numero_fattura', numero)
  .gte('data_fattura', `${annoFattura}-01-01`)
  .lte('data_fattura', `${annoFattura}-12-31`)
  .limit(1)

   if (esistente && esistente.length > 0) {
  const { error: updateError } = await supabase
    .from('fatture_emesse')
    .update({
      xml_url: xmlUrl,
    })
    .eq('id', esistente[0].id)

  if (updateError) {
    alert('Errore aggiornamento XML: ' + updateError.message)
    return
  }

  await caricaFattureEmesse()

  console.log('XML collegato a fattura già presente:', numero)
  return
}

    const { error } = await supabase
      .from('fatture_emesse')
      .insert([
        {
          numero_fattura: numero,
          data_fattura: data,
          cliente,
          imponibile,
          iva,
          totale,
          importo_incassato: 0,
          stato: 'emessa',
xml_url: xmlUrl,
          note:
            `Import XML Bluenext\n` +
            `Scadenza: ${scadenza}\n` +
            `Pagamento: ${pagamento}`,
        },
      ])

    if (error) {
      alert(
        'Errore import fattura: ' +
          error.message
      )
      return
    }

    await caricaFattureEmesse()

    console.log(
      'Fattura emessa importata:',
      numero
    )
  } catch (err) {
    console.error(err)

    alert(
      'Errore lettura XML fattura emessa'
    )
  }
}



const caricaFatturaEmessaPdf = async (
  file: File
) => {
  try {
    const nomePulito = file.name
      .replace(/\.[^/.]+$/, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')

    const filePath =
      `fatture-emesse/pdf/${Date.now()}_${nomePulito}.pdf`

    const { error: uploadError } =
      await supabase.storage
        .from('preventivi')
        .upload(filePath, file)

    if (uploadError) {
      alert(
        'Errore upload PDF: ' +
          uploadError.message
      )
      return
    }

    const { data: publicData } =
      supabase.storage
        .from('preventivi')
        .getPublicUrl(filePath)

    const pdfUrl = publicData.publicUrl

   const nomeSenzaEstensione = file.name.replace(/\.[^/.]+$/, '')

const partiNome = nomeSenzaEstensione.split('_')

const numeroEstratto =
  partiNome.length >= 2
    ? partiNome[1]
    : file.name.match(/\d+/)?.[0] || ''


alert('PDF letto: ' + file.name + '\nNumero estratto: ' + numeroEstratto)

    if (!numeroEstratto) {
      console.log(
        'Numero fattura non trovato nel PDF'
      )
      return
    }

    const { data: esistente } =
      await supabase
        .from('fatture_emesse')
        .select('id')
        .ilike(
          'numero_fattura',
          `%${numeroEstratto}%`
        )
        .limit(1)

    if (
      !esistente ||
      esistente.length === 0
    ) {
      console.log(
        'Nessuna fattura trovata per PDF:',
        numeroEstratto
      )
      return
    }

    const { error: updateError } =
      await supabase
        .from('fatture_emesse')
        .update({
          pdf_url: pdfUrl,
        })
        .eq('id', esistente[0].id)

    if (updateError) {
      alert(
        'Errore collegamento PDF: ' +
          updateError.message
      )
      return
    }

    await caricaFattureEmesse()

    console.log(
      'PDF collegato:',
      numeroEstratto
    )
  } catch (err) {
    console.error(err)

    alert(
      'Errore import PDF fattura emessa'
    )
  }
}

const approvaPreventivoAiECreaCantiere = async (p: any) => {
  const oggi = new Date().toISOString().slice(0, 10)

  const { error: errorePreventivo } = await supabase
    .from('preventivi_cantiere')
    .update({
      approvato: true,
      stato_preventivo: 'approvato',
      data_approvazione: oggi,
    })
    .eq('id', p.id)

  if (errorePreventivo) {
    alert('Errore approvazione preventivo: ' + errorePreventivo.message)
    return
  }

  const { error: erroreCantiere } = await supabase
    .from('cantieri')
    .insert([
      {
        nome: p.cantiere,
        preventivo: p.importo_totale || 0,
        data_inizio_lavori: oggi,
        origine_preventivo_id: p.id,
        lavori_conclusi: false,
      },
    ])

  if (erroreCantiere) {
    alert('Errore creazione cantiere: ' + erroreCantiere.message)
    return
  }

  await caricaCantieri()
  await caricaEconomia()

  alert('Preventivo approvato e cantiere creato')
}


const apriPreventivoAiGeneratoInModifica = () => {
  if (!preventivoAiGenerato) return

  setSezioneAttiva('registro')
  setRegistroTab('preventivi')
  setRegistroCerca('')
  setSopralluogoAperto(null)

  setPreventivoRegistroEdit(String(preventivoAiGenerato.id))
  setPreventivoRegistroCantiere(preventivoAiGenerato.cantiere || '')
  setPreventivoRegistroNomeFile(preventivoAiGenerato.nome_file || '')
  setPreventivoRegistroImporto(
    String(preventivoAiGenerato.importo_totale || '')
  )
  setPreventivoRegistroNote(preventivoAiGenerato.note || '')
}



const apriFatturaFornitore = async (fatturaId: string) => {
  const { data, error } = await supabase
    .from('fatture_fornitori_righe')
    .select('*')
    .eq('fattura_id', fatturaId)
    .order('numero_riga', { ascending: true })

  if (error) {
    alert('Errore apertura righe fattura: ' + error.message)
    return
  }

  setFatturaApertaId(fatturaId)
  setRigheFatturaAperta(data || [])
}


const salvaModificheFatturaAperta = async () => {
  if (!fatturaApertaId) {
    alert('Nessuna fattura aperta')
    return
  }



const totaleAssegnatoFattura = righeFatturaAperta.reduce(
  (tot, r) => tot + Number(r.totale_riga || 0),
  0
)

const fatturaCorrenteAperta = fattureFornitori.find(
  (f) => String(f.id) === String(fatturaApertaId)
)

const totaleDocumentoFattura =
  Number(fatturaCorrenteAperta?.importo_totale || 0)
const differenzaFattura =
  totaleDocumentoFattura - totaleAssegnatoFattura



  const righeAggiornate = righeFatturaAperta.map((r) => ({
  id: r.id,
  cantiere: r.cantiere || null,
  categoria_economica: r.categoria_economica || null,
  stato: r.cantiere ? 'assegnata' : 'da_assegnare',
}))

for (const riga of righeAggiornate) {
  if (!riga.id) continue

  const { error } = await supabase
    .from('fatture_fornitori_righe')
    .update({
      cantiere: riga.cantiere,
      categoria_economica: riga.categoria_economica,
      stato: riga.stato,
    })
    .eq('id', riga.id)

  if (error) {
    alert('Errore aggiornamento riga fattura: ' + error.message)
    return
  }
}

const fatturaCorrente = fattureFornitori.find(
  (f) => String(f.id) === String(fatturaApertaId)
)

if (fatturaCorrente) {
  await supabase
    .from('materiali_cantiere')
    .delete()
    .eq('nome_file', fatturaCorrente.nome_file || '')

  await supabase
    .from('spese_impresa')
    .delete()
    .eq('nome_file', fatturaCorrente.nome_file || '')

  const materialiDaSalvare = righeFatturaAperta
    .filter(
      (r) =>
        r.cantiere &&
        r.cantiere !== 'Generale impresa' &&
        r.categoria_economica === 'materiale_cantiere'
    )
    .map((r) => ({
      cantiere: r.cantiere,
      descrizione: r.descrizione,
      quantita: r.quantita || 1,
      prezzo_unitario: r.prezzo_unitario || 0,
      totale: Number(r.totale_riga || 0),
      fornitore: fatturaCorrente.fornitore || '',
      data_documento: fatturaCorrente.data_fattura || '',
      nome_file: fatturaCorrente.nome_file || '',
      file_tipo: fatturaCorrente.tipo_file || '',
      anteprima_testo: `Fattura ${fatturaCorrente.numero_fattura || ''}`,
    }))

  if (materialiDaSalvare.length > 0) {
    const { error: erroreMateriali } = await supabase
      .from('materiali_cantiere')
      .insert(materialiDaSalvare)

    if (erroreMateriali) {
      alert(
        'Errore salvataggio materiali: ' +
          JSON.stringify(erroreMateriali)
      )
      return
    }
  }

  const speseImpresaDaSalvare = righeFatturaAperta
    .filter(
      (r) =>
        r.categoria_economica === 'attrezzo_ditta' ||
        r.categoria_economica === 'magazzino' ||
        r.categoria_economica === 'spesa_generale'
    )
    .map((r) => ({
      categoria: r.categoria_economica,
      descrizione: r.descrizione || '',
      importo: Number(r.totale_riga || 0),
      fornitore: fatturaCorrente.fornitore || '',
      data_documento: fatturaCorrente.data_fattura || null,
      nome_file: fatturaCorrente.nome_file || '',
      fattura_id: fatturaCorrente.id || null,
      riga_fattura_id: r.id || null,
      nota: `Fattura ${fatturaCorrente.numero_fattura || ''}`,
    }))

  if (speseImpresaDaSalvare.length > 0) {
    const { error: erroreSpese } = await supabase
      .from('spese_impresa')
      .insert(speseImpresaDaSalvare)

    if (erroreSpese) {
      alert(
        'Errore salvataggio spese impresa: ' +
          JSON.stringify(erroreSpese)
      )
      return
    }
  }
}


const righeAssegnate = righeFatturaAperta.filter(
  (r) => r.cantiere || r.categoria_economica
)
  const nuovoStato =
    righeAssegnate.length === righeFatturaAperta.length
      ? 'assegnata'
      : righeAssegnate.length > 0
      ? 'parzialmente_assegnata'
      : 'da_assegnare'

  const { error: erroreFattura } = await supabase
    .from('fatture_fornitori')
    .update({ stato: nuovoStato })
    .eq('id', fatturaApertaId)

  if (erroreFattura) {
  alert(
    'Errore aggiornamento stato fattura: ' +
      JSON.stringify(erroreFattura)
  )
  return
}


// QUI INCOLLI IL BLOCCO MATERIALI

await caricaFattureFornitori()
await caricaEconomia()
await caricaSpeseImpresa()

setFatturaApertaId(null)
setRigheFatturaAperta([])
setCantiereMassivoFattura('')

alert('Modifiche fattura salvate')

}



const eliminaFatturaFornitore = async (fattura: FatturaFornitore) => {
  if (!fattura.id) return

  const conferma = confirm(
    `Vuoi eliminare la fattura ${fattura.numero_fattura} di ${fattura.fornitore}?\n\nVerranno eliminate anche le righe collegate.`
  )

  if (!conferma) return

 const descrizionePagamento =
  `Fattura ${fattura.numero_fattura} del ${fattura.data_fattura}`

await supabase
  .from('pagamenti_fornitori')
  .delete()
  .eq('descrizione', descrizionePagamento)

await supabase
  .from('materiali_cantiere')
  .delete()
  .eq('nome_file', fattura.nome_file || '')

const { error } = await supabase
  .from('fatture_fornitori')
  .delete()
  .eq('id', fattura.id)

  if (error) {
    alert('Errore eliminazione fattura: ' + error.message)
    return
  }

  if (fatturaApertaId === fattura.id) {
    setFatturaApertaId(null)
    setRigheFatturaAperta([])
  }

  await caricaFattureFornitori()
  await caricaEconomia()
  await caricaPagamentiFornitori()

  alert('Fattura eliminata')
}


const [operaiRapportino, setOperaiRapportino] = useState<
  { nome: string; ore: number; costo: number }[]
>([])
const [costoExtraRapportino, setCostoExtraRapportino] = useState('')
const [operaioSelezionato, setOperaioSelezionato] = useState('')
const [oreOperaio, setOreOperaio] = useState(0)
const [sottoSezioneCantieri, setSottoSezioneCantieri] = useState('elenco')
const [cantiereSchedaSelezionato, setCantiereSchedaSelezionato] = useState<string | null>(null)
const [sottoSezionePagamenti, setSottoSezionePagamenti] = useState('operai')

const [fileUrlAnalisi, setFileUrlAnalisi] = useState<string | null>(null)
const [fileTipoAnalisi, setFileTipoAnalisi] = useState<string | null>(null)

const [cantiereRegistroEdit, setCantiereRegistroEdit] = useState<string | null>(null)
const [cantiereRegistroNome, setCantiereRegistroNome] = useState('')
const [cantiereRegistroPreventivo, setCantiereRegistroPreventivo] = useState('')
const [cantiereRegistroInizio, setCantiereRegistroInizio] = useState('')
const [cantiereRegistroFine, setCantiereRegistroFine] = useState('')
const [cantiereRegistroConcluso, setCantiereRegistroConcluso] = useState(false)

const [preventivoRegistroEdit, setPreventivoRegistroEdit] = useState<string | null>(null)
const [preventivoAiGenerato, setPreventivoAiGenerato] =
  useState<any | null>(null)

const [preventivoRegistroCantiere, setPreventivoRegistroCantiere] = useState('')
const [preventivoRegistroNomeFile, setPreventivoRegistroNomeFile] = useState('')
const [preventivoRegistroImporto, setPreventivoRegistroImporto] = useState('')
const [preventivoRegistroNote, setPreventivoRegistroNote] = useState('')


const [pagamentiOperai, setPagamentiOperai] = useState<PagamentoOperaio[]>([])
const [operaioPagamento, setOperaioPagamento] = useState('')
const [importoPagamento, setImportoPagamento] = useState('')
const [dataPagamento, setDataPagamento] = useState('')
const [metodoPagamento, setMetodoPagamento] = useState('')
const [notaPagamento, setNotaPagamento] = useState('')

const [scadenzaPagamentiOperai, setScadenzaPagamentiOperai] = useState('')
const [giorniPreavvisoPagamenti, setGiorniPreavvisoPagamenti] = useState(3)

const [assistenteAttivo, setAssistenteAttivo] = useState(false)
const [recognitionAssistente, setRecognitionAssistente] = useState<any>(null)

const [timbraturaInModifica, setTimbraturaInModifica] = useState<string | null>(null)
const [dataTimbraturaModifica, setDataTimbraturaModifica] = useState('')
const [oraEntrataModifica, setOraEntrataModifica] = useState('')
const [oraUscitaModifica, setOraUscitaModifica] = useState('')
const [statoTimbraturaModifica, setStatoTimbraturaModifica] = useState('aperto')





type RigaDocumentoAnalizzato = {
  descrizione: string
  quantita: number
  unita_misura: string
  prezzo_unitario: number
  totale: number
  riga_originale: string
}

const normalizzaTestoDocumento = (testo: string) => {
  if (!testo) return ''

  return testo
    .replace(/\r/g, '\n')
    .replace(/[·•]+/g, ' ')
    .replace(/\.{2,}/g, ' ')
    .replace(/[|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(
      /\s(\d{1,3})\s+(?=[A-ZÀ-Ü])/g,
      '\n$1 '
    )
    .replace(
      /(mq|m²|ml|m|cad|pz|kg|lt|corpo)\s+/gi,
      ' $1 '
    )
    .trim()
}

const analizzaRigheDocumento = (testo: string): RigaDocumentoAnalizzato[] => {
  if (!testo) return []

  const testoNormalizzato = normalizzaTestoDocumento(testo)

  const righe = testoNormalizzato
    .split('\n')
    .map((r) => r.trim())
    .filter((r) => r.length > 5)

  return righe
    .map((riga) => {
      const rigaPulita = riga.replace(/\s+/g, ' ')

      const numeri =
        rigaPulita.match(/\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2}|\d+/g) || []

      if (numeri.length === 0) return null

      const patternComputo = rigaPulita.match(
        /(mq|m²|ml|m|cad|pz|kg|lt|corpo)\s+([\d.,]+)\s+([\d.,]+)\s*([\d.,]+)?/i
      )

      let unitaMisura = 'corpo'
      let quantitaNumero = '1'
      let prezzoNumero = numeri[numeri.length - 1]
      let totaleNumero = numeri[numeri.length - 1]

      if (patternComputo) {
        unitaMisura = patternComputo[1].toLowerCase()
        quantitaNumero = patternComputo[2]
        prezzoNumero = patternComputo[3]

        if (patternComputo[4]) {
          totaleNumero = patternComputo[4]
        } else {
          const qta = parseImporto(quantitaNumero)
          const prezzo = parseImporto(prezzoNumero)
          totaleNumero = String(qta * prezzo)
        }
      } else if (numeri.length >= 3) {
        quantitaNumero = numeri[numeri.length - 3]
        prezzoNumero = numeri[numeri.length - 2]
        totaleNumero = numeri[numeri.length - 1]
      }

      const quantita = parseImporto(quantitaNumero) || 1
      const prezzoUnitario = parseImporto(prezzoNumero)
      const totale = parseImporto(totaleNumero)

      if (!totale || totale <= 0) return null

      const descrizione = rigaPulita
        .replace(patternComputo?.[0] || '', '')
        .replace(/\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2}|\d+/g, '')
        .replace(/\b(mq|m²|ml|m|cad|pz|kg|lt|corpo)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim()

      if (!descrizione || descrizione.length < 4) return null

      return {
        descrizione,
        quantita,
        unita_misura: unitaMisura,
        prezzo_unitario: prezzoUnitario,
        totale,
        riga_originale: riga,
      }
    })
    .filter(Boolean) as RigaDocumentoAnalizzato[]
}

const salvaInMemoriaPrezzi = async ({
  descrizione,
  categoria,
  unita_misura,
  prezzo_unitario,
  prezzo_totale,
  quantita,
  cantiere,
  fonte,
  note,
}: MemoriaPrezzo) => {
  if (!descrizione || !prezzo_unitario) return

  const { error } = await supabase
    .from('memoria_prezzi')
    .insert({
      descrizione,
      categoria: categoria || null,
      unita_misura: unita_misura || null,
      prezzo_unitario,
      prezzo_totale: prezzo_totale || null,
      quantita: quantita || null,
      cantiere: cantiere || null,
      fonte: fonte || 'lavoro reale ARTECNA',
      provincia: 'Catania',
      note: note || null,
    })

  if (error) {
    console.log('Errore salvataggio memoria prezzi:', error.message)
    return
  }

  await caricaMemoriaPrezzi()
}

const cercaPrezzoMigliore = (descrizione: string) => {
  const testo = String(descrizione || '').toLowerCase().trim()

  if (!testo) return null

  const parole = testo
    .split(' ')
    .filter((p) => p.length > 3)

  const risultatiPrezzario = prezziarioSicilia
    .map((p: any) => {
      const desc = String(p.descrizione || '').toLowerCase()

      const punteggio = parole.filter((parola) =>
        desc.includes(parola)
      ).length

      return {
        ...p,
        punteggio,
        fonte_prezzo:
          p.fonte ||
          `Prezzario Regione Siciliana ${p.anno || ''}`,
      }
    })
    .filter(
      (p: any) =>
        p.punteggio > 0 &&
        Number(p.prezzo_unitario || 0) > 0
    )
    .sort((a: any, b: any) => b.punteggio - a.punteggio)

  if (risultatiPrezzario.length > 0) {
    return risultatiPrezzario[0]
  }

  const mediaArtecna = calcolaMediaPrezziSimili(descrizione)

  if (mediaArtecna) {
    return {
      descrizione,
      prezzo_unitario: mediaArtecna,
      unita_misura: '',
      fonte_prezzo: 'Memoria prezzi ARTECNA / Catania',
    }
  }

  return null
}



const cercaPrezziSimili = (testo: string) => {
  const parole = testo
    .toLowerCase()
    .split(' ')
    .filter((p) => p.length > 3)

  return memoriaPrezzi.filter((p) => {
    const descrizione = String(p.descrizione || '').toLowerCase()
    return parole.some((parola) => descrizione.includes(parola))
  })
}

const calcolaMediaPrezziSimili = (testo: string) => {
  const simili = cercaPrezziSimili(testo)
    .filter((p) => Number(p.prezzo_unitario) > 0)

  if (simili.length === 0) return null

  const totale = simili.reduce(
    (somma, p) => somma + Number(p.prezzo_unitario || 0),
    0
  )

  return totale / simili.length
}

const verificaPrezzoAnomalo = (descrizione: string, prezzo: number) => {
  const media = calcolaMediaPrezziSimili(descrizione)

  if (!media || !prezzo) return ''

  const differenza = ((prezzo - media) / media) * 100

  if (differenza > 30) {
    return `⚠️ Prezzo alto: circa ${differenza.toFixed(0)}% sopra la media ARTECNA/Catania`
  }

  if (differenza < -30) {
    return `⚠️ Prezzo basso: circa ${Math.abs(differenza).toFixed(0)}% sotto la media ARTECNA/Catania`
  }

  return '✅ Prezzo in linea con la memoria prezzi ARTECNA'
}

const salvaDocumentoAnalizzatoInEconomia = async (
  tipo: 'preventivo' | 'materiale' | 'attrezzo'
) => {
  if (!cantiereScheda) {
    alert('Seleziona prima un cantiere')
    return
  }

  const importo = parseImporto(importoRilevatoDocumento)

  if (!importo || importo <= 0) {
    alert('Importo non valido')
    return
  }

  const baseData = {
    cantiere: cantiereScheda,
    descrizione: nomeFileAnalisiDocumento || 'Documento analizzato',
    quantita: 1,
    prezzo_unitario: importo,
    totale: importo,
    fornitore: 'Documento analizzato',
    data_documento: oggi,
    nome_file: nomeFileAnalisiDocumento || 'Documento analizzato',
    file_url: fileUrlAnalisi || null,
    file_tipo: fileTipoAnalisi || null,
    anteprima_testo: testoEstrattoDocumento || null,
  }

  let error = null

if (tipo === 'preventivo') {
  const res = await supabase.from('preventivi_cantiere').insert([
    {
      cantiere: cantiereScheda,
      importo_totale: importo,
      nome_file: nomeFileAnalisiDocumento || 'Documento analizzato',
      note: 'Importato da analisi documento',

      file_url: fileUrlAnalisi || null,
      file_path: filePathAnalisi || null,

      file_tipo: fileTipoAnalisi || null,
      anteprima_testo: testoEstrattoDocumento || null,
    },
  ])

  error = res.error

 if (!error) {
  const righeDocumento = analizzaRigheDocumento(testoEstrattoDocumento || '')

  if (righeDocumento.length > 0) {
    await supabase.from('preventivo_lavorazioni').insert(
      righeDocumento.map((r) => ({
        cantiere: cantiereScheda,
        descrizione: r.descrizione,
        importo_previsto: r.totale,
        quantita: r.quantita,
        prezzo_unitario: r.prezzo_unitario,
        unita_misura: r.unita_misura,
      }))
    )
  } else {
    await supabase.from('preventivo_lavorazioni').insert([
      {
        cantiere: cantiereScheda,
        descrizione: nomeFileAnalisiDocumento || 'Documento analizzato',
        importo_previsto: importo,
        quantita: 1,
        prezzo_unitario: importo,
        unita_misura: 'corpo',
      },
    ])
  }

  await caricaPreventivoLavorazioni()
}
}



  if (tipo === 'materiale') {
    const res = await supabase.from('materiali_cantiere').insert([baseData])
    error = res.error
  }

  if (tipo === 'attrezzo') {
    const res = await supabase.from('attrezzi_cantiere').insert([
      {
        ...baseData,
        nota: 'Importato da analisi documento',
      },
    ])
    error = res.error
  }

  if (error) {
    alert('Errore salvataggio: ' + error.message)
    return
  }

  await caricaEconomia()

  alert(`Salvato come ${tipo}`)
}

const storicoGiornaliero = () => {
  const giorni: Record<string, number> = {}


  timbrature.forEach((t) => {
    if (!t.data) return

    if (dataDa && t.data < dataDa) return
    if (dataA && t.data > dataA) return

    const costo = calcolaCostoTimbratura(t)

    if (!giorni[t.data]) {
      giorni[t.data] = 0
    }

    giorni[t.data] += costo * -1
  })

rapportini.forEach((r) => {
  if (!r.data) return

  if (dataDa && r.data < dataDa) return
  if (dataA && r.data > dataA) return

  const costo = Number(r.costo_manodopera || 0)

  if (!giorni[r.data]) {
    giorni[r.data] = 0
  }

  giorni[r.data] += costo * -1
})
materialiCantiere.forEach((m) => {
  const dataMateriale = m.data_documento || oggi

  if (dataDa && dataMateriale < dataDa) return
  if (dataA && dataMateriale > dataA) return

  const costo = Number(m.totale || 0)

  if (!giorni[dataMateriale]) {
    giorni[dataMateriale] = 0
  }
  giorni[dataMateriale] += costo * -1
})
  return Object.entries(giorni)
    .map(([data, costo]) => ({
      data,
      costo,
    }))
    .sort((a, b) => a.data.localeCompare(b.data))
}
const utileNelTempo = () => {
  const giorni: Record<string, number> = {}

  // COSTI (già negativi)
  storicoGiornaliero().forEach((g) => {
    giorni[g.data] = g.costo
  })

  // PREVENTIVI distribuiti (semplificato)
  cantieri.forEach((c) => {
    const preventivo = Number(c.preventivo || 0)

    if (!preventivo) return

    // distribuiamo su una sola data (oggi per ora)
    const data = oggi

    if (!giorni[data]) {
      giorni[data] = 0
    }

    giorni[data] += preventivo
  })

  return Object.entries(giorni)
    .map(([data, valore]) => ({
      data,
      valore,
    }))
    .sort((a, b) => a.data.localeCompare(b.data))
}

const controlloCostiPro = () => {
  return cantieri.map((c) => {
    const preventivo = Number(c.preventivo || 0)

    const costoTimbrature = timbrature
      .filter((t) => t.cantiere === c.nome)
      .reduce((tot, t) => tot + calcolaCostoTimbratura(t), 0)

    const costoRapportini = rapportini
      .filter((r) => r.cantiere === c.nome)
      .reduce((tot, r) => tot + Number(r.costo_manodopera || 0), 0)

    const costoMateriali = materialiCantiere
      .filter((m) => m.cantiere === c.nome)
      .reduce((tot, m) => tot + Number(m.totale || 0), 0)

    const costoAttrezzi = attrezziCantiere
      .filter((a) => a.cantiere === c.nome)
      .reduce((tot, a) => tot + Number(a.totale || 0), 0)

    const costoTotale =
      costoTimbrature + costoRapportini + costoMateriali + costoAttrezzi

    const utile = preventivo - costoTotale
    const margine = preventivo > 0 ? (utile / preventivo) * 100 : 0


    const stato =
      utile < 0
        ? 'perdita'
        : margine < 10
        ? 'attenzione'
        : 'ok'

    return {
      nome: c.nome,
      preventivo,
      costoTotale,
      utile,
      margine,
      stato,
    }
  })
}

const caricaFilePreventivo = async (file: File) => {
  if (!file || !cantiereScheda) {
    alert('Seleziona cantiere e file')
    return
  }

  const fakeEvent = {
    target: {
      files: [file],
    },
  } as unknown as React.ChangeEvent<HTMLInputElement>

  await handleUploadPreventivo(fakeEvent)
}

const parseNumeroMonetarioExcel = (valore: unknown) => {
  if (typeof valore === 'number') {
    return Number.isFinite(valore) && valore > 0 ? valore : null
  }

  const testo = String(valore || '').trim()
  if (!testo || testo.includes('%')) return null
  if (/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(testo)) return null

  const corrispondenze = testo.match(/\d[\d.,]*/g)

  if (!corrispondenze) return null

  const numeri = corrispondenze
    .map((numero) => {
      const ultimaVirgola = numero.lastIndexOf(',')
      const ultimoPunto = numero.lastIndexOf('.')
      let normalizzato = numero

      if (ultimaVirgola >= 0 && ultimoPunto >= 0) {
        normalizzato =
          ultimaVirgola > ultimoPunto
            ? numero.replace(/\./g, '').replace(',', '.')
            : numero.replace(/,/g, '')
      } else if (ultimaVirgola >= 0) {
        const decimali = numero.length - ultimaVirgola - 1
        normalizzato =
          decimali > 0 && decimali <= 2
            ? numero.replace(',', '.')
            : numero.replace(/,/g, '')
      } else if (ultimoPunto >= 0) {
        const decimali = numero.length - ultimoPunto - 1
        normalizzato =
          numero.split('.').length > 2 || decimali === 3
            ? numero.replace(/\./g, '')
            : numero
      }

      return Number(normalizzato)
    })
    .filter(
      (numero) =>
        Number.isFinite(numero) && numero > 0 && numero <= 100_000_000
    )

  return numeri.length > 0 ? Math.max(...numeri) : null
}

const rilevaTotalePreventivoExcel = (righe: unknown[][]) => {
  const candidati: Array<{ importo: number; priorita: number; riga: number }> = []

  righe.forEach((riga, indiceRiga) => {
    const testoRiga = riga
      .map((cella) => String(cella || '').trim().toLowerCase())
      .join(' ')
      .replace(/\s+/g, ' ')

    const totaleForte =
      /\b(totale generale|totale complessivo|importo totale|totale preventivo|totale offerta)\b/.test(
        testoRiga
      )
    const totaleEsplicito = riga.some((cella) =>
      /^totale(?:\s+(?:lavori|netto|preventivo))?\s*:?$/i.test(
        String(cella || '').trim()
      )
    )

    if (!totaleForte && !totaleEsplicito) return

    const valori = riga
      .map(parseNumeroMonetarioExcel)
      .filter((valore): valore is number => valore !== null)

    if (valori.length === 0) return

    candidati.push({
      importo: Math.max(...valori),
      priorita: totaleForte ? 2 : 1,
      riga: indiceRiga,
    })
  })

  candidati.sort((a, b) => b.priorita - a.priorita || b.riga - a.riga)
  return candidati[0]?.importo ?? null
}

const handleUploadPreventivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]

  if (!file || !cantiereScheda) {
    alert('Seleziona cantiere e file')
    return
  }

  const estensione = file.name.split('.').pop()?.toLowerCase() || 'file'

  const nomePulito = file.name
    .replace(/\.[^/.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  const { data: userData } = await supabase.auth.getUser()
const user = userData.user

if (!user) {
  alert('Utente non autenticato')
  return
}

const cantierePulito = cantiereScheda
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9_-]/g, '_')
  .replace(/_+/g, '_')
  .replace(/^_+|_+$/g, '')

const fileName = `utenti/${user.id}/cantieri/${cantierePulito}/preventivi/${Date.now()}_${nomePulito}.${estensione}`

const { error: uploadError } = await supabase.storage
  .from('preventivi')
  .upload(fileName, file)

  if (uploadError) {
    console.error('UPLOAD ERROR:', uploadError)
    alert('Errore upload file: ' + uploadError.message)
    return
  }

  const { data } = supabase.storage
    .from('preventivi')
    .getPublicUrl(fileName)

  const fileUrl = data.publicUrl

  const nome = file.name.toLowerCase()

  let tipo = 'altro'
  if (nome.endsWith('.pdf')) tipo = 'pdf'
  if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) tipo = 'excel'
  if (
    nome.endsWith('.jpg') ||
    nome.endsWith('.jpeg') ||
    nome.endsWith('.png') ||
    nome.endsWith('.webp')
  ) {
    tipo = 'img'
  }

  let anteprima = ''
  let importoTotale = 0
  let totaleExcelAffidabile = true

  if (tipo === 'excel') {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
    })
    const righeVisibili = json.filter(
      (riga) =>
        Array.isArray(riga) &&
        riga.some((cella) => String(cella).trim() !== '')
    )

    anteprima = JSON.stringify(righeVisibili.slice(0, 100))

    const totaleRilevato = rilevaTotalePreventivoExcel(righeVisibili)
    totaleExcelAffidabile = totaleRilevato !== null
    importoTotale =
      totaleRilevato !== null ? Number(totaleRilevato.toFixed(2)) : 0
  }

  if (tipo === 'pdf') {
    const testo = await leggiPdfTesto(file)
    anteprima = testo.slice(0, 2000)

    const totale = estraiTotaleScontrino(testo)
    importoTotale = totale || 0
  }

  if (tipo === 'img') {
    const testo = await leggiTestoDaImmagine(file)
    anteprima = testo.slice(0, 2000)

    const totale = estraiTotaleScontrino(testo)
    importoTotale = totale || 0
  }

  const { error } = await supabase.from('preventivi_cantiere').insert([
    {
       cantiere: cantiereScheda,
    nome_file: file.name,
    file_url: fileUrl,
    file_path: fileName,
    file_tipo: tipo,
    anteprima_testo: anteprima,
    importo_totale: importoTotale,
    },
  ])

  if (error) {
    alert('Errore salvataggio DB: ' + error.message)
    return
  }

  await caricaEconomia()
  setMostraPreventiviCantiere(true)

  if (tipo === 'excel' && !totaleExcelAffidabile) {
    alert(
      'Preventivo caricato. Totale non rilevato automaticamente, inserisci importo manualmente.'
    )
    return
  }

  alert('Preventivo caricato ✔')
}
const previsioneCostiPro = () => {
  return cantieri.map((c) => {
    const preventivo = Number(c.preventivo || 0)

    const costi = controlloCostiPro().find(x => x.nome === c.nome)

    const costoAttuale = costi?.costoTotale || 0

    const giorni = storicoGiornaliero().length || 1

    const costoMedioGiornaliero = costoAttuale / giorni

    const giorniStimatiTotali = giorni + 5 // puoi migliorarlo dopo

    const costoStimatoFinale = costoMedioGiornaliero * giorniStimatiTotali

    const utilePrevisto = preventivo - costoStimatoFinale

    return {
      nome: c.nome,
      costoAttuale,
      costoStimatoFinale,
      utilePrevisto,
    }
  })
}
const utileCumulatoNelTempo = () => {
  let cumulato = 0

  return storicoGiornaliero().map((g) => {
    cumulato += g.costo

    return {
      data: g.data,
      utile: cumulato,
    }
  })
}

const utileRealePerCantiere = () => {
  const risultati: Record<
    string,
    { data: string; utile: number }[]
  > = {}

  cantieri.forEach((c) => {
    const preventivo = Number(c.preventivo || 0)
    const nomeCantiere = String(c.nome || '')

    if (!nomeCantiere) return

    let cumulato = preventivo

    risultati[nomeCantiere] = storicoGiornaliero().map((g) => {
      const costoGiorno =
        timbrature
          .filter(
            (t) =>
              t.cantiere === nomeCantiere &&
              t.data === g.data
          )
          .reduce(
            (tot, t) => tot + calcolaCostoTimbratura(t),
            0
          ) +
        rapportini
          .filter(
            (r) =>
              r.cantiere === nomeCantiere &&
              r.data === g.data
          )
          .reduce(
            (tot, r) =>
              tot + Number(r.costo_manodopera || 0),
            0
          ) +
        materialiCantiere
          .filter(
            (m) =>
              m.cantiere === nomeCantiere &&
              (m.data_documento || oggi) === g.data
          )
          .reduce(
            (tot, m) => tot + Number(m.totale || 0),
            0
          )

      cumulato -= costoGiorno

      return {
        data: g.data,
        utile: cumulato,
      }
    })
  })

    return risultati
}
const allarmiPerditaCantieri = () => {
  return Object.entries(utileRealePerCantiere()).map(([nome, dati]) => {
    const ultimo = dati[dati.length - 1]
    const utileFinale = ultimo?.utile || 0

    const cantiere = cantieri.find((c) => c.nome === nome)
    const preventivo = Number(cantiere?.preventivo || 0)

    const marginePercentuale =
      preventivo > 0 ? (utileFinale / preventivo) * 100 : 0

    return {
      nome,
      utileFinale,
      marginePercentuale,
      stato:
        utileFinale < 0
          ? 'perdita'
          : marginePercentuale < 10
          ? 'attenzione'
          : 'ok',
    }
  })
}
const utileCumulatoPerCantiere = () => {
  let cumulatoCosto = 0

  return storicoGiornaliero().map((g) => {
    const costiGiorno = timbrature
      .filter(
        (t) =>
          t.data === g.data &&
          (!cantiereGrafico || t.cantiere === cantiereGrafico)
      )
      .reduce((tot, t) => tot + calcolaCostoTimbratura(t), 0)

    cumulatoCosto += costiGiorno

    const cantiere = cantieri.find((c) => c.nome === cantiereGrafico)
    const preventivo = Number(cantiere?.preventivo || 0)

    const utile = preventivo - cumulatoCosto

    return {
      data: g.data,
      utile,
    }
  })
}

const timbratureFiltrateRegistro = timbrature.filter((t) => {
  const cerca = registroCerca.toLowerCase()

  const passaRicerca =
    String(t.operaio_nome || '').toLowerCase().includes(cerca) ||
    String(t.cantiere || '').toLowerCase().includes(cerca)

  if (!passaRicerca) return false

  if (
    filtroTimbratureDal &&
    String(t.data || '') < filtroTimbratureDal
  ) {
    return false
  }

  if (
    filtroTimbratureAl &&
    String(t.data || '') > filtroTimbratureAl
  ) {
    return false
  }

  if (
    filtroTimbratureCantiere &&
    t.cantiere !== filtroTimbratureCantiere
  ) {
    return false
  }

  if (
    filtroTimbratureOperaio &&
    t.operaio_nome !== filtroTimbratureOperaio
  ) {
    return false
  }

  return true
})


const previsioneCantiere = () => {
  if (!cantiereGrafico) return null

  const cantiere = cantieri.find((c) => c.nome === cantiereGrafico)
  const preventivo = Number(cantiere?.preventivo || 0)

  const timbratureCantiere = timbrature.filter(
    (t) => t.cantiere === cantiereGrafico
  )

  const costoTotale = timbratureCantiere.reduce(
    (tot, t) => tot + calcolaCostoTimbratura(t),
    0
  )

  const giorniLavorati = new Set(
    timbratureCantiere.map((t) => t.data).filter(Boolean)
  ).size

  const costoMedioGiornaliero =
    giorniLavorati > 0 ? costoTotale / giorniLavorati : 0

  const margineResiduo = preventivo - costoTotale

  const giorniPrimaPerdita =
    costoMedioGiornaliero > 0
      ? Math.floor(margineResiduo / costoMedioGiornaliero)
      : null

  return {
    preventivo,
    costoTotale,
    giorniLavorati,
    costoMedioGiornaliero,
    margineResiduo,
    giorniPrimaPerdita,
  }
}
  const [dataStoricoUtile, setDataStoricoUtile] = useState(
  new Date().toISOString().split('T')[0]
)
const [dataDa, setDataDa] = useState('')
const [dataA, setDataA] = useState('')

const [cantiereGrafico, setCantiereGrafico] = useState('')

  const [sottoSezioneOperai, setSottoSezioneOperai] = useState('anagrafica')

  const [preventivi, setPreventivi] = useState<PreventivoCantiere[]>([])
  const [materialiCantiere, setMaterialiCantiere] = useState<MaterialeCantiere[]>([])
  const [attrezziCantiere, setAttrezziCantiere] = useState<AttrezzoCantiere[]>([])

// Stati generali per impostazioni
const [fontFamily, setFontFamily] = useState('Inter')
const [fontSize, setFontSize] = useState(15) // in px
const [nomeApp, setNomeApp] = useState('ARTECNA')
const [mostraImpostazioni, setMostraImpostazioni] = useState(false)

const [dragAttivo, setDragAttivo] = useState(false)

  const [nomeCantiere, setNomeCantiere] = useState('')
  const [cantiereDaModificare, setCantiereDaModificare] = useState('')
  const [nuovoNomeCantiere, setNuovoNomeCantiere] = useState('')

  const [includiVociAnalizzateNeiCosti, setIncludiVociAnalizzateNeiCosti] = useState(false)

  const [menuAperto, setMenuAperto] = useState<string | null>(null)



  const [preventivoCantiereInput, setPreventivoCantiereInput] = useState('')

  const [rapportinoInModifica, setRapportinoInModifica] = useState<string | null>(null)
  const [cantiereRapporto, setCantiereRapporto] = useState('')
  const [data, setData] = useState('')
  const [ore, setOre] = useState('')
  const [note, setNote] = useState('')
  const [operai, setOperai] = useState('')
  const [numeroPresenti, setNumeroPresenti] = useState('')
  const [orePerOperaio, setOrePerOperaio] = useState('')
  const [materiali, setMateriali] = useState('')
  const [quantitaMateriali, setQuantitaMateriali] = useState('')
  const [costoMateriali, setCostoMateriali] = useState('')

  const [fotoInModifica, setFotoInModifica] = useState<string | null>(null)
  const [cantiereFoto, setCantiereFoto] = useState('')
  const [notaFoto, setNotaFoto] = useState('')
  const [immagineBase64, setImmagineBase64] = useState('')
  const [dataFoto, setDataFoto] = useState('')
  const [geolocalizzazione, setGeolocalizzazione] = useState('')

  const [nomeOperaio, setNomeOperaio] = useState('')
  const [telefonoOperaio, setTelefonoOperaio] = useState('')
  const [qualificaOperaio, setQualificaOperaio] = useState('')
  const [pinOperaio, setPinOperaio] = useState('')
  const [notaOperaio, setNotaOperaio] = useState('')
  const [statoOperaio, setStatoOperaio] = useState('attivo')
  const [costoOrarioOperaio, setCostoOrarioOperaio] = useState('')
  const [ricercaOperaio, setRicercaOperaio] = useState('')

  const [operaioInModifica, setOperaioInModifica] = useState<string | null>(null)
  const [nomeOperaioModifica, setNomeOperaioModifica] = useState('')
  const [telefonoOperaioModifica, setTelefonoOperaioModifica] = useState('')
  const [qualificaOperaioModifica, setQualificaOperaioModifica] = useState('')
  const [pinOperaioModifica, setPinOperaioModifica] = useState('')
  const [notaOperaioModifica, setNotaOperaioModifica] = useState('')
  const [statoOperaioModifica, setStatoOperaioModifica] = useState('attivo')
  const [costoOrarioOperaioModifica, setCostoOrarioOperaioModifica] = useState('')

  const [operaioTimbratura, setOperaioTimbratura] = useState('')
  const [cantiereTimbratura, setCantiereTimbratura] = useState('')
  const [pinTimbratura, setPinTimbratura] = useState('')

  const [ultimoRapportino, setUltimoRapportino] = useState<Rapportino | null>(null)
const [ultimoSopralluogo, setUltimoSopralluogo] =
  useState<Sopralluogo | null>(null)

  const [filtroCantiere, setFiltroCantiere] = useState('')
  const [cantiereScheda, setCantiereScheda] = useState('')

  const [importoPreventivo, setImportoPreventivo] = useState('')
  const [descrizioneMateriale, setDescrizioneMateriale] = useState('')
  const [quantitaMaterialeEconomia, setQuantitaMaterialeEconomia] = useState('')
  const [prezzoMaterialeEconomia, setPrezzoMaterialeEconomia] = useState('')
const [prezziarioSicilia, setPrezziarioSicilia] = useState<any[]>([])

  const [descrizioneAttrezzo, setDescrizioneAttrezzo] = useState('')
  const [quantitaAttrezzo, setQuantitaAttrezzo] = useState('')
  const [prezzoAttrezzo, setPrezzoAttrezzo] = useState('')

  const [notePreventivo, setNotePreventivo] = useState('')
  const [nomeFilePreventivo, setNomeFilePreventivo] = useState('')

  const [fornitoreMateriale, setFornitoreMateriale] = useState('')
  const [dataDocumentoMateriale, setDataDocumentoMateriale] = useState('')
  const [nomeFileMateriale, setNomeFileMateriale] = useState('')

  const [fornitoreAttrezzo, setFornitoreAttrezzo] = useState('')
  const [dataDocumentoAttrezzo, setDataDocumentoAttrezzo] = useState('')
  const [nomeFileAttrezzo, setNomeFileAttrezzo] = useState('')
  const [notaAttrezzo, setNotaAttrezzo] = useState('')

  const [preventivoInModifica, setPreventivoInModifica] = useState<string | null>(null)
  const [importoPreventivoModifica, setImportoPreventivoModifica] = useState('')
  const [notePreventivoModifica, setNotePreventivoModifica] = useState('')
  const [nomeFilePreventivoModifica, setNomeFilePreventivoModifica] = useState('')

  const [materialeInModifica, setMaterialeInModifica] = useState<string | null>(null)
  const [descrizioneMaterialeModifica, setDescrizioneMaterialeModifica] = useState('')
  const [quantitaMaterialeModifica, setQuantitaMaterialeModifica] = useState('')
  const [prezzoMaterialeModifica, setPrezzoMaterialeModifica] = useState('')
  const [fornitoreMaterialeModifica, setFornitoreMaterialeModifica] = useState('')
  const [dataDocumentoMaterialeModifica, setDataDocumentoMaterialeModifica] = useState('')
  const [nomeFileMaterialeModifica, setNomeFileMaterialeModifica] = useState('')

const [materialeManualeDescrizione, setMaterialeManualeDescrizione] = useState('')
const [materialeManualeQuantita, setMaterialeManualeQuantita] = useState('1')
const [materialeManualePrezzo, setMaterialeManualePrezzo] = useState('')
const [materialeManualeFornitore, setMaterialeManualeFornitore] = useState('Magazzino')
const [materialeManualeNota, setMaterialeManualeNota] = useState('')



  const [attrezzoInModifica, setAttrezzoInModifica] = useState<string | null>(null)
  const [descrizioneAttrezzoModifica, setDescrizioneAttrezzoModifica] = useState('')
  const [quantitaAttrezzoModifica, setQuantitaAttrezzoModifica] = useState('')
  const [prezzoAttrezzoModifica, setPrezzoAttrezzoModifica] = useState('')
  const [fornitoreAttrezzoModifica, setFornitoreAttrezzoModifica] = useState('')
  const [dataDocumentoAttrezzoModifica, setDataDocumentoAttrezzoModifica] = useState('')
  const [nomeFileAttrezzoModifica, setNomeFileAttrezzoModifica] = useState('')
  const [notaAttrezzoModifica, setNotaAttrezzoModifica] = useState('')

 const [filePreventivo, setFilePreventivo] = useState<File | null>(null)
const [fileMateriale, setFileMateriale] = useState<File | null>(null)
const [fileAttrezzo, setFileAttrezzo] = useState<File | null>(null)

const [fileAnalisiDocumento, setFileAnalisiDocumento] = useState<File | null>(null)
const [testoEstrattoDocumento, setTestoEstrattoDocumento] = useState('')
const [nomeFileAnalisiDocumento, setNomeFileAnalisiDocumento] = useState('')
const [analisiInCorso, setAnalisiInCorso] = useState(false)
const [
  vociPreventivoAiOriginali,
  setVociPreventivoAiOriginali,
] = useState<any[]>([])
const [vociAnalizzate, setVociAnalizzate] = useState<VoceAnalizzata[]>([])
const [sezioneAttiva, setSezioneAttiva] = useState('home')

const [vociPreventivoAi, setVociPreventivoAi] =
  useState<any[]>([])

const [descrizionePreventivoAi, setDescrizionePreventivoAi] =
  useState('')

const [mostraRevisionePreventivoAi, setMostraRevisionePreventivoAi] =
  useState(false)
const [incassiNonFatturati, setIncassiNonFatturati] = useState<any[]>([])
const [popupIncassoNonFatturato, setPopupIncassoNonFatturato] = useState(false)

const [nuovoIncassoNonFatturato, setNuovoIncassoNonFatturato] = useState<any>({
  data_incasso: '',
  cliente: '',
  cantiere: '',
  descrizione: '',
  importo: 0,
  metodo: '',
  note: '',
})

const [graficoCantieriAperto, setGraficoCantieriAperto] =
  useState(false)

const [graficoTotaliAperto, setGraficoTotaliAperto] =
  useState(false)

const [importoRilevatoDocumento, setImportoRilevatoDocumento] = useState('')
const [modalitaMulti, setModalitaMulti] = useState(false)
const menuButtonStyle = (attivo: boolean): CSSProperties => ({
  width: '100%',
  textAlign: 'left',
  padding: '10px 12px',
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
  background: attivo ? '#2563eb' : 'transparent',
  color: 'white',
  fontWeight: attivo ? 700 : 500,
fontSize: fontSize,
fontFamily: fontFamily,
})

const submenuStyle = {
  padding: 6,
  cursor: 'pointer',
  color: '#cbd5e1',
}
const submenuButtonStyle = (attivo: boolean) => ({
  padding: '8px 10px',
  cursor: 'pointer',
  color: attivo ? '#ffffff' : '#cbd5e1',
  background: attivo ? '#2563eb' : 'transparent',
  borderRadius: 8,
  fontWeight: attivo ? 700 : 500,
})
const vaiASezione = (id: string) => {
  setSezioneAttiva('cantieri')

  setTimeout(() => {
    const elemento = document.getElementById(id)
    if (elemento) {
      elemento.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, 100)
}

const excelBox = {
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  overflow: 'hidden',
}

const excelToolbar = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  padding: 10,
  background: '#f8fafc',
  borderBottom: '1px solid #cbd5e1',
}

const excelTable: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'auto',
  fontSize: 14,
}

const cellaTabellaResponsive: CSSProperties = {
  border: '1px solid #d1d5db',
  padding: '6px 8px',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  verticalAlign: 'top',
}

const thOrdinabile = (campo: string, label: string) => (
  <th
    onClick={() => ordinaFatture(campo)}
    style={{
      ...cellaTabellaResponsive,
      cursor: 'pointer',
      background: '#f3f4f6',
      userSelect: 'none',
      position: 'sticky',
      top: 0,
      zIndex: 1,
    }}
  >
    {label}
  </th>
)

const excelTh = {
  background: '#e5e7eb',
  border: '1px solid #cbd5e1',
  padding: '8px 10px',
  textAlign: 'left' as const,
  fontWeight: 700,
  whiteSpace: 'nowrap' as const,

  position: 'sticky' as const,
  top: 0,
  zIndex: 1,
}

const excelTd = {
  border: '1px solid #cbd5e1',
  padding: '7px 10px',
  verticalAlign: 'middle' as const,
  whiteSpace: 'normal' as const,
  wordBreak: 'break-word' as const,
  lineHeight: 1.35,
}

const excelInput = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: 4,
  padding: '6px 8px',
  background: '#fff',

  outline: 'none',
  minWidth: 120,
}

const cardStyle = {
  background: '#ffffff',
  borderRadius: 12,
  padding: 16,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  border: '1px solid #e2e8f0',
}
const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px',
  marginBottom: 10,
  background: '#ffffff',
  color: '#0f172a',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  fontSize: 14,
}

const selectStyle: CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

const [menuCantieriAperto, setMenuCantieriAperto] = useState(true)
const [menuOperaiAperto, setMenuOperaiAperto] = useState(false)
const [menuEconomiaAperto, setMenuEconomiaAperto] = useState(false)
const [menuAttivitaAperto, setMenuAttivitaAperto] = useState(false)

const oggi = new Date().toISOString().slice(0, 10)

function analizzaTestoInVoci(testo: string) {
  const righe = testo.split('\n')
  const voci: VoceAnalizzata[] = []

  righe.forEach((riga) => {
    const pulita = riga
      .replace(/\|+/g, ' | ')
      .replace(/\s+/g, ' ')
      .trim()

    if (pulita.length < 5) return

    const parti = pulita.split('|').map((p) => p.trim()).filter(Boolean)

    if (parti.length >= 4) {
      const descrizione = parti[0] || ''
      const unita = parti[1] || ''
      const quantita = parseFloat((parti[2] || '').replace(',', '.'))
      const prezzo = parseFloat((parti[3] || '').replace(',', '.'))

      if (
        descrizione &&
        !isNaN(quantita) &&
        !isNaN(prezzo) &&
        descrizione.length > 2
      ) {
        voci.push({
          descrizione,
          unita,
          quantita: Math.round(quantita * 100) / 100,
          prezzo: Math.round(prezzo * 100) / 100,
        })
      }
    }
  })

  setVociAnalizzate(voci)

  const totale = voci.reduce((tot, voce) => {
    const quantita = Number(voce.quantita || 0)
    const prezzo = Number(voce.prezzo || 0)
    return tot + quantita * prezzo
  }, 0)

  if (totale > 0) {
    setImportoRilevatoDocumento(
      totale.toLocaleString('it-IT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    )
  } else {
    const totaleDocumento = estraiTotaleScontrino(testo)

    if (totaleDocumento) {
      setImportoRilevatoDocumento(
        totaleDocumento.toLocaleString('it-IT', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      )
    }
  }
}
  

function estraiTotaleScontrino(testo: string): number | null {
  const match =
    testo.match(/importo complessivo iva esclusa[^0-9]*([\d.,]+)/i) ||
    testo.match(/importo complessivo[^0-9]*([\d.,]+)/i) ||
    testo.match(/totale offerta[^0-9]*([\d.,]+)/i) ||
    testo.match(/totale complessivo[^0-9]*([\d.,]+)/i) ||
    testo.match(/totale preventivo[^0-9]*([\d.,]+)/i) ||
    testo.match(/totale documento[^0-9]*([\d.,]+)/i) ||
    testo.match(/importo totale[^0-9]*([\d.,]+)/i) ||
    testo.match(/totale da pagare[^0-9]*([\d.,]+)/i) ||
    testo.match(/importo eur[^0-9]*([\d.,]+)/i) ||
    testo.match(/importo pagato[^0-9]*([\d.,]+)/i) ||
    testo.match(/\bTOTALE\b[^0-9]*([\d.,]+)/i)

  if (!match) return null

  let raw = match[1].trim()

// Se contiene sia punto che virgola → formato italiano
if (raw.includes('.') && raw.includes(',')) {
  raw = raw.replace(/\./g, '').replace(',', '.')
} else {
  // formato tipo 53845.2 → NON toccare il punto
  raw = raw.replace(',', '.')
}

const valore = parseFloat(raw)
  return isNaN(valore) ? null : valore
}

useEffect(() => {
  const salvata = localStorage.getItem('artecna_email')
  if (salvata) setEmailLogin(salvata)
}, [])




const caricaAcconti = async () => {
  const { data, error } = await supabase
    .from('acconti_cantiere')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    alert('Errore caricamento acconti: ' + error.message)
    return
  }

  setAccontiCantiere(data || [])
}

const caricaPagamentiOperai = async () => {
  const { data, error } = await supabase
    .from('pagamenti_operai')
    .select('*')
    .order('data_pagamento', { ascending: false })

  if (error) {
    alert('Errore caricamento pagamenti operai: ' + error.message)
    return
  }

  setPagamentiOperai((data || []) as PagamentoOperaio[])
}

useEffect(() => {
  const checkSession = async () => {
    const { data } = await supabase.auth.getSession()

    if (data.session) {
      setUtente(data.session.user)
    }
  }

  checkSession()

  const { data: listener } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      if (session?.user) {
        setUtente(session.user)
      } else {
        setUtente(null)
      }
    }
  )

  return () => {
    listener.subscription.unsubscribe()
  }
}, [])

useEffect(() => {
caricaSopralluoghi()
  caricaCantieri()
  caricaRapportini()
  caricaFotoCantiere()
  caricaOperai()
  caricaTimbrature()
  caricaEconomia()
  caricaAcconti()
  caricaPagamentiOperai()
  caricaPagamentiFornitori()
  caricaFattureFornitori()
  caricaFattureEmesse()
caricaIncassiNonFatturati()
  caricaSalLavorazioni()
  caricaPreventivoLavorazioni()
caricaSpeseImpresa()
caricaMemoriaPrezzi()
caricaPrezziarioSicilia()
caricaUtilizzoAi()
}, [])

useEffect(() => {
  caricaImpostazioniSupabase()
}, [])

useEffect(() => {
  localStorage.setItem('artecna_fontFamily', fontFamily)
  localStorage.setItem('artecna_fontSize', String(fontSize))
  localStorage.setItem('artecna_nomeApp', nomeApp)
}, [fontFamily, fontSize, nomeApp])

useEffect(() => {
  const savedFont = localStorage.getItem('artecna_fontFamily')
  const savedSize = localStorage.getItem('artecna_fontSize')
  const savedNome = localStorage.getItem('artecna_nomeApp')

  if (savedFont) setFontFamily(savedFont)
  if (savedSize) setFontSize(Number(savedSize))
  if (savedNome) setNomeApp(savedNome)
}, [])

  const oraAttuale = () => {
    const now = new Date()
    return now.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const parseOra = (ora?: string) => {
    if (!ora) return null
    const parti = ora.split(':')
    if (parti.length < 2) return null
    const h = Number(parti[0])
    const m = Number(parti[1])
    if (isNaN(h) || isNaN(m)) return null
    return h * 60 + m
  }

  const formatMoney = (value: number) =>
  Number(value || 0).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
  })
const parseImporto = (valore: any) => {
  if (valore === null || valore === undefined) return 0

  let testo = String(valore)
    .replace(/[€\s]/g, '')
    .trim()

  if (!testo) return 0

  const haVirgola = testo.includes(',')
  const haPunto = testo.includes('.')

  if (haVirgola && haPunto) {
    // formato italiano: 53.845,20
    testo = testo.replace(/\./g, '').replace(',', '.')
  } else if (haVirgola && !haPunto) {
    // formato italiano semplice: 53845,20
    testo = testo.replace(',', '.')
  } else {
    // formato numerico normale: 53845.20
    testo = testo
  }

  const numero = Number(testo)
  return Number.isFinite(numero) ? numero : 0
}
const salvaModificaTimbratura = async () => {
  if (!timbraturaInModifica) return

  const { error } = await supabase
    .from('timbrature')
    .update({
      data: dataTimbraturaModifica,
      ora_entrata: oraEntrataModifica,
      ora_uscita: oraUscitaModifica,
    })
    .eq('id', timbraturaInModifica)

  if (error) {
    alert('Errore modifica timbratura: ' + error.message)
    return
  }

  setTimbraturaInModifica(null)

  await caricaTimbrature()

  alert('Timbratura aggiornata')
}

const salvaPagamentoOperaio = async () => {
  if (!operaioPagamento || !importoPagamento) {
    alert('Seleziona operaio e inserisci importo')
    return
  }

  const importo = parseImporto(importoPagamento)

  if (isNaN(importo) || importo <= 0) {
    alert('Importo non valido')
    return
  }

  const { error } = await supabase.from('pagamenti_operai').insert([
    {
      operaio_nome: operaioPagamento,
      importo,
      data_pagamento: dataPagamento || oggi,
      metodo: metodoPagamento,
      nota: notaPagamento,
    },
  ])

  if (error) {
    alert('Errore salvataggio pagamento: ' + error.message)
    return
  }

  setOperaioPagamento('')
  setImportoPagamento('')
  setDataPagamento('')
  setMetodoPagamento('')
  setNotaPagamento('')

  await caricaPagamentiOperai()
  alert('Pagamento operaio salvato')
}

const preparaPagamentoRapidoOperaio = (
  operaio: string,
  importo: number,
  tipo: 'saldo' | 'acconto' = 'saldo'
) => {
  if (!operaio) return

  const importoPulito = Math.max(0, Number(importo || 0))

  setOperaioPagamento(operaio)
  setImportoPagamento(
    importoPulito.toLocaleString('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
  setDataPagamento(oggi)
  setMetodoPagamento('')
  setNotaPagamento(
    tipo === 'saldo'
      ? `Saldo maturato${pagamentiDataDa || pagamentiDataA ? ' periodo filtrato' : ''}`
      : 'Acconto operaio'
  )
}
  const caricaCantieri = async () => {
    const { data, error } = await supabase
      .from('cantieri')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      alert('Errore caricamento cantieri: ' + error.message)
      return
    }

    setCantieri((data || []) as Cantiere[])
  }

const eliminaPagamentoOperaio = async (id?: string) => {
  if (!id) return

  const conferma = confirm('Vuoi eliminare questo pagamento operaio?')
  if (!conferma) return

  const { error } = await supabase
    .from('pagamenti_operai')
    .delete()
    .eq('id', id)

  if (error) {
    alert('Errore eliminazione pagamento: ' + error.message)
    return
  }

  await caricaPagamentiOperai()
  alert('Pagamento eliminato')
}

  const caricaRapportini = async () => {
    const { data, error } = await supabase
      .from('rapportini')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      alert('Errore caricamento rapportini: ' + error.message)
      return
    }

    const lista = (data || []) as Rapportino[]
    setRapportini(lista)
    setUltimoRapportino(lista.length > 0 ? lista[0] : null)
  }

const caricaFotoCantiere = async () => {
  const { data, error } = await supabase
    .from('foto_cantiere')
  .select(
  'id,cantiere,nota,data_foto,geolocalizzazione,created_at,categoria,file_url,file_path,thumbnail_url,storage_provider,sync_status,rapportino_id'
)
    .order('created_at', { ascending: false })
    .limit(80)

 if (error) {
  console.error('Errore caricamento foto:', error.message)
  setFotoCantiere([])
  return
}

console.log('FOTO CARICATE', data)
console.log('NUMERO FOTO', data?.length)

 setFotoCantiere(
  ((data || []).map((foto: any) => ({
    ...foto,
    immagine_base64: foto.file_url || foto.thumbnail_url || '',
  }))) as FotoCantiere[]
)
}
  const caricaOperai = async () => {
    const { data, error } = await supabase
      .from('operai')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      alert('Errore caricamento operai: ' + error.message)
      return
    }

    setOperaiAnagrafica((data || []) as Operaio[])
  }

  const caricaTimbrature = async () => {
    const { data, error } = await supabase
      .from('timbrature')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      alert('Errore caricamento timbrature: ' + error.message)
      return
    }

    setTimbrature((data || []) as Timbratura[])
  }


const caricaFotoRapportinoDaInput = (e: ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || [])
  if (files.length === 0) return

  files.forEach((file) => {
    const reader = new FileReader()

    reader.onload = () => {
      setFotoRapportinoTemp((foto) => [
        ...foto,
        String(reader.result || ''),
      ])
    }

    reader.readAsDataURL(file)
  })

  e.target.value = ''
}

const scattaFotoCantiere = () => {
  const webcam = webcamFotoCantiereRef.current

  if (!webcam) {
    alert('Fotocamera non pronta')
    return
  }

  const immagine = webcam.getScreenshot()

  if (!immagine) {
    alert('Attendi 1 secondo dopo aver aperto la fotocamera e riprova')
    return
  }

  setFotoDaCaricare((prev) => [...prev, immagine])
}

const scattaFotoSopralluogo = () => {
  const immagine =
    webcamSopralluogoRef.current?.getScreenshot()

  if (!immagine) {
    alert('Impossibile scattare foto')
    return
  }

  setFotoSopralluogoTemp((foto) => [
    ...foto,
    immagine,
  ])
}

const scattaFotoRapportino = () => {
  const immagine = webcamRapportinoRef.current?.getScreenshot()

  if (!immagine) {
    alert('Impossibile scattare la foto')
    return
  }

  setFotoRapportinoTemp((foto) => [
    ...foto,
    immagine,
  ])
}


const caricaFotoDaInput = (e: ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || [])
  if (files.length === 0) {
    alert('File mancante: seleziona almeno una foto')
    return
  }

  files.forEach((file) => {
    if (!file.type.startsWith('image/')) {
      alert(`File non valido: ${file.name} non è un'immagine`)
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== 'string' || !reader.result.startsWith('data:image/')) {
        alert(`File non leggibile: ${file.name}`)
        return
      }

      setFotoDaCaricare((foto) => [
        ...foto,
        reader.result as string,
      ])
    }

    reader.onerror = () => {
      alert(`Errore lettura file: ${file.name}`)
    }

    reader.readAsDataURL(file)
  })

  e.target.value = ''
}


const rilevaPosizioneFoto = () => {
  if (!navigator.geolocation) {
    alert('Geolocalizzazione non supportata da questo dispositivo')
    return
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(6)
      const lng = pos.coords.longitude.toFixed(6)
      setGeolocalizzazioneFoto(`${lat}, ${lng}`)
    },
    () => {
      alert('Impossibile rilevare la posizione')
    }
  )
}



const [mostraPreventiviCantiere, setMostraPreventiviCantiere] = useState(true)
const [mostraMaterialiCantiere, setMostraMaterialiCantiere] = useState(false)
const [mostraAttrezziCantiere, setMostraAttrezziCantiere] = useState(false)

  const caricaEconomia = async () => {
    const { data: p, error: errP } = await supabase
      .from('preventivi_cantiere')
      .select('*')
      .order('created_at', { ascending: false })

    const { data: m, error: errM } = await supabase
      .from('materiali_cantiere')
      .select('*')
      .order('created_at', { ascending: false })

    const { data: a, error: errA } = await supabase
      .from('attrezzi_cantiere')
      .select('*')
      .order('created_at', { ascending: false })

    if (errP) {
      alert('Errore caricamento preventivi: ' + errP.message)
      return
    }

    if (errM) {
      alert('Errore caricamento materiali: ' + errM.message)
      return
    }

    if (errA) {
      alert('Errore caricamento attrezzi: ' + errA.message)
      return
    }

    setPreventivi((p || []) as PreventivoCantiere[])
    setMaterialiCantiere((m || []) as MaterialeCantiere[])
    setAttrezziCantiere((a || []) as AttrezzoCantiere[])
  }

  const resetFormRapportino = () => {
    setRapportinoInModifica(null)
    setCantiereRapporto('')
    setData('')
    setOre('')
    setNote('')
    setOperai('')
    setNumeroPresenti('')
    setOrePerOperaio('')
    setMateriali('')
    setQuantitaMateriali('')
    setCostoMateriali('')
  }

  const resetFormFoto = () => {
    setFotoInModifica(null)
    setCantiereFoto('')
    setNotaFoto('')
    setImmagineBase64('')
    setDataFoto('')
    setGeolocalizzazione('')
  }


const avviaDettaturaMateriali = () => {
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition

  if (!SpeechRecognition) {
    alert('Dettatura non supportata')
    return
  }

  const recognition = new SpeechRecognition()

  recognition.lang = 'it-IT'
  recognition.continuous = true
  recognition.interimResults = false

  recognition.onresult = (event: any) => {
    let testo = ''

    for (let i = event.resultIndex; i < event.results.length; i++) {
      testo += event.results[i][0].transcript + ' '
    }

    setMateriali((prev) => (prev ? prev + ' ' + testo : testo))
  }

  recognition.onend = () => {
    setAscoltoMateriali(false)
  }

  recognition.start()

  setRecognitionMateriali(recognition)
  setAscoltoMateriali(true)
}

const fermaDettaturaMateriali = () => {
  recognitionMateriali?.stop()
  setAscoltoMateriali(false)
}




const avviaDettatura = (
  callback: (testo: string) => void
) => {
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition

  if (!SpeechRecognition) {
    alert('Dettatura vocale non supportata')
    return
  }

  const recognition = new SpeechRecognition()

  recognition.lang = 'it-IT'
  recognition.continuous = false
  recognition.interimResults = false
  recognition.maxAlternatives = 1

  recognition.onresult = (event: any) => {
    const testo =
      event.results?.[0]?.[0]?.transcript || ''

    if (testo.trim()) {
      callback(testo)
    }
  }

  recognition.start()
}



const avviaAssistenteVocale = () => {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

  if (!SpeechRecognition) {
    alert('Il riconoscimento vocale non è supportato da questo browser. Usa Chrome o Edge.')
    return
  }

  const recognition = new SpeechRecognition()
  recognition.lang = 'it-IT'
  recognition.continuous = true
  recognition.interimResults = true

  setRecognitionAssistente(recognition)

  recognition.onstart = () => {
    setAssistenteAttivo(true)
  }

  recognition.onresult = (event: any) => {
    let testo = ''

    for (let i = event.resultIndex; i < event.results.length; i++) {
      testo += event.results[i][0].transcript.toLowerCase()
    }

    console.log('ASSISTENTE HA SENTITO:', testo)

  if (
  testo.includes('rapportino') ||
  testo.includes('rapporto')
) {
  setSezioneAttiva('rapportini')
}

if (
  testo.includes('economia')
) {
  setSezioneAttiva('economia')
}

if (
  testo.includes('timbrature')
) {
  setSezioneAttiva('operai')
  setSottoSezioneOperai('timbrature')
}

if (
  testo.includes('presenze')
) {
  setSezioneAttiva('operai')
  setSottoSezioneOperai('presenze')
}

if (
  testo.includes('dashboard') ||
  testo.includes('home')
) {
  setSezioneAttiva('home')
}

if (
  testo.includes('stop rapportino')
) {
  fermaDettaturaRapportino()
}
  }

  recognition.onerror = () => {
    setAssistenteAttivo(false)
  }

  recognition.onend = () => {
    setAssistenteAttivo(false)
  }

  recognition.start()
}


const fermaAssistenteVocale = () => {
  if (recognitionAssistente) {
    recognitionAssistente.stop()
  }

  setAssistenteAttivo(false)
}


const avviaDettaturaNoteFoto = () => {
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition

  if (!SpeechRecognition) {
    alert('Dettatura non supportata')
    return
  }

  const recognition = new SpeechRecognition()

  recognition.lang = 'it-IT'
  recognition.continuous = true
  recognition.interimResults = false

  recognition.onresult = (event: any) => {
    let testo = ''

    for (
      let i = event.resultIndex;
      i < event.results.length;
      i++
    ) {
      testo += event.results[i][0].transcript + ' '
    }

    setNotaFotoRapportino((prev) =>
      prev ? prev + ' ' + testo : testo
    )
  }

  recognition.onend = () => {
    setAscoltoNoteFoto(false)
  }

  recognition.start()

  setRecognitionNoteFoto(recognition)
  setAscoltoNoteFoto(true)
}



const fermaDettaturaNoteFoto = () => {
  recognitionNoteFoto?.stop()
  setAscoltoNoteFoto(false)
}




const avviaDettaturaRapportino = () => {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

  if (!SpeechRecognition) {
    alert('Il riconoscimento vocale non è supportato da questo browser. Usa Chrome o Edge.')
    return
  }

  const recognition = new SpeechRecognition()
  setRecognitionRapportino(recognition)

  recognition.lang = 'it-IT'
  recognition.continuous = true
  recognition.interimResults = true

  let testoFinale = ''
  let ultimaFraseFinale = ''

  recognition.onstart = () => {
    setAscoltoRapportino(true)
    setTestoVoceRapportino('')
  }

  recognition.onresult = (event: any) => {
    let testoTemporaneo = ''

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const frase = String(event.results[i][0].transcript || '').trim()

      if (!frase) continue

      if (event.results[i].isFinal) {
        if (frase !== ultimaFraseFinale) {
          testoFinale = cleanDictationText(`${testoFinale} ${frase}`)
          ultimaFraseFinale = frase
        }
      } else {
        testoTemporaneo = frase
      }
    }

    const testoCompleto = cleanDictationText(
      `${testoFinale} ${testoTemporaneo}`
    )
    setTestoVoceRapportino(testoCompleto)
  }

  recognition.onerror = () => {
    alert('Errore durante il riconoscimento vocale')
  }

  recognition.onend = () => {
    setAscoltoRapportino(false)

    const testoPulito = cleanDictationText(testoFinale)

    if (testoPulito) {
      setNote((prev) => {
        const vecchio = prev?.trim() || ''

        if (vecchio.includes(testoPulito)) {
          return vecchio
        }

        return vecchio ? `${vecchio}\n${testoPulito}` : testoPulito
      })
    }
  }

  recognition.start()
}
const fermaDettaturaRapportino = () => {
  if (recognitionRapportino) {
    recognitionRapportino.stop()
  }

  setAscoltoRapportino(false)
}

const compilaRapportinoConAI = async () => {
  if (!testoVoceRapportino.trim()) {
    alert('Prima detta il rapportino')
    return
  }

  const res = await fetch('/api/analizza-rapportino', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
   body: JSON.stringify({
  testo: testoVoceRapportino,
  cantieri: cantieri.map((c) => c.nome),
  operai: operaiAnagrafica.map((o) => o.nome),
  modello: modelloAiPredefinito,
}),
  })

 const dati = await res.json()

if (!res.ok) {
  alert('Errore AI: ' + dati.error)
  return
}

await caricaUtilizzoAi()

if (dati.cantiere) setCantiereRapporto(dati.cantiere)

  if (dati.cantiere) setCantiereRapporto(dati.cantiere)
  if (dati.data) setData(dati.data)
  if (dati.ore) setOre(dati.ore)
  if (dati.note) setNote(dati.note)
  if (dati.operai) setOperai(dati.operai)
  if (dati.materiali) setMateriali(dati.materiali)
  if (dati.costoMateriali) setCostoMateriali(dati.costoMateriali)

  alert('Rapportino compilato con AI')
}

  const aggiungiCantiere = async () => {
    if (!nomeCantiere.trim()) return

    const { error } = await supabase
      .from('cantieri')
     .insert([{
  nome: nomeCantiere.trim(),
  preventivo: parseFloat(preventivoCantiereInput) || 0,
}])

    if (error) {
      alert('Errore salvataggio cantiere: ' + error.message)
      return
    }
setPreventivoCantiereInput('')
    setNomeCantiere('')
    await caricaCantieri()
await caricaEconomia()
setCantiereScheda((prev) => prev)
  }


const aggiungiVociAnalizzateComeMateriali = async () => {
  if (!cantiereScheda) {
    alert('Seleziona prima un cantiere')
    return
  }

  if (vociAnalizzate.length === 0) {
    alert('Non ci sono voci analizzate da salvare')
    return
  }

  const conferma = confirm(
    `Vuoi salvare ${vociAnalizzate.length} voci come materiali del cantiere "${cantiereScheda}"?`
  )

  if (!conferma) return

  const records = vociAnalizzate
    .filter((voce) => voce.descrizione && voce.quantita !== undefined && voce.prezzo !== undefined)
    .map((voce) => ({
      cantiere: cantiereScheda,
  descrizione: nomeFileAnalisiDocumento || 'Scontrino attrezzo',
  quantita: 1,
 prezzo_unitario: estraiTotaleScontrino(testoEstrattoDocumento) || 0,
totale: estraiTotaleScontrino(testoEstrattoDocumento) || 0,
  fornitore: 'Documento analizzato',
  data_documento: oggi,
  nome_file: nomeFileAnalisiDocumento || 'Documento analizzato',
  nota: 'Importato automaticamente da scontrino',
    }))

  if (records.length === 0) {
    alert('Le voci analizzate non sono complete')
    return
  }

  const { error } = await supabase.from('materiali_cantiere').insert(records)

  if (error) {
    alert('Errore nel salvataggio delle voci analizzate: ' + error.message)
    return
  }

  await caricaEconomia()
  alert('Voci analizzate salvate come materiali')
}

const aggiungiVociAnalizzateComeAttrezzi = async () => {
  if (!cantiereScheda) {
    alert('Seleziona prima un cantiere')
    return
  }

  if (vociAnalizzate.length === 0) {
    alert('Non ci sono voci analizzate da salvare')
    return
  }

  const conferma = confirm(
    `Vuoi salvare ${vociAnalizzate.length} voci come attrezzi del cantiere "${cantiereScheda}"?`
  )

  if (!conferma) return

  const records = vociAnalizzate
    .filter((voce) => voce.descrizione && voce.quantita !== undefined && voce.prezzo !== undefined)
    .map((voce) => ({
      cantiere: cantiereScheda,
      descrizione: voce.descrizione,
      quantita: Number(voce.quantita || 1),
      prezzo_unitario: Number(voce.prezzo || 0),
      totale: Number(voce.quantita || 1) * Number(voce.prezzo || 0),
      fornitore: 'Documento analizzato',
      data_documento: oggi,
      nome_file: nomeFileAnalisiDocumento || 'Documento analizzato',
      nota: 'Importato da analisi documento',
    }))

  if (records.length === 0) {
    alert('Le voci analizzate non sono complete')
    return
  }

  const { error } = await supabase.from('attrezzi_cantiere').insert(records)

  if (error) {
    alert('Errore nel salvataggio delle voci come attrezzi: ' + error.message)
    return
  }

  await caricaEconomia()
  alert('Voci analizzate salvate come attrezzi')
}

const eliminaVociImportate = async () => {
  if (!cantiereScheda) {
    alert('Seleziona prima un cantiere')
    return
  }

  const conferma = confirm(
    `Vuoi eliminare tutte le voci importate da documento per il cantiere "${cantiereScheda}"?`
  )

  if (!conferma) return

  const { error } = await supabase
    .from('materiali_cantiere')
    .delete()
    .eq('cantiere', cantiereScheda)
    .eq('fornitore', 'Documento analizzato')

  if (error) {
    alert('Errore durante eliminazione: ' + error.message)
    return
  }

  await caricaEconomia()
  alert('Voci importate eliminate')
}
  const aggiungiOperaio = async () => {
    if (!nomeOperaio.trim()) {
      alert('Inserisci il nome dell’operaio')
      return
    }

    if (!pinOperaio.trim()) {
      alert('Inserisci un PIN per l’operaio')
      return
    }

    const { data: esistente, error: erroreCheck } = await supabase
      .from('operai')
      .select('*')
      .eq('pin', pinOperaio.trim())

    if (erroreCheck) {
      alert('Errore controllo PIN: ' + erroreCheck.message)
      return
    }

    if (esistente && esistente.length > 0) {
      alert('Questo PIN è già usato da un altro operaio')
      return
    }

    const costo = parseFloat(String(costoOrarioOperaio).replace(',', '.'))
    const costoPulito = isNaN(costo) ? 0 : costo

    const { error } = await supabase
      .from('operai')
      .insert([
        {
          nome: nomeOperaio.trim(),
          telefono: telefonoOperaio.trim(),
          qualifica: qualificaOperaio.trim(),
          pin: pinOperaio.trim(),
          nota: notaOperaio.trim(),
          stato: statoOperaio,
          costo_orario: costoPulito,
        },
      ])

    if (error) {
      alert('Errore salvataggio operaio: ' + error.message)
      return
    }

    setNomeOperaio('')
    setTelefonoOperaio('')
    setQualificaOperaio('')
    setPinOperaio('')
    setNotaOperaio('')
    setStatoOperaio('attivo')
    setCostoOrarioOperaio('')
    await caricaOperai()
    alert('Operaio salvato')
  }

  const preparaModificaOperaio = (operaio: Operaio) => {
    setOperaioInModifica(operaio.id || null)
    setNomeOperaioModifica(operaio.nome || '')
    setTelefonoOperaioModifica(operaio.telefono || '')
    setQualificaOperaioModifica(operaio.qualifica || '')
    setPinOperaioModifica(operaio.pin || '')
    setNotaOperaioModifica(operaio.nota || '')
    setStatoOperaioModifica(operaio.stato || 'attivo')
    setCostoOrarioOperaioModifica(
      operaio.costo_orario !== undefined && operaio.costo_orario !== null
        ? String(operaio.costo_orario)
        : ''
    )
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const annullaModificaOperaio = () => {
    setOperaioInModifica(null)
    setNomeOperaioModifica('')
    setTelefonoOperaioModifica('')
    setQualificaOperaioModifica('')
    setPinOperaioModifica('')
    setNotaOperaioModifica('')
    setStatoOperaioModifica('attivo')
    setCostoOrarioOperaioModifica('')
  }



  const salvaModificaOperaio = async () => {
    if (!operaioInModifica) {
      alert('Nessun operaio selezionato')
      return
    }

    if (!nomeOperaioModifica.trim()) {
      alert('Inserisci il nome dell’operaio')
      return
    }

    if (!pinOperaioModifica.trim()) {
      alert('Inserisci il PIN dell’operaio')
      return
    }

    const { data: duplicati, error: erroreCheck } = await supabase
      .from('operai')
      .select('*')
      .eq('pin', pinOperaioModifica.trim())

    if (erroreCheck) {
      alert('Errore controllo PIN: ' + erroreCheck.message)
      return
    }

    const pinUsatoDaAltro = duplicati && duplicati.some((o) => o.id !== operaioInModifica)

    if (pinUsatoDaAltro) {
      alert('Questo PIN è già usato da un altro operaio')
      return
    }

    const costo = parseFloat(String(costoOrarioOperaioModifica).replace(',', '.'))
    const costoPulito = isNaN(costo) ? 0 : costo

    const { error } = await supabase
      .from('operai')
      .update({
        nome: nomeOperaioModifica.trim(),
        telefono: telefonoOperaioModifica.trim(),
        qualifica: qualificaOperaioModifica.trim(),
        pin: pinOperaioModifica.trim(),
        nota: notaOperaioModifica.trim(),
        stato: statoOperaioModifica,
        costo_orario: costoPulito,
      })
      .eq('id', operaioInModifica)

    if (error) {
      alert('Errore modifica operaio: ' + error.message)
      return
    }

    annullaModificaOperaio()
    await caricaOperai()
    alert('Operaio modificato correttamente')
  }


const preparaModificaRegistroOperaio = (o: Operaio) => {
  setOperaioRegistroEdit(o.id || null)
  setOperaioRegistroNome(o.nome || '')
  setOperaioRegistroTelefono(o.telefono || '')
  setOperaioRegistroQualifica(o.qualifica || '')
  setOperaioRegistroCosto(String(o.costo_orario || ''))
}

const annullaModificaRegistroOperaio = () => {
  setOperaioRegistroEdit(null)
  setOperaioRegistroNome('')
  setOperaioRegistroTelefono('')
  setOperaioRegistroQualifica('')
  setOperaioRegistroCosto('')
}

const salvaModificaRegistroOperaio = async (id?: string) => {
  if (!id) return

  const costo = parseFloat(String(operaioRegistroCosto).replace(',', '.'))

  const { error } = await supabase
    .from('operai')
    .update({
      nome: operaioRegistroNome.trim(),
      telefono: operaioRegistroTelefono.trim(),
      qualifica: operaioRegistroQualifica.trim(),
      costo_orario: isNaN(costo) ? 0 : costo,
    })
    .eq('id', id)

  if (error) {
    alert('Errore modifica operaio: ' + error.message)
    return
  }

  annullaModificaRegistroOperaio()
  await caricaOperai()
  alert('Operaio aggiornato')
}


const preparaModificaRegistroPagamentoOperaio = (p: any) => {
  setPagamentoOperaioRegistroEdit(String(p.id))
  setPagamentoOperaioRegistroNome(p.operaio_nome || '')
  setPagamentoOperaioRegistroImporto(String(p.importo || ''))
  setPagamentoOperaioRegistroData(p.data_pagamento || '')
  setPagamentoOperaioRegistroMetodo(p.metodo || '')
  setPagamentoOperaioRegistroNota(p.nota || '')
}

const annullaModificaRegistroPagamentoOperaio = () => {
  setPagamentoOperaioRegistroEdit(null)
  setPagamentoOperaioRegistroNome('')
  setPagamentoOperaioRegistroImporto('')
  setPagamentoOperaioRegistroData('')
  setPagamentoOperaioRegistroMetodo('')
  setPagamentoOperaioRegistroNota('')
}

const salvaModificaRegistroPagamentoOperaio = async (id?: string) => {
  if (!id) return

  const { error } = await supabase
    .from('pagamenti_operai')
    .update({
      operaio_nome: pagamentoOperaioRegistroNome,
      importo: parseImporto(pagamentoOperaioRegistroImporto),
      data_pagamento: pagamentoOperaioRegistroData || null,
      metodo: pagamentoOperaioRegistroMetodo,
      nota: pagamentoOperaioRegistroNota,
    })
    .eq('id', id)

  if (error) {
    alert('Errore modifica pagamento operaio: ' + error.message)
    return
  }

  annullaModificaRegistroPagamentoOperaio()
  await caricaPagamentiOperai()
  alert('Pagamento operaio aggiornato')
}

const preparaModificaRegistroRapportino = (r: any) => {
  setRapportinoRegistroEdit(String(r.id))
  setRapportinoRegistroData(r.data || '')
  setRapportinoRegistroCantiere(r.cantiere || '')
  setRapportinoRegistroOperaio(r.operai || '')
  setRapportinoRegistroOre(String(r.ore || ''))
  setRapportinoRegistroDescrizione(r.note || '')
}

const annullaModificaRegistroRapportino = () => {
  setRapportinoRegistroEdit(null)
  setRapportinoRegistroData('')
  setRapportinoRegistroCantiere('')
  setRapportinoRegistroOperaio('')
  setRapportinoRegistroOre('')
  setRapportinoRegistroDescrizione('')
}

const salvaModificaRegistroRapportino = async (id?: string) => {
  if (!id) return

  const { error } = await supabase
    .from('rapportini')
    .update({
      data: rapportinoRegistroData || null,
      cantiere: rapportinoRegistroCantiere,
      operai: rapportinoRegistroOperaio,
      ore: parseImporto(rapportinoRegistroOre),
      note: rapportinoRegistroDescrizione,
    })
    .eq('id', id)

  if (error) {
    alert('Errore modifica rapportino: ' + error.message)
    return
  }

  annullaModificaRegistroRapportino()
  await caricaRapportini()
  alert('Rapportino aggiornato')
}

const preparaModificaRegistroTimbratura = (t: any) => {
  setTimbraturaRegistroEdit(String(t.id))
  setTimbraturaRegistroData(t.data || '')
  setTimbraturaRegistroOperaio(t.operaio_nome || '')
  setTimbraturaRegistroCantiere(t.cantiere || '')
  setTimbraturaRegistroEntrata(t.ora_entrata || '')
  setTimbraturaRegistroUscita(t.ora_uscita || '')
  setTimbraturaRegistroOre(String(t.ore_totali || ''))
}

const annullaModificaRegistroTimbratura = () => {
  setTimbraturaRegistroEdit(null)
  setTimbraturaRegistroData('')
  setTimbraturaRegistroOperaio('')
  setTimbraturaRegistroCantiere('')
  setTimbraturaRegistroEntrata('')
  setTimbraturaRegistroUscita('')
  setTimbraturaRegistroOre('')
}

const salvaModificaRegistroTimbratura = async (id?: string) => {
  if (!id) return

  const { error } = await supabase
    .from('timbrature')
    .update({
      data: timbraturaRegistroData || null,
      operaio_nome: timbraturaRegistroOperaio,
      cantiere: timbraturaRegistroCantiere,
      ora_entrata: timbraturaRegistroEntrata,
      ora_uscita: timbraturaRegistroUscita,
    })
    .eq('id', id)

  if (error) {
    alert('Errore modifica timbratura: ' + error.message)
    return
  }

  annullaModificaRegistroTimbratura()
  await caricaTimbrature()
  alert('Timbratura aggiornata')
}

const cambiaOrdinamentoOperai = (
  campo: 'data' | 'operaio' | 'entrata' | 'uscita' | 'ore' | 'costo'
) => {
  if (ordineOperai === campo) {
    setDirezioneOperai(
      direzioneOperai === 'asc' ? 'desc' : 'asc'
    )
  } else {
    setOrdineOperai(campo)
    setDirezioneOperai('asc')
  }
}

const cambiaOrdinamentoCantieri = (
  campo: 'nome' | 'preventivo' | 'inizio' | 'fine' | 'concluso'
) => {
  if (ordinaCantieriCampo === campo) {
    setOrdinaCantieriDirezione((d) =>
      d === 'asc' ? 'desc' : 'asc'
    )
  } else {
    setOrdinaCantieriCampo(campo)
    setOrdinaCantieriDirezione('asc')
  }
}

  const cambiaStatoOperaio = async (operaio: Operaio, nuovoStato: 'attivo' | 'sospeso') => {
    if (!operaio.id) return

    const { error } = await supabase
      .from('operai')
      .update({ stato: nuovoStato })
      .eq('id', operaio.id)

    if (error) {
      alert('Errore aggiornamento stato operaio: ' + error.message)
      return
    }

    await caricaOperai()
    alert(`Operaio ${nuovoStato === 'attivo' ? 'riattivato' : 'sospeso'}`)
  }


const coloreStatoSopralluogo = (
  stato?: string
) => {
  if (stato === 'convertito_in_cantiere')
    return '#15803d'

  if (stato === 'preventivo_creato')
    return '#2563eb'

  if (stato === 'da_preventivare')
    return '#d97706'

  return '#6b7280'
}


  const eliminaOperaio = async (id?: string) => {
    if (!id) return

    const conferma = confirm('Vuoi eliminare questo operaio?')
    if (!conferma) return

    const { error } = await supabase.from('operai').delete().eq('id', id)

    if (error) {
      alert('Errore eliminazione operaio: ' + error.message)
      return
    }

    await caricaOperai()
    alert('Operaio eliminato')
  }

  const timbraEntrata = async () => {
    if (!operaioTimbratura || !cantiereTimbratura) {
      alert('Seleziona operaio e cantiere')
      return
    }

    const { data: aperte, error: errCheck } = await supabase
      .from('timbrature')
      .select('*')
      .eq('operaio_nome', operaioTimbratura)
      .eq('cantiere', cantiereTimbratura)
      .eq('data', oggi)
      .eq('stato', 'aperto')

    if (errCheck) {
      alert('Errore controllo timbratura: ' + errCheck.message)
      return
    }

    if (aperte && aperte.length > 0) {
      alert('Esiste già una timbratura aperta per questo operaio')
      return
    }

    const { error } = await supabase.from('timbrature').insert([
      {
        operaio_nome: operaioTimbratura,
        cantiere: cantiereTimbratura,
        data: oggi,
        ora_entrata: oraAttuale(),
        stato: 'aperto',
      },
    ])

    if (error) {
      alert('Errore timbratura entrata: ' + error.message)
      return
    }

    await caricaTimbrature()
    alert('Entrata registrata')
  }

  const timbraUscita = async () => {
    if (!operaioTimbratura || !cantiereTimbratura) {
      alert('Seleziona operaio e cantiere')
      return
    }

    const { data: aperte, error: errFind } = await supabase
      .from('timbrature')
      .select('*')
      .eq('operaio_nome', operaioTimbratura)
      .eq('cantiere', cantiereTimbratura)
      .eq('data', oggi)
      .eq('stato', 'aperto')
      .order('created_at', { ascending: false })

    if (errFind) {
      alert('Errore ricerca timbratura aperta: ' + errFind.message)
      return
    }

    if (!aperte || aperte.length === 0) {
      alert('Nessuna entrata aperta trovata')
      return
    }

    const timbraturaAperta = aperte[0]

    const { error } = await supabase
      .from('timbrature')
      .update({
        ora_uscita: oraAttuale(),
        stato: 'chiuso',
      })
      .eq('id', timbraturaAperta.id)

    if (error) {
      alert('Errore timbratura uscita: ' + error.message)
      return
    }

    await caricaTimbrature()
    alert('Uscita registrata')
  }

  const timbraEntrataConPin = async () => {
    if (!pinTimbratura.trim() || !cantiereTimbratura) {
      alert('Inserisci PIN e seleziona il cantiere')
      return
    }

    const { data: operaiTrovati, error: erroreOperaio } = await supabase
      .from('operai')
      .select('*')
      .eq('pin', pinTimbratura.trim())

    if (erroreOperaio) {
      alert('Errore ricerca operaio: ' + erroreOperaio.message)
      return
    }

    if (!operaiTrovati || operaiTrovati.length === 0) {
      alert('PIN non valido')
      return
    }

    const operaio = operaiTrovati[0]

    if (operaio.stato === 'sospeso') {
      alert(`L'operaio ${operaio.nome} è sospeso`)
      return
    }

    const { data: aperte, error: errCheck } = await supabase
      .from('timbrature')
      .select('*')
      .eq('operaio_nome', operaio.nome)
      .eq('cantiere', cantiereTimbratura)
      .eq('data', oggi)
      .eq('stato', 'aperto')

    if (errCheck) {
      alert('Errore controllo timbratura: ' + errCheck.message)
      return
    }

    if (aperte && aperte.length > 0) {
      alert(`Esiste già una timbratura aperta per ${operaio.nome}`)
      return
    }

    const { error } = await supabase.from('timbrature').insert([
      {
        operaio_nome: operaio.nome,
        cantiere: cantiereTimbratura,
        data: oggi,
        ora_entrata: oraAttuale(),
        stato: 'aperto',
      },
    ])

    if (error) {
      alert('Errore timbratura entrata: ' + error.message)
      return
    }

    setPinTimbratura('')
    await caricaTimbrature()
    alert(`Entrata registrata per ${operaio.nome}`)
  }

  const timbraUscitaConPin = async () => {
    if (!pinTimbratura.trim() || !cantiereTimbratura) {
      alert('Inserisci PIN e seleziona il cantiere')
      return
    }

    const { data: operaiTrovati, error: erroreOperaio } = await supabase
      .from('operai')
      .select('*')
      .eq('pin', pinTimbratura.trim())

    if (erroreOperaio) {
      alert('Errore ricerca operaio: ' + erroreOperaio.message)
      return
    }

    if (!operaiTrovati || operaiTrovati.length === 0) {
      alert('PIN non valido')
      return
    }

    const operaio = operaiTrovati[0]

    const { data: aperte, error: errFind } = await supabase
      .from('timbrature')
      .select('*')
      .eq('operaio_nome', operaio.nome)
      .eq('cantiere', cantiereTimbratura)
      .eq('data', oggi)
      .eq('stato', 'aperto')
      .order('created_at', { ascending: false })

    if (errFind) {
      alert('Errore ricerca timbratura aperta: ' + errFind.message)
      return
    }

    if (!aperte || aperte.length === 0) {
      alert(`Nessuna entrata aperta trovata per ${operaio.nome}`)
      return
    }

    const timbraturaAperta = aperte[0]

    const { error } = await supabase
      .from('timbrature')
      .update({
        ora_uscita: oraAttuale(),
        stato: 'chiuso',
      })
      .eq('id', timbraturaAperta.id)

    if (error) {
      alert('Errore timbratura uscita: ' + error.message)
      return
    }

    setPinTimbratura('')
    await caricaTimbrature()
    alert(`Uscita registrata per ${operaio.nome}`)
  }

  const eliminaTimbratura = async (id?: string) => {
    if (!id) return

    const conferma = confirm('Vuoi eliminare questa timbratura?')
    if (!conferma) return

    const { error } = await supabase.from('timbrature').delete().eq('id', id)

    if (error) {
      alert('Errore eliminazione timbratura: ' + error.message)
      return
    }

    await caricaTimbrature()
    alert('Timbratura eliminata')
  }

  const compilaRapportinoDaTimbrature = () => {
    if (!cantiereRapporto) {
      alert('Seleziona prima un cantiere nel rapportino')
      return
    }

    const timbratureDelCantiere = timbrature.filter(
      (t) => t.cantiere === cantiereRapporto && t.data === oggi
    )

    if (timbratureDelCantiere.length === 0) {
      alert('Nessuna timbratura trovata oggi per questo cantiere')
      return
    }

    const mappaOperai = new Map<string, number>()

    timbratureDelCantiere.forEach((t) => {
      const nome = t.operaio_nome?.trim()
      if (!nome) return

      const entrata = parseOra(t.ora_entrata)
      const uscita = parseOra(t.ora_uscita)

      if (entrata === null) return

      let minutiLavorati = 0
      if (uscita !== null && uscita >= entrata) {
        minutiLavorati = uscita - entrata
      }

      const attuale = mappaOperai.get(nome) || 0
      mappaOperai.set(nome, attuale + minutiLavorati)
    })

    const nomiOperai = Array.from(mappaOperai.keys())

    if (nomiOperai.length === 0) {
      alert('Nessun operaio valido trovato nelle timbrature di oggi')
      return
    }

    const totaleMinuti = Array.from(mappaOperai.values()).reduce((a, b) => a + b, 0)
    const totaleOreNumero = totaleMinuti / 60

    const dettaglioOre = Array.from(mappaOperai.entries())
      .map(([nome, minuti]) => `${nome}: ${(minuti / 60).toFixed(2)} h`)
      .join(' | ')

    setOperai(nomiOperai.join(', '))
    setNumeroPresenti(String(nomiOperai.length))
    setOre(totaleOreNumero.toFixed(2))
    setOrePerOperaio(dettaglioOre)
    setData(oggi)

    alert('Rapportino compilato automaticamente dalle timbrature')
  }

  const preparaModificaCantiere = (nome: string) => {
    setCantiereDaModificare(nome)
    setNuovoNomeCantiere(nome)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const salvaModificaCantiere = async () => {
    if (!cantiereDaModificare || !nuovoNomeCantiere.trim()) {
      alert('Seleziona un cantiere e scrivi il nuovo nome')
      return
    }

    const nuovoNome = nuovoNomeCantiere.trim()

    if (cantiereDaModificare === nuovoNome) {
      alert('Il nuovo nome è uguale a quello attuale')
      return
    }

    const { error: errorCantieri } = await supabase
      .from('cantieri')
      .update({ nome: nuovoNome })
      .eq('nome', cantiereDaModificare)

    if (errorCantieri) {
      alert('Errore modifica cantiere: ' + errorCantieri.message)
      return
    }

    const { error: errorRapportini } = await supabase
      .from('rapportini')
      .update({ cantiere: nuovoNome })
      .eq('cantiere', cantiereDaModificare)

    if (errorRapportini) {
      alert('Errore aggiornamento rapportini: ' + errorRapportini.message)
      return
    }

    const { error: errorFoto } = await supabase
      .from('foto_cantiere')
      .update({ cantiere: nuovoNome })
      .eq('cantiere', cantiereDaModificare)

    if (errorFoto) {
      alert('Errore aggiornamento foto: ' + errorFoto.message)
      return
    }

    const { error: errorTimbrature } = await supabase
      .from('timbrature')
      .update({ cantiere: nuovoNome })
      .eq('cantiere', cantiereDaModificare)

    if (errorTimbrature) {
      alert('Errore aggiornamento timbrature: ' + errorTimbrature.message)
      return
    }

    const { error: errorPreventivi } = await supabase
      .from('preventivi_cantiere')
      .update({ cantiere: nuovoNome })
      .eq('cantiere', cantiereDaModificare)

    if (errorPreventivi) {
      alert('Errore aggiornamento preventivi: ' + errorPreventivi.message)
      return
    }

    const { error: errorMateriali } = await supabase
      .from('materiali_cantiere')
      .update({ cantiere: nuovoNome })
      .eq('cantiere', cantiereDaModificare)

    if (errorMateriali) {
      alert('Errore aggiornamento materiali: ' + errorMateriali.message)
      return
    }

    const { error: errorAttrezzi } = await supabase
      .from('attrezzi_cantiere')
      .update({ cantiere: nuovoNome })
      .eq('cantiere', cantiereDaModificare)

    if (errorAttrezzi) {
      alert('Errore aggiornamento attrezzi: ' + errorAttrezzi.message)
      return
    }

    if (cantiereRapporto === cantiereDaModificare) setCantiereRapporto(nuovoNome)
    if (cantiereFoto === cantiereDaModificare) setCantiereFoto(nuovoNome)
    if (cantiereTimbratura === cantiereDaModificare) setCantiereTimbratura(nuovoNome)
    if (filtroCantiere === cantiereDaModificare) setFiltroCantiere(nuovoNome)
    if (cantiereScheda === cantiereDaModificare) setCantiereScheda(nuovoNome)

    setCantiereDaModificare('')
    setNuovoNomeCantiere('')

    await caricaCantieri()
    await caricaRapportini()
    await caricaFotoCantiere()
    await caricaTimbrature()
    await caricaEconomia()
    await caricaAcconti()

    alert('Cantiere modificato correttamente')
  }


const preparaModificaRegistroCantiere = (c: Cantiere) => {
  setCantiereRegistroEdit(c.id || null)
  setCantiereRegistroNome(c.nome || '')
  setCantiereRegistroPreventivo(String(c.preventivo || ''))
  setCantiereRegistroInizio(c.data_inizio_lavori || '')
  setCantiereRegistroFine(c.data_fine_lavori || '')
  setCantiereRegistroConcluso(Boolean(c.lavori_conclusi))
}

const annullaModificaRegistroCantiere = () => {
  setCantiereRegistroEdit(null)
  setCantiereRegistroNome('')
  setCantiereRegistroPreventivo('')
  setCantiereRegistroInizio('')
  setCantiereRegistroFine('')
  setCantiereRegistroConcluso(false)
}

const salvaModificaRegistroCantiere = async (id?: string) => {
  if (!id) return

  const preventivo = parseImporto(cantiereRegistroPreventivo)

  const { error } = await supabase
    .from('cantieri')
    .update({
      nome: cantiereRegistroNome.trim(),
      preventivo,
      data_inizio_lavori: cantiereRegistroInizio || null,
      data_fine_lavori: cantiereRegistroFine || null,
      lavori_conclusi: cantiereRegistroConcluso,
    })
    .eq('id', id)

  if (error) {
    alert('Errore modifica cantiere: ' + error.message)
    return
  }

  annullaModificaRegistroCantiere()
  await caricaCantieri()
  await caricaEconomia()
  alert('Cantiere aggiornato')
}

const salvaModificaRegistroPreventivo = async (id?: string) => {
  if (!id) return

  const { error } = await supabase
    .from('preventivi_cantiere')
    .update({
      cantiere: preventivoRegistroCantiere,
      nome_file: preventivoRegistroNomeFile,
      importo_totale: parseImporto(preventivoRegistroImporto),
      note: preventivoRegistroNote,
    })
    .eq('id', id)

  if (error) {
    alert('Errore modifica preventivo: ' + error.message)
    return
  }

  setPreventivoRegistroEdit(null)
  setPreventivoRegistroCantiere('')
  setPreventivoRegistroNomeFile('')
  setPreventivoRegistroImporto('')
  setPreventivoRegistroNote('')

  await caricaEconomia()
  alert('Preventivo aggiornato')
}


const eliminaPreventivoCantiere = async (id?: string) => {
  if (!id) return

  if (!confirm('Vuoi eliminare questo preventivo?')) return

  const { data: doc, error: errFetch } = await supabase
    .from('preventivi_cantiere')
    .select('file_path')
    .eq('id', id)
    .single()

  if (errFetch) {
    alert('Errore recupero file: ' + errFetch.message)
    return
  }

  try {
    await eliminaFileDaStorage(doc?.file_path)
  } catch {
    alert('Errore cancellazione file da Storage')
    return
  }

  const { error } = await supabase
    .from('preventivi_cantiere')
    .delete()
    .eq('id', id)

  if (error) {
    alert('Errore eliminazione preventivo: ' + error.message)
    return
  }

  await caricaEconomia()
  alert('Preventivo eliminato completamente')
}



  const eliminaCantiere = async (nome: string) => {
  const conferma = confirm(
    `Vuoi eliminare completamente il cantiere "${nome}"?\n\nVerranno eliminati:\n- cantiere\n- rapportini\n- foto\n- timbrature\n- preventivi\n- materiali\n- attrezzi\n- file collegati nello Storage`
  )

  if (!conferma) return

  // 1. Recupera tutti i file collegati al cantiere
  const { data: preventiviDaEliminare, error: errPrevFetch } = await supabase
    .from('preventivi_cantiere')
    .select('file_path')
    .eq('cantiere', nome)

  if (errPrevFetch) {
    alert('Errore recupero file preventivi: ' + errPrevFetch.message)
    return
  }

  const { data: materialiDaEliminare, error: errMatFetch } = await supabase
    .from('materiali_cantiere')
    .select('file_path')
    .eq('cantiere', nome)

  if (errMatFetch) {
    alert('Errore recupero file materiali: ' + errMatFetch.message)
    return
  }

  const { data: attrezziDaEliminare, error: errAttFetch } = await supabase
    .from('attrezzi_cantiere')
    .select('file_path')
    .eq('cantiere', nome)

  if (errAttFetch) {
    alert('Errore recupero file attrezzi: ' + errAttFetch.message)
    return
  }

  const filePaths = [
    ...(preventiviDaEliminare || []).map((x: any) => x.file_path),
    ...(materialiDaEliminare || []).map((x: any) => x.file_path),
    ...(attrezziDaEliminare || []).map((x: any) => x.file_path),
  ].filter(Boolean)

  // 2. Cancella i file dallo Storage
  if (filePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from('preventivi')
      .remove(filePaths)

    if (storageError) {
      alert('Errore cancellazione file Storage: ' + storageError.message)
      return
    }
  }

  // 3. Cancella dati collegati dal database
  const { error: errorRapportini } = await supabase
    .from('rapportini')
    .delete()
    .eq('cantiere', nome)

  if (errorRapportini) {
    alert('Errore eliminazione rapportini: ' + errorRapportini.message)
    return
  }

  const { error: errorFoto } = await supabase
    .from('foto_cantiere')
    .delete()
    .eq('cantiere', nome)

  if (errorFoto) {
    alert('Errore eliminazione foto: ' + errorFoto.message)
    return
  }

  const { error: errorTimbrature } = await supabase
    .from('timbrature')
    .delete()
    .eq('cantiere', nome)

  if (errorTimbrature) {
    alert('Errore eliminazione timbrature: ' + errorTimbrature.message)
    return
  }

  const { error: errorPreventivi } = await supabase
    .from('preventivi_cantiere')
    .delete()
    .eq('cantiere', nome)

  if (errorPreventivi) {
    alert('Errore eliminazione preventivi: ' + errorPreventivi.message)
    return
  }

  const { error: errorMateriali } = await supabase
    .from('materiali_cantiere')
    .delete()
    .eq('cantiere', nome)

  if (errorMateriali) {
    alert('Errore eliminazione materiali: ' + errorMateriali.message)
    return
  }

  const { error: errorAttrezzi } = await supabase
    .from('attrezzi_cantiere')
    .delete()
    .eq('cantiere', nome)

  if (errorAttrezzi) {
    alert('Errore eliminazione attrezzi: ' + errorAttrezzi.message)
    return
  }

  // 4. Cancella il cantiere
  const { error: errorCantiere } = await supabase
    .from('cantieri')
    .delete()
    .eq('nome', nome)

  if (errorCantiere) {
    alert('Errore eliminazione cantiere: ' + errorCantiere.message)
    return
  }

  // 5. Pulisce stati locali
  if (cantiereRapporto === nome) setCantiereRapporto('')
  if (cantiereFoto === nome) setCantiereFoto('')
  if (cantiereTimbratura === nome) setCantiereTimbratura('')
  if (filtroCantiere === nome) setFiltroCantiere('')
  if (cantiereScheda === nome) setCantiereScheda('')
  if (cantiereGrafico === nome) setCantiereGrafico('')

  await caricaCantieri()
  await caricaRapportini()
  await caricaFotoCantiere()
  await caricaTimbrature()
  await caricaEconomia()

  alert('Cantiere eliminato completamente, compresi i file nello Storage')
}

const salvaRapportino = async () => {
  if (!cantiereRapporto || !data) {
    alert('Compila almeno cantiere e data')
    return
  }

  const operaiValidi = operaiRapportinoTemp.filter(
    (o) => o.nome && o.ore > 0
  )

  const costoManodoperaRapportino = operaiValidi.reduce(
    (tot, o) => tot + Number(o.ore || 0) * Number(o.costo_orario || 0),
    0
  )

  const oreTotali = operaiValidi.reduce(
    (tot, o) => tot + Number(o.ore || 0),
    0
  )

  const riepilogoOperai =
    operai ||
    operaiValidi
      .map(
        (o) =>
          `${o.nome} (${o.ora_inizio || '-'} / ${o.ora_fine || '-'} - ${
            o.ore
          }h)`
      )
      .join(', ')

  const nuovoRapportino = {
    cantiere: cantiereRapporto,
    data,
    ore: String(oreTotali || ore || ''),
    note,
    operai: riepilogoOperai,
    costo_manodopera: costoManodoperaRapportino,
    materiali,
    quantita_materiali: quantitaMateriali,
    costo_materiali: costoMateriali,
  }

  const { data: rapportinoCreato, error } = await supabase
    .from('rapportini')
    .insert([nuovoRapportino])
    .select('id')
    .single()

  if (error) {
    alert('Errore salvataggio rapportino: ' + error.message)
    return
  }

  if (operaiValidi.length > 0) {
    const timbratureDaSalvare = operaiValidi.map((o) => ({
      operaio_nome: o.nome,
      cantiere: cantiereRapporto,
      data,
      ora_entrata: o.ora_inizio || null,
      ora_uscita: o.ora_fine || null,
      stato: 'da rapportino',
    }))

    const { error: erroreTimbrature } = await supabase
      .from('timbrature')
      .insert(timbratureDaSalvare)

    if (erroreTimbrature) {
      alert(
        'Rapportino salvato, ma errore inserimento timbrature: ' +
          erroreTimbrature.message
      )
      return
    }
  }

  const rapportinoId = rapportinoCreato?.id ? String(rapportinoCreato.id) : undefined

  setUltimoRapportino({ ...nuovoRapportino, id: rapportinoId })

 if (fotoRapportinoTemp.length > 0) {
  const risultatoFoto = await salvaFotoRapportinoInStorage(cantiereRapporto, rapportinoId)

  if (!risultatoFoto.success) {
    alert('Rapportino salvato, ma errore foto: ' + risultatoFoto.error)
    return
  }
}
  setFotoRapportinoTemp([])
  setNotaFotoRapportino('')
  setPopupFotoRapportino(false)
  setOperaiRapportinoTemp([])

  resetFormRapportino()

 await caricaRapportini()
await caricaTimbrature()
await caricaFotoCantiere()
await caricaEconomia()

  alert('Rapportino salvato e timbrature aggiornate')
}

const generaPdfSopralluogo = async (
  sopralluogo: Sopralluogo
) => {
  const pdf = new jsPDF()

  let y = 18

pdf.setFontSize(22)
pdf.text('ARTECNA', 20, y)

pdf.setFontSize(11)
pdf.text('Impresa edile - Scheda sopralluogo tecnico', 20, y + 7)

pdf.setFontSize(9)
pdf.text(
  `Generato il: ${new Date().toLocaleDateString('it-IT')}`,
  150,
  y
)

y += 18

pdf.setDrawColor(180)
pdf.line(20, y, 190, y)

y += 12

pdf.setFontSize(15)
pdf.text('DATI CLIENTE', 20, y)

y += 10

pdf.setFontSize(12)

  pdf.text(
    `Cliente: ${sopralluogo.cliente || '-'}`,
    20,
    y
  )

  y += 8

  pdf.text(
    `Telefono: ${sopralluogo.telefono || '-'}`,
    20,
    y
  )

  y += 8

  pdf.text(
    `Indirizzo: ${sopralluogo.indirizzo || '-'}`,
    20,
    y
  )

  y += 8

  pdf.text(
    `Data: ${sopralluogo.data_sopralluogo || '-'}`,
    20,
    y
  )

  y += 12

  pdf.setFontSize(14)

  pdf.text('NOTE SOPRALLUOGO', 20, y)

  y += 8

  pdf.setFontSize(11)

  const note = pdf.splitTextToSize(
    sopralluogo.note || '-',
    170
  )

  pdf.text(note, 20, y)

  y += note.length * 6 + 10

  const fotoDelSopralluogo =
    fotoSopralluoghi.filter(
      (f) =>
        f.sopralluogo_id === sopralluogo.id
    )

if (fotoDelSopralluogo.length > 0) {
  if (y > 230) {
    pdf.addPage()
    y = 20
  }

  pdf.setFontSize(15)
  pdf.text('DOCUMENTAZIONE FOTOGRAFICA', 20, y)

  y += 10
}




  for (const foto of fotoDelSopralluogo) {
    if (y > 230) {
      pdf.addPage()
      y = 20
    }

    try {
      pdf.addImage(
        foto.immagine_base64,
        'JPEG',
        20,
        y,
        70,
        50
      )

      y += 55

      if (foto.nota) {
        pdf.setFontSize(10)

        const testoFoto =
          pdf.splitTextToSize(
            foto.nota,
            160
          )

        pdf.text(testoFoto, 20, y)

        y += testoFoto.length * 5 + 5
      }
    } catch (err) {
      console.error(err)
    }
  }

if (firmaCliente) {
  if (y > 220) {
    pdf.addPage()
    y = 20
  }
  pdf.setFontSize(14)

  pdf.text('FIRMA CLIENTE', 20, y)

  y += 10

  try {
    pdf.addImage(
      firmaCliente,
      'PNG',
      20,
      y,
      70,
      35
    )

    y += 45
  } catch (err) {
    console.error(err)
  }
}



if (appuntiRefs.current.length > 0) {
  appuntiRefs.current.forEach((ref, index) => {
    const img = ref
      ?.getCanvas()
      ?.toDataURL('image/png')

    if (!img) return

    pdf.addPage()

    pdf.setFontSize(16)

    pdf.text(
      `Appunti sopralluogo - Pagina ${index + 1}`,
      20,
      20
    )

    pdf.addImage(
      img,
      'PNG',
      10,
      30,
      190,
      250
    )
  })
}



  pdf.save(
    `Sopralluogo_${sopralluogo.cliente}.pdf`
  )
}




const normalizzaDataFotoRapportino = (valore?: string | null) =>
  String(valore || '').slice(0, 10)

const fotoCollegataAlRapportino = (
  foto: FotoCantiere,
  rapportino: Rapportino
) => {
  const fotoRapportinoId = (foto as any).rapportino_id

  if (fotoRapportinoId && rapportino.id) {
    return String(fotoRapportinoId) === String(rapportino.id)
  }

  const stessoCantiere =
    String(foto.cantiere || '').trim() ===
    String(rapportino.cantiere || '').trim()
  const stessaData =
    normalizzaDataFotoRapportino(foto.data_foto) ===
    normalizzaDataFotoRapportino(rapportino.data)
  const categoriaCompatibile =
    !foto.categoria ||
    String(foto.categoria).toLowerCase() === 'rapportino'

  return stessoCantiere && stessaData && categoriaCompatibile
}

const generaPdfRapportinoFotografico = (r: Rapportino) => {
  const doc = new jsPDF('p', 'mm', 'a4')

  const fotoDelRapportino = fotoCantiere.filter((f) =>
    fotoCollegataAlRapportino(f, r)
  )

  doc.setFillColor(15, 23, 42)
doc.rect(0, 0, 210, 28, 'F')

doc.setTextColor(255, 255, 255)
doc.setFontSize(18)
doc.text('ARTECNA', 15, 12)

doc.setFontSize(11)
doc.text('Rapportino fotografico di cantiere', 15, 20)

doc.setTextColor(15, 23, 42)
doc.setFontSize(11)

doc.text(`Cantiere: ${r.cantiere}`, 15, 38)
doc.text(`Data: ${r.data}`, 15, 45)

doc.setDrawColor(203, 213, 225)
doc.line(15, 50, 195, 50)
  doc.setFontSize(12)

  doc.text('Descrizione lavori:', 15, 60)

 const testoPulito = String(r.note || '-')
  .replace(/[^\x00-\x7F]/g, '')

const note = doc.splitTextToSize(
  testoPulito,
  180
)
  doc.setFontSize(10)
 doc.text(note, 15, 68)

let y = 68 + note.length * 5 + 8

  if (r.operai) {
    doc.setFontSize(12)
    doc.text('Operai presenti:', 15, y)
    y += 7

    const testoOperai = doc.splitTextToSize(r.operai, 180)
    doc.setFontSize(10)
    doc.text(testoOperai, 15, y)
    y += testoOperai.length * 5 + 8
  }

  if (fotoDelRapportino.length === 0) {
    doc.text('Nessuna foto collegata al rapportino.', 15, y)
  }

  fotoDelRapportino.forEach((foto, index) => {
    if (y > 210) {
      doc.addPage()
      y = 20
    }

    try {
      doc.setFontSize(11)
      doc.text(`Foto ${index + 1}`, 15, y)
      y += 5

    const props = doc.getImageProperties(foto.immagine_base64)

const maxWidth = 140
const maxHeight = 100

const ratio = Math.min(
  maxWidth / props.width,
  maxHeight / props.height
)

const pdfWidth = props.width * ratio
const pdfHeight = props.height * ratio

const x = 15 + (140 - pdfWidth) / 2

doc.addImage(
  foto.immagine_base64,
  'JPEG',
  x,
  y,
  pdfWidth,
  pdfHeight
)

y += pdfHeight + 10

     

      if (foto.nota) {
        const notaFotoPulita = String(
  foto.nota || ''
).replace(/[^\x00-\x7F]/g, '')

const notaFoto = doc.splitTextToSize(
  notaFotoPulita,
  180
)
        doc.setFontSize(9)
        doc.text(notaFoto, 15, y)
        y += notaFoto.length * 5 + 6
      }
    } catch {
      doc.text(`Foto ${index + 1} non inseribile nel PDF`, 15, y)
      y += 8
    }
  })
if (y > 230) {
  doc.addPage()
  y = 25
}

doc.setDrawColor(203, 213, 225)
doc.line(15, y, 195, y)
y += 10

doc.setFontSize(12)
doc.text('Riepilogo rapportino', 15, y)
y += 8

doc.setFontSize(10)
doc.text(`Cantiere: ${r.cantiere || '-'}`, 15, y)
y += 6
doc.text(`Data: ${r.data || '-'}`, 15, y)
y += 6
doc.text(`Ore totali: ${r.ore || '-'}`, 15, y)
y += 6

if (r.operai) {
  const operaiPuliti = String(r.operai)
    .replace(/[^\x00-\x7F]/g, '')

  const testoOperai = doc.splitTextToSize(
    operaiPuliti,
    180
  )

  doc.text(testoOperai, 15, y)
  y += testoOperai.length * 5 + 10
}

doc.setFontSize(10)
doc.text('Firma impresa', 25, 275)
doc.line(20, 268, 85, 268)

doc.text('Firma cliente / D.L.', 125, 275)
doc.line(120, 268, 185, 268)

const nomeFile = `Rapportino_fotografico_${String(r.cantiere || 'cantiere')
  .replace(/\s+/g, '_')
  .replace(/[^\w-]/g, '')}_${String(r.data || 'data')}.pdf`

doc.save(nomeFile)
 
}


const generaPdfSalFotografico = () => {
  if (!salFotoCantiere || !salFotoMese) {
    alert('Seleziona cantiere e mese')
    return
  }

  const doc = new jsPDF('p', 'mm', 'a4')

  const rapportiniDelMese = rapportini
    .filter(
      (r) =>
        r.cantiere === salFotoCantiere &&
        String(r.data || '').startsWith(salFotoMese)
    )
    .sort((a, b) =>
      String(a.data || '').localeCompare(String(b.data || ''))
    )

  if (rapportiniDelMese.length === 0) {
    alert('Nessun rapportino trovato per questo cantiere/mese')
    return
  }

  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, 210, 30, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.text('ARTECNA', 15, 13)

  doc.setFontSize(11)
  doc.text('SAL fotografico di cantiere', 15, 22)

  doc.setTextColor(15, 23, 42)
  doc.setFontSize(11)
  doc.text(`Cantiere: ${salFotoCantiere}`, 15, 42)
  doc.text(`Periodo: ${salFotoMese}`, 15, 49)

  let y = 62

const fotoGiaInserite = new Set<string>()

  rapportiniDelMese.forEach((r, index) => {
    if (index > 0) {
      doc.addPage()
      y = 20
    }

    doc.setFontSize(13)
    doc.text(`Data: ${r.data || '-'}`, 15, y)
    y += 8

    const notePulite = String(r.note || '-')
      .replace(/[^\x00-\x7F]/g, '')

    const note = doc.splitTextToSize(notePulite, 180)
    doc.setFontSize(10)
    doc.text(note, 15, y)
    y += note.length * 5 + 8

    const fotoGiorno = fotoCantiere.filter(
      (f) =>
        f.cantiere === r.cantiere &&
        String(f.data_foto || '') === String(r.data || '')
    )

    if (fotoGiorno.length === 0) {
      doc.text('Nessuna foto collegata a questa data.', 15, y)
      y += 8
    }

    fotoGiorno.forEach((foto, i) => {
const chiaveFoto =
  String(foto.id || foto.immagine_base64.slice(0, 40))

if (fotoGiaInserite.has(chiaveFoto)) {
  return
}

fotoGiaInserite.add(chiaveFoto)
      if (y > 220) {
        doc.addPage()
        y = 20
      }

      try {
        const props = doc.getImageProperties(foto.immagine_base64)

        const maxWidth = 140
        const maxHeight = 95

        const ratio = Math.min(
          maxWidth / props.width,
          maxHeight / props.height
        )

        const pdfWidth = props.width * ratio
        const pdfHeight = props.height * ratio
        const x = 15 + (140 - pdfWidth) / 2

        doc.setFontSize(10)
        doc.text(`Foto ${i + 1}`, 15, y)
        y += 5

        doc.addImage(
          foto.immagine_base64,
          'JPEG',
          x,
          y,
          pdfWidth,
          pdfHeight
        )

        y += pdfHeight + 8
      } catch {
        doc.text(`Foto ${i + 1} non inseribile`, 15, y)
        y += 8
      }
    })
  })

  if (y > 235) {
    doc.addPage()
    y = 30
  }

  doc.setDrawColor(203, 213, 225)
  doc.line(15, y, 195, y)
  y += 12

  doc.setFontSize(12)
  doc.text('Riepilogo SAL fotografico', 15, y)
  y += 8

  doc.setFontSize(10)
  doc.text(`Cantiere: ${salFotoCantiere}`, 15, y)
  y += 6
  doc.text(`Periodo: ${salFotoMese}`, 15, y)
  y += 6
  doc.text(`Giornate documentate: ${rapportiniDelMese.length}`, 15, y)

  doc.text('Firma impresa', 25, 275)
  doc.line(20, 268, 85, 268)

  doc.text('Firma cliente / D.L.', 125, 275)
  doc.line(120, 268, 185, 268)

  const nomeFile = `SAL_fotografico_${salFotoCantiere
    .replace(/\s+/g, '_')
    .replace(/[^\w-]/g, '')}_${salFotoMese}.pdf`

  doc.save(nomeFile)
}






  const preparaModificaRapportino = (r: Rapportino) => {
    setRapportinoInModifica(r.id || null)
    setCantiereRapporto(r.cantiere ?? '')
    setData(r.data ?? '')
    setOre(r.ore ?? '')
    setNote(r.note ?? '')
    setOperai(r.operai ?? '')
    setNumeroPresenti(r.numero_presenti ?? '')
    setOrePerOperaio(r.ore_per_operaio ?? '')
    setMateriali(r.materiali ?? '')
    setQuantitaMateriali(r.quantita_materiali ?? '')
    setCostoMateriali(r.costo_materiali ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const aggiornaRapportino = async () => {
    if (!rapportinoInModifica) {
      alert('Nessun rapportino selezionato')
      return
    }

   if (!cantiereRapporto || !data) {
  alert('Compila almeno cantiere e data')
  return
}

    const { error } = await supabase
      .from('rapportini')
      .update({
  cantiere: cantiereRapporto,
  data,
  ore: String(
    operaiRapportinoTemp.reduce(
      (tot, o) => tot + o.ore,
      0
    )
  ),
  note,
  operai,
  costo_manodopera: operaiRapportinoTemp.reduce(
    (tot, o) => tot + o.ore * o.costo_orario,
    0
  ),
  numero_presenti: numeroPresenti,
  ore_per_operaio: orePerOperaio,
  materiali,
  quantita_materiali: quantitaMateriali,
  costo_materiali: costoMateriali,
})
      .eq('id', rapportinoInModifica)

    if (error) {
      alert('Errore aggiornamento rapportino: ' + error.message)
      return
    }

    resetFormRapportino()
    await caricaRapportini()
    alert('Rapportino aggiornato')
  }


const eliminaFotoCantiere = async (id?: string) => {
  if (!id) return

  const conferma = confirm(
    'Eliminare questa foto?'
  )

  if (!conferma) return

  const { error } = await supabase
    .from('foto_cantiere')
    .delete()
    .eq('id', id)

  if (error) {
    alert(
      'Errore eliminazione foto: ' +
        error.message
    )
    return
  }

  await caricaFotoCantiere()

  if (
    fotoFullscreen &&
    String(fotoFullscreen.id) === String(id)
  ) {
    setFotoFullscreen(null)
  }

  alert('Foto eliminata')
}

const eliminaFotoRapportino = async (foto: any) => {
  if (!foto?.id) {
    alert('Errore eliminazione foto: record foto non valido')
    return
  }

  const conferma = confirm(
    'Eliminare questa foto dal rapportino e dalla galleria cantiere?'
  )

  if (!conferma) return

  if (foto.file_path) {
    try {
      const { error: erroreStorage } = await supabase.storage
        .from(FOTO_CANTIERE_BUCKET)
        .remove([foto.file_path])

      if (erroreStorage) {
        alert('Errore eliminazione file Storage: ' + erroreStorage.message)
        return
      }
    } catch (errore) {
      const messaggio = errore instanceof Error ? errore.message : 'errore di rete'
      alert('Errore eliminazione file Storage: ' + messaggio)
      return
    }
  }

  const { error } = await supabase
    .from('foto_cantiere')
    .delete()
    .eq('id', foto.id)

  if (error) {
    alert('Errore eliminazione record foto: ' + error.message)
    return
  }

  setFotoRapportinoAperte((fotoCorrenti) =>
    fotoCorrenti.filter(
      (fotoCorrente) => String(fotoCorrente.id) !== String(foto.id)
    )
  )

  await caricaFotoCantiere()
}




  const eliminaRapportino = async (id?: string) => {
    if (!id) return

    const conferma = confirm('Vuoi eliminare questo rapportino?')
    if (!conferma) return

    const { error: erroreFoto } = await supabase
      .from('foto_cantiere')
      .update({ rapportino_id: null })
      .eq('rapportino_id', id)

    if (erroreFoto) {
      alert('Errore scollegamento foto rapportino: ' + erroreFoto.message)
      return
    }

    const { error } = await supabase.from('rapportini').delete().eq('id', id)

    if (error) {
      alert('Errore eliminazione rapportino: ' + error.message)
      return
    }

    await caricaRapportini()
    await caricaFotoCantiere()
    alert('Rapportino eliminato')
  }

  const gestisciFileImmagine = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      const risultato = reader.result
      if (typeof risultato === 'string') {
        setImmagineBase64(risultato)
      }
    }
    reader.readAsDataURL(file)
  }


  const usaPosizioneAttuale = () => {
    if (!navigator.geolocation) {
      alert('Geolocalizzazione non supportata dal browser')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6)
        const lng = position.coords.longitude.toFixed(6)
        setGeolocalizzazione(`${lat}, ${lng}`)
      },
      () => {
        alert('Impossibile ottenere la posizione')
      }
    )
  }

const aggiornaCategoriaFotoSelezionate = async () => {
  if (fotoCantiereSelezionate.length === 0) {
    alert('Seleziona almeno una foto')
    return
  }

  const { error } = await supabase
    .from('foto_cantiere')
    .update({ categoria: categoriaFotoMultipla })
    .in('id', fotoCantiereSelezionate)

  if (error) {
    alert('Errore aggiornamento categorie: ' + error.message)
    return
  }

  setFotoCantiere((prev) =>
    prev.map((f) =>
      f.id && fotoCantiereSelezionate.includes(f.id)
        ? { ...f, categoria: categoriaFotoMultipla }
        : f
    )
  )

  setFotoCantiereSelezionate([])
  await caricaFotoCantiere()

  alert('Categoria aggiornata per le foto selezionate')
}

const gestisciFilePreventivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0] || null
  setFilePreventivo(file)
  setNomeFilePreventivo(file ? file.name : '')

  if (!file) {
    alert('Nessun file selezionato')
    return
  }

  const nome = file.name.toLowerCase()

  alert(`File selezionato: ${file.name}`)

  try {
    if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) {
      alert('Sto leggendo un file Excel')
      await leggiExcelPreventivo(file)
      alert('Lettura Excel completata')
    } else if (nome.endsWith('.pdf')) {
      alert('Sto leggendo un file PDF')
      await provaImportoDaPdf(file)
      alert('Lettura PDF completata')
    } else if (
      nome.endsWith('.jpg') ||
      nome.endsWith('.jpeg') ||
      nome.endsWith('.png') ||
      nome.endsWith('.webp')
    ) {
      alert('Sto leggendo un’immagine')
      await provaImportoDaImmagine(file)
      alert('Lettura immagine completata')
    } else {
      alert('Formato file non supportato')
    }
  } catch (error) {
    console.error('ERRORE PREVENTIVO:', error)
    alert('Errore durante la lettura del file preventivo')
  }
} 


const salvaMaterialeManuale = async () => {
  if (!cantiereScheda || !materialeManualeDescrizione.trim()) {
    alert('Inserisci cantiere e descrizione')
    return
  }

  const quantita = Number(materialeManualeQuantita || 0)
  const prezzo = Number(materialeManualePrezzo || 0)

  const totale = quantita * prezzo

  const { error } = await supabase
    .from('materiali_cantiere')
    .insert([
      {
        cantiere: cantiereScheda,
        descrizione: materialeManualeDescrizione,
        quantita,
        prezzo_unitario: prezzo,
        totale,
        fornitore: materialeManualeFornitore || 'Magazzino',
        nota: materialeManualeNota,
        data_documento: new Date()
          .toISOString()
          .slice(0, 10),
        nome_file: 'Inserimento manuale',
      },
    ])

  if (error) {
    alert('Errore salvataggio materiale: ' + error.message)
    return
  }

  setMaterialeManualeDescrizione('')
  setMaterialeManualeQuantita('1')
  setMaterialeManualePrezzo('')
  setMaterialeManualeFornitore('Magazzino')
  setMaterialeManualeNota('')

  await caricaEconomia()

  alert('Materiale inserito')
}




const gestisciFileMateriale = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0] || null
  setFileMateriale(file)
  setNomeFileMateriale(file ? file.name : '')

  if (!file) return

  const nome = file.name.toLowerCase()

  try {
    if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) {
      await leggiExcelMateriale(file)
    } else if (nome.endsWith('.pdf')) {
      await provaMaterialeDaPdf(file)
    } else if (
      nome.endsWith('.jpg') ||
      nome.endsWith('.jpeg') ||
      nome.endsWith('.png') ||
      nome.endsWith('.webp')
    ) {
      await provaMaterialeDaImmagine(file)
    }
  } catch (error) {
    console.error(error)
    alert('Errore durante la lettura del file materiale')
  }
}

const gestisciFileAttrezzo = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0] || null
  setFileAttrezzo(file)
  setNomeFileAttrezzo(file ? file.name : '')

  if (!file) return

  const nome = file.name.toLowerCase()

  try {
    if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) {
      await leggiExcelAttrezzo(file)
    } else if (nome.endsWith('.pdf')) {
      await provaAttrezzoDaPdf(file)
    } else if (
      nome.endsWith('.jpg') ||
      nome.endsWith('.jpeg') ||
      nome.endsWith('.png') ||
      nome.endsWith('.webp')
    ) {
      await provaAttrezzoDaImmagine(file)
    }
  } catch (error) {
    console.error(error)
    alert('Errore durante la lettura del file attrezzo')
  }
}

const leggiExcelPreventivo = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

  let importoTrovato: number | null = null

  for (const row of rows) {
    if (!Array.isArray(row)) continue

    for (const cell of row) {
      if (typeof cell === 'number' && cell > 0) {
        if (importoTrovato === null || cell > importoTrovato) {
          importoTrovato = cell
        }
      }

      if (typeof cell === 'string') {
        const match = cell.replace(/\./g, '').replace(',', '.').match(/\d+(\.\d+)?/)
        if (match) {
          const valore = parseFloat(match[0])
          if (!isNaN(valore) && valore > 0) {
            if (importoTrovato === null || valore > importoTrovato) {
              importoTrovato = valore
            }
          }
        }
      }
    }
  }

  if (importoTrovato !== null) {
    setImportoPreventivo(String(importoTrovato.toFixed(2)))
  }
}

const leggiExcelMateriale = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue

    const descrizione = row[0] ? String(row[0]) : ''
    const quantita = row[1] ? String(row[1]) : ''
    const prezzo = row[2] ? String(row[2]) : ''

    if (descrizione && !descrizioneMateriale) {
      setDescrizioneMateriale(descrizione)
      setQuantitaMaterialeEconomia(quantita)
      setPrezzoMaterialeEconomia(prezzo)
      break
    }
  }
}

const leggiPdfTesto = async (file: File) => {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let testoCompleto = ''

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
    testoCompleto += ' ' + pageText
  }

  return testoCompleto
}
const leggiTestoDaImmagine = async (file: File) => {
  const result = await Tesseract.recognize(file, 'ita+eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        console.log(`OCR: ${Math.round(m.progress * 100)}%`)
      }
    },
  })

  return result.data.text || ''
}

const caricaFileAnalisiDocumento = async (file: File) => {
  if (!file) return

  const fakeEvent = {
    target: {
      files: [file],
    },
  } as unknown as React.ChangeEvent<HTMLInputElement>

  await analizzaDocumentoCantiere(fakeEvent)
}

const analizzaDocumentoCantiere = async (e: React.ChangeEvent<HTMLInputElement>) => {

  const file = e.target.files?.[0] || null
  setFileAnalisiDocumento(file)
  setNomeFileAnalisiDocumento(file ? file.name : '')
  setTestoEstrattoDocumento('')

  if (!file) {
    alert('Nessun file selezionato')
    return
  }
const estensione = file.name.split('.').pop()?.toLowerCase() || 'file'

const nomePulito = file.name
  .replace(/\.[^/.]+$/, '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9_-]/g, '_')
  .replace(/_+/g, '_')
  .replace(/^_+|_+$/g, '')

const cantierePulito = (cantiereScheda || 'senza_cantiere')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9_-]/g, '_')
  .replace(/_+/g, '_')
  .replace(/^_+|_+$/g, '')
  .toUpperCase()

const fileName = `cantieri/${cantierePulito}/documenti/${Date.now()}_${nomePulito}.${estensione}`

const { error: uploadError } = await supabase.storage
  .from('preventivi')
  .upload(fileName, file)

if (uploadError) {
  alert('Errore upload file: ' + uploadError.message)
  return
}

const { data: urlData } = supabase.storage
  .from('preventivi')
  .getPublicUrl(fileName)

setFileUrlAnalisi(urlData.publicUrl)
setFilePathAnalisi(fileName)

if (estensione === 'pdf') setFileTipoAnalisi('pdf')
else if (estensione === 'xlsx' || estensione === 'xls') setFileTipoAnalisi('excel')
else if (['jpg', 'jpeg', 'png', 'webp'].includes(estensione)) setFileTipoAnalisi('img')
else setFileTipoAnalisi('altro')

const tipo = file.name.toLowerCase().includes('.pdf')
  ? 'pdf'
  : file.name.toLowerCase().includes('.xls')
  ? 'excel'
  : 'img'

// salva tipo
setFileTipoAnalisi(tipo)



  const nome = file.name.toLowerCase()

  try {
    setAnalisiInCorso(true)

    let testo = ''

    if (nome.endsWith('.pdf')) {
      testo = await leggiPdfTesto(file)
    } else if (
      nome.endsWith('.jpg') ||
      nome.endsWith('.jpeg') ||
      nome.endsWith('.png') ||
      nome.endsWith('.webp')
    ) {
      testo = await leggiTestoDaImmagine(file)
    } else if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      testo = rows
        .map((row) => (Array.isArray(row) ? row.join(' | ') : ''))
        .join('\n')
    } else {
      alert('Formato non supportato. Usa PDF, immagine o Excel.')
      return
    }

   // PULIZIA TESTO
let testoPulito = testo
  .replace(/\|+/g, '|')
  .replace(/\n\s*\n/g, '\n')
  .replace(/€/g, '')
    setTestoEstrattoDocumento(testoPulito || 'Nessun testo estratto')

    analizzaTestoInVoci(testoPulito)

    setTimeout(() => {
      const totale = vociAnalizzate.reduce((tot, voce) => {
        const quantita = Number(voce.quantita || 0)
        const prezzo = Number(voce.prezzo || 0)
        return tot + quantita * prezzo
      }, 0)

      if (totale > 0) {
        setImportoRilevatoDocumento(
          totale.toLocaleString('it-IT', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        )
      }
    }, 100)

  } catch (error) {
    console.error('ERRORE ANALISI DOCUMENTO:', error)
    alert('Errore durante l’analisi del documento')
  } finally {
    setAnalisiInCorso(false)
  }
}
const provaImportoDaPdf = async (file: File) => {
  const testo = await leggiPdfTesto(file)
  const righe = testo
    .split(/\n|\r| {2,}/)
    .map((r) => r.trim())
    .filter(Boolean)

  let importoTrovato: number | null = null

  const priorita = [
    'totale preventivo',
    'totale documento',
    'totale complessivo',
    'totale da pagare',
    'importo totale',
    'totale',
  ]

  for (const chiave of priorita) {
    const riga = righe.find((r) => r.toLowerCase().includes(chiave))
    if (riga) {
      const numero = estraiNumeroEuro(riga)
      if (numero && numero > 0) {
        importoTrovato = numero
        break
      }
    }
  }

  if (importoTrovato === null) {
    const matches = testo.match(/\d{1,3}(?:\.\d{3})*(?:,\d{2})/g) || []
    let importoMaggiore = 0

    matches.forEach((m) => {
      const valore = parseFloat(m.replace(/\./g, '').replace(',', '.'))
      if (!isNaN(valore) && valore > importoMaggiore) {
        importoMaggiore = valore
      }
    })

    if (importoMaggiore > 0) {
      importoTrovato = importoMaggiore
    }
  }

  if (importoTrovato !== null) {
    setImportoPreventivo(importoTrovato.toFixed(2))
  }
}

const provaImportoDaImmagine = async (file: File) => {
  const testo = await leggiTestoDaImmagine(file)
  const righe = testo
    .split(/\n|\r/)
    .map((r) => r.trim())
    .filter(Boolean)

  let importoTrovato: number | null = null

  const priorita = [
    'totale preventivo',
    'totale documento',
    'totale complessivo',
    'totale da pagare',
    'importo totale',
    'totale',
  ]

  for (const chiave of priorita) {
    const riga = righe.find((r) => r.toLowerCase().includes(chiave))
    if (riga) {
      const numero = estraiNumeroEuro(riga)
      if (numero && numero > 0) {
        importoTrovato = numero
        break
      }
    }
  }

  if (importoTrovato === null) {
    const matches = testo.match(/\d{1,3}(?:\.\d{3})*(?:,\d{2})/g) || []
    let importoMaggiore = 0

    matches.forEach((m) => {
      const valore = parseFloat(m.replace(/\./g, '').replace(',', '.'))
      if (!isNaN(valore) && valore > importoMaggiore) {
        importoMaggiore = valore
      }
    })

    if (importoMaggiore > 0) {
      importoTrovato = importoMaggiore
    }
  }

  if (importoTrovato !== null) {
    setImportoPreventivo(importoTrovato.toFixed(2))
  }
}
const provaMaterialeDaImmagine = async (file: File) => {
  const testo = await leggiTestoDaImmagine(file)

  const righe = testo
    .split(/\n|\r/)
    .map((r) => r.trim())
    .filter(Boolean)

  const escluse = [
    'totale',
    'iva',
    'imponibile',
    'documento',
    'fattura',
    'data',
    'pagamento',
    'banca',
    'iban',
    'cliente',
    'fornitore',
  ]

  for (const riga of righe) {
    const rigaBassa = riga.toLowerCase()
    const daEscludere = escluse.some((parola) => rigaBassa.includes(parola))
    const matchNumero = riga.match(/\d+(?:[.,]\d+)?/)

    if (riga.length > 5 && matchNumero && !daEscludere) {
      setDescrizioneMateriale(riga.slice(0, 80))

      const numero = estraiNumeroEuro(riga)
      if (numero !== null) {
        setPrezzoMaterialeEconomia(numero.toFixed(2))
      }

      const qtaMatch = riga.match(/\b\d+(?:[.,]\d+)?\b/)
      if (qtaMatch) {
        setQuantitaMaterialeEconomia(qtaMatch[0].replace(',', '.'))
      }

      break
    }
  }
}
const provaMaterialeDaPdf = async (file: File) => {
  const testo = await leggiPdfTesto(file)

  const righe = testo
    .split(/[\n\r]+| {2,}/)
    .map((r) => r.trim())
    .filter(Boolean)

  const escluse = [
    'totale',
    'iva',
    'imponibile',
    'documento',
    'fattura',
    'data',
    'pagamento',
    'banca',
    'iban',
    'cliente',
    'fornitore',
  ]

  for (const riga of righe) {
    const rigaBassa = riga.toLowerCase()
    const daEscludere = escluse.some((parola) => rigaBassa.includes(parola))
    const matchNumero = riga.match(/\d+(?:[.,]\d+)?/)

    if (riga.length > 5 && matchNumero && !daEscludere) {
      setDescrizioneMateriale(riga.slice(0, 80))

      const numero = estraiNumeroEuro(riga)
      if (numero !== null) {
        setPrezzoMaterialeEconomia(numero.toFixed(2))
      }

      const qtaMatch = riga.match(/\b\d+(?:[.,]\d+)?\b/)
      if (qtaMatch) {
        setQuantitaMaterialeEconomia(qtaMatch[0].replace(',', '.'))
      }

      break
    }
  }
}

const estraiNumeroEuro = (testo: string): number | null => {
  if (!testo) return null

  // cerca numeri tipo: 1.234,56 oppure 1234,56 oppure 1234
  const matches = testo.match(/\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:,\d{2})?/g)

  if (!matches || matches.length === 0) return null

  let valoreMaggiore = 0

  matches.forEach((m) => {
    const numero = parseFloat(m.replace(/\./g, '').replace(',', '.'))
    if (!isNaN(numero) && numero > valoreMaggiore) {
      valoreMaggiore = numero
    }
  })

  return valoreMaggiore > 0 ? valoreMaggiore : null
}
const leggiExcelAttrezzo = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue

    const descrizione = row[0] ? String(row[0]) : ''
    const quantita = row[1] ? String(row[1]) : ''
    const prezzo = row[2] ? String(row[2]) : ''

    if (descrizione && !descrizioneAttrezzo) {
      setDescrizioneAttrezzo(descrizione)
      setQuantitaAttrezzo(quantita)
      setPrezzoAttrezzo(prezzo)
      break
    }
  }
} 

const provaAttrezzoDaPdf = async (file: File) => {
  const testo = await leggiPdfTesto(file)

  const righe = testo
    .split(/[\n\r]+| {2,}/)
    .map((r) => r.trim())
    .filter(Boolean)

  const escluse = [
    'totale',
    'iva',
    'imponibile',
    'documento',
    'fattura',
    'data',
    'pagamento',
    'banca',
    'iban',
    'cliente',
    'fornitore',
  ]

  for (const riga of righe) {
    const rigaBassa = riga.toLowerCase()
    const daEscludere = escluse.some((parola) => rigaBassa.includes(parola))
    const matchNumero = riga.match(/\d+(?:[.,]\d+)?/)

    if (
      riga.length > 5 &&
      matchNumero &&
      !daEscludere
    ) {
      setDescrizioneAttrezzo(riga.slice(0, 80))
      break
    }
  }
}
const provaAttrezzoDaImmagine = async (file: File) => {
  const testo = await leggiTestoDaImmagine(file)

  const righe = testo
    .split(/\n|\r/)
    .map((r) => r.trim())
    .filter(Boolean)

  const escluse = [
    'totale',
    'iva',
    'imponibile',
    'documento',
    'fattura',
    'data',
    'pagamento',
    'banca',
    'iban',
    'cliente',
    'fornitore',
  ]

  for (const riga of righe) {
    const rigaBassa = riga.toLowerCase()
    const daEscludere = escluse.some((parola) => rigaBassa.includes(parola))
    const matchNumero = riga.match(/\d+(?:[.,]\d+)?/)

    if (
      riga.length > 5 &&
      matchNumero &&
      !daEscludere
    ) {
      setDescrizioneAttrezzo(riga.slice(0, 80))
      break
    }
  }
}


const FOTO_CANTIERE_BUCKET = 'preventivi'

const creaBlobFotoCantiere = (dataUrl: string) => {
  const separatore = dataUrl.indexOf(',')
  const intestazione = dataUrl.slice(0, separatore)

  if (separatore < 0 || !intestazione.startsWith('data:image/')) {
    throw new Error('Il file selezionato non contiene una foto valida')
  }

  const mimeType = intestazione.match(/^data:([^;]+)/)?.[1] || 'image/jpeg'
  const contenuto = dataUrl.slice(separatore + 1)
  const binario = intestazione.includes(';base64')
    ? atob(contenuto)
    : decodeURIComponent(contenuto)
  const bytes = new Uint8Array(binario.length)

  for (let indice = 0; indice < binario.length; indice += 1) {
    bytes[indice] = binario.charCodeAt(indice)
  }

  return new Blob([bytes], { type: mimeType })
}

const estensioneFotoCantiere = (mimeType: string) => {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/heic') return 'heic'
  if (mimeType === 'image/heif') return 'heif'
  return 'jpg'
}

const pulisciSegmentoStorage = (valore: string) =>
  valore
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'cantiere'

const salvaFotoCantiere = async () => {
  if (!cantiereScheda) {
    alert('Cantiere mancante: seleziona un cantiere prima di salvare')
    return false
  }

  if (fotoDaCaricare.length === 0) {
    alert('File mancante: carica o scatta almeno una foto')
    return false
  }

  let filePreparati: Array<{ blob: Blob; estensione: string }>

  try {
    filePreparati = fotoDaCaricare.map((foto) => {
      const blob = creaBlobFotoCantiere(foto)
      return { blob, estensione: estensioneFotoCantiere(blob.type) }
    })
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : 'foto non valida'
    alert('File mancante o non valido: ' + messaggio)
    return false
  }

  const { data: datiUtente, error: erroreUtente } = await supabase.auth.getUser()

  if (erroreUtente || !datiUtente.user) {
    alert(
      'Errore Storage upload: impossibile identificare l’utente. ' +
        (erroreUtente?.message || 'Sessione non disponibile')
    )
    return false
  }

  const cantierePulito = pulisciSegmentoStorage(cantiereScheda)
  const caricamenti: Array<{ path: string; url: string }> = []

  const rimuoviUploadParziali = async () => {
    if (caricamenti.length === 0) return

    try {
      const { error } = await supabase.storage
        .from(FOTO_CANTIERE_BUCKET)
        .remove(caricamenti.map((file) => file.path))

      if (error) console.error('Errore rollback foto Storage:', error.message)
    } catch (errore) {
      console.error('Errore di rete durante il rollback foto Storage:', errore)
    }
  }

  try {
    for (let indice = 0; indice < filePreparati.length; indice += 1) {
      const file = filePreparati[indice]
      const path = `utenti/${datiUtente.user.id}/cantieri/${cantierePulito}/foto/${Date.now()}_${indice}.${file.estensione}`
      const { error: erroreUpload } = await supabase.storage
        .from(FOTO_CANTIERE_BUCKET)
        .upload(path, file.blob, {
          contentType: file.blob.type,
          upsert: false,
        })

      if (erroreUpload) {
        await rimuoviUploadParziali()
        alert('Errore Storage upload: ' + erroreUpload.message)
        return false
      }

      const { data: datiUrl } = supabase.storage
        .from(FOTO_CANTIERE_BUCKET)
        .getPublicUrl(path)

      if (!datiUrl.publicUrl) {
        await rimuoviUploadParziali()
        alert('Errore Storage upload: URL pubblico della foto non disponibile')
        return false
      }

      caricamenti.push({ path, url: datiUrl.publicUrl })
    }
  } catch (errore) {
    await rimuoviUploadParziali()
    const messaggio = errore instanceof Error ? errore.message : 'errore di rete'
    alert('Errore Storage upload: connessione non riuscita. ' + messaggio)
    return false
  }

const nuoveFoto = caricamenti.map((file) => ({
  cantiere: cantiereScheda,
  nota: notaFotoCantiere,
  file_url: file.url,
  file_path: file.path,
  immagine_base64: file.url,
  categoria: categoriaFotoDaSalvare || categoriaFoto || 'durante',
  geolocalizzazione: geolocalizzazioneFoto,
  data_foto: new Date().toISOString().slice(0, 10),
  storage_provider: 'cloud',
  sync_status: 'not_required',
}))

  try {
    const { error: erroreInsert } = await supabase
      .from('foto_cantiere')
      .insert(nuoveFoto)

    if (erroreInsert) {
      await rimuoviUploadParziali()
      alert('Errore insert database foto_cantiere: ' + erroreInsert.message)
      return false
    }
  } catch (errore) {
    await rimuoviUploadParziali()
    const messaggio = errore instanceof Error ? errore.message : 'errore di rete'
    alert('Errore insert database foto_cantiere: connessione non riuscita. ' + messaggio)
    return false
  }

  setFotoDaCaricare([])
  setNotaFotoCantiere('')
  setGeolocalizzazioneFoto('')
  setCategoriaFoto(categoriaFotoDaSalvare || 'durante')
  setPopupCategoriaFotoCantiere(false)

  await caricaFotoCantiere()

  alert('Foto cantiere salvate')
  return true
}

type SalvataggioFotoRapportinoResult =
  | { success: true; numeroFoto: number }
  | { success: false; error: string }

const salvaFotoRapportinoInStorage = async (
  cantiereFoto: string,
  rapportinoId?: string
): Promise<SalvataggioFotoRapportinoResult> => {
  const { data: datiUtente, error: erroreUtente } = await supabase.auth.getUser()

  if (erroreUtente || !datiUtente.user) {
    return {
      success: false,
      error:
        'Impossibile identificare l’utente. ' +
        (erroreUtente?.message || 'Sessione non disponibile'),
    }
  }

  const dataFoto = data || new Date().toISOString().slice(0, 10)
  const utenteId = datiUtente.user.id
  const cantierePulito = pulisciSegmentoStorage(cantiereFoto)
  const risultato = await buildPhotoRecordsWithStorage(supabase, {
    cantiere: cantiereFoto,
    categoria: 'rapportino',
    nota: notaFotoRapportino,
    dataFoto,
    geolocalizzazione: geolocalizzazioneFoto,
    rapportinoId: rapportinoId ?? null,
    dataUrls: fotoRapportinoTemp,
    bucket: FOTO_CANTIERE_BUCKET,
    folder: `utenti/${utenteId}/cantieri/${cantierePulito}/foto`,
  })

  if (!risultato.success) {
    return {
      success: false,
      error: risultato.error || 'Errore salvataggio foto rapportino',
    }
  }

  const rimuoviUploadParziali = async () => {
    if (risultato.uploadedPaths.length === 0) return

    try {
      const { error } = await supabase.storage
        .from(FOTO_CANTIERE_BUCKET)
        .remove(risultato.uploadedPaths)

      if (error) console.error('Errore rollback foto Storage:', error.message)
    } catch (errore) {
      console.error('Errore di rete durante il rollback foto Storage:', errore)
    }
  }

  try {
    const { error } = await supabase
      .from('foto_cantiere')
      .insert(risultato.photos)

    if (error) {
      await rimuoviUploadParziali()
      return { success: false, error: error.message }
    }
  } catch (errore) {
    await rimuoviUploadParziali()
    const messaggio =
      errore instanceof Error ? errore.message : 'errore di rete'
    return { success: false, error: messaggio }
  }

  return { success: true, numeroFoto: risultato.photos.length }
}

  const salvaPreventivo = async () => {
    if (!cantiereScheda || !importoPreventivo.trim()) {
      alert('Seleziona cantiere e inserisci importo')
      return
    }

    const importo = parseFloat(importoPreventivo.replace(',', '.'))

    if (isNaN(importo)) {
      alert('Importo non valido')
      return
    }

    const { error } = await supabase.from('preventivi_cantiere').insert([
      {
        cantiere: cantiereScheda,
        importo_totale: importo,

        note: notePreventivo.trim(),
        nome_file: nomeFilePreventivo.trim(),
      },
    ])

    if (error) {
      alert('Errore salvataggio preventivo: ' + error.message)
      return
    }

    setImportoPreventivo('')
    setNotePreventivo('')
    setNomeFilePreventivo('')

    await caricaEconomia()
    await caricaAcconti()
    alert('Preventivo salvato')
  }

const salvaFotoRapportino = async () => {
  if (fotoRapportinoTemp.length === 0) {
    alert('Carica o scatta almeno una foto')
    return
  }

  const cantiereFoto =
    cantiereRapporto ||
    cantiereScheda ||
    ultimoRapportino?.cantiere ||
    ''

  if (!cantiereFoto) {
    alert('Seleziona un cantiere prima di salvare le foto del rapportino')
    return
  }

  const risultatoFoto = await salvaFotoRapportinoInStorage(cantiereFoto)

  if (!risultatoFoto.success) {
    alert('Errore salvataggio foto rapportino: ' + risultatoFoto.error)
    return
  }

  setNote((prev) => {
    const testoFoto =
      `\n\n📸 Foto lavoro allegate: ${risultatoFoto.numeroFoto}` +
      (notaFotoRapportino
        ? `\nNota foto: ${notaFotoRapportino}`
        : '') +
      (geolocalizzazioneFoto
        ? `\nPosizione foto: ${geolocalizzazioneFoto}`
        : '')

    if (prev.includes('📸 Foto lavoro allegate:')) {
      return prev
    }

    return prev + testoFoto
  })

  setFotoRapportinoTemp([])
  setNotaFotoRapportino('')
  setPopupFotoRapportino(false)

  await caricaFotoCantiere()

  alert('Foto rapportino salvate nella galleria cantiere')
}

  const aggiungiMaterialeEconomia = async () => {
    if (!cantiereScheda || !descrizioneMateriale.trim()) {
      alert('Seleziona il cantiere nella scheda e inserisci la descrizione del materiale')
      return
    }

    const qta = parseFloat((quantitaMaterialeEconomia || '0').replace(',', '.'))
    const prezzo = parseFloat((prezzoMaterialeEconomia || '0').replace(',', '.'))

    const quantitaPulita = isNaN(qta) ? 0 : qta
    const prezzoPulito = isNaN(prezzo) ? 0 : prezzo
    

   const totale = estraiTotaleScontrino(testoEstrattoDocumento)

if (!totale) {
  alert('Totale non trovato')
  return
}


const { error } = await supabase.from('attrezzi_cantiere').insert([
  {
    cantiere: cantiereScheda,
    descrizione: nomeFileAnalisiDocumento || 'Scontrino attrezzo',
    quantita: 1,
    prezzo_unitario: estraiTotaleScontrino(testoEstrattoDocumento) || 0,
totale: estraiTotaleScontrino(testoEstrattoDocumento) || 0,
    fornitore: 'Documento analizzato',
    data_documento: oggi,
    nome_file: nomeFileAnalisiDocumento || 'Documento analizzato',
    nota: 'Importato automaticamente da scontrino',
  },
])

if (error) {
  alert('Errore salvataggio materiale: ' + error.message)
  return
}

setDescrizioneMateriale('')
setQuantitaMaterialeEconomia('')
setPrezzoMaterialeEconomia('')
setFornitoreMateriale('')
setDataDocumentoMateriale('')
setNomeFileMateriale('')

    await caricaEconomia()
    alert('Materiale aggiunto')
  }

  const aggiungiAttrezzo = async () => {
    if (!cantiereScheda || !descrizioneAttrezzo.trim()) {
      alert('Seleziona il cantiere nella scheda e inserisci la descrizione dell’attrezzo')
      return
    }
const totale = estraiTotaleScontrino(testoEstrattoDocumento)

if (!totale) {
  alert('Totale non trovato')
  return
}
    const qta = parseFloat((quantitaAttrezzo || '0').replace(',', '.'))
    const prezzo = parseFloat((prezzoAttrezzo || '0').replace(',', '.'))

    const quantitaPulita = isNaN(qta) ? 0 : qta
    const prezzoPulito = isNaN(prezzo) ? 0 : prezzo
    const totaleCalcolato = quantitaPulita * prezzoPulito


    const { error } = await supabase.from('attrezzi_cantiere').insert([
      {
        cantiere: cantiereScheda,
        descrizione: descrizioneAttrezzo.trim(),
        quantita: quantitaPulita,
        prezzo_unitario: prezzoPulito,
        totale,
        fornitore: fornitoreAttrezzo.trim(),
        data_documento: dataDocumentoAttrezzo || null,
        nome_file: nomeFileAttrezzo.trim(),
        nota: notaAttrezzo.trim(),
      },
    ])

    if (error) {
      alert('Errore salvataggio attrezzo: ' + error.message)
      return
    }

    setDescrizioneAttrezzo('')
    setQuantitaAttrezzo('')
    setPrezzoAttrezzo('')
    setFornitoreAttrezzo('')
    setDataDocumentoAttrezzo('')
    setNomeFileAttrezzo('')
    setNotaAttrezzo('')

    await caricaEconomia()
    alert('Attrezzo aggiunto')
  }

  const calcolaCostoTimbratura = (timbratura: Timbratura) => {
    const entrata = parseOra(timbratura.ora_entrata)
    const uscita = parseOra(timbratura.ora_uscita)

    if (entrata === null || uscita === null || uscita < entrata) return 0

    const minuti = uscita - entrata
    const ore = minuti / 60

    const operaio = operaiAnagrafica.find((o) => o.nome === timbratura.operaio_nome)
    const costoOrario = Number(operaio?.costo_orario || 0)

    return ore * costoOrario
  }

  const preparaModificaPreventivo = (p: PreventivoCantiere) => {
    setPreventivoInModifica(p.id || null)
    setImportoPreventivoModifica(
      p.importo_totale !== undefined && p.importo_totale !== null
        ? String(p.importo_totale)
        : ''
    )
    setNotePreventivoModifica(p.note || '')
    setNomeFilePreventivoModifica(p.nome_file || '')
  }

  const annullaModificaPreventivo = () => {
    setPreventivoInModifica(null)
    setImportoPreventivoModifica('')
    setNotePreventivoModifica('')
    setNomeFilePreventivoModifica('')
  }

  const salvaModificaPreventivo = async () => {
    if (!preventivoInModifica) return

    const importo = parseFloat(importoPreventivoModifica.replace(',', '.'))
    if (isNaN(importo)) {
      alert('Importo preventivo non valido')
      return
    }

    const { error } = await supabase
      .from('preventivi_cantiere')
      .update({
        importo_totale: importo,
        note: notePreventivoModifica.trim(),
        nome_file: nomeFilePreventivoModifica.trim(),
      })
      .eq('id', preventivoInModifica)

    if (error) {
      alert('Errore modifica preventivo: ' + error.message)
      return
    }

    annullaModificaPreventivo()
    await caricaEconomia()
    alert('Preventivo modificato')
  }

  const preparaModificaMateriale = (m: MaterialeCantiere) => {
    setMaterialeInModifica(m.id || null)
    setDescrizioneMaterialeModifica(m.descrizione || '')
    setQuantitaMaterialeModifica(
      m.quantita !== undefined && m.quantita !== null ? String(m.quantita) : ''
    )
    setPrezzoMaterialeModifica(
      m.prezzo_unitario !== undefined && m.prezzo_unitario !== null
        ? String(m.prezzo_unitario)
        : ''
    )
    setFornitoreMaterialeModifica(m.fornitore || '')
    setDataDocumentoMaterialeModifica(m.data_documento || '')
    setNomeFileMaterialeModifica(m.nome_file || '')
  }

  const annullaModificaMateriale = () => {
    setMaterialeInModifica(null)
    setDescrizioneMaterialeModifica('')
    setQuantitaMaterialeModifica('')
    setPrezzoMaterialeModifica('')
    setFornitoreMaterialeModifica('')
    setDataDocumentoMaterialeModifica('')
    setNomeFileMaterialeModifica('')
  }

  const salvaModificaMateriale = async () => {
    if (!materialeInModifica) return

    const qta = parseFloat((quantitaMaterialeModifica || '0').replace(',', '.'))
    const prezzo = parseFloat((prezzoMaterialeModifica || '0').replace(',', '.'))

    const quantitaPulita = isNaN(qta) ? 0 : qta
    const prezzoPulito = isNaN(prezzo) ? 0 : prezzo
    const totale = quantitaPulita * prezzoPulito

    const { error } = await supabase
      .from('materiali_cantiere')
      .update({
        descrizione: descrizioneMaterialeModifica.trim(),
        quantita: quantitaPulita,
        prezzo_unitario: prezzoPulito,
        totale,
        fornitore: fornitoreMaterialeModifica.trim(),
        data_documento: dataDocumentoMaterialeModifica || null,
        nome_file: nomeFileMaterialeModifica.trim(),
      })
      .eq('id', materialeInModifica)

    if (error) {
      alert('Errore modifica materiale: ' + error.message)
      return
    }

    annullaModificaMateriale()
    await caricaEconomia()
    alert('Materiale modificato')
  }

  const preparaModificaAttrezzo = (a: AttrezzoCantiere) => {
    setAttrezzoInModifica(a.id || null)
    setDescrizioneAttrezzoModifica(a.descrizione || '')
    setQuantitaAttrezzoModifica(
      a.quantita !== undefined && a.quantita !== null ? String(a.quantita) : ''
    )
    setPrezzoAttrezzoModifica(
      a.prezzo_unitario !== undefined && a.prezzo_unitario !== null
        ? String(a.prezzo_unitario)
        : ''
    )
    setFornitoreAttrezzoModifica(a.fornitore || '')
    setDataDocumentoAttrezzoModifica(a.data_documento || '')
    setNomeFileAttrezzoModifica(a.nome_file || '')
    setNotaAttrezzoModifica(a.nota || '')
  }

  const annullaModificaAttrezzo = () => {
    setAttrezzoInModifica(null)
    setDescrizioneAttrezzoModifica('')
    setQuantitaAttrezzoModifica('')
    setPrezzoAttrezzoModifica('')
    setFornitoreAttrezzoModifica('')
    setDataDocumentoAttrezzoModifica('')
    setNomeFileAttrezzoModifica('')
    setNotaAttrezzoModifica('')
  }

  const salvaModificaAttrezzo = async () => {
    if (!attrezzoInModifica) return

    const qta = parseFloat((quantitaAttrezzoModifica || '0').replace(',', '.'))
    const prezzo = parseFloat((prezzoAttrezzoModifica || '0').replace(',', '.'))

    const quantitaPulita = isNaN(qta) ? 0 : qta
    const prezzoPulito = isNaN(prezzo) ? 0 : prezzo
    const totale = quantitaPulita * prezzoPulito

    const { error } = await supabase
      .from('attrezzi_cantiere')
      .update({
        descrizione: descrizioneAttrezzoModifica.trim(),
        quantita: quantitaPulita,
        prezzo_unitario: prezzoPulito,
        totale,
        fornitore: fornitoreAttrezzoModifica.trim(),
        data_documento: dataDocumentoAttrezzoModifica || null,
        nome_file: nomeFileAttrezzoModifica.trim(),
        nota: notaAttrezzoModifica.trim(),
      })
      .eq('id', attrezzoInModifica)

    if (error) {
      alert('Errore modifica attrezzo: ' + error.message)
      return
    }

    annullaModificaAttrezzo()
    await caricaEconomia()
    alert('Attrezzo modificato')
  }

  const generaPDF = () => {
    const r = ultimoRapportino || {
      cantiere: cantiereRapporto,
      data,
      ore,
      note,
      operai,
      numero_presenti: numeroPresenti,
      ore_per_operaio: orePerOperaio,
      materiali,
      quantita_materiali: quantitaMateriali,
      costo_materiali: costoMateriali,
    }

    if (!r.cantiere) {
      alert('Non ci sono dati da esportare')
      return
    }

    const doc = new jsPDF()
    let y = 20

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text('ARTECNA', 20, y)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Gestione cantieri e rapportini di lavoro', 20, y + 6)

    doc.setLineWidth(0.6)
    doc.line(20, y + 10, 190, y + 10)

    y += 20

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('RAPPORTINO GIORNALIERO DI CANTIERE', 20, y)

    y += 12

    doc.setFont('helvetica', 'bold')
    doc.text('Cantiere:', 20, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(r.cantiere || '-'), 45, y)

    doc.setFont('helvetica', 'bold')
    doc.text('Data:', 140, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(r.data || '-'), 155, y)

    y += 10

    doc.setFont('helvetica', 'bold')
    doc.text('Ore totali:', 20, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(r.ore || '-'), 45, y)

    y += 15

    doc.setFont('helvetica', 'bold')
    doc.text('OPERAI PRESENTI', 20, y)
    doc.line(20, y + 2, 80, y + 2)

    y += 10

    doc.setFont('helvetica', 'bold')
    doc.text('Nomi:', 20, y)
    doc.setFont('helvetica', 'normal')
    const operaiLines = doc.splitTextToSize(String(r.operai || '-'), 145)
    doc.text(operaiLines, 45, y)

    y += operaiLines.length * 6 + 4

    doc.setFont('helvetica', 'bold')
    doc.text('Numero presenti:', 20, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(r.numero_presenti || '-'), 55, y)

    doc.setFont('helvetica', 'bold')
    doc.text('Ore per operaio:', 100, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(r.ore_per_operaio || '-'), 140, y)

    y += 15

    doc.setFont('helvetica', 'bold')
    doc.text('MATERIALI USATI', 20, y)
    doc.line(20, y + 2, 85, y + 2)

    y += 10

    doc.setFont('helvetica', 'bold')
    doc.text('Materiali:', 20, y)
    doc.setFont('helvetica', 'normal')
    const materialiLines = doc.splitTextToSize(String(r.materiali || '-'), 140)
    doc.text(materialiLines, 50, y)

    y += materialiLines.length * 6 + 4

    doc.setFont('helvetica', 'bold')
    doc.text('Quantità:', 20, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(r.quantita_materiali || '-'), 40, y)

    doc.setFont('helvetica', 'bold')
    doc.text('Costo materiali:', 100, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(r.costo_materiali || '-'), 138, y)

    y += 15

    doc.setFont('helvetica', 'bold')
    doc.text('NOTE LAVORAZIONI', 20, y)
    doc.line(20, y + 2, 95, y + 2)

    y += 10

    doc.setFont('helvetica', 'normal')
    const noteLines = doc.splitTextToSize(String(r.note || '-'), 170)
    doc.text(noteLines, 20, y)

    y += noteLines.length * 6 + 20

    if (y < 240) {
      doc.setFont('helvetica', 'normal')
      doc.line(20, y, 80, y)
      doc.line(120, y, 180, y)
      doc.text('Firma impresa', 20, y + 7)
      doc.text('Firma cliente', 120, y + 7)
    }

    doc.save(`rapportino-${String(r.cantiere || 'artecna')}.pdf`)
  }

  const rapportiniFiltrati = filtroCantiere
    ? rapportini.filter((r) => r.cantiere === filtroCantiere)
    : rapportini

  const fotoFiltrate = filtroCantiere
    ? fotoCantiere.filter((f) => f.cantiere === filtroCantiere)
    : fotoCantiere

  const rapportiniScheda = cantiereScheda
    ? rapportini.filter((r) => r.cantiere === cantiereScheda)
    : []

  const fotoScheda = cantiereScheda
    ? fotoCantiere.filter((f) => f.cantiere === cantiereScheda)
    : []

  const timbratureOggi = timbrature.filter((t) => t.data === oggi)

  const operaiFiltrati = operaiAnagrafica.filter((o) => {
    const testo =
      `${o.nome || ''} ${o.telefono || ''} ${o.qualifica || ''} ${o.nota || ''} ${o.stato || ''}`.toLowerCase()
    return testo.includes(ricercaOperaio.toLowerCase())
  })

  const operaiAttivi = operaiAnagrafica.filter((o) => o.stato !== 'sospeso')

const cantieriAttivi = cantieri.filter((c) => !c.lavori_conclusi)

const totaleCantieri = cantieriAttivi.length
  const totaleRapportini = rapportini.length
  const totaleFoto = fotoCantiere.length
  const totaleOperai = operaiAnagrafica.length

  const rapportiniOggi = rapportini.filter((r) => r.data === oggi)
  const totaleRapportiniOggi = rapportiniOggi.length

  const oreTotaliOggi = rapportiniOggi.reduce((tot, r) => {
    const valore = parseFloat(String(r.ore).replace(',', '.'))
    return tot + (isNaN(valore) ? 0 : valore)
  }, 0)

  const costoTotaleTimbratureOggi = timbratureOggi.reduce((tot, t) => {
    return tot + calcolaCostoTimbratura(t)
  }, 0)

const costoPerCantiereOggi = () => {
  const risultato: { [key: string]: number } = {}

  timbratureOggi.forEach((t) => {
    const costo = calcolaCostoTimbratura(t)

    if (!risultato[t.cantiere]) {
      risultato[t.cantiere] = 0
    }


    risultato[t.cantiere] += costo
  })

  return risultato
}

const totaleAccontiCantiere = accontiCantiere
 .filter((a) => {
  if (a.cantiere !== cantiereScheda) return false

  if (
    economiaDataDa &&
    String(a.data_incasso || '') < economiaDataDa
  ) {
    return false
  }

  if (
    economiaDataA &&
    String(a.data_incasso || '') > economiaDataA
  ) {
    return false
  }

  return true
})
  .reduce((tot, a) => tot + Number(a.importo || 0), 0)


  const costoGiornalieroCantiereSelezionato = timbrature
    .filter((t) => t.cantiere === cantiereScheda && t.data === oggi)
    .reduce((tot, t) => tot + calcolaCostoTimbratura(t), 0)

const costoTotaleRapportino = operaiRapportino.reduce(
  (tot, o) => tot + o.ore * o.costo,
  0
)

const totaleFinaleRapportino =
  costoTotaleRapportino + Number(costoExtraRapportino || 0)

  const costoGiornalieroRapportino = timbrature
    .filter((t) => t.cantiere === cantiereRapporto && t.data === oggi)
    .reduce((tot, t) => tot + calcolaCostoTimbratura(t), 0)

  const ultimiCantieri = cantieri.slice(0, 5)
  const ultimiRapportini = rapportini.slice(0, 5)
  const ultimeFoto = fotoCantiere.slice(0, 4)

 const cantiereSelezionato = cantieri.find(
  (c) => c.nome === cantiereScheda
)

const totalePreventiviCaricati = preventivi
  .filter((p) => p.cantiere === cantiereScheda)
  .reduce((tot, p) => {
    const valoreDaUsare =
      (p as any).importo_corretto &&
      String((p as any).importo_corretto).trim() !== ''
        ? (p as any).importo_corretto
        : p.importo_totale

    return tot + parseImporto(valoreDaUsare)
  }, 0)
const preventivoCantiere =
  totalePreventiviCaricati > 0
    ? totalePreventiviCaricati
    : Number(cantiereSelezionato?.preventivo || 0)

const residuoDaIncassare =
  Number(preventivoCantiere || 0) - totaleAccontiCantiere
  const totaleMaterialiEconomia = materialiCantiere
  .filter((m) => {
    if (m.cantiere !== cantiereScheda) return false

    if (
      economiaDataDa &&
      String(m.data_documento || '') < economiaDataDa
    ) {
      return false
    }

    if (
      economiaDataA &&
      String(m.data_documento || '') > economiaDataA
    ) {
      return false
    }

    return true
  })
  .reduce((tot, m) => tot + Number(m.totale || 0), 0)


  const totaleAttrezziEconomia = attrezziCantiere
    .filter((a) => a.cantiere === cantiereScheda)
    .reduce((tot, a) => tot + Number(a.totale || 0), 0)
const totaleVociAnalizzate = vociAnalizzate.reduce((tot, voce) => {
  if (voce.quantita !== undefined && voce.prezzo !== undefined) {
    return tot + voce.quantita * voce.prezzo
  }
  return tot
}, 0)

 const totaleManodoperaTimbrature = timbrature
  .filter((t) => {
    if (t.cantiere !== cantiereScheda) return false

    if (economiaDataDa && String(t.data || '') < economiaDataDa) {
      return false
    }

    if (economiaDataA && String(t.data || '') > economiaDataA) {
      return false
    }

    return true
  })
  .reduce((tot, t) => tot + calcolaCostoTimbratura(t), 0)

const totaleManodoperaRapportini = rapportini
  .filter((r) => {
    if (r.cantiere !== cantiereScheda) return false

    if (economiaDataDa && String(r.data || '') < economiaDataDa) {
      return false
    }

    if (economiaDataA && String(r.data || '') > economiaDataA) {
      return false
    }

    return true
  })
  .reduce(
    (tot, r) => tot + Number((r as any).costo_manodopera || 0),
    0
  )

const totaleManodoperaCantiere =
  totaleManodoperaTimbrature + totaleManodoperaRapportini

const totaleCostiCantiere =
  totaleManodoperaCantiere +
  totaleMaterialiEconomia +
  totaleAttrezziEconomia +
  (includiVociAnalizzateNeiCosti ? totaleVociAnalizzate : 0)

const utileCantiere = preventivoCantiere - totaleCostiCantiere

const dashboardCantieri = cantieri.map((c) => {
  const totalePreventiviCaricati = preventivi
    .filter((p) => p.cantiere === c.nome)
    .reduce((tot, p) => {
      const valoreDaUsare =
        (p as any).importo_corretto &&
        String((p as any).importo_corretto).trim() !== ''
          ? (p as any).importo_corretto
          : p.importo_totale

      return tot + parseImporto(valoreDaUsare)
    }, 0)

  const preventivo =
    totalePreventiviCaricati > 0
      ? totalePreventiviCaricati
      : parseImporto(c.preventivo)

  const materiali = materialiCantiere
    .filter((m) => m.cantiere === c.nome)
    .reduce((tot, m) => tot + Number(m.totale || 0), 0)

  const attrezzi = attrezziCantiere
    .filter((a) => a.cantiere === c.nome)
    .reduce((tot, a) => tot + Number(a.totale || 0), 0)

  const manodoperaTimbrature = timbrature
    .filter((t) => t.cantiere === c.nome)
    .reduce((tot, t) => tot + calcolaCostoTimbratura(t), 0)

  const manodoperaRapportini = rapportini
    .filter((r) => r.cantiere === c.nome)
    .reduce(
      (tot, r) => tot + Number((r as any).costo_manodopera || 0),
      0
    )

  const manodopera =
    manodoperaTimbrature + manodoperaRapportini

  const costi = materiali + attrezzi + manodopera
  const utile = preventivo - costi
  const margine = preventivo > 0 ? (utile / preventivo) * 100 : 0

  return {
    nome: c.nome,
    preventivo,
    costi,
    utile,
    margine,
  }
})

const calcolaOreTimbratura = (entrata?: string, uscita?: string) => {
  if (!entrata || !uscita) return '-'

  const [eh, em] = entrata.split(':').map(Number)
  const [uh, um] = uscita.split(':').map(Number)

  const minutiEntrata = eh * 60 + em
  const minutiUscita = uh * 60 + um
  const differenza = minutiUscita - minutiEntrata

  if (differenza <= 0) return '-'

  const ore = Math.floor(differenza / 60)
  const minuti = differenza % 60

  return minuti === 0 ? `${ore} ore` : `${ore}h ${minuti}m`
}

const minutiDaOra = (ora?: string) => {
  if (!ora) return 0

  const [h, m] = ora.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return 0

  return h * 60 + m
}

const calcolaOreNumero = (entrata?: string, uscita?: string) => {
  if (!entrata || !uscita) return 0

  const minutiEntrata = minutiDaOra(entrata)
  const minutiUscita = minutiDaOra(uscita)

  const diff = minutiUscita - minutiEntrata
  if (diff <= 0) return 0

  return diff / 60
}

const totaleOreOperaio = (operaio: string) => {
  return timbrature
    .filter((t) => t.operaio_nome === operaio)
    .reduce(
      (tot, t) =>
        tot + calcolaOreNumero(t.ora_entrata, t.ora_uscita),
      0
    )
}



const totalePreventiviImpresa = dashboardCantieri.reduce((tot, c) => tot + c.preventivo, 0)
const totaleCostiImpresa = dashboardCantieri.reduce((tot, c) => tot + c.costi, 0)
const utileTotaleImpresa = totalePreventiviImpresa - totaleCostiImpresa
const margineMedioImpresa =
  totalePreventiviImpresa > 0 ? (utileTotaleImpresa / totalePreventiviImpresa) * 100 : 0



const classificaCantieri = dashboardCantieri
  .filter((c) => !cantieri.find((x) => x.nome === c.nome)?.lavori_conclusi)
  .sort((a, b) => b.utile - a.utile)


const storicoUtileCantieri = cantieri.map((c) => {
  const preventivo = Number(c.preventivo || 0)

  const manodoperaGiorno = timbrature
    .filter(
      (t) =>
        t.cantiere === c.nome &&
        t.data &&
        t.data <= dataStoricoUtile
    )
    .reduce((tot, t) => tot + calcolaCostoTimbratura(t), 0)

  const utileGiorno = preventivo - manodoperaGiorno

  return {
    nome: c.nome,
    preventivo,
    manodoperaGiorno,
    utileGiorno,
  }
})



  const margineCantiere =
    preventivoCantiere > 0
      ? ((utileCantiere / preventivoCantiere) * 100).toFixed(2)
      : '0.00'

 
  const buttonPrimary: CSSProperties = {
    padding: '10px 14px',
    backgroundColor: '#0f172a',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
  }

  const buttonSecondary: CSSProperties = {
    padding: '10px 14px',
    backgroundColor: '#f3f4f6',
    color: '#111827',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
  }

  const badgeStyle = (stato?: string): CSSProperties => ({
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    marginLeft: 8,
    backgroundColor: stato === 'sospeso' ? '#fee2e2' : '#dcfce7',
    color: stato === 'sospeso' ? '#991b1b' : '#166534',
    border: stato === 'sospeso' ? '1px solid #fecaca' : '1px solid #bbf7d0',
  })
const togglePaginaAperta = (pagina: string) => {
  setPagineAperte((prev) =>
    prev.includes(pagina)
      ? prev.filter((p) => p !== pagina)
      : [...prev, pagina]
  )
}
const labelStyle = {
  display: 'block',
  fontSize: 13,
  color: '#cbd5e1',
  marginBottom: 4,
}

const sectionTitle = {
  marginTop: 8,
  marginBottom: 4,
  fontSize: 12,
  color: '#94a3b8',
}
const calcolaOre = (t: Timbratura) => {
  const entrata = parseOra(t.ora_entrata)
  const uscita = parseOra(t.ora_uscita)

  if (entrata === null || uscita === null || uscita < entrata) return 0

  return (uscita - entrata) / 60
}



const timbratureFiltrate = timbrature.filter((t) => {
  if (dataDa && t.data < dataDa) return false
  if (dataA && t.data > dataA) return false
  if (cantiereGrafico && t.cantiere !== cantiereGrafico) return false
  return true
})

const totaleCostoPeriodo = timbratureFiltrate.reduce((tot, t) => {
  return tot + calcolaCostoTimbratura(t)
}, 0)

const totaleOrePeriodo = timbratureFiltrate.reduce((tot, t) => {
  return tot + calcolaOre(t)
}, 0)

const totaleMaturatoOperai = timbrature.reduce((tot, t) => {
  return tot + calcolaCostoTimbratura(t)
}, 0)

const totalePagatoOperai = pagamentiOperai.reduce((tot, p) => {
  return tot + Number(p.importo || 0)
}, 0)

const residuoPagamentiOperai = totaleMaturatoOperai - totalePagatoOperai

const giorniAllaScadenzaPagamenti = scadenzaPagamentiOperai
  ? Math.ceil(
      (new Date(scadenzaPagamentiOperai).getTime() - new Date(oggi).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  : null

const costoOperaiPerCantiere = timbrature.reduce((acc: any, t) => {
  const cantiere = t.cantiere || 'Senza cantiere'

  if (!acc[cantiere]) {
    acc[cantiere] = 0
  }

  acc[cantiere] += calcolaCostoTimbratura(t)

  return acc
}, {})


const situazioneCantieri = cantieri.map((c) => {
  const nome = c.nome

  const acconti = accontiCantiere
    .filter((a) => a.cantiere === nome)
    .reduce((tot, a) => tot + Number(a.importo || 0), 0)

  const costoOperai = timbrature
    .filter((t) => t.cantiere === nome)
    .reduce((tot, t) => tot + calcolaCostoTimbratura(t), 0)

  const costoMateriali = materialiCantiere
    .filter((m) => m.cantiere === nome)
    .reduce((tot, m) => tot + Number(m.totale || 0), 0)

  const costoAttrezzi = attrezziCantiere
    .filter((a) => a.cantiere === nome)
    .reduce((tot, a) => tot + Number(a.totale || 0), 0)

  const costiTotali =
    costoOperai + costoMateriali + costoAttrezzi

  const saldo =
    acconti - costiTotali


const preventivo =
  Number(c.preventivo || 0)

const stimaMateriali =
  preventivo * 0.28

const stimaManodopera =
  preventivo * 0.32

const stimaCostiTotali =
  stimaMateriali + stimaManodopera + costoAttrezzi

const utileStimato =
  preventivo - stimaCostiTotali

const differenzaCosti =
  stimaCostiTotali - costiTotali

  let stato = 'ok'

  if (saldo < 0) {
    stato = 'critico'
  } else if (saldo < costiTotali * 0.15) {
    stato = 'attenzione'
  }

  return {
    nome,
    acconti,
    costoOperai,
    costoMateriali,
    costoAttrezzi,
    costiTotali,
    saldo,
    stato,

preventivo,
stimaMateriali,
stimaManodopera,
stimaCostiTotali,
utileStimato,
differenzaCosti,
  }
})


const statoScadenzaPagamenti =
  giorniAllaScadenzaPagamenti === null
    ? 'nessuna'
    : giorniAllaScadenzaPagamenti < 0
    ? 'scaduto'
    : giorniAllaScadenzaPagamenti <= giorniPreavvisoPagamenti
    ? 'attenzione'
    : 'ok'

const aggiungiPresenzaManuale = async () => {
  if (!operaioPresenzaManuale || !cantierePresenzaManuale || !dataPresenzaManuale || !oraEntrataManuale) {
    alert('Compila operaio, cantiere, data e ora entrata')
    return
  }

  const { error } = await supabase.from('timbrature').insert([
    {
      operaio_nome: operaioPresenzaManuale,
      cantiere: cantierePresenzaManuale,
      data: dataPresenzaManuale,
      ora_entrata: oraEntrataManuale,
      ora_uscita: oraUscitaManuale || null,
      stato: oraUscitaManuale ? 'chiuso' : 'aperto',
    },
  ])

  if (error) {
    alert('Errore inserimento presenza: ' + error.message)
    return
  }

  setOperaioPresenzaManuale('')
  setCantierePresenzaManuale('')
  setOraEntrataManuale('')
  setOraUscitaManuale('')

  await caricaTimbrature()
  alert('Presenza inserita')
}
const erroreTimbratura = (t: Timbratura) => {
  const entrata = parseOra(t.ora_entrata)
  const uscita = parseOra(t.ora_uscita)

  if (!t.ora_uscita || t.stato === 'aperto') {
    return '⚠️ Mancata uscita'
  }

  if (entrata !== null && uscita !== null && uscita < entrata) {
    return '🚨 Uscita precedente all’entrata'
  }

  const ore = calcolaOre(t)

  if (ore > 10) {
    return `⚠️ Ore eccessive: ${ore.toFixed(2)} h`
  }

  return ''
}
const eliminaFileDaStorage = async (filePath?: string | null) => {
  if (!filePath) return

  const { error } = await supabase.storage
    .from('preventivi')
    .remove([filePath])

  if (error) {
    console.error('Errore cancellazione Storage:', error.message)
    throw error
  }
}

const salvaDocumentoComeMaterialeUnico = async () => {
  if (!cantiereScheda) {
    alert('Seleziona prima un cantiere')
    return
  }

  if (!fileAnalisiDocumento) {
    alert('Seleziona prima un file')
    return
  }

  const importo = parseImporto(importoRilevatoDocumento)

  if (!importo || importo <= 0) {
    alert('Importo non valido')
    return
  }

  // 🔥 👇 INSERISCI QUI (PRIMA DELL'INSERT)

  const estensione = fileAnalisiDocumento.name.split('.').pop()?.toLowerCase() || 'file'

  let fileTipo = 'altro'
  if (estensione === 'pdf') fileTipo = 'pdf'
  if (estensione === 'xlsx' || estensione === 'xls') fileTipo = 'excel'
  if (['jpg', 'jpeg', 'png', 'webp'].includes(estensione)) fileTipo = 'img'

  const nomePulito = fileAnalisiDocumento.name
    .replace(/\.[^/.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')

  const cantierePulito = (cantiereScheda || 'senza_cantiere')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9_-]/g, '_')
  .replace(/_+/g, '_')
  .replace(/^_+|_+$/g, '')
  .toUpperCase()

const fileName = `cantieri/${cantierePulito}/documenti/${Date.now()}_${nomePulito}.${estensione}`

  const { error: uploadError } = await supabase.storage
    .from('preventivi')
    .upload(fileName, fileAnalisiDocumento)

  if (uploadError) {
    alert('Errore upload file: ' + uploadError.message)
    return
  }

  const { data } = supabase.storage
    .from('preventivi')
    .getPublicUrl(fileName)

  const fileUrl = data.publicUrl

  // 🔥 👇 DOPO L’UPLOAD → INSERT

  const { error } = await supabase.from('materiali_cantiere').insert([
    {
      cantiere: cantiereScheda,
      descrizione: nomeFileAnalisiDocumento || 'Documento analizzato',
      quantita: 1,
      prezzo_unitario: importo,
      totale: importo,
      fornitore: 'Documento analizzato',
      data_documento: oggi,
      nome_file: nomeFileAnalisiDocumento || 'Documento analizzato',

      file_url: fileUrl,
      file_tipo: fileTipo,
file_path: fileName,
      anteprima_testo: testoEstrattoDocumento,
    },
  ])

  if (error) {
    alert('Errore salvataggio materiale: ' + error.message)
    return
  }

  await caricaEconomia()
  alert('Documento salvato come materiale')
}

const voceMenuStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 10px',
  borderRadius: 8,
  cursor: 'pointer',
}

const voceSinistra = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const caricaImpostazioniSupabase = async () => {
  const { data, error } = await supabase
    .from('impostazioni_app')
    .select('*')

  if (error) {
    console.error('Errore caricamento impostazioni:', error.message)
    return
  }

  data?.forEach((item) => {
    if (item.chiave === 'fontFamily') setFontFamily(item.valore || 'Inter')
    if (item.chiave === 'fontSize') setFontSize(Number(item.valore || 15))
    if (item.chiave === 'nomeApp') setNomeApp(item.valore || 'ARTECNA')
    if (item.chiave === 'temaApp') setTemaApp(item.valore || 'scuro')
  })
}

const salvaImpostazioneSupabase = async (chiave: string, valore: string) => {
  const { error } = await supabase
    .from('impostazioni_app')
    .upsert(
      { chiave, valore },
      { onConflict: 'chiave' }
    )

  if (error) {
    alert('Errore salvataggio impostazione: ' + error.message)
  }
}

const [emailLogin, setEmailLogin] = useState('')
const [passwordLogin, setPasswordLogin] = useState('')
const [utente, setUtente] = useState<any>(null)
const [ricordaEmail, setRicordaEmail] = useState(true)

const login = async () => {
console.log('EMAIL:', emailLogin)
console.log('PASSWORD LEN:', passwordLogin.length)

console.log(
  'URL:',
  process.env.NEXT_PUBLIC_SUPABASE_URL
)

console.log(
  'KEY START:',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 15)
)
  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailLogin,
    password: passwordLogin,
  })

  if (error) {
    alert('Errore login: ' + error.message)
    return
  }

  if (ricordaEmail) {
    localStorage.setItem('artecna_email', emailLogin)
  } else {
    localStorage.removeItem('artecna_email')
  }

  setUtente(data.user)
}


const registrati = async () => {
  const { data, error } = await supabase.auth.signUp({
    email: emailLogin,
    password: passwordLogin,
  })

  if (error) {
    alert('Errore registrazione: ' + error.message)
    return
  }

  setUtente(data.user)
}

if (!utente) {
  return (
    <LoginForm
      emailLogin={emailLogin}
      passwordLogin={passwordLogin}
      mostraPassword={mostraPassword}
      inputStyle={inputStyle}
      buttonPrimary={buttonPrimary}
      buttonSecondary={buttonSecondary}
      setEmailLogin={setEmailLogin}
      setPasswordLogin={setPasswordLogin}
      setMostraPassword={setMostraPassword}
      login={login}
      registrati={registrati}
    />
  )
}








const salvaFatturaFornitore = async () => {
  if (!fatturaNumero || !fatturaData) {
  alert('Dati fattura incompleti: manca numero o data fattura')
  return
}

  if (righeFatturaDaAssegnare.length === 0) {
    alert('Nessuna riga da salvare')
    return
  }

  const totale = Number(String(fatturaTotale).replace(',', '.')) || 0

  const { data: duplicati, error: erroreDuplicati } = await supabase
    .from('fatture_fornitori')
    .select('*')
    .eq('partita_iva', fatturaPartitaIva || '')
    .eq('numero_fattura', fatturaNumero)
    .eq('data_fattura', fatturaData)
    .eq('importo_totale', totale)

  if (erroreDuplicati) {
    alert('Errore controllo duplicati: ' + erroreDuplicati.message)
    return
  }

  if (duplicati && duplicati.length > 0) {
    alert('Questa fattura risulta già caricata.')
    return
  }

  const righeAssegnate = righeFatturaDaAssegnare.filter((r) => r.cantiere)

for (const riga of righeAssegnate) {
  const totaleMateriale =
    Number(riga.totale_riga || 0)

  await supabase
    .from('materiali_cantiere')
    .insert({
      cantiere: riga.cantiere,
      descrizione: riga.descrizione,
      quantita: riga.quantita || 1,
      prezzo_unitario: riga.prezzo_unitario || 0,
      totale: Number(riga.totale_riga || 0),
      fornitore: fatturaFornitore,
      data_documento: fatturaData,
      nome_file: fatturaNomeFile,
      file_tipo: fatturaTipoFile,
      anteprima_testo: fatturaTestoOriginale,
    })
}

  if (righeAssegnate.length === 0) {
    alert('Assegna almeno una riga a un cantiere o a Generale impresa')
    return
  }

  const stato =
    righeAssegnate.length === righeFatturaDaAssegnare.length
      ? 'assegnata'
      : 'parzialmente_assegnata'

  const { data: fatturaInserita, error: erroreFattura } = await supabase
    .from('fatture_fornitori')
    .insert({
      fornitore: fatturaFornitore,
      partita_iva: fatturaPartitaIva,
      numero_fattura: fatturaNumero,
      data_fattura: fatturaData,
      tipo_documento: 'fattura',
      importo_totale: totale,
      nome_file: fatturaNomeFile,
      tipo_file: fatturaTipoFile || 'xml',
      xml_testo: fatturaTipoFile === 'xml' ? fatturaTestoOriginale : null,
      pdf_testo: fatturaTipoFile === 'pdf' ? fatturaTestoOriginale : null,
      stato,
    })
    .select()
    .single()

  if (erroreFattura) {
    alert('Errore salvataggio fattura: ' + erroreFattura.message)
    return
  }

  const fatturaId = fatturaInserita.id

  const righeDaSalvare = righeAssegnate.map((r) => ({
  fattura_id: fatturaInserita.id,
  numero_riga: r.numero_riga,
  descrizione: r.descrizione,
  quantita: Number(r.quantita || 0),
  prezzo_unitario: Number(r.prezzo_unitario || 0),

  aliquota_iva: Number(r.aliquota_iva || 0),

  totale_riga: Number(r.totale_riga || 0),

  cantiere: r.cantiere,
  stato: r.cantiere ? 'assegnata' : 'da_assegnare',
}))

  const { error: erroreRighe } = await supabase
    .from('fatture_fornitori_righe')
    .insert(righeDaSalvare)

  if (erroreRighe) {
    alert('Errore salvataggio righe fattura: ' + erroreRighe.message)
    return
  }

  const materialiDaSalvare = righeAssegnate
    .filter((r) => r.cantiere !== 'Generale impresa')
    .map((r) => ({
      cantiere: r.cantiere,
      descrizione: `${fatturaFornitore} - ${r.descrizione}`,
     totale: Number(r.totale_riga || 0),
      data: fatturaData,
      nome_file: fatturaNomeFile,
      file_tipo: fatturaTipoFile || 'xml',
      anteprima_testo: `Fattura ${fatturaNumero} del ${fatturaData}`,
    }))
console.log('MATERIALI DA SALVARE:', materialiDaSalvare)
alert('Materiali da salvare in economia: ' + materialiDaSalvare.length)

  if (materialiDaSalvare.length > 0) {
    const { error: erroreMateriali } = await supabase
      .from('materiali_cantiere')
      .insert(materialiDaSalvare)

    if (erroreMateriali) {
      alert('Errore salvataggio materiali cantiere: ' + erroreMateriali.message)
      return
    }
  }


  const { error: errorePagamento } = await supabase
    .from('pagamenti_fornitori')
    .insert({
      fornitore: fatturaFornitore,
      descrizione: `Fattura ${fatturaNumero} del ${fatturaData}`,
      importo: totale,
      data_scadenza: fatturaData,
      stato: 'da_pagare',
      note: fatturaNomeFile,
    })

  if (errorePagamento) {
    alert('Errore salvataggio pagamento fornitore: ' + errorePagamento.message)
    return
  }

  setFatturaFornitore('')
  setFatturaPartitaIva('')
  setFatturaNumero('')
  setFatturaData('')
  setFatturaTotale('')
  setFatturaNomeFile('')
  setFatturaTipoFile('')
  setFatturaTestoOriginale('')
  setRigheFatturaDaAssegnare([])
  setCantiereMassivoFattura('')

  await caricaEconomia()
  await caricaPagamentiFornitori()
  await caricaFattureFornitori()

  alert('Fattura salvata correttamente')
}

const importaFatturaSilenziosa = async (
  dati: {
    fornitore: string
    partitaIva?: string
    numero: string
    data: string
    totale: number
    nomeFile: string
    tipoFile: string
    testoOriginale?: string
  },
  righe: RigaFatturaDaAssegnare[]
) => {
  try {
    // controllo duplicato
    const { data: esistente } = await supabase
      .from('fatture_fornitori')
      .select('id')
      .eq('numero_fattura', dati.numero)
      .eq('fornitore', dati.fornitore)
      .maybeSingle()

    if (esistente) {
      return {
        stato: 'duplicato',
      }
    }

    // salva testata fattura
    const { data: fattura, error } = await supabase
      .from('fatture_fornitori')
      .insert({
        fornitore: dati.fornitore,
        partita_iva: dati.partitaIva || '',
        numero_fattura: dati.numero,
        data_fattura: dati.data,
        importo_totale: dati.totale,
        nome_file: dati.nomeFile,
        tipo_file: dati.tipoFile,
        stato: 'da_assegnare',
        xml_testo: dati.tipoFile === 'xml' ? dati.testoOriginale || '' : '',
pdf_testo: dati.tipoFile === 'pdf' ? dati.testoOriginale || '' : '',
      })
      .select()
      .single()

    if (error || !fattura) {
      console.error('Errore importazione fattura silenziosa:', error)

alert(
  'Errore importazione fattura silenziosa:\n' +
    JSON.stringify(error, null, 2)
)
      return {
        stato: 'errore',
      }
    }

    // salva righe
    if (righe.length > 0) {
      const righeInsert = righe.map((r) => ({
        fattura_id: fattura.id,
        numero_riga: r.numero_riga,
        descrizione: r.descrizione,
        quantita: r.quantita || 1,
        prezzo_unitario: r.prezzo_unitario || 0,
        totale_riga: r.totale_riga || 0,
        aliquota_iva: r.aliquota_iva || 0,
        unita_misura: r.unita_misura || '',
categoria_economica: r.categoria_economica || '',
        cantiere: r.cantiere || '',
       stato:
  r.cantiere || r.categoria_economica
    ? 'assegnata'
    : 'da_assegnare',
      }))

     const { error: erroreRighe } = await supabase
  .from('fatture_fornitori_righe')
  .insert(righeInsert)

if (erroreRighe) {
  const messaggioErrore = [
    erroreRighe.message,
    erroreRighe.details,
    erroreRighe.hint,
    erroreRighe.code,
  ]
    .filter(Boolean)
    .join('\n')

  alert(
    'Errore salvataggio righe import massivo:\n' +
      (messaggioErrore || 'Errore sconosciuto')
  )

  console.error('Errore righe import massivo:', {
    message: erroreRighe.message,
    details: erroreRighe.details,
    hint: erroreRighe.hint,
    code: erroreRighe.code,
  })

  return {
    stato: 'errore',
  }
}    }

    return {
      stato: 'importata',
    }
  } catch (errore) {
    console.error(errore)

    return {
      stato: 'errore',
    }
  }
}


const fattureOrdinate = [...fattureFornitori].sort((a: any, b: any) => {
  const valoreA = String(a[ordineFattureCampo] || '').toLowerCase()
  const valoreB = String(b[ordineFattureCampo] || '').toLowerCase()

  if (ordineFattureDirezione === 'asc') {
    return valoreA.localeCompare(valoreB)
  }

  return valoreB.localeCompare(valoreA)
})

const fattureEmesseOrdinate = [...fattureEmesse].sort((a: any, b: any) => {
  const campo = ordineFattureEmesseCampo

  let valoreA: any = a[campo] || ''
  let valoreB: any = b[campo] || ''

  if (
    campo === 'totale' ||
    campo === 'importo_incassato' ||
    campo === 'imponibile'
  ) {
    valoreA = Number(valoreA || 0)
    valoreB = Number(valoreB || 0)

    return ordineFattureEmesseDirezione === 'asc'
      ? valoreA - valoreB
      : valoreB - valoreA
  }

  valoreA = String(valoreA).toLowerCase()
  valoreB = String(valoreB).toLowerCase()

  return ordineFattureEmesseDirezione === 'asc'
    ? valoreA.localeCompare(valoreB)
    : valoreB.localeCompare(valoreA)
})
const ordinaRegistro = (
  campo: string,
  setCampo: any,
  setDirezione: any,
  campoAttuale: string
) => {
  if (campoAttuale === campo) {
    setDirezione((d: 'asc' | 'desc') =>
      d === 'asc' ? 'desc' : 'asc'
    )
  } else {
    setCampo(campo)
    setDirezione('asc')
  }
}

const esportaPdfFotoCantiere = async () => {
  if (!cantiereScheda) {
    alert('Seleziona prima un cantiere')
    return
  }

  const fotoDelCantiere = fotoCantiere.filter(
    (f) => f.cantiere === cantiereScheda
  )

  if (fotoDelCantiere.length === 0) {
    alert('Non ci sono foto da esportare per questo cantiere')
    return
  }

  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  pdf.setFontSize(18)
  pdf.text('Report fotografico cantiere', 14, 18)

  pdf.setFontSize(11)
  pdf.text(`Cantiere: ${cantiereScheda}`, 14, 28)
  pdf.text(`Data esportazione: ${new Date().toLocaleDateString('it-IT')}`, 14, 35)

  let y = 45

  let x = 14
let colonna = 0

for (const foto of fotoDelCantiere) {
  const cardWidth = 85
  const imageWidth = 75
  const maxImageHeight = 55

  if (y > 240) {
    pdf.addPage()
    y = 20
  }

  pdf.setDrawColor(220)
  pdf.roundedRect(x, y, cardWidth, 85, 3, 3)

  pdf.setFontSize(10)
 pdf.text(
  `Categoria: ${(foto.categoria || 'prima').toUpperCase()}`,
  x + 4,
  y + 8
)

 pdf.text(
  `Data: ${foto.data_foto || '-'}`,
  x + 4,
  y + 14
)

  const img = new Image()
  img.src = foto.immagine_base64

  await new Promise((resolve) => {
    img.onload = resolve
  })

 let imgWidth = imageWidth
let imgHeight = (img.height * imgWidth) / img.width

if (imgHeight > maxImageHeight) {
  imgHeight = maxImageHeight
  imgWidth = (img.width * imgHeight) / img.height
}

const imgX = x + 5 + (imageWidth - imgWidth) / 2

pdf.addImage(
  foto.immagine_base64,
  'JPEG',
  imgX,
  y + 18,
  imgWidth,
  imgHeight
)

  const testoPulito = (
  foto.nota || 'Nessuna nota'
)
  .replace(/[^\x00-\x7F]/g, '')

const note = pdf.splitTextToSize(
  testoPulito,
  72
)

pdf.text(note, x + 4, y + 80)

  if (colonna === 0) {
    x = 110
    colonna = 1
  } else {
    x = 14
    colonna = 0
    y += 95
  }
}

  pdf.save(`report-foto-${cantiereScheda}.pdf`)
}


const eliminaAttrezzatura = async (a: any) => {
  if (!a.id) return

  if (!confirm('Sei sicuro di eliminare questa attrezzatura?')) return

  try {
    await eliminaFileDaStorage(a.file_path)
  } catch {
    alert('Errore cancellazione file da Storage')
    return
  }

  const { error } = await supabase
    .from('attrezzi_cantiere')
    .delete()
    .eq('id', a.id)

  if (error) {
    alert('Errore eliminazione: ' + error.message)
    return
  }

  await caricaEconomia()
}

const modificaAcconto = async (a: any) => {
  const nuovoImporto = prompt(
    'Modifica importo acconto',
    String(a.importo || '')
  )

  if (nuovoImporto === null) return

  const importo = parseImporto(nuovoImporto)

  if (!importo || importo <= 0) {
    alert('Importo non valido')
    return
  }

  const nuovaDescrizione = prompt(
    'Modifica descrizione',
    a.descrizione || 'Acconto'
  )

  if (nuovaDescrizione === null) return

  const { error } = await supabase
    .from('acconti_cantiere')
    .update({
      importo,
      descrizione: nuovaDescrizione,
    })
    .eq('id', a.id)

  if (error) {
    alert('Errore modifica acconto: ' + error.message)
    return
  }

  await caricaAcconti()

  alert('Acconto modificato')
}

const eliminaAcconto = async (a: any) => {
  const conferma = confirm('Eliminare questo acconto?')

  if (!conferma) return

  const { error } = await supabase
    .from('acconti_cantiere')
    .delete()
    .eq('id', a.id)

  if (error) {
    alert('Errore eliminazione acconto: ' + error.message)
    return
  }

  await caricaAcconti()

  alert('Acconto eliminato')
}


const aggiornaFatturaEmessa = async () => {
  if (!fatturaEmessaAperta?.id) return

  const totale = Number(fatturaEmessaAperta.totale || 0)
  const incassato = Number(fatturaEmessaAperta.importo_incassato || 0)

  const stato =
    incassato <= 0
      ? 'emessa'
      : incassato >= totale
      ? 'incassata'
      : 'parziale'

  const { error } = await supabase
    .from('fatture_emesse')
    .update({
      importo_incassato: incassato,
      stato,
      cantiere: fatturaEmessaAperta.cantiere || null,
    })
    .eq('id', fatturaEmessaAperta.id)

  if (error) {
    alert('Errore aggiornamento: ' + error.message)
    return
  }

  await caricaFattureEmesse()

  setFatturaEmessaAperta(null)

  alert('Fattura aggiornata')
}

const eliminaFatturaEmessa = async () => {
  if (!fatturaEmessaAperta?.id) return

  const conferma = confirm(
    `Vuoi eliminare la fattura emessa n. ${fatturaEmessaAperta.numero_fattura}?`
  )

  if (!conferma) return

  const { error } = await supabase
    .from('fatture_emesse')
    .delete()
    .eq('id', fatturaEmessaAperta.id)

  if (error) {
    alert('Errore eliminazione fattura: ' + error.message)
    return
  }

  await caricaFattureEmesse()

  setFatturaEmessaAperta(null)

  alert('Fattura eliminata')
}
 return (

















<div
  style={{
    display: 'flex',
    minHeight: '100vh',
    fontFamily: fontFamily,
    fontSize: fontSize,
  }}
>

   <style>{`
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: #eef2f7;
    color: #0f172a;
  }

  /* TESTO GENERALE */
  p, span, label, div {
    color: #0f172a;
  }

  h1, h2, h3 {
    color: #0f172a;
  }

  /* INPUT */
  input:not(.impostazioni-input),
select:not(.impostazioni-input),
textarea:not(.impostazioni-input) {
    width: 100%;
    padding: 12px;
    margin-bottom: 10px;
    background: #ffffff !important;
    color: #0f172a !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: 10px;
    font-size: 15px;
  }

  input::placeholder,
  textarea::placeholder {
    color: #64748b !important;
  }

  input:focus,
  select:focus,
  textarea:focus {
    border-color: #2563eb !important;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
  }

  /* SELECT */
  select {
    cursor: pointer;
  }

  /* BUTTON */
  button {
    min-height: 42px;
    font-size: 14px;
  }

  /* SIDEBAR (mantiene testo bianco lì) */
  aside, aside * {
    color: white !important;
  }

`}</style>




<button
  onClick={() => setSidebarAperta(!sidebarAperta)}
  style={{
    position: 'fixed',
    top: 12,
   left: sidebarAperta ? 12 : 12,
    zIndex: 2000,
    background: '#0f172a',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 12px',
    cursor: 'pointer',
    boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
    transition: 'left 0.25s ease',
  }}
>
 {sidebarAperta ? '✕' : '☰ Menu'}
</button>

<aside
  style={{
    width: sidebarAperta ? 260 : 0,
    background: '#0f172a',
    color: '#fff',
    height: '100vh',
    transition: 'width 0.25s ease',
    overflowY: 'auto',
    overflowX: 'hidden',
    flexShrink: 0,
  }}
>





  <h2
  style={{
    marginTop: isMobile ? 60 : 0,
    letterSpacing: 1,
    textAlign: 'center',
    paddingTop: 10,
  }}
>
  {nomeApp}
</h2>
{menuAperto === 'impostazioni' && (
  <div style={{ marginLeft: 10, marginTop: 5, display: 'grid', gap: 8 }}>
    <label style={labelStyle}>
      Font:
      <input
        value={fontFamily}
        onChange={(e) => setFontFamily(e.target.value)}
        placeholder="Scegli font"
        style={{
          marginTop: 4,
          padding: 6,
          borderRadius: 6,
          backgroundColor: '#1e293b',
          color: '#f3f4f6',
          border: '1px solid #334155',
          fontSize: 'inherit',
          width: '100%',
        }}
      />
    </label>

    <label style={labelStyle}>
      Dimensione font:
      <input
        value={fontSize}
        onChange={(e) => setFontSize(Number(e.target.value))}
        placeholder="Dimensione font"
        style={{
          marginTop: 4,
          padding: 6,
          borderRadius: 6,
          backgroundColor: '#1e293b',
          color: '#f3f4f6',
          border: '1px solid #334155',
          fontSize: 13,
          width: '100%',
        }}
      />
    </label>
<label style={{ color: 'white' }}>
  Intestazione:
  <input
    className="impostazioni-input"
    value={nomeApp}
    onChange={(e) => setNomeApp(e.target.value)}
    placeholder="Nome app"
    style={{
      width: '100%',
      padding: 8,
      borderRadius: 8,
      backgroundColor: '#0f172a',
      color: '#ffffff',
      border: '1px solid #475569',
      marginTop: 4,
    }}
  />
</label>
  </div>
)}

  <div style={{ marginTop: 24, display: 'grid', gap: 8 }}>
    <button
      onClick={() => {
        setSezioneAttiva('home')
        setMenuAperto(null)
      }}
      style={menuButtonStyle(sezioneAttiva === 'home')}
    >
      🏠 Home
    </button>

<button
  onClick={() => {
    setSezioneAttiva('sopralluoghi')
    setMenuAperto(null)
  }}
  style={menuButtonStyle(sezioneAttiva === 'sopralluoghi')}
>
  📍 Sopralluoghi
</button>


    <div>
      <button
        onClick={() => {
          setMenuAperto(menuAperto === 'cantieri' ? null : 'cantieri')
          setSezioneAttiva('cantieri')
          setSottoSezioneCantieri('elenco')
        }}
        style={menuButtonStyle(sezioneAttiva === 'cantieri')}
      >
        🏗️ Cantieri {menuAperto === 'cantieri' ? '▲' : '▼'}
      </button>

      {menuAperto === 'cantieri' && (
        <div style={{ marginLeft: 10, marginTop: 5, display: 'grid', gap: 4 }}>
          <div
            onClick={() => {
              setSezioneAttiva('cantieri')
              setSottoSezioneCantieri('elenco')
            }}
            style={submenuButtonStyle(sottoSezioneCantieri === 'elenco')}
          >
            📋 Elenco
          </div>

          <div
            onClick={() => {
              setSezioneAttiva('cantieri')
              setSottoSezioneCantieri('scheda')
            }}
            style={submenuButtonStyle(sottoSezioneCantieri === 'scheda')}
          >
            🏗️ Scheda cantiere
          </div>

          <div
            onClick={() => {
              setSezioneAttiva('cantieri')
              setSottoSezioneCantieri('analisi')
            }}
            style={submenuButtonStyle(sottoSezioneCantieri === 'analisi')}
          >
            📄 Analisi documento
          </div>

          <div
            onClick={() => {
              setSezioneAttiva('cantieri')
              setSottoSezioneCantieri('economia')
            }}
            style={submenuButtonStyle(sottoSezioneCantieri === 'economia')}
          >
            📁 Fascicolo cantiere
          </div>
        </div>
      )}
    </div>

    <div>
      <button
        onClick={() => {
          setMenuAperto(menuAperto === 'operai' ? null : 'operai')
          setSezioneAttiva('operai')
          setSottoSezioneOperai('anagrafica')
        }}
        style={menuButtonStyle(sezioneAttiva === 'operai')}
      >
        👷 Operai {menuAperto === 'operai' ? '▲' : '▼'}
      </button>

      {menuAperto === 'operai' && (
        <div style={{ marginLeft: 10, marginTop: 5, display: 'grid', gap: 4 }}>
          <div
            onClick={() => {
              setSezioneAttiva('operai')
              setSottoSezioneOperai('anagrafica')
            }}
            style={submenuButtonStyle(sottoSezioneOperai === 'anagrafica')}
          >
            👷 Anagrafica
          </div>

          <div
            onClick={() => {
              setSezioneAttiva('operai')
              setSottoSezioneOperai('timbrature')
            }}
            style={submenuButtonStyle(sottoSezioneOperai === 'timbrature')}
          >
            🕒 Timbrature
          </div>

          <div
            onClick={() => {
              setSezioneAttiva('operai')
              setSottoSezioneOperai('presenze')
            }}
            style={submenuButtonStyle(sottoSezioneOperai === 'presenze')}
          >
            📋 Presenze / costi
          </div>
        </div>
      )}
    </div>

    <button
      onClick={() => {
        setSezioneAttiva('rapportini')
        setMenuAperto(null)
      }}
      style={menuButtonStyle(sezioneAttiva === 'rapportini')}
    >
      📄 Rapportini
    </button>

    <div>
      <button
        onClick={() =>
          setMenuAperto(menuAperto === 'pagamenti' ? null : 'pagamenti')
        }
        style={menuButtonStyle(sezioneAttiva === 'pagamenti')}
     >
  💳 Pagamenti{' '}
  {statoScadenzaPagamenti === 'attenzione' && '⚠️'}
  {statoScadenzaPagamenti === 'scaduto' && '🚨'}
  {menuAperto === 'pagamenti' ? '▲' : '▼'}
</button>

      {menuAperto === 'pagamenti' && (
        <div style={{ marginLeft: 10, marginTop: 5, display: 'grid', gap: 4 }}>
          <div
            onClick={() => {
              setSezioneAttiva('pagamenti')
              setSottoSezionePagamenti('operai')
            }}
            style={submenuButtonStyle(sottoSezionePagamenti === 'operai')}
          >
            👷 Pagamenti operai
          </div>

          <div
            onClick={() => {
              setSezioneAttiva('pagamenti')
              setSottoSezionePagamenti('fornitori')
            }}
            style={submenuButtonStyle(sottoSezionePagamenti === 'fornitori')}
          >
            🧾 Pagamenti fornitori
          </div>
        </div>
      )}
    </div>

    <button
      onClick={() => {
        setSezioneAttiva('economia')
        setMenuAperto(null)
      }}
      style={menuButtonStyle(sezioneAttiva === 'economia')}
    >
 
    💶 Economia generale
    </button>
<button
  onClick={() => {
    setSezioneAttiva('registro')
    setMenuAperto(null)
  }}
  style={menuButtonStyle(sezioneAttiva === 'registro')}
>
  📚 Registro
</button>
    <button
      onClick={() => {
        setSezioneAttiva('agenda')
        setMenuAperto(null)
      }}
      style={menuButtonStyle(sezioneAttiva === 'agenda')}
    >
      🗓️ Agenda
    </button>
    <button
      onClick={() => {
        setSezioneAttiva('attivita')
        setMenuAperto(null)
      }}
      style={menuButtonStyle(sezioneAttiva === 'attivita')}
    >

      📅 Attività
    </button>
<div style={{ marginTop: 10, padding: 8, borderTop: '1px solid #334155' }}>
  <button
    onClick={() => setApriChecklist(!apriChecklist)}
    style={{
      width: '100%',
      padding: '8px',
      background: '#1e40af',
      color: 'white',
      border: 'none',
      borderRadius: 6,
      cursor: 'pointer',
      fontWeight: 600,
    }}
  >

    📂 Apri più pagine {apriChecklist ? '▲' : '▼'}
  </button>

 {apriChecklist && (
  <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
    {[
      ['home', '🏠 Home'],
      ['cantieri-elenco', '📋 Elenco cantieri'],
      ['cantieri-scheda', '🏗️ Scheda cantiere'],
      ['cantieri-analisi', '📄 Analisi documento'],
      ['cantieri-economia', '📁 Fascicolo cantiere'],
      ['operai-anagrafica', '👷 Anagrafica operai'],
      ['operai-timbrature', '🕒 Timbrature'],
      ['operai-presenze', '📋 Presenze / costi'],
      ['rapportini', '📄 Rapportini'],
      ['pagamenti-operai', '👷 Pagamenti operai'],
      ['pagamenti-fornitori', '🧾 Pagamenti fornitori'],
      ['economia', '💶 Economia generale'],
      ['attivita', '📅 Attività'],
    ].map(([key, testo]) => (
      <label
        key={key}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '8px 10px',
          borderRadius: 8,
          cursor: 'pointer',
          color: '#f8fafc',
          fontSize: 'inherit',
          backgroundColor: pagineAperte.includes(key) ? '#1e3a8a' : 'transparent',
        }}
      >
        <span>{testo}</span>

        <input
          type="checkbox"
          checked={pagineAperte.includes(key)}
          onChange={() => togglePaginaAperta(key)}
        />
      </label>
    ))}
  </div>
)}
</div> {/* CHIUSURA BOX CHECKLIST */}

<button
  onClick={() => setMostraImpostazioni(!mostraImpostazioni)}
  style={buttonPrimary}
>
  ⚙️ Impostazioni {mostraImpostazioni ? '▲' : '▼'}
</button>

{mostraImpostazioni && (
  <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>

    <label style={{ color: '#f3f4f6', fontSize: 13 }}>
      Font:
      <select
        value={fontFamily}
        onChange={(e) => {
  setFontFamily(e.target.value)
  salvaImpostazioneSupabase('fontFamily', e.target.value)
}}
        style={{
          marginLeft: 6,
          padding: 6,
          borderRadius: 6,
          backgroundColor: '#1e293b',
          color: '#f3f4f6',
          border: '1px solid #334155',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        <option value="Inter">Inter</option>
        <option value="Arial">Arial</option>
        <option value="Helvetica">Helvetica</option>
        <option value="Avenir Next LT Pro Light">Avenir Next LT Pro Light</option>
        <option value="Microsoft JhengHei Light">Microsoft JhengHei Light</option>
        <option value="Verdana">Verdana</option>
      </select>
    </label>

    <label style={{ color: '#f3f4f6', fontSize: 13 }}>
      Dimensione font:
      <select
        value={fontSize}
       onChange={(e) => {
  const val = e.target.value
  setFontSize(Number(val))
  salvaImpostazioneSupabase('fontSize', val)
}}
        style={{
          marginLeft: 6,
          padding: 6,
          borderRadius: 6,
          backgroundColor: '#1e293b',
          color: '#f3f4f6',
          border: '1px solid #334155',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        <option value={13}>Piccolo</option>
        <option value={15}>Medio</option>
        <option value={18}>Grande</option>
        <option value={22}>Molto grande</option>
        <option value={24}>Grandissimo</option>
      </select>
    </label>
<label style={{ color: '#f3f4f6', fontSize: 'inherit' }}>
  Tema:
  <select
    value={temaApp}
    onChange={(e) => {
      setTemaApp(e.target.value)
      salvaImpostazioneSupabase('temaApp', e.target.value)
    }}
    style={{
      marginLeft: 6,
      padding: 6,
      borderRadius: 6,
      backgroundColor: '#1e293b',
      color: '#f3f4f6',
      border: '1px solid #334155',
      cursor: 'pointer',
    }}
  >
    <option value="scuro">Scuro</option>
    <option value="chiaro">Chiaro</option>
  </select>
</label>
    <label style={{ color: '#f3f4f6', fontSize: 13 }}>
      Nome intestazione:
      <input
        className="impostazioni-input"
        value={nomeApp}
        onChange={(e) => {
  setNomeApp(e.target.value)
  salvaImpostazioneSupabase('nomeApp', e.target.value)
}}
        placeholder="Nome app"
      />
    </label>
<hr
  style={{
    borderColor: '#334155',
    margin: '10px 0',
  }}
/>

<div
  style={{
    padding: 10,
    border: '1px solid #334155',
    borderRadius: 8,
    background: '#0f172a',
  }}
>
  <div
    style={{
      color: '#f3f4f6',
      fontWeight: 600,
      marginBottom: 8,
    }}
  >
    🤖 AI ARTECNA
  </div>

  <label
    style={{
      color: '#f3f4f6',
      fontSize: 13,
      display: 'block',
      marginBottom: 8,
    }}
  >
    Modello predefinito:

    <select
      value={modelloAiPredefinito}
      onChange={(e) => {
        setModelloAiPredefinito(e.target.value)
        salvaImpostazioneSupabase(
          'modelloAiPredefinito',
          e.target.value
        )
      }}
      style={{
        marginTop: 6,
        width: '100%',
        padding: 6,
        borderRadius: 6,
        backgroundColor: '#1e293b',
        color: '#f3f4f6',
        border: '1px solid #334155',
      }}
    >
      <option value="gpt-4.1-mini">
        GPT-4.1 Mini
      </option>

    
    </select>
  </label>

  <button
    onClick={() =>
      setMostraStoricoAi(!mostraStoricoAi)
    }
    style={{
      ...buttonSecondary,
      width: '100%',
      marginTop: 6,
    }}
  >
    🤖 Storico AI
  </button>
</div>
  </div>
)}


<p style={{ fontSize: 'inherit', color: '#cbd5e1' }}>Menu principale</p>

</div> {/* CHIUSURA GRID MENU */}
</aside>

 <main
  style={{
    flex: 1,
    padding: '80px 25px 25px 25px',
    height: '100vh',
    overflowY: 'auto',
    fontFamily: fontFamily,
    fontSize: `${fontSize}px`,
  }}
>




{popupFotoRapportino && (
  <PopupFotoRapportino
    buttonPrimary={buttonPrimary}
    buttonSecondary={buttonSecondary}
    fotoRapportinoTemp={fotoRapportinoTemp}
    setFotoRapportinoTemp={setFotoRapportinoTemp}
    notaFotoRapportino={notaFotoRapportino}
    setNotaFotoRapportino={setNotaFotoRapportino}
    cameraRapportinoAttiva={cameraRapportinoAttiva}
    setCameraRapportinoAttiva={setCameraRapportinoAttiva}
    fotoRapportinoFullscreen={fotoRapportinoFullscreen}
    setFotoRapportinoFullscreen={setFotoRapportinoFullscreen}
    geolocalizzazioneFoto={geolocalizzazioneFoto}
    ascoltoNoteFoto={ascoltoNoteFoto}
    webcamRapportinoRef={webcamRapportinoRef}
    caricaFotoRapportinoDaInput={caricaFotoRapportinoDaInput}
    rilevaPosizioneFoto={rilevaPosizioneFoto}
    salvaFotoRapportino={salvaFotoRapportino}
    scattaFotoRapportino={scattaFotoRapportino}
    avviaDettaturaNoteFoto={avviaDettaturaNoteFoto}
    fermaDettaturaNoteFoto={fermaDettaturaNoteFoto}
    setPopupFotoRapportino={setPopupFotoRapportino}
  />
)}

{popupOperaiRapportino && (
  <PopupOperaiRapportino
    operaiAnagrafica={operaiAnagrafica}
    operaiRapportinoTemp={operaiRapportinoTemp}
    setOperaiRapportinoTemp={setOperaiRapportinoTemp}
    inputStyle={inputStyle}
    buttonPrimary={buttonPrimary}
    buttonSecondary={buttonSecondary}
    formatMoney={formatMoney}
    setOperai={setOperai}
    setPopupOperaiRapportino={setPopupOperaiRapportino}
  />
)}

{fotoRapportinoAperte.length > 0 && (
  <PopupFotoRapportinoAperte
    fotoRapportinoAperte={fotoRapportinoAperte}
    setFotoRapportinoAperte={setFotoRapportinoAperte}
    onEliminaFotoRapportino={eliminaFotoRapportino}
    buttonSecondary={buttonSecondary}
  />
)}



{/* ================= MULTI PAGINE - LAYOUT AFFIANCATO PRO ================= */}
{modalitaMulti && pagineAperte.length > 0 && (
  <div
    style={{
      display: 'flex',
      gap: 16,
      overflowX: 'auto',
scrollBehavior: 'smooth',
WebkitOverflowScrolling: 'touch',
      paddingBottom: 12,
      marginBottom: 20,
    }}
  >
    {pagineAperte.includes('home') && (
      <div style={{ ...cardStyle, minWidth: 360, maxWidth: 420 }}>
        <h3>🏠 Home</h3>
        <p>Cantieri: {totaleCantieri}</p>
        <p>Operai: {totaleOperai}</p>
        <p>Rapportini: {totaleRapportini}</p>
        <p><strong>Utile:</strong> {formatMoney(utileTotaleImpresa)}</p>
      </div>
    )}

    {pagineAperte.includes('cantieri-elenco') && (
      <div style={{ ...cardStyle, minWidth: 420, maxWidth: 480 }}>
        <h3>🏗️ Elenco cantieri</h3>
        {cantieri.slice(0, 8).map((c, i) => (
          <div key={c.id || i} style={{ borderBottom: '1px solid #eee', padding: '6px 0' }}>
            <strong>{c.nome}</strong><br />
            Preventivo: {formatMoney(Number(c.preventivo || 0))}
          </div>
        ))}
      </div>
    )}

    {pagineAperte.includes('cantieri-economia') && (
      <div style={{ ...cardStyle, minWidth: 420, maxWidth: 480 }}>
        <h3>📁 Fascicolo cantiere</h3>
        <p>Cantiere: {cantiereScheda || 'nessuno'}</p>
        <p>Preventivo: {formatMoney(preventivoCantiere)}</p>
        <p>Manodopera: {formatMoney(totaleManodoperaCantiere)}</p>
        <p>Materiali: {formatMoney(totaleMaterialiEconomia)}</p>
        <p>Attrezzi: {formatMoney(totaleAttrezziEconomia)}</p>
        <p>
          <strong style={{ color: utileCantiere >= 0 ? 'green' : 'red' }}>
            Utile: {formatMoney(utileCantiere)}
          </strong>
        </p>
      </div>
    )}

  {pagineAperte.includes('operai-presenze') && (
  <HomePresenzeCostiCard
    cardStyle={cardStyle}
    costoTotaleTimbratureOggi={costoTotaleTimbratureOggi}
    presenzeOggi={timbratureOggi.length}
    formatMoney={formatMoney}
  />
)}
{pagineAperte.includes('pagamenti-operai') && (
  <HomePagamentiOperaiCard
    cardStyle={cardStyle}
    pagamentiOperai={pagamentiOperai}
    operaiAnagrafica={operaiAnagrafica}
  />
)}
    {pagineAperte.includes('pagamenti-fornitori') && (
      <div style={{ ...cardStyle, minWidth: 380, maxWidth: 440 }}>
        <h3>🧾 Pagamenti fornitori</h3>
        <p>Fornitori registrati: {pagamentiFornitori.length}</p>
        <p>
          Totale:{' '}
          {formatMoney(
            pagamentiFornitori.reduce(
              (tot, p) => tot + parseImporto(p.importo_totale),
              0
            )
          )}
        </p>
      </div>
    )}

   {pagineAperte.includes('economia') && (
  <HomeEconomiaGeneraleCard
    cardStyle={cardStyle}
    totalePreventiviImpresa={totalePreventiviImpresa}
    totaleCostiImpresa={totaleCostiImpresa}
    utileTotaleImpresa={utileTotaleImpresa}
    margineMedioImpresa={margineMedioImpresa}
    formatMoney={formatMoney}
  />
)}

    {pagineAperte.includes('attivita') && (
      <div style={{ ...cardStyle, minWidth: 360, maxWidth: 420 }}>
        <h3>📅 Attività</h3>
        <p>Agenda, scadenze, appuntamenti e promemoria.</p>
      </div>
    )}
  </div>
)}
    {pagineAperte.includes('cantieri-economia') && (
      <div style={cardStyle}>
        <h3>📁 Fascicolo cantiere</h3>
        <p>Cantiere: {cantiereScheda || 'nessuno'}</p>
        <p>Preventivo: {formatMoney(preventivoCantiere)}</p>
        <p>Manodopera: {formatMoney(totaleManodoperaCantiere)}</p>
        <p>Materiali: {formatMoney(totaleMaterialiEconomia)}</p>
        <p>Attrezzi: {formatMoney(totaleAttrezziEconomia)}</p>
        <p>Utile: {formatMoney(utileCantiere)}</p>
      </div>
    )}

   {pagineAperte.includes('operai-anagrafica') && (
  <HomeAnagraficaOperaiCard
    cardStyle={cardStyle}
    operaiAnagrafica={operaiAnagrafica}
    formatMoney={formatMoney}
  />
)}

   
  {pagineAperte.includes('rapportini') && (
  <HomeRapportiniCard
    cardStyle={cardStyle}
    totaleRapportini={totaleRapportini}
    totaleRapportiniOggi={totaleRapportiniOggi}
    oreTotaliOggi={oreTotaliOggi}
  />
)}
      {pagineAperte.includes('pagamenti-fornitori') && (
  <HomePagamentiFornitoriCard
    cardStyle={cardStyle}
    pagamentiFornitori={pagamentiFornitori}
    parseImporto={parseImporto}
    formatMoney={formatMoney}
  />
)}

    {pagineAperte.includes('economia') && (
      <div style={cardStyle}>
        <h3>💶 Economia generale</h3>
        <p>Totale preventivi: {formatMoney(totalePreventiviImpresa)}</p>
        <p>Totale costi: {formatMoney(totaleCostiImpresa)}</p>
        <p>Utile totale: {formatMoney(utileTotaleImpresa)}</p>
        <p>Margine medio: {margineMedioImpresa.toFixed(1)}%</p>
      </div>
    )}

    {pagineAperte.includes('attivita') && (
      <div style={cardStyle}>
        <h3>📅 Attività</h3>
        <p>Agenda, scadenze, appuntamenti e promemoria.</p>
      </div>
    )}
  
{/* ================= HOME ================= */}
{(
  pagineAperte.includes('home') ||
  (!modalitaMulti && sezioneAttiva === 'home')
) && (
  <HomeDashboardPanel
    cardStyle={cardStyle}
    buttonPrimary={buttonPrimary}
    buttonSecondary={buttonSecondary}
    assistenteAttivo={assistenteAttivo}
    avviaAssistenteVocale={avviaAssistenteVocale}
    fermaAssistenteVocale={fermaAssistenteVocale}
    classificaCantieri={classificaCantieri}
    formatMoney={formatMoney}
    mostraCantieriConclusi={mostraCantieriConclusi}
    setMostraCantieriConclusi={setMostraCantieriConclusi}
    cantieri={cantieri}
    calcoloEconomiaCantiere={calcoloEconomiaCantiere}
  />
)}

{/* ================= CANTIERI - ELENCO ================= */}
{(
  pagineAperte.includes('cantieri-elenco') ||
  (!modalitaMulti &&
    sezioneAttiva === 'cantieri' &&
    sottoSezioneCantieri === 'elenco')
) && (
  <CantieriElencoPanel
    cantieri={cantieri}
    ricercaCantiere={ricercaCantiere}
    setRicercaCantiere={setRicercaCantiere}
    setNomeCantiere={setNomeCantiere}
    preventivoCantiereInput={preventivoCantiereInput}
    setPreventivoCantiereInput={setPreventivoCantiereInput}
    aggiungiCantiere={aggiungiCantiere}
    mostraCantieriConclusi={mostraCantieriConclusi}
    setMostraCantieriConclusi={setMostraCantieriConclusi}
    ordinaCantieriCampo={ordinaCantieriCampo}
    ordinaCantieriDirezione={ordinaCantieriDirezione}
    cambiaOrdinamentoCantieri={cambiaOrdinamentoCantieri}
    setCantiereScheda={setCantiereScheda}
    setSottoSezioneCantieri={setSottoSezioneCantieri}
    eliminaCantiere={eliminaCantiere}
    formatMoney={formatMoney}
    cardStyle={cardStyle}
    excelTable={excelTable}
    excelTh={excelTh}
    excelTd={excelTd}
    buttonPrimary={buttonPrimary}
    buttonSecondary={buttonSecondary}
  />
)}

{(
  pagineAperte.includes('cantieri-scheda') ||
  (!modalitaMulti &&
    sezioneAttiva === 'cantieri' &&
    sottoSezioneCantieri === 'scheda')
) && (
<CantieriContainer
  pagineAperte={pagineAperte}
  modalitaMulti={modalitaMulti}
  sezioneAttiva={sezioneAttiva}
  sottoSezioneCantieri={sottoSezioneCantieri}
  cardStyle={cardStyle}
  cantieri={cantieri}
  cantiereScheda={cantiereScheda}
  setCantiereScheda={setCantiereScheda}
  ricercaCantiereEconomia={ricercaCantiereEconomia}
  setRicercaCantiereEconomia={setRicercaCantiereEconomia}
  mostraConclusiEconomia={mostraConclusiEconomia}
  setMostraConclusiEconomia={setMostraConclusiEconomia}
  calcoloEconomiaCantiere={calcoloEconomiaCantiere}
  formatMoney={formatMoney}
  inputStyle={inputStyle}
  buttonPrimary={buttonPrimary}
  buttonSecondary={buttonSecondary}
  caricaFotoDaInput={caricaFotoDaInput}
  cameraFotoCantiereAttiva={cameraFotoCantiereAttiva}
  setCameraFotoCantiereAttiva={setCameraFotoCantiereAttiva}
  cameraFotoCantiereFullscreen={cameraFotoCantiereFullscreen}
  setCameraFotoCantiereFullscreen={setCameraFotoCantiereFullscreen}
  webcamFotoCantiereRef={webcamFotoCantiereRef}
  scattaFotoCantiere={scattaFotoCantiere}
  rilevaPosizioneFoto={rilevaPosizioneFoto}
  fotoDaCaricare={fotoDaCaricare}
  setFotoDaCaricare={setFotoDaCaricare}
  categoriaFoto={categoriaFoto}
  setCategoriaFoto={setCategoriaFoto}
  categoriaFotoDaSalvare={categoriaFotoDaSalvare}
  setCategoriaFotoDaSalvare={setCategoriaFotoDaSalvare}
  popupCategoriaFotoCantiere={popupCategoriaFotoCantiere}
  setPopupCategoriaFotoCantiere={setPopupCategoriaFotoCantiere}
  esportaPdfFotoCantiere={esportaPdfFotoCantiere}
  notaFotoCantiere={notaFotoCantiere}
  setNotaFotoCantiere={setNotaFotoCantiere}
  note={note}
  setNote={setNote}
  avviaDettatura={avviaDettatura}
  fotoCantiere={fotoCantiere}
  setFotoCantiere={setFotoCantiere}
  filtroFotoCantiere={filtroFotoCantiere}
  setFiltroFotoCantiere={setFiltroFotoCantiere}
  fotoCantiereSelezionate={fotoCantiereSelezionate}
  setFotoCantiereSelezionate={setFotoCantiereSelezionate}
  categoriaFotoMultipla={categoriaFotoMultipla}
  setCategoriaFotoMultipla={setCategoriaFotoMultipla}
  aggiornaCategoriaFotoSelezionate={aggiornaCategoriaFotoSelezionate}
  setFotoFullscreen={setFotoFullscreen}
  supabase={supabase}
  fotoStorageBucket={FOTO_CANTIERE_BUCKET}
  caricaFotoCantiere={caricaFotoCantiere}
  eliminaFotoCantiere={eliminaFotoCantiere}
  geolocalizzazioneFoto={geolocalizzazioneFoto}
  salvaFotoCantiere={salvaFotoCantiere}
/>
)}
 <FotoFullscreenModal
  fotoFullscreen={fotoFullscreen}
  setFotoFullscreen={setFotoFullscreen}
/>
    
    

  

{/* ================= CANTIERI - ANALISI DOCUMENTO ================= */}
{(
  pagineAperte.includes('cantieri-analisi') ||
  (!modalitaMulti &&
    sezioneAttiva === 'cantieri' &&
    sottoSezioneCantieri === 'analisi')
) && (
 <CantieriAnalisiDocumentoPanel
  cardStyle={cardStyle}
  cantieri={cantieri}
  cantiereAnalisiDocumento={cantiereScheda || ''}
  setCantiereAnalisiDocumento={setCantiereScheda}
  inputStyle={inputStyle}
  buttonSecondary={buttonSecondary}
  buttonPrimary={buttonPrimary}
  caricaFileAnalisiDocumento={caricaFileAnalisiDocumento}
  fileAnalisiDocumento={fileAnalisiDocumento}
  nomeFileAnalisiDocumento={nomeFileAnalisiDocumento}
  testoEstrattoDocumento={testoEstrattoDocumento}
  importoRilevatoDocumento={importoRilevatoDocumento}
  vociAnalizzate={vociAnalizzate}
/>
)}

 {/* ================= CANTIERI - ECONOMIA CANTIERE ================= */}
{(
  pagineAperte.includes('cantieri-economia') ||
  (!modalitaMulti &&
    sezioneAttiva === 'cantieri' &&
    sottoSezioneCantieri === 'economia')
) && (
<CantieriEconomiaPanel
  cardStyle={cardStyle}
  cantiereScheda={cantiereScheda}
  preventivoCantiere={preventivoCantiere}
  totaleCostiCantiere={totaleCostiCantiere}
  totaleAccontiCantiere={totaleAccontiCantiere}
  residuoDaIncassare={residuoDaIncassare}
  utileCantiere={utileCantiere}
  totaleManodoperaCantiere={totaleManodoperaCantiere}
  totaleMaterialiEconomia={totaleMaterialiEconomia}
  totaleAttrezziEconomia={totaleAttrezziEconomia}
  setMostraDettaglioManodopera={setMostraDettaglioManodopera}
  setMostraDettaglioMateriali={setMostraDettaglioMateriali}
  setMostraDettaglioAttrezzi={setMostraDettaglioAttrezzi}
  cantieri={cantieri}
  setCantiereScheda={setCantiereScheda}
  ricercaCantiereEconomia={ricercaCantiereEconomia}
  setRicercaCantiereEconomia={setRicercaCantiereEconomia}
  mostraConclusiEconomia={mostraConclusiEconomia}
  setMostraConclusiEconomia={setMostraConclusiEconomia}
  dragAttivo={dragAttivo}
  setDragAttivo={setDragAttivo}
  caricaFilePreventivo={caricaFilePreventivo}
  handleUploadPreventivo={handleUploadPreventivo}
  inputStyle={inputStyle}
  buttonSecondary={buttonSecondary}
  supabase={supabase}
  caricaCantieri={caricaCantieri}
  mostraPreventiviCantiere={mostraPreventiviCantiere}
  setMostraPreventiviCantiere={setMostraPreventiviCantiere}
  preventivi={preventivi}
  setPreventivi={setPreventivi}
  formatMoney={formatMoney}
  parseImporto={parseImporto}
  caricaEconomia={caricaEconomia}
  salCantiere={salCantiere}
  setSalCantiere={setSalCantiere}
  salDescrizione={salDescrizione}
  setSalDescrizione={setSalDescrizione}
  salImportoPrevisto={salImportoPrevisto}
  setSalImportoPrevisto={setSalImportoPrevisto}
  salPercentuale={salPercentuale}
  setSalPercentuale={setSalPercentuale}
  salNote={salNote}
  setSalNote={setSalNote}
  salvaSalLavorazione={salvaSalLavorazione}
  buttonPrimary={buttonPrimary}
  caricaSalLavorazioni={caricaSalLavorazioni}
  caricaPreventivoLavorazioni={caricaPreventivoLavorazioni}
  prevDescrizione={prevDescrizione}
  setPrevDescrizione={setPrevDescrizione}
  prevQuantita={prevQuantita}
  setPrevQuantita={setPrevQuantita}
  prevPrezzoUnitario={prevPrezzoUnitario}
  setPrevPrezzoUnitario={setPrevPrezzoUnitario}
  prevUnita={prevUnita}
  setPrevUnita={setPrevUnita}
  prevImporto={prevImporto}
  setPrevImporto={setPrevImporto}
  salvaLavorazionePreventivo={salvaLavorazionePreventivo}
  preventivoLavorazioni={preventivoLavorazioni}
  analizzaRigheDocumento={analizzaRigheDocumento}
  mostraConfrontoPdfSal={mostraConfrontoPdfSal}
  setMostraConfrontoPdfSal={setMostraConfrontoPdfSal}
  lavorazioneEditId={lavorazioneEditId}
  setLavorazioneEditId={setLavorazioneEditId}
  lavorazioneEditDescrizione={lavorazioneEditDescrizione}
  setLavorazioneEditDescrizione={setLavorazioneEditDescrizione}
  lavorazioneEditImporto={lavorazioneEditImporto}
  setLavorazioneEditImporto={setLavorazioneEditImporto}
  salLavorazioni={salLavorazioni}
  accontiCantiere={accontiCantiere}
  excelTable={excelTable}
  excelTh={excelTh}
  excelTd={excelTd}
  eliminaSalLavorazione={eliminaSalLavorazione}
  economiaDataDa={economiaDataDa}
  setEconomiaDataDa={setEconomiaDataDa}
  economiaDataA={economiaDataA}
  setEconomiaDataA={setEconomiaDataA}
  mostraAcconti={mostraAcconti}
  setMostraAcconti={setMostraAcconti}
  descrizioneAcconto={descrizioneAcconto}
  setDescrizioneAcconto={setDescrizioneAcconto}
  importoAcconto={importoAcconto}
  setImportoAcconto={setImportoAcconto}
  dataAcconto={dataAcconto}
  setDataAcconto={setDataAcconto}
  metodoAcconto={metodoAcconto}
  setMetodoAcconto={setMetodoAcconto}
  notaAcconto={notaAcconto}
  setNotaAcconto={setNotaAcconto}
  salvaAcconto={salvaAcconto}
  modificaAcconto={modificaAcconto}
  eliminaAcconto={eliminaAcconto}
  mostraDettaglioManodopera={mostraDettaglioManodopera}
  timbrature={timbrature}
  ordineOperai={ordineOperai}
  setOrdineOperai={setOrdineOperai}
  direzioneOperai={direzioneOperai}
  setDirezioneOperai={setDirezioneOperai}
  calcolaOre={calcolaOre}
  calcolaOreNumero={calcolaOreNumero}
  calcolaCostoTimbratura={calcolaCostoTimbratura}
  mostraDettaglioMateriali={mostraDettaglioMateriali}
  materialiCantiere={materialiCantiere}
  cercaMaterialeManuale={cercaMaterialeManuale}
  setCercaMaterialeManuale={setCercaMaterialeManuale}
  materialeManualeDescrizione={materialeManualeDescrizione}
  setMaterialeManualeDescrizione={setMaterialeManualeDescrizione}
  materialeManualeQuantita={materialeManualeQuantita}
  setMaterialeManualeQuantita={setMaterialeManualeQuantita}
  materialeManualePrezzo={materialeManualePrezzo}
  setMaterialeManualePrezzo={setMaterialeManualePrezzo}
  materialeManualeFornitore={materialeManualeFornitore}
  setMaterialeManualeFornitore={setMaterialeManualeFornitore}
  materialeManualeNota={materialeManualeNota}
  setMaterialeManualeNota={setMaterialeManualeNota}
  salvaMaterialeManuale={salvaMaterialeManuale}
  eliminaMaterialeCantiere={eliminaMaterialeCantiere}
  ordinaMateriali={ordinaMateriali}
  ordineMaterialiCampo={ordineMaterialiCampo}
  ordineMaterialiDirezione={ordineMaterialiDirezione}
  margineCantiere={margineCantiere}
  mostraMaterialiCantiere={mostraMaterialiCantiere}
  setMostraMaterialiCantiere={setMostraMaterialiCantiere}
  eliminaFileDaStorage={eliminaFileDaStorage}
  mostraAttrezziCantiere={mostraAttrezziCantiere}
  setMostraAttrezziCantiere={setMostraAttrezziCantiere}
  attrezziCantiere={attrezziCantiere}
  eliminaAttrezzatura={eliminaAttrezzatura}
  caricaFileAnalisiDocumento={caricaFileAnalisiDocumento}
  fileAnalisiDocumento={fileAnalisiDocumento}
  nomeFileAnalisiDocumento={nomeFileAnalisiDocumento}
  testoEstrattoDocumento={testoEstrattoDocumento}
  importoRilevatoDocumento={importoRilevatoDocumento}
  vociAnalizzate={vociAnalizzate}
  caricaFotoDaInput={caricaFotoDaInput}
  cameraFotoCantiereAttiva={cameraFotoCantiereAttiva}
  setCameraFotoCantiereAttiva={setCameraFotoCantiereAttiva}
  cameraFotoCantiereFullscreen={cameraFotoCantiereFullscreen}
  setCameraFotoCantiereFullscreen={setCameraFotoCantiereFullscreen}
  webcamFotoCantiereRef={webcamFotoCantiereRef}
  scattaFotoCantiere={scattaFotoCantiere}
  rilevaPosizioneFoto={rilevaPosizioneFoto}
  fotoDaCaricare={fotoDaCaricare}
  setFotoDaCaricare={setFotoDaCaricare}
  categoriaFoto={categoriaFoto}
  setCategoriaFoto={setCategoriaFoto}
  categoriaFotoDaSalvare={categoriaFotoDaSalvare}
  setCategoriaFotoDaSalvare={setCategoriaFotoDaSalvare}
  popupCategoriaFotoCantiere={popupCategoriaFotoCantiere}
  setPopupCategoriaFotoCantiere={setPopupCategoriaFotoCantiere}
  esportaPdfFotoCantiere={esportaPdfFotoCantiere}
  notaFotoCantiere={notaFotoCantiere}
  setNotaFotoCantiere={setNotaFotoCantiere}
  note={note}
  setNote={setNote}
  avviaDettatura={avviaDettatura}
  fotoCantiere={fotoCantiere}
  setFotoCantiere={setFotoCantiere}
  filtroFotoCantiere={filtroFotoCantiere}
  setFiltroFotoCantiere={setFiltroFotoCantiere}
  fotoCantiereSelezionate={fotoCantiereSelezionate}
  setFotoCantiereSelezionate={setFotoCantiereSelezionate}
  categoriaFotoMultipla={categoriaFotoMultipla}
  setCategoriaFotoMultipla={setCategoriaFotoMultipla}
  aggiornaCategoriaFotoSelezionate={aggiornaCategoriaFotoSelezionate}
  setFotoFullscreen={setFotoFullscreen}
  fotoStorageBucket={FOTO_CANTIERE_BUCKET}
  caricaFotoCantiere={caricaFotoCantiere}
  eliminaFotoCantiere={eliminaFotoCantiere}
  geolocalizzazioneFoto={geolocalizzazioneFoto}
  salvaFotoCantiere={salvaFotoCantiere}
  setRegistroTab={setRegistroTab}
  setSezioneAttiva={setSezioneAttiva}
/>
)}

<FotoFullscreenModal
  fotoFullscreen={fotoFullscreen}
  setFotoFullscreen={setFotoFullscreen}
/>


<OperaiContainer
  pagineAperte={pagineAperte}
  modalitaMulti={modalitaMulti}
  sezioneAttiva={sezioneAttiva}
  sottoSezioneOperai={sottoSezioneOperai}
  cardStyle={cardStyle}
  operaioInModifica={operaioInModifica}
  annullaModificaOperaio={annullaModificaOperaio}
  salvaModificaOperaio={salvaModificaOperaio}
  nomeOperaioModifica={nomeOperaioModifica}
  setNomeOperaioModifica={setNomeOperaioModifica}
  telefonoOperaioModifica={telefonoOperaioModifica}
  setTelefonoOperaioModifica={setTelefonoOperaioModifica}
  qualificaOperaioModifica={qualificaOperaioModifica}
  setQualificaOperaioModifica={setQualificaOperaioModifica}
  pinOperaioModifica={pinOperaioModifica}
  setPinOperaioModifica={setPinOperaioModifica}
  costoOrarioOperaioModifica={costoOrarioOperaioModifica}
  setCostoOrarioOperaioModifica={setCostoOrarioOperaioModifica}
  statoOperaioModifica={statoOperaioModifica}
  setStatoOperaioModifica={setStatoOperaioModifica}
  notaOperaioModifica={notaOperaioModifica}
  setNotaOperaioModifica={setNotaOperaioModifica}
  nomeOperaio={nomeOperaio}
  setNomeOperaio={setNomeOperaio}
  telefonoOperaio={telefonoOperaio}
  setTelefonoOperaio={setTelefonoOperaio}
  qualificaOperaio={qualificaOperaio}
  setQualificaOperaio={setQualificaOperaio}
  pinOperaio={pinOperaio}
  setPinOperaio={setPinOperaio}
  costoOrarioOperaio={costoOrarioOperaio}
  setCostoOrarioOperaio={setCostoOrarioOperaio}
  aggiungiOperaio={aggiungiOperaio}
  operaiFiltrati={operaiFiltrati}
  badgeStyle={badgeStyle}
  formatMoney={formatMoney}
  preparaModificaOperaio={preparaModificaOperaio}
  cambiaStatoOperaio={cambiaStatoOperaio}
  eliminaOperaio={eliminaOperaio}
  buttonPrimary={buttonPrimary}
  buttonSecondary={buttonSecondary}
  timbraturaInModifica={timbraturaInModifica}
  dataTimbraturaModifica={dataTimbraturaModifica}
  setDataTimbraturaModifica={setDataTimbraturaModifica}
  oraEntrataModifica={oraEntrataModifica}
  setOraEntrataModifica={setOraEntrataModifica}
  oraUscitaModifica={oraUscitaModifica}
  setOraUscitaModifica={setOraUscitaModifica}
  setTimbraturaInModifica={setTimbraturaInModifica}
  setStatoTimbraturaModifica={setStatoTimbraturaModifica}
  parseOra={parseOra}
  salvaModificaTimbratura={salvaModificaTimbratura}
  operaioTimbratura={operaioTimbratura}
  setOperaioTimbratura={setOperaioTimbratura}
  cantiereTimbratura={cantiereTimbratura}
  setCantiereTimbratura={setCantiereTimbratura}
  pinTimbratura={pinTimbratura}
  setPinTimbratura={setPinTimbratura}
  operaiAttivi={operaiAttivi}
  cantieri={cantieri}
  timbratureOggi={timbratureOggi}
  timbraEntrataConPin={timbraEntrataConPin}
  timbraUscitaConPin={timbraUscitaConPin}
  eliminaTimbratura={eliminaTimbratura}
  calcolaCostoTimbratura={calcolaCostoTimbratura}
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
  aggiungiPresenzaManuale={aggiungiPresenzaManuale}
  dataDa={dataDa}
  setDataDa={setDataDa}
  dataA={dataA}
  setDataA={setDataA}
  cantiereGrafico={cantiereGrafico}
  setCantiereGrafico={setCantiereGrafico}
  inputStyle={inputStyle}
  timbrature={timbrature}
  totaleCostoPeriodo={totaleCostoPeriodo}
  totaleOrePeriodo={totaleOrePeriodo}
  calcolaOre={calcolaOre}
  costoPerCantiereOggi={costoPerCantiereOggi}
  erroreTimbratura={erroreTimbratura}
/>

{/* ================= RAPPORTINI ================= */}
{(
  pagineAperte.includes('rapportini') ||
  (!modalitaMulti && sezioneAttiva === 'rapportini')
) && (
  <RapportiniPanel
    cardStyle={cardStyle}
    rapportiniFiltrati={rapportiniFiltrati}
    fotoCantiere={fotoCantiere}
    setFotoRapportinoAperte={setFotoRapportinoAperte}
    preparaModificaRapportino={preparaModificaRapportino}
    eliminaRapportino={eliminaRapportino}
    generaPdfRapportinoFotografico={generaPdfRapportinoFotografico}
    cantiereRapporto={cantiereRapporto}
    setCantiereRapporto={setCantiereRapporto}
    data={data}
    setData={setData}
    note={note}
    setNote={setNote}
    materiali={materiali}
    setMateriali={setMateriali}
    quantitaMateriali={quantitaMateriali}
    setQuantitaMateriali={setQuantitaMateriali}
    costoMateriali={costoMateriali}
    setCostoMateriali={setCostoMateriali}
    salvaRapportino={salvaRapportino}
    aggiornaRapportino={aggiornaRapportino}
    rapportinoInModifica={rapportinoInModifica}
    cantieri={cantieri}
    inputStyle={inputStyle}
    buttonPrimary={buttonPrimary}
    buttonSecondary={buttonSecondary}
    ascoltoRapportino={ascoltoRapportino}
    avviaDettaturaRapportino={avviaDettaturaRapportino}
    fermaDettaturaRapportino={fermaDettaturaRapportino}
    operaiAnagrafica={operaiAnagrafica}
    operaiRapportinoTemp={operaiRapportinoTemp}
    setOperaiRapportinoTemp={setOperaiRapportinoTemp}
    setPopupFotoRapportino={setPopupFotoRapportino}
  />
)}

{/* ================= SOPRALLUOGHI ================= */}
{sezioneAttiva === 'sopralluoghi' && (
  <SopralluoghiContainer
    cardStyle={cardStyle}
    clienteSopralluogo={clienteSopralluogo}
    setClienteSopralluogo={setClienteSopralluogo}
    telefonoSopralluogo={telefonoSopralluogo}
    setTelefonoSopralluogo={setTelefonoSopralluogo}
    indirizzoSopralluogo={indirizzoSopralluogo}
    setIndirizzoSopralluogo={setIndirizzoSopralluogo}
    geolocalizzazioneSopralluogo={geolocalizzazioneSopralluogo}
    setGeolocalizzazioneSopralluogo={setGeolocalizzazioneSopralluogo}
    rilevaGeolocalizzazioneSopralluogo={rilevaGeolocalizzazioneSopralluogo}
    dataSopralluogo={dataSopralluogo}
    setDataSopralluogo={setDataSopralluogo}
    oraSopralluogo={oraSopralluogo}
    setOraSopralluogo={setOraSopralluogo}
    promemoriaSopralluogo={promemoriaSopralluogo}
    setPromemoriaSopralluogo={setPromemoriaSopralluogo}
    tipoLavoroSopralluogo={tipoLavoroSopralluogo}
    setTipoLavoroSopralluogo={setTipoLavoroSopralluogo}
    noteSopralluogo={noteSopralluogo}
    setNoteSopralluogo={setNoteSopralluogo}
    salvaSopralluogo={salvaSopralluogo}
    inputStyle={inputStyle}
    buttonPrimary={buttonPrimary}
    buttonSecondary={buttonSecondary}
    sopralluoghi={sopralluoghi}
    mostraElencoSopralluoghi={mostraElencoSopralluoghi}
    setMostraElencoSopralluoghi={setMostraElencoSopralluoghi}
    setUltimoSopralluogo={setUltimoSopralluogo}
    setSopralluogoAperto={setSopralluogoAperto}
    setFirmaCliente={setFirmaCliente}
    setMostraGestioneFotoSopralluogo={setMostraGestioneFotoSopralluogo}
    setMostraFotoPreventivoSopralluogo={setMostraFotoPreventivoSopralluogo}
    setFotoSopralluoghi={setFotoSopralluoghi}
    eliminaSopralluogo={eliminaSopralluogo}
    supabase={supabase}
    sopralluogoAperto={sopralluogoAperto}
    setSopralluogoModificaId={setSopralluogoModificaId}
    coloreStatoSopralluogo={coloreStatoSopralluogo}
    firmaRef={firmaRef}
    mostraFirmaCliente={mostraFirmaCliente}
    setMostraFirmaCliente={setMostraFirmaCliente}
    altezzaFirma={altezzaFirma}
    setAltezzaFirma={setAltezzaFirma}
    coloreFirma={coloreFirma}
    spessoreFirma={spessoreFirma}
    mostraAppuntiSopralluogo={mostraAppuntiSopralluogo}
    setMostraAppuntiSopralluogo={setMostraAppuntiSopralluogo}
    pagineAppunti={pagineAppunti}
    setPagineAppunti={setPagineAppunti}
    paginaFullscreen={paginaFullscreen}
    setPaginaFullscreen={setPaginaFullscreen}
    appuntiRefs={appuntiRefs}
    mostraTavolozzaFirma={mostraTavolozzaFirma}
    setMostraTavolozzaFirma={setMostraTavolozzaFirma}
    setColoreFirma={setColoreFirma}
    setSpessoreFirma={setSpessoreFirma}
    mostraGestioneFotoSopralluogo={mostraGestioneFotoSopralluogo}
    mostraFotoPreventivoSopralluogo={mostraFotoPreventivoSopralluogo}
    setPopupFotoSopralluogo={setPopupFotoSopralluogo}
    fotoSopralluoghi={fotoSopralluoghi}
    fotoSopralluogoSelezionate={fotoSopralluogoSelezionate}
    setFotoSopralluogoSelezionate={setFotoSopralluogoSelezionate}
    setFotoFullscreen={setFotoFullscreen}
    caricaFotoSopralluoghi={caricaFotoSopralluoghi}
    preventivoAiGenerato={preventivoAiGenerato}
    generaPreventivoAiDaSopralluogo={generaPreventivoAiDaSopralluogo}
    generaPreventivoDaSopralluogo={generaPreventivoDaSopralluogo}
    apriPreventivoAiGeneratoInModifica={apriPreventivoAiGeneratoInModifica}
    convertiSopralluogoInCantiere={convertiSopralluogoInCantiere}
    generaPdfSopralluogo={generaPdfSopralluogo}
    popupFotoSopralluogo={popupFotoSopralluogo}
    cameraSopralluogoAttiva={cameraSopralluogoAttiva}
    setCameraSopralluogoAttiva={setCameraSopralluogoAttiva}
    cameraSopralluogoFullscreen={cameraSopralluogoFullscreen}
    setCameraSopralluogoFullscreen={setCameraSopralluogoFullscreen}
    webcamSopralluogoRef={webcamSopralluogoRef}
    scattaFotoSopralluogo={scattaFotoSopralluogo}
    fotoSopralluogoTemp={fotoSopralluogoTemp}
    setFotoSopralluogoTemp={setFotoSopralluogoTemp}
    notaFotoSopralluogo={notaFotoSopralluogo}
    setNotaFotoSopralluogo={setNotaFotoSopralluogo}
    salvaFotoSopralluogo={salvaFotoSopralluogo}
  />
)}

<PagamentiContainer
  pagineAperte={pagineAperte}
  modalitaMulti={modalitaMulti}
  sezioneAttiva={sezioneAttiva}
  sottoSezionePagamenti={sottoSezionePagamenti}

  cardStyle={cardStyle}

  buttonPrimary={buttonPrimary}
  buttonSecondary={buttonSecondary}

  excelTable={excelTable}
  excelTh={excelTh}
  excelTd={excelTd}

  formatMoney={formatMoney}
  calcolaOreNumero={calcolaOreNumero}
  totaleOreOperaio={totaleOreOperaio}
  calcolaCostoTimbratura={calcolaCostoTimbratura}
  parseOra={parseOra}

  totaleMaturatoOperai={totaleMaturatoOperai}
  totalePagatoOperai={totalePagatoOperai}
  residuoPagamentiOperai={residuoPagamentiOperai}
  scadenzaPagamentiOperai={scadenzaPagamentiOperai}
  statoScadenzaPagamenti={statoScadenzaPagamenti}
  giorniAllaScadenzaPagamenti={giorniAllaScadenzaPagamenti}

  costoOperaiPerCantiere={costoOperaiPerCantiere}
  situazioneCantieri={situazioneCantieri}
  cantieri={cantieri}
  timbrature={timbrature}
  operaiAnagrafica={operaiAnagrafica}
  pagamentiOperai={pagamentiOperai}

  mostraValutazioneFondi={mostraValutazioneFondi}
  setMostraValutazioneFondi={setMostraValutazioneFondi}
  mostraCostiPresenze={mostraCostiPresenze}
  setMostraCostiPresenze={setMostraCostiPresenze}
  mostraRiepilogoOperai={mostraRiepilogoOperai}
  setMostraRiepilogoOperai={setMostraRiepilogoOperai}

  pagamentiDataDa={pagamentiDataDa}
  setPagamentiDataDa={setPagamentiDataDa}
  pagamentiDataA={pagamentiDataA}
  setPagamentiDataA={setPagamentiDataA}

  operaioPagamento={operaioPagamento}
  setOperaioPagamento={setOperaioPagamento}
  importoPagamento={importoPagamento}
  setImportoPagamento={setImportoPagamento}
  dataPagamento={dataPagamento}
  setDataPagamento={setDataPagamento}
  metodoPagamento={metodoPagamento}
  setMetodoPagamento={setMetodoPagamento}
  notaPagamento={notaPagamento}
  setNotaPagamento={setNotaPagamento}

  salvaPagamentoOperaio={salvaPagamentoOperaio}
  preparaPagamentoRapidoOperaio={preparaPagamentoRapidoOperaio}
/>

{/* ================= ECONOMIA GENERALE ================= */}
{(
  pagineAperte.includes('economia') ||
  (!modalitaMulti && sezioneAttiva === 'economia')
) && (
  <EconomiaGeneralePanel
    cardStyle={cardStyle}
    fattureEmesse={fattureEmesse}
    fattureFornitori={fattureFornitori}
    totalePreventiviImpresa={totalePreventiviImpresa}
    accontiCantiere={accontiCantiere}
    cantieri={cantieri}
    speseImpresa={speseImpresa}
    calcoloEconomiaCantiere={calcoloEconomiaCantiere}
    formatMoney={formatMoney}
    filtroSpeseImpresa={filtroSpeseImpresa}
    setFiltroSpeseImpresa={setFiltroSpeseImpresa}
    tabellaSpeseImpresaAperta={tabellaSpeseImpresaAperta}
    setTabellaSpeseImpresaAperta={setTabellaSpeseImpresaAperta}
    ordineSpeseCampo={ordineSpeseCampo}
    ordineSpeseDirezione={ordineSpeseDirezione}
    ordinaSpeseImpresa={ordinaSpeseImpresa}
    inputStyle={inputStyle}
    buttonSecondary={buttonSecondary}
    excelTable={excelTable}
    excelTh={excelTh}
    excelTd={excelTd}
  />
)}
{/* ================= REGISTRO ================= */}
{sezioneAttiva === 'registro' && (
  <RegistroPanel
  sezioneAttiva={sezioneAttiva}
  registroTab={registroTab}
  setRegistroTab={setRegistroTab}
  registroCerca={registroCerca}
  setRegistroCerca={setRegistroCerca}
  registroFiltroDataDa={registroFiltroDataDa}
  setRegistroFiltroDataDa={setRegistroFiltroDataDa}
  registroFiltroDataA={registroFiltroDataA}
  setRegistroFiltroDataA={setRegistroFiltroDataA}
  setRegistroFiltroNome={setRegistroFiltroNome}

  cantieri={cantieri}
  preventivi={preventivi}
  rapportini={rapportini}
  timbratureFiltrateRegistro={timbratureFiltrateRegistro}
  pagamentiOperai={pagamentiOperai}

  fattureFornitori={fattureFornitori}
  fattureOrdinate={fattureOrdinate}
  righeFatturaDaAssegnare={righeFatturaDaAssegnare}
  righeFatturaAperta={righeFatturaAperta}
 

  mostraRevisionePreventivoAi={mostraRevisionePreventivoAi}
  mostraRegistroPreventiviCaricati={mostraRegistroPreventiviCaricati}
  setMostraRegistroPreventiviCaricati={setMostraRegistroPreventiviCaricati}

  cantiereRegistroEdit={cantiereRegistroEdit}
  cantiereRegistroNome={cantiereRegistroNome}
  setCantiereRegistroNome={setCantiereRegistroNome}
  cantiereRegistroPreventivo={cantiereRegistroPreventivo}
  setCantiereRegistroPreventivo={setCantiereRegistroPreventivo}
  cantiereRegistroInizio={cantiereRegistroInizio}
  setCantiereRegistroInizio={setCantiereRegistroInizio}
  cantiereRegistroFine={cantiereRegistroFine}
  setCantiereRegistroFine={setCantiereRegistroFine}
  cantiereRegistroConcluso={cantiereRegistroConcluso}
  setCantiereRegistroConcluso={setCantiereRegistroConcluso}

  preventivoRegistroEdit={preventivoRegistroEdit}
  setPreventivoRegistroEdit={setPreventivoRegistroEdit}
  preventivoRegistroCantiere={preventivoRegistroCantiere}
  setPreventivoRegistroCantiere={setPreventivoRegistroCantiere}
  preventivoRegistroNomeFile={preventivoRegistroNomeFile}
  setPreventivoRegistroNomeFile={setPreventivoRegistroNomeFile}
  preventivoRegistroImporto={preventivoRegistroImporto}
  setPreventivoRegistroImporto={setPreventivoRegistroImporto}
  preventivoRegistroNote={preventivoRegistroNote}
  setPreventivoRegistroNote={setPreventivoRegistroNote}

  rapportinoRegistroEdit={rapportinoRegistroEdit}
  rapportinoRegistroData={rapportinoRegistroData}
  setRapportinoRegistroData={setRapportinoRegistroData}
  rapportinoRegistroCantiere={rapportinoRegistroCantiere}
  setRapportinoRegistroCantiere={setRapportinoRegistroCantiere}
  rapportinoRegistroOperaio={rapportinoRegistroOperaio}
  setRapportinoRegistroOperaio={setRapportinoRegistroOperaio}
  rapportinoRegistroOre={rapportinoRegistroOre}
  setRapportinoRegistroOre={setRapportinoRegistroOre}
  rapportinoRegistroDescrizione={rapportinoRegistroDescrizione}
  setRapportinoRegistroDescrizione={setRapportinoRegistroDescrizione}

  timbraturaRegistroEdit={timbraturaRegistroEdit}
  timbraturaRegistroData={timbraturaRegistroData}
  setTimbraturaRegistroData={setTimbraturaRegistroData}
  timbraturaRegistroOperaio={timbraturaRegistroOperaio}
  setTimbraturaRegistroOperaio={setTimbraturaRegistroOperaio}
  timbraturaRegistroCantiere={timbraturaRegistroCantiere}
  setTimbraturaRegistroCantiere={setTimbraturaRegistroCantiere}
  timbraturaRegistroEntrata={timbraturaRegistroEntrata}
  setTimbraturaRegistroEntrata={setTimbraturaRegistroEntrata}
  timbraturaRegistroUscita={timbraturaRegistroUscita}
  setTimbraturaRegistroUscita={setTimbraturaRegistroUscita}

  pagamentoOperaioRegistroEdit={pagamentoOperaioRegistroEdit}
  pagamentoOperaioRegistroNome={pagamentoOperaioRegistroNome}
  setPagamentoOperaioRegistroNome={setPagamentoOperaioRegistroNome}
  pagamentoOperaioRegistroImporto={pagamentoOperaioRegistroImporto}
  setPagamentoOperaioRegistroImporto={setPagamentoOperaioRegistroImporto}
  pagamentoOperaioRegistroData={pagamentoOperaioRegistroData}
  setPagamentoOperaioRegistroData={setPagamentoOperaioRegistroData}
  pagamentoOperaioRegistroMetodo={pagamentoOperaioRegistroMetodo}
  setPagamentoOperaioRegistroMetodo={setPagamentoOperaioRegistroMetodo}
  pagamentoOperaioRegistroNota={pagamentoOperaioRegistroNota}
  setPagamentoOperaioRegistroNota={setPagamentoOperaioRegistroNota}

  ordinaRegistro={ordinaRegistro}
  ordinaCantieriCampo={ordinaCantieriCampo}
  ordinaCantieriDirezione={ordinaCantieriDirezione}
  setOrdinaCantieriCampo={setOrdinaCantieriCampo}
  setOrdinaCantieriDirezione={setOrdinaCantieriDirezione}
  ordinaPreventiviCampo={ordinaPreventiviCampo}
  ordinaPreventiviDirezione={ordinaPreventiviDirezione}
  setOrdinaPreventiviCampo={setOrdinaPreventiviCampo}
  setOrdinaPreventiviDirezione={setOrdinaPreventiviDirezione}
  ordinaRapportiniCampo={ordinaRapportiniCampo}
  ordinaRapportiniDirezione={ordinaRapportiniDirezione}
  setOrdinaRapportiniCampo={setOrdinaRapportiniCampo}
  setOrdinaRapportiniDirezione={setOrdinaRapportiniDirezione}
  ordinaTimbratureCampo={ordinaTimbratureCampo}
  ordinaTimbratureDirezione={ordinaTimbratureDirezione}
  setOrdinaTimbratureCampo={setOrdinaTimbratureCampo}
  setOrdinaTimbratureDirezione={setOrdinaTimbratureDirezione}
  ordinaPagamentiCampo={ordinaPagamentiCampo}
  ordinaPagamentiDirezione={ordinaPagamentiDirezione}
  setOrdinaPagamentiCampo={setOrdinaPagamentiCampo}
  setOrdinaPagamentiDirezione={setOrdinaPagamentiDirezione}

  operaiAnagrafica={operaiAnagrafica}
  calcolaOre={calcolaOre}
  calcolaCostoTimbratura={calcolaCostoTimbratura}
  calcolaOreTimbratura={calcolaOreTimbratura}
  parseImporto={parseImporto}
  formatMoney={formatMoney}

  salvaModificaRegistroCantiere={salvaModificaRegistroCantiere}
  annullaModificaRegistroCantiere={annullaModificaRegistroCantiere}
  preparaModificaRegistroCantiere={preparaModificaRegistroCantiere}
  eliminaCantiere={eliminaCantiere}

  generaExcelDaPreventivoAi={generaExcelDaPreventivoAi}
  approvaPreventivoAiECreaCantiere={approvaPreventivoAiECreaCantiere}
  salvaModificaRegistroPreventivo={salvaModificaRegistroPreventivo}
  eliminaPreventivoCantiere={eliminaPreventivoCantiere}

  salvaModificaRegistroRapportino={salvaModificaRegistroRapportino}
  annullaModificaRegistroRapportino={annullaModificaRegistroRapportino}
  preparaModificaRegistroRapportino={preparaModificaRegistroRapportino}
  eliminaRapportino={eliminaRapportino}

  salvaModificaRegistroTimbratura={salvaModificaRegistroTimbratura}
  annullaModificaRegistroTimbratura={annullaModificaRegistroTimbratura}
  preparaModificaRegistroTimbratura={preparaModificaRegistroTimbratura}
  eliminaTimbratura={eliminaTimbratura}

  salvaModificaRegistroPagamentoOperaio={salvaModificaRegistroPagamentoOperaio}
  annullaModificaRegistroPagamentoOperaio={annullaModificaRegistroPagamentoOperaio}
  preparaModificaRegistroPagamentoOperaio={preparaModificaRegistroPagamentoOperaio}
  eliminaPagamentoOperaio={eliminaPagamentoOperaio}

  messaggioAi={messaggioAi}
  descrizionePreventivoAi={descrizionePreventivoAi}
  setDescrizionePreventivoAi={setDescrizionePreventivoAi}
  vociPreventivoAi={vociPreventivoAi}
  setVociPreventivoAi={setVociPreventivoAi}
  vociPreventivoAiOriginali={vociPreventivoAiOriginali}
  setVociPreventivoAiOriginali={setVociPreventivoAiOriginali}
  preventivoAiGenerato={preventivoAiGenerato}
  setPreventivoAiGenerato={setPreventivoAiGenerato}
  calcolaMediaPrezziSimili={calcolaMediaPrezziSimili}
  verificaPrezzoAnomalo={verificaPrezzoAnomalo}
  miglioraVocePreventivoAi={miglioraVocePreventivoAi}
  salvaInMemoriaPrezzi={salvaInMemoriaPrezzi}
  generaExcelDefinitivoPreventivoAi={generaExcelDefinitivoPreventivoAi}
  setMostraRevisionePreventivoAi={setMostraRevisionePreventivoAi}

  fatturaNomeFile={fatturaNomeFile}
  fatturaFornitore={fatturaFornitore}
  fatturaPartitaIva={fatturaPartitaIva}
  fatturaNumero={fatturaNumero}
  fatturaData={fatturaData}
  cantiereMassivoFattura={cantiereMassivoFattura}
  categoriaMassivaFattura={categoriaMassivaFattura}
  filtroFattureFornitore={filtroFattureFornitore}
  filtroFattureStato={filtroFattureStato}
  fatturaApertaId={fatturaApertaId}
  nascondiCantieriConclusiFatture={nascondiCantieriConclusiFatture}
  larghezzaDescrizioneFattura={larghezzaDescrizioneFattura}

  setFatturaFornitore={setFatturaFornitore}
  setFatturaPartitaIva={setFatturaPartitaIva}
  setFatturaNumero={setFatturaNumero}
  setFatturaData={setFatturaData}
  setFatturaTotale={setFatturaTotale}
  setFatturaNomeFile={setFatturaNomeFile}
  setFatturaTipoFile={setFatturaTipoFile}
  setFatturaTestoOriginale={setFatturaTestoOriginale}
  setRigheFatturaDaAssegnare={setRigheFatturaDaAssegnare}
  setRigheFatturaAperta={setRigheFatturaAperta}
  setCantiereMassivoFattura={setCantiereMassivoFattura}
  setCategoriaMassivaFattura={setCategoriaMassivaFattura}
  setFatturaApertaId={setFatturaApertaId}
  setNascondiCantieriConclusiFatture={setNascondiCantieriConclusiFatture}
  setLarghezzaDescrizioneFattura={setLarghezzaDescrizioneFattura}

  caricaFatturaXml={caricaFatturaXml}
  caricaFatturaPdf={caricaFatturaPdf}
  caricaFattureFornitori={caricaFattureFornitori}
  importaFatturaSilenziosa={importaFatturaSilenziosa}
  numeroXml={numeroXml}
  salvaFatturaFornitore={salvaFatturaFornitore}
  ordinaFatture={ordinaFatture}
  apriFatturaFornitore={apriFatturaFornitore}
  eliminaFatturaFornitore={eliminaFatturaFornitore}
  salvaModificheFatturaAperta={salvaModificheFatturaAperta}

  fattureEmesseOrdinate={fattureEmesseOrdinate}
  filtroFattureEmesse={filtroFattureEmesse}
  setFiltroFattureEmesse={setFiltroFattureEmesse}
  setNuovaFatturaEmessa={setNuovaFatturaEmessa}
  setPopupNuovaFatturaEmessa={setPopupNuovaFatturaEmessa}
  setFatturaEmessaAperta={setFatturaEmessaAperta}
  caricaFatturaEmessaPdf={caricaFatturaEmessaPdf}
  caricaFatturaEmessaXml={caricaFatturaEmessaXml}
  caricaFattureEmesse={caricaFattureEmesse}
  ordinaFattureEmesse={ordinaFattureEmesse}

  popupNuovaFatturaEmessa={popupNuovaFatturaEmessa}
  nuovaFatturaEmessa={nuovaFatturaEmessa}
  salvaNuovaFatturaEmessa={salvaNuovaFatturaEmessa}
  fatturaEmessaAperta={fatturaEmessaAperta}
  aggiornaFatturaEmessa={aggiornaFatturaEmessa}
  eliminaFatturaEmessa={eliminaFatturaEmessa}

  cardStyle={cardStyle}
  inputStyle={inputStyle}
  excelBox={excelBox}
  excelToolbar={excelToolbar}
  excelTable={excelTable}
  excelTh={excelTh}
  excelTd={excelTd}
  excelInput={excelInput}
  buttonPrimary={buttonPrimary}
  buttonSecondary={buttonSecondary}
/>
)}

{/* ================= AGENDA / TIME ENGINE ================= */}
{!modalitaMulti && sezioneAttiva === 'agenda' && (
  <AgendaContainer
    sopralluoghi={sopralluoghi}
    cantieri={cantieri}
    preventivi={preventivi}
    cardStyle={cardStyle}
    buttonPrimary={buttonPrimary}
    buttonSecondary={buttonSecondary}
  />
)}

{/* ================= ATTIVITÀ ================= */}
{(
  pagineAperte.includes('attivita') ||
  (!modalitaMulti && sezioneAttiva === 'attivita')
) && <AttivitaPanel cardStyle={cardStyle} />}
 </main>
    </div>
  )
}
