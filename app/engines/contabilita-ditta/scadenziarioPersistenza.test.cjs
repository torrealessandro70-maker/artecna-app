/* eslint-disable @typescript-eslint/no-require-imports -- Mock RPC only: no SQL, sockets or real credentials. */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript')
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, f)
const { creaArchivioScadenziario, ErroreScadenziario } = require('./scadenziarioPersistenza.ts')
const { validaBozzaScadenza, nuovaBozzaScadenza } = require('./scadenziario.ts')
const id = '00000000-0000-4000-8000-000000000001', actor = '00000000-0000-4000-8000-000000000002'
const raw = (extra = {}) => ({ id, tipo: 'F24', periodo_riferimento: 'T4 fixture', data_scadenza: '2026-12-01', importo_previsto: null, stato: 'da_verificare', importo_pagato: null, data_pagamento: null, note: '', riferimento_documento: 'fixture', includi_nei_totali: false, revisione: '0', created_at: '2026-11-10T12:00:00+00:00', created_by: actor, updated_at: '2026-11-10T12:00:00+00:00', updated_by: actor, archiviata_at: null, archiviata_by: null, motivo_archiviazione: null, ...extra })
const dati = () => ({ scadenza: validaBozzaScadenza({ ...nuovaBozzaScadenza(), tipo: 'F24', periodo: 'T4 fixture', dataScadenza: '2026-12-01', riferimento: 'fixture', includiNeiTotali: false }, id), importoPagato: null, dataPagamento: null })
function mock(replies) { const calls = []; return { calls, api: creaArchivioScadenziario({ async rpc(name, args) { calls.push({ name, args }); const reply = replies[calls.length - 1]; if (reply instanceof Error) throw reply; return reply } }) } }
const elenco = rows => ({ data: { versione: 1, totale: rows.length, include_archiviate: false, righe: rows }, error: null })
const errore = kind => e => e instanceof ErroreScadenziario && e.tipo === kind
test('valid empty archive distinct from unavailable read', async () => {
  assert.deepEqual(await mock([elenco([])]).api.elenco(), [])
  for (const reply of [{ error: { code: '42501' } }, new Error('offline'), null, { data: null }]) await assert.rejects(mock([reply]).api.elenco(), errore('lettura'))
})
test('DTO keeps NULL, zero, four state mapping, actors, revisions and manual F24 exclusion', async () => {
  const r = await mock([elenco([raw(), raw({ id: actor, importo_previsto: '0.00', stato: 'pagato' })])]).api.elenco()
  assert.equal(r[0].importoCentesimi, null); assert.equal(r[1].importoCentesimi, 0); assert.equal(r[1].stato, 'Pagato'); assert.equal(r[0].includiNeiTotali, false)
  assert.equal(r[0].createdBy, actor); assert.equal(r[0].revisione, '0')
})
for (const extra of [{ importo_previsto: 1 }, { importo_previsto: '-1' }, { importo_previsto: '1.001' }, { importo_previsto: '1,22' }, { importo_previsto: '1000000000000' }, { revisione: 0 }, { stato: 'stimato' }, { created_by: null }, { importo_pagato: undefined }, { data_pagamento: '2026-11-10' }, { archiviata_at: '2026-11-10T12:00:00Z' }]) test('malformed row rejected: ' + JSON.stringify(extra), async () => await assert.rejects(mock([elenco([raw(extra)])]).api.elenco(), errore('lettura')))
test('truncation, duplicate identity and unexpected archived rows fail closed', async () => {
  for (const reply of [{ data: { ...elenco([]).data, totale: 1 } }, elenco([raw(), raw()]), elenco([raw({ archiviata_at: '2026-11-10T12:00:00Z', archiviata_by: actor, motivo_archiviazione: 'fixture' })])]) await assert.rejects(mock([reply]).api.elenco(), errore('lettura'))
})
test('create sends only mutable fields and stable UUID, no client-supplied actor/timestamps', async () => {
  const m = mock([{ data: raw(), error: null }]); await m.api.crea(dati())
  assert.equal(m.calls.length, 1); assert.equal(m.calls[0].name, 'crea_scadenza_fiscale'); assert.equal(m.calls[0].args.p_id, id)
  assert.equal(m.calls[0].args.p_dati.importo_previsto, null); assert.equal(m.calls[0].args.p_dati.stato, 'da_verificare')
  for (const key of ['created_by', 'updated_by', 'created_at', 'revisione', 'id']) assert(!(key in m.calls[0].args.p_dati))
})
test('update preserves explicit payment annotations and revision string', async () => {
  const d = dati(); d.importoPagato = '0.00'; d.dataPagamento = '2026-11-10'
  const m = mock([{ data: raw({ revisione: '8', importo_pagato: '0.00', data_pagamento: d.dataPagamento }), error: null }])
  await m.api.aggiorna(d, '7'); assert.equal(m.calls[0].args.p_revisione_attesa, '7'); assert.equal(m.calls[0].args.p_dati.importo_pagato, '0.00')
})
test('archive is a dedicated RPC with expected revision and reason, never delete', async () => {
  const m = mock([{ data: raw({ revisione: '1', archiviata_at: '2026-11-10T13:00:00Z', archiviata_by: actor, motivo_archiviazione: 'fine' }), error: null }])
  const r = await m.api.archivia(id, '0', ' fine '); assert(r.archiviataAt); assert.equal(r.stato, 'Da verificare')
  assert.deepEqual(m.calls[0], { name: 'archivia_scadenza_fiscale', args: { p_id: id, p_revisione_attesa: '0', p_motivo: 'fine' } })
})
test('stale revision has its own conflict type, one call only', async () => {
  const m = mock([{ error: { code: '40001' } }]); await assert.rejects(m.api.aggiorna(dati(), '0'), errore('conflitto')); assert.equal(m.calls.length, 1)
})
test('denied write, network ambiguity and incomplete acknowledgment remain distinct, no retries', async () => {
  for (const [reply, kind] of [[{ error: { code: '42501' } }, 'scrittura'], [new Error('offline'), 'esito_incerto'], [{ data: null }, 'esito_incerto'], [{ data: raw({ revisione: '1' }) }, 'esito_incerto'], [{ data: raw({ note: 'unexpected' }) }, 'esito_incerto']]) {
    const m = mock([reply]); await assert.rejects(m.api.crea(dati()), errore(kind)); assert.equal(m.calls.length, 1)
  }
})
test('invalid inputs rejected before RPC; no unsafe rounding/payment generation', async () => {
  const m = mock([])
  await assert.rejects(m.api.aggiorna(dati(), '-1'), errore('scrittura'))
  await assert.rejects(m.api.crea({ ...dati(), importoPagato: '1.001' }), errore('scrittura'))
  await assert.rejects(m.api.archivia(id, '0', ''), errore('scrittura')); assert.equal(m.calls.length, 0)
})

test('archive reader explicitly requests history, preserves archived state and metadata', async () => {
  const row=raw({archiviata_at:'2026-11-10T12:00:00Z',archiviata_by:actor,motivo_archiviazione:'Conclusa',stato:'pagato'})
  const m=mock([{data:{versione:1,totale:1,include_archiviate:true,righe:[row]}}]);const rows=await m.api.elenco(true)
  assert.equal(m.calls[0].args.p_includi_archiviate,true);assert.equal(rows[0].stato,'Pagato');assert.equal(rows[0].motivoArchiviazione,'Conclusa')
  await assert.rejects(mock([{data:{versione:1,totale:0,include_archiviate:false,righe:[]}}]).api.elenco(true),errore('lettura'))
})
