export type ClientNoteCredito = {
  rpc: (nome: string, parametri: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
}
export type QuotaCredito = {
  tipo: 'economia' | 'cantiere' | 'impresa' | 'spesa'; id: string; origine_riga_id: string
  cantiere_id: string | null; categoria: string; quantita: number; netto: number; costo: number
  numero_riga?: number; descrizione?: string; quantita_disponibile?: number; costo_disponibile?: number
}
export type RettificaCredito = {
  id: string; nota_id: string; nota_riga_id: string; origine_id: string; origine_riga_id: string
  categoria: string; cantiere_id: string | null; quantita: number; importo_netto: number; importo_costo: number
  data_nota: string; economia_riga_id: string | null; materiale_cantiere_id: string | null
  materiale_impresa_id: string | null; spesa_impresa_id: string | null
}
export type RigaNota = { id: string; numero_riga: number; descrizione: string; quantita: number; prezzo_unitario: number }
export type RiconciliazioneCredito = {
  stato: 'da riconciliare' | 'rettifica applicata'; motivo: string | null
  documento?: { id: string; tipo: string; numero: string; data: string; totale_originale: string; imponibile_originale: string; iva_originale: string
    riferimenti: { numero: string; data: string; linee: string[] }[] }
  origine?: { id: string; numero: string; data: string } | null
  quote: QuotaCredito[]; righe: RigaNota[]; rettifiche: RettificaCredito[]
}
export type CostoFornitori = {
  quote: (QuotaCredito & { documento_id: string; data: string })[]
  rettifiche: RettificaCredito[]; perimetro: string
}

async function chiamata<T>(client: ClientNoteCredito, nome: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(nome, params)
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    const messaggio = error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Risposta non disponibile'
    throw Error(messaggio)
  }
  if (nome !== 'leggi_costi_fornitori_rettificati') {
    const nota = data as Partial<RiconciliazioneCredito>
    if (!Array.isArray(nota.righe) || !Array.isArray(nota.quote) || !Array.isArray(nota.rettifiche)
      || !['da riconciliare', 'rettifica applicata'].includes(nota.stato || '')) throw Error('Riconciliazione non disponibile: risposta incompleta')
  }
  return data as T
}
export const leggiNotaCredito = (client: ClientNoteCredito, notaId: string) =>
  chiamata<RiconciliazioneCredito>(client, 'leggi_nota_credito_fornitore', { p_nota_id: notaId })
export const applicaNotaCredito = (client: ClientNoteCredito, notaId: string, origineId: string,
  righe: { nota_riga_id: string; tipo: string; quota_id: string; quantita: string; conferma_corrispondenza: boolean }[], richiestaId: string) =>
  chiamata<RiconciliazioneCredito>(client, 'applica_nota_credito_fornitore', {
    p_nota_id: notaId, p_origine_id: origineId, p_righe: righe, p_richiesta_id: richiestaId,
  })
export const leggiCostiFornitori = (client: ClientNoteCredito, cantiereId?: string, da?: string, a?: string) =>
  chiamata<CostoFornitori>(client, 'leggi_costi_fornitori_rettificati', {
    p_cantiere_id: cantiereId || null, p_da: da || null, p_a: a || null,
  })

function centesimi(value: unknown): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value))) {
    throw Error('Importo indisponibile: nessuna sostituzione con zero')
  }
  const n = Math.round(Number(value) * 100)
  if (!Number.isSafeInteger(n)) throw Error('Importo fuori intervallo')
  return n
}
export function riepilogaCostiFornitori(dati: CostoFornitori) {
  if (!Array.isArray(dati.quote) || !Array.isArray(dati.rettifiche)) throw Error('Fonti dei costi non disponibili')
  const visti = new Set<string>(), rettifiche = new Set<string>()
  let originali = 0, delta = 0
  for (const q of dati.quote) {
    const key = `${q.tipo}:${q.id}`
    if (visti.has(key)) throw Error('Quota duplicata nel riepilogo')
    visti.add(key)
    const valore = centesimi(q.costo)
    if (valore < 0) throw Error('Quota originaria con costo negativo non riconciliato')
    originali += valore
  }
  for (const r of dati.rettifiche) {
    if (rettifiche.has(r.id)) throw Error('Rettifica duplicata nel riepilogo')
    rettifiche.add(r.id)
    const valore = centesimi(r.importo_costo)
    if (valore >= 0) throw Error('Rettifica con segno non valido')
    delta += valore
  }
  return { originali: originali / 100, rettifiche: delta / 100, netto: (originali + delta) / 100 }
}
// Il costo quote è già sommato dal reader Economia esistente: qui solo il delta,
// senza aggiungere nuovamente le quote originali né il totale del documento TD04.
export function deltaRettifiche(dati: CostoFornitori, fonte?: 'materiali_cantiere' | 'economia') {
  riepilogaCostiFornitori(dati)
  return dati.rettifiche.filter(r => !fonte || (fonte === 'economia' ? r.economia_riga_id : r.materiale_cantiere_id))
    .reduce((tot, r) => tot + centesimi(r.importo_costo), 0) / 100
}

/** Verifica l'inclusione delle fonti, senza ricostruire associazioni dai nomi. */
export function rettificheCompatibiliConBase(dati: CostoFornitori, materialiBaseIds: readonly string[]) {
  const conteggi = new Map<string, number>()
  materialiBaseIds.forEach(id => conteggi.set(id, (conteggi.get(id) || 0) + 1))
  return dati.rettifiche.every(r => !r.materiale_cantiere_id || conteggi.get(r.materiale_cantiere_id) === 1)
}
