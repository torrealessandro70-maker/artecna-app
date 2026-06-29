'use client'

import React from 'react'
import { Card } from '../Card'
import styles from './StatusCard.module.css'

export type StatusCardProps = {
  icon: string
  title: string
  value: string
  detail: string
  accent?: string
}

export function StatusCard({
  icon,
  title,
  value,
  detail,
  accent = '#22c55e',
}: StatusCardProps) {
  return (
    <Card variant="cockpit">
      <div
        className={styles.icon}
        style={{
          background: `${accent}22`,
          borderColor: `${accent}66`,
        }}
      >
        {icon}
      </div>

      <div className={styles.title}>{title}</div>

      <div className={styles.value}>{value}</div>

      <div className={styles.detail}>{detail}</div>
    </Card>
  )
}