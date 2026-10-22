'use client'
import { useEffect, useRef, useState } from 'react'
import { CodaFotoRapportinoV1, type ContestoFoto, type FotoLocaleInCoda } from '../engines/rapportini/fotoRapportinoV1'
import { RepositoryCodaFotoIndexedDB } from '../engines/rapportini/codaFotoIndexedDB'
import { FotoMobileQueue, factoryFotoOperaio, lockFotoOperaio, preparaFotoMobile, statoVisibileFoto } from '../engines/rapportini/fotoMobileQueue'
import { messaggioErroreInvioFotoV1 } from '../engines/rapportini/trasportoHttpFotoV1'

function Anteprima({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState('')
  useEffect(() => { const value = URL.createObjectURL(blob); setUrl(value); return () => URL.revokeObjectURL(value) }, [blob])
  return url ? <img src={url} alt="Anteprima foto del Rapportino" style={{ width: 160, height: 120, objectFit: 'cover' }} /> : null
}
export default function FotoRapportinoMobileV1({ operaioId, contesto, disabled }: {
  operaioId: string; contesto: ContestoFoto; disabled: boolean
}) {
  const queue = useRef<FotoMobileQueue | null>(null)
  const [foto, setFoto] = useState<readonly FotoLocaleInCoda[]>([])
  const [preview, setPreview] = useState<readonly Blob[]>([])
  const [errore, setErrore] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false), generation = useRef(0)
  const ctxKey = `${operaioId}/${contesto.cantiere_id}/${contesto.data}/${contesto.rapportino_id ?? ''}`
  useEffect(() => {
    const gen = ++generation.current
    let repo: RepositoryCodaFotoIndexedDB | undefined, closed = false
    setFoto([]); setPreview([]); setErrore(''); queue.current = null
    void (async () => {
      try {
        if (!globalThis.indexedDB) throw new Error('IndexedDB indisponibile')
        repo = await RepositoryCodaFotoIndexedDB.apri(factoryFotoOperaio(globalThis.indexedDB, operaioId))
        if (closed) { repo.chiudi(); return }
        const value = new FotoMobileQueue(new CodaFotoRapportinoV1(repo), lockFotoOperaio(operaioId))
        queue.current = value
        const saved = await value.inizializza(contesto)
        if (generation.current === gen) setFoto(saved)
      } catch {
        if (!closed) { queue.current = null; setErrore('Coda foto non disponibile. Nessuna nuova foto sarà inviata: riprova ad aprire il Rapportino.') }
      }
    })()
    return () => { closed = true; queue.current?.disattiva(); queue.current = null; repo?.chiudi() }
    // La chiave include tutti i campi del contesto e l'identità autenticata dalla pagina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey])
  async function seleziona(files: File[]) {
    const current = queue.current, gen = generation.current
    if (!current || busyRef.current || disabled) return
    busyRef.current = true; setBusy(true); setPreview(files); setErrore('')
    try {
      for (const file of files) await current.aggiungi(await preparaFotoMobile(file), contesto)
      const saved = await current.elenca(contesto)
      if (gen === generation.current) { setFoto(saved); setPreview([]) }
    } catch {
      if (gen === generation.current) {
        setPreview([])
        setErrore('Una foto non è stata conservata nella coda. Formati JPEG/PNG/WebP, massimo 4 MB. Verifica spazio disponibile e selezionala di nuovo.')
        setFoto(await current.elenca(contesto).catch(() => []))
      }
    } finally { busyRef.current = false; setBusy(false) }
  }
  async function invia(key: string) {
    const current = queue.current, gen = generation.current
    if (!current || busyRef.current || disabled) return
    busyRef.current = true; setBusy(true); setErrore('')
    setFoto(values => values.map(f => f.chiave_client_allegato === key ? { ...f, stato: 'caricamento' } : f))
    try { await current.invia(key, contesto) }
    catch (error) { if (gen === generation.current) setErrore(messaggioErroreInvioFotoV1(error)) }
    finally {
      if (gen === generation.current) setFoto(await current.elenca(contesto).catch(() => []))
      busyRef.current = false; setBusy(false)
    }
  }
  return <section aria-label="Foto del Rapportino strutturato" style={{ padding: 14, border: '1px solid #ddd', borderRadius: 10 }}>
    <h3>Foto del lavoro</h3>
    <p>Le foto restano su questo browser. Salva il Rapportino, poi premi Invia foto. L’invio non ripete il salvataggio del Rapportino.</p>
    <p>Le immagini oltre 4 MB o 24 megapixel vengono ridotte in JPEG prima di essere conservate e inviate.</p>
    <label>Scatta o seleziona foto <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple
      disabled={disabled || busy || !queue.current} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; void seleziona(files) }} /></label>
    {preview.map((blob, i) => <div key={i}><Anteprima blob={blob} /><p>Conservazione in coda…</p></div>)}
    {errore && <p role="alert">{errore}</p>}
    {!contesto.rapportino_id && <p>In attesa del salvataggio del Rapportino.</p>}
    {foto.map(f => <div key={f.chiave_client_allegato} style={{ marginTop: 12 }}>
      <Anteprima blob={f.blob} /><p aria-live="polite">{statoVisibileFoto(f)}</p>
      {['pronta', 'errore'].includes(f.stato) && <button type="button" disabled={disabled || busy || !contesto.rapportino_id}
        onClick={() => void invia(f.chiave_client_allegato)}>{f.stato === 'errore' ? 'Riprova invio' : 'Invia foto'}</button>}
    </div>)}
  </section>
}
