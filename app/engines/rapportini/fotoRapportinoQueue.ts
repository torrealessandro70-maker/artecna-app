import { CodaFotoRapportinoV1, type ContestoFoto, type FotoLocaleInCoda } from './fotoRapportinoV1'
import { LIMITI_ALLEGATI, validaMimeAllegato, validaUUIDAllegato } from './contrattoAllegati'
import type { LockFotoQueue } from './identitaCodaFoto'
import type { creaTrasportoHttpFotoV1 } from './trasportoHttpFotoV1'

/** Adatta solo immagini fuori limite prima che la coda assegni hash e identità. */
export async function preparaFotoRapportino(blob: Blob): Promise<Blob> {
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

/** Non conosce writer Rapportini: l'UUID arriva solo dal contesto autorevole del chiamante. */
export class FotoRapportinoQueue {
  private attiva = true
  private readonly operazioni = new Set<Promise<unknown>>()
  async quandoInattiva() { await Promise.allSettled([...this.operazioni]) }
  private esegui<T>(azione: () => Promise<T>): Promise<T> {
    this.verifica()
    const task = azione(); this.operazioni.add(task)
    void task.then(() => this.operazioni.delete(task), () => this.operazioni.delete(task))
    return task
  }
  constructor(private readonly coda: CodaFotoRapportinoV1, private readonly lock: LockFotoQueue,
    private readonly transport: Pick<ReturnType<typeof creaTrasportoHttpFotoV1>, 'ritentaFoto'>) {}
  disattiva() { this.attiva = false }
  private verifica() { if (!this.attiva) throw new Error('Sessione foto non più attiva.') }
  async inizializza(ctx: ContestoFoto) {
    return this.esegui(() => this.lock(async () => {
      this.verifica()
      if (ctx.rapportino_id) await this.coda.writerRiuscito({ ...ctx, rapportino_id: null }, ctx.rapportino_id)
      await this.coda.recuperaInterrotte(ctx)
      return this.coda.elenca(ctx)
    }))
  }
  async aggiungi(blob: Blob, ctx: ContestoFoto) {
    this.verifica()
    return this.esegui(() => this.coda.aggiungi(blob, ctx))
  }
  async elenca(ctx: ContestoFoto) { this.verifica(); return this.coda.elenca(ctx) }
  async invia(key: string, ctx: ContestoFoto) {
    return this.esegui(() => this.lock(async () => {
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
    }))
  }
}
export function statoVisibileFoto(foto: FotoLocaleInCoda) {
  if (foto.stato === 'completata') return 'Completata'
  if (foto.stato === 'caricamento' || foto.stato === 'finalizzazione') return 'Caricamento'
  if (foto.stato === 'errore' || foto.stato === 'scaduta') return 'Errore'
  return 'In attesa'
}
