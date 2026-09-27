'use client'

import {
  useId,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type { Cantiere, FotoCantiere, Operaio } from '../types'
import type { ParsedReport } from '../engines/document-intelligence/report-parser'
import type { PropostaOperaioRiconosciuto } from '../utils/applicaOperaiRiconosciuti'
import RapportinoActivities, {
  type RapportinoActivity,
} from './RapportinoActivities'
import SmartReportAssistant, {
  type ReminderActivityDraft,
} from './SmartReportAssistant'
import { cleanDictationText } from '../utils/cleanDictationText'
import {
  risolviMenzioniOperai,
  type MenzioneOperaioRisolta,
} from '../utils/risolviMenzioniOperai'

type SceltaIdentitaOperaio =
  | { tipo: 'candidato'; operaioId: string }
  | { tipo: 'nessuno' }

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
  avviaDettaturaRapportino?: () => void
  fermaDettaturaRapportino?: () => void
  operaiAnagrafica: Operaio[]
  operaiRapportinoTemp: OperaioRapportinoTemp[]
 setOperaiRapportinoTemp: Dispatch<
  SetStateAction<OperaioRapportinoTemp[]>
>
onSalvaPortale?: () => void | Promise<void>
  setPopupFotoRapportino: (aperto: boolean) => void
  fotoCantiere: FotoCantiere[]
  setFotoRapportinoAperte: (foto: FotoCantiere[]) => void
  onClose: () => void
  modalitaPortaleOperai?: boolean
  onApplicaOperaiRiconosciuti?: (
    proposte: readonly PropostaOperaioRiconosciuto[]
  ) => void
  applicazioneOperaiDisabilitata?: boolean
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
  setPopupFotoRapportino,
  fotoCantiere,
  setFotoRapportinoAperte,
  onClose,
  modalitaPortaleOperai = false,
  onSalvaPortale,
  onApplicaOperaiRiconosciuti,
  applicazioneOperaiDisabilitata = false,
}: Props) {
  const [attivita, setAttivita] = useState<RapportinoActivity[]>([])
  // Batch locale informativo, senza applicazione alla squadra.
  const [
    menzioniOperaiRisolte,
    setMenzioniOperaiRisolte,
  ] = useState<MenzioneOperaioRisolta[]>([])
  const [scelteIdentitaOperai, setScelteIdentitaOperai] = useState<
    Record<string, SceltaIdentitaOperaio>
  >({})
  const idGruppiIdentita = useId()

  const proposteOperaiRiconosciuti: PropostaOperaioRiconosciuto[] =
    menzioniOperaiRisolte.flatMap((risultato, indice) => {
      const menzione = risultato.menzione
      const chiave = `${indice}:${menzione.inizio}:${menzione.fine}`
      let operaioId: string

      if (risultato.stato === 'trovato') {
        operaioId = risultato.operaio.id
      } else if (risultato.stato === 'ambiguo') {
        const scelta = scelteIdentitaOperai[chiave]
        if (scelta?.tipo !== 'candidato' ||
            !risultato.candidati.some((candidato) => candidato.id === scelta.operaioId)) {
          return []
        }
        operaioId = scelta.operaioId
      } else {
        return []
      }

      return [{
        chiaveMenzione: chiave,
        operaioId,
        ora_inizio: menzione.ora_inizio,
        ora_fine: menzione.ora_fine,
      }]
    })

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
  if (!modalitaPortaleOperai) {
    if (report.cantiere) setCantiereRapporto(report.cantiere)
    if (report.data) setData(report.data)
  }

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

    const anagraficaRisolvibile = operaiAnagrafica.flatMap((operaio) =>
      typeof operaio.id === 'string' &&
      operaio.id.trim() &&
      operaio.nome.trim()
        ? [{
            id: operaio.id,
            nome: operaio.nome,
            costo_orario: operaio.costo_orario,
          }]
        : []
    )
    setMenzioniOperaiRisolte(
      risolviMenzioniOperai(report.menzioniOperai, anagraficaRisolvibile)
    )
    setScelteIdentitaOperai({})
  }

  const creaAttivitaDaPromemoria = (activity: ReminderActivityDraft) => {
    setAttivita((attivitaCorrenti) => {
      const giaPresente = attivitaCorrenti.some(
        (attivita) =>
          attivita.testo.trim().toLowerCase() ===
            activity.testo.trim().toLowerCase() &&
          attivita.dataSuggerita === activity.dataSuggerita &&
          attivita.oraSuggerita === activity.oraSuggerita
      )

      if (giaPresente) return attivitaCorrenti

      return [
        ...attivitaCorrenti,
        {
          id: crypto.randomUUID(),
          testo: activity.testo,
          completata: false,
          origine: activity.origine,
          dataCreazione: new Date().toISOString(),
          dataSuggerita: activity.dataSuggerita,
          oraSuggerita: activity.oraSuggerita,
        },
      ]
    })
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

{!modalitaPortaleOperai && (
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
)}
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
        testo={note}
        onChangeTesto={setNote}
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
        onCreateActivityFromReminder={creaAttivitaDaPromemoria}
      />

      {menzioniOperaiRisolte.length > 0 && (
        <section
          aria-label="Riconoscimento operai"
          style={{ display: 'grid', gap: 10, minWidth: 0 }}
        >
          <h3 style={{ margin: 0, fontSize: 16 }}>Riconoscimento operai</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
            {onApplicaOperaiRiconosciuti
              ? 'Il riconoscimento e la conferma non modificano la squadra. Usa “Applica operai riconosciuti” per applicare le proposte disponibili.'
              : 'Le identità riconosciute o confermate non sono ancora applicate agli operai del rapportino.'}
          </p>
          {menzioniOperaiRisolte.map((risultato, indice) => {
            const chiave = `${indice}:${risultato.menzione.inizio}:${risultato.menzione.fine}`
            const scelta = scelteIdentitaOperai[chiave]
            return (
            <div
              key={chiave}
              style={{
                padding: 12,
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                overflowWrap: 'anywhere',
                background: risultato.stato === 'trovato'
                  ? '#f0fdf4'
                  : risultato.stato === 'ambiguo' ? '#fffbeb' : '#fff',
              }}
            >
              <strong>
                {risultato.stato === 'trovato'
                  ? 'Operaio riconosciuto'
                  : risultato.stato === 'ambiguo' ? 'Da chiarire' : 'Non riconosciuto'}
              </strong>
              <p style={{ margin: '6px 0' }}>
                {risultato.stato === 'trovato'
                  ? risultato.menzione.testo === risultato.operaio.nome
                    ? risultato.operaio.nome
                    : `${risultato.menzione.testo} → ${risultato.operaio.nome}`
                  : risultato.stato === 'ambiguo'
                    ? `Quale operaio intendi con "${risultato.menzione.testo}"?`
                    : `"${risultato.menzione.testo}" non è stato trovato nell'anagrafica.`}
              </p>
              <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>
                {risultato.menzione.ora_inizio && risultato.menzione.ora_fine
                  ? `Orario rilevato: ${risultato.menzione.ora_inizio} - ${risultato.menzione.ora_fine}`
                  : 'Orario non rilevato'}
              </p>
              {risultato.stato === 'ambiguo' && (
                <fieldset style={{ margin: '8px 0 0', padding: 0, border: 0, minWidth: 0 }}>
                  <legend>Possibili per "{risultato.menzione.testo}":</legend>
                  <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
                    {risultato.candidati.map((candidato) => (
                      <label key={candidato.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="radio"
                          name={`${idGruppiIdentita}-${chiave}`}
                          checked={scelta?.tipo === 'candidato' && scelta.operaioId === candidato.id}
                          onChange={() => setScelteIdentitaOperai((correnti) => ({
                            ...correnti,
                            [chiave]: { tipo: 'candidato', operaioId: candidato.id },
                          }))}
                        />
                        {candidato.nome}
                      </label>
                    ))}
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="radio"
                        name={`${idGruppiIdentita}-${chiave}`}
                        checked={scelta?.tipo === 'nessuno'}
                        onChange={() => setScelteIdentitaOperai((correnti) => ({
                          ...correnti,
                          [chiave]: { tipo: 'nessuno' },
                        }))}
                      />
                      Non è nessuno di questi
                    </label>
                  </div>
                </fieldset>
              )}
            </div>
            )
          })}
          {onApplicaOperaiRiconosciuti && proposteOperaiRiconosciuti.length > 0 && (
            <button
              type="button"
              disabled={applicazioneOperaiDisabilitata}
              onClick={() => {
                if (applicazioneOperaiDisabilitata) return
                onApplicaOperaiRiconosciuti(proposteOperaiRiconosciuti)
              }}
              style={{ ...buttonSecondary, justifySelf: 'start' }}
            >
              Applica operai riconosciuti
            </button>
          )}
        </section>
      )}

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
{!modalitaPortaleOperai && (
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
)}
      </section>

      <RapportinoActivities
        attivita={attivita}
        onChangeAttivita={setAttivita}
        buttonSecondary={buttonSecondary}
      />
{!modalitaPortaleOperai && (
  <>
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
 </>
)}
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
         onClick={() => {
  if (modalitaPortaleOperai && onSalvaPortale) {
    void onSalvaPortale()
    return
  }

  void (rapportinoInModifica !== null
    ? aggiornaRapportino()
    : salvaRapportino())
}}
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
