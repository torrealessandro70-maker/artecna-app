import { associaFotoLocale, cambiaStatoFotoLocale, ErroreCodaFoto } from './fotoRapportinoV1'
import type { ContestoFoto, FotoLocaleInCoda, RepositoryCodaFoto, StatoUploadFoto } from './fotoRapportinoV1'
import type { UUIDAllegato } from './contrattoAllegati'

function errore(error: unknown): ErroreCodaFoto {
  return new ErroreCodaFoto(error instanceof DOMException && error.name === 'QuotaExceededError' ? 'quota_locale' : 'persistenza')
}
/** Nessun fallback silenzioso. Una scrittura è riuscita soltanto a transaction.oncomplete. */
export class RepositoryCodaFotoIndexedDB implements RepositoryCodaFoto {
  private constructor(private readonly db: IDBDatabase) {}
  static apri(factory: IDBFactory | undefined = globalThis.indexedDB): Promise<RepositoryCodaFotoIndexedDB> {
    if (!factory) return Promise.reject(new ErroreCodaFoto('persistenza'))
    return new Promise((resolve, reject) => {
      let terminata = false
      let request: IDBOpenDBRequest
      try { request = factory.open('artecna-rapportino-foto-v1', 1) } catch (e) { reject(errore(e)); return }
      request.onupgradeneeded = () => request.result.createObjectStore('foto', { keyPath: 'chiave_client_allegato' })
      request.onerror = () => { terminata = true; reject(errore(request.error)) }
      request.onblocked = () => { terminata = true; reject(new ErroreCodaFoto('persistenza')) }
      request.onsuccess = () => {
        if (terminata) { request.result.close(); return }
        request.result.onversionchange = () => request.result.close()
        resolve(new RepositoryCodaFotoIndexedDB(request.result))
      }
    })
  }
  chiudi() { this.db.close() }
  private transazione<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction | undefined, value: T
      try {
        tx = this.db.transaction('foto', mode)
        tx.oncomplete = () => resolve(value)
        tx.onabort = () => reject(errore(tx?.error))
        tx.onerror = () => { /* onabort certifica il rollback */ }
        run(tx.objectStore('foto'), x => { value = x })
      } catch (e) {
        try { tx?.abort() } catch { /* Transazione già conclusa: il fallimento resta sanitizzato. */ }
        reject(errore(e))
      }
    })
  }
  aggiungi(foto: FotoLocaleInCoda): Promise<void> {
    return this.transazione('readwrite', (store, result) => { store.add(foto); result(undefined) })
  }
  elenca(): Promise<readonly FotoLocaleInCoda[]> {
    return this.transazione('readonly', (store, result) => { store.getAll().onsuccess = e => result((e.target as IDBRequest<FotoLocaleInCoda[]>).result) })
  }
  private modifica(run: (foto: FotoLocaleInCoda[]) => FotoLocaleInCoda[]): Promise<void> {
    return this.transazione('readwrite', (store, result) => {
      const request = store.getAll()
      request.onsuccess = () => {
        // Nessuna attesa asincrona dentro la transazione IndexedDB.
        try {
            const foto = run(request.result as FotoLocaleInCoda[])
            for (const f of foto) store.put(f)
            result(undefined)
        } catch { store.transaction.abort() }
      }
    })
  }
  associa(contesto: ContestoFoto, id: UUIDAllegato) { return this.modifica(foto => foto.map(f => associaFotoLocale(f, contesto, id))) }
  stato(key: UUIDAllegato, stato: StatoUploadFoto) {
    return this.modifica(foto => {
      if (!foto.some(f => f.chiave_client_allegato === key)) throw new ErroreCodaFoto('integrita')
      return foto.map(f => f.chiave_client_allegato === key ? cambiaStatoFotoLocale(f, stato) : f)
    })
  }
  rimuovi(key: UUIDAllegato): Promise<void> {
    return this.transazione('readwrite', (store, result) => { store.delete(key); result(undefined) })
  }
}
