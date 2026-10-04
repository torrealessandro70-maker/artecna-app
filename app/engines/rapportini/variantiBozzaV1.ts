import type { VarianteRapportinoPortale } from './contrattoServizio'

export type StatoVariantiBozza = {
  cantiere_id: string
  stato: 'non_caricate' | 'caricamento' | 'pronte' | 'errore'
  varianti: readonly VarianteRapportinoPortale[]
}

/** Conserva anche le varianti storiche non selezionabili, senza espandere il DTO. */
export function validaRispostaVariantiBozza(value: unknown): readonly VarianteRapportinoPortale[] {
  const rows = (value as { varianti?: unknown } | null)?.varianti
  if (!Array.isArray(rows)) throw new Error('Risposta Varianti non valida')
  const ids = new Set<string>()
  return rows.map(v => {
    if (!v || typeof v.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.id)
      || ids.has(v.id) || (v.numero !== null && !Number.isInteger(v.numero))
      || typeof v.etichetta !== 'string' || typeof v.selezionabile !== 'boolean') {
      throw new Error('Risposta Varianti non valida')
    }
    ids.add(v.id)
    return { id: v.id, numero: v.numero, etichetta: v.etichetta, selezionabile: v.selezionabile }
  })
}

export function etichettaVarianteBozza(v: VarianteRapportinoPortale): string {
  return (v.numero === null ? 'Variante' : `Variante n. ${v.numero}`) + ' — ' + v.etichetta
}
