'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { salvaPrezzoMateriale, totaleClienteMateriale, type RigaPrezzoMateriale } from '../engines/economia/prezzoMaterialeCliente'

export default function PrezziMaterialiEconomia({ raccolta, righe, bloccato, onInvio, onRileggi }: {
  raccolta: { id: string; revisione: number; stato: string }; righe: readonly RigaPrezzoMateriale[]
  bloccato: boolean; onInvio: (busy: boolean) => void; onRileggi: () => Promise<void>
}) {
  const [aperta, setAperta] = useState<string | null>(null), [prezzo, setPrezzo] = useState('')
  const [messaggio, setMessaggio] = useState(''), [invio, setInvio] = useState(false), [riletturaRichiesta, setRiletturaRichiesta] = useState(false)
  const lock = useRef(false), mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function salva(r: RigaPrezzoMateriale) {
    if (lock.current || bloccato || raccolta.stato !== 'bozza' || riletturaRichiesta || totaleClienteMateriale(r.quantita, prezzo) === null) return
    lock.current = true; setInvio(true); setMessaggio(''); onInvio(true)
    try {
      await salvaPrezzoMateriale(supabase, raccolta, r, prezzo)
      if (mounted.current) setMessaggio('Prezzo cliente salvato. Rilettura della Raccolta…')
      await onRileggi()
    } catch (e) {
      if (mounted.current) setMessaggio(e instanceof Error ? e.message : 'Esito non verificabile: rileggi la Raccolta.')
    } finally {
      onInvio(false)
      if (mounted.current) { setInvio(false); setRiletturaRichiesta(true) }
      // Nessun secondo invio prima di una rilettura autorevole e della nuova revisione.
    }
  }
  const euro = (v: number | null) => v === null || !Number.isFinite(v) ? 'Non disponibile' : v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
  return <section aria-label="Prezzi fatturabili materiali">
    {raccolta.stato !== 'bozza' && <p>Raccolta congelata: prezzi non modificabili.</p>}
    {righe.map(r => <div key={r.id} style={{ marginBottom: 10, overflowWrap: 'anywhere' }}>
      <button type="button" disabled={bloccato || invio || riletturaRichiesta || raccolta.stato !== 'bozza'} onClick={() => { setAperta(r.id); setPrezzo(''); setMessaggio('') }}>Modifica prezzo fatturabile · riga {r.ordine}</button>
      {aperta === r.id && <div>
        <p>Riga {r.ordine} — {r.descrizione} · {r.quantita} {r.um}. Prezzo fatturabile attuale: {euro(r.prezzo)}.</p>
        <p>Prezzo cliente esplicito: costo, quantità e provenienza restano invariati.</p>
        <p>Valore unitario originario acquisito, sola lettura: {euro(r.prezzoOrigine)}. {r.provenienzaFattura || `Origine: ${r.origine}`}</p>
        <p>Il valore originario acquisito può includere normalizzazioni documentali; non viene modificato né usato come suggerimento del prezzo cliente.</p>
        <label>Nuovo prezzo fatturabile <input aria-label={`Nuovo prezzo fatturabile riga ${r.ordine}`} inputMode="decimal" value={prezzo} disabled={invio || bloccato || riletturaRichiesta} onChange={e => setPrezzo(e.target.value)} /></label>
        <p>Totale risultante: {euro(totaleClienteMateriale(r.quantita, prezzo))}</p>
        <button type="button" disabled={invio || bloccato || riletturaRichiesta || totaleClienteMateriale(r.quantita, prezzo) === null} onClick={() => void salva(r)}>Salva prezzo cliente</button>{' '}
        <button type="button" disabled={invio} onClick={() => setAperta(null)}>Annulla</button>
      </div>}
    </div>)}
    {messaggio && <p role="status">{messaggio}</p>}
    {riletturaRichiesta && <button type="button" disabled={invio} onClick={() => void onRileggi()}>Rileggi Raccolta prima di continuare</button>}
  </section>
}
