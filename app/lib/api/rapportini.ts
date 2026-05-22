import { supabase } from '../supabase'

// 🔹 CARICA RAPPORTINI
export const caricaRapportini = async () => {
  const { data, error } = await supabase
    .from('rapportini')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  return data || []
}

// 🔹 AGGIUNGI RAPPORTINO (se ti serve dopo)
export const aggiungiRapportinoDB = async (rapportino: any) => {
  const { error } = await supabase
    .from('rapportini')
    .insert([rapportino])

  if (error) throw error
}