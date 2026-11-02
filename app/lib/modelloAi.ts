export const modelliAiSelezionabili = [
  { id: 'gpt-4.1-mini', nome: 'GPT-4.1 Mini' },
  { id: 'gpt-6.1-sol', nome: 'GPT-6.1 Sol' },
] as const

export const headerModelloAi = 'X-Artecna-Modello-AI'

export function normalizzaModelloAi(valore?: unknown) {
  return modelliAiSelezionabili.find(modello => modello.id === valore)?.id ?? modelliAiSelezionabili[0].id
}
