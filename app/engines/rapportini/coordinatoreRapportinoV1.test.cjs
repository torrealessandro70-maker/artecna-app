const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',W='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',R='dddddddd-dddd-4ddd-8ddd-dddddddddddd',P='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const D='2026-09-30',plain=x=>JSON.parse(JSON.stringify(x)),flush=()=>new Promise(r=>setImmediate(r))
const dettagli={versione_contratto:1,rapportino_id:R,cantiere_id:A,data:D,revisione:1,documento:{note:'Lavori',materiali:'Materiali',quantita_materiali:'2'},prestazioni:[{prestazione_id:P,chiave_client:'prima',operaio_id:W,operaio_nome:'Mario',ora_inizio:'07:00',ora_fine:'12:00',pausa_minuti:0,ore:5,revisione:1,lavoro_in_economia:false,variante_id:null,rimossa_at:null}]}
const stato=()=>new Response(JSON.stringify({presente:true,versione_prestazioni:1,data:D,rapportino:{id:R,data:D},timbrature:[],strutturato:dettagli}))
function harness(trasporto){
 const hooks=[];let index=0,uuid=0,aperto=false,errore='',messaggio=''
 const react={useState(initial){const i=index++;if(!(i in hooks))hooks[i]=initial;return[hooks[i],v=>hooks[i]=typeof v==='function'?v(hooks[i]):v]},useRef(initial){const i=index++;if(!(i in hooks))hooks[i]={current:initial};return hooks[i]}}
 const cache=new Map()
 function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports)
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,console,AbortController,setTimeout,clearTimeout,crypto:{randomUUID:()=> '99999999-9999-4999-8999-'+String(++uuid).padStart(12,'0')},fetch:()=>{throw Error('Il coordinatore non deve conoscere HTTP')},require:name=>name==='react'?react:load(path.resolve(path.dirname(file),name)+'.ts')});return exports}
 const engine=load(path.join(__dirname,'useCoordinatoreRapportinoV1.ts')),bozza=load(path.join(__dirname,'bozzaRapportinoV1.ts'))
 const ctx={autorizzato:true,cantiereId:A,cantiereSelezionatoId:A,dataRapportino:D,operaiDisponibili:[{id:W,nome:'Mario'}],statoRapportino:{cantiereId:A,data:D,richiesta:1,presente:false,versionePrestazioni:null},richiestaStato:{current:1},controlloInCorso:{current:false},salvataggioInCorso:{current:false},statoInCorso:false,salvataggioAttivo:false,
  setStatoRapportino:v=>ctx.statoRapportino=v,setStatoInCorso:v=>ctx.statoInCorso=v,setSalvataggioAttivo:v=>ctx.salvataggioAttivo=v,setMostraForm:v=>aperto=v,setErrore:v=>errore=v,setMessaggioSalvataggio:v=>messaggio=v}
 const render=()=>{index=0;return engine.useCoordinatoreRapportinoV1(ctx,trasporto)}
 return{ctx,render,bozza,uuid:()=>uuid,aperto:()=>aperto,errore:()=>errore,messaggio:()=>messaggio}
}
test('U1: coordinatore senza PIN/HTTP usa trasporto iniettato, intento unico e rilettura',async()=>{
 const calls=[]
 const h=harness({caricaVarianti:async()=>new Response('[]'),salvaStrutturato:async(corpo,signal)=>{calls.push({corpo,signal});return new Response(JSON.stringify(dettagli))},leggiStato:async(input,signal)=>{calls.push({input,signal});return stato()}})
 h.render().apriNuovoV1();assert(h.aperto())
 let b=h.bozza.aggiungiPrestazioneBozza(h.render().bozzaV1,'prima')
 b=h.bozza.modificaPrestazioneBozza(b,'prima',{operaio_id:W,ora_inizio:'07:00',ora_fine:'12:00'})
 h.render().editorProps.onChange({...b,documento:dettagli.documento});h.render().editorProps.onSalva();await flush()
 assert.equal(h.uuid(),1);assert.equal(calls.length,2);assert.equal(calls[0].signal instanceof AbortSignal,true)
 assert.deepEqual(plain(calls[1].input),{cantiere_id:A,data:D,rapportino_id:R});assert.equal(h.ctx.statoRapportino.versionePrestazioni,1)
 assert.equal(h.render().salvatoV1.rapportino_id,R);assert.equal(h.render().riletturaV1Fallita,false);assert(!h.aperto());assert(h.messaggio().includes('30/09/2026'))
 h.render().apriModificaV1();assert(h.aperto());assert.equal(h.render().bozzaV1.revisione_attesa,1)
})
test('U1: retry con trasporto alternativo conserva corpo e richiesta, non richiede contesto portale',async()=>{
 const bodies=[];const h=harness({caricaVarianti:async()=>new Response('[]'),salvaStrutturato:async corpo=>{bodies.push(corpo);throw Error('Trasporto ambiguo')},leggiStato:async()=>stato()})
 h.render().apriNuovoV1();let b=h.bozza.aggiungiPrestazioneBozza(h.render().bozzaV1,'prima');b=h.bozza.modificaPrestazioneBozza(b,'prima',{operaio_id:W,ora_inizio:'07:00',ora_fine:'12:00'})
 h.render().editorProps.onChange(b);h.render().editorProps.onSalva();await flush();assert(h.render().editorProps.retryDisponibile)
 h.render().editorProps.onRetry();await flush();assert.equal(bodies.length,2);assert.equal(bodies[0],bodies[1]);assert.equal(h.uuid(),1)
})
test('U1: confine condiviso senza endpoint/accesso/V0; unico editor esistente',()=>{
 const source=fs.readFileSync(path.join(__dirname,'useCoordinatoreRapportinoV1.ts'),'utf8')
 assert.doesNotMatch(source,/fetch\(|\/api\/|COOKIE|PIN|RapportinoForm|salvaRapportinoPortale/)
 const page=fs.readFileSync(path.join(__dirname,'../../rapportino/page.tsx'),'utf8')
 assert.equal((page.match(/<RapportinoPrestazioniEditorV1\b/g)||[]).length,1)
 assert(page.includes('useCoordinatoreRapportinoV1'));assert(page.includes("fetch('/api/rapportino/accesso'"));assert(page.includes("fetch('/api/rapportino/salva'"))
 assert.doesNotMatch(page,/creaTentativoSalvataggioV1|const salvaBozzaV1|const rileggiSalvatoV1|const caricaVarianti/)
})
test('M1: dettatura attraverso editor reale modifica solo note e invalida intento congelato',async()=>{
 const bodies=[];const h=harness({caricaVarianti:async()=>new Response('[]'),salvaStrutturato:async corpo=>{bodies.push(JSON.parse(corpo));throw Error('Risposta persa')},leggiStato:async()=>stato()})
 h.render().apriNuovoV1();let b=h.bozza.aggiungiPrestazioneBozza(h.render().bozzaV1,'prima');b=h.bozza.modificaPrestazioneBozza(b,'prima',{operaio_id:W,ora_inizio:'07:00',ora_fine:'12:00'})
 h.render().editorProps.onChange({...b,documento:dettagli.documento});h.render().editorProps.onSalva();await flush();assert(h.render().editorProps.retryDisponibile)
 const exports={},jsx=(type,props)=>({type,props})
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../components/RapportinoPrestazioniEditorV1.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n.includes('bozzaRapportinoV1')?h.bozza:n.includes('DettaturaNoteV1')?{default:'DettaturaNoteV1'}:{default:'Squadra',etichettaVarianteBozza:()=>''}})
 const before=plain(h.render().bozzaV1),tree=exports.default(h.render().editorProps)
 const find=n=>Array.isArray(n)?n.flatMap(find):n?.props?[n,...find(n.props.children)]:[]
 find(tree).find(n=>n.type==='DettaturaNoteV1').props.onTesto('Lavori Dettati')
 const after=plain(h.render().bozzaV1);assert.equal(after.documento.note,'Lavori Dettati');assert.deepEqual(after.prestazioni,before.prestazioni);assert.equal(after.documento.materiali,before.documento.materiali);assert.equal(after.documento.quantita_materiali,before.documento.quantita_materiali)
 assert.equal(h.render().editorProps.retryDisponibile,false);h.render().editorProps.onSalva();await flush()
 assert.equal(h.uuid(),2);assert.notEqual(bodies[0].richiesta_id,bodies[1].richiesta_id);assert.equal(bodies[1].documento.note,'Lavori Dettati')
})
