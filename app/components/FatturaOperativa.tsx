'use client'

import { useEffect, useRef, useState } from 'react'
import { unitaOriginaliXml } from '../engines/fatture/unitaOriginaliXml'
import { supabase } from '../../lib/supabaseClient'
import type { DocumentoOperativo } from './InviaMaterialiFatturaEconomia'
import { assegnaMaterialiImpresa, assegnaMaterialiCantiere, inviaMaterialiFattura, leggiContestoMateriali, leggiRaccolteMateriali, leggiStatoFattura, verificaRigheMateriali, motivoNonSelezionabile, motivoNonTrasferibile, motivoQuantita, unitaEconomiaValida, uuidFattura, statoRigaMateriale, etichettaStatoFattura, valoriEconomiaFattura, messaggioAssegnazione, type ContestoMateriali, type DestinazioneMateriale, type RaccoltaMateriali, type RigaMaterialeFattura, type DisponibilitaMateriale, type StatoFattura } from '../engines/economia/fattureMateriali'

type Config = { destinazione: DestinazioneMateriale; cantiere: string; raccolta: string; categoria: 'attrezzo_ditta' | 'magazzino'; integra: boolean }
const initial: Config = { destinazione: 'economia', cantiere: '', raccolta: '', categoria: 'attrezzo_ditta', integra: false }
const key = (c: Config) => [c.destinazione, c.destinazione === 'impresa' ? '' : c.cantiere, c.destinazione === 'economia' ? c.raccolta : ''].join('|')
const complete = (c: Config) => c.destinazione === 'impresa' || (uuidFattura(c.cantiere) && (c.destinazione !== 'economia' || uuidFattura(c.raccolta)))
const signature = (d: DocumentoOperativo) => JSON.stringify(d.righe.map(r => [r.id, r.categoria_economica || null, r.cantiere || null]).sort((a,b) => String(a[0]).localeCompare(String(b[0]))))
const savedSelection = (previous: string | null, d: DocumentoOperativo, ids: string[]) => {
  const rows = new Map<string, unknown[]>(JSON.parse(previous || '[]').map((r: unknown[]) => [String(r[0]), r]))
  for (const r of d.righe) if (r.id && ids.includes(r.id)) rows.set(r.id, [r.id, r.categoria_economica || null, r.cantiere || null])
  return JSON.stringify([...rows.values()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]))))
}
function historicalRowIds(error: unknown): string[] {
  if (!error || typeof error !== 'object') return []
  const value = error as Record<string, unknown>
  const rpc = value.diagnosticaRpc && typeof value.diagnosticaRpc === 'object' ? value.diagnosticaRpc as Record<string, unknown> : value
  if (rpc.code !== '23514' || typeof rpc.message !== 'string' || !/cost[oi] storic[oi]/i.test(rpc.message) || typeof rpc.details !== 'string') return []
  return [...new Set(Array.from(rpc.details.matchAll(/\briga_fattura_id\s*=\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?![0-9a-f-])/gi), m=>m[1].toLowerCase()))]
}
const historicalMessage = 'Questa voce risulta già contabilizzata nel vecchio sistema.'
const historicalAction = 'Deseleziona la riga per continuare con le altre oppure riconciliala separatamente.'
const quantitative = (c: string | null | undefined) => ['materiale_cantiere', 'attrezzo_ditta', 'magazzino'].includes(c || '')
const num = (v: unknown) => v == null || v === '' ? '—' : String(v).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '').replace('.', ',')
const euro = (v: unknown) => v == null || v === '' ? '—' : Number(v).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
const categoryFor = (c: Config) => c.destinazione === 'impresa' ? c.categoria : 'materiale_cantiere'
const cell = { padding: 6, border: '1px solid #cbd5e1', verticalAlign: 'top' as const }
const standardUnits = ['PZ', 'CAD', 'NR', 'KG', 'ML', 'MT', 'MQ', 'MC']
const unitOptions = (...values: (string | null | undefined)[]) => [...new Set([...standardUnits, ...values.filter((value): value is string => typeof value === 'string' && !!unitaEconomiaValida(value))])]
const input = { border: '1px solid #cbd5e1', borderRadius: 4, padding: 5, maxWidth: '100%' }
type StepState = 'attesa' | 'corso' | 'completato' | 'errore'
const stepNames = ['Validazione', 'Salvataggio classificazione', 'Rilettura dati', 'Assegnazione', 'Aggiornamento stato']

type Props = { fatturaId: string; cantieri: { id?: string; nome?: string }[]; documento: DocumentoOperativo; onAggiornamentoFattura?: () => void | Promise<void>; onDisponibilita?: (v: { fatturaId: string; righe: Record<string, DisponibilitaMateriale> }) => void }
export default function FatturaOperativa({ fatturaId, cantieri, documento, onAggiornamentoFattura, onDisponibilita }: Props) {
  const [righe, setRighe] = useState<RigaMaterialeFattura[]>([]), [configs, setConfigs] = useState<Record<string, Config>>({})
  const [defaultConfig, setDefaultConfig] = useState<Config>(initial), [unitaDefault, setUnitaDefault] = useState('')
  const [unita, setUnita] = useState<Record<string,string>>({}), [quantita, setQuantita] = useState<Record<string,string>>({}), [selected, setSelected] = useState<string[]>([])
  const [globalContext, setGlobalContext] = useState<ContestoMateriali | null>(null), [contexts, setContexts] = useState<Record<string,ContestoMateriali>>({}), [raccolte, setRaccolte] = useState<Record<string,RaccoltaMateriali[]>>({})
  const [stato, setStato] = useState<StatoFattura | null>(null), [confirmed, setConfirmed] = useState<string | null>(null), [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [timeline, setTimeline] = useState<StepState[]>([])
  const [serverBlocks, setServerBlocks] = useState<Record<string,{fingerprint:string;message:string;storico?:boolean}>>({})
  const rowElements = useRef<Record<string, HTMLTableRowElement | null>>({})
  function step(index: number, state: StepState) { setTimeline(old => old.map((v,i) => i === index ? state : v)) }
  function clearBlocks(ids: string[]) { setServerBlocks(old=>Object.fromEntries(Object.entries(old).filter(([id,b])=>b.storico||!ids.includes(id)))) }
  function markHistorical(error: unknown) {
    const ids=historicalRowIds(error).filter(id=>righe.some(r=>r.id?.toLowerCase()===id))
    if(ids.length)setServerBlocks(old=>({...old,...Object.fromEntries(ids.map(id=>{const visibleId=righe.find(r=>r.id?.toLowerCase()===id)!.id!;return [visibleId,{fingerprint:'',message:'Costo storico già presente',storico:true}]}))}))
    return ids.length>0
  }
  function showRow(id: string) { rowElements.current[id]?.scrollIntoView({block:'nearest',behavior:'smooth'}) }
  const lock = useRef(false), active = useRef(true), epoch = useRef(0), manualUnits = useRef(new Set<string>()), requests = useRef<Record<string,{signature:string; id:string}>>({})
  const callbacks = useRef({ onAggiornamentoFattura, onDisponibilita }); callbacks.current = { onAggiornamentoFattura, onDisponibilita }
  const cat = (id: string) => documento.righe.find(r => r.id === id)?.categoria_economica
  const cfg = (id: string): Config => configs[id] || { ...initial, destinazione: ['attrezzo_ditta','magazzino'].includes(cat(id) || '') ? 'impresa' : 'economia', categoria: cat(id) === 'magazzino' ? 'magazzino' : 'attrezzo_ditta' }
  const dirty = saved !== null && saved !== signature(documento)
  function acceptContext(v: ContestoMateriali, rows: RigaMaterialeFattura[]) {
    verificaRigheMateriali(rows,v); setGlobalContext(v); setStato(v.statoFattura)
    callbacks.current.onDisponibilita?.({fatturaId,righe:v.disponibilita})
    setQuantita(old => Object.fromEntries(rows.filter(r=>r.id).map(r=>[r.id!,old[r.id!] ?? v.disponibilita[r.id!].quantita_residua])))
    setUnita(old => { const next={...old}; for(const r of rows) { if(!r.id || manualUnits.current.has(r.id))continue; const h=v.storico[r.id]?.assegnazioni.slice().sort((a,b)=>b.data.localeCompare(a.data))[0]; if(h?.unita_misura)next[r.id]=h.unita_misura; else if(!(r.id in next))next[r.id]=r.unita_misura || '' } return next })
  }
  useEffect(() => {
    active.current=true; const version=++epoch.current; manualUnits.current.clear(); requests.current={}; setTimeline([]); setServerBlocks({}); setConfigs({}); setContexts({}); setRaccolte({}); setSelected([]); setUnita({}); setQuantita({}); setGlobalContext(null); setConfirmed(null); setSaved(null); setError(''); setMessage(''); setLoading(true)
    void (async()=>{try {
      const [{data,error:readError},s,{data:header,error:headerError}]=await Promise.all([supabase.from('fatture_fornitori_righe').select('id,fattura_id,descrizione,quantita,numero_riga,unita_misura,prezzo_unitario,totale_riga,categoria_economica,cantiere').eq('fattura_id',fatturaId).order('numero_riga'),leggiStatoFattura(supabase,fatturaId),supabase.from('fatture_fornitori').select('id,xml_testo').eq('id',fatturaId).single()])
      if(readError || headerError || !header || header.id!==fatturaId || !Array.isArray(data))throw Error('Impossibile leggere le righe fattura')
      const originalUnits=unitaOriginaliXml(typeof header.xml_testo==='string'?header.xml_testo:'');for(const r of data)if(!r.unita_misura?.trim()&&Number.isSafeInteger(r.numero_riga))r.unita_misura=originalUnits[r.numero_riga]||''
      let v: ContestoMateriali | null=null, lastError:unknown
      // A reader context only authorizes the read; it never assigns a destination to a row.
      for(const c of [{...initial,destinazione:'impresa' as const},...cantieri.filter(c=>uuidFattura(c.id)).map(c=>({...initial,destinazione:'cantiere' as const,cantiere:c.id!}))]) {
        try {v=await leggiContestoMateriali(supabase,fatturaId,c.cantiere,c.destinazione,c.raccolta);break}catch(e){lastError=e}
      }
      if(!v)throw lastError || Error('Disponibilità non verificabile')
      if(!active.current||epoch.current!==version)return
      setRighe(data);setStato(s);setSaved(JSON.stringify(data.map(r=>[r.id,r.categoria_economica||null,r.cantiere||null]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))));acceptContext(v,data)
    }catch(e){if(active.current&&epoch.current===version)setError(messaggioAssegnazione(e))}finally{if(active.current&&epoch.current===version)setLoading(false)}})()
    return()=>{active.current=false;epoch.current++}
  },[fatturaId])
  async function prepareReference(c: Config) {
    const version=epoch.current
    try {
      if(c.destinazione==='economia' && uuidFattura(c.cantiere) && !raccolte[c.cantiere]) {const list=await leggiRaccolteMateriali(supabase,c.cantiere);if(active.current&&epoch.current===version)setRaccolte(old=>({...old,[c.cantiere]:list}))}
      if(complete(c)){const v=await leggiContestoMateriali(supabase,fatturaId,c.cantiere,c.destinazione,c.raccolta);if(active.current&&epoch.current===version){verificaRigheMateriali(righe,v);setContexts(old=>({...old,[key(c)]:v}));acceptContext(v,righe)}}
    }catch(e){if(active.current&&epoch.current===version)setError(messaggioAssegnazione(e))}
  }
  function changeDefault(patch:Partial<Config>) {if(lock.current)return;const next={...defaultConfig,...patch,integra:false};if(patch.cantiere!==undefined||patch.destinazione!==undefined)next.raccolta='';setDefaultConfig(next);setConfirmed(null);void prepareReference(next)}
  function changeRow(id:string,patch:Partial<Config>,changeCategory=false) {if(lock.current)return;clearBlocks([id]);const next={...cfg(id),...patch};if(patch.destinazione!==undefined||patch.cantiere!==undefined) {next.raccolta='';next.integra=false}setConfigs(old=>({...old,[id]:next}));if(changeCategory&&cat(id)!==categoryFor(next))documento.onCategoria(id,categoryFor(next));setConfirmed(null);void prepareReference(next)}
  function selectable(r:RigaMaterialeFattura) {const d=globalContext?.disponibilita[r.id||''];return !!r.id&&!motivoNonSelezionabile(r)&&(!cat(r.id)||quantitative(cat(r.id)))&&!contexts[key(cfg(r.id))]?.presenti.includes(r.id)&&!!d&&Number(d.quantita_residua)>0}
  function applyAll() {if(lock.current||!complete(defaultConfig))return;clearBlocks(selected);setConfigs(old=>{const next={...old};for(const id of selected)next[id]={...defaultConfig,integra:false};return next});for(const id of selected)if(cat(id)!==categoryFor(defaultConfig))documento.onCategoria(id,categoryFor(defaultConfig));setConfirmed(null)}
  function applyUnits() {const value=unitaDefault.trim();if(lock.current||!unitaEconomiaValida(value))return;clearBlocks(selected);setUnita(old=>{const next={...old};for(const id of selected){next[id]=value;manualUnits.current.add(id)}return next});setConfirmed(null)}
  const reason=(r:RigaMaterialeFattura)=>{const id=r.id||'',c=cfg(id),v=contexts[key(c)],d=globalContext?.disponibilita[id];return !cat(id)?'Categoria mancante':!quantitative(cat(id))?null:cat(id)!==categoryFor(c)?'Categoria e destinazione non coerenti':!complete(c)?'Completa destinazione e riferimento':!unitaEconomiaValida(unita[id]||'')?'U.M. mancante o non valida':motivoQuantita(d,quantita[id])||motivoNonTrasferibile(r,unita[id]||'')||(v?.presenti.includes(id)?'Già presente nella raccolta':null)||(v?.statoRaccolta==='chiusa'&&!c.integra?'Conferma integrazione raccolta chiusa':null)}
  const fingerprint=(id:string)=>JSON.stringify([cfg(id),cat(id),unita[id],quantita[id]])
  const blockers=selected.flatMap(id=>{const i=righe.findIndex(r=>r.id===id),r=righe[i],motivo=r?reason(r):'Riga non disponibile';return motivo?[{id,numero:i+1,motivo}]:[]})
  const historicalBlocks=Object.entries(serverBlocks).filter(([id,b])=>b.storico&&selected.includes(id)).map(([id,b])=>({id,numero:righe.findIndex(r=>r.id===id)+1,motivo:b.message}))
  const visibleBlocks=[...historicalBlocks,...blockers.filter(b=>!historicalBlocks.some(h=>h.id===b.id)),...Object.entries(serverBlocks).filter(([id,b])=>!b.storico&&!blockers.some(x=>x.id===id)).map(([id,b])=>({id,numero:righe.findIndex(r=>r.id===id)+1,motivo:b.message}))].sort((a,b)=>a.numero-b.numero)
  const latestBlockers=useRef(blockers);latestBlockers.current=blockers
  const firstBlock=visibleBlocks[0]?.id
  useEffect(()=>{if(!firstBlock)return;const tag=typeof document==='undefined'?'':document.activeElement?.tagName;if(!['INPUT','SELECT','TEXTAREA'].includes(tag||''))showRow(firstBlock)},[firstBlock])
  const validSelection=!loading&&!busy&&selected.length>0&&historicalBlocks.length===0&&selected.every(id=>{const r=righe.find(r=>r.id===id);return r&&!reason(r)})
  const canAssign=validSelection&&!dirty
  const selectionSignature=JSON.stringify(selected.map(id=>[id,cfg(id),unita[id],quantita[id],cat(id)]))
  async function save() {if(lock.current)return;lock.current=true;setBusy(true);setError('');setConfirmed(null);const sig=signature(documento),version=epoch.current;try{await documento.onSalva();if(active.current&&epoch.current===version){setSaved(sig);setMessage('Classificazione salvata.')}}catch(e){if(active.current&&epoch.current===version){if(markHistorical(e))setMessage(historicalMessage+'\n'+historicalAction);setError(messaggioAssegnazione(e))}}finally{lock.current=false;if(active.current&&epoch.current===version)setBusy(false)}}
  async function assign(saveFirst=false) {
    if(lock.current||!(saveFirst?validSelection:canAssign)||(!saveFirst&&confirmed!==selectionSignature))return
    lock.current=true;setBusy(true);setConfirmed(null);setError('');setMessage('');setServerBlocks(old=>Object.fromEntries(Object.entries(old).filter(([,b])=>b.storico)));if(saveFirst)setTimeline(['corso','attesa','attesa','attesa','attesa']);let success=0,originalError:unknown;const version=epoch.current,documentIds=[...selected],ids=selected.filter(id=>quantitative(cat(id)))
    if(saveFirst){
      await Promise.resolve();step(0,'completato');step(1,'corso')
      const documentSignature=savedSelection(saved,documento,documentIds)
      try{
        await documento.onSalva(documentIds)
        if(!active.current||epoch.current!==version){lock.current=false;return}
        setSaved(documentSignature)
        step(1,'completato');step(2,'corso')
        await Promise.resolve()
        if(latestBlockers.current.length){step(2,'completato');step(3,'errore');setMessage('Classificazione salvata.\nCompleta le righe evidenziate in rosso per terminare l’assegnazione.');setBusy(false);lock.current=false;return}
      }catch(e){
        if(active.current&&epoch.current===version){
          const historical=markHistorical(e)
          const documentSaved=e instanceof Error && 'classificazioneSalvata' in e && e.classificazioneSalvata===true
          if(documentSaved)setSaved(documentSignature)
          step(1,documentSaved?'completato':'errore');if(documentSaved)step(2,'errore')
          setError(messaggioAssegnazione(e));setMessage(historical?historicalMessage+'\n'+historicalAction:documentSaved?'Classificazione salvata.\nAssegnazione non completata.':'Salvataggio documentale non completato: nessuna assegnazione avviata.');setBusy(false)
        }
        lock.current=false;return
      }
    }
    let phase=2, currentId=''
    try {for(const id of ids){currentId=id;const c=cfg(id);phase=2;const v=await leggiContestoMateriali(supabase,fatturaId,c.cantiere,c.destinazione,c.raccolta);verificaRigheMateriali(righe,v);if(!active.current||epoch.current!==version)return
      const r=righe.find(r=>r.id===id)!,d=v.disponibilita[id]
      if(v.presenti.includes(id)||motivoQuantita(d,quantita[id])||motivoNonTrasferibile(r,unita[id]||''))throw Error('Disponibilità cambiata: controlla i residui e conferma nuovamente.')
      if(saveFirst){step(2,'completato');step(3,'corso')}phase=3
      if(c.destinazione==='economia') {if(v.revisione===null||v.statoRaccolta===null)throw Error('Revisione raccolta non verificabile');if(v.statoRaccolta==='chiusa'&&!c.integra)throw Error('Conferma integrazione raccolta chiusa');const result=await inviaMaterialiFattura(supabase,c.raccolta,v.revisione,[id],unita,quantita,v.statoRaccolta==='chiusa'&&c.integra);if(result.esiti.some(e=>e.stato==='errore'))throw Error(result.esiti.map(e=>e.motivo).join('; '));}
      else if(c.destinazione==='cantiere')await assegnaMaterialiCantiere(supabase,c.cantiere,[id],unita,quantita)
      else {const sig=JSON.stringify([fatturaId,id,quantita[id],unitaEconomiaValida(unita[id]),c.categoria]);if(requests.current[id]?.signature!==sig)requests.current[id]={signature:sig,id:crypto.randomUUID()};await assegnaMaterialiImpresa(supabase,[id],unita,quantita,{[id]:requests.current[id].id},{[id]:c.categoria});delete requests.current[id]}
      success++
    }if(saveFirst){step(2,'completato');step(3,'completato');step(4,'corso')}}catch(e){originalError=e;if(currentId)setServerBlocks(old=>({...old,[currentId]:{fingerprint:fingerprint(currentId),message:messaggioAssegnazione(e)}}));if(saveFirst)step(phase,'errore')}
    finally {
      if(active.current&&epoch.current===version){setSelected([]);setMessage(saveFirst ? (originalError ? `Classificazione salvata.\nAssegnazione non completata.\n${success} di ${ids.length} righe completate · nessun retry automatico` : 'Classificazione salvata. Aggiornamento stato in corso…') : `${success} di ${ids.length} righe completate${originalError?' · operazione interrotta, nessun retry automatico':''}`)
        try{for(const c of [...new Map(ids.map(id=>[key(cfg(id)),cfg(id)])).values()]){const v=await leggiContestoMateriali(supabase,fatturaId,c.cantiere,c.destinazione,c.raccolta);if(!active.current||epoch.current!==version)return;setContexts(old=>({...old,[key(c)]:v}));acceptContext(v,righe);setQuantita(old=>({...old,...Object.fromEntries(ids.map(id=>[id,v.disponibilita[id].quantita_residua]))}))}await callbacks.current.onAggiornamentoFattura?.();if(saveFirst&&!originalError){step(4,'completato');setMessage('Classificazione e assegnazione completate.')}}catch(e){if(saveFirst){step(4,'errore');setMessage('Classificazione salvata.\nAssegnazione '+(originalError?'non completata.':'completata, ma aggiornamento stato non verificato.'))}setError(originalError?`${messaggioAssegnazione(originalError)}\nRilettura server: ${messaggioAssegnazione(e)}`:messaggioAssegnazione(e))}
        if(originalError)setError(old=>old||messaggioAssegnazione(originalError));if(active.current&&epoch.current===version)setBusy(false)
      }lock.current=false
    }
  }
  function references(c:Config,change:(p:Partial<Config>)=>void,label:string) {return c.destinazione==='impresa'?<label>Categoria impresa <select aria-label={`Categoria impresa ${label}`} style={input} value={c.categoria} disabled={busy} onChange={e=>change({categoria:e.target.value as Config['categoria']})}><option value="attrezzo_ditta">Attrezzatura</option><option value="magazzino">Magazzino</option></select></label>:<><label>Cantiere <select aria-label={`Cantiere ${label}`} style={input} value={c.cantiere} disabled={busy} onChange={e=>change({cantiere:e.target.value})}><option value="">Scegli cantiere</option>{cantieri.filter(c=>uuidFattura(c.id)).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>{c.destinazione==='economia'&&<label>Raccolta Economia <select aria-label={`Raccolta ${label}`} style={input} value={c.raccolta} disabled={busy||!c.cantiere} onChange={e=>change({raccolta:e.target.value})}><option value="">Scegli raccolta</option>{(raccolte[c.cantiere]||[]).map(r=><option key={r.id} value={r.id}>{r.titolo} — {r.stato}</option>)}</select></label>}</>}
  function destination(c:Config,change:(p:Partial<Config>)=>void,label:string) {return <select style={input} aria-label={`Destinazione ${label}`} value={c.destinazione} disabled={busy} onChange={e=>change({destinazione:e.target.value as DestinazioneMateriale})}><option value="economia">Lavori in economia</option><option value="cantiere">Cantiere</option><option value="impresa">Generale impresa</option></select>}
  return <section aria-label="Classificazione e assegnazione fattura" style={{border:'1px solid #cbd5e1',borderRadius:8,overflow:'hidden'}}>
    <div role="toolbar" aria-label="Compilazione fattura" style={{display:'flex',flexWrap:'wrap',gap:8,padding:10,alignItems:'center',background:'#f8fafc'}}>
      <button disabled={busy||loading} onClick={()=>{if(!lock.current){setSelected(righe.filter(selectable).map(r=>r.id!));setConfirmed(null)}}}>Seleziona tutte</button><button disabled={busy||!selected.length} onClick={()=>{if(!lock.current){setSelected([]);setConfirmed(null)}}}>Deseleziona tutte</button>
      <label>Override U.M. selezionate <select aria-label="Override U.M. selezionate" style={{...input,minWidth:100}} disabled={busy} value={unitaDefault} onChange={e=>{if(!lock.current)setUnitaDefault(e.target.value)}}><option value="">Scegli U.M.</option>{unitOptions(unitaDefault,...Object.values(unita),...righe.map(r=>r.unita_misura)).map(value=><option key={value} value={value}>{value}</option>)}</select></label><button disabled={busy||!selected.length||!unitaEconomiaValida(unitaDefault)} onClick={applyUnits}>Applica U.M.</button>
      <label>Destinazione predefinita {destination(defaultConfig,changeDefault,'predefinita')}</label>{references(defaultConfig,changeDefault,'predefinito')}<button disabled={busy||!selected.length||!complete(defaultConfig)} onClick={applyAll}>Applica a tutte</button>
      <button disabled={!validSelection} style={{background:'#1d4ed8',color:'#fff',border:0,borderRadius:5,padding:'8px 12px',fontWeight:600}} onClick={()=>assign(true)}>{busy?'Operazione in corso…':'Salva e assegna selezionate'}</button><button disabled={busy||loading} onClick={save}>Salva classificazione</button><button disabled={!canAssign} onClick={()=>{if(!lock.current)setConfirmed(selectionSignature)}}>Assegna selezionate</button>
    </div>
    <div style={{padding:8,fontSize:13}}>{selected.length} righe selezionate · Stato fattura: <strong>{etichettaStatoFattura(stato)}</strong>{dirty&&<p>Classificazione modificata: salva prima di assegnare.</p>}{visibleBlocks.length>0&&<div role="alert" style={{background:'#fef2f2',border:'1px solid #ef4444',padding:8}}>{historicalBlocks.length>0&&<p><strong>{historicalBlocks.length} {historicalBlocks.length===1?'riga bloccata':'righe bloccate'} da costo storico</strong></p>}<strong>Impossibile completare l’assegnazione: {visibleBlocks.length} righe richiedono attenzione.</strong><ul aria-label="Righe incomplete">{visibleBlocks.map(b=><li key={b.id}><button type="button" onClick={()=>showRow(b.id)}>Riga {b.numero} — {righe.find(r=>r.id===b.id)?.descrizione}: {b.motivo}</button></li>)}</ul></div>}{loading&&<p>Caricamento...</p>}</div>
    {timeline.length>0&&<ol aria-label="Avanzamento salvataggio e assegnazione" aria-live="polite" style={{display:'flex',flexWrap:'wrap',gap:16,padding:'10px 28px',margin:0}}>{timeline.map((state,i)=><li key={stepNames[i]} data-state={state} aria-current={state==='corso'?'step':undefined} style={{color:state==='errore'?'#b91c1c':state==='completato'?'#166534':'#334155'}}>{state==='completato'?'✓':state==='errore'?'✕':state==='corso'?'◉':'○'} {stepNames[i]} — {state==='corso'?'In corso…':state==='completato'?'Completato':state==='errore'?'Operazione bloccata':'In attesa'}</li>)}</ol>}
    {(error||message)&&<div role={error?'alert':'status'} style={{padding:8,whiteSpace:'pre-wrap',background:error?'#fef2f2':'#eff6ff'}}>{message}{error&&`\n${error}`}</div>}
    <div role="region" aria-label="Tabella operativa fattura" style={{overflowX:'auto'}} tabIndex={0}><table style={{borderCollapse:'collapse',width:'100%',fontSize:13}}><thead><tr>{['Selezione','Descrizione','Q.tà fattura','Già assegnata','Residuo','U.M.','Categoria','Destinazione','Riferimento','Q.tà da assegnare','Prezzo','Totale','Stato / storico'].map(t=><th scope="col" key={t} style={cell}>{t}</th>)}</tr></thead><tbody>
    {righe.map((r,i)=>{const id=r.id||'',c=cfg(id),v=contexts[key(c)],d=globalContext?.disponibilita[id],h=v?.storico[id]?.assegnazioni||globalContext?.storico[id]?.assegnazioni||[],values=valoriEconomiaFattura(r,quantita[id]),block=visibleBlocks.find(b=>b.id===id);return <tr ref={node=>{rowElements.current[id]=node}} key={id||i} aria-label={block?`Riga ${i+1} da completare`:undefined} style={{outline:block?'2px solid #ef4444':undefined,outlineOffset:-2,background:block?'#fef2f2':selected.includes(id)?'#eff6ff':i%2?'#f8fafc':'white'}}>
      <td style={cell}><input type="checkbox" aria-label={`Seleziona riga ${i+1}`} checked={selected.includes(id)} disabled={busy||!selectable(r)} onChange={()=>{if(!lock.current){setSelected(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);setConfirmed(null)}}}/></td><td style={{...cell,minWidth:200,overflowWrap:'anywhere'}}>{r.descrizione}{block&&<strong style={{display:'block',color:'#b91c1c',whiteSpace:'pre-wrap'}}>⚠ {block.motivo}</strong>}{block&&serverBlocks[id]?.storico&&<small style={{display:'block',color:'#991b1b'}}>Questa riga non può essere assegnata automaticamente. Deselezionala oppure esegui una riconciliazione.</small>}</td><td style={cell}>{num(r.quantita)}</td><td style={cell}>{num(d?.quantita_assegnata)}</td><td style={cell}>{num(d?.quantita_residua)}</td>
      <td style={cell}><select aria-label={`U.M. riga ${i+1}`} style={{...input,minWidth:100}} value={unita[id]||''} disabled={busy||!selectable(r)} onChange={e=>{if(!lock.current){clearBlocks([id]);manualUnits.current.add(id);setUnita(old=>({...old,[id]:e.target.value}));setConfirmed(null)}}}><option value="">Scegli U.M.</option>{unitOptions(unita[id],r.unita_misura).map(value=><option key={value} value={value}>{value}</option>)}</select><small style={{display:'block'}}>Fattura: {r.unita_misura||'—'}</small></td>
      <td style={cell}><select aria-label={`Categoria riga ${i+1}`} style={input} value={cat(id)||''} disabled={busy} onChange={e=>{if(lock.current)return;clearBlocks([id]);documento.onCategoria(id,e.target.value);setConfirmed(null);if(['attrezzo_ditta','magazzino'].includes(e.target.value))changeRow(id,{destinazione:'impresa',categoria:e.target.value as Config['categoria']});else if(e.target.value==='materiale_cantiere'&&c.destinazione==='impresa')changeRow(id,{destinazione:'economia'})}}><option value="">Da classificare</option><option value="materiale_cantiere">Materiale cantiere</option><option value="attrezzo_ditta">Attrezzatura</option><option value="magazzino">Magazzino</option><option value="spesa_generale">Spesa generale</option><option value="storno_escluso">Storno / esclusione</option></select></td>
      <td style={cell}>{quantitative(cat(id))?destination(c,p=>changeRow(id,p,true),`riga ${i+1}`):'Solo documento'}</td><td style={{...cell,minWidth:170}}>{quantitative(cat(id))?references(c,p=>changeRow(id,p,true),`riga ${i+1}`):<select aria-label={`Riferimento documento riga ${i+1}`} style={input} value={documento.righe.find(r=>r.id===id)?.cantiere||''} disabled={busy} onChange={e=>{if(!lock.current){documento.onRiferimento(id,e.target.value);setConfirmed(null)}}}><option value="">Nessun riferimento</option><option value="Generale impresa">Generale impresa</option>{cantieri.map(c=><option key={c.id||c.nome} value={c.nome}>{c.nome}</option>)}</select>}{v?.statoRaccolta==='chiusa'&&c.destinazione==='economia'&&<label><input type="checkbox" aria-label={`Conferma integrazione riga ${i+1}`} disabled={busy} checked={c.integra} onChange={e=>changeRow(id,{integra:e.target.checked})}/>Conferma integrazione raccolta chiusa</label>}</td>
      <td style={cell}><input aria-label={`Quantità riga ${i+1}`} style={{...input,width:85,textAlign:'right'}} value={quantita[id]||''} disabled={busy||!selectable(r)} onChange={e=>{if(!lock.current){clearBlocks([id]);setQuantita(old=>({...old,[id]:e.target.value}));setConfirmed(null)}}}/></td><td style={cell}>{euro(values?.prezzo)}</td><td style={cell}>{euro(values?.totale)}</td><td style={cell}><strong>{block&&serverBlocks[id]?.storico?'Costo storico già presente':statoRigaMateriale(d)}</strong><small style={{display:'block'}}>{reason(r)}</small><details><summary>Vedi assegnazioni ({h.length})</summary>{h.map(a=><div key={a.id} style={{padding:5}}>{a.destinazione==='impresa'?`Generale impresa — ${a.categoria==='magazzino'?'Magazzino':'Attrezzatura'}`:a.cantiere} · {a.raccolta} · {num(a.quantita)} {a.unita_misura} · {euro(a.prezzo_unitario)} · {euro(a.totale)} · {new Date(a.data).toLocaleDateString('it-IT')}</div>)}</details></td>
    </tr>})}</tbody></table></div>
    {confirmed===selectionSignature&&<div role="group" aria-label="Conferma assegnazione materiali" style={{padding:10}}>Confermi {selected.length} righe alle rispettive destinazioni? <button disabled={!canAssign} onClick={()=>assign()}>Conferma assegnazione</button><button disabled={busy} onClick={()=>setConfirmed(null)}>Annulla</button></div>}
  </section>
}
