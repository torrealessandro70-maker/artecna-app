const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { webcrypto, createHash } = require('node:crypto')
const cache = new Map()
function load(name) {
  if (cache.has(name)) return cache.get(name)
  const module = { exports: {} }; cache.set(name, module.exports)
  const source = fs.readFileSync(path.join(__dirname, name + '.ts'), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  new Function('require', 'exports', 'module', js)(id => load(id.replace('./', '')), module.exports, module)
  return module.exports
}
const f = load('fotoRapportinoV1'), idb = load('codaFotoIndexedDB')
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const ctx = { cantiere_id: uuid(1), data: '2026-10-07', rapportino_id: null }
const blob = () => new Blob(['byte reali'], { type: 'image/jpeg' })
function setup(repo = new f.RepositoryCodaFotoMemoria()) {
  return { repo, coda: new f.CodaFotoRapportinoV1(repo, webcrypto, () => 1234) }
}
test('F2: più foto, UUID canonici distinti e hash sui byte reali', async () => {
  const { coda } = setup(), a = await coda.aggiungi(blob(), ctx), b = await coda.aggiungi(blob(), ctx)
  assert.notEqual(a.chiave_client_allegato, b.chiave_client_allegato)
  assert.match(a.chiave_client_allegato, /^[0-9a-f-]{36}$/)
  assert.equal(a.sha256, createHash('sha256').update('byte reali').digest('hex'))
  assert.equal((await coda.elenca(ctx)).length, 2)
})
test('F2: reload repository, associazione UUID dopo writer, retry stessa identità', async () => {
  const { repo, coda } = setup(), a = await coda.aggiungi(blob(), ctx)
  const reload = new f.CodaFotoRapportinoV1(repo, webcrypto)
  assert.equal((await reload.elenca(ctx))[0].chiave_client_allegato, a.chiave_client_allegato)
  await reload.writerRiuscito(ctx, uuid(2))
  const existing = { ...ctx, rapportino_id: uuid(2) }
  await reload.cambiaStato(a.chiave_client_allegato, 'caricamento')
  await reload.recuperaInterrotte(existing)
  await reload.cambiaStato(a.chiave_client_allegato, 'pronta')
  assert.equal((await reload.elenca(existing))[0].chiave_client_allegato, a.chiave_client_allegato)
  assert.equal((await reload.elenca(ctx)).length, 0)
})
test('F2: writer fallito non altera coda né bozza/intento; cambio contesto isolato', async () => {
  const { coda } = setup(), bozza = { note: 'nota', richiesta_id: uuid(9) }, prima = structuredClone(bozza)
  const a = await coda.aggiungi(blob(), ctx)
  await coda.aggiungi(blob(), { ...ctx, data: '2026-10-06' })
  await coda.aggiungi(blob(), { ...ctx, cantiere_id: uuid(3) })
  assert.equal(a.stato, 'in_coda')
  assert.equal((await coda.elenca(ctx)).length, 1)
  await coda.writerRiuscito({ ...ctx, data: '2026-10-06' }, uuid(4))
  assert.equal((await coda.elenca(ctx))[0].stato, 'in_coda')
  assert.deepEqual(bozza, prima)
})
test('F2: esistente pronto; UUID autorevole non sovrascrive altra associazione', async () => {
  const { coda } = setup(), existing = { ...ctx, rapportino_id: uuid(2) }
  const a = await coda.aggiungi(blob(), existing)
  assert.equal(a.stato, 'pronta')
  await assert.rejects(coda.writerRiuscito(existing, uuid(3)))
  await coda.writerRiuscito(ctx, uuid(4))
  assert.equal((await coda.elenca(existing))[0].contesto.rapportino_id, uuid(2))
})
for (const mime of ['image/jpeg', 'image/png', 'image/webp']) test(`F2: MIME ${mime}`, async () => {
  await setup().coda.aggiungi(new Blob(['a'], { type: mime }), ctx)
})
for (const mime of ['image/heic', 'image/heif', 'image/gif', '']) test(`F2: MIME vietato ${mime}`, async () => {
  await assert.rejects(setup().coda.aggiungi(new Blob(['a'], { type: mime }), ctx))
})
test('F2: peso nullo/eccessivo rifiutato e limite incluso', async () => {
  const { coda } = setup()
  await assert.rejects(coda.aggiungi(new Blob([], { type: 'image/png' }), ctx))
  await assert.rejects(coda.aggiungi(new Blob([new Uint8Array(4000001)], { type: 'image/png' }), ctx))
  await coda.aggiungi(new Blob([new Uint8Array(4000000)], { type: 'image/png' }), ctx)
  assert.equal(f.VERIFICA_PIXEL_FOTO.implementata, false)
})
test('F2: IndexedDB indisponibile e quota senza fallback o perdita silenziosa', async () => {
  await assert.rejects(idb.RepositoryCodaFotoIndexedDB.apri(undefined), e => e.codice === 'persistenza')
  const factory = { open() { throw new DOMException('segreto', 'QuotaExceededError') } }
  await assert.rejects(idb.RepositoryCodaFotoIndexedDB.apri(factory), e => e.codice === 'quota_locale' && !e.message.includes('segreto'))
  const { coda } = setup({ aggiungi: async () => { throw new f.ErroreCodaFoto('quota_locale') } })
  await assert.rejects(coda.aggiungi(blob(), ctx), e => e.codice === 'quota_locale')
})
test('F2: rimozione locale prima upload e cleanup solo completate', async () => {
  const { coda } = setup(), a = await coda.aggiungi(blob(), ctx)
  await coda.rimuoviLocale(a.chiave_client_allegato)
  assert.equal((await coda.elenca(ctx)).length, 0)
  const existing = { ...ctx, rapportino_id: uuid(2) }, b = await coda.aggiungi(blob(), existing)
  await coda.cambiaStato(b.chiave_client_allegato, 'caricamento')
  await assert.rejects(coda.rimuoviLocale(b.chiave_client_allegato))
  await coda.cambiaStato(b.chiave_client_allegato, 'finalizzazione')
  await coda.cambiaStato(b.chiave_client_allegato, 'completata')
  await coda.pulisciCompletate()
  assert.equal((await coda.elenca(existing)).length, 0)
})
test('F2: scaduta non riattivabile, cancellazione pending non libera stato/quota', async () => {
  const { coda } = setup(), existing = { ...ctx, rapportino_id: uuid(2) }, a = await coda.aggiungi(blob(), existing)
  await coda.cambiaStato(a.chiave_client_allegato, 'caricamento')
  await coda.cambiaStato(a.chiave_client_allegato, 'scaduta')
  await assert.rejects(coda.cambiaStato(a.chiave_client_allegato, 'pronta'))
  await coda.cambiaStato(a.chiave_client_allegato, 'richiesta_cancellazione')
  await coda.cambiaStato(a.chiave_client_allegato, 'cancellazione_pending')
  await coda.pulisciCompletate()
  assert.equal((await coda.elenca(existing)).length, 1)
})
test('F2: scadenza persistita proiettata senza path/segreti e mapping dopo commit', () => {
  const input = { versione_contratto: 1, esito: 'scaduto_persistito_con_conflitto', allegato_id: uuid(4),
    stato: 'scaduto', upload_necessario: false, lease_id: null, lease_until: null, bucket: 'segreto', file_path: 'segreto' }
  const result = f.validaScadenzaAllegatoPersistita(input)
  assert.equal(f.conflittoScadenzaDopoCommit(result).status, 409)
  assert.equal(f.conflittoScadenzaDopoCommit(result).scadenza_persistita, true)
  assert.equal(JSON.stringify(result).includes('segreto'), false)
  for (const change of [{ upload_necessario: true }, { lease_id: uuid(5) }, { lease_until: 'data' }, { stato: 'prenotato' }])
    assert.throws(() => f.validaScadenzaAllegatoPersistita({ ...input, ...change }))
})
test('F2: successo prenotazione/finalizzato discriminato, upload incoerente rifiutato', () => {
  const base = { versione_contratto: 1, esito: 'successo', allegato_id: uuid(5), lease_id: null, lease_until: null }
  assert.equal(f.validaEsitoPrenotazioneFoto({ ...base, stato: 'prenotato', upload_necessario: true }).stato, 'prenotato')
  assert.equal(f.validaEsitoPrenotazioneFoto({ ...base, stato: 'finalizzato', upload_necessario: false }).stato, 'finalizzato')
  assert.throws(() => f.validaEsitoPrenotazioneFoto({ ...base, stato: 'finalizzato', upload_necessario: true }))
  assert.throws(() => f.validaEsitoPrenotazioneFoto({ ...base, stato: 'finalizzato', upload_necessario: false, lease_id: uuid(9) }))
})
test('F2: serializzazione Blob nativa senza segreti/Base64 né riferimenti remoti', async () => {
  const { coda } = setup(), foto = await coda.aggiungi(blob(), { ...ctx, token: 'segreto' })
  const clone = structuredClone(foto)
  assert.equal(await clone.blob.text(), 'byte reali')
  assert.deepEqual(Object.keys(clone).sort(), ['chiave_client_allegato','blob','mime_type','byte_size','sha256','contesto','stato','creata_at_ms'].sort())
  assert.equal(JSON.stringify(clone).includes('segreto'), false)
  for (const file of ['fotoRapportinoV1.ts', 'codaFotoIndexedDB.ts']) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8')
    assert.doesNotMatch(source, /localStorage|readAsDataURL|fetch\(|supabase|\.rpc\(/)
  }
})

async function repositoryIDBControllato() {
  let tx, store
  const db = { close() {}, transaction() {
    store = { add() {}, delete() {}, getAll() { return {} }, put() {} }
    tx = { objectStore() { return store } }
    return tx
  } }
  const factory = { open() {
    const request = { result: db }
    queueMicrotask(() => request.onsuccess())
    return request
  } }
  return { repo: await idb.RepositoryCodaFotoIndexedDB.apri(factory), transaction: () => tx, store: () => store }
}
test('F2: adapter IndexedDB attende commit e non il solo successo request', async () => {
  const adapter = await repositoryIDBControllato(), a = await setup().coda.aggiungi(blob(), ctx)
  let risolta = false
  const promise = adapter.repo.aggiungi(a).then(() => { risolta = true })
  await Promise.resolve()
  assert.equal(risolta, false)
  adapter.transaction().oncomplete()
  await promise
  assert.equal(risolta, true)
})
test('F2: abort/quota IndexedDB sanitizzati, nessun successo parziale', async () => {
  const adapter = await repositoryIDBControllato(), a = await setup().coda.aggiungi(blob(), ctx)
  const promise = adapter.repo.aggiungi(a)
  adapter.transaction().error = new DOMException('dettagli privati', 'QuotaExceededError')
  adapter.transaction().onabort()
  await assert.rejects(promise, e => e.codice === 'quota_locale' && !e.message.includes('dettagli'))
})
test('F2: reload Blob da getAll IndexedDB risolto solo dopo commit readonly', async () => {
  const adapter = await repositoryIDBControllato(), a = await setup().coda.aggiungi(blob(), ctx)
  let request = {}
  // Nuova transazione controllata: intercettiamo il request senza filesystem o DB remoto.
  const db = { close() {}, transaction() {
    const tx = { objectStore() { return { getAll() { return request } } } }
    adapter.txRead = tx
    return tx
  } }
  const factory = { open() { const r = { result: db }; queueMicrotask(() => r.onsuccess()); return r } }
  const repo = await idb.RepositoryCodaFotoIndexedDB.apri(factory)
  const promise = repo.elenca()
  request.result = [structuredClone(a)]
  request.onsuccess({ target: request })
  adapter.txRead.oncomplete()
  const rows = await promise
  assert.equal(rows[0].chiave_client_allegato, a.chiave_client_allegato)
  assert.equal(await rows[0].blob.text(), 'byte reali')
})
