import type { SupabaseClient } from '@supabase/supabase-js'

export const LINK_PORTALE_PREDEFINITO = '/rapportino'
export type ClientLinkPortale = Pick<SupabaseClient, 'rpc'>
export type ConfigLinkPortale = { url: string | null; configurato: boolean; modificabile: boolean }

/** Percorsi relativi all'origine corrente oppure HTTPS, mai credenziali o schemi eseguibili. */
export function validaLinkPortale(valore: unknown): string {
  if (typeof valore !== 'string' || !valore.trim()) throw Error('Link mancante: indicare il percorso del Portale Rapportini Mobile.')
  const testo = valore.trim()
  if (testo.length > 2048 || /[\s\\]/.test(testo) || [...testo].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) throw Error('Link non valido: spazi e caratteri di controllo non sono ammessi.')
  try {
    const relativo = testo.startsWith('/') && !testo.startsWith('//')
    const u = new URL(testo, 'https://artecna.invalid')
    if (u.username || u.password || (!relativo && !testo.toLowerCase().startsWith('https://')) || (relativo && u.origin !== 'https://artecna.invalid') || u.protocol !== 'https:') throw Error()
    return relativo ? u.pathname + u.search + u.hash : u.href
  } catch { throw Error('Link non valido: usare un percorso interno come /rapportino oppure un URL HTTPS senza credenziali.') }
}

function configValida(data: unknown): data is ConfigLinkPortale {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (typeof d.url === 'string' || d.url === null) && typeof d.configurato === 'boolean' && typeof d.modificabile === 'boolean'
}
export async function leggiLinkPortale(client: ClientLinkPortale): Promise<ConfigLinkPortale> {
  const r = await client.rpc('leggi_link_rapportini_mobile')
  if (r.error || !configValida(r.data)) throw Error('Impostazioni condivise non disponibili: è utilizzato il percorso interno /rapportino. La modifica richiede il servizio di configurazione autorizzato.')
  return r.data
}
export async function salvaLinkPortale(client: ClientLinkPortale, valore: string): Promise<ConfigLinkPortale> {
  const url = validaLinkPortale(valore)
  const r = await client.rpc('salva_link_rapportini_mobile', { p_url: url })
  if (r.error) throw Error(`Salvataggio link non confermato${r.error.code ? ` (${r.error.code})` : ''}. Rileggere le impostazioni prima di ripetere il salvataggio.`)
  if (!configValida(r.data) || r.data.url !== url) throw Error('Risposta di salvataggio non coerente: rileggere le impostazioni.')
  return r.data
}
