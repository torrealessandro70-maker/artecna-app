const punctuationSuffix = (text: string) =>
  text.match(/[.,;:!?]+$/u)?.[0] || ''

const comparisonKey = (text: string) =>
  text
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .toLocaleLowerCase('it-IT')

const preserveTrailingPunctuation = (kept: string, removed: string) => {
  if (punctuationSuffix(kept)) return kept
  return `${kept}${punctuationSuffix(removed)}`
}

const cleanRepeatedWordsAndPhrases = (text: string) => {
  const words = text.split(' ').filter(Boolean)
  const withoutRepeatedWords: string[] = []

  for (const word of words) {
    const previousIndex = withoutRepeatedWords.length - 1
    const previous = withoutRepeatedWords[previousIndex]

    if (
      previous &&
      comparisonKey(previous) &&
      comparisonKey(previous) === comparisonKey(word)
    ) {
      withoutRepeatedWords[previousIndex] = preserveTrailingPunctuation(
        previous,
        word
      )
      continue
    }

    withoutRepeatedWords.push(word)
  }

  let index = 0

  while (index < withoutRepeatedWords.length) {
    const maxPhraseLength = Math.floor(
      (withoutRepeatedWords.length - index) / 2
    )
    let duplicateLength = 0

    for (let length = maxPhraseLength; length >= 2; length--) {
      const first = withoutRepeatedWords
        .slice(index, index + length)
        .map(comparisonKey)
      const second = withoutRepeatedWords
        .slice(index + length, index + length * 2)
        .map(comparisonKey)

      if (
        first.every(Boolean) &&
        first.every((word, wordIndex) => word === second[wordIndex])
      ) {
        duplicateLength = length
        break
      }
    }

    if (!duplicateLength) {
      index++
      continue
    }

    const keptLastIndex = index + duplicateLength - 1
    const removedLastIndex = index + duplicateLength * 2 - 1
    withoutRepeatedWords[keptLastIndex] = preserveTrailingPunctuation(
      withoutRepeatedWords[keptLastIndex],
      withoutRepeatedWords[removedLastIndex]
    )
    withoutRepeatedWords.splice(index + duplicateLength, duplicateLength)
  }

  return withoutRepeatedWords.join(' ')
}

export function cleanDictationText(text: string): string {
  const normalized = text
    .replace(/\s+/gu, ' ')
    .replace(/\s+([,.;:!?])/gu, '$1')
    .trim()

  if (!normalized) return ''

  const sentences = normalized.match(/[^.!?;]+[.!?;]*/gu) || [normalized]
  const cleanedSentences: string[] = []
  let previousKey = ''

  for (const sentence of sentences) {
    const cleaned = cleanRepeatedWordsAndPhrases(sentence.trim())
    const key = comparisonKey(cleaned)

    if (!key || key === previousKey) continue

    cleanedSentences.push(cleaned)
    previousKey = key
  }

  return cleanedSentences.join(' ')
}
