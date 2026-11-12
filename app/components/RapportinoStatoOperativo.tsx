'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { BozzaRapportinoV1 } from '../engines/rapportini/bozzaRapportinoV1'
import { deltaMaterialiBozza } from '../engines/rapportini/materialiBozzaV1'

type StatoOperativo = {
  stato: 'bozza' | 'chiuso' | null
  revisione_stato: string
  revisione_documento: string | null
}

function statoValido(value: unknown): value is StatoOperativo {
  if (!value || typeof value !== 'object') return false
  const { stato, revisione_stato, revisione_documento } = value as Partial<StatoOperativo>
  return (stato === null || stato === 'bozza' || stato === 'chiuso')
    && typeof revisione_stato === 'string' && /^\d+$/.test(revisione_stato)
    && (revisione_documento === null || (typeof revisione_documento === 'string' && /^\d+$/.test(revisione_documento)))
}

export function rapportinoConModificheLocali(bozza: BozzaRapportinoV1 | null) {
  if (!bozza) return false
  if (!bozza.baseline || Object.values(bozza.prestazioni).some(righe => righe.length > 0)) return true
  const originale = bozza.baseline.documento
  if (bozza.documento.note !== originale.note || bozza.documento.materiali !== originale.materiali
    || bozza.documento.quantita_materiali !== originale.quantita_materiali) return true
  if (bozza.materialiStrutturati?.versione_materiali !== 1) return false
  try {
    return Object.values(deltaMaterialiBozza(bozza)).some(righe => righe.length > 0)
  } catch {
    return true
  }
}

type Props = {
  id: string
  cantiereId: string
  revisioneDocumento: number | null
  disabilitato: boolean
  modificheLocali?: boolean
  onBusy: (busy: boolean) => void
}

export default function RapportinoStatoOperativo({ id, cantiereId, revisioneDocumento, disabilitato,
  modificheLocali = false, onBusy }: Props) {
  const [stato, setStato] = useState<StatoOperativo>()
  const [occupato, setOccupato] = useState(false)
  const [errore, setErrore] = useState('')
  const [ricarica, setRicarica] = useState(0)
  const revisione = revisioneDocumento === null ? null : String(revisioneDocumento)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      const { data, error } = await supabase.rpc('leggi_stato_operativo_rapportino',
        { p_id: id, p_cantiere: cantiereId }).abortSignal(controller.signal)
      if (controller.signal.aborted) return
      if (error || !statoValido(data)) {
        setStato(undefined)
        setErrore('Stato operativo non disponibile.')
      } else setStato(data)
    })()
    return () => controller.abort()
  }, [id, cantiereId, revisione, ricarica])

  const documentoAggiornato = !!stato && stato.revisione_documento !== revisione
  const bloccato = !stato || occupato || disabilitato || modificheLocali || documentoAggiornato
  const cambia = async () => {
    if (bloccato) return
    setErrore('')
    setOccupato(true)
    onBusy(true)
    try {
      const { data, error } = await supabase.rpc('cambia_stato_operativo_rapportino', {
        p_id: id, p_cantiere: cantiereId,
        p_stato: stato.stato === 'chiuso' ? 'bozza' : 'chiuso',
        p_revisione_stato: stato.revisione_stato, p_revisione_documento: revisione,
      })
      if (error?.code === 'PR412') {
        setStato(undefined)
        setErrore('Conflitto: il rapportino è stato aggiornato. Rileggo lo stato operativo. Le modifiche locali restano nell’editor.')
        setRicarica(n => n + 1)
      } else if (error?.code === '42501') {
        setErrore('Non hai il permesso di cambiare lo stato operativo.')
      } else if (error || !statoValido(data)) {
        setErrore('Cambio di stato non confermato. Rileggo lo stato operativo.')
        setStato(undefined)
        setRicarica(n => n + 1)
      } else setStato(data)
    } finally {
      setOccupato(false)
      onBusy(false)
    }
  }

  return <section aria-label="Stato operativo del rapportino">
    <p role="status">Stato operativo: {stato ? stato.stato ?? 'Non classificato' : errore ? 'Non disponibile' : 'Caricamento…'}</p>
    {errore && <p role="alert">{errore}</p>}
    {modificheLocali && <p>Salva le modifiche prima di cambiare lo stato operativo.</p>}
    {documentoAggiornato && <p>La revisione del documento è cambiata. Rileggi il documento prima di cambiare stato.</p>}
    {stato && <button type="button" disabled={bloccato} onClick={() => void cambia()}>
      {stato.stato === 'chiuso' ? 'Riapri rapportino' : 'Chiudi rapportino'}
    </button>}
  </section>
}
