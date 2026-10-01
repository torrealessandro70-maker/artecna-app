export type InputPreparaCorrezioneContrattuale = Readonly<{
  varianteId: string
  tipoComponente: 'preventivo' | 'variante'
  componenteId: number
  operazione: 'riduzione_residua' | 'eliminazione_residua'
  quantita?: string | number | null
  motivo: string
}>

type IdentitaRichiestaCorrezione = Readonly<{
  varianteId: string
  tipoComponente: 'preventivo' | 'variante'
  componenteId: number
  motivo: string
}>

export type RichiestaCorrezioneContrattuale = IdentitaRichiestaCorrezione & (
  | Readonly<{ operazione: 'riduzione_residua'; quantitaRichiesta: number }>
  | Readonly<{ operazione: 'eliminazione_residua' }>
)

export type CodiceAnomaliaCorrezioneContrattuale =
  | 'variante_id_non_valido'
  | 'tipo_componente_non_valido'
  | 'componente_id_non_valido'
  | 'operazione_non_valida'
  | 'quantita_mancante'
  | 'quantita_non_valida'
  | 'quantita_non_ammessa_per_eliminazione'
  | 'motivo_mancante'

export type AnomaliaCorrezioneContrattuale = Readonly<{
  codice: CodiceAnomaliaCorrezioneContrattuale
}>

export type RisultatoPreparaCorrezioneContrattuale =
  | Readonly<{ stato: 'ok'; richiesta: RichiestaCorrezioneContrattuale }>
  | Readonly<{ stato: 'errore'; anomalie: readonly AnomaliaCorrezioneContrattuale[] }>

// Stessa sintassi decimale semplice degli engine Varianti; nessuna inferenza locale.
function numero(valore: unknown): number {
  if (typeof valore === 'number') return valore
  if (typeof valore !== 'string') return Number.NaN
  const testo = valore.trim()
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(testo)) return Number.NaN
  return Number(testo.replace(',', '.'))
}

// Prepara solo l'intenzione: identita canonica, residuo e importi spettano al server.
export function preparaCorrezioneContrattuale(
  input: InputPreparaCorrezioneContrattuale,
): RisultatoPreparaCorrezioneContrattuale {
  const anomalie: AnomaliaCorrezioneContrattuale[] = []
  const varianteId = typeof input?.varianteId === 'string' ? input.varianteId.trim() : ''
  const motivo = typeof input?.motivo === 'string' ? input.motivo.trim() : ''
  const tipoComponente = input?.tipoComponente
  const componenteId = input?.componenteId
  const operazione = input?.operazione
  if (!varianteId) anomalie.push({ codice: 'variante_id_non_valido' })
  if (tipoComponente !== 'preventivo' && tipoComponente !== 'variante') {
    anomalie.push({ codice: 'tipo_componente_non_valido' })
  }
  // Evita di trasmettere ID bigint che JavaScript non rappresenta esattamente.
  if (!Number.isSafeInteger(componenteId) || componenteId <= 0) {
    anomalie.push({ codice: 'componente_id_non_valido' })
  }
  if (operazione !== 'riduzione_residua' && operazione !== 'eliminazione_residua') {
    anomalie.push({ codice: 'operazione_non_valida' })
  }
  if (!motivo) anomalie.push({ codice: 'motivo_mancante' })

  const quantita = input?.quantita
  const quantitaAssente = quantita === undefined || quantita === null
    || (typeof quantita === 'string' && quantita.trim() === '')
  let quantitaRichiesta = Number.NaN
  if (operazione === 'riduzione_residua') {
    if (quantitaAssente) anomalie.push({ codice: 'quantita_mancante' })
    else {
      quantitaRichiesta = numero(quantita)
      if (!Number.isFinite(quantitaRichiesta) || quantitaRichiesta <= 0) {
        anomalie.push({ codice: 'quantita_non_valida' })
      }
    }
  } else if (operazione === 'eliminazione_residua' && !quantitaAssente) {
    anomalie.push({ codice: 'quantita_non_ammessa_per_eliminazione' })
  }
  if (anomalie.length) return { stato: 'errore', anomalie }

  const identita = { varianteId, tipoComponente, componenteId, motivo }
  return {
    stato: 'ok',
    richiesta: operazione === 'riduzione_residua'
      ? { ...identita, operazione, quantitaRichiesta }
      : { ...identita, operazione: 'eliminazione_residua' },
  }
}
