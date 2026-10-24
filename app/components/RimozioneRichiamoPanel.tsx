'use client'
import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import GestioniQuadernoPendenti from './GestioniQuadernoPendenti'
import { rimuoviRichiamo } from '../engines/quaderno/gestione'
import { erroreQuaderno } from '../engines/quaderno/persistenza'

type Richiamo = { id: string; sorgente_titolo: string; richiamato_at: string }
export default function RimozioneRichiamoPanel({ supabase, sopralluogo, versione, ids, disabled, onBusy, onConclusa }: {
  supabase: SupabaseClient; sopralluogo: string; versione: string | null; ids: string[]; disabled: boolean
  onBusy: (value: boolean) => void; onConclusa: () => void
}) {
  const [elenco, setElenco] = useState<Richiamo[]>([]), [scelta, setScelta] = useState(''), [errore, setErrore] = useState(''), [revision, setRevision] = useState(0)
  const busyRef = useRef(false), key = [...new Set(ids)].sort().join(',')
  useEffect(() => {
    let active = true
    void (async () => {
      const auth = await supabase.auth.getUser()
      if (auth.error) throw auth.error
      if (!auth.data.user) throw Error('Autenticazione richiesta')
      const r = await supabase.from('quaderno_richiami_sopralluogo').select('id,sorgente_titolo,richiamato_at')
        .eq('user_id', auth.data.user.id).eq('sopralluogo_id', sopralluogo).eq('stato', 'completato')
      if (r.error) throw r.error
      if (active) setElenco((r.data || []).filter(g => key.split(',').includes(g.id)))
    })().catch(e => { if (active) setErrore(erroreQuaderno(e)) })
    return () => { active = false }
  }, [supabase, sopralluogo, key, revision])
  async function rimuovi() {
    const r = elenco.find(x => x.id === scelta)
    if (!r || disabled || busyRef.current) return
    if (!window.confirm(`Rimuovere il richiamo “${r.sorgente_titolo}” del ${new Date(r.richiamato_at).toLocaleString('it-IT')} e i suoi file? I contenuti manuali e gli altri richiami saranno conservati.`)) return
    busyRef.current = true; onBusy(true); setErrore('')
    try { await rimuoviRichiamo(supabase, { id: r.id, titolo: r.sorgente_titolo, sopralluogo, versione }); onConclusa() }
    catch (error) { setErrore('Rimozione non confermata: usare Riprendi operazione. ' + erroreQuaderno(error as Error)) }
    finally { busyRef.current = false; onBusy(false); setRevision(n => n + 1) }
  }
  return <div style={{ marginTop: 12 }}>
    {!!elenco.length && <>
      <label>Richiamo da rimuovere <select aria-label="Richiamo da rimuovere" value={scelta} disabled={disabled} onChange={e => setScelta(e.target.value)}>
        <option value="">Scegli un richiamo</option>
        {elenco.map(r => <option key={r.id} value={r.id}>{r.sorgente_titolo} — {new Date(r.richiamato_at).toLocaleString('it-IT')}</option>)}
      </select></label>{' '}
      <button type="button" disabled={disabled || !elenco.some(r => r.id === scelta)} onClick={() => void rimuovi()}>Rimuovi richiamo</button>
      <p>Rimuove le pagine, gli elementi riconoscibili e i file della copia scelta. Il testo della nota e i contenuti di origine incerta restano conservati.</p>
      {disabled && <p>Salva o riconcilia le modifiche pendenti prima di rimuovere un richiamo.</p>}
    </>}
    <GestioniQuadernoPendenti supabase={supabase} sopralluogo={sopralluogo} revisione={revision} disabled={disabled}
      onBusy={onBusy} onConclusa={onConclusa} />
    {errore && <p role="alert">{errore}</p>}
  </div>
}
