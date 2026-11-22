/* eslint-disable @typescript-eslint/no-require-imports -- Offline UI state and synthetic records, no service requests. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f)
const {FONTI}=require('../engines/contabilita-ditta/riepilogo.ts')
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const period={da:'2026-01-01',a:'2026-03-31'}
function sources(n=25){const f=Object.fromEntries(FONTI.map(k=>[k,{stato:'pronta',righe:[]}]));f.fatture_emesse.righe=Array.from({length:n},(_,i)=>({id:id(i+1),numero_fattura:'STESSO NUMERO',cliente:'Cliente sintetico',data_fattura:'2026-01-12',totale:'122',importo_incassato:'0'}));return f}
const nodes=x=>Array.isArray(x)?x.flatMap(nodes):x?.props?[x,...nodes(x.props.children)]:[]
const text=x=>Array.isArray(x)?x.map(text).join(''):x?.props?text(x.props.children):typeof x==='string'||typeof x==='number'?String(x):''
const button=(t,label)=>nodes(t).find(n=>n.type==='button'&&text(n)===label)
function harness(){const slots=[];let cursor=0;const area={scrollTop:0};const jsx=(type,props)=>({type,props}),react={useState(v){const i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return[slots[i],x=>slots[i]=typeof x==='function'?x(slots[i]):x]},useMemo(fn){cursor++;return fn()},useRef(v){const i=cursor++;return slots[i]??(slots[i]={current:v})}}
 const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'ContiDaVerificarePanel.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{exports:out,document:{getElementById:()=>area},require:n=>n==='react'?react:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='./VistaOperativa'?{default:'VistaOperativa'}:n.endsWith('.css')?{default:{}}:require(n)})
 return{exports:out,area,render(props){cursor=0;return out.default(props)}}
}
const props=()=>({fonti:sources(),periodo:period,incassi:null})
const openAll=(m,p)=>{const t=m.render(p);button(t,'Vedi tutti i conti da verificare').props.onClick({currentTarget:{}});return m.render(p)}
const list=t=>nodes(t).find(n=>n.type==='VistaOperativa'&&n.props.titolo==='Conti da verificare')
const detail=t=>nodes(t).find(n=>n.type==='VistaOperativa'&&n.props.titolo==='Dettaglio conto da verificare')

test('initial overview is compact, groups counted without duplicated financial KPIs',()=>{const m=harness(),t=m.render(props());assert(!list(t));assert(text(t).includes('Da verificare e sistemare'));assert(!text(t).includes('Saldo fiscale:'));assert(!text(t).includes('Totale incassi verificati'));assert(!text(t).includes('STESSO NUMERO'))})
test('page two opens the exact UUID and return preserves page, group, query and scroll ref',()=>{
 const m=harness(),p=props();let t=openAll(m,p);button(list(t),'Successiva').props.onClick();t=m.render(p);assert(text(list(t)).includes('Pagina 2 di 2'))
 const row=nodes(list(t)).find(n=>n.type==='li'&&button(n,'Apri dettaglio'));assert(text(row).includes(id(21).slice(-8)));m.area.scrollTop=640
 button(row,'Apri dettaglio').props.onClick({currentTarget:{}});t=m.render(p);let d=detail(t);assert.equal(d.props.etichettaRitorno,'Torna ai conti da verificare')
 const sheet=nodes(d).find(n=>n.type===m.exports.SchedaConto);assert.equal(sheet.props.conto.id,id(21));assert.equal(list(t).props.visibile,false)
 d.props.onChiudi();t=m.render(p);assert(!detail(t));assert.equal(list(t).props.scrollRef.current,640);assert(text(list(t)).includes('Pagina 2 di 2'))
 const input=nodes(list(t)).find(n=>n.type==='input');input.props.onChange({target:{value:id(24)}});t=m.render(p);assert(text(list(t)).includes('1 posizioni disponibili'));button(list(t),'Apri dettaglio').props.onClick({currentTarget:{}});detail(m.render(p)).props.onChiudi();t=m.render(p);assert.equal(nodes(list(t)).find(n=>n.type==='input').props.value,id(24))
})
test('updated source replaces the exact sheet; disappeared records never show stale snapshot',()=>{
 const m=harness(),p=props();let t=openAll(m,p);button(list(t),'Apri dettaglio').props.onClick({currentTarget:{}});t=m.render(p)
 p.fonti=sources(1);p.fonti.fatture_emesse.righe[0].cliente='Cliente aggiornato';t=m.render(p);assert.equal(nodes(detail(t)).find(n=>n.type===m.exports.SchedaConto).props.conto.controparte,'Cliente aggiornato')
 p.fonti=sources(0);t=m.render(p);assert(text(detail(t)).includes('Record non più disponibile'));assert(!nodes(detail(t)).some(n=>n.type===m.exports.SchedaConto))
})
test('missing UUID is never rebound to the next record after a source refresh',()=>{
 const m=harness(),p=props();p.fonti=sources(1);p.fonti.fatture_emesse.righe[0].id=undefined;let t=openAll(m,p);button(list(t),'Apri dettaglio').props.onClick({currentTarget:{}})
 p.fonti=sources(1);p.fonti.fatture_emesse.righe[0].id=undefined;t=m.render(p);assert(text(detail(t)).includes('Record non più disponibile'))
})
test('opening and cancelling sheets invoke no correction callback; concurrent correction hides review overlays',()=>{
 const m=harness(),p=props();let calls=0;p.onVerificaAcconto=()=>calls++;let t=openAll(m,p);button(list(t),'Apri dettaglio').props.onClick({currentTarget:{}});p.correzioneAperta=true;t=m.render(p);assert.equal(detail(t).props.visibile,false);assert.equal(list(t).props.visibile,false);assert.equal(calls,0)
})
test('sheet shows exact original ID, missing values and rejects generic register navigation',()=>{
 const m=harness();const c={chiave:'key',fonte:'fatture_emesse',id:id(1),copie:1,controparte:'Fixture',numero:'1',data:'bad',destinazione:'',stato:'',lordo:12200,iva:null,imponibile:null,registrato:null,url:null,problemi:[{ambito:'IVA esclusa dal calcolo',motivo:'XML mancante',verifica:'Verificare XML originale'}]}
 const t=m.exports.SchedaConto({conto:c});assert(text(t).includes(id(1)));assert(text(t).includes('Non valida: bad'));assert(text(t).includes('XML mancante'));assert(text(t).includes('Non determinabile'));assert(!text(t).includes('Apri registro'));assert(!text(t).includes('Cosa fare'))
})
test('acconto correction requires original UUID and actor, runs only after explicit action',()=>{
 const m=harness();let args;const c={chiave:'k',fonte:'incassi_lordi_clienti',id:id(1),copie:1,controparte:'Fixture',numero:'',data:'2026-01-01',destinazione:'',stato:'',lordo:50000,iva:null,imponibile:null,registrato:null,url:null,problemi:[],autore:id(9),movimento:{acconto_id:id(2),metodo:'contanti',fonte:'fixture',imputazione:'contratto',fiscale:{stato:'Da verificare'},quote:[]}}
 let t=m.exports.SchedaConto({conto:c,onVerificaAcconto:(...a)=>{args=a}});assert.equal(args,undefined);button(t,'Apri verifica acconto esistente').props.onClick();assert.deepEqual(args,[id(2),id(9)])
 c.autore=undefined;t=m.exports.SchedaConto({conto:c,onVerificaAcconto(){throw Error('No')}});assert(!text(t).includes('Cosa fare'))
})
test('linked invoice opens only exact loaded UUID and never guesses by number',()=>{
 const m=harness();let target;const c={chiave:'k',fonte:'incassi_lordi_clienti',id:id(1),copie:1,controparte:'',numero:'',data:'',destinazione:'',stato:'',lordo:50000,iva:null,imponibile:null,registrato:null,url:null,problemi:[],movimento:{acconto_id:id(2),fiscale:{stato:'Da verificare'},quote:[{id:id(4),fattura_id:id(5),numero:'STESSO NUMERO',valida:false,revocata:false}]}}
 let t=m.exports.SchedaConto({conto:c,collegataDisponibile:()=>true,onApriCollegata:id=>{target=id}});button(t,'Apri dettaglio fattura collegata').props.onClick({currentTarget:{}});assert.equal(target,id(5))
 t=m.exports.SchedaConto({conto:c,collegataDisponibile:()=>false});assert(text(t).includes('Documento non disponibile nelle letture autorizzate correnti'));assert(!button(t,'Apri dettaglio fattura collegata'))
})
