'use client'
import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import VariantePreventivoIntegrativoPanel from './VariantePreventivoIntegrativoPanel'
import RevisionePreventivoAiPanel from './RevisionePreventivoAiPanel'
import { leggiMemoriaPrezziPreventivo } from '../engines/preventivo-generation/memoria-prezzi'
import { leggiStoricoPrezzi } from '../engines/price-resolution/storico-prezzi'
import type { PriceKnowledgeItem } from '../engines/price-resolution/types'
import { totaleManuale, validaManuale, type VoceManuale } from '../engines/preventivo-generation/manuale'

export type DocumentoManuale = { id: string; cliente_ai?: string; cantiere: string; cantiere_id?: string | null; nome_file: string
  data_preventivo: string; descrizione_ai: string; json_voci_ai: VoceManuale[]; origine_ai: false; natura?: string | null; approvato?: boolean }
type Cantiere = { id?: string; nome: string; cliente?: string | null }
type Props = { db: SupabaseClient; cantieri: readonly Cantiere[]; iniziale?: DocumentoManuale; cantiereId?: string
  chiudi: () => void; salvato: () => void | Promise<void>; excel: (documento: DocumentoManuale) => unknown | Promise<unknown> }
export default function PreventivoManualePanel({ db, cantieri, iniziale, cantiereId, chiudi, salvato, excel }: Props) {
  const [tipo, setTipo] = useState<'contrattuale' | 'integrativo'>('contrattuale')
  const [varianti, setVarianti] = useState<{ id: string; titolo: string }[]>([])
  const [variante, setVariante] = useState('')
  const [memoriaRiservata, setMemoriaRiservata] = useState(false)
  const [id] = useState(() => iniziale?.id || crypto.randomUUID())
  const [cliente, setCliente] = useState(iniziale?.cliente_ai || cantieri.find(c => c.id === cantiereId)?.cliente || '')
  const [cantiere, setCantiere] = useState(iniziale?.cantiere_id || cantiereId || '')
  const [titolo, setTitolo] = useState(iniziale?.nome_file || 'Preventivo manuale')
  const [data, setData] = useState(iniziale?.data_preventivo || new Date().toLocaleDateString('sv-SE'))
  const [descrizione, setDescrizione] = useState(iniziale?.descrizione_ai || '')
  const [voci, setVoci] = useState<VoceManuale[]>(iniziale?.json_voci_ai || [])
  const [prezzi, setPrezzi] = useState<PriceKnowledgeItem[]>([]), [memoria, setMemoria] = useState<PriceKnowledgeItem[]>([]), [storico, setStorico] = useState<PriceKnowledgeItem[]>([])
  const [errore, setErrore] = useState(''), [pronto, setPronto] = useState(false), [busy, setBusy] = useState(false)
  const [persistito, setPersistito] = useState(!!iniziale), [incerto, setIncerto] = useState(false)
  const inCorso = useRef(false)
  useEffect(() => {
    let attivo = true
    const pagine = async (tabella: string) => {
      if (tabella === 'memoria_prezzi') {
        const memoria = await leggiMemoriaPrezziPreventivo(db)
        if (attivo) setMemoriaRiservata(!memoria.autorizzata)
        return memoria.righe
      }
      const righe: PriceKnowledgeItem[] = []
      for (let from = 0; ; from += 500) {
        const r = await db.from(tabella).select('*').order(tabella === 'prezzi_lavorazioni' ? 'codice' : 'creato_il').range(from, from + 499)
        if (r.error) throw Error('Riferimenti prezzi non disponibili')
        righe.push(...r.data); if (r.data.length < 500) return righe
      }
    }
    void Promise.all([pagine('prezzi_lavorazioni'), pagine('memoria_prezzi'), leggiStoricoPrezzi(db)]).then(([p, m, s]) => {
      if (attivo) { setPrezzi(p); setMemoria(m); setStorico(s); setPronto(true) }
    }).catch(() => { if (attivo) setErrore('Riferimenti prezzi non disponibili; chiudi e riprova prima di compilare.') })
    return () => { attivo = false }
  }, [db])
  useEffect(() => {
    const proteggi = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', proteggi); return () => window.removeEventListener('beforeunload', proteggi)
  }, [])
  useEffect(() => {
    let attivo = true
    if (tipo !== 'integrativo' || !cantiere) return
    void db.from('varianti_cantiere').select('id,titolo').eq('cantiere_id', cantiere).eq('stato', 'bozza').order('id').then(r => {
      if (attivo) { if (r.error) setErrore('Varianti non disponibili'); else setVarianti(r.data || []) }
    })
    return () => { attivo = false }
  }, [db, cantiere, tipo])
  function documento(): DocumentoManuale {
    return { id, cliente_ai: cliente.trim(), cantiere_id: cantiere || null,
      cantiere: cantieri.find(c => c.id === cantiere)?.nome || cliente.trim(), nome_file: titolo.trim(),
      data_preventivo: data, descrizione_ai: descrizione, json_voci_ai: voci, origine_ai: false }
  }
  async function salva() {
    if (inCorso.current || incerto) return
    try { validaManuale(voci); if (!cliente.trim() || !titolo.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(data)) throw Error('Completa Cliente, Titolo e Data') }
    catch (e) { setErrore(e instanceof Error ? e.message : 'Dati incompleti'); return }
    inCorso.current = true; setBusy(true); setErrore('')
    try {
      const record = { ...documento(), note: descrizione, importo_totale: totaleManuale(voci), stato_preventivo: 'revisionato' }
      const r = persistito ? await db.from('preventivi_cantiere').update(record).eq('id', id).eq('origine_ai', false).select('id').single()
        : await db.from('preventivi_cantiere').insert({ ...record, approvato: false }).select('id').single()
      if (r.error || r.data?.id !== id) throw Error('Salvataggio non confermato. Verifica il Registro prima di ulteriori azioni; nessun retry automatico.')
      setPersistito(true); await salvato(); setErrore('Preventivo manuale salvato nel Registro')
    } catch (e) { setIncerto(true); setErrore(e instanceof Error ? e.message : 'Salvataggio non confermato') }
    finally { inCorso.current = false; setBusy(false) }
  }
  return <section aria-label="Nuovo preventivo manuale">
    <h3>{iniziale ? 'Modifica preventivo manuale' : 'Nuovo preventivo manuale'}</h3>
    <fieldset disabled={busy || incerto}>
      <label>Cliente <input value={cliente} onChange={e => setCliente(e.target.value)} /></label>
      <label>Cantiere <select value={cantiere} onChange={e => { if (variante && !window.confirm("Cambiare Cantiere e chiudere la revisione Integrativo non salvata?")) return; setCantiere(e.target.value); setVariante(''); setVarianti([]); const c = cantieri.find(c => c.id === e.target.value); if (c?.cliente) setCliente(c.cliente) }}><option value="">Non ancora assegnato</option>{cantieri.filter(c => c.id).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      <label>Titolo <input value={titolo} onChange={e => setTitolo(e.target.value)} /></label>
      <label>Data <input type="date" value={data} onChange={e => setData(e.target.value)} /></label>
      <label>Tipo <select disabled={!!iniziale || voci.length > 0} value={tipo} onChange={e => setTipo(e.target.value as 'contrattuale' | 'integrativo')}><option value="contrattuale">Contrattuale</option><option value="integrativo">Integrativo</option></select></label>
      {tipo === 'integrativo' && <div><p>Seleziona la Variante bozza: contratto, genealogia e residui vengono riletti dal percorso Step 5. Cliente, titolo e data sono confermati nella revisione Integrativo.</p>
        <label>Variante <select value={variante} onChange={e => { if (!variante || window.confirm("Cambiare Variante e scartare la revisione non salvata?")) setVariante(e.target.value) }}><option value="">Seleziona una Variante bozza</option>{varianti.map(v => <option key={v.id} value={v.id}>{v.titolo}</option>)}</select></label>
        {variante && <VariantePreventivoIntegrativoPanel key={variante} supabase={db} soloManuale metadatiManuali={{ cliente, titolo, data }} varianteId={variante} onSalvato={() => { void salvato() }} />}
        <button type="button" onClick={() => { if (window.confirm('Chiudere il preventivo?')) chiudi() }}>Chiudi</button>
      </div>}
      {memoriaRiservata && <p role="status">Memoria prezzi riservata al titolare autorizzato. Restano disponibili prezzario e voci libere.</p>}
      {errore && <p role="status">{errore}</p>}
      {!pronto && <p>Caricamento riferimenti prezzi…</p>}
      {pronto && tipo === 'contrattuale' && <RevisionePreventivoAiPanel manuale confermaInCorso={busy || incerto} messaggioAi="Origine: manuale" descrizionePreventivoAi={descrizione} setDescrizionePreventivoAi={setDescrizione}
        vociPreventivoAi={voci} setVociPreventivoAi={setVoci} vociPreventivoAiOriginali={iniziale?.json_voci_ai || []}
        prezziRiferimento={prezzi} memoriaRiferimento={memoria} storicoRiferimento={storico} calcolaMediaPrezziSimili={() => null} verificaPrezzoAnomalo={() => ''}
        formatMoney={v => Number(v).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} miglioraVocePreventivoAi={() => {}} salvaInMemoriaPrezzi={() => {}}
        salvaRevisionePreventivoAi={salva} generaExcelDefinitivoPreventivoAi={async () => { try { validaManuale(voci); await excel(documento()) } catch (e) { setErrore(e instanceof Error ? e.message : 'Excel non generato') } }}
        preventivoRegistroCantiere={documento().cantiere} setMostraRevisionePreventivoAi={v => { if (!v && window.confirm('Chiudere il preventivo? Le modifiche non salvate saranno perse.')) chiudi() }}
        excelTable={{ borderCollapse: 'collapse' }} excelTh={{ padding: 8 }} excelTd={{ padding: 8 }} buttonPrimary={{ padding: 8 }} buttonSecondary={{ padding: 8 }} />}
    </fieldset>
    {!pronto && <button type="button" onClick={chiudi}>Chiudi</button>}
  </section>
}
