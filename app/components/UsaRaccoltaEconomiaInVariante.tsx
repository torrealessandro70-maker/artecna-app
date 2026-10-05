'use client'

import { useEffect, useRef, useState } from 'react'
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

export default function UsaRaccoltaEconomiaInVariante({ raccolta, varianti, elencoPronto, onRileggi, onApri }: {
  raccolta: RaccoltaPonteEconomia; varianti: readonly string[]; elencoPronto: boolean
  onRileggi: () => Promise<void>; onApri: (id: string) => void
}) {
  const [collegata, setCollegata] = useState<string | null>(null)
  const [verifica, setVerifica] = useState(true)
  const [erroreLettura, setErroreLettura] = useState('')
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)
  const [esito, setEsito] = useState<EsitoPonteEconomia | null>(null)
  const [rilettura, setRilettura] = useState(0)
  const occupato = useRef(false), attivo = useRef(true)
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
    if (occupato.current || verifica || erroreLettura || collegata || esito || !raccoltaPonteValida(raccolta)) return
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
      const consentiti = ['22023','42501','PT409','XX001',undefined].map(errorePonteEconomia)
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
  return <section aria-label="Usa raccolta in Variante">
    {esito && <p role="status">{esito.riutilizzata ? 'Variante già creata. È stata riaperta.' : 'Variante creata dai lavori in economia.'}
      {' '}{esito.numero_variante === null ? 'Variante' : `Variante n. ${esito.numero_variante}`} · {esito.stato_variante} · {esito.numero_lavorazioni} lavorazioni · {esito.totale.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</p>}
    {errore && <p role="alert">{errore}</p>}
    {id ? <button type="button" disabled={invio} onClick={() => onApri(id)}>Apri variante</button> : <>
      {verifica && <p role="status">Verifica collegamento Variante...</p>}
      {erroreLettura && <div role="alert">{erroreLettura}<button type="button" onClick={() => setRilettura(v => v + 1)}>Riprova collegamento</button></div>}
      {!verifica && !erroreLettura && raccoltaPonteValida(raccolta) && <button type="button" disabled={invio} onClick={() => void usa()}>{invio ? 'Creazione Variante...' : 'Usa in Variante'}</button>}
    </>}
  </section>
}
