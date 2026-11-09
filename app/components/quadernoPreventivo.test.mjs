import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appunti = fs.readFileSync(path.join(__dirname, 'SopralluogoAppunti.tsx'), 'utf8');
const dettaglio = fs.readFileSync(path.join(__dirname, 'SopralluogoDettaglio.tsx'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, '../page.tsx'), 'utf8');
function expression(source, name) { const tree = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let found; function visit(n) { if (!found && ts.isVariableDeclaration(n) && n.name.getText(tree) === name)
    found = n.initializer.getText(tree); ts.forEachChild(n, visit); } visit(tree); assert.ok(found, name); return found; }
const flushSource = expression(appunti, 'salvaPrimaDiUscire');
function fixture(overrides = {}) { let text = 'Ultimo testo', saved = '', writes = 0; const env = { pronto: true, richiamoAperto: false, richiamoBusyRef: { current: false }, richiamoIncertoRef: { current: false }, salvataggioPromiseRef: { current: null }, quadernoDirty: true, contenutoCorrenteRef: { current: () => ({ testo: text }) }, firmaPersistitaRef: { current: null }, salvaNota: async () => { writes++; saved = text; env.firmaPersistitaRef.current = JSON.stringify({ testo: text }); return 'nota'; }, ...overrides }; const flush = Function(...Object.keys(env), 'return (' + flushSource + ')')(...Object.values(env)); return { env, flush, text: v => text = v, saved: () => saved, writes: () => writes }; }
test('typing and native paste use onChange and mark the notebook dirty', () => { assert.match(appunti, /onChange=\{\(event\) => \{ setTesto\(event.target.value\); setQuadernoDirty\(true\); \}\}/); });
test('immediate transition persists the complete pasted text before the reader', async () => { const f = fixture(); const text = 'Inizio\n' + ('testo incollato\n'.repeat(20000)) + 'FINE'; f.text(text); assert.equal(await f.flush(), true); assert.equal(f.saved(), text); assert.equal(f.writes(), 1); });
test('awaits an in-flight save and persists edits made during it', async () => { let release; const pending = new Promise(r => release = r); const f = fixture({ salvataggioPromiseRef: { current: pending } }); const promise = f.flush(); f.text('incollato durante il salvataggio'); assert.equal(f.writes(), 0); release('nota'); assert.equal(await promise, true); assert.equal(f.saved(), 'incollato durante il salvataggio'); });
test('save failure blocks leaving/generation; no retry', async () => { let calls = 0; const f = fixture({ salvaNota: async () => { calls++; return null; } }); assert.equal(await f.flush(), false); assert.equal(calls, 1); });
for (const override of [{ pronto: false }, { richiamoAperto: true }, { richiamoIncertoRef: { current: true } }])
    test('unready/conflicted notebook blocks generation ' + JSON.stringify(override), async () => assert.equal(await fixture(override).flush(), false));
test('unchanged notebook does not write', async () => { const f = fixture({ quadernoDirty: false }); assert.equal(await f.flush(), true); assert.equal(f.writes(), 0); });
test('payload includes only selected photos of this target, with image and note', () => { const s = { id: 'target', note: 'tutto il quaderno' }, fotoSopralluoghi = [{ sopralluogo_id: 'target', includi_preventivo: true, immagine_base64: 'data:image/png;base64,AAAA', nota: 'Nota completa' }, { sopralluogo_id: 'target', includi_preventivo: false, immagine_base64: 'esclusa' }, { sopralluogo_id: 'altro', includi_preventivo: true, immagine_base64: 'altro' }]; const filter = expression(page, 'fotoDelSopralluogo'), payload = expression(page, 'payloadPreventivoAi'); const result = Function('s', 'fotoSopralluoghi', 'sopralluogoConMemoria', 'prezziRiferimento', 'const fotoDelSopralluogo=' + filter + '; return ' + payload)(s, fotoSopralluoghi, s, []); assert.deepEqual(result.foto, [{ immagine_base64: 'data:image/png;base64,AAAA', nota: 'Nota completa' }]); assert.equal(JSON.parse(JSON.stringify(result)).sopralluogo.note, s.note); });
test('generation waits for notebook persistence before its database read', () => { assert.match(dettaglio, /primaDiUscireRef=\{primaDiUscireRef\}/); assert.match(dettaglio, /if \(!await dopoSalvataggioQuaderno\(\(\) => \{\}\)\) return false\s+return props.generaPreventivoAiDaSopralluogo\(s\)/); assert.ok(page.indexOf(".from('note_sopralluogo')", page.indexOf('const generaPreventivoAiDaSopralluogo')) < page.indexOf('const payloadPreventivoAi')); });
test('memory and AI request retain the full notebook and selected photo content', () => { function load(file) { const source = fs.readFileSync(path.join(__dirname, file), 'utf8'); const mod = { exports: {} }; Function('exports', 'require', 'module', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(mod.exports, require, mod); return mod.exports; } const { buildSopralluogoMemory } = load('../engines/sopralluogo-memory/builder.ts'); const { creaRichiestaPreventivoAi } = load('../engines/preventivo-generation/richiesta.ts'); const text = 'INIZIO\n' + ('testo\n'.repeat(30000)) + 'FINE'; const memory = buildSopralluogoMemory({ sopralluogoId: 'target', descrizioneIniziale: 'Descrizione', quaderno: { titolo: 'Quaderno', testo: text } }); assert.ok(memory.testoUnificato.includes(text)); const request = JSON.stringify(creaRichiestaPreventivoAi({ sopralluogo: { note: memory.testoUnificato }, foto: [{ immagine_base64: 'data:image/png;base64,AAAA', nota: 'Nota foto' }] })); assert.ok(request.includes('FINE')); assert.ok(request.includes('data:image/png;base64,AAAA')); assert.ok(request.includes('Nota foto')); });

test('concurrent callers share one writer promise', async () => {
  const salvataggioPromiseRef = { current: null };
  let release, calls = 0;
  const pending = new Promise(resolve => { release = resolve; });
  const writer = () => { calls++; return pending; };
  const save = Function('salvataggioPromiseRef', 'eseguiSalvataggioNota', 'return (' + expression(appunti, 'salvaNota') + ')')(salvataggioPromiseRef, writer);
  const first = save(false), second = save(false);
  assert.equal(first, second);
  assert.equal(calls, 1);
  release('nota');
  assert.equal(await first, 'nota');
  await Promise.resolve();
  assert.equal(salvataggioPromiseRef.current, null);
});
test('failed in-flight save blocks AI without retry', async () => {
  const f = fixture({ salvataggioPromiseRef: { current: Promise.resolve(null) } });
  assert.equal(await f.flush(), false);
  assert.equal(f.writes(), 0);
});
