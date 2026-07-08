import { classifyDocument } from './document-classifier'

export const runDocumentClassifierSmokeTest = () => {
  const results = {
    computo: classifyDocument('COMPUTO METRICO ESTIMATIVO importo lavori'),
    fattura: classifyDocument('Fattura elettronica totale documento partita iva'),
    sal: classifyDocument('Stato avanzamento lavori SAL n 1 percentuale avanzamento'),
    capitolato: classifyDocument('Capitolato speciale prescrizioni tecniche'),
    offerta: classifyDocument('Offerta economica totale offerta'),
    prezzario: classifyDocument('Prezzario Regione Siciliana codice articolo'),
    sconosciuto: classifyDocument('Documento generico senza parole chiave'),
  }

  return {
    success:
      results.computo === 'computo' &&
      results.fattura === 'fattura' &&
      results.sal === 'sal' &&
      results.capitolato === 'capitolato' &&
      results.offerta === 'offerta' &&
      results.prezzario === 'prezzario' &&
      results.sconosciuto === 'sconosciuto',
    results,
  }
}