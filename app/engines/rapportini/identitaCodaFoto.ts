import { validaDataAllegato, validaUUIDAllegato } from './contrattoAllegati'
import type { ContestoFoto } from './fotoRapportinoV1'

export type IdentitaCodaFoto = Readonly<{ canale: 'portale' | 'desktop'; soggettoId: string }>
export function chiaveIdentitaFoto(identity: IdentitaCodaFoto): string {
  if (!['portale', 'desktop'].includes(identity.canale)) throw new Error('Identità coda foto non valida')
  return `${identity.canale}/${validaUUIDAllegato(identity.soggettoId)}`
}
/** Portale conserva byte per byte il database v1 già presente sui dispositivi. */
export function factoryFotoIdentita(factory: IDBFactory, identity: IdentitaCodaFoto): IDBFactory {
  chiaveIdentitaFoto(identity)
  const suffix = identity.canale === 'portale' ? `operaio-${identity.soggettoId}` : `desktop-${identity.soggettoId}`
  return new Proxy(factory, { get(target, key) {
    if (key === 'open') return (name: string, version?: number) => target.open(`${name}-${suffix}`, version)
    const value = Reflect.get(target, key, target)
    return typeof value === 'function' ? value.bind(target) : value
  } })
}
export type LockFotoQueue = <T>(action: () => Promise<T>) => Promise<T>
export function nomeLockFoto(identity: IdentitaCodaFoto, ctx?: ContestoFoto): string {
  chiaveIdentitaFoto(identity)
  // Il lock storico globale dell'operaio deve coordinarsi anche con vecchie schede Mobile.
  if (identity.canale === 'portale') return `artecna-foto-mobile-${identity.soggettoId}`
  if (!ctx) throw new Error('Contesto coda Desktop obbligatorio')
  // Nessun ID Rapportino: il lock resta uguale durante l'associazione bozza -> salvato.
  return `artecna-foto-desktop-${identity.soggettoId}/${validaUUIDAllegato(ctx.cantiere_id)}/${validaDataAllegato(ctx.data)}`
}
export function lockFotoIdentita(identity: IdentitaCodaFoto, ctx?: ContestoFoto): LockFotoQueue {
  const name = nomeLockFoto(identity, ctx)
  return async action => {
    if (!navigator.locks) throw new Error('Questo browser non consente un invio foto sicuro tra schede.')
    return navigator.locks.request(name, { ifAvailable: true }, async lock => {
      if (!lock) throw new Error('Una foto è già in elaborazione in un’altra scheda.')
      return action()
    })
  }
}
