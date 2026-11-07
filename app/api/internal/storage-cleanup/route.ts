import 'server-only'
import { storageCleanupPOST } from '../../../engines/cantiere-delete/storageEntrypoint.server'

export const runtime = 'nodejs'
export const maxDuration = 60
export const POST = storageCleanupPOST
