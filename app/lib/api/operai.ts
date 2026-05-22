
import { supabase } from '../supabase'
import { Operaio } from '@/app/types'

// 🔹 CARICA OPERAI
export const caricaOperai = async (): Promise<Operaio[]> => {
  const { data, error } = await supabase
    .from('operai')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []) as Operaio[]
}

// 🔹 AGGIUNGI OPERAIO
export const aggiungiOperaioDB = async (operaio: Partial<Operaio>) => {
  const { error } = await supabase
    .from('operai')
    .insert([operaio])

  if (error) throw error
}