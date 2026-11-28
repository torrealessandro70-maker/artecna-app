import { centesimiExcel, dataExcel, testoCella, verificaArchivioExcel } from '../contabilita-ditta/riepilogoExcel'
import { leggiFatturaEmessaXml, xmlFattura, type FatturaEmessaXml } from './documento-fiscale'
import { risolviFonteIvaPersistita } from '../contabilita-ditta/fonteIva'

export type FonteBluenext = { sha256: string; nome: string; tipo: 'xml' | 'zip' | 'xlsx' | 'xls'; base64: string; bytes: number }
export type RigaEsito = { fonte: string; foglio: string; riga: number; numero: string; data: string; tipo: string; cliente: string; identificativo: string; totale: number; esito: string; idSdi: string; importata: string; nonRegistrata: string }
export type OperazionePreparata = { rpc: 'riconcilia_acconto_fattura'; args: Record<string, unknown> }
export type DocumentoIntegrato = { xml: string; nome: string; xml_sha: string; archivio?: string; documento: FatturaEmessaXml; identificativi: string[]; descrizioni: string[]; report?: RigaEsito; reports?: RigaEsito[]; ricevuta?: { xml: string; fonte: string; nome: string; archivio?: string }; problemi: string[]; cantiere?: string; operazioni?: OperazionePreparata[] }
export type AnalisiBluenext = { documenti: DocumentoIntegrato[]; anomalie: string[]; reportOrfani: RigaEsito[] }
const normal = (v: string) => v.trim().replace(/\s+/g, ' ').toUpperCase()
export const identitaFiscale = (v: string) => normal(v).replace(/^IT(?=\d{11}$)/, '')
export const sha256 = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)), x => x.toString(16).padStart(2, '0')).join('')
export function base64(bytes: Uint8Array): string {
  let text = ''; for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(text)
}
export function bytesFonte(f: FonteBluenext): Uint8Array { return Uint8Array.from(atob(f.base64), x => x.charCodeAt(0)) }
export async function preparaFile(file: File): Promise<FonteBluenext> {
  const ext = file.name.toLowerCase().split('.').pop()
  if (!['xml', 'zip', 'xlsx', 'xls'].includes(ext ?? '')) throw Error('Formato non supportato: usare XML, ZIP, XLSX o XLS.')
  if (!file.size || file.size > 10 * 1024 * 1024) throw Error('File vuoto o oltre 10 MiB.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  return { nome: file.name, tipo: ext as FonteBluenext['tipo'], bytes: bytes.length, sha256: await sha256(bytes), base64: base64(bytes) }
}
const colonne = ['Num. documento', 'Data doc.', 'Tipo', 'Cliente', 'Partita IVA', 'Importo', 'Esito invio', 'Data Importazione', 'Non Registrata', 'Id SDI']
export async function leggiReport(fonte: FonteBluenext): Promise<RigaEsito[]> {
  const bytes = bytesFonte(fonte)
  if (fonte.tipo === 'xlsx') verificaArchivioExcel(bytes.buffer as ArrayBuffer)
  const XLSX = await import('xlsx')
  const book = XLSX.read(bytes, { type: 'array', cellDates: false, raw: true })
  const candidates = book.SheetNames.flatMap(nome => {
    const sheet = book.Sheets[nome]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true })
    if (rows.length > 20000 || Object.keys(sheet).length > 210000) throw Error('Report oltre i limiti di sicurezza.')
    return rows.slice(0, 30).flatMap((row, i) => {
      const names = row.map(v => normal(testoCella(v)))
      return colonne.every(c => names.filter(v => v === normal(c)).length === 1) ? [{ nome, rows, sheet, at: i, columns: colonne.map(c => names.indexOf(normal(c))) }] : []
    })
  })
  if (candidates.length !== 1) throw Error('Serve un solo foglio con le dieci colonne del report Bluenext, senza intestazioni ambigue.')
  const { nome, rows, sheet, at, columns: c } = candidates[0], result: RigaEsito[] = []
  for (let n = at + 1; n < rows.length; n++) {
    const row = rows[n], val = (i: number) => row[c[i]]
    if (!row.some(v => testoCella(v))) continue
    // Summary/calculation rows are not invoice records. A document-like broken row is an anomaly, never silently dropped.
    if (!testoCella(val(0)) && !testoCella(val(1)) && !testoCella(val(3))) continue
    if (/^(TOTALE|TOTALI|DIFFERENZA|ANNOTAZIONI|NOTE)(\b|:)/.test(normal(testoCella(val(0)))) && !testoCella(val(3)) && !testoCella(val(4))) continue
    if (row.some((_, j) => sheet[XLSX.utils.encode_cell({ r: n, c: j })]?.f)) throw Error(`Riga ${n + 1}: formule non ammesse nei documenti.`)
    const date = dataExcel(val(1), !!book.Workbook?.WBProps?.date1904), money = centesimiExcel(val(5))
    if (!date || money === null || !testoCella(val(0)) || !testoCella(val(3))) throw Error(`Riga ${n + 1}: identità, data o importo non verificabili.`)
    const text = (i: number) => typeof val(i) === 'boolean' ? String(val(i)) : testoCella(sheet[XLSX.utils.encode_cell({ r: n, c: c[i] })]?.w ?? val(i))
    const id = text(9)
    if (typeof val(9) === 'number' && !Number.isSafeInteger(val(9)) || id && !/^\d{1,30}$/.test(id)) throw Error(`Riga ${n + 1}: Id SDI non verificabile; esportare come testo senza notazione scientifica.`)
    result.push({ fonte: fonte.sha256, foglio: nome, riga: n + 1, numero: text(0), data: date, tipo: text(2), cliente: text(3), identificativo: identitaFiscale(text(4)), totale: money / 100, esito: text(6), idSdi: id, importata: text(7), nonRegistrata: text(8) })
  }
  return result
}
export function esitoIntermediario(esito: string): string {
  const s = normal(esito)
  return ({ 'IMPOSSIBILITÀ DI RECAPITO': 'mancata_consegna', 'IMPOSSIBILITA DI RECAPITO': 'mancata_consegna', 'CONSEGNATA': 'consegnata', 'SCARTATA': 'scartata', 'INVIATA': 'inviata' } as Record<string, string>)[s] ?? 'da_verificare'
}
export async function analizzaFonti(fonti: FonteBluenext[]): Promise<AnalisiBluenext> {
  if (fonti.length > 30 || fonti.reduce((n, f) => n + f.bytes, 0) > 30 * 1024 * 1024) throw Error('Massimo 30 file e 30 MiB per analisi.')
  const documenti: DocumentoIntegrato[] = [], reports: RigaEsito[] = [], anomalie: string[] = [], receipts: { xml: string; fonte: string; nome: string; file: string; archivio?: string }[] = []
  async function xml(raw: string, nome: string, source: string, archivio?: string) {
    if (new TextEncoder().encode(raw).length > 2000000) throw Error('XML oltre 2 MB.')
    const doc = xmlFatturaOEsito(raw), hash = await sha256(new TextEncoder().encode(raw))
    if (doc.root !== 'FatturaElettronica') { receipts.push({ xml: raw, fonte: hash, nome: doc.nome, file: nome, archivio: hash !== source ? source : undefined }); return }
    const parsed = leggiFatturaEmessaXml(raw)
    const currency = doc.document.getElementsByTagNameNS('*', 'Divisa')
    const cliente = doc.document.getElementsByTagNameNS('*', 'CessionarioCommittente')[0]
    const ids = ['IdCodice', 'CodiceFiscale'].flatMap(tag => Array.from(cliente.getElementsByTagNameNS('*', tag)).map(n => identitaFiscale(n.textContent ?? '')).filter(Boolean))
    for (const id of Array.from(cliente.getElementsByTagNameNS('*', 'IdFiscaleIVA'))) ids.push(identitaFiscale((id.getElementsByTagNameNS('*', 'IdPaese')[0]?.textContent ?? '') + (id.getElementsByTagNameNS('*', 'IdCodice')[0]?.textContent ?? '')))
    const problemi = ['TD01','TD02','TD04'].includes(parsed.tipo) ? [] : ['Tipo fiscale da gestire con il percorso dedicato.']
    if (currency.length !== 1 || currency[0].textContent?.trim() !== 'EUR') problemi.push('Valuta diversa da EUR o non documentata: nessuna conversione presunta.')
    documenti.push({ xml: raw, nome, xml_sha: hash, archivio: archivio ?? (hash !== source ? source : undefined), documento: parsed, identificativi: ids, descrizioni: Array.from(doc.document.getElementsByTagNameNS('*', 'Descrizione')).map(n => n.textContent ?? ''), problemi })
  }
  for (const f of fonti) {
    try {
      if (f.tipo === 'xls' || f.tipo === 'xlsx') reports.push(...await leggiReport(f))
      else if (f.tipo === 'xml') await xml(new TextDecoder('utf-8', { fatal: true }).decode(bytesFonte(f)), f.nome, f.sha256)
      else {
        verificaArchivioExcel(bytesFonte(f).buffer as ArrayBuffer)
        const JSZip = (await import('jszip')).default, zip = await JSZip.loadAsync(bytesFonte(f), { checkCRC32: true })
        const entries = Object.values(zip.files).filter(v => !v.dir)
        if (entries.length > 1000) throw Error('Troppi elementi nell’archivio.')
        for (const e of entries) {
          if (/\.xml$/i.test(e.name)) await xml(await e.async('string'), `${f.nome} / ${e.name}`, f.sha256, f.sha256)
          else anomalie.push(`${f.nome} / ${e.name}: contenuto non XML escluso dall’analisi fiscale.`)
        }
      }
    } catch (e) { anomalie.push(`${f.nome}: ${e instanceof Error ? e.message : 'File non leggibile'}`) }
  }
  const groups = new Map<string, DocumentoIntegrato[]>()
  for (const d of documenti) { const key = JSON.stringify([normal(d.documento.cedente), d.documento.data.slice(0, 4), normal(d.documento.numero)]); groups.set(key, [...groups.get(key) ?? [], d]) }
  const used = new Set<RigaEsito>(), unique: DocumentoIntegrato[] = []
  for (const variants of groups.values()) {
    const d = variants[0], x = d.documento
    if (new Set(variants.map(v => v.xml_sha)).size > 1) d.problemi.push('XML differenti per la stessa identità: verifica manuale.')
    const matching = reports.filter(r => normal(r.numero) === normal(x.numero) && r.data === x.data && Math.round(r.totale * 100) === Math.round(x.totale * 100) && d.identificativi.includes(r.identificativo))
    matching.forEach(r => used.add(r))
    const signatures = new Set(matching.map(r => JSON.stringify([r.tipo, normal(r.cliente), r.identificativo, r.esito, r.idSdi])))
    if (signatures.size > 1) d.problemi.push('Report intermediario discordanti: nessun esito sovrascritto automaticamente.')
    else if (matching.length) { d.report = matching[0];d.reports = matching }
    if (!matching.length && reports.some(r => normal(r.numero) === normal(x.numero) && r.data === x.data)) d.problemi.push('Excel presente ma identificativo fiscale o totale discordante.')
    if (d.report && normal(d.report.cliente) !== normal(x.cliente)) d.problemi.push('Denominazione cliente discordante: verificare sul documento.')
    if (d.report) {
      const tipi: Record<string, string[]> = { FATTURA: ['TD01','TD02'], 'FATTURA IMMEDIATA': ['TD01','TD02'], 'NOTA DI CREDITO': ['TD04'], 'FATTURA DIFFERITA': ['TD24'] }
      const codici = /^TD\d{2}$/.test(d.report.tipo) ? [d.report.tipo] : tipi[normal(d.report.tipo)]
      if (!codici?.includes(x.tipo)) d.problemi.push('Tipo fiscale XML/Excel discordante o non riconosciuto.')
    }
    const file = d.nome.split(/[\\/]/).pop()?.trim()
    const rs = [...new Map(receipts.filter(r => r.nome === file).map(r => [r.fonte, r])).values()]
    if (rs.length === 1) {
      const source = rs[0], receipt = xmlFatturaOEsito(source.xml).document
      const field = (tag: string) => receipt.getElementsByTagNameNS('*', tag)[0]?.textContent?.trim() ?? ''
      const date = field('DataOraRicezione'), outcome = field('DataOraConsegna') || field('DataOraMessaADisposizione')
      if (!/^\d+$/.test(field('IdentificativoSdI')) || d.report?.idSdi && field('IdentificativoSdI') !== d.report.idSdi
        || !/(?:Z|[+-]\d{2}:\d{2})$/.test(date) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(outcome)
        || !Number.isFinite(Date.parse(date)) || !Number.isFinite(Date.parse(outcome))) d.problemi.push('Ricevuta SdI incompleta o discordante: verificare identificativo e date originali, senza usare Data Importazione.')
      else d.ricevuta = { xml: source.xml, fonte: source.fonte, nome: source.file, archivio: source.archivio }
    }
    else if (rs.length > 1) d.problemi.push('Più ricevute: verificare la cronologia degli esiti.')
    unique.push(d)
  }
  return { documenti: unique, anomalie, reportOrfani: reports.filter(r => !used.has(r)) }
}
export async function fontiConDerivati(fonti: FonteBluenext[], documenti: DocumentoIntegrato[]): Promise<FonteBluenext[]> {
  const result = new Map(fonti.map(f => [f.sha256, f]))
  for (const d of documenti) for (const item of [{ xml: d.xml, hash: d.xml_sha, nome: d.nome }, ...(d.ricevuta ? [{ xml: d.ricevuta.xml, hash: d.ricevuta.fonte, nome: d.ricevuta.nome }] : [])]) {
    const bytes = new TextEncoder().encode(item.xml)
    if (await sha256(bytes) !== item.hash) throw Error('Fonte cambiata dopo l’analisi.')
    if (!result.has(item.hash)) result.set(item.hash, { sha256: item.hash, nome: item.nome, tipo: 'xml', base64: base64(bytes), bytes: bytes.length })
  }
  return [...result.values()]
}
// A draft preview only: the server reparses the original XML and calls the existing writer at final confirmation.
export function anteprimaIvaXml(d: DocumentoIntegrato) {
  const xml = xmlFattura(d.xml), tags = (node: Element | Document, tag: string) => Array.from(node.getElementsByTagNameNS('*', tag)), value = (node: Element, tag: string) => tags(node, tag)[0]?.textContent?.trim() ?? ''
  const gruppi = tags(xml, 'DatiRiepilogo').map(g => ({ imponibile: Number(value(g, 'ImponibileImporto')), iva: Number(value(g, 'Imposta')), aliquota: Number(value(g, 'AliquotaIVA')), natura: value(g, 'Natura') || null }))
  const canon = risolviFonteIvaPersistita({ id: 'anteprima', numero_fattura: d.documento.numero, data_fattura: d.documento.data, cliente: d.documento.cliente, tipo_documento: d.documento.tipo, imponibile: d.documento.imponibile, iva: d.documento.iva, totale: d.documento.totale }, { semantica: 'importo', documento_verificato: true, riferimento: `XML originale ${d.xml_sha}`, gruppi })
  const speciale = tags(xml, 'EsigibilitaIVA').some(n => n.textContent?.trim() !== 'I') || gruppi.some(g => g.natura?.startsWith('N6'))
  return { valida: canon.valida && !speciale, motivo: speciale ? 'Regime speciale: usare il percorso fiscale dedicato.' : canon.motivo, fonte: 'XML originale nel lotto, non ancora registrato', impronta: d.xml_sha, gruppi: canon.gruppi }
}
function xmlFatturaOEsito(raw: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(raw)) throw Error('Dichiarazioni XML esterne non ammesse.')
  const document = new DOMParser().parseFromString(raw, 'text/xml')
  if (document.getElementsByTagName('parsererror').length) throw Error('XML non leggibile.')
  const root = document.documentElement.localName
  if (root === 'FatturaElettronica') xmlFattura(raw)
  else if (!['RicevutaConsegna', 'NotificaMancataConsegna', 'NotificaScarto'].includes(root)) throw Error('XML non riconosciuto come fattura o ricevuta SdI supportata.')
  return { document, root, nome: document.getElementsByTagNameNS('*', 'NomeFile')[0]?.textContent?.trim() ?? '' }
}
