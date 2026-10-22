import { RepositoryCodaFotoIndexedDB } from './codaFotoIndexedDB'
import { CodaFotoRapportinoV1, type ContestoFoto, type FotoLocaleInCoda } from './fotoRapportinoV1'
import { LIMITI_ALLEGATI, validaMimeAllegato, validaUUIDAllegato } from './contrattoAllegati'
import { creaTrasportoHttpFotoV1 } from './trasportoHttpFotoV1'

/** Adatta solo immagini fuori limite prima che la coda assegni hash e identità. */
export async function preparaFotoMobile(blob: Blob): Promise<Blob> {
  validaMimeAllegato(blob.type)
  if (!blob.size) throw new Error('Immagine vuota')
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Immagine non leggibile'))
      image.src = url
    })
    const w = image.naturalWidth, h = image.naturalHeight
    if (!w || !h) throw new Error('Dimensioni immagine non valide')
    if (blob.size <= LIMITI_ALLEGATI.byte_size && w * h <= LIMITI_ALLEGATI.pixel) return blob
    // Stesso formato/qualità della fotocamera Desktop; rispetta l'orientamento.
    const scale = Math.min(1, 1920 / Math.max(w, h), 1080 / Math.min(w, h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Preparazione immagine non disponibile')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.9, 0.8, 0.7, 0.6]) {
      const result = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (result?.type === 'image/jpeg' && result.size > 0 && result.size <= LIMITI_ALLEGATI.byte_size) return result
    }
    throw new Error('Immagine non riducibile entro 4 MB')
  } finally { URL.revokeObjectURL(url) }
}

/** Nessun token nel nome o nei record. La vecchia coda non scoped non viene importata. */
export function factoryFotoOperaio(factory: IDBFactory, operaioId: string): IDBFactory {
  const id = validaUUIDAllegato(operaioId)
  return new Proxy(factory, { get(target, key) {
    if (key === 'open') return (name: string, version?: number) => target.open(`${name}-operaio-${id}`, version)
    const value = Reflect.get(target, key, target)
    return typeof value === 'function' ? value.bind(target) : value
  } })
}
export type LockFotoMobile = <T>(action: () => Promise<T>) => Promise<T>
export function lockFotoOperaio(operaioId: string): LockFotoMobile {
  const id = validaUUIDAllegato(operaioId)
  return async action => {
    if (!navigator.locks) throw new Error('Questo browser non consente un invio foto sicuro tra schede.')
    return navigator.locks.request(`artecna-foto-mobile-${id}`, { ifAvailable: true }, async lock => {
      if (!lock) throw new Error('Una foto è già in elaborazione in un’altra scheda.')
      return action()
    })
  }
}
/** Non conosce writer Rapportini: l'UUID arriva solo dal contesto autorevole del chiamante. */
export class FotoMobileQueue {
  private attiva = true
  constructor(private readonly coda: CodaFotoRapportinoV1, private readonly lock: LockFotoMobile,
    private readonly transport = creaTrasportoHttpFotoV1('/api/rapportino/foto')) {}
  disattiva() { this.attiva = false }
  private verifica() { if (!this.attiva) throw new Error('Sessione foto non più attiva.') }
  async inizializza(ctx: ContestoFoto) {
    return this.lock(async () => {
      this.verifica()
      if (ctx.rapportino_id) await this.coda.writerRiuscito({ ...ctx, rapportino_id: null }, ctx.rapportino_id)
      await this.coda.recuperaInterrotte(ctx)
      return this.coda.elenca(ctx)
    })
  }
  async aggiungi(blob: Blob, ctx: ContestoFoto) {
    this.verifica()
    return this.coda.aggiungi(blob, ctx)
  }
  async elenca(ctx: ContestoFoto) { this.verifica(); return this.coda.elenca(ctx) }
  async invia(key: string, ctx: ContestoFoto) {
    return this.lock(async () => {
      this.verifica()
      const id = validaUUIDAllegato(key)
      const foto = (await this.coda.elenca(ctx)).find(f => f.chiave_client_allegato === id)
      if (!foto || !ctx.rapportino_id || !['pronta', 'errore'].includes(foto.stato))
        throw new Error('Foto non pronta: salva prima il Rapportino o ricarica la coda.')
      if (foto.stato === 'errore') await this.coda.cambiaStato(id, 'pronta')
      await this.coda.cambiaStato(id, 'caricamento')
      try {
        this.verifica()
        const result = await this.transport.ritentaFoto(foto)
        await this.coda.cambiaStato(id, 'finalizzazione')
        await this.coda.cambiaStato(id, 'completata')
        return result
      } catch (error) {
        await this.coda.cambiaStato(id, 'errore')
        throw error
      }
    })
  }
}
export function statoVisibileFoto(foto: FotoLocaleInCoda) {
  if (foto.stato === 'completata') return 'Completata'
  if (foto.stato === 'caricamento' || foto.stato === 'finalizzazione') return 'Caricamento'
  if (foto.stato === 'errore' || foto.stato === 'scaduta') return 'Errore'
  return 'In attesa'
}
