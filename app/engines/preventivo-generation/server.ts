import 'server-only'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { leggiFotoOsservatore } from '../variante-fonti/foto.server'
import { creaGeneratoreIntegrativo } from './servizio'

export const generaIntegrativo = creaGeneratoreIntegrativo({
  async authorize(token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw Error('Autenticazione non configurata')
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data, error } = await client.auth.getUser(token)
    if (error || !data.user) throw Error('Accesso richiesto')
    return {
      async read(id) { const r = await client.rpc('leggi_contesto_preventivo_integrativo', { p_variante_id: id }); if (r.error) throw r.error; return r.data },
      async prices() {
        const rows: unknown[] = []
        for (let from = 0; ; from += 500) {
          const r = await client.from('prezzi_lavorazioni').select('codice,descrizione,unita_misura,prezzo_unitario,fonte,regione,anno,versione,tipo_prezzo').order('codice').range(from, from + 499)
          if (r.error) throw r.error
          rows.push(...r.data); if (r.data.length < 500) return rows
        }
      },
    }
  },
  async photo(f, token) { const r = await leggiFotoOsservatore(f, token); return { immagine_base64: r.dataUrl, sha256: r.sha256 } },
  async generate(input) { return new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).responses.create(input) },
})
