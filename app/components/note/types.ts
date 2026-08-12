import type { BackgroundTransform }
  from '../../engines/quaderno-layout'
import type { QuadernoLayer } from "@/app/engines/quaderno-layers/types"
import type { QuadernoLayerId } from '@/app/engines/quaderno-layers/types'
import type {
  CadDimensionEntity,
  CadEntity,
} from '@/app/engines/cad/entities'

import type { CadScaleCalibration } from '@/app/engines/cad/scale-manager'

export type StrumentoDisegno =
  | 'penna'
  | 'evidenziatore'
  | 'freccia'
  | 'linea'
  | 'perpendicolare'
  | 'rettangolo'
  | 'cerchio'
  | 'testo'
  | 'gomma'
  | 'pin'


export type PuntoNota = {
  x: number
  y: number
}

export type MetadatiSegnoNota = {
  numero?: number

  titolo?: string

  testo?: string
  descrizione?: string

  fontSize?: number
  fontFamily?: string
  fontWeight?: 'normal' | 'bold'
 fontStyle?: 'normal' | 'italic'
textDecoration?: 'none' | 'underline'
rotation?: number

textBoxWidth?: number
textBoxHeight?: number

  stato?: 'nuovo' | 'in_lavorazione' | 'risolto'

  categoria?:
    | 'rilievo'
    | 'difetto'
    | 'impianto'
    | 'misura'
    | 'promemoria'
}
export type SegnoNota = {
  id: string
  strumento: StrumentoDisegno
  colore: string
  spessore: number
  punti: PuntoNota[]
  metadati?: MetadatiSegnoNota
  layerId?: QuadernoLayerId
}


export type OggettoGraficoQuaderno = {
  id: string
  tipo: 'immagine'
  sorgente: string
  transform: BackgroundTransform
  larghezzaIniziale?: number
  altezzaIniziale?: number
  layerId?: QuadernoLayerId
}

export type PaginaQuadernoNota = {
  id: string
  titolo: string

  disegni: SegnoNota[]
  cadDimensions?: CadDimensionEntity[]
cadEntities?: CadEntity[]
  scaleCalibration?: CadScaleCalibration | null

  sfondoDisegno: string | null

  zoomSfondo?: number

  oggettiGrafici?: OggettoGraficoQuaderno[]

  layers?: QuadernoLayer[]
  backgroundTransform?: BackgroundTransform
}
export type VoceChecklistNota = {
  id: string
  testo: string
  completata: boolean
}

export type AllegatoNota = {
  id: string
  nome_file: string
  tipo: 'foto' | 'allegato' | 'audio'
  mime_type?: string | null
  storage_path: string
  url: string
  created_at?: string
}

export type AnalisiNota = {
  sintesi: string
  ipotesi: string[]
  verifiche: string[]
  domande: string[]
  avvertenza: string
}
export type PinNota = {
  id: string
  numero: number
  x: number
  y: number
}

