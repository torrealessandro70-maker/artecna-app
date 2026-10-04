'use client'

import { useRef, useState } from 'react'
import RapportinoForm from '../components/RapportinoForm'
import RapportinoPrestazioniEditorV1 from '../components/RapportinoPrestazioniEditorV1'
import { creaBozzaRapportinoV1, ricostruisciBozzaRapportinoV1, type BozzaRapportinoV1 } from '../engines/rapportini/bozzaRapportinoV1'
import { validaRispostaVariantiBozza, type StatoVariantiBozza } from '../engines/rapportini/variantiBozzaV1'
import { bozzaV1Salvabile, creaTentativoSalvataggioV1, esitoCreazioneV1Valido,
  messaggioErroreSalvataggioV1, type TentativoSalvataggioV1 } from '../engines/rapportini/salvataggioBozzaV1'
import type { EsitoSalvataggioRapportino } from '../engines/rapportini/contrattoServizio'
import RapportinoOperaiEditor from '../components/RapportinoOperaiEditor'
import type { OperaioRapportinoInput } from '../types'
import { preparaOperaiRapportino } from '../utils/rapportinoOperai'
import {
  applicaOperaiRiconosciuti,
  type PropostaOperaioRiconosciuto,
} from '../utils/applicaOperaiRiconosciuti'

type OperaioAccesso = {
  id: string
  nome: string
}

type OperaioDisponibile = {
  id: string
  nome: string
  costo_orario?: number
}

type CantiereAccesso = {
  id: string
  nome: string
}

export default function RapportinoOperaiPage() {
  const [bozzaV1, setBozzaV1] = useState<BozzaRapportinoV1 | null>(null)
  const tentativoV1 = useRef<TentativoSalvataggioV1 | null>(null)
  const [retryV1, setRetryV1] = useState(false)
  const [conflittoV1, setConflittoV1] = useState(false)
  const conflittoV1Ref = useRef(false)
  const [salvatoV1, setSalvatoV1] = useState<EsitoSalvataggioRapportino | null>(null)
  const [riletturaV1Fallita, setRiletturaV1Fallita] = useState(false)
  const [variantiBozza, setVariantiBozza] = useState<StatoVariantiBozza>({ cantiere_id: '', stato: 'non_caricate', varianti: [] })
  const cacheVarianti = useRef<StatoVariantiBozza>({ cantiere_id: '', stato: 'non_caricate', varianti: [] })
  const richiestaVarianti = useRef(0)
  const invalidaVarianti = () => {
    richiestaVarianti.current += 1
    cacheVarianti.current = { cantiere_id: '', stato: 'non_caricate', varianti: [] }
    setVariantiBozza(cacheVarianti.current)
  }
  const caricaVarianti = async (cantiere: string, riprova = false) => {
    const cache = cacheVarianti.current
    if (cache.cantiere_id === cantiere && (cache.stato === 'caricamento' || cache.stato === 'pronte' || (cache.stato === 'errore' && !riprova))) return
    const richiesta = ++richiestaVarianti.current
    cacheVarianti.current = { cantiere_id: cantiere, stato: 'caricamento', varianti: [] }
    setVariantiBozza(cacheVarianti.current)
    try {
      const risposta = await fetch('/api/rapportino/varianti', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cantiere_id: cantiere }),
      })
      if (!risposta.ok) throw new Error('Caricamento non riuscito')
      const varianti = validaRispostaVariantiBozza(await risposta.json())
      if (richiesta !== richiestaVarianti.current) return
      cacheVarianti.current = { cantiere_id: cantiere, stato: 'pronte', varianti }
    } catch {
      if (richiesta !== richiestaVarianti.current) return
      cacheVarianti.current = { cantiere_id: cantiere, stato: 'errore', varianti: [] }
    }
    setVariantiBozza(cacheVarianti.current)
  }
  const [pin, setPin] = useState('')
  const [operaio, setOperaio] = useState<OperaioAccesso | null>(null)
const [fotoRapportino, setFotoRapportino] = useState<string[]>([])
  const [cantieri, setCantieri] = useState<CantiereAccesso[]>([])
  const [operaiDisponibili, setOperaiDisponibili] =
    useState<OperaioDisponibile[]>([])
  const [operaiRapportino, setOperaiRapportino] =
    useState<OperaioRapportinoInput[]>([])
const [rapportinoEsistente, setRapportinoEsistente] = useState<any>(null)
const [timbratureRapportino, setTimbratureRapportino] = useState<any[]>([])

  const [cantiereId, setCantiereId] = useState('')
  const [cantiereSelezionato, setCantiereSelezionato] =
    useState<CantiereAccesso | null>(null)

  const [statoRapportino, setStatoRapportino] = useState<{
  cantiereId: string
  richiesta: number
  data: string
  presente: boolean
  versionePrestazioni: null | 0 | 1
  rapportinoId?: string
  revisione?: number
} | null>(null)
const [dataRapportino, setDataRapportino] = useState('')
  const richiestaStato = useRef(0)
  const controlloInCorso = useRef(false)
  const salvataggioInCorso = useRef(false)
  const [salvataggioAttivo, setSalvataggioAttivo] = useState(false)
  const [messaggioSalvataggio, setMessaggioSalvataggio] = useState('')
  const dataLeggibile = (data: string) => data.split('-').reverse().join('/')
  const [errore, setErrore] = useState('')
  const [accessoInCorso, setAccessoInCorso] = useState(false)
  const [statoInCorso, setStatoInCorso] = useState(false)
  const [mostraForm, setMostraForm] = useState(false)
  const [messaggioApplicazioneOperai, setMessaggioApplicazioneOperai] = useState('')
const [note, setNote] = useState('')
const [materiali, setMateriali] = useState('')
const [quantitaMateriali, setQuantitaMateriali] = useState('')
const [costoMateriali, setCostoMateriali] = useState('')
const [fotoRapportinoAperte, setFotoRapportinoAperte] = useState<any[]>([])
const operaiRapportinoPreparati = preparaOperaiRapportino(operaiRapportino)
  .sort((a, b) =>
    operaiDisponibili.findIndex((item) => item.id === a.id) -
    operaiDisponibili.findIndex((item) => item.id === b.id)
  )


  const applicaProposteOperaiRiconosciuti = (
    proposte: readonly PropostaOperaioRiconosciuto[]
  ) => {
    if (statoInCorso) return
    const anagrafica = operaiDisponibili.map(({ id, nome, costo_orario }) => ({
      id, nome, costo_orario,
    }))
    const risultato = applicaOperaiRiconosciuti(operaiRapportino, proposte, anagrafica)
    setOperaiRapportino(risultato.operai)
    const daVerificare = risultato.esiti.some((esito) =>
      esito.stato === 'conflitto' || esito.stato === 'escluso' || esito.orariDaCompletare
    )
    setMessaggioApplicazioneOperai(daVerificare
      ? 'Applicazione completata con elementi da verificare: controlla gli operai e gli orari. I conflitti non sono stati applicati.'
      : 'Operai riconosciuti applicati.')
  }

  const accedi = async () => {
    const pinPulito = pin.trim()

    if (!pinPulito || accessoInCorso) return

    setErrore('')
    setAccessoInCorso(true)

    try {
      const risposta = await fetch('/api/rapportino/accesso', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
  pin: pinPulito,
}),
      })

      const risultato = await risposta.json()

      if (!risposta.ok) {
        setErrore(risultato?.error || 'Accesso non riuscito')
        return
      }

      setOperaio(risultato.operaio)
      setOperaiDisponibili(
        (Array.isArray(risultato.operai) ? risultato.operai : []).filter(
          (item: OperaioDisponibile) =>
            typeof item?.id === 'string' && item.id.trim().length > 0
        )
      )
      setCantieri(risultato.cantieri || [])

      setCantiereId('')
      setCantiereSelezionato(null)
      setStatoRapportino(null)
      setOperaiRapportino([])
      setMostraForm(false)
      setPin('')
    } catch {
      setErrore('Connessione non disponibile')
    } finally {
      setAccessoInCorso(false)
    }
  }

  const invalidaRapportino = () => {
    tentativoV1.current = null
    setRetryV1(false)
    setConflittoV1(false)
    conflittoV1Ref.current = false
    setSalvatoV1(null)
    setRiletturaV1Fallita(false)
    setBozzaV1(null)
    richiestaStato.current += 1
    controlloInCorso.current = false
    setStatoInCorso(false)
    setStatoRapportino(null)
    setRapportinoEsistente(null)
    setTimbratureRapportino([])
    setMostraForm(false)
    setOperaiRapportino([])
    setNote('')
    setMateriali('')
    setQuantitaMateriali('')
    setCostoMateriali('')
    setFotoRapportino([])
    setFotoRapportinoAperte([])
    setMessaggioApplicazioneOperai('')
  }

  const controllaRapportino = async (cantiere: CantiereAccesso, data: string) => {
    invalidaRapportino()
    const richiesta = richiestaStato.current
    controlloInCorso.current = true
    setStatoInCorso(true)
    setErrore('')
    try {
      const risposta = await fetch('/api/rapportino/stato', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cantiereId: cantiere.id, data: data || undefined }),
      })
      const risultato = await risposta.json()
      if (richiesta !== richiestaStato.current) return
      if (!risposta.ok) {
        setErrore(risultato?.error || 'Impossibile controllare il rapportino')
        return
      }
      if (!risultato.data || (data && risultato.data !== data)
        || (risultato.rapportino && risultato.rapportino.data !== risultato.data)) {
        setErrore('Data del Rapportino non coerente: ripeti il controllo')
        return
      }
      const versione = risultato.versione_prestazioni
      if (!((versione === null && risultato.presente === false && risultato.rapportino === null)
        || ((versione === 0 || versione === 1) && risultato.presente === true && risultato.rapportino?.id))) {
        setErrore('Stato del Rapportino non valido: ripeti il controllo')
        return
      }
      if (versione === 1 && (!esitoCreazioneV1Valido(risultato.strutturato, { cantiere_id: cantiere.id, data: risultato.data,
        rapportino_id: risultato.rapportino.id }) || risultato.strutturato.rapportino_id !== risultato.rapportino.id)) {
        setErrore('Dettaglio strutturato non valido: ripeti il controllo')
        return
      }
      setSalvatoV1(versione === 1 ? risultato.strutturato : null)
      setDataRapportino(risultato.data)
      setCantiereSelezionato(cantiere)
      setStatoRapportino({
        cantiereId: cantiere.id, richiesta, data: risultato.data,
        presente: Boolean(risultato.presente),
        versionePrestazioni: versione,
        rapportinoId: risultato.rapportino?.id ? String(risultato.rapportino.id) : undefined,
        revisione: versione === 1 ? risultato.strutturato.revisione : undefined,
      })
      setRapportinoEsistente(versione === 0 ? risultato.rapportino : null)
      setTimbratureRapportino(versione === 0 && Array.isArray(risultato.timbrature) ? risultato.timbrature : [])
    } catch {
      if (richiesta === richiestaStato.current) setErrore('Connessione non disponibile')
    } finally {
      if (richiesta === richiestaStato.current) {
        controlloInCorso.current = false
        setStatoInCorso(false)
      }
    }
  }

  const rileggiSalvatoV1 = async (salvato: EsitoSalvataggioRapportino, contesto: number) => {
    if (contesto !== richiestaStato.current) return
    controlloInCorso.current = true
    setStatoInCorso(true)
    setErrore('')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const risposta = await fetch('/api/rapportino/stato', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cantiereId: salvato.cantiere_id, data: salvato.data, rapportinoId: salvato.rapportino_id }),
        signal: controller.signal,
      })
      const risultato = await risposta.json()
      if (contesto !== richiestaStato.current) return
      if (!risposta.ok || risultato.presente !== true || risultato.versione_prestazioni !== 1
        || risultato.data !== salvato.data || risultato.rapportino?.id !== salvato.rapportino_id
        || risultato.rapportino?.data !== salvato.data || !Array.isArray(risultato.timbrature) || risultato.timbrature.length
        || !esitoCreazioneV1Valido(risultato.strutturato, salvato)
        || risultato.strutturato.rapportino_id !== salvato.rapportino_id
        || risultato.strutturato.revisione < salvato.revisione) throw new Error('Rilettura non valida')
      contesto = ++richiestaStato.current
      tentativoV1.current = null
      setRetryV1(false)
      conflittoV1Ref.current = false
      setConflittoV1(false)
      setMostraForm(false)
      setStatoRapportino({ cantiereId: salvato.cantiere_id, data: salvato.data, richiesta: contesto,
        presente: true, versionePrestazioni: 1, rapportinoId: salvato.rapportino_id,
        revisione: risultato.strutturato.revisione })
      setSalvatoV1(risultato.strutturato)
      setBozzaV1(ricostruisciBozzaRapportinoV1(risultato.strutturato))
      setRiletturaV1Fallita(false)
    } catch {
      if (contesto !== richiestaStato.current) return
      setRiletturaV1Fallita(true)
      setErrore('Rapportino salvato. Impossibile aggiornare la visualizzazione. Ripeti il controllo.')
    } finally {
      clearTimeout(timeout)
      if (contesto === richiestaStato.current) {
        controlloInCorso.current = false
        setStatoInCorso(false)
      }
    }
  }

  const salvaBozzaV1 = async (retry = false) => {
    if (salvataggioInCorso.current || controlloInCorso.current || conflittoV1Ref.current || riletturaV1Fallita
      || !operaio || !bozzaV1 || !statoRapportino || statoRapportino.versionePrestazioni === 0
      || (statoRapportino.versionePrestazioni === null ? bozzaV1.rapportino_id !== null || statoRapportino.presente
        : bozzaV1.rapportino_id !== statoRapportino.rapportinoId || bozzaV1.revisione_attesa !== statoRapportino.revisione)
      || statoRapportino.richiesta !== richiestaStato.current
      || statoRapportino.cantiereId !== cantiereId || cantiereSelezionato?.id !== cantiereId
      || bozzaV1.cantiere_id !== cantiereId || bozzaV1.data !== dataRapportino
      || statoRapportino.data !== dataRapportino) return
    let tentativo = tentativoV1.current
    if (retry) {
      if (!tentativo || tentativo.cantiere_id !== cantiereId || tentativo.data !== dataRapportino) return
    } else {
      if (tentativo || !bozzaV1Salvabile(bozzaV1, cacheVarianti.current)
        || bozzaV1.prestazioni.nuove.some(p => !operaiDisponibili.some(o => o.id === p.operaio_id))) return
      tentativo = creaTentativoSalvataggioV1(bozzaV1, cacheVarianti.current, () => crypto.randomUUID())
      tentativoV1.current = tentativo
    }
    const contesto = richiestaStato.current
    salvataggioInCorso.current = true
    setSalvataggioAttivo(true)
    setRetryV1(false)
    setErrore('')
    setMessaggioSalvataggio('')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const risposta = await fetch('/api/rapportino/strutturato', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: tentativo!.corpo, signal: controller.signal,
      })
      if (contesto !== richiestaStato.current) return
      if (!risposta.ok) {
        // Il writer sanitizza 22023 in HTTP 400: il cambio stato Variante non è distinguibile dagli altri input invalidi.
        const economiaDaAggiornare = risposta.status === 400 && [...tentativo!.payload.prestazioni.nuove,
          ...tentativo!.payload.prestazioni.aggiornate].some(p => p.lavoro_in_economia)
        setErrore(messaggioErroreSalvataggioV1(risposta.status)
          + (economiaDaAggiornare ? ' Per Economia aggiorna stato e varianti prima di riprovare.' : ''))
        if (risposta.status === 409 || economiaDaAggiornare) {
          conflittoV1Ref.current = true
          setConflittoV1(true)
          tentativoV1.current = null
          invalidaVarianti()
        } else if ([400, 401, 403].includes(risposta.status)) {
          tentativoV1.current = null
        } else setRetryV1(true)
        return
      }
      const risultato: unknown = await risposta.json()
      if (contesto !== richiestaStato.current) return
      if (!esitoCreazioneV1Valido(risultato, { ...tentativo!, rapportino_id: tentativo!.payload.rapportino_id })
        || (tentativo!.payload.revisione_attesa !== null && risultato.revisione < tentativo!.payload.revisione_attesa)) throw new Error('Risposta non valida')
      clearTimeout(timeout)
      // Il contesto confermato rende obsolete tutte le callback della bozza assente.
      const contestoSalvato = ++richiestaStato.current
      tentativoV1.current = null
      setSalvatoV1(risultato)
      setBozzaV1(null)
      setMostraForm(false)
      setStatoRapportino({ cantiereId: risultato.cantiere_id, data: risultato.data, richiesta: contestoSalvato,
        presente: true, versionePrestazioni: 1, rapportinoId: risultato.rapportino_id, revisione: risultato.revisione })
      setMessaggioSalvataggio('Rapportino del ' + dataLeggibile(risultato.data) + ' salvato')
      await rileggiSalvatoV1(risultato, contestoSalvato)
    } catch {
      if (contesto !== richiestaStato.current) return
      setErrore(messaggioErroreSalvataggioV1(503))
      setRetryV1(true)
    } finally {
      clearTimeout(timeout)
      salvataggioInCorso.current = false
      setSalvataggioAttivo(false)
    }
  }

  const continua = async () => {
    if (!cantiereId || salvataggioInCorso.current) return
    const cantiere = cantieri.find(item => item.id === cantiereId)
    if (!cantiere) { setErrore('Cantiere non valido'); return }
    if (salvatoV1 && !conflittoV1Ref.current && salvatoV1.cantiere_id === cantiereId && salvatoV1.data === dataRapportino) {
      if (controlloInCorso.current || statoRapportino?.richiesta !== richiestaStato.current) return
      await rileggiSalvatoV1(salvatoV1, statoRapportino.richiesta)
      return
    }
    setMessaggioSalvataggio('')
    setCantiereSelezionato(cantiere)
    await controllaRapportino(cantiere, dataRapportino)
  }

  const cambiaDataRapportino = (nuovaData: string) => {
    if (salvataggioInCorso.current) return
    setDataRapportino(nuovaData)
    setMessaggioSalvataggio('')
    setErrore('')
    invalidaRapportino()
    const cantiere = cantieri.find(item => item.id === cantiereId)
    if (cantiere && nuovaData) void controllaRapportino(cantiere, nuovaData)
  }

const salvaRapportinoPortale = async () => {
  if (statoRapportino?.versionePrestazioni !== 0) {
    setErrore('Rapportino strutturato presente: modifica mobile non ancora disponibile')
    return
  }
  if (salvataggioInCorso.current || controlloInCorso.current || statoInCorso
    || !statoRapportino || statoRapportino.data !== dataRapportino
    || statoRapportino.richiesta !== richiestaStato.current
    || statoRapportino.cantiereId !== cantiereId
    || cantiereSelezionato?.id !== cantiereId) {
    setErrore('Attendi un controllo valido per il cantiere e la data selezionati')
    return
  }
if (!operaio || !cantiereSelezionato || !dataRapportino) {
  setErrore('Operaio, cantiere e data sono obbligatori')
  return
}
  const operaiValidi = operaiRapportinoPreparati.filter(
    (operaio) => operaio.nome && operaio.ore > 0
  )

 if (operaiValidi.length === 0) {

  setErrore('Inserisci gli orari di almeno un operaio')
  return
}

 const dataSalvata = dataRapportino
 const cantiereSalvato = cantiereSelezionato
 const contestoSalvataggio = richiestaStato.current
 salvataggioInCorso.current = true
 setSalvataggioAttivo(true)
 setMessaggioSalvataggio('')
 setErrore('')
setStatoInCorso(true)

try {
    const risposta = await fetch('/api/rapportino/salva', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cantiereId: cantiereSelezionato.id,
rapportinoId: statoRapportino?.rapportinoId || undefined,
compilatoDaOperaioId: operaio.id,
compilatoDaNome: operaio.nome,
        data: dataSalvata,
        note,
        materiali,
        quantitaMateriali,
        operai: operaiValidi.map(({ id, nome, ora_inizio, ora_fine, pausa_minuti, ore }) => ({
          id, nome, ora_inizio, ora_fine, pausa_minuti, ore,
        })),
        foto: fotoRapportino,
      }),
    })

const testoRisposta = await risposta.text()

let risultato: any = {}

try {
  risultato = testoRisposta
    ? JSON.parse(testoRisposta)
    : {}
} catch {
  risultato = {
    error: testoRisposta || `Errore HTTP ${risposta.status}`,
  }
}

    

  if (!risposta.ok) {
  setErrore(
    `Errore ${risposta.status}: ` +
      (risultato?.error || 'Salvataggio rapportino non riuscito')
  )
  return
}

    if (contestoSalvataggio !== richiestaStato.current) return
    if (risultato.rapportino?.data !== dataSalvata) {
      invalidaRapportino()
      setErrore('Data salvata non coerente: ripeti il controllo')
      return
    }
    setDataRapportino(dataSalvata)
    setMessaggioSalvataggio('Rapportino del ' + dataLeggibile(dataSalvata) + ' salvato')
    await controllaRapportino(cantiereSalvato, dataSalvata)
  } catch {
    setErrore('Connessione non disponibile')
  } finally {
    salvataggioInCorso.current = false
    setSalvataggioAttivo(false)
    setStatoInCorso(false)
  }
}

  const esci = () => {
    if (salvataggioInCorso.current) return
    invalidaVarianti()
    invalidaRapportino()
    setMessaggioSalvataggio('')
    setOperaio(null)
    setCantieri([])
    setOperaiDisponibili([])
    setOperaiRapportino([])
    setCantiereId('')
    setCantiereSelezionato(null)
    setStatoRapportino(null)
    setMostraForm(false)
    setPin('')
    setErrore('')
setNote('')
setMateriali('')
setQuantitaMateriali('')
setCostoMateriali('')
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          margin: '0 auto',
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          padding: 20,
          boxSizing: 'border-box',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 26 }}>
          Rapportino giornaliero
        </h1>

        <p style={{ color: '#64748b', marginTop: 8 }}>
          Portale operai ARTECNA
        </p>

        {!operaio ? (
          <div style={{ display: 'grid', gap: 12, marginTop: 24 }}>
            <label style={{ fontWeight: 700 }}>
              PIN operaio
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void accedi()
                  }
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  marginTop: 6,
                  padding: 12,
                  fontSize: 18,
                  border: '1px solid #cbd5e1',
                  borderRadius: 10,
                }}
              />
            </label>

            {errore && (
              <div
                role="alert"
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: '#fef2f2',
                  color: '#991b1b',
                }}
              >
                {errore}
              </div>
            )}

            <button
              type="button"
              disabled={!pin.trim() || accessoInCorso}
              onClick={() => void accedi()}
              style={{
                minHeight: 48,
                border: 0,
                borderRadius: 10,
                background: '#2563eb',
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                cursor: accessoInCorso ? 'wait' : 'pointer',
                opacity: !pin.trim() || accessoInCorso ? 0.6 : 1,
              }}
            >
              {accessoInCorso ? 'Accesso...' : 'Accedi'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
            <div
              style={{
                padding: 14,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 10,
              }}
            >
{errore && (
  <div
    role="alert"
    style={{
      padding: 12,
      borderRadius: 8,
      background: '#fef2f2',
      border: '1px solid #fecaca',
      color: '#991b1b',
      fontWeight: 600,
    }}
  >
    {errore}
  </div>
)}
              <strong>{operaio.nome}</strong>
              <div style={{ color: '#166534', marginTop: 4 }}>
                Accesso effettuato
              </div>
            </div>

            <label style={{ fontWeight: 700 }}>
              Cantiere
              <select
                value={cantiereId}
                disabled={salvataggioAttivo}
                onChange={(event) => {
                  if (salvataggioInCorso.current) return
                  invalidaVarianti()
                  invalidaRapportino()
                  setCantiereId(event.target.value)
                  setCantiereSelezionato(null)
                  setMessaggioSalvataggio('')
                  setErrore('')
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  marginTop: 6,
                  padding: 12,
                  minHeight: 48,
                  border: '1px solid #cbd5e1',
                  borderRadius: 10,
                  background: '#fff',
                  fontSize: 16,
                }}
              >
                <option value="">Seleziona cantiere...</option>

                {cantieri.map((cantiere) => (
                  <option key={cantiere.id} value={cantiere.id}>
                    {cantiere.nome}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontWeight: 700 }}>
              Data del Rapportino
              <input type="date" value={dataRapportino} disabled={salvataggioAttivo}
                onChange={event => cambiaDataRapportino(event.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 6, padding: 12, boxSizing: 'border-box' }} />
            </label>
            {messaggioSalvataggio && <p role="status">{messaggioSalvataggio}</p>}
            {riletturaV1Fallita && salvatoV1 && <button type="button" disabled={statoInCorso || salvataggioAttivo}
              onClick={() => { if (!controlloInCorso.current && !salvataggioInCorso.current && statoRapportino?.richiesta === richiestaStato.current)
                void rileggiSalvatoV1(salvatoV1, statoRapportino.richiesta) }}>
              Ripeti controllo Rapportino
            </button>}
           <button
  type="button"
  disabled={!cantiereId || statoInCorso || salvataggioAttivo}
  onClick={() => void continua()}
  style={{
    minHeight: 48,
    border: 0,
    borderRadius: 10,
    background: '#2563eb',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    opacity: cantiereId && !statoInCorso ? 1 : 0.6,
  }}
>
  {statoInCorso ? 'Controllo...' : 'Continua'}
</button>
{cantiereSelezionato && statoRapportino && (
  <div
    style={{
      padding: 16,
      borderRadius: 10,
      border: statoRapportino.presente
        ? '1px solid #bbf7d0'
        : '1px solid #fde68a',
      background: statoRapportino.presente
        ? '#f0fdf4'
        : '#fffbeb',
    }}
  >
    <strong>{cantiereSelezionato.nome}</strong>

    <div
      style={{
        marginTop: 8,
        fontWeight: 700,
        color: statoRapportino.presente
          ? '#166534'
          : '#92400e',
      }}
    >
      {statoRapportino.versionePrestazioni === 1
        ? 'Rapportino del ' + dataLeggibile(statoRapportino.data) + ' strutturato presente'
        : statoRapportino.presente
        ? 'Rapportino del ' + dataLeggibile(statoRapportino.data) + ' già inviato'
        : 'Rapportino del ' + dataLeggibile(statoRapportino.data) + ' non ancora inviato'}
    </div>

    {!statoRapportino.presente && !mostraForm && (
      <button
        type="button"
        onClick={() => {
  setBozzaV1(corrente => corrente && corrente.cantiere_id === statoRapportino.cantiereId && corrente.data === statoRapportino.data
    ? corrente : creaBozzaRapportinoV1(statoRapportino.cantiereId, statoRapportino.data))
  setMostraForm(true)
}}
        style={{
          width: '100%',
          minHeight: 48,
          marginTop: 14,
          border: 0,
          borderRadius: 10,
          background: '#2563eb',
          color: '#fff',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Compila rapportino
      </button>
    )}
  </div>
)}

{statoRapportino &&
  statoRapportino.versionePrestazioni === 1 && salvatoV1 && !mostraForm && (
  <button type="button" disabled={statoInCorso || salvataggioAttivo || riletturaV1Fallita}
    onClick={() => {
      if (controlloInCorso.current || salvataggioInCorso.current || riletturaV1Fallita
        || statoRapportino.richiesta !== richiestaStato.current || salvatoV1.rapportino_id !== statoRapportino.rapportinoId) return
      setBozzaV1(corrente => corrente?.rapportino_id === salvatoV1.rapportino_id && corrente.revisione_attesa === salvatoV1.revisione
        ? corrente : ricostruisciBozzaRapportinoV1(salvatoV1))
      setMostraForm(true)
      void caricaVarianti(statoRapportino.cantiereId)
    }} style={{ minHeight: 44, padding: 12 }}>
    Apri / Modifica
  </button>
)}
{statoRapportino &&
  statoRapportino.presente &&
  statoRapportino.versionePrestazioni === 0 &&
  statoRapportino.rapportinoId &&
  !mostraForm && (
    <button
      type="button"
     onClick={() => {
  if (!rapportinoEsistente || statoRapportino.versionePrestazioni !== 0) return

  setNote(String(rapportinoEsistente.note || ''))
  setMateriali(String(rapportinoEsistente.materiali || ''))
  setQuantitaMateriali(
    String(rapportinoEsistente.quantita_materiali || '')
  )
const operaiRicostruiti: OperaioRapportinoInput[] = []

timbratureRapportino.forEach((timbratura) => {
  const operaioId = String(timbratura.operaio_id || '').trim()
  if (!operaioId) return

  const item = operaiDisponibili.find(
    (disponibile) => disponibile.id === operaioId
  )
  if (!item) return

  if (operaiRicostruiti.some((operaio) => operaio.id === item.id)) {
    return
  }

  operaiRicostruiti.push({
    id: item.id,
    nome: item.nome,
    ora_inizio: timbratura.ora_entrata || '',
    ora_fine: timbratura.ora_uscita || '',
    pausa_minuti: 0,
    costo_orario: item.costo_orario,
  })
})
setOperaiRapportino(operaiRicostruiti)
  setMessaggioApplicazioneOperai('')
  setMostraForm(true)
}}
      style={{
        width: '100%',
        minHeight: 48,
        marginTop: 14,
        border: 0,
        borderRadius: 10,
        background: '#2563eb',
        color: '#fff',
        fontSize: 16,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      Apri / Modifica rapportino
    </button>
  )}

{mostraForm && cantiereSelezionato && statoRapportino && statoRapportino.versionePrestazioni !== 0 && bozzaV1 && (
  <RapportinoPrestazioniEditorV1 bozza={bozzaV1} operai={operaiDisponibili}
    disabled={statoInCorso || salvataggioAttivo}
    salvataggioInCorso={salvataggioAttivo}
    salvabile={!conflittoV1 && !riletturaV1Fallita && bozzaV1Salvabile(bozzaV1, variantiBozza)
      && bozzaV1.prestazioni.nuove.every(p => operaiDisponibili.some(o => o.id === p.operaio_id))}
    retryDisponibile={retryV1}
    onSalva={() => { void salvaBozzaV1() }}
    onRetry={() => { void salvaBozzaV1(true) }}
    varianti={variantiBozza}
    onRichiediVarianti={() => {
      if (!conflittoV1Ref.current && !salvataggioInCorso.current && !controlloInCorso.current
        && richiestaStato.current === statoRapportino.richiesta)
        void caricaVarianti(statoRapportino.cantiereId)
    }}
    onRiprovaVarianti={() => {
      if (!salvataggioInCorso.current && !controlloInCorso.current && richiestaStato.current === statoRapportino.richiesta)
        void caricaVarianti(statoRapportino.cantiereId, true)
    }}
    onChange={nuova => {
      if (salvataggioInCorso.current || controlloInCorso.current || richiestaStato.current !== statoRapportino.richiesta
        || nuova.cantiere_id !== statoRapportino.cantiereId || nuova.data !== statoRapportino.data) return
      tentativoV1.current = null
      setRetryV1(false)
      setBozzaV1(nuova)
      if (!conflittoV1Ref.current && nuova.prestazioni.nuove.some(p => p.lavoro_in_economia)) void caricaVarianti(nuova.cantiere_id)
    }} onClose={() => { if (!salvataggioInCorso.current) setMostraForm(false) }} />
)}
{conflittoV1 && <button type="button" disabled={statoInCorso || salvataggioAttivo}
  onClick={() => { if (!salvataggioInCorso.current && !controlloInCorso.current) void continua() }}>
  Aggiorna stato e varianti
</button>}
{mostraForm &&
  cantiereSelezionato &&
  statoRapportino && statoRapportino.versionePrestazioni === 0 && (
    <section
      style={{
        display: 'grid',
        gap: 14,
        padding: 16,
        border: '1px solid #cbd5e1',
        borderRadius: 12,
        background: '#fff',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 13,
            color: '#64748b',
          }}
        >
          Cantiere
        </div>
        <strong>{cantiereSelezionato.nome}</strong>
      </div>

      <div>
        <div
          style={{
            fontSize: 13,
            color: '#64748b',
          }}
        >
          Data
        </div>
        <strong>{statoRapportino.data}</strong>
      </div>

      <div>
        <div
          style={{
            fontSize: 13,
            color: '#64748b',
          }}
        >
          Compilato da
        </div>
        <strong>{operaio.nome}</strong>
      </div>
<RapportinoOperaiEditor
  operaiDisponibili={operaiDisponibili}
  value={operaiRapportino}
  onChange={setOperaiRapportino}
  disabled={statoInCorso}
/>
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
  <strong>Foto del lavoro</strong>

  <input
    type="file"
    accept="image/*"
    capture="environment"
    multiple
    onChange={(event) => {
      const files = Array.from(event.target.files || [])

      files.forEach((file) => {
        const reader = new FileReader()

        reader.onload = () => {
          if (typeof reader.result !== 'string') return

          setFotoRapportino((correnti) => [
            ...correnti,
            reader.result as string,
          ])
        }

        reader.readAsDataURL(file)
      })

      event.target.value = ''
    }}
  />

  {fotoRapportino.length > 0 && (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
      }}
    >
      {fotoRapportino.map((foto, indice) => (
        <div key={indice} style={{ position: 'relative' }}>
          <img
            src={foto}
            alt={`Foto ${indice + 1}`}
            style={{
              width: '100%',
              aspectRatio: '1',
              objectFit: 'cover',
              borderRadius: 8,
            }}
          />

          <button
            type="button"
            onClick={() =>
              setFotoRapportino((correnti) =>
                correnti.filter((_, i) => i !== indice)
              )
            }
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: 0,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )}
</section>
<RapportinoForm
  cantiereRapporto={cantiereSelezionato.nome}
  setCantiereRapporto={() => {}}
data={dataRapportino}
setData={cambiaDataRapportino}

  note={note}
  setNote={setNote}
  materiali={materiali}
  setMateriali={setMateriali}
  quantitaMateriali={quantitaMateriali}
  setQuantitaMateriali={setQuantitaMateriali}
  costoMateriali={costoMateriali}
  setCostoMateriali={setCostoMateriali}
  salvaRapportino={() => {}}
  aggiornaRapportino={() => {}}
  rapportinoInModifica={
  statoRapportino?.presente && statoRapportino.rapportinoId
    ? statoRapportino.rapportinoId
    : null
}
  cantieri={cantieri}
  inputStyle={{}}
  buttonPrimary={{}}
  buttonSecondary={{}}
  ascoltoRapportino={false}
  operaiAnagrafica={operaiDisponibili}
  operaiRapportinoTemp={operaiRapportinoPreparati.map((item) => ({
    nome: item.nome,
    ora_inizio: item.ora_inizio,
    ora_fine: item.ora_fine,
    ore: item.ore,
    costo_orario: 0,
  }))}
  setOperaiRapportinoTemp={() => {}}
  setPopupFotoRapportino={() => {}}
  fotoCantiere={[]}
  setFotoRapportinoAperte={setFotoRapportinoAperte}
  onClose={() => setMostraForm(false)}
  modalitaPortaleOperai
  salvataggioPortaleDisabilitato={statoInCorso || salvataggioAttivo}
  onSalvaPortale={salvaRapportinoPortale}
  onApplicaOperaiRiconosciuti={applicaProposteOperaiRiconosciuti}
  applicazioneOperaiDisabilitata={statoInCorso}
/>
{messaggioApplicazioneOperai && (
  <p role="status" style={{ margin: '12px 0', color: '#475569' }}>
    {messaggioApplicazioneOperai}
  </p>
)}

      <div
        style={{
          padding: 14,
          borderRadius: 10,
          background: '#f8fafc',
          color: '#475569',
        }}
      >
        Nel prossimo passaggio inseriremo operai presenti,
        orari, lavori eseguiti, materiali e foto.
      </div>

      <button
        type="button"
        onClick={() => setMostraForm(false)}
        style={{
          minHeight: 44,
          border: '1px solid #cbd5e1',
          borderRadius: 10,
          background: '#fff',
          fontWeight: 700,
        }}
      >
        Chiudi
      </button>
    </section>
 )}
            <button
              type="button"
              disabled={salvataggioAttivo}
              onClick={esci}
              style={{
                minHeight: 44,
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                background: '#fff',
                fontWeight: 700,
              }}
            >
              Cambia operaio
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
