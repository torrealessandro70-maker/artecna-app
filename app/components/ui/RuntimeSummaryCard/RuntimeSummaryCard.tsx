'use client'

import React from 'react'
import { Card } from '../Card'
import styles from './RuntimeSummaryCard.module.css'

type RuntimeSummaryCardProps = {
  observed: string[]
  understood: string[]
  attention: string[]
  proposed: string[]
}

export function RuntimeSummaryCard({
  observed,
  understood,
  attention,
  proposed,
}: RuntimeSummaryCardProps) {
  return (
    <Card variant="cockpit">
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Runtime Summary</div>
          <div className={styles.title}>ARTECNA ha osservato il cantiere</div>
        </div>
        <div className={styles.badge}>OS attivo</div>
      </div>

      <div className={styles.grid}>
        <RuntimeColumn title="Osservato" icon="👁" items={observed} />
        <RuntimeColumn title="Compreso" icon="🧠" items={understood} />
        <RuntimeColumn title="Attenzione" icon="⚠" items={attention} />
        <RuntimeColumn title="Proposta" icon="🤖" items={proposed} />
      </div>
    </Card>
  )
}

function RuntimeColumn({
  title,
  icon,
  items,
}: {
  title: string
  icon: string
  items: string[]
}) {
  return (
    <div className={styles.column}>
      <div className={styles.columnTitle}>
        <span>{icon}</span>
        <span>{title}</span>
      </div>

      <div className={styles.items}>
        {items.map((item) => (
          <div key={item} className={styles.item}>
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}