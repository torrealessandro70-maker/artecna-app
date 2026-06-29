'use client'

import React from 'react'
import styles from './Button.module.css'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

type ButtonProps = {
  children: React.ReactNode
  variant?: ButtonVariant
  type?: 'button' | 'submit' | 'reset'
  onClick?: () => void
}

export function Button({
  children,
  variant = 'primary',
  type = 'button',
  onClick,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`${styles.button} ${styles[variant]}`}
    >
      {children}
    </button>
  )
}