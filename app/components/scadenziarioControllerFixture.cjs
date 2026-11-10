/* eslint-disable @typescript-eslint/no-require-imports -- Shared offline React controller harness, injected archive only. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function controller(archivio) {
  const slots = [], effects = []; let cursor = 0
  const memo = (fn, deps) => { const i = cursor++; const old = slots[i]; if (!old || deps.some((d, j) => d !== old.deps[j])) slots[i] = { deps, value: fn() }; return slots[i].value }
  const react = {
    useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v }] },
    useRef(value) { const i = cursor++; return slots[i] ?? (slots[i] = { current: value }) }, useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps),
    useEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((d, j) => d !== old.deps[j])) { effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() } }) } },
  }
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, 'ScadenziarioPersistentePanel.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, Error, require(name) {
    if (name === 'react') return react
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) }
    if (name === './ScadenziarioFiscalePanel') return { default: 'Panel' }
    if (name.endsWith('/scadenziarioPersistenza')) return { creaArchivioScadenziario() { throw Error('Real client forbidden') } }
    throw Error(name)
  } })
  const props = { archivioTest: archivio }
  const m = { props, render() { cursor = 0; return exports.default(props).props.persistenza }, async flush() { for (const effect of effects.splice(0)) effect(); await new Promise(resolve => setImmediate(resolve)); return m.render() }, unmount() { for (const slot of slots) slot?.cleanup?.() } }
  m.render(); return m
}

module.exports={controller};
