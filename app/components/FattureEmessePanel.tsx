'use client'

import type { CSSProperties, ChangeEvent } from 'react'
import JSZip from 'jszip'

type Props = {
  fattureEmesseOrdinate: any[]
  filtroFattureEmesse: string
  setFiltroFattureEmesse: (v: string) => void

  setNuovaFatturaEmessa: (v: any) => void
  setPopupNuovaFatturaEmessa: (v: boolean) => void
  setFatturaEmessaAperta: (v: any) => void

  caricaFatturaEmessaPdf: (file: File) => void | Promise<void>
  caricaFatturaEmessaXml: (file: File) => void | Promise<void>
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
  caricaFatturaEmessaXml,
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
  const gestisciAggiornaBluenext = async (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const input = e.currentTarget
    const files = Array.from(e.target.files || [])

    const fatture = files.filter(
      (file) =>
        file.name.toLowerCase().endsWith('.xml') ||
        file.name.toLowerCase().endsWith('.pdf') ||
        file.name.toLowerCase().endsWith('.zip')
    )

    if (fatture.length === 0) {
      alert('Nessun file XML o PDF trovato.')
      return
    }

    alert(`Trovate ${fatture.length} fatture emesse da controllare.`)

    for (const file of fatture) {
      const nome = file.name.toLowerCase()

      if (nome.endsWith('.xml')) {
        await caricaFatturaEmessaXml(file)
      }

      if (nome.endsWith('.pdf')) {
        await caricaFatturaEmessaPdf(file)
      }

      if (nome.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file)

        const fileZip = Object.values(zip.files).filter(
          (f) =>
            !f.dir &&
            (f.name.toLowerCase().endsWith('.xml') ||
              f.name.toLowerCase().endsWith('.pdf'))
        )

        for (const voce of fileZip) {
          const blob = await voce.async('blob')
          const nomeFile = voce.name.split('/').pop() || voce.name

          const fileEstratto = new File([blob], nomeFile, {
            type: nomeFile.toLowerCase().endsWith('.pdf')
              ? 'application/pdf'
              : 'text/xml',
          })

          if (nomeFile.toLowerCase().endsWith('.xml')) {
            await caricaFatturaEmessaXml(fileEstratto)
          }

          if (nomeFile.toLowerCase().endsWith('.pdf')) {
            await caricaFatturaEmessaPdf(fileEstratto)
          }
        }
      }
    }

    input.value = ''
  }

  const gestisciImportaZipBluenext = async (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const input = e.currentTarget
    const file = e.target.files?.[0]

    if (!file) return

    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert('Seleziona un file ZIP Bluenext.')
      input.value = ''
      return
    }

    const conferma = confirm(
      `Importare le fatture emesse contenute nello ZIP?\n\nFile: ${file.name}`
    )

    if (!conferma) {
      input.value = ''
      return
    }

    try {
      const zip = await JSZip.loadAsync(file)

      const fileZip = Object.values(zip.files).filter(
        (voce) =>
          !voce.dir &&
          (voce.name.toLowerCase().endsWith('.xml') ||
            voce.name.toLowerCase().endsWith('.pdf'))
      )

      if (fileZip.length === 0) {
        alert('Nessun XML o PDF trovato nello ZIP.')
        input.value = ''
        return
      }

      const fileEstratti: File[] = []

      for (const voce of fileZip) {
        const blob = await voce.async('blob')
        const nomeFile = voce.name.split('/').pop() || voce.name

        fileEstratti.push(
          new File([blob], nomeFile, {
            type: nomeFile.toLowerCase().endsWith('.pdf')
              ? 'application/pdf'
              : 'text/xml',
          })
        )
      }

      let importatiXml = 0
      let importatiPdf = 0

      for (const fileEstratto of fileEstratti) {
        if (fileEstratto.name.toLowerCase().endsWith('.xml')) {
          await caricaFatturaEmessaXml(fileEstratto)
          importatiXml++
        }
      }

      await caricaFattureEmesse()

      for (const fileEstratto of fileEstratti) {
        if (fileEstratto.name.toLowerCase().endsWith('.pdf')) {
          await caricaFatturaEmessaPdf(fileEstratto)
          importatiPdf++
        }
      }

      await caricaFattureEmesse()

      alert(
        `Import ZIP completato.\nXML controllati: ${importatiXml}\nPDF controllati: ${importatiPdf}`
      )
    } catch (errore) {
      console.error(errore)
      alert('Errore durante import ZIP Bluenext.')
    }

    input.value = ''
  }

  return (
    <section style={cardStyle}>
      <h3>🧾 Fatture emesse</h3>

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <button style={buttonPrimary}>Carica XML fattura</button>

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

        <label style={buttonPrimary}>
          🔄 Aggiorna fatture Bluenext

          <input
            type="file"
            multiple
            // @ts-ignore
            webkitdirectory="true"
            style={{ display: 'none' }}
            onChange={gestisciAggiornaBluenext}
          />
        </label>

        <label style={buttonSecondary}>
          📦 Importa ZIP Bluenext

          <input
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            style={{ display: 'none' }}
            onChange={gestisciImportaZipBluenext}
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

              <th style={{ ...excelTh, whiteSpace: 'normal' }}>PDF</th>
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
      </div>
    </section>
  )
}