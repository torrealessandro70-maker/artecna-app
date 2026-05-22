import { supabase } from '../supabase'

// 🔹 CARICA PAGAMENTI
export const caricaPagamentiOperai = async () => {
  const { data, error } = await supabase
    .from('pagamenti_operai')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  return data || []
}

// 🔹 AGGIUNGI PAGAMENTO
export const aggiungiPagamentoOperaioDB = async (pagamento: any) => {
  const { error } = await supabase
    .from('pagamenti_operai')
    .insert([pagamento])

  if (error) throw error
}