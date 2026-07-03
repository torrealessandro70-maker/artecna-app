'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <h3>Sopralluoghi</h3>

        <button
          onClick={() =>
            setMostraElencoSopralluoghi(!mostraElencoSopralluoghi)
          }
          style={buttonSecondary}
        >
          {mostraElencoSopralluoghi ? 'Nascondi elenco' : 'Mostra elenco'}
        </button>
      </div>

{sopralluoghiInLavorazioneLista.length > 0 && (
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
    🟢 Sopralluoghi in lavorazione
  </div>
  <div style={{ color: '#64748b', fontSize: 13, marginTop: 3 }}>
    Sopralluoghi che stai seguendo adesso.
  </div>
</div>

    {sopralluoghiInLavorazioneLista.map((s) => (
     <button
  key={s.id}
  type="button"
  onClick={() => {
    setUltimoSopralluogo(s)
    setSopralluogoAperto(s)
    setMostraElencoSopralluoghi(false)
  }}
  style={{
    textAlign: 'left',
    padding: 12,
    border: '1px solid #bbf7d0',
    borderRadius: 12,
    background: '#ffffff',
    cursor: 'pointer',
  }}
>
  <strong style={{ display: 'block', color: '#0f172a' }}>
    {s.cliente || 'Sopralluogo'}
  </strong>

  <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
    {s.indirizzo || '-'}
  </div>

 <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
  <span
    style={{
      padding: '3px 8px',
      borderRadius: 999,
      background: '#dcfce7',
      color: '#166534',
      fontSize: 12,
      fontWeight: 800,
    }}
  >
    {s.stato || 'Stato non impostato'}
  </span>

  {s.data_sopralluogo && (
    <span
      style={{
        padding: '3px 8px',
        borderRadius: 999,
        background: '#f1f5f9',
        color: '#475569',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {s.data_sopralluogo}
    </span>
  )}
</div>

<div
  style={{
    display: 'grid',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTop: '1px solid #e5e7eb',
  }}
>
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation()
      setUltimoSopralluogo(s)
      setSopralluogoAperto(s)
      setMostraElencoSopralluoghi(false)
    }}
    style={{
      ...buttonPrimary,
      width: '100%',
      padding: '12px 14px',
      fontWeight: 900,
    }}
  >
    ✏️ Continua sopralluogo
  </button>

  <div
    style={{
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
    }}
  >
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
    </button>
  </div>
</div>
</button>
    ))}
  </section>
)}

      {sopralluoghi.length === 0 ? (
        <p>Nessun sopralluogo salvato</p>
      ) : (
       <div style={{ display: 'grid', gap: 10 }}>
  {sopralluoghiOrdinati
    .slice(0, mostraElencoSopralluoghi ? undefined : 1)
    .map((s, i) => (
              <div
                key={s.id || i}
                style={{
                  padding: 12,
                  border: '1px solid #ddd',
                  borderRadius: 10,
                  background: '#fff',
                }}
              >
               <div
  style={{
    display: 'flex',
    gap: 8,
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
    padding: '8px 10px',
    backgroundColor: sopralluoghiInLavorazione.includes(String(s.id))
      ? '#dcfce7'
      : buttonSecondary.backgroundColor,
  }}
>
  🟢
</button>
      <button
        type="button"
        onClick={() => spostaSopralluogo(String(s.id), 'su')}
        style={{
          ...buttonSecondary,
          width: 'auto',
          minWidth: 0,
          padding: '8px 10px',
        }}
      >
        ⬆️
      </button>

      <button
        type="button"
        onClick={() => spostaSopralluogo(String(s.id), 'giu')}
        style={{
          ...buttonSecondary,
          width: 'auto',
          minWidth: 0,
          padding: '8px 10px',
        }}
      >
        ⬇️
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

                <strong>{s.cliente}</strong>
                <br />
                {s.indirizzo || '-'}
                <br />
                Data: {s.data_sopralluogo || '-'}
                <br />
                Tipo lavoro: {s.tipo_lavoro || '-'}
                <br />
                Stato: {s.stato || '-'}
              </div>
            ))}
        </div>
      )}
    </>
  )
}
