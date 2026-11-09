import { CodaFotoRapportinoV1 } from './fotoRapportinoV1'
import { FotoRapportinoQueue } from './fotoRapportinoQueue'
import { factoryFotoIdentita, lockFotoIdentita, type LockFotoQueue } from './identitaCodaFoto'
import { creaTrasportoHttpFotoV1 } from './trasportoHttpFotoV1'

export { preparaFotoRapportino as preparaFotoMobile, statoVisibileFoto } from './fotoRapportinoQueue'
export type LockFotoMobile = LockFotoQueue
export const factoryFotoOperaio = (factory: IDBFactory, operaioId: string) =>
  factoryFotoIdentita(factory, { canale: 'portale', soggettoId: operaioId })
export const lockFotoOperaio = (operaioId: string) =>
  lockFotoIdentita({ canale: 'portale', soggettoId: operaioId })
/** Compatibilità API Mobile: stesso trasporto, database, lock e formato dei record. */
export class FotoMobileQueue extends FotoRapportinoQueue {
  constructor(coda: CodaFotoRapportinoV1, lock: LockFotoMobile,
    transport = creaTrasportoHttpFotoV1('/api/rapportino/foto')) { super(coda, lock, transport) }
}
