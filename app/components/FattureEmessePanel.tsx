'use client'
import ContrattoFiscalePanel from './ContrattoFiscalePanel'

import { useRef, useState, type CSSProperties, type ChangeEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import CollegaIncassoPanel, { CollegaIncassoAzione } from './CollegaIncassoPanel'
import { cantiereDocumento } from '../engines/contabilita-ditta/attribuzioni'
import { leggiDocumentiArchivioBluenext } from '../engines/fatture/import-zip'
import { leggiFatturaEmessaXml, riepilogaBluenext, type VoceBluenext } from '../engines/fatture/documento-fiscale'

type Props = {
  fattureEmesseOrdinate: any[]
  filtroFattureEmesse: string
  setFiltroFattureEmesse: (v: string) => void

  setNuovaFatturaEmessa: (v: any) => void
  setPopupNuovaFatturaEmessa: (v: boolean) => void
  setFatturaEmessaAperta: (v: any) => void

  caricaFatturaEmessaPdf: (file: File) => void | Promise<void>
  caricaFattureEmesse: () => void | Promise<void>

  ordinaFattureEmesse: (campo: string) => void
  formatMoney: (v: any) => string

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
  const [collegaId, setCollegaId] = useState<string | null>(null)
  const [anteprima, setAnteprima] = useState<VoceBluenext[]>([])
  const riepilogo = riepilogaBluenext(anteprima, fattureEmesseOrdinate)
  const [letturaZip, setLetturaZip] = useState(false)
  const importazioneInCorso = useRef(false)
  const [salvataggioZip, setSalvataggioZip] = useState(false)
  const [risultatoZip, setRisultatoZip] = useState<Record<string, number> | null>(null)
  const [cantieriImport, setCantieriImport] = useState<{ id: string; nome: string }[]>([])
  const [cantiereImport, setCantiereImport] = useState('')
  const [erroreZip, setErroreZip] = useState('')
  const leggiAnteprimaBluenext = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (!files.length || letturaZip) return
    setLetturaZip(true)
    setErroreZip('')
    setRisultatoZip(null)
    try {
      const documenti: VoceBluenext[] = []
      async function aggiungiXml(nome: string, testo: string) {
        try {
          const documento = leggiFatturaEmessaXml(testo)
          const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(testo))
          const impronta = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
          documenti.push({ nome, documento, xml: testo, impronta, stato: 'Letto' })
        } catch (errore) {
          documenti.push({ nome, stato: errore instanceof Error ? errore.message : 'XML non leggibile' })
        }
      }
      for (const file of files) {
        if (file.name.toLowerCase().endsWith('.xml')) await aggiungiXml(file.name, await file.text())
        else if (file.name.toLowerCase().endsWith('.zip')) {
          try {
            for (const voce of await leggiDocumentiArchivioBluenext(await file.arrayBuffer())) {
              const nome = file.name + ' / ' + voce.nome
              if (voce.xml !== null) await aggiungiXml(nome, voce.xml)
              else documenti.push({ nome, stato: 'PDF da associare dal Registro' })
            }
          } catch {
            documenti.push({ nome: file.name, stato: 'Archivio Bluenext non leggibile' })
          }
        } else {
          documenti.push({ nome: file.name, stato: 'Documento da associare dal Registro' })
        }
      }
      const { data: cantieri } = await supabase.from('cantieri').select('id,nome').order('nome')
      if (cantieri) setCantieriImport(cantieri)
      setAnteprima(corrente => [...corrente, ...documenti])
      if (!documenti.length) setErroreZip('Nessun documento riconosciuto nell’archivio.')
    } catch {
      setErroreZip('Archivio Bluenext non leggibile.')
    } finally {
      setLetturaZip(false)
    }
  }
  const salvaArchivioBluenext = async () => {
    const nuove = riepilogo.esiti.filter(voce => voce.stato === 'Nuova' && voce.xml)
    if (!nuove.length || importazioneInCorso.current || letturaZip) return
    importazioneInCorso.current = true
    setSalvataggioZip(true)
    setErroreZip('')
    const contatori: Record<string, number> = { Nuova: 0, 'Già presente': 0, Ambigua: 0, Errore: riepilogo.scarti.length }
    const sospese = riepilogo.esiti.filter(voce => voce.stato === 'Ambigua' || voce.stato === 'Modificata')
    contatori.Ambigua = sospese.length
    contatori['Già presente'] = riepilogo.esiti.filter(voce => voce.stato === 'Già presente').length
    try {
      for (let i = 0; i < nuove.length; i += 10) {
        const documenti = nuove.slice(i, i + 10).map(voce => voce.xml!)
        const { data, error } = await supabase.rpc('importa_fatture_bluenext', { p_documenti: documenti, p_cantiere: cantiereImport || null })
        if (error || !Array.isArray(data) || data.length !== documenti.length) {
          setErroreZip('Esito del lotto non confermato. Rileggi e riprova: le fatture già registrate sono riconosciute.')
          break
        }
        for (const esito of data) contatori[esito.stato] = (contatori[esito.stato] ?? 0) + 1
      }
      setRisultatoZip(contatori)
      await caricaFattureEmesse()
    } catch {
      setRisultatoZip(contatori)
      setErroreZip('Esito non confermato. Rileggi il Registro prima di riprovare.')
    } finally {
      importazioneInCorso.current = false
      setSalvataggioZip(false)
    }
  }

  return (
    <section style={cardStyle}>
      <h3>🧾 Fatture emesse</h3>

      <label style={buttonSecondary}>
        Analizza archivio Bluenext
        <input type="file" accept=".zip,.xml" multiple hidden disabled={letturaZip || salvataggioZip} onChange={leggiAnteprimaBluenext} />
      </label>
      {letturaZip && <p role="status">Lettura archivio…</p>}
      {erroreZip && <p role="alert">{erroreZip}</p>}
      {risultatoZip && <p role="status">Nuove {risultatoZip.Nuova} · Già presenti {risultatoZip['Già presente']} · Da verificare {risultatoZip.Ambigua} · Errori {risultatoZip.Errore}</p>}
      {anteprima.length > 0 && <section aria-label="Anteprima Bluenext">
        <h4>Anteprima Bluenext</h4>
        <p>Esito SdI da verificare. L’XML da solo non documenta l’accettazione.</p>
        <p>I periodi indicano i documenti osservati. La completezza del trimestre resta da verificare.</p>
        <h5>Per periodo</h5>
        <ul>{riepilogo.periodi.map(([periodo, c]) => <li key={periodo}>
          {periodo}{periodo.length === 4 ? ' · trimestre ambiguo' : ''} · {c.documenti} documenti ·
          Nuovi {c.nuove} · Già presenti {c.presenti} · Modificati {c.modificate} · Ambigui {c.ambigue}
        </li>)}</ul>
        <h5>Per anno</h5>
        <ul>{riepilogo.anni.map(([anno, totale]) => <li key={anno}>{anno} · {totale} documenti distinti</li>)}</ul>
        <ul>{riepilogo.esiti.map(({ nome, documento, stato, copie, fonti }, i) => <li key={nome + i}>
          {documento ? [documento.numero, documento.data, documento.tipo, documento.cliente,
            'Imponibile ' + formatMoney(documento.imponibile), 'IVA ' + formatMoney(documento.iva),
            'Totale ' + formatMoney(documento.totale)].join(' · ') : nome} · {stato}
          {copie > 1 && ` · ${copie} occorrenze · ${fonti.length} fonti distinte`}
        </li>)}</ul>
        {riepilogo.scarti.length > 0 && <ul>{riepilogo.scarti.map(({ nome, stato }, i) => <li key={nome + i}>{nome} · {stato}</li>)}</ul>}
        <label>Cantiere per le nuove fatture
          <select value={cantiereImport} disabled={salvataggioZip} onChange={event => setCantiereImport(event.target.value)}>
            <option value="">Senza cantiere</option>
            {cantieriImport.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <button type="button" style={buttonPrimary} disabled={salvataggioZip || letturaZip || !riepilogo.esiti.some(voce => voce.stato === 'Nuova')}
          onClick={() => void salvaArchivioBluenext()}>Conferma importazione delle fatture nuove</button>
        <button type="button" style={buttonSecondary} disabled={salvataggioZip} onClick={() => setAnteprima([])}>Chiudi anteprima</button>
      </section>}

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
                Incassato ↕
              </th>

              <th
                onClick={() => ordinaFattureEmesse('stato')}
                style={{
                  ...excelTh,
                  cursor: 'pointer',
                  whiteSpace: 'normal',
                }}
              >
                Stato ↕
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
                  <td style={excelTd}>{f.cantiere}</td>

                  <td style={excelTd}>
                    {formatMoney(Number(f.totale || 0))}
                  </td>

                  <td style={excelTd}>
                    {formatMoney(Number(f.importo_incassato || 0))}
                  </td>

                  <td style={excelTd}>{f.stato || 'emessa'}</td>
                  <td style={excelTd} onClick={e => e.stopPropagation()}>{f.id && <ContrattoFiscalePanel id={f.id} />}<CollegaIncassoAzione cantiereId={f.cantiere_id} onClick={e => { e.stopPropagation(); setCollegaId(f.id) }} /></td>

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
