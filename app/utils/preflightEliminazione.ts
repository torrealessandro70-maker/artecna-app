export const categoriePreflight = {
  sal: 'SAL e relative sorgenti', acconti: 'Acconti', fatture: 'Fatture e righe fattura',
  incassi: 'Incassi', pagamenti: 'Pagamenti', rettifiche: 'Rettifiche e note di credito',
  economia: 'Economia e raccolte', varianti: 'Varianti e relative fonti',
  preventivi: 'Preventivi e lavorazioni', rapportini: 'Rapportini, prestazioni e allegati',
  presenze: 'Presenze e timbrature', materiali: 'Materiali', attrezzature: 'Attrezzature',
  foto: 'Foto', quaderno: 'Note, richiami e gestioni Quaderno',
  allegati_quaderno: 'Allegati Quaderno', cantieri: 'Cantieri collegati',
  agenda: 'Attività in agenda', altri_collegamenti: 'Altri dati collegati',
} as const
export type EntitaPreflight = 'sopralluogo' | 'cantiere'
export type CategoriaPreflight = keyof typeof categoriePreflight
export type EsitoPreflight = {
  versione: 1; entita: EntitaPreflight; id: string
  stato: 'eliminabile' | 'bloccato' | 'non_verificabile'
  verifica_completa: boolean; categorie: CategoriaPreflight[]
  azione_consigliata: 'conferma_eliminazione' | 'segna_concluso' | 'nessuna'
  verificato_at: string
}
type ClientPreflight = {
  rpc: (nome: string, parametri: Record<string, string>) => PromiseLike<{ data: unknown; error: unknown }>
}
export function esitoNonVerificabile(entita: EntitaPreflight, id: string): EsitoPreflight {
  return { versione: 1, entita, id, stato: 'non_verificabile', verifica_completa: false,
    categorie: [], azione_consigliata: 'nessuna', verificato_at: '' }
}
export function eliminazioneConsentita(esito: EsitoPreflight): boolean {
  return esito.stato === 'eliminabile' && esito.verifica_completa === true &&
    esito.categorie.length === 0 && esito.azione_consigliata === 'conferma_eliminazione'
}
// Nessuna cache/token: ogni click legge il server. Errori e contratti inattesi
// bloccano la UI senza mostrare SQL o categorie parziali.
export async function richiediPreflight(db: ClientPreflight, entita: EntitaPreflight, id: string): Promise<EsitoPreflight> {
  const fallback = esitoNonVerificabile(entita, id)
  try {
    const { data, error } = await db.rpc(`preflight_eliminazione_${entita}`, { [`p_${entita}_id`]: id })
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) return fallback
    const e = data as EsitoPreflight
    if (e.versione !== 1 || e.entita !== entita || e.id !== id ||
      typeof e.verificato_at !== 'string' || !Number.isFinite(Date.parse(e.verificato_at)) ||
      !Array.isArray(e.categorie) || !e.categorie.every(c => Object.hasOwn(categoriePreflight, c))) return fallback
    if (eliminazioneConsentita(e)) return e
    if (e.stato === 'bloccato' && e.verifica_completa === true && e.categorie.length > 0 &&
      e.azione_consigliata === (entita === 'cantiere' ? 'segna_concluso' : 'nessuna')) return e
    return fallback
  } catch { return fallback }
}
