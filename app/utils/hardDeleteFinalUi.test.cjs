/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {renderToStaticMarkup}=require('react-dom/server');
const page=fs.readFileSync('app/page.tsx','utf8'),ast=ts.createSourceFile('page.tsx',page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const id='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function declaration(name){let result;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)result=n.getText(ast);ts.forEachChild(n,visit);}visit(ast);assert(result,name);return 'const '+result;}
function mount({text='ELIMINA',error=null,wait}={}){
 const source=declaration('eseguiEliminazioneCantiere'),trace=[],state={cantieri:[{id},{id:other}]},context={};
 for(const match of source.matchAll(/\b[A-Za-z_$][\w$]*\b/g))context[match[0]]=null;
 Object.assign(context,{console:{error:()=>{}},Array,Promise,String,Object,Error,Set,eliminazioneCantiere:{id,nome:'Omonimo',fase:2},testoConfermaCantiere:text,invioEliminazioneCantiere:{current:false},cantieriEliminatiRef:{current:new Set()},dialogEliminazioneCantiere:{current:{close:()=>trace.push('close')}},contestoEliminazioneSal:{current:{cantiereIdScheda:id}},analisiPreventivoRef:{current:null},fotoCantiere:[],preventivi:[],materialiCantiere:[],attrezziCantiere:[],supabase:{rpc:async(name,args)=>{trace.push(['rpc',name,args]);if(wait)await wait;return {data:error?null:[{cantiere_id:id,eliminato:true}],error};}}});
 for(const name of new Set([...source.matchAll(/\b(set[A-Z]\w+|carica[A-Z]\w+)\b/g)].map(m=>m[0])))context[name]=async(value)=>{trace.push([name,typeof value==='function'?'update':value]);if(name==='setCantieri')state.cantieri=typeof value==='function'?value(state.cantieri):value;};
 context.globalThis=context;vm.runInNewContext(compile(source+';globalThis.action=eseguiEliminazioneCantiere'),context);
 return {context,trace,state,run:()=>context.action()};
}
test('ELIMINA esatto: singola RPC, chiusura, esclusione UUID, refresh e risultato',async()=>{const m=mount();await m.run();assert.equal(m.trace.filter(x=>x[0]==='rpc').length,1);assert(m.trace.includes('close'));assert.deepEqual(m.state.cantieri,[{id:other}]);assert(m.trace.some(x=>x[0]==='caricaCantieri'));assert(m.trace.some(x=>x[0]==='setEsitoEliminazioneCantiere'&&x[1].includes('Elenco aggiornato')));});
test('testo diverso, inclusi spazi/case: nessuna RPC',async()=>{for(const text of ['', 'elimina',' ELIMINA','ELIMINA ']){const m=mount({text});await m.run();assert.equal(m.trace.length,0);}});
test('doppio click concorrente: una sola richiesta distruttiva',async()=>{let release;const wait=new Promise(r=>release=r),m=mount({wait});const first=m.run();await m.run();release();await first;assert.equal(m.trace.filter(x=>x[0]==='rpc').length,1);});
test('errore RPC: dialog aperto, elenco preservato, errore visibile, nessun retry',async()=>{const m=mount({error:{message:'Operazione annullata',code:'P2114'}});await m.run();await new Promise(r=>setImmediate(r));assert.equal(m.trace.filter(x=>x[0]==='rpc').length,1);assert(!m.trace.includes('close'));assert.equal(m.state.cantieri.length,2);assert(m.trace.some(x=>x[0]==='setErroreEliminazioneCantiere'&&x[1].includes('Operazione annullata')));assert(!m.trace.some(x=>x[0]==='caricaCantieri'));});
test('render finestra: pulsante distruttivo disabilitato fino a ELIMINA esatto',()=>{
 const start=page.indexOf('<dialog ref={dialogEliminazioneCantiere}'),end=page.indexOf('</dialog>',start)+9,jsx=page.slice(start,end);assert(start>0);
 for(const text of ['', 'elimina','ELIMINA ','ELIMINA']){const context={exports:{},require,eliminazioneCantiere:{nome:'Fixture',fase:2},testoConfermaCantiere:text,eliminazioneCantiereInCorso:false,erroreEliminazioneCantiere:'',buttonSecondary:{},inputStyle:{},dialogEliminazioneCantiere:null,inputConfermaCantiere:null,chiudiEliminazioneCantiere:()=>{},eseguiEliminazioneCantiere:()=>{},setTestoConfermaCantiere:()=>{}};context.globalThis=context;vm.runInNewContext(compile('globalThis.view=('+jsx+')'),context);const html=renderToStaticMarkup(context.view);const button=html.match(/<button[^>]*>Elimina definitivamente<\/button>/)[0];assert.equal(button.includes('disabled'),text!=='ELIMINA');}
});
