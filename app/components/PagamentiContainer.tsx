'use client'

import PagamentiOperaiPanel from './PagamentiOperaiPanel'
import PagamentiFornitoriPanel from './PagamentiFornitoriPanel'

type Props = any

export default function PagamentiContainer(props: Props) {
  const p = props

  return (
    <>
      {/* ================= PAGAMENTI - OPERAI ================= */}
      {(
        p.pagineAperte.includes('pagamenti-operai') ||
        (!p.modalitaMulti &&
          p.sezioneAttiva === 'pagamenti' &&
          p.sottoSezionePagamenti === 'operai')
      ) && (
        <PagamentiOperaiPanel
          cardStyle={p.cardStyle}
          buttonPrimary={p.buttonPrimary}
          buttonSecondary={p.buttonSecondary}
          excelTable={p.excelTable}
          excelTh={p.excelTh}
          excelTd={p.excelTd}
          formatMoney={p.formatMoney}
          calcolaOreNumero={p.calcolaOreNumero}
          totaleOreOperaio={p.totaleOreOperaio}
          calcolaCostoTimbratura={p.calcolaCostoTimbratura}
          parseOra={p.parseOra}
          totaleMaturatoOperai={p.totaleMaturatoOperai}
          totalePagatoOperai={p.totalePagatoOperai}
          residuoPagamentiOperai={p.residuoPagamentiOperai}
          scadenzaPagamentiOperai={p.scadenzaPagamentiOperai}
          statoScadenzaPagamenti={p.statoScadenzaPagamenti}
          giorniAllaScadenzaPagamenti={p.giorniAllaScadenzaPagamenti}
          costoOperaiPerCantiere={p.costoOperaiPerCantiere}
          situazioneCantieri={p.situazioneCantieri}
          cantieri={p.cantieri}
          timbrature={p.timbrature}
          operaiAnagrafica={p.operaiAnagrafica}
          pagamentiOperai={p.pagamentiOperai}
          mostraValutazioneFondi={p.mostraValutazioneFondi}
          setMostraValutazioneFondi={p.setMostraValutazioneFondi}
          mostraCostiPresenze={p.mostraCostiPresenze}
          setMostraCostiPresenze={p.setMostraCostiPresenze}
          mostraRiepilogoOperai={p.mostraRiepilogoOperai}
          setMostraRiepilogoOperai={p.setMostraRiepilogoOperai}
          pagamentiDataDa={p.pagamentiDataDa}
          setPagamentiDataDa={p.setPagamentiDataDa}
          pagamentiDataA={p.pagamentiDataA}
          setPagamentiDataA={p.setPagamentiDataA}
          operaioPagamento={p.operaioPagamento}
          setOperaioPagamento={p.setOperaioPagamento}
          importoPagamento={p.importoPagamento}
          setImportoPagamento={p.setImportoPagamento}
          dataPagamento={p.dataPagamento}
          setDataPagamento={p.setDataPagamento}
          metodoPagamento={p.metodoPagamento}
          setMetodoPagamento={p.setMetodoPagamento}
          notaPagamento={p.notaPagamento}
          setNotaPagamento={p.setNotaPagamento}
          salvaPagamentoOperaio={p.salvaPagamentoOperaio}
          preparaPagamentoRapidoOperaio={p.preparaPagamentoRapidoOperaio}
        />
      )}

      {/* ================= PAGAMENTI - FORNITORI ================= */}
      {(
        p.pagineAperte.includes('pagamenti-fornitori') ||
        (!p.modalitaMulti &&
          p.sezioneAttiva === 'pagamenti' &&
          p.sottoSezionePagamenti === 'fornitori')
      ) && <PagamentiFornitoriPanel cardStyle={p.cardStyle} />}
    </>
  )
}