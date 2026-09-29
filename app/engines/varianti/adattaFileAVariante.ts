import type {
  AnomaliaPropostaVarianteDaFile,
  FormatoSorgenteFileVariante,
  PropostaLavorazioneVarianteDaFile,
  RisultatoAdattamentoFileVariante,
} from './types'

export type VoceFileEstratta = Readonly<{
  descrizione?: unknown
  codice?: unknown
  unitaMisura?: unknown
  quantita?: unknown
  prezzo?: unknown
  totale?: unknown
  categoria?: unknown
  note?: unknown
  rigaFile?: unknown
  pagina?: unknown
}>

export type InputAdattamentoFileVariante = Readonly<{
  cantiereId: unknown
  nomeFile: unknown
  formato: unknown
  voci: readonly VoceFileEstratta[]
}>

const testoUtile = (valore: unknown): valore is string =>
  typeof valore === 'string' && valore.trim().length > 0

const formatoValido = (valore: unknown): valore is FormatoSorgenteFileVariante =>
  valore === 'pdf' || valore === 'excel' || valore === 'immagine'

const testo = (valore: unknown): string | undefined => testoUtile(valore) ? valore : undefined

const numeroSemplice = (valore: unknown): number | undefined => {
  if (typeof valore === 'number') return Number.isFinite(valore) ? valore : undefined
  if (typeof valore !== 'string') return undefined
  const pulito = valore.trim()
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(pulito)) return undefined
  const numero = Number(pulito.replace(',', '.'))
  return Number.isFinite(numero) ? numero : undefined
}

export function adattaFileAVariante({
  cantiereId, nomeFile, formato, voci,
}: InputAdattamentoFileVariante): RisultatoAdattamentoFileVariante {
  const anomalie: AnomaliaPropostaVarianteDaFile[] = []
  if (!testoUtile(cantiereId)) anomalie.push({ codice: 'cantiere_id_non_valido' })
  if (!testoUtile(nomeFile)) anomalie.push({ codice: 'nome_file_mancante' })
  if (!formatoValido(formato)) anomalie.push({ codice: 'formato_non_supportato' })
  // Le guardie restringono i tipi senza inventare una provenienza o usare cast.
  if (!testoUtile(cantiereId) || !testoUtile(nomeFile) || !formatoValido(formato)) {
    return { stato: 'errore', anomalie }
  }

  const lavorazioni = voci.map((voce, indiceVoce): PropostaLavorazioneVarianteDaFile => {
    const segnala = (codice: AnomaliaPropostaVarianteDaFile['codice']) => {
      anomalie.push({ codice, indiceVoce })
    }
    const descrizione = testo(voce.descrizione)
    const unitaMisura = testo(voce.unitaMisura)
    const quantita = numeroSemplice(voce.quantita)
    const prezzoSorgente = numeroSemplice(voce.prezzo)
    const totale = numeroSemplice(voce.totale)
    if (descrizione === undefined) segnala('descrizione_mancante')
    if (unitaMisura === undefined) segnala('unita_misura_mancante')
    const quantitaValida = quantita !== undefined && quantita > 0
    const prezzoValido = prezzoSorgente !== undefined && prezzoSorgente >= 0
    if (!quantitaValida) segnala('quantita_non_valida')
    if (!prezzoValido) segnala('prezzo_non_valido')
    if (totale === undefined || totale < 0) {
      segnala('totale_non_valido')
    } else if (quantitaValida && prezzoValido) {
      const atteso = quantita * prezzoSorgente
      // Stessa tolleranza floating point dell'adapter ARTECNA, senza arrotondamenti.
      const tolleranza = Number.EPSILON * Math.max(1, Math.abs(atteso), Math.abs(totale)) * 4
      if (!Number.isFinite(atteso) || Math.abs(totale - atteso) > tolleranza) {
        segnala('totale_incoerente')
      }
    }
    return {
      descrizione, unitaMisura, quantita, prezzoSorgente, totale,
      codice: testo(voce.codice),
      categoria: testo(voce.categoria),
      note: testo(voce.note),
      sorgente: {
        tipo: 'file', cantiereId, nomeFile, formato, indiceVoce,
        ...(typeof voce.rigaFile === 'number' && Number.isInteger(voce.rigaFile) && voce.rigaFile >= 0
          ? { rigaFile: voce.rigaFile } : {}),
        ...(typeof voce.pagina === 'number' && Number.isInteger(voce.pagina) && voce.pagina >= 1
          ? { pagina: voce.pagina } : {}),
      },
    }
  })
  return {
    stato: 'ok',
    proposta: {
      natura: 'preventivo_integrativo', acquisizione: 'file', cantiereId,
      file: { nome: nomeFile, formato },
      lavorazioni, anomalie,
    },
  }
}
