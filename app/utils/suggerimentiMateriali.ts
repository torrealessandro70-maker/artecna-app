type Materiale = { descrizione?: string; fornitore?: string }
export type Fattura = { id?: string; fornitore?: string; data_fattura?: string; numero_fattura?: string }
export type RigaFattura = { id?: string; fattura_id?: string; descrizione: string; categoria_economica?: string; prezzo_unitario?: number | null; quantita?: number }

export type RigaMaterialeFatturaStorico = {
  id: string
  fattura_id: string
  descrizione: string
  categoria_economica: 'materiale_cantiere'
  prezzo_unitario: number | null
}

export function valoriUniciOrdinati(valori: (string | undefined)[]): string[] {
  const unici = new Map<string, string>()
  for (const valore of valori) {
    const nome = (valore ?? '').trim()
    const chiave = nome.toLocaleLowerCase('it-IT')
    if (nome && !unici.has(chiave)) unici.set(chiave, nome)
  }
  return [...unici.values()].sort((a, b) => a.localeCompare(b, 'it'))
}

export function suggerimentiMateriali(
  materiali: Materiale[], fatture: Fattura[], righeFattura: RigaFattura[],
) {
  return {
    materiali: valoriUniciOrdinati([
      ...materiali.map((m) => m.descrizione),
      ...righeFattura.filter((r) => r.categoria_economica === 'materiale_cantiere').map((r) => r.descrizione),
    ]),
    fornitori: valoriUniciOrdinati([
      ...fatture.map((f) => f.fornitore),
      ...materiali.map((m) => m.fornitore),
    ]),
  }
}

export type AcquistoMateriale = {
  descrizione: string
  prezzoUnitario: number
  dataFattura: string
  fornitore?: string
  quantita?: number
  rigaId?: string
  fatturaId: string
  numeroFattura?: string
}

export function acquistiMaterialiDisponibili(fatture: Fattura[], righe: RigaFattura[]): AcquistoMateriale[] {
  return righe.flatMap((riga) => {
    const fattura = fatture.find((f) => Boolean(riga.fattura_id) && f.id === riga.fattura_id)
    if (riga.categoria_economica !== 'materiale_cantiere' || !riga.descrizione.trim() ||
        typeof riga.prezzo_unitario !== 'number' || !Number.isFinite(riga.prezzo_unitario) ||
        !fattura?.id || !fattura.data_fattura || !/^\d{4}-\d{2}-\d{2}$/.test(fattura.data_fattura)) return []
    return [{
      descrizione: riga.descrizione.trim(), prezzoUnitario: riga.prezzo_unitario,
      dataFattura: fattura.data_fattura, fornitore: fattura.fornitore, quantita: riga.quantita,
      rigaId: riga.id, fatturaId: fattura.id, numeroFattura: fattura.numero_fattura,
    }]
  })
}

export function ultimoPrezzoMateriale(descrizione: string, acquisti: AcquistoMateriale[]): number | undefined {
  const corrispondenti = acquisti.filter((a) =>
    a.descrizione.toLocaleLowerCase('it-IT') === descrizione.trim().toLocaleLowerCase('it-IT')
  ).sort((a, b) => b.dataFattura.localeCompare(a.dataFattura))
  const ultimo = corrispondenti[0]
  if (!ultimo) return undefined
  // Prezzi diversi nella stessa data: manca l'informazione per scegliere l'ultimo.
  if (corrispondenti.some((a) => a.dataFattura === ultimo.dataFattura && a.prezzoUnitario !== ultimo.prezzoUnitario)) return undefined
  return ultimo.prezzoUnitario
}
