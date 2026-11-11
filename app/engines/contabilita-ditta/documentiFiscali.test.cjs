/* eslint-disable @typescript-eslint/no-require-imports -- Offline tests with injected Supabase client. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, f)
const { creaArchivioDocumentiFiscali, BUCKET_FISCALE } = require('./documentiFiscali.ts')
const { creaArchivioScadenziario } = require('./scadenziarioPersistenza.ts')
const { riepilogaScadenze } = require('./scadenziario.ts')

const docId = '00000000-0000-4000-8000-000000000010'
const first = '00000000-0000-4000-8000-000000000011'
const second = '00000000-0000-4000-8000-000000000012'
const now = '2026-11-11T12:00:00Z'
const pdf = new File(['%PDF-1.4'], 'f24.pdf', { type: 'application/pdf' })
const meta = { tipo: 'F24', nome: 'f24.pdf', data: '' }
const doc = { revisione: 0, id: docId, tipo_documento: 'F24', nome_file: 'f24.pdf', data_documento: null,
  storage_path: 'documenti/' + docId + '.pdf', byte_size: pdf.size, caricato_at: null, archiviata_at: null }

function row(id, tipo, incluso, documento = null, revisione = '0') {
  return { id, tipo, periodo_riferimento: 'Novembre', data_scadenza: '2026-11-16',
    importo_previsto: '100.00', importo_pagato: '20.00', data_pagamento: '2026-11-10',
    stato: 'da_pagare', note: 'nota', riferimento_documento: 'testo manuale',
    includi_nei_totali: incluso, documento_id: documento, revisione,
    created_at: now, updated_at: now, created_by: docId, updated_by: docId,
    archiviata_at: null, archiviata_by: null, motivo_archiviazione: null }
}

test('one F24 references two schedules without changing amounts, statuses or KPIs', async () => {
  const calls = []
  const original = [row(first, 'IVA', true), row(second, 'F24', false)]
  const archive = creaArchivioScadenziario({
    async rpc(name, args) {
      calls.push({ name, args })
      if (name === 'leggi_scadenze_fiscali') {
        return { data: { versione: 1, totale: 2, include_archiviate: false, righe: original } }
      }
      const base = original.find(r => r.id === args.p_id)
      return { data: { ...base, documento_id: args.p_documento_id ?? null, revisione: '1' } }
    },
  })
  const before = await archive.elenco()
  assert.equal(before[0].documentoId, null)
  const linked = await Promise.all(before.map(r => archive.impostaDocumento(r.id, '0', docId)))
  assert(linked.every(r => r.documentoId === docId && r.stato === 'Da pagare' && r.importoPagato === '20.00'))
  assert(linked.every(r => r.riferimento === 'testo manuale'))
  const previousKpi = riepilogaScadenze(before, '2026-11-11')
  const linkedKpi = riepilogaScadenze(linked, '2026-11-11')
  for (const k of ['entro30', 'entro60', 'entro90']) {
    assert.deepEqual(linkedKpi[k], previousKpi[k])
    assert.equal(linkedKpi[k].centesimi, 10000)
  }
  for (const [i, id] of [first, second].entries()) {
    assert.deepEqual(calls[i + 1], { name: 'collega_documento_scadenza',
      args: { p_id: id, p_revisione_attesa: '0', p_documento_id: docId } })
  }
  await archive.impostaDocumento(first, '0', null)
  assert.deepEqual(calls.at(-1), { name: 'scollega_documento_scadenza', args: { p_id: first, p_revisione_attesa: '0' } })
})

test('revision conflict or mismatched association stops without retry', async () => {
  for (const reply of [{ error: { code: '40001' } }, { data: row(first, 'IVA', true, null, '1') }]) {
    let count = 0
    const archive = creaArchivioScadenziario({ async rpc() { count++; return reply } })
    await assert.rejects(archive.impostaDocumento(first, '0', docId), e => e.tipo === (reply.error ? 'conflitto' : 'esito_incerto'))
    assert.equal(count, 1)
  }
})

test('metadata, signed upload and finalization are separate and archive is logical', async () => {
  const calls = []
  const archive = creaArchivioDocumentiFiscali({
    async rpc(name, args) {
      calls.push({ name, args })
      return { data: { ...doc, caricato_at: name === 'conferma_upload_documento_fiscale' ? now : null,
        archiviata_at: name === 'archivia_documento_fiscale' ? now : null } }
    },
    storage: { from(bucket) {
      assert.equal(bucket, BUCKET_FISCALE)
      return {
        async createSignedUploadUrl(path, options) {
          assert.equal(path, doc.storage_path)
          assert.deepEqual(options, { upsert: false })
          calls.push({ name: 'firma' })
          return { data: { path, token: 'fixture-only' } }
        },
        async uploadToSignedUrl(path, token, file, options) {
          assert.equal(path, doc.storage_path)
          assert.equal(token, 'fixture-only')
          assert.equal(file, pdf)
          assert.equal(options.upsert, false)
          calls.push({ name: 'upload' })
          return { data: {} }
        },
      }
    } },
  })
  const reserved = await archive.crea(meta, pdf, docId)
  assert.deepEqual(calls, [{ name: 'crea_documento_fiscale',
    args: { p_id: docId, p_tipo: 'F24', p_nome: 'f24.pdf', p_data: null, p_byte_size: pdf.size } }])
  await archive.carica(reserved, pdf)
  assert.deepEqual(calls.slice(1).map(x => x.name), ['firma', 'upload'])
  assert.equal((await archive.conferma(docId)).caricato_at, now)
  assert.equal((await archive.archivia(docId, 0)).archiviata_at, now)
  assert.deepEqual(calls.slice(-2).map(x => x.name), ['conferma_upload_documento_fiscale', 'archivia_documento_fiscale'])
})

test('metadata update/archive carry the captured revision; stale reply requires reread without retry', async () => {
  const calls = []
  const archive = creaArchivioDocumentiFiscali({ async rpc(name, args) {
    calls.push({ name, args })
    return { error: { code: '40001' } }
  } })
  await assert.rejects(archive.aggiorna(docId, 3, meta), /Conflitto di revisione/)
  await assert.rejects(archive.archivia(docId, 3), /Conflitto di revisione/)
  assert.deepEqual(calls, [
    { name: 'aggiorna_documento_fiscale', args: { p_id: docId, p_revisione_attesa: 3, p_tipo: 'F24', p_nome: 'f24.pdf', p_data: null } },
    { name: 'archivia_documento_fiscale', args: { p_id: docId, p_revisione_attesa: 3 } },
  ])
})

test('authorization refusal blocks metadata and signing; signing is bounded and uses the registry path', async () => {
  const calls = []
  const archive = creaArchivioDocumentiFiscali({
    async rpc() { return { error: { code: '42501' } } },
    storage: { from() { return { async createSignedUrl(...args) { calls.push(args); return { error: { statusCode: '403' } } } } } },
  })
  await assert.rejects(archive.crea(meta, pdf, docId))
  await assert.rejects(archive.urlFirmato(doc))
  assert.equal(calls.length, 0)
  await assert.rejects(archive.urlFirmato({ ...doc, caricato_at: now }))
  await assert.rejects(archive.urlFirmato({ ...doc, caricato_at: now, storage_path: 'altro.pdf' }))
  assert.deepEqual(calls, [[doc.storage_path, 120, { download: true }]])
})

test('metadata creation reuses an explicit identity and rejects a mismatched acknowledgment', async () => {
  const calls = []
  const archive = creaArchivioDocumentiFiscali({
    async rpc(name, args) { calls.push({ name, args }); return { data: doc } },
    storage: {},
  })
  await archive.crea(meta, pdf, docId)
  await archive.crea(meta, pdf, docId)
  assert.deepEqual(calls[0], calls[1])
  assert(calls.every(c => c.name === 'crea_documento_fiscale'))
})

test('metadata acknowledgment cannot substitute a different document identity', async () => {
  const archive = creaArchivioDocumentiFiscali({
    async rpc() { return { data: { ...doc, id: first, storage_path: 'documenti/' + first + '.pdf' } } },
    storage: {},
  })
  await assert.rejects(archive.crea(meta, pdf, docId), /Registrazione non confermata/)
})
