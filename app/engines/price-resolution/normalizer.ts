const normalizzaSpazi = (value: string) =>
  value.replace(/\s+/g, ' ').trim()

export const normalizePriceCode = (
  value?: string | null,
): string => {
  if (!value) return ''

  return value
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}.-]/gu, '')
    .trim()
}

export const normalizePriceDescription = (
  value?: string | null,
): string => {
  if (!value) return ''

  return normalizzaSpazi(
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}%/.,()-]/gu, ' ')
      .replace(/[.,;:()[\]]/g, ' '),
  )
}

export const normalizeUnitOfMeasure = (
  value?: string | null,
): string => {
  if (!value) return ''

  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/\./g, '')

  const aliases: Record<string, string> = {
    mq: 'm2',
    m2: 'm2',
    metquadro: 'm2',
    metroquadro: 'm2',
    metriquadrati: 'm2',

    mc: 'm3',
    m3: 'm3',
    metrocubo: 'm3',
    metricubi: 'm3',

    ml: 'm',
    mt: 'm',
    m: 'm',
    metro: 'm',
    metrilineari: 'm',

    cad: 'cad',
    cadauno: 'cad',
    cadauna: 'cad',
    pz: 'cad',
    pezzo: 'cad',
    pezzi: 'cad',
    nr: 'cad',
    n: 'cad',

    kg: 'kg',
    q: 'q',
    t: 't',

    h: 'h',
    ora: 'h',
    ore: 'h',

    gg: 'giorno',
    giorno: 'giorno',
    giorni: 'giorno',

    acorpo: 'a_corpo',
    corpo: 'a_corpo',
    forfait: 'a_corpo',
  }

  return aliases[normalized] ?? normalized
}

export const tokenizePriceDescription = (
  value?: string | null,
): string[] => {
  const normalized = normalizePriceDescription(value)

  if (!normalized) return []

  return Array.from(
    new Set(
      normalized
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    ),
  )
}