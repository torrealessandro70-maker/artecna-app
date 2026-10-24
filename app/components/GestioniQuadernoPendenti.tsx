'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { gestioniPendenti, riprendiGestione, archiviaNonAvviata, type Gestione } from '../engines/quaderno/gestione'
import { erroreQuaderno } from '../engines/quaderno/persistenza'

export default function GestioniQuadernoPendenti({ supabase, sopralluogo, revisione = 0, disabled = false, onConclusa, onBusy }: {
  supabase: SupabaseClient; sopralluogo?: string; revisione?: number; disabled?: boolean
  onConclusa: () => void; onBusy?: (busy: boolean) => void
}) {
  const [operazioni, setOperazioni] = useState<Gestione[]>([]), [errore, setErrore] = useState(''), [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const carica = useCallback(async () => {
    const rows = await gestioniPendenti(supabase)
    return rows.filter(g => sopralluogo ? g.tipo === 'rimuovi' && g.sopralluogo_id === sopralluogo : g.tipo !== 'rimuovi')
  }, [supabase, sopralluogo])
  useEffect(() => {
    let active = true
    void carica().then(rows => { if (active) { setOperazioni(rows); setErrore('') } }).catch(e => { if (active) setErrore(erroreQuaderno(e)) })
    return () => { active = false }
  }, [carica, revisione])
  async function riprendi(g: Gestione, annulla = false, archivia = false) {
    if (disabled || busyRef.current) return
    if (annulla && !window.confirm('Annullare la copia incompleta e rimuovere soltanto i suoi nuovi file?')) return
    busyRef.current = true; setBusy(true); onBusy?.(true); setErrore('')
    try {
      if (archivia) await archiviaNonAvviata(supabase, g)
      else await riprendiGestione(supabase, g.id, annulla)
      setOperazioni(await carica()); onConclusa()
    } catch (error) { setErrore('Operazione non conclusa. Riprendere senza creare una nuova richiesta. ' + erroreQuaderno(error as Error)) }
    finally { busyRef.current = false; setBusy(false); onBusy?.(false) }
  }
  if (!operazioni.length && !errore) return null
  return <aside aria-label="Operazioni Quaderno da riprendere" style={{ border: '1px solid #d97706', padding: 12, marginTop: 12 }}>
    <p>Operazioni da riprendere. La bozza aperta non viene salvata automaticamente da questi comandi.</p>
    {operazioni.map(g => <div key={g.id}>
      <span>{g.tipo === 'duplica' ? 'Copia' : g.tipo === 'elimina' ? 'Eliminazione' : 'Rimozione richiamo'}: {g.titolo}</span>{' '}
      <button type="button" disabled={busy || disabled} onClick={() => void riprendi(g)}>Riprendi operazione</button>{' '}
      {g.tipo === 'duplica' && <button type="button" disabled={busy || disabled} onClick={() => void riprendi(g, true)}>Annulla copia incompleta</button>}
      <button type="button" disabled={busy || disabled} onClick={() => void riprendi(g, false, true)}>Archivia richiesta non avviata</button>
    </div>)}
    {errore && <p role="alert">{errore}</p>}
  </aside>
}
