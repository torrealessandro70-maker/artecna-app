export type GruppoVariante = 'operative' | 'vuote' | 'altre' | 'approvate'

export const titoliGruppiVarianti: Record<GruppoVariante, string> = {
  operative: 'Varianti operative',
  vuote: 'Bozze senza lavorazioni — da verificare',
  altre: 'Altre varianti da verificare',
  approvate: 'Varianti approvate',
}

// Unknown is deliberately distinct from a successfully loaded empty detail.
export function gruppoVariante(stato: string, numeroLavorazioni?: number | null): GruppoVariante {
  if (stato === 'approvata') return 'approvate'
  const noto = typeof numeroLavorazioni === 'number' && Number.isSafeInteger(numeroLavorazioni) && numeroLavorazioni >= 0
  if (noto && ['bozza', 'proposta'].includes(stato) && numeroLavorazioni > 0) return 'operative'
  if (noto && stato === 'bozza' && numeroLavorazioni === 0) return 'vuote'
  return 'altre'
}
