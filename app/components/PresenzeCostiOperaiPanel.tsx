'use client'

import type { CSSProperties, ReactNode } from 'react'

type Props = {
  cardStyle: CSSProperties
  children: ReactNode
}

export default function PresenzeCostiOperaiPanel({
  cardStyle,
  children,
}: Props) {
  return (
    <div style={cardStyle}>
      <h2>Presenze / costi operai</h2>
      {children}
    </div>
  )
}