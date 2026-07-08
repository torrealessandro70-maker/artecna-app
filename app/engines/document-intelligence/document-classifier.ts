export type DocumentKind =
  | 'computo'
  | 'preventivo'
  | 'fattura'
  | 'sal'
  | 'capitolato'
  | 'offerta'
  | 'prezzario'
  | 'sconosciuto'

type DocumentKindScore = {
  kind: DocumentKind
  score: number
}

const normalizzaDocumento = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ')

const addScore = (
  scores: Record<DocumentKind, number>,
  kind: DocumentKind,
  amount: number,
) => {
  scores[kind] += amount
}

export const classifyDocument = (text: string): DocumentKind => {
  const normalized = normalizzaDocumento(text)

  const scores: Record<DocumentKind, number> = {
    computo: 0,
    preventivo: 0,
    fattura: 0,
    sal: 0,
    capitolato: 0,
    offerta: 0,
    prezzario: 0,
    sconosciuto: 0,
  }

  if (normalized.includes('computo metrico')) addScore(scores, 'computo', 100)
  if (normalized.includes('computo metrico estimativo')) {
    addScore(scores, 'computo', 120)
  }
  if (normalized.includes('elenco prezzi')) addScore(scores, 'computo', 45)
  if (normalized.includes('quadro economico')) addScore(scores, 'computo', 35)
  if (normalized.includes('importo lavori')) addScore(scores, 'computo', 30)

  if (normalized.includes('preventivo')) addScore(scores, 'preventivo', 90)
  if (normalized.includes('offerta economica')) addScore(scores, 'offerta', 100)
  if (normalized.includes('totale offerta')) addScore(scores, 'offerta', 80)

  if (normalized.includes('fattura')) addScore(scores, 'fattura', 100)
  if (normalized.includes('fattura elettronica')) addScore(scores, 'fattura', 120)
  if (normalized.includes('totale documento')) addScore(scores, 'fattura', 50)
  if (normalized.includes('partita iva')) addScore(scores, 'fattura', 35)

  if (normalized.includes('stato avanzamento lavori')) addScore(scores, 'sal', 120)
  if (normalized.includes('s.a.l.')) addScore(scores, 'sal', 120)
  if (normalized.includes('sal n')) addScore(scores, 'sal', 80)
  if (normalized.includes('percentuale avanzamento')) addScore(scores, 'sal', 50)

  if (normalized.includes('capitolato')) addScore(scores, 'capitolato', 100)
  if (normalized.includes('capitolato speciale')) addScore(scores, 'capitolato', 120)
  if (normalized.includes('prescrizioni tecniche')) {
    addScore(scores, 'capitolato', 50)
  }

  if (normalized.includes('prezzario')) addScore(scores, 'prezzario', 100)
  if (normalized.includes('regione siciliana')) addScore(scores, 'prezzario', 50)
  if (normalized.includes('codice articolo')) addScore(scores, 'prezzario', 40)

  const ordered = (Object.entries(scores) as [DocumentKind, number][])
    .map(([kind, score]): DocumentKindScore => ({ kind, score }))
    .sort((a, b) => b.score - a.score)

  const best = ordered[0]

  if (!best || best.score <= 0) return 'sconosciuto'

  return best.kind
}