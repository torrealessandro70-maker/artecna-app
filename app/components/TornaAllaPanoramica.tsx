'use client'

import { ArrowLeft } from 'lucide-react'

export default function TornaAllaPanoramica({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        minHeight: 44, maxWidth: '100%', padding: '10px 14px', marginBottom: 16,
        border: '1px solid #bfdbfe', borderRadius: 10,
        background: '#eff6ff', color: '#1d4ed8', fontSize: 14,
        fontWeight: 600, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
      }}
    >
      <ArrowLeft size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
      Torna alla panoramica
    </button>
  )
}
