// Sole letture RPC: valori cliente da snapshot approvati; costi da quote fattura.
type Riga = Record<string, any>
type Client = { rpc: (nome: string, parametri: Record<string, unknown>) => any }
export type MaterialeEconomiaApprovato = {
  id: string; data: string; fornitore: string; fattura: string; descrizione: string
  quantita: number; um: string; prezzo: number; totale: number; riferimento: string
}
type IdentitaMateriale = { raccoltaId: string; rigaId: string; sorgenteId: string | null; fatturaRigaId: string | null }
export type MaterialiOperativi = { righe: readonly MaterialeEconomiaApprovato[]; daContabilizzare: number; totaleOperativo: number }
export type ScomposizioneVarianti = {
  totale: number; ordinarie: number; manodopera: number; materiali: number
  dettaglioMateriali?: readonly MaterialeEconomiaApprovato[]; cantiereNome?: string
  identitaMateriali?: readonly IdentitaMateriale[]
}
export function aggiungiCostoQuote(materiali: number, costi: number, quote: number) {
  // I totali preesistenti possono contenere frazioni di centesimo (es. voci analizzate).
  // Si conserva il loro valore monetario esposto, senza intervenire sul calcolo a monte.
  try { return { materiali: somma(Math.round(numero(materiali) * 100), cent(quote)) / 100, costi: somma(Math.round(numero(costi) * 100), cent(quote)) / 100 } }
  catch { return null }
}
const record = (v: unknown): v is Riga => !!v && typeof v === 'object' && !Array.isArray(v)
const errore = (): never => { throw Error('Riepilogo non verificabile: dati incompleti o incoerenti') }
function numero(v: unknown): number {
  if (!['string', 'number'].includes(typeof v) || String(v).trim() === '' || !Number.isFinite(Number(v))) return errore()
  return Number(v)
}
function cent(v: unknown): number {
  const n = numero(v), c = Math.round(n * 100)
  if (!Number.isSafeInteger(c) || Math.abs(n * 100 - c) > 0.000001) return errore()
  return c
}
function somma(a: number, b: number): number {
  if (!Number.isSafeInteger(a + b)) return errore()
  return a + b
}
function unico(v: unknown, ids: Set<string>): string {
  if (typeof v !== 'string' || !v || ids.has(v)) return errore()
  ids.add(v); return v
}
async function pagina(client: Client, nome: string, params: Riga, ordine: string): Promise<Riga[]> {
  const out: Riga[] = [], ids = new Set<string>()
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await client.rpc(nome, params).order(ordine, { ascending: true }).order('id', { ascending: true }).range(offset, offset + 199)
    if (error || !Array.isArray(data)) return errore()
    for (const r of data) { if (!record(r)) return errore(); unico(r.id, ids); out.push(r) }
    if (data.length < 200) return out
  }
}
function singola(data: unknown): Riga {
  const r = Array.isArray(data) ? data.length === 1 ? data[0] : null : data
  return record(r) ? r : errore()
}
export function scomponiVarianti(varianti: Riga[], sorgenti: Riga[], cantiereId: string, contrattoId: string): ScomposizioneVarianti {
  let totale = 0, ordinarie = 0, manodopera = 0, materiali = 0
  const dettaglioMateriali: MaterialeEconomiaApprovato[] = []
  const identitaMateriali: IdentitaMateriale[] = []
  let dettaglioCompleto = true
  const ids = new Set<string>(), raccolte = new Set<string>(), fonti = new Set<string>()
  for (const s of sorgenti) unico(s.id, fonti)
  for (const v of varianti) {
    unico(v.id, ids)
    if (v.cantiere_id !== cantiereId) return errore()
    if (v.stato !== 'approvata' || v.preventivo_contrattuale_id !== contrattoId) continue
    const importo = cent(v.importo_delta_approvato)
    totale = somma(totale, importo)
    const economia = sorgenti.filter(s => s.variante_id === v.id && s.tipo === 'raccolta_economia')
    if (!economia.length) { ordinarie = somma(ordinarie, importo); continue }
    if (economia.length !== 1) return errore()
    const s = economia[0], snap = s.snapshot
    unico(s.economia_raccolta_id, raccolte)
    if (s.snapshot_version !== 1 || !record(snap) || snap.raccolta_id !== s.economia_raccolta_id || snap.cantiere_id !== cantiereId ||
        numero(snap.revisione_sorgente) !== numero(s.economia_revisione_sorgente) || numero(snap.revisione_congelata) !== numero(s.economia_revisione_congelata) ||
        !Array.isArray(snap.registrazioni) || !snap.registrazioni.length || snap.numero_registrazioni !== snap.registrazioni.length) return errore()
    let righe = 0; const registrazioni = new Set<string>()
    for (const r of snap.registrazioni) {
      if (!record(r)) return errore()
      unico(r.id, registrazioni)
      const valore = cent(r.importo)
      if (valore <= 0) return errore()
      if (r.tipo_riga === 'manodopera') manodopera = somma(manodopera, valore)
      else if (r.tipo_riga === 'materiale') {
        materiali = somma(materiali, valore)
        const fatturaRigaId = r.dettagli_analitici?.fattura?.fattura_riga_id
        identitaMateriali.push({ raccoltaId: s.economia_raccolta_id, rigaId: r.id,
          sorgenteId: r.sorgente_id ?? null, fatturaRigaId: fatturaRigaId ?? null })
        try {
        const quantita = numero(r.quantita), prezzo = numero(r.prezzo_unitario)
        if (quantita <= 0 || prezzo < 0 || cent(costoNettoQuota(r.quantita, r.prezzo_unitario)) !== valore ||
            typeof r.descrizione !== 'string' || !r.descrizione.trim() || typeof r.unita_misura !== 'string' || !r.unita_misura.trim()) return errore()
        const testo = (v: unknown): string => typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
        const operativo = record(r.dettagli_analitici?.operativo) ? r.dettagli_analitici.operativo : {}
        const fattura = record(r.dettagli_analitici?.fattura) ? r.dettagli_analitici.fattura : {}
        const riferimento = [snap.numero == null ? '' : `Raccolta n. ${testo(snap.numero)}`, testo(snap.titolo) || testo(s.titolo),
          `rev. ${testo(snap.revisione_congelata)}`].filter(Boolean).join(' — ')
        dettaglioMateriali.push({ id: `${s.id}:${r.id}`, data: testo(fattura.data_fattura) || testo(operativo.data),
          fornitore: testo(fattura.fornitore) || testo(operativo.fornitore), fattura: testo(fattura.numero_fattura) || testo(operativo.documento),
          descrizione: r.descrizione, quantita, um: r.unita_misura, prezzo, totale: valore / 100, riferimento })
        } catch { dettaglioCompleto = false } // Il dettaglio non deve cambiare la disponibilità del totale contrattuale.
      }
      else return errore() // Non attribuire arbitrariamente righe generiche all'Economia lavoro/materiali.
      righe = somma(righe, valore)
    }
    if (righe !== importo || righe !== cent(snap.totale)) return errore()
  }
  if (somma(somma(ordinarie, manodopera), materiali) !== totale) return errore()
  return { totale: totale / 100, ordinarie: ordinarie / 100, manodopera: manodopera / 100, materiali: materiali / 100,
    dettaglioMateriali: dettaglioCompleto ? dettaglioMateriali : undefined, identitaMateriali }
}
export async function leggiScomposizioneVarianti(client: Client, cantiereId: string, contrattoId: string): Promise<ScomposizioneVarianti> {
  const varianti = await pagina(client, 'leggi_varianti_cantiere', { p_cantiere_id: cantiereId }, 'numero')
  const sorgenti: Riga[] = []
  for (const v of varianti.filter(v => v.stato === 'approvata' && v.preventivo_contrattuale_id === contrattoId)) {
    const elenco = await pagina(client, 'leggi_sorgenti_variante', { p_variante_id: v.id }, 'created_at')
    for (const s of elenco) {
      if (s.variante_id !== v.id) return errore()
      if (s.tipo !== 'raccolta_economia') continue
      const { data, error } = await client.rpc('leggi_sorgente_variante', { p_sorgente_id: s.id })
      if (error) return errore()
      const d = singola(data)
      if (d.id !== s.id || d.variante_id !== v.id || d.tipo !== s.tipo) return errore()
      sorgenti.push(d)
    }
  }
  return scomponiVarianti(varianti, sorgenti, cantiereId, contrattoId)
}
// Prodotto decimale esatto del prezzo netto documentale, NON prezzo cliente/Variante.
function decimale(v: unknown): { n: bigint; scala: number } {
  numero(v)
  const m = /^\+?(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(v).trim())
  if (!m || m[1].length + (m[2]?.length ?? 0) > 1000) return errore()
  const scala = (m[2]?.length ?? 0) - Number(m[3] ?? 0)
  if (!Number.isSafeInteger(scala) || Math.abs(scala) > 1000) return errore()
  const n = BigInt(m[1] + (m[2] ?? ''))
  return scala >= 0 ? { n, scala } : { n: n * BigInt(10) ** BigInt(-scala), scala: 0 }
}
export function costoNettoQuota(quantita: unknown, prezzoNetto: unknown): number {
  const q = decimale(quantita), p = decimale(prezzoNetto)
  if (q.n <= BigInt(0)) return errore()
  const n = q.n * p.n, scala = q.scala + p.scala
  const divisor = BigInt(10) ** BigInt(Math.max(0, scala - 2))
  const c = scala <= 2 ? n * BigInt(10) ** BigInt(2 - scala) : (n + divisor / BigInt(2)) / divisor
  const value = Number(c)
  return Number.isSafeInteger(value) ? value / 100 : errore()
}
function stabile(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(stabile).join(',') + ']'
  if (record(v)) return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stabile(v[k])).join(',') + '}'
  return JSON.stringify(v)
}
export function costoQuoteFattura(dettagli: Riga[], cantiereId: string, da = '', a = ''): number {
  let totale = 0
  const raccolte = new Set<string>(), righe = new Set<string>()
  for (const d of dettagli) {
    const c = d.raccolta
    if (!record(c) || c.cantiere_id !== cantiereId || !['bozza', 'chiusa'].includes(c.stato) || !Array.isArray(d.righe) || !Array.isArray(d.sorgenti)) return errore()
    unico(c.id, raccolte)
    const fonti = new Set<string>()
    const fattureNellaRaccolta = new Set<string>()
    for (const s of d.sorgenti) { if (!record(s) || s.raccolta_id !== c.id) return errore(); unico(s.id, fonti) }
    for (const r of d.righe) {
      if (!record(r) || r.raccolta_id !== c.id) return errore()
      unico(r.id, righe)
      if (r.fattura_riga_id == null && r.origine !== 'fattura_fornitore') continue
      const s = d.sorgenti.find((s: Riga) => s.id === r.sorgente_id), f = r.dettagli_analitici?.fattura
      if (r.origine !== 'fattura_fornitore' || typeof r.fattura_riga_id !== 'string' || !record(s) || s.tipo !== 'fattura_fornitore' || s.formato !== 'fattura' || s.snapshot_version !== 1 ||
          !record(f) || f.version !== 1 || stabile(s.snapshot) !== stabile(f) || f.fattura_riga_id !== r.fattura_riga_id || numero(f.quantita) !== numero(r.quantita)) return errore()
      unico(r.fattura_riga_id, fattureNellaRaccolta)
      // Prezzo originale netto acquisito dall'import; il totale originale può essere lordo IVA.
      const prezzo = f.prezzo_unitario_originale ?? f.prezzo_unitario
      const costo = cent(costoNettoQuota(r.quantita, prezzo))
      const data = f.data_fattura
      if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return errore()
      if ((da && data < da) || (a && data > a)) continue
      totale = somma(totale, costo)
    }
  }
  return totale / 100
}
export async function leggiCostoQuoteFattura(client: Client, cantiereId: string, da = '', a = ''): Promise<number> {
  return costoQuoteFattura(await leggiDettagliQuoteFattura(client, cantiereId), cantiereId, da, a)
}
async function leggiDettagliQuoteFattura(client: Client, cantiereId: string): Promise<Riga[]> {
  const { data, error } = await client.rpc('leggi_raccolte_economia', { p_cantiere_id: cantiereId })
  if (error || !Array.isArray(data)) return errore()
  const ids = new Set<string>(), dettagli: Riga[] = []
  for (const r of data) {
    if (!record(r) || r.cantiere_id !== cantiereId) return errore()
    unico(r.id, ids)
    const risposta = await client.rpc('leggi_raccolta_economia', { p_raccolta_id: r.id })
    if (risposta.error || !record(risposta.data) || risposta.data.raccolta?.id !== r.id || risposta.data.raccolta?.revisione !== r.revisione) return errore()
    dettagli.push(risposta.data)
  }
  return dettagli
}

// Solo elenco operativo: non alimenta contratto, SAL o costi. L'ID congelato è er.id,
// non l'ID della lavorazione Variante. La stessa fattura in raccolte diverse è distinta.
export function materialiDaContabilizzare(dettagli: Riga[], approvati: ScomposizioneVarianti, cantiereId: string): MaterialiOperativi {
  costoQuoteFattura(dettagli, cantiereId) // Mantiene le guardie certificate di provenienza fattura/snapshot.
  if (!Array.isArray(approvati.identitaMateriali) || !Array.isArray(approvati.dettaglioMateriali) ||
      approvati.identitaMateriali.length < approvati.dettaglioMateriali.length) return errore()
  const congelati = approvati.identitaMateriali
  const ids = new Set<string>()
  for (const x of congelati) {
    if (!x.raccoltaId || !x.rigaId || (x.fatturaRigaId !== null && (!x.fatturaRigaId || !x.sorgenteId))) return errore()
    unico(`${x.raccoltaId}:${x.rigaId}`, ids)
  }
  const righe: MaterialeEconomiaApprovato[] = []; let totale = 0
  for (const d of dettagli) for (const r of d.righe) {
    if (r.origine !== 'fattura_fornitore') continue
    const stessaRiga = congelati.find(x => x.rigaId === r.id)
    if (stessaRiga && (stessaRiga.raccoltaId !== r.raccolta_id || stessaRiga.sorgenteId !== r.sorgente_id || stessaRiga.fatturaRigaId !== r.fattura_riga_id)) return errore()
    if (stessaRiga) continue
    // Un'origine già congelata con ID riga differente è ambigua, non va sottratta euristicamente.
    if (congelati.some(x => x.raccoltaId === r.raccolta_id &&
        (x.fatturaRigaId === r.fattura_riga_id || x.sorgenteId === r.sorgente_id))) return errore()
    const f = r.dettagli_analitici.fattura
    const quantita = numero(r.quantita), prezzo = numero(r.prezzo_unitario)
    const valore = cent(costoNettoQuota(quantita, prezzo))
    if (r.tipo_riga !== 'materiale' || valore <= 0 || typeof r.descrizione !== 'string' || !r.descrizione.trim() ||
        typeof r.unita_misura !== 'string' || !r.unita_misura.trim() || cent(f.totale_economia) !== valore ||
        numero(f.prezzo_unitario_economia) !== prezzo || f.unita_misura_economia !== r.unita_misura) return errore()
    const testo = (v: unknown) => typeof v === 'string' ? v : ''
    righe.push({ id: `${r.raccolta_id}:${r.id}`, data: f.data_fattura, fornitore: testo(f.fornitore), fattura: testo(f.numero_fattura),
      descrizione: r.descrizione, quantita, um: r.unita_misura, prezzo, totale: valore / 100,
      riferimento: `Raccolta n. ${d.raccolta.numero ?? '—'} — ${d.raccolta.titolo ?? '—'}` })
    totale = somma(totale, valore)
  }
  return { righe, daContabilizzare: totale / 100, totaleOperativo: somma(cent(approvati.materiali), totale) / 100 }
}
export async function leggiMaterialiDaContabilizzare(client: Client, cantiereId: string, approvati: ScomposizioneVarianti): Promise<MaterialiOperativi> {
  // Lettura indipendente dal contratto corrente: un errore storico blocca soltanto
  // il dettaglio operativo, mai i totali contrattuali già caricati.
  const varianti = await pagina(client, 'leggi_varianti_cantiere', { p_cantiere_id: cantiereId }, 'numero')
  const contratti = new Set(varianti.filter(v => v.stato === 'approvata').map(v => v.preventivo_contrattuale_id))
  const identitaMateriali: IdentitaMateriale[] = []
  for (const id of contratti) {
    if (typeof id !== 'string' || !id) return errore()
    const snapshot = await leggiScomposizioneVarianti(client, cantiereId, id)
    if (!snapshot.identitaMateriali) return errore()
    identitaMateriali.push(...snapshot.identitaMateriali)
  }
  // Se le approvazioni cambiano durante il caricamento, non usare un elenco misto.
  for (const x of approvati.identitaMateriali ?? []) {
    if (!identitaMateriali.some(y => stabile(x) === stabile(y))) return errore()
  }
  return materialiDaContabilizzare(await leggiDettagliQuoteFattura(client, cantiereId), { ...approvati, identitaMateriali }, cantiereId)
}
