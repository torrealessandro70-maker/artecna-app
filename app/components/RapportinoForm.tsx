'use client'

import {
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type { Cantiere, FotoCantiere, Operaio } from '../types'
import type { ParsedReport } from '../engines/document-intelligence/report-parser'
import RapportinoActivities, {
  type RapportinoActivity,
} from './RapportinoActivities'
import SmartReportAssistant from './SmartReportAssistant'
import { cleanDictationText } from '../utils/cleanDictationText'

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
  fotoCantiere: FotoCantiere[]
  setFotoRapportinoAperte: (foto: FotoCantiere[]) => void
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
  fotoCantiere,
  setFotoRapportinoAperte,
  onClose,
}: Props) {
  const [testoRacconto, setTestoRacconto] = useState('')
  const [attivita, setAttivita] = useState<RapportinoActivity[]>([])

  const fotoCollegate = cantiereRapporto && data
    ? fotoCantiere.filter((foto) => {
        const categoria = String(foto.categoria || '').toLowerCase()

        return (
          foto.cantiere === cantiereRapporto &&
          String(foto.data_foto || '') === String(data) &&
          (!categoria || categoria === 'rapportino')
        )
      })
    : []

  const applicaReport = (report: ParsedReport) => {
    if (report.cantiere) setCantiereRapporto(report.cantiere)
    if (report.data) setData(report.data)
    if (report.note.trim()) setNote(cleanDictationText(report.note))

    if (report.attivitaDaFare.length > 0) {
      setAttivita((attivitaCorrenti) => {
        const testiPresenti = new Set(
          attivitaCorrenti.map((attivita) => attivita.testo.trim().toLowerCase())
        )
        const nuoveAttivita = report.attivitaDaFare
          .filter((testo) => !testiPresenti.has(testo.trim().toLowerCase()))
          .map((testo) => ({
            id: crypto.randomUUID(),
            testo,
            completata: false,
            origine: 'ai' as const,
            dataCreazione: new Date().toISOString(),
          }))

        return [...attivitaCorrenti, ...nuoveAttivita]
      })
    }

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
      <h3 style={{ margin: 0 }}>
        {rapportinoInModifica !== null
          ? '✏ Modifica rapportino'
          : '➕ Nuovo rapportino'}
      </h3>

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

      <section
        style={{
          display: 'grid',
          gap: 10,
          padding: 14,
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          background: '#fff',
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>
            🛠 Cosa abbiamo fatto oggi
          </h3>
          <p style={{ margin: 0, color: '#64748b' }}>
            Scrivi o detta le lavorazioni eseguite oggi. Sotto puoi segnare le
            cose da fare nei prossimi giorni.
          </p>
        </div>

        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-label="Cosa abbiamo fatto oggi"
          style={{ ...inputStyle, display: 'block', width: '100%' }}
          rows={4}
        />

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
      </section>

      <RapportinoActivities
        attivita={attivita}
        onChangeAttivita={setAttivita}
        buttonSecondary={buttonSecondary}
      />

      <button
        type="button"
        onClick={() => setPopupFotoRapportino(true)}
        style={{ ...buttonSecondary, justifySelf: 'start' }}
      >
        📷 Aggiungi foto rapportino
      </button>

      <section
        style={{
          display: 'grid',
          gap: 10,
          padding: 12,
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          background: '#f8fafc',
        }}
      >
        <div>
          <strong>📷 Foto collegate</strong>
          <span style={{ marginLeft: 8, color: '#64748b' }}>
            {fotoCollegate.length}
          </span>
        </div>

        {fotoCollegate.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>
            Nessuna foto collegata a questo rapportino.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 72px))',
              gap: 8,
            }}
          >
            {fotoCollegate.map((foto, indice) => (
              <button
                key={foto.id || indice}
                type="button"
                onClick={() => setFotoRapportinoAperte(fotoCollegate)}
                title="Apri foto collegate"
                style={{
                  width: 72,
                  height: 72,
                  padding: 0,
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                <img
                  src={foto.immagine_base64}
                  alt={foto.nota || `Foto rapportino ${indice + 1}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </section>

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
          onClick={() =>
            void (rapportinoInModifica !== null
              ? aggiornaRapportino()
              : salvaRapportino())
          }
          style={buttonPrimary}
        >
          {rapportinoInModifica !== null
            ? 'Aggiorna rapportino'
            : 'Salva rapportino'}
        </button>
        <button type="button" onClick={onClose} style={buttonSecondary}>
          Chiudi
        </button>
      </div>
    </div>
  )
}
