import { acquistiMaterialiDisponibili, valoriUniciOrdinati, type Fattura } from './suggerimentiMateriali'

export type RigaAttrezzaturaFatturaStorico = {
  id: string
  fattura_id: string
  descrizione: string
  categoria_economica: 'attrezzo_ditta'
  prezzo_unitario: number | null
}

type Attrezzatura = { descrizione?: string; fornitore?: string }

// Conserva il prezzo della riga e i dati della testata senza interpretare
// l'unità di noleggio né applicare prezzi automaticamente al form.
export function storicoAttrezzatureFatture(fatture: Fattura[], righe: RigaAttrezzaturaFatturaStorico[]) {
  const testate = new Map(fatture.filter((f) => f.id).map((f) => [f.id, f]))
  return righe.filter((r) => r.categoria_economica === 'attrezzo_ditta').map((r) => {
    const fattura = testate.get(r.fattura_id)
    return {
      rigaId: r.id,
      fatturaId: r.fattura_id,
      descrizione: (r.descrizione || '').trim(),
      prezzoUnitario: r.prezzo_unitario,
      dataFattura: fattura?.data_fattura,
      fornitore: fattura?.fornitore,
    }
  })
}

export function suggerimentiAttrezzature(
  attrezzature: Attrezzatura[], fatture: Fattura[], righe: RigaAttrezzaturaFatturaStorico[],
) {
  const storico = storicoAttrezzatureFatture(fatture, righe)
  const normalizza = (valore?: string) => valore?.trim().replace(/\s+/g, ' ')
  return {
    attrezzature: valoriUniciOrdinati([
      ...attrezzature.map((a) => normalizza(a.descrizione)),
      ...storico.map((r) => normalizza(r.descrizione)),
    ]),
    fornitori: valoriUniciOrdinati([
      ...attrezzature.map((a) => normalizza(a.fornitore)),
      ...storico.map((r) => normalizza(r.fornitore)),
    ]),
  }
}

// Adattamento in memoria al contratto della regola prezzi condivisa.
// La categoria persistita resta attrezzo_ditta: nessuna riclassificazione.
export function acquistiAttrezzatureDisponibili(fatture: Fattura[], righe: RigaAttrezzaturaFatturaStorico[]) {
  return acquistiMaterialiDisponibili(fatture, righe
    .filter((r) => r.categoria_economica === 'attrezzo_ditta')
    .map((r) => ({ ...r, descrizione: r.descrizione || '', categoria_economica: 'materiale_cantiere' })))
}
