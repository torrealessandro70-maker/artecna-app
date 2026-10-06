'use client'

import { useState, type CSSProperties } from 'react'
import type { BozzaRapportinoV1 } from '../engines/rapportini/bozzaRapportinoV1'
import { aggiungiMaterialeBozza, modificaMaterialeBozza, rimuoviMaterialeBozza, adottaMaterialiStrutturati,
  erroriMaterialeBozza, totaleRigaMateriale, riepilogoMaterialiBozza, deltaMaterialiBozza, type MaterialeBozzaV1 } from '../engines/rapportini/materialiBozzaV1'

const input: CSSProperties = { width: '100%', minWidth: 0, boxSizing: 'border-box', padding: 10,
  marginTop: 5, fontSize: 16, border: '1px solid #cbd5e1', borderRadius: 8 }
const button: CSSProperties = { minHeight: 44, padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8 }
const unita = ['cad','pz','kg','lt','mq','mc','ml','sacco','conf.','rotolo']
const euro = (s: string) => s.replace('.', ',')
type Props = { bozza: BozzaRapportinoV1; onChange: (bozza: BozzaRapportinoV1) => void; disabled?: boolean }

function Riga({ riga, numero, disabled, modifica, rimuovi }: {
  riga: MaterialeBozzaV1; numero: number; disabled: boolean
  modifica: (value: Parameters<typeof modificaMaterialeBozza>[2]) => void; rimuovi: () => void
}) {
  const [altra, setAltra] = useState(!unita.includes(riga.unita_misura) && riga.unita_misura !== '')
  const errori = erroriMaterialeBozza(riga)
  let totale: string | null | undefined
  try { totale = totaleRigaMateriale(riga.quantita, riga.costo_unitario) } catch { totale = undefined }
  return <fieldset disabled={disabled} style={{ minWidth: 0, display: 'grid', gap: 12, padding: 12, border: '1px solid #e2e8f0', borderRadius: 10 }}>
    <legend>Materiale {numero}</legend>
    <label>Descrizione<input style={input} value={riga.descrizione} maxLength={2000}
      onChange={e => modifica({ descrizione: e.target.value })} /></label>
    <label>Quantità<input style={input} inputMode="decimal" value={riga.quantita}
      onChange={e => modifica({ quantita: e.target.value })} /></label>
    <label>U.M.<select style={input} value={altra || (!unita.includes(riga.unita_misura) && riga.unita_misura !== '') ? 'altra' : riga.unita_misura}
      onChange={e => { const custom = e.target.value === 'altra'; setAltra(custom); modifica({ unita_misura: custom ? '' : e.target.value }) }}>
      <option value="">Seleziona unità</option>
      {unita.map(u => <option key={u} value={u}>{u === 'ml' ? 'ml — metri lineari' : u}</option>)}
      <option value="altra">Altra unità</option>
    </select></label>
    {(altra || (riga.unita_misura !== '' && !unita.includes(riga.unita_misura))) && <label>Altra unità<input style={input} maxLength={50}
      value={riga.unita_misura} onChange={e => modifica({ unita_misura: e.target.value })} /></label>}
    <label>Costo unitario (facoltativo)<input style={input} inputMode="decimal" value={riga.costo_unitario ?? ''}
      onChange={e => modifica({ costo_unitario: e.target.value === '' ? null : e.target.value })} /></label>
    <output aria-label={'Totale materiale ' + numero}>{totale === null ? 'Da valorizzare' : totale === undefined ?
      'Verifica quantità e costo per il totale.' : 'Totale: € ' + euro(totale)}</output>
    <label>Nota materiale (facoltativa)<textarea style={input} rows={2} maxLength={20000} value={riga.note}
      onChange={e => modifica({ note: e.target.value })} /></label>
    {errori.length > 0 && <ul aria-label={'Errori materiale ' + numero} style={{ color: '#b91c1c', margin: 0 }}>
      {errori.map(e => <li key={e}>{e}</li>)}</ul>}
    <button type="button" style={button} onClick={rimuovi}>Rimuovi materiale</button>
  </fieldset>
}

export default function RapportinoMaterialiEditorV1({ bozza, onChange, disabled = false }: Props) {
  const s = bozza.materialiStrutturati
  if (!s) return null
  let riepilogo: ReturnType<typeof riepilogoMaterialiBozza> | null = null
  let operazioniInvalide = false
  if (s.versione_materiali === 1) {
    try { riepilogo = riepilogoMaterialiBozza(bozza) } catch { /* Errori mostrati nelle singole righe. */ }
    if (s.righe.every(r => erroriMaterialeBozza(r).length === 0)) {
      try { deltaMaterialiBozza(bozza) } catch { operazioniInvalide = true }
    }
  }
  const legacy = s.documento_legacy_materiali
  return <section aria-label="Materiali utilizzati" style={{ display: 'grid', gap: 12, minWidth: 0 }}>
    <h2 style={{ fontSize: 20, margin: 0 }}>Materiali utilizzati</h2>
    {(legacy.materiali || legacy.quantita_materiali) && <div aria-label="Materiali precedenti" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      <h3>Materiali precedenti</h3><p>{legacy.materiali}</p><p>{legacy.quantita_materiali}</p>
      <small>Dati precedenti conservati in sola lettura.</small>
    </div>}
    {s.versione_materiali === 0 ? <div>
      <p>I dati precedenti resteranno conservati.</p>
      <button type="button" style={button} disabled={disabled} onClick={() => {
        if (!disabled) onChange(adottaMaterialiStrutturati(bozza))
      }}>Usa nuova gestione materiali</button>
    </div> : <>
      <button type="button" style={button} disabled={disabled} onClick={() => {
        if (!disabled) onChange(aggiungiMaterialeBozza(bozza, () => crypto.randomUUID()))
      }}>+ Aggiungi materiale</button>
      {s.righe.length === 0 && <p>Nessun materiale inserito.</p>}
      {s.righe.map((r, i) => <Riga key={r.chiave_client} riga={r} numero={i + 1} disabled={disabled}
        modifica={value => { if (!disabled) onChange(modificaMaterialeBozza(bozza, r.chiave_client, value)) }}
        rimuovi={() => { if (!disabled) onChange(rimuoviMaterialeBozza(bozza, r.chiave_client)) }} />)}
      {operazioniInvalide && <p role="alert">Materiali non validi. Verifica le righe: massimo 100 operazioni per tipo e salvataggio.</p>}
      {riepilogo ? <div aria-live="polite">
        <p>Totale materiali valorizzati: € {euro(riepilogo.totale_materiali_valorizzati)}</p>
        <p>{riepilogo.numero_materiali_da_valorizzare > 0 ? riepilogo.numero_materiali_da_valorizzare + ' materiali da valorizzare' : 'Valorizzazione completa'}</p>
        <small>Anteprima; il server confermerà i valori al salvataggio.</small>
      </div> : <p role="status">Completa quantità e costi validi per il riepilogo.</p>}
    </>}
  </section>
}
