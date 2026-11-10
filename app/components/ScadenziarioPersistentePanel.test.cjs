/* eslint-disable @typescript-eslint/no-require-imports -- Async controller with injected in-memory RPC fixture, never a real database. */
const test = require('node:test'), assert = require('node:assert/strict')
const {controller}=require('./scadenziarioControllerFixture.cjs')
const id = '00000000-0000-4000-8000-000000000001'
const voce = (extra = {}) => ({ id, tipo: 'IVA', periodo: 'T4 fixture', dataScadenza: '2026-12-01', importoCentesimi: 10000, stato: 'Da verificare', nota: '', riferimento: '', includiNeiTotali: true, revisione: '0', importoPagato: null, dataPagamento: null, archiviataAt: null, ...extra })
const defer = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function fixture(rows = []) {
  let data = rows; const calls = []
  return { calls, async elenco() { calls.push('elenco'); return [...data] }, async crea({ scadenza }) { calls.push('crea'); const r = { ...voce(), ...scadenza }; data = [...data, r]; return r }, async aggiorna({ scadenza, importoPagato, dataPagamento }, revisione) { calls.push({ action: 'aggiorna', revisione, importoPagato, dataPagamento }); const r = { ...voce(), ...scadenza, revisione: String(Number(revisione) + 1), importoPagato, dataPagamento }; data = data.map(x => x.id === r.id ? r : x); return r }, async archivia(identita, revisione, motivo) { calls.push({ action: 'archivia', identita, revisione, motivo }); return { ...data.find(r => r.id === identita), revisione: String(Number(revisione) + 1), archiviataAt: '2026-11-10T12:00:00Z' } } }
}
test('empty acknowledged archive distinct from loading and read error, no memory fallback', async () => {
  const f = fixture(), m = controller(f); assert.equal(m.render().pronta, false)
  let p = await m.flush(); assert.equal(p.pronta, true); assert.deepEqual(p.righe, [])
  f.elenco = async () => { f.calls.push('errore'); throw Error('Accesso negato') }; p.onRileggi(); p = await m.flush()
  assert.equal(p.pronta, false); assert(p.errore.includes('Accesso negato')); assert.equal(p.righe.length, 0)
})
test('fresh mount/new session rereads persisted fixture instead of resetting rows', async () => {
  const f = fixture(); const first = controller(f); let p = await first.flush(); await p.onSalva(voce(), null); first.unmount()
  const second = controller(f); p = await second.flush(); assert.equal(p.righe.length, 1); assert.equal(p.righe[0].id, id)
})
test('no optimistic save and no double writer during pending acknowledgment', async () => {
  const f = fixture(), pending = defer(); let writes = 0; f.crea = () => { writes++; return pending.promise }
  const m = controller(f); let p = await m.flush(); const op = p.onSalva(voce(), null)
  assert.equal(m.render().righe.length, 0); assert.equal(m.render().occupata, true)
  await assert.rejects(m.render().onSalva(voce(), null)); assert.equal(writes, 1)
  pending.resolve(voce()); await op; p = m.render(); assert.equal(p.righe.length, 1); assert.equal(p.occupata, false)
})
test('update uses revision and preserves existing paid amount/date; UI engine fields unchanged', async () => {
  const f = fixture([voce({ importoPagato: '10.00', dataPagamento: '2026-11-01', revisione: '7' })]); const m = controller(f)
  const p = await m.flush(); await p.onSalva(voce({ nota: 'modifica' }), id)
  assert.equal(m.render().righe[0].revisione, '8'); assert.deepEqual(f.calls[1], { action: 'aggiorna', revisione: '7', importoPagato: '10.00', dataPagamento: '2026-11-01' })
})
test('conflict/error blocks further mutations until explicit read, no automatic retry', async () => {
  const f = fixture([voce()]); f.aggiorna = async () => { f.calls.push('conflitto'); throw Error('Revisione cambiata') }
  const m = controller(f); const p = await m.flush(); await assert.rejects(p.onSalva(voce(), id))
  assert.equal(m.render().pronta, false); assert.equal(f.calls.filter(x => x === 'elenco').length, 1)
  await assert.rejects(m.render().onSalva(voce(), null)); assert.equal(f.calls.length, 2)
  m.render().onRileggi(); assert.equal((await m.flush()).pronta, true)
})
test('archiving removes only acknowledged entry from open KPI input, no fifth state', async () => {
  const f = fixture([voce()]), m = controller(f); const p = await m.flush(); await p.onArchivia(id, 'Conclusa')
  assert.equal(m.render().righe.length, 0); assert.deepEqual(f.calls[1], { action: 'archivia', identita: id, revisione: '0', motivo: 'Conclusa' })
})
test('late read after unmount cannot hydrate next session/context', async () => {
  const pending = defer(), f = fixture(); f.elenco = () => pending.promise
  const m = controller(f); await m.flush(); m.unmount(); pending.resolve([voce()]); await m.flush(); assert.equal(m.render().pronta, false)
})
