import { creaHttpFotoV1 } from '../../../engines/rapportini/servizioFotoV1.server'
import { registroFotoMobile } from '../../../engines/rapportini/registroFotoMobile.server'
import { registroFotoDesktop } from '../../../engines/rapportini/registroFotoDesktop.server'
import { storageFotoV1Configurato } from '../../../engines/rapportini/storageFotoV1.server'

export const runtime = 'nodejs'
// Configurazione assente -> 503 dopo autorizzazione e prima della prenotazione.
export const POST = (req: Request) => creaHttpFotoV1({ mobile: registroFotoMobile, desktop: registroFotoDesktop, storage: storageFotoV1Configurato() })(req)
