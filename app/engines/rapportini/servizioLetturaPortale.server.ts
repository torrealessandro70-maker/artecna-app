import 'server-only'
import { leggiRapportinoPortale } from './letturaRapportinoPortale.server'
import { ErroreServizioRapportini } from './servizioRapportini.server'
import { contestoLetturaPortaleValido, type ContestoLetturaRapportinoPortale } from './validaLetturaPortale'
import type { LetturaRapportinoPortale } from './contrattoLetturaPortale'
import type { StatoRapportinoV2 } from './contrattoMaterialiRapportino'

/** Input applicativo non ancora validato. L'identità deriva soltanto dalla Request. */
export type InputLetturaPortale = Readonly<{
  cantiere_id: unknown
  data: unknown
  rapportino_id?: unknown
}>

function normalizzaContesto(input: unknown): ContestoLetturaRapportinoPortale {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ErroreServizioRapportini('Contesto lettura Rapportino non valido', 400, '22023')
  }
  const { cantiere_id, data, rapportino_id } = input as InputLetturaPortale
  if (typeof cantiere_id !== 'string' || typeof data !== 'string'
    || (rapportino_id != null && typeof rapportino_id !== 'string')) {
    throw new ErroreServizioRapportini('Contesto lettura Rapportino non valido', 400, '22023')
  }
  const contesto: ContestoLetturaRapportinoPortale = {
    cantiere_id: cantiere_id.trim().toLowerCase(),
    data: data.trim(),
    rapportino_id: rapportino_id == null ? null : rapportino_id.trim().toLowerCase(),
  }
  // Nessuna data implicita: la route futura risolverà il proprio fallback esistente.
  if (!contestoLetturaPortaleValido(contesto)) {
    throw new ErroreServizioRapportini('Contesto lettura Rapportino non valido', 400, '22023')
  }
  return contesto
}

/** Opt-in separato: il percorso operativo V1 conserva dipendenze e comportamento. */
export async function leggiStatoRapportinoPortaleV2(req: Request, input: InputLetturaPortale): Promise<StatoRapportinoV2> {
  const contesto = normalizzaContesto(input)
  const { leggiMaterialiPortale } = await import('./letturaMaterialiPortale.server')
  return leggiMaterialiPortale(req, contesto)
}

/** Una sola lettura autorevole; V0 resta un riferimento, senza lettura legacy.
 * Validazione JSON, sessione, origine e mapping RPC sono del livello sottostante.
 */
export async function leggiStatoRapportinoPortale(req: Request, input: InputLetturaPortale): Promise<LetturaRapportinoPortale> {
  try {
    const contesto = normalizzaContesto(input)
    return await leggiRapportinoPortale(req, contesto)
  } catch (error) {
    if (error instanceof ErroreServizioRapportini) throw error
    throw new ErroreServizioRapportini('Servizio lettura Rapportini non disponibile', 503, 'TRANSPORT')
  }
}
