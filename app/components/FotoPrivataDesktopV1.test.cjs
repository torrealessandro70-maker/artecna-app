// Componenti reali, hook e trasporto controllati; nessun browser/Storage API reale.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
function harness(){
 const states=[],effects=[],revoked=[];let index=0,pending,listener,cleanup,previous,token='session-token',read=async()=>new Blob(['image'],{type:'image/png'})
 const {ErroreLetturaFotoDesktop}=(()=>{const m={exports:{}};const s=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../engines/rapportini/letturaFotoDesktop.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',s)(()=>({}),m,m.exports);return m.exports})()
 const react={useState:value=>{const i=index++;if(!(i in states))states[i]=value;return[states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v}]},useEffect:(fn,deps)=>{if(!previous||deps.some((d,i)=>d!==previous[i])){previous=deps;pending=fn}}}
 const jsx=(type,props)=>({type,props}),m={exports:{}}
 const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,'FotoPrivataDesktopV1.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 let count=0
 new Function('require','module','exports','URL',js)(id=>id==='react'?react:id==='react/jsx-runtime'?{jsx,jsxs:jsx}:id.includes('supabaseClient')?{supabase:{auth:{getSession:async()=>({data:{session:token?{access_token:token}:null},error:null}),onAuthStateChange:fn=>{listener=fn;return{data:{subscription:{unsubscribe:()=>{listener=null}}}}}}}}:{ErroreLetturaFotoDesktop,leggiBlobFotoDesktop:(...args)=>{count++;return read(...args)}},m,m.exports,{createObjectURL:()=>`blob:local-${count}`,revokeObjectURL:url=>revoked.push(url)})
 const render=()=>{index=0;const tree=m.exports.default({allegato:'a',rapportino:'r',foto:'f'});if(pending){if(cleanup)cleanup();const fn=pending;pending=null;cleanup=fn();effects.push(fn)}return tree}
 return{render,setRead:fn=>{read=fn},event:(event)=>listener(event),logout:()=>{token=null;listener('SIGNED_OUT')},cleanup:()=>cleanup(),revoked,states,effects,ErroreLetturaFotoDesktop,count:()=>count}
}
const flush=()=>new Promise(resolve=>setImmediate(resolve))
function find(tree,predicate){if(!tree)return;if(Array.isArray(tree)){for(const n of tree){const r=find(n,predicate);if(r)return r}}else if(typeof tree==='object'){if(predicate(tree))return tree;return find(tree.props?.children,predicate)}}
test('F4C.2 anteprima: loading, Blob locale, evento iniziale senza loop e cleanup',async()=>{
 const h=harness();assert.equal(h.render().props.role,'status');h.event('INITIAL_SESSION');await flush();const tree=h.render();assert.equal(tree.type,'img');assert.equal(tree.props.src,'blob:local-1');assert.equal(h.count(),1);h.cleanup();assert.deepEqual(h.revoked,['blob:local-1'])
})
test('F4C.2 accesso negato e retry manuale con nuova lettura',async()=>{
 const h=harness();h.setRead(async()=>{throw new h.ErroreLetturaFotoDesktop(403)});h.render();await flush();const tree=h.render();assert.equal(tree.props.role,'alert');assert(find(tree,n=>n.type==='p').props.children.includes('Accesso'))
 h.setRead(async()=>new Blob(['image'],{type:'image/png'}));find(tree,n=>n.type==='button').props.onClick({stopPropagation(){}});h.render();await flush();assert.equal(h.render().type,'img');assert.equal(h.count(),2);h.cleanup()
})
test('F4C.2 logout revoca Blob; risposta ritardata dopo logout non compare',async()=>{
 const h=harness();let release;h.setRead(()=>new Promise(resolve=>{release=resolve}));h.render();await flush();h.logout();h.render();release(new Blob(['late'],{type:'image/png'}));await flush();assert.equal(h.render().props.role,'alert');assert(!h.states[1].url);h.cleanup()
 const done=harness();done.render();await flush();assert.equal(done.render().type,'img');done.logout();assert.deepEqual(done.revoked,['blob:local-1']);assert.equal(done.render().props.role,'status');await flush();assert.equal(done.render().props.role,'alert');done.cleanup()
})
