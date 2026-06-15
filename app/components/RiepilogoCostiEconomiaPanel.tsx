import type { CSSProperties } from 'react'

import DettaglioManodoperaPanel from './DettaglioManodoperaPanel'
import MaterialiEconomiaPanel from './MaterialiEconomiaPanel'
import RiepilogoUtilePanel from './RiepilogoUtilePanel'
import MaterialiCaricatiPanel from './MaterialiCaricatiPanel'
import AttrezzatureCaricatePanel from './AttrezzatureCaricatePanel'

type Props = {
  mostraDettaglioManodopera: boolean
  setMostraDettaglioManodopera: (v: boolean) => void
  timbrature: any[]
  cantiereScheda: string
  totaleManodoperaCantiere: number
  economiaDataDa: string
  economiaDataA: string
ordineOperai: 'data' | 'operaio' | 'entrata' | 'uscita' | 'ore' | 'costo'
setOrdineOperai: (v: 'data' | 'operaio' | 'entrata' | 'uscita' | 'ore' | 'costo') => void
direzioneOperai: 'asc' | 'desc'
setDirezioneOperai: (v: 'asc' | 'desc') => void
excelTable: CSSProperties
excelTh: CSSProperties
excelTd: CSSProperties
  buttonSecondary: CSSProperties
  formatMoney: (n: number) => string
  calcolaOre: (t: any) => number
  calcolaOreNumero: (entrata?: string, uscita?: string) => number
  calcolaCostoTimbratura: (t: any) => number

  mostraDettaglioMateriali: boolean
  setMostraDettaglioMateriali: (v: boolean) => void
  totaleMaterialiEconomia: number
  materialiCantiere: any[]
  cercaMaterialeManuale: string
  setCercaMaterialeManuale: (v: string) => void
  materialeManualeDescrizione: string
  setMaterialeManualeDescrizione: (v: string) => void
  materialeManualeQuantita: string
  setMaterialeManualeQuantita: (v: string) => void
  materialeManualePrezzo: string
  setMaterialeManualePrezzo: (v: string) => void
  materialeManualeFornitore: string
  setMaterialeManualeFornitore: (v: string) => void
  materialeManualeNota: string
  setMaterialeManualeNota: (v: string) => void
  salvaMaterialeManuale: () => void | Promise<void>
  eliminaMaterialeCantiere: (m: any) => void | Promise<void>
  ordinaMateriali: (campo: string) => void
  ordineMaterialiCampo: string
  ordineMaterialiDirezione: 'asc' | 'desc'
  inputStyle: CSSProperties
  buttonPrimary: CSSProperties

  totaleCostiCantiere: number
  utileCantiere: number
  margineCantiere: string

  mostraMaterialiCantiere: boolean
  setMostraMaterialiCantiere: (v: boolean) => void
  eliminaFileDaStorage: (path?: string | null) => Promise<void>
  caricaEconomia: () => Promise<void>
  supabase: any

  mostraAttrezziCantiere: boolean
  setMostraAttrezziCantiere: (v: boolean) => void
  attrezziCantiere: any[]
  eliminaAttrezzatura: (a: any) => void | Promise<void>
}

export default function RiepilogoCostiEconomiaPanel({
  mostraDettaglioManodopera,
  setMostraDettaglioManodopera,
  timbrature,
  cantiereScheda,
  totaleManodoperaCantiere,
  economiaDataDa,
  economiaDataA,
  ordineOperai,
  setOrdineOperai,
  direzioneOperai,
  setDirezioneOperai,
  excelTable,
  excelTh,
  excelTd,
  buttonSecondary,
  formatMoney,
  calcolaOre,
  calcolaOreNumero,
  calcolaCostoTimbratura,

  mostraDettaglioMateriali,
  setMostraDettaglioMateriali,
  totaleMaterialiEconomia,
  materialiCantiere,
  cercaMaterialeManuale,
  setCercaMaterialeManuale,
  materialeManualeDescrizione,
  setMaterialeManualeDescrizione,
  materialeManualeQuantita,
  setMaterialeManualeQuantita,
  materialeManualePrezzo,
  setMaterialeManualePrezzo,
  materialeManualeFornitore,
  setMaterialeManualeFornitore,
  materialeManualeNota,
  setMaterialeManualeNota,
  salvaMaterialeManuale,
  eliminaMaterialeCantiere,
  ordinaMateriali,
  ordineMaterialiCampo,
  ordineMaterialiDirezione,
  inputStyle,
  buttonPrimary,

  totaleCostiCantiere,
  utileCantiere,
  margineCantiere,

  mostraMaterialiCantiere,
  setMostraMaterialiCantiere,
  eliminaFileDaStorage,
  caricaEconomia,
  supabase,

  mostraAttrezziCantiere,
  setMostraAttrezziCantiere,
  attrezziCantiere,
  eliminaAttrezzatura,
}: Props) {
  return (
    <>
      <DettaglioManodoperaPanel
        mostraDettaglioManodopera={mostraDettaglioManodopera}
        setMostraDettaglioManodopera={setMostraDettaglioManodopera}
        timbrature={timbrature}
        cantiereScheda={cantiereScheda}
        totaleManodoperaCantiere={totaleManodoperaCantiere}
        economiaDataDa={economiaDataDa}
        economiaDataA={economiaDataA}
        ordineOperai={ordineOperai}
        setOrdineOperai={setOrdineOperai}
        direzioneOperai={direzioneOperai}
        setDirezioneOperai={setDirezioneOperai}
        excelTable={excelTable}
        excelTh={excelTh}
        excelTd={excelTd}
        buttonSecondary={buttonSecondary}
        formatMoney={formatMoney}
        calcolaOre={calcolaOre}
        calcolaOreNumero={calcolaOreNumero}
        calcolaCostoTimbratura={calcolaCostoTimbratura}
      />

      <MaterialiEconomiaPanel
        mostraDettaglioMateriali={mostraDettaglioMateriali}
        setMostraDettaglioMateriali={setMostraDettaglioMateriali}
        totaleMaterialiEconomia={totaleMaterialiEconomia}
        materialiCantiere={materialiCantiere}
        cantiereScheda={cantiereScheda}
        economiaDataDa={economiaDataDa}
        economiaDataA={economiaDataA}
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
        excelTable={excelTable}
        excelTh={excelTh}
        excelTd={excelTd}
        inputStyle={inputStyle}
        buttonPrimary={buttonPrimary}
        buttonSecondary={buttonSecondary}
        formatMoney={formatMoney}
      />

      <RiepilogoUtilePanel
        totaleCostiCantiere={totaleCostiCantiere}
        utileCantiere={utileCantiere}
        margineCantiere={margineCantiere}
        formatMoney={formatMoney}
      />

      <MaterialiCaricatiPanel
        mostraMaterialiCantiere={mostraMaterialiCantiere}
        setMostraMaterialiCantiere={setMostraMaterialiCantiere}
        materialiCantiere={materialiCantiere}
        cantiereScheda={cantiereScheda}
        economiaDataDa={economiaDataDa}
        economiaDataA={economiaDataA}
        buttonSecondary={buttonSecondary}
        formatMoney={formatMoney}
        eliminaFileDaStorage={eliminaFileDaStorage}
        caricaEconomia={caricaEconomia}
        supabase={supabase}
      />

      <AttrezzatureCaricatePanel
        mostraAttrezziCantiere={mostraAttrezziCantiere}
        setMostraAttrezziCantiere={setMostraAttrezziCantiere}
        attrezziCantiere={attrezziCantiere}
        cantiereScheda={cantiereScheda}
        buttonSecondary={buttonSecondary}
        formatMoney={formatMoney}
        onElimina={eliminaAttrezzatura}
      />
    </>
  )
}