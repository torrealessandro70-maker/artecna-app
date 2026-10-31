'use client'

import { useEffect, useRef, useState } from 'react'
import type { RigaDocumentoFattura } from '../engines/fatture/classificazioneDocumento'
import FatturaOperativa from './FatturaOperativa'
import NotaCreditoFornitorePanel from './NotaCreditoFornitorePanel'
import { tipoFiscaleDocumento } from '../engines/fatture/documento-fiscale'
import { supabase } from '../../lib/supabaseClient'
import { valoriEconomiaFattura, motivoQuantita, residuoPreview, type DisponibilitaMateriale } from '../engines/economia/fattureMateriali'
import { assegnaMaterialiImpresa, assegnaMaterialiCantiere, etichettaStatoFattura, leggiContestoMateriali, leggiStatoFattura, messaggioAssegnazione, statoRigaMateriale, verificaRigheMateriali, inviaMaterialiFattura, leggiRaccolteMateriali, motivoNonSelezionabile, motivoNonTrasferibile, selezionaRigaFattura, unitaEconomiaValida, uuidFattura, type ContestoMateriali, type DestinazioneMateriale, type StatoFattura, type StoricoMateriale, type RaccoltaMateriali, type RigaMaterialeFattura } from '../engines/economia/fattureMateriali'

export type DocumentoOperativo = {
  righe: RigaDocumentoFattura[]
  onCategoria: (id: string, value: string) => void
  onRiferimento: (id: string, value: string) => void
  onSalva: (righeIds?: string[]) => void | Promise<void>
}
const numeroUI = (v: unknown) => v == null || v === '' ? '—' : String(v).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '').replace('.', ',')
const firmaDocumento = (righe: RigaDocumentoFattura[]) => JSON.stringify(righe.map(r => [r.id, r.categoria_economica || null, r.cantiere || null]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))))
const euroUI = (v: unknown) => v == null || v === '' ? '—' : Number(v).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

export function InviaMaterialiFatturaEconomiaLegacy({ fatturaId, cantieri, onAggiornamentoFattura, onDisponibilita, semplice = false, documento }: { fatturaId: string; cantieri: { id?: string; nome?: string }[]; onAggiornamentoFattura?: () => void | Promise<void>; onDisponibilita?: (snapshot: { fatturaId: string; righe: Record<string, DisponibilitaMateriale> }) => void; semplice?: boolean; documento?: DocumentoOperativo }) {
  const [aperto, setAperto] = useState(semplice || !!documento)
  const [avanzato, setAvanzato] = useState(!semplice)
  const soloResiduo = semplice && !avanzato && !documento
  const [righe, setRighe] = useState<(RigaMaterialeFattura & RigaDocumentoFattura)[]>([])
  const [unitaEconomia, setUnitaEconomia] = useState<Record<string, string>>({}), [unitaMultipla, setUnitaMultipla] = useState('')
  const [cantiere, setCantiere] = useState(''), [raccolta, setRaccolta] = useState('')
  const [destinazione, setDestinazione] = useState<DestinazioneMateriale>('economia')
  const [storico, setStorico] = useState<Record<string, StoricoMateriale>>({}), [statoFattura, setStatoFattura] = useState<StatoFattura | null>(null)
  const [raccolte, setRaccolte] = useState<RaccoltaMateriali[]>([])
  const [presenti, setPresenti] = useState<string[]>([]), [scelte, setScelte] = useState<string[]>([])
  const [revisione, setRevisione] = useState<number | null>(null)
  const [disponibilita, setDisponibilita] = useState<Record<string, DisponibilitaMateriale>>({}), [quantita, setQuantita] = useState<Record<string, string>>({})
  const [statoDestinazione, setStatoDestinazione] = useState<RaccoltaMateriali['stato'] | null>(null)
  const [integrazioneConfermata, setIntegrazioneConfermata] = useState(false), [contestoPronto, setContestoPronto] = useState('')
  const contesto = `${fatturaId}|${cantiere}|${destinazione}|${destinazione === 'economia' ? raccolta : ''}`, contestoAttuale = useRef(contesto)
  contestoAttuale.current = contesto
  const pronta = aperto && contestoPronto === contesto && (destinazione !== 'economia' || statoDestinazione !== null)
  const chiusa = destinazione === 'economia' && (statoDestinazione ?? raccolte.find(r => r.id === raccolta)?.stato) === 'chiusa'
  const [caricamento, setCaricamento] = useState(false), [invio, setInvio] = useState(false)
  const [conferma, setConferma] = useState(false), [bloccato, setBloccato] = useState(false)
  const [documentoConfermato, setDocumentoConfermato] = useState<string | null>(null)
  const [errore, setErrore] = useState(''), [messaggio, setMessaggio] = useState('')
  const lock = useRef(false), attivo = useRef(true)
  const richiesteImpresa = useRef<Record<string, { firma: string; id: string }>>({})
  useEffect(() => { attivo.current = true; return () => { attivo.current = false } }, [])
  useEffect(() => {
    let valido = true
    setDocumentoConfermato(null); setRighe([]); setStatoFattura(null); setUnitaEconomia({}); setUnitaMultipla(''); setScelte([]); setConferma(false); setErrore(''); setBloccato(false); setMessaggio('')
    if (!aperto) return
    onDisponibilita?.({ fatturaId, righe: {} })
    setCaricamento(true)
    void (async () => {
      try {
        const [{ data, error }, stato] = await Promise.all([
          supabase.from('fatture_fornitori_righe').select('id,fattura_id,descrizione,quantita,unita_misura,prezzo_unitario,totale_riga,categoria_economica,cantiere').eq('fattura_id', fatturaId).order('numero_riga'),
          leggiStatoFattura(supabase, fatturaId),
        ])
        if (!valido) return
        if (error || !Array.isArray(data)) setErrore('Impossibile leggere le righe originali della fattura')
        else {
          setRighe(data); setStatoFattura(stato)
          setUnitaEconomia(Object.fromEntries(data.filter(r => uuidFattura(r.id)).map(r => [r.id, typeof r.unita_misura === 'string' ? r.unita_misura : ''])))
        }
      } catch { if (valido) setErrore('Impossibile leggere le righe originali della fattura') }
      finally { if (valido) setCaricamento(false) }
    })()
    return () => { valido = false }
  }, [aperto, fatturaId, onDisponibilita])
  useEffect(() => {
    let valido = true
    setRaccolte([]); setRaccolta(''); setScelte([]); setPresenti([]); setRevisione(null); setConferma(false); setErrore(''); setMessaggio('')
    if (!aperto || !cantiere || destinazione !== 'economia') return
    setCaricamento(true)
    void leggiRaccolteMateriali(supabase, cantiere).then(v => { if (valido) setRaccolte(v) })
      .catch(e => { if (valido) setErrore(e.message) }).finally(() => { if (valido) setCaricamento(false) })
    return () => { valido = false }
  }, [aperto, cantiere, destinazione])
  useEffect(() => {
    let valido = true
    setScelte([]); setPresenti([]); setRevisione(null); setConferma(false); setIntegrazioneConfermata(false)
    setDisponibilita({}); setStorico({}); setQuantita({}); setContestoPronto(''); setStatoDestinazione(null); setErrore(''); setMessaggio('')
    if (!aperto || (destinazione === 'economia' && !raccolta) || (destinazione !== 'impresa' && !cantiere) || !righe.length) return
    setCaricamento(true)
    void leggiContestoMateriali(supabase, fatturaId, cantiere, destinazione, raccolta)
      .then(v => { if (valido) impostaDisponibilita(v) })
      .catch(e => { if (valido) setErrore(messaggioAssegnazione(e)) }).finally(() => { if (valido) setCaricamento(false) })
    return () => { valido = false }
  }, [aperto, fatturaId, raccolta, cantiere, destinazione, righe])
  function impostaDisponibilita(v: ContestoMateriali) {
    verificaRigheMateriali(righe, v)
    const d = v.disponibilita
    onDisponibilita?.({ fatturaId, righe: d })
    const ids = righe.filter(r => uuidFattura(r.id)).map(r => r.id!)
    setDisponibilita(d); setQuantita(Object.fromEntries(ids.map(id => [id, d[id].quantita_residua])))
    setStorico(v.storico); setStatoFattura(v.statoFattura)
    setPresenti(v.presenti); setRevisione(v.revisione); setStatoDestinazione(v.statoRaccolta); setContestoPronto(contesto)
    if (v.statoRaccolta) setRaccolte(old => old.map(r => r.id === raccolta ? { ...r, stato: v.statoRaccolta! } : r))
  }
  const documentoRiga = (id: string) => documento?.righe.find(r => r.id === id)
  const documentoModificato = !!documento && firmaDocumento(documento.righe) !== (documentoConfermato ?? firmaDocumento(righe))
  function motivoCategoria(id: string): string | null {
    if (!documento) return null
    const c = documentoRiga(id)?.categoria_economica
    if (c === 'materiale_cantiere') return destinazione === 'impresa' ? 'Scegli Lavori in economia o Cantiere' : null
    if (c === 'attrezzo_ditta' || c === 'magazzino') return destinazione === 'impresa' ? null : 'Scegli Generale impresa — Attrezzatura'
    return c ? 'Categoria solo documentale: nessuna assegnazione quantitativa' : 'Classifica la riga prima di assegnare'
  }
  async function salvaDocumento() {
    if (!documento || lock.current || invio || caricamento) return
    lock.current = true; setInvio(true); setConferma(false); setErrore(''); setMessaggio('')
    const corrente = contesto, confermato = firmaDocumento(documento.righe)
    try {
      await documento.onSalva()
      if (!attivo.current || contestoAttuale.current !== corrente) return
      setDocumentoConfermato(confermato)
      setMessaggio('Classificazione salvata dal server. Le assegnazioni quantitative restano invariate.')
    } catch (e) { if (attivo.current && contestoAttuale.current === corrente) setErrore(messaggioAssegnazione(e)) }
    finally { lock.current = false; if (attivo.current) setInvio(false) }
  }
  function cambiaCategoria(id: string, value: string) {
    if (!documento || lock.current || invio) return
    documento.onCategoria(id, value); setScelte([]); setConferma(false); setIntegrazioneConfermata(false)
    if (value === 'attrezzo_ditta' || value === 'magazzino') setDestinazione('impresa')
    else if (value === 'materiale_cantiere' && destinazione === 'impresa') setDestinazione('economia')
  }
  const incomplete = scelte.flatMap(id => {
    const r = righe.find(r => r.id === id), motivo = r ? motivoCategoria(id) || motivoQuantita(disponibilita[id], quantita[id]) || motivoNonTrasferibile(r, unitaEconomia[id] ?? '') : 'Riga non disponibile'
    return motivo || presenti.includes(id) ? [`${r?.descrizione || id}: ${presenti.includes(id) ? 'Già assegnata' : motivo}`] : []
  })
  const puoInviare = !documentoModificato && pronta && scelte.length > 0 && incomplete.length === 0 && (destinazione !== 'economia' || revisione !== null) && (!chiusa || integrazioneConfermata) && !caricamento && !invio && !bloccato
  function modificaUnita(id: string, value: string) {
    if (lock.current || invio || bloccato || presenti.includes(id)) return
    setUnitaEconomia(v => ({ ...v, [id]: value })); setConferma(false); setIntegrazioneConfermata(false)
  }
  function modificaQuantita(id: string, value: string) {
    if (lock.current || invio || bloccato || presenti.includes(id)) return
    setQuantita(v => ({ ...v, [id]: value })); setConferma(false); setIntegrazioneConfermata(false)
  }
  function applicaUnitaMultipla() {
    const value = unitaEconomiaValida(unitaMultipla)
    if (!value || lock.current || invio || bloccato) return
    setUnitaEconomia(v => {
      const next = { ...v }
      for (const id of scelte) if (!presenti.includes(id)) next[id] = value
      return next
    })
    setConferma(false); setIntegrazioneConfermata(false)
  }
  function quantitaResidue(v: ContestoMateriali) {
    verificaRigheMateriali(righe, v)
    const valori: Record<string, string> = {}
    for (const id of scelte) {
      const r = righe.find(r => r.id === id), d = v.disponibilita[id]
      if (!r || !d || v.presenti.includes(id) || motivoQuantita(d, d.quantita_residua) || motivoNonTrasferibile(r, unitaEconomia[id] ?? '')) throw Error('Selezione non più assegnabile: rileggere la fattura')
      valori[id] = d.quantita_residua
    }
    return valori
  }
  async function preparaAssegnazione() {
    if (!puoInviare || lock.current) return
    if (!soloResiduo) { setConferma(true); return }
    lock.current = true; setInvio(true); setErrore(''); setMessaggio('')
    const richiesta = contesto
    try {
      const v = await leggiContestoMateriali(supabase, fatturaId, cantiere, destinazione, raccolta)
      if (!attivo.current || contestoAttuale.current !== richiesta) return
      const q = quantitaResidue(v)
      impostaDisponibilita(v); setQuantita(q); setConferma(true)
      if (chiusa !== (v.statoRaccolta === 'chiusa')) { setIntegrazioneConfermata(false); setConferma(false) }
    } catch (e) {
      if (attivo.current && contestoAttuale.current === richiesta) { setErrore(messaggioAssegnazione(e)); setConferma(false); setBloccato(true) }
    } finally { lock.current = false; if (attivo.current) setInvio(false) }
  }
  async function invia() {
    if (lock.current || !conferma || !puoInviare || (destinazione === 'economia' && revisione === null)) return
    lock.current = true; setInvio(true); setConferma(false); setErrore('')
    const richiesta = contesto
    let esito: Awaited<ReturnType<typeof assegnaMaterialiCantiere>> | undefined, erroreInvio: unknown
    try {
      let quantitaInvio = quantita, revisioneInvio = revisione
      if (soloResiduo) {
        const fresco = await leggiContestoMateriali(supabase, fatturaId, cantiere, destinazione, raccolta)
        if (!attivo.current || contestoAttuale.current !== richiesta) return
        quantitaInvio = quantitaResidue(fresco); revisioneInvio = fresco.revisione
        const cambiato = scelte.some(id => ['quantita_originale', 'quantita_assegnata', 'quantita_residua'].some(k => fresco.disponibilita[id][k as keyof DisponibilitaMateriale] !== disponibilita[id]?.[k as keyof DisponibilitaMateriale])) || fresco.revisione !== revisione || fresco.statoRaccolta !== statoDestinazione
        if (cambiato) {
          impostaDisponibilita(fresco); setMessaggio('Disponibilità cambiata: controlla i residui aggiornati e conferma nuovamente.'); setIntegrazioneConfermata(false); return
        }
      }
      try {
        esito = destinazione === 'economia'
          ? await inviaMaterialiFattura(supabase, raccolta, revisioneInvio!, scelte, unitaEconomia, quantitaInvio, chiusa && integrazioneConfermata)
          : destinazione === 'impresa'
            ? await assegnaMaterialiImpresa(supabase, scelte, unitaEconomia, quantitaInvio, Object.fromEntries(scelte.map(id => {
              const firma = JSON.stringify([fatturaId, id, quantitaInvio[id], unitaEconomiaValida(unitaEconomia[id]), documentoRiga(id)?.categoria_economica ?? 'attrezzo_ditta'])
              if (richiesteImpresa.current[id]?.firma !== firma) richiesteImpresa.current[id] = { firma, id: crypto.randomUUID() }
              return [id, richiesteImpresa.current[id].id]
            })), documento ? Object.fromEntries(scelte.map(id => [id, documentoRiga(id)?.categoria_economica || ''])) : undefined)
            : await assegnaMaterialiCantiere(supabase, cantiere, scelte, unitaEconomia, quantitaInvio)
      } catch (e) { erroreInvio = e }
      if (!attivo.current || contestoAttuale.current !== richiesta) return
      setScelte([]); setIntegrazioneConfermata(false); setContestoPronto('')
      onDisponibilita?.({ fatturaId, righe: {} })
      const v = await leggiContestoMateriali(supabase, fatturaId, cantiere, destinazione, raccolta)
      if (!attivo.current || contestoAttuale.current !== richiesta) return
      impostaDisponibilita(v)
      await onAggiornamentoFattura?.()
      if (!attivo.current || contestoAttuale.current !== richiesta) return
      if (erroreInvio) {
        if (soloResiduo) {
          const unitaMinime = (q: string) => BigInt(q.replace('.', ''))
          const riuscite = scelte.filter(id => v.disponibilita[id] && disponibilita[id] && unitaMinime(v.disponibilita[id].quantita_assegnata) - unitaMinime(disponibilita[id].quantita_assegnata) >= unitaMinime(quantitaInvio[id])).length
          setMessaggio(`${riuscite} di ${scelte.length} righe con incremento confermato dal server. Verifica lo storico; operazione interrotta.`)
        }
        throw erroreInvio
      }
      if (!esito) throw Error('Esito assegnazione non verificabile')
      if (destinazione === 'impresa') for (const r of esito.esiti) if (r.stato === 'inserita') delete richiesteImpresa.current[r.id]
      setMessaggio(`${esito.esiti.filter(r => r.stato === 'inserita').length} inserite · ${esito.esiti.filter(r => r.stato === 'gia_assegnata').length} già assegnate`)
      const errori = esito.esiti.filter(r => r.stato === 'errore')
      if (errori.length) {
        if (soloResiduo) setMessaggio(`${esito.esiti.filter(r => r.stato === 'inserita').length} di ${scelte.length} righe inserite · operazione interrotta.`)
        setErrore(errori.map(r => `${r.id}: ${r.motivo}`).join('; ')); setBloccato(true)
      }
    } catch (e) { if (attivo.current && contestoAttuale.current === richiesta) {
      setErrore(erroreInvio && erroreInvio !== e
        ? `${messaggioAssegnazione(erroreInvio)}\nRilettura server: ${messaggioAssegnazione(e)}`
        : messaggioAssegnazione(e))
      setBloccato(true)
    } }
    finally { if (attivo.current) setInvio(false); lock.current = false }
  }
  return <section aria-label="Assegnazione quantitativa" style={{ marginBlock: 12, border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '10px 12px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
      <strong>{documento ? 'Classificazione e assegnazione fattura' : soloResiduo ? 'Assegnazione semplice — tutto il residuo' : 'Assegnazione materiali e quantità'}</strong>
      {!documento && <button type="button" disabled={invio} aria-expanded={aperto && avanzato} onClick={() => {
        setConferma(false)
        if (semplice) { setAvanzato(v => !v); setQuantita(Object.fromEntries(Object.entries(disponibilita).map(([id, d]) => [id, d.quantita_residua]))) }
        else { setContestoPronto(''); setAperto(v => !v) }
      }}>{semplice && avanzato ? 'Torna ad assegnazione semplice' : 'Assegna materiali e quantità'}</button>}
    </div>
    {aperto && <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '8px 12px', fontSize: 13 }}>
        <span>{documento ? 'Classifica e salva; poi seleziona le righe da assegnare. Quantità parziali modificabili nella riga.' : soloResiduo ? 'Seleziona le righe: Assegna utilizza tutto il residuo.' : 'Seleziona le righe e indica le quantità.'} Destinazione e riferimento sono comuni alla selezione.</span>
        <span role="status">Stato fattura: <strong>{etichettaStatoFattura(statoFattura)}</strong></span>
      </div>
      {caricamento && <p role="status" style={{ margin: '4px 12px' }}>Caricamento...</p>}
      <div style={{ overflowX: 'auto' }} tabIndex={0} role="region" aria-label="Tabella assegnazione materiali">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, lineHeight: 1.35 }}>
        <thead><tr>{(documento ? ['Selezione', 'Descrizione', 'Q.tà fattura', 'U.M.', 'Categoria', 'Già assegnata', 'Residuo', 'Destinazione', 'Riferimento destinazione', 'Q.tà da assegnare', 'Totale', 'Stato', 'Operazioni / storico'] : ['Selezione', 'Descrizione', 'Q.tà fattura', 'Già assegnata', 'Residuo', 'U.M.', 'Destinazione', 'Riferimento destinazione', 'Q.tà da assegnare', 'Prezzo', 'Totale', 'Stato', 'Operazioni / storico']).map(t => <th key={t} scope="col" style={{ background: '#e5e7eb', border: '1px solid #cbd5e1', padding: '7px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>{t}</th>)}</tr></thead>
        <tbody>
        {!righe.length && <tr><td colSpan={13} style={{ padding: 12 }}>{caricamento ? 'Lettura righe fattura…' : 'Nessuna riga disponibile.'}</td></tr>}
        {righe.map((r, i) => { const id = r.id ?? '', d = disponibilita[id], richiesta = quantita[id] ?? '', presente = presenti.includes(id), selezionata = scelte.includes(id)
          const motivo = motivoCategoria(id) || motivoQuantita(d, richiesta) || motivoNonTrasferibile(r, unitaEconomia[id] ?? ''), economia = valoriEconomiaFattura(r, richiesta)
          const indisponibile = !!motivoCategoria(id) || !pronta || !d || presente || d.quantita_residua === '0.000000'
          const cella = { border: '1px solid #cbd5e1', padding: '6px 8px', verticalAlign: 'top' as const, overflowWrap: 'anywhere' as const }
          const numero = { ...cella, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' }
          const input = { width: '100%', minWidth: 65, boxSizing: 'border-box' as const, border: '1px solid #cbd5e1', borderRadius: 4, padding: '5px 6px', background: '#fff', font: 'inherit' }
          return <tr key={r.id || i} style={{ background: selezionata ? '#eff6ff' : i % 2 ? '#f8fafc' : '#fff' }}>
            <td style={{ ...cella, textAlign: 'center' }}><input type="checkbox" aria-label={`Seleziona ${r.descrizione || 'riga'}`} checked={selezionata} disabled={!!motivoNonSelezionabile(r) || indisponibile || (!selezionata && !!motivoQuantita(d, richiesta)) || caricamento || invio || bloccato}
              onChange={() => { if (indisponibile || lock.current) return; setScelte(v => selezionaRigaFattura(v, r, presenti)); setConferma(false); setIntegrazioneConfermata(false) }} /></td>
            <td style={{ ...cella, minWidth: 190, maxWidth: 320, whiteSpace: 'normal' }}>{r.descrizione}</td>
            <td style={numero}>{documento ? numeroUI(r.quantita) : r.quantita ?? '—'}</td>
            {documento && <td style={{ ...cella, minWidth: 85 }}><input style={input} type="text" aria-label={`U.M. ${destinazione === 'economia' ? 'Economia' : 'assegnazione'} riga ${i + 1}: ${r.descrizione || 'riga'}`} maxLength={64} value={r.id ? unitaEconomia[r.id] ?? '' : ''} disabled={!r.id || presente || invio || bloccato || (!!documento && !['materiale_cantiere', 'attrezzo_ditta', 'magazzino'].includes(documentoRiga(id)?.categoria_economica || ''))}
              onChange={e => { if (r.id) modificaUnita(r.id, e.target.value) }} />
              <small style={{ display: 'block', color: '#64748b', marginTop: 4 }}>Originale fattura: {r.unita_misura?.trim() ? r.unita_misura : '—'}</small></td>}
            {documento && <td style={{ ...cella, minWidth: 160 }}><select style={input} aria-label={`Categoria riga ${i + 1}`} value={documentoRiga(id)?.categoria_economica || ''} disabled={invio} onChange={e => cambiaCategoria(id, e.target.value)}>
              <option value="">Da classificare</option><option value="materiale_cantiere">Materiale cantiere</option><option value="attrezzo_ditta">Attrezzo / bene ditta</option><option value="magazzino">Magazzino</option><option value="spesa_generale">Spesa generale</option><option value="storno_escluso">Storno / esclusione</option>
            </select></td>}
            <td style={numero}>{documento ? numeroUI(d?.quantita_assegnata) : d?.quantita_assegnata ?? '—'}{destinazione === 'impresa' && d && <details><summary style={{ fontSize: 11, cursor: 'pointer' }}>Ripartizione</summary><small>Economia: {d.quantita_assegnata_economia} · Cantiere: {d.quantita_assegnata_cantiere} · Impresa: {d.quantita_assegnata_impresa}</small></details>}</td>
            <td style={numero}>{documento ? numeroUI(d?.quantita_residua) : <>Disponibile: {d?.quantita_residua ?? '—'}</>}<small style={{ display: 'block', color: '#64748b', marginTop: 4 }}>Dopo: {documento ? numeroUI(presente ? d?.quantita_residua : residuoPreview(d, richiesta)) : presente ? d?.quantita_residua ?? '—' : residuoPreview(d, richiesta) ?? '—'}</small></td>
            {!documento && <td style={{ ...cella, minWidth: 85 }}><input style={input} type="text" aria-label={`U.M. ${destinazione === 'economia' ? 'Economia' : 'assegnazione'} riga ${i + 1}: ${r.descrizione || 'riga'}`} maxLength={64} value={r.id ? unitaEconomia[r.id] ?? '' : ''} disabled={!r.id || presente || invio || bloccato || (!!documento && !['materiale_cantiere', 'attrezzo_ditta', 'magazzino'].includes(documentoRiga(id)?.categoria_economica || ''))}
              onChange={e => { if (r.id) modificaUnita(r.id, e.target.value) }} />
              <small style={{ display: 'block', color: '#64748b', marginTop: 4 }}>Originale fattura: {r.unita_misura?.trim() ? r.unita_misura : '—'}</small></td>}
            {!documento && i === 0 && <td rowSpan={righe.length} style={{ ...cella, minWidth: 155, background: '#fff' }}>
      <fieldset style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: 0, padding: 0, border: 0 }} disabled={invio || bloccato}>
        <legend style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Comune alle righe selezionate</legend>
        {(['economia', 'cantiere', 'impresa'] as const).map(d => <label key={d}><input type="radio" name={`destinazione-${fatturaId}`} value={d} checked={destinazione === d} onChange={() => { if (!lock.current) { setDestinazione(d); setConferma(false); setIntegrazioneConfermata(false) } }} /> {d === 'economia' ? 'Lavori in economia' : d === 'impresa' ? 'Generale impresa' : 'Cantiere'}</label>)}
      </fieldset>

            </td>}
            {!documento && i === 0 && <td rowSpan={righe.length} style={{ ...cella, minWidth: 195, maxWidth: 260, background: '#fff' }}>
      {destinazione !== 'impresa' && <label>Cantiere <select style={{ ...input, display: 'block', marginBlock: 4 }} value={cantiere} disabled={invio || bloccato} onChange={e => setCantiere(e.target.value)}>
        <option value="">Scegli cantiere</option>{cantieri.filter(c => uuidFattura(c.id)).map(c => <option key={c.id} value={c.id}>{c.nome || c.id}</option>)}
      </select></label>}{' '}

      {destinazione === 'economia' && <label>Raccolta Economia <select style={{ ...input, display: 'block', marginBlock: 4 }} value={raccolta} disabled={!cantiere || caricamento || invio || bloccato} onChange={e => { setErrore(''); setRaccolta(e.target.value) }}>
        <option value="">Scegli raccolta esistente</option>{raccolte.map(r => <option key={r.id} value={r.id}>{r.titolo} — {r.stato === 'chiusa' ? 'Chiusa' : 'Aperta'}</option>)}
      </select></label>}

              {destinazione === 'impresa' && <span>Generale impresa<br />Categoria: <strong>Attrezzatura</strong></span>}
              {destinazione === 'economia' && cantiere && !caricamento && !errore && !raccolte.length && <small>Nessuna raccolta Economia disponibile per questo cantiere</small>}
            </td>}
            {documento && <td style={{ ...cella, minWidth: 155 }}>
              {['materiale_cantiere', 'attrezzo_ditta', 'magazzino'].includes(documentoRiga(id)?.categoria_economica || '') ? <select style={input} aria-label={`Destinazione riga ${i + 1}`} value={motivoCategoria(id) ? '' : destinazione} disabled={invio || bloccato} onChange={e => { if (!lock.current && !invio) { const nuova = e.target.value as DestinazioneMateriale; const categoria = nuova === 'impresa' ? (documentoRiga(id)?.categoria_economica === 'magazzino' ? 'magazzino' : 'attrezzo_ditta') : 'materiale_cantiere'; if (documentoRiga(id)?.categoria_economica !== categoria) cambiaCategoria(id, categoria); setDestinazione(nuova); setConferma(false); setIntegrazioneConfermata(false) } }}>
                <option value="" disabled>Scegli destinazione</option>
                <option value="economia">Lavori in economia</option><option value="cantiere">Cantiere</option><option value="impresa">Generale impresa</option>
              </select> : <span>{documentoRiga(id)?.categoria_economica === 'storno_escluso' ? 'Esclusione' : 'Solo documento'}</span>}
            </td>}
            {documento && <td style={{ ...cella, minWidth: 190, maxWidth: 260 }}>
              {documentoRiga(id)?.categoria_economica === 'materiale_cantiere' ? <>
                <label>Cantiere <select style={input} aria-label={`Cantiere assegnazione riga ${i + 1}`} value={cantiere} disabled={invio || bloccato} onChange={e => setCantiere(e.target.value)}><option value="">Scegli cantiere</option>{cantieri.filter(c => uuidFattura(c.id)).map(c => <option key={c.id} value={c.id}>{c.nome || c.id}</option>)}</select></label>
                {destinazione === 'economia' && <label>Raccolta Economia <select style={{ ...input, marginTop: 4 }} aria-label={`Raccolta Economia riga ${i + 1}`} value={raccolta} disabled={!cantiere || caricamento || invio || bloccato} onChange={e => { setErrore(''); setRaccolta(e.target.value) }}><option value="">Scegli raccolta esistente</option>{raccolte.map(r => <option key={r.id} value={r.id}>{r.titolo} — {r.stato === 'chiusa' ? 'Chiusa' : 'Aperta'}</option>)}</select></label>}
                {destinazione === 'economia' && cantiere && !caricamento && !errore && !raccolte.length && <small>Nessuna raccolta Economia disponibile per questo cantiere</small>}
              </> : ['attrezzo_ditta', 'magazzino'].includes(documentoRiga(id)?.categoria_economica || '') ? <span>Generale impresa — {documentoRiga(id)?.categoria_economica === 'magazzino' ? 'Magazzino' : 'Attrezzatura'}</span> : ['magazzino', 'spesa_generale'].includes(documentoRiga(id)?.categoria_economica || '') ? <label>Riferimento documento <select style={input} aria-label={`Riferimento documento riga ${i + 1}`} value={documentoRiga(id)?.cantiere || ''} disabled={invio} onChange={e => { if (!lock.current) { documento.onRiferimento(id, e.target.value); setConferma(false) } }}><option value="">Nessun riferimento</option><option value="Generale impresa">Generale impresa</option>{cantieri.map(c => <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>)}</select></label> : '—'}
            </td>}
            <td style={{ ...numero, minWidth: 95 }}>{soloResiduo ? <span>{richiesta || '—'}</span> : <input style={{ ...input, textAlign: 'right' }} type="text" inputMode="decimal" aria-label={`Quantità da assegnare riga ${i + 1}`} value={documento ? numeroUI(richiesta).replace('—', '') : richiesta} disabled={indisponibile || invio || bloccato} onChange={e => modificaQuantita(id, e.target.value)} />}</td>
            {!documento && <td style={numero}>{destinazione === 'economia' ? 'Economia: ' : 'Netto: '}{economia?.prezzo ?? '—'}<small style={{ display: 'block', color: '#64748b', marginTop: 4 }}>Originale: {r.prezzo_unitario ?? '—'}</small></td>}
            <td style={numero}>{documento ? euroUI(['materiale_cantiere', 'attrezzo_ditta', 'magazzino'].includes(documentoRiga(id)?.categoria_economica || '') ? economia?.totale : r.totale_riga) : <>{destinazione === 'economia' ? 'Economia netto: ' : 'Netto: '}{economia?.totale ?? '—'}</>}{documento && <small style={{ display: 'block' }}>Prezzo: {euroUI(economia?.prezzo)}</small>}<small style={{ display: 'block', color: '#64748b', marginTop: 4 }}>Documento originale: {documento ? euroUI(r.totale_riga) : r.totale_riga ?? '—'}</small></td>
            <td style={{ ...cella, minWidth: 140 }}><strong>{documento && !['materiale_cantiere', 'attrezzo_ditta', 'magazzino'].includes(documentoRiga(id)?.categoria_economica || '') ? (documentoRiga(id)?.categoria_economica === 'storno_escluso' ? 'Esclusa dai costi' : 'Solo documento') : statoRigaMateriale(d)}</strong><small style={{ display: 'block', color: motivo ? '#92400e' : '#64748b', marginTop: 4 }}>{motivo || (!r.unita_misura?.trim() ? 'U.M. completata' : '')}</small></td>
            <td style={cella}>              {storico[id] && <details style={{ minWidth: 150, maxWidth: 310 }}><summary>Vedi assegnazioni ({storico[id].assegnazioni.length})</summary>
                {storico[id].assegnazioni.length ? <ul aria-label={`Assegnazioni riga ${i + 1}`} style={{ listStyle: 'none', padding: 0, margin: '6px 0', display: 'grid', gap: 6 }}>
                  {storico[id].assegnazioni.map(a => <li key={`${a.destinazione}:${a.id}`} style={{ padding: 8, border: '1px solid #e2e8f0', borderRadius: 6, minWidth: 0, overflowWrap: 'anywhere' }}>
                    {a.destinazione !== 'impresa' && <strong>{a.cantiere || '—'}</strong>}<div>{a.destinazione === 'economia' ? 'Economia' : a.destinazione === 'impresa' ? `Generale impresa — ${a.categoria === 'magazzino' ? 'Magazzino' : 'Attrezzatura'}` : 'Cantiere'}</div>
                    {a.destinazione === 'economia' && <small style={{ display: 'block' }}>{a.raccolta || '—'}</small>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 4 }}>
                      <span>{Number(a.quantita).toLocaleString('it-IT', { maximumFractionDigits: 6 })} {a.unita_misura}</span>{(documento || a.destinazione === 'impresa') && <span>Prezzo: {documento ? euroUI(a.prezzo_unitario) : a.prezzo_unitario + ' €'}</span>}<span>Totale: {Number(a.totale).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span><time dateTime={a.data}>{new Date(a.data).toLocaleDateString('it-IT')}</time>
                    </div>
                  </li>)}
                </ul> : <p>Nessuna assegnazione visibile. Le quantità globali includono tutti i cantieri.</p>}
              </details>}
            </td>
          </tr>
        })}
        </tbody>
      </table></div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '8px 12px', borderTop: '1px solid #cbd5e1', background: '#f8fafc' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>U.M. selezionate <input style={{ width: 72, padding: '5px 6px', border: '1px solid #cbd5e1', borderRadius: 4 }} type="text" aria-label="U.M. per le righe selezionate" maxLength={64} value={unitaMultipla} disabled={invio || bloccato} onChange={e => setUnitaMultipla(e.target.value)} /></label>
        <button type="button" disabled={!scelte.length || !unitaEconomiaValida(unitaMultipla) || caricamento || invio || bloccato} onClick={applicaUnitaMultipla}>Applica U.M. alle righe selezionate</button>
        <span style={{ marginLeft: 'auto', fontSize: 13 }}>{scelte.length} righe selezionate</span>
        {documento && <button type="button" disabled={invio || caricamento || !righe.length} onClick={() => void salvaDocumento()}>Salva classificazione</button>}
        <button type="button" disabled={!puoInviare} onClick={() => void preparaAssegnazione()}>{documento ? 'Assegna selezionate' : soloResiduo ? 'Assegna' : `Assegna ${scelte.length} materiali`}</button>
      </div>
      {documentoModificato && <p role="status" style={{ margin: '8px 12px' }}>Classificazione modificata: salva prima di assegnare.</p>}
      {chiusa && <div style={{ margin: '8px 12px', padding: 8, border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: 6 }}><p style={{ margin: '0 0 6px' }}>Questa raccolta è già chiusa. Il materiale verrà registrato come integrazione post-chiusura.</p>
        <label><input type="checkbox" aria-label="Confermo integrazione post-chiusura" checked={integrazioneConfermata} disabled={!pronta || invio || bloccato} onChange={e => { setIntegrazioneConfermata(e.target.checked); setConferma(false) }} /> Confermo l’integrazione post-chiusura</label></div>}
      {incomplete.length > 0 && <p role="alert" style={{ margin: '8px 12px', padding: 8, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6 }}>Completa le righe selezionate prima di inviare: {incomplete.join('; ')}</p>}
      {conferma && <div role="group" aria-label="Conferma assegnazione materiali" style={{ margin: '8px 12px', padding: 10, border: '1px solid #93c5fd', background: '#eff6ff', borderRadius: 6 }}><p>{soloResiduo ? `Stai assegnando tutto il residuo di ${scelte.length} righe` : `Assegnare ${scelte.length} righe`} a {destinazione === 'impresa' ? 'Generale impresa'  : cantieri.find(c => c.id === cantiere)?.nome || cantiere}{destinazione === 'economia' ? `, raccolta ${raccolte.find(r => r.id === raccolta)?.titolo || raccolta}` : destinazione === 'cantiere' ? ', come costo del cantiere' : ''}?</p>
        <button type="button" disabled={!puoInviare} onClick={() => void invia()}>Conferma assegnazione</button>{' '}<button type="button" disabled={invio} onClick={() => setConferma(false)}>Annulla</button></div>}
      {(messaggio || errore || bloccato) && <div aria-label="Esito assegnazione" style={{ margin: '8px 12px', padding: 10, border: errore ? '1px solid #fca5a5' : '1px solid #cbd5e1', background: errore ? '#fef2f2' : '#f8fafc', borderRadius: 6, fontSize: 13 }}>
        {messaggio && <p role="status" style={{ margin: 0 }}>{messaggio}</p>}{errore && <p role="alert" style={{ margin: '4px 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{errore}</p>}
      {bloccato && <p style={{ margin: '4px 0' }}>Invio bloccato: chiudere e riaprire la fattura per rileggere lo stato. Nessun retry automatico.</p>}
      </div>}
    </>}
  </section>
}

export default function InviaMaterialiFatturaEconomia(props: Parameters<typeof InviaMaterialiFatturaEconomiaLegacy>[0]) {
 const [tipo, setTipo] = useState<{ id: string; valore: string | null; errore: string } | null>(null)
 useEffect(() => {
   let attivo = true
   void (async () => {
     try {
       const { data, error } = await supabase.from('fatture_fornitori').select('id,tipo_documento,xml_testo').eq('id', props.fatturaId).single()
       if (error || !data) throw Error(error?.message || 'Documento non disponibile')
       const valore = tipoFiscaleDocumento(data)
       if (attivo) setTipo({ id: props.fatturaId, valore, errore: '' })
     } catch (e) { if (attivo) setTipo({ id: props.fatturaId, valore: null, errore: e instanceof Error ? e.message : 'Tipo fiscale non disponibile' }) }
   })()
   return () => { attivo = false }
 }, [props.fatturaId])
 if (tipo?.id !== props.fatturaId) return <p role="status">Verifica tipo documento…</p>
 if (tipo.errore) return <p role="alert">Tipo documento non disponibile: {tipo.errore}. Nessuna assegnazione avviata.</p>
 if (tipo.valore === 'TD04') return <NotaCreditoFornitorePanel key={props.fatturaId} client={supabase} notaId={props.fatturaId} cantieri={props.cantieri} onAggiornamento={props.onAggiornamentoFattura} />
 return props.documento ? <FatturaOperativa {...props} documento={props.documento} key={props.fatturaId} /> : <InviaMaterialiFatturaEconomiaLegacy {...props} />
}
