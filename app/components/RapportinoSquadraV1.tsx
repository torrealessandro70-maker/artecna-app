'use client'

import { useRef, useState, type CSSProperties } from 'react'
import type { BozzaRapportinoV1 } from '../engines/rapportini/bozzaRapportinoV1'
import { aggiungiSquadraBozzaV1, creaSquadraBozzaV1, validaSquadraBozzaV1, type SquadraBozzaV1 } from '../engines/rapportini/squadraBozzaV1'
import { etichettaVarianteBozza, type StatoVariantiBozza } from '../engines/rapportini/variantiBozzaV1'

const input: CSSProperties = { width: '100%', minWidth: 0, boxSizing: 'border-box', padding: 10, fontSize: 16,
  border: '1px solid #cbd5e1', borderRadius: 8 }
const button: CSSProperties = { minHeight: 44, padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8 }
type Props = { bozza: BozzaRapportinoV1; operai: readonly { id: string; nome: string }[];
  varianti: StatoVariantiBozza; onChange: (b: BozzaRapportinoV1) => void;
  onRichiediVarianti?: () => void; onRiprovaVarianti: () => void; disabled: boolean }

export default function RapportinoSquadraV1({ bozza, operai, varianti, onChange, onRichiediVarianti, onRiprovaVarianti, disabled }: Props) {
  const [aperto, setAperto] = useState(false)
  const [squadra, setSquadra] = useState(creaSquadraBozzaV1)
  const [errore, setErrore] = useState('')
  const confermata = useRef(false)
  const cambia = (value: Partial<SquadraBozzaV1>) => { if (!disabled) { setSquadra(s => ({ ...s, ...value })); setErrore('') } }
  const chiudi = () => { setAperto(false); setSquadra(creaSquadraBozzaV1()); setErrore(''); confermata.current = true }
  const errori = validaSquadraBozzaV1(squadra, bozza, operai, varianti)
  const elenco = varianti.cantiere_id === bozza.cantiere_id && varianti.stato === 'pronte' ? varianti.varianti : []
  return <>
    <button type="button" style={button} disabled={disabled} onClick={() => {
      if (!disabled) { confermata.current = false; setSquadra(creaSquadraBozzaV1()); setErrore(''); setAperto(true) }
    }}>+ Aggiungi squadra</button>
    {aperto && <fieldset disabled={disabled} aria-label="Squadra" style={{ minWidth: 0, display: 'grid', gap: 12,
      padding: 12, border: '1px solid #cbd5e1', borderRadius: 10 }}>
      <legend>Squadra</legend>
      <strong>Operai</strong>
      <button type="button" style={button} onClick={() => cambia({ operai: operai.map(o => o.id) })}>Seleziona tutti</button>
      <button type="button" style={button} onClick={() => cambia({ operai: [] })}>Deseleziona tutti</button>
      {operai.map(o => <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
        <input type="checkbox" checked={squadra.operai.includes(o.id)} onChange={e => cambia({ operai: e.target.checked
          ? [...squadra.operai.filter(id => id !== o.id), o.id] : squadra.operai.filter(id => id !== o.id) })} />{o.nome}
      </label>)}
      <output aria-live="polite">{squadra.operai.length} operai selezionati</output>
      <label>Da<input type="time" style={input} value={squadra.ora_inizio} onChange={e => cambia({ ora_inizio: e.target.value })} /></label>
      <label>A<input type="time" style={input} value={squadra.ora_fine} onChange={e => cambia({ ora_fine: e.target.value })} /></label>
      <label>Pausa (minuti)<input type="number" min={0} step={1} style={input} value={Number.isNaN(squadra.pausa_minuti) ? '' : squadra.pausa_minuti}
        onChange={e => cambia({ pausa_minuti: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>
      <span>Modalità</span>
      <label><input type="radio" name="squadra-modalita" checked={!squadra.lavoro_in_economia}
        onChange={() => cambia({ lavoro_in_economia: false, variante_id: null })} /> Ordinario</label>
      <label><input type="radio" name="squadra-modalita" checked={squadra.lavoro_in_economia} onChange={() => {
        if (!disabled) { cambia({ lavoro_in_economia: true, variante_id: null }); onRichiediVarianti?.() }
      }} /> Economia</label>
      {squadra.lavoro_in_economia && <>
        <label>Variante<select style={input} value={squadra.variante_id || ''} onChange={e => {
          cambia({ variante_id: elenco.some(v => v.id === e.target.value && v.selezionabile) ? e.target.value : null })
        }}><option value="">Seleziona variante</option>
          {elenco.filter(v => v.selezionabile).map(v => <option key={v.id} value={v.id}>{etichettaVarianteBozza(v)}</option>)}
        </select></label>
        {varianti.stato === 'caricamento' && <p role="status">Caricamento varianti…</p>}
        {varianti.stato === 'errore' && <><p role="alert">Varianti non disponibili</p>
          <button type="button" style={button} onClick={() => { if (!disabled) onRiprovaVarianti() }}>Riprova varianti</button></>}
        {varianti.stato === 'pronte' && !elenco.some(v => v.selezionabile) && <p>Nessuna variante disponibile</p>}
      </>}
      {errori.length > 0 && <ul>{errori.map(e => <li key={e}>{e}</li>)}</ul>}
      {errore && <p role="alert">{errore}</p>}
      <button type="button" style={button} disabled={disabled || errori.length > 0} onClick={() => {
        if (disabled || errori.length || confermata.current) return
        confermata.current = true
        try { const nuova = aggiungiSquadraBozzaV1(bozza, squadra, operai, varianti, () => crypto.randomUUID()); onChange(nuova); chiudi() }
        catch { confermata.current = false; setErrore('Impossibile aggiungere le prestazioni. Riprova.') }
      }}>{squadra.operai.length ? `Aggiungi ${squadra.operai.length} prestazioni` : 'Aggiungi prestazioni'}</button>
      <button type="button" style={button} onClick={() => { if (!disabled) chiudi() }}>Annulla</button>
    </fieldset>}
  </>
}
