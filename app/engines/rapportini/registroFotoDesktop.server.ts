import 'server-only'
import { rpcPortalePostgres } from './adapterPortalePostgres.server'
import { capabilityFotoDesktop, type CapabilityFotoDesktop } from './letturaFotoDesktop.server'
import { ErroreFotoV1, type RegistroFotoV1 } from './servizioFotoV1.server'

/** The subject comes only from Auth.getUser, never from HTTP metadata or a mobile cookie. */
export function creaRegistroFotoDesktop(
  capability: Pick<CapabilityFotoDesktop, 'authorize'> = capabilityFotoDesktop,
  rpc: typeof rpcPortalePostgres = rpcPortalePostgres,
): RegistroFotoV1 {
  return {
    canale: 'desktop',
    async authorize(req, input) {
      const bearer = req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)
      if (!bearer) throw new ErroreFotoV1(401, 'identita')
      const verified = await capability.authorize(bearer[1])
      // Existing canonical reader checks membership and structured Rapportino context
      // before any physical Storage operation. Mutating RPCs recheck the guard.
      await verified.list(input.rapportino_id)
      const call = async (name: 'prenota_allegato_rapportino_desktop' | 'finalizza_allegato_rapportino_desktop', params: Record<string, unknown>) => {
        const result = await rpc(name, { ...params, p_user_id: verified.userId })
        if (result.error) {
          const code = result.error.code
          throw new ErroreFotoV1(code === '42501' ? 403 : code === 'PR401' ? 401
            : ['PR409', 'PR412'].includes(code) ? 409 : ['22023', '22P02'].includes(code) ? 400 : 503,
          'registro_desktop')
        }
        return result.data
      }
      return {
        reserve: () => call('prenota_allegato_rapportino_desktop', {
          p_rapportino_id: input.rapportino_id, p_cantiere_id: input.cantiere_id,
          p_data: input.data, p_chiave_client_allegato: input.chiave_client_allegato,
          p_sha256: input.sha256, p_mime_type: input.mime_type, p_byte_size: input.byte_size,
        }),
        finalize: (id, lease) => call('finalizza_allegato_rapportino_desktop', {
          p_allegato_id: id, p_lease_id: lease,
        }),
      }
    },
  }
}
export const registroFotoDesktop = creaRegistroFotoDesktop()
