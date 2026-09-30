export type RigaConfermaPreventivoIntegrativoInput = Readonly<{
  sorgenteId: string
  indiceVoce: number
  inclusa: boolean
  descrizione: string
  unitaMisura: string
  quantita: string | number
  prezzoUnitario: string | number
}>

export type InputConfermaPreventivoIntegrativo = Readonly<{
  varianteId: string
  righe: readonly RigaConfermaPreventivoIntegrativoInput[]
}>

export type LavorazioneConfermataPreventivoIntegrativo = {
  sorgenteId: string
  indiceVoce: number
  operazione: 'nuova'
  descrizione: string
  unitaMisura: string
  quantita: number
  prezzoUnitario: number
  deltaContratto: number
}

export type AnomaliaConfermaPreventivoIntegrativo = {
  codice:
    | 'variante_id_non_valido'
    | 'sorgente_id_non_valido'
    | 'indice_voce_non_valido'
    | 'descrizione_mancante'
    | 'unita_misura_mancante'
    | 'quantita_non_valida'
    | 'prezzo_non_valido'
    | 'delta_non_valido'
    | 'riga_duplicata'
    | 'nessuna_lavorazione'
  indiceRigaInput?: number
  sorgenteId?: string
  indiceVoce?: number
}

export type RisultatoConfermaPreventivoIntegrativo =
  | {
      stato: 'ok'
      richiesta: {
        varianteId: string
        lavorazioni: LavorazioneConfermataPreventivoIntegrativo[]
      }
    }
  | { stato: 'errore'; anomalie: AnomaliaConfermaPreventivoIntegrativo[] }

function numero(valore: string | number): number {
  if (typeof valore === 'number') return valore
  const testo = valore.trim()
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(testo)) return Number.NaN
  return Number(testo.replace(',', '.'))
}

export function confermaPreventivoIntegrativo(
  input: InputConfermaPreventivoIntegrativo,
): RisultatoConfermaPreventivoIntegrativo {
  const anomalie: AnomaliaConfermaPreventivoIntegrativo[] = []
  const lavorazioni: LavorazioneConfermataPreventivoIntegrativo[] = []
  const varianteId = input.varianteId.trim()
  const occorrenze = new Set<string>()
  let incluse = 0
  if (!varianteId) anomalie.push({ codice: 'variante_id_non_valido' })

  input.righe.forEach((riga, indiceRigaInput) => {
    if (!riga.inclusa) return
    incluse += 1
    const sorgenteId = riga.sorgenteId.trim()
    const indiceValido = Number.isInteger(riga.indiceVoce) && riga.indiceVoce >= 0
    const segnala = (codice: AnomaliaConfermaPreventivoIntegrativo['codice']) => {
      anomalie.push({
        codice,
        indiceRigaInput,
        ...(sorgenteId ? { sorgenteId } : {}),
        ...(indiceValido ? { indiceVoce: riga.indiceVoce } : {}),
      })
    }
    const anomaliePrima = anomalie.length
    if (!sorgenteId) segnala('sorgente_id_non_valido')
    if (!indiceValido) segnala('indice_voce_non_valido')
    if (sorgenteId && indiceValido) {
      const chiave = JSON.stringify([sorgenteId, riga.indiceVoce])
      if (occorrenze.has(chiave)) segnala('riga_duplicata')
      occorrenze.add(chiave)
    }
    const descrizione = riga.descrizione.trim()
    const unitaMisura = riga.unitaMisura.trim()
    if (!descrizione) segnala('descrizione_mancante')
    if (!unitaMisura) segnala('unita_misura_mancante')
    const quantita = numero(riga.quantita)
    const prezzoUnitario = numero(riga.prezzoUnitario)
    const quantitaValida = Number.isFinite(quantita) && quantita > 0
    const prezzoValido = Number.isFinite(prezzoUnitario) && prezzoUnitario >= 0
    if (!quantitaValida) segnala('quantita_non_valida')
    if (!prezzoValido) segnala('prezzo_non_valido')
    const deltaContratto = Math.round(quantita * prezzoUnitario * 100) / 100
    if (quantitaValida && prezzoValido && (!Number.isFinite(deltaContratto) || deltaContratto <= 0)) {
      segnala('delta_non_valido')
    }
    if (anomalie.length === anomaliePrima) {
      lavorazioni.push({
        sorgenteId, indiceVoce: riga.indiceVoce, operazione: 'nuova',
        descrizione, unitaMisura, quantita, prezzoUnitario, deltaContratto,
      })
    }
  })

  if (incluse === 0) anomalie.push({ codice: 'nessuna_lavorazione' })
  return anomalie.length > 0
    ? { stato: 'errore', anomalie }
    : { stato: 'ok', richiesta: { varianteId, lavorazioni } }
}
