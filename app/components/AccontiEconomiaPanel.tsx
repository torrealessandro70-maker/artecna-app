import type { CSSProperties } from 'react'

import AccontiSalPanel from './AccontiSalPanel'
import AccontoForm from './AccontoForm'
import AccontiTable from './AccontiTable'

type Props = {
  totaleAccontiCantiere: number
  residuoDaIncassare: number
  mostraAcconti: boolean
  setMostraAcconti: (v: boolean) => void

  descrizioneAcconto: string
  setDescrizioneAcconto: (v: string) => void
  importoAcconto: string
  setImportoAcconto: (v: string) => void
  dataAcconto: string
  setDataAcconto: (v: string) => void
  metodoAcconto: string
  setMetodoAcconto: (v: string) => void
  notaAcconto: string
  setNotaAcconto: (v: string) => void
  salvaAcconto: () => void | Promise<void>

  accontiCantiere: any[]
  cantiereScheda: string
  economiaDataDa: string
  economiaDataA: string

  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
  buttonSecondary: CSSProperties

  formatMoney: (n: number) => string
  modificaAcconto: (a: any) => void
  eliminaAcconto: (a: any) => void | Promise<void>
}

export default function AccontiEconomiaPanel({
  totaleAccontiCantiere,
  residuoDaIncassare,
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
  accontiCantiere,
  cantiereScheda,
  economiaDataDa,
  economiaDataA,
  excelTable,
  excelTh,
  excelTd,
  buttonSecondary,
  formatMoney,
  modificaAcconto,
  eliminaAcconto,
}: Props) {
  return (
    <div>
      <AccontiSalPanel
        totaleAccontiCantiere={totaleAccontiCantiere}
        residuoDaIncassare={residuoDaIncassare}
        mostraAcconti={mostraAcconti}
        buttonSecondary={buttonSecondary}
        formatMoney={formatMoney}
        setMostraAcconti={setMostraAcconti}
      />

      {mostraAcconti && (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <AccontoForm
            descrizione={descrizioneAcconto}
            setDescrizione={setDescrizioneAcconto}
            importo={importoAcconto}
            setImporto={setImportoAcconto}
            data={dataAcconto}
            setData={setDataAcconto}
            metodo={metodoAcconto}
            setMetodo={setMetodoAcconto}
            nota={notaAcconto}
            setNota={setNotaAcconto}
            onSalva={salvaAcconto}
          />

          <AccontiTable
            acconti={accontiCantiere}
            cantiereScheda={cantiereScheda}
            economiaDataDa={economiaDataDa}
            economiaDataA={economiaDataA}
            excelTable={excelTable}
            excelTh={excelTh}
            excelTd={excelTd}
            buttonSecondary={buttonSecondary}
            formatMoney={formatMoney}
            onModifica={modificaAcconto}
            onElimina={eliminaAcconto}
          />
        </div>
      )}
    </div>
  )
}