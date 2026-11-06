/* eslint-disable @typescript-eslint/no-require-imports -- UI isolata, nessuna connessione reale. */
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
const source=fs.readFileSync(path.join(__dirname,'VariantiCantierePanel.tsx'),'utf8')
const compiled=ts.transpileModule(source+'\nexport {DisponibilitaVarianteSal, ApprovazioneVarianteForm}',{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText
const jsx=(type,props)=>({type,props})
const nodes=x=>Array.isArray(x)?x.flatMap(nodes):x?.props?[x,...nodes(x.props.children)]:[]
const text=x=>Array.isArray(x)?x.map(text).join(''):x?.props?text(x.props.children):typeof x==='string'||typeof x==='number'?String(x):''
const tick=()=>new Promise(setImmediate)
function harness(name,props,{pages=[[]],error=null,rpcError=null,currentContract='contract'}={}){
 if(name==='DisponibilitaVarianteSal')props={preventivoId:'contract',...props}
 const slots=[],reads=[],writes=[];let cursor=0,pending=[]
 const react={useState(init){const i=cursor++;if(!(i in slots))slots[i]=init;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef(init){const i=cursor++;return slots[i]??(slots[i]={current:init})},useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((d,j)=>d!==old.deps[j])){slots[i]={deps};pending.push(()=>{old?.cleanup?.();slots[i].cleanup=fn()})}}}
 const db={from(table){const call={table};reads.push(call);const chain={select(v){call.select=v;return chain},eq(k,v){call[k]=v;return chain},in(k,v){call[k]=v;return chain},order(){return chain},maybeSingle(){return Promise.resolve({data:{id:call.id,preventivo_contrattuale_id:currentContract},error})},range(start,end){call.range=[start,end];return Promise.resolve({data:pages[start/200]||[],error})}};return chain},async rpc(name,args){writes.push({name,args});return{data:null,error:rpcError||{code:'P2075'}}}}
 const exports={};vm.runInNewContext(compiled,{exports,require:id=>id==='react'?react:id==='react/jsx-runtime'?{jsx,jsxs:jsx}:id.endsWith('/supabaseClient')?{supabase:db}:{},confirm:()=>true,console})
 const render=()=>{cursor=0;const tree=exports[name](props),effects=pending;pending=[];effects.forEach(fn=>fn());return tree}
 return{render,reads,writes,async settle(){let tree;for(let i=0;i<3;i++){tree=render();await tick()}return tree}}
}
const rows=[{id:232,operazione:'nuova'},{id:'233',operazione:'aumento'},{id:234,operazione:'riduzione_residua'}]
test('storica con positiva mancante: badge esplicito, singola lettura aggregata, zero scritture',async()=>{
 const h=harness('DisponibilitaVarianteSal',{lavorazioni:rows,cantiereId:'site'},{pages:[[{source_variante_lavorazione_id:232}]]})
 a(text(await h.settle()).includes('Approvata — da importare nel SAL'))
 a.equal(h.reads.length,2);a.equal(h.reads[1].table,'cantieri');a.deepEqual(Array.from(h.reads[0].source_variante_lavorazione_id),[232,233]);a.equal(h.reads[0].cantiere_id,'site');a.deepEqual(h.writes,[])
})
test('già importata: nessun falso badge; bigint numero/testo accettati',async()=>{
 const h=harness('DisponibilitaVarianteSal',{lavorazioni:rows,cantiereId:'site'},{pages:[[{source_variante_lavorazione_id:'232'},{source_variante_lavorazione_id:233}]]})
 a.equal(await h.settle(),null);a.deepEqual(h.writes,[])
})
test('contratto storico: non propone un recupero vietato dal contratto corrente',async()=>{
 const h=harness('DisponibilitaVarianteSal',{lavorazioni:rows,cantiereId:'site'},{currentContract:'altro'})
 const t=text(await h.settle());a(t.includes('contratto storico'));a(!t.includes('da importare'));a.deepEqual(h.writes,[])
})
test('sola riduzione: non richiede materializzazione né query aggiuntive',async()=>{
 const h=harness('DisponibilitaVarianteSal',{lavorazioni:[rows[2]],cantiereId:'site'})
 a.equal(await h.settle(),null);a.deepEqual(h.reads,[])
})
test('errore lettura o identità mancante: non inventa uno stato da importare',async()=>{
 for(const options of [{error:{code:'42501'}},{}]){
  const h=harness('DisponibilitaVarianteSal',{lavorazioni:options.error?rows:[{operazione:'nuova'}],cantiereId:'site'},options)
  const t=text(await h.settle());a(t.includes('non verificabile'));a(!t.includes('da importare'));a.deepEqual(h.writes,[])
 }
})
test('anteprima paginata oltre 200: nessuna falsa lavorazione mancante',async()=>{
 const long=Array.from({length:201},(_,i)=>({id:i+1,operazione:'nuova'})),data=long.map(r=>({source_variante_lavorazione_id:r.id}))
 const h=harness('DisponibilitaVarianteSal',{lavorazioni:long,cantiereId:'site'},{pages:[data.slice(0,200),data.slice(200)]})
 a.equal(await h.settle(),null);a.equal(h.reads.length,2)
})
test('approvazione UI chiama solo la RPC atomica e comunica rollback se SAL fallisce',async()=>{
 let approved=false
 const h=harness('ApprovazioneVarianteForm',{variante:{id:'v',numero:5,stato:'proposta'},cantiereId:'site',lavorazioniLette:[{delta_contratto:720}],onApprovata(){approved=true}})
 let tree=await h.settle()
 nodes(tree).find(n=>n.type==='button').props.onClick();tree=h.render()
 nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'Firma fixture'}});tree=h.render()
 await nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
 tree=h.render();a(text(tree).includes('approvazione annullata'));a.equal(approved,false)
 a.deepEqual(JSON.parse(JSON.stringify(h.writes)),[{name:'approva_variante',args:{p_variante_id:'v',p_riferimento_approvazione:'Firma fixture'}}])
})
