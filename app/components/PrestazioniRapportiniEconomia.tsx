'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import VistaOperativa from './VistaOperativa'
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
  const [mostraAcquisite, setMostraAcquisite] = useState(false)
  const [aperta, setAperta] = useState(false)
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
  const selezioneBloccata = busy || loading || daRileggere || !elenco?.raccolte_in_bozza.length
  const eleggibili = elenco?.prestazioni.filter(p => p.candidabile && p.stato !== 'gia_acquisita').map(p => p.prestazione_id) ?? []
  const giaAcquisite = elenco?.prestazioni.filter(p => p.stato === 'gia_acquisita').length ?? 0
  const visibili = elenco?.prestazioni.filter(p => mostraAcquisite || p.stato !== 'gia_acquisita') ?? []
  const tutteSelezionate = eleggibili.length > 0 && eleggibili.every(id => selezione.includes(id))
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
  return <section aria-label="Prestazioni Economia dai Rapportini" style={{ marginTop: 12, padding: 12, border: '1px solid #e2e8f0', borderRadius: 10, minWidth: 0 }}>
    <button type="button" onClick={() => setAperta(true)}>Lavori in economia dai Rapportini</button>
    <VistaOperativa titolo="Lavori in economia dai Rapportini" etichettaRitorno="← Torna a Economia" visibile={aperta} onChiudi={() => setAperta(false)} occupata={busy}>
    <div className="prestazioni-economia-focus" style={{ minWidth: 0, width: '100%', overflowWrap: 'anywhere', containerType: 'inline-size', containerName: 'prestazioni-economia' }}>
    <p style={{ margin: '0 0 8px', fontSize: 11, color: '#64748b', letterSpacing: '.04em' }}>ECONOMIA DAI RAPPORTINI MOBILE</p>
    <p style={{ margin: '0 0 12px', fontSize: 14 }}>Acquisisci le ore nella raccolta in bozza. Il costo interno non diventa il prezzo fatturabile.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <button type="button" disabled={busy || loading} onClick={() => { setConferma(false); setLettura(v => v + 1) }}>Rileggi prestazioni</button>
      <button type="button" disabled={selezioneBloccata || !eleggibili.length} onClick={() => {
        if (selezioneBloccata) return
        setSelezione(s => tutteSelezionate ? [] : [...new Set([...s, ...eleggibili])]); setConferma(false)
      }}>{tutteSelezionate ? 'Deseleziona tutto' : 'Seleziona tutto'}</button>
      <button type="button" disabled={busy || daRileggere || !raccolta || !prestazioni.length} onClick={() => setConferma(true)}>Acquisisci selezionate</button>
    </div>
    {elenco && <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <span>Da acquisire: {eleggibili.length} · Già acquisite: {giaAcquisite}</span>
      <button type="button" aria-pressed={mostraAcquisite} onClick={() => setMostraAcquisite(v => !v)}>{mostraAcquisite ? 'Nascondi già acquisite' : 'Mostra già acquisite'}</button>
    </div>}
    {loading && <p role="status">Caricamento prestazioni...</p>}
    {busy && <p role="status">Acquisizione in corso...</p>}
    {errore && <p role="alert">{errore}</p>}
    {messaggio && <p role="status">{messaggio}</p>}
    {elenco && <>
      {!elenco.raccolte_in_bozza.length ? <p role="status" style={{ margin: '8px 0', fontSize: 14 }}>Nessuna raccolta in bozza</p> :
        <label>Raccolta di destinazione<select value={destinazione} disabled={busy || daRileggere} onChange={e => { setDestinazione(e.target.value); setConferma(false) }}>
          <option value="">Scegli esplicitamente una raccolta</option>
          {elenco.raccolte_in_bozza.map(r => <option key={r.raccolta_id} value={r.raccolta_id}>N. {r.numero} — {r.titolo} · revisione {r.revisione}</option>)}
        </select></label>}
      {!elenco.prestazioni.length ? <p style={{ margin: '8px 0', fontSize: 14 }}>Nessuna prestazione Economia V1 disponibile.</p> : !visibili.length ? <p role="status">Tutte le prestazioni disponibili risultano già acquisite.</p> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', tableLayout: 'auto', borderCollapse: 'collapse' }}>
        <thead><tr>{['Selezione', 'Data', 'Operaio', 'Lavorazione', 'Ore', 'Variante', 'Stato'].map(v => <th key={v} scope="col">{v}</th>)}</tr></thead>
        <tbody>{visibili.map(p => <tr key={p.prestazione_id}>
          <td data-label="Selezione"><input type="checkbox" aria-label={`Seleziona prestazione ${p.prestazione_id}`} checked={selezione.includes(p.prestazione_id)}
            disabled={!p.candidabile || p.stato === 'gia_acquisita' || selezioneBloccata} onChange={e => {
              const checked = e.target.checked; setSelezione(s => checked ? [...s.filter(id => id !== p.prestazione_id), p.prestazione_id] : s.filter(id => id !== p.prestazione_id)); setConferma(false)
            }} /></td>
          <td data-label="Data">{p.data}</td><td data-label="Operaio">{p.operaio_nome}</td><td data-label="Lavorazione">Lavoro in economia da Rapportino</td>
          <td data-label="Ore">{p.ore.toLocaleString('it-IT')}</td><td data-label="Variante">{p.variante_id ? varianti.find(v => v.id === p.variante_id)?.titolo?.trim() || 'Titolo variante non disponibile' : 'Nessuna variante'}</td>
          <td data-label="Stato">{p.stato === 'gia_acquisita' ? 'Già acquisita' : p.stato === 'divergente' ? 'Divergente: verifica necessaria' : p.candidabile ? 'Da acquisire' : 'Non acquisibile: verifica Variante e ore'}</td>
        </tr>)}</tbody>
      </table></div>}
      {conferma && raccolta && <div role="group" aria-label="Conferma acquisizione">
        <p>Confermi {prestazioni.length} prestazioni nella raccolta «{raccolta.titolo}»? Il prezzo fatturabile resterà non valorizzato.</p>
        <button type="button" disabled={busy} onClick={() => void acquisisci()}>Conferma acquisizione</button>
        <button type="button" disabled={busy} onClick={() => setConferma(false)}>Annulla</button>
      </div>}
    </>}
    </div>
    <style>{`
      .prestazioni-economia-focus button, .prestazioni-economia-focus select { min-width: 0; max-width: 100%; box-sizing: border-box; white-space: normal; overflow-wrap: anywhere; }
      .prestazioni-economia-focus th, .prestazioni-economia-focus td { padding: 8px; vertical-align: top; }
      .prestazioni-economia-focus th { white-space: nowrap; }
      @container prestazioni-economia (width < 900px) {
        .prestazioni-economia-focus table, .prestazioni-economia-focus tbody, .prestazioni-economia-focus tr, .prestazioni-economia-focus td { display: block; width: 100%; min-width: 0; box-sizing: border-box; }
        .prestazioni-economia-focus thead { display: none; }
        .prestazioni-economia-focus tr { margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 8px; }
        .prestazioni-economia-focus td::before { content: attr(data-label); display: block; font-weight: 600; color: #64748b; }
      }
    `}</style>
    </VistaOperativa>
  </section>
}
