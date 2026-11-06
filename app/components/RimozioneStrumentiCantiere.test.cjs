/* eslint-disable @typescript-eslint/no-require-imports -- Regressioni offline; nessun DB. */
const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm'),ts=require('typescript')
const base='fd812d09248a5848a8a2ee3eab6b9a778f65dde1'
const read=f=>fs.readFileSync(f,'utf8').replace(/\r/g,'')
const old=f=>cp.execFileSync('git',['show',base+':'+f],{encoding:'utf8'}).replace(/\r/g,'')
const parse=s=>ts.createSourceFile('p.tsx',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
function elements(s,name){const f=parse(s),out=[];function visit(n){if((ts.isJsxSelfClosingElement(n)||ts.isJsxOpeningElement(n))&&n.tagName.getText(f)===name)out.push(n);ts.forEachChild(n,visit)}visit(f);return {f,nodes:out}}
function sources(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?sources(path.join(dir,x.name)):/\.(tsx?|jsx?)$/.test(x.name)?[path.join(dir,x.name)]:[])}
test('app attiva: nessuna etichetta, import o mount del contenitore legacy',()=>{
 assert(!fs.existsSync('app/components/CantieriContainer.tsx'))
 for(const file of sources('app').concat(sources('lib'))){const s=read(file);assert(!s.includes('Altri strumenti del cantiere'),file);assert(!s.includes('CantieriContainer'),file);assert(!s.includes('soloCantiereCorrente'),file)}
})
test('la Scheda riceve gli stessi valori del wrapper precedente, senza pannello duplicato',()=>{
 const before=elements(old('app/page.tsx'),'CantieriContainer'),after=elements(read('app/page.tsx'),'CantieriSchedaPanel')
 assert.equal(before.nodes.length,1);assert.equal(after.nodes.length,1)
 const attrs=(result)=>result.nodes[0].attributes.properties.map(n=>n.getText(result.f))
 assert.deepEqual(attrs(after),attrs(before),'anche oggetti panelProps, UUID e callback restano identici')
 const props=Object.fromEntries(before.nodes[0].attributes.properties.map(n=>[n.name.getText(before.f),'fixture:'+n.name.getText(before.f)]))
 const exports={},jsx=(type,props)=>({type,props})
 const code=ts.transpileModule(old('app/components/CantieriContainer.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
 vm.runInNewContext(code,{exports,require:id=>id==='react/jsx-runtime'?{jsx,jsxs:jsx}:{default:id}})
 const nodes=x=>Array.isArray(x)?x.flatMap(nodes):x?.props?[x,...nodes(x.props.children)]:[]
 const forwarded=nodes(exports.default(props)).find(n=>n.type==='./CantieriSchedaPanel').props
 assert.deepEqual({...forwarded},props)
})
test('page: solo import e mount sostituiti; reader/writer, preflight, handler, stato e navigazione invariati',()=>{
 const expected=old('app/page.tsx').replace("import CantieriContainer from './components/CantieriContainer'\n",'').replace('<CantieriContainer','<CantieriSchedaPanel')
 assert.equal(read('app/page.tsx'),expected)
})
test('Economia attiva resta raggiungibile separatamente; rimosso soltanto il flag del duplicato',()=>{
 const file='app/components/CantieriEconomiaPanel.tsx'
 const expected=old(file).replace('{!p.soloCantiereCorrente && <EconomiaSelezioneCantierePanel','<EconomiaSelezioneCantierePanel').replace(/(buttonSecondary=\{p\.buttonSecondary\}\n\s*)\/>\}/,'$1/>')
 assert.equal(read(file),expected)
 const page=read('app/page.tsx');assert.equal(elements(page,'CantieriEconomiaPanel').nodes.length,1)
 assert(page.includes("{vistaCantieriAttiva === 'economia' && (\n<CantieriEconomiaPanel"))
 assert(page.includes("{vistaCantieriAttiva === 'scheda' && (\n<>\n<CantieriSchedaPanel"))
})
test('nessuna rimozione di componenti condivisi: tutti i flussi attuali conservati byte per byte',()=>{
 for(const name of ['CantieriSchedaPanel','CantieriElencoPanel','CantieriAnalisiDocumentoPanel','RapportiniCantierePanel','RapportiniPanel','AttrezzatureCantierePanel','MaterialiCantierePanel','EconomiaCantierePanel','VariantiCantierePanel','DocumentiCantierePanel','FascicoloCantiereContainer','TimelineCantierePanel','SopralluoghiList','QuadernoProgettiPanel','DashboardEconomiaPanel','SalDettagliatoPanel','AccontiEconomiaPanel']){
  const f='app/components/'+name+'.tsx';assert.equal(read(f),old(f),name)
 }
})
test('nessuna modifica Supabase, schema, RPC, ENV, Login/Auth o repository condivisi',()=>{
 const changed=cp.execFileSync('git',['diff','--name-only',base,'--','supabase','lib','app/engines','app/hooks','.env*','app/components/LoginForm.tsx','package.json','package-lock.json'],{encoding:'utf8'}).trim()
 assert.equal(changed,'')
})
