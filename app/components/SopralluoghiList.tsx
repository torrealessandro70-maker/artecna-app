'use client'

import { useEffect, useMemo, useState, type ReactNode, type CSSProperties } from 'react'

const excelTable: CSSProperties = {
  width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', fontSize: 14, minWidth: 1100,
}
const excelTh: CSSProperties = {
  background: '#e5e7eb', border: '1px solid #cbd5e1', padding: '8px 10px',
  fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap',
}
const excelTd: CSSProperties = {
  border: '1px solid #cbd5e1', padding: '7px 10px', verticalAlign: 'middle', lineHeight: 1.35,
}

type Props = {
  onApriPreventivo?: (sopralluogoId: string) => void
  azioneNuovo?: ReactNode
  sopralluoghi: any[]
  mostraElencoSopralluoghi: boolean
  setMostraElencoSopralluoghi: (v: boolean) => void

  setUltimoSopralluogo: (v: any) => void
  setSopralluogoAperto: (v: any) => void
  setFirmaCliente: (v: string) => void
  setMostraGestioneFotoSopralluogo: (v: boolean) => void
  setMostraFotoPreventivoSopralluogo: (v: boolean) => void
  setFotoSopralluoghi: (v: any[]) => void

  eliminaSopralluogo: (id?: string) => void | Promise<void>

  supabase: any
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function SopralluoghiList({
  onApriPreventivo,
  azioneNuovo,
  sopralluoghi,
  mostraElencoSopralluoghi,
  setMostraElencoSopralluoghi,

  setUltimoSopralluogo,
  setSopralluogoAperto,
  setFirmaCliente,
  setMostraGestioneFotoSopralluogo,
  setMostraFotoPreventivoSopralluogo,
  setFotoSopralluoghi,

  eliminaSopralluogo,

  supabase,
  buttonPrimary,
  buttonSecondary,
}: Props) {


  const [ordineSopralluoghi, setOrdineSopralluoghi] = useState<string[]>([])
const [sopralluoghiInLavorazione, setSopralluoghiInLavorazione] = useState<string[]>([])
  const [campoOrdinamento, setCampoOrdinamento] = useState<'data' | 'cliente'>('data')
  const [direzioneOrdinamento, setDirezioneOrdinamento] = useState<'asc' | 'desc'>('desc')

  const [ricercaSopralluogo, setRicercaSopralluogo] = useState('')
  const [dataDaSopralluogo, setDataDaSopralluogo] = useState('')
  const [dataASopralluogo, setDataASopralluogo] = useState('')
  const query = ricercaSopralluogo.trim().toLowerCase()
  const filtriAttivi = Boolean(query || dataDaSopralluogo || dataASopralluogo)

  const corrispondeAiFiltri = (s: any) => {
    if (dataDaSopralluogo || dataASopralluogo) {
      const data = s.data_sopralluogo || ''
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false
      const dataVerificata = new Date(data + 'T00:00:00Z')
      if (Number.isNaN(dataVerificata.getTime()) || dataVerificata.toISOString().slice(0, 10) !== data) return false
      if (dataDaSopralluogo && data < dataDaSopralluogo) return false
      if (dataASopralluogo && data > dataASopralluogo) return false
    }
    return !query || [s.cliente, s.indirizzo, s.tipo_lavoro, s.note]
      .some((testo) => String(testo || '').toLowerCase().includes(query))
  }

  const evidenziaTesto = (testo: string) => {
    if (!query) return testo
    const segmenti = []
    const normalizzato = testo.toLowerCase()
    let posizione = 0
    let indice = normalizzato.indexOf(query)
    while (indice !== -1) {
      segmenti.push(testo.slice(posizione, indice))
      segmenti.push(<mark key={indice}>{testo.slice(indice, indice + query.length)}</mark>)
      posizione = indice + query.length
      indice = normalizzato.indexOf(query, posizione)
    }
    segmenti.push(testo.slice(posizione))
    return segmenti
  }

  const cambiaOrdinamento = (campo: 'data' | 'cliente') => {
    if (campo === campoOrdinamento) {
      setDirezioneOrdinamento((direzione) => direzione === 'asc' ? 'desc' : 'asc')
    } else {
      setCampoOrdinamento(campo)
      setDirezioneOrdinamento(campo === 'data' ? 'desc' : 'asc')
    }
  }

  const confrontaSopralluoghi = (a: any, b: any) => {
    const cliente = (a.cliente || '').localeCompare(b.cliente || '', 'it', { sensitivity: 'base' })
    const dataA = /^\d{4}-\d{2}-\d{2}$/.test(a.data_sopralluogo || '') ? a.data_sopralluogo : ''
    const dataB = /^\d{4}-\d{2}-\d{2}$/.test(b.data_sopralluogo || '') ? b.data_sopralluogo : ''
    const confrontaDate = (direzione: 'asc' | 'desc') => {
      if (!dataA && !dataB) return 0
      if (!dataA) return 1
      if (!dataB) return -1
      const confronto = dataA.localeCompare(dataB)
      return direzione === 'asc' ? confronto : -confronto
    }
    return campoOrdinamento === 'data'
      ? confrontaDate(direzioneOrdinamento) || cliente
      : (direzioneOrdinamento === 'asc' ? cliente : -cliente) || confrontaDate('desc')
  }

  const intestazioneOrdinabile = (titolo: string) => {
    const campo = titolo === 'Data' ? 'data' : titolo === 'Cliente' ? 'cliente' : null
    if (!campo) return <th key={titolo} scope="col" style={excelTh}>{titolo}</th>
    const selezionato = campoOrdinamento === campo
    return (
      <th key={titolo} scope="col" style={excelTh} aria-sort={selezionato ? (direzioneOrdinamento === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" onClick={() => cambiaOrdinamento(campo)} style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}>
          {titolo}{selezionato ? (direzioneOrdinamento === 'asc' ? ' ↑' : ' ↓') : ''}
        </button>
      </th>
    )
  }

 useEffect(() => {
  try {
    const salvato = localStorage.getItem('artecna:sopralluoghi:ordine')
    if (salvato) {
      const parsed = JSON.parse(salvato)
      if (Array.isArray(parsed)) {
        setOrdineSopralluoghi(parsed)
      }
    }
  } catch {
    localStorage.removeItem('artecna:sopralluoghi:ordine')
  }
}, [])

  useEffect(() => {
    localStorage.setItem(
      'artecna:sopralluoghi:ordine',
      JSON.stringify(ordineSopralluoghi)
    )
  }, [ordineSopralluoghi])

useEffect(() => {
  try {
    const salvato = localStorage.getItem('artecna:sopralluoghi:in-lavorazione')
    if (salvato) {
      const parsed = JSON.parse(salvato)
      if (Array.isArray(parsed)) {
        setSopralluoghiInLavorazione(parsed)
      }
    }
  } catch {
    localStorage.removeItem('artecna:sopralluoghi:in-lavorazione')
  }
}, [])

useEffect(() => {
  localStorage.setItem(
    'artecna:sopralluoghi:in-lavorazione',
    JSON.stringify(sopralluoghiInLavorazione)
  )
}, [sopralluoghiInLavorazione])

  const sopralluoghiOrdinati = useMemo(() => {
  const mappa = new Map(
    sopralluoghi.filter((s) => s.id).map((s) => [String(s.id), s])
  )

  const ordinati = ordineSopralluoghi
    .map((id) => mappa.get(id))
    .filter(Boolean)

  const giaOrdinati = new Set(ordineSopralluoghi)

  const altri = sopralluoghi.filter(
    (s) => !s.id || !giaOrdinati.has(String(s.id))
  )

  return [...ordinati, ...altri]
}, [sopralluoghi, ordineSopralluoghi])

const sopralluoghiInLavorazioneLista = useMemo(() => {
  const ids = new Set(sopralluoghiInLavorazione)

  return sopralluoghiOrdinati.filter(
    (s) => s.id && ids.has(String(s.id))
  )
}, [sopralluoghiOrdinati, sopralluoghiInLavorazione])

  const attiviVisualizzati = [...sopralluoghiInLavorazioneLista].sort(confrontaSopralluoghi)
  const archivioVisualizzato = [...sopralluoghiOrdinati].sort(confrontaSopralluoghi)
  const attiviFiltrati = attiviVisualizzati.filter(corrispondeAiFiltri)
  const archivioFiltrato = archivioVisualizzato.filter(corrispondeAiFiltri)



const toggleInLavorazione = (id: string) => {
  setSopralluoghiInLavorazione((prev) =>
    prev.includes(id)
      ? prev.filter((item) => item !== id)
      : [...prev, id]
  )
}
  const spostaSopralluogo = (id: string, direzione: 'su' | 'giu') => {
    const ids = sopralluoghiOrdinati.filter((s) => s.id).map((s) => String(s.id))
    const indice = ids.indexOf(id)
    if (indice === -1) return

    const nuovoIndice = direzione === 'su' ? indice - 1 : indice + 1
    if (nuovoIndice < 0 || nuovoIndice >= ids.length) return

    const nuovoOrdine = [...ids]
    const temporaneo = nuovoOrdine[indice]
    nuovoOrdine[indice] = nuovoOrdine[nuovoIndice]
    nuovoOrdine[nuovoIndice] = temporaneo

    setOrdineSopralluoghi(nuovoOrdine)
  }


  return (
    <>
      <style>{`.sopralluoghi-attivi-stato { display: inline-block; max-width: 100%; box-sizing: border-box; padding: 3px 4px; border-radius: 6px; background: #f1f5f9; color: #334155; font-size: 12px; line-height: 1.35; font-weight: 600; word-break: normal; overflow-wrap: normal; }
      @container sopralluoghi-lista (min-width: 1100.01px) {
        .sopralluoghi-attivi-tabella td:nth-child(2), .sopralluoghi-attivi-tabella td:nth-child(3) { white-space: normal; word-break: normal; overflow-wrap: break-word; }
        .sopralluoghi-attivi-stato { white-space: nowrap; }
        .sopralluoghi-attivi-tabella td:last-child > div { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .sopralluoghi-attivi-tabella td:last-child button { min-width: 0 !important; width: 100% !important; max-width: 100%; min-height: 44px; box-sizing: border-box; padding: 6px 8px !important; font-size: 13px; white-space: normal; overflow-wrap: normal; word-break: normal; }
        .sopralluoghi-attivi-tabella td:last-child button:first-child { grid-column: 1 / -1; }
      }
      @container sopralluoghi-lista (max-width: 1100px) { .sopralluoghi-attivi-tabella colgroup { display: none; } }
      @container sopralluoghi-lista (max-width: 1100px) {
        .sopralluoghi-tabella thead { display: none; }
        .sopralluoghi-tabella, .sopralluoghi-tabella tbody, .sopralluoghi-tabella tr, .sopralluoghi-tabella td { display: block; width: 100%; min-width: 0 !important; box-sizing: border-box; }
        .sopralluoghi-tabella td { white-space: normal !important; overflow-wrap: anywhere; }
        .sopralluoghi-tabella td::before { display: block; font-weight: 700; }
        .sopralluoghi-tabella td:nth-child(1)::before { content: 'Data'; }
        .sopralluoghi-tabella td:nth-child(2)::before { content: 'Cliente'; }
        .sopralluoghi-tabella td:nth-child(3)::before { content: 'Indirizzo'; }
        .sopralluoghi-tabella td:nth-child(4)::before { content: 'Intervento / Note'; }
        .sopralluoghi-tabella td:nth-child(5)::before { content: 'Stato'; }
        .sopralluoghi-tabella td:nth-child(6)::before { content: 'Azioni'; }
        .sopralluoghi-tabella button { min-width: 0 !important; max-width: 100%; white-space: normal !important; overflow-wrap: anywhere; }
      }
      [aria-label="Navigazione sopralluoghi"] { min-width: 0; max-width: 100%; }
      [aria-label="Navigazione sopralluoghi"] button { min-width: 0; max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
      .sopralluoghi-filtri label { min-width: 0; max-width: 100%; }
      .sopralluoghi-filtri input { min-width: 0; width: 100%; max-width: 100%; box-sizing: border-box; }`}</style>
      <div className="sopralluoghi-filtri" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end', marginBottom: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          Da
          <input type="date" value={dataDaSopralluogo} onChange={(event) => setDataDaSopralluogo(event.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          A
          <input type="date" value={dataASopralluogo} onChange={(event) => setDataASopralluogo(event.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 4, flex: '1 1 240px' }}>
          Cerca sopralluogo
          <input type="search" value={ricercaSopralluogo} onChange={(event) => setRicercaSopralluogo(event.target.value)} />
        </label>
        <button type="button" style={{ ...buttonSecondary, width: 'auto' }} onClick={() => {
          setRicercaSopralluogo('')
          setDataDaSopralluogo('')
          setDataASopralluogo('')
        }}>Reset filtri</button>
      </div>
      <p style={{ color: '#64748b', fontSize: 13 }}>
        Attivi visualizzati: {attiviFiltrati.length} · Archivio trovato: {archivioFiltrato.length}
      </p>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          marginBottom: 10,
        }}
      >


        <div aria-label="Navigazione sopralluoghi" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {azioneNuovo}
        <button
  type="button"
  onClick={() =>
    setMostraElencoSopralluoghi(!mostraElencoSopralluoghi)
  }
  style={{
    ...buttonSecondary,
    fontWeight: 700,
  }}
>
  {mostraElencoSopralluoghi
    ? '📚 Archivio sopralluoghi ▲'
    : '📚 Archivio sopralluoghi ▼'}
</button>
        </div>
      </div>

{attiviFiltrati.length === 0 ? <p>Nessun lavoro attivo trovato</p> : (
  <section
    style={{
      display: 'grid',
      gap: 10,
      marginBottom: 16,
      padding: 12,
      border: '1px solid #bbf7d0',
      borderRadius: 12,
      background: '#f0fdf4',
    }}
  >
   <div>
  <div style={{ fontWeight: 900, color: '#166534', fontSize: 16 }}>
    🎯 Sopralluoghi attivi
  </div>
  <div style={{ color: '#64748b', fontSize: 13, marginTop: 3 }}>
    Qui trovi subito i sopralluoghi su cui stai lavorando.
  </div>
</div>

    <div style={{ overflowX: 'auto', containerType: 'inline-size', containerName: 'sopralluoghi-lista', minWidth: 0 }}><table className="sopralluoghi-tabella sopralluoghi-attivi-tabella" style={{ ...excelTable, tableLayout: 'fixed' }}><colgroup><col style={{ width: '9%' }} /><col style={{ width: '16%' }} /><col style={{ width: '18%' }} /><col style={{ width: '29%' }} /><col style={{ width: '12%' }} /><col style={{ width: '16%' }} /></colgroup><thead><tr>{['Data', 'Cliente', 'Indirizzo', 'Intervento / Note', 'Stato', 'Azioni'].map(intestazioneOrdinabile)}</tr></thead><tbody>{attiviFiltrati.map((s) => (
    <tr key={s.id}
role="button"
tabIndex={0}
onClick={() => {
    setUltimoSopralluogo(s)
    setSopralluogoAperto(s)
    setMostraElencoSopralluoghi(false)
  }}
onKeyDown={(event) => {
    if (
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault()

      setUltimoSopralluogo(s)
      setSopralluogoAperto(s)
      setMostraElencoSopralluoghi(false)
    }
  }} style={{ background: '#fff', cursor: 'pointer' }}>
<td style={{ ...excelTd, whiteSpace: 'nowrap' }}>{s.data_sopralluogo || '-'}</td>
        <td style={excelTd}>{evidenziaTesto(s.cliente || '-')}</td>
        <td style={excelTd}>{evidenziaTesto(s.indirizzo || '-')}</td>
        <td style={{ ...excelTd, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{evidenziaTesto([s.tipo_lavoro, s.note].filter(Boolean).join('\n') || '-')}</td>
        <td style={excelTd}><span className="sopralluoghi-attivi-stato">{s.stato === 'da_preventivare' ? 'Da preventivare' : s.stato === 'preventivo_creato' ? 'Preventivo creato' : s.stato === 'convertito_in_cantiere' ? 'Convertito in cantiere' : s.stato || '-'}</span></td>
<td style={excelTd}>
<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button
    type="button"
    onClick={(event) => {
      event.stopPropagation()
      setUltimoSopralluogo(s)
      setSopralluogoAperto(s)
      setMostraElencoSopralluoghi(false)
    }}
    style={{
      ...buttonPrimary,
      width: 'auto',
      padding: '8px 12px',
      fontWeight: 900,
    }}
  >
    ✏️ Continua sopralluogo
  </button>
<button type="button" onClick={(event) => {
    event.stopPropagation()
    if (confirm('Chiudere e archiviare questo sopralluogo? Questa organizzazione è locale al browser.')) toggleInLavorazione(String(s.id))
  }} style={{ ...buttonSecondary, minHeight: 44 }}>Chiudi e archivia</button>
<button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        setUltimoSopralluogo(s)
        setSopralluogoAperto(s)
        setMostraElencoSopralluoghi(false)
      }}
      style={{
        ...buttonSecondary,
        flex: 1,
        minWidth: 90,
      }}
    >
      📂 Fascicolo
    </button>
<button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        alert('PDF sopralluogo: azione in arrivo')
      }}
      style={{
        ...buttonSecondary,
        flex: 1,
        minWidth: 70,
      }}
    >
      📄 PDF
    </button>
<button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onApriPreventivo?.(String(s.id))
      }}
      style={{
        ...buttonSecondary,
        flex: 1,
        minWidth: 110,
      }}
    >
      🤖 Preventivo
    </button></div>
</td></tr>
    ))}</tbody></table></div>
  </section>
)}

      <h3>Archivio sopralluoghi</h3>
      {archivioFiltrato.length === 0 ? (
        <p>Nessun sopralluogo trovato</p>
      ) : (
       <div style={{ display: 'grid', gap: 10 }}>
  <div style={{ overflowX: 'auto', containerType: 'inline-size', containerName: 'sopralluoghi-lista', minWidth: 0 }}><table className="sopralluoghi-tabella" style={excelTable}><thead><tr>{['Data', 'Cliente', 'Indirizzo', 'Intervento / Note', 'Stato', 'Azioni'].map(intestazioneOrdinabile)}</tr></thead><tbody>{archivioFiltrato
    .slice(0, filtriAttivi || mostraElencoSopralluoghi ? undefined : 1)
    .map((s, i) => (
              <tr key={s.id || i} style={{ background: '#fff' }}>
<td style={{ ...excelTd, whiteSpace: 'nowrap' }}>{s.data_sopralluogo || '-'}</td>
        <td style={excelTd}>{evidenziaTesto(s.cliente || '-')}</td>
        <td style={excelTd}>{evidenziaTesto(s.indirizzo || '-')}</td>
        <td style={{ ...excelTd, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{evidenziaTesto([s.tipo_lavoro, s.note].filter(Boolean).join('\n') || '-')}</td>
        <td style={excelTd}>{s.stato || '-'}</td>
<td style={excelTd}>
<div
  style={{
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
    width: 'auto',
    marginBottom: 8,
  }}
>
  {s.id && (
    <>
<button
  type="button"
  onClick={() => toggleInLavorazione(String(s.id))}
  style={{
    ...buttonSecondary,
    width: 'auto',
    minWidth: 0,
    padding: '8px 12px',
    backgroundColor: sopralluoghiInLavorazione.includes(String(s.id))
      ? '#dcfce7'
      : '#ffffff',
    color: sopralluoghiInLavorazione.includes(String(s.id))
      ? '#166534'
      : '#475569',
    fontWeight: 700,
  }}
>
  {sopralluoghiInLavorazione.includes(String(s.id))
    ? '🟢 In lavorazione'
    : '➕ Metti in lavorazione'}
</button>




    </>
  )}


                  <button
                    type="button"
                    onClick={async () => {
                      setUltimoSopralluogo(s)
                      setSopralluogoAperto(s)

                      setMostraElencoSopralluoghi(false)
                      setFirmaCliente(s.firma_cliente || '')
                      setMostraGestioneFotoSopralluogo(false)
                      setMostraFotoPreventivoSopralluogo(false)

                      const { data } = await supabase
                        .from('foto_sopralluogo')
                        .select('id,sopralluogo_id,nota,immagine_base64,tag,includi_preventivo,created_at')
                        .eq('sopralluogo_id', s.id)

                      setFotoSopralluoghi(
                        [...(data || [])].sort((prima, seconda) =>
                          String(seconda.created_at || '').localeCompare(
                            String(prima.created_at || '')
                          )
                        )
                      )
                    }}
                    style={{
                      ...buttonPrimary,
                      width: 'auto',
                      minWidth: 0,
                      padding: '8px 12px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    🔍 Apri sopralluogo
                  </button>

                  <button
                    type="button"
                    onClick={() => eliminaSopralluogo(s.id)}
                    style={{
                      ...buttonPrimary,
                      width: 'auto',
                      minWidth: 0,
                      padding: '8px 12px',
                      whiteSpace: 'nowrap',
                      backgroundColor: '#dc2626',
                    }}
                  >
                    🗑 Elimina
                  </button>
                </div>
</td></tr>
            ))}</tbody></table></div>
        </div>
      )}
    </>
  )
}
