'use client'

import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import RevisionePreventivoAiPanel from './RevisionePreventivoAiPanel'
import { leggiSnapshotIntegrativo } from '../engines/preventivo-generation/lettura'
import { contestoVariante, leggiRispostaIntegrativa, validaRevisione, type SnapshotIntegrativo, type VoceIntegrativa } from '../engines/preventivo-generation/contesto'
import { leggiMemoriaPrezziPreventivo } from '../engines/preventivo-generation/memoria-prezzi'
import { leggiStoricoPrezzi } from '../engines/price-resolution/storico-prezzi'
import type { PriceKnowledgeItem } from '../engines/price-resolution/types'
import { preservaPerimetroMiglioraTesto } from '../utils/perimetroMiglioraTesto'

type Props = { soloManuale?: boolean; metadatiManuali?: { cliente: string; titolo: string; data: string }; supabase: SupabaseClient; varianteId: string; onSalvato: () => void }
export default function VariantePreventivoIntegrativoPanel({ supabase, varianteId, onSalvato, metadatiManuali, soloManuale = false }: Props) {
  const [clienteManuale, setClienteManuale] = useState(metadatiManuali?.cliente || '')
  const [titoloManuale, setTitoloManuale] = useState(metadatiManuali?.titolo || 'Preventivo Integrativo manuale')
  const [dataManuale, setDataManuale] = useState(metadatiManuali?.data || new Date().toLocaleDateString('sv-SE'))
  const [memoriaRiservata, setMemoriaRiservata] = useState(false)
  const [manuale, setManuale] = useState(false)
  const [storico, setStorico] = useState<PriceKnowledgeItem[]>([])
  const [snapshot, setSnapshot] = useState<SnapshotIntegrativo | null>(null)
  const [preview, setPreview] = useState(false), [busy, setBusy] = useState(false), [errore, setErrore] = useState('')
  const [arrestoVisibile, setArrestoVisibile] = useState(false)
  const [voci, setVoci] = useState<VoceIntegrativa[]>([]), [originali, setOriginali] = useState<VoceIntegrativa[]>([])
  const [descrizione, setDescrizione] = useState(''), [revisione, setRevisione] = useState(false), [salvato, setSalvato] = useState('')
  const [prezzi, setPrezzi] = useState<PriceKnowledgeItem[]>([]), [memoria, setMemoria] = useState<PriceKnowledgeItem[]>([])
  const inCorso = useRef(false), mounted = useRef(false), richiesta = useRef(''), arrestato = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!revisione || salvato) return
    const protect = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', protect); return () => window.removeEventListener('beforeunload', protect)
  }, [revisione, salvato])
  async function leggi() {
    const r = await supabase.rpc('leggi_contesto_preventivo_integrativo', { p_variante_id: varianteId })
    if (r.error) throw Error('Fonti o contratto non disponibili. Verifica che la migrazione Step 5 sia installata.')
    return leggiSnapshotIntegrativo(r.data, varianteId)
  }
  async function riferimenti(tabella: 'prezzi_lavorazioni' | 'memoria_prezzi', percorsoManuale = false) {
    if (percorsoManuale && tabella === 'memoria_prezzi') {
      const memoria = await leggiMemoriaPrezziPreventivo(supabase)
      if (mounted.current) setMemoriaRiservata(!memoria.autorizzata)
      return memoria.righe
    }
    const righe: PriceKnowledgeItem[] = []
    for (let da = 0; ; da += 500) {
      const r = await supabase.from(tabella).select('*').order(tabella === 'prezzi_lavorazioni' ? 'codice' : 'creato_il').range(da, da + 499)
      if (r.error) throw Error('Price Resolution non disponibile')
      righe.push(...r.data); if (r.data.length < 500) return righe
    }
  }
  async function anteprima() {
    if (inCorso.current || arrestato.current) return
    inCorso.current = true; setBusy(true); setErrore('')
    try { const s = await leggi(); if (mounted.current) { setSnapshot(s); if (s.documento_confermato) setSalvato(s.documento_confermato); else setPreview(true) } }
    catch (e) { if (mounted.current) setErrore(e instanceof Error ? e.message : 'Contesto non disponibile') }
    finally { inCorso.current = false; if (mounted.current) setBusy(false) }
  }
  async function compilaManuale() {
    if (inCorso.current || arrestato.current || salvato) return
    inCorso.current = true; setBusy(true); setErrore('')
    try {
      const s = await leggi(); contestoVariante(s)
      const [p, m, h] = await Promise.all([riferimenti('prezzi_lavorazioni'), riferimenti('memoria_prezzi', true), leggiStoricoPrezzi(supabase)])
      if (!mounted.current) return
      setSnapshot(s); setPrezzi(p); setMemoria(m); setStorico(h); setVoci([]); setOriginali([])
      setDescrizione(s.lettura.fonti.variante.descrizione || 'Preventivo Integrativo manuale')
      richiesta.current = crypto.randomUUID(); setManuale(true); setRevisione(true); setPreview(false)
    } catch (e) { if (mounted.current) setErrore(e instanceof Error ? e.message : 'Contesto non disponibile') }
    finally { inCorso.current = false; if (mounted.current) setBusy(false) }
  }
  async function genera() {
    if (!snapshot || inCorso.current || arrestato.current) return
    inCorso.current = true; setBusy(true); setErrore('')
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) throw Error('Accesso richiesto')
      const s = await leggi(); contestoVariante(s)
      const response = await fetch('/api/genera-preventivo-ai', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ tipo: 'integrativo', variante_id: varianteId }) })
      const json = await response.json()
      if (!response.ok) throw Error(typeof json.error === 'string' ? json.error : 'Generazione non confermata')
      // The server rereads independently. Reject if the preview changed during the request.
      if (json.integrativo?.firma !== s.firma) throw Error('Fonti cambiate durante la generazione: riapri l’anteprima')
      const [pp, m, storico] = await Promise.all([riferimenti('prezzi_lavorazioni'), riferimenti('memoria_prezzi'), leggiStoricoPrezzi(supabase)])
      const mm = m.filter(r => typeof r.prezzo_unitario === 'number' && Number.isFinite(r.prezzo_unitario))
      const righe = leggiRispostaIntegrativa(json, s.contratto, pp, mm, storico)
      if (!mounted.current) return
      setManuale(false); setPrezzi(pp); setMemoria(mm); setSnapshot(s); setVoci(righe); setOriginali(righe); setDescrizione(json.descrizione_intervento || 'Preventivo Integrativo')
      richiesta.current = crypto.randomUUID(); setRevisione(true); setPreview(false)
    } catch (e) { if (mounted.current) setErrore(e instanceof Error ? e.message : 'Generazione non confermata') }
    finally { inCorso.current = false; if (mounted.current) setBusy(false) }
  }
  async function conferma() {
    if (!snapshot || inCorso.current || arrestato.current || salvato) return
    try { validaRevisione(voci, snapshot.contratto); if (manuale && (!clienteManuale.trim() || !titoloManuale.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dataManuale))) throw Error('Completa Cliente, Titolo e Data') } catch (e) { setErrore(e instanceof Error ? e.message : 'Revisione incompleta'); return }
    inCorso.current = true; setBusy(true); setErrore('')
    // One request identity, retained on an uncertain response. No automatic retry.
    try {
      const r = await supabase.rpc(manuale ? 'salva_preventivo_integrativo_manuale' : 'salva_preventivo_integrativo_generato', { p_variante_id: varianteId, p_richiesta_id: richiesta.current,
        p_firma: snapshot.firma, p_descrizione: descrizione, p_voci: voci, ...(manuale ? { p_metadati: { cliente: clienteManuale.trim(), titolo: titoloManuale.trim(), data: dataManuale } } : {}) })
      if (r.error || r.data?.preventivo_id !== richiesta.current || r.data?.variante_id !== varianteId) throw Error('Salvataggio non confermato: verifica il Registro e la bozza prima di altre azioni. Nessun retry automatico.')
      if (mounted.current) { setSalvato(r.data.preventivo_id); setRevisione(false); onSalvato() }
    } catch (e) { arrestato.current = true; if (mounted.current) { setArrestoVisibile(true); setErrore(e instanceof Error ? e.message : 'Salvataggio non confermato') } }
    finally { inCorso.current = false; if (mounted.current) setBusy(false) }
  }
  async function migliora(indice: number) {
    const voce = voci[indice]; if (!voce || inCorso.current) return
    const r = await fetch('/api/migliora-voce-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ descrizione: voce.descrizione }) })
    const data = await r.json()
    if (r.ok && typeof data.descrizione === 'string' && preservaPerimetroMiglioraTesto(voce.descrizione, data.descrizione))
      setVoci(correnti => correnti.map(v => v === voce ? { ...v, descrizione: data.descrizione, revisione_confermata: false, da_verificare: true } : v))
  }
  let stato = ''
  let numeroNarrative = snapshot ? snapshot.lettura.fonti.quaderni.length + 1 : 0
  if (snapshot) { try { numeroNarrative = contestoVariante(snapshot).narrativa.fonti.length } catch (e) { stato = e instanceof Error ? e.message : 'Fonti non valide' } }
  return <section aria-label="Generazione Preventivo Integrativo">
    <h4>Preventivo Integrativo</h4>
    {!soloManuale && <button type="button" disabled={busy || !!salvato || arrestoVisibile || revisione} onClick={() => void anteprima()}>Genera Preventivo Integrativo</button>}
    <button type="button" disabled={busy || !!salvato || arrestoVisibile || revisione} onClick={() => void compilaManuale()}>Compila manualmente</button>
    {manuale && memoriaRiservata && <p role="status">Memoria prezzi riservata al titolare autorizzato. Restano disponibili prezzario e voci libere.</p>}
    {errore && <p role="alert">{errore}</p>}
    {preview && snapshot && <div aria-label="Anteprima generazione integrativa">
      <p>{numeroNarrative} fonti narrative · {snapshot.lettura.fonti.quaderni.length} Quaderni · {snapshot.lettura.fonti.foto.length} foto</p>
      <p>AI Osservatore: {!snapshot.lettura.analisi ? 'Non presente' : snapshot.lettura.analisi.allineata ? 'Allineata' : 'Non allineata'}</p>
      <p>Preventivo contrattuale di riferimento: {snapshot.contratto.id} — {snapshot.contratto.voci.length} voci, soltanto contesto di confronto.</p>
      {stato && <p role="alert">{stato}</p>}
      <button type="button" disabled={busy || !!stato} onClick={() => void genera()}>Genera</button>
      <button type="button" disabled={busy} onClick={() => void anteprima()}>Aggiorna anteprima</button>
      <button type="button" onClick={() => setPreview(false)}>Annulla</button>
    </div>}
    {revisione && snapshot && <fieldset disabled={busy || arrestoVisibile} style={{ border: 0, margin: 0, padding: 0 }} aria-label="Revisione Integrativo">
      {manuale && <div><p>Cantiere: {snapshot.genealogia.cantiere_id} · Variante: {varianteId} · Contratto: {snapshot.contratto.id}</p>
        <label>Cliente <input value={clienteManuale} onChange={e => setClienteManuale(e.target.value)} /></label>
        <label>Titolo <input value={titoloManuale} onChange={e => setTitoloManuale(e.target.value)} /></label>
        <label>Data <input type="date" value={dataManuale} onChange={e => setDataManuale(e.target.value)} /></label>
      </div>}
      <RevisionePreventivoAiPanel manuale={manuale} storicoRiferimento={storico} integrativo={snapshot.contratto} confermaInCorso={busy || arrestoVisibile}
      messaggioAi={errore} descrizionePreventivoAi={descrizione} setDescrizionePreventivoAi={setDescrizione}
      vociPreventivoAi={voci} setVociPreventivoAi={setVoci} vociPreventivoAiOriginali={originali}
      prezziRiferimento={prezzi} memoriaRiferimento={memoria} calcolaMediaPrezziSimili={() => null} verificaPrezzoAnomalo={() => ''}
      formatMoney={v => Number(v).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} miglioraVocePreventivoAi={migliora}
      salvaInMemoriaPrezzi={() => {}} generaExcelDefinitivoPreventivoAi={() => {}} salvaRevisionePreventivoAi={conferma}
      preventivoRegistroCantiere="Preventivo Integrativo" setMostraRevisionePreventivoAi={v => { if (!v && !busy && window.confirm('Chiudere e scartare la revisione non salvata?')) setRevisione(false) }}
      excelTable={{ borderCollapse: 'collapse' }} excelTh={{ padding: 8, border: '1px solid #ccc' }} excelTd={{ padding: 8, border: '1px solid #ccc' }} buttonPrimary={{ padding: 8 }} buttonSecondary={{ padding: 8 }} />
    </fieldset>}
    {salvato && <p role="status">Preventivo Integrativo {salvato} salvato nel Registro. Lavorazioni inserite nella bozza Variante; nessuna approvazione automatica. Excel disponibile dal Registro esistente.</p>}
  </section>
}
