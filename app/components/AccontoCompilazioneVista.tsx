'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import VistaOperativa from './VistaOperativa'
import ContrattoFiscalePanel from './ContrattoFiscalePanel'
import IncassiLordiPanel from './IncassiLordiPanel'
import { campiAcconto, centesimi, modificheAcconto, originaleAcconto, propostaAcconto, scorporoAcconto,
  type AccontoPersistito, type CampiAcconto } from '../engines/economia/compilazioneAcconto'

type Pendente = { id: string; richiesta: string; firma: string; campi: CampiAcconto; proposta: { lordo: number; aliquota: number } | null }
function recuperaPendente(key: string): Pendente | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Pendente | null
    return p && typeof p.id === 'string' && typeof p.richiesta === 'string' && typeof p.firma === 'string' && p.campi ? p : null
  } catch { return null }
}

export default function AccontoCompilazioneVista({ id, cantiereId, cantiere, utenteId, onChiudi, onPersistito, annotazioneGestionale = false }: {
  id?: string; cantiereId?: string; cantiere?: string; utenteId: string; onChiudi: () => void; onPersistito: () => Promise<unknown>; annotazioneGestionale?: boolean
}) {
  const chiavePendente = `artecna-acconto-compilazione:${utenteId}:${id ?? cantiereId}`
  const [pendente] = useState(() => recuperaPendente(chiavePendente))
  const [uuid] = useState(() => id ?? pendente?.id ?? crypto.randomUUID())
  const [record, setRecord] = useState<AccontoPersistito | null>(null)
  const [campi, setCampi] = useState<CampiAcconto>(pendente?.campi ?? { descrizione: '', importo: '', data_incasso: '', metodo: '', nota: '' })
  const [caricato, setCaricato] = useState(!id)
  const [documentato, setDocumentato] = useState(true)
  const [modo, setModo] = useState<'netto' | 'lordo'>(pendente?.proposta ? 'lordo' : 'netto')
  const [lordo, setLordo] = useState(pendente?.proposta ? String(pendente.proposta.lordo) : '')
  const [aliquota, setAliquota] = useState(pendente?.proposta ? String(pendente.proposta.aliquota) : '')
  const [conferma, setConferma] = useState(false)
  const [errore, setErrore] = useState('')
  const [occupato, setOccupato] = useState(false)
  const blocco = useRef(false)
  const focusOrigine = useRef<HTMLElement | null>(typeof document === 'undefined' ? null : document.activeElement as HTMLElement)
  const richiesta = useRef<{ firma: string; uuid: string } | null>(pendente ? { firma: pendente.firma, uuid: pendente.richiesta } : null)

  useEffect(() => {
    let attivo = true
    if (!id) return
    void (async () => {
      const r = await supabase.rpc('leggi_acconto_compilazione', { p_id: id })
      if (!attivo) return
      if (r.error || !r.data?.acconto) { setErrore('Acconto non disponibile: verifica anche la disponibilità della migrazione separata. Nessuna modifica consentita.'); return }
      const a = r.data.acconto as AccontoPersistito
      setRecord(a); setCaricato(true)
      if (pendente?.richiesta === a.compilazione_unica?.richiesta) {
        richiesta.current = null; sessionStorage.removeItem(chiavePendente); setCampi(campiAcconto(a)); setModo('netto')
      } else setCampi(pendente?.campi ?? campiAcconto(a))
      const p = propostaAcconto(a)
      if (p && !pendente) { setLordo(String(p.lordo)); setAliquota(String(p.aliquota)) }
      setDocumentato(r.data.documentato !== false)
    })().catch(() => { if (attivo) setErrore('Lettura non disponibile. Riapri per riprovare.') })
    return () => { attivo = false }
  }, [id, pendente, chiavePendente])

  let calcolo: ReturnType<typeof scorporoAcconto> | null = null
  if (modo === 'lordo') { try { calcolo = scorporoAcconto(lordo, aliquota) } catch { /* incomplete input */ } }
  const cambia = (nome: keyof CampiAcconto, valore: string) => { setCampi(c => ({ ...c, [nome]: valore })); setConferma(false) }

  async function salva(e: FormEvent) {
    e.preventDefault()
    if (blocco.current || !caricato) return
    setErrore('')
    try {
      const nuovo = { ...campi, importo: modo === 'lordo' ? String(scorporoAcconto(lordo, aliquota).imponibile) : campi.importo }
      if (!record || nuovo.importo !== String(record.importo ?? '')) centesimi(nuovo.importo)
      const patch = modificheAcconto(nuovo, record)
      const sensibile = ['importo', 'data_incasso', 'metodo'].some(k => k in patch)
      if (record && sensibile && documentato) throw Error('Dati già documentati: usa i percorsi di rettifica. Puoi modificare descrizione e note.')
      if (record && sensibile && !conferma) throw Error('Conferma la nuova verifica dei dati modificati.')
      if (record && !Object.keys(patch).length && modo !== 'lordo') { setErrore('Nessun campo modificato.'); return }
      const proposta = modo === 'lordo' ? { lordo: scorporoAcconto(lordo, aliquota).lordo, aliquota: Number(aliquota) } : null
      const args = { p_id: uuid, p_cantiere: record?.cantiere_id ?? cantiereId,
        p_originale: record ? originaleAcconto(record) : null, p_modifiche: patch, p_proposta: proposta }
      if (!args.p_cantiere) throw Error('Cantiere non verificabile: nessuna scrittura.')
      const firma = JSON.stringify(args)
      if (richiesta.current && richiesta.current.firma !== firma) throw Error('Esito precedente non verificato: recupera gli stessi dati prima di cambiarli.')
      richiesta.current ??= { firma, uuid: crypto.randomUUID() }
      sessionStorage.setItem(chiavePendente, JSON.stringify({ id: uuid, richiesta: richiesta.current.uuid, firma, campi: nuovo, proposta } satisfies Pendente))
      blocco.current = true; setOccupato(true)
      const r = await supabase.rpc('salva_acconto_compilazione', { ...args, p_richiesta: richiesta.current.uuid })
      if (r.error) {
        if (['22023','23514','42501','40001','23505','PGRST202'].includes(r.error.code)) {
          richiesta.current = null; sessionStorage.removeItem(chiavePendente)
        }
        throw Error(r.error.code === 'PGRST202' ? 'Writer non disponibile: la migrazione separata deve essere autorizzata e installata prima di usare questo flusso.' : r.error.message)
      }
      // L'UUID resta quello originale. Nessuna conferma fiscale/finanziaria automatica.
      const lettura = await supabase.rpc('leggi_acconto_compilazione', { p_id: uuid })
      if (lettura.error || !lettura.data?.acconto) throw Error('Salvataggio da verificare: ripeti soltanto la stessa richiesta.')
      const a = lettura.data.acconto as AccontoPersistito
      setDocumentato(lettura.data.documentato !== false)
      setRecord(a); setCampi(campiAcconto(a)); setModo('netto'); setConferma(false); richiesta.current = null
      sessionStorage.removeItem(chiavePendente)
      await onPersistito()
      setErrore('Acconto salvato. Stato fiscale e pagamento richiedono ancora le tue conferme esplicite.')
    } catch (error) { setErrore(error instanceof Error ? error.message : 'Esito non verificato: nessun nuovo tentativo con dati diversi.') }
    finally { blocco.current = false; setOccupato(false) }
  }

  function chiudi() {
    if (blocco.current) return
    if (richiesta.current) { setErrore('Esito da verificare: recupera il salvataggio con gli stessi dati prima di chiudere.'); return }
    onChiudi()
  }
  return <VistaOperativa titolo={id || record ? 'Modifica acconto' : 'Registra acconto'} contesto={cantiere}
    onChiudi={chiudi} occupata={occupato} ritornoFocusRef={focusOrigine} etichettaRitorno="← Torna agli acconti">
    <span data-acconto-compilazione="true" />
    <style>{`
      #area-lavoro-principale:has(> [data-attivita-operativa] [data-acconto-compilazione]) > [data-attivita-operativa]:not(:has([data-acconto-compilazione])) { display: none !important; }
      .acconto-compilazione-form { display: grid; gap: 12px; max-width: 760px; }
      .acconto-compilazione-form label { display: grid; gap: 4px; }
      .acconto-compilazione-form input, .acconto-compilazione-form select, .acconto-compilazione-form textarea { max-width: 100%; min-width: 0; box-sizing: border-box; }
      .acconto-compilazione-form button { min-height: 44px; }
    `}</style>
    {errore && <p role="status">{errore}</p>}
    {caricato && <form onSubmit={salva}><fieldset className="acconto-compilazione-form" disabled={occupato}>
      <label>Descrizione <input value={campi.descrizione} maxLength={500} onChange={e => cambia('descrizione', e.target.value)} /></label>
      <label>Importo inserito <select value={modo} disabled={!!record && documentato} onChange={e => setModo(e.target.value as 'netto' | 'lordo')}>
        <option value="netto">Imponibile</option><option value="lordo">Lordo con aliquota esplicita</option>
      </select></label>
      {modo === 'netto' ? <label>Imponibile <input required={!record} inputMode="decimal" placeholder="Da verificare" value={campi.importo} disabled={!!record && documentato} onChange={e => cambia('importo', e.target.value)} /></label> : <>
        <label>Importo lordo <input required inputMode="decimal" value={lordo} onChange={e => { setLordo(e.target.value); setConferma(false) }} /></label>
        <label>Aliquota IVA <select required value={aliquota} onChange={e => { setAliquota(e.target.value); setConferma(false) }}>
          <option value="">Da verificare</option>{[0,4,5,10,22].map(n => <option value={String(n)} key={n}>{n}%</option>)}
        </select></label>
        <p>Calcolo proposto: imponibile {calcolo?.imponibile.toFixed(2) ?? 'Da verificare'} · IVA {calcolo?.iva.toFixed(2) ?? 'Da verificare'}. Non conferma un incasso.</p>
      </>}
      {modo === 'netto' && <p>Lordo e IVA: Da verificare. Le proposte salvate sono disponibili nelle fasi successive.</p>}
      <label>Data <input type="date" value={campi.data_incasso} disabled={!!record && documentato} onChange={e => cambia('data_incasso', e.target.value)} /></label>
      <label>Metodo <input value={campi.metodo} maxLength={100} disabled={!!record && documentato} onChange={e => cambia('metodo', e.target.value)} /></label>
      {annotazioneGestionale && <p>Puoi annotare nelle note una scelta gestionale, ad esempio «Fattura non prevista», con la motivazione. La nota non conferma un incasso, non regolarizza la posizione fiscale e non disattiva avvisi o scadenze.</p>}
      <label>{annotazioneGestionale ? 'Note / scelta gestionale' : 'Note'} <textarea value={campi.nota} maxLength={4000} onChange={e => cambia('nota', e.target.value)} /></label>
      {record && documentato ? <p>Importo, data e metodo protetti. Usa le rettifiche fiscali e finanziarie esistenti.</p> : record && <label><input type="checkbox" checked={conferma} onChange={e => setConferma(e.target.checked)} /> Confermo la nuova verifica dei dati economici modificati.</label>}
      <button type="submit">{occupato ? 'Salvataggio…' : record ? 'Salva modifiche' : 'Registra acconto'}</button>
      <button type="button" onClick={chiudi}>Annulla</button>
    </fieldset></form>}
    {record && <div key={record.compilazione_unica?.richiesta ?? record.id}>
      <ContrattoFiscalePanel id={record.id} acconto dataIncasso={record.data_incasso} descrizione={record.descrizione} proposta={propostaAcconto(record)} />
      <IncassiLordiPanel id={record.id} contesto="acconto" netto={record.importo} accontoPersistito={record} />
    </div>}
  </VistaOperativa>
}
