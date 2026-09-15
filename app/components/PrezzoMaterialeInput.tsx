'use client'

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { Calculator, Delete, Undo2, X } from 'lucide-react'

type Operazione = '+' | '-' | '*' | '/'
type Passaggio = { valore: string; formula: string }
const simboli = { '+': '+', '-': '−', '*': '×', '/': '÷' }
const mostra = (v: string) => v.replace('.', ',')

export function calcolaPrezzo(valore: string, operazione: Operazione, operando: string, percentuale = false): string | null {
  const leggi = (testo: string) => {
    const normalizzato = testo.trim().replace(',', '.')
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalizzato) ? Number(normalizzato) : NaN
  }
  const prezzo = leggi(valore)
  let secondo = leggi(operando)
  if (!Number.isFinite(prezzo) || !Number.isFinite(secondo)) return null
  if (percentuale) secondo = operazione === '+' || operazione === '-' ? prezzo * secondo / 100 : secondo / 100
  if (operazione === '/' && secondo === 0) return null
  const risultato = operazione === '+' ? prezzo + secondo : operazione === '-' ? prezzo - secondo : operazione === '*' ? prezzo * secondo : prezzo / secondo
  if (!Number.isFinite(risultato) || Math.abs(risultato) >= 1e21) return null
  return (Math.round((risultato + Math.sign(risultato) * Number.EPSILON) * 100) / 100).toFixed(2)
}

type Props = { value: string; onChange: (value: string) => void; inputStyle: CSSProperties; buttonStyle: CSSProperties }

export default function PrezzoMaterialeInput({ value, onChange, inputStyle, buttonStyle }: Props) {
  const [aperta, setAperta] = useState(false)
  const [operazione, setOperazione] = useState<Operazione | null>(null)
  const [operando, setOperando] = useState('')
  const [percentuale, setPercentuale] = useState(false)
  const [nuovoNumero, setNuovoNumero] = useState(true)
  const [errore, setErrore] = useState('')
  const [history, setHistory] = useState<Passaggio[]>([])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const dialog = dialogRef.current
    if (aperta && dialog && !dialog.open) dialog.showModal()
    if (!aperta && dialog?.open) dialog.close()
  }, [aperta])
  const resetOperazione = () => { setOperazione(null); setOperando(''); setPercentuale(false); setErrore(''); setNuovoNumero(true) }
  const apri = () => { resetOperazione(); setHistory([{ valore: value, formula: 'Prezzo iniziale' }]); setAperta(true) }
  const digita = (cifra: string) => {
    const attuale = operazione ? operando : nuovoNumero ? '' : value
    if (cifra === '.' && attuale.includes('.')) return
    const prossimo = cifra === '.' && !attuale ? '0.' : attuale + cifra
    if (operazione) setOperando(prossimo)
    else { onChange(prossimo); setNuovoNumero(false) }
    setErrore('')
  }
  const backspace = () => {
    if (operazione) setOperando(operando.slice(0, -1))
    else if (!nuovoNumero) onChange(value.slice(0, -1))
    setErrore('')
  }
  const applica = () => {
    if (!operazione) return
    const risultato = calcolaPrezzo(value, operazione, operando, percentuale)
    if (risultato === null) { setErrore('Inserisci valori validi. Non è possibile dividere per zero.'); return }
    const formula = mostra(value) + ' ' + simboli[operazione] + ' ' + mostra(operando) + (percentuale ? '%' : '')
    onChange(risultato)
    setHistory([...history, { valore: risultato, formula }])
    resetOperazione()
  }
  const undo = () => {
    if (history.length < 2) return
    const precedente = history.slice(0, -1)
    onChange(precedente[precedente.length - 1].valore)
    setHistory(precedente)
    resetOperazione()
  }
  const scegliOperazione = (op: Operazione) => { setOperazione(op); setPercentuale(false); setErrore('') }
  const formula = operazione ? mostra(value) + ' ' + simboli[operazione] + ' ' + mostra(operando) + (percentuale ? '%' : '') : history[history.length - 1]?.formula || 'Prezzo corrente'
  const tasto: CSSProperties = { ...buttonStyle, minHeight: 48, minWidth: 0, padding: 8, margin: 0, width: '100%', fontSize: 18, touchAction: 'manipulation' }
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input aria-label="Prezzo unitario €" placeholder="Prezzo unitario €" inputMode="decimal"
          value={mostra(value)} onChange={(e) => onChange(e.target.value.replace(',', '.'))}
          style={{ ...inputStyle, minWidth: 0, width: '100%' }} />
        <button type="button" aria-label="Calcolatrice prezzo" aria-haspopup="dialog" aria-expanded={aperta} aria-controls={id}
          onClick={apri} style={{ ...tasto, width: 48, flexShrink: 0 }}><Calculator size={18} aria-hidden="true" /></button>
      </div>
      <dialog ref={dialogRef} id={id} aria-labelledby={id + '-titolo'} className="prezzo-calcolatrice-dialog"
        onCancel={(e) => { e.preventDefault(); setAperta(false) }} onClose={() => setAperta(false)}
        onClick={(e) => {
          if (e.target !== e.currentTarget) return
          const r = e.currentTarget.getBoundingClientRect()
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) setAperta(false)
        }}
        onKeyDown={(e) => {
          if (/^[0-9]$/.test(e.key)) { e.preventDefault(); digita(e.key) }
          else if (e.key === ',' || e.key === '.') { e.preventDefault(); digita('.') }
          else if (['+', '-', '*', '/'].includes(e.key)) { e.preventDefault(); scegliOperazione(e.key as Operazione) }
          else if (e.key === '%' && operazione && operando) { e.preventDefault(); setPercentuale(!percentuale) }
          else if (e.key === '=') { e.preventDefault(); applica() }
          else if (e.key === 'Backspace') { e.preventDefault(); backspace() }
        }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h3 id={id + '-titolo'} style={{ margin: 0, fontSize: 18 }}>Calcolatrice prezzo</h3>
          <button autoFocus type="button" aria-label="Chiudi calcolatrice" onClick={() => setAperta(false)} style={{ ...tasto, width: 48 }}><X size={20} aria-hidden="true" /></button>
        </header>
        <p aria-label="Operazione" style={{ minHeight: 22, margin: '12px 0 6px', color: '#475569', overflowWrap: 'anywhere' }}>{formula}</p>
        <output aria-label="Prezzo corrente" aria-live="polite" style={{ display: 'block', textAlign: 'right', fontSize: 32, fontVariantNumeric: 'tabular-nums', marginBottom: 12, overflowWrap: 'anywhere' }}>{value ? mostra(value) + ' €' : '—'}</output>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          {['7','8','9','/','4','5','6','*','1','2','3','-','0',',','%','+'].map((key) => (
            <button key={key} type="button" style={tasto}
              aria-pressed={key === '%' ? percentuale : ['+','-','*','/'].includes(key) ? operazione === key : undefined}
              disabled={key === '%' && (!operazione || !operando)}
              onClick={() => { if (/^[0-9]$/.test(key)) digita(key); else if (key === ',') digita('.'); else if (key === '%') setPercentuale(!percentuale); else scegliOperazione(key as Operazione) }}>
              {simboli[key as Operazione] || key}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
          <button type="button" aria-label="Cancella ultima cifra" onClick={backspace} style={tasto}><Delete size={20} aria-hidden="true" /></button>
          <button type="button" aria-label="Annulla ultimo calcolo" disabled={history.length < 2} onClick={undo} style={tasto}><Undo2 size={20} aria-hidden="true" /></button>
          <button type="button" aria-label="Calcola" onClick={applica} style={tasto}>=</button>
        </div>
        {errore && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{errore}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" aria-label="Cancella prezzo" onClick={() => { onChange(''); resetOperazione() }} style={tasto}>C</button>
          <button type="button" onClick={() => setAperta(false)} style={tasto}>Chiudi</button>
        </div>
        <section aria-label="Cronologia" style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
          <h4 style={{ margin: '0 0 8px' }}>Cronologia</h4>
          <ol style={{ margin: 0, paddingLeft: 20, maxHeight: 120, overflowY: 'auto' }}>
            {history.map((passaggio, index) => <li key={index} style={{ padding: '4px 0', overflowWrap: 'anywhere' }}><strong>{mostra(passaggio.valore) || '—'}</strong> — {passaggio.formula}</li>)}
          </ol>
        </section>
      </dialog>
      <style>{'.prezzo-calcolatrice-dialog { box-sizing: border-box; width: min(400px, calc(100vw - 24px)); max-width: calc(100vw - 24px); max-height: calc(100dvh - 24px); margin: auto; padding: 16px; border: 1px solid #cbd5e1; border-radius: 16px; background: #fff; color: #0f172a; overflow-y: auto; box-shadow: 0 20px 60px #0003; } .prezzo-calcolatrice-dialog::backdrop { background: #0f172a80; }'}</style>
    </div>
  )
}
