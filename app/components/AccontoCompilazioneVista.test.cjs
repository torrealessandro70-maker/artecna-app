/* eslint-disable @typescript-eslint/no-require-imports -- Offline UI integration with in-memory authorized readers. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const compile=f=>ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const jsx=(type,props)=>({type,props});const nodes=x=>Array.isArray(x)?x.flatMap(nodes):x?.props?[x,...nodes(x.props.children)]:[];
const text=x=>Array.isArray(x)?x.map(text).join(''):x?.props?text(x.props.children):typeof x==='string'?x:'';
const storage=new Map();const sessionStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const engine={};vm.runInNewContext(compile('app/engines/economia/compilazioneAcconto.ts'),{exports:engine});
let ids=0;const crypto={randomUUID:()=>`00000000-0000-4000-8000-${String(++ids).padStart(12,'0')}`};
const tick=()=>new Promise(r=>setImmediate(r));
function mount(file,props,db){
 let cursor=0;const slots=[],effects=[];const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef(initial){const i=cursor++;return slots[i]??=( {current:initial})},useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((d,j)=>d!==slots[i][j])){slots[i]=deps;effects.push(fn)}}};
 const exports={};vm.runInNewContext(compile(file),{exports,require:n=>n==='react'?react:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='../../lib/supabaseClient'?{supabase:db}:n==='../engines/economia/compilazioneAcconto'?engine:{default:n},sessionStorage,crypto,console});
 const render=()=>{cursor=0;return exports.default(props)};const flush=async()=>{while(effects.length)effects.shift()();await tick();return render()};return{render,flush};
}
const file='app/components/AccontoCompilazioneVista.tsx';
function fake(record=null,documented=false){
 const calls=[];let current=record,fail=false;
 const db={calls,fail:()=>fail=true,rpc:async(name,args)=>{calls.push({name,args});if(name==='leggi_acconto_compilazione')return{data:{documentato:documented,acconto:current},error:null};if(name==='leggi_acconto_fiscale')return{data:{revisione:documented?1:0},error:null};if(name==='leggi_incassi_lordi_cliente')return{data:{incassi:documented?[{}]:[],imputazioni:[],quote:[]},error:null};
 current={...current,id:args.p_id,cantiere_id:args.p_cantiere,...args.p_modifiche,compilazione_unica:{richiesta:args.p_richiesta,proposta:args.p_proposta,fonte:[args.p_modifiche.importo??current?.importo,args.p_modifiche.data_incasso??current?.data_incasso,args.p_modifiche.metodo??current?.metodo]}};
 if(fail){fail=false;throw Error('Network lost after commit')};return{data:current,error:null}},from:()=>({select(){return this},eq(){return this},single:async()=>({data:current,error:null})})};return db;
}
const field=(tree,label)=>{const node=nodes(tree).find(n=>n.type==='label'&&text(n).startsWith(label));assert(node,label);return nodes(node.props.children).find(n=>['input','textarea','select'].includes(n.type))};
test('apertura e annullamento: nessuna scrittura, un solo focus operativo',()=>{
 storage.clear();const db=fake();let closed=0;const m=mount(file,{cantiereId:'site',onChiudi:()=>closed++,onPersistito:async()=>{}},db);
 const t=m.render();nodes(t).find(n=>n.type==='button'&&text(n)==='Annulla').props.onClick();assert.equal(closed,1);assert.equal(db.calls.length,0);assert.equal(t.props.titolo,'Registra acconto');
});
test('modifica note precompilata su UUID persistito: patch singola, zero conferme automatiche',async()=>{
 storage.clear();const a={id:'original',cantiere_id:'site',descrizione:'Persistita',importo:100,data_incasso:'2026-01-01',metodo:'bonifico',nota:'Prima'};
 const db=fake(a,true),m=mount(file,{id:a.id,onChiudi(){},onPersistito:async()=>{}},db);m.render();let t=await m.flush();await tick();t=m.render();
 assert.equal(field(t,'Descrizione').props.value,'Persistita');assert.equal(field(t,'Imponibile').props.disabled,true);
 field(t,'Note').props.onChange({target:{value:'Dopo'}});t=m.render();await nodes(t).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
 const writes=db.calls.filter(c=>c.name==='salva_acconto_compilazione');assert.equal(writes.length,1);assert.equal(writes[0].args.p_id,a.id);assert.deepEqual(Object.keys(writes[0].args.p_modifiche),['nota']);assert.equal(writes[0].args.p_modifiche.nota,'Dopo');
 assert(!db.calls.some(c=>c.name.startsWith('registra_')||c.name.startsWith('conferma_')));
});
test('lordo 5000 IVA 10 precompila netto; perdita risposta e riapertura recuperano stessa richiesta',async()=>{
 storage.clear();const db=fake();db.fail();const props={cantiereId:'site',onChiudi(){},onPersistito:async()=>{}};let m=mount(file,props,db),t=m.render();
 field(t,'Importo inserito').props.onChange({target:{value:'lordo'}});t=m.render();field(t,'Importo lordo').props.onChange({target:{value:'5000'}});field(t,'Aliquota IVA').props.onChange({target:{value:'10'}});t=m.render();
 await nodes(t).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(db.calls[0].args.p_modifiche.importo,4545.45);const first=db.calls[0].args;
 m=mount(file,props,db);t=m.render();assert.equal(field(t,'Importo lordo').props.value,'5000');await nodes(t).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
 const writes=db.calls.filter(c=>c.name==='salva_acconto_compilazione');assert.equal(writes.length,2);assert.equal(writes[1].args.p_id,first.p_id);assert.equal(writes[1].args.p_richiesta,first.p_richiesta);assert.equal(storage.size,0);
});
test('stato fiscale propone la data e il motivo ma non conferma un incasso',async()=>{
 const db={rpc:async()=>({data:{revisione:0,stato:'Da verificare'},error:null})};const m=mount('app/components/ContrattoFiscalePanel.tsx',{id:'original',acconto:true,dataIncasso:'2026-01-01',descrizione:'Motivo persistito',proposta:{lordo:122,aliquota:22}},db);
 let t=m.render();t.props.onToggle({currentTarget:{open:true}});await tick();t=m.render();assert.equal(field(t,'Data fiscale').props.defaultValue,'2026-01-01');assert.equal(field(t,'Motivo').props.defaultValue,'Motivo persistito');assert.equal(field(t,'Incasso').props.defaultValue,'da_verificare');assert(nodes(t).some(n=>n.type==='input'&&n.props.type==='checkbox'&&n.props.required));
});
function readerFinanziario(incassi=[],contratto=true){
 const a={id:'original',cantiere_id:'site',importo:100,data_incasso:'2026-01-01',metodo:'Bonifico',descrizione:'Descrizione persistita',compilazione_unica:{richiesta:'r',proposta:{lordo:122,aliquota:22},fonte:[100,'2026-01-01','Bonifico']}};
 const calls=[];return{calls,rpc:async(name)=>{calls.push(name);return{data:name==='leggi_rettifiche_incasso_lordo_cliente'?[]:{totale:null,attribuito:null,residuo:null,incassi,quote:[],imputazioni:[],imputazione_effettiva:'da_verificare'},error:null}},from:table=>({select(){return this},eq(){return this},single:async()=>table==='acconti_cantiere'?{data:a,error:null}:table==='cantieri'?{data:{id:'site',preventivo_contrattuale_id:contratto?'contract':null},error:null}:{data:{id:'contract',cantiere_id:'site',natura:'principale'},error:null}})};
}
test('incasso lordo propone dati persistiti, contratto verificato e motivo; non inventa fonte o CRO',async()=>{
 storage.clear();const db=readerFinanziario();const m=mount('app/components/IncassiLordiPanel.tsx',{id:'original',contesto:'acconto',netto:100},db);let t=m.render();const current={open:true};t.props.onToggle({target:current,currentTarget:current});await tick();t=m.render();
 assert.equal(field(t,'Importo lordo').props.defaultValue,122);assert.equal(field(t,'Data effettiva').props.defaultValue,'2026-01-01');assert.equal(field(t,'Metodo').props.defaultValue,'bonifico');assert.equal(field(t,'Imputazione').props.defaultValue,'contratto');assert.equal(field(t,'Motivo della scelta').props.defaultValue,'Descrizione persistita');
 assert.equal(field(t,'Riferimento univoco').props.defaultValue,undefined);assert.equal(field(t,'Fonte della verifica').props.defaultValue,undefined);assert(!db.calls.some(n=>n.startsWith('conferma_')||n.startsWith('imputa_')));
});
test('pagamento documentato si riapre in lettura, non con una nuova conferma duplicata',async()=>{
 storage.clear();const db=readerFinanziario([{id:'payment',importo:122,disponibile:122,ricevuto_il:'2026-01-01',metodo:'bonifico',riferimento:'REFERENCE_SYNTHETIC'}]);
 const m=mount('app/components/IncassiLordiPanel.tsx',{id:'original',contesto:'acconto',netto:100},db);let t=m.render();const current={open:true};t.props.onToggle({target:current,currentTarget:current});await tick();t=m.render();
 assert(!nodes(t).some(n=>n.type==='button'&&text(n)==='Conferma pagamento lordo'));assert(text(t).includes('REFERENCE_SYNTHETIC'));assert(nodes(t).some(n=>n.type==='button'&&text(n)==='Registra un pagamento distinto'));
});
