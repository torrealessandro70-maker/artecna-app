'use client'
import { useEffect, useRef, useState } from 'react'
import { CodaFotoRapportinoV1, type ContestoFoto, type FotoLocaleInCoda } from '../engines/rapportini/fotoRapportinoV1'
import { RepositoryCodaFotoIndexedDB } from '../engines/rapportini/codaFotoIndexedDB'
import { FotoRapportinoQueue, preparaFotoRapportino, statoVisibileFoto } from '../engines/rapportini/fotoRapportinoQueue'
import { factoryFotoIdentita, lockFotoIdentita, chiaveIdentitaFoto, type IdentitaCodaFoto } from '../engines/rapportini/identitaCodaFoto'
import type { creaTrasportoHttpFotoV1, FotoElencataDesktop } from '../engines/rapportini/trasportoHttpFotoV1'
import { messaggioErroreInvioFotoV1 } from '../engines/rapportini/trasportoHttpFotoV1'

function Anteprima({ blob }: { blob: Blob }) {
  const image = useRef<HTMLImageElement | null>(null)
  useEffect(() => {
    const value = URL.createObjectURL(blob)
    if (image.current) image.current.src = value
    return () => URL.revokeObjectURL(value)
  }, [blob])
  // eslint-disable-next-line @next/next/no-img-element -- Blob locale; nessun URL pubblico o ottimizzatore remoto.
  return <img ref={image} alt="Anteprima foto del Rapportino" width={160} height={120} style={{ objectFit: 'cover' }} />
}
type Props = {
  identita: IdentitaCodaFoto; contesto: ContestoFoto; disabled: boolean
  trasporto: ReturnType<typeof creaTrasportoHttpFotoV1>; onBusyChange?: (busy: boolean) => void
}
export default function FotoRapportinoQueueV1(props: Props) {
  const key = chiaveIdentitaFoto(props.identita) + '/' + props.contesto.cantiere_id + '/' + props.contesto.data + '/' + (props.contesto.rapportino_id ?? '')
  return <FotoRapportinoQueueSessione key={key} {...props} />
}
function FotoRapportinoQueueSessione({ identita, contesto, disabled, trasporto, onBusyChange }: Props) {
  const queue = useRef<FotoRapportinoQueue | null>(null)
  const [ready, setReady] = useState(false)
  const [foto, setFoto] = useState<readonly FotoLocaleInCoda[]>([])
  const [preview, setPreview] = useState<readonly Blob[]>([])
  const [errore, setErrore] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false), generation = useRef(0)
  const [elencoRevision, setElencoRevision] = useState(0)
  const [esistenti, setEsistenti] = useState<readonly FotoElencataDesktop[]>([])
  const [erroreElenco, setErroreElenco] = useState('')
  useEffect(() => {
    if (!busy) return
    const avvisa = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', avvisa)
    return () => window.removeEventListener('beforeunload', avvisa)
  }, [busy])
  const ctxKey = `${chiaveIdentitaFoto(identita)}/${contesto.cantiere_id}/${contesto.data}/${contesto.rapportino_id ?? ''}`
  useEffect(() => {
    const gen = ++generation.current
    let repo: RepositoryCodaFotoIndexedDB | undefined, ownedQueue: FotoRapportinoQueue | undefined, closed = false
    void (async () => {
      try {
        if (!globalThis.indexedDB) throw new Error('IndexedDB indisponibile')
        repo = await RepositoryCodaFotoIndexedDB.apri(factoryFotoIdentita(globalThis.indexedDB, identita))
        if (closed) { repo.chiudi(); return }
        const value = new FotoRapportinoQueue(new CodaFotoRapportinoV1(repo), lockFotoIdentita(identita, contesto), trasporto)
        ownedQueue = value; queue.current = value
        const saved = await value.inizializza(contesto)
        if (generation.current === gen) { setFoto(saved); setReady(true) }
      } catch {
        if (!closed) { queue.current = null; setErrore('Coda foto non disponibile. Nessuna nuova foto sarà inviata: riprova ad aprire il Rapportino.') }
      }
    })()
    return () => {
      closed = true; generation.current += 1; queue.current = null; onBusyChange?.(false)
      ownedQueue?.disattiva()
      if (ownedQueue) void ownedQueue.quandoInattiva().then(() => repo?.chiudi())
      else repo?.chiudi()
    }
    // La chiave include tutti i campi del contesto e l'identità autenticata dalla pagina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey, trasporto])
  useEffect(() => {
    const controller = new AbortController()
    if (contesto.rapportino_id && trasporto.elencaFoto) {
      void trasporto.elencaFoto(contesto.rapportino_id, controller.signal).then(rows => {
        if (!controller.signal.aborted) { setEsistenti(rows); setErroreElenco('') }
      }).catch(() => { if (!controller.signal.aborted) setErroreElenco('Foto già salvate non disponibili. Riprova la lettura.') })
    }
    return () => controller.abort()
    // Identità e intero contesto sono contenuti nella chiave stabile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey, elencoRevision, trasporto])
  async function seleziona(files: File[]) {
    const current = queue.current, gen = generation.current
    if (!current || busyRef.current || disabled) return
    busyRef.current = true; setBusy(true); onBusyChange?.(true); setPreview(files); setErrore('')
    try {
      for (const file of files) await current.aggiungi(await preparaFotoRapportino(file), contesto)
      const saved = await current.elenca(contesto)
      if (gen === generation.current) { setFoto(saved); setPreview([]) }
    } catch {
      if (gen === generation.current) {
        setPreview([])
        setErrore('Una foto non è stata conservata nella coda. Formati JPEG/PNG/WebP, massimo 4 MB. Verifica spazio disponibile e selezionala di nuovo.')
        setFoto(await current.elenca(contesto).catch(() => []))
      }
    } finally { if (gen === generation.current) { busyRef.current = false; setBusy(false); onBusyChange?.(false) } }
  }
  async function invia(key: string) {
    const current = queue.current, gen = generation.current
    if (!current || busyRef.current || disabled) return
    busyRef.current = true; setBusy(true); onBusyChange?.(true); setErrore('')
    setFoto(values => values.map(f => f.chiave_client_allegato === key ? { ...f, stato: 'caricamento' } : f))
    try { await current.invia(key, contesto); if (gen === generation.current) setElencoRevision(n => n + 1) }
    catch (error) { if (gen === generation.current) setErrore(messaggioErroreInvioFotoV1(error)) }
    finally {
      if (gen === generation.current) setFoto(await current.elenca(contesto).catch(() => []))
      if (gen === generation.current) { busyRef.current = false; setBusy(false); onBusyChange?.(false) }
    }
  }
  return <section aria-label="Foto del Rapportino strutturato" style={{ padding: 14, border: '1px solid #ddd', borderRadius: 10 }}>
    <h3>Foto del lavoro</h3>
    <p>Le foto restano su questo browser. Salva il Rapportino, poi premi Invia foto. L’invio non ripete il salvataggio del Rapportino.</p>
    <p>Le immagini oltre 4 MB o 24 megapixel vengono ridotte in JPEG prima di essere conservate e inviate.</p>
    <label>Scatta o seleziona foto <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple
      disabled={disabled || busy || !ready} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; void seleziona(files) }} /></label>
    {preview.map((blob, i) => <div key={i}><Anteprima blob={blob} /><p>Conservazione in coda…</p></div>)}
    {errore && <p role="alert">{errore}</p>}
    {!contesto.rapportino_id && <p>In attesa del salvataggio del Rapportino.</p>}
    {erroreElenco && <p role="alert">{erroreElenco}<button type="button" onClick={() => { setErroreElenco(''); setElencoRevision(n => n + 1) }}>Riprova elenco foto</button></p>}
    {esistenti.map(f => <div key={f.allegato_id}><FotoRemota foto={f} leggi={trasporto.leggiFoto!} /><p>Foto salvata</p></div>)}
    {foto.map(f => <div key={f.chiave_client_allegato} style={{ marginTop: 12 }}>
      <Anteprima blob={f.blob} /><p aria-live="polite">{statoVisibileFoto(f)}</p>
      {['pronta', 'errore'].includes(f.stato) && <button type="button" disabled={disabled || busy || !contesto.rapportino_id}
        onClick={() => void invia(f.chiave_client_allegato)}>{f.stato === 'errore' ? 'Riprova invio' : 'Invia foto'}</button>}
    </div>)}
  </section>
}

function FotoRemota({ foto, leggi }: { foto: FotoElencataDesktop;
  leggi: NonNullable<ReturnType<typeof creaTrasportoHttpFotoV1>['leggiFoto']> }) {
  const [blob, setBlob] = useState<Blob>(), [errore, setErrore] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void leggi(foto, controller.signal).then(value => { if (!controller.signal.aborted) setBlob(value) })
      .catch(() => { if (!controller.signal.aborted) setErrore(true) })
    return () => controller.abort()
  }, [foto, leggi, retry])
  return blob ? <Anteprima blob={blob} /> : errore ? <p role="alert">Foto non disponibile.
    <button type="button" onClick={() => { setErrore(false); setRetry(n => n + 1) }}>Riprova lettura foto</button></p> : <p>Caricamento foto salvata…</p>
}
