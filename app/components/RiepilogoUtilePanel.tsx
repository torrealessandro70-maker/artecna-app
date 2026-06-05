'use client'

type Props = {
  totaleCostiCantiere: number
  utileCantiere: number
  margineCantiere: number | string
  formatMoney: (v: number) => string
}

export default function RiepilogoUtilePanel({
  totaleCostiCantiere,
  utileCantiere,
  margineCantiere,
  formatMoney,
}: Props) {
  return (
    <>
      <div
        style={{
          padding: 12,
          border: '2px solid #111827',
          borderRadius: 8,
        }}
      >
        <strong>Totale costi:</strong> {formatMoney(totaleCostiCantiere)}
      </div>

      <div
        style={{
          padding: 12,
          border: utileCantiere >= 0 ? '2px solid green' : '2px solid red',
          borderRadius: 8,
          background: utileCantiere >= 0 ? '#dcfce7' : '#fee2e2',
        }}
      >
        <strong>Utile:</strong>{' '}
        <span
          style={{
            color: utileCantiere >= 0 ? 'green' : 'red',
            fontWeight: 700,
          }}
        >
          {formatMoney(utileCantiere)}
        </span>
        <br />
        <strong>Margine:</strong> {margineCantiere}%
      </div>
    </>
  )
}