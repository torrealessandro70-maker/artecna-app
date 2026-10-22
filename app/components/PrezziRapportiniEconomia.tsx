'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { confermaTariffeSequenziali, leggiTariffeManodopera, prezzoClienteManodopera, totaleValorizzazione, type TariffaManodopera } from '../engines/economia/valorizzaManodopera'

type Riga = { id: string; ordine: number; descrizione: string; um: string; quantita: number; prezzo: number | null; note: string | null; origine: string }
export default function PrezziRapportiniEconomia({ raccolta, righe, onRileggi, onEsito, onInvio, solaLettura = false }: {
  raccolta: { id: string; revisione: number; stato: string }; righe: Riga[]; onRileggi: () => Promise<void>
  onEsito?: (messaggio: string) => void; onInvio?: (busy: boolean) => void; solaLettura?: boolean
}) {
  const [prezzi, setPrezzi] = useState<Record<string, string>>({})
  const [tariffaTutte, setTariffaTutte] = useState('')
  const [tariffe, setTariffe] = useState<TariffaManodopera[]>([])
  const [campoSuggerimenti, setCampoSuggerimenti] = useState<string | null>(null)
  const [erroreTariffe, setErroreTariffe] = useState('')
  const [caricaTariffe, setCaricaTariffe] = useState(false)
  const [conferma, setConferma] = useState(false)
  const [invio, setInvio] = useState(false)
  const [messaggio, setMessaggio] = useState('')
  const [bloccata, setBloccata] = useState(false)
  const lock = useRef(false), attiva = useRef(true), letturaTariffe = useRef(0)
  useEffect(() => { attiva.current = true; return () => { attiva.current = false; letturaTariffe.current++ } }, [])
  const sorgenti = righe.filter(r => r.origine === 'rapportino' && r.um === 'h')
  if (!sorgenti.length || raccolta.stato !== 'bozza' || solaLettura) return null
  const modifiche = sorgenti.filter(r => Object.hasOwn(prezzi, r.id))
  const validi = modifiche.length > 0 && modifiche.every(r => prezzoClienteManodopera(prezzi[r.id]) !== null)
  const testoPrezzo = (r: Riga) => prezzi[r.id] ?? (r.prezzo === null ? '' : String(r.prezzo))
  const totali = sorgenti.map(r => totaleValorizzazione(r.quantita, testoPrezzo(r)))
  const sommaCentesimi = totali.reduce<number>((s, n) => s + (n === null ? 0 : Math.round(n * 100)), 0)
  const incompleto = totali.some(t => t === null) || !Number.isSafeInteger(sommaCentesimi)
  const euro = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
  const modifica = (id: string, valore: string) => { setPrezzi(p => ({ ...p, [id]: valore })); setConferma(false) }
  async function suggerisci(id: string) {
    const token = ++letturaTariffe.current
    setCampoSuggerimenti(id); setCaricaTariffe(true); setErroreTariffe('')
    try { const dati = await leggiTariffeManodopera(supabase); if (attiva.current && token === letturaTariffe.current) setTariffe(dati) }
    catch { if (attiva.current && token === letturaTariffe.current) { setTariffe([]); setErroreTariffe('Suggerimenti non disponibili. Inserisci manualmente la tariffa.') } }
    finally { if (attiva.current && token === letturaTariffe.current) setCaricaTariffe(false) }
  }
  async function salva() {
    if (lock.current || bloccata || !conferma || !validi) return
    const daSalvare = modifiche.map(r => ({ id: r.id, prezzo: prezzi[r.id] }))
    lock.current = true; setInvio(true); setConferma(false); setMessaggio(''); onInvio?.(true)
    try {
      const esito = await confermaTariffeSequenziali(supabase, raccolta, daSalvare, () => attiva.current)
      if (!attiva.current) return
      setBloccata(true); setMessaggio(esito.messaggio); onEsito?.(esito.messaggio)
      if (esito.confermate > 0) await suggerisci(campoSuggerimenti ?? sorgenti[0].id)
      if (attiva.current) {
        try { await onRileggi() }
        catch { const testo = esito.messaggio + ' Rilettura non disponibile: usa Rileggi raccolta.'; setMessaggio(testo); onEsito?.(testo) }
      }
    } catch {
      if (attiva.current) {
        const testo = 'Esito non verificabile. Rileggi lo stato server prima di riprovare.'
        setBloccata(true); setMessaggio(testo); onEsito?.(testo)
        try { await onRileggi() } catch { /* sola rilettura manuale, mai reinviare il writer */ }
      }
    } finally { onInvio?.(false); if (attiva.current) setInvio(false) /* lock resta bloccato fino alla rilettura */ }
  }
  return <section aria-label="Prezzi fatturabili Rapportini">
    <h5>Prezzi fatturabili delle ore da Rapportino</h5>
    <p>Conferma la tariffa cliente. Le ore, il Rapportino e il costo interno restano immutati.</p>
    <label>Tariffa €/h per tutte le righe <input aria-label="Tariffa per tutte" inputMode="decimal" value={tariffaTutte} disabled={invio || bloccata} onChange={e => setTariffaTutte(e.target.value)} /></label>{' '}
    <button type="button" disabled={invio || bloccata || !prezzoClienteManodopera(tariffaTutte) || !sorgenti.some(r => r.prezzo === null)} onClick={() => {
      setPrezzi(p => ({ ...p, ...Object.fromEntries(sorgenti.filter(r => r.prezzo === null).map(r => [r.id, tariffaTutte])) })); setConferma(false)
    }}>Applica a tutte</button>
    <p>Applica solo alle righe ancora senza prezzo; nessun salvataggio automatico.</p>
    {sorgenti.map((r, i) => <div key={r.id} style={{ marginTop: 10 }}>
      <label style={{ display: 'block' }}>{r.descrizione} · {r.quantita} ore · Prezzo €/h
        <input aria-label={'Prezzo fatturabile ' + r.id} inputMode="decimal" disabled={invio || bloccata} value={testoPrezzo(r)}
          onChange={e => modifica(r.id, e.target.value)} onFocus={() => { void suggerisci(r.id) }} />
      </label>
      <p>{r.quantita.toLocaleString('it-IT')} h × {prezzoClienteManodopera(testoPrezzo(r)) ? Number(testoPrezzo(r).replace(',', '.')).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) + ' €/h' : '—'} = {totali[i] === null ? 'Da valorizzare' : euro(totali[i]!)}</p>
      {campoSuggerimenti === r.id && <div aria-label={'Suggerimenti ' + r.id}><strong>Suggerimenti</strong>
        {caricaTariffe ? <p role="status">Caricamento tariffe…</p> : erroreTariffe ? <p role="status">{erroreTariffe}</p> : !tariffe.length ? <p>Nessuna tariffa confermata.</p> : <ul>{tariffe.map((t, index) => <li key={t.prezzo}>
          <button type="button" disabled={invio || bloccata} onClick={() => modifica(r.id, t.prezzo.replace('.', ','))}>{Number(t.prezzo).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} €/h</button>{' '}
          {index === 0 ? 'Ultimo utilizzato' : `Usato ${t.numeroUtilizzi} ${t.numeroUtilizzi === 1 ? 'volta' : 'volte'}`}
        </li>)}</ul>}
      </div>}
    </div>)}
    <p aria-live="polite">Totale da contabilizzare: <strong>{incompleto ? 'Totale incompleto' : euro(sommaCentesimi / 100)}</strong>{incompleto && Number.isSafeInteger(sommaCentesimi) ? ` · Subtotale righe valorizzate: ${euro(sommaCentesimi / 100)}` : ''}</p>
    {messaggio && <p role="status">{messaggio}</p>}
    {bloccata ? <button type="button" disabled={invio} onClick={() => void onRileggi()}>Rileggi raccolta</button>
      : conferma ? <><p>Confermi le tariffe di {modifiche.length} righe? I salvataggi sono sequenziali; in caso di errore quelli già riusciti restano confermati.</p><button type="button" disabled={invio} onClick={() => { void salva() }}>Conferma valorizzazione</button><button type="button" disabled={invio} onClick={() => setConferma(false)}>Annulla</button></>
      : <button type="button" disabled={!validi || invio} onClick={() => setConferma(true)}>Verifica prezzi</button>}
  </section>
}
