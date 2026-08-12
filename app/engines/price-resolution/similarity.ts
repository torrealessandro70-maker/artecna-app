import { tokenizePriceDescription } from './normalizer'

export const calculateDescriptionSimilarity = (
  left?: string | null,
  right?: string | null,
): number => {
  const leftTokens = tokenizePriceDescription(left)
  const rightTokens = tokenizePriceDescription(right)

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0
  }

  const rightSet = new Set(rightTokens)

  const common = leftTokens.filter((token) =>
    rightSet.has(token),
  ).length

  return common / Math.max(leftTokens.length, rightTokens.length)
}