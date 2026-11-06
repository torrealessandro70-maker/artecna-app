/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
const api={};vm.runInNewContext(compile(fs.readFileSync('app/utils/preflightEliminazione.ts','utf8')),{exports:api})
const page=fs.readFileSync('app/page.tsx','utf8').replace(/\r/g,'')
const result=(entity,state='eliminabile')=>({versione:1,entita:entity,id:'00000000-0000-4000-8000-000000000001',stato:state,verifica_completa:state!=='non_verificabile',categorie:state==='bloccato'?['foto']:[],azione_consigliata:state==='eliminabile'?'conferma_eliminazione':state==='bloccato'&&entity==='cantiere'?'segna_concluso':'nessuna',verificato_at:'2026-11-06T12:00:00Z'})
function mount(entity,response){
 const trace=[],id=result(entity).id
 const start=page.indexOf(entity==='cantiere'?'  const eliminaCantiere =':'const eliminaSopralluogo =')
 const end=page.indexOf(entity==='cantiere'?'  const chiudiEliminazioneCantiere':'const generaVociAutomatiche',start)
 const source=page.slice(start,end).trim()+`;globalThis.action=${entity==='cantiere'?'eliminaCantiere':'eliminaSopralluogo'}`
 const context={console,globalThis:null,preflightInCorso:{current:false},invioEliminazioneCantiere:{current:false},eliminazioneCantiere:null,cantieri:[{id,nome:'Cantiere fixture'}],cantieriEliminatiRef:{current:new Set()},alert:()=>trace.push('alert'),confirm:()=>{trace.push('confirm');return false},focusPrimaEliminazione:{current:null},document:{activeElement:null},HTMLElement:class{},sopralluogoAperto:null,
 supabase:{rpc:async(name,args)=>{trace.push(['rpc',name,args]);return response},from:()=>{trace.push('DELETE_FORBIDDEN');throw Error('DELETE non atteso')}},
 richiediPreflight:api.richiediPreflight,eliminazioneConsentita:api.eliminazioneConsentita,
 setEsitoPreflight:e=>trace.push(['blocked',e]),setTestoConfermaCantiere:()=>{},setErroreEliminazioneCantiere:()=>{},setEsitoEliminazioneCantiere:()=>{},setEliminazioneCantiere:e=>trace.push(['confirm-dialog',e])}
 context.globalThis=context;vm.runInNewContext(compile(source),context)
 return {trace,context,run:()=>entity==='cantiere'?context.action('Cantiere fixture',id):context.action(id)}
}
test('Elimina: preflight prima della conferma esistente; Annulla non scrive',async()=>{
 for(const entity of ['cantiere','sopralluogo']){
  const m=mount(entity,{data:result(entity),error:null});await m.run()
  assert.equal(m.trace[0][0],'rpc');assert.equal(m.trace[0][1],'preflight_eliminazione_'+entity)
  assert.equal(entity==='cantiere'?m.trace[1][0]:m.trace[1],entity==='cantiere'?'confirm-dialog':'confirm')
  assert(!m.trace.includes('DELETE_FORBIDDEN'))
 }
})
test('bloccato/non_verificabile: nessuna conferma, DELETE o RPC distruttiva',async()=>{
 for(const e of ['cantiere','sopralluogo'])for(const state of ['bloccato','non_verificabile']){
  const m=mount(e,{data:result(e,state),error:null});await m.run();assert.equal(m.trace[1][0],'blocked');assert.equal(m.trace[1][1].stato,state)
  assert.equal(m.trace.length,2)
 }
})
test('risposta malformata, errore RPC, rete o identita diversa bloccano senza dettagli grezzi',async()=>{
 for(const e of ['cantiere','sopralluogo']){
  const good=result(e)
  for(const data of [null,[],{}, {...good,id:'other'},{...good,versione:2},{...good,verifica_completa:false},{...good,categorie:['segreto']},{...good,verificato_at:'no'},{...good,stato:'bloccato'},{...good,verifica_completa:1}]){
   const r=await api.richiediPreflight({rpc:async()=>({data,error:null})},e,good.id);assert.equal(r.stato,'non_verificabile')
  }
  const m=mount(e,{data:good,error:{message:'SQL segreto'}});await m.run();assert.equal(m.trace[1][1].stato,'non_verificabile');assert(!JSON.stringify(m.trace).includes('SQL segreto'))
  const r=await api.richiediPreflight({rpc:async()=>{throw Error('network')}},e,good.id);assert.equal(r.stato,'non_verificabile')
 }
})
test('doppio click concorrente: una sola RPC; nessun token persistente',async()=>{
 const m=mount('sopralluogo',{data:result('sopralluogo','bloccato'),error:null});await Promise.all([m.run(),m.run()]);assert.equal(m.trace.filter(x=>x[0]==='rpc').length,1);assert.equal(m.context.preflightInCorso.current,false)
})
test('DELETE diretto Sopralluogo e RPC distruttiva Cantiere rimangono invariati rispetto al parent',()=>{
 const cp=require('node:child_process'),old=cp.execFileSync('git',['show','4f147d38aef416e36c8bfe86c51f7a2239aee766:app/page.tsx'],{encoding:'utf8'}).replace(/\r/g,'')
 const slice=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a))).replace(/\r/g,'')
 assert.equal(slice(page,"  const conferma = confirm(\n",'const generaVociAutomatiche'),slice(old,"  const conferma = confirm(\n",'const generaVociAutomatiche'))
 const destructive=s=>{const ast=ts.createSourceFile('page.tsx',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found;const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='eseguiEliminazioneCantiere')found=n.getText(ast);ts.forEachChild(n,visit)};visit(ast);assert(found);return found}
 assert.equal(destructive(page),destructive(old))
})
test('UI categorie leggibili; Segna come concluso apre solo la modifica locale esistente',()=>{
 const exports={},jsx=(type,props)=>({type,props})
 vm.runInNewContext(compile(fs.readFileSync('app/components/PreflightEliminazioneDialog.tsx','utf8')),{exports,require:id=>id==='react'?{useRef:()=>({current:null}),useEffect:()=>{}}:id==='react/jsx-runtime'?{jsx,jsxs:jsx}:api})
 const nodes=x=>Array.isArray(x)?x.flatMap(nodes):x?.props?[x,...nodes(x.props.children)]:[]
 const text=x=>Array.isArray(x)?x.map(text).join(''):x?.props?text(x.props.children):typeof x==='string'?x:''
 let closed=0,proposed=0
 const tree=exports.default({esito:{...result('cantiere','bloccato'),categorie:['sal','economia','quaderno']},onChiudi:()=>closed++,onSegnaConcluso:()=>proposed++})
 assert(text(tree).includes('SAL e relative sorgenti'));assert(text(tree).includes('Economia e raccolte'));assert(!text(tree).includes('Elimina forzatamente'))
 nodes(tree).find(n=>n.type==='button'&&text(n)==='Segna come concluso').props.onClick();assert.equal(proposed,1)
 nodes(tree).find(n=>n.type==='button'&&text(n)==='Chiudi').props.onClick();assert.equal(closed,1)
 const block=page.slice(page.indexOf('onSegnaConcluso={esitoPreflight'),page.indexOf('{eliminazioneCantiere && ('))
 assert(block.includes('preparaModificaRegistroCantiere(c)'));assert(block.includes('setCantiereRegistroConcluso(true)'));assert(!/supabase|salvaModifica|\.update\(/.test(block))
})
