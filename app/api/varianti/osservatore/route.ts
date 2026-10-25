import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { analizzaNotaOsservatore } from '../../../engines/osservatore/analizza'
import { creaServizioOsservatoreVariante, ErroreOsservatore } from '../../../engines/variante-fonti/servizio'
import { leggiFotoOsservatore } from '../../../engines/variante-fonti/foto.server'
import { salvaOsservatoreVariantePostgres } from '../../../engines/rapportini/adapterPortalePostgres.server'

export const runtime = 'nodejs'
export const POST = creaServizioOsservatoreVariante({
  async authorize(token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new ErroreOsservatore(503, 'Autenticazione non configurata')
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data, error } = await client.auth.getUser(token)
    if (error || !data.user) throw new ErroreOsservatore(401, 'Accesso richiesto')
    return { userId: data.user.id, async read(variante) {
      const r = await client.rpc('leggi_osservatore_variante', { p_variante_id: variante })
      if (r.error) throw r.error
      return r.data
    } }
  },
  photo: leggiFotoOsservatore,
  async analyze(input) {
    if (!process.env.OPENAI_API_KEY) throw new ErroreOsservatore(503, 'Osservatore non configurato')
    return analizzaNotaOsservatore(input, new OpenAI({ apiKey: process.env.OPENAI_API_KEY }))
  },
  save: salvaOsservatoreVariantePostgres,
})
