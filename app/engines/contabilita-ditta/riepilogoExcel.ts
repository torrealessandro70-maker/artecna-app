export type DocumentoExcel = { id: string; riga: number; data: string; numero: string; controparte: string; tipo: string; centesimi: number; stato: string }
export type ExportExcel = { documenti: DocumentoExcel[]; esclusioni: { riga: number; motivo: string }[]; foglio: string }
export type FiltriExcel = { da: string; a: string; controparte: string; numero: string; ordine: 'data-desc' | 'data-asc' | 'importo-desc' | 'controparte' }
export const filtriVuoti: FiltriExcel = { da: '', a: '', controparte: '', numero: '', ordine: 'data-desc' }
const normalizza = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
export function testoCella(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim()
  if (typeof v === 'object' && 'text' in v && typeof v.text === 'string') return v.text.trim()
  if (typeof v === 'object' && 'richText' in v && Array.isArray(v.richText)) return v.richText.map(t => testoCella(t)).join('').trim()
  return ''
}
export function centesimiExcel(v: unknown): number | null {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null
    const n = Math.round(v * 100)
    return Number.isSafeInteger(n) && Math.abs(v * 100 - n) < 0.00001 ? n : null
  }
  if (typeof v !== 'string') return null
  let s = v.trim().replace(/€/g, '').replace(/\s/g, '')
  if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1, -1)
  if (s.includes(',')) {
    if (!/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(s)) return null
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(s)) return null
  const negative = s.startsWith('-'); const [interi, decimali = ''] = s.replace(/^[+-]/, '').split('.')
  const n = Number(interi) * 100 + Number(decimali.padEnd(2, '0'))
  return Number.isSafeInteger(n) ? (negative ? -n : n) : null
}
export function dataExcel(v: unknown, date1904 = false): string | null {
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.toISOString().slice(0, 10) : null
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 0 || v > 2958465 || (!date1904 && Math.floor(v) === 60)) return null
    const giorni = Math.floor(v) - (!date1904 && v >= 60 ? 1 : 0)
    return new Date(Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 31) + giorni * 86400000).toISOString().slice(0, 10)
  }
  const s = testoCella(v); const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) ?? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s)?.map((x, i, a) => i === 1 ? a[3] : i === 3 ? a[1] : x)
  if (!m) return null
  const iso = `${m[1]}-${m[2]}-${m[3]}`; const d = new Date(iso + 'T00:00:00Z')
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null
}
const alias = {
  data: ['data', 'datadocumento', 'datadoc', 'datafattura', 'dataemissione'],
  numero: ['numero', 'numerodocumento', 'numdocumento', 'numerofattura', 'ndocumento', 'nfattura', 'nrdocumento'],
  controparte: ['cliente', 'fornitore', 'clientefornitore', 'denominazione', 'ragionesociale', 'controparte'],
  tipo: ['tipo', 'tipodocumento', 'tipodoc', 'tipofattura'],
  importo: ['importo', 'totale', 'totaledocumento', 'totalefattura', 'importototale', 'totalelordo'],
  stato: ['stato', 'statodocumento', 'statosdi', 'esitosdi', 'esitoinvio'],
} as const
type Colonne = Record<keyof typeof alias, number>
export function intestazioneExcel(riga: unknown[]): Colonne | null {
  const h = riga.map(v => normalizza(testoCella(v))); const c = {} as Colonne
  for (const key of Object.keys(alias) as (keyof typeof alias)[]) {
    const indices = h.flatMap((v, i) => (alias[key] as readonly string[]).includes(v) ? [i] : [])
    if (indices.length > 1) return null
    c[key] = indices[0] ?? -1
  }
  return c.data >= 0 && c.numero >= 0 && c.controparte >= 0 && c.importo >= 0 && c.tipo >= 0 ? c : null
}
function tipoDocumento(v: unknown): { tipo: string; credito: boolean } | null {
  const s = testoCella(v); const n = normalizza(s); const td = /\bTD(\d{2})\b/i.exec(s)
  if (td) return ['01','02','03','04','05','06','07','08','09','16','17','18','19','20','21','22','23','24','25','26','27','28','29'].includes(td[1]) ? { tipo: s, credito: ['04','08'].includes(td[1]) } : null
  if (['fattura','fatturaimmediata','fatturadifferita','fatturadifferitaart21comma4letta','parcella','notadidebito'].includes(n)) return { tipo: s, credito: false }
  if (['notadicredito','notadiaccredito'].includes(n)) return { tipo: s, credito: true }
  return null
}
export function analizzaRigheExcel(righe: unknown[][], foglio = 'Documenti', date1904 = false): ExportExcel {
  if (righe.length > 20000) throw new Error('Troppi dati: massimo 20.000 righe per export.')
  const matches = righe.slice(0, 30).flatMap((r, i) => intestazioneExcel(r) ? [{ i, c: intestazioneExcel(r)! }] : [])
  if (!matches.length || matches.some(m => JSON.stringify(m.c) !== JSON.stringify(matches[0].c))) throw new Error('Intestazioni non riconosciute o ambigue: servono Data, Numero, Cliente/Fornitore, Tipo documento e Totale lordo.')
  const { i, c } = matches[0]; const esclusioni: ExportExcel['esclusioni'] = []; const parsed: DocumentoExcel[] = []
  for (let idx = i + 1; idx < righe.length; idx++) {
    const r = righe[idx]; if (r.every(v => !testoCella(v) && !(v instanceof Date))) continue
    const exclude = (motivo: string) => esclusioni.push({ riga: idx + 1, motivo })
    if (intestazioneExcel(r)) { exclude('Intestazione ripetuta'); continue }
    const tipo = tipoDocumento(r[c.tipo]); const numero = testoCella(r[c.numero]); const controparte = testoCella(r[c.controparte])
    const data = dataExcel(r[c.data], date1904); const importo = centesimiExcel(r[c.importo])
    if (!tipo || !numero || !controparte || !data || importo === null) { exclude('Riga non documentale o dati mancanti/ambigui (tipo, data, numero, controparte o importo); formule non conteggiate.'); continue }
    const centesimi = tipo.credito ? -Math.abs(importo) : importo
    parsed.push({ id: `${foglio}:${idx + 1}`, riga: idx + 1, data, numero, controparte, tipo: tipo.tipo, centesimi, stato: c.stato >= 0 ? testoCella(r[c.stato]) || 'Non disponibile' : 'Non disponibile' })
  }
  const groups = new Map<string, DocumentoExcel[]>()
  for (const d of parsed) {
    const key = JSON.stringify([d.data.slice(0,4), d.numero.trim().toUpperCase(), d.controparte.trim().toLocaleUpperCase('it-IT'), /\bTD\d{2}\b/i.exec(d.tipo)?.[0].toUpperCase() ?? normalizza(d.tipo)])
    groups.set(key, [...(groups.get(key) ?? []), d])
  }
  const documenti: DocumentoExcel[] = []
  for (const group of groups.values()) {
    const d = group[0]
    if (group.some(x => x.data !== d.data || x.centesimi !== d.centesimi || x.stato !== d.stato)) {
      for (const x of group) esclusioni.push({ riga: x.riga, motivo: 'Identità documento ripetuta con dati discordanti: tutte le occorrenze escluse, verificare la fonte.' })
    } else {
      documenti.push(d)
      for (const x of group.slice(1)) esclusioni.push({ riga: x.riga, motivo: `Duplicato esatto della riga ${d.riga}: conteggiato una sola volta.` })
    }
  }
  totaleExcel(documenti)
  return { documenti, esclusioni: esclusioni.sort((a,b) => a.riga-b.riga), foglio }
}
export function totaleExcel(righe: DocumentoExcel[]): number {
  let somma = 0
  for (const r of righe) { somma += r.centesimi; if (!Number.isSafeInteger(somma)) throw new Error('Totale oltre il limite numerico consentito.') }
  return somma
}
export function filtraExcel(righe: DocumentoExcel[], f: FiltriExcel): DocumentoExcel[] {
  return righe.filter(r => (!f.da || r.data >= f.da) && (!f.a || r.data <= f.a) && r.controparte.toLocaleLowerCase('it-IT').includes(f.controparte.toLocaleLowerCase('it-IT')) && r.numero.toLowerCase().includes(f.numero.toLowerCase()))
    .sort((a,b) => (f.ordine === 'importo-desc' ? b.centesimi-a.centesimi : f.ordine === 'controparte' ? a.controparte.localeCompare(b.controparte,'it') : f.ordine === 'data-asc' ? a.data.localeCompare(b.data) : b.data.localeCompare(a.data)) || a.id.localeCompare(b.id))
}
export async function leggiExportExcel(bytes: ArrayBuffer): Promise<ExportExcel> {
  if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024) throw new Error('File vuoto o oltre 10 MiB.')
  verificaArchivioExcel(bytes)
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  // ExcelJS reads cell values only; formulas are never evaluated or executed.
  await workbook.xlsx.load(bytes)
  const candidati: { righe: unknown[][]; nome: string }[] = []
  workbook.eachSheet(sheet => {
    if (sheet.state !== 'visible') return
    if (sheet.rowCount > 20000 || sheet.columnCount > 100) throw new Error('Export oltre i limiti di righe o colonne.')
    const righe: unknown[][] = []
    for (let i=1; i<=sheet.rowCount; i++) {
      const r: unknown[] = []; for (let j=1; j<=sheet.columnCount; j++) r.push(sheet.getCell(i,j).value)
      righe.push(r)
    }
    if (righe.slice(0,30).some(r => intestazioneExcel(r))) candidati.push({ righe, nome: sheet.name })
  })
  if (candidati.length !== 1) throw new Error('Serve un solo foglio documentale riconoscibile. Gli altri fogli non vengono sommati automaticamente.')
  return analizzaRigheExcel(candidati[0].righe, candidati[0].nome, workbook.properties.date1904)
}

// Bound the declared expanded ZIP before the workbook parser allocates its contents.
export function verificaArchivioExcel(bytes: ArrayBuffer) {
  const b = new Uint8Array(bytes); const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let end = -1
  for (let i=b.length-22; i>=Math.max(0,b.length-65557); i--) if(v.getUint32(i,true)===0x06054b50){end=i;break}
  if(end<0 || v.getUint16(end+4,true)!==0 || v.getUint16(end+6,true)!==0) throw new Error('Archivio Excel non valido.')
  const entries=v.getUint16(end+10,true);let offset=v.getUint32(end+16,true);let expanded=0
  if(entries>1000 || v.getUint16(end+8,true)!==entries) throw new Error('Archivio Excel oltre i limiti.')
  for(let i=0;i<entries;i++){
    if(offset+46>b.length || v.getUint32(offset,true)!==0x02014b50 || (v.getUint16(offset+8,true)&1)) throw new Error('Archivio Excel non supportato.')
    expanded+=v.getUint32(offset+24,true)
    if(expanded>40*1024*1024) throw new Error('Contenuto Excel oltre 40 MiB.')
    offset+=46+v.getUint16(offset+28,true)+v.getUint16(offset+30,true)+v.getUint16(offset+32,true)
  }
  if(offset!==end) throw new Error('Indice Excel non valido.')
}
