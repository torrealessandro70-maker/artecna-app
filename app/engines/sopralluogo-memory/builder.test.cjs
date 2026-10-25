const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const path = require('node:path')
const fixed = '2026-10-25T12:00:00.000Z'
function load(filename = 'builder.ts') {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, filename), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
  }).outputText
  vm.runInNewContext(code, { exports, require: name => load(name + '.ts'), Date: class extends Date { constructor() { super(fixed) } } })
  return exports
}
const cases = [
  {},
  { descrizioneIniziale: '  descrizione  ' },
  { quaderno: { titolo: ' titolo ', testo: ' testo ' } },
  { descrizioneIniziale: ' descrizione ', quaderno: { titolo: ' titolo ', testo: ' testo ' } },
  { descrizioneIniziale: ' uguale ', quaderno: { titolo: '', testo: ' uguale ' } },
  { descrizioneIniziale: '\n ', quaderno: { titolo: ' ', testo: '\n' } },
  { descrizioneIniziale: ' a\n\n b ', quaderno: { titolo: '', testo: ' x\n y ' } },
  { quaderno: null },
]
for (const [index, fixture] of cases.entries()) {
  test(`parità baseline ${index + 1}`, () => {
    const input = { sopralluogoId: 's1', ...fixture }
    const description = input.descrizioneIniziale?.trim() ?? ''
    const notebook = [input.quaderno?.titolo?.trim() ?? '', input.quaderno?.testo?.trim() ?? ''].filter(Boolean).join('\n')
    const actual = load().buildSopralluogoMemory(input)
    assert.deepEqual(JSON.parse(JSON.stringify(actual)), {
      sopralluogoId: 's1', descrizioneIniziale: description, quaderno: input.quaderno ?? null,
      testoUnificato: [description, notebook].filter(Boolean).join('\n\n'), lastUpdated: fixed,
    })
    assert.equal(actual.quaderno, input.quaderno ?? null)
  })
}


const plain = value => JSON.parse(JSON.stringify(value))
const description = { source_id: 'd', source_type: 'descrizione', origine: 'cantiere', testo: ' Descrizione ' }
const note = { source_id: 'n', source_type: 'nota', origine: 'quaderno', titolo: ' Titolo ', testo: ' Testo ' }
for (const [name, sources, expected] of [
  ['descrizione e nota', [description, note], 'Descrizione\n\nTitolo\nTesto'],
  ['solo descrizione', [description], 'Descrizione'],
  ['solo nota', [note], 'Titolo\nTesto'],
  ['due note', [note, { ...note, source_id: 'z', testo: ' Seconda ' }], 'Titolo\nTesto\n\nTitolo\nSeconda'],
  ['titoli e testi vuoti', [{ ...note, titolo: ' ', testo: '\n' }, { ...description, testo: '' }], ''],
]) test(name, () => assert.equal(load().buildMemoryFromSources(sources).testoUnificato, expected))

test('ordine stabile, duplicati normalizzati e input immutabile', () => {
  const sources = Object.freeze([Object.freeze(note), Object.freeze(description), Object.freeze({ ...note, testo: 'Testo' })])
  const compose = load().buildMemoryFromSources
  const result = compose(sources)
  assert.deepEqual(plain(result), plain(compose([...sources].reverse())))
  assert.equal(result.fonti.length, 2)
  assert.equal(note.testo, ' Testo ')
})

test('identità, provenienza e versioni conservate; fonti distinte non eliminate', () => {
  const source = { ...note, source_version: 'v2', updated_at: '2026-10-25T10:00:00Z' }
  const result = load().buildMemoryFromSources([source, { ...source, source_version: 'v3' }])
  assert.equal(result.fonti.length, 2)
  assert.deepEqual(plain(result.fonti[0]), { ...source, titolo: 'Titolo', testo: 'Testo' })
})

test('nessuna inclusione implicita di analisi, foto, CAD o allegati', () => {
  const extras = { analisi_ai: 'SEGRETO', foto: ['foto'], cad: 'cad', checklist: ['check'], documenti: ['doc'], allegati: ['file'] }
  const result = load().buildMemoryFromSources([{ ...note, ...extras }])
  assert.deepEqual(plain(result.fonti), [{ ...note, titolo: 'Titolo', testo: 'Testo' }])
  assert.equal(result.testoUnificato, 'Titolo\nTesto')
  assert.equal(load().buildSopralluogoMemory({ sopralluogoId: 's', ...extras }).testoUnificato, '')
})

test('stessa identità con contenuti diversi: nessuna selezione dipendente dall’ordine', () => {
  const compose = load().buildMemoryFromSources
  const sources = [note, { ...note, testo: 'Altro' }]
  assert.equal(compose(sources).fonti.length, 2)
  assert.deepEqual(plain(compose(sources)), plain(compose([...sources].reverse())))
})

test('API esportata dall’indice compatibile con il chiamante attuale', () => {
  const api = load('index.ts')
  assert.equal(typeof api.buildSopralluogoMemory, 'function')
  assert.equal(api.buildMemoryFromSources([description]).testoUnificato, 'Descrizione')
})
