import type { RuntimeFeedItem } from '../../runtime/feed'

type RuntimeFeedPanelProps = {
  items: RuntimeFeedItem[]
}

function formatFeedTime(timestamp: Date) {
  return new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

export function RuntimeFeedPanel({ items }: RuntimeFeedPanelProps) {
  return (
    <section
      style={{
        display: 'grid',
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 13, color: '#64748b', fontWeight: 700 }}>
          Runtime Feed
        </div>
        <h3 style={{ margin: '4px 0 0', fontSize: 20 }}>
          Memoria viva del cantiere
        </h3>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((item) => (
          <article
            key={item.id}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: 14,
              background: '#ffffff',
              display: 'grid',
              gap: 6,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <strong style={{ fontSize: 15 }}>{item.title}</strong>
              <span
                style={{
                  fontSize: 12,
                  color: '#64748b',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}
              >
                {formatFeedTime(item.timestamp)}
              </span>
            </div>

            {item.description && (
              <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>
                {item.description}
              </p>
            )}

            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                fontSize: 11,
                color: '#64748b',
                fontWeight: 700,
              }}
            >
              <span>{item.category}</span>
              <span>-</span>
              <span>{item.source}</span>
              <span>-</span>
              <span>priorita {item.priority ?? 1}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
