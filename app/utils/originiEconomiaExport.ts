export type RecordOrigine = Record<string, unknown>
export type LetturaOrigine = { varianteId: string; disponibile: boolean; sorgenti: RecordOrigine[]; identita?: RecordOrigine[] }
export type IdentitaEconomia = {
  economiaStato: 'verificata' | 'origine Economia non verificata' | 'non Economia'
  economiaRegistrazioneId?: string; economiaTipoRiga?: 'materiale' | 'manodopera'
  economiaDataOperativa?: string; economiaOperaioId?: string; economiaMaterialeId?: string
  economiaSorgenteId?: string; economiaVarianteId?: string; economiaIndiceVoce?: number
  economiaImportoSorgente?: number; economiaPercorso?: 'sorgente_indice'
}
const record = (v: unknown): v is RecordOrigine => !!v && typeof v === 'object' && !Array.isArray(v)
const testo = (v: unknown) => typeof v === 'string' && v.trim() ? v : undefined
const numero = (v: unknown) => (typeof v === 'number' || typeof v === 'string' && v.trim() !== '') && Number.isFinite(Number(v)) ? Number(v) : NaN
const cent = (v: unknown) => { const n = numero(v), c = Math.round(n * 100); return Number.isSafeInteger(c) && Math.abs(n * 100 - c) < 0.000001 ? c : NaN }
const giorno = (v: unknown) => { if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined; const d = new Date(v + 'T00:00:00Z'); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : undefined }

type Risposta = { data: unknown; error: unknown }
type Query = PromiseLike<Risposta> & { order: (colonna: string, opzioni: { ascending: boolean }) => Query; range: (da: number, a: number) => PromiseLike<Risposta> }

// Letture soltanto al comando Excel; un errore non diventa assenza di sorgenti.
export async function leggiOriginiExport(client: { rpc: (nome: string, params: RecordOrigine) => Query }, varianti: string[]): Promise<LetturaOrigine[]> {
  const risultati: LetturaOrigine[] = []
  for (const varianteId of new Set(varianti)) {
    try {
      const elenco: RecordOrigine[] = [], ids = new Set<string>()
      for (let offset = 0; ; offset += 200) {
        const { data, error } = await client.rpc('leggi_sorgenti_variante', { p_variante_id: varianteId }).order('created_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 199)
        if (error || !Array.isArray(data)) throw Error('Sorgenti non disponibili')
        for (const s of data) {
          if (!record(s) || !testo(s.id) || ids.has(String(s.id)) || s.variante_id !== varianteId) throw Error('Identità sorgente incoerente')
          ids.add(String(s.id)); elenco.push(s)
        }
        if (data.length < 200) break
      }
      const sorgenti: RecordOrigine[] = []
      for (const s of elenco) {
        if (s.tipo !== 'raccolta_economia') { sorgenti.push(s); continue }
        const { data, error } = await client.rpc('leggi_sorgente_variante', { p_sorgente_id: s.id })
        const d = Array.isArray(data) ? data.length === 1 ? data[0] : null : data
        if (error || !record(d) || d.id !== s.id || d.variante_id !== varianteId || d.tipo !== s.tipo) throw Error('Snapshot non disponibile')
        sorgenti.push(d)
      }
      const identita: RecordOrigine[] = [], visti = new Set<string>()
      for (let offset = 0; ; offset += 200) {
        const { data, error } = await client.rpc('leggi_identita_lavorazioni_variante', { p_variante_id: varianteId }).order('id', { ascending: true }).range(offset, offset + 199)
        if (error || !Array.isArray(data)) throw Error('Identità lavorazioni non disponibili')
        for (const r of data) {
          if (!record(r) || r.id == null || visti.has(String(r.id)) || r.variante_id !== varianteId) throw Error('Identità lavorazioni incoerente')
          visti.add(String(r.id)); identita.push(r)
        }
        if (data.length < 200) break
      }
      risultati.push({ varianteId, disponibile: true, sorgenti, identita })
    } catch { risultati.push({ varianteId, disponibile: false, sorgenti: [] }) }
  }
  return risultati
}

export function riconciliaOriginiEconomia(lavori: readonly RecordOrigine[], letture: readonly LetturaOrigine[], cantiereId: string): IdentitaEconomia[] {
  const nonVerificata = (): IdentitaEconomia => ({ economiaStato: 'origine Economia non verificata' })
  const esiti = lavori.map((originale): IdentitaEconomia => {
    let l = originale
    const varianteId = record(l.variante) ? testo(l.variante.id) : undefined
    const lettura = letture.filter(r => r.varianteId === varianteId)
    if (!varianteId || !cantiereId || lettura.length !== 1 || !lettura[0].disponibile || l.variante_id !== varianteId) return nonVerificata()
    if (lettura[0].identita) {
      const match = lettura[0].identita.filter(r => String(r.id) === String(l.id))
      if (match.length !== 1 || match[0].variante_id !== varianteId ||
        ['variante_sorgente_id', 'indice_voce_sorgente'].some(k => l[k] != null && l[k] !== match[0][k])) return nonVerificata()
      l = { ...l, variante_sorgente_id: match[0].variante_sorgente_id, indice_voce_sorgente: match[0].indice_voce_sorgente }
    }
    const tutte = lettura[0].sorgenti, economie = tutte.filter(s => s.tipo === 'raccolta_economia')
    if (tutte.some(s => !testo(s.id) || s.variante_id !== varianteId) || new Set(tutte.map(s => s.id)).size !== tutte.length) return nonVerificata()
    const esplicita = l.variante_sorgente_id != null
    if (!economie.length) return esplicita && !tutte.some(s => s.id === l.variante_sorgente_id) ? nonVerificata() : { economiaStato: 'non Economia' }
    const candidati = esplicita ? economie.filter(s => s.id === l.variante_sorgente_id) : economie
    if (candidati.length !== 1) return esplicita && tutte.some(s => s.id === l.variante_sorgente_id && s.tipo !== 'raccolta_economia') ? { economiaStato: 'non Economia' } : nonVerificata()
    const s = candidati[0], snap = s.snapshot
    if (!testo(s.id) || s.variante_id !== varianteId || s.snapshot_version !== 1 || !record(snap) || !testo(s.economia_raccolta_id) || snap.raccolta_id !== s.economia_raccolta_id || snap.cantiere_id !== cantiereId ||
      !Number.isSafeInteger(numero(s.economia_revisione_sorgente)) || numero(snap.revisione_sorgente) !== numero(s.economia_revisione_sorgente) ||
      !Number.isSafeInteger(numero(s.economia_revisione_congelata)) || numero(snap.revisione_congelata) !== numero(s.economia_revisione_congelata) ||
      !Array.isArray(snap.registrazioni) || !snap.registrazioni.length || snap.numero_registrazioni !== snap.registrazioni.length) return nonVerificata()
    const registrazioni = snap.registrazioni
    if (!registrazioni.every(record) || registrazioni.some(r => !testo(r.id)) || new Set(registrazioni.map(r => r.id)).size !== registrazioni.length) return nonVerificata()
    const esclusioni = snap.versione_esclusioni === 1
    if (snap.versione_esclusioni != null && !esclusioni) return nonVerificata()
    const escluse = registrazioni.filter(r => r.esclusa_proposta === true)
    if (esclusioni ? snap.numero_escluse !== escluse.length || snap.numero_incluse !== registrazioni.length - escluse.length || registrazioni.some(r => typeof r.esclusa_proposta !== 'boolean') : escluse.length > 0 || registrazioni.some(r => r.esclusa_proposta != null && r.esclusa_proposta !== false)) return nonVerificata()
    if (registrazioni.some(r => !Number.isSafeInteger(cent(r.importo)) || (r.esclusa_proposta === true ? cent(r.importo) !== 0 : cent(r.importo) <= 0)) ||
      registrazioni.reduce((n, r) => n + cent(r.importo), 0) !== cent(snap.totale)) return nonVerificata()
    // L'indice originale proviene dalla lavorazione persistita, mai dal numero visuale.
    if (!esplicita) return nonVerificata()
    const indice = l.indice_voce_sorgente as number, percorso = 'sorgente_indice' as const
    if (!Number.isSafeInteger(indice) || indice < 0 || indice >= registrazioni.length) return nonVerificata()
    const r = registrazioni[indice]
    // Una riduzione senza propria voce firmata non eredita il tipo dal lavoro originario.
    if (r.esclusa_proposta === true) return nonVerificata()
    if (!['nuova', 'aumento'].includes(String(l.operazione)) || cent(l.delta_contratto) !== cent(r.importo) || !['materiale', 'manodopera'].includes(String(r.tipo_riga))) return nonVerificata()
    const a = record(r.dettagli_analitici) ? r.dettagli_analitici : {}, operativo = record(a.operativo) ? a.operativo : {}, fattura = record(a.fattura) ? a.fattura : {}, rapporto = record(r.prestazione_snapshot) ? r.prestazione_snapshot : record(a.rapportino) ? a.rapportino : {}
    const date = r.tipo_riga === 'manodopera' ? [rapporto.data, operativo.data] : [fattura.data_fattura, operativo.data]
    const valide = date.filter(v => v != null && v !== '').map(giorno)
    const data = valide.length && valide.every(v => v && v === valide[0]) ? valide[0] : undefined
    return { economiaStato: 'verificata', economiaRegistrazioneId: String(r.id), economiaTipoRiga: r.tipo_riga as 'materiale' | 'manodopera', economiaDataOperativa: data,
      economiaOperaioId: testo(r.operaio_id) ?? testo(rapporto.operaio_id) ?? testo(operativo.operaio_id), economiaMaterialeId: testo(r.materiale_id) ?? testo(operativo.materiale_id), economiaSorgenteId: String(s.id), economiaVarianteId: varianteId, economiaIndiceVoce: indice, economiaImportoSorgente: cent(r.importo) / 100, economiaPercorso: percorso }
  })
  // Nessuna stessa registrazione viene attribuita due volte, neppure con indici/UUID diversi.
  const chiavi = esiti.map(r => r.economiaStato === 'verificata' ? r.economiaRegistrazioneId : undefined)
  return esiti.map((r, i) => chiavi[i] && chiavi.filter(k => k === chiavi[i]).length > 1 ? nonVerificata() : r)
}
