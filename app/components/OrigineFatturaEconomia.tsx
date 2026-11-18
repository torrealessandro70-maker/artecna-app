'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { verificaOrigineFattura, type OrigineFatturaEconomia as Identita } from '../engines/economia/origineFatturaEconomia'

export default function OrigineFatturaEconomia({ riga, raccoltaId, cantiereId }: {
  riga: unknown; raccoltaId: string; cantiereId: string
}) {
  const [esito, setEsito] = useState<Identita | null>(null)
  const [errore, setErrore] = useState('')
  const [caricamento, setCaricamento] = useState(false)
  const richiesta = useRef(false), attiva = useRef(true)
  useEffect(() => { attiva.current = true; return () => { attiva.current = false } }, [])
  async function verifica() {
    if (richiesta.current) return
    richiesta.current = true; setCaricamento(true)
    try {
      const id = await verificaOrigineFattura(supabase, riga, raccoltaId, cantiereId)
      if (attiva.current) setEsito(id)
    } catch (e) {
      if (attiva.current) setErrore(e instanceof Error ? e.message : 'Non verificabile: lettura non disponibile.')
    } finally { if (attiva.current) setCaricamento(false) }
  }
  return <details onToggle={e => { if (e.currentTarget.open) void verifica() }}>
    <summary>Origine fattura</summary>
    {caricamento && <p role="status">Verifica provenienza in corso…</p>}
    {errore && <p role="status">{errore}</p>}
    {esito && <div style={{ overflowWrap: 'anywhere' }}>
      <p>Provenienza verificata tramite UUID. Destinazione effettiva: Economia.</p>
      <dl>{([
        ['Fattura', esito.fatturaId], ['Riga fattura', esito.rigaFatturaId], ['Quota Economia', esito.quotaId],
        ['Registrazione', esito.registrazioneId], ['Raccolta', esito.raccoltaId], ['Cantiere', esito.cantiereId],
      ] as const).map(([label, id]) => <div key={label}><dt>{label}</dt><dd style={{ marginLeft: 0 }}>{id}</dd></div>)}</dl>
      <p>In Economia la quota e la registrazione condividono lo stesso UUID. Consultazione senza modifiche contabili.</p>
    </div>}
  </details>
}
