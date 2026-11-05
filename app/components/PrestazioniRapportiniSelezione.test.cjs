/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness with isolated CommonJS mocks. */
const { test } = require('node:test');
const a = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props });
const nodes = (n, out = []) => { if (Array.isArray(n)) n.forEach(v => nodes(v, out)); else if (n?.props) { out.push(n); nodes(n.props.children, out); } return out; };
const text = n => Array.isArray(n) ? n.map(text).join('') : n?.props ? text(n.props.children) : n == null || typeof n === 'boolean' ? '' : String(n);
function harness({ empty = false, noCollection = false, allAcquired = false, acquiredCandidabile = false } = {}) {
  const states = [], refs = [], effects = [], calls = [];
  let cursor = 0;
  const rows = empty ? [] : ['eligible-a', 'acquired', 'divergent', 'blocked', 'eligible-b'].map((id, i) => ({ prestazione_id: id, candidabile: i === 0 || i === 4 || (i === 1 && acquiredCandidabile), stato: allAcquired || i === 1 ? 'gia_acquisita' : i === 2 ? 'divergente' : 'disponibile', ore: 2, data: '2026-11-05', operaio_nome: 'Fixture' }));
  const react = {
    useState: init => { const i = cursor++; if (!(i in states)) states[i] = init; return [states[i], v => { states[i] = typeof v === 'function' ? v(states[i]) : v; }]; },
    useRef: init => { const i = cursor++; return refs[i] ||= { current: init }; },
    useEffect: (fn, deps) => { const i = cursor++; if (!effects[i] || deps.some((d, j) => d !== effects[i].deps[j])) { effects[i]?.cleanup?.(); effects[i] = { deps, pending: fn }; } }
  };
  const exports = {};
  const source = fs.readFileSync(require('node:path').join(__dirname, 'PrestazioniRapportiniEconomia.tsx'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: n => n === 'react' ? react : n === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : n === './VistaOperativa' ? { default: 'VistaOperativa' } : n.includes('supabaseClient') ? { supabase: { rpc: () => { throw Error('Unexpected RPC'); } } } : { elencaPrestazioniEconomia: async () => { calls.push('read'); return { prestazioni: rows, raccolte_in_bozza: noCollection ? [] : [{ raccolta_id: 'collection', titolo: 'Fixture', numero: 1, revisione: 1 }] }; }, acquisisciPrestazioniEconomia: async () => { calls.push('write'); throw Error('No writes in smoke'); } } });
  const render = () => { cursor = 0; const tree = exports.default({ cantiereId: 'fixture', aggiornamento: 0, onInvio() {}, onAcquisite() {} }); for (const effect of effects) if (effect?.pending) { const fn = effect.pending; delete effect.pending; effect.cleanup = fn(); } return tree; };
  const button = (tree, name) => nodes(tree).find(n => n.type === 'button' && text(n) === name);
  const checks = tree => nodes(tree).filter(n => n.type === 'input');
  return { render, button, checks, calls, rows };
}
const flush = () => new Promise(setImmediate);
test('smoke: mixed rows, select/deselect eligible only; toolbar order; no acquisition or RPC', async () => {
  const h = harness(); let t = h.render(); a.equal(h.button(t, 'Seleziona tutto').props.disabled, true); await flush(); t = h.render();
  a.deepEqual(nodes(t).filter(n => n.type === 'button' && text(n) !== 'Lavori in economia dai Rapportini').slice(0, 3).map(text), ['Rileggi prestazioni', 'Seleziona tutto', 'Acquisisci selezionate']);
  const eligible = h.checks(t).filter(n => !n.props.disabled).map(n => n.props['aria-label']); a.equal(eligible.length, 2);
  h.button(t, 'Seleziona tutto').props.onClick(); t = h.render();
  a.deepEqual(h.checks(t).filter(n => n.props.checked).map(n => n.props['aria-label']), eligible);
  a.equal(h.button(t, 'Acquisisci selezionate').props.disabled, false);
  a(!nodes(t).some(n => n.props['aria-label'] === 'Conferma acquisizione'));
  h.button(t, 'Deseleziona tutto').props.onClick(); t = h.render(); a(h.checks(t).every(n => !n.props.checked)); a.deepEqual(h.calls, ['read']);
});
test('partial selection completes without duplicates; individual toggle restores label', async () => {
  const h = harness(); h.render(); await flush(); let t = h.render(); h.checks(t)[0].props.onChange({ target: { checked: true } }); t = h.render();
  h.button(t, 'Seleziona tutto').props.onClick(); t = h.render(); a.equal(h.checks(t).filter(n => n.props.checked).length, 2);
  h.checks(t)[0].props.onChange({ target: { checked: false } }); t = h.render(); a(h.button(t, 'Seleziona tutto')); a.deepEqual(h.calls, ['read']);
});
for (const options of [{ empty: true }, { noCollection: true }]) test(`disabled selection: ${JSON.stringify(options)}`, async () => { const h = harness(options); h.render(); await flush(); const t = h.render(); a.equal(h.button(t, 'Seleziona tutto').props.disabled, true); h.button(t, 'Seleziona tutto').props.onClick(); a(h.checks(h.render()).every(n => !n.props.checked)); a.deepEqual(h.calls, ['read']); });
test('selection changes close pending confirmation; reread resets selection', async () => {
 const h = harness(); h.render(); await flush(); let t = h.render(); h.button(t, 'Seleziona tutto').props.onClick(); t = h.render(); h.button(t, 'Acquisisci selezionate').props.onClick(); t = h.render(); a(nodes(t).some(n => n.props['aria-label'] === 'Conferma acquisizione')); h.button(t, 'Deseleziona tutto').props.onClick(); t = h.render(); a(!nodes(t).some(n => n.props['aria-label'] === 'Conferma acquisizione')); h.button(t, 'Seleziona tutto').props.onClick(); t = h.render(); h.button(t, 'Rileggi prestazioni').props.onClick(); h.render(); await flush(); t = h.render(); a(h.checks(t).every(n => !n.props.checked)); a.deepEqual(h.calls, ['read', 'read']);
});

test('history filter: acquired hidden, divergent/blocked visible, counts and data preserved; zero RPC from filter', async () => {
 const h = harness(); const before = JSON.stringify(h.rows); h.render(); await flush(); let t = h.render();
 a.equal(h.checks(t).length, 4); a(!text(t).includes('Già acquisita')); a(text(t).includes('Divergente: verifica necessaria')); a(text(t).includes('Non acquisibile: verifica Variante e ore')); a(text(t).includes('Da acquisire: 2')); a(text(t).includes('Già acquisite: 1'));
 h.button(t, 'Mostra già acquisite').props.onClick(); t = h.render(); a.equal(h.checks(t).length, 5); a(text(t).includes('Già acquisita')); a.equal(h.button(t, 'Nascondi già acquisite').props['aria-pressed'], true);
 h.button(t, 'Seleziona tutto').props.onClick(); t = h.render(); a.equal(h.checks(t).filter(n => n.props.checked).length, 2); a.equal(h.checks(t).find(n => n.props['aria-label'].endsWith('acquired')).props.checked, false);
 h.button(t, 'Nascondi già acquisite').props.onClick(); t = h.render(); a.equal(h.checks(t).length, 4); a.equal(h.checks(t).filter(n => n.props.checked).length, 2);
 h.button(t, 'Deseleziona tutto').props.onClick(); a(h.checks(h.render()).every(n => !n.props.checked)); a.deepEqual(h.calls, ['read']); a.equal(JSON.stringify(h.rows), before);
 const fresh = harness(); fresh.render(); await flush(); a(fresh.button(fresh.render(), 'Mostra già acquisite'));
});
test('all acquired: explicit explanation, no empty table, history consultable and selection disabled', async () => {
 const h = harness({ allAcquired: true }); h.render(); await flush(); let t = h.render();
 a(text(t).includes('Tutte le prestazioni disponibili risultano già acquisite.')); a.equal(nodes(t).filter(n => n.type === 'table').length, 0); a.equal(h.button(t, 'Seleziona tutto').props.disabled, true);
 h.button(t, 'Mostra già acquisite').props.onClick(); t = h.render(); a.equal(h.checks(t).length, 5); a(h.checks(t).every(n => n.props.disabled)); a(text(t).includes('Da acquisire: 0'));
 h.button(t, 'Nascondi già acquisite').props.onClick(); a(text(h.render()).includes('Tutte le prestazioni disponibili risultano già acquisite.')); a.deepEqual(h.calls, ['read']);
});
test('acquired never eligible even if candidate flag is inconsistent; filter independent of selection', async () => {
 const h = harness({ acquiredCandidabile: true }); h.render(); await flush(); let t = h.render();
 h.button(t, 'Mostra già acquisite').props.onClick(); t = h.render(); a.equal(h.checks(t).find(n => n.props['aria-label'].endsWith('acquired')).props.disabled, true);
 h.button(t, 'Seleziona tutto').props.onClick(); t = h.render(); a.equal(h.checks(t).filter(n => n.props.checked).length, 2); a.deepEqual(h.calls, ['read']);
});

test('Rapportini: accesso compatto, focus isolato e ritorno locale senza RPC', async () => {
 const h = harness(); h.render(); await flush(); let t = h.render(); const focus = () => nodes(t).find(n => n.type === 'VistaOperativa');
 a.equal(focus().props.visibile, false); a(!nodes(t).some(n => n.type === 'details')); h.button(t, 'Lavori in economia dai Rapportini').props.onClick(); t = h.render(); a.equal(focus().props.visibile, true); a.equal(focus().props.etichettaRitorno, '← Torna a Economia');
 h.button(t, 'Seleziona tutto').props.onClick(); t = h.render(); focus().props.onChiudi(); t = h.render(); a.equal(focus().props.visibile, false); h.button(t, 'Lavori in economia dai Rapportini').props.onClick(); t = h.render(); a.equal(h.checks(t).filter(n => n.props.checked).length, 2); a.deepEqual(h.calls, ['read']);
});

test('responsive focus: scoped container cards reuse labels without changing row data', async () => {
 const h = harness(); h.render(); await flush(); const t = h.render();
 const wrapper = nodes(t).find(n => n.props.className === 'prestazioni-economia-focus'); a.equal(wrapper.props.style.containerType, 'inline-size');
 const css = text(nodes(t).find(n => n.type === 'style')); a(css.includes('@container prestazioni-economia (width < 900px)')); a(css.includes('content: attr(data-label)'));
 const rows = nodes(t).filter(n => n.type === 'tr' && nodes(n).some(c => c.type === 'td'));
 a.equal(rows.length, 4); for (const row of rows) a.deepEqual(nodes(row).filter(n => n.type === 'td').map(n => n.props['data-label']), ['Selezione','Data','Operaio','Lavorazione','Ore','Variante','Stato']);
 a.deepEqual(h.calls, ['read']);
});
