'use client'
import IncassiLordiPanel from './IncassiLordiPanel'
import { RiconciliazioneAzione } from './RiconciliazioneUnificata'
import ContrattoFiscalePanel from './ContrattoFiscalePanel'

import { useEffect, useState, type CSSProperties } from 'react'
import BluenextIntegrato from './BluenextIntegrato'
import FontiBluenext from './FontiBluenext'
import { supabase } from '../../lib/supabaseClient'
import CollegaIncassoPanel, { CollegaIncassoAzione } from './CollegaIncassoPanel'
import { numeroDichiarato } from '../engines/contabilita-ditta/modificaFattura'
import { cantiereDocumento } from '../engines/contabilita-ditta/attribuzioni'

type RigaFatturaUI = Record<string, unknown> & { id: string; numero_fattura?: string | null; data_fattura?: string | null; cliente?: string | null; cantiere?: string | null; cantiere_id?: string | null; stato?: string | null; pdf_url?: string | null }
type Props = {
  fattureEmesseOrdinate: RigaFatturaUI[]
  filtroFattureEmesse: string
  setFiltroFattureEmesse: (v: string) => void

  setNuovaFatturaEmessa: (v: Record<string, unknown>) => void
  setPopupNuovaFatturaEmessa: (v: boolean) => void
  setFatturaEmessaAperta: (v: RigaFatturaUI) => void

  caricaFatturaEmessaPdf: (file: File) => void | Promise<void>
  caricaFattureEmesse: () => void | Promise<void>

  ordinaFattureEmesse: (campo: string) => void
  formatMoney: (v: unknown) => string

  cardStyle: CSSProperties
  inputStyle: CSSProperties
  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function FattureEmessePanel({
  fattureEmesseOrdinate,
  filtroFattureEmesse,
  setFiltroFattureEmesse,
  setNuovaFatturaEmessa,
  setPopupNuovaFatturaEmessa,
  setFatturaEmessaAperta,
  caricaFatturaEmessaPdf,
  caricaFattureEmesse,
  ordinaFattureEmesse,
  formatMoney,
  cardStyle,
  inputStyle,
  excelTable,
  excelTh,
  excelTd,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const [nomiCantieri, setNomiCantieri] = useState<Record<string, string>>({})
  useEffect(() => {
    let attivo = true
    void Promise.resolve(supabase.from('cantieri').select('id,nome')).then(r => {
      if (attivo && !r.error) setNomiCantieri(Object.fromEntries((r.data ?? []).map(c => [c.id, c.nome])))
    }).catch(() => { if (attivo) setNomiCantieri({}) })
    return () => { attivo = false }
  }, [])
  const [collegaId, setCollegaId] = useState<string | null>(null)

  return (
    <section style={cardStyle}>
      <h3>🧾 Fatture emesse</h3>

      <BluenextIntegrato client={supabase} cantieri={nomiCantieri} onAggiorna={caricaFattureEmesse} buttonStyle={buttonSecondary} />

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >

        <label style={buttonSecondary}>
          Carica PDF fattura

          <input
            type="file"
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const input = e.currentTarget
              const file = e.target.files?.[0]

              if (!file) return

              await caricaFatturaEmessaPdf(file)

              input.value = ''
            }}
          />
        </label>

      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <input
          type="text"
          placeholder="Numero fattura..."
          value={filtroFattureEmesse || ''}
          onChange={(e) => setFiltroFattureEmesse(e.target.value)}
          style={inputStyle}
        />

        <button
          onClick={() => {
            setNuovaFatturaEmessa({
              numero_fattura: '',
              data_fattura: '',
              cliente: '',
              cantiere: '',
              imponibile: 0,
              iva: 22,
              totale: 0,
              importo_incassato: 0,
              stato: 'emessa',
              note: '',
            })

            setPopupNuovaFatturaEmessa(true)
          }}
          style={buttonPrimary}
        >
          ➕ Nuova fattura
        </button>
      </div>

      <div
        style={{
          height: '70vh',
          width: '100%',
          resize: 'both',
          overflow: 'auto',
          minWidth: 600,
          minHeight: 300,
          maxWidth: '95vw',
          maxHeight: '80vh',
          border: '1px solid #cbd5e1',
          borderRadius: 10,
          background: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <table
          style={{
            ...excelTable,
            tableLayout: 'auto',
            width: 'max-content',
            minWidth: '100%',
          }}
        >
          <thead>
            <tr>
              <th
                onClick={() => ordinaFattureEmesse('data_fattura')}
                style={{
                  ...excelTh,
                  cursor: 'pointer',
                  whiteSpace: 'normal',
                }}
              >
                Data ↕
              </th>

              <th
                onClick={() => ordinaFattureEmesse('numero_fattura')}
                style={{
                  ...excelTh,
                  cursor: 'pointer',
                  whiteSpace: 'normal',
                }}
              >
                Numero ↕
              </th>

              <th
                onClick={() => ordinaFattureEmesse('cliente')}
                style={{
                  ...excelTh,
                  cursor: 'pointer',
                  whiteSpace: 'normal',
                }}
              >
                Cliente ↕
              </th>

              <th
                onClick={() => ordinaFattureEmesse('cantiere')}
                style={{
                  ...excelTh,
                  cursor: 'pointer',
                  whiteSpace: 'normal',
                }}
              >
                Cantiere ↕
              </th>

              <th
                onClick={() => ordinaFattureEmesse('totale')}
                style={{
                  ...excelTh,
                  cursor: 'pointer',
                  whiteSpace: 'normal',
                }}
              >
                Totale ↕
              </th>

              <th
                onClick={() => ordinaFattureEmesse('importo_incassato')}
                style={{
                  ...excelTh,
                  cursor: 'pointer',
                  whiteSpace: 'normal',
                }}
              >
                Incassato storico ↕
              </th>

              <th
                onClick={() => ordinaFattureEmesse('stato')}
                style={{
                  ...excelTh,
                  cursor: 'pointer',
                  whiteSpace: 'normal',
                }}
              >
                Stato storico ↕
              </th>

              <th style={excelTh}>Incassi collegati</th><th style={{ ...excelTh, whiteSpace: 'normal' }}>PDF</th>
            </tr>
          </thead>

          <tbody>
            {fattureEmesseOrdinate
              .filter((f) => {
                const cerca = (filtroFattureEmesse || '').toLowerCase()

                return (
                  String(f.numero_fattura || '')
                    .toLowerCase()
                    .includes(cerca) ||
                  String(f.cliente || '')
                    .toLowerCase()
                    .includes(cerca)
                )
              })
              .map((f, i) => (
                <tr
                  key={f.id || i}
                  onClick={() => setFatturaEmessaAperta(f)}
                  style={{
                    cursor: 'pointer',
                  }}
                >
                  <td style={excelTd}>{f.data_fattura}</td>
                  <td style={excelTd}>{f.numero_fattura}</td>
                  <td style={excelTd}>{f.cliente}</td>
                  <td style={excelTd}>{f.cantiere_id ? nomiCantieri[f.cantiere_id] ?? 'Nome cantiere non disponibile' : 'Non associata'}{f.cantiere && f.cantiere_id && nomiCantieri[f.cantiere_id] && f.cantiere !== nomiCantieri[f.cantiere_id] && <small role="status"> · Nome storico discordante</small>}{f.cantiere && !f.cantiere_id && <small> · Nome storico senza UUID: da verificare</small>}</td>

                  <td style={excelTd}>
                    {formatMoney(Number(f.totale || 0))}
                  </td>

                  <td style={excelTd}>
                    {numeroDichiarato(f.importo_incassato) === null ? 'Da verificare' : formatMoney(numeroDichiarato(f.importo_incassato))}
                  </td>

                  <td style={excelTd}>{f.stato || 'Da verificare'}</td>
                  <td style={excelTd} onClick={e => e.stopPropagation()}>{f.id && <ContrattoFiscalePanel id={f.id} />}{f.id && f.cantiere_id && <IncassiLordiPanel id={f.id} contesto="fattura" />}<FontiBluenext client={supabase} fatturaId={f.id} /><RiconciliazioneAzione client={supabase} fatturaId={f.id} etichetta="Riconcilia acconto" onConfermato={caricaFattureEmesse} /><CollegaIncassoAzione cantiereId={f.cantiere_id} onClick={e => { e.stopPropagation(); setCollegaId(f.id) }} /></td>

                  <td style={excelTd}>
                    {f.pdf_url ? (
                      <a
                        href={f.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          ...buttonSecondary,
                          display: 'inline-block',
                          textDecoration: 'none',
                          padding: '5px 8px',
                        }}
                      >
                        📕 PDF
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      {collegaId && <CollegaIncassoPanel key={collegaId} client={supabase} fatturaId={collegaId} cantiereId={cantiereDocumento(fattureEmesseOrdinate, collegaId)} onChiudi={() => setCollegaId(null)} onConfermato={caricaFattureEmesse} />}
</div>
    </section>
  )
}
