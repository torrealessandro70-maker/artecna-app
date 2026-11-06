/* eslint-disable @typescript-eslint/no-require-imports -- Offline binary Excel fixtures and mocked database. */
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), XLSX = require('xlsx')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '../../..')
function load(file, cache = new Map()) {
  if (cache.has(file)) return cache.get(file)
  const exports = {}; cache.set(file, exports)
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, File, crypto: require('node:crypto').webcrypto, console: { group() {}, log() {}, table() {}, groupEnd() {} }, require: id => id.startsWith('.') ? load(path.resolve(path.dirname(file), id + '.ts'), cache) : require(id) })
  return exports
}
const engine = load(path.join(__dirname, 'preventivo-listino.ts'))
const headers = ['N°', 'Tariffa', 'Descrizione lavori', 'U.M.', 'Quantità', 'Prezzo unitario €', 'Totale €', 'Categoria', '% Manodopera', 'Zona', 'Regione']
const values = [1, 'PREV.01', 'Rasatura delle pareti', 'm²', 12, 19.123456789, 229.48, 'Finiture', 30, 'Catania', 'Sicilia']
function workbook(sheets) {
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name)
  return wb
}
function file(wb, type = 'xlsx') { return new File([XLSX.write(wb, { type: 'buffer', bookType: type })], `preventivo.${type}`) }
async function rows(data = [headers, values], type) { return (await engine.leggiPreventivoListino(file(workbook({ Opere: data }), type))).righe }
const proposals = (r, list = [], labor = false) => engine.confrontaPreventivoListino(r, list, labor)
const choices = (r, conflitto = 'salta') => r.map(v => ({ id: v.id, conflitto }))
const existing = { id: 'uuid-esistente', tipo_prezzo: 'artecna', codice: 'PREV.01', descrizione: 'Altra voce', unita_misura: 'm', prezzo_unitario: 99 }
function database(list = [], failAt = 0) {
  const writes = [], reads = []
  return { writes, reads, from(table) {
    assert.equal(table, 'prezzi_lavorazioni')
    let insertion
    const q = { select() { reads.push('select'); return q }, eq(k, v) { reads.push([k, v]); return q }, order() { return q }, range() { return q },
      insert(data) { writes.push(data); insertion = writes.length; return q },
      update() { throw Error('Updates forbidden') }, delete() { throw Error('Deletes forbidden') }, upsert() { throw Error('Upserts forbidden') },
      then(resolve, reject) { return Promise.resolve(insertion ? { error: insertion === failAt ? { message: 'network failure' } : null } : { data: list, error: null }).then(resolve, reject) } }
    return q
  } }
}
test('normal quotation XLSX and XLS use the existing parser and preserve precise numeric price / provenance', async () => {
  for (const type of ['xlsx', 'xls']) {
    const wb = workbook({ Opere: [['Preventivo attendibile'], [], headers, values] })
    wb.Sheets.Opere.F4.z = '€0.00'
    const r = (await engine.leggiPreventivoListino(file(wb, type))).righe
    assert.equal(r.length, 1); assert.equal(r[0].riga, 4); assert.equal(r[0].foglio, 'Opere')
    assert.equal(r[0].form.codice, 'PREV.01'); assert.equal(r[0].prezzoDocumentale, values[5])
    assert.equal(r[0].form.prezzo_unitario, String(values[5])); assert.equal(r[0].quantita, 12)
    assert.equal(r[0].form.categoria, 'Finiture'); assert.equal(r[0].form.incidenza_manodopera, '30')
    assert.equal(r[0].form.zona, 'Catania'); assert.equal(r[0].form.regione, 'Sicilia'); assert.equal(proposals(r)[0].errori.length, 0)
  }
})
test('missing description, UM and unit price stay visible and can be completed; totals never substitute unit prices', async () => {
  const r = await rows([headers, [1, 'A', '', 'm', 2, 10], [2, 'B', 'Voce senza UM', '', 1, 12], [3, 'C', 'Solo totale', 'm', 2, '', 200]])
  assert.equal(r.length, 3); assert.equal(r[0].form.descrizione, ''); assert.equal(r[2].form.prezzo_unitario, '')
  assert(proposals(r).every(p => p.errori.length))
  r[0].form.descrizione = 'Completata'; r[1].form.unita_misura = 'm'; r[2].form.prezzo_unitario = '100'
  assert(proposals(r).every(p => !p.errori.length))
})
test('unknown headers are retained as incomplete rows; non-Excel and empty files are rejected', async () => {
  const r = await rows([['Testo libero'], ['Opera da completare']]); assert.equal(r.length, 2); assert(proposals(r).every(p => p.errori.length))
  await assert.rejects(engine.leggiPreventivoListino(new File(['x'], 'voci.csv')), /XLSX o XLS/)
  await assert.rejects(rows([]), /non contiene righe/)
})
test('all sheets and original row offsets survive; ordinal N° is never treated as the item code', async () => {
  const wb = workbook({ Opere: [headers, values], Impianti: [] })
  XLSX.utils.sheet_add_aoa(wb.Sheets.Impianti, [['N°', 'Descrizione', 'U.M.', 'Prezzo'], [7, 'Impianto', 'cad', 77]], { origin: 'A5' })
  const r = (await engine.leggiPreventivoListino(file(wb))).righe
  assert.equal(r.length, 2); assert.equal(r[1].riga, 6); assert.equal(r[1].foglio, 'Impianti'); assert.equal(r[1].codiceOriginale, '')
  assert.notEqual(r[0].id, r[1].id)
})
test('new adapter recognizes observed quotation headers without changing shared parser; missing description header stays incomplete', async () => {
  for (const description of ['Descrizione Lavoro', 'D E S C R I Z I O N E']) {
    const r = await rows([['N.', description, 'U.M.', 'Quantità', 'Prezzo Unitario (€)'], [1, 'Opera attendibile', 'cad', 2, 44]])
    assert.equal(r[0].form.descrizione, 'Opera attendibile'); assert.equal(r[0].form.codice, ''); assert.equal(proposals(r)[0].errori.length, 0)
  }
  const r = await rows([['Testo non riconosciuto', 'U.M.', 'Prezzo'], ['Opera', 'cad', 44]])
  assert.equal(r[0].form.descrizione, ''); assert(proposals(r)[0].errori.length)
})
test('ambiguous price columns require a manual choice, cached formula price is not recalculated', async () => {
  const r = await rows([['Descrizione', 'U.M.', 'Prezzo', 'Prezzo unitario'], ['Opera', 'm', 11, 22]])
  assert.equal(r[0].form.prezzo_unitario, ''); assert(proposals(r)[0].errori.length); assert(r[0].avvisi.some(v => /Più colonne/.test(v)))
  const wb = workbook({ Opere: [headers, values] }); wb.Sheets.Opere.F2.f = '100/3'
  const cached = (await engine.leggiPreventivoListino(file(wb))).righe[0]
  assert.equal(cached.prezzoDocumentale, values[5]); assert(cached.avvisi.some(v => /nessun ricalcolo/.test(v)))
})
test('duplicate comparison prefers code, otherwise exact normalized description + UM, never fuzzy similarity', async () => {
  const r = await rows(), [p] = proposals(r, [existing]); assert.equal(p.matches[0].id, existing.id)
  const byText = { ...existing, codice: 'OTHER', descrizione: '  RASATURA delle pareti ', unita_misura: 'mq' }
  assert.equal(proposals(r, [byText])[0].matches.length, 1)
  assert.equal(proposals(r, [{ ...byText, descrizione: 'Rasatura delle pareti interne' }])[0].matches.length, 0)
  assert.equal(proposals(r, [{ ...byText, unita_misura: 'm' }])[0].matches.length, 0)
  assert.equal(proposals(r, [{ ...existing, tipo_prezzo: 'sic24' }])[0].matches.length, 0)
  assert.equal(proposals(r, [existing, byText])[0].matches.length, 1)
})
test('duplicates inside the file require an explicit add-new decision for each selected row', async () => {
  const r = await rows([headers, values, values]), p = proposals(r), db = database()
  assert(p.every(engine.haConflittoPreventivo))
  await assert.rejects(engine.importaPreventivoListino(db, p, choices(r), 'file.xlsx', false, true), /risolvi/); assert.equal(db.writes.length, 0)
  const result = await engine.importaPreventivoListino(db, p, choices(r, 'nuova'), 'file.xlsx', false, true)
  assert.equal(result.salvate.length, 2); assert(db.writes.every(v => /^ART_/.test(v.codice))); assert.notEqual(db.writes[0].codice, db.writes[1].codice)
})
test('loading, comparison, cancel, incomplete and unresolved conflict cannot write', async () => {
  const r = await rows(), p = proposals(r, [existing]), db = database([existing])
  await assert.rejects(engine.importaPreventivoListino(db, p, choices(r, 'nuova'), 'f.xlsx', false, false), /Conferma obbligatoria/)
  await assert.rejects(engine.importaPreventivoListino(db, p, choices(r), 'f.xlsx', false, true), /risolvi/)
  await assert.rejects(engine.importaPreventivoListino(db, p, [], 'f.xlsx', false, true), /Seleziona/)
  await assert.rejects(engine.importaPreventivoListino(db, p, [...choices(r), ...choices(r)], 'f.xlsx', false, true), /duplicata/)
  r[0].form.unita_misura = ''; await assert.rejects(engine.importaPreventivoListino(db, proposals(r), choices(r), 'f.xlsx', false, true), /Completa/)
  assert.equal(db.writes.length, 0)
})
test('selected rows only use the unchanged Listino insertion writer, exact price, original code and Note provenance', async () => {
  const r = await rows([headers, values, [2, '', 'Seconda opera', 'cad', 1, 50]]), db = database()
  const before = JSON.stringify(r)
  await engine.importaPreventivoListino(db, proposals(r), choices([r[0]]), 'fidato.xlsx', false, true)
  assert.equal(db.writes.length, 1); assert.equal(db.writes[0].codice, 'PREV.01'); assert.equal(db.writes[0].prezzo_unitario, values[5])
  assert.equal(db.writes[0].fonte, 'ARTECNA'); assert.equal(db.writes[0].tipo_prezzo, 'artecna'); assert.equal(db.writes[0].versione, 'manuale')
  for (const s of ['preventivo_excel', 'fidato.xlsx', 'Opere; riga: 2', 'Codice originale: PREV.01', 'Quantità documentale: 12', '% Manodopera documentale: 30']) assert(db.writes[0].note.includes(s), s)
  assert(!('incidenza_manodopera' in db.writes[0])); assert.equal(JSON.stringify(r), before)
  await engine.importaPreventivoListino(db, proposals([r[1]]), choices([r[1]]), 'fidato.xlsx', false, true)
  assert.match(db.writes[1].codice, /^ART_[0-9a-f-]{36}$/)
})
test('add-new on existing code or reserved SIC24 delegates ART generation; existing records remain untouched', async () => {
  const r = await rows(), db = database([existing]), before = JSON.stringify(existing)
  await engine.importaPreventivoListino(db, proposals(r, [existing]), choices(r, 'nuova'), 'f.xlsx', false, true)
  assert.match(db.writes[0].codice, /^ART_/); assert.equal(JSON.stringify(existing), before)
  r[0].form.codice = 'SIC24_1.2'; r[0].codiceOriginale = 'SIC24_1.2'
  const db2 = database(); await engine.importaPreventivoListino(db2, proposals(r), choices(r), 'f.xlsx', false, true)
  assert.match(db2.writes[0].codice, /^ART_/); assert(db2.writes[0].note.includes('SIC24_1.2'))
})
test('fresh Listino changes abort before any write; document price cannot be edited', async () => {
  const r = await rows(), db = database([existing])
  await assert.rejects(engine.importaPreventivoListino(db, proposals(r), choices(r), 'f.xlsx', false, true), /Listino cambiato/)
  assert.equal(db.writes.length, 0)
  r[0].form.prezzo_unitario = '1'; assert(proposals(r)[0].errori.some(v => /documentale/.test(v)))
})
test('supported labor uses existing validation and payload, unsupported labor stays in notes', async () => {
  const r = await rows(), db = database()
  await engine.importaPreventivoListino(db, proposals(r, [], true), choices(r), 'f.xlsx', true, true)
  assert.equal(db.writes[0].incidenza_manodopera, 30)
  r[0].form.incidenza_manodopera = '101'; assert(proposals(r, [], true)[0].errori.length)
})
test('partial network failure reports only acknowledged rows and never retries or rolls back', async () => {
  const r = await rows([headers, values, [2, 'B', 'Seconda opera', 'cad', 1, 50], [3, 'C', 'Terza', 'cad', 1, 80]]), db = database([], 2)
  const result = await engine.importaPreventivoListino(db, proposals(r), choices(r), 'f.xlsx', false, true)
  assert.equal(result.salvate.length, 1); assert.equal(result.salvate[0], r[0].id); assert.equal(db.writes.length, 2); assert.match(result.errore, /Rileggi il Listino/)
})
test('legacy ARTECNA binary fixture stays accepted, normal quotation remains rejected by the strict import', async () => {
  const old = load(path.join(__dirname, 'file-listino.ts'))
  const wb = workbook({ ARTECNA: [['Codice', 'Descrizione', 'U.M.', 'Prezzo'], ['ART_TEST', 'Opera', 'm', 12]] })
  const valid = old.leggiFileArtecna('artecna.xlsx', await file(wb).arrayBuffer()); assert.equal(valid[0].errori.length, 0)
  const rejected = old.leggiFileArtecna('preventivo.xlsx', await file(workbook({ Opere: [headers, values] })).arrayBuffer()); assert(rejected.some(r => r.errori.length))
})
test('existing parsers, Listino writer/reader, ARTECNA import and SIC24 have no changes against Production', () => {
  for (const p of ['app/engines/document-parser/excel.ts', 'app/engines/document-parser/header-detector.ts', 'app/engines/price-import/listino-manuale.ts', 'app/engines/price-import/file-listino.ts', 'app/components/ImportaFileArtecnaPanel.tsx', 'app/components/PrezzarioSic24Panel.tsx'])
    assert.equal(fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n'), execFileSync('git', ['show', 'a4571c6b1331f4c993a43ab15d08f4d7919acbba:' + p], { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n'), p)
})
