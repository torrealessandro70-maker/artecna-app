'use client'

import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import JSZip from 'jszip'
import { supabase } from '../../lib/supabaseClient'

type Props = {
  cardStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
  excelBox: CSSProperties

  cantieri: any[]
  fattureFornitori: any[]
  fattureOrdinate: any[]
  righeFatturaDaAssegnare: any[]
  righeFatturaAperta: any[]

  fatturaNomeFile: string
  fatturaFornitore: string
  fatturaPartitaIva: string
  fatturaNumero: string
  fatturaData: string

  cantiereMassivoFattura: string
  categoriaMassivaFattura: string
  filtroFattureFornitore: string
  filtroFattureStato: string
  fatturaApertaId: string | null
  nascondiCantieriConclusiFatture: boolean
  larghezzaDescrizioneFattura: number

  setFatturaFornitore: Dispatch<SetStateAction<string>>
  setFatturaPartitaIva: Dispatch<SetStateAction<string>>
  setFatturaNumero: Dispatch<SetStateAction<string>>
  setFatturaData: Dispatch<SetStateAction<string>>
  setFatturaTotale: Dispatch<SetStateAction<string>>
  setFatturaNomeFile: Dispatch<SetStateAction<string>>
  setFatturaTipoFile: Dispatch<SetStateAction<string>>
  setFatturaTestoOriginale: Dispatch<SetStateAction<string>>

  setRigheFatturaDaAssegnare: Dispatch<SetStateAction<any[]>>
  setRigheFatturaAperta: Dispatch<SetStateAction<any[]>>
  setCantiereMassivoFattura: Dispatch<SetStateAction<string>>
  setCategoriaMassivaFattura: Dispatch<SetStateAction<string>>
  setFatturaApertaId: Dispatch<SetStateAction<string | null>>
  setNascondiCantieriConclusiFatture: Dispatch<SetStateAction<boolean>>
  setLarghezzaDescrizioneFattura: Dispatch<SetStateAction<number>>

  caricaFatturaXml: (file: File) => Promise<void> | void
  caricaFatturaPdf: (file: File) => Promise<void> | void
  caricaFattureFornitori: () => Promise<void> | void
  importaFatturaSilenziosa: (dati: any, righe: any[]) => Promise<any>
  numeroXml: (valore: string) => number
  formatMoney: (valore: any) => string
  salvaFatturaFornitore: () => Promise<void> | void
  ordinaFatture: (campo: string) => void
  apriFatturaFornitore: (id: string) => Promise<void> | void
  eliminaFatturaFornitore: (fattura: any) => Promise<void> | void
  salvaModificheFatturaAperta: () => Promise<void> | void
}

export default function RegistroFattureFornitoriPanel({
  cardStyle,
  buttonPrimary,
  buttonSecondary,
  excelTable,
  excelTh,
  excelTd,
  excelBox,

  cantieri,
  fattureFornitori,
  fattureOrdinate,
  righeFatturaDaAssegnare,
  righeFatturaAperta,

  fatturaNomeFile,
  fatturaFornitore,
  fatturaPartitaIva,
  fatturaNumero,
  fatturaData,

  cantiereMassivoFattura,
  categoriaMassivaFattura,
  filtroFattureFornitore,
  filtroFattureStato,
  fatturaApertaId,
  nascondiCantieriConclusiFatture,
  larghezzaDescrizioneFattura,

  setFatturaFornitore,
  setFatturaPartitaIva,
  setFatturaNumero,
  setFatturaData,
  setFatturaTotale,
  setFatturaNomeFile,
  setFatturaTipoFile,
  setFatturaTestoOriginale,
  setRigheFatturaDaAssegnare,
  setRigheFatturaAperta,
  setCantiereMassivoFattura,
  setCategoriaMassivaFattura,
  setFatturaApertaId,
  setNascondiCantieriConclusiFatture,
  setLarghezzaDescrizioneFattura,

  caricaFatturaXml,
  caricaFatturaPdf,
  caricaFattureFornitori,
  importaFatturaSilenziosa,
  numeroXml,
  formatMoney,
  salvaFatturaFornitore,
  ordinaFatture,
  apriFatturaFornitore,
  eliminaFatturaFornitore,
  salvaModificheFatturaAperta,
}: Props) {
 return (
  <>

    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
      <label style={buttonPrimary}>
        Carica XML fattura
        <input
          type="file"
          accept=".xml,text/xml,application/xml"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) caricaFatturaXml(file)
            e.currentTarget.value = ''
          }}
        />
      </label>
<label style={buttonSecondary}>
  Carica PDF fattura
  <input
    type="file"
    accept=".pdf,application/pdf"
    style={{ display: 'none' }}
    onChange={(e) => {
      const file = e.target.files?.[0]
      if (file) caricaFatturaPdf(file)
      e.currentTarget.value = ''
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
    onChange={async (e) => {
const input = e.currentTarget
      const files = Array.from(e.target.files || [])

      const fatture = files.filter((file) =>
  file.name.toLowerCase().endsWith('.xml') ||
  file.name.toLowerCase().endsWith('.pdf') ||
  file.name.toLowerCase().endsWith('.zip')
)

      if (fatture.length === 0) {
        alert('Nessun file XML o PDF trovato nella cartella selezionata.')
        return
      }

      alert(`Trovate ${fatture.length} fatture da controllare.`)

      for (const file of fatture) {
  const nome = file.name.toLowerCase()

  if (nome.endsWith('.xml')) {
    await caricaFatturaXml(file)
  }

  if (nome.endsWith('.pdf')) {
    await caricaFatturaPdf(file)
  }

  if (nome.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(file)

    const fileZip = Object.values(zip.files).filter((f) =>
      !f.dir &&
      (
        f.name.toLowerCase().endsWith('.xml') ||
        f.name.toLowerCase().endsWith('.pdf')
      )
    )

    if (fileZip.length === 0) {
      alert(`Nessun XML o PDF trovato dentro ${file.name}`)
      continue
    }

    for (const voce of fileZip) {
      const blob = await voce.async('blob')
      const nomeFile = voce.name.split('/').pop() || voce.name

      const fileEstratto = new File([blob], nomeFile, {
        type: nomeFile.toLowerCase().endsWith('.pdf')
          ? 'application/pdf'
          : 'text/xml',
      })

      if (nomeFile.toLowerCase().endsWith('.xml')) {
        await caricaFatturaXml(fileEstratto)
      }

      if (nomeFile.toLowerCase().endsWith('.pdf')) {
        await caricaFatturaPdf(fileEstratto)
      }
    }
  }
}

      input.value = ''
    }}
  />
</label>

<label style={buttonSecondary}>
  📦 Importa ZIP Bluenext
  <input
    type="file"
    accept=".zip,application/zip"
    multiple
    style={{ display: 'none' }}
    onChange={async (e) => {
const input = e.currentTarget
let importate = 0
let duplicati = 0
let errori = 0
      const files = Array.from(e.target.files || [])

      for (const file of files) {
        const zip = await JSZip.loadAsync(file)

        const fileZip = Object.values(zip.files).filter((f) =>
  !f.dir &&
  !f.name.toLowerCase().includes('metadato') &&
  (
    f.name.toLowerCase().endsWith('.xml') ||
    f.name.toLowerCase().endsWith('.pdf')
  )
)

        if (fileZip.length === 0) {
          alert(`Nessun XML o PDF trovato dentro ${file.name}`)
          continue
        }

        for (const voce of fileZip) {
          const blob = await voce.async('blob')
          const nomeFile = voce.name.split('/').pop() || voce.name

          const fileEstratto = new File([blob], nomeFile, {
            type: nomeFile.toLowerCase().endsWith('.pdf')
              ? 'application/pdf'
              : 'text/xml',
          })

         if (nomeFile.toLowerCase().endsWith('.xml')) {
  const testo = await fileEstratto.text()
  const parser = new DOMParser()
  const xml = parser.parseFromString(testo, 'text/xml')

  const datiGeneraliDocumento = xml.getElementsByTagName('DatiGeneraliDocumento')[0]
  const cedente = xml.getElementsByTagName('CedentePrestatore')[0]
  const datiAnagrafici = cedente?.getElementsByTagName('DatiAnagrafici')[0]
  const idFiscaleIva = datiAnagrafici?.getElementsByTagName('IdFiscaleIVA')[0]

  const fornitore =
    datiAnagrafici?.getElementsByTagName('Denominazione')[0]?.textContent?.trim() ||
    datiAnagrafici?.getElementsByTagName('Nome')[0]?.textContent?.trim() ||
    'Fornitore XML'

  const partitaIva =
    idFiscaleIva?.getElementsByTagName('IdCodice')[0]?.textContent?.trim() || ''

  const numero =
    datiGeneraliDocumento?.getElementsByTagName('Numero')[0]?.textContent?.trim() ||
    nomeFile

  const data =
    datiGeneraliDocumento?.getElementsByTagName('Data')[0]?.textContent?.trim() ||
    new Date().toISOString().slice(0, 10)

  const totale =
    numeroXml(
      datiGeneraliDocumento?.getElementsByTagName('ImportoTotaleDocumento')[0]?.textContent?.trim() ||
        '0'
    )

  const dettaglioLinee = Array.from(xml.getElementsByTagName('DettaglioLinee'))

  const righe = dettaglioLinee.map((riga, index) => {
    const numeroLinea = Number(
      riga.getElementsByTagName('NumeroLinea')[0]?.textContent?.trim() || index + 1
    )

    const descrizione =
      riga.getElementsByTagName('Descrizione')[0]?.textContent?.trim() || ''

    const quantita = numeroXml(
      riga.getElementsByTagName('Quantita')[0]?.textContent?.trim() || '1'
    )

    const prezzoUnitario = numeroXml(
      riga.getElementsByTagName('PrezzoUnitario')[0]?.textContent?.trim() || '0'
    )

    const prezzoTotale = numeroXml(
      riga.getElementsByTagName('PrezzoTotale')[0]?.textContent?.trim() || '0'
    )

   const aliquotaIva = numeroXml(
  riga.getElementsByTagName('AliquotaIVA')[0]
    ?.textContent?.trim() || '0'
)

const totaleIvaInclusa =
  prezzoTotale + prezzoTotale * aliquotaIva / 100

return {
  numero_riga: numeroLinea,
  descrizione,
  quantita,
  prezzo_unitario: prezzoUnitario,
  aliquota_iva: aliquotaIva,
  totale_riga: totaleIvaInclusa,
  cantiere: '',
}
  })

  const risultato = await importaFatturaSilenziosa(
    {
      fornitore,
      partitaIva,
      numero,
      data,
      totale,
      nomeFile,
      tipoFile: 'xml',
      testoOriginale: testo,
    },
    righe
  )

  if (risultato.stato === 'importata') importate++
  if (risultato.stato === 'duplicato') duplicati++
  if (risultato.stato === 'errore') errori++
}

if (nomeFile.toLowerCase().endsWith('.pdf')) {
  errori++
}
        }
      }

await caricaFattureFornitori()

alert(
  `Importazione completata.\n\nImportate: ${importate}\nDuplicati: ${duplicati}\nErrori: ${errori}`
)

     input.value = ''
    }}
  />
</label>
    </div>

    {fatturaNomeFile && (
      <div style={{ marginBottom: 16 }}>
        <strong>File:</strong> {fatturaNomeFile}<br />
        <strong>Fornitore:</strong> {fatturaFornitore || '-'}<br />
        <strong>P.IVA:</strong> {fatturaPartitaIva || '-'}<br />
        <strong>Numero:</strong> {fatturaNumero || '-'}<br />
        <strong>Data:</strong> {fatturaData || '-'}<br />
        <strong>Totale righe IVA incl.:</strong>{' '}
{formatMoney(
  righeFatturaDaAssegnare.reduce(
    (tot, r) => tot + Number(r.totale_riga || 0),
    0
  )
)}
      </div>
    )}

{righeFatturaDaAssegnare.length > 0 && (
  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
    <select
      value={cantiereMassivoFattura}
      onChange={(e) => setCantiereMassivoFattura(e.target.value)}
    >
      <option value="">Assegna tutte le righe a...</option>
      <option value="Generale impresa">Generale impresa</option>
      {cantieri.map((c) => (
        <option key={c.id || c.nome} value={c.nome}>
          {c.nome}
        </option>
      ))}
    </select>


    <button
      onClick={() => {
        if (!cantiereMassivoFattura) {
          alert('Seleziona un cantiere')
          return
        }

        setRigheFatturaDaAssegnare((righe) =>
          righe.map((r) => ({
            ...r,
            cantiere: cantiereMassivoFattura,
          }))
        )
      }}
      style={buttonSecondary}
    >
      Applica a tutte
    </button>

    <button
      onClick={salvaFatturaFornitore}
      style={buttonPrimary}
    >
      💾 Salva fattura
    </button>

<button
  onClick={() => {
    setFatturaFornitore('')
    setFatturaPartitaIva('')
    setFatturaNumero('')
    setFatturaData('')
    setFatturaTotale('')
    setFatturaNomeFile('')
    setFatturaTipoFile('')
    setFatturaTestoOriginale('')
    setRigheFatturaDaAssegnare([])
    setCantiereMassivoFattura('')
  }}
  style={buttonSecondary}
>
  🧹 Pulisci anteprima
</button>

  </div>
)}



    {righeFatturaDaAssegnare.length > 0 && (
      <div style={{ overflowX: 'auto' }}>
        <table style={excelTable}>
          <thead>
            <tr>
  <th style={excelTh}>Riga</th>
  <th style={excelTh}>Descrizione</th>
  <th style={excelTh}>Quantità</th>
  <th style={excelTh}>Prezzo unit. netto</th>
  <th style={excelTh}>UM</th>
  <th style={excelTh}>IVA</th>
  <th style={excelTh}>Totale IVA incl.</th>
  <th style={excelTh}>Cantiere</th>
</tr>
          </thead>

          <tbody>
            {righeFatturaDaAssegnare.map((riga, index) => (
              <tr key={`${riga.numero_riga}-${index}`}>
                <td style={excelTd}>{riga.numero_riga}</td>
<td style={excelTd}>{riga.descrizione}</td>
<td style={excelTd}>{riga.quantita}</td>
<td style={excelTd}>{formatMoney(riga.prezzo_unitario)}</td>
<td style={excelTd}>{riga.unita_misura || '-'}</td>
<td style={excelTd}>{riga.aliquota_iva ? `${riga.aliquota_iva}%` : '-'}</td>
<td style={excelTd}>{formatMoney(riga.totale_riga)}</td>

<td style={excelTd}>
  <select
                    value={riga.cantiere}
                    onChange={(e) => {
                      const valore = e.target.value

                      setRigheFatturaDaAssegnare((righe) =>
                        righe.map((item, i) =>
                          i === index
                            ? { ...item, cantiere: valore }
                            : item
                        )
                      )
                    }}
                  >
                    <option value="">Da assegnare</option>

                    <option value="Generale impresa">
                      Generale impresa
                    </option>

                    {cantieri.map((c) => (
                      <option
                        key={c.id || c.nome}
                        value={c.nome}
                      >
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

<hr style={{ margin: '24px 0' }} />



<h3>📚 Fatture salvate</h3>

<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
  <button
    onClick={async () => {
      const conferma = confirm('Eliminare tutte le fatture metaDato importate?')
      if (!conferma) return

      const daEliminare = fattureFornitori.filter((f) =>
        String(f.nome_file || '').toLowerCase().includes('metadato')
      )

      if (daEliminare.length === 0) {
        alert('Nessun metaDato trovato.')
        return
      }

      for (const f of daEliminare) {
        await supabase.from('fatture_fornitori_righe').delete().eq('fattura_id', f.id)
        await supabase.from('fatture_fornitori').delete().eq('id', f.id)
      }

      await caricaFattureFornitori()
      alert(`Eliminate ${daEliminare.length} fatture metaDato.`)
    }}
    style={{
      ...buttonSecondary,
      backgroundColor: '#dc2626',
      color: '#fff',
    }}
  >
    🗑 Elimina metaDato
  </button>

  <button
    onClick={async () => {
      const conferma = confirm('Eliminare tutte le fatture senza righe collegate?')
      if (!conferma) return

      let eliminate = 0

      for (const f of fattureFornitori) {
        const { data: righe, error } = await supabase
          .from('fatture_fornitori_righe')
          .select('id')
          .eq('fattura_id', f.id)

        if (error) continue

        if (!righe || righe.length === 0) {
          await supabase.from('fatture_fornitori').delete().eq('id', f.id)
          eliminate++
        }
      }

      await caricaFattureFornitori()
      alert(`Eliminate ${eliminate} fatture senza righe.`)
    }}
    style={{
      ...buttonSecondary,
      backgroundColor: '#f59e0b',
      color: '#fff',
    }}
  >
    🧹 Elimina fatture senza righe
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
      width: '100%',
      borderCollapse: 'collapse',
    }}
  >
    <thead>
      <tr>
        <th onClick={() => ordinaFatture('data_fattura')} style={{ ...excelTh, cursor: 'pointer', padding: '6px 8px', whiteSpace: 'normal' }}>
          Data ↕
        </th>
        <th onClick={() => ordinaFatture('numero_fattura')} style={{ ...excelTh, cursor: 'pointer', padding: '6px 8px', whiteSpace: 'normal' }}>
          Numero ↕
        </th>
        <th onClick={() => ordinaFatture('fornitore')} style={{ ...excelTh, cursor: 'pointer', padding: '6px 8px', whiteSpace: 'normal' }}>
          Fornitore ↕
        </th>
        <th onClick={() => ordinaFatture('importo_totale')} style={{ ...excelTh, cursor: 'pointer', padding: '6px 8px', whiteSpace: 'normal' }}>
          Totale ↕
        </th>
        <th onClick={() => ordinaFatture('stato')} style={{ ...excelTh, cursor: 'pointer', padding: '6px 8px', whiteSpace: 'normal' }}>
          Stato ↕
        </th>
        <th onClick={() => ordinaFatture('nome_file')} style={{ ...excelTh, cursor: 'pointer', padding: '6px 8px', whiteSpace: 'normal' }}>
          File ↕
        </th>
        <th style={{ ...excelTh, padding: '6px 8px', whiteSpace: 'normal' }}>
          Azioni
        </th>
      </tr>
    </thead>

    <tbody>
      {fattureOrdinate
        .filter((f) => {
          const cerca = filtroFattureFornitore.toLowerCase()

          const matchTesto =
            String(f.fornitore || '').toLowerCase().includes(cerca) ||
            String(f.numero_fattura || '').toLowerCase().includes(cerca) ||
            String(f.nome_file || '').toLowerCase().includes(cerca)

          const matchStato = !filtroFattureStato || f.stato === filtroFattureStato

          return matchTesto && matchStato
        })
        .map((f, i) => (
          <tr key={f.id || i}>
            <td style={{ ...excelTd, padding: '5px 8px', whiteSpace: 'normal', wordBreak: 'break-word', verticalAlign: 'top' }}>
              {f.data_fattura || '-'}
            </td>

            <td style={{ ...excelTd, padding: '5px 8px', whiteSpace: 'normal', wordBreak: 'break-word', verticalAlign: 'top' }}>
              {f.numero_fattura || '-'}
            </td>

            <td style={{ ...excelTd, padding: '5px 8px', whiteSpace: 'normal', wordBreak: 'break-word', verticalAlign: 'top' }}>
              {f.fornitore || '-'}
            </td>

            <td style={{ ...excelTd, padding: '5px 8px', whiteSpace: 'normal', wordBreak: 'break-word', verticalAlign: 'top' }}>
              {formatMoney(Number(f.importo_totale || 0))}
            </td>

            <td style={{ ...excelTd, padding: '5px 8px', whiteSpace: 'normal', wordBreak: 'break-word', verticalAlign: 'top' }}>
              {f.stato || '-'}
            </td>

            <td style={{ ...excelTd, padding: '5px 8px', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', verticalAlign: 'top' }}>
              {f.nome_file || '-'}
            </td>

            <td style={{ ...excelTd, padding: '5px 8px', whiteSpace: 'normal', verticalAlign: 'top' }}>
              <button onClick={() => apriFatturaFornitore(String(f.id))} style={buttonSecondary}>
                👁 Apri
              </button>

              <button
                onClick={() => eliminaFatturaFornitore(f)}
                style={{
                  ...buttonSecondary,
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  marginLeft: 6,
                  marginTop: 4,
                }}
              >
                🗑 Elimina
              </button>
            </td>
          </tr>
        ))}
    </tbody>
  </table>
</div>

{fatturaApertaId && (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.55)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}
  >
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 20,
        width: '95%',
        maxWidth: 1250,
        maxHeight: '85vh',
        overflow: 'auto',
        boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
      }}
    >    
  <h3>👁 Righe fattura aperta</h3>
<button
  onClick={() =>
    setNascondiCantieriConclusiFatture(
      !nascondiCantieriConclusiFatture
    )
  }
  style={{
    ...buttonSecondary,
    marginBottom: 10,
  }}
>
  {nascondiCantieriConclusiFatture
    ? 'Mostra anche conclusi'
    : 'Nascondi conclusi'}
</button>
<div style={{ marginBottom: 10 }}>
  <label>
    Larghezza descrizione: {larghezzaDescrizioneFattura}px
  </label>

  <input
    type="range"
    min="180"
    max="700"
    value={larghezzaDescrizioneFattura}
    onChange={(e) => {
      const valore = Number(e.target.value)

      setLarghezzaDescrizioneFattura(valore)

      localStorage.setItem(
        'larghezza_descrizione_fattura',
        String(valore)
      )
    }}
    style={{ width: 260, marginLeft: 10 }}
  />
</div>


<div
  style={{
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 12,
    alignItems: 'center',
  }}
>
  <select
    value={cantiereMassivoFattura}
    onChange={(e) => setCantiereMassivoFattura(e.target.value)}
  >
    <option value="">Assegna tutte le righe a...</option>
    <option value="Generale impresa">Generale impresa</option>

  {cantieri
  .filter((c) =>
    nascondiCantieriConclusiFatture
      ? !c.lavori_conclusi
      : true
  )
  .map((c) => (
    <option key={c.id || c.nome} value={c.nome}>
      {c.lavori_conclusi ? '✅ ' : '🏗️ '}
      {c.nome}
    </option>
  ))}
  </select>


<select
  value={categoriaMassivaFattura}
  onChange={(e) => setCategoriaMassivaFattura(e.target.value)}
>
  <option value="">Categoria massiva...</option>

  <option value="materiale_cantiere">
    Materiale cantiere
  </option>

  <option value="attrezzo_ditta">
    Attrezzo / bene ditta
  </option>

  <option value="magazzino">
    Magazzino
  </option>

  <option value="spesa_generale">
    Spesa generale
  </option>

<option value="storno_escluso">
  🚫 Storno / Escludi dai costi
</option>
</select>


  <button
   onClick={() => {
  if (
    !cantiereMassivoFattura &&
    !categoriaMassivaFattura
  ) {
    alert('Seleziona almeno un valore')
    return
  }

  setRigheFatturaAperta((righe) =>
    righe.map((r) => ({
      ...r,

      cantiere:
        cantiereMassivoFattura || r.cantiere,

      categoria_economica:
        categoriaMassivaFattura ||
        r.categoria_economica,

      stato:
        cantiereMassivoFattura || r.cantiere
          ? 'assegnata'
          : 'da_assegnare',
    }))
  )
}}
    style={buttonSecondary}
  >
    Applica a tutte
  </button>
</div>


<div
  style={{
    display: 'flex',
    gap: 16,
    marginBottom: 16,
    flexWrap: 'wrap',
  }}
>
  <div style={excelBox}>
    <strong>Totale righe fattura</strong>
    <div>
      {formatMoney(
        righeFatturaAperta.reduce(
          (tot, r) => tot + Number(r.totale_riga || 0),
          0
        )
      )}
    </div>
  </div>

  <div style={excelBox}>
    <strong>Storni esclusi</strong>
    <div>
      {formatMoney(
        righeFatturaAperta
          .filter((r) => r.categoria_economica === 'storno_escluso')
          .reduce((tot, r) => tot + Number(r.totale_riga || 0), 0)
      )}
    </div>
  </div>

  <div style={excelBox}>
    <strong>Totale conteggiato</strong>
    <div>
      {formatMoney(
        righeFatturaAperta
          .filter((r) => r.categoria_economica !== 'storno_escluso')
          .reduce((tot, r) => tot + Number(r.totale_riga || 0), 0)
      )}
    </div>
  </div>
</div>


 <div
  style={{
    maxHeight: '70vh',
    overflow: 'auto',
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

<colgroup>
  <col style={{ width: 50 }} />
  <col style={{ minWidth: 260 }} />
  <col style={{ width: 70 }} />
  <col style={{ width: 100 }} />
  <col style={{ width: 70 }} />
  <col style={{ width: 100 }} />
  <col style={{ width: 150 }} />
  <col style={{ width: 160 }} />
  <col style={{ width: 90 }} />
</colgroup>          
             <thead>
  <tr>
    <th style={excelTh}>Riga</th>
    <th style={excelTh}>Descrizione</th>
    <th style={excelTh}>Quantità</th>
    <th style={excelTh}>Prezzo unit.</th>
    <th style={excelTh}>IVA %</th>
    <th style={excelTh}>Totale</th>
    <th style={excelTh}>Categoria</th>
    <th style={excelTh}>Cantiere</th>
    <th style={excelTh}>Stato</th>
  </tr>
</thead>
           

          <tbody>
            {righeFatturaAperta.map((r, i) => (
            <tr
  key={r.id || i}
  style={{
    backgroundColor:
      r.categoria_economica === 'storno_escluso'
        ? '#fee2e2'
        : r.categoria_economica === 'materiale_cantiere'
        ? '#f0fdf4'
        : r.categoria_economica === 'spesa_generale'
        ? '#eff6ff'
        : '#fff',
  }}
>
                <td style={excelTd}>{r.numero_riga}</td>
                <td
  style={{
    ...excelTd,
    width: larghezzaDescrizioneFattura,
minWidth: larghezzaDescrizioneFattura,
maxWidth: larghezzaDescrizioneFattura,
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    lineHeight: 1.3,
  }}
>
  {r.descrizione}
</td>
                <td style={excelTd}>{r.quantita}</td>
                <td style={excelTd}>{formatMoney(Number(r.prezzo_unitario || 0))}</td>
                <td style={excelTd}>{r.aliquota_iva || 0}%</td>
                <td style={excelTd}>{formatMoney(Number(r.totale_riga || 0))}</td>

<td style={excelTd}>
  <select
style={{
  width: '100%',
  height: 28,
  fontSize: 12,
  padding: '2px 6px',
}}
    value={r.categoria_economica || ''}
    onChange={(e) => {
      const valore = e.target.value

      setRigheFatturaAperta((righe) =>
        righe.map((item, index) =>
          index === i
            ? {
                ...item,
                categoria_economica: valore,
              }
            : item
        )
      )
    }}
  >
    <option value="">Da classificare</option>

    <option value="materiale_cantiere">
      Materiale cantiere
    </option>

    <option value="attrezzo_ditta">
      Attrezzo / bene ditta
    </option>

    <option value="magazzino">
      Magazzino
    </option>

    <option value="spesa_generale">
      Spesa generale
    </option>
<option value="storno_escluso">
  🚫 Storno / Escludi dai costi
</option>
  </select>
</td>





                <td style={excelTd}>
                  <select
style={{
  width: '100%',
  height: 28,
  fontSize: 12,
  padding: '2px 6px',
}}
                    value={r.cantiere || ''}
                    onChange={(e) => {
                      const valore = e.target.value

                      setRigheFatturaAperta((righe) =>
                        righe.map((item, index) =>
                          index === i
                            ? {
                                ...item,
                                cantiere: valore,
                                stato: valore ? 'assegnata' : 'da_assegnare',
                              }
                            : item
                        )
                      )
                    }}
                  >
                    <option value="">Da assegnare</option>
                    <option value="Generale impresa">Generale impresa</option>

                  {cantieri
  .filter((c) =>
    nascondiCantieriConclusiFatture
      ? !c.lavori_conclusi
      : true
  )
  .map((c) => (
                      <option key={c.id || c.nome} value={c.nome}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </td>

                <td style={excelTd}>{r.stato || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


<div
  style={{
    marginTop: 12,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 10,
  }}
>
  {[
    {
      titolo: '📦 Materiali cantiere',
      categoria: 'materiale_cantiere',
    },
    {
      titolo: '🛠 Attrezzi ditta',
      categoria: 'attrezzo_ditta',
    },
    {
      titolo: '🏬 Magazzino',
      categoria: 'magazzino',
    },
    {
      titolo: '📑 Spese generali',
      categoria: 'spesa_generale',
    },
{
  titolo: '🚫 Storni esclusi',
  categoria: 'storno_escluso',
},

  ].map((box) => {
    const totale = righeFatturaAperta
      .filter((r) => r.categoria_economica === box.categoria)
      .reduce((tot, r) => tot + Number(r.totale_riga || 0), 0)

    const righe = righeFatturaAperta.filter(
      (r) => r.categoria_economica === box.categoria
    ).length

    return (
      <div
        key={box.categoria}
        style={{
          border: '1px solid #cbd5e1',
          borderRadius: 10,
          padding: 10,
          background: '#f8fafc',
        }}
      >
        <strong>{box.titolo}</strong>
        <div style={{ marginTop: 6, fontSize: 18 }}>
          {formatMoney(totale)}
        </div>
        <small>{righe} righe</small>
      </div>
    )
  })}
</div>
      <button
        onClick={salvaModificheFatturaAperta}
        style={{ ...buttonPrimary, marginTop: 12, marginRight: 8 }}
      >
        💾 Salva modifiche
      </button>

      <button
        onClick={() => {
          setFatturaApertaId(null)
          setRigheFatturaAperta([])
        }}
        style={{ ...buttonSecondary, marginTop: 12 }}
           >
        Chiudi fattura
      </button>
    </div>
  </div>
)}


   
    </>

  )
}