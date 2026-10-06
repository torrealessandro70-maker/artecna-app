'use client'

import { useRef, useState, type ComponentProps, type Dispatch, type SetStateAction, type RefObject } from 'react'
import type RapportinoPrestazioniEditorV1 from '../../components/RapportinoPrestazioniEditorV1'
import { creaBozzaRapportinoV1, ricostruisciBozzaRapportinoV1, type BozzaRapportinoV1 } from './bozzaRapportinoV1'
import { validaRispostaVariantiBozza, type StatoVariantiBozza } from './variantiBozzaV1'
import { bozzaV1Salvabile, creaTentativoSalvataggioV1, esitoCreazioneV1Valido,
  messaggioErroreSalvataggioV1, type TentativoSalvataggioV1 } from './salvataggioBozzaV1'
import type { EsitoSalvataggioRapportino } from './contrattoServizio'
import type { TrasportoRapportinoV1 } from './trasportoRapportinoV1'
import { creaBozzaRapportinoV2, ricostruisciBozzaRapportinoV2, vistaPrestazioniV1 } from './materialiBozzaV1'
import { letturaMaterialiValida } from './validaLetturaMateriali'
import { esitoCreazioneV2Valido } from './salvataggioBozzaV1'
import type { DettaglioRapportinoV2 } from './contrattoMaterialiRapportino'

export type StatoContestoRapportino = {
  cantiereId: string; richiesta: number; data: string; presente: boolean
  versionePrestazioni: null | 0 | 1; rapportinoId?: string; revisione?: number
}
type Setter<T> = Dispatch<SetStateAction<T>>
type Contesto = {
  autorizzato: boolean; cantiereId: string; cantiereSelezionatoId?: string; dataRapportino: string
  operaiDisponibili: readonly { id: string; nome: string }[]
  statoRapportino: StatoContestoRapportino | null
  richiestaStato: RefObject<number>; controlloInCorso: RefObject<boolean>; salvataggioInCorso: RefObject<boolean>
  statoInCorso: boolean; salvataggioAttivo: boolean
  setStatoRapportino: Setter<StatoContestoRapportino | null>; setStatoInCorso: Setter<boolean>
  setSalvataggioAttivo: Setter<boolean>; setMostraForm: Setter<boolean>
  setErrore: Setter<string>; setMessaggioSalvataggio: Setter<string>
}

/** Orchestrazione V1; identità, selettori esterni e compatibilità V0 appartengono al wrapper. */
export function useCoordinatoreRapportinoV1(contesto: Contesto, trasporto: TrasportoRapportinoV1, opzioni: { materiali?: boolean } = {}) {
  const materialiAbilitati = opzioni.materiali === true
  const dettaglioV2 = useRef<DettaglioRapportinoV2 | null>(null)
  const { autorizzato, cantiereId, cantiereSelezionatoId, dataRapportino, operaiDisponibili,
    statoRapportino, richiestaStato, controlloInCorso, salvataggioInCorso, statoInCorso, salvataggioAttivo,
    setStatoRapportino, setStatoInCorso, setSalvataggioAttivo, setMostraForm, setErrore, setMessaggioSalvataggio } = contesto
  const dataLeggibile = (data: string) => data.split('-').reverse().join('/')
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
      const risposta = await trasporto.caricaVarianti(cantiere)
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
  const rileggiSalvatoV1 = async (salvato: EsitoSalvataggioRapportino, contesto: number) => {
    if (contesto !== richiestaStato.current) return
    controlloInCorso.current = true
    setStatoInCorso(true)
    setErrore('')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const input = { cantiere_id: salvato.cantiere_id, data: salvato.data, rapportino_id: salvato.rapportino_id }
      if (materialiAbilitati && !trasporto.leggiStatoV2) throw new Error('Lettura materiali non disponibile')
      const risposta = await (materialiAbilitati ? trasporto.leggiStatoV2! : trasporto.leggiStato)(input, controller.signal)
      let risultato = await risposta.json()
      if (contesto !== richiestaStato.current) return
      let lettoV2: DettaglioRapportinoV2 | null = null
      if (materialiAbilitati) {
        if (!letturaMaterialiValida(risultato, input) || risultato.versione_prestazioni !== 1) throw new Error('Rilettura non valida')
        lettoV2 = risultato.dettaglio
        risultato = { presente: true, versione_prestazioni: 1, data: lettoV2.data,
          rapportino: { id: lettoV2.rapportino_id, data: lettoV2.data }, timbrature: [], strutturato: vistaPrestazioniV1(lettoV2) }
      }
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
      dettaglioV2.current = lettoV2
      setBozzaV1(lettoV2 ? ricostruisciBozzaRapportinoV2(lettoV2) : ricostruisciBozzaRapportinoV1(risultato.strutturato))
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
    if (materialiAbilitati && !trasporto.leggiStatoV2) return
    if (bozzaV1?.materialiStrutturati?.versione_materiali === 1 && !materialiAbilitati) return
    if (salvataggioInCorso.current || controlloInCorso.current || conflittoV1Ref.current || riletturaV1Fallita
      || !autorizzato || !bozzaV1 || !statoRapportino || statoRapportino.versionePrestazioni === 0
      || (statoRapportino.versionePrestazioni === null ? bozzaV1.rapportino_id !== null || statoRapportino.presente
        : bozzaV1.rapportino_id !== statoRapportino.rapportinoId || bozzaV1.revisione_attesa !== statoRapportino.revisione)
      || statoRapportino.richiesta !== richiestaStato.current
      || statoRapportino.cantiereId !== cantiereId || cantiereSelezionatoId !== cantiereId
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
      const risposta = await trasporto.salvaStrutturato(tentativo!.corpo, controller.signal)
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
      const ricevuto: unknown = await risposta.json()
      if (contesto !== richiestaStato.current) return
      let risultato: unknown = ricevuto
      if (tentativo!.payload.versione_contratto === 2) {
        if (!esitoCreazioneV2Valido(ricevuto, { ...tentativo!, rapportino_id: tentativo!.payload.rapportino_id })) throw new Error('Risposta non valida')
        risultato = vistaPrestazioniV1({ ...ricevuto, documento_legacy_materiali:
          bozzaV1.materialiStrutturati!.documento_legacy_materiali })
      }
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

  const invalidaV1 = () => {
    dettaglioV2.current = null
    tentativoV1.current = null
    setRetryV1(false)
    setConflittoV1(false)
    conflittoV1Ref.current = false
    setSalvatoV1(null)
    setRiletturaV1Fallita(false)
    setBozzaV1(null)
  }
  const apriNuovoV1 = () => {
    if (!statoRapportino) return
    setBozzaV1(corrente => corrente && corrente.cantiere_id === statoRapportino.cantiereId && corrente.data === statoRapportino.data
      ? corrente : (materialiAbilitati ? creaBozzaRapportinoV2 : creaBozzaRapportinoV1)(statoRapportino.cantiereId, statoRapportino.data))
    setMostraForm(true)
  }
  const apriModificaV1 = () => {
    if (!statoRapportino || !salvatoV1) return
    if (controlloInCorso.current || salvataggioInCorso.current || riletturaV1Fallita
      || statoRapportino.richiesta !== richiestaStato.current || salvatoV1.rapportino_id !== statoRapportino.rapportinoId) return
    setBozzaV1(corrente => corrente?.rapportino_id === salvatoV1.rapportino_id && corrente.revisione_attesa === salvatoV1.revisione
      ? corrente : dettaglioV2.current ? ricostruisciBozzaRapportinoV2(dettaglioV2.current) : ricostruisciBozzaRapportinoV1(salvatoV1))
    setMostraForm(true)
    void caricaVarianti(statoRapportino.cantiereId)
  }
  const editorProps: ComponentProps<typeof RapportinoPrestazioniEditorV1> | null = bozzaV1 && statoRapportino ? {
    bozza: bozzaV1, operai: operaiDisponibili, disabled: statoInCorso || salvataggioAttivo,
    salvataggioInCorso: salvataggioAttivo,
    salvabile: !conflittoV1 && !riletturaV1Fallita && bozzaV1Salvabile(bozzaV1, variantiBozza)
      && bozzaV1.prestazioni.nuove.every(p => operaiDisponibili.some(o => o.id === p.operaio_id)),
    retryDisponibile: retryV1, varianti: variantiBozza,
    onSalva: () => { void salvaBozzaV1() }, onRetry: () => { void salvaBozzaV1(true) },
    onRichiediVarianti: () => {
      if (!conflittoV1Ref.current && !salvataggioInCorso.current && !controlloInCorso.current
        && richiestaStato.current === statoRapportino.richiesta) void caricaVarianti(statoRapportino.cantiereId)
    },
    onRiprovaVarianti: () => {
      if (!salvataggioInCorso.current && !controlloInCorso.current && richiestaStato.current === statoRapportino.richiesta)
        void caricaVarianti(statoRapportino.cantiereId, true)
    },
    onChange: nuova => {
      if (nuova.materialiStrutturati && !materialiAbilitati) return
      if (salvataggioInCorso.current || controlloInCorso.current || richiestaStato.current !== statoRapportino.richiesta
        || nuova.cantiere_id !== statoRapportino.cantiereId || nuova.data !== statoRapportino.data) return
      tentativoV1.current = null
      setRetryV1(false)
      setBozzaV1(nuova)
      if (!conflittoV1Ref.current && nuova.prestazioni.nuove.some(p => p.lavoro_in_economia)) void caricaVarianti(nuova.cantiere_id)
    },
    onClose: () => { if (!salvataggioInCorso.current) setMostraForm(false) },
  } : null
  const riceviLetturaV2 = (value: unknown, richiesta: number) => {
    if (!materialiAbilitati || statoRapportino?.versionePrestazioni === 0 || tentativoV1.current || richiesta !== richiestaStato.current || salvataggioInCorso.current
      || !letturaMaterialiValida(value, { cantiere_id: cantiereId, data: dataRapportino }) || value.versione_prestazioni !== 1) return false
    dettaglioV2.current = value.dettaglio
    conflittoV1Ref.current = false
    setConflittoV1(false)
    setRiletturaV1Fallita(false)
    setStatoRapportino({ cantiereId: value.cantiere_id, data: value.data, richiesta,
      presente: true, versionePrestazioni: 1, rapportinoId: value.rapportino_id, revisione: value.dettaglio.revisione })
    setSalvatoV1(vistaPrestazioniV1(value.dettaglio))
    setBozzaV1(ricostruisciBozzaRapportinoV2(value.dettaglio))
    return true
  }
  return { bozzaV1, conflittoV1, conflittoV1Ref, salvatoV1, setSalvatoV1, riletturaV1Fallita, riceviLetturaV2,
    invalidaV1, invalidaVarianti, rileggiSalvatoV1, apriNuovoV1, apriModificaV1, editorProps }
}
