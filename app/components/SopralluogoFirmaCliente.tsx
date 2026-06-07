'use client'

import type { CSSProperties, RefObject } from 'react'
import SignatureCanvas from 'react-signature-canvas'

type Props = {
  sopralluogoAperto: any
  firmaRef: RefObject<any>
  mostraFirmaCliente: boolean
  setMostraFirmaCliente: (v: boolean) => void
  altezzaFirma: number
  setAltezzaFirma: (v: (h: number) => number) => void
  coloreFirma: string
  spessoreFirma: number
  setFirmaCliente: (v: string) => void
  supabase: any
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function SopralluogoFirmaCliente({
  sopralluogoAperto,
  firmaRef,
  mostraFirmaCliente,
  setMostraFirmaCliente,
  altezzaFirma,
  setAltezzaFirma,
  coloreFirma,
  spessoreFirma,
  setFirmaCliente,
  supabase,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  return (
    <div style={{ marginTop: 20 }}>
      <button
        type="button"
        onClick={() => setMostraFirmaCliente(!mostraFirmaCliente)}
        style={{
          ...buttonPrimary,
          backgroundColor: '#0f172a',
        }}
      >
        {mostraFirmaCliente ? 'Nascondi firma cliente' : '✍️ Firma cliente'}
      </button>

      {mostraFirmaCliente && (
        <div
          style={{
            marginTop: 12,
            padding: 14,
            border: '1px solid #cbd5e1',
            borderRadius: 12,
            background: '#f8fafc',
          }}
        >
          <h4 style={{ marginTop: 0 }}>Firma cliente</h4>

          <div
            style={{
              resize: 'both',
              overflow: 'hidden',
              minWidth: 320,
              minHeight: 220,
              width: 700,
              height: altezzaFirma,
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              background: '#fff',
            }}
          >
            <SignatureCanvas
              ref={firmaRef}
              penColor={coloreFirma}
              minWidth={spessoreFirma}
              maxWidth={spessoreFirma}
              canvasProps={{
                width: 700,
                height: altezzaFirma,
                style: {
                  width: '100%',
                  height: '100%',
                  background: '#fff',
                  touchAction: 'none',
                },
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginTop: 10,
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={async () => {
                const firma =
                  firmaRef.current?.getCanvas().toDataURL('image/png') || ''

                setFirmaCliente(firma)

                if (sopralluogoAperto?.id) {
                  const { error } = await supabase
                    .from('sopralluoghi')
                    .update({ firma_cliente: firma })
                    .eq('id', sopralluogoAperto.id)

                  if (error) {
                    alert('Errore salvataggio firma: ' + error.message)
                    return
                  }
                }

                alert('Firma salvata')
              }}
              style={buttonPrimary}
            >
              💾 Salva firma
            </button>

            <button
              type="button"
              onClick={() => {
                const data = firmaRef.current?.toData()

                if (data && data.length > 0) {
                  data.pop()
                  firmaRef.current?.fromData(data)
                }
              }}
              style={buttonSecondary}
            >
              ↩️ Annulla ultimo tratto
            </button>

            <button
              type="button"
              onClick={() => {
                firmaRef.current?.clear()
                setFirmaCliente('')
              }}
              style={buttonSecondary}
            >
              🗑 Cancella firma
            </button>

            <button
              type="button"
              onClick={() => setAltezzaFirma((h) => Math.max(180, h - 40))}
              style={buttonSecondary}
            >
              ➖ Riduci firma
            </button>

            <button
              type="button"
              onClick={() => setAltezzaFirma((h) => h + 40)}
              style={buttonSecondary}
            >
              ➕ Allarga firma
            </button>
          </div>
        </div>
      )}
    </div>
  )
}