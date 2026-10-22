'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

type CampoEditorSal = 'descrizione' | 'importo_previsto' | 'percentuale'
type BozzaEditorSal = { rigaId: string; campo: CampoEditorSal; valore: string; base: string; modificata: boolean; salvataggio: boolean; errore?: string; inviata?: string }
function numeroEditorSal(valore: string, campo: CampoEditorSal): number {
  let testo = valore.replace(/[€\s]/g, '')
  if (campo === 'importo_previsto') {
    if (testo.includes(',') && testo.includes('.')) testo = testo.replace(/\./g, '').replace(',', '.')
    else if (testo.includes(',')) testo = testo.replace(',', '.')
  }
  if (!testo || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(testo) || !Number.isFinite(Number(testo))) throw new Error('Inserisci un valore numerico valido.')
  const numero = Number(testo)
  if (campo === 'percentuale' && (numero < 0 || numero > 100)) throw new Error('La percentuale deve essere compresa tra 0 e 100.')
  return numero
}
function stessoValoreEditor(a: string, b: string, campo: CampoEditorSal) {
  if (campo === 'descrizione') return a === b
  try { return numeroEditorSal(a, campo) === numeroEditorSal(b, campo) } catch { return a === b }
}
function erroreEditorSal(errore: unknown): string {
  const e = errore && typeof errore === 'object' ? errore as Record<string, unknown> : { message: String(errore) }
  return ['code', 'message', 'details', 'hint'].map(k => `${k}: ${e[k] == null ? '—' : String(e[k])}`).join('\n')
}

export type RettificaSal = { verificabile: boolean; rettificata: boolean; riduzione: number | null; importoAggiornato: number | null; anomalia: boolean; esaurito: boolean }
export function rettificheRigheSal(righe: any[], lavorazioni: any[], completa: boolean): Record<string, RettificaSal> {
  const risultato: Record<string, RettificaSal> = {}
  const numero = (v: unknown) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) ? Number(v) : null
  for (const riga of righe) {
    const base = riga.source_lavorazione_id != null, variante = riga.source_variante_lavorazione_id != null
    if (!base && !variante) continue
    const origine = numero(riga.importo_previsto), maturato = numero(riga.importo_maturato)
    let valida = completa && base !== variante && origine !== null && origine >= 0 && maturato !== null && maturato >= 0
    let riduzione = 0
    for (const lavoro of lavorazioni) {
      if (!['riduzione_residua', 'eliminazione_residua'].includes(lavoro.operazione)) continue
      const collegata = base ? String(lavoro.riferimento_preventivo_lavorazione_id) === String(riga.source_lavorazione_id)
        : String(lavoro.riferimento_variante_lavorazione_id) === String(riga.source_variante_lavorazione_id)
      if (!collegata) continue
      const delta = numero(lavoro.delta_contratto), quantita = numero(lavoro.quantita_delta)
      if (delta === null || delta >= 0 || quantita === null || quantita >= 0 ||
          (lavoro.riferimento_preventivo_lavorazione_id != null) === (lavoro.riferimento_variante_lavorazione_id != null)) valida = false
      else riduzione -= delta
    }
    const aggiornato = origine === null ? null : Number((origine - riduzione).toFixed(2))
    if (!Number.isFinite(riduzione) || aggiornato === null || !Number.isFinite(aggiornato)) valida = false
    const anomalia = valida && (aggiornato! < 0 || aggiornato! < maturato!)
    risultato[String(riga.id)] = { verificabile: valida, rettificata: riduzione > 0, riduzione: valida ? riduzione : null,
      importoAggiornato: valida ? aggiornato : null, anomalia, esaurito: valida && !anomalia && riduzione > 0 && aggiornato === maturato }
  }
  return risultato
}

type SalTableProps = {
  cantiereId: string
  nomeCantiere: string
  lavorazioni: any[]
  excelTable: any
  excelTh: any
  excelTd: any
  formatMoney: (value: number) => string
  onToggleCompletata: (lavorazione: any, completata: boolean) => void | Promise<void>
  onUpdateDescrizione: (lavorazione: any, descrizione: string) => void | Promise<void>
  onUpdateImporto: (lavorazione: any, valore: string) => void | Promise<void>
  onUpdatePercentuale: (lavorazione: any, valore: string) => void | Promise<void>
  onElimina: (id: number) => void
  rettifiche?: Record<string, RettificaSal>
  originiVariante?: Record<string, { titolo: string; data: string | null }>
}

export default function SalTable({
  cantiereId,
  nomeCantiere,
  lavorazioni,
  excelTable,
  excelTh,
  excelTd,
  formatMoney,
  onToggleCompletata,
  onUpdateDescrizione,
  onUpdateImporto,
  onUpdatePercentuale,
  onElimina,
  rettifiche,
  originiVariante,
}: SalTableProps) {
  const [espansa, setEspansa] = useState(false)
  const scrollArea = useRef<HTMLDivElement | null>(null)
  const pendingScroll = useRef<{
    cantiereId: string; righe: any[]; completata: boolean
    posizioni: { elemento: HTMLElement; top: number; left: number }[]
  } | null>(null)
  const [, aggiornaVista] = useState(0)
  const [bozze, setBozze] = useState<Record<string, BozzaEditorSal>>({})
  const bozzeCorrenti = useRef(bozze)
  const refreshEditor = useRef<{
    cantiereId: string; righe: any[]; origini: typeof originiVariante; rettifiche: typeof rettifiche
    inCorso: number; posizioni: { elemento: HTMLElement; top: number; left: number }[]
  } | null>(null)
  const ripristinoFinaleEditor = useRef<{ elemento: HTMLElement; top: number; left: number }[] | null>(null)
  const attesaEditor = refreshEditor.current?.cantiereId === cantiereId ? refreshEditor.current : null
  const attesa = pendingScroll.current?.cantiereId === cantiereId ? pendingScroll.current : null
  // Solo continuità visiva: le guardie usano sempre le rettifiche correnti.
  const continuita = attesa || attesaEditor
  const righeVisibili = continuita
    ? [...continuita.righe.map(r => lavorazioni.find(s => s.id === r.id) || r), ...lavorazioni.filter(r => !continuita.righe.some(s => s.id === r.id))]
    : lavorazioni
  function aggiornaBozza(chiave: string, valore: BozzaEditorSal) {
    bozzeCorrenti.current = { ...bozzeCorrenti.current, [chiave]: valore }
    setBozze(bozzeCorrenti.current)
  }
  function propsEditor(riga: any, campo: CampoEditorSal) {
    const chiave = `${cantiereId}:${riga.id}:${campo}`
    const server = String(riga[campo] ?? '')
    return {
      value: bozze[chiave]?.valore ?? riga[campo] ?? '',
      'aria-label': `${campo === 'descrizione' ? 'Descrizione' : campo === 'importo_previsto' ? 'Importo' : 'Percentuale'} SAL ${riga.id}`,
      'aria-invalid': !!bozze[chiave]?.errore,
      onChange: (e: { target: { value: string } }) => {
        const precedente = bozzeCorrenti.current[chiave]
        const base = precedente?.base ?? server
        aggiornaBozza(chiave, { ...precedente, rigaId: String(riga.id), campo, base, valore: e.target.value, modificata: !stessoValoreEditor(e.target.value, base, campo), salvataggio: precedente?.salvataggio ?? false, errore: undefined })
      },
      onBlur: () => { void commitEditor(riga, campo, chiave) },
      onKeyDown: (e: { key: string; nativeEvent: { isComposing?: boolean }; preventDefault: () => void }) => {
        if (campo !== 'descrizione' && e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void commitEditor(riga, campo, chiave) }
      },
    }
  }
  async function commitEditor(riga: any, campo: CampoEditorSal, chiave: string) {
    const bozza = bozzeCorrenti.current[chiave]
    if (!bozza || !bozza.modificata || bozza.salvataggio) return
    try {
      if (campo !== 'descrizione') numeroEditorSal(bozza.valore, campo)
      const guardia = rettifiche?.[String(riga.id)]
      if (!lavorazioni.some(r => r.id === riga.id) || (guardia && (!guardia.verificabile || (campo === 'percentuale' && (guardia.anomalia || guardia.esaurito)) || (campo === 'importo_previsto' && guardia.rettificata)))) throw new Error('Verifica rettifiche in corso o riga non modificabile. La bozza è conservata.')
    } catch (errore) { aggiornaBozza(chiave, { ...bozza, errore: erroreEditorSal(errore) }); return }
    const posizioni: { elemento: HTMLElement; top: number; left: number }[] = []
    for (let elemento: HTMLElement | null = scrollArea.current; elemento; elemento = elemento.parentElement) posizioni.push({ elemento, top: elemento.scrollTop, left: elemento.scrollLeft })
    const ciclo = refreshEditor.current?.cantiereId === cantiereId ? refreshEditor.current : { cantiereId, righe: righeVisibili, origini: originiVariante, rettifiche, inCorso: 0, posizioni }
    refreshEditor.current = ciclo
    ciclo.inCorso++
    aggiornaBozza(chiave, { ...bozza, salvataggio: true, errore: undefined })
    try {
      const handler = campo === 'descrizione' ? onUpdateDescrizione : campo === 'importo_previsto' ? onUpdateImporto : onUpdatePercentuale
      await handler(riga, bozza.valore)
      const corrente = bozzeCorrenti.current[chiave]
      if (corrente) aggiornaBozza(chiave, { ...corrente, base: bozza.valore, inviata: bozza.valore, modificata: !stessoValoreEditor(corrente.valore, bozza.valore, campo), salvataggio: false })
    } catch (errore) {
      const corrente = bozzeCorrenti.current[chiave]
      if (corrente) aggiornaBozza(chiave, { ...corrente, salvataggio: false, errore: erroreEditorSal(errore) })
    } finally { ciclo.inCorso--; aggiornaVista(v => v + 1) }
  }
  useLayoutEffect(() => {
    const ciclo = refreshEditor.current
    if (ciclo && ciclo.cantiereId !== cantiereId) { refreshEditor.current = null; ripristinoFinaleEditor.current = null; return }
    const posizioni = ciclo?.posizioni || ripristinoFinaleEditor.current
    if (!pendingScroll.current) for (const p of posizioni || []) if (p.elemento.isConnected) { p.elemento.scrollTop = p.top; p.elemento.scrollLeft = p.left }
    if (!ciclo) { ripristinoFinaleEditor.current = null; return }
    if (ciclo.inCorso === 0 && ciclo.righe.every(r => lavorazioni.some(s => s.id === r.id)) && !Object.values(rettifiche || {}).some(r => !r.verificabile)) {
      refreshEditor.current = null
      ripristinoFinaleEditor.current = ciclo.posizioni
      aggiornaVista(v => v + 1)
    }
  })
  useEffect(() => {
    const aggiornate = { ...bozzeCorrenti.current }; let cambia = false
    for (const [chiave, bozza] of Object.entries(aggiornate)) {
      const riga = lavorazioni.find(r => String(r.id) === bozza.rigaId)
      if (chiave.startsWith(`${cantiereId}:`) && !bozza.salvataggio && !bozza.modificata && bozza.inviata !== undefined && riga && stessoValoreEditor(String(riga[bozza.campo] ?? ''), bozza.inviata, bozza.campo)) { delete aggiornate[chiave]; cambia = true }
    }
    if (cambia) { bozzeCorrenti.current = aggiornate; setBozze(aggiornate) }
  }, [lavorazioni, bozze, cantiereId])
  useLayoutEffect(() => {
    const posizione = pendingScroll.current
    if (!posizione) return
    if (posizione.cantiereId !== cantiereId) { pendingScroll.current = null; return }
    for (const p of posizione.posizioni) {
      if (p.elemento.isConnected) { p.elemento.scrollTop = p.top; p.elemento.scrollLeft = p.left }
    }
    if (posizione.completata && !Object.values(rettifiche || {}).some(r => !r.verificabile)) {
      pendingScroll.current = null
      aggiornaVista(v => v + 1)
    }
  })
  async function cambiaCompletata(riga: any, completata: boolean) {
    const posizioni: { elemento: HTMLElement; top: number; left: number }[] = []
    for (let elemento: HTMLElement | null = scrollArea.current; elemento; elemento = elemento.parentElement) {
      posizioni.push({ elemento, top: elemento.scrollTop, left: elemento.scrollLeft })
    }
    const posizione = { cantiereId, righe: righeVisibili, completata: false, posizioni }
    pendingScroll.current = posizione
    try { await onToggleCompletata(riga, completata) }
    finally {
      if (pendingScroll.current === posizione) { posizione.completata = true; aggiornaVista(v => v + 1) }
    }
  }

  useEffect(() => {
    setEspansa(false)
  }, [cantiereId])

  useEffect(() => {
    if (lavorazioni.length === 0 && !pendingScroll.current && !refreshEditor.current) setEspansa(false)
  }, [lavorazioni.length])

  useEffect(() => {
    if (!espansa) return
    const overflowPrecedente = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setEspansa(false)
      }
    }
    document.addEventListener('keydown', onEscape, true)
    return () => {
      document.body.style.overflow = overflowPrecedente
      document.removeEventListener('keydown', onEscape, true)
    }
  }, [espansa])

  if (righeVisibili.length === 0) {
    return <p>Nessuna lavorazione SAL inserita per questo cantiere.</p>
  }

  return (
    <section
      aria-label="SAL dettagliato"
      style={espansa ? {
        position: 'fixed', inset: 8, zIndex: 10000,
        background: '#fff', borderRadius: 10, padding: 12,
        display: 'flex', flexDirection: 'column', minWidth: 0,
        boxShadow: '0 0 0 100vmax rgba(15,23,42,0.35)',
        boxSizing: 'border-box',
      } : { minWidth: 0 }}
    >
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          <strong>SAL dettagliato</strong>
          {espansa && <div>{nomeCantiere}</div>}
        </div>
        <button
          type="button"
          aria-expanded={espansa}
          onClick={() => setEspansa((value) => !value)}
          style={{ minHeight: 44, padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#f8fafc', color: '#0f172a', cursor: 'pointer' }}
        >
          {espansa ? 'Riduci' : 'Espandi'}
        </button>
      </header>
    <div
      ref={scrollArea}
      aria-label="Scorrimento SAL dettagliato"
      onWheel={() => { pendingScroll.current = null }}
      onTouchMove={() => { pendingScroll.current = null }}
      style={{
        marginTop: 12,
        background: '#fff',
        border: '1px solid #cbd5e1',
        borderRadius: 10,
        padding: 12,
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        width: '100%',
        minWidth: 360,
        maxWidth: '100%',
        height: 520,
        minHeight: 260,
        maxHeight: '80vh',
        overflow: 'auto',
        overflowAnchor: 'none',
        resize: 'both',
        ...(espansa ? {
          flex: 1, minHeight: 0, height: 'auto', maxHeight: 'none',
          minWidth: 0, boxSizing: 'border-box' as const, resize: 'none' as const,
          overscrollBehavior: 'contain' as const,
        } : {}),
      }}
    >
      <table style={espansa ? { ...excelTable, width: '100%', minWidth: 1100 } : excelTable}>
        <thead>
          <tr>
            <th style={excelTh}>Completata</th>
            <th style={excelTh}>Lavorazione</th>
            <th style={excelTh}>Importo previsto</th>
            <th style={excelTh}>% eseguita</th>
            <th style={excelTh}>SAL maturato</th>
            <th style={excelTh}>Data</th>
            <th style={excelTh}>Note</th>
            <th style={excelTh}>Azioni</th>
          </tr>
        </thead>

        <tbody>
          {righeVisibili.map((s, i) => {
            const temporanea = !lavorazioni.some(r => r.id === s.id)
            const rettifica = rettifiche?.[String(s.id)]
            const blocco = !!rettifica && (!rettifica.verificabile || rettifica.anomalia || rettifica.esaurito)
            const origineVariante = originiVariante?.[String(s.id)] || attesaEditor?.origini?.[String(s.id)]
            const rettificaVisibile = attesaEditor && (!rettifica || !rettifica.verificabile) ? attesaEditor.rettifiche?.[String(s.id)] || rettifica : rettifica
            const solaBozza = !!attesaEditor && attesaEditor.righe.some(r => r.id === s.id) && (!rettifica || !rettifica.verificabile)
            const erroreCampo = (campo: CampoEditorSal) => bozze[`${cantiereId}:${s.id}:${campo}`]?.errore
            const feedbackCampo = (campo: CampoEditorSal) => erroreCampo(campo) ? <small role="alert" style={{ display: 'block', color: '#b91c1c', whiteSpace: 'pre-wrap' }}>{erroreCampo(campo)}</small> : null
            const testoSospetto = String(s.descrizione || '').toLowerCase()

            const rigaSospetta =
              testoSospetto.includes('totale offerta') ||
              testoSospetto.includes('cronoprogramma') ||
              testoSospetto.includes('schema pagamenti') ||
              testoSospetto.includes('garanzia') ||
              testoSospetto.includes('firma') ||
              testoSospetto.includes('iva esclusa')

            return (
              <tr key={s.id || i}>
                <td style={excelTd}>
                  <input
                    type="checkbox"
                    checked={!!s.completata}
                    disabled={temporanea || blocco || !!rettifica?.rettificata}
                    title={rettifica?.rettificata ? 'Il completamento al 100% originario non viene forzato dopo una riduzione.' : undefined}
                    onChange={(e) =>
                      cambiaCompletata(s, e.target.checked)
                    }
                  />
                </td>

                <td style={excelTd}>
                  {origineVariante && <small style={{ display: 'block', marginBottom: 6 }}>
                    Origine: Variante “{origineVariante.titolo}” — {origineVariante.data && Number.isFinite(Date.parse(origineVariante.data)) ? new Date(origineVariante.data).toLocaleDateString('it-IT') : 'Data non disponibile'}
                  </small>}
                  <textarea
                    disabled={temporanea && !solaBozza}
                    {...propsEditor(s, 'descrizione')}
                    style={{
                      width: '100%',
                      minWidth: espansa ? 360 : 260,
                      minHeight: 80,
                      border: '1px solid #ccc',
                      borderRadius: 6,
                      padding: 6,
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      lineHeight: 1.4,
                    }}
                  />
                  {feedbackCampo('descrizione')}
                </td>

                <td style={excelTd}>
                  {rettificaVisibile && !rettificaVisibile.verificabile ? <p role="alert">Rettifiche non verificabili</p> : rettificaVisibile?.rettificata ? <div>
                    <div>Importo originario: {formatMoney(Number(s.importo_previsto))}</div>
                    <div>Rettifiche approvate: {formatMoney(-rettificaVisibile.riduzione!)}</div>
                    <div>Importo contrattuale aggiornato: {formatMoney(rettificaVisibile.importoAggiornato!)}</div>
                    {!rettificaVisibile.anomalia && <div>Residuo contrattuale aggiornato: {formatMoney(rettificaVisibile.importoAggiornato! - Number(s.importo_maturato))}</div>}
                    <a href="#sal-aggiornamenti-contrattuali">Vedi aggiornamenti contrattuali</a>
                    {rettificaVisibile.anomalia && <p role="alert">Importo aggiornato inferiore al maturato o negativo: avanzamento bloccato.</p>}
                    {rettificaVisibile.esaurito && <p>Residuo contrattuale esaurito</p>}
                  </div> :
                  <input
                    disabled={temporanea && !solaBozza}
                    {...propsEditor(s, 'importo_previsto')}
                    style={{
                      width: 110,
                      padding: 6,
                      borderRadius: 6,
                      border: '1px solid #ccc',
                    }}
                  />}
                  {feedbackCampo('importo_previsto')}
                </td>

                <td style={excelTd}>
                  <input
                    disabled={(temporanea || blocco) && !solaBozza}
                    {...propsEditor(s, 'percentuale')}
                    style={{
                      width: 70,
                      padding: 6,
                      borderRadius: 6,
                      border: '1px solid #ccc',
                    }}
                  />
                  {feedbackCampo('percentuale')}
                </td>

                <td
                  style={{
                    ...excelTd,
                    fontWeight: 700,
                    color: '#16a34a',
                  }}
                >
                  {formatMoney(Number(s.importo_maturato || 0))}
                </td>

                <td style={excelTd}>
                  {s.data_aggiornamento || '-'}
                </td>

                <td style={espansa ? { ...excelTd, minWidth: 220, whiteSpace: 'normal', overflowWrap: 'anywhere' } : excelTd}>
                  {rigaSospetta
                    ? '⚠️ Probabile errore OCR/importazione'
                    : s.note || '-'}
                </td>

                <td style={excelTd}>
                  <button
                    disabled={temporanea}
                    onClick={() => onElimina(s.id)}
                    style={{
                      background: '#dc2626',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    Elimina
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    </section>
  )
}
