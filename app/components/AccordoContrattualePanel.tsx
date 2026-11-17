'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { importoOriginaleVoce, type AccordoContrattuale, type VoceAccordo } from '../engines/economia/accordiContrattuali'

type Documento = { id: string; nome_file: string; cantiere_id: string | null; provenienza_testuale: string
  file_url: string | null; file_path: string | null; accordo: AccordoContrattuale | null; lavorazioni: VoceAccordo[] }
type Bozza = { descrizione: string; quantita: string; unita_misura: string; prezzo: string }
const vuota = (): Bozza => ({ descrizione: '', quantita: '1', unita_misura: 'corpo', prezzo: '' })
const euro = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
type Parametri = Record<string, unknown>

export default function AccordoContrattualePanel({ cantiereId, onSalvato }: {
  cantiereId: string; onSalvato: () => Promise<void>
}) {
  const [aperto, setAperto] = useState(false)
  const [documenti, setDocumenti] = useState<Documento[]>([])
  const [documentoId, setDocumentoId] = useState('')
  const [bozze, setBozze] = useState<Bozza[]>([vuota()])
  const [importo, setImporto] = useState('')
  const [modalita, setModalita] = useState('a_corpo')
  const [motivo, setMotivo] = useState('')
  const [riferimento, setRiferimento] = useState('')
  const [nota, setNota] = useState('')
  const [conferma, setConferma] = useState('')
  const [anteprima, setAnteprima] = useState<AccordoContrattuale | null>(null)
  const [parametri, setParametri] = useState<Parametri | null>(null)
  const [attesa, setAttesa] = useState(false)
  const [errore, setErrore] = useState('')
  const [esito, setEsito] = useState('')
  const documento = documenti.find(d => d.id === documentoId)
  const blocco = useRef(false)
  const chiave = 'artecna-accordo-contrattuale:' + cantiereId
  const [pendente, setPendente] = useState<Parametri | null>(null)
  const carica = async () => {
    const { data, error } = await supabase.rpc('candidati_accordo_contrattuale', { p_cantiere: cantiereId })
    if (error) throw error
    if (!Array.isArray(data)) throw Error('Elenco documenti non verificabile')
    setDocumenti(data)
  }
  useEffect(() => {
    if (!aperto) return
    let attivo = true
    void supabase.rpc('candidati_accordo_contrattuale', { p_cantiere: cantiereId }).then(({ data, error }) => {
      if (!attivo) return
      if (error || !Array.isArray(data)) setErrore('Documenti non disponibili. Verifica autorizzazioni e installazione dello schema.')
      else setDocumenti(data)
      setAttesa(false)
    }, () => {
      if (attivo) { setErrore('Connessione documenti non disponibile'); setAttesa(false) }
    })
    return () => { attivo = false }
  }, [aperto, cantiereId, chiave])

  async function esegui(azione: 'anteprima' | 'conferma' | 'importa' | 'recupera') {
    if (blocco.current || attesa) return
    blocco.current = true
    setAttesa(true); setErrore(''); setEsito('')
    try {
      if (azione === 'anteprima') {
        if (!documento) throw Error('Seleziona e verifica il documento originale')
        const numero = (v: string) => {
          if (!/^\d+(?:[.,]\d+)?$/.test(v.trim())) throw Error('Inserisci numeri decimali validi')
          return Number(v.replace(',', '.'))
        }
        const voci = documento.lavorazioni.length ? [] : bozze.map(r => ({ descrizione: r.descrizione,
          quantita: numero(r.quantita), unita_misura: r.unita_misura, prezzo_unitario: numero(r.prezzo),
          importo_previsto: importoOriginaleVoce(r.quantita, r.prezzo) }))
        const args = { p_cantiere: cantiereId, p_preventivo: documento.id, p_voci: voci, p_importo: numero(importo),
          p_modalita: modalita, p_motivo: motivo, p_riferimento: riferimento, p_nota_documentale: nota }
        const { data, error } = await supabase.rpc('anteprima_accordo_contrattuale', args)
        if (error) throw error
        setAnteprima(data); setParametri(args)
      } else if (azione === 'conferma' || azione === 'recupera') {
        if (azione === 'conferma' && (!anteprima || !parametri || conferma !== 'CONFERMA CONTRATTO')) throw Error('Verifica anteprima e conferma esplicita')
        const args = azione === 'recupera' ? pendente : { ...parametri, p_richiesta: crypto.randomUUID(),
          p_token: anteprima!.token, p_conferma: conferma }
        if (!args) throw Error('Richiesta da recuperare non disponibile')
        sessionStorage.setItem(chiave, JSON.stringify(args)); setPendente(args)
        const { error } = await supabase.rpc('conferma_accordo_contrattuale', args)
        if (error) {
          if (['22023', '42501', '40001', '23505', '55000'].includes(error.code)) {
            sessionStorage.removeItem(chiave); setPendente(null)
          }
          throw error
        }
        sessionStorage.removeItem(chiave); setPendente(null); setAnteprima(null); setParametri(null); setConferma('')
        await carica(); await onSalvato()
        setEsito('Contratto confermato. Documento originale e prezzi originali conservati.')
      } else {
        if (!documento?.accordo) throw Error('Conferma prima il contratto')
        const { data, error } = await supabase.rpc('importa_sal_accordato', { p_cantiere: cantiereId,
          p_preventivo: documento.id, p_ids: documento.accordo.righe.map(r => r.id) })
        if (error) throw error
        await onSalvato()
        setEsito(`${data} lavorazioni importate nel SAL`)
      }
    } catch (e) { setErrore(e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Operazione non confermata. Recupera la richiesta.') }
    finally { setAttesa(false); blocco.current = false }
  }
  const valori = anteprima ?? documento?.accordo
  return <details onToggle={e => {
    if (e.currentTarget.open && !aperto) {
      setAttesa(true)
      try { setPendente(JSON.parse(sessionStorage.getItem(chiave) ?? 'null')) }
      catch { setErrore('Richiesta locale non leggibile. Verifica prima di confermare un nuovo accordo.') }
    }
    setAperto(e.currentTarget.open)
  }}>
    <summary>Recupera documento storico / Accordo economico e ribasso contrattuale</summary>
    {attesa && <p role="status">Verifica in corso…</p>}
    {errore && <p role="alert">{errore}</p>}{esito && <p role="status">{esito}</p>}
    {pendente && <button type="button" disabled={attesa} onClick={() => void esegui('recupera')}>Recupera conferma contratto</button>}
    <fieldset disabled={attesa || !!pendente || !!anteprima}>
      <label>Documento da verificare <select value={documentoId} onChange={e => { setDocumentoId(e.target.value); setEsito(''); setErrore('') }}>
        <option value="">Seleziona il PDF esistente</option>
        {documenti.map(d => <option key={d.id} value={d.id}>{d.nome_file || d.id} — {d.cantiere_id ? 'collegato per UUID' : 'storico da verificare'}</option>)}
      </select></label>
      {documento && <>
        <p>Documento UUID {documento.id}. Provenienza registrata {documento.provenienza_testuale}. Proprietario storico non registrato.</p>
        {documento.file_url && /^https:\/\//.test(documento.file_url) && <a href={documento.file_url} target="_blank" rel="noreferrer">Apri PDF originale per verifica</a>}
        {!documento.file_url && <p>Verifica il PDF attraverso l’anteprima del documento archiviato prima della conferma.</p>}
        <p>La corrispondenza testuale individua un candidato. Conferma identità, provenienza e contenuto del PDF.</p>
        {documento.lavorazioni.length ? <p>{documento.lavorazioni.length} lavorazioni esistenti da riutilizzare integralmente.</p> : <>
          <p>Inserisci le lavorazioni originali verificate nel documento, comprese le opzioni effettivamente concordate.</p>
          {bozze.map((r, i) => <fieldset key={i}><legend>Lavorazione {i + 1}</legend>
            {(['descrizione', 'quantita', 'unita_misura', 'prezzo'] as const).map(k => <label key={k}>{({ descrizione: 'Descrizione originale', quantita: 'Quantità', unita_misura: 'UM', prezzo: 'Prezzo unitario originale' })[k]}
              <input value={r[k]} onChange={e => setBozze(prima => prima.map((v, j) => j === i ? { ...v, [k]: e.target.value } : v))} /></label>)}
          </fieldset>)}
          <button type="button" onClick={() => setBozze(v => [...v, vuota()])}>Aggiungi lavorazione originale</button>
        </>}
      </>}
      <label>Importo concordato IVA esclusa <input value={importo} onChange={e => setImporto(e.target.value)} inputMode="decimal" /></label>
      <label>Modalità <select value={modalita} onChange={e => setModalita(e.target.value)}><option value="a_corpo">A corpo</option><option value="a_misura">A misura</option></select></label>
      <label>Motivo dell’accordo <input value={motivo} maxLength={500} onChange={e => setMotivo(e.target.value)} /></label>
      <label>Riferimento dell’accordo <input value={riferimento} maxLength={500} onChange={e => setRiferimento(e.target.value)} /></label>
      <label>Note documentali, refusi e opzioni concordate <textarea value={nota} maxLength={2000} onChange={e => setNota(e.target.value)} /></label>
      <button type="button" disabled={!documento} onClick={() => void esegui('anteprima')}>Verifica lavorazioni e calcola ribasso</button>
    </fieldset>
    {valori && <>
      <p>Importo archiviato del documento {valori.importo_documento == null ? 'Non disponibile' : euro(valori.importo_documento)}. Somma verificata delle voci originali {euro(valori.totale_originale)}.</p>
      <p>Ribasso {valori.ribasso_percentuale.toLocaleString('it-IT')}%. Importo concordato {euro(valori.importo_concordato)}. {valori.modalita === 'a_corpo' ? 'A corpo' : 'A misura'}.</p>
      <div style={{ overflowX: 'auto' }}><table aria-label="Anteprima prezzi contrattuali"><thead><tr>{['Lavorazione', 'Quantità / UM', 'Prezzo originale', 'Importo originale', 'Ribasso', 'Prezzo contrattuale', 'Importo contrattuale', 'Conguaglio'].map(t => <th key={t}>{t}</th>)}</tr></thead>
        <tbody>{valori.righe.map(r => <tr key={r.ordine}><td>{r.descrizione}</td><td>{r.quantita} {r.unita_misura}</td><td>{r.prezzo_unitario.toLocaleString('it-IT', { maximumFractionDigits: 6 })} €</td><td>{euro(r.importo_previsto)}</td><td>{valori.ribasso_percentuale}%</td><td>{r.prezzo_unitario_contrattuale.toLocaleString('it-IT', { maximumFractionDigits: 12 })} €</td><td>{euro(r.importo_contrattuale)}</td><td>{euro(r.conguaglio)}</td></tr>)}</tbody></table></div>
      <p>{valori.nota_documentale}</p>
    </>}
    {anteprima && <fieldset disabled={attesa || !!pendente}>
      <label>Ho verificato il PDF, la provenienza, tutte le voci e l’accordo. Digita CONFERMA CONTRATTO <input value={conferma} onChange={e => setConferma(e.target.value)} /></label>
      <button type="button" disabled={conferma !== 'CONFERMA CONTRATTO'} onClick={() => void esegui('conferma')}>Conferma contratto</button>
      <button type="button" onClick={() => { setAnteprima(null); setParametri(null); setConferma('') }}>Rivedi anteprima</button>
    </fieldset>}
    {documento?.accordo && !anteprima && <button type="button" disabled={attesa || !!pendente} onClick={() => void esegui('importa')}>Importa lavorazioni concordate nel SAL</button>}
  </details>
}
