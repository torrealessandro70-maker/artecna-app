import type { PreventivoReviewIssue, PreventivoRevision } from './types'

const creaIssueId = (index: number) => `issue-${index + 1}`

export const buildPreventivoReviewIssues = (
  revision: PreventivoRevision,
): PreventivoReviewIssue[] => {
  const issues: PreventivoReviewIssue[] = []

  revision.voci.forEach((voce) => {
    if (!voce.descrizione.trim()) {
      issues.push({
        id: creaIssueId(issues.length),
        severity: 'critical',
        title: 'Descrizione mancante',
        description: 'Una voce del preventivo non contiene una descrizione.',
        voceId: voce.id,
      })
    }

    if (voce.quantita <= 0) {
      issues.push({
        id: creaIssueId(issues.length),
        severity: 'warning',
       title: 'Unità di misura mancante',
description: 'La voce non contiene una unità di misura.',
        voceId: voce.id,
      })
    }

  if (voce.prezzoUnitario <= 0) {
  issues.push({
    id: creaIssueId(issues.length),
    severity: 'warning',
    title: 'Prezzo non disponibile',
    description:
      'Nessun prezzo unitario valido è stato trovato. Inserisci il prezzo manualmente oppure collega una base prezzi.',
    voceId: voce.id,
  })
}

    if (!voce.unitaMisura) {
      issues.push({
        id: creaIssueId(issues.length),
        severity: 'info',
        title: 'Unità di misura mancante',
        description: 'La voce non contiene una unità di misura.',
        voceId: voce.id,
      })
    }
  })

  return issues
}

export const buildPreventivoRevisionReview = (
  revision: PreventivoRevision,
): PreventivoRevision => ({
  ...revision,
  issues: buildPreventivoReviewIssues(revision),
})