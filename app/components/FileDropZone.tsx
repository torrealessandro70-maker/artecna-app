'use client'

import { useRef, useState, type CSSProperties, type ReactNode } from 'react'

// Shared file acquisition only. Parsing and persistence belong to the caller.
export default function FileDropZone({ onFiles, accept, disabled = false, title, children, buttonStyle }: {
  onFiles: (files: File[]) => void; accept: string; disabled?: boolean; title: string
  children?: ReactNode; buttonStyle?: CSSProperties
}) {
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const receive = (files: File[]) => { if (!disabled && files.length) onFiles(files) }
  return <section aria-label={title} tabIndex={0} aria-busy={disabled}
    onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = disabled ? 'none' : 'copy'; if (!disabled) setDrag(true) } }}
    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false) }}
    onDrop={e => { e.preventDefault(); e.stopPropagation(); setDrag(false); receive(Array.from(e.dataTransfer.files)) }}
    onPaste={e => { if (e.clipboardData.files.length) { e.preventDefault(); receive(Array.from(e.clipboardData.files)) } }}
    style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', overflowWrap: 'anywhere', padding: 16, border: `2px dashed ${drag ? '#2563eb' : '#cbd5e1'}`, borderRadius: 12, background: drag ? '#eff6ff' : '#fff' }}>
    <h3 style={{ marginTop: 0 }}>{title}</h3>
    <p>Trascina qui uno o più file oppure usa Seleziona file. Puoi aggiungerne altri successivamente.</p>
    <button type="button" disabled={disabled} style={{ ...buttonStyle, minHeight: 44 }} onClick={() => input.current?.click()}>Seleziona file</button>
    <input ref={input} aria-label={title} type="file" multiple accept={accept} hidden disabled={disabled}
      onChange={e => { const files = Array.from(e.currentTarget.files ?? []); e.currentTarget.value = ''; receive(files) }} />
    {children}
  </section>
}
