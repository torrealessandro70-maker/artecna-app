import type { CSSProperties } from 'react'

import AccontiSalPanel from './AccontiSalPanel'
import AccontoForm from './AccontoForm'
import AccontiTable from './AccontiTable'
import VistaOperativa from './VistaOperativa'
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
        <VistaOperativa titolo="Gestione acconti" contesto={`${cantiereScheda} · Economia · SAL e acconti`}
          etichettaRitorno="← Torna a SAL e acconti" onChiudi={() => setMostraAcconti(false)}>
        <div className="acconti-gestione-focus" style={{ width: '100%', minWidth: 0, containerType: 'inline-size', containerName: 'acconti-gestione' }}>
          <p><strong>Acconti ricevuti:</strong> {totaleAccontiCantiere === null ? 'Non disponibile' : formatMoney(totaleAccontiCantiere)}</p>
          <div className="acconti-form-focus">
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
          </div>

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
          <style>{`
            .acconti-gestione-focus input { width: 100%; min-width: 0; max-width: 100%; box-sizing: border-box; }
            .acconti-form-focus > div { grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr)) !important; min-width: 0; }
            .acconti-gestione-focus button { min-height: 44px; max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
            .acconti-gestione-focus table { width: 100%; }
            .acconti-gestione-focus td, .acconti-gestione-focus th { overflow-wrap: anywhere; }
            @container acconti-gestione (max-width: 899px) {
              .acconti-gestione-focus table, .acconti-gestione-focus tbody, .acconti-gestione-focus tr, .acconti-gestione-focus td { display: block; width: 100%; min-width: 0; box-sizing: border-box; }
              .acconti-gestione-focus thead { display: none; }
              .acconti-gestione-focus tr { margin-bottom: 14px; border: 1px solid #cbd5e1; border-radius: 8px; }
              .acconti-gestione-focus td::before { display: block; font-weight: 600; color: #64748b; margin-bottom: 4px; }
              .acconti-gestione-focus td:nth-child(1)::before { content: 'Data'; }
              .acconti-gestione-focus td:nth-child(2)::before { content: 'Descrizione'; }
              .acconti-gestione-focus td:nth-child(3)::before { content: 'Importo'; }
              .acconti-gestione-focus td:nth-child(4)::before { content: 'Metodo'; }
              .acconti-gestione-focus td:nth-child(5)::before { content: 'Nota'; }
              .acconti-gestione-focus td:nth-child(6)::before { content: 'Azioni'; }
            }
          `}</style>
        </div>
        </VistaOperativa>
      )}
    </section>
  )
}
