'use client'

import { useMemo, useRef, useState, type CSSProperties } from 'react'
import VistaOperativa from './VistaOperativa'
import FileDropZone from './FileDropZone'
import RiconciliazioneUnificata from './RiconciliazioneUnificata'
import { analizzaFonti, anteprimaIvaXml, esitoIntermediario, fontiConDerivati, preparaFile, type AnalisiBluenext, type DocumentoIntegrato, type FonteBluenext, type OperazionePreparata } from '../engines/fatture/bluenextIntegrato'
import { ripartisci, type ClientRiconciliazione, type SnapshotRiconciliazione } from '../engines/contabilita-ditta/riconciliazioneUnificata'

type Riga = { key: string; xml_sha: string; fattura: string | null; cantiere: string | null; numero: string; data: string; cliente: string; tipo: string; imponibile: number; iva: number; totale: number; certa: boolean; operazione: string; problemi: string[]; avviso?: string; sdi: { esito?: string } | null; riepilogo: { numero: number; totale_registrato: number | null; posizioni: { id: string; descrizione: string; importo: number; stato: string }[] } | null; proposta: { acconto: string; incasso: string; netto: number; lordo: number; data: string; stato_fiscale: { stato: string } } | null; versione: string }
type Preview = { versione: string; righe: Riga[] }
type Conferma = { p_richiesta: string; p_documenti: DocumentoIntegrato[]; p_fonti: FonteBluenext[]; p_versione: string; p_riconcilia: boolean; p_attestazione: boolean }
const euro = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
const journal = 'artecna-bluenext-integrato-pendente'
export default function BluenextIntegrato({ client, cantieri, onAggiorna, buttonStyle }: {
  client: ClientRiconciliazione; cantieri: Record<string, string>; onAggiorna: () => void | Promise<void>; buttonStyle?: CSSProperties
}) {
  const [aperta, setAperta] = useState(false), [fonti, setFonti] = useState<FonteBluenext[]>([])
  const [analisi, setAnalisi] = useState<AnalisiBluenext | null>(null), [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false), [errore, setErrore] = useState(''), [messaggio, setMessaggio] = useState('')
  const [scelte, setScelte] = useState<Record<string, string>>({}), [selezioni, setSelezioni] = useState<string[]>([])
  const [attestazione, setAttestazione] = useState(false), [riconcilia, setRiconcilia] = useState(true)
  const [pendente, setPendente] = useState<string | null>(null), [esito, setEsito] = useState<unknown>(null)
  const [manuali, setManuali] = useState<Record<string, OperazionePreparata[]>>({})
  const [target, setTarget] = useState<{ documento: DocumentoIntegrato; fattura: string; acconto: string; cantiere: string } | null>(null)
  const pendingArgs = useRef<Conferma | null>(null), blocco = useRef(false), focus = useRef<HTMLButtonElement | null>(null)
  const draftClient = useMemo<ClientRiconciliazione>(() => ({ rpc: async (name, args) => {
    if (name !== 'leggi_riconciliazione_unificata' || !target) return { data: null, error: { code: 'DRAFT_READ_ONLY' } }
    const r = await client.rpc(name, { ...args, p_fattura: null, p_acconto: target.acconto })
    if (r.error || !r.data) return r
    const data = structuredClone(r.data) as SnapshotRiconciliazione
    if (data.cantiere_id !== target.cantiere) return { data: null, error: { code: '42501' } }
    let f = data.fatture.find(f => f.id === target.fattura)
    if (!f) { const x = target.documento.documento;f = { id: target.fattura, numero: x.numero, data: x.data, cliente: x.cliente, totale: x.totale, attribuito_netto: 0, documento: { valida: false }, collegamenti_netto: [], sdi: {}, quote: [] };data.fatture.push(f) }
    f.documento = anteprimaIvaXml(target.documento)
    for (const op of manuali[target.documento.xml_sha] ?? []) {
      const parts = op.args.p_allocazioni as { indice: number; imponibile: string }[]
      const amounts = ripartisci(f, Object.fromEntries(parts.map(p => [p.indice, p.imponibile])))
      const allocations = parts.map(p => ({ indice: p.indice, imponibile: Number(p.imponibile), iva: ripartisci(f, { [p.indice]: p.imponibile }).iva / 100 }))
      f.quote.push({ id: String(op.args.p_richiesta), attribuzione_id: null, incasso_id: String(op.args.p_incasso), importo: amounts.lordo / 100, revocata: false, allocazioni: allocations })
      f.attribuito_netto += amounts.netto / 100
      const a = data.acconti.find(a => a.id === op.args.p_acconto);if (a) a.attribuito += amounts.netto / 100
      const i = data.incassi.find(i => i.id === op.args.p_incasso);if (i) i.disponibile -= amounts.lordo / 100
    }
    data.fatture = [f]
    return { data, error: null }
  } }), [client, manuali, target])
  const invalida = () => { setAnalisi(null); setPreview(null); setSelezioni([]); setAttestazione(false); setEsito(null);setManuali({}) }
  async function apri() {
    setAperta(true);setErrore('');setMessaggio('')
    try { const id = sessionStorage.getItem(journal); if (id) { setPendente(id);setMessaggio('Una richiesta precedente richiede verifica: nessuna nuova conferma finché l’esito non è noto.') } }
    catch { setPendente('non-leggibile');setErrore('Registro locale non leggibile: nessuna conferma consentita.') }
  }
  async function aggiungi(files: File[]) {
    if (blocco.current || pendente) return
    blocco.current = true;setBusy(true);setErrore('');invalida()
    try {
      const aggiunte: FonteBluenext[] = [], errori: string[] = []; let duplicati = 0
      const hashes = new Set(fonti.map(f => f.sha256))
      for (const file of files) {
        try { const f = await preparaFile(file); if (hashes.has(f.sha256)) duplicati++;else { hashes.add(f.sha256);aggiunte.push(f) } }
        catch (e) { errori.push(`${file.name}: ${e instanceof Error ? e.message : 'File non leggibile'}`) }
      }
      if (fonti.length + aggiunte.length > 30 || [...fonti, ...aggiunte].reduce((s, f) => s + f.bytes, 0) > 30 * 1024 * 1024) throw Error('Massimo 30 file e 30 MiB: rimuovi gli archivi non necessari.')
      setFonti(f => [...f, ...aggiunte]);setErrore(errori.join(' · '));setMessaggio(duplicati ? `${duplicati} file identici già presenti, non aggiunti di nuovo.` : '')
    } catch (e) { setErrore(e instanceof Error ? e.message : 'Caricamento non completato') }
    finally { blocco.current = false;setBusy(false) }
  }
  function documentiCorrenti(a: AnalisiBluenext) { return a.documenti.map(d => ({ ...d, cantiere: scelte[d.xml_sha] || undefined, operazioni: manuali[d.xml_sha] ?? [] })) }
  async function leggi(documenti: DocumentoIntegrato[]): Promise<Preview> {
    const r = await client.rpc('anteprima_bluenext_integrata', { p_documenti: documenti })
    if (r.error || !r.data) throw Error(r.error?.code === 'PGRST202' ? 'Procedura integrata non installata: richiede la migrazione separata, non applicata automaticamente.' : 'Anteprima server non verificabile: nessuna scrittura.')
    const p = r.data as Preview
    if (!Array.isArray(p.righe) || typeof p.versione !== 'string') throw Error('Anteprima incompleta: nessuna scrittura.')
    return p
  }
  async function analizza() {
    if (blocco.current || pendente) return
    blocco.current = true;setBusy(true);setErrore('');setPreview(null);setEsito(null);setAttestazione(false)
    try {
      const a = await analizzaFonti(fonti);setAnalisi(a)
      const ds = documentiCorrenti(a).filter(d => !d.problemi.length)
      if (!ds.length) throw Error('Nessun XML verificabile da confrontare. Esamina le anomalie e aggiungi le fonti mancanti.')
      const p = await leggi(ds);setPreview(p);setSelezioni(p.righe.filter(r => r.certa).map(r => r.key))
    } catch (e) { setErrore(e instanceof Error ? e.message : 'Analisi non completata') }
    finally { blocco.current = false;setBusy(false) }
  }
  async function invia(args: Conferma) {
    pendingArgs.current = args;sessionStorage.setItem(journal, args.p_richiesta);setPendente(args.p_richiesta)
    const r = await client.rpc('conferma_bluenext_integrato', args)
    if (r.error || !r.data || (r.data as { confermato?: boolean }).confermato !== true) throw Error('Esito non confermato. Verifica la stessa richiesta; nessun nuovo lotto automatico.')
    setEsito(r.data);setMessaggio('Operazioni confermate. Report intermediario e ricevute originali restano distinti.');
    sessionStorage.removeItem(journal);pendingArgs.current = null;setPendente(null);setPreview(null);setAttestazione(false);setManuali({})
    await onAggiorna()
  }
  async function conferma() {
    if (blocco.current || !preview || !analisi || !attestazione || pendente || !selezioni.length) return
    blocco.current = true;setBusy(true);setErrore('')
    try {
      const ds = documentiCorrenti(analisi).filter(d => preview.righe.some(r => selezioni.includes(r.key) && r.xml_sha === d.xml_sha))
      const fresh = await leggi(ds)
      if (fresh.righe.length !== selezioni.length || fresh.righe.some(r => !r.certa || r.versione !== preview.righe.find(x => x.key === r.key)?.versione)) throw Error('Dati cambiati dopo l’analisi: rileggi e verifica prima della conferma.')
      await invia({ p_richiesta: crypto.randomUUID(), p_documenti: ds, p_fonti: await fontiConDerivati(fonti, ds), p_versione: fresh.versione, p_riconcilia: riconcilia, p_attestazione: true })
    } catch (e) { setErrore(e instanceof Error ? e.message : 'Conferma interrotta: verifica lo stato.') }
    finally { blocco.current = false;setBusy(false) }
  }
  async function recupera() {
    if (!pendente || blocco.current) return
    blocco.current = true;setBusy(true);setErrore('')
    try {
      const r = await client.rpc('leggi_esito_bluenext_integrato', { p_richiesta: pendente })
      if (r.error) throw Error('Esito non leggibile: conserva la richiesta e verifica il servizio.')
      if (r.data) { setEsito(r.data);sessionStorage.removeItem(journal);setPendente(null);pendingArgs.current = null;setPreview(null);await onAggiorna() }
      else if (pendingArgs.current) await invia(pendingArgs.current)
      else throw Error('Nessun esito registrato. Servono le stesse fonti e la richiesta originaria per una ripresa controllata; nessuna nuova scrittura consentita.')
    } catch (e) { setErrore(e instanceof Error ? e.message : 'Esito non verificato') }
    finally { blocco.current = false;setBusy(false) }
  }
  const selezionate = preview?.righe.filter(r => selezioni.includes(r.key)) ?? []
  return <><button ref={focus} type="button" style={buttonStyle} onClick={() => void apri()}>Analizza archivio Bluenext</button>
    {aperta && <VistaOperativa titolo="Importazione Bluenext XML + Excel" etichettaRitorno="← Torna alle fatture emesse" ritornoFocusRef={focus} occupata={busy || !!pendente}
      onChiudi={() => { if (!busy && !pendente) setAperta(false) }}>
      <p>XML: dati fiscali. Excel: stato riportato dall’intermediario. Il caricamento non registra fatture o pagamenti.</p>
      <FileDropZone title="Carica fonti Bluenext" accept=".xml,.zip,.xlsx,.xls" disabled={busy || !!pendente} onFiles={files => void aggiungi(files)}>
        <p>XML · ZIP · XLSX · XLS. L’Excel è facoltativo. Non sostituisce la ricevuta originale SdI.</p>
      </FileDropZone>
      {!!fonti.length && <ul aria-label="File caricati">{fonti.map(f => <li key={f.sha256} style={{ overflowWrap: 'anywhere', margin: '8px 0' }}>{f.nome} · {f.tipo.toUpperCase()} · {f.bytes} byte <button type="button" disabled={busy || !!pendente} onClick={() => { setFonti(all => all.filter(x => x.sha256 !== f.sha256));invalida() }}>Rimuovi {f.nome}</button></li>)}</ul>}
      {errore && <p role="alert">{errore}</p>}{messaggio && <p role="status">{messaggio}</p>}
      {pendente && <><p>Richiesta da verificare: {pendente}. Non ripetere l’importazione con un nuovo identificativo.</p><button disabled={busy} onClick={() => void recupera()}>Verifica stessa richiesta</button></>}
      <button type="button" disabled={busy || !!pendente || !fonti.length} onClick={() => void analizza()}>{busy ? 'Elaborazione…' : 'Analizza XML + Excel'}</button>
      {analisi && <>
        <p>{analisi.documenti.length} documenti XML distinti · {analisi.reportOrfani.length} righe Excel senza abbinamento. I duplicati identici non creano nuove fatture.</p>
        {!!analisi.anomalie.length && <details open><summary>Anomalie dei file</summary>{analisi.anomalie.map((s, i) => <p key={i}>{s}</p>)}</details>}
        {analisi.documenti.map(d => <section key={d.xml_sha} aria-label={`Documento ${d.documento.numero}`} style={{ padding: 12, marginTop: 12, border: '1px solid #cbd5e1', borderRadius: 8, overflowWrap: 'anywhere' }}>
          <strong>{d.documento.numero} · {d.documento.data} · {d.documento.cliente} · {euro(d.documento.totale)}</strong>
          <p>Imponibile {euro(d.documento.imponibile)} · IVA {euro(d.documento.iva)} · Fonte: {d.nome}</p>
          <p>Emittente fiscale XML: {d.documento.cedente} · Identificativi cliente: {d.identificativi.join(' · ') || 'Da verificare'}</p>
          {d.report ? <p>Report Bluenext: {d.report.esito || 'Non disponibile'} ({esitoIntermediario(d.report.esito)}) · Id SDI {d.report.idSdi || 'Non disponibile'}. Data Importazione: {d.report.importata || 'Non disponibile'}; non è una data di trasmissione verificata.</p> : <p>Report Excel non abbinato: l’importazione XML rimane possibile.</p>}
          {d.report && <p>Indicazione “Non Registrata” del report: {d.report.nonRegistrata || 'Non disponibile'}. Non modifica lo stato della fattura in ARTECNA.</p>}
          <p>{d.ricevuta ? 'Ricevuta originale caricata: sarà validata dal server, senza inventare date.' : 'Ricevuta originale SdI non acquisita: nessuna nuova copertura fiscale certificata dal solo report.'}</p>
          {!!d.problemi.length && <p role="alert">{d.problemi.join(' · ')}</p>}
          {!!manuali[d.xml_sha]?.length && <p>{manuali[d.xml_sha].length} proposte manuali preparate, non ancora registrate. <button type="button" disabled={busy || !!pendente} onClick={() => { setManuali(m => ({ ...m, [d.xml_sha]: [] }));setPreview(null);setAttestazione(false) }}>Rimuovi proposte {d.documento.numero}</button></p>}
          <details><summary>Riferimenti e numerazione</summary>{d.descrizioni.map((s, i) => <p key={i}>{s}</p>)}<p>Progressivo dei movimenti e progressivo degli acconti fatturati sono indipendenti. La differenza, da sola, non è un’anomalia.</p></details>
          {preview?.righe.find(r => r.xml_sha === d.xml_sha)?.cantiere ? null : <label>Cantiere del documento {d.documento.numero} <select value={scelte[d.xml_sha] ?? ''} disabled={busy || !!pendente} onChange={e => { setScelte(s => ({ ...s, [d.xml_sha]: e.target.value }));setPreview(null);setAttestazione(false) }} style={{ maxWidth: '100%', minHeight: 44 }}><option value="">Da verificare</option>{Object.entries(cantieri).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></label>}
        </section>)}
      </>}
      {preview && <section aria-label="Operazioni proposte"><h3>Conferma complessiva</h3>{preview.righe.map(r => <div key={r.key} style={{ margin: '12px 0' }}>
        <label><input type="checkbox" disabled={!r.certa || busy || !!pendente} checked={selezioni.includes(r.key)} onChange={e => { setSelezioni(s => e.target.checked ? [...s, r.key] : s.filter(k => k !== r.key));setAttestazione(false) }} /> {r.numero}: {r.operazione} · {cantieri[r.cantiere ?? ''] ?? 'Cantiere da verificare'}</label>
        {r.problemi.map((s, i) => <p role="alert" key={i}>{s}</p>)}
        {r.avviso && <p role="status">{r.avviso}</p>}
        <p>Stato SdI attualmente verificabile: {r.sdi?.esito ?? 'Da verificare'}. Distinto dal report dell’intermediario.</p>
        <p>{manuali[r.xml_sha]?.length ? 'Le proposte manuali elencate sostituiscono l’abbinamento automatico.' : r.proposta ? `Acconto ${r.proposta.acconto}: ${euro(r.proposta.netto)}; riuso incasso ${r.proposta.incasso}: ${euro(r.proposta.lordo)}. Nessun nuovo pagamento.` : 'Nessuna coppia acconto/incasso univoca disponibile: conservazione delle fonti senza riconciliazione automatica.'}</p>
        {manuali[r.xml_sha]?.map(op => <p key={String(op.args.p_richiesta)}>Proposta: acconto {String(op.args.p_acconto)} · {op.args.p_incasso ? `riuso incasso ${String(op.args.p_incasso)}` : 'nuovo pagamento documentato esplicitamente'} · imponibile {euro((op.args.p_allocazioni as { imponibile: string }[]).reduce((n, p) => n + Math.round(Number(p.imponibile) * 100), 0) / 100)} · conferma fiscale {op.args.p_conferma_fiscale ? 'richiesta, subordinata alle evidenze' : 'non richiesta'}.</p>)}
        {r.certa && r.cantiere && !!r.riepilogo?.posizioni.length && <button type="button" disabled={busy || !!pendente} onClick={() => {
          const d = analisi?.documenti.find(d => d.xml_sha === r.xml_sha)
          if (d) setTarget({ documento: d, fattura: r.fattura ?? crypto.randomUUID(), acconto: r.proposta?.acconto ?? r.riepilogo!.posizioni[0].id, cantiere: r.cantiere! })
        }}>Prepara riconciliazione {r.numero}</button>}
        {r.riepilogo && <details><summary>Situazione economica e fiscale del cantiere</summary><p>{r.riepilogo.numero} acconti registrati · Totale registrato {r.riepilogo.totale_registrato === null ? 'Non determinabile' : euro(r.riepilogo.totale_registrato)}. La registrazione non sostituisce la prova bancaria del pagamento.</p>{r.riepilogo.posizioni.map(a => <p key={a.id}>{a.descrizione} · {euro(a.importo)} · Posizione fiscale: {a.stato}</p>)}</details>}
      </div>)}
        <p>Selezionate {selezionate.length} operazioni. Totali documentali: {euro(selezionate.reduce((n, r) => n + Math.round(r.totale * 100), 0) / 100)}. Non sono nuovi incassi.</p>
        <label style={{ display: 'block', margin: '12px 0' }}><input type="checkbox" disabled={busy || !!pendente} checked={riconcilia} onChange={e => { setRiconcilia(e.target.checked);setAttestazione(false) }} /> Riconcilia anche le sole coppie acconto/incasso esistente univoche elencate.</label>
        <label style={{ display: 'block', margin: '12px 0' }}><input type="checkbox" disabled={busy || !!pendente} checked={attestazione} onChange={e => setAttestazione(e.target.checked)} /> Ho confrontato gli originali, l’emittente, le identità, il cantiere e i riferimenti contrattuali; per le riconciliazioni selezionate ho verificato l’incasso, la base imponibile e il regime fiscale ordinario. Non attesto una ricevuta SdI con il solo report Excel.</label>
        <button type="button" disabled={busy || !!pendente || !attestazione || !selezionate.length} style={{ minHeight: 44 }} onClick={() => void conferma()}>Conferma operazioni certe</button>
      </section>}
      {!!esito && <p role="status">Importazione confermata dal server. Rileggi fatture e posizioni fiscali: le pendenze prive di evidenze sufficienti restano aperte.</p>}
    </VistaOperativa>}
    {target && <RiconciliazioneUnificata client={draftClient} fatturaId={target.fattura} onChiudi={() => setTarget(null)} onPrepara={op => {
      if (op.rpc !== 'riconcilia_acconto_fattura' || op.args.p_fattura !== target.fattura) throw Error('Proposta non coerente con il documento nel lotto.')
      setManuali(m => ({ ...m, [target.documento.xml_sha]: [...m[target.documento.xml_sha] ?? [], { rpc: 'riconcilia_acconto_fattura', args: op.args }] }));setPreview(null);setAttestazione(false);setMessaggio('Proposta preparata senza scritture. Riesegui Analizza XML + Excel per la conferma complessiva.')
    }} />}
  </>
}
