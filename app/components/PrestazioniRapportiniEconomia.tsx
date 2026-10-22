'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { acquisisciPrestazioniEconomia, elencaPrestazioniEconomia, type ElencoPrestazioniEconomia } from '../engines/economia/prestazioniRapportiniDesktop'

export default function PrestazioniRapportiniEconomia({ cantiereId, aggiornamento, onInvio, onAcquisite, varianti = [], onConferma, onTitoloSuggerito }: {
  cantiereId: string; aggiornamento: number; onInvio: (busy: boolean) => void; onAcquisite: () => void
  varianti?: readonly { id: string; titolo: string | null }[]; onConferma?: (aperta: boolean) => void; onTitoloSuggerito?: (titolo: string | null) => void
}) {
  const [elenco, setElenco] = useState<ElencoPrestazioniEconomia | null>(null)
  const [selezione, setSelezione] = useState<string[]>([])
  const [destinazione, setDestinazione] = useState('')
  const [conferma, setConferma] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState('')
  const [messaggio, setMessaggio] = useState('')
  const [daRileggere, setDaRileggere] = useState(false)
  const [lettura, setLettura] = useState(0)
  const generation = useRef(0), invio = useRef(false)
  useEffect(() => {
    const token = ++generation.current
    setElenco(null); setSelezione([]); setDestinazione(''); setConferma(false); setLoading(true); setErrore('')
    void elencaPrestazioniEconomia((n, p) => supabase.rpc(n, p), cantiereId).then(v => {
      if (generation.current !== token) return
      setElenco(v); setDestinazione(v.raccolte_in_bozza.length === 1 ? v.raccolte_in_bozza[0].raccolta_id : '')
      setDaRileggere(false)
    }).catch(e => { if (generation.current === token) setErrore(e instanceof Error ? e.message : 'Lettura non verificabile.') })
      .finally(() => { if (generation.current === token) setLoading(false) })
    return () => { generation.current++ }
  }, [cantiereId, aggiornamento, lettura])
  const raccolta = elenco?.raccolte_in_bozza.find(r => r.raccolta_id === destinazione)
  const prestazioni = elenco?.prestazioni.filter(p => selezione.includes(p.prestazione_id)) ?? []
  const varianteComune = prestazioni.length && prestazioni[0].variante_id && prestazioni.every(p => p.variante_id === prestazioni[0].variante_id) ? prestazioni[0].variante_id : null
  const titoloSuggerito = varianti.find(v => v.id === varianteComune)?.titolo?.trim() || null
  useEffect(() => { onConferma?.(conferma); return () => onConferma?.(false) }, [conferma, onConferma])
  useEffect(() => { onTitoloSuggerito?.(titoloSuggerito); return () => onTitoloSuggerito?.(null) }, [titoloSuggerito, onTitoloSuggerito])
  async function acquisisci() {
    if (invio.current || !conferma || !raccolta || !prestazioni.length || daRileggere) return
    invio.current = true; setBusy(true); onInvio(true); setErrore(''); setConferma(false)
    const token = generation.current
    try {
      const v = await acquisisciPrestazioniEconomia((n, p) => supabase.rpc(n, p), raccolta, prestazioni)
      if (token !== generation.current) return
      setMessaggio(`${v.acquisite} prestazioni acquisite. Prezzo fatturabile da valorizzare separatamente.`)
      setSelezione([]); onAcquisite(); setLettura(v => v + 1)
    } catch (e) {
      if (token === generation.current) { setErrore(e instanceof Error ? e.message : 'Esito non verificabile. Rileggi prima di riprovare.'); setDaRileggere(true) }
    } finally { invio.current = false; setBusy(false); onInvio(false) }
  }
  return <section aria-label="Prestazioni Economia dai Rapportini" style={{ marginTop: 16 }}>
    <h4>ECONOMIA DAI RAPPORTINI MOBILE</h4>
    <p>Acquisisci le ore nella raccolta in bozza. Il costo interno non diventa il prezzo fatturabile.</p>
    <button type="button" disabled={busy || loading} onClick={() => { setConferma(false); setLettura(v => v + 1) }}>Rileggi prestazioni</button>
    {loading && <p role="status">Caricamento prestazioni...</p>}
    {busy && <p role="status">Acquisizione in corso...</p>}
    {errore && <p role="alert">{errore}</p>}
    {messaggio && <p role="status">{messaggio}</p>}
    {elenco && <>
      {!elenco.raccolte_in_bozza.length ? <p>Nessuna raccolta in bozza per questo cantiere. Apri una raccolta con il flusso Economia esistente prima di acquisire.</p> :
        <label>Raccolta di destinazione<select value={destinazione} disabled={busy || daRileggere} onChange={e => { setDestinazione(e.target.value); setConferma(false) }}>
          <option value="">Scegli esplicitamente una raccolta</option>
          {elenco.raccolte_in_bozza.map(r => <option key={r.raccolta_id} value={r.raccolta_id}>N. {r.numero} — {r.titolo} · revisione {r.revisione}</option>)}
        </select></label>}
      {!elenco.prestazioni.length ? <p>Nessuna prestazione Economia V1 disponibile.</p> : <div style={{ overflowX: 'auto' }}><table>
        <thead><tr>{['Selezione', 'Data', 'Operaio', 'Lavorazione', 'Ore', 'Variante', 'Stato'].map(v => <th key={v} scope="col">{v}</th>)}</tr></thead>
        <tbody>{elenco.prestazioni.map(p => <tr key={p.prestazione_id}>
          <td><input type="checkbox" aria-label={`Seleziona prestazione ${p.prestazione_id}`} checked={selezione.includes(p.prestazione_id)}
            disabled={!p.candidabile || busy || daRileggere || !elenco.raccolte_in_bozza.length} onChange={e => {
              const checked = e.target.checked; setSelezione(s => checked ? [...s.filter(id => id !== p.prestazione_id), p.prestazione_id] : s.filter(id => id !== p.prestazione_id)); setConferma(false)
            }} /></td>
          <td>{p.data}</td><td>{p.operaio_nome}</td><td>Lavoro in economia da Rapportino</td>
          <td>{p.ore.toLocaleString('it-IT')}</td><td>{p.variante_id ? varianti.find(v => v.id === p.variante_id)?.titolo?.trim() || 'Titolo variante non disponibile' : 'Nessuna variante'}</td>
          <td>{p.stato === 'gia_acquisita' ? 'Già acquisita' : p.stato === 'divergente' ? 'Divergente: verifica necessaria' : p.candidabile ? 'Da acquisire' : 'Non acquisibile: verifica Variante e ore'}</td>
        </tr>)}</tbody>
      </table></div>}
      <button type="button" disabled={busy || daRileggere || !raccolta || !prestazioni.length} onClick={() => setConferma(true)}>Acquisisci selezionate</button>
      {conferma && raccolta && <div role="group" aria-label="Conferma acquisizione">
        <p>Confermi {prestazioni.length} prestazioni nella raccolta «{raccolta.titolo}»? Il prezzo fatturabile resterà non valorizzato.</p>
        <button type="button" disabled={busy} onClick={() => void acquisisci()}>Conferma acquisizione</button>
        <button type="button" disabled={busy} onClick={() => setConferma(false)}>Annulla</button>
      </div>}
    </>}
  </section>
}
