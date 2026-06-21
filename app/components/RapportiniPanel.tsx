'use client'

import {
  useEffect,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type { Cantiere, Operaio } from '../types'
import RapportinoForm, {
  type OperaioRapportinoTemp,
} from './RapportinoForm'
import RapportiniList from './RapportiniList'

type Props = {
  cardStyle: CSSProperties
  rapportiniFiltrati: any[]
  fotoCantiere: any[]
  setFotoRapportinoAperte: (foto: any[]) => void
  preparaModificaRapportino: (rapportino: any) => void
  eliminaRapportino: (id?: string) => void | Promise<void>
  generaPdfRapportinoFotografico: (
    rapportino: any
  ) => void | Promise<void>
  cantiereRapporto: string
  setCantiereRapporto: (cantiere: string) => void
  data: string
  setData: (data: string) => void
  note: string
  setNote: (note: string) => void
  materiali: string
  setMateriali: (materiali: string) => void
  quantitaMateriali: string
  setQuantitaMateriali: (quantita: string) => void
  costoMateriali: string
  setCostoMateriali: (costo: string) => void
  salvaRapportino: () => void | Promise<void>
  aggiornaRapportino: () => void | Promise<void>
  rapportinoInModifica: string | null
  cantieri: Cantiere[]
  inputStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
  ascoltoRapportino: boolean
  avviaDettaturaRapportino: () => void
  fermaDettaturaRapportino: () => void
  operaiAnagrafica: Operaio[]
  operaiRapportinoTemp: OperaioRapportinoTemp[]
  setOperaiRapportinoTemp: Dispatch<
    SetStateAction<OperaioRapportinoTemp[]>
  >
  setPopupFotoRapportino: (aperto: boolean) => void
}

export default function RapportiniPanel({
  cardStyle,
  rapportiniFiltrati,
  fotoCantiere,
  setFotoRapportinoAperte,
  preparaModificaRapportino,
  eliminaRapportino,
  generaPdfRapportinoFotografico,
  cantiereRapporto,
  setCantiereRapporto,
  data,
  setData,
  note,
  setNote,
  materiali,
  setMateriali,
  quantitaMateriali,
  setQuantitaMateriali,
  costoMateriali,
  setCostoMateriali,
  salvaRapportino,
  aggiornaRapportino,
  rapportinoInModifica,
  cantieri,
  inputStyle,
  buttonPrimary,
  buttonSecondary,
  ascoltoRapportino,
  avviaDettaturaRapportino,
  fermaDettaturaRapportino,
  operaiAnagrafica,
  operaiRapportinoTemp,
  setOperaiRapportinoTemp,
  setPopupFotoRapportino,
}: Props) {
  const [mostraInserimento, setMostraInserimento] = useState(false)

  useEffect(() => {
    if (rapportinoInModifica !== null) {
      setMostraInserimento(true)
    }
  }, [rapportinoInModifica])

  const cantieriCoinvolti = new Set(
    rapportiniFiltrati
      .map((rapportino) => String(rapportino.cantiere || '').trim())
      .filter(Boolean)
  ).size

  const totaleOreRapportini = rapportiniFiltrati.reduce(
    (totale, rapportino) => {
      const ore = parseFloat(String(rapportino.ore || 0).replace(',', '.'))

      return totale + (Number.isNaN(ore) ? 0 : ore)
    },
    0
  )

  return (
    <section style={cardStyle}>
      <h2>📅 Diario di Cantiere</h2>
      <p style={{ color: '#64748b' }}>
        Riepilogo operativo dei rapportini salvati per cantiere.
      </p>

      <button
        type="button"
        onClick={() => setMostraInserimento(true)}
        style={buttonPrimary}
      >
        ➕ Aggiungi rapportino
      </button>

      {mostraInserimento && (
        <RapportinoForm
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
          onClose={() => setMostraInserimento(false)}
        />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          margin: '18px 0',
        }}
      >
        <div
          style={{
            padding: 14,
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            background: '#f8fafc',
          }}
        >
          <div style={{ color: '#64748b', fontSize: 13 }}>
            Numero rapportini
          </div>
          <strong style={{ display: 'block', marginTop: 4, fontSize: 22 }}>
            {rapportiniFiltrati.length}
          </strong>
        </div>

        <div
          style={{
            padding: 14,
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            background: '#f8fafc',
          }}
        >
          <div style={{ color: '#64748b', fontSize: 13 }}>
            Cantieri coinvolti
          </div>
          <strong style={{ display: 'block', marginTop: 4, fontSize: 22 }}>
            {cantieriCoinvolti}
          </strong>
        </div>

        <div
          style={{
            padding: 14,
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            background: '#f8fafc',
          }}
        >
          <div style={{ color: '#64748b', fontSize: 13 }}>
            Totale ore rapportini
          </div>
          <strong style={{ display: 'block', marginTop: 4, fontSize: 22 }}>
            {totaleOreRapportini.toLocaleString('it-IT', {
              maximumFractionDigits: 2,
            })}
          </strong>
        </div>
      </div>

      <RapportiniList
        rapportiniFiltrati={rapportiniFiltrati}
        fotoCantiere={fotoCantiere}
        setFotoRapportinoAperte={setFotoRapportinoAperte}
        preparaModificaRapportino={preparaModificaRapportino}
        eliminaRapportino={eliminaRapportino}
        generaPdfRapportinoFotografico={generaPdfRapportinoFotografico}
        buttonSecondary={buttonSecondary}
      />
    </section>
  )
}
