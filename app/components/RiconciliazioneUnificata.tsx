'use client'

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import VerificaFonteIva from './VerificaFonteIva'
import type { VerificaIva } from '../engines/contabilita-ditta/fonteIva'
import VistaOperativa from './VistaOperativa'
import { uuid } from '../engines/contabilita-ditta/attribuzioni'
import { centesimi } from '../engines/contabilita-ditta/riepilogo'
import { leggiRiconciliazione, propostaUnivoca, propostaAccontoUnivoco, ripartisci, type SnapshotRiconciliazione, type ClientRiconciliazione } from '../engines/contabilita-ditta/riconciliazioneUnificata'

type Props = { client: ClientRiconciliazione; fatturaId?: string; accontoId?: string; onChiudi: () => void; onConfermato?: () => void | Promise<void>; onPrepara?: (richiesta: Richiesta) => void | Promise<void>; ritornoFocusRef?: RefObject<HTMLElement | null> }
export type Richiesta = { rpc: 'riconcilia_acconto_fattura' | 'revoca_riconciliazione_unificata'; args: Record<string, unknown> }
const euro = (v: number | null) => v === null ? 'Non determinabile' : (v / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

export function RiconciliazioneAzione({ etichetta, ...props }: Omit<Props, 'onChiudi'> & { etichetta: string }) {
  const [aperta, setAperta] = useState(false)
  const ritorno = useRef<HTMLButtonElement | null>(null)
  return <><button ref={ritorno} type="button" onClick={() => setAperta(true)}>{etichetta}</button>
    {aperta && <RiconciliazioneUnificata {...props} ritornoFocusRef={ritorno} onChiudi={() => setAperta(false)} />}</>
}

export default function RiconciliazioneUnificata({ client, fatturaId, accontoId, onChiudi, onConfermato, onPrepara, ritornoFocusRef }: Props) {
  const [dati, setDati] = useState<SnapshotRiconciliazione | null>(null), [errore, setErrore] = useState('')
  const [fattura, setFattura] = useState(fatturaId ?? ''), [acconto, setAcconto] = useState(accontoId ?? '')
  const [incasso, setIncasso] = useState(''), [valori, setValori] = useState<Record<number, string>>({})
  const [fonte, setFonte] = useState(''), [baseVerificata, setBaseVerificata] = useState(false), [fiscale, setFiscale] = useState(false)
  const [occupata, setOccupata] = useState(false), [esito, setEsito] = useState(''), [pendente, setPendente] = useState<Richiesta | null>(null)
  const blocco = useRef(false)
  const originali = useRef<SnapshotRiconciliazione | null>(null)
  const [verificaIva,setVerificaIva]=useState<{fattura:string;dati:VerificaIva}|null>(null)
  const [journal, setJournal] = useState('')
  const [journalCorrotto, setJournalCorrotto] = useState(false)
  useEffect(() => {
    let attiva = true
    void leggiRiconciliazione(client, fatturaId, accontoId).then(d => { if (attiva) {
      originali.current=d;setDati(d)
      const key = `artecna-riconciliazione-pendente:${d.autore}`
      setJournal(key)
      if (!accontoId) setAcconto(fatturaId ? propostaAccontoUnivoco(d, fatturaId) ?? '' : d.acconti.length === 1 ? d.acconti[0].id : '')
      if (accontoId && !fatturaId) setFattura(propostaUnivoca(d, accontoId) ?? '')
      try { const raw = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Richiesta | null
        if (raw !== null) {
          if (!['riconcilia_acconto_fattura', 'revoca_riconciliazione_unificata'].includes(raw.rpc) || !uuid(raw.args?.p_richiesta)) throw Error('Journal non valido')
          setPendente(raw)
        }
      } catch { setJournalCorrotto(true);setErrore('Richiesta precedente non leggibile: verificare lo stato senza nuova conferma.') }
    } }).catch(e => { if (attiva) setErrore(e.message) })
    return () => { attiva = false }
  }, [client, fatturaId, accontoId])
  const f = dati?.fatture.find(x => x.id === fattura), a = dati?.acconti.find(x => x.id === acconto)
  const pagamenti = dati?.incassi.filter(x => x.acconto_id === acconto) ?? []
  const pagamento = pagamenti.find(x => x.id === incasso)
  let calcolo: ReturnType<typeof ripartisci> | null = null, anomalia = ''
  if (f) { try { calcolo = ripartisci(f, valori) } catch (e) { anomalia = (e as Error).message } }
  const disponibile = a ? (centesimi(a.importo) ?? 0) - (centesimi(a.attribuito) ?? 0) : null
  // An exact historical allocation may be reused by the server; never silently add it again.
  const storici = f?.collegamenti_netto.filter(x => x.acconto_id === acconto && x.attiva && !x.unificata) ?? []
  const riusaStorico = storici.length === 1 && f?.documento.gruppi?.length === 1 && calcolo?.netto === centesimi(storici[0].importo)
  const nettoCapiente = !!calcolo && disponibile !== null && (calcolo.netto <= disponibile || riusaStorico)
  const quoteLordeStoriche = f?.quote.filter(q => !q.revocata && !q.attribuzione_id && q.incasso_id === incasso) ?? []
  const riusaQuotaLorda = quoteLordeStoriche.length === 1 && calcolo?.lordo === centesimi(quoteLordeStoriche[0].importo)
  const lordoCapiente = !!calcolo && (incasso === 'nuovo' ? true : !!pagamento && ((centesimi(pagamento.disponibile) ?? 0) >= calcolo.lordo || riusaQuotaLorda))
  async function invia(richiesta: Richiesta) {
    if (blocco.current) return
    blocco.current = true; setOccupata(true); setErrore('')
    let confermata = false
    try {
      if (onPrepara) {
        if (pendente || richiesta.rpc !== 'riconcilia_acconto_fattura') throw Error('Operazione precedente o revoca da verificare nel percorso dedicato.')
        await onPrepara(richiesta);onChiudi();return
      }
      if (!journal || journalCorrotto) throw Error('Identità utente o journal non verificabile: nessuna richiesta inviata.')
      sessionStorage.setItem(journal, JSON.stringify(richiesta));setPendente(richiesta)
      const r = await client.rpc(richiesta.rpc, richiesta.args)
      if (r.error) {
        if (['23514','23505','22023','42501','40001','22P02','PGRST202'].includes(r.error.code ?? '')) { sessionStorage.removeItem(journal);setPendente(null) }
        throw Error(`Operazione non confermata (${r.error.code ?? 'rete'}). Nessun nuovo invio automatico.`)
      }
      const risultato = r.data as { confermato?: boolean; richiesta?: string; fiscale?: { stato?: string }; revocata?: boolean } | null
      if (risultato?.confermato !== true || risultato?.richiesta !== richiesta.args.p_richiesta) throw Error('Risposta incerta: verifica la stessa richiesta, senza crearne un’altra.')
      confermata = true;sessionStorage.removeItem(journal);setPendente(null);setValori({});setBaseVerificata(false)
      setEsito(`Operazione confermata. Stato fiscale: ${risultato.fiscale?.stato ?? 'Da verificare'}${risultato.revocata ? ' · Collegamenti revocati.' : ''}`)
      originali.current=await leggiRiconciliazione(client, fatturaId, accontoId);setDati(originali.current);setValori({});setBaseVerificata(false);setVerificaIva(null)
      await onConfermato?.()
      for (const evento of ['artecna-incassi-lordi-aggiornati','artecna-clienti-incassi-aggiornati','artecna-fatture-emesse-aggiornate']) window.dispatchEvent(new Event(evento))
    } catch (e) { if (confermata) { setDati(null);setErrore('Operazione confermata; rilettura non riuscita. Riapri senza ripetere la riconciliazione.') } else setErrore((e as Error).message) } finally { blocco.current = false;setOccupata(false) }
  }
  function conferma(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!f || !a || !calcolo || !baseVerificata || !nettoCapiente || !lordoCapiente || pendente) return
    const form = new FormData(e.currentTarget)
    const nuovo = incasso === 'nuovo' ? { importo: String(form.get('lordo')).replace(',', '.'), data: form.get('data'),
      metodo: form.get('metodo'), riferimento: form.get('riferimento'), fonte: form.get('fonte_pagamento'), verificato: form.get('pagamento_verificato') === 'on', distinto: form.get('pagamento_distinto') === 'on' } : null
    void invia({ rpc: 'riconcilia_acconto_fattura', args: { p_richiesta: crypto.randomUUID(), p_fattura: f.id, p_acconto: a.id,
      p_incasso: nuovo ? null : incasso, p_nuovo: nuovo, p_allocazioni: calcolo.allocazioni, p_impronta: f.documento.impronta,
      p_verifica: verificaIva?.fattura===f.id?verificaIva.dati:null, p_fonte_base: fonte, p_conferma_fiscale: fiscale && (calcolo.netto === disponibile || riusaStorico && a.importo === a.attribuito) } })
  }
  return <VistaOperativa titolo="Riconcilia acconto e fattura" etichettaRitorno="← Torna al riepilogo" onChiudi={onChiudi} occupata={occupata || !!pendente} ritornoFocusRef={ritornoFocusRef}>
    {errore && <p role="alert">{errore}</p>}{esito && <p role="status">{esito}</p>}
    <p>Acconto contrattuale, pagamento lordo e copertura fiscale restano distinti. Nessuna fattura prova da sola l’incasso.</p>
    {onPrepara && <p>Preparazione nel lotto Bluenext: nessuna scrittura fino alla conferma complessiva.</p>}
    {pendente && <p>Richiesta da verificare. <button disabled={occupata} onClick={() => void invia(pendente)}>Verifica stessa richiesta</button></p>}
    {!dati && !errore && <p role="status">Caricamento dati autorizzati…</p>}
    {dati && <form data-riconciliazione onSubmit={conferma}><fieldset disabled={occupata || !!pendente || journalCorrotto} style={{ display: 'grid', gap: 12, minWidth: 0, border: 0, padding: 0 }}>
      <p>Cantiere: <strong>{dati.cantiere}</strong></p>
      <label>Acconto <select required value={acconto} onChange={e => { setAcconto(e.target.value);setIncasso('');setValori({});setBaseVerificata(false);setVerificaIva(null);if(originali.current)setDati(originali.current);if (!fatturaId) setFattura(propostaUnivoca(dati,e.target.value) ?? '') }}><option value="">Seleziona l’acconto</option>{dati.acconti.map(x => <option value={x.id} key={x.id}>{x.data} · {x.descrizione} · {euro(centesimi(x.importo))}</option>)}</select></label>
      <label>Fattura emessa <select required value={fattura} onChange={e => { setFattura(e.target.value);setValori({});setBaseVerificata(false);setVerificaIva(null);if(originali.current)setDati(originali.current) }}><option value="">Abbinamento non univoco: seleziona la fattura</option>{dati.fatture.map(x => <option value={x.id} key={x.id}>{x.numero} · {x.data} · {x.cliente} · {euro(centesimi(x.totale))}</option>)}</select></label>
      {a && <p>Imponibile contrattuale: {euro(centesimi(a.importo))} · Quote contrattuali attive: {euro(centesimi(a.attribuito))} · Disponibilità: {euro(disponibile)} · Stato fiscale: {a.fiscale.stato}</p>}
      {f && <><p>Lordo fattura: {euro(centesimi(f.totale))} · SdI: {f.sdi.esito ?? 'Da verificare'}</p>
        {!f.documento.valida ? <><p role="alert">{f.documento.motivo}</p><VerificaFonteIva onVerifica={async v=>{setOccupata(true);setErrore('');try{const fresh=await leggiRiconciliazione(client,f.id,accontoId,v);const doc=fresh.fatture.find(x=>x.id===f.id)?.documento;if(!doc?.valida)throw Error(doc?.motivo??'Fonte non verificabile');setDati(fresh);setVerificaIva({fattura:f.id,dati:v});setValori({});setBaseVerificata(false)}catch(e){setErrore((e as Error).message)}finally{setOccupata(false)}}}/></> : <><p>Fonte: {f.documento.fonte}</p><p>{f.documento.canonico?.motivo}</p>
          {f.documento.gruppi?.map(g => <label key={g.indice}>Quota imponibile — IVA {g.aliquota === null ? 'aggregata, aliquota non determinabile' : `${g.aliquota}%`}{g.natura ? ` · ${g.natura}` : ''} (documento: {euro(centesimi(g.imponibile))} + IVA {euro(centesimi(g.iva))})
            <input inputMode="decimal" value={valori[g.indice] ?? ''} onChange={e => setValori(v => ({ ...v, [g.indice]: e.target.value }))} /></label>)}
          <p>Quote proposte: imponibile {euro(calcolo?.netto ?? null)} · IVA documentale {euro(calcolo?.iva ?? null)} · Lordo {euro(calcolo?.lordo ?? null)}</p>
        </>}
        {anomalia && <p role="status">{anomalia}</p>}
        {calcolo && !nettoCapiente && <p role="alert">Quota superiore alla disponibilità contrattuale. Un collegamento storico richiede verifica esatta del server.</p>}
        <details><summary>Collegamenti finanziari già registrati</summary>{f.quote.map(q => <p key={q.id}>{euro(centesimi(q.importo))} · {q.revocata ? 'Revocata' : 'Attiva'} {q.attribuzione_id && !q.revocata && <button type="button" onClick={() => { if (window.confirm('Revocare insieme quota lorda e collegamento contrattuale? Il pagamento rimane registrato.')) void invia({ rpc:'revoca_riconciliazione_unificata',args:{p_richiesta:crypto.randomUUID(),p_quota:q.id} }) }}>Revoca riconciliazione</button>}</p>)}</details>
      </>}
      <label>Pagamento lordo <select aria-label="Pagamento lordo" required value={incasso} onChange={e => setIncasso(e.target.value)}><option value="">Seleziona il pagamento verificato</option>{pagamenti.map(x => <option key={x.id} value={x.id}>{x.ricevuto_il} · {x.riferimento} · Disponibile {euro(centesimi(x.disponibile))}</option>)}<option value="nuovo">Conferma un nuovo pagamento effettivo documentato</option></select></label>
      {riusaQuotaLorda && <p>La quota lorda già collegata verrà riutilizzata, senza duplicarla.</p>}
      {riusaStorico && <p>Il collegamento contrattuale storico esatto verrà riutilizzato, senza aumentarne l’importo.</p>}
      {pagamento && <p>Incasso verificato {euro(centesimi(pagamento.importo))} · Disponibile {euro(centesimi(pagamento.disponibile))}</p>}
      {incasso === 'nuovo' && <>{pagamenti.length > 0 && <label><input type="checkbox" name="pagamento_distinto" required />Ho confrontato i pagamenti elencati: questo è un pagamento distinto, con proprio riferimento documentale.</label>}<label>Lordo effettivamente ricevuto <input name="lordo" required inputMode="decimal" /></label><label>Data effettiva <input name="data" type="date" required /></label>
        <label>Metodo <select name="metodo" required><option value="">Seleziona</option><option value="bonifico">Bonifico</option><option value="contanti">Contanti</option><option value="altro">Altro</option></select></label>
        <label>Riferimento univoco <input name="riferimento" required maxLength={200} /></label><label>Fonte della verifica del pagamento <input name="fonte_pagamento" required maxLength={200} /></label>
        <label><input type="checkbox" name="pagamento_verificato" required />Ho verificato il pagamento effettivo: la fattura non costituisce questa prova.</label></>}
      <label>Fonte documentale della base contrattuale <input value={fonte} onChange={e => setFonte(e.target.value)} required minLength={8} maxLength={500} /></label>
      <label><input type="checkbox" checked={baseVerificata} onChange={e => setBaseVerificata(e.target.checked)} required />Ho verificato che la quota dell’acconto sia imponibile, non lordo. Nessuna riclassificazione automatica dello storico.</label>
      <label><input type="checkbox" checked={fiscale} disabled={!calcolo || !(calcolo.netto === disponibile || riusaStorico && a?.importo === a?.attribuito)} onChange={e => setFiscale(e.target.checked)} />Confermo anche incasso e regime fiscale ordinario sulla fonte verificata. Lo stato SdI non verrà modificato.</label>
      <button type="submit" disabled={!calcolo || !baseVerificata || fonte.trim().length < 8 || !nettoCapiente || !lordoCapiente}>{onPrepara ? 'Aggiungi proposta al lotto' : 'Conferma riconciliazione unica'}</button>
      <p>La regolarizzazione fiscale richiede evidenza SdI valida. In sua assenza restano visibili pendenza e avvisi.</p>
    </fieldset></form>}
    <style>{`[data-riconciliazione] label{display:grid;gap:6px;min-width:0}[data-riconciliazione] input:not([type=checkbox]),[data-riconciliazione] select{box-sizing:border-box;width:100%;min-width:0;max-width:100%;min-height:44px}[data-riconciliazione] label:has(input[type=checkbox]){display:flex;align-items:flex-start}[data-riconciliazione] button{min-height:44px;white-space:normal}`}</style>
  </VistaOperativa>
}
