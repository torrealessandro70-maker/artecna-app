import ImportaPreventivoSalPanel from './ImportaPreventivoSalPanel'
import ScomposizioneContrattuale from './ScomposizioneContrattuale'
import type { ScomposizioneVarianti } from '../engines/economia/riepilogoEconomico'

import { eliminaPreventivoConFile, messaggioEliminazione } from '../utils/eliminazionePreventivo'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { calcolaStampaSal, documentoSalCliente, type DatiStampaSal } from '../utils/stampaSalCliente'

import SalForm from './SalForm'
import PreventivoLavorazioniForm from './PreventivoLavorazioniForm'
import PreventiviCaricatiList from './PreventiviCaricatiList'
import ConfrontoPdfSalPanel from './ConfrontoPdfSalPanel'
import PulisciPreventivoSalButton from './PulisciPreventivoSalButton'
import SalSummaryCards from './SalSummaryCards'
import SalTable, { rettificheRigheSal } from './SalTable'

export async function leggiRettificheSal(client: any, cantiereId: string, contrattoId: string) {
  if (!cantiereId || !contrattoId) throw new Error('Contratto SAL non verificabile')
  const pagina = async (rpc: string, parametri: object, ordine: string) => {
    const righe: any[] = [], ids = new Set<string>()
    for (let offset = 0; ; offset += 200) {
      const { data, error } = await client.rpc(rpc, parametri).order(ordine, { ascending: true }).order('id', { ascending: true }).range(offset, offset + 199)
      if (error || !Array.isArray(data)) throw new Error('Lettura rettifiche non verificabile')
      for (const riga of data) {
        if (!riga?.id || ids.has(String(riga.id))) throw new Error('Lettura rettifiche incompleta o duplicata')
        ids.add(String(riga.id)); righe.push(riga)
      }
      if (data.length < 200) return righe
    }
  }
  const varianti = await pagina('leggi_varianti_cantiere', { p_cantiere_id: cantiereId }, 'numero')
  const lavori: any[] = []; let deltaCentesimi = 0, incrementiCentesimi = 0, riduzioniCentesimi = 0
  const centesimi = (value: unknown) => {
    if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '' || !Number.isFinite(Number(value))) throw new Error('Importo non verificabile')
    const cent = Math.round(Number(value) * 100)
    if (!Number.isSafeInteger(cent) || Math.abs(Number(value) * 100 - cent) > 0.000001) throw new Error('Importo non verificabile')
    return cent
  }
  for (const variante of varianti) {
    if (variante.cantiere_id !== cantiereId) throw new Error('Cantiere Variante incoerente')
    if (variante.stato !== 'approvata' || variante.preventivo_contrattuale_id !== contrattoId) continue
    if (variante.importo_delta_approvato == null || String(variante.importo_delta_approvato).trim() === '' || !Number.isFinite(Number(variante.importo_delta_approvato))) throw new Error('Delta Variante non verificabile')
    const componenti = await pagina('leggi_lavorazioni_variante', { p_variante_id: variante.id }, 'numero_riga')
    if (!componenti.length) throw new Error('Variante approvata senza lavorazioni: non verificabile')
    let somma = 0
    for (const lavoro of componenti) {
      if (lavoro.variante_id !== variante.id || !['nuova', 'aumento', 'riduzione_residua', 'eliminazione_residua'].includes(lavoro.operazione)) throw new Error('Operazione Variante non verificabile')
      if (['riduzione_residua', 'eliminazione_residua'].includes(lavoro.operazione) &&
          ((lavoro.riferimento_preventivo_lavorazione_id != null) === (lavoro.riferimento_variante_lavorazione_id != null) ||
           lavoro.delta_contratto == null || String(lavoro.delta_contratto).trim() === '' || !Number.isFinite(Number(lavoro.delta_contratto)) || Number(lavoro.delta_contratto) >= 0 ||
           lavoro.quantita_delta == null || String(lavoro.quantita_delta).trim() === '' || !Number.isFinite(Number(lavoro.quantita_delta)) || Number(lavoro.quantita_delta) >= 0)) throw new Error('Rettifica non verificabile')
      const importo = centesimi(lavoro.delta_contratto)
      if (['nuova', 'aumento'].includes(lavoro.operazione) ? importo <= 0 : importo >= 0) throw new Error('Segno Variante non verificabile')
      somma += importo
      if (!Number.isSafeInteger(somma)) throw new Error('Somma Variante non verificabile')
      if (importo > 0) incrementiCentesimi += importo
      else riduzioniCentesimi -= importo
      lavori.push({ ...lavoro, variante: { id: variante.id, titolo: variante.titolo, data_variante: variante.data_variante, approvata_at: variante.approvata_at, stato: variante.stato } })
    }
    if (somma !== centesimi(variante.importo_delta_approvato)) throw new Error('Delta testata/lavorazioni incoerente: non verificabile')
    deltaCentesimi += somma
  }
  if (![deltaCentesimi, incrementiCentesimi, riduzioniCentesimi].every(Number.isSafeInteger)) throw new Error('Totale Varianti non verificabile')
  return { lavori, delta: deltaCentesimi / 100, incrementi: incrementiCentesimi / 100, riduzioni: riduzioniCentesimi / 100 }
}

export function gruppiRigheSal(righe: any[], lavori: any[], completa: boolean) {
  const operative = new Set(lavori.filter(l => ['nuova', 'aumento'].includes(l.operazione)).map(l => String(l.id)))
  return { base: righe.filter(r => r.source_variante_lavorazione_id == null),
    operative: completa ? righe.filter(r => r.source_lavorazione_id == null && operative.has(String(r.source_variante_lavorazione_id))) : [],
    nonVerificabili: righe.filter(r => r.source_variante_lavorazione_id != null && (!completa || r.source_lavorazione_id != null || !operative.has(String(r.source_variante_lavorazione_id)))) }
}

export function totaliContrattualiSal(originario: number, incrementi: number, riduzioni: number, maturato: number) {
  if (![originario, incrementi, riduzioni, maturato].every(Number.isFinite)) throw new Error('Totali non verificabili')
  const aggiornato = originario + incrementi - riduzioni
  const residuo = aggiornato - maturato
  if (![aggiornato, residuo].every(Number.isFinite)) throw new Error('Totali non verificabili')
  return { aggiornato, residuo }
}

export function AggiornamentiContrattualiSal({ lavori, righe, verificabile, formatMoney, excelTable = {}, excelTh = {}, excelTd = {}, totali, scomposizione }: {
  lavori: any[]; righe: any[]; verificabile: boolean; formatMoney: (value: number) => string
  excelTable?: CSSProperties; excelTh?: CSSProperties; excelTd?: CSSProperties
  totali?: { incrementi: number; riduzioni: number; delta: number }
  scomposizione?: ScomposizioneVarianti | null
}) {
  const [dettaglioAperto, setDettaglioAperto] = useState(false)
  const tipi: Record<string, string> = { nuova: 'Incremento', aumento: 'Incremento', riduzione_residua: 'Riduzione', eliminazione_residua: 'Eliminazione' }
  const data = (value: string | null | undefined) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleDateString('it-IT') : 'Data non disponibile'
  const conSegno = (value: number) => `${value >= 0 ? '+' : '-'}${formatMoney(Math.abs(value))}`
  const secondario: CSSProperties = { display: 'block', marginTop: 4, fontSize: 12, color: '#64748b' }
  const cella: CSSProperties = { ...excelTd, padding: '10px 12px', verticalAlign: 'top', borderBottom: '1px solid #dbe3ee' }
  return <section id="sal-aggiornamenti-contrattuali" aria-label="Aggiornamenti contrattuali">
    <h3>Aggiornamenti contrattuali</h3>
    {scomposizione !== undefined && <ScomposizioneContrattuale valori={verificabile && totali?.delta === scomposizione?.totale ? scomposizione : null} formatMoney={formatMoney} />}
    {!verificabile ? <p role="alert">Non verificabile: letture incomplete o delta contrattuali incoerenti.</p> : lavori.length === 0 ? <p>Nessun aggiornamento contrattuale approvato.</p> :
      <><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <span>{lavori.length} righe{totali && <> — {conSegno(totali.delta)}</>}</span>
        <button type="button" aria-expanded={dettaglioAperto} onClick={() => setDettaglioAperto(aperto => !aperto)}
          style={{ minHeight: 44, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#f8fafc', cursor: 'pointer' }}>
          {dettaglioAperto ? 'Nascondi dettaglio' : 'Mostra dettaglio'}
        </button>
      </div>
      {dettaglioAperto && <div style={{ overflowX: 'auto' }}><table style={{ ...excelTable, width: '100%', minWidth: 850, borderCollapse: 'collapse' }}>
        <thead><tr>{['N.', 'Data', 'Variante', 'Lavorazione', 'Tipo', 'Importo'].map(t => <th key={t} scope="col"
          style={{ ...excelTh, padding: '10px 12px', textAlign: t === 'Importo' ? 'right' : 'left' }}>{t}</th>)}</tr></thead>
        <tbody>{lavori.map((l, indice) => {
        const origine = righe.find(r => l.riferimento_preventivo_lavorazione_id != null ? String(r.source_lavorazione_id) === String(l.riferimento_preventivo_lavorazione_id)
          : l.riferimento_variante_lavorazione_id != null && String(r.source_variante_lavorazione_id) === String(l.riferimento_variante_lavorazione_id))
        const componente = lavori.find(r => l.riferimento_variante_lavorazione_id != null && String(r.id) === String(l.riferimento_variante_lavorazione_id))
        return <tr key={l.id} style={{ background: indice % 2 ? '#f8fafc' : '#fff' }}>
          <td style={cella}>{indice + 1}</td>
          <td style={{ ...cella, whiteSpace: 'nowrap' }}>{data(l.variante.data_variante)}{l.variante.approvata_at && <small style={secondario}>Approvata: {data(l.variante.approvata_at)}</small>}</td>
          <td style={{ ...cella, minWidth: 170 }}><strong>{l.variante.titolo || 'Senza titolo'}</strong></td>
          <td style={{ ...cella, minWidth: 280, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{l.descrizione}
            {(origine?.descrizione || componente?.descrizione) && <small style={secondario}>Origine: {origine?.descrizione || componente.descrizione}</small>}</td>
          <td style={cella}><span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6,
            background: Number(l.delta_contratto) < 0 ? '#fff1f2' : '#ecfdf5', color: Number(l.delta_contratto) < 0 ? '#9f1239' : '#065f46' }}>{tipi[l.operazione]}</span></td>
          <td style={{ ...cella, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{conSegno(Number(l.delta_contratto))}</td>
        </tr>
      })}</tbody></table></div>}
      {totali && <dl aria-label="Totali aggiornamenti contrattuali" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 20px', padding: 16, background: '#f8fafc', border: '1px solid #dbe3ee' }}>
        <dt>Totale incrementi</dt><dd style={{ margin: 0, textAlign: 'right' }}>{conSegno(totali.incrementi)}</dd>
        <dt>Totale riduzioni</dt><dd style={{ margin: 0, textAlign: 'right' }}>{conSegno(-totali.riduzioni)}</dd>
        <dt><strong>Delta aggiornamenti</strong></dt><dd style={{ margin: 0, textAlign: 'right' }}><strong>{conSegno(totali.delta)}</strong></dd>
      </dl>}</>}
  </section>
}

type ContestoSal =
  | { contestuale?: false; cantiereContestuale?: never }
  | { contestuale: true; cantiereContestuale: { id: string; nome: string } }

type Props = ContestoSal & {
  scomposizioneEconomiaApprovata?: ScomposizioneVarianti | null
  cardStyle: CSSProperties
  cantieri: any[]
  salCantiere: string
  setSalCantiere: (v: string) => void

  salDescrizione: string
  setSalDescrizione: (v: string) => void
  salImportoPrevisto: string
  setSalImportoPrevisto: (v: string) => void
  salPercentuale: string
  setSalPercentuale: (v: string) => void
  salNote: string
  setSalNote: (v: string) => void

  salvaSalLavorazione: (cantiereOverride?: string) => void | Promise<void>

  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties

  supabase: any

  caricaSalLavorazioni: () => Promise<void>
  caricaPreventivoLavorazioni: () => Promise<void>
  caricaEconomia: () => Promise<void>
  caricaCantieri: () => Promise<void>

  prevDescrizione: string
  setPrevDescrizione: (v: string) => void
  prevQuantita: string
  setPrevQuantita: (v: string) => void
  prevPrezzoUnitario: string
  setPrevPrezzoUnitario: (v: string) => void
  prevUnita: string
  setPrevUnita: (v: string) => void
  prevImporto: string
  setPrevImporto: (v: string) => void

  salvaLavorazionePreventivo: (cantiereOverride?: string) => void | Promise<void>

  preventivi: any[]
  preventivoLavorazioni: any[]

  cantiereScheda: string

  formatMoney: (n: number) => string
  parseImporto: (v: any) => number
  analizzaRigheDocumento: (testo: string) => any[]

  mostraConfrontoPdfSal: boolean
  setMostraConfrontoPdfSal: (v: boolean) => void

 lavorazioneEditId: number | null
setLavorazioneEditId: (v: number | null) => void

  lavorazioneEditDescrizione: string
  setLavorazioneEditDescrizione: (v: string) => void

  lavorazioneEditImporto: string
  setLavorazioneEditImporto: (v: string) => void

  salLavorazioni: any[]
  accontiCantiere: any[]

  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties

  eliminaSalLavorazione: (s: any, cantiereOverride?: string) => void | Promise<void>
}

// Osserva le query gia esistenti dei figli, senza aggiungere richieste o cambiare payload.
function clientSalMonitorato(client: any, osserva: <T>(azione: () => T | PromiseLike<T>) => Promise<T>) {
  const query = (target: any): any => new Proxy(target, {
    get(oggetto, key) {
      const valore = Reflect.get(oggetto, key, oggetto)
      if (key === 'then' && typeof valore === 'function') {
        return (successo: any, errore: any) => osserva(() => Promise.resolve(oggetto)).then(successo, errore)
      }
      if (typeof valore !== 'function') return valore
      return (...args: any[]) => {
        const risultato = valore.apply(oggetto, args)
        return risultato && typeof risultato === 'object' ? query(risultato) : risultato
      }
    },
  })
  return new Proxy(client, {
    get(oggetto, key) {
      const valore = Reflect.get(oggetto, key, oggetto)
      if (key === 'storage') return query(valore)
      return key === 'from' || key === 'rpc'
        ? (...args: any[]) => query(valore.apply(oggetto, args))
        : typeof valore === 'function' ? valore.bind(oggetto) : valore
    },
  })
}

export default function SalDettagliatoPanel({
  scomposizioneEconomiaApprovata,
  cardStyle,
  cantieri,
  salCantiere: salCantiereLegacy,
  setSalCantiere,

  salDescrizione,
  setSalDescrizione,
  salImportoPrevisto,
  setSalImportoPrevisto,
  salPercentuale,
  setSalPercentuale,
  salNote,
  setSalNote,

  salvaSalLavorazione,

  buttonPrimary,
  buttonSecondary,

  supabase: clientOriginale,

  caricaSalLavorazioni: rileggiSalOriginale,
  caricaPreventivoLavorazioni: rileggiLavorazioniOriginale,
  caricaEconomia: rileggiEconomiaOriginale,
  caricaCantieri: rileggiCantieriOriginale,

  prevDescrizione,
  setPrevDescrizione,
  prevQuantita,
  setPrevQuantita,
  prevPrezzoUnitario,
  setPrevPrezzoUnitario,
  prevUnita,
  setPrevUnita,
  prevImporto,
  setPrevImporto,

  salvaLavorazionePreventivo,

  preventivi,
  preventivoLavorazioni,

  cantiereScheda,

  formatMoney,
  parseImporto,
  analizzaRigheDocumento,

  mostraConfrontoPdfSal,
  setMostraConfrontoPdfSal,

  lavorazioneEditId,
  setLavorazioneEditId,

  lavorazioneEditDescrizione,
  setLavorazioneEditDescrizione,

  lavorazioneEditImporto,
  setLavorazioneEditImporto,

  salLavorazioni,
  accontiCantiere,

  excelTable,
  excelTh,
  excelTd,

  eliminaSalLavorazione,
  ...contesto
}: Props) {
  const operazioniSal = useRef(0)
  const [operazioniInCorso, setOperazioniInCorso] = useState(0)
  const [anteprimaSal, setAnteprimaSal] = useState<{ dati: DatiStampaSal; righe: any[]; acconti: any[]; rettifiche: typeof rettificheSal } | null>(null)
  const [detrazioneAcconto, setDetrazioneAcconto] = useState('')
  const [ivaStampa, setIvaStampa] = useState('')
  const osservaOperazioneSal = useCallback(async <T,>(azione: () => T | PromiseLike<T>): Promise<T> => {
    setOperazioniInCorso(++operazioniSal.current)
    try { return await azione() }
    finally { setOperazioniInCorso(--operazioniSal.current) }
  }, [])
  const supabase = useMemo(() => clientSalMonitorato(clientOriginale, osservaOperazioneSal), [clientOriginale, osservaOperazioneSal])
  const caricaSalLavorazioni = useCallback(() => osservaOperazioneSal(rileggiSalOriginale), [osservaOperazioneSal, rileggiSalOriginale])
  const caricaPreventivoLavorazioni = useCallback(() => osservaOperazioneSal(rileggiLavorazioniOriginale), [osservaOperazioneSal, rileggiLavorazioniOriginale])
  const caricaEconomia = useCallback(() => osservaOperazioneSal(rileggiEconomiaOriginale), [osservaOperazioneSal, rileggiEconomiaOriginale])
  const caricaCantieri = useCallback(() => osservaOperazioneSal(rileggiCantieriOriginale), [osservaOperazioneSal, rileggiCantieriOriginale])
  const cantiereSal = cantieri.filter(c => contesto.contestuale ? c.id === contesto.cantiereContestuale.id : c.nome === salCantiere)
  const cantiereSalId = cantiereSal.length === 1 ? cantiereSal[0].id : undefined
  const contrattoSalId = cantiereSal.length === 1 ? cantiereSal[0].preventivo_contrattuale_id : undefined
  const [rettificheSal, setRettificheSal] = useState<{ cantiereId: string; contrattoId: string; righe: any[]; lavori: any[]; delta: number; incrementi: number; riduzioni: number } | null>(null)
  const [erroreRettifiche, setErroreRettifiche] = useState('')
  const [riletturaRettifiche, setRiletturaRettifiche] = useState(0)
  useEffect(() => {
    let attivo = true
    setRettificheSal(null); setErroreRettifiche('')
    if (!cantiereSalId || !contrattoSalId) { setErroreRettifiche('Contratto SAL non verificabile'); return }
    void leggiRettificheSal(clientOriginale, cantiereSalId, contrattoSalId).then(esito => {
      if (attivo) setRettificheSal({ ...esito, cantiereId: cantiereSalId, contrattoId: contrattoSalId, righe: salLavorazioni })
    }, () => { if (attivo) setErroreRettifiche('Rettifiche non verificabili: rileggi prima di avanzare il SAL.') })
    return () => { attivo = false }
  }, [clientOriginale, cantiereSalId, contrattoSalId, salLavorazioni, riletturaRettifiche])
  const letturaRettificheValida = rettificheSal?.cantiereId === cantiereSalId && rettificheSal?.contrattoId === contrattoSalId && rettificheSal?.righe === salLavorazioni
  const mappaRettifiche = rettificheRigheSal(salLavorazioni, letturaRettificheValida ? rettificheSal!.lavori : [], letturaRettificheValida)
  const aggiornamentiSal = useRef(new Map<string, {
    versione: number
    coda: Promise<void>
  }>())

  const aggiornaSalStrutturato = async (
    riga: any,
    percentuale: number | null,
    completata: boolean | null,
    erroreEditor = false,
  ): Promise<boolean> => {
    const base = riga.source_lavorazione_id != null
    const variante = riga.source_variante_lavorazione_id != null
    if (!base && !variante) return false
    if (base && variante) {
      if (erroreEditor) throw new Error('Riga SAL con sorgente incoerente.')
      alert('Riga SAL con sorgente incoerente.')
      return true
    }

    const chiave = String(riga.id)
    const richieste = aggiornamentiSal.current.get(chiave) || {
      versione: 0,
      coda: Promise.resolve(),
    }
    aggiornamentiSal.current.set(chiave, richieste)
    const versione = ++richieste.versione
    const corrente = () => richieste.versione === versione
    const messaggi: Record<string, string> = {
      P2030: 'Riga SAL non disponibile.',
      P2031: 'Richiesta SAL non valida.',
      P2032: 'Contesto SAL cambiato. Ricarica.',
      P2033: 'Sorgente contrattuale non valida.',
      P2034: 'Importo SAL incoerente con la sorgente.',
      P2035: 'Sorgente Variante non valida.',
      P2036: 'Percentuale non valida.',
      P2037: 'Residuo contrattuale insufficiente o incoerente.',
      P2038: 'Riga SAL con doppia sorgente.',
      P2039: 'Conflitto durante aggiornamento SAL. Riprova.',
      P2040: 'Operazione SAL non autorizzata.',
    }
    const numeroFinito = (valore: unknown) =>
      (typeof valore === 'number' ||
        (typeof valore === 'string' && valore.trim() !== '')) &&
      Number.isFinite(Number(valore))

    // Ordina le scritture della stessa riga; le altre righe restano indipendenti.
    const esegui = async () => {
      try {
        const { data, error } = await supabase.rpc('aggiorna_avanzamento_sal', {
          p_sal_id: riga.id,
          p_percentuale: percentuale,
          p_completata: completata,
        })
        if (!corrente()) return
        if (error) {
          if (erroreEditor) throw error
          alert(messaggi[error.code] || 'Errore aggiornamento SAL. Ricarica e riprova.')
          await caricaSalLavorazioni()
          return
        }
        const esito = Array.isArray(data) && data.length === 1 ? data[0] : null
        if (!esito || String(esito.id) !== chiave ||
            esito.classificazione !== (base ? 'STRUTTURATA_BASE' : 'STRUTTURATA_VARIANTE') ||
            !numeroFinito(esito.percentuale) || !numeroFinito(esito.importo_maturato) ||
            typeof esito.completata !== 'boolean') {
          if (erroreEditor) throw new Error('Risposta SAL non verificabile. La bozza è conservata; verifica i dati prima di riprovare.')
          alert('Risposta SAL non verificabile. Ricarica i dati.')
          await caricaSalLavorazioni()
          return
        }
        // Rilegge i valori persistiti dal server, senza calcoli o patch locali.
        await caricaSalLavorazioni()
      } catch (errore) {
        if (erroreEditor) throw errore
        if (corrente()) alert('Aggiornamento SAL non confermato. Ricarica i dati.')
      }
    }
    richieste.coda = richieste.coda.then(esegui, esegui)
    await richieste.coda
    return true
  }

  // Il record contestuale arriva dalla selezione UUID della Scheda.
  const salCantiere = contesto.contestuale
    ? contesto.cantiereContestuale.nome
    : salCantiereLegacy
  const cantiereOverride = contesto.contestuale ? salCantiere : undefined
  if (contesto.contestuale && (!contesto.cantiereContestuale.id || !salCantiere.trim())) {
    throw new Error('Il SAL contestuale richiede un cantiere con UUID e nome')
  }
  const vincolaAlCantiere = (query: any) => contesto.contestuale
    ? query.eq('cantiere', salCantiere)
    : query

  return (





<div style={cardStyle}>
  <h2>📊 SAL dettagliato</h2>

  <p style={{ color: '#64748b', marginTop: 0 }}>
    Gestisci lo stato avanzamento lavori per singola lavorazione.
  </p>

  <div
    style={{
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 18,
    }}
  >
    {!contesto.contestuale && <select
      value={salCantiere}
      onChange={(e) => setSalCantiere(e.target.value)}
      style={{ padding: 8, width: 220 }}
    >
      <option value="">Seleziona cantiere</option>
      {cantieri.map((c, i) => (
        <option key={c.id || i} value={c.nome}>
          {c.nome}
        </option>
      ))}
    </select>}

  <SalForm
  salDescrizione={salDescrizione}
  setSalDescrizione={setSalDescrizione}
  salImportoPrevisto={salImportoPrevisto}
  setSalImportoPrevisto={setSalImportoPrevisto}
  salPercentuale={salPercentuale}
  setSalPercentuale={setSalPercentuale}
  salNote={salNote}
  setSalNote={setSalNote}
  onSalva={() => osservaOperazioneSal(() => salvaSalLavorazione(cantiereOverride))}
  buttonPrimary={buttonPrimary}
/>

    {contesto.contestuale ? <ImportaPreventivoSalPanel
      key={contesto.cantiereContestuale.id}
      cantiere={contesto.cantiereContestuale}
      supabase={supabase}
      caricaSalLavorazioni={caricaSalLavorazioni}
      formatMoney={formatMoney}
      buttonStyle={buttonSecondary}
    /> : (
    <button
      onClick={async () => {
        if (!salCantiere) {
          alert('Seleziona prima un cantiere')
          return
        }

        const { data: righePreventivo, error: erroreCaricamento } =
          await supabase
            .from('preventivo_lavorazioni')
            .select('*')
            .eq('cantiere', salCantiere)

        if (erroreCaricamento) {
          alert(
            'Errore caricamento lavorazioni preventivo: ' +
              erroreCaricamento.message
          )
          return
        }

        if (!righePreventivo || righePreventivo.length === 0) {
          alert('Nessuna lavorazione preventivo trovata per questo cantiere')
          return
        }

        const lavorazioniDaInserire = righePreventivo.map((r: any) => ({
          cantiere: salCantiere,
          descrizione: r.descrizione,
          importo_previsto: Number(r.importo_previsto || 0),
          percentuale: 0,
          importo_maturato: 0,
          completata: false,
          note: 'Importata da preventivo',
          data_aggiornamento: new Date().toISOString().slice(0, 10),
        }))

        const { error } = await supabase
          .from('sal_lavorazioni')
          .insert(lavorazioniDaInserire)

        if (error) {
          alert('Errore importazione nel SAL: ' + error.message)
          return
        }

        await caricaSalLavorazioni()

        alert('Lavorazioni importate nel SAL')
      }}
      style={buttonSecondary}
    >
      Importa lavorazioni preventivo nel SAL
    </button>
    )}
  </div>

  {!contesto.contestuale && <>
  <div
    style={{
      marginTop: 20,
      marginBottom: 20,
      padding: 14,
      border: '1px solid #ddd',
      borderRadius: 10,
      background: '#fff',
    }}
  >
    <h3 style={{ marginTop: 0 }}>📋 Lavorazioni preventivo</h3>

    <div
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      <PreventivoLavorazioniForm
  prevDescrizione={prevDescrizione}
  setPrevDescrizione={setPrevDescrizione}
  prevQuantita={prevQuantita}
  setPrevQuantita={setPrevQuantita}
  prevPrezzoUnitario={prevPrezzoUnitario}
  setPrevPrezzoUnitario={setPrevPrezzoUnitario}
  prevUnita={prevUnita}
  setPrevUnita={setPrevUnita}
  prevImporto={prevImporto}
  setPrevImporto={setPrevImporto}
  onSalva={() => osservaOperazioneSal(() => salvaLavorazionePreventivo(cantiereOverride))}
  buttonPrimary={buttonPrimary}
/>

    </div>
  </div>
{salCantiere && (() => {
  const totalePreventiviPdf = preventivi
   .filter((p) => p.cantiere === (contesto.contestuale ? salCantiere : cantiereScheda))
    .reduce((tot, p) => tot + Number(p.importo_totale || 0), 0)

  const totaleLavorazioniPreventivo = preventivoLavorazioni
    .filter((p) => p.cantiere === salCantiere)
    .reduce((tot, p) => tot + Number(p.importo_previsto || 0), 0)

  const differenza = totalePreventiviPdf - totaleLavorazioniPreventivo

  return (
    <div
      style={{
        marginTop: 15,
        padding: 12,
        border: '2px solid #0f172a',
        borderRadius: 8,
        background: '#f8fafc',
      }}
    >
      <strong>📊 Controllo importazione preventivo</strong>

      <div style={{ marginTop: 8 }}>
        Totale preventivi caricati: € {formatMoney(totalePreventiviPdf)}
      </div>

      <div>
        Totale lavorazioni preventivo/SAL: € {formatMoney(totaleLavorazioniPreventivo)}
      </div>




<div style={{ marginTop: 16 }}>
  <strong style={{ fontSize: 18 }}>
    📋 Lavorazioni preventivo caricate
  </strong>

  <div
  style={{
    marginTop: 12,
   background: '#fff',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    padding: 18,
boxShadow: '0 2px 10px rgba(0,0,0,0.08)',

    width: '100%',
    minWidth: 360,
    maxWidth: '100%',

    height: 520,
    minHeight: 260,
    maxHeight: '80vh',

    overflow: 'auto',
    resize: 'both',
  }}
>
    {preventivoLavorazioni.filter(
      (p) => p.cantiere === salCantiere
    ).length === 0 ? (
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 20,
        }}
      >
        Nessuna lavorazione caricata.
      </div>
    ) : (
      preventivoLavorazioni
        .filter((p) => p.cantiere === salCantiere)
        .map((p, i) => (
          <div
            key={p.id || i}
            style={{
              background: '#fff',
              marginBottom: 18,
              padding: '22px 26px',
              borderRadius: 4,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              border: '1px solid #e5e7eb',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                display: 'flex',
                gap: 8,
              }}
            >
              <button
                onClick={async () => {
                  const conferma = confirm(
                    'Eliminare questa lavorazione?'
                  )

                  if (!conferma) return

                  const { error } = await vincolaAlCantiere(supabase
                    .from('preventivo_lavorazioni')
                    .delete()
                    .eq('id', p.id))

                  if (error) {
                    alert(
                      messaggioEliminazione(error, 'Lavorazione preventivo')
                    )
                    return
                  }

                  await caricaPreventivoLavorazioni()

                  alert('Lavorazione eliminata')
                }}
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
            </div>

            <div
              style={{
                fontSize: 13,
                color: '#64748b',
                marginBottom: 8,
              }}
            >
              Riga #{i + 1}
            </div>

            <div
              style={{
                fontSize: 20,
                fontWeight: 400,
                marginBottom: 10,
                lineHeight: 1.3,
              }}
            >
             {String(p.descrizione || '')
  .replace(/\s+/g, ' ')
  .trim()}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 120px 120px 1fr',
                gap: 12,
                marginTop: 18,
                fontSize: 18,
              }}
            >
              <div>
                <strong>UM</strong>
                <br />
                {p.unita_misura || '-'}
              </div>

              <div>
                <strong>Qtà</strong>
                <br />
                {p.quantita || '-'}
              </div>

              <div>
                <strong>Prezzo</strong>
                <br />
                €
                {formatMoney(
                  Number(p.prezzo_unitario || 0)
                )}
              </div>

              <div>
                <strong>Totale</strong>
                <br />
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                  }}
                >
                  €
                  {formatMoney(
                    Number(p.importo_previsto || 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        ))
    )}
  </div>
</div>

      <div
        style={{
          marginTop: 8,
          fontWeight: 700,
          color: Math.abs(differenza) > 1 ? '#b91c1c' : '#15803d',
        }}
      >
        Differenza: € {formatMoney(differenza)}
      </div>

      {Math.abs(differenza) > 1 && (
        <div style={{ marginTop: 8, color: '#92400e' }}>
          ⚠️ Il totale delle lavorazioni non coincide con il totale del preventivo.
          Potrebbero mancare alcune voci oppure alcune righe sono state lette male.
        </div>
      )}

{!contesto.contestuale && <>
<PreventiviCaricatiList
  preventivi={preventivi}
  salCantiere={salCantiere}
  formatMoney={formatMoney}
  onElimina={async (p) => {
    const conferma = confirm('Eliminare questo preventivo caricato?')
    if (!conferma) return

    try {
      const avviso = await eliminaPreventivoConFile(supabase, p.id)
      if (avviso) alert(avviso)
      await caricaEconomia()
      if (!avviso) alert('Preventivo eliminato completamente')
    } catch (error: any) {
      alert(error.message || 'Errore eliminazione preventivo')
    }
  }}
/>

<ConfrontoPdfSalPanel
  mostraConfrontoPdfSal={mostraConfrontoPdfSal}
  setMostraConfrontoPdfSal={setMostraConfrontoPdfSal}
  salCantiere={salCantiere}
  preventivi={preventivi}
  preventivoLavorazioni={preventivoLavorazioni}
  supabase={supabase}
  formatMoney={formatMoney}
  parseImporto={parseImporto}
  analizzaRigheDocumento={analizzaRigheDocumento}
  caricaPreventivoLavorazioni={caricaPreventivoLavorazioni}
  lavorazioneEditId={lavorazioneEditId}
  setLavorazioneEditId={setLavorazioneEditId}
  lavorazioneEditDescrizione={lavorazioneEditDescrizione}
  setLavorazioneEditDescrizione={setLavorazioneEditDescrizione}
  lavorazioneEditImporto={lavorazioneEditImporto}
  setLavorazioneEditImporto={setLavorazioneEditImporto}
  buttonSecondary={buttonSecondary}
/>


<PulisciPreventivoSalButton
  salCantiere={salCantiere}
  preventivi={preventivi}
  supabase={supabase}
  caricaCantieri={caricaCantieri}
  caricaEconomia={caricaEconomia}
  caricaPreventivoLavorazioni={caricaPreventivoLavorazioni}
  caricaSalLavorazioni={caricaSalLavorazioni}
/>
</>}


    </div>
  )
})()}
  </>}

  {salCantiere && (
    <>
      {(() => {
        const lavorazioniCantiere = salLavorazioni.filter(
          (s) => s.cantiere === salCantiere
        )

        const totalePrevistoSal = lavorazioniCantiere.reduce(
          (tot, s) => tot + Number(s.importo_previsto || 0),
          0
        )

        const totaleMaturatoSal = lavorazioniCantiere.reduce(
          (tot, s) => tot + Number(s.importo_maturato || 0),
          0
        )

        const totaleAccontiSal = accontiCantiere
  .filter((a) => a.cantiere === salCantiere)
  .reduce(
    (tot, a) => tot + Number(a.importo || 0),
    0
  )
        const daRichiedereSal =
  totaleMaturatoSal - totaleAccontiSal

        const percentualeGlobaleSal =
          totalePrevistoSal > 0
            ? (totaleMaturatoSal / totalePrevistoSal) * 100
            : 0

        let statoSal = 'coperto'

        if (daRichiedereSal > 0) {
          statoSal = 'da_richiedere'
        }

        if (daRichiedereSal > 500) {
          statoSal = 'urgente'
        }

        const gruppiSal = gruppiRigheSal(lavorazioniCantiere, letturaRettificheValida ? rettificheSal!.lavori : [], letturaRettificheValida)
        const righeOperative = lavorazioniCantiere.filter(r => gruppiSal.base.includes(r) || gruppiSal.operative.includes(r))
        const originiVariante = Object.fromEntries(gruppiSal.operative.map(r => {
          const lavoro = rettificheSal!.lavori.find(l => String(l.id) === String(r.source_variante_lavorazione_id))
          return [String(r.id), { titolo: lavoro.variante.titolo || 'Titolo non disponibile', data: lavoro.variante.data_variante || null }]
        }))
        const renderTabellaSal = (righe: any[]) => (
 <SalTable
  cantiereId={contesto.contestuale ? contesto.cantiereContestuale.id : salCantiere}
  nomeCantiere={salCantiere}
  lavorazioni={righe}
  rettifiche={mappaRettifiche}
  originiVariante={originiVariante}
  excelTable={excelTable}
  excelTh={excelTh}
  excelTd={excelTd}
  formatMoney={formatMoney}
  onToggleCompletata={(s, completata) => osservaOperazioneSal(async () => {
    if (await aggiornaSalStrutturato(s, null, completata)) return
    const nuovaPercentuale = completata
      ? Number(s.percentuale || 0)
      : 0

    const nuovoMaturato = completata
      ? (Number(s.importo_previsto || 0) * nuovaPercentuale) / 100
      : 0

    const { error } = await vincolaAlCantiere(supabase
      .from('sal_lavorazioni')
      .update({
        completata,
        percentuale: nuovaPercentuale,
        importo_maturato: nuovoMaturato,
        data_aggiornamento: new Date()
          .toISOString()
          .slice(0, 10),
      })
      .eq('id', s.id))

    if (error) {
      alert('Errore aggiornamento SAL: ' + error.message)
      return
    }

    await caricaSalLavorazioni()
  })}
  onUpdateDescrizione={(s, descrizione) => osservaOperazioneSal(async () => {
    const { error } = await vincolaAlCantiere(supabase
      .from('sal_lavorazioni')
      .update({
        descrizione,
      })
      .eq('id', s.id))

    if (error) throw error
    await caricaSalLavorazioni()
  })}
  onUpdateImporto={(s, valore) => osservaOperazioneSal(async () => {
    const importo = parseImporto(valore)

    const { error } = await vincolaAlCantiere(supabase
      .from('sal_lavorazioni')
      .update({
        importo_previsto: importo,
      })
      .eq('id', s.id))

    if (error) throw error
    await caricaSalLavorazioni()
  })}
  onUpdatePercentuale={(s, valore) => osservaOperazioneSal(async () => {
    if (await aggiornaSalStrutturato(s, Number(valore || 0), null, true)) return
    const percentuale = Number(valore || 0)

    const maturato =
      (Number(s.importo_previsto || 0) * percentuale) / 100

    const { error } = await vincolaAlCantiere(supabase
      .from('sal_lavorazioni')
      .update({
        percentuale,
        importo_maturato: maturato,
      })
      .eq('id', s.id))

    if (error) throw error
    await caricaSalLavorazioni()
  })}
  onElimina={(id) => osservaOperazioneSal(() => eliminaSalLavorazione(id, cantiereOverride))}
/>
        )
        let riepilogoBase: ReturnType<typeof calcolaStampaSal> | undefined
        let riepilogoStampa: ReturnType<typeof calcolaStampaSal> | undefined
        let erroreStampa = ''
        if (anteprimaSal) {
          try { riepilogoBase = calcolaStampaSal(anteprimaSal.dati, { detrazioneAccontoPercentuale: 0, ivaPercentuale: 0 }); riepilogoStampa = calcolaStampaSal(anteprimaSal.dati, { detrazioneAccontoPercentuale: detrazioneAcconto, ivaPercentuale: ivaStampa }) }
          catch (error) { erroreStampa = error instanceof Error ? error.message : 'Dati non verificabili.' }
        }
        const anteprimaObsoleta = anteprimaSal && (anteprimaSal.dati.cantiere !== salCantiere || anteprimaSal.righe !== salLavorazioni || anteprimaSal.acconti !== accontiCantiere || anteprimaSal.rettifiche !== rettificheSal || !letturaRettificheValida)
        return (
          <>
            <button type="button" style={buttonSecondary}
              disabled={operazioniInCorso > 0 || lavorazioniCantiere.length === 0 || !letturaRettificheValida || gruppiSal.nonVerificabili.length > 0}
              onClick={() => {
                if (operazioniSal.current > 0 || !letturaRettificheValida || !rettificheSal || gruppiSal.nonVerificabili.length > 0) return
                try {
                  const candidati = cantieri.filter(c => contesto.contestuale
                    ? c.id === contesto.cantiereContestuale.id : c.nome === salCantiere)
                  if (candidati.length !== 1) throw new Error('Cantiere non univoco per la stampa SAL.')
                  const cantiere = candidati[0]
                  const basi = preventivi.filter(p => p.id === cantiere.preventivo_contrattuale_id && p.cantiere_id === cantiere.id)
                  if (basi.length !== 1) throw new Error('Preventivo contrattuale non disponibile per la stampa SAL.')
                  if (lavorazioniCantiere.some(s => s.cantiere_id != null && s.cantiere_id !== cantiere.id)) {
                    throw new Error('Le righe SAL non appartengono allo stesso cantiere.')
                  }
                  if (accontiCantiere.some(a => a.cantiere === salCantiere && a.cantiere_id != null && a.cantiere_id !== cantiere.id)) {
                    throw new Error('Gli acconti non appartengono allo stesso cantiere.')
                  }
                  const base = basi[0]
                  const numero = (value: unknown): number => {
                    if ((typeof value !== 'number' && typeof value !== 'string') ||
                        (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value))) {
                      throw new Error('Importi o percentuali SAL non disponibili per la stampa.')
                    }
                    return Number(value)
                  }
                  const dati: DatiStampaSal = {
                    cantiere: salCantiere,
                    committente: typeof base.cliente_ai === 'string' ? base.cliente_ai : undefined,
                    preventivoContrattuale: { nome: base.nome_file || 'Preventivo contrattuale del cantiere', importo: numero(base.importo_totale) },
                    righe: lavorazioniCantiere.map(s => ({ descrizione: String(s.descrizione || ''),
                      importoContrattuale: numero(s.importo_previsto), percentuale: numero(s.percentuale), importoMaturato: numero(s.importo_maturato) })),
                    accontiRicevuti: accontiCantiere.filter(a => a.cantiere === salCantiere)
                      .reduce((totale, a) => totale + numero(a.importo), 0),
                    contratto: { incrementi: rettificheSal.incrementi, riduzioni: rettificheSal.riduzioni,
                      aggiornamenti: rettificheSal.lavori.map(l => ({ data: l.variante.data_variante || null,
                        approvataIl: l.variante.approvata_at || null, variante: l.variante.titolo || 'Senza titolo',
                        descrizione: l.descrizione, tipo: l.operazione === 'eliminazione_residua' ? 'Eliminazione' as const : l.operazione === 'riduzione_residua' ? 'Riduzione' as const : 'Incremento' as const,
                        importo: numero(l.delta_contratto) })) },
                  }
                  setDetrazioneAcconto(''); setIvaStampa('')
                  setAnteprimaSal({ dati, righe: salLavorazioni, acconti: accontiCantiere, rettifiche: rettificheSal })
                } catch (error) {
                  alert(error instanceof Error ? error.message : 'Stampa SAL non disponibile.')
                }
              }}>Stampa SAL</button>
            {anteprimaSal && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 20 }}>
              <section role="dialog" aria-modal="true" aria-labelledby="anteprima-sal-titolo" style={{ background: 'white', color: '#172033', padding: 24, borderRadius: 12, maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                <h2 id="anteprima-sal-titolo">Anteprima SAL</h2>
                <p>{anteprimaSal.dati.cantiere} — stato cumulativo attuale</p>
                <p>Percentuali valide solo per questa stampa. Nessun dato viene salvato.</p>
                <label>A detrarre d’acconto % <input type="number" min="0" max="100" step="any" value={detrazioneAcconto} onChange={e => setDetrazioneAcconto(e.target.value)} /></label>
                <label style={{ display: 'block', marginTop: 12 }}>IVA % <input type="number" min="0" max="100" step="any" value={ivaStampa} onChange={e => setIvaStampa(e.target.value)} /></label>
                <dl>
                  <dt>Contratto originario</dt><dd>{formatMoney(anteprimaSal.dati.preventivoContrattuale.importo)}</dd>
                  <dt>Incrementi approvati</dt><dd>{riepilogoBase ? formatMoney(riepilogoBase.incrementi) : 'Non verificabile'}</dd>
                  <dt>Riduzioni approvate</dt><dd>{riepilogoBase ? formatMoney(riepilogoBase.riduzioni) : 'Non verificabile'}</dd>
                  <dt>Contratto aggiornato</dt><dd>{riepilogoBase ? formatMoney(riepilogoBase.contrattoAggiornato) : 'Non verificabile'}</dd>
                  <dt>Totale righe SAL</dt><dd>{riepilogoBase ? formatMoney(riepilogoBase.totaleRighe) : 'Non verificabile'}</dd>
                  <dt>Totale maturato</dt><dd>{riepilogoBase ? formatMoney(riepilogoBase.totaleMaturato) : 'Non verificabile'}</dd>
                  <dt>Residuo contrattuale aggiornato</dt><dd>{riepilogoBase ? formatMoney(riepilogoBase.residuo) : 'Non verificabile'}</dd>
                  <dt>Acconti ricevuti</dt><dd>{formatMoney(anteprimaSal.dati.accontiRicevuti)}</dd>
                  {riepilogoStampa && <>
                    <dt>A detrarre d’acconto {riepilogoStampa.detrazionePercentuale}%</dt><dd>{formatMoney(riepilogoStampa.detrazioneAcconto)}</dd>
                    <dt>Imponibile</dt><dd>{formatMoney(riepilogoStampa.imponibile)}</dd>
                    <dt>IVA {riepilogoStampa.ivaPercentuale}%</dt><dd>{formatMoney(riepilogoStampa.iva)}</dd>
                    <dt>TOTALE DA RICHIEDERE</dt><dd><strong>{formatMoney(riepilogoStampa.daRichiedere)}</strong></dd>
                  </>}
                </dl>
                {(erroreStampa || anteprimaObsoleta) && <p role="alert">{anteprimaObsoleta ? 'Dati SAL aggiornati: chiudi e riapri l’anteprima.' : erroreStampa}</p>}
                <p>Eventuale saldo/trattenuta finale da liquidare al collaudo secondo gli accordi contrattuali.</p>
                <button type="button" style={buttonPrimary} disabled={!riepilogoStampa || !!anteprimaObsoleta || operazioniInCorso > 0} onClick={() => {
                  if (operazioniSal.current > 0 || !riepilogoStampa || anteprimaObsoleta) return
                  try {
                    const documento = documentoSalCliente(anteprimaSal.dati, { detrazioneAccontoPercentuale: detrazioneAcconto, ivaPercentuale: ivaStampa })
                    const finestra = window.open('', '_blank')
                    if (!finestra) throw new Error('Consenti l’apertura della finestra per stampare il SAL.')
                    finestra.document.open(); finestra.document.write(documento); finestra.document.close()
                    finestra.focus(); finestra.print(); setAnteprimaSal(null)
                  } catch (error) { alert(error instanceof Error ? error.message : 'Stampa SAL non disponibile.') }
                }}>Stampa</button>
                <button type="button" style={buttonSecondary} onClick={() => setAnteprimaSal(null)}>Annulla</button>
              </section>
            </div>}
           <SalSummaryCards
  totalePrevistoSal={totalePrevistoSal}
  totaleMaturatoSal={totaleMaturatoSal}
  totaleAccontiSal={totaleAccontiSal}
  daRichiedereSal={daRichiedereSal}
  statoSal={statoSal}
  percentualeGlobaleSal={percentualeGlobaleSal}
  formatMoney={formatMoney}
/>
 <section aria-label="Riferimenti contrattuali SAL">
   {(() => {
     const basi = preventivi.filter(p => p.id === contrattoSalId && p.cantiere_id === cantiereSalId)
     const base = basi.length === 1 && basi[0].importo_totale != null && String(basi[0].importo_totale).trim() !== '' && Number.isFinite(Number(basi[0].importo_totale)) ? Number(basi[0].importo_totale) : null
     let totali: ReturnType<typeof totaliContrattualiSal> | null = null
     if (base !== null && letturaRettificheValida) {
       try { totali = totaliContrattualiSal(base, rettificheSal!.incrementi, rettificheSal!.riduzioni, totaleMaturatoSal) } catch { /* Nessun valore presunto. */ }
     }
     return <>
       <p>Contratto originario: {base === null ? 'Non verificabile' : formatMoney(base)}</p>
       <p>Incrementi approvati: {letturaRettificheValida ? formatMoney(rettificheSal!.incrementi) : 'Non verificabile'}</p>
       <p>Riduzioni approvate: {letturaRettificheValida ? formatMoney(rettificheSal!.riduzioni) : 'Non verificabile'}</p>
       <p>Contratto aggiornato: {totali ? formatMoney(totali.aggiornato) : 'Non verificabile'}</p>
       <p>Totale storico righe SAL: {formatMoney(totalePrevistoSal)}</p>
       <p>Maturato SAL: {formatMoney(totaleMaturatoSal)}</p>
       <p>Residuo contrattuale aggiornato: {totali ? formatMoney(totali.residuo) : 'Non verificabile'}</p>
     </>
   })()}
   {!letturaRettificheValida && <p role="status">{erroreRettifiche || 'Verifica rettifiche in corso: avanzamento non disponibile.'}</p>}
   <button type="button" style={buttonSecondary} onClick={() => setRiletturaRettifiche(v => v + 1)}>Rileggi rettifiche</button>
 </section>
 <section aria-label="SAL operativo"><h3>SAL operativo</h3>{renderTabellaSal(righeOperative)}</section>
 <AggiornamentiContrattualiSal lavori={letturaRettificheValida ? rettificheSal!.lavori : []} righe={lavorazioniCantiere} verificabile={letturaRettificheValida} formatMoney={formatMoney}
   scomposizione={scomposizioneEconomiaApprovata}
   excelTable={excelTable} excelTh={excelTh} excelTd={excelTd}
   totali={letturaRettificheValida ? { incrementi: rettificheSal!.incrementi, riduzioni: rettificheSal!.riduzioni, delta: rettificheSal!.delta } : undefined} />
 {gruppiSal.nonVerificabili.length > 0 && <aside role="alert"><p>Dati contrattuali non verificabili: nessun avanzamento disponibile.</p><ul>{gruppiSal.nonVerificabili.map(r => <li key={r.id}>
   {r.descrizione} — maturato conservato: {r.importo_maturato != null && String(r.importo_maturato).trim() !== '' && Number.isFinite(Number(r.importo_maturato)) ? formatMoney(Number(r.importo_maturato)) : 'Non verificabile'}
   <label>Completata<input type="checkbox" checked={!!r.completata} disabled readOnly /></label>
   <label>% eseguita<input value={r.percentuale ?? ''} disabled readOnly /></label>
 </li>)}</ul></aside>}
          </>
        )
      })()}
    </>
  )}
</div>
  )
}
