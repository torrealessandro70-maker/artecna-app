import 'server-only'
import { rpcPortalePostgres } from './adapterPortalePostgres.server'
import { ErroreServizioRapportini, tokenSessioneRapportino, verificaOrigineRapportino } from './servizioRapportini.server'
import { contestoLetturaPortaleValido, letturaPortaleValida, type ContestoLetturaRapportinoPortale } from './validaLetturaPortale'
import type { LetturaRapportinoPortale } from './contrattoLetturaPortale'

/** Solo canale portale/pooler; nessun Bearer, PostgREST o fallback service_role. */
export async function leggiRapportinoPortale(req: Request, contesto: ContestoLetturaRapportinoPortale): Promise<LetturaRapportinoPortale> {
  verificaOrigineRapportino(req)
  const sessione = tokenSessioneRapportino(req.headers.get('cookie'))
  if (!sessione) throw new ErroreServizioRapportini('Sessione portale assente: accedi nuovamente', 401, 'PR401')
  if (!contestoLetturaPortaleValido(contesto)) throw new ErroreServizioRapportini('Contesto lettura Rapportino non valido', 400, '22023')
  try {
    const result = await rpcPortalePostgres('leggi_rapportino_portale', {
      p_sessione: sessione, p_cantiere_id: contesto.cantiere_id, p_data: contesto.data,
      p_rapportino_id: contesto.rapportino_id ?? null,
    })
    if (result.error) {
      const code = result.error.code
      const mapping: Record<string, readonly [number, string]> = {
        PR401: [401, 'Sessione portale assente, scaduta o revocata'],
        '42501': [403, 'Accesso Rapportini non consentito'],
        PR409: [409, 'UUID o contesto Rapportino incoerente o ambiguo'],
        '22023': [400, 'Input o versione Rapportino non supportata'],
      }
      const mapped = Object.prototype.hasOwnProperty.call(mapping, code) ? mapping[code] : undefined
      if (mapped) throw new ErroreServizioRapportini(mapped[1], mapped[0], code)
      throw new ErroreServizioRapportini('Servizio lettura Rapportini non disponibile', 503, 'TRANSPORT')
    }
    if (!letturaPortaleValida(result.data, contesto)) {
      throw new ErroreServizioRapportini('Risposta lettura Rapportino non valida', 503, 'RISPOSTA')
    }
    return result.data
  } catch (error) {
    if (error instanceof ErroreServizioRapportini) throw error
    throw new ErroreServizioRapportini('Servizio lettura Rapportini non disponibile', 503, 'TRANSPORT')
  }
}
