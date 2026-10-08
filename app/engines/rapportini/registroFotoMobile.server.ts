import 'server-only'
import { rpcPortalePostgres, type RpcPortaleRapportini } from './adapterPortalePostgres.server'
import { tokenSessioneRapportino } from './servizioRapportini.server'
import { ErroreFotoV1, type RegistroFotoV1 } from './servizioFotoV1.server'

async function call(name: RpcPortaleRapportini, params: Record<string, unknown>) {
  const result = await rpcPortalePostgres(name, params)
  if (result.error) {
    const code = result.error.code
    const status = code === 'PR401' ? 401 : code === '42501' ? 403
      : ['PR409', 'PR412'].includes(code) ? 409 : ['22023', '22P02'].includes(code) ? 400 : 503
    throw new ErroreFotoV1(status, status === 503 ? 'registro_non_disponibile' : code)
  }
  return result.data
}
export const registroFotoMobile: RegistroFotoV1 = {
  canale: 'mobile',
  async authorize(req, input) {
    if (req.headers.has('authorization')) throw new ErroreFotoV1(401, 'identita')
    const session = tokenSessioneRapportino(req.headers.get('cookie'))
    if (!session) throw new ErroreFotoV1(401, 'sessione')
    await call('verifica_sessione_rapportino', { p_sessione: session, p_cantiere_id: input.cantiere_id })
    return {
      reserve: () => call('prenota_allegato_rapportino_portale', {
        p_sessione: session, p_rapportino_id: input.rapportino_id, p_cantiere_id: input.cantiere_id,
        p_data: input.data, p_chiave_client_allegato: input.chiave_client_allegato,
        p_sha256: input.sha256, p_mime_type: input.mime_type, p_byte_size: input.byte_size }),
      finalize: (id, lease) => call('finalizza_allegato_rapportino_portale', {
        p_sessione: session, p_allegato_id: id, p_lease_id: lease }),
    }
  },
}
