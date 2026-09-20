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
    <ImportaVariantiApprovatePanel key={cantiere.id} cantiere={cantiere} supabase={supabase}
      caricaSalLavorazioni={caricaSalLavorazioni} formatMoney={formatMoney} buttonStyle={buttonStyle} />
  </section>
}


type VarianteApprovataSal = { id: string; numero: number; titolo: string | null; stato: 'approvata'; importo_delta_approvato: number | string }
const erroriImportazioneVariante: Record<string, string> = {
  P2070: 'Sessione utente non valida.',
  P2071: 'Variante o cantiere non disponibili.',
  P2072: 'La variante non è approvata.',
  P2073: 'Il contratto di riferimento non è valido.',
  P2074: 'La variante non contiene lavorazioni.',
  P2075: 'Importazione SAL incompleta.',
  P2076: "Conflitto durante l'importazione. Riprova.",
}
const conteggioSal = (valore: unknown): bigint | null => {
  if (typeof valore === 'number') return Number.isSafeInteger(valore) && valore >= 0 ? BigInt(valore) : null
  if (typeof valore === 'string' && /^\d+$/.test(valore)) return BigInt(valore)
  return null
}

function ImportaVariantiApprovatePanel({ cantiere, supabase, caricaSalLavorazioni, formatMoney, buttonStyle }: Props) {
  const [varianti, setVarianti] = useState<VarianteApprovataSal[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [erroreLettura, setErroreLettura] = useState('')
  const [erroreImportazione, setErroreImportazione] = useState('')
  const [messaggio, setMessaggio] = useState('')
  const [inCorso, setInCorso] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const occupato = useRef(false)
  const contesto = useRef<object | null>(null)
  useEffect(() => {
    contesto.current = {}
    return () => { contesto.current = null }
  }, [])
  useEffect(() => {
    let attivo = true
    setCaricamento(true)
    setErroreLettura('')
    setVarianti([])
    async function carica() {
      try {
        if (!cantiere.id) throw new Error('Cantiere assente')
        const approvate: VarianteApprovataSal[] = []
        const pagina = 200
        for (let offset = 0; ; offset += pagina) {
          const { data, error } = await supabase.rpc('leggi_varianti_cantiere', { p_cantiere_id: cantiere.id })
            .order('numero', { ascending: true, nullsFirst: false })
            .order('id', { ascending: true }).range(offset, offset + pagina - 1)
          if (!attivo) return
          if (error) {
            setErroreLettura(error.code === 'P2020' ? 'Sessione utente non valida.' : error.code === 'P2021'
              ? 'Non sei autorizzato a visualizzare le varianti di questo cantiere.' : 'Impossibile caricare le varianti approvate.')
            return
          }
          if (!Array.isArray(data)) throw new Error('Risposta non valida')
          for (const variante of data) {
            if (variante?.stato !== 'approvata') continue
            if (typeof variante.id !== 'string' || !variante.id.trim() || !Number.isInteger(variante.numero) || variante.numero <= 0 ||
                (variante.titolo !== null && typeof variante.titolo !== 'string') ||
                !['number', 'string'].includes(typeof variante.importo_delta_approvato) ||
                String(variante.importo_delta_approvato).trim() === '' || !Number.isFinite(Number(variante.importo_delta_approvato))) throw new Error('Variante non valida')
            approvate.push(variante)
          }
          if (data.length < pagina) break
        }
        if (attivo) setVarianti(approvate)
      } catch {
        if (attivo) setErroreLettura('Impossibile caricare le varianti approvate.')
      } finally {
        if (attivo) setCaricamento(false)
      }
    }
    void carica()
    return () => { attivo = false }
  }, [supabase, cantiere.id, refresh])

  async function importaVariante(variante: VarianteApprovataSal) {
    if (occupato.current || caricamento || variante.stato !== 'approvata') return
    const corrente = contesto.current
    if (!corrente) return
    occupato.current = true
    setInCorso(variante.id)
    setErroreImportazione('')
    setMessaggio('')
    try {
      const { data, error } = await supabase.rpc('importa_variante_approvata_nel_sal', { p_variante_id: variante.id })
      if (contesto.current !== corrente) return
      if (error) {
        setErroreImportazione(erroriImportazioneVariante[error.code] || 'Importazione non confermata. Verifica il SAL prima di riprovare.')
        return
      }
      const esito = Array.isArray(data) && data.length === 1 ? data[0] : null
      const righe = conteggioSal(esito?.righe_variante)
      const importate = conteggioSal(esito?.importate)
      const presenti = conteggioSal(esito?.gia_presenti)
      if (!esito || esito.variante_id !== variante.id || esito.cantiere_id !== cantiere.id ||
          righe === null || righe < BigInt(1) || importate === null || presenti === null || importate + presenti !== righe) {
        setErroreImportazione('Risposta di importazione non verificabile. Verifica il SAL prima di riprovare.')
        return
      }
      setMessaggio(importate > BigInt(0)
        ? `${importate.toString()} lavorazioni della Variante n. ${variante.numero} importate nel SAL.`
        : `Variante n. ${variante.numero} già completamente presente nel SAL.`)
      try {
        await caricaSalLavorazioni()
      } catch {
        if (contesto.current === corrente) setErroreImportazione('Importazione confermata, ma aggiornamento della vista SAL non riuscito. Riapri il SAL per verificarlo.')
      }
    } catch {
      if (contesto.current === corrente) setErroreImportazione('Importazione non confermata. Verifica il SAL prima di riprovare.')
    } finally {
      if (contesto.current === corrente) {
        occupato.current = false
        setInCorso(null)
      }
    }
  }

  return <section aria-label="Importa lavorazioni da varianti approvate" style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #cbd5e1' }}>
    <h3>Importa lavorazioni da varianti approvate</h3>
    <button type="button" style={buttonStyle} disabled={caricamento || inCorso !== null} onClick={() => setRefresh(v => v + 1)}>Ricarica varianti</button>
    {caricamento && <p role="status">Caricamento varianti approvate...</p>}
    {erroreLettura && <p role="alert">{erroreLettura}</p>}
    {erroreImportazione && <p role="alert">{erroreImportazione}</p>}
    {messaggio && <p role="status">{messaggio}</p>}
    {!caricamento && !erroreLettura && varianti.length === 0 && <p>Nessuna variante approvata disponibile per questo cantiere.</p>}
    <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
      {varianti.map(variante => <article key={variante.id} style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <h4 style={{ marginTop: 0 }}>Variante n. {variante.numero} — {variante.titolo || 'Senza titolo'}</h4>
        <p>Delta approvato: {formatMoney(Number(variante.importo_delta_approvato))}</p>
        <button type="button" style={{ ...buttonStyle, minHeight: 44 }} disabled={caricamento || inCorso !== null}
          onClick={() => void importaVariante(variante)}>{inCorso === variante.id ? 'Importazione…' : 'Importa nel SAL'}</button>
      </article>)}
    </div>
  </section>
}
