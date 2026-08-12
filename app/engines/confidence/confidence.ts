import type { ConfidenceBadge } from './types'

export const getConfidenceBadge = (
  confidence: number,
): ConfidenceBadge => {
  if (confidence >= 95) {
    return {
      level: 'perfect',
      icon: '🟢',
      label: 'Match perfetto',
      color: '#16a34a',
      description: 'Corrispondenza esatta.',
      reviewNeeded: false,
    }
  }

  if (confidence >= 85) {
    return {
      level: 'reliable',
      icon: '🟢',
      label: 'Match affidabile',
      color: '#22c55e',
      description: 'Corrispondenza affidabile.',
      reviewNeeded: false,
    }
  }

  if (confidence >= 70) {
    return {
      level: 'review',
      icon: '🟡',
      label: 'Da verificare',
      color: '#eab308',
      description: 'Controllo consigliato.',
      reviewNeeded: true,
    }
  }

  if (confidence >= 50) {
    return {
      level: 'weak',
      icon: '🟠',
      label: 'Match debole',
      color: '#f97316',
      description: 'Possibile corrispondenza.',
      reviewNeeded: true,
    }
  }

  return {
    level: 'none',
    icon: '🔴',
    label: 'Nessuna corrispondenza affidabile',
    color: '#dc2626',
    description: 'Verifica manuale necessaria.',
    reviewNeeded: true,
  }
}
