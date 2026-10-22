import { createClient } from '@supabase/supabase-js'

function configurazioneDesktop() {
  const mode = process.env.NEXT_PUBLIC_ARTECNA_LAB_MODE
  if (mode === undefined || mode === '' || mode === 'false') {
    return { url: 'https://axuiaiglbahygsmeoypy.supabase.co', key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4dWlhaWdsYmFoeWdzbWVveXB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1OTY5ODYsImV4cCI6MjA5MjE3Mjk4Nn0.UU0rZN-8utUUXiuQHfkh-Z9sbhNmfpnJBsGMBqhzSIg' }
  }
  if (mode !== 'true') throw new Error('Configurazione laboratorio Supabase non valida')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  try {
    if (url !== 'https://rzeybsdddqsumdezkpxv.supabase.co' || !key) throw new Error()
    const parts = key.split('.')
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error()
    const decode = (part: string) => JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    const header = decode(parts[0]), claims = decode(parts[1])
    // Controllo di configurazione: la firma viene verificata dal servizio Supabase.
    if (header.alg !== 'HS256' || claims.role !== 'anon' || claims.ref !== 'rzeybsdddqsumdezkpxv') throw new Error()
    return { url, key }
  } catch {
    throw new Error('Configurazione laboratorio Supabase non valida')
  }
}

const config = configurazioneDesktop()
export const supabase = createClient(config.url, config.key)
