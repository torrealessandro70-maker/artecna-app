export const oggi = new Date().toISOString().split('T')[0]

export const formatMoney = (value: number) =>
  Number(value || 0).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
  })

export const parseOra = (ora?: string) => {
  if (!ora) return null

  const parti = ora.split(':')
  if (parti.length < 2) return null

  const h = Number(parti[0])
  const m = Number(parti[1])

  if (isNaN(h) || isNaN(m)) return null

  return h * 60 + m
}