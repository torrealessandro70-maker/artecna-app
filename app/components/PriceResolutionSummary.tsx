'use client'

type Props = {
  statistics: {
    exactCode: number
    normalizedCode: number
    descriptionUnit: number
    description: number
    similarity: number
    noMatch: number
    perfect: number
    reliable: number
    review: number
    weak: number
    none: number
  }
}

export default function PriceResolutionSummary({
  statistics,
}: Props) {
  const totale =
    statistics.exactCode +
    statistics.normalizedCode +
    statistics.descriptionUnit +
    statistics.description +
    statistics.similarity +
    statistics.noMatch

  return (
    <section
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: 16,
        background: '#fff',
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        Price Resolution Engine
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
          gap: 8,
        }}
      >
        <div>Exact Code</div>
        <strong>{statistics.exactCode}</strong>

        <div>Normalized Code</div>
        <strong>{statistics.normalizedCode}</strong>

        <div>Description + UM</div>
        <strong>{statistics.descriptionUnit}</strong>

        <div>Description</div>
        <strong>{statistics.description}</strong>

        <div>Similarity</div>
        <strong>{statistics.similarity}</strong>

        <div>No Match</div>
        <strong>{statistics.noMatch}</strong>
      </div>

      <hr />

      <h4 style={{ marginBottom: 10 }}>
        Qualità dei match
      </h4>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
          gap: 8,
        }}
      >
        <div>🟢 Match perfetti</div>
        <strong>{statistics.perfect}</strong>

        <div>🟢 Match affidabili</div>
        <strong>{statistics.reliable}</strong>

        <div>🟡 Da verificare</div>
        <strong>{statistics.review}</strong>

        <div>🟠 Match deboli</div>
        <strong>{statistics.weak}</strong>

        <div>🔴 Non affidabili</div>
        <strong>{statistics.none}</strong>
      </div>

      <hr />

      <strong>Totale lavorazioni: {totale}</strong>
    </section>
  )
}
