'use client'

import type { CSSProperties, ReactNode } from 'react'
import RapportinoSquadraV1 from './RapportinoSquadraV1'
import DettaturaNoteV1 from './DettaturaNoteV1'
import RapportinoMaterialiEditorV1 from './RapportinoMaterialiEditorV1'
import {
  aggiungiPrestazioneBozza, modificaPrestazioneBozza, rimuoviPrestazioneBozza,
  oreAnteprimaPrestazione, validaPrestazioneBozza,
  prestazioniAttiveBozza, originalePrestazioneBozza,
  type BozzaRapportinoV1,
} from '../engines/rapportini/bozzaRapportinoV1'

import { etichettaVarianteBozza, type StatoVariantiBozza } from '../engines/rapportini/variantiBozzaV1'

const input: CSSProperties = { width: '100%', minWidth: 0, boxSizing: 'border-box', padding: 10,
  marginTop: 5, fontSize: 16, border: '1px solid #cbd5e1', borderRadius: 8 }
const button: CSSProperties = { minHeight: 44, padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8 }
type Props = {
  bozza: BozzaRapportinoV1
  operai: readonly { id: string; nome: string }[]
  onChange: (bozza: BozzaRapportinoV1) => void
  onClose: () => void
  varianti: StatoVariantiBozza
  onRiprovaVarianti: () => void
  onRichiediVarianti?: () => void
  salvabile?: boolean
  salvataggioInCorso?: boolean
  retryDisponibile?: boolean
  onSalva?: () => void
  onRetry?: () => void
  disabled?: boolean
  diagnosticaMateriali?: ReactNode
}
export default function RapportinoPrestazioniEditorV1({ bozza, operai, onChange, onClose, varianti, onRiprovaVarianti, onRichiediVarianti, salvabile = false, salvataggioInCorso = false, retryDisponibile = false, onSalva, onRetry, disabled = false, diagnosticaMateriali }: Props) {
  const modifica = (chiave: string, value: Parameters<typeof modificaPrestazioneBozza>[2]) => {
    if (!disabled) onChange(modificaPrestazioneBozza(bozza, chiave, value, () => crypto.randomUUID()))
  }
  const documento = (campo: keyof BozzaRapportinoV1['documento'], value: string) => {
    if (!disabled) onChange({ ...bozza, documento: { ...bozza.documento, [campo]: value } })
  }
  return <section aria-label="Editor Rapportino V1" style={{ display: 'grid', gap: 14, padding: 16,
    border: '1px solid #cbd5e1', borderRadius: 12, background: '#fff' }}>
    <h2 style={{ fontSize: 20, margin: 0 }}>Prestazioni</h2>
    <button type="button" disabled={disabled} style={button} onClick={() => {
      if (!disabled) onChange(aggiungiPrestazioneBozza(bozza, crypto.randomUUID()))
    }}>+ Aggiungi prestazione</button>
    <RapportinoSquadraV1 key={`${bozza.cantiere_id}/${bozza.data}/${bozza.rapportino_id}/${bozza.revisione_attesa}`}
      bozza={bozza} operai={operai} varianti={varianti} disabled={disabled} onChange={onChange}
      onRichiediVarianti={onRichiediVarianti} onRiprovaVarianti={onRiprovaVarianti} />
    {prestazioniAttiveBozza(bozza).map((p, index) => {
      const originale = originalePrestazioneBozza(bozza, p)
      const errori = validaPrestazioneBozza(p, varianti.stato === 'pronte' && varianti.cantiere_id === bozza.cantiere_id ? varianti.varianti : [], originale)
      return <fieldset key={p.chiave_client} disabled={disabled} style={{ minWidth: 0, display: 'grid', gap: 12,
        padding: 12, border: '1px solid #e2e8f0', borderRadius: 10 }}>
        <legend>Prestazione {index + 1}</legend>
        <label>Operaio<select style={input} value={p.operaio_id}
          onChange={e => modifica(p.chiave_client, { operaio_id: e.target.value })}>
          <option value="">Seleziona operaio</option>
          {operai.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          {!operai.some(o => o.id === p.operaio_id) && p.prestazione_id && <option value={p.operaio_id}>
            {bozza.baseline?.prestazioni.find(a => a.prestazione_id === p.prestazione_id)?.operaio_nome || 'Operaio storico'}
          </option>}
        </select></label>
        {p.prestazione_id && <small>Cambiando operaio la prestazione sarà sostituita con una nuova riga.</small>}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
          <label>Da<input type="time" style={input} value={p.ora_inizio}
            onChange={e => modifica(p.chiave_client, { ora_inizio: e.target.value })} /></label>
          <label>A<input type="time" style={input} value={p.ora_fine}
            onChange={e => modifica(p.chiave_client, { ora_fine: e.target.value })} /></label>
        </div>
        <label>Pausa (minuti)<input type="number" min={0} step={1} style={input}
          value={Number.isNaN(p.pausa_minuti) ? '' : p.pausa_minuti}
          onChange={e => modifica(p.chiave_client, { pausa_minuti: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend>Modalità</legend>
          <label style={{ marginRight: 16 }}><input type="radio" name={'modalita-' + p.chiave_client}
            checked={!p.lavoro_in_economia} onChange={() => modifica(p.chiave_client, { lavoro_in_economia: false })} /> Ordinario</label>
          <label><input type="radio" name={'modalita-' + p.chiave_client} checked={p.lavoro_in_economia}
            onChange={() => modifica(p.chiave_client, { lavoro_in_economia: true })} /> Economia</label>
        </fieldset>
        {p.lavoro_in_economia && <div>
          <label>Variante<select aria-label={'Variante prestazione ' + (index + 1)} style={input} value={p.variante_id || ''}
            disabled={disabled || varianti.stato !== 'pronte' || varianti.cantiere_id !== bozza.cantiere_id}
            onChange={e => {
              const scelta = varianti.varianti.find(v => v.id === e.target.value && (v.selezionabile || v.id === originale?.variante_id))
              if (varianti.stato === 'pronte' && varianti.cantiere_id === bozza.cantiere_id && (scelta || e.target.value === ''))
                modifica(p.chiave_client, { variante_id: scelta?.id || null })
            }}>
            <option value="">Seleziona variante</option>
            {p.variante_id && !varianti.varianti.some(v => v.id === p.variante_id) && <option value={p.variante_id} disabled>
              Variante collegata — {p.variante_id}
            </option>}
            {varianti.cantiere_id === bozza.cantiere_id && varianti.varianti.map(v =>
              <option key={v.id} value={v.id} disabled={!v.selezionabile && v.id !== originale?.variante_id}>{etichettaVarianteBozza(v)}</option>)}
          </select></label>
          {varianti.stato === 'caricamento' && <p role="status">Caricamento varianti…</p>}
          {varianti.stato === 'pronte' && !varianti.varianti.some(v => v.selezionabile) && !originale?.variante_id && <p>Nessuna variante disponibile</p>}
          {originale?.lavoro_in_economia && originale.variante_id === null && <p>Economia storica senza Variante: per modificare questa prestazione seleziona una Variante.</p>}
          {varianti.stato === 'errore' && <div role="alert">
            <p>Impossibile caricare le varianti. Riprova.</p>
            <button type="button" style={button} disabled={disabled} onClick={() => { if (!disabled) onRiprovaVarianti() }}>Riprova caricamento varianti</button>
          </div>}
        </div>}
        <output aria-label={'Ore prestazione ' + (index + 1)}>Ore: {oreAnteprimaPrestazione(p).toLocaleString('it-IT', { maximumFractionDigits: 2 })}</output>
        <small>Anteprima delle ore; il server sarà autorevole al salvataggio.</small>
        {errori.length > 0 && <ul aria-label={'Errori prestazione ' + (index + 1)} style={{ color: '#b91c1c', margin: 0 }}>
          {errori.map(errore => <li key={errore}>{errore}</li>)}
        </ul>}
        <button type="button" style={button} onClick={() => {
          if (!disabled) onChange(rimuoviPrestazioneBozza(bozza, p.chiave_client))
        }}>Rimuovi</button>
      </fieldset>
    })}
    {prestazioniAttiveBozza(bozza).length === 0 && <p>{bozza.rapportino_id ? 'Nessuna prestazione attiva.' : 'Aggiungi almeno una prestazione per compilare la bozza.'}</p>}
    <label>Lavori eseguiti / Note<textarea disabled={disabled} rows={4} style={input} value={bozza.documento.note}
      onChange={e => documento('note', e.target.value)} /></label>
    <DettaturaNoteV1 testo={bozza.documento.note} onTesto={testo => documento('note', testo)} disabled={disabled}
      contesto={`${bozza.cantiere_id}/${bozza.data}/${bozza.rapportino_id}/${bozza.revisione_attesa}`} />
    {bozza.materialiStrutturati ? <RapportinoMaterialiEditorV1 key={`${bozza.cantiere_id}/${bozza.data}/${bozza.revisione_attesa}`}
      bozza={bozza} onChange={onChange} disabled={disabled} /> : <>
    <label>Materiali<textarea disabled={disabled} rows={2} style={input} value={bozza.documento.materiali}
      onChange={e => documento('materiali', e.target.value)} /></label>
    <label>Quantità materiali<input disabled={disabled} style={input} value={bozza.documento.quantita_materiali}
      onChange={e => documento('quantita_materiali', e.target.value)} /></label>
    </>}
    {diagnosticaMateriali}
    {salvataggioInCorso && <p role="status">Salvataggio in corso...</p>}
    {retryDisponibile && <div>
      <p>Il retry invia lo stesso contenuto. Modificando la bozza inizierai un nuovo intento di salvataggio.</p>
      <button type="button" style={button} disabled={disabled} onClick={() => { if (!disabled) onRetry?.() }}>Riprova stesso salvataggio</button>
    </div>}
    <button type="button" disabled={disabled || !salvabile || retryDisponibile} style={button}
      onClick={() => { if (!disabled && salvabile && !retryDisponibile) onSalva?.() }}>Salva rapportino</button>
    <button type="button" disabled={disabled} style={button} onClick={onClose}>Chiudi</button>
  </section>
}
