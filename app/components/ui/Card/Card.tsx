'use client'

import React from 'react'
import styles from './Card.module.css'

type CardVariant = 'default' | 'cockpit' | 'success' | 'warning' | 'danger'

type CardProps = {
  children: React.ReactNode
  variant?: CardVariant
  className?: string
}

export function Card({
  children,
  variant = 'default',
  className = '',
}: CardProps) {
  return (
    <div className={`${styles.card} ${styles[variant]} ${className}`}>
      {children}
    </div>
  )
}