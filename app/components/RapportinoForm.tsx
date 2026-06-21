'use client'

import {
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type { Cantiere, Operaio } from '../types'
import type { ParsedReport } from '../engines/document-intelligence/report-parser'
import SmartReportAssistant from './SmartReportAssistant'

const checklistRapportino = [
  'Lavorazioni eseguite',
  'Personale presente',
  'Materiali utilizzati',
  'Criticita riscontrate',
  'Lavori da completare',
]

export type OperaioRapportinoTemp = {
  nome: string
  ora_inizio?: string
  ora_fine?: string
  ore: number
  costo_orario: number
}

type Props = {
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
  onClose: () => void
}

export default function RapportinoForm({
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
  onClose,
}: Props) {
  const [testoRacconto, setTestoRacconto] = useState('')

  const applicaReport = (report: ParsedReport) => {
    if (report.cantiere) setCantiereRapporto(report.cantiere)
    if (report.data) setData(report.data)
    if (report.note.trim()) setNote(report.note)

    if (report.materiali.length > 0) {
      const materialiEstratti = report.materiali
        .map((materiale) => {
          if (typeof materiale === 'string') return materiale

          const nome = String(materiale?.nome || '').trim()
          const quantita = materiale?.quantita
          const unita = String(materiale?.unita || nome).trim()

          return quantita ? `${quantita} ${unita}` : nome
        })
        .filter(Boolean)

      if (materialiEstratti.length > 0) {
        setMateriali(materialiEstratti.join(', '))
      }
    }

    if (report.operai.length > 0) {
      const operaiEstratti = new Map(
        report.operai.map((operaio) => [operaio.nome, operaio])
      )

      setOperaiRapportinoTemp((operaiCorrenti) => {
        const operaiAggiornati = operaiCorrenti.map((operaio) => {
          const estratto = operaiEstratti.get(operaio.nome)

          if (!estratto) return operaio

          return {
            ...operaio,
            ora_inizio: estratto.ora_inizio || operaio.ora_inizio || '',
            ora_fine: estratto.ora_fine || operaio.ora_fine || '',
            ore: estratto.ore > 0 ? estratto.ore : operaio.ore,
          }
        })
        const nomiPresenti = new Set(
          operaiAggiornati.map((operaio) => operaio.nome)
        )
        const nuoviOperai = operaiAnagrafica
          .filter(
            (operaio) =>
              operaiEstratti.has(operaio.nome) &&
              !nomiPresenti.has(operaio.nome)
          )
          .map((operaio) => {
            const estratto = operaiEstratti.get(operaio.nome)

            return {
              nome: operaio.nome,
              ora_inizio: estratto?.ora_inizio || '',
              ora_fine: estratto?.ora_fine || '',
              ore: estratto?.ore || 0,
              costo_orario: Number(operaio.costo_orario || 0),
            }
          })

        return [...operaiAggiornati, ...nuoviOperai]
      })
    }
  }

  const aggiungiVoceChecklist = (voce: string) => {
    const riga = `☐ ${voce}`
    const notaCorrente = note.trimEnd()

    if (notaCorrente.split('\n').some((linea) => linea.trim() === riga)) return

    setNote(notaCorrente ? `${notaCorrente}\n${riga}` : riga)
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: 12,
        marginTop: 16,
        padding: 16,
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        background: '#f8fafc',
      }}
    >
      <h3 style={{ margin: 0 }}>Nuovo rapportino</h3>

      <label>
        Cantiere
        <select
          value={cantiereRapporto}
          onChange={(event) => setCantiereRapporto(event.target.value)}
          style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 6 }}
        >
          <option value="">Seleziona cantiere...</option>
          {cantieri.map((cantiere) => (
            <option key={cantiere.id || cantiere.nome} value={cantiere.nome}>
              {cantiere.nome}
            </option>
          ))}
        </select>
      </label>

      <label>
        Data
        <input
          type="date"
          value={data}
          onChange={(event) => setData(event.target.value)}
          style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 6 }}
        />
      </label>

      <SmartReportAssistant
        testo={testoRacconto}
        onChangeTesto={setTestoRacconto}
        inputStyle={inputStyle}
        buttonPrimary={buttonPrimary}
        buttonSecondary={buttonSecondary}
        context={{
          cantiere: cantiereRapporto || undefined,
          data: data || undefined,
          cantieriDisponibili: cantieri.map((cantiere) => cantiere.nome),
          operaiDisponibili: operaiAnagrafica.map((operaio) => operaio.nome),
        }}
        onParsedReport={applicaReport}
      />

      {operaiRapportinoTemp.length > 0 && (
        <div
          style={{
            padding: 10,
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            background: '#f0fdf4',
          }}
        >
          <strong>Operai precompilati:</strong>{' '}
          {operaiRapportinoTemp
            .map((operaio) =>
              operaio.ore > 0
                ? `${operaio.nome} (${operaio.ora_inizio}-${operaio.ora_fine}, ${operaio.ore}h)`
                : operaio.nome
            )
            .join(', ')}
        </div>
      )}

      <label>
        Note / lavorazioni
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 6 }}
          rows={4}
        />
      </label>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={avviaDettaturaRapportino}
          disabled={ascoltoRapportino}
          style={buttonSecondary}
        >
          🎤 Avvia dettatura
        </button>
        <button
          type="button"
          onClick={fermaDettaturaRapportino}
          disabled={!ascoltoRapportino}
          style={{
            ...buttonSecondary,
            backgroundColor: ascoltoRapportino ? '#dc2626' : undefined,
            color: ascoltoRapportino ? '#fff' : undefined,
          }}
        >
          ⏹ Stop
        </button>
      </div>

      <fieldset
        style={{
          display: 'grid',
          gap: 8,
          margin: 0,
          padding: 12,
          border: '1px solid #e2e8f0',
          borderRadius: 8,
        }}
      >
        <legend style={{ padding: '0 6px', fontWeight: 600 }}>
          Checklist rapida
        </legend>
        {checklistRapportino.map((voce) => {
          const riga = `☐ ${voce}`
          const presente = note
            .split('\n')
            .some((linea) => linea.trim() === riga)

          return (
            <label key={voce} style={{ display: 'flex', gap: 8 }}>
              <input
                type="checkbox"
                checked={presente}
                disabled={presente}
                onChange={() => aggiungiVoceChecklist(voce)}
              />
              {voce}
            </label>
          )
        })}
      </fieldset>

      <label>
        Materiali
        <input
          value={materiali}
          onChange={(event) => setMateriali(event.target.value)}
          style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 6 }}
        />
      </label>

      <label>
        Quantita materiali
        <input
          type="number"
          min="0"
          step="any"
          value={quantitaMateriali}
          onChange={(event) => setQuantitaMateriali(event.target.value)}
          style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 6 }}
        />
      </label>

      <label>
        Costo materiali
        <input
          type="number"
          min="0"
          step="0.01"
          value={costoMateriali}
          onChange={(event) => setCostoMateriali(event.target.value)}
          style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 6 }}
        />
      </label>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => void salvaRapportino()}
          style={buttonPrimary}
        >
          Salva rapportino
        </button>
        <button type="button" onClick={onClose} style={buttonSecondary}>
          Chiudi
        </button>
      </div>
    </div>
  )
}
