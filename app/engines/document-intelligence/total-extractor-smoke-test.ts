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

import { parsePreventivoItems } from './preventivo-items'
import { extractOfferAmounts } from './offer-amounts'

export const runArtecnaPdfRegressionTest = () => {
  const parseNumber = (value: string) => Number(value.replace(/€/g, '').trim().replace(/\./g, '').replace(',', '.'))
  const check = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message)
  }
  // Representative fixture, not a transcription of the unavailable full PDF.
  // Only the supplied economic examples are real; other rows are synthetic.
  const lines = Array.from({ length: 19 }, (_, index) => {
    const n = index + 1
    const description = n === 1 ? 'Bonifica della soletta superiore: ripristino in 3 strati da 2 cm' :
      n === 12 ? 'Ripristino frontalino con 4 passaggi' : 'Lavorazione rappresentativa con 2 passaggi'
    const tail = n === 1 ? 'm² 72,40 € 28,00 € 2.027,20' :
      n === 2 ? 'm² 72,40 € 27,00 € 1.954,80' :
      n === 5 ? 'ml 40,30 € 18,00 € 725,40' :
      n === 16 ? 'corpo 1,00 € 400,00 € 400,00' :
      n === 19 ? 'corpo 1,00 € 600,00 € 600,00' : 'm² 2,00 € 10,00 € 20,00'
    return (n === 12 ? 'ARTECNA - OFFERTA TECNICO ECONOMICA ARTECNA - Impresa Edile Via Roma 45 P.IVA 12345678901 Telefono 0911234567 Ripristino completo balconi ammalorati ' : '') + n + ' ' + description + ' ' + tail
  })
  const text = 'PREVENTIVO ARTECNA ' + lines.join(' ') + ' € 28.405,40 TOTALE OFFERTA IVA ESCLUSA'
  const rows = parsePreventivoItems(text, parseNumber)
  check(rows.length === 19, 'Expected 19 structured rows')
  for (const [index, unit, quantity, price, total] of [
    [0, 'm²', 72.4, 28, 2027.2], [4, 'ml', 40.3, 18, 725.4],
    [15, 'corpo', 1, 400, 400], [18, 'corpo', 1, 600, 600],
  ] as const) {
    const row = rows[index]
    check(row.unita === unit && row.quantita === quantity && row.prezzo === price && row.totale === total, 'Incorrect row ' + (index + 1))
    check(row.importoCoerente === true, 'Coherence lost for row ' + (index + 1))
  }
  check(rows[0].descrizione.startsWith('Bonifica della soletta superiore:'), 'First description lost')
  check(rows[11].descrizione === 'Ripristino frontalino con 4 passaggi', 'Page header leaked into row 12')
  check(rows.slice(9, 12).length === 3 && rows.every(row => !/ARTECNA|P\.IVA|Telefono|Via Roma/.test(row.descrizione)), 'Header leaked into descriptions')
  check(extractDocumentTotal(text) === 28405.4, 'Incorrect document total')
  check(parsePreventivoItems(text.replace(/€/g, ''), parseNumber).length === 19, 'Optional currency regression')
  check(parsePreventivoItems('Posa | mq | 2,00 | 10,00 | 20,00', parseNumber)[0]?.totale === 20, 'Pipe format regression')
  check(parsePreventivoItems('1 Posa mq 2,00 10,00 € 20,00 € 2 Finitura cad 1,00 3,00 3,00', parseNumber).length === 2, 'Legacy currency regression')
  check(parsePreventivoItems('1 Finitura m² 3,00 € 0,333 € 1,00', parseNumber)[0]?.importoCoerente === true, 'Small rounding difference rejected')
  check(parsePreventivoItems('Via Roma 45 P.IVA 12345678901 Telefono 0911234567 20 cm', parseNumber).length === 0, 'Metadata created items')
  for (const label of ['TOTALE OFFERTA IVA ESCLUSA', 'TOTALE LAVORI (IVA esclusa)']) {
    check(extractOfferAmounts('€ 28.405,40 ' + label).imponibile?.value === 28405.4, 'Preceding total: ' + label)
    check(extractOfferAmounts(label + ' € 28.405,40').imponibile?.value === 28405.4, 'Following total: ' + label)
    check(!extractOfferAmounts('1 Finitura corpo 1,00 € 600,00 € 600,00 ' + label).imponibile, 'Item total mistaken for document total')
  }
  check(!extractOfferAmounts('€ 600,00 TOTALE').totaleDocumento, 'Weak label bound a preceding amount')
  check(!extractOfferAmounts('Acconto € 600,00 TOTALE OFFERTA IVA ESCLUSA').imponibile, 'Payment mistaken for total')
  check(extractOfferAmounts('Totale IVA esclusa 1.000,00 € IVA 22% 220,00 € Totale IVA inclusa 1.220,00 €').imponibile?.value === 1000, 'Existing net/VAT format regression')
  check(extractOfferAmounts('€ 28.405,40 TOTALE OFFERTA IVA ESCLUSA Imponibile 600,00').imponibile?.value === 28405.4, 'Strong net label lost priority')
  return { success: true, rows: rows.length, total: extractDocumentTotal(text) }
}
