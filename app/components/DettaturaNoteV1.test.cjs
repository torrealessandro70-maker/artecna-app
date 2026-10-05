const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
const source=fs.readFileSync(__dirname+'/DettaturaNoteV1.tsx','utf8')
const jsx=(type,props)=>({type,props}),nodes=(n,r=[])=>{if(Array.isArray(n))n.forEach(x=>nodes(x,r));else if(n&&n.props){r.push(n);nodes(n.props.children,r)}return r}
function harness(mode='standard',initial=''){
 const hooks=[],effects=[],instances=[],changes=[];let index=0,props={testo:initial,contesto:'cantiere/data',disabled:false,onTesto:t=>{changes.push(t);props.testo=t}}
 class Speech {constructor(){instances.push(this)}start(){this.started=true}stop(){this.stopped=true}abort(){this.aborted=true}}
 const react={useState(v){const i=index++;if(!(i in hooks))hooks[i]=v;return[hooks[i],v=>hooks[i]=v]},useRef(v){const i=index++;if(!(i in hooks))hooks[i]={current:v};return hooks[i]},useEffect(fn,deps){const i=index++,prev=hooks[i];if(!prev||deps.some((v,j)=>v!==prev.deps[j]))effects.push(()=>{prev?.cleanup?.();hooks[i]={deps,cleanup:fn()}})}}
 const exports={},window=mode==='none'?{}:mode==='prefixed'?{webkitSpeechRecognition:Speech}:{SpeechRecognition:Speech}
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,window,require:n=>n==='react'?react:{jsx,jsxs:jsx}})
 const render=()=>{index=0;let tree=exports.default(props);effects.splice(0).forEach(f=>f());index=0;tree=exports.default(props);return nodes(tree)}
 return{render,instances,changes,props,button:()=>render().find(n=>n.type==='button'),unmount:()=>hooks.forEach(h=>h?.cleanup?.()),result:(texts,final=true)=>instances.at(-1).onresult?.({results:texts.map(transcript=>({isFinal:final,0:{transcript}}))})}
}
test('M1: browser standard/prefixed, italiano, avvio e doppio avvio impedito',()=>{for(const mode of ['standard','prefixed']){const h=harness(mode),button=h.button();button.props.onClick();button.props.onClick();assert.equal(h.instances.length,1);assert.equal(h.instances[0].started,true);assert.equal(h.instances[0].lang,'it-IT');assert.equal(h.instances[0].interimResults,false);assert.ok(h.render().some(n=>n.props.children==='Sto ascoltando...'))}})
test('M1: non supportato non provoca crash e spiega disponibilità',()=>{const h=harness('none');assert.equal(h.button().props.disabled,true);assert.ok(h.render().some(n=>n.props.children==='Dettatura non disponibile su questo dispositivo/browser.'))})
test('M1: stop attende risultato finale ed end riabilita avvio',()=>{const h=harness();h.button().props.onClick();h.button().props.onClick();assert.equal(h.instances[0].stopped,true);assert.equal(h.button().props.disabled,true);h.result(['Fine lavori']);h.instances[0].onend();assert.equal(h.props.testo,'Fine lavori');assert.equal(h.button().props.disabled,false)})
test('M1: testo esistente preservato, risultati cumulativi non duplicati',()=>{const h=harness('standard','Lavori precedenti');h.button().props.onClick();h.result(['prima frase']);h.result(['prima frase','seconda frase']);h.result(['prima frase','seconda frase']);assert.deepEqual(h.changes,['Lavori precedenti prima frase','Lavori precedenti prima frase seconda frase'])})
test('M1: spazi/newline esistenti preservati e frase vuota ignorata',()=>{const h=harness('standard','Note\n');h.button().props.onClick();h.result(['  ',' nuova frase ']);assert.equal(h.props.testo,'Note\nnuova frase')})
test('M1: risultato intermedio non inserito, finale inserito',()=>{const h=harness();h.button().props.onClick();h.result(['parziale'],false);assert.equal(h.changes.length,0);h.result(['completo']);assert.equal(h.props.testo,'completo')})
test('M1: modifica da tastiera durante ascolto resta nel testo',()=>{const h=harness();h.button().props.onClick();h.props.testo='Modifica manuale';h.render();h.result(['dettatura']);assert.equal(h.props.testo,'Modifica manuale dettatura')})
test('M1: errore sanitizzato, callback tardiva ignorata, riprova disponibile',()=>{const h=harness();h.button().props.onClick();const late=h.instances[0].onresult;h.instances[0].onerror();late({results:[{isFinal:true,0:{transcript:'obsoleto'}}]});assert.equal(h.changes.length,0);assert.equal(h.instances[0].aborted,true);assert.ok(h.render().some(n=>n.props.role==='alert'));h.button().props.onClick();assert.equal(h.instances.length,2)})
test('M1: end inatteso non riavvia automaticamente',()=>{const h=harness();h.button().props.onClick();h.instances[0].onend();assert.equal(h.instances.length,1);assert.equal(h.button().props.disabled,false)})
test('M1: unmount chiusura interrompe e ignora callback obsolete',()=>{const h=harness();h.button().props.onClick();const late=h.instances[0].onresult;h.unmount();late({results:[{isFinal:true,0:{transcript:'obsoleto'}}]});assert.equal(h.instances[0].aborted,true);assert.equal(h.changes.length,0)})
test('M1: cambio contesto o salvataggio disabilitato interrompe ascolto',()=>{for(const update of [{contesto:'altra/data'},{disabled:true}]){const h=harness();h.button().props.onClick();Object.assign(h.props,update);h.render();assert.equal(h.instances[0].aborted,true);assert.equal(h.changes.length,0)}})
test('M1: editor usa stessa callback textarea, solo note; niente audio/file o persistenza',()=>{
 const editor=fs.readFileSync(__dirname+'/RapportinoPrestazioniEditorV1.tsx','utf8')
 assert.match(editor,/onTesto=\{testo => documento\('note', testo\)\}/);assert.match(editor,/onChange=\{e => documento\('note', e.target.value\)\}/)
 assert.doesNotMatch(source,/MediaRecorder|Blob|createObjectURL|fetch\(|localStorage|sessionStorage|console\./)
 assert.match(editor,/<textarea disabled=\{disabled\} rows=\{4\}/)
})
