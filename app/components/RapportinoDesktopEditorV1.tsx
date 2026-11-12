'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import RapportinoStatoOperativo, { rapportinoConModificheLocali } from './RapportinoStatoOperativo'
import FotoRapportinoDesktopV1 from './FotoRapportinoDesktopV1'
import { validaDataAllegato, validaUUIDAllegato } from '../engines/rapportini/contrattoAllegati'
import { supabase } from '../../lib/supabaseClient'
import RapportinoStrutturatoEditorV1 from './RapportinoStrutturatoEditorV1'
import { creaTrasportoDesktopRapportinoV1 } from '../engines/rapportini/trasportoDesktopRapportinoV1'
import { letturaMaterialiValida } from '../engines/rapportini/validaLetturaMateriali'
import type { StatoRapportinoV2 } from '../engines/rapportini/contrattoMaterialiRapportino'
import type { StatoContestoRapportino } from '../engines/rapportini/useCoordinatoreRapportinoV1'

const trasporto = creaTrasportoDesktopRapportinoV1(supabase)
type Props = {
  cantiereId: string; data: string; rapportinoId?: string
  operai: readonly { id: string; nome: string }[]
  onClose: () => void; onSaved: () => void; onLegacy: (id: string) => void
}

/** JWT adapter only. No worker identity, portal authentication or photo queue. */
export default function RapportinoDesktopEditorV1({ cantiereId, data, rapportinoId, operai,
  onClose, onSaved, onLegacy }: Props) {
  const richiestaStato = useRef(0), controlloInCorso = useRef(false), salvataggioInCorso = useRef(false)
  const [statoRapportino, setStatoRapportino] = useState<StatoContestoRapportino | null>(null)
  const [statoInCorso, setStatoInCorso] = useState(true)
  const [salvataggioAttivo, setSalvataggioAttivo] = useState(false)
  const [mostraForm, setMostraForm] = useState(true)
  const [errore, setErrore] = useState(''), [messaggio, setMessaggio] = useState('')
  const [lettura, setLettura] = useState<StatoRapportinoV2>()
  const [ricarica, setRicarica] = useState(0)
  const [statoOperativoBusy, setStatoOperativoBusy] = useState(false)
  const [fotoBusy, setFotoBusy] = useState(false)
  const fotoBusyRef = useRef(false)
  const statoFoto = useCallback((busy: boolean) => { fotoBusyRef.current = busy; setFotoBusy(busy) }, [])
  const chiudi = () => { if (!fotoBusyRef.current && !statoOperativoBusy) onClose() }
  useEffect(() => {
    const richiesta = ++richiestaStato.current, controller = new AbortController()
    controlloInCorso.current = true
    const timeout = setTimeout(() => controller.abort(), 30_000)
    void (async () => {
      try {
        const input = { cantiere_id: cantiereId, data, rapportino_id: rapportinoId }
        const risposta = await trasporto.leggiStatoV2!(input, controller.signal), value: unknown = await risposta.json()
        if (controller.signal.aborted || richiesta !== richiestaStato.current) return
        if (!risposta.ok) throw new Error(risposta.status === 401 ? 'Sessione Desktop assente o scaduta.'
          : risposta.status === 403 ? 'Accesso al Cantiere non consentito.' : 'Lettura Rapportino non disponibile.')
        if (!letturaMaterialiValida(value, input)) throw new Error('Contratto Rapportino V2 non valido.')
        setStatoRapportino({ cantiereId, data, richiesta, presente: value.presente,
          versionePrestazioni: value.versione_prestazioni, rapportinoId: value.rapportino_id ?? undefined,
          revisione: value.dettaglio?.revisione })
        setLettura(value)
      } catch (e) {
        if (richiesta === richiestaStato.current) setErrore(e instanceof Error ? e.message : 'Lettura non completata.')
      } finally {
        clearTimeout(timeout)
        if (richiesta === richiestaStato.current) { controlloInCorso.current = false; setStatoInCorso(false) }
      }
    })()
    return () => { controller.abort(); clearTimeout(timeout); richiestaStato.current += 1 }
  }, [cantiereId, data, rapportinoId, ricarica])
  const rileggi = () => {
    setStatoInCorso(true); setErrore(''); setLettura(undefined); setMostraForm(true)
    setRicarica(n => n + 1)
  }
  const occupato = statoInCorso || salvataggioAttivo
  return <section aria-label="Editor Rapportino Desktop" role="dialog" aria-modal="true"
    style={{ position: 'fixed', inset: 20, zIndex: 2000, overflow: 'auto', background: '#fff', padding: 24, border: '2px solid #2563eb', borderRadius: 12 }}>
    <h2>Rapportino — {data}</h2>
    <button type="button" disabled={salvataggioAttivo || fotoBusy || statoOperativoBusy} onClick={chiudi}>Chiudi</button>
    {fotoBusy && <p role="status">Operazione foto in corso: attendi il completamento prima di chiudere.</p>}
    {statoInCorso && <p role="status">Lettura autorevole del Rapportino…</p>}
    {errore && <p role="alert">{errore}</p>}
    {messaggio && <p role="status">{messaggio}</p>}
    {lettura?.versione_prestazioni === 0 && <RapportinoStatoOperativo
      key={lettura.rapportino_id} id={lettura.rapportino_id} cantiereId={cantiereId}
      revisioneDocumento={null} disabilitato={occupato} onBusy={setStatoOperativoBusy} />}
    {lettura?.versione_prestazioni === 0 && <p>Rapportino storico: resta nel formato originale.
      <button type="button" disabled={statoOperativoBusy} onClick={() => onLegacy(lettura.rapportino_id)}>Apri form legacy</button></p>}
    {lettura && lettura.versione_prestazioni !== 0 && <RapportinoStrutturatoEditorV1
      key={`${cantiereId}/${data}/${rapportinoId ?? ''}/${ricarica}`}
      canale="desktop" cantiereId={cantiereId} data={data} rapportinoId={rapportinoId}
      trasporto={trasporto} letturaIniziale={lettura} onClose={chiudi} onSaved={onSaved}
      contesto={{ autorizzato: true, cantiereId, cantiereSelezionatoId: cantiereId, dataRapportino: data,
        operaiDisponibili: operai, statoRapportino, richiestaStato, controlloInCorso, salvataggioInCorso,
        statoInCorso, salvataggioAttivo: salvataggioAttivo || fotoBusy || statoOperativoBusy, setStatoRapportino, setStatoInCorso, setSalvataggioAttivo,
        setMostraForm, setErrore, setMessaggioSalvataggio: setMessaggio }}>
      {({ coordinatore, editor }) => <>
        {statoRapportino?.rapportinoId && <RapportinoStatoOperativo
          key={statoRapportino.rapportinoId} id={statoRapportino.rapportinoId} cantiereId={cantiereId}
          revisioneDocumento={statoRapportino.revisione ?? null}
          disabilitato={occupato || fotoBusy || coordinatore.conflittoV1 || coordinatore.riletturaV1Fallita}
          modificheLocali={mostraForm && rapportinoConModificheLocali(coordinatore.bozzaV1)}
          onBusy={setStatoOperativoBusy} />}
        {mostraForm && editor}
        {!mostraForm && coordinatore.salvatoV1 && <button type="button" disabled={occupato || statoOperativoBusy || coordinatore.riletturaV1Fallita}
          onClick={coordinatore.apriModificaV1}>Apri / Modifica rapportino</button>}
        {(coordinatore.conflittoV1 || coordinatore.riletturaV1Fallita) && <button type="button" disabled={occupato || statoOperativoBusy}
          onClick={() => { if (confirm('Rileggere lo stato server e sostituire la bozza corrente?')) rileggi() }}>Rileggi stato server</button>}
      </>}
    </RapportinoStrutturatoEditorV1>}
    {!lettura && !occupato && <button type="button" onClick={rileggi}>Ripeti lettura</button>}
    {lettura && lettura.versione_prestazioni !== 0 && <FotoRapportinoDesktopV1
      contesto={{ cantiere_id: validaUUIDAllegato(cantiereId), data: validaDataAllegato(data),
        rapportino_id: statoRapportino?.rapportinoId ? validaUUIDAllegato(statoRapportino.rapportinoId) : null }}
      disabled={occupato || statoOperativoBusy} onBusyChange={statoFoto} />}
  </section>
}
