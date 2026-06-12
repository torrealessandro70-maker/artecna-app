'use client'

type Props = {
  situazioneCantieri: any[]
  formatMoney: (valore: any) => string
}

export default function ValutazioneFondiPanel({
  situazioneCantieri,
  formatMoney,
}: Props) {
  if (situazioneCantieri.length === 0) {
    return <p>Nessun cantiere presente.</p>
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {situazioneCantieri.map((c) => (
        <div key={c.nome}>
          <strong>{c.nome}</strong>
        </div>
      ))}
    </div>
  )
}