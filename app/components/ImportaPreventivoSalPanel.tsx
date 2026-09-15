'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { caricaLavorazioniPreventivo, caricaSorgentiGiaNelSal, importaLavorazioniSelezionateNelSal, type LavorazioneImportSal } from '../utils/importaPreventivoSal'

type Preventivo = { id: string; nome_file?: string; importo_totale?: number; data_preventivo?: string; created_at?: string }
type Props = {
  cantiere: { id: string; nome: string }
  supabase: any
  caricaSalLavorazioni: () => Promise<void>
  formatMoney: (value: number) => string
  buttonStyle: CSSProperties
}

export default function ImportaPreventivoSalPanel({ cantiere, supabase, caricaSalLavorazioni, formatMoney, buttonStyle }: Props) {
  const [preventivi, setPreventivi] = useState<Preventivo[]>([])
  const [preventivoId, setPreventivoId] = useState('')
  const [righe, setRighe] = useState<LavorazioneImportSal[]>([])
  const [giaPresenti, setGiaPresenti] = useState<Set<string>>(new Set())
  const [selezione, setSelezione] = useState<Set<string>>(new Set())
  const [caricamento, setCaricamento] = useState(true)
  const [importazione, setImportazione] = useState(false)
  const [errore, setErrore] = useState('')
  const [messaggio, setMessaggio] = useState('')
  const [revisione, setRevisione] = useState(0)
  const occupato = useRef(false)

  useEffect(() => {
    let attivo = true
    setCaricamento(true)
    setErrore('')
    supabase.from('preventivi_cantiere')
      .select('id, nome_file, importo_totale, data_preventivo, created_at')
      .eq('cantiere_id', cantiere.id).order('created_at', { ascending: false })
      .then(({ data, error }: any) => {
        if (!attivo) return
        if (error) setErrore('Errore caricamento preventivi: ' + error.message)
        else setPreventivi(data || [])
        setCaricamento(false)
      }).catch((error: any) => {
        if (attivo) { setErrore(error.message || 'Errore caricamento preventivi'); setCaricamento(false) }
      })
    return () => { attivo = false }
  }, [supabase, cantiere.id])

  useEffect(() => {
    if (!preventivoId) return
    let attivo = true
    setCaricamento(true)
    setRighe([])
    setSelezione(new Set())
    ;(async () => {
      try {
        const nuove = await caricaLavorazioniPreventivo(supabase, preventivoId, cantiere.id)
        const presenti = await caricaSorgentiGiaNelSal(supabase, nuove)
        if (!attivo) return
        setRighe(nuove)
        setGiaPresenti(presenti)
        setSelezione(new Set(nuove.filter((r) => !presenti.has(String(r.id))).map((r) => String(r.id))))
      } catch (error: any) {
        if (attivo) setErrore('Errore caricamento lavorazioni: ' + (error.message || 'richiesta non riuscita'))
      } finally {
        if (attivo) setCaricamento(false)
      }
    })()
    return () => { attivo = false }
  }, [supabase, preventivoId, cantiere.id, revisione])

  const importa = async () => {
    if (occupato.current || caricamento || !selezione.size) return
    occupato.current = true
    setImportazione(true)
    setErrore('')
    setMessaggio('')
    try {
      const count = await importaLavorazioniSelezionateNelSal(supabase, preventivoId, cantiere, [...selezione])
      setMessaggio(count ? `${count} lavorazioni importate nel SAL` : 'Le lavorazioni selezionate risultano già nel SAL o non più disponibili.')
      await caricaSalLavorazioni()
    } catch (error: any) {
      setErrore(error.code === '23505'
        ? 'Una o più lavorazioni risultano già presenti nel SAL. Aggiorna la vista.'
        : 'Operazione non completata: ' + (error.message || 'errore di comunicazione'))
      if (error.code === '23505') {
        try { await caricaSalLavorazioni() } catch { /* The local list is reloaded below. */ }
      }
    } finally {
      setSelezione(new Set())
      setCaricamento(true)
      setRevisione((value) => value + 1)
      occupato.current = false
      setImportazione(false)
    }
  }
  const disabilitato = caricamento || importazione
  const totale = righe.filter((r) => selezione.has(String(r.id)) && !giaPresenti.has(String(r.id)))
    .reduce((sum, r) => sum + Number(r.importo_previsto || 0), 0)
  return <section aria-label="Importa lavorazioni dal preventivo" style={{ width: '100%', minWidth: 0, padding: 12, border: '1px solid #cbd5e1', borderRadius: 10, boxSizing: 'border-box' }}>
    <h3>Importa lavorazioni dal preventivo</h3>
    <label>Preventivo
      <select value={preventivoId} disabled={disabilitato} style={{ width: '100%', minHeight: 44 }} onChange={(e) => {
        setPreventivoId(e.target.value); setRighe([]); setSelezione(new Set()); setGiaPresenti(new Set()); setMessaggio(''); setErrore('')
        setCaricamento(Boolean(e.target.value))
      }}>
        <option value="">Scegli un preventivo</option>
        {preventivi.map((p) => <option key={p.id} value={p.id}>{p.nome_file || 'Preventivo'} — {formatMoney(Number(p.importo_totale || 0))}{(p.data_preventivo || p.created_at) ? ` — ${(p.data_preventivo || p.created_at || '').slice(0, 10)}` : ''}</option>)}
      </select>
    </label>
    {caricamento && <p role="status">Caricamento…</p>}
    {!caricamento && !errore && !preventivi.length && <p>Nessun preventivo disponibile</p>}
    {errore && <p role="alert">{errore}</p>}
    {messaggio && <p role="status">{messaggio}</p>}
    {preventivoId && !caricamento && !errore && !righe.length && <p>Nessuna lavorazione strutturata disponibile per questo preventivo.</p>}
    {!!righe.length && <>
      <h4>Lavorazioni disponibili</h4>
      <div style={{ maxHeight: 420, overflowY: 'auto', display: 'grid', gap: 10 }}>
        {righe.map((r, index) => { const presente = giaPresenti.has(String(r.id)); return <label key={r.id} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr)', alignItems: 'start', gap: 10, padding: 8, minWidth: 0, minHeight: 44, boxSizing: 'border-box', lineHeight: 1.4 }}>
          <input type="checkbox" style={{ width: 20, height: 20, minWidth: 20, minHeight: 20, maxWidth: 20, maxHeight: 20, margin: '2px 0 0', padding: 0, alignSelf: 'start' }} disabled={disabilitato || presente} checked={!presente && selezione.has(String(r.id))} onChange={(e) => {
            const checked = e.target.checked
            setSelezione((previous) => { const next = new Set(previous); if (checked) next.add(String(r.id)); else next.delete(String(r.id)); return next })
          }} />
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{index + 1}. {r.descrizione}<br />{r.unita_misura || '—'} × {r.quantita ?? '—'} — {formatMoney(Number(r.importo_previsto || 0))}{presente && <strong> — Già nel SAL</strong>}</span>
        </label> })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <button type="button" style={buttonStyle} disabled={disabilitato} onClick={() => setSelezione(new Set(righe.filter((r) => !giaPresenti.has(String(r.id))).map((r) => String(r.id))))}>Seleziona tutte</button>
        <button type="button" style={buttonStyle} disabled={disabilitato} onClick={() => setSelezione(new Set())}>Deseleziona tutte</button>
      </div>
    </>}
    <p>Totale selezionato: {formatMoney(totale)}</p>
    <button type="button" style={{ ...buttonStyle, minHeight: 44 }} disabled={disabilitato || !selezione.size} onClick={importa}>{importazione ? 'Importazione…' : 'Importa nel SAL'}</button>
  </section>
}
