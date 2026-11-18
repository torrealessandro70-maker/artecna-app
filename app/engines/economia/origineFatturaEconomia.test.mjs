import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const source = ts.transpileModule(fs.readFileSync(new URL('./origineFatturaEconomia.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const engine = {}; new Function('exports', source)(engine)
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const fattura = id(1), riga = id(2), registrazione = id(3), raccolta = id(4), cantiere = id(5)
const fixture = () => ({ id: registrazione, raccolta_id: raccolta, origine: 'fattura_fornitore', tipo_riga: 'materiale',
  fattura_riga_id: riga, dettagli_analitici: { version: 1, fattura: { version: 1, fattura_id: fattura, fattura_riga_id: riga } } })
function client({ row = { id: riga, fattura_id: fattura }, rowError = null, rpcError = null,
  assignments = [{ id: registrazione, destinazione: 'economia', raccolta_id: raccolta, cantiere_id: cantiere }] } = {}) {
  const calls = []
  return { calls, from(table) {
    assert.equal(table, 'fatture_fornitori_righe'); calls.push('select')
    const q = { select(fields) { assert.equal(fields, 'id,fattura_id'); return q },
      eq(field, value) { assert.equal(value, field === 'id' ? riga : fattura); return q },
      maybeSingle: async () => ({ data: row, error: rowError }) }
    return q
  }, rpc: async (name, params) => {
    assert.equal(name, 'leggi_assegnazioni_materiali_fattura')
    assert.deepEqual(params, { p_fattura_id: fattura, p_cantiere_id: cantiere }); calls.push(name)
    return { data: [{ fattura_riga_id: riga, assegnazioni: assignments }], error: rpcError }
  } }
}
test('Catena completa: quota Economia coincide con la registrazione; soltanto due letture', async () => {
  const c = client(); const result = await engine.verificaOrigineFattura(c, fixture(), raccolta, cantiere)
  assert.deepEqual(result, { fatturaId: fattura, rigaFatturaId: riga, quotaId: registrazione,
    registrazioneId: registrazione, raccoltaId: raccolta, cantiereId: cantiere })
  assert.deepEqual(c.calls, ['select', 'leggi_assegnazioni_materiali_fattura'])
})
test('Origine storica incompleta: nessuna ricerca per nome o importo e nessuna richiesta', async () => {
  const f = fixture(); delete f.dettagli_analitici.fattura.fattura_id
  const c = client(); await assert.rejects(engine.verificaOrigineFattura(c, f, raccolta, cantiere), /Non verificabile/)
  assert.deepEqual(c.calls, [])
})
test('Permessi negati o record invisibile: nessun dato di identità certificato', async () => {
  for (const options of [{ rowError: { code: '42501' } }, { row: null }, { rpcError: { code: '42501' } }])
    await assert.rejects(engine.verificaOrigineFattura(client(options), fixture(), raccolta, cantiere), /Non verificabile/)
})
test('Quota di altro cantiere, raccolta, destinazione, identità duplicata o mancante: blocco', async () => {
  const a = { id: registrazione, destinazione: 'economia', raccolta_id: raccolta, cantiere_id: cantiere }
  for (const assignments of [[{ ...a, cantiere_id: id(6) }], [{ ...a, raccolta_id: id(6) }],
    [{ ...a, destinazione: 'cantiere' }], [a, a], [], [{ ...a, id: id(6) }]])
    await assert.rejects(engine.verificaOrigineFattura(client({ assignments }), fixture(), raccolta, cantiere), /Non verificabile/)
})
test('Metadati e riga fiscale discordanti restano non verificabili', async () => {
  const f = fixture(); f.dettagli_analitici.fattura.fattura_riga_id = id(6)
  await assert.rejects(engine.verificaOrigineFattura(client(), f, raccolta, cantiere), /Non verificabile/)
  await assert.rejects(engine.verificaOrigineFattura(client({ row: { id: riga, fattura_id: id(6) } }), fixture(), raccolta, cantiere), /Non verificabile/)
})
