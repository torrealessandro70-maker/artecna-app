import { costoNettoQuota, scomponiVarianti } from './riepilogoEconomico'
import { operativoPrestazioneAcquisita } from './prestazioniRapportiniDesktop'

type Riga = Record<string, any>
export type ClientManodopera = { rpc: (nome: string, parametri: Record<string, unknown>) => any }
export type VoceManodoperaEconomia = {
  id: string; rigaId: string; raccoltaId: string; sorgenteId: string | null
  prestazioneId: string | null; rapportinoId: string | null
  data: string; descrizione: string; operaioRiferimento: string; quantita: number
  um: string; prezzo: number | null; totale: number | null; riferimento: string
  origine: string; stato: 'Approvato' | 'Da contabilizzare'
}
export type DettaglioManodoperaEconomia = {
  approvate: VoceManodoperaEconomia[]; pendenti: VoceManodoperaEconomia[]
  totaleApprovato: number; totalePendenti: number | null; totaleOperativo: number | null; totalePendentiValorizzati: number
  raccolte: { id: string; titolo: string; righe: VoceManodoperaEconomia[] }[]
}
export function statoVisibileManodopera(riga: VoceManodoperaEconomia): string {
  return riga.stato === 'Da contabilizzare' && riga.prezzo === null ? 'Da valorizzare' : riga.stato
}
const record = (v: unknown): v is Riga => !!v && typeof v === 'object' && !Array.isArray(v)
const stop = (): never => { throw Error('Dettaglio manodopera non verificabile: identità o valorizzazione incoerenti.') }
const testo = (v: unknown) => typeof v === 'string' ? v : ''
function id(v: unknown): string { return typeof v === 'string' && v.trim() ? v : stop() }
function numero(v: unknown): number {
  return (typeof v === 'number' || typeof v === 'string') && String(v).trim() && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : stop()
}
function cent(v: unknown): number {
  const n = numero(v), c = Math.round(n * 100)
  return Number.isSafeInteger(c) && Math.abs(n * 100 - c) < 0.000001 ? c : stop()
}
function totale(righe: VoceManodoperaEconomia[]): number {
  const c = righe.reduce((s, r) => s + cent(r.totale), 0)
  return Number.isSafeInteger(c) ? c / 100 : stop()
}
function voce(r: Riga, c: Riga, stato: VoceManodoperaEconomia['stato'], congelata: boolean): VoceManodoperaEconomia {
  if (!record(r) || r.tipo_riga !== 'manodopera' || !['manuale', 'file', 'rapportino'].includes(r.origine) ||
      !testo(r.descrizione).trim() || !testo(r.unita_misura).trim()) return stop()
  const q = numero(r.quantita), p = !congelata && r.prezzo_unitario === null ? null : numero(r.prezzo_unitario)
  if (q <= 0) return stop()
  const valore = p === null ? null : costoNettoQuota(q, p)
  if (congelata && cent(r.importo) !== cent(valore)) return stop()
  if (!congelata && r.totale != null && (valore === null || cent(r.totale) !== cent(valore))) return stop()
  const dettagli = record(r.dettagli_analitici) ? r.dettagli_analitici : {}
  const op = record(dettagli.operativo) ? dettagli.operativo : {}
  const rap = record(dettagli.rapportino) ? dettagli.rapportino : {}
  const sorgenteId = r.sorgente_id == null ? null : id(r.sorgente_id)
  let prestazioneId: string | null = null, rapportinoId: string | null = null
  if (r.origine === 'file' && !sorgenteId) return stop()
  if (r.origine === 'rapportino') {
    operativoPrestazioneAcquisita(congelata ? { ...r, prestazione_snapshot: rap,
      rapportino_prestazione_id: rap.prestazione_id, prestazione_revisione_acquisita: rap.revisione } : r, c.cantiere_id)
    prestazioneId = id(rap.prestazione_id); rapportinoId = id(rap.rapportino_id)
    if (rap.version !== 1 || rap.cantiere_id !== c.cantiere_id || rap.lavoro_in_economia !== true ||
        (r.rapportino_prestazione_id != null && r.rapportino_prestazione_id !== prestazioneId) ||
        numero(rap.ore) !== q) return stop()
  }
  const rigaId = id(r.id), raccoltaId = id(c.id)
  return { id: `${raccoltaId}:${rigaId}`, rigaId, raccoltaId, sorgenteId, prestazioneId, rapportinoId,
    data: testo(rap.data) || testo(op.data), descrizione: r.descrizione,
    operaioRiferimento: [testo(op.operaio), testo(op.riferimento), rapportinoId ? `Rapportino ${rapportinoId}` : '',
      !testo(op.operaio) && rap.operaio_id ? `Operaio ${id(rap.operaio_id)}` : ''].filter(Boolean).join(' — '),
    quantita: q, um: r.unita_misura, prezzo: p, totale: valore,
    riferimento: `Raccolta n. ${c.numero ?? '—'} — ${testo(c.titolo) || '—'}`, origine: r.origine, stato }
}
export function calcolaDettaglioManodopera(varianti: Riga[], sorgenti: Riga[], dettagli: Riga[], cantiereId: string, contrattoId: string): DettaglioManodoperaEconomia {
  const finanziario = scomponiVarianti(varianti, sorgenti, cantiereId, contrattoId)
  const approvate: VoceManodoperaEconomia[] = [], pendenti: VoceManodoperaEconomia[] = []
  const congelate = new Map<string, VoceManodoperaEconomia>(), prestazioni = new Set<string>()
  // Tutte le approvazioni escludono i pendenti, ma solo il contratto corrente entra nel dettaglio approvato.
  for (const v of varianti.filter(v => v.stato === 'approvata')) {
    if (v.cantiere_id !== cantiereId) return stop()
    for (const s of sorgenti.filter(s => s.variante_id === v.id && s.tipo === 'raccolta_economia')) {
      const snap = s.snapshot
      if (s.snapshot_version !== 1 || !record(snap) || snap.cantiere_id !== cantiereId || snap.raccolta_id !== s.economia_raccolta_id ||
          !Array.isArray(snap.registrazioni) || snap.numero_registrazioni !== snap.registrazioni.length) return stop()
      // La validazione monetaria/revisione resta identica al riepilogo esistente.
      scomponiVarianti(varianti, sorgenti, cantiereId, id(v.preventivo_contrattuale_id))
      for (const r of snap.registrazioni.filter((r: Riga) => r.tipo_riga === 'manodopera')) {
        const x = voce(r, { ...snap, id: snap.raccolta_id }, 'Approvato', true)
        if (congelate.has(x.id)) return stop()
        congelate.set(x.id, x)
        if (x.prestazioneId) {
          if (prestazioni.has(x.prestazioneId)) return stop()
          prestazioni.add(x.prestazioneId)
        }
        if (v.preventivo_contrattuale_id === contrattoId) approvate.push(x)
      }
    }
  }
  const raccolte = new Set<string>(), righe = new Set<string>(), correntiPrestazioni = new Set<string>()
  const consultazione: DettaglioManodoperaEconomia['raccolte'] = []
  for (const d of dettagli) {
    const c = d.raccolta
    if (!record(c) || c.cantiere_id !== cantiereId || !['bozza','chiusa'].includes(c.stato) || !Array.isArray(d.righe) || !Array.isArray(d.sorgenti)) return stop()
    if (raccolte.has(id(c.id))) return stop()
    raccolte.add(c.id)
    const elencoRaccolta = { id: c.id, titolo: testo(c.titolo), righe: [] as VoceManodoperaEconomia[] }
    consultazione.push(elencoRaccolta)
    const fonti = new Set<string>()
    for (const s of d.sorgenti) { if (!record(s) || s.raccolta_id !== c.id || fonti.has(id(s.id))) return stop(); fonti.add(s.id) }
    for (const r of d.righe) {
      if (!record(r) || r.raccolta_id !== c.id || righe.has(id(r.id))) return stop()
      righe.add(r.id)
      if (r.tipo_riga !== 'manodopera') continue
      const x = voce(r, c, 'Da contabilizzare', false)
      if (x.sorgenteId && !fonti.has(x.sorgenteId)) return stop()
      if (x.origine === 'file' && d.sorgenti.find((s: Riga) => s.id === x.sorgenteId)?.tipo !== 'file') return stop()
      if (x.prestazioneId) {
        if (correntiPrestazioni.has(x.prestazioneId)) return stop()
        correntiPrestazioni.add(x.prestazioneId)
      }
      const congelata = congelate.get(x.id)
      if (!congelata && [...congelate.values()].some(r => r.rigaId === x.rigaId)) return stop()
      elencoRaccolta.righe.push({ ...x, stato: congelata ? 'Approvato' : 'Da contabilizzare' })
      if (congelata) {
        if (congelata.sorgenteId !== x.sorgenteId || congelata.prestazioneId !== x.prestazioneId || congelata.rapportinoId !== x.rapportinoId || congelata.origine !== x.origine) return stop()
        continue
      }
      // La stessa prestazione con un ID Economia diverso richiede diagnosi, non fuzzy matching.
      if (x.prestazioneId && prestazioni.has(x.prestazioneId)) return stop()
      pendenti.push(x)
    }
  }
  const totaleApprovato = totale(approvate), totalePendentiValorizzati = totale(pendenti.filter(r => r.totale !== null))
  const totalePendenti = pendenti.some(r => r.totale === null) ? null : totalePendentiValorizzati
  if (cent(totaleApprovato) !== cent(finanziario.manodopera)) return stop()
  const somma = cent(totaleApprovato) + cent(totalePendentiValorizzati)
  if (!Number.isSafeInteger(somma)) return stop()
  return { approvate, pendenti, totaleApprovato, totalePendenti, totalePendentiValorizzati, totaleOperativo: totalePendenti === null ? null : somma / 100, raccolte: consultazione }
}
async function pagina(client: ClientManodopera, nome: string, args: Riga, ordine: string): Promise<Riga[]> {
  const rows: Riga[] = [], ids = new Set<string>()
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await client.rpc(nome, args).order(ordine, { ascending: true }).order('id', { ascending: true }).range(offset, offset + 199)
    if (error || !Array.isArray(data)) return stop()
    for (const r of data) { if (!record(r) || ids.has(id(r.id))) return stop(); ids.add(r.id); rows.push(r) }
    if (data.length < 200) return rows
  }
}
export async function leggiDettaglioManodopera(client: ClientManodopera, cantiereId: string, contrattoId: string): Promise<DettaglioManodoperaEconomia> {
  const varianti = await pagina(client, 'leggi_varianti_cantiere', { p_cantiere_id: cantiereId }, 'numero'), sorgenti: Riga[] = []
  for (const v of varianti.filter(v => v.stato === 'approvata')) {
    const elenco = await pagina(client, 'leggi_sorgenti_variante', { p_variante_id: v.id }, 'created_at')
    for (const s of elenco.filter(s => s.tipo === 'raccolta_economia')) {
      const { data, error } = await client.rpc('leggi_sorgente_variante', { p_sorgente_id: s.id })
      const d = Array.isArray(data) && data.length === 1 ? data[0] : data
      if (error || !record(d) || d.id !== s.id || d.variante_id !== v.id) return stop()
      sorgenti.push(d)
    }
  }
  const elenco = await client.rpc('leggi_raccolte_economia', { p_cantiere_id: cantiereId }), dettagli: Riga[] = []
  if (elenco.error || !Array.isArray(elenco.data)) return stop()
  for (const c of elenco.data) {
    if (c.cantiere_id !== cantiereId) return stop()
    const { data, error } = await client.rpc('leggi_raccolta_economia', { p_raccolta_id: id(c.id) })
    if (error || !record(data) || data.raccolta?.id !== c.id || data.raccolta.revisione !== c.revisione) return stop()
    dettagli.push(data)
  }
  return calcolaDettaglioManodopera(varianti, sorgenti, dettagli, cantiereId, contrattoId)
}
