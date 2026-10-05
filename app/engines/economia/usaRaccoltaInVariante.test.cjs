const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',V='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',S='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const raccolta={id:A,numero:1,revisione:1,stato:'bozza'}
const result={versione_contratto:1,riutilizzata:false,raccolta_id:A,revisione_sorgente:1,revisione_congelata:2,variante_id:V,variante_sorgente_id:S,numero_variante:null,stato_variante:'bozza',numero_lavorazioni:50,totale:3268.20}
function compile(file,require){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require,console,Error});return exports}
const engine=compile(path.join(__dirname,'usaRaccoltaInVariante.ts'),()=>({}))
const plain=x=>JSON.parse(JSON.stringify(x))
test('RPC ponte: esclusivamente UUID/revisione, risposta autorevole e numero NULL',async()=>{
 const calls=[];const esito=await engine.usaRaccoltaInVariante(async(...args)=>{calls.push(args);return{data:result,error:null}}, {...raccolta,totale:999,righe:[],cantiere_id:V})
 assert.deepEqual(plain(calls),[['usa_raccolta_economia_in_variante',{p_raccolta_id:A,p_revisione_attesa:1}]]);assert.equal(esito.numero_variante,null)
})
test('visibilita: bozza/chiusa valide, revisione e UUID validi obbligatori',()=>{
 assert(engine.raccoltaPonteValida(raccolta));assert(engine.raccoltaPonteValida({...raccolta,stato:'chiusa'}))
 for(const r of [{...raccolta,id:''},{...raccolta,revisione:-1},{...raccolta,revisione:1.5},{...raccolta,stato:'annullata'}])assert(!engine.raccoltaPonteValida(r))
})
for(const code of ['22023','42501','PT409','XX001','P0001'])test('errore sanitizzato '+code,async()=>{
 await assert.rejects(()=>engine.usaRaccoltaInVariante(async()=>({data:null,error:{code,message:'SQL password token'}}),raccolta),e=>e.message===engine.errorePonteEconomia(code)&&!e.message.includes('SQL'))
})
test('risposta incoerente rifiutata senza dettagli driver',async()=>{
 for(const data of [null,{...result,raccolta_id:V},{...result,numero_variante:7},{...result,totale:NaN}])await assert.rejects(()=>engine.usaRaccoltaInVariante(async()=>({data,error:null}),raccolta),e=>e.message===engine.errorePonteEconomia())
})
test('rilettura collegamento via RPC esistenti: solo dettaglio sorgenti Economia',async()=>{
 const calls=[];const id=await engine.leggiVarianteDellaRaccolta(async(name,p)=>{calls.push([name,p]);return{error:null,data:name==='leggi_sorgenti_variante'?[{id:S,variante_id:V,tipo:'raccolta_economia'},{id:A,variante_id:V,tipo:'file'}]:{id:S,variante_id:V,tipo:'raccolta_economia',economia_raccolta_id:A}}},A,[V])
 assert.equal(id,V);assert.equal(calls.length,2);assert.equal(calls[1][0],'leggi_sorgente_variante')
 assert.equal(await engine.leggiVarianteDellaRaccolta(async name=>({error:null,data:name==='leggi_sorgenti_variante'?[{id:S,variante_id:V,tipo:'raccolta_economia'}]:[{id:S,variante_id:V,tipo:'raccolta_economia',economia_raccolta_id:A}]}),A,[V]),V)
})

const flush=()=>new Promise(r=>setImmediate(r))
function harness(transport,{confirm=true,refreshFailure=false}={}){
 const hooks=[],effects=[],calls=[],opened=[],refreshed=[];let index=0
 const react={useState(initial){const i=index++;if(!(i in hooks))hooks[i]=initial;return[hooks[i],v=>hooks[i]=typeof v==='function'?v(hooks[i]):v]},useRef(initial){const i=index++;if(!(i in hooks))hooks[i]={current:initial};return hooks[i]},useEffect(fn,deps){const i=index++;const old=hooks[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){old?.cleanup?.();hooks[i]={deps};effects.push(()=>{hooks[i].cleanup=fn()})}}}
 const jsx=(type,props)=>({type,props}),exports={}
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../components/UsaRaccoltaEconomiaInVariante.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
 vm.runInNewContext(code,{exports,console,Error,window:{confirm:()=>confirm},require:name=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx,Fragment:'fragment'}:name.includes('supabaseClient')?{supabase:{rpc(name,p){calls.push([name,p]);const promise=Promise.resolve().then(()=>transport(name,p));promise.order=()=>promise;promise.range=()=>promise;return promise}}}:engine})
 let props={raccolta,varianti:[],elencoPronto:true,onRileggi:async()=>{refreshed.push(true);if(refreshFailure)throw Error('secret')},onApri:id=>opened.push(id)}
 function nodes(x,out=[]){if(Array.isArray(x))x.forEach(v=>nodes(v,out));else if(x?.props){out.push(x);nodes(x.props.children,out)}return out}
 function render(){index=0;const tree=nodes(exports.default(props));while(effects.length)effects.shift()();return tree}
 function text(){return render().flatMap(x=>Array.isArray(x.props.children)?x.props.children.filter(v=>typeof v==='string'):typeof x.props.children==='string'?[x.props.children]:[]).join(' ')}
 const button=label=>render().find(x=>x.type==='button'&&x.props.children===label)
 async function ready(){render();await flush();render()}
 return{calls,opened,refreshed,text,button,ready,render,setProps:p=>props={...props,...p},unmount:()=>hooks.forEach(h=>h?.cleanup?.())}
}
test('UI: conferma annullata non invoca writer',async()=>{
 const h=harness(()=>({data:result,error:null}),{confirm:false});await h.ready();h.button('Usa in Variante').props.onClick();await flush();assert.equal(h.calls.length,0)
})
test('UI: doppio submit bloccato, nuova Variante, refresh/apertura e numero NULL',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r)
 const h=harness(()=>pending);await h.ready();const click=h.button('Usa in Variante').props.onClick;click();click();await flush()
 assert.equal(h.calls.length,1);assert(h.button('Creazione Variante...').props.disabled)
 resolve({data:result,error:null});await flush();assert.deepEqual(h.opened,[V]);assert.equal(h.refreshed.length,1)
 assert(h.text().includes('Variante creata dai lavori in economia.'));assert(!h.text().includes('n. null'));assert(h.button('Apri variante'));assert(!h.button('Usa in Variante'))
})
test('UI: riutilizzata conserva numero/stato correnti e riapre',async()=>{
 const h=harness(()=>({error:null,data:{...result,riutilizzata:true,numero_variante:3,stato_variante:'approvata'}}));await h.ready();h.button('Usa in Variante').props.onClick();await flush()
 assert(h.text().includes('Variante già creata. È stata riaperta.'));assert(h.text().includes('Variante n. 3'));assert.deepEqual(h.opened,[V])
})
for(const code of ['PT409','22023','42501','XX001','P0001'])test('UI: '+code+' sanitizzato e refresh solo sul conflitto',async()=>{
 const h=harness(()=>({data:null,error:{code,message:'SQL segreto'}}));await h.ready();h.button('Usa in Variante').props.onClick();await flush()
 assert(h.text().includes(engine.errorePonteEconomia(code)));assert(!h.text().includes('segreto'));assert.equal(h.opened.length,0);assert.equal(h.refreshed.length,code==='PT409'?1:0)
})
test('UI: trasporto sanitizzato e successo non annullato da errore rilettura',async()=>{
 const h=harness(()=>{throw Error('URL password SQL')});await h.ready();h.button('Usa in Variante').props.onClick();await flush();assert(h.text().includes(engine.errorePonteEconomia()));assert(!h.text().includes('password'))
 const saved=harness(()=>({data:result,error:null}),{refreshFailure:true});await saved.ready();saved.button('Usa in Variante').props.onClick();await flush();assert(saved.button('Apri variante'));assert(!saved.button('Usa in Variante'))
})
test('UI: acquisita dopo reload mostra Apri, lettura fallita blocca creazione',async()=>{
 const h=harness(name=>({error:null,data:name==='leggi_sorgenti_variante'?[{id:S,variante_id:V,tipo:'raccolta_economia'}]:{id:S,variante_id:V,tipo:'raccolta_economia',economia_raccolta_id:A}}))
 h.setProps({varianti:[V]});await h.ready();assert(h.button('Apri variante'));assert(!h.button('Usa in Variante'));h.button('Apri variante').props.onClick();assert.deepEqual(h.opened,[V])
 const broken=harness(()=>({data:null,error:{code:'42501'}}));broken.setProps({varianti:[V]});await broken.ready();assert(!broken.button('Usa in Variante'));assert(broken.button('Riprova collegamento'))
})
test('UI: risposta tardiva dopo uscita ignorata',async()=>{
 let resolve;const h=harness(()=>new Promise(r=>resolve=r));await h.ready();h.button('Usa in Variante').props.onClick();await flush();h.unmount();resolve({data:result,error:null});await flush();assert.equal(h.opened.length,0);assert.equal(h.refreshed.length,0)
})
test('integrazione additiva: refresh raccolte/Varianti, apertura e percorsi storici preservati',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../../components/VariantiCantierePanel.tsx'),'utf8')
 assert(source.includes('await apri(dettaglio.raccolta.id, true)'));assert(source.includes('setRilettura(v => v + 1)'));assert(source.includes('onApriVarianteEconomia={apriVarianteEconomia}'));assert(source.includes('aggiornaVariante(varianteId)'));assert(source.includes('setVarianteApertaId(aperturaEconomia.current)'))
 assert(source.includes('confermaImportazione()'));assert(source.includes("supabase.rpc('crea_raccolta_economia'"));assert(source.includes("supabase.rpc('crea_bozza_variante'"))
 const helper=fs.readFileSync(path.join(__dirname,'usaRaccoltaInVariante.ts'),'utf8');assert(!helper.includes('proponi_variante'));assert(!helper.includes('approva_variante'));assert(!helper.includes('/api/rapportino'))
})
