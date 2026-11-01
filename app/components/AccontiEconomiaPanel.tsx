import type { CSSProperties } from 'react'

import AccontiSalPanel from './AccontiSalPanel'
import AccontoForm from './AccontoForm'
import AccontiTable from './AccontiTable'
import { accontiCaricati, type StatoAcconti, type RigaAcconto } from '../engines/economia/accontiCantiere'

type Props = {
  totaleAccontiCantiere: number | null
  residuoDaIncassare: number | null
  statoAcconti: StatoAcconti
  authAccontiDisponibile: boolean
  caricaAcconti: () => Promise<boolean>
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

  accontiCantiere: RigaAcconto[]
  cantiereScheda: string
  cantiereId?: string
  economiaDataDa: string
  economiaDataA: string

  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
  buttonSecondary: CSSProperties

  formatMoney: (n: number) => string
  modificaAcconto: (a: RigaAcconto) => void
  eliminaAcconto: (a: RigaAcconto) => void | Promise<void>
}

export default function AccontiEconomiaPanel({
  totaleAccontiCantiere,
  residuoDaIncassare,
  statoAcconti,
  authAccontiDisponibile,
  caricaAcconti,
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
  cantiereId,
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
  const caricati = accontiCaricati(statoAcconti)
  const gestisci = async () => {
    if (mostraAcconti && caricati) {
      setMostraAcconti(false)
      return
    }
    if (caricati || await caricaAcconti()) setMostraAcconti(true)
  }
  return (
    <section aria-label="Acconti del cantiere">
      <AccontiSalPanel
        totaleAccontiCantiere={totaleAccontiCantiere}
        residuoDaIncassare={residuoDaIncassare}
        statoAcconti={statoAcconti}
        authDisponibile={authAccontiDisponibile}
        mostraAcconti={mostraAcconti}
        buttonSecondary={buttonSecondary}
        formatMoney={formatMoney}
        onGestisci={gestisci}
      />

      {mostraAcconti && caricati && (
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
            cantiereId={cantiereId}
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
    </section>
  )
}
