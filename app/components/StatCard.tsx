import type { CSSProperties, ReactNode } from 'react'

type Props = {
  title: string
  value: ReactNode
  subtitle?: ReactNode
  style?: CSSProperties
}

export default function StatCard({
  title,
  value,
  subtitle,
  style,
}: Props) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        background: '#fff',
        border: '1px solid #ddd',
        ...style,
      }}
    >
      <div style={{ color: '#666', marginBottom: 6 }}>
        {title}
      </div>

      <strong style={{ fontSize: 20 }}>
        {value}
      </strong>

      {subtitle && (
        <div style={{ marginTop: 6 }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}