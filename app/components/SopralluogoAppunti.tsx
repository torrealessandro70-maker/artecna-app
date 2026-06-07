'use client'

import type { CSSProperties, MutableRefObject } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import jsPDF from 'jspdf'

type Props = {
  mostraAppuntiSopralluogo: boolean
  setMostraAppuntiSopralluogo: (v: boolean) => void
  pagineAppunti: string[]
  setPagineAppunti: React.Dispatch<React.SetStateAction<string[]>>
  paginaFullscreen: number | null
  setPaginaFullscreen: (v: number | null) => void
  appuntiRefs: MutableRefObject<any[]>
  mostraTavolozzaFirma: boolean
  setMostraTavolozzaFirma: (v: boolean) => void
  coloreFirma: string
  setColoreFirma: (v: string) => void
  spessoreFirma: number
  setSpessoreFirma: (v: number) => void
  sopralluogoAperto: any
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function SopralluogoAppunti({
  mostraAppuntiSopralluogo,
  setMostraAppuntiSopralluogo,
  pagineAppunti,
  setPagineAppunti,
  paginaFullscreen,
  setPaginaFullscreen,
  appuntiRefs,
  mostraTavolozzaFirma,
  setMostraTavolozzaFirma,
  coloreFirma,
  setColoreFirma,
  spessoreFirma,
  setSpessoreFirma,
  sopralluogoAperto,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  return (
    <>
      <button
        type="button"
        onClick={() =>
          setMostraAppuntiSopralluogo(!mostraAppuntiSopralluogo)
        }
        style={{ ...buttonPrimary, marginTop: 16 }}
      >
        📝 Appunti / Disegni sopralluogo
      </button>

      {mostraAppuntiSopralluogo && (
        <div style={{ marginTop: 16 }}>
          <h4>Appunti a penna</h4>

          {pagineAppunti.map((pagina, index) => (
            <div key={index} style={{ marginBottom: 20 }}>
              <div
                style={{
                  width: paginaFullscreen === index ? '100vw' : 794,
                  height: paginaFullscreen === index ? '100vh' : 1123,
                  maxWidth: '100%',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  overflow: 'hidden',
                  position:
                    paginaFullscreen === index ? 'fixed' : 'relative',
                  inset: paginaFullscreen === index ? 0 : 'auto',
                  zIndex: paginaFullscreen === index ? 30000 : 'auto',
                  padding: paginaFullscreen === index ? 10 : 0,
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setPaginaFullscreen(
                      paginaFullscreen === index ? null : index
                    )
                  }
                  style={{
                    position: 'absolute',
                    bottom: 16,
                    right: 16,
                    zIndex: 1000,
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    border: '2px solid white',
                    background: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    fontSize: 24,
                    cursor: 'pointer',
                  }}
                >
                  {paginaFullscreen === index ? '↙️' : '↗️'}
                </button>

                <div
                  style={{
                    position: 'absolute',
                    left: 12,
                    right: 72,
                    bottom: 12,
                    zIndex: 999,
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.95)',
                    padding: 8,
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      const ref = appuntiRefs.current[index]
                      const data = ref?.toData()

                      if (data && data.length > 0) {
                        data.pop()
                        ref.fromData(data)
                      }
                    }}
                    style={buttonSecondary}
                  >
                    ↩️ Annulla tratto
                  </button>

                  <button
                    type="button"
                    onClick={() => appuntiRefs.current[index]?.clear()}
                    style={buttonSecondary}
                  >
                    🗑 Cancella pagina
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setMostraTavolozzaFirma(!mostraTavolozzaFirma)
                    }
                    style={buttonSecondary}
                  >
                    🎨 Penna
                  </button>

                  <button
                    type="button"
                    onClick={() => setPagineAppunti((p) => [...p, ''])}
                    style={buttonPrimary}
                  >
                    ➕ Aggiungi pagina
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (pagineAppunti.length === 1) {
                        alert('Deve rimanere almeno una pagina')
                        return
                      }

                      setPagineAppunti((p) => {
                        const nuovePagine = [...p]
                        nuovePagine.pop()
                        return nuovePagine.length > 0 ? nuovePagine : ['']
                      })

                      appuntiRefs.current.pop()
                    }}
                    style={buttonSecondary}
                  >
                    ➖ Togli ultima pagina
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const pagineSalvate = appuntiRefs.current
                        .map(
                          (ref) =>
                            ref?.getCanvas()?.toDataURL('image/png') || ''
                        )
                        .filter(Boolean)

                      setPagineAppunti(pagineSalvate)
                      alert('Appunti salvati')
                    }}
                    style={buttonPrimary}
                  >
                    💾 Salva appunti
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const pdf = new jsPDF('p', 'mm', 'a4')

                      appuntiRefs.current.forEach((ref, idx) => {
                        const img =
                          ref?.getCanvas()?.toDataURL('image/png')
                        if (!img) return

                        if (idx > 0) pdf.addPage()

                        pdf.setFontSize(14)
                        pdf.text(
                          `Appunti sopralluogo - Pagina ${idx + 1}`,
                          20,
                          15
                        )
                        pdf.addImage(img, 'PNG', 10, 25, 190, 267)
                      })

                      pdf.save(
                        `Appunti_${
                          sopralluogoAperto?.cliente || 'sopralluogo'
                        }.pdf`
                      )
                    }}
                    style={{
                      ...buttonPrimary,
                      backgroundColor: '#2563eb',
                    }}
                  >
                    🖨️ Stampa appunti
                  </button>
                </div>

                {mostraTavolozzaFirma && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 16,
                      left: 16,
                      zIndex: 1000,
                      background: 'rgba(255,255,255,0.95)',
                      padding: 10,
                      borderRadius: 12,
                      display: 'flex',
                      gap: 10,
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}
                  >
                    {[
                      { nome: 'Nero', colore: 'black' },
                      { nome: 'Blu', colore: 'blue' },
                      { nome: 'Rosso', colore: 'red' },
                      { nome: '🧽 Gomma', colore: '#ffffff' },
                    ].map((c) => (
                      <button
                        type="button"
                        key={c.colore}
                        onClick={() => {
                          setColoreFirma(c.colore)

                          if (c.colore === '#ffffff') {
                            setSpessoreFirma(14)
                          } else if (spessoreFirma > 6) {
                            setSpessoreFirma(2)
                          }
                        }}
                        style={{
                          ...buttonSecondary,
                          border:
                            coloreFirma === c.colore
                              ? '2px solid #111827'
                              : '1px solid #cbd5e1',
                        }}
                      >
                        {c.nome}
                      </button>
                    ))}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span>Spessore</span>

                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={spessoreFirma}
                        onChange={(e) =>
                          setSpessoreFirma(Number(e.target.value))
                        }
                      />

                      <strong>{spessoreFirma}</strong>
                    </div>
                  </div>
                )}

                <SignatureCanvas
                  ref={(ref) => {
                    appuntiRefs.current[index] = ref
                  }}
                  penColor={coloreFirma}
                  minWidth={spessoreFirma}
                  maxWidth={spessoreFirma}
                  canvasProps={{
                    width: 794,
                    height: 1123,
                    style: {
                      width: '100%',
                      height: '100%',
                      background: '#fff',
                      touchAction: 'none',
                    },
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}