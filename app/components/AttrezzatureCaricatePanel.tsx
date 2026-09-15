'use client'

import { useId, useState, type CSSProperties } from 'react'
import PrezzoMaterialeInput from './PrezzoMaterialeInput'
import { calcolaAttrezzoManuale } from '../utils/attrezzoManuale'

type Props = {
  contestuale?: boolean
  totaleAttrezzature?: number
  form?: {
    descrizione: string; setDescrizione: (v: string) => void
    quantita: string; setQuantita: (v: string) => void
    prezzo: string; setPrezzo: (v: string) => void
    fornitore: string; setFornitore: (v: string) => void
    data: string; setData: (v: string) => void
    nomeFile: string; setNomeFile: (v: string) => void
    nota: string; setNota: (v: string) => void
    salva: () => void | Promise<void>
  }
  suggerimentiDescrizione?: string[]
  inputStyle?: CSSProperties
  buttonPrimary?: CSSProperties
  excelTable?: CSSProperties
  excelTh?: CSSProperties
  excelTd?: CSSProperties
  mostraAttrezziCantiere: boolean
  setMostraAttrezziCantiere: (v: boolean) => void
  attrezziCantiere: any[]
  cantiereScheda: string
  buttonSecondary: CSSProperties
  formatMoney: (v: number) => string
 onElimina: (a: any) => void | Promise<void>
}

export default function AttrezzatureCaricatePanel({
  contestuale = false, totaleAttrezzature, form,
  suggerimentiDescrizione = [], inputStyle, buttonPrimary, excelTable, excelTh, excelTd,
  mostraAttrezziCantiere,
  setMostraAttrezziCantiere,
  attrezziCantiere,
  cantiereScheda,
  buttonSecondary,
  formatMoney,
 onElimina,
}: Props) {
  const descrizioniId = useId()
  const [ordine, setOrdine] = useState({ campo: 'data_documento', direzione: 'desc' })
  const ordina = (campo: string) => setOrdine((precedente) => ({
    campo, direzione: precedente.campo === campo && precedente.direzione === 'asc' ? 'desc' : 'asc',
  }))
  const righe = attrezziCantiere.filter((a) => a.cantiere === cantiereScheda)
    .sort((a, b) => {
      const confronto = ['quantita', 'prezzo_unitario', 'totale'].includes(ordine.campo)
        ? Number(a[ordine.campo] || 0) - Number(b[ordine.campo] || 0)
        : String(a[ordine.campo] || '').toLocaleLowerCase('it-IT').localeCompare(String(b[ordine.campo] || '').toLocaleLowerCase('it-IT'))
      return ordine.direzione === 'asc' ? confronto : -confronto
    })
  if (contestuale) {
    const manuale = form ? calcolaAttrezzoManuale(form.quantita, form.prezzo) : null
    const campoStyle: CSSProperties = { ...inputStyle, width: '100%', minWidth: 0, boxSizing: 'border-box' }
    const cellaStyle: CSSProperties = { ...excelTd, padding: '5px 8px', whiteSpace: 'normal', overflowWrap: 'anywhere', verticalAlign: 'top' }
    return (
      <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8, minWidth: 0 }}>
        <strong>Totale attrezzature cantiere:</strong> {formatMoney(totaleAttrezzature ?? 0)}
        <div style={{ marginTop: 12, overflow: 'auto', border: '1px solid #cbd5e1', borderRadius: 10, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          {form && (
            <div style={{ padding: 15, border: '1px solid #cbd5e1', borderRadius: 12, marginBottom: 20, background: '#f8fafc' }}>
              <h3>Inserimento attrezzatura manuale</h3>
              <input aria-label="Descrizione attrezzatura" placeholder="Descrizione attrezzatura" list={descrizioniId}
                value={form.descrizione} onChange={(e) => form.setDescrizione(e.target.value)}
                style={{ ...campoStyle, marginBottom: 8 }} />
              <datalist id={descrizioniId}>
                {suggerimentiDescrizione.filter((nome) => nome.toLocaleLowerCase('it-IT').includes(form.descrizione.toLocaleLowerCase('it-IT')))
                  .map((nome) => <option key={nome} value={nome} />)}
              </datalist>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 10 }}>
                {[
                  { titolo: 'Quantità', valore: form.quantita, imposta: form.setQuantita },
                  { titolo: 'Prezzo unitario €', valore: form.prezzo, imposta: form.setPrezzo, calcolatrice: true },
                  { titolo: 'Fornitore / provenienza', valore: form.fornitore, imposta: form.setFornitore },
                  { titolo: 'Data documento', valore: form.data, imposta: form.setData, tipo: 'date' },
                  { titolo: 'Nome file', valore: form.nomeFile, imposta: form.setNomeFile },
                ].map((campo) => campo.calcolatrice ? (
                  <PrezzoMaterialeInput key={campo.titolo} value={form.prezzo} onChange={form.setPrezzo}
                    inputStyle={campoStyle} buttonStyle={buttonSecondary} />
                ) : (
                  <input key={campo.titolo} aria-label={campo.titolo} placeholder={campo.titolo} type={campo.tipo || 'text'}
                    value={campo.valore} onChange={(e) => campo.imposta(e.target.value)} style={campoStyle} />
                ))}
              </div>
              <textarea aria-label="Nota" placeholder="Nota" value={form.nota} onChange={(e) => form.setNota(e.target.value)}
                style={{ ...campoStyle, minHeight: 70, marginTop: 10 }} />
              <p aria-live="polite"><strong>Totale:</strong> {manuale ? formatMoney(manuale.totale) : 'Inserisci quantità e prezzo validi'}</p>
              <button type="button" onClick={form.salva} style={{ ...buttonPrimary, marginTop: 12 }}>Salva attrezzatura</button>
            </div>
          )}
          {righe.length === 0 ? <p style={{ padding: 12 }}>Nessuna attrezzatura corrispondente ai filtri per questo cantiere.</p> : (
            <table style={{ ...excelTable, tableLayout: 'auto', minWidth: 800, width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {[
                  ['data_documento', 'Data'], ['descrizione', 'Descrizione'], ['fornitore', 'Fornitore'],
                  ['quantita', 'Q.tà'], ['prezzo_unitario', 'Prezzo unit.'], ['totale', 'Totale'],
                  ['nome_file', 'File'], ['nota', 'Nota'],
                ].map(([campo, titolo]) => (
                  <th key={campo} aria-sort={ordine.campo === campo ? (ordine.direzione === 'asc' ? 'ascending' : 'descending') : 'none'}
                    style={{ ...excelTh, whiteSpace: 'normal' }}>
                    <button type="button" onClick={() => ordina(campo)} style={{ border: 0, background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0 }}>{titolo} ↕</button>
                  </th>
                ))}
                <th style={{ ...excelTh, whiteSpace: 'normal' }}>Azioni</th>
              </tr></thead>
              <tbody>{righe.map((a, i) => (
                <tr key={a.id || i}>
                  <td style={cellaStyle}>{a.data_documento || '-'}</td>
                  <td style={cellaStyle}>{a.descrizione || '-'}</td>
                  <td style={cellaStyle}>{a.fornitore || '-'}</td>
                  <td style={cellaStyle}>{a.quantita ?? '-'}</td>
                  <td style={cellaStyle}>{formatMoney(Number(a.prezzo_unitario || 0))}</td>
                  <td style={cellaStyle}><strong>{formatMoney(Number(a.totale || 0))}</strong></td>
                  <td style={cellaStyle}>{a.file_url ? <a href={a.file_url} target="_blank" rel="noopener noreferrer">{a.nome_file || 'Apri file'}</a> : a.nome_file || '-'}</td>
                  <td style={cellaStyle}>{a.nota || '-'}</td>
                  <td style={cellaStyle}><button type="button" onClick={() => onElimina(a)}
                    style={{ ...buttonSecondary, backgroundColor: '#dc2626', color: '#fff' }}>Elimina</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    )
  }
  return (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <strong>Attrezzature / noli caricati:</strong>

      <button
        onClick={() => setMostraAttrezziCantiere(!mostraAttrezziCantiere)}
        style={{ ...buttonSecondary, marginLeft: 10 }}
      >
        {mostraAttrezziCantiere ? 'Nascondi anteprima' : 'Vedi anteprima attrezzature'}
      </button>

      {attrezziCantiere.filter((a) => a.cantiere === cantiereScheda).length === 0 ? (
        <p>Nessuna attrezzatura caricata.</p>
      ) : (
        mostraAttrezziCantiere && (
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            {attrezziCantiere
              .filter((a) => a.cantiere === cantiereScheda)
              .sort((a, b) =>
                String(b.data_documento || '').localeCompare(
                  String(a.data_documento || '')
                )
              )
              .map((a, i) => (
                <div
                  key={a.id || i}
                  style={{
                    padding: 12,
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    background: '#fff',
                  }}
                >
                  <strong>
                    {a.nome_file || a.descrizione || `Attrezzatura ${i + 1}`}
                  </strong>

                  <br />

                  <div style={{ marginTop: 8 }}>
                    <strong>Importo:</strong>{' '}
                    {formatMoney(Number(a.totale || 0))}
                  </div>

                  <br />
                  Fornitore: {a.fornitore || '-'}
                  <br />
                  Data: {a.data_documento || '-'}
                  <br />
                  Nota: {a.nota || '-'}

                  {a.file_tipo === 'pdf' && a.file_url && (
                    <div
                      style={{
                        width: 700,
                        height: 500,
                        minWidth: 300,
                        minHeight: 250,
                        resize: 'both',
                        overflow: 'auto',
                        border: '1px solid #ddd',
                        borderRadius: 8,
                        marginTop: 10,
                      }}
                    >
                      <iframe
                        src={a.file_url}
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                        }}
                      />
                    </div>
                  )}

                  {a.file_tipo === 'img' && a.file_url && (
                    <div
                      style={{
                        width: 700,
                        height: 500,
                        minWidth: 300,
                        minHeight: 250,
                        resize: 'both',
                        overflow: 'auto',
                        border: '1px solid #ddd',
                        borderRadius: 8,
                        marginTop: 10,
                      }}
                    >
                      <img
                        src={a.file_url}
                        style={{
                          width: '100%',
                          display: 'block',
                        }}
                      />
                    </div>
                  )}

                  <div style={{ marginTop: 10 }}>
                    <button
                      onClick={() => onElimina(a)}
                      style={{
                        backgroundColor: '#d9534f',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 10px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Elimina attrezzatura
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )
      )}
    </div>
  )
}