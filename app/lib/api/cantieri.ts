import { supabase } from '../supabase'
import { Cantiere } from '@/app/types'

// 🔹 CARICA
export const caricaCantieri = async (): Promise<Cantiere[]> => {
  const { data, error } = await supabase
    .from('cantieri')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []) as Cantiere[]
}

// 🔹 AGGIUNGI
export const aggiungiCantiereDB = async (
  nome: string,
  preventivo: number
) => {
  const { error } = await supabase
    .from('cantieri')
    .insert([{ nome, preventivo }])

  if (error) throw error
}