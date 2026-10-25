'use client'

import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Rapportino } from '../types'
import type { EsitoSalvataggioRapportino } from '../engines/rapportini/contrattoServizio'
import { letturaPortaleValida } from '../engines/rapportini/validaLetturaPortale'

const ore = (valore: number) => {
  const minuti = Math.round(valore * 60)
  return `${Math.floor(minuti / 60)}:${String(minuti % 60).padStart(2, '0')} h`
}

/** Proiezione del solo DTO di lettura: le ore autorevoli sono quelle della RPC. */
export function DettaglioPrestazioniRapportinoV1({ dettaglio }: { dettaglio: EsitoSalvataggioRapportino }) {
  const gruppi = new Map<string, typeof dettaglio.prestazioni[number][]>()
  for (const p of dettaglio.prestazioni) {
    if (p.rimossa_at !== null) continue
    if (!gruppi.has(p.operaio_id)) gruppi.set(p.operaio_id, [])
    gruppi.get(p.operaio_id)!.push(p)
  }
  return <div>{Array.from(gruppi, ([id, righe]) => {
    const ordinario = righe.filter(p => !p.lavoro_in_economia).reduce((n, p) => n + p.ore, 0)
    const economia = righe.filter(p => p.lavoro_in_economia).reduce((n, p) => n + p.ore, 0)
    return <section key={id} aria-label={'Prestazioni di ' + righe[0].operaio_nome}>
      <h4>{righe[0].operaio_nome}</h4>
      <ul>{righe.map(p => <li key={p.prestazione_id}>
        {p.ora_inizio}–{p.ora_fine} — {p.lavoro_in_economia ? 'Economia' : 'Ordinario'} — {ore(p.ore)}
        {p.pausa_minuti > 0 ? ` · Pausa ${p.pausa_minuti} min` : ''}
        {p.lavoro_in_economia && p.variante_id ? ` · Variante ${p.variante_id}` : ''}
      </li>)}</ul>
      <p>Totale: {ore(ordinario + economia)} — Ordinario: {ore(ordinario)} — Economia: {ore(economia)}</p>
    </section>
  })}</div>
}

export default function RapportinoPrestazioniLetturaV1({ rapportino }: { rapportino: Rapportino }) {
  const [dettaglio, setDettaglio] = useState<EsitoSalvataggioRapportino | null>(null)
  const [caricamento, setCaricamento] = useState(false)
  const [messaggio, setMessaggio] = useState('')
  const occupato = useRef(false)
  async function carica() {
    if (occupato.current || rapportino.versione_prestazioni !== 1 || !rapportino.id || !rapportino.cantiere_id) return
    occupato.current = true; setCaricamento(true); setMessaggio('')
    try {
      const r = await supabase.rpc('leggi_rapportino_desktop', { p_cantiere_id: rapportino.cantiere_id,
        p_data: rapportino.data, p_rapportino_id: rapportino.id, p_versione_lettura: 1 })
      if (r.error || !letturaPortaleValida(r.data, { cantiere_id: rapportino.cantiere_id,
        data: rapportino.data, rapportino_id: rapportino.id })) throw Error('Dettaglio non disponibile')
      if (r.data.versione_prestazioni === 1) setDettaglio(r.data.dettaglio)
      else setMessaggio('Dettaglio prestazioni non disponibile. Resta valido il riepilogo storico.')
    } catch { setMessaggio('Dettaglio prestazioni non disponibile. Resta visibile il riepilogo del rapportino; puoi riprovare.') }
    finally { occupato.current = false; setCaricamento(false) }
  }
  if (rapportino.versione_prestazioni !== 1) return null
  return <section aria-label="Dettaglio prestazioni in sola lettura">
    <button type="button" disabled={caricamento || !rapportino.id || !rapportino.cantiere_id}
      onClick={() => { if (dettaglio) setDettaglio(null); else void carica() }}>
      {caricamento ? 'Caricamento prestazioni…' : dettaglio ? 'Nascondi prestazioni' : 'Mostra prestazioni'}
    </button>
    {messaggio && <p role="status">{messaggio}</p>}
    {dettaglio && <DettaglioPrestazioniRapportinoV1 dettaglio={dettaglio} />}
  </section>
}
