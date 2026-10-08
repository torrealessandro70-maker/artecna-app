import { capabilityFotoDesktop, creaLetturaHttpFotoDesktop } from '../../../engines/rapportini/letturaFotoDesktop.server'
export const runtime = 'nodejs'
export const GET = creaLetturaHttpFotoDesktop({ capability: capabilityFotoDesktop })
