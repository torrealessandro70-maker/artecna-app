// Regressioni locali: trasporto Storage finto, nessun accesso remoto.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const vm = require('node:vm')
const root = path.resolve(__dirname, '../..')
function load(file, mocks = {}, cache = new Map()) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const exports = {}; cache.set(file, exports)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  vm.runInNewContext(source, { exports, Buffer, Blob, atob, crypto: require('node:crypto').webcrypto,
    console, require: name => {
      if (name in mocks) return mocks[name]
      if (!name.startsWith('.')) return require(name)
      const base = path.resolve(path.dirname(file), name)
      const candidate = fs.existsSync(base + '.ts') ? base + '.ts' : path.join(base, 'index.ts')
      return load(candidate, mocks, cache)
    } }, { filename: file })
  return exports
}
const input = { cantiere: 'Cantiere', categoria: 'rapportino', rapportinoId: 'V0',
  dataUrls: ['data:image/png;base64,aGVsbG8=', 'data:image/png;base64,d29ybGQ='],
  bucket: 'preventivi', folder: 'utenti/fixture/cantieri/fixture/foto' }
function storage(failAt = 0) {
  const calls = []; let uploads = 0
  return { calls, client: { storage: { from: bucket => ({
    upload: async (key, blob, options) => {
      calls.push({ op: 'upload', bucket, key, bytes: await blob.text(), options })
      return { error: ++uploads === failAt ? new Error('fixture') : null }
    },
    getPublicUrl: key => { calls.push({ op: 'url', bucket, key }); return { data: { publicUrl: 'https://fixture.invalid/' + key } } },
    remove: async keys => { calls.push({ op: 'remove', bucket, keys: [...keys] }); return { error: null } },
  }) } } }
}
test('Legacy V0: batch foto resta su preventivi, URL pubblici e mapping rapportino', async () => {
  const h = storage()
  const manager = load(path.join(root, 'engines/photo-storage/photo-manager.ts'))
  const result = await manager.buildPhotoRecordsWithStorage(h.client, input)
  assert.equal(result.success, true)
  assert.equal(result.photos.length, 2)
  assert(h.calls.every(c => c.bucket === 'preventivi'))
  assert.deepEqual(h.calls.filter(c => c.op === 'upload').map(c => c.bytes), ['hello', 'world'])
  assert(result.photos.every(p => p.rapportino_id === 'V0' && p.file_url.startsWith('https://fixture.invalid/')))
})
test('Legacy V0: upload parziale fallito elimina esclusivamente oggetti già caricati', async () => {
  const h = storage(2)
  const manager = load(path.join(root, 'engines/photo-storage/photo-manager.ts'))
  const result = await manager.buildPhotoRecordsWithStorage(h.client, input)
  assert.equal(result.success, false)
  assert.equal(result.photos.length, 0)
  const removed = h.calls.find(c => c.op === 'remove')
  assert.equal(removed.bucket, 'preventivi')
  assert.deepEqual(removed.keys, [h.calls.find(c => c.op === 'upload').key])
})
for (const [file, name] of [
  ['engines/preventivo/smoke-test.ts', 'runPreventivoEngineSmokeTest'],
  ['engines/document-intelligence/document-classifier-smoke-test.ts', 'runDocumentClassifierSmokeTest'],
  ['engines/document-intelligence/document-insights-smoke-test.ts', 'runDocumentInsightsSmokeTest'],
  ['engines/document-intelligence/total-extractor-smoke-test.ts', 'runDocumentTotalExtractorSmokeTest'],
  ['engines/document-intelligence/total-extractor-smoke-test.ts', 'runArtecnaPdfRegressionTest'],
]) test('Regressione esistente: ' + name, () => {
  const result = load(path.join(root, file))[name]()
  assert.equal(result.success, true, JSON.stringify(result))
})
