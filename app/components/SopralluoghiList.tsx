'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'

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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end', marginBottom: 12 }}>
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
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <h3>🚧 Lavori attivi</h3>

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

    <div style={{ overflowX: 'auto' }}><table style={excelTable}><thead><tr>{['Data', 'Cliente', 'Indirizzo', 'Intervento / Note', 'Stato', 'Azioni'].map(intestazioneOrdinabile)}</tr></thead><tbody>{attiviFiltrati.map((s) => (
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
        <td style={excelTd}>{s.stato || '-'}</td>
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
        alert('Preventivo AI: azione in arrivo')
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
  <div style={{ overflowX: 'auto' }}><table style={excelTable}><thead><tr>{['Data', 'Cliente', 'Indirizzo', 'Intervento / Note', 'Stato', 'Azioni'].map(intestazioneOrdinabile)}</tr></thead><tbody>{archivioFiltrato
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
