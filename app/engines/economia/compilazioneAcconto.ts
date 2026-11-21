import type { RigaAcconto } from './accontiCantiere'

export type PropostaAcconto = { lordo: number; aliquota: number }
export type AccontoPersistito = RigaAcconto & { id: string; compilazione_unica?: {
  richiesta?: string; proposta?: PropostaAcconto | null; fonte?: unknown[]
} | null }
export type CampiAcconto = { descrizione: string; importo: string; data_incasso: string; metodo: string; nota: string }

export function centesimi(valore: string): number {
  const s = valore.trim().replace(',', '.')
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(s)) throw Error('Inserisci un importo positivo con al massimo due decimali.')
  const [interi, decimali = ''] = s.split('.')
  const n = Number(interi) * 100 + Number(decimali.padEnd(2, '0'))
  if (!Number.isSafeInteger(n) || n <= 0 || n >= 1e12) throw Error('Importo fuori limite.')
  return n
}

export function scorporoAcconto(lordo: string, aliquota: string) {
  if (!['0', '4', '5', '10', '22'].includes(aliquota)) throw Error('Seleziona esplicitamente l’aliquota IVA.')
  const totale = centesimi(lordo), divisore = BigInt(100 + Number(aliquota))
  const netto = Number((BigInt(totale) * BigInt(100) + divisore / BigInt(2)) / divisore)
  if (!netto) throw Error('Imponibile nullo.')
  return { imponibile: netto / 100, iva: (totale - netto) / 100, lordo: totale / 100, aliquota: Number(aliquota) }
}

export function campiAcconto(a: AccontoPersistito): CampiAcconto {
  return { descrizione: a.descrizione ?? '', importo: a.importo == null ? '' : String(a.importo),
    data_incasso: a.data_incasso ?? '', metodo: a.metodo ?? '', nota: a.nota ?? '' }
}

export function originaleAcconto(a: AccontoPersistito) {
  return [a.descrizione ?? null, a.importo == null ? null : Number(a.importo), a.data_incasso ?? null,
    a.metodo ?? null, a.nota ?? null, a.compilazione_unica?.richiesta ?? null]
}

export function modificheAcconto(campi: CampiAcconto, originale: AccontoPersistito | null) {
  const importo = originale && campi.importo === String(originale.importo ?? '')
    ? originale.importo == null ? null : Number(originale.importo) : centesimi(campi.importo) / 100
  const valori = { ...campi, importo, data_incasso: campi.data_incasso || null }
  return Object.fromEntries(Object.entries(valori).filter(([k, v]) => !originale ||
    (k === 'importo' ? (originale.importo == null ? null : Number(originale.importo)) !== v : (originale[k as keyof CampiAcconto] ?? '') !== (v ?? ''))))
}

export function propostaAcconto(a: AccontoPersistito): PropostaAcconto | null {
  const c = a.compilazione_unica, p = c?.proposta
  if (!p || JSON.stringify(c?.fonte) !== JSON.stringify([Number(a.importo), a.data_incasso ?? null, a.metodo ?? null])) return null
  try { return scorporoAcconto(String(p.lordo), String(p.aliquota)).imponibile === Number(a.importo) ? p : null }
  catch { return null }
}

export const metodoAcconto = (s?: string | null) => {
  const value = s?.trim().toLowerCase()
  return value === 'bonifico' || value === 'contanti' || value === 'altro' ? value : ''
}
