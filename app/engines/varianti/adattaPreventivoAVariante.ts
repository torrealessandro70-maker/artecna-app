import type {
  AnomaliaPropostaVariante,
  PropostaVarianteDaPreventivo,
  VocePreventivoSorgente,
} from './types'

const testoUtile = (valore: unknown): valore is string =>
  typeof valore === 'string' && valore.trim().length > 0

const numeroFinito = (valore: unknown): valore is number =>
  typeof valore === 'number' && Number.isFinite(valore)

export function adattaPreventivoAVariante(
  cantiereId: string,
  preventivoSorgenteId: string,
  voci: readonly VocePreventivoSorgente[],
): PropostaVarianteDaPreventivo {
  const anomalie: AnomaliaPropostaVariante[] = []
  if (!testoUtile(cantiereId)) anomalie.push({ codice: 'cantiere_id_non_valido' })
  if (!testoUtile(preventivoSorgenteId)) {
    anomalie.push({ codice: 'preventivo_sorgente_id_non_valido' })
  }

  const lavorazioni = voci.map((voce, indiceVoce) => {
    const segnala = (codice: AnomaliaPropostaVariante['codice']) => {
      anomalie.push({ codice, indiceVoce })
    }
    if (!testoUtile(voce.id)) segnala('lavorazione_sorgente_id_non_valido')
    if (!testoUtile(voce.descrizione)) segnala('descrizione_mancante')
    if (!testoUtile(voce.unitaMisura)) segnala('unita_misura_mancante')
    const quantitaValida = numeroFinito(voce.quantita) && voce.quantita > 0
    const prezzoValido = numeroFinito(voce.prezzoUnitario) && voce.prezzoUnitario >= 0
    if (!quantitaValida) segnala('quantita_non_valida')
    if (!prezzoValido) segnala('prezzo_non_valido')
    if (!numeroFinito(voce.totale) || voce.totale < 0) {
      segnala('totale_non_valido')
    } else if (quantitaValida && prezzoValido) {
      const atteso = voce.quantita! * voce.prezzoUnitario!
      // Nessun arrotondamento monetario: tolleranza solo per aritmetica floating point.
      const tolleranza = Number.EPSILON * Math.max(1, Math.abs(atteso), Math.abs(voce.totale)) * 4
      if (!Number.isFinite(atteso) || Math.abs(voce.totale - atteso) > tolleranza) {
        segnala('totale_incoerente')
      }
    }

    const { id, ...dati } = voce
    return {
      ...dati,
      sorgente: {
        tipo: 'preventivo_strutturato' as const,
        cantiereId,
        preventivoSorgenteId,
        lavorazioneSorgenteId: id,
      },
      prezzoSorgente: voce.prezzoUnitario,
    }
  })

  return {
    natura: 'preventivo_integrativo',
    acquisizione: 'dati_artecna',
    cantiereId,
    preventivoSorgenteId,
    lavorazioni,
    anomalie,
  }
}
