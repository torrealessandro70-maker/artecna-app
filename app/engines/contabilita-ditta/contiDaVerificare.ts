import { costruisciRiepilogo, centesimi, dataValida, FONTI, testo, type Fonti, type Fonte, type Periodo, type Riga } from './riepilogo'
import { preparaArchivioIva } from './prospettoIva'
import type { RigaIncasso, RiepilogoIncassi } from './incassiFatturazione'

export type LetturaContiIncassi = { dati: RiepilogoIncassi | null; da: string; a: string; errore: string; autore?: string; origine?: object }
export const GRUPPI_CONTI = { emesse: 'Fatture emesse: IVA da verificare', ricevute: 'Fatture ricevute: IVA da verificare', incassi: 'Incassi da riconciliare o verificare', altri: 'Altri documenti e movimenti esclusi' } as const
export type GruppoConto = keyof typeof GRUPPI_CONTI
export type ProblemaConto = { ambito: string; motivo: string; verifica: string }
export type ContoVerificare = {
  chiave: string; fonte: Fonte | 'incassi_lordi_clienti'; id: string | null; gruppo: GruppoConto; copie: number
  controparte: string; numero: string; data: string; destinazione: string; stato: string
  lordo: number | null; imponibile: number | null; iva: number | null; registrato: number | null
  url: string | null; problemi: ProblemaConto[]; movimento?: RigaIncasso; autore?: string
}
export const chiaveConto = (fonte: string, id: string) => JSON.stringify([fonte, id])
export function urlOriginaleSicuro(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  try { const u = new URL(raw); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null } catch { return null }
}
function verifica(motivo: string): string {
  if (/duplicat|ripetut|doppia/i.test(motivo)) return 'Confrontare le registrazioni originali e accertare quale documento rappresentano. Nessuna copia viene scelta automaticamente.'
  if (/data/i.test(motivo)) return 'Verificare la data sul documento originale; il periodo non viene ricostruito.'
  if (/XML|riepilog/i.test(motivo)) return 'Verificare la disponibilità e la coerenza dell’XML fiscale originale. PDF e OCR non certificano l’IVA.'
  if (/importo|totale|segno|base|imposta|aliquota/i.test(motivo)) return 'Confrontare gli importi e la natura fiscale con la fonte originale; nessuna aliquota viene presunta.'
  return 'Confrontare la registrazione con la fonte originale e le verifiche indicate. Nessuna riclassificazione automatica.'
}
function scheda(fonte: Fonte, righe: readonly Riga[], chiave: string): ContoVerificare {
  const r = righe.length === 1 ? righe[0] : {}, fattura = fonte === 'fatture_emesse' || fonte === 'fatture_fornitori'
  const id = testo(righe[0]?.id) || null
  return { chiave, fonte, id, gruppo: 'altri', copie: righe.length,
    controparte: testo(r.cliente || r.fornitore || r.operaio_nome), numero: testo(r.numero_fattura),
    data: testo(fattura ? r.data_fattura : fonte === 'pagamenti_operai' ? r.data_pagamento : fonte === 'pagamenti_fornitori' ? r.data_documento : r.data_incasso),
    destinazione: testo(r.cantiere || r.cantiere_id || r.destinazione), stato: testo(r.stato),
    lordo: fattura ? centesimi(fonte === 'fatture_emesse' ? r.totale : r.importo_totale) : null,
    imponibile: fattura ? centesimi(r.imponibile) : null, iva: null,
    registrato: fattura ? null : centesimi(fonte === 'pagamenti_fornitori' ? r.importo_pagato : r.importo),
    url: urlOriginaleSicuro(r.xml_url) || urlOriginaleSicuro(r.pdf_url), problemi: [] }
}
/** Solo trasformazioni della fotografia già autorizzata. Nessun IO, writer o somma tra registri. */
export function costruisciContiDaVerificare(fonti: Fonti, periodo: Periodo, incassi: LetturaContiIncassi | null) {
  const schede = new Map<string, ContoVerificare>(), posizioni = new Map<Fonte, ContoVerificare[]>()
  const avvisi: string[] = []
  const periodoValido = dataValida(periodo.da) && dataValida(periodo.a) && periodo.da <= periodo.a
  for (const fonte of FONTI) {
    const gruppi = new Map<string, Riga[]>()
    const chiavi = fonti[fonte].righe.map((r, i) => testo(r.id) ? chiaveConto(fonte, testo(r.id)) : JSON.stringify([fonte, null, i]))
    fonti[fonte].righe.forEach((r, i) => { const key = chiavi[i]; gruppi.set(key, [...(gruppi.get(key) || []), r]) })
    for (const [key, records] of gruppi) {
      const c = scheda(fonte, records, key)
      schede.set(key, c)
    }
    posizioni.set(fonte, chiavi.map(key => schede.get(key)!))
    if (fonti[fonte].stato !== 'pronta' || fonti[fonte].limite) avvisi.push(`${fonte}: lettura ${fonti[fonte].stato}. Elenco disponibile non completo o da verificare.`)
  }
  const archivio = preparaArchivioIva(fonti)
  const cursori = new Map<Fonte, number>()
  for (const d of archivio.documenti) {
    const indice = cursori.get(d.fonte) || 0
    cursori.set(d.fonte, indice + 1)
    const c = posizioni.get(d.fonte)?.[indice]
    if (!c) continue
    if (c.copie === 1) c.iva = d.iva
    if (d.iva === null && (!dataValida(d.data) || d.data >= periodo.da && d.data <= periodo.a)) {
      c.gruppo = d.fonte === 'fatture_emesse' ? 'emesse' : 'ricevute'
      c.problemi.push({ ambito: 'IVA esclusa dal calcolo', motivo: d.motivo, verifica: verifica(d.motivo) })
    }
  }
  for (const i of costruisciRiepilogo(fonti, periodo)) {
    if (!i.fonte) continue
    // Stesso ordine/contratto di filtro del lettore esistente: anche un ID
    // mancante resta legato alla sua posizione, mai a nome, data o importo.
    const indici = fonti[i.fonte].righe.map((r, n) => ({ r, n })).filter(({ r }) => i.id === 'pagato-fornitori' || i.ambito === 'progressivo' || !dataValida(r[i.data]) || (testo(r[i.data]) >= periodo.da && testo(r[i.data]) <= periodo.a))
    if (indici.length !== i.dettagli.length) { avvisi.push(`${i.fonte}: contratto del dettaglio non riconciliato, rileggere la fonte.`); continue }
    i.dettagli.forEach((d, n) => {
      if (d.incluso) return
      const c = posizioni.get(i.fonte!)?.[indici[n].n]
      const ambito = i.ambito === 'progressivo' ? 'Escluso dal cumulativo dichiarato' : 'Non conteggiato nel totale documentale'
      const motivo = `${i.nome}: ${d.motivo}`
      if (c && !c.problemi.some(p => p.ambito === ambito && p.motivo === motivo)) c.problemi.push({ ambito, motivo, verifica: verifica(d.motivo) })
    })
  }
  for (const c of posizioni.get('incassi_non_fatturati') || []) {
    if (!dataValida(c.data) || c.data >= periodo.da && c.data <= periodo.a) c.problemi.push({
      ambito: 'Registro storico separato dai KPI Incassi/Fatturazione',
      motivo: 'Registrazione storica non sommata automaticamente agli incassi lordi verificati, per evitare duplicazioni. La fonte non espone una riconciliazione individuale.',
      verifica: 'Confrontare il movimento originale con il registro degli incassi verificati, senza crearne una copia.' })
  }
  const incassiCompleti = !!incassi?.dati && !incassi.errore && incassi.da <= periodo.da && incassi.a >= periodo.a
  if (!incassiCompleti) avvisi.push('Incassi: copertura del periodo incompleta o lettura non disponibile. Nessuno zero sostitutivo.')
  for (const r of incassi?.dati?.righe ?? []) {
    if (dataValida(r.data) && (r.data < periodo.da || r.data > periodo.a)) continue
    if (r.riconciliare <= 0 && r.senzaFattura <= 0) continue
    const key = chiaveConto('incassi_lordi_clienti', r.id)
    const duplicato = schede.get(key)
    if (duplicato) {
      duplicato.copie++; duplicato.controparte = ''; duplicato.destinazione = ''; duplicato.data = ''; duplicato.stato = ''; duplicato.lordo = null; duplicato.movimento = undefined; duplicato.autore = undefined
      duplicato.problemi = [{ ambito: 'Identità non univoca', motivo: 'Identificativo movimento ripetuto: nessuna versione selezionata.', verifica: 'Rileggere la fonte autorizzata e riconciliare le registrazioni.' }]
      continue
    }
    const motivo = !r.quote.length ? 'Nessuna fattura collegata.' : r.quote.every(q => q.revocata) ? 'I collegamenti alle fatture risultano revocati.' : r.quote.some(q => !q.revocata && !q.valida) ? 'Copertura della fattura collegata non verificata. La fonte non dettaglia se la causa sia SdI, destinazione o rettifica.' : 'Quota non coperta da collegamenti documentali verificati.'
    schede.set(key, { chiave: key, fonte: 'incassi_lordi_clienti', id: r.id, gruppo: 'incassi', copie: 1,
      controparte: r.cliente, numero: '', data: r.data, destinazione: r.cantiere || r.cantiere_id, stato: r.fiscale.stato,
      lordo: r.totale, imponibile: null, iva: null, registrato: null, url: null, movimento: r, autore: incassi?.autore,
      problemi: [{ ambito: r.riconciliare > 0 ? 'Incasso registrato ma da riconciliare' : 'Posizione fiscale non determinabile', motivo, verifica: 'Verificare i collegamenti, la destinazione e i documenti originali. Incasso e obblighi fiscali restano separati.' }] })
  }
  if (!periodoValido) avvisi.push('Periodo non valido: correggere le date prima della consultazione.')
  const conti = periodoValido ? [...schede.values()].filter(c => c.problemi.length) : []
  return { conti, schede, avvisi, periodoValido, incassiCompleti }
}
export function filtraConti(conti: readonly ContoVerificare[], gruppo: string, cerca: string, pagina: number) {
  const query = cerca.trim().toLocaleLowerCase('it')
  const filtrati = conti.filter(c => (!gruppo || c.gruppo === gruppo) && (!query || [c.id, c.numero, c.controparte, c.destinazione, ...c.problemi.map(p => p.motivo)].join(' ').toLocaleLowerCase('it').includes(query)))
  const pagine = Math.max(1, Math.ceil(filtrati.length / 20)), corrente = Math.max(0, Math.min(Number.isSafeInteger(pagina) ? pagina : 0, pagine - 1))
  return { totale: filtrati.length, pagine, corrente, righe: filtrati.slice(corrente * 20, corrente * 20 + 20) }
}
