import { resolveByExactCode } from './exact-code'
import { resolveByNormalizedCode } from './normalized-code'
import { resolveByDescriptionAndUnit } from './description-unit'
import { resolveByDescription } from './description'
import { resolveBySimilarity } from './similarity'

export const priceResolutionStrategies = [
  resolveByExactCode,
  resolveByNormalizedCode,
  resolveByDescriptionAndUnit,
  resolveByDescription,
  resolveBySimilarity,
]
