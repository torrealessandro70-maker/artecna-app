'use client'
import { useState } from 'react'
import RapportinoDesktopEditorV1 from './RapportinoDesktopEditorV1'

type Props = {
  cantiereId?: string; data?: string; rapportinoId?: string
  cantieri: readonly { id?: string; nome: string }[]
  operai: readonly { id: string; nome: string }[]
  onClose: () => void; onSaved: () => void; onLegacy: (id: string) => void
}
export default function RapportinoDesktopDialogV1(props: Props) {
  const [cantiereId, setCantiereId] = useState(props.cantiereId ?? '')
  const [data, setData] = useState(props.data ?? new Date().toLocaleDateString('sv-SE'))
  const [aperto, setAperto] = useState(!!props.rapportinoId)
  if (aperto) return <RapportinoDesktopEditorV1 {...props} cantiereId={cantiereId} data={data} />
  return <section role="dialog" aria-modal="true" aria-label="Nuovo Rapportino strutturato"
    style={{ position: 'fixed', inset: 30, zIndex: 2000, padding: 24, background: '#fff', border: '2px solid #2563eb', borderRadius: 12 }}>
    <h2>Nuovo Rapportino strutturato</h2>
    <label>Cantiere<select value={cantiereId} onChange={e => setCantiereId(e.target.value)}>
      <option value="">Seleziona Cantiere</option>
      {props.cantieri.filter(c => c.id).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
    </select></label>
    <label>Data<input type="date" value={data} onChange={e => setData(e.target.value)} /></label>
    <button type="button" disabled={!cantiereId || !/^\d{4}-\d{2}-\d{2}$/.test(data)} onClick={() => setAperto(true)}>Apri editor</button>
    <button type="button" onClick={props.onClose}>Annulla</button>
  </section>
}
