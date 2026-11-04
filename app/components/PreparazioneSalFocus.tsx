'use client'

import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import VistaOperativa from './VistaOperativa'

export default function PreparazioneSalFocus({ contestuale, contesto, occupata, buttonStyle, children }: {
  contestuale: boolean
  contesto: string
  occupata: boolean
  buttonStyle: CSSProperties
  children: ReactNode
}) {
  const [aperta, setAperta] = useState(false)
  const aperturaRef = useRef<HTMLButtonElement>(null)
  if (!contestuale) return children
  return <>
    <button type="button" ref={aperturaRef} style={buttonStyle} onClick={() => setAperta(true)}>Preparazione SAL</button>
    {aperta && <VistaOperativa titolo="Preparazione SAL" contesto={contesto} occupata={occupata}
      onChiudi={() => setAperta(false)} ritornoFocusRef={aperturaRef}>
      <div className="sal-preparazione-focus" style={{ width: '100%', minWidth: 0 }}>
        {children}
        <style>{`
          .sal-preparazione-focus input, .sal-preparazione-focus select, .sal-preparazione-focus textarea { box-sizing: border-box; max-width: 100%; min-width: 0; }
          .sal-preparazione-focus button { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
          .sal-preparazione-focus p, .sal-preparazione-focus li { overflow-wrap: anywhere; }
        `}</style>
      </div>
    </VistaOperativa>}
  </>
}
