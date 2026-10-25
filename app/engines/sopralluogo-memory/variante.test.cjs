const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const ts = require('typescript')
function load(name = 'index.ts') {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, name), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
  }).outputText
  vm.runInNewContext(code, { exports, require: name => load(name + '.ts'), Date })
  return exports
}
const { buildVarianteMemorySources: adapt, buildMemoryFromSources: compose, buildSopralluogoMemory } = load()
const plain = value => JSON.parse(JSON.stringify(value))
const variante = Object.freeze({ id: 'v1', stato: 'bozza', descrizione: ' Descrizione ' })
const nota = Object.freeze({ source_id: 'n1', titolo: ' Nota ', testo: ' Testo ' })
const quaderno = Object.freeze({ id: 'q1', titolo: ' Quaderno ', testo: ' Corpo ', updated_at: '2026-10-25T10:00:00Z' })
const base = Object.freeze({ variante, cantiere_id: 'c1' })
for (const [name, extra, expected] of [
  ['sola descrizione', {}, 'Descrizione'],
  ['nota', { noteIntegrative: [nota] }, 'Nota\nTesto\n\nDescrizione'],
  ['Quaderno', { quaderni: [quaderno] }, 'Quaderno\nCorpo\n\nDescrizione'],
  ['nota e Quaderno', { noteIntegrative: [nota], quaderni: [quaderno] }, 'Quaderno\nCorpo\n\nNota\nTesto\n\nDescrizione'],
]) test(name, () => assert.equal(compose(adapt({ ...base, ...extra })).testoUnificato, expected))

test('adapter conserva byte, identità e provenienza senza normalizzare', () => {
  const sources = adapt({ ...base, quaderni: [quaderno], noteIntegrative: [nota] })
  assert.equal(sources[0].testo, ' Descrizione ')
  assert.deepEqual(plain(sources[2]), { source_id: 'q1', source_type: 'nota', origine: 'quaderno', source_version: quaderno.updated_at, updated_at: quaderno.updated_at, titolo: ' Quaderno ', testo: ' Corpo ' })
  assert.equal(quaderno.testo, ' Corpo ')
})
test('duplicati lasciati al composer', () => {
  const sources = adapt({ ...base, quaderni: [quaderno, quaderno], noteIntegrative: [nota, nota] })
  assert.equal(sources.length, 5)
  assert.equal(compose(sources).fonti.length, 3)
})
test('updated_at differente mantiene revisioni distinte', () => {
  const sources = adapt({ ...base, quaderni: [quaderno, { ...quaderno, updated_at: '2026-10-26T10:00:00Z' }] })
  assert.equal(compose(sources).fonti.length, 3)
  assert.notEqual(sources[1].source_version, sources[2].source_version)
})
test('versione esplicita e metadati della nota/variante conservati', () => {
  const sources = adapt({ ...base, variante: { ...variante, titolo: ' Titolo ', source_version: 'v2' }, noteIntegrative: [{ ...nota, source_version: 'n2', updated_at: 'data' }], quaderni: [{ ...quaderno, source_version: 'q2' }] })
  assert.equal(sources[0].titolo, ' Titolo ')
  assert.equal(sources[0].source_version, 'v2')
  assert.equal(sources[1].source_version, 'n2')
  assert.equal(sources[1].updated_at, 'data')
  assert.equal(sources[2].source_version, 'q2')
})
test('contratto separato, nessun dato extra incluso', () => {
  const extras = { foto: ['NO'], analisi_ai: 'NO', checklist: ['NO'], cad: 'NO', documenti: ['NO'], allegati: ['NO'], prezzi: [100], lavorazioni: ['NO'] }
  const contract = Object.freeze({ preventivo_contrattuale_id: 'contratto', preventivo_sorgente_id: 'sorgente', testo: 'NO' })
  const actual = adapt({ ...base, ...extras, variante: { ...variante, ...extras }, contestoContrattuale: contract, quaderni: [{ ...quaderno, ...extras }] })
  assert.deepEqual(plain(actual), plain(adapt({ ...base, quaderni: [quaderno] })))
  assert.equal(contract.preventivo_contrattuale_id, 'contratto')
  assert.ok(!compose(actual).testoUnificato.includes('NO'))
})
test('composizione deterministica con ordine input diverso', () => {
  const a = adapt({ ...base, noteIntegrative: [nota, { ...nota, source_id: 'n2' }] })
  const b = adapt({ ...base, noteIntegrative: [{ ...nota, source_id: 'n2' }, nota] })
  assert.deepEqual(plain(compose(a)), plain(compose(b)))
  assert.deepEqual(plain(adapt(base)), plain(adapt(base)))
})
test('vuoti gestiti solo dal composer', () => {
  const sources = adapt({ ...base, variante: { ...variante, titolo: ' ', descrizione: '\n' } })
  assert.equal(sources.length, 1)
  assert.equal(sources[0].testo, '\n')
  assert.equal(compose(sources).testoUnificato, '')
})
test('solo Variante bozza, nessun side effect su adapter precedente', () => {
  assert.throws(() => adapt({ ...base, variante: { ...variante, stato: 'approvata' } }), /bozza/)
  const input = { sopralluogoId: 's1', descrizioneIniziale: ' D ', quaderno: { titolo: ' T ', testo: ' X ' } }
  assert.equal(buildSopralluogoMemory(input).testoUnificato, 'D\n\nT\nX')
  assert.equal(buildSopralluogoMemory(input).quaderno, input.quaderno)
})
