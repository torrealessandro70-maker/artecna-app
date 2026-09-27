import type { Operaio } from '../types'

export type OperaioRisolvibile =
  Pick<Operaio, 'nome' | 'costo_orario'> & {
    id: string
  }

export type RegolaRisoluzioneOperaio =
  | 'completo_esatto'
  | 'token_riordinati'
  | 'token_univoco'

export type RisultatoRisoluzioneOperaio =
  | {
      stato: 'trovato'
      operaio: OperaioRisolvibile
      regola: RegolaRisoluzioneOperaio
    }
  | {
      stato: 'ambiguo'
      candidati: OperaioRisolvibile[]
    }
  | {
      stato: 'non_trovato'
    }

const normalizzaNome = (nome: string): string =>
  nome
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201B\u02BC\uFF07]/g, "'")
    .replace(/[\u2010-\u2015\u2212\uFE63\uFF0D]/g, '-')
    .trim()
    .replace(/\s+/gu, ' ')

const chiaveToken = (nome: string): string =>
  JSON.stringify(nome.split(' ').sort())

export function risolviOperaio(
  input: string,
  anagrafica: readonly OperaioRisolvibile[]
): RisultatoRisoluzioneOperaio {
  const nome = normalizzaNome(input)
  if (!/\p{L}/u.test(nome)) return { stato: 'non_trovato' }

  const validi = anagrafica
    .filter((operaio) =>
      typeof operaio.id === 'string' && operaio.id.trim().length > 0
    )
    .map((operaio) => ({ operaio, nome: normalizzaNome(operaio.nome) }))
  const chiave = chiaveToken(nome)
  const completi = validi.filter((item) => chiaveToken(item.nome) === chiave)
  const compatibili = completi.length > 0
    ? completi
    : nome.split(' ').length === 1
      ? validi.filter((item) => item.nome.split(' ').includes(nome))
      : []

  const candidati = new Map<string, OperaioRisolvibile>()
  for (const { operaio } of compatibili) {
    if (!candidati.has(operaio.id)) {
      candidati.set(operaio.id, {
        id: operaio.id,
        nome: operaio.nome,
        ...(operaio.costo_orario !== undefined
          ? { costo_orario: operaio.costo_orario }
          : {}),
      })
    }
  }

  if (candidati.size === 0) return { stato: 'non_trovato' }
  if (candidati.size > 1) {
    return { stato: 'ambiguo', candidati: [...candidati.values()] }
  }

  const operaio = [...candidati.values()][0]
  return {
    stato: 'trovato',
    operaio,
    regola: completi.length === 0
      ? 'token_univoco'
      : completi.some((item) => item.nome === nome)
        ? 'completo_esatto'
        : 'token_riordinati',
  }
}
