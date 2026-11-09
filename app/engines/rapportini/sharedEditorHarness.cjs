/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',R='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',W='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',V='cccccccc-cccc-4ccc-8ccc-cccccccccccc',D='2026-09-21'
const jsx=(type,props)=>({type,props}),plain=x=>JSON.parse(JSON.stringify(x))
function loader(react={}){
 const cache=new Map()
 const load=file=>{file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports)
 const src=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText
 vm.runInNewContext(src,{exports,fetch:()=>{throw Error("Network forbidden in local tests")},Response,Request,DOMException,AbortController,setTimeout,clearTimeout,console,crypto:globalThis.crypto,require:n=>{
  if(n==='react')return react;if(n==='react/jsx-runtime')return{jsx,jsxs:jsx,Fragment:'fragment'}
  if(n.includes('RapportinoPrestazioniEditorV1'))return{default:'prestazioni-editor'}
  if(!n.startsWith('.'))throw Error('Unexpected import '+n)
  const base=path.resolve(path.dirname(file),n);return load(fs.existsSync(base+'.ts')?base+'.ts':base+'.tsx')
 }});return exports};return n=>load(path.resolve(__dirname,n))
}
const details=(rev=1)=>({versione_contratto:2,rapportino_id:R,cantiere_id:A,data:D,revisione:rev,documento:{note:'Note'},prestazioni:[],versione_materiali:1,materiali:[],riepilogo_materiali:{totale_materiali_valorizzati:'0.00',numero_materiali_da_valorizzare:0,valorizzazione_completa:true},documento_legacy_materiali:{materiali:'Storico',quantita_materiali:'Due sacchi'}})
const state=d=>({versione_lettura:2,cantiere_id:A,data:D,presente:!!d,versione_prestazioni:d?1:null,rapportino_id:d?R:null,dettaglio:d??null})
function harness({seed=state(),transport,onSaved=()=>{}}={}){
 const hooks=[],effects=[];let index=0,result,closed=0,opened=true,error='',message=''
 const react={useState(initial){const i=index++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return[hooks[i],v=>{hooks[i]=typeof v==='function'?v(hooks[i]):v}]},useRef(initial){const i=index++;if(!(i in hooks))hooks[i]={current:initial};return hooks[i]},useEffect(fn,deps){const i=index++,old=hooks[i];if(!old||deps.some((d,k)=>d!==old[k])){hooks[i]=deps;effects.push(fn)}}}
 const load=loader(react),component=load('../../components/RapportinoStrutturatoEditorV1.tsx').default
 const ctx={autorizzato:true,cantiereId:A,cantiereSelezionatoId:A,dataRapportino:D,operaiDisponibili:[{id:W,nome:'Mario'}],statoRapportino:{cantiereId:A,data:D,richiesta:1,presente:seed.presente,versionePrestazioni:seed.versione_prestazioni,rapportinoId:seed.rapportino_id??undefined,revisione:seed.dettaglio?.revisione},richiestaStato:{current:1},controlloInCorso:{current:false},salvataggioInCorso:{current:false},statoInCorso:false,salvataggioAttivo:false,setStatoRapportino:v=>ctx.statoRapportino=v,setStatoInCorso:v=>ctx.statoInCorso=v,setSalvataggioAttivo:v=>ctx.salvataggioAttivo=v,setMostraForm:v=>opened=v,setErrore:v=>error=v,setMessaggioSalvataggio:v=>message=v}
 const read=()=>new Response(JSON.stringify(seed));transport??={leggiStato:read,leggiStatoV2:read,caricaVarianti:async()=>new Response(JSON.stringify({varianti:[]})),salvaStrutturato:async()=>{throw Error('No save expected')}}
 const render=()=>{index=0;component({canale:'desktop',cantiereId:A,data:D,trasporto:transport,contesto:ctx,letturaIniziale:seed,onClose:()=>closed++,onSaved,children:v=>{result=v;return v.editor}});while(effects.length)effects.shift()();return result}
 render();render()
 return{render,load,ctx,closed:()=>closed,opened:()=>opened,error:()=>error,message:()=>message}
}
const flush=()=>new Promise(resolve=>setTimeout(resolve,30))
module.exports={loader,harness,details,state,plain,flush,A,R,W,V,D}
