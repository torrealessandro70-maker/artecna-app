import type { RpcPonteEconomia } from './usaRaccoltaInVariante'

export type PrestazioneEconomiaDesktop = {
  prestazione_id: string; rapportino_id: string; operaio_id: string; operaio_nome: string
  data: string; ore: number; variante_id: string | null; revisione: number
  stato: 'da_acquisire' | 'gia_acquisita' | 'divergente'; candidabile: boolean
}
export type DestinazioneEconomiaDesktop = { raccolta_id: string; titolo: string; numero: number; data: string; revisione: number }
export type ElencoPrestazioniEconomia = { prestazioni: PrestazioneEconomiaDesktop[]; raccolte_in_bozza: DestinazioneEconomiaDesktop[] }
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const revision = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
async function chiama(rpc: RpcPonteEconomia, nome: string, parametri: Record<string, unknown>) {
  try { return await rpc(nome, parametri) }
  catch { throw new ErrorePrestazioniEconomia('UNKNOWN', messaggioPrestazioniEconomia()) }
}
export class ErrorePrestazioniEconomia extends Error {
  constructor(public readonly code: string, message: string) { super(message) }
}
export function messaggioPrestazioniEconomia(code?: string): string {
  return ({
    PGRST202: 'Acquisizione da Rapportini non disponibile: le capability Economia devono essere installate.',
    '42883': 'Acquisizione da Rapportini non disponibile: le capability Economia devono essere installate.',
    '42501': 'Non sei autorizzato alle prestazioni di questo cantiere.',
    PT409: 'La raccolta o le prestazioni sono cambiate, oppure risultano già acquisite altrove. Rileggi prima di confermare.',
    '40001': 'I dati sono cambiati durante l’operazione. Rileggi prima di confermare.',
    '55000': 'La raccolta è chiusa. Rileggi e scegli una raccolta in bozza.',
    '22023': 'Selezione non valida. Rileggi le prestazioni.',
  } as Record<string, string>)[code ?? ''] ?? 'Esito non verificabile. Rileggi le prestazioni prima di riprovare; nessun reinvio automatico.'
}
export async function elencaPrestazioniEconomia(rpc: RpcPonteEconomia, cantiere: string): Promise<ElencoPrestazioniEconomia> {
  if (!uuid(cantiere)) throw new ErrorePrestazioniEconomia('22023', messaggioPrestazioniEconomia('22023'))
  const { data, error } = await chiama(rpc, 'elenca_prestazioni_economia_rapportini', { p_cantiere_id: cantiere })
  if (error) throw new ErrorePrestazioniEconomia(error.code ?? 'UNKNOWN', messaggioPrestazioniEconomia(error.code))
  if (!record(data) || data.versione_contratto !== 1 || data.cantiere_id !== cantiere ||
      !Array.isArray(data.prestazioni) || !Array.isArray(data.raccolte_in_bozza)) throw new Error('Elenco prestazioni non verificabile.')
  const prestazioni = data.prestazioni.map(p => {
    if (!record(p) || !uuid(p.prestazione_id) || !uuid(p.rapportino_id) || !uuid(p.operaio_id) ||
        typeof p.operaio_nome !== 'string' || !date(p.data) || typeof p.ore !== 'number' || !Number.isFinite(p.ore) || p.ore < 0 ||
        (p.variante_id !== null && !uuid(p.variante_id)) || !revision(p.revisione) ||
        !['da_acquisire', 'gia_acquisita', 'divergente'].includes(String(p.stato)) || typeof p.candidabile !== 'boolean' ||
        (p.candidabile && (p.stato !== 'da_acquisire' || p.ore <= 0))) throw new Error('Prestazione non verificabile.')
    return p as unknown as PrestazioneEconomiaDesktop
  })
  const raccolte = data.raccolte_in_bozza.map(r => {
    if (!record(r) || !uuid(r.raccolta_id) || typeof r.titolo !== 'string' || !r.titolo.trim() ||
        !Number.isSafeInteger(r.numero) || Number(r.numero) <= 0 || !date(r.data) || !revision(r.revisione)) throw new Error('Destinazione non verificabile.')
    return r as unknown as DestinazioneEconomiaDesktop
  })
  if (new Set(prestazioni.map(p => p.prestazione_id)).size !== prestazioni.length ||
      new Set(raccolte.map(r => r.raccolta_id)).size !== raccolte.length) throw new Error('Elenco duplicato non verificabile.')
  return { prestazioni, raccolte_in_bozza: raccolte }
}
export async function acquisisciPrestazioniEconomia(rpc: RpcPonteEconomia, raccolta: DestinazioneEconomiaDesktop,
  prestazioni: readonly PrestazioneEconomiaDesktop[]): Promise<{ acquisite: number; revisione: number }> {
  if (!uuid(raccolta.raccolta_id) || !revision(raccolta.revisione) || prestazioni.length < 1 || prestazioni.length > 100 ||
      new Set(prestazioni.map(p => p.prestazione_id)).size !== prestazioni.length || prestazioni.some(p =>
        !uuid(p.prestazione_id) || !revision(p.revisione) || !p.candidabile || p.stato !== 'da_acquisire'))
    throw new ErrorePrestazioniEconomia('22023', messaggioPrestazioniEconomia('22023'))
  const { data, error } = await chiama(rpc, 'acquisisci_prestazioni_economia_rapportini', {
    p_raccolta_id: raccolta.raccolta_id, p_revisione_attesa: raccolta.revisione,
    p_prestazioni: prestazioni.map(p => ({ prestazione_id: p.prestazione_id, revisione_attesa: p.revisione })),
  })
  if (error) throw new ErrorePrestazioniEconomia(error.code ?? 'UNKNOWN', messaggioPrestazioniEconomia(error.code))
  if (!record(data) || data.versione_contratto !== 1 || data.raccolta_id !== raccolta.raccolta_id ||
      !revision(data.revisione) || !revision(data.acquisite) || data.acquisite > prestazioni.length ||
      !Array.isArray(data.righe) || data.righe.length !== prestazioni.length ||
      data.righe.some(r => !record(r) || !uuid(r.riga_id) || !prestazioni.some(p => p.prestazione_id === r.prestazione_id)) ||
      new Set(data.righe.map(r => r.prestazione_id)).size !== prestazioni.length ||
      new Set(data.righe.map(r => r.riga_id)).size !== prestazioni.length) throw new Error(messaggioPrestazioniEconomia())
  return { acquisite: data.acquisite, revisione: data.revisione }
}

// Adattamento di sola lettura dello snapshot E3.2; non tratta un Rapportino come un import file.
export function operativoPrestazioneAcquisita(r: Record<string, unknown>, cantiere: string): Record<string, unknown> {
  const s = r.prestazione_snapshot
  if (r.origine !== 'rapportino' || r.tipo_riga !== 'manodopera' || !record(s) || s.version !== 1 ||
      s.cantiere_id !== cantiere || !uuid(s.prestazione_id) || s.prestazione_id !== r.rapportino_prestazione_id ||
      !uuid(s.rapportino_id) || !uuid(s.operaio_id) || (s.variante_id !== null && !uuid(s.variante_id)) || !date(s.data) ||
      !revision(s.revisione) || String(s.revisione) !== String(r.prestazione_revisione_acquisita) ||
      typeof s.ora_inizio !== 'string' || typeof s.ora_fine !== 'string' || !revision(s.pausa_minuti) ||
      typeof s.ore !== 'number' || !Number.isFinite(s.ore) || s.ore <= 0 || s.ore !== Number(r.quantita) ||
      r.unita_misura !== 'h' || s.lavoro_in_economia !== true || !record(r.dettagli_analitici) ||
      r.dettagli_analitici.version !== 1 || !record(r.dettagli_analitici.rapportino) ||
      Object.keys(s).length !== Object.keys(r.dettagli_analitici.rapportino).length ||
      Object.entries(s).some(([k, v]) => (r.dettagli_analitici as { rapportino: Record<string, unknown> }).rapportino[k] !== v))
    throw new Error('Provenienza Rapportino non verificabile.')
  return { data: s.data, operaio: s.operaio_id, qualifica: null, ora_inizio: s.ora_inizio,
    ora_fine: s.ora_fine, pausa_min: s.pausa_minuti, riferimento: s.rapportino_id }
}
