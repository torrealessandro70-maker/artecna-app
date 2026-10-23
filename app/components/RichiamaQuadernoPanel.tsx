'use client'
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { erroreQuaderno } from '../engines/quaderno/persistenza'

type Progetto = { id: string; titolo: string; updated_at: string }
export default function RichiamaQuadernoPanel({ supabase, busy, onConferma, onAnnulla }: {
  supabase: SupabaseClient; busy: boolean; onConferma: (id: string) => Promise<void>; onAnnulla: () => void;
}) {
  const [progetti, setProgetti] = useState<Progetto[]>([])
  const [scelta, setScelta] = useState('')
  const [errore, setErrore] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const auth = await supabase.auth.getUser()
        if (auth.error) throw auth.error
        if (!auth.data.user) throw Error('Accedi per aprire l’archivio')
        const result = await supabase.from('quaderno_progetti').select('id,titolo,updated_at').eq('user_id', auth.data.user.id).order('updated_at', { ascending: false })
        if (result.error) throw result.error
        if (active) setProgetti(result.data || [])
      } catch (error) { if (active) setErrore(erroreQuaderno(error as Error)) }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [supabase])
  return <section aria-label="Richiama dall’archivio" style={{ border: '2px solid #334155', padding: 16, background: '#fff' }}>
    <h3>Richiama dall’archivio</h3>
    <p>Copia lo stato salvato: le pagine e gli allegati verranno aggiunti senza sostituire il lavoro aperto. Le modifiche pendenti saranno salvate insieme alla copia.</p>
    {loading && <p role="status">Caricamento progetti…</p>}
    {!loading && !errore && !progetti.length && <p>Nessun progetto accessibile.</p>}
    <label>Progetto<select value={scelta} disabled={busy || loading} onChange={e => setScelta(e.target.value)}>
      <option value="">Scegli progetto</option>
      {progetti.map(p => <option key={p.id} value={p.id}>{p.titolo || 'Senza titolo'} — {new Date(p.updated_at).toLocaleString('it-IT')}</option>)}
    </select></label>
    <button type="button" disabled={!scelta || busy || loading} onClick={() => { setErrore(''); void onConferma(scelta).catch(e => setErrore(erroreQuaderno(e))) }}>Aggiungi al sopralluogo</button>
    <button type="button" disabled={busy} onClick={onAnnulla}>Annulla</button>
    {busy && <p role="status">Copia in corso… Non chiudere il sopralluogo.</p>}
    {errore && <p role="alert">{errore}</p>}
  </section>
}
