import { extractDocumentTotal } from './total-extractor'

export const runDocumentTotalExtractorSmokeTest = () => {
  const computo = extractDocumentTotal(`
    COMPUTO METRICO ESTIMATIVO
    Demolizioni € 1.200,00
    Murature € 3.400,00
    TOTALE LAVORI € 4.600,00
  `)

  const offerta = extractDocumentTotal(`
    OFFERTA ECONOMICA
    Totale IVA esclusa 31.438,40 €
    IVA 10% 3.143,84 €
    Totale IVA inclusa 34.582,24 €
  `)

  const fattura = extractDocumentTotal(`
    FATTURA
    Imponibile 1.000,00 €
    IVA 220,00 €
    Totale documento 1.220,00 €
  `)

  return {
    success:
      computo === 4600 &&
      offerta === 31438.4 &&
      fattura === 1220,
    results: {
      computo,
      offerta,
      fattura,
    },
  }
}