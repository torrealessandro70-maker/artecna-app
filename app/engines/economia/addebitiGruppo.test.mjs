import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const modules = {}
function load(name) {
  if (modules[name]) return modules[name]
  if (name === './fattureMateriali') return { uuidFattura: v => typeof v === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v) }
  const source = ts.transpileModule(fs.readFileSync(new URL(name + '.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const e = modules[name] = {}; new Function('require', 'exports', source)(load, e); return e
}
const e = load('./addebitiGruppo'), id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const quota = (n, costo = 10) => ({ materiale_id: id(n), fattura_riga_id: id(n + 50), cantiere_id: id(90), cantiere: 'Fixture',
  descrizione: 'Materiale', quantita: 1, disponibile: 1, unita_misura: 'CAD', costo })
test('Nove quote costo 22,92, totale cliente 62, ripartizione esatta e deterministica', () => {
  const costi = [262, 148, 500, 295, 8, 343, 230, 431, 75]
  assert.equal(costi.reduce((a, b) => a + b), 2292)
  const prezzi = e.ripartisci('62', costi)
  assert.equal(prezzi.reduce((a, b) => a + b), 6200)
  assert.ok(prezzi.every(p => p > 0)); assert.deepEqual(e.ripartisci('0.10', [1, 1, 1]), [4, 3, 3])
  assert.throws(() => e.ripartisci('0.01', [1, 1, 1])); assert.throws(() => e.ripartisci('62', [0, 0]))
})
test('Precompilazione costo come base, IVA da confermare, quantità parziale e ricarico', () => {
  const q = { ...quota(1, 22.92), quantita: 2, disponibile: 0.5 }
  const r = e.preparaRiga(q); assert.equal(r.importo, '5.73'); assert.equal(r.aliquota, ''); assert.equal(r.iva_confermata, false)
  assert.equal(e.ricarico(573, '25'), 716); assert.throws(() => e.costoQuota(q, '0.6'))
})
test('Applica a tutti modifica solo campi comuni espliciti e soltanto selezionate', () => {
  const righe = [e.preparaRiga(quota(1)), { ...e.preparaRiga(quota(2)), importo: '62.00', descrizione: 'Personalizzata' }]
  const changed = e.applicaComuni(righe, [id(2)], { motivo: 'Motivo comune' })
  assert.deepEqual(changed[0], righe[0]); assert.equal(changed[1].importo, '62.00'); assert.equal(changed[1].descrizione, 'Personalizzata')
  assert.equal(changed[1].motivo, 'Motivo comune'); assert.equal(righe[1].motivo, '')
})
test('IVA esplicita, prezzi positivi e duplicati: blocco prima di qualsiasi RPC', async () => {
  const r = e.preparaRiga(quota(1))
  assert.throws(() => e.payloadGruppo([r]))
  const ok = { ...r, aliquota: '0', iva_confermata: true, motivo: 'Concordato', riferimento: 'Accordo' }
  assert.equal(e.payloadGruppo([ok])[0].aliquota, 0)
  assert.throws(() => e.payloadGruppo([ok, ok])); assert.throws(() => e.payloadGruppo([{ ...ok, aliquota: '' }]))
  assert.throws(() => e.payloadGruppo([{ ...ok, importo: '0' }]))
  let calls = 0; await assert.rejects(e.anteprimaGruppo({ rpc: async () => { calls++; return {} } }, id(90), [r])); assert.equal(calls, 0)
})
test('Lettura quote: errori, riserve e identità duplicate non sono zero verificati', async () => {
  await assert.rejects(e.leggiQuoteGruppo({ rpc: async () => ({ data: null, error: { code: '42501' } }) }, id(80)))
  await assert.rejects(e.leggiQuoteGruppo({ rpc: async () => ({ data: [quota(1), quota(1)], error: null }) }, id(80)))
  const rows = await e.leggiQuoteGruppo({ rpc: async () => ({ data: [{ ...quota(1), disponibile: 0 }], error: null }) }, id(80))
  assert.equal(rows[0].disponibile, 0)
})
