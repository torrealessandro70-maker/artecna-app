 import type { CSSProperties } from 'react'

import EconomiaGraficiPanel from './EconomiaGraficiPanel'
import EconomiaSelezioneCantierePanel from './EconomiaSelezioneCantierePanel'
import DashboardEconomiaPanel from './DashboardEconomiaPanel'
import PreventiviEconomiaPanel from './PreventiviEconomiaPanel'
import SalDettagliatoPanel from './SalDettagliatoPanel'
import FiltroPeriodoEconomia from './FiltroPeriodoEconomia'
import AccontiEconomiaPanel from './AccontiEconomiaPanel'
import RiepilogoCostiEconomiaPanel from './RiepilogoCostiEconomiaPanel'

type Props = any

export default function CantieriEconomiaPanel(props: Props) {
 const {
  cardStyle,
  cantiereScheda,
  preventivoCantiere,
  totaleCostiCantiere,
  totaleAccontiCantiere,
  residuoDaIncassare,
  utileCantiere,
  totaleManodoperaCantiere,
  totaleMaterialiEconomia,
  totaleAttrezziEconomia,
  setMostraDettaglioManodopera,
  setMostraDettaglioMateriali,
  setMostraDettaglioAttrezzi,
  cantieri,
  setCantiereScheda,
  ricercaCantiereEconomia,
  setRicercaCantiereEconomia,
  mostraConclusiEconomia,
  setMostraConclusiEconomia,
  dragAttivo,
  setDragAttivo,
  caricaFilePreventivo,
  handleUploadPreventivo,
  inputStyle,
  buttonSecondary,
  supabase,
  caricaCantieri,
  mostraPreventiviCantiere,
  setMostraPreventiviCantiere,
  preventivi,
  setPreventivi,
  formatMoney,
  parseImporto,
  caricaEconomia,
  salCantiere,
  setSalCantiere,
  salDescrizione,
  setSalDescrizione,
  salImportoPrevisto,
  setSalImportoPrevisto,
  salPercentuale,
  setSalPercentuale,
  salNote,
  setSalNote,
  salvaSalLavorazione,
  buttonPrimary,
  caricaSalLavorazioni,
  caricaPreventivoLavorazioni,
  prevDescrizione,
  setPrevDescrizione,
  prevQuantita,
  setPrevQuantita,
  prevPrezzoUnitario,
  setPrevPrezzoUnitario,
  prevUnita,
  setPrevUnita,
  prevImporto,
  setPrevImporto,
  salvaLavorazionePreventivo,
  preventivoLavorazioni,
  analizzaRigheDocumento,
  mostraConfrontoPdfSal,
  setMostraConfrontoPdfSal,
  lavorazioneEditId,
  setLavorazioneEditId,
  lavorazioneEditDescrizione,
  setLavorazioneEditDescrizione,
  lavorazioneEditImporto,
  setLavorazioneEditImporto,
  salLavorazioni,
  accontiCantiere,
  excelTable,
  excelTh,
  excelTd,
  eliminaSalLavorazione,
  economiaDataDa,
  setEconomiaDataDa,
  economiaDataA,
  setEconomiaDataA,
  mostraAcconti,
  setMostraAcconti,
  descrizioneAcconto,
  setDescrizioneAcconto,
  importoAcconto,
  setImportoAcconto,
  dataAcconto,
  setDataAcconto,
  metodoAcconto,
  setMetodoAcconto,
  notaAcconto,
  setNotaAcconto,
  salvaAcconto,
  modificaAcconto,
  eliminaAcconto,
  mostraDettaglioManodopera,
  timbrature,
  ordineOperai,
  setOrdineOperai,
  direzioneOperai,
  setDirezioneOperai,
  calcolaOre,
  calcolaOreNumero,
  calcolaCostoTimbratura,
  mostraDettaglioMateriali,
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
  margineCantiere,
  mostraMaterialiCantiere,
  setMostraMaterialiCantiere,
  eliminaFileDaStorage,
  mostraAttrezziCantiere,
  setMostraAttrezziCantiere,
  attrezziCantiere,
  eliminaAttrezzatura,
} = props

  return (
 <div style={cardStyle}>
    <h2>Economia cantiere</h2>

<EconomiaGraficiPanel
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
/>

<EconomiaSelezioneCantierePanel
  cantieri={cantieri}
  cantiereScheda={cantiereScheda}
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
/>

    {!cantiereScheda ? (
      <p>Seleziona un cantiere per vedere l’economia.</p>
    ) : (
      <div>
               <DashboardEconomiaPanel
          cantiereScheda={cantiereScheda}
          cantieri={cantieri}
          supabase={supabase}
          caricaCantieri={caricaCantieri}
        />

        <div style={{ display: 'grid', gap: 10 }}>



                    <PreventiviEconomiaPanel
            preventivoCantiere={preventivoCantiere}
            mostraPreventiviCantiere={mostraPreventiviCantiere}
            setMostraPreventiviCantiere={setMostraPreventiviCantiere}
            preventivi={preventivi}
            setPreventivi={setPreventivi}
            cantiereScheda={cantiereScheda}
            formatMoney={formatMoney}
            parseImporto={parseImporto}
            supabase={supabase}
            caricaEconomia={caricaEconomia}
            buttonSecondary={buttonSecondary}
          />


<SalDettagliatoPanel
  cardStyle={cardStyle}
  cantieri={cantieri}
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
  buttonSecondary={buttonSecondary}
  supabase={supabase}
  caricaSalLavorazioni={caricaSalLavorazioni}
  caricaPreventivoLavorazioni={caricaPreventivoLavorazioni}
  caricaEconomia={caricaEconomia}
  caricaCantieri={caricaCantieri}
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
  preventivi={preventivi}
  preventivoLavorazioni={preventivoLavorazioni}
  cantiereScheda={cantiereScheda}
  formatMoney={formatMoney}
  parseImporto={parseImporto}
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
/>




<FiltroPeriodoEconomia
  economiaDataDa={economiaDataDa}
  setEconomiaDataDa={setEconomiaDataDa}
  economiaDataA={economiaDataA}
  setEconomiaDataA={setEconomiaDataA}
  buttonSecondary={buttonSecondary}
/>

<AccontiEconomiaPanel
  totaleAccontiCantiere={totaleAccontiCantiere}
  residuoDaIncassare={residuoDaIncassare}
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
  accontiCantiere={accontiCantiere}
  cantiereScheda={cantiereScheda}
  economiaDataDa={economiaDataDa}
  economiaDataA={economiaDataA}
  excelTable={excelTable}
  excelTh={excelTh}
  excelTd={excelTd}
  buttonSecondary={buttonSecondary}
  formatMoney={formatMoney}
  modificaAcconto={modificaAcconto}
  eliminaAcconto={eliminaAcconto}
/>
       <RiepilogoCostiEconomiaPanel
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
  mostraDettaglioMateriali={mostraDettaglioMateriali}
  setMostraDettaglioMateriali={setMostraDettaglioMateriali}
  totaleMaterialiEconomia={totaleMaterialiEconomia}
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
  inputStyle={inputStyle}
  buttonPrimary={buttonPrimary}
  totaleCostiCantiere={totaleCostiCantiere}
  utileCantiere={utileCantiere}
  margineCantiere={margineCantiere}
  mostraMaterialiCantiere={mostraMaterialiCantiere}
  setMostraMaterialiCantiere={setMostraMaterialiCantiere}
  eliminaFileDaStorage={eliminaFileDaStorage}
  caricaEconomia={caricaEconomia}
  supabase={supabase}
  mostraAttrezziCantiere={mostraAttrezziCantiere}
  setMostraAttrezziCantiere={setMostraAttrezziCantiere}
  attrezziCantiere={attrezziCantiere}
  eliminaAttrezzatura={eliminaAttrezzatura}
/>
             
   </div>
      </div>
    )}
  </div>
  )
}
