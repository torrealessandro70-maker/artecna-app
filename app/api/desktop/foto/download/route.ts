import { capabilityFotoDesktop, creaLetturaHttpFotoDesktop } from '../../../../engines/rapportini/letturaFotoDesktop.server'
import { storageFotoV1Configurato } from '../../../../engines/rapportini/storageFotoV1.server'
export const runtime = 'nodejs'
// Configurazione assente -> 503 dopo il resolver autorizzato, nessun fallback pubblico.
export const GET = (req: Request) => creaLetturaHttpFotoDesktop({ capability: capabilityFotoDesktop, storage: storageFotoV1Configurato() })(req)
