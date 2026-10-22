import type { CadEntity, CadPoint } from '../cad/entities'
import type { PaginaQuadernoNota } from '../../components/note/types'
import { workspacePointToPagePoint } from '../cad/workspace-coordinates'
import { getCadEntitiesFromPage } from '../cad/integration'
export type UnitaDxf = 'mm' | 'cm' | 'm'
const codes = { mm: 4, cm: 5, m: 6 }
const pairs = (code: number, value: string | number) => `${code}\n${value}\n`
const finite = (n: number) => { if (!Number.isFinite(n) || Math.abs(n) > 1e12) throw Error('Coordinate DXF non valide'); return n }
export function esportaDxf(page: PaginaQuadernoNota, workspace: CadEntity[] = page.workspaceCadEntities || []) {
  const c = page.scaleCalibration
  if (!c || !Number.isFinite(c.pixelDistance) || !Number.isFinite(c.realDistance) || c.pixelDistance <= 0 || c.realDistance <= 0 || !codes[c.unit]) throw Error('Calibrare la pagina con una misura reale prima di esportare CAD: i pixel non sono unità CAD')
  const scale = c.realDistance / c.pixelDistance, origin = page.cadOrigin || { x: 0, y: 0 }, warnings = new Set<string>()
  const point = (p: CadPoint) => ({ x: finite(p.x * scale + origin.x), y: finite(-p.y * scale + origin.y) })
  const xy = (p: CadPoint, n = 10) => { const q = point(p); return pairs(n, q.x) + pairs(n + 10, q.y) }
  let body = ''; const exportedLayers = new Set<string>()
  const poly = (points: CadPoint[], closed: boolean, layer: string) => pairs(0, 'LWPOLYLINE') + pairs(100, 'AcDbEntity') + pairs(8, layer) + pairs(100, 'AcDbPolyline') + pairs(90, points.length) + pairs(70, closed ? 1 : 0) + points.map(p => xy(p)).join('')
  const entities = new Map(getCadEntitiesFromPage(page).map(e => [e.id, e]))
  for (const e of workspace) {
    if (!e.metadata?.workspacePageId) { warnings.add('Entità workspace senza pagina assegnata escluse'); continue }
    if (e.metadata.workspacePageId !== page.id) continue
    warnings.add('Entità workspace della pagina incluse intere, senza ritaglio ai bordi')
    const local = (p: CadPoint) => workspacePointToPagePoint(p, page)
    const converted: CadEntity = e.type === 'line' || e.type === 'dimension' ? { ...e, start: local(e.start), end: local(e.end) } : e.type === 'circle' ? { ...e, center: local(e.center) } : e.type === 'text' || e.type === 'pin' ? { ...e, position: local(e.position) } : e.type === 'freehand' || e.type === 'polyline' || e.type === 'area' ? { ...e, points: e.points.map(local) } : { ...e, transform: { ...e.transform, ...local(e.transform) } }
    entities.set(e.id, converted)
  }
  for (const e of entities.values()) {
    const layer = e.layerId.replace(/[<>/\\":;?*|=\r\n]/g, '_') || '0'
    exportedLayers.add(layer)
    const head = (type: string) => pairs(0, type) + pairs(8, layer)
    const legacy = page.disegni.find(segno => segno.id === e.id);
    if (legacy && e.type === 'freehand' && ['rettangolo', 'cerchio', 'testo'].includes(legacy.strumento)) {
      const first = legacy.punti[0], last = legacy.punti.at(-1);
      if (!first || !last) { warnings.add('Forma legacy vuota esclusa'); continue }
      if (legacy.strumento === 'rettangolo') { body += poly([first, { x: last.x, y: first.y }, last, { x: first.x, y: last.y }], true, layer); warnings.add('Rettangoli convertiti in polilinee chiuse') }
      if (legacy.strumento === 'cerchio') {
        const rx = Math.abs(last.x - first.x) / 2, ry = Math.abs(last.y - first.y) / 2, center = { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 };
        if (rx <= 0 || ry <= 0) { warnings.add('Ellisse degenere esclusa'); continue }
        if (Math.abs(rx - ry) < 1e-8) body += head('CIRCLE') + xy(center) + pairs(40, rx * scale);
        else { warnings.add('Ellissi legacy approssimate con 128 segmenti'); body += poly(Array.from({ length: 128 }, (_, i) => ({ x: center.x + rx * Math.cos(i * 2 * Math.PI / 128), y: center.y + ry * Math.sin(i * 2 * Math.PI / 128) })), true, layer) }
      }
      if (legacy.strumento === 'testo') { warnings.add('Testi TEXT: font/stile e righe multiple semplificati'); body += head('TEXT') + xy(first) + pairs(40, (legacy.metadati?.fontSize || legacy.spessore) * scale) + pairs(50, -(legacy.metadati?.rotation || 0)) + pairs(1, (legacy.metadati?.testo || '').replace(/[\r\n]/g, ' ')) }
      continue
    }
    if (legacy?.strumento === 'freccia') warnings.add('Frecce convertite in tracciato, punta esclusa');
    switch (e.type) {
      case 'line': body += head('LINE') + xy(e.start) + xy(e.end, 11); break
      case 'circle': body += head('CIRCLE') + xy(e.center) + pairs(40, finite(e.radius * scale)); break
      case 'freehand': warnings.add('Tratti liberi convertiti in polilinee'); body += poly(e.points, false, layer); break
      case 'polyline': body += poly(e.points, e.closed, layer); break
      case 'area': warnings.add('Aree convertite in contorni chiusi, senza dati di computo'); body += poly(e.points, true, layer); break
      case 'rectangle': {
        warnings.add('Rettangoli convertiti in polilinee chiuse')
        const t = e.transform, angle = t.rotation * Math.PI / 180
        const pts = [[0, 0], [t.width * (t.scaleX ?? 1), 0], [t.width * t.scaleX, t.height * (t.scaleY ?? 1)], [0, t.height * t.scaleY]].map(([x, y]) => ({ x: t.x + x * Math.cos(angle) - y * Math.sin(angle), y: t.y + x * Math.sin(angle) + y * Math.cos(angle) }))
        body += poly(pts, true, layer); break
      }
      case 'text': warnings.add('Testi TEXT: font/stile e righe multiple semplificati'); body += head('TEXT') + xy(e.position) + pairs(40, finite(e.fontSize * scale)) + pairs(50, -e.rotation) + pairs(1, e.content.replace(/[\r\n]/g, ' ')); break
      case 'dimension': warnings.add('Quote convertite in linea di misura: vincoli, testo e offset non trasferiti'); body += head('LINE') + xy(e.start) + xy(e.end, 11); break
      default: warnings.add(`Escluso: ${e.type}`)
    }
  }
  if (page.sfondoDisegno || page.workspacePosterImages?.length) warnings.add('Sfondi e immagini workspace esclusi')
  warnings.add('Colori, spessori, blocco e visibilità dei livelli non trasferiti');
  const tableLayers = pairs(0, 'SECTION') + pairs(2, 'TABLES') + pairs(0, 'TABLE') + pairs(2, 'LAYER') + pairs(70, exportedLayers.size) + [...exportedLayers].map(name => pairs(0, 'LAYER') + pairs(2, name) + pairs(70, 0) + pairs(62, 7) + pairs(6, 'CONTINUOUS')).join('') + pairs(0, 'ENDTAB') + pairs(0, 'ENDSEC')
  return { text: pairs(0, 'SECTION') + pairs(2, 'HEADER') + pairs(9, '$ACADVER') + pairs(1, 'AC1027') + pairs(9, '$INSUNITS') + pairs(70, codes[c.unit]) + pairs(0, 'ENDSEC') + tableLayers + pairs(0, 'SECTION') + pairs(2, 'ENTITIES') + body + pairs(0, 'ENDSEC') + pairs(0, 'EOF'), warnings: [...warnings] }
}
export function importaDxf(text: string, scelta?: UnitaDxf): { pagina: PaginaQuadernoNota; warnings: string[] } | { richiedeUnita: true } {
  if (text.length > 8 * 1024 * 1024 || text.startsWith('AutoCAD Binary')) throw Error('Supportato soltanto DXF ASCII 2D fino a 8 MB')
  const lines = text.replace(/^\uFEFF/, '').replace(/\r/g, '').trimEnd().split('\n')
  if (lines.length % 2 || lines.length > 500_000) throw Error('Struttura DXF non valida')
  const tags: [number, string][] = []
  for (let i = 0; i < lines.length; i += 2) { if (!/^\s*\d+\s*$/.test(lines[i])) throw Error('Codice DXF non valido'); tags.push([Number(lines[i]), lines[i + 1].trim()]) }
  if (!tags.some(([n, v]) => n === 0 && v === 'EOF')) throw Error('DXF incompleto')
  let header = false, unitCode = 0
  for (let n = 0; n < tags.length; n++) {
    if (tags[n][0] === 0 && tags[n][1] === 'SECTION') header = tags[n + 1]?.[1] === 'HEADER'
    if (tags[n][0] === 0 && tags[n][1] === 'ENDSEC') header = false
    if (header && tags[n][0] === 9 && tags[n][1] === '$INSUNITS' && tags[n + 1]?.[0] === 70) unitCode = Number(tags[n + 1][1])
  }
  const unit: UnitaDxf | undefined = ({ 4: 'mm', 5: 'cm', 6: 'm', 1: 'mm', 2: 'mm' } as Record<number, UnitaDxf>)[unitCode] || scelta
  if (!unit) return { richiedeUnita: true }
  const conversion = unitCode === 1 ? 25.4 : unitCode === 2 ? 304.8 : 1, warnings = new Set<string>(), entities: CadEntity[] = [], layers = new Map<string, `layer-${string}`>()
  if (conversion !== 1) warnings.add('Pollici/piedi convertiti in millimetri')
  const layerId = (name: string) => { if (!layers.has(name)) layers.set(name, `layer-${crypto.randomUUID()}`); return layers.get(name)! }
  let section = '', i = 0
  while (i < tags.length) {
    if (tags[i][0] === 0 && tags[i][1] === 'SECTION') { section = tags[i + 1]?.[1] || ''; i += 2; continue }
    if (tags[i][0] === 0 && tags[i][1] === 'ENDSEC') { section = ''; i++; continue }
    if (section !== 'ENTITIES' || tags[i][0] !== 0) { i++; continue }
    const type = tags[i++][1], data: [number, string][] = []
    while (i < tags.length && tags[i][0] !== 0) data.push(tags[i++])
    if (!['LINE', 'CIRCLE', 'LWPOLYLINE', 'TEXT'].includes(type)) { warnings.add(`Entità esclusa: ${type}`); continue }
    const num = (n: number, fallback?: number) => { const raw = data.find(([k]) => k === n)?.[1]; if (raw === undefined && fallback !== undefined) return fallback; if (raw === undefined || !raw.trim()) throw Error(`DXF ${type}: coordinata ${n} mancante`); return finite(Number(raw)) }
    if (num(30, 0) !== 0 || num(31, 0) !== 0 || num(38, 0) !== 0 || num(210, 0) !== 0 || num(220, 0) !== 0 || num(230, 1) !== 1) { warnings.add(`Entità 3D esclusa: ${type}`); continue }
    const now = new Date().toISOString(), base = { id: crypto.randomUUID(), layerId: layerId(data.find(([n]) => n === 8)?.[1] || '0'), visible: true, locked: false, selectable: true, createdAt: now, updatedAt: now }
    const pt = (n: number) => ({ x: num(n) * conversion, y: num(n + 10) * conversion })
    if (type === 'LINE') entities.push({ ...base, type: 'line', start: pt(10), end: pt(11), stroke: { color: '#111827', width: 2 } })
    if (type === 'CIRCLE') { const radius = num(40) * conversion; if (radius <= 0) throw Error('Raggio DXF non valido'); entities.push({ ...base, type: 'circle', center: pt(10), radius, stroke: { color: '#111827', width: 2 } }) }
    if (type === 'TEXT') { if (num(72, 0) !== 0 || num(73, 0) !== 0) { warnings.add('TEXT con allineamento speciale escluso'); continue }; const height = num(40); if (height <= 0) throw Error('Altezza testo non valida'); entities.push({ ...base, type: 'text', position: pt(10), content: data.find(([n]) => n === 1)?.[1] || '', fontSize: height * conversion, color: '#111827', rotation: -num(50, 0), alignment: 'left' }) }
    if (type === 'LWPOLYLINE') {
      if (data.some(([n, v]) => n === 42 && Number(v) !== 0)) { warnings.add('Polilinea con archi/bulge esclusa'); continue }
      const points: CadPoint[] = []
      for (let j = 0; j < data.length; j++) if (data[j][0] === 10) { if (data[j + 1]?.[0] !== 20) throw Error('Vertice DXF incompleto'); points.push({ x: finite(Number(data[j][1])) * conversion, y: finite(Number(data[j + 1][1])) * conversion }) }
      if (points.length < 2 || points.length !== num(90)) throw Error('Numero vertici DXF incoerente')
      entities.push({ ...base, type: 'polyline', points, closed: !!(num(70, 0) & 1), stroke: { color: '#111827', width: 2 } })
    }
    if (entities.length > 20_000) throw Error('Troppe entità DXF')
  }
  if (!entities.length) throw Error('Nessuna entità 2D supportata nel file')
  const pts: CadPoint[] = entities.flatMap(e => e.type === 'line' ? [e.start, e.end] : e.type === 'circle' ? [{ x: e.center.x - e.radius, y: e.center.y - e.radius }, { x: e.center.x + e.radius, y: e.center.y + e.radius }] : e.type === 'text' ? [e.position, { x: e.position.x + e.fontSize * 0.62 * Math.max(e.content.length, 1), y: e.position.y + e.fontSize }] : e.type === 'polyline' ? e.points : [])
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y) }
  const scale = Math.min(760 / Math.max(maxX - minX, 1), 900 / Math.max(maxY - minY, 1)), origin = { x: minX - 20 / scale, y: maxY + 20 / scale }
  const toPixel = (p: CadPoint) => ({ x: (p.x - origin.x) * scale, y: (origin.y - p.y) * scale })
  const converted = entities.map(e => e.type === 'line' ? { ...e, start: toPixel(e.start), end: toPixel(e.end) } : e.type === 'circle' ? { ...e, center: toPixel(e.center), radius: e.radius * scale } : e.type === 'text' ? { ...e, position: toPixel(e.position), fontSize: e.fontSize * scale, metadata: { ...e.metadata, textBoxWidth: Math.max(e.content.length, 1) * e.fontSize * scale * 0.62 + 1 } } : e.type === 'polyline' ? { ...e, points: e.points.map(toPixel) } : e)
  warnings.add('Stili colore, spessore e font DXF non trasferiti; geometria e livelli preservati')
  return { pagina: { id: crypto.randomUUID(), titolo: 'Importazione DXF', disegni: [], sfondoDisegno: null, cadEntities: converted, cadOrigin: origin, layers: [...layers].map(([name, id], order) => ({ id, name, visible: true, locked: false, selectable: true, order })), scaleCalibration: { start: { x: 0, y: 0 }, end: { x: scale, y: 0 }, pixelDistance: scale, realDistance: 1, unit } }, warnings: [...warnings] }
}
