import { getConfidenceBadge } from '../confidence'
import type {
  PreventivoQualityLevel,
  PreventivoQualitySummary,
} from './types'

type PreventivoQualityVoice = {
  priceResolution?: {
    confidence?: number
  }
}

const resolveQualityLevel = (
  score: number,
): {
  level: PreventivoQualityLevel
  label: string
} => {
  if (score >= 95) {
    return {
      level: 'excellent',
      label: 'Qualità eccellente',
    }
  }

  if (score >= 85) {
    return {
      level: 'good',
      label: 'Qualità affidabile',
    }
  }

  if (score >= 70) {
    return {
      level: 'review',
      label: 'Verifica consigliata',
    }
  }

  if (score >= 50) {
    return {
      level: 'weak',
      label: 'Qualità debole',
    }
  }

  return {
    level: 'critical',
    label: 'Revisione necessaria',
  }
}

export const buildPreventivoQuality = (
  voci: PreventivoQualityVoice[],
): PreventivoQualitySummary => {
  const summary = {
    perfect: 0,
    reliable: 0,
    review: 0,
    weak: 0,
    none: 0,
  }

  let confidenceTotal = 0

  voci.forEach((voce) => {
    const confidencePercent =
      Number(voce.priceResolution?.confidence || 0) * 100

    const badge = getConfidenceBadge(confidencePercent)

    summary[badge.level] += 1
    confidenceTotal += confidencePercent
  })

  const total = voci.length

  const score =
    total > 0
      ? Number((confidenceTotal / total).toFixed(1))
      : 0

  const reviewNeeded =
    summary.review +
    summary.weak +
    summary.none

  const quality = resolveQualityLevel(score)

  return {
    ...summary,
    total,
    reviewNeeded,
    score,
    level: quality.level,
    label: quality.label,
  }
}
