/* eslint-disable @typescript-eslint/no-require-imports -- Offline component harness; database operations are mocked. */
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const { execFileSync } = require('node:child_process')
const file = path.join(__dirname, 'ListinoArtecnaPanel.tsx'), root = path.resolve(__dirname, '../..')
const nodes = x => x == null ? [] : Array.isArray(x) ? x.flatMap(nodes) : typeof x === 'object' ? [x, ...nodes(x.props?.children)] : []
const text = x => x == null ? '' : Array.isArray(x) ? x.map(text).join('') : typeof x === 'object' ? text(x.props?.children) : String(x)
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' }
const tick = () => new Promise(resolve => setImmediate(resolve))
function hooks() {
  const slots = []; let cursor = 0, pending = []
  return { begin() { cursor = 0 }, flush() { const effects = pending; pending = []; effects.forEach(f => f()) }, api: {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }] },
    useRef(init) { const i = cursor++; return slots[i] ?? (slots[i] = { current: init }) },
    useEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v, n) => !Object.is(v, old[n]))) { slots[i] = deps; pending.push(fn) } },
  } }
}
function load(f, h, cache = new Map()) {
  if (cache.has(f)) return cache.get(f)
  const ex = {}; cache.set(f, ex)
  const localRequire = id => {
    if (id === 'react') return h.api
    if (id === 'react/jsx-runtime') return jsx
    if (!id.startsWith('.')) return require(id)
    const target = path.resolve(path.dirname(f), id)
    return load([target + '.ts', target + '.tsx', path.join(target, 'index.ts')].find(fs.existsSync), h, cache)
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { exports: ex, require: localRequire, window: { confirm() { throw Error('No destructive actions') } } })
  return ex
}

const fixture = Array.from({length:5},(_,i)=>({id:'row-'+i,codice:'ART_'+(i+1),
  descrizione:('Lavorazione ARTECNA '+(i+1)+'. ')+('Descrizione completa con oneri, inclusioni ed esclusioni. ').repeat(22),
  unita_misura:'m²',prezzo_unitario:42.5+i,incidenza_manodopera:30,prezzo_manodopera:12.75,
  categoria:'Finiture',zona:'Catania',regione:'Sicilia',updated_at:'2026-11-03T10:00:00Z',tipo_prezzo:'artecna',fonte:'ARTECNA',versione:'manuale'}))
function mount(data=fixture){
  const operations=[], h=hooks(); let saved=0
  const db={from(table){const q={};for(const op of ['select','eq','order','range'])q[op]=(...args)=>{operations.push({table,op,args});return q}
    q.then=cb=>Promise.resolve({error:null,data}).then(cb)
    for(const op of ['insert','update','delete','upsert'])q[op]=()=>{throw Error('Unexpected write '+op)}
    return q}}
  const C=load(file,h).default
  const render=()=>{h.begin();const tree=C({supabase:db,onSaved:async()=>{saved++}});h.flush();return tree}
  const settle=async()=>{let tree;for(let i=0;i<4;i++){tree=render();await tick()}return tree}
  return {settle,operations,saved:()=>saved}
}
const cards=tree=>nodes(tree).filter(n=>n.type==='article')
const button=(tree,label)=>{const b=nodes(tree).find(n=>n.type==='button'&&(text(n)===label||n.props['aria-label']===label));assert(b,label);return b}

test('cinque card con descrizioni lunghe complete, metadati e valori originali',async()=>{
 const original=JSON.stringify(fixture),m=mount(),tree=await m.settle();assert.equal(cards(tree).length,5)
 for(const [i,c] of cards(tree).entries()){
  assert.equal(c.props['aria-label'],'Voce ARTECNA '+fixture[i].codice)
  assert(c.props.style.border);assert(c.props.style.padding>0);assert(c.props.style.marginBottom>0)
  const header=nodes(c).find(n=>n.type==='header'),dl=nodes(c).find(n=>n.type==='dl')
  assert(text(header).includes(fixture[i].codice));assert(!text(header).includes(fixture[i].descrizione))
  const desc=c.props.children.at(-1);assert.equal(text(desc),fixture[i].descrizione);assert.equal(desc.props.style.whiteSpace,'pre-wrap');assert(desc.props.style.borderTop)
  for(const label of ['U.M.','Prezzo unitario','% Manodopera','Manodopera €/U.M.','Categoria','Zona','Regione','Aggiornato il'])assert(text(dl).includes(label),label)
  assert(text(dl).includes('Catania'));assert(text(dl).includes('Sicilia'));assert(text(dl).includes((42.5+i).toLocaleString('it-IT',{style:'currency',currency:'EUR'})))
  assert.equal(nodes(dl).filter(n=>n.type==='dd'&&n.props.style.fontVariantNumeric==='tabular-nums').length,3)
  assert.equal(button(c,'Modifica').props.disabled,false);assert.equal(button(c,'Elimina').props.disabled,false)
 }
 assert.equal(JSON.stringify(fixture),original);assert.equal(m.saved(),0)
 assert(m.operations.some(o=>o.op==='eq'&&o.args[0]==='tipo_prezzo'&&o.args[1]==='artecna'))
})
test('ogni Modifica apre la propria voce, Annulla chiude senza scritture',async()=>{
 const m=mount();let tree=await m.settle()
 for(let i=0;i<5;i++){
  button(cards(tree)[i],'Modifica').props.onClick();tree=await m.settle()
  const form=nodes(tree).find(n=>n.type==='form');assert(form)
  const inputs=nodes(form).filter(n=>n.type==='input'||n.type==='textarea')
  assert(inputs.some(n=>n.props.value===fixture[i].codice));assert(inputs.some(n=>n.props.value===fixture[i].descrizione))
  assert(inputs.some(n=>n.props.value===String(fixture[i].prezzo_unitario)))
  button(tree,'Annulla').props.onClick();tree=await m.settle();assert(!nodes(tree).some(n=>n.type==='form'))
 }
 assert.equal(m.saved(),0)
})
test('ricerca e navigazione mantengono evidenziazione e associazione della card attiva',async()=>{
 const m=mount();let tree=await m.settle()
 const search=value=>nodes(tree).find(n=>n.props['aria-label']==='Ricerca listino ARTECNA').props.onChange({target:{value}})
 search('ART_3');tree=await m.settle();assert.equal(cards(tree).length,1);assert(text(cards(tree)[0]).includes('ART_3'));assert(nodes(cards(tree)[0]).some(n=>n.type==='mark'))
 search('lavorazione');tree=await m.settle();assert.equal(cards(tree).length,5)
 button(tree,'Risultato successivo').props.onClick();tree=await m.settle();assert.equal(cards(tree)[1].props.style.background,'#eff6ff')
 button(tree,'Risultato precedente').props.onClick();tree=await m.settle();assert.equal(cards(tree)[0].props.style.background,'#eff6ff')
 search('inesistente');tree=await m.settle();assert.equal(cards(tree).length,0);assert(text(tree).includes('Nessuna voce trovata.'))
})
test('azioni Elimina restano associate al proprio ID e richiedono conferma prima di qualunque scrittura',async()=>{
 const m=mount(),tree=await m.settle()
 for(const c of cards(tree))await assert.rejects(button(c,'Elimina').props.onClick(),/No destructive actions/)
 assert.equal(m.saved(),0)
})
test('reader, ricerca, handler, form e importazione sono identici al parent; nessuna modifica prezzi',()=>{
 const base='c831e0c4b75c3f4dbae1372603cee3f50bd87366'
 const previous=execFileSync('git',['show',base+':app/components/ListinoArtecnaPanel.tsx'],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n')
 const current=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')
 assert.equal(current.slice(0,current.indexOf('  return <section')),previous.slice(0,previous.indexOf('  return <section')).replace('HTMLTableRowElement','HTMLElement'))
 assert.equal(current.slice(current.indexOf('    {proposte &&')),previous.slice(previous.indexOf('    {proposte &&')))
 const handlers=source=>{const ast=ts.createSourceFile('ui.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),result=[];function visit(n){if(ts.isJsxAttribute(n)&&/^on[A-Z]/.test(n.name.text))result.push(n.getText(ast).replace(/\s+/g,' '));ts.forEachChild(n,visit)}visit(ast);return result.sort()}
 assert.deepEqual(handlers(current),handlers(previous))
 for(const f of ['app/utils/ricercaPrezzari.ts','app/engines/price-import/listino-manuale.ts','app/components/PrezzarioSic24Panel.tsx'])assert.equal(fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show',base+':'+f],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n'))
})
