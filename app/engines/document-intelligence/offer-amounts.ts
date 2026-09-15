export type OfferAmount = { value: number; label: string; source: string; evidence?: string }
export type OfferAmounts = {
  imponibile?: OfferAmount
  iva?: OfferAmount
  totaleDocumento?: OfferAmount
  pagamenti: { acconto: OfferAmount[]; avanzamento: OfferAmount[]; saldo: OfferAmount[] }
  sommaVoci?: number
  sommaCoerente?: boolean
  scartoSommaVoci?: number
  relazioneIvaCoerente?: boolean
}

const moneyPattern = /(?<![\d.,])(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}(?!\d|\s*%)/g
const parseMoney = (value: string) => Number(value.replace(/\./g, '').replace(',', '.'))
const close = (a: number, b: number) => Math.abs(a - b) <= 0.05

// Labels delimit semantic spans even when PDF text is one continuous line.
export function extractOfferAmounts(text: string, itemsTotal?: number): OfferAmounts {
  const flat = text.replace(/\s+/g, ' ').trim()
  const labels = [...flat.matchAll(/\b(?:totale(?:\s+(?:offerta|lavorazioni|lavori|opere|imponibile|documento|generale|complessivo|preventivo|da pagare))?(?:\s+iva\s+(?:esclusa|inclusa|compresa))?|importo\s+(?:complessivo|netto|lavori)(?:\s+iva\s+esclusa)?|imponibile|iva(?:\s+al)?(?:\s+\d+(?:[.,]\d+)?\s*%)?|acconto(?:\s+iniziale)?|stato\s+avanzamento\s+lavori|s\.?a\.?l\.?|saldo(?:\s+finale)?)(?=[\s:€]|$)/gi)]
  const result: OfferAmounts = { pagamenti: { acconto: [], avanzamento: [], saldo: [] } }
  const detachedNetLabels: string[] = []
  let beforeVat: OfferAmount | undefined
  const paymentPositions = new Set<number>()
  labels.forEach((match, index) => {
    const label = match[0]
    const lower = label.toLowerCase()
    const after = flat.slice(match.index! + label.length, labels[index + 1]?.index ?? flat.length)
    const amount = [...after.matchAll(moneyPattern)][0]
    // Do not cross prose sections to attach unrelated later prices to a label.
    const nearby = amount && amount.index! <= 80
    const isNet = /esclusa|imponibile|lavorazioni|lavori|opere|netto/.test(lower) && !/avanzamento/.test(lower)
    if (!nearby) {
      if (isNet) detachedNetLabels.push(label)
      return
    }
    const entry: OfferAmount = { value: parseMoney(amount[0]), label, source: label + after.slice(0, amount.index! + amount[0].length) }
    if (/^acconto|^saldo|avanzamento|^s\.?a\.?l/.test(lower)) {
      paymentPositions.add(match.index! + label.length + amount.index!)
    }
    if (/^acconto/.test(lower)) result.pagamenti.acconto.push(entry)
    else if (/^saldo/.test(lower)) result.pagamenti.saldo.push(entry)
    else if (/avanzamento|^s\.?a\.?l/.test(lower)) result.pagamenti.avanzamento.push(entry)
    else if (/^iva/.test(lower)) {
      result.iva = entry
      const before = flat.slice(0, match.index)
      const prior = [...before.matchAll(moneyPattern)].pop()
      if (prior && !paymentPositions.has(prior.index!) && /^[\s€]*$/.test(before.slice(prior.index! + prior[0].length))) {
        beforeVat = { value: parseMoney(prior[0]), label: '', source: prior[0] }
      }
    } else if (isNet) result.imponibile = entry
    else result.totaleDocumento = entry
  })
  // A detached net label needs numeric corroboration, never proximity alone.
  if (!result.imponibile && beforeVat && detachedNetLabels.length && result.iva && result.totaleDocumento &&
      close(beforeVat.value + result.iva.value, result.totaleDocumento.value)) {
    result.imponibile = { ...beforeVat, label: detachedNetLabels[0], evidence: 'Importo prima dell’IVA; imponibile + IVA = totale documento; etichetta separata.' }
  }
  if (result.imponibile && result.iva && result.totaleDocumento) {
    result.relazioneIvaCoerente = close(result.imponibile.value + result.iva.value, result.totaleDocumento.value)
  }
  if (itemsTotal !== undefined) {
    result.sommaVoci = Math.round(itemsTotal * 100) / 100
    if (result.imponibile) {
      result.scartoSommaVoci = Math.round((result.sommaVoci - result.imponibile.value) * 100) / 100
      // Small accumulated rounding differences are evidence, not corrections.
      result.sommaCoerente = Math.abs(result.scartoSommaVoci) <= Math.max(0.05, Math.abs(result.imponibile.value) * 0.0001)
    }
  }
  return result
}
