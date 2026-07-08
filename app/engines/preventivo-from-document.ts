export type VoceDocumentoAnalizzata = {
  descrizione: string
  quantita?: number
  unita?: string
  prezzo?: number
}

export type VocePreventivoDaDocumento = {
  descrizione: string
  quantita: number
  unita_misura: string
  prezzo_unitario: number
  totale: number
  fonte: 'documento'
}

export function creaVociPreventivoDaDocumento(
  voci: VoceDocumentoAnalizzata[]
): VocePreventivoDaDocumento[] {
  return (voci || [])
    .filter((voce) => voce.descrizione)
    .map((voce) => {
      const quantita = Number(voce.quantita || 1)
      const prezzo = Number(voce.prezzo || 0)

      return {
        descrizione: voce.descrizione,
        quantita,
        unita_misura: voce.unita || 'a.c.',
        prezzo_unitario: prezzo,
        totale: quantita * prezzo,
        fonte: 'documento',
      }
    })
}
