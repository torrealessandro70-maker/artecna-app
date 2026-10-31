'use client'

import { useEffect, useRef, useState } from 'react'
import { blocchiProposta, type RigaPrecheckProposta } from '../engines/economia/precheckProposta'
import { supabase } from '../../lib/supabaseClient'
import { errorePonteEconomia, leggiVarianteDellaRaccolta, raccoltaPonteValida, usaRaccoltaInVariante,
  type EsitoPonteEconomia, type RaccoltaPonteEconomia, type RpcPonteEconomia } from '../engines/economia/usaRaccoltaInVariante'

const rpc: RpcPonteEconomia = async (nome, parametri) => {
  if (nome !== 'leggi_sorgenti_variante') return await supabase.rpc(nome, parametri)
  const righe: unknown[] = []
  for (let offset = 0; ; offset += 200) {
    const risposta = await supabase.rpc(nome, parametri).order('id', { ascending: true }).range(offset, offset + 199)
    if (risposta.error || !Array.isArray(risposta.data)) return risposta
    righe.push(...risposta.data)
    if (risposta.data.length < 200) return { data: righe, error: null }
  }
}

export default function UsaRaccoltaEconomiaInVariante({ raccolta, righe, varianti, elencoPronto, onRileggi, onApri, operativo = false, totale, bloccato = false, statiVarianti = [] }: {
  raccolta: RaccoltaPonteEconomia; varianti: readonly string[]; elencoPronto: boolean
  righe: readonly RigaPrecheckProposta[]
  onRileggi: () => Promise<void>; onApri: (id: string) => void; operativo?: boolean; totale?: number | null; bloccato?: boolean
  statiVarianti?: readonly { id: string; titolo: string | null; stato: string }[]
}) {
  const [collegata, setCollegata] = useState<string | null>(null)
  const [verifica, setVerifica] = useState(true)
  const [erroreLettura, setErroreLettura] = useState('')
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)
  const [esito, setEsito] = useState<EsitoPonteEconomia | null>(null)
  const [rilettura, setRilettura] = useState(0)
  const occupato = useRef(false), attivo = useRef(true)
  const blocchi = righe ? blocchiProposta(righe) : []
  const datiNonPronti = !righe || righe.length === 0
  useEffect(() => { attivo.current = true; return () => { attivo.current = false } }, [])
  const identitaVarianti = JSON.stringify(varianti)
  useEffect(() => {
    let corrente = true
    setVerifica(true); setErroreLettura('')
    if (!elencoPronto) return () => { corrente = false }
    void leggiVarianteDellaRaccolta(rpc, raccolta.id, JSON.parse(identitaVarianti)).then(id => {
      if (corrente) { setCollegata(id); setVerifica(false) }
    }).catch(() => {
      if (corrente) { setErroreLettura('Impossibile verificare il collegamento alla Variante. Riprova la lettura.'); setVerifica(false) }
    })
    return () => { corrente = false }
  }, [raccolta.id, identitaVarianti, elencoPronto, rilettura])

  async function usa() {
    if (bloccato || datiNonPronti || blocchi.length > 0 || occupato.current || verifica || erroreLettura || collegata || esito || !raccoltaPonteValida(raccolta)) return
    occupato.current = true
    if (!window.confirm(`Creare una Variante dai lavori in economia della Raccolta n. ${raccolta.numero}?\n\nLa Raccolta verrà congelata e chiusa se necessario. Verrà creata una nuova Variante in bozza e le registrazioni diventeranno lavorazioni della Variante.`)) {
      occupato.current = false; return
    }
    setInvio(true); setErrore('')
    try {
      const risultato = await usaRaccoltaInVariante(rpc, raccolta)
      if (!attivo.current) return
      setEsito(risultato); setCollegata(risultato.variante_id)
      onApri(risultato.variante_id)
      try { await onRileggi() } catch {
        if (attivo.current) setErrore('Variante salvata. Rilettura della Raccolta non disponibile: riprova la lettura.')
      }
    } catch (e) {
      if (!attivo.current) return
      const consentiti = [...['22023','42501','PT409','XX001',undefined].map(c => errorePonteEconomia(c)),
        errorePonteEconomia('22023', 'Registrazione Economia non rappresentabile')]
      const messaggio = e instanceof Error && consentiti.includes(e.message) ? e.message : errorePonteEconomia()
      setErrore(messaggio)
      if (messaggio === errorePonteEconomia('PT409')) {
        try { await onRileggi() } catch { /* Il messaggio conserva la richiesta di aggiornamento. */ }
        if (attivo.current) setRilettura(v => v + 1)
      }
    } finally {
      occupato.current = false
      if (attivo.current) setInvio(false)
    }
  }
  const id = esito?.variante_id ?? collegata
  const collegamento = statiVarianti.find(v => v.id === id)
  return <section aria-label="Usa raccolta in Variante">
    {!id && blocchi.length > 0 && <div role="alert">
      <p>Proposta non disponibile. Numero di registrazioni bloccanti: {blocchi.length}. Nessuna riga verrà esclusa automaticamente.</p>
      <ul>{blocchi.map(r => <li key={r.id} style={{ overflowWrap: 'anywhere', marginBottom: 8 }}>
        <a href={`#economia-${raccolta.id}-${r.id}`}>Riga {r.ordine} — {r.descrizione || 'Descrizione mancante'}</a>
        <ul>{r.motivi.map(m => <li key={m}>{m}</li>)}</ul>
      </li>)}</ul>
    </div>}
    {!verifica && !erroreLettura && !id && raccolta.stato === 'bozza' && <p role="status">Nessuna proposta collegata a questa Raccolta è stata verificata. Eventuali altre Varianti non costituiscono conferma di questa acquisizione.</p>}
    {!id && datiNonPronti && <p role="status">Registrazioni non disponibili per la verifica preliminare.</p>}
    {esito && <p role="status">{esito.riutilizzata ? 'Variante già creata. È stata riaperta.' : operativo ? 'Bozza creata dai lavori in economia. Verifica le lavorazioni e conferma la proposta.' : 'Variante creata dai lavori in economia.'}
      {' '}{esito.numero_variante === null ? 'Variante' : `Variante n. ${esito.numero_variante}`} · {esito.stato_variante} · {esito.numero_lavorazioni} lavorazioni · {esito.totale.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</p>}
    {errore && <div role="alert"><p>{errore}</p>{!esito && <p>Creazione non confermata. Nessuna Variante è stata aperta come risultato di questa richiesta. Rileggi il collegamento prima di riprovare.</p>}</div>}
    {operativo && id && <p>{collegamento?.titolo || 'Proposta collegata'} · Stato: {collegamento?.stato || esito?.stato_variante || 'da rileggere'}</p>}
    {id ? <button type="button" disabled={invio || bloccato} onClick={() => onApri(id)}>{operativo ? 'Apri proposta' : 'Apri variante'}</button> : <>
      {verifica && <p role="status">Verifica collegamento Variante...</p>}
      {erroreLettura && <div role="alert">{erroreLettura}<button type="button" onClick={() => setRilettura(v => v + 1)}>Riprova collegamento</button></div>}
      {!verifica && !erroreLettura && raccoltaPonteValida(raccolta) && <button type="button" disabled={invio || bloccato || datiNonPronti || blocchi.length > 0} onClick={() => void usa()}>{invio ? 'Creazione Variante...' : operativo ? `Crea proposta${totale == null ? '' : ' da ' + totale.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}` : 'Usa in Variante'}</button>}
    </>}
  </section>
}
